migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('test_tenants').id
    const collection = new Collection({
      name: 'test_interests',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && tenant_id = @request.auth.tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && tenant_id = @request.auth.tenant_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'fixture_key', type: 'text', required: true, min: 1, max: 64 },
        { name: 'contact_key', type: 'text', required: true, min: 1, max: 120 },
        { name: 'display_name', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['interest_received'],
          maxSelect: 1,
        },
        { name: 'request_id', type: 'text', required: true, min: 4, max: 64 },
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_interests_fixture_key ON test_interests (fixture_key)',
        'CREATE INDEX idx_test_interests_tenant_contact ON test_interests (tenant_id, contact_key)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('test_interests')
    app.delete(collection)
  },
)
