// Registro da decisão de triagem (F2-T04, plano oficial fase_2.md SHA cc435e3a).
// O champion autenticado registra a decisão sobre uma ficha da fila do SEU
// tenant; o tenant vem SEMPRE da sessão (nunca do corpo). O sistema nunca
// decide sozinho: toda decisão tem quem decidiu (decided_by = sessão),
// quando (created) e por quê (reason obrigatória). Append-only (Opção A):
// cada nova decisão é um novo registro; a anterior nunca é apagada ou
// editada. A decisão atualiza o estado da ficha para screened.
routerAdd(
  'POST',
  '/backend/v1/test-screening-decisions',
  (e) => {
    const body = e.requestInfo().body || {}
    const submissionId = String(body.submission_id || '').trim()
    const decision = String(body.decision || '').trim()
    const reason = String(body.reason || '').trim()

    if (!submissionId) {
      return e.json(400, { error: 'submission_id é obrigatório' })
    }
    if (decision !== 'elegivel' && decision !== 'nao_elegivel' && decision !== 'pendente') {
      return e.json(400, { error: 'decision deve ser elegivel, nao_elegivel ou pendente' })
    }
    if (!reason) {
      return e.json(400, { error: 'justificativa (reason) é obrigatória' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion decide a triagem', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    let submission
    try {
      submission = $app.findRecordById('test_screening_submissions', submissionId)
    } catch (_) {
      return e.json(404, { error: 'ficha de triagem não encontrada' })
    }

    if (submission.getString('tenant_id') !== authTenant) {
      return e.json(403, {
        error: 'recurso fora do contexto autorizado',
        rule_id: 'RN-1.02',
      })
    }

    const requestId = e.request.id || $security.randomString(16)

    const record = new Record($app.findCollectionByNameOrId('test_screening_decisions'))
    record.set('decision_id', 'dec-' + $security.randomString(12))
    record.set('submission_id', submission.id)
    record.set('tenant_id', authTenant)
    record.set('decision', decision)
    record.set('reason', reason)
    record.set('decided_by', auth.id)
    record.set('request_id', requestId)
    $app.save(record)

    // A decisão atualiza o estado da ficha (screening_pending → screened).
    submission.set('status', 'screened')
    $app.save(submission)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'decision-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_screening_decisions')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-2.01')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      decision_id: record.id,
      decision_record_id: record.getString('decision_id'),
      submission_id: submission.id,
      decision: decision,
      reason: reason,
      decided_by: auth.id,
      submission_status: submission.getString('status'),
      request_id: requestId,
      created_at: record.getString('created'),
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)

// Linha do tempo de decisões de uma ficha: somente decisões do tenant da
// sessão, da mais antiga para a mais nova. O tenant vem da sessão; ficha de
// outro tenant responde 404 sem revelar existência (RN-1.02).
routerAdd(
  'GET',
  '/backend/v1/test-screening-decisions/{submissionId}',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'histórico exclusivo de champion', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    const submissionId = e.request.pathValue('submissionId')

    let submission
    try {
      submission = $app.findRecordById('test_screening_submissions', submissionId)
    } catch (_) {
      return e.json(404, { error: 'ficha de triagem não encontrada' })
    }

    if (submission.getString('tenant_id') !== authTenant) {
      return e.json(404, { error: 'ficha de triagem não encontrada' })
    }

    const requestId = e.request.id || $security.randomString(16)
    let records = []
    try {
      records = $app.findRecordsByFilter(
        'test_screening_decisions',
        "submission_id = '" + submissionId.replace(/'/g, "''") + "'",
        'created',
        200,
        0,
      )
    } catch (_) {
      records = []
    }

    const items = records.map((r) => ({
      decision_id: r.id,
      decision_record_id: r.getString('decision_id'),
      decision: r.getString('decision'),
      reason: r.getString('reason'),
      decided_by: r.getString('decided_by'),
      created_at: r.getString('created'),
    }))

    return e.json(200, {
      submission_id: submission.id,
      display_name: submission.getString('display_name'),
      submission_status: submission.getString('status'),
      items: items,
      count: items.length,
      request_id: requestId,
    })
  },
  $apis.requireAuth(),
)
