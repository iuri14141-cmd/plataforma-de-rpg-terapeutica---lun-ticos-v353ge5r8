// Sonda de vínculo cruzado (F1-T09, CA-1-13, MIS-RED-01).
// O champion autenticado tenta vincular um participante de OUTRO tenant
// (fixture participant-b, tenant-b). A sonda não cria nenhum registro: apenas
// prova que a negação server-side ocorre e gera auditoria (RN-1.02) sem
// revelar conteúdo do alvo.
routerAdd(
  'POST',
  '/backend/v1/test-mission-link-probe',
  (e) => {
    const body = e.requestInfo().body || {}
    const missionId = String(body.mission_id || '').trim()

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'sonda exclusiva de champion', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    let mission = null
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

    // Alvo da sonda: participante sintético de OUTRO tenant (fixture participant-b).
    let targetParticipant = null
    try {
      targetParticipant = $app.findFirstRecordByFilter(
        'test_identities',
        "fixture_key = 'participant-b' && status = 'active'",
      )
    } catch (_) {
      targetParticipant = null
    }

    if (!targetParticipant || targetParticipant.getString('tenant_id') === authTenant) {
      return e.json(409, {
        error: 'pré-condição da sonda não satisfeita: alvo cross-tenant indisponível',
      })
    }

    const requestId = e.request.id || $security.randomString(16)

    // Negação auditada: vínculo cross-tenant nunca é criado (CA-1-13).
    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'deny-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_mission_links')
    audit.set('target_id', targetParticipant.id)
    audit.set('outcome', 'denied')
    audit.set('rule_id', 'RN-1.02')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(403, {
      outcome: 'denied',
      rule_id: 'RN-1.02',
      audit_event_id: audit.id,
      request_id: requestId,
    })
  },
  $apis.requireAuth(),
)
