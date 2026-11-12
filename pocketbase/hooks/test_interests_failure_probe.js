// Demonstração segura de cadastro com falha e nova tentativa (F2-T01, card
// e051cfd3, prova do CA-1-10). O modo de falha é controlado pelo secret
// F2_FAILURE_MODE ("on" = falha ligada; qualquer outro valor = desligada).
// Com a falha LIGADA: a rota tenta gravar um interesse e falha de verdade
// (HTTP 500) sem criar registro e sem confirmação de sucesso.
// Com a falha DESLIGADA: grava normalmente (HTTP 201/200 idempotente) —
// reenvio do mesmo contact_key não cria segunda ficha (deduplicação RN-1.07).
// A falha nunca fica ligada após o teste: só o Maestro altera o secret.
routerAdd(
  'POST',
  '/backend/v1/test-interests-failure-probe',
  (e) => {
    const body = e.requestInfo().body || {}
    const displayName = String(body.display_name || '').trim()
    const contactKey = String(body.contact_key || '').trim()

    if (!displayName || !contactKey) {
      return e.json(400, { error: 'display_name e contact_key são obrigatórios' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'demonstração exclusiva de champion', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    const failureMode = String($secrets.get('F2_FAILURE_MODE') || 'off').toLowerCase()

    if (failureMode === 'on') {
      // Falha real de persistência: grava um registro inválido (tenant_id
      // inexistente viola a constraint da coleção). Nada é criado e nenhuma
      // confirmação de sucesso é enviada (CA-1-10).
      const requestId = e.request.id || $security.randomString(16)
      const broken = new Record($app.findCollectionByNameOrId('test_interests'))
      broken.set('fixture_key', 'interest-' + $security.randomString(10))
      broken.set('contact_key', contactKey.toLowerCase())
      broken.set('display_name', displayName)
      broken.set('status', 'interest_received')
      broken.set('request_id', requestId)
      broken.set('tenant_id', 'tenant-inexistente-f2t01')
      try {
        $app.save(broken)
      } catch (saveError) {
        return e.json(500, {
          error: 'Não foi possível salvar o cadastro (falha simulada e controlada).',
          failure_mode: 'on',
          detail: String(saveError).slice(0, 200),
          request_id: requestId,
        })
      }
      // Se por acaso gravar (não deve acontecer), não confirma como sucesso:
      return e.json(500, {
        error: 'Não foi possível salvar o cadastro (falha simulada e controlada).',
        failure_mode: 'on',
        request_id: requestId,
      })
    }

    // Falha DESLIGADA: grava normalmente com deduplicação (reenvio não cria
    // segunda ficha). Confirmação só após persistência bem-sucedida.
    const normalizedContact = contactKey.toLowerCase()
    const requestId = e.request.id || $security.randomString(16)

    let existing = null
    try {
      existing = $app.findFirstRecordByFilter(
        'test_interests',
        "tenant_id = '" +
          authTenant.replace(/'/g, "''") +
          "' && contact_key = '" +
          normalizedContact.replace(/'/g, "''") +
          "'",
      )
    } catch (_) {
      existing = null
    }

    if (existing) {
      return e.json(200, {
        duplicate: true,
        interest_id: existing.id,
        display_name: existing.getString('display_name'),
        contact_key: existing.getString('contact_key'),
        status: existing.getString('status'),
        request_id: requestId,
        created_at: existing.getString('created'),
      })
    }

    const record = new Record($app.findCollectionByNameOrId('test_interests'))
    record.set('fixture_key', 'interest-' + $security.randomString(10))
    record.set('contact_key', normalizedContact)
    record.set('display_name', displayName)
    record.set('status', 'interest_received')
    record.set('request_id', requestId)
    record.set('tenant_id', authTenant)
    $app.save(record)

    return e.json(201, {
      duplicate: false,
      interest_id: record.id,
      display_name: record.getString('display_name'),
      contact_key: record.getString('contact_key'),
      status: record.getString('status'),
      request_id: requestId,
      created_at: record.getString('created'),
    })
  },
  $apis.requireAuth(),
)
