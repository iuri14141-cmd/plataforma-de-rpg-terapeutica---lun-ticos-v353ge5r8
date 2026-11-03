migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('test_tenants').id

    const missions = new Collection({
      name: 'test_missions',
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
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'modality',
          type: 'select',
          required: true,
          values: ['individual', 'grupo'],
          maxSelect: 1,
        },
        { name: 'objective', type: 'text', required: true, min: 1, max: 500 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'ativa', 'pausada', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'created_by', type: 'text', required: true, min: 1, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_missions_fixture_key ON test_missions (fixture_key)',
        'CREATE INDEX idx_test_missions_tenant_status ON test_missions (tenant_id, status)',
      ],
    })
    app.save(missions)

    const missionsId = app.findCollectionByNameOrId('test_missions').id
    const events = new Collection({
      name: 'test_mission_events',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && mission_id.tenant_id = @request.auth.tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && mission_id.tenant_id = @request.auth.tenant_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, min: 4, max: 64 },
        {
          name: 'mission_id',
          type: 'relation',
          required: true,
          collectionId: missionsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'actor_id', type: 'text', required: true, min: 1, max: 64 },
        {
          name: 'event_type',
          type: 'select',
          required: true,
          values: [
            'mission_created',
            'mission_activated',
            'mission_paused',
            'mission_cancelled',
            'mission_reopened',
          ],
          maxSelect: 1,
        },
        {
          name: 'before_status',
          type: 'select',
          required: true,
          values: ['rascunho', 'ativa', 'pausada', 'cancelada'],
          maxSelect: 1,
        },
        {
          name: 'after_status',
          type: 'select',
          required: true,
          values: ['rascunho', 'ativa', 'pausada', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'request_id', type: 'text', required: true, min: 4, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_mission_events_event_id ON test_mission_events (event_id)',
        'CREATE INDEX idx_test_mission_events_mission ON test_mission_events (mission_id, created)',
      ],
    })
    app.save(events)
  },
  (app) => {
    const events = app.findCollectionByNameOrId('test_mission_events')
    app.delete(events)
    const missions = app.findCollectionByNameOrId('test_missions')
    app.delete(missions)
  },
)
