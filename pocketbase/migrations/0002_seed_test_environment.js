migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('test_tenants')
    const identities = app.findCollectionByNameOrId('test_identities')

    function upsertTenant(fixtureKey, slug, label) {
      let record
      try {
        record = app.findFirstRecordByData('test_tenants', 'fixture_key', fixtureKey)
      } catch (_) {
        record = new Record(tenants)
        record.set('fixture_key', fixtureKey)
      }
      record.set('slug', slug)
      record.set('label', label)
      record.set('purpose', 'access-isolation')
      record.set('is_synthetic', true)
      app.save(record)
      return record
    }

    function upsertIdentity(fixtureKey, email, displayName, role, tenant) {
      let record
      try {
        record = app.findFirstRecordByData('test_identities', 'fixture_key', fixtureKey)
      } catch (_) {
        record = new Record(identities)
        record.set('fixture_key', fixtureKey)
      }
      record.set('email', email)
      record.set('display_name', displayName)
      record.set('role', role)
      record.set('status', 'active')
      record.set('is_synthetic', true)
      if (tenant) {
        record.set('tenant_id', tenant.id)
      } else {
        record.set('tenant_id', '')
      }
      app.save(record)
    }

    const tenantA = upsertTenant('tenant-a', 'tenant-a', 'Tenant A — cenário de acesso permitido')
    const tenantB = upsertTenant('tenant-b', 'tenant-b', 'Tenant B — cenário de isolamento')

    upsertIdentity('champion-a', 'champion-a@tests.invalid', 'Champion A', 'champion', tenantA)
    upsertIdentity(
      'participant-a',
      'participant-a@tests.invalid',
      'Participant A',
      'participant',
      tenantA,
    )
    upsertIdentity(
      'participant-b',
      'participant-b@tests.invalid',
      'Participant B',
      'participant',
      tenantB,
    )
    upsertIdentity(
      'technical-admin',
      'technical-admin@tests.invalid',
      'Administrador técnico condicionado',
      'administrador_tecnico_condicionado',
      null,
    )
  },
  (app) => {
    const identityKeys = ['champion-a', 'participant-a', 'participant-b', 'technical-admin']
    for (const fixtureKey of identityKeys) {
      try {
        app.delete(app.findFirstRecordByData('test_identities', 'fixture_key', fixtureKey))
      } catch (_) {}
    }

    const tenantKeys = ['tenant-a', 'tenant-b']
    for (const fixtureKey of tenantKeys) {
      try {
        app.delete(app.findFirstRecordByData('test_tenants', 'fixture_key', fixtureKey))
      } catch (_) {}
    }
  },
)
