migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('test_tenants')
    const identities = app.findCollectionByNameOrId('test_identities')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenantCollectionId = tenants.id

    if (!users.fields.getByName('fixture_key')) {
      users.fields.add(new TextField({ name: 'fixture_key', required: true, min: 1, max: 64 }))
    }
    if (!users.fields.getByName('tenant_id')) {
      users.fields.add(
        new RelationField({
          name: 'tenant_id',
          required: true,
          collectionId: tenantCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!users.fields.getByName('test_role')) {
      users.fields.add(
        new SelectField({
          name: 'test_role',
          required: true,
          values: ['champion', 'participant', 'administrador_tecnico_condicionado'],
          maxSelect: 1,
        }),
      )
    }
    if (!users.fields.getByName('access_status')) {
      users.fields.add(
        new SelectField({
          name: 'access_status',
          required: true,
          values: ['active', 'revoked'],
          maxSelect: 1,
        }),
      )
    }
    users.createRule = null
    users.updateRule = null
    users.deleteRule = null
    app.save(users)

    if (!identities.fields.getByName('user_id')) {
      identities.fields.add(
        new RelationField({
          name: 'user_id',
          required: false,
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    const identityAccessRule =
      "@request.auth.id != '' && @request.auth.access_status = 'active' && (user_id = @request.auth.id || (@request.auth.test_role = 'champion' && tenant_id = @request.auth.tenant_id))"
    identities.listRule = identityAccessRule
    identities.viewRule = identityAccessRule
    identities.createRule = null
    identities.updateRule = null
    identities.deleteRule = null
    app.save(identities)
  },
  (app) => {
    const identities = app.findCollectionByNameOrId('test_identities')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    identities.listRule = null
    identities.viewRule = null
    identities.createRule = null
    identities.updateRule = null
    identities.deleteRule = null
    identities.fields.removeByName('user_id')
    app.save(identities)

    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    users.fields.removeByName('access_status')
    users.fields.removeByName('test_role')
    users.fields.removeByName('tenant_id')
    users.fields.removeByName('fixture_key')
    app.save(users)
  },
)
