migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('test_tenants').id
    const missionsId = app.findCollectionByNameOrId('test_missions').id
    const participantsId = app.findCollectionByNameOrId('test_participants').id

    const links = new Collection({
      name: 'test_mission_links',
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
        {
          name: 'mission_id',
          type: 'relation',
          required: true,
          collectionId: missionsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'participant_id',
          type: 'relation',
          required: true,
          collectionId: participantsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['active', 'unlinked'],
          maxSelect: 1,
        },
        { name: 'linked_by', type: 'text', required: true, min: 1, max: 64 },
        { name: 'unlinked_by', type: 'text', required: false, min: 1, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_mission_links_fixture_key ON test_mission_links (fixture_key)',
        "CREATE UNIQUE INDEX idx_test_mission_links_active_pair ON test_mission_links (mission_id, participant_id) WHERE status = 'active'",
        'CREATE INDEX idx_test_mission_links_tenant ON test_mission_links (tenant_id, status)',
      ],
    })
    app.save(links)

    const linksId = app.findCollectionByNameOrId('test_mission_links').id
    const events = new Collection({
      name: 'test_mission_link_events',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && link_id.tenant_id = @request.auth.tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && link_id.tenant_id = @request.auth.tenant_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, min: 4, max: 64 },
        {
          name: 'link_id',
          type: 'relation',
          required: true,
          collectionId: linksId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'mission_id',
          type: 'relation',
          required: true,
          collectionId: missionsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'participant_id',
          type: 'relation',
          required: true,
          collectionId: participantsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'actor_id', type: 'text', required: true, min: 1, max: 64 },
        {
          name: 'event_type',
          type: 'select',
          required: true,
          values: ['link_created', 'link_removed'],
          maxSelect: 1,
        },
        { name: 'request_id', type: 'text', required: true, min: 4, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_mission_link_events_event_id ON test_mission_link_events (event_id)',
        'CREATE INDEX idx_test_mission_link_events_link ON test_mission_link_events (link_id, created)',
      ],
    })
    app.save(events)
  },
  (app) => {
    const events = app.findCollectionByNameOrId('test_mission_link_events')
    app.delete(events)
    const links = app.findCollectionByNameOrId('test_mission_links')
    app.delete(links)
  },
)
