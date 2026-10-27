// Entrada de interesse de teste (F1-T04/F1-T06, CA-1-06, CA-1-07 e CA-1-10).
// O champion autenticado registra uma solicitação sintética; o tenant vem
// SEMPRE da sessão (nunca do corpo). Deduplicação por tenant + contact_key
// normalizada: reenvio não cria segundo registro e grava duplicate_detected.
// A confirmação só é enviada após a persistência bem-sucedida do registro
// e do evento de auditoria — sem confirmação falsa em falha (RN-1.06/RN-1.10).
routerAdd(
  'POST',
  '/backend/v1/test-interests',
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
      return e.json(403, { error: 'somente champion registra interesse', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    const requestId = e.request.id || $security.randomString(16)
    const normalizedContact = contactKey.toLowerCase()

    // Deduplicação: procura a chave normalizada APENAS no tenant da sessão.
    // A existência em outro tenant nunca é revelada (RN-1.07).
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
      const duplicateEventId = 'dup-' + $security.randomString(12)
      const audit = new Record($app.findCollectionByNameOrId('audit_events'))
      audit.set('event_id', duplicateEventId)
      audit.set('request_id', requestId)
      audit.set('action', 'probe')
      audit.set('target_type', 'test_interests')
      audit.set('target_id', existing.id)
      audit.set('outcome', 'allowed')
      audit.set('rule_id', 'RN-1.07')
      audit.set('actor_id', auth.id)
      audit.set('tenant_id', authTenant)
      $app.save(audit)

      return e.json(200, {
        duplicate: true,
        interest_id: existing.id,
        fixture_key: existing.getString('fixture_key'),
        display_name: existing.getString('display_name'),
        contact_key: existing.getString('contact_key'),
        status: existing.getString('status'),
        request_id: requestId,
        tenant_id: authTenant,
        created_at: existing.getString('created'),
        audit_event_id: audit.id,
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

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'interest-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_interests')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.06')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      duplicate: false,
      interest_id: record.id,
      fixture_key: record.getString('fixture_key'),
      display_name: record.getString('display_name'),
      contact_key: record.getString('contact_key'),
      status: record.getString('status'),
      request_id: requestId,
      tenant_id: authTenant,
      created_at: record.getString('created'),
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
