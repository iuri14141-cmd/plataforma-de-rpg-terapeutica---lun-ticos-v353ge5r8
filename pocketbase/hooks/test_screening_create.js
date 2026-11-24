// Formulário inicial de triagem (F2-T03, plano oficial fase_2.md SHA cc435e3a).
// O champion autenticado registra uma submissão de triagem SINTÉTICA no seu
// tenant; o tenant vem SEMPRE da sessão (nunca do corpo). Sem campo de dado
// de saúde: apenas ciência declarada (Opção A decidida pelo Champion).
// Deduplicação por tenant + contact_key normalizada (RN-1.07): reenvio não
// cria segundo registro e grava duplicate_detected. Confirmação só após a
// persistência do registro e do evento de auditoria (RN-1.06/RN-1.10).
routerAdd(
  'POST',
  '/backend/v1/test-screening-submissions',
  (e) => {
    const body = e.requestInfo().body || {}
    const displayName = String(body.display_name || '').trim()
    const contactKey = String(body.contact_key || '').trim()
    const motivation = String(body.motivation || '').trim()
    const goal = String(body.goal || '').trim()
    const ackNotReplacement = body.ack_not_replacement === true
    const ackNoDiagnosis = body.ack_no_diagnosis === true
    const consentRecording = body.consent_recording === true
    const consentConfidentiality = body.consent_confidentiality === true

    if (!displayName || !contactKey || !motivation || !goal) {
      return e.json(400, {
        error: 'display_name, contact_key, motivation e goal são obrigatórios',
      })
    }
    if (!ackNotReplacement || !ackNoDiagnosis || !consentRecording || !consentConfidentiality) {
      return e.json(400, {
        error: 'todas as declarações de ciência e consentimentos são obrigatórios',
      })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, {
        error: 'somente champion registra triagem de teste',
        rule_id: 'RN-1.03',
      })
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
        'test_screening_submissions',
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
      const duplicateEventId = 'dup-scr-' + $security.randomString(12)
      const audit = new Record($app.findCollectionByNameOrId('audit_events'))
      audit.set('event_id', duplicateEventId)
      audit.set('request_id', requestId)
      audit.set('action', 'probe')
      audit.set('target_type', 'test_screening_submissions')
      audit.set('target_id', existing.id)
      audit.set('outcome', 'allowed')
      audit.set('rule_id', 'RN-1.07')
      audit.set('actor_id', auth.id)
      audit.set('tenant_id', authTenant)
      $app.save(audit)

      return e.json(200, {
        duplicate: true,
        submission_id: existing.id,
        display_name: existing.getString('display_name'),
        contact_key: existing.getString('contact_key'),
        status: existing.getString('status'),
        request_id: requestId,
        tenant_id: authTenant,
        created_at: existing.getString('created'),
        audit_event_id: audit.id,
      })
    }

    const record = new Record($app.findCollectionByNameOrId('test_screening_submissions'))
    record.set('fixture_key', 'screening-' + $security.randomString(10))
    record.set('contact_key', normalizedContact)
    record.set('display_name', displayName)
    record.set('motivation', motivation)
    record.set('goal', goal)
    record.set('ack_not_replacement', ackNotReplacement)
    record.set('ack_no_diagnosis', ackNoDiagnosis)
    record.set('consent_recording', consentRecording)
    record.set('consent_confidentiality', consentConfidentiality)
    record.set('status', 'screening_pending')
    record.set('request_id', requestId)
    record.set('tenant_id', authTenant)
    $app.save(record)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'screening-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_screening_submissions')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.06')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      duplicate: false,
      submission_id: record.id,
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

// Fila de triagem server-side: lista do tenant da sessão, do mais antigo
// para o mais novo, com estado por ficha. O tenant vem da sessão; nenhum
// parâmetro de cliente altera o recorte (RN-1.01/RN-1.02).
routerAdd(
  'GET',
  '/backend/v1/test-screening-queue',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'fila exclusiva de champion', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    const requestId = e.request.id || $security.randomString(16)
    let records = []
    try {
      records = $app.findRecordsByFilter(
        'test_screening_submissions',
        "tenant_id = '" + authTenant.replace(/'/g, "''") + "'",
        'created',
        200,
        0,
      )
    } catch (_) {
      records = []
    }

    const items = records.map((r) => ({
      submission_id: r.id,
      display_name: r.getString('display_name'),
      contact_key: r.getString('contact_key'),
      motivation: r.getString('motivation'),
      goal: r.getString('goal'),
      ack_not_replacement: r.getBool('ack_not_replacement'),
      ack_no_diagnosis: r.getBool('ack_no_diagnosis'),
      consent_recording: r.getBool('consent_recording'),
      consent_confidentiality: r.getBool('consent_confidentiality'),
      status: r.getString('status'),
      created_at: r.getString('created'),
    }))

    return e.json(200, { items: items, count: items.length, request_id: requestId })
  },
  $apis.requireAuth(),
)
