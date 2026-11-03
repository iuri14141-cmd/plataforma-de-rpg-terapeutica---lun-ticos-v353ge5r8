// Ciclo de vida da missão de teste (F1-T07, CA-1-11 e CA-1-15).
// Transições válidas: rascunho→ativa, ativa→pausada, pausada→ativa,
// ativa/pausada→cancelada, cancelada→rascunho (reopen). Cada mudança grava
// evento append-only com before/after status, ator e request_id. Nenhuma
// sessão, prontidão, convite ou composição automática é criada.
routerAdd(
  'PATCH',
  '/backend/v1/test-missions/{id}',
  (e) => {
    const missionId = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const action = String(body.action || '').trim()

    if (action !== 'activate' && action !== 'pause' && action !== 'cancel' && action !== 'reopen') {
      return e.json(400, { error: 'action deve ser activate, pause, cancel ou reopen' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion altera a missão', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')

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

    const currentStatus = mission.getString('status')
    const transitions = {
      activate: { from: ['rascunho', 'pausada'], to: 'ativa', event: 'mission_activated' },
      pause: { from: ['ativa'], to: 'pausada', event: 'mission_paused' },
      cancel: {
        from: ['ativa', 'pausada', 'rascunho'],
        to: 'cancelada',
        event: 'mission_cancelled',
      },
      reopen: { from: ['cancelada'], to: 'rascunho', event: 'mission_reopened' },
    }

    const transition = transitions[action]
    if (transition.from.indexOf(currentStatus) === -1) {
      return e.json(409, {
        error: 'transição inválida de ' + currentStatus + ' via ' + action,
      })
    }

    const requestId = e.request.id || $security.randomString(16)
    mission.set('status', transition.to)
    $app.save(mission)

    const event = new Record($app.findCollectionByNameOrId('test_mission_events'))
    event.set('event_id', 'evt-' + $security.randomString(12))
    event.set('mission_id', mission.id)
    event.set('actor_id', auth.id)
    event.set('event_type', transition.event)
    event.set('before_status', currentStatus)
    event.set('after_status', transition.to)
    event.set('request_id', requestId)
    $app.save(event)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'mission-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_missions')
    audit.set('target_id', mission.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.15')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(200, {
      mission_id: mission.id,
      title: mission.getString('title'),
      status: mission.getString('status'),
      before_status: currentStatus,
      event_id: event.id,
      event_type: transition.event,
      request_id: requestId,
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
