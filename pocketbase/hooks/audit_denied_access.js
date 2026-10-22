// Auditoria server-side de negação de acesso (F1-T03, CA-1-03).
// Registra exatamente um evento `denied` por request_id quando uma tentativa
// de listar identidades de teste é recusada pela regra de tenant.
onRecordsListRequest((e) => {
  if (e.collection.name !== 'test_identities') {
    return e.next()
  }

  const auth = e.auth
  if (!auth) {
    return e.next()
  }

  const accessStatus = auth.getString('access_status')
  const authTenant = auth.getString('tenant_id')
  const testRole = auth.getString('test_role')

  const denied =
    accessStatus !== 'active' || (testRole !== 'champion' && testRole !== 'participant')

  if (!denied) {
    return e.next()
  }

  try {
    const requestId = e.request.id || $security.randomString(16)
    const eventId = 'denied-' + $security.randomString(12)
    const record = new Record($app.findCollectionByNameOrId('audit_events'))
    record.set('event_id', eventId)
    record.set('request_id', requestId)
    record.set('action', 'list')
    record.set('target_type', 'test_identities')
    record.set('target_id', '')
    record.set('outcome', 'denied')
    record.set('rule_id', 'RN-1.02')
    record.set('actor_id', auth.id)
    record.set('tenant_id', authTenant)
    $app.save(record)
  } catch (err) {
    $app.logger().error('audit denied write failed', 'error', String(err))
  }

  return e.next()
}, 'test_identities')
