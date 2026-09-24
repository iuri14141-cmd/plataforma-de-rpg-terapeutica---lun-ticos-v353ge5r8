migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenants = app.findCollectionByNameOrId('test_tenants')
    const identities = app.findCollectionByNameOrId('test_identities')
    const passwordChampion = $secrets.get('F1_TEST_CHAMPION_PASSWORD')
    const passwordParticipant = $secrets.get('F1_TEST_PARTICIPANT_PASSWORD')

    function upsertUser(email, name, fixtureKey, role, tenantId, password) {
      let record
      try {
        record = app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {
        record = new Record(users)
        record.setEmail(email)
      }
      record.setEmail(email)
      record.setPassword(password)
      record.setVerified(true)
      record.set('name', name)
      record.set('fixture_key', fixtureKey)
      record.set('tenant_id', tenantId)
      record.set('test_role', role)
      record.set('access_status', 'active')
      app.save(record)
      return record
    }

    function linkIdentity(fixtureKey, userId) {
      const identity = app.findFirstRecordByData('test_identities', 'fixture_key', fixtureKey)
      identity.set('user_id', userId)
      app.save(identity)
    }

    const tenantA = app.findFirstRecordByData('test_tenants', 'fixture_key', 'tenant-a')
    const champion = upsertUser(
      'champion-a@tests.invalid',
      'Champion A',
      'champion-a',
      'champion',
      tenantA.id,
      passwordChampion,
    )
    const participant = upsertUser(
      'participant-a@tests.invalid',
      'Participant A',
      'participant-a',
      'participant',
      tenantA.id,
      passwordParticipant,
    )

    linkIdentity('champion-a', champion.id)
    linkIdentity('participant-a', participant.id)
  },
  (app) => {
    const identityKeys = ['champion-a', 'participant-a']
    for (const fixtureKey of identityKeys) {
      try {
        const identity = app.findFirstRecordByData('test_identities', 'fixture_key', fixtureKey)
        identity.set('user_id', '')
        app.save(identity)
      } catch (_) {}
    }

    const emails = ['champion-a@tests.invalid', 'participant-a@tests.invalid']
    for (const email of emails) {
      try {
        app.delete(app.findAuthRecordByEmail('_pb_users_auth_', email))
      } catch (_) {}
    }
  },
)
