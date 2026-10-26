// Promoção de interesse de teste a participante (F1-T05, CA-1-08).
// Idempotente por interest_id: reenvio retorna o participante existente.
// O tenant vem SEMPRE da sessão; cada criação grava evento append-only.
routerAdd(
  'POST',
  '/backend/v1/test-participants',
  (e) => {
    const body = e.requestInfo().body || {}
    const interestId = String(body.interest_id || '').trim()
    if (!interestId) {
      return e.json(400, { error: 'interest_id é obrigatório' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion promove participante', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')

    let interest
    try {
      interest = $app.findRecordById('test_interests', interestId)
    } catch (_) {
      return e.json(404, { error: 'interesse não encontrado' })
    }

    if (interest.getString('tenant_id') !== authTenant) {
      return e.json(403, {
        error: 'recurso fora do contexto autorizado',
        rule_id: 'RN-1.02',
      })
    }

    // Idempotência: mesmo interest_id retorna o participante existente.
    let existing = null
    try {
      existing = $app.findFirstRecordByFilter(
        'test_participants',
        "interest_id = '" + interestId.replace(/'/g, "''") + "'",
      )
    } catch (_) {
      existing = null
    }

    const requestId = e.request.id || $security.randomString(16)

    if (existing) {
      return e.json(200, {
        participant_id: existing.id,
        fixture_key: existing.getString('fixture_key'),
        display_name: existing.getString('display_name'),
        contact_key: existing.getString('contact_key'),
        lifecycle_status: existing.getString('lifecycle_status'),
        interest_id: interestId,
        request_id: requestId,
        created_at: existing.getString('created'),
        already_registered: true,
      })
    }

    const record = new Record($app.findCollectionByNameOrId('test_participants'))
    record.set('fixture_key', 'participant-' + $security.randomString(10))
    record.set('tenant_id', authTenant)
    record.set('interest_id', interestId)
    record.set('display_name', interest.getString('display_name'))
    record.set('contact_key', interest.getString('contact_key'))
    record.set('lifecycle_status', 'participant_registered')
    $app.save(record)

    const event = new Record($app.findCollectionByNameOrId('test_participant_events'))
    event.set('event_id', 'evt-' + $security.randomString(12))
    event.set('participant_id', record.id)
    event.set('actor_id', auth.id)
    event.set('event_type', 'participant_registered')
    event.set('request_id', requestId)
    event.set('changed_fields', JSON.stringify({ display_name: record.getString('display_name') }))
    $app.save(event)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'promote-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_participants')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.08')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      participant_id: record.id,
      fixture_key: record.getString('fixture_key'),
      display_name: record.getString('display_name'),
      contact_key: record.getString('contact_key'),
      lifecycle_status: record.getString('lifecycle_status'),
      interest_id: interestId,
      request_id: requestId,
      created_at: record.getString('created'),
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
