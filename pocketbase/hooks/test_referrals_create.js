// Encaminhamento da ficha elegível (F2-T05, plano oficial fase_2.md SHA cc435e3a).
// O champion autenticado encaminha uma ficha de triagem ELEGÍVEL do SEU tenant
// para atendimento individual ou grupo; o tenant vem SEMPRE da sessão. A
// elegibilidade é decidida server-side pela decisão mais recente da ficha
// (nunca pelo corpo do cliente). Append-only: cada encaminhamento é um novo
// registro com quem encaminhou (referred_by = sessão), quando (created) e por
// quê (reason obrigatória). Auditoria RN-2.02; confirmação só após save.
routerAdd(
  'POST',
  '/backend/v1/test-referrals',
  (e) => {
    const body = e.requestInfo().body || {}
    const submissionId = String(body.submission_id || '').trim()
    const destination = String(body.destination || '').trim()
    const reason = String(body.reason || '').trim()

    if (!submissionId) {
      return e.json(400, { error: 'submission_id é obrigatório' })
    }
    if (destination !== 'individual' && destination !== 'grupo') {
      return e.json(400, { error: 'destination deve ser individual ou grupo' })
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
      return e.json(403, { error: 'somente champion encaminha', rule_id: 'RN-1.03' })
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

    // Elegibilidade decidida server-side: a decisão MAIS RECENTE da ficha
    // (append-only) deve ser elegivel. O cliente não envia elegibilidade.
    let latestDecision = null
    try {
      latestDecision = $app.findFirstRecordByFilter(
        'test_screening_decisions',
        "submission_id = '" + submissionId.replace(/'/g, "''") + "'",
        '-created',
      )
    } catch (_) {
      latestDecision = null
    }

    if (!latestDecision || latestDecision.getString('decision') !== 'elegivel') {
      return e.json(409, {
        error: 'somente ficha com decisão mais recente elegível pode ser encaminhada',
      })
    }

    const requestId = e.request.id || $security.randomString(16)

    const record = new Record($app.findCollectionByNameOrId('test_referrals'))
    record.set('referral_id', 'ref-' + $security.randomString(12))
    record.set('submission_id', submission.id)
    record.set('tenant_id', authTenant)
    record.set('destination', destination)
    record.set('reason', reason)
    record.set('referred_by', auth.id)
    record.set('request_id', requestId)
    $app.save(record)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'referral-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_referrals')
    audit.set('target_id', record.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-2.02')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(201, {
      referral_id: record.id,
      referral_record_id: record.getString('referral_id'),
      submission_id: submission.id,
      destination: destination,
      reason: reason,
      referred_by: auth.id,
      request_id: requestId,
      created_at: record.getString('created'),
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)

// Linha do tempo de encaminhamentos de uma ficha: somente do tenant da
// sessão, da mais antiga para a mais nova. Ficha de outro tenant responde
// 404 sem revelar existência (RN-1.02).
routerAdd(
  'GET',
  '/backend/v1/test-referrals/{submissionId}',
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
        'test_referrals',
        "submission_id = '" + submissionId.replace(/'/g, "''") + "'",
        'created',
        200,
        0,
      )
    } catch (_) {
      records = []
    }

    const items = records.map((r) => ({
      referral_id: r.id,
      referral_record_id: r.getString('referral_id'),
      destination: r.getString('destination'),
      reason: r.getString('reason'),
      referred_by: r.getString('referred_by'),
      created_at: r.getString('created'),
    }))

    return e.json(200, {
      submission_id: submission.id,
      display_name: submission.getString('display_name'),
      items: items,
      count: items.length,
      request_id: requestId,
    })
  },
  $apis.requireAuth(),
)
