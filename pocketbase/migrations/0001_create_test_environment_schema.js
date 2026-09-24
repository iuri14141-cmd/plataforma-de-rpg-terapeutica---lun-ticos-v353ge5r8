migrate(
  (app) => {
    const tenants = new Collection({
      name: 'test_tenants',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'fixture_key', type: 'text', required: true, min: 1, max: 64 },
        { name: 'slug', type: 'text', required: true, min: 1, max: 64 },
        { name: 'label', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'purpose',
          type: 'select',
          required: true,
          values: ['access-isolation'],
          maxSelect: 1,
        },
        { name: 'is_synthetic', type: 'bool', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_tenants_fixture_key ON test_tenants (fixture_key)',
        'CREATE UNIQUE INDEX idx_test_tenants_slug ON test_tenants (slug)',
      ],
    })
    app.save(tenants)

    const tenantCollectionId = app.findCollectionByNameOrId('test_tenants').id
    const identities = new Collection({
      name: 'test_identities',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'fixture_key', type: 'text', required: true, min: 1, max: 64 },
        { name: 'email', type: 'email', required: true },
        { name: 'display_name', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['champion', 'participant', 'administrador_tecnico_condicionado'],
          maxSelect: 1,
        },
        {
          name: 'tenant_id',
          type: 'relation',
          collectionId: tenantCollectionId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['active', 'revoked'],
          maxSelect: 1,
        },
        { name: 'is_synthetic', type: 'bool', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_identities_fixture_key ON test_identities (fixture_key)',
        'CREATE UNIQUE INDEX idx_test_identities_email ON test_identities (email)',
        'CREATE INDEX idx_test_identities_tenant ON test_identities (tenant_id)',
      ],
    })
    app.save(identities)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('test_identities'))
    app.delete(app.findCollectionByNameOrId('test_tenants'))
  },
)
