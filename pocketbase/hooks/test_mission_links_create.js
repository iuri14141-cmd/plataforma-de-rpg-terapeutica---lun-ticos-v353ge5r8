// Vínculo manual missão–participante (F1-T08, CA-1-12).
// Champion do tenant da sessão associa participante do MESMO tenant a uma
// missão do MESMO tenant. Idempotente: reenvio do par ativo retorna o vínculo
// existente (HTTP 200 already_linked). Vínculo cruzado é negado sem conteúdo
// do alvo e auditado. Confirmação só após persistência do vínculo e do evento.
routerAdd(
  'POST',
  '/backend/v1/test-mission-links',
  (e) => {
    const body = e.requestInfo().body || {}
    const missionId = String(body.mission_id || '').trim()
    const participantId = String(body.participant_id || '').trim()

    if (!missionId || !participantId) {
      return e.json(400, { error: 'mission_id e participant_id são obrigatórios' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion vincula participante', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    let mission
    try {
      mission = $app.findRecordById('test_missions', missionId)
    } catch (_) {
      return e.json(404, { error: 'missão não encontrada' })
    }

    if (mission.getString('tenant_id') !== authTenant) {
      return e.json(403, {
        error: 'recurso fora do contexto autorizado',
        rule_id: 'RN-1.02',
      })
    }

    let participant
    try {
      participant = $app.findRecordById('test_participants', participantId)
    } catch (_) {
      return e.json(404, { error: 'participante não encontrado' })
    }

    if (participant.getString('tenant_id') !== authTenant) {
      return e.json(403, {
        error: 'recurso fora do contexto autorizado',
        rule_id: 'RN-1.02',
      })
    }

    const requestId = e.request.id || $security.randomString(16)

    // Idempotência: par ativo já existe → retorna o vínculo existente.
    let existing = null
    try {
      existing = $app.findFirstRecordByFilter(
        'test_mission_links',
        "mission_id = '" +
          missionId.replace(/'/g, "''") +
          "' && participant_id = '" +
          participantId.replace(/'/g, "''") +
          "' && status = 'active'",
      )
    } catch (_) {
      existing = null
    }

    if (existing) {
      return e.json(200, {
        link_id: existing.id,
        mission_id: missionId,
        participant_id: participantId,
        status: existing.getString('status'),
        linked_by: existing.getString('linked_by'),
        created_at: existing.getString('created'),
        request_id: requestId,
        already_linked: true,
      })
    }

    const record = new Record($app.findCollectionByNameOrId('test_mission_links'))
    record.set('fixture_key', 'link-' + $security.randomString(10))
    record.set('tenant_id', authTenant)
    record.set('mission_id', missionId)
    record.set('participant_id', participantId)
    record.set('status', 'active')
    record.set('linked_by', auth.id)
    $app.save(record)

    const event = new Record($app.findCollectionByNameOrId('test_mission_link_events'))
    event.set('event_id', 'evt-' + $security.randomString(12))
    event.set('link_id', record.id)
    event.set('mission_id', missionId)
    event.set('participant_id', participantId)
    event.set('actor_id', auth.id)
    event.set('event_type', 'link_created')
    event.set('request_id', requestId)
    $app.save(event)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'link-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_mission_links')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.12')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      link_id: record.id,
      mission_id: missionId,
      participant_id: participantId,
      status: record.getString('status'),
      linked_by: auth.id,
      created_at: record.getString('created'),
      request_id: requestId,
      event_id: event.id,
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
