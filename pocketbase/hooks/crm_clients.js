// Rota /backend/v1/clients — proxy para a API de clientes do CRM.
//
// A chave de API (X-API-Key) NUNCA chega ao navegador: ela é lida aqui, no
// backend, via secret CHAVECRM, e usada apenas na chamada de saída ao CRM.
routerAdd(
  'GET',
  '/backend/v1/clients',
  (e) => {
    const apiKey = $os.getenv('CHAVECRM')
    if (!apiKey) {
      console.warn('[clientes] secret CHAVECRM ausente no backend')
      return e.json(500, {
        error:
          'Integração com o CRM não configurada: o secret CHAVECRM está ausente. Avise o responsável pela plataforma.',
      })
    }

    let res
    try {
      res = $http.send({
        url: 'https://instrucoes-do-arquivo-anexo-2dbe9.shrd01.internal.goskip.dev/backend/v1/clients',
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
        timeout: 15, // segundos
      })
    } catch (err) {
      console.warn('[clientes] falha de rede ao chamar o CRM: ' + err)
      return e.json(502, {
        error: 'O CRM está fora do ar ou não respondeu a tempo. Tente novamente em instantes.',
      })
    }

    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn('[clientes] CRM recusou a chave de API (status ' + res.statusCode + ')')
      return e.json(502, {
        error:
          'O CRM recusou a chave de API. Confira se o secret CHAVECRM está com o valor correto.',
      })
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.warn('[clientes] CRM respondeu status inesperado ' + res.statusCode)
      return e.json(502, {
        error:
          'O CRM respondeu um erro inesperado (status ' +
          res.statusCode +
          '). Tente novamente mais tarde.',
      })
    }

    const raw = res.json
    const source = raw && typeof raw === 'object' ? raw : null
    const list = source && Array.isArray(source.clients) ? source.clients : null

    if (!list) {
      console.warn('[clientes] CRM devolveu um formato inesperado de resposta')
      return e.json(502, {
        error:
          'O CRM devolveu uma resposta em formato inesperado. Avise o responsável pela plataforma.',
      })
    }

    // Normalização: o endpoint real devolve { total, count, since, clients:
    // [{id, name, phone, email, updated}] } — campos em ordens diferentes,
    // telefone às vezes vazio. Mantemos o pedido original intacto.
    const clients = list.map((item, index) => {
      const obj = item && typeof item === 'object' ? item : {}
      const name = String(obj.name ?? '').trim()
      const email = String(obj.email ?? '').trim()
      const phone = String(obj.phone ?? '').trim()
      return {
        id: String(obj.id ?? '') || 'crm-' + (index + 1),
        name: name || (email ? email.split('@')[0] : 'Cliente sem nome'),
        email: email,
        phone: phone,
        updated_at: String(obj.updated ?? obj.updated_at ?? '').trim(),
      }
    })

    return e.json(200, {
      clients: clients,
      total: Number(source.total ?? clients.length) || clients.length,
    })
  },
  $apis.requireAuth(),
)
