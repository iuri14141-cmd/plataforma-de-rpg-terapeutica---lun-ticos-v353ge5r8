migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('test_tenants').id
    const submissionsId = app.findCollectionByNameOrId('test_screening_submissions').id

    const referrals = new Collection({
      name: 'test_referrals',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && tenant_id = @request.auth.tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && tenant_id = @request.auth.tenant_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'referral_id', type: 'text', required: true, min: 4, max: 64 },
        {
          name: 'submission_id',
          type: 'relation',
          required: true,
          collectionId: submissionsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'destination',
          type: 'select',
          required: true,
          values: ['individual', 'grupo'],
          maxSelect: 1,
        },
        { name: 'reason', type: 'text', required: true, min: 1, max: 2000 },
        { name: 'referred_by', type: 'text', required: true, min: 1, max: 64 },
        { name: 'request_id', type: 'text', required: true, min: 4, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_referrals_referral_id ON test_referrals (referral_id)',
        'CREATE INDEX idx_test_referrals_submission ON test_referrals (submission_id, created)',
        'CREATE INDEX idx_test_referrals_tenant ON test_referrals (tenant_id, created)',
      ],
    })
    app.save(referrals)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('test_referrals')
    app.delete(collection)
  },
)
