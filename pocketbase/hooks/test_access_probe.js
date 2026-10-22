// Sonda de isolamento server-side (F1-T03, CA-1-03 e CA-1-05).
// O cliente informa apenas a fixture_key desejada; o servidor decide pela
// associação real do usuário autenticado — valores de tenant/papel enviados
// pelo cliente nunca são aceitos como autoridade (RN da SPEC-1-001).
routerAdd(
  'POST',
  '/backend/v1/test-access/probe',
  (e) => {
    const body = e.requestInfo().body || {}
    const fixtureKey = String(body.fixture_key || '')
    if (!fixtureKey) {
      return e.json(400, { error: 'fixture_key é obrigatório' })
    }

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    const accessStatus = auth.getString('access_status')
    if (accessStatus !== 'active') {
      return e.json(403, {
        error: 'acesso revogado',
        outcome: 'denied',
        rule_id: 'RN-1.05',
      })
    }

    let identity
    try {
      identity = $app.findFirstRecordByFilter(
        'test_identities',
        "fixture_key = '" + fixtureKey.replace(/'/g, "''") + "'",
      )
    } catch (_) {
      identity = null
    }

    if (!identity) {
      return e.json(404, { error: 'identidade não encontrada' })
    }

    const identityTenant = identity.getString('tenant_id')
    const authTenant = auth.getString('tenant_id')
    const testRole = auth.getString('test_role')
    const identityUserId = identity.getString('user_id')

    const sameTenant = identityTenant !== '' && identityTenant === authTenant
    const ownRecord = identityUserId !== '' && identityUserId === auth.id
    const allowed = ownRecord || (testRole === 'champion' && sameTenant)

    const requestId = e.request.id || $security.randomString(16)
    const eventId = 'probe-' + $security.randomString(12)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', eventId)
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_identities')
    audit.set('target_id', identity.id)
    audit.set('outcome', allowed ? 'allowed' : 'denied')
    audit.set('rule_id', allowed ? 'RN-1.03' : 'RN-1.02')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    if (!allowed) {
      return e.json(403, {
        error: 'recurso fora do contexto autorizado',
        outcome: 'denied',
        rule_id: 'RN-1.02',
        audit_event_id: eventId,
      })
    }

    return e.json(200, {
      outcome: 'allowed',
      rule_id: 'RN-1.03',
      audit_event_id: eventId,
      identity: {
        id: identity.id,
        fixture_key: identity.getString('fixture_key'),
        display_name: identity.getString('display_name'),
        role: identity.getString('role'),
        tenant_id: identityTenant,
        status: identity.getString('status'),
      },
    })
  },
  $apis.requireAuth(),
)
