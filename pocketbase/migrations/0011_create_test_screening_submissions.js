migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('test_tenants').id

    const screening = new Collection({
      name: 'test_screening_submissions',
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
        { name: 'motivation', type: 'text', required: true, min: 1, max: 2000 },
        { name: 'goal', type: 'text', required: true, min: 1, max: 2000 },
        {
          name: 'ack_not_replacement',
          type: 'bool',
          required: true,
        },
        {
          name: 'ack_no_diagnosis',
          type: 'bool',
          required: true,
        },
        {
          name: 'consent_recording',
          type: 'bool',
          required: true,
        },
        {
          name: 'consent_confidentiality',
          type: 'bool',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['screening_pending', 'screened'],
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
        'CREATE UNIQUE INDEX idx_test_screening_fixture_key ON test_screening_submissions (fixture_key)',
        'CREATE INDEX idx_test_screening_tenant_contact ON test_screening_submissions (tenant_id, contact_key)',
        'CREATE INDEX idx_test_screening_tenant_created ON test_screening_submissions (tenant_id, created)',
      ],
    })
    app.save(screening)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('test_screening_submissions')
    app.delete(collection)
  },
)
