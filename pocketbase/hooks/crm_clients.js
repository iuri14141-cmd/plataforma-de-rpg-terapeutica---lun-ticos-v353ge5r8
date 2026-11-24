// Rota /backend/v1/clients — sincronização incremental com a API do CRM.
//
// Fluxo (instruções do endpoint seguidas à risca):
//   1ª interação — chamada SEM parâmetros: recebe todos os clientes do CRM.
//   Chamadas seguintes — incremental: chama com ?since=<maior updated já
//   recebido>, então o CRM devolve só as novidades/alterações.
//
// Cada resposta é gravada na coleção local `crm_clients` (upsert pelo id do
// CRM) e o maior `updated` recebido fica salvo em `crm_sync_state` (chave
// única "default"), para a próxima sincronização. Se o CRM falhar, servimos
// a cópia local marcada como "stale" (aviso no corpo da resposta).
//
// A chave de API (X-API-Key) NUNCA chega ao navegador: ela é lida aqui, no
// backend, via secret CHAVECRM, e usada apenas na chamada de saída ao CRM.
routerAdd(
  'GET',
  '/backend/v1/clients',
  (e) => {
    // O CRM manda "2026-11-23 14:42:44.832Z" (espaço em vez de "T"). Para
    // comparar e enviar de volta como ?since=, normalizamos para
    // "2026-11-23T14:42:44.832Z" e mantemos UTC.
    function normalizeCrmTimestamp(value) {
      const raw = String(value ?? '').trim()
      if (!raw) return ''
      const normalized = raw.replace(' ', 'T')
      const parsed = new Date(normalized)
      if (Number.isNaN(parsed.getTime())) return raw
      return parsed.toISOString()
    }

    // ISO UTC compara como texto — max com ordem estável.
    function maxTimestamp(a, b) {
      if (!a) return b || ''
      if (!b) return a
      return a > b ? a : b
    }

    const apiKey = $os.getenv('CHAVECRM')
    if (!apiKey) {
      console.warn('[clientes] secret CHAVECRM ausente no backend')
      return e.json(500, {
        error:
          'Integração com o CRM não configurada: o secret CHAVECRM está ausente. Avise o responsável pela plataforma.',
      })
    }

    // ----- estado da sincronização (maior updated já recebido) -----
    let since = ''
    let stateRecord = null
    try {
      stateRecord = $app.findFirstRecordByFilter('crm_sync_state', "key = 'default'")
      since = normalizeCrmTimestamp(stateRecord.getString('last_updated'))
    } catch (_) {
      // Sem estado salvo ainda: primeira sincronização — chama sem parâmetros.
    }

    // Se o CRM falhou mas já existe cópia local, servimos os dados salvos
    // marcados como "stale" em vez de deixar a aba vazia.
    function serveLocalCopy(fallbackMessage) {
      let local = []
      try {
        local = $app.findRecordsByFilter('crm_clients', '', '-crm_updated', 500, 0)
      } catch (_) {
        local = []
      }
      if (local.length === 0) {
        return e.json(502, { error: fallbackMessage })
      }
      const localClients = local.map((record) => ({
        id: record.getString('crm_id'),
        name: record.getString('name'),
        email: record.getString('email'),
        phone: record.getString('phone'),
        updated_at: record.getString('crm_updated'),
      }))
      return e.json(200, {
        clients: localClients,
        total: localClients.length,
        count: localClients.length,
        created: 0,
        updated: 0,
        synced_at: stateRecord ? stateRecord.getString('last_synced_at') : '',
        stale: true,
        error: fallbackMessage,
      })
    }

    const url =
      'https://instrucoes-do-arquivo-anexo-2dbe9.shrd01.internal.goskip.dev/backend/v1/clients' +
      (since ? '?since=' + encodeURIComponent(since) : '')

    let res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
        timeout: 15, // segundos
      })
    } catch (err) {
      console.warn('[clientes] falha de rede ao chamar o CRM: ' + err)
      return serveLocalCopy(
        'O CRM está fora do ar ou não respondeu a tempo. Exibindo a cópia local (pode estar desatualizada).',
      )
    }

    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn('[clientes] CRM recusou a chave de API (status ' + res.statusCode + ')')
      return serveLocalCopy(
        'O CRM recusou a chave de API. Confira o secret CHAVECRM. Exibindo a cópia local (pode estar desatualizada).',
      )
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.warn('[clientes] CRM respondeu status inesperado ' + res.statusCode)
      return serveLocalCopy(
        'O CRM respondeu um erro inesperado (status ' +
          res.statusCode +
          '). Exibindo a cópia local (pode estar desatualizada).',
      )
    }

    const raw = res.json
    const source = raw && typeof raw === 'object' ? raw : null
    const list = source && Array.isArray(source.clients) ? source.clients : null

    if (!list) {
      console.warn('[clientes] CRM devolveu um formato inesperado de resposta')
      return serveLocalCopy(
        'O CRM devolveu uma resposta em formato inesperado. Avise o responsável pela plataforma. Exibindo a cópia local (pode estar desatualizada).',
      )
    }

    // ----- upsert local + cálculo do novo maior "updated" -----
    let maxUpdated = since
    const clients = []
    let createdCount = 0
    let updatedCount = 0

    list.forEach((item, index) => {
      const obj = item && typeof item === 'object' ? item : {}
      const crmId = String(obj.id ?? '').trim()
      const email = String(obj.email ?? '').trim()
      const name = String(obj.name ?? '').trim()
      const phone = String(obj.phone ?? '').trim()
      const updatedAt = normalizeCrmTimestamp(obj.updated ?? obj.updated_at)

      maxUpdated = maxTimestamp(maxUpdated, updatedAt)

      if (!crmId) {
        console.warn('[clientes] registro do CRM sem id, ignorado (linha ' + (index + 1) + ')')
        return
      }

      const fallbackName = name || (email ? email.split('@')[0] : 'Cliente sem nome')

      try {
        const existing = $app.findFirstRecordByFilter('crm_clients', 'crm_id = {:id}', {
          id: crmId,
        })
        // Upsert: só regrava quando o `updated` do CRM mudou de verdade.
        if (existing.getString('crm_updated') !== updatedAt) {
          existing.set('name', fallbackName)
          existing.set('email', email)
          existing.set('phone', phone)
          existing.set('crm_updated', updatedAt)
          $app.save(existing)
          updatedCount++
        }
      } catch (_) {
        const record = new Record($app.findCollectionByNameOrId('crm_clients'))
        record.set('crm_id', crmId)
        record.set('name', fallbackName)
        record.set('email', email)
        record.set('phone', phone)
        record.set('crm_updated', updatedAt)
        $app.save(record)
        createdCount++
      }

      clients.push({
        id: crmId,
        name: fallbackName,
        email: email,
        phone: phone,
        updated_at: updatedAt,
      })
    })

    // ----- grava o novo estado (maior updated) -----
    const nowIso = new Date().toISOString()
    try {
      if (stateRecord) {
        stateRecord.set('last_updated', maxUpdated)
        stateRecord.set('last_synced_at', nowIso)
        $app.save(stateRecord)
      } else {
        const record = new Record($app.findCollectionByNameOrId('crm_sync_state'))
        record.set('key', 'default')
        record.set('last_updated', maxUpdated)
        record.set('last_synced_at', nowIso)
        $app.save(record)
      }
    } catch (err) {
      // Não derruba a resposta por causa do estado; só registra.
      console.warn('[clientes] não foi possível salvar o estado da sincronização: ' + err)
    }

    return e.json(200, {
      clients: clients,
      total: Number(source.total ?? clients.length) || clients.length,
      count: list.length,
      created: createdCount,
      updated: updatedCount,
      synced_at: nowIso,
      stale: false,
    })
  },
  $apis.requireAuth(),
)
