// Correção de ficha e ciclo de vida do participante de teste (F1-T05, CA-1-09).
// Cada alteração grava um evento append-only com ator e data; a origem
// (evento participant_registered) nunca é apagada ou editada.
routerAdd(
  'PATCH',
  '/backend/v1/test-participants/{id}',
  (e) => {
    const participantId = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const displayName = String(body.display_name || '').trim()
    const action = String(body.action || '').trim()
    const reason = String(body.reason || '').trim()

    if (!displayName && !action) {
      return e.json(400, { error: 'informe display_name ou action' })
    }
    if (action && action !== 'cancel' && action !== 'reopen') {
      return e.json(400, { error: 'action deve ser cancel ou reopen' })
    }
    if (action && !reason) {
      return e.json(400, { error: 'motivo operacional sintético é obrigatório' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion corrige a ficha', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')

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
    const changed = {}

    if (displayName && displayName !== participant.getString('display_name')) {
      changed.display_name = displayName
      participant.set('display_name', displayName)
    }

    let eventType = 'participant_updated'
    if (action === 'cancel') {
      if (participant.getString('lifecycle_status') === 'cancelled') {
        return e.json(409, { error: 'participante já está cancelado' })
      }
      participant.set('lifecycle_status', 'cancelled')
      changed.lifecycle_status = 'cancelled'
      changed.reason = reason
      eventType = 'participant_cancelled'
    } else if (action === 'reopen') {
      if (participant.getString('lifecycle_status') !== 'cancelled') {
        return e.json(409, { error: 'somente participante cancelado pode ser reaberto' })
      }
      participant.set('lifecycle_status', 'reopened')
      changed.lifecycle_status = 'reopened'
      changed.reason = reason
      eventType = 'participant_reopened'
    }

    if (Object.keys(changed).length === 0) {
      return e.json(400, { error: 'nenhuma alteração a registrar' })
    }

    $app.save(participant)

    const event = new Record($app.findCollectionByNameOrId('test_participant_events'))
    event.set('event_id', 'evt-' + $security.randomString(12))
    event.set('participant_id', participant.id)
    event.set('actor_id', auth.id)
    event.set('event_type', eventType)
    event.set('request_id', requestId)
    event.set('changed_fields', JSON.stringify(changed))
    $app.save(event)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'update-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_participants')
    audit.set('target_id', participant.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.09')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(200, {
      participant_id: participant.id,
      display_name: participant.getString('display_name'),
      lifecycle_status: participant.getString('lifecycle_status'),
      event_id: event.id,
      event_type: eventType,
      request_id: requestId,
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
