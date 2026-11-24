// Criação de missão de teste (F1-T07, CA-1-11) + campanha de grupo (F2-T05).
// O champion autenticado cria uma missão no tenant da sessão com modalidade
// individual/grupo e objetivo não vazio; a missão inicia SEMPRE em rascunho.
// Campanha de grupo (F2-T05): modalidade grupo exige os parâmetros de negócio
// definidos pelo Champion — group_min 3, group_max 6, sessions_total 12 e
// frequency semanal (gravados server-side; o cliente não define os valores).
// Sem sessão, prontidão, convite ou composição automática (CA-1-15).
// A confirmação só é enviada após a persistência do registro e do evento.
routerAdd(
  'POST',
  '/backend/v1/test-missions',
  (e) => {
    const body = e.requestInfo().body || {}
    const title = String(body.title || '').trim()
    const modality = String(body.modality || '').trim()
    const objective = String(body.objective || '').trim()

    if (!title || !modality || !objective) {
      return e.json(400, { error: 'title, modality e objective são obrigatórios' })
    }
    if (modality !== 'individual' && modality !== 'grupo') {
      return e.json(400, { error: 'modality deve ser individual ou grupo' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion cria missão', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    const requestId = e.request.id || $security.randomString(16)

    // Parâmetros de campanha de grupo (F2-T05): definidos pelo Champion
    // (3 a 6 pessoas, 12 encontros, semanal) e gravados server-side. O
    // cliente não envia os valores; a missão individual não os recebe.
    let groupMin = 0
    let groupMax = 0
    let sessionsTotal = 0
    let frequency = ''
    if (modality === 'grupo') {
      groupMin = 3
      groupMax = 6
      sessionsTotal = 12
      frequency = 'semanal'
    }

    const record = new Record($app.findCollectionByNameOrId('test_missions'))
    record.set('fixture_key', 'mission-' + $security.randomString(10))
    record.set('tenant_id', authTenant)
    record.set('title', title)
    record.set('modality', modality)
    record.set('objective', objective)
    record.set('status', 'rascunho')
    record.set('created_by', auth.id)
    if (modality === 'grupo') {
      record.set('group_min', groupMin)
      record.set('group_max', groupMax)
      record.set('sessions_total', sessionsTotal)
      record.set('frequency', frequency)
    }
    $app.save(record)

    const event = new Record($app.findCollectionByNameOrId('test_mission_events'))
    event.set('event_id', 'evt-' + $security.randomString(12))
    event.set('mission_id', record.id)
    event.set('actor_id', auth.id)
    event.set('event_type', 'mission_created')
    event.set('before_status', 'rascunho')
    event.set('after_status', 'rascunho')
    event.set('request_id', requestId)
    $app.save(event)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'mission-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_missions')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.11')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      mission_id: record.id,
      fixture_key: record.getString('fixture_key'),
      title: record.getString('title'),
      modality: record.getString('modality'),
      objective: record.getString('objective'),
      status: record.getString('status'),
      tenant_id: authTenant,
      group_min: groupMin,
      group_max: groupMax,
      sessions_total: sessionsTotal,
      frequency: frequency,
      request_id: requestId,
      created_at: record.getString('created'),
      event_id: event.id,
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
