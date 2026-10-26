migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('test_tenants').id
    const interestsId = app.findCollectionByNameOrId('test_interests').id

    const participants = new Collection({
      name: 'test_participants',
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
          name: 'interest_id',
          type: 'relation',
          required: true,
          collectionId: interestsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'display_name', type: 'text', required: true, min: 1, max: 120 },
        { name: 'contact_key', type: 'text', required: true, min: 1, max: 120 },
        {
          name: 'lifecycle_status',
          type: 'select',
          required: true,
          values: ['participant_registered', 'cancelled', 'reopened'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_participants_fixture_key ON test_participants (fixture_key)',
        'CREATE UNIQUE INDEX idx_test_participants_interest ON test_participants (interest_id)',
        'CREATE INDEX idx_test_participants_tenant_contact ON test_participants (tenant_id, contact_key)',
      ],
    })
    app.save(participants)

    const participantsId = app.findCollectionByNameOrId('test_participants').id
    const events = new Collection({
      name: 'test_participant_events',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && participant_id.tenant_id = @request.auth.tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.access_status = 'active' && @request.auth.test_role = 'champion' && participant_id.tenant_id = @request.auth.tenant_id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, min: 4, max: 64 },
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
          values: [
            'participant_registered',
            'participant_updated',
            'participant_cancelled',
            'participant_reopened',
          ],
          maxSelect: 1,
        },
        { name: 'request_id', type: 'text', required: true, min: 4, max: 64 },
        { name: 'changed_fields', type: 'json', maxSize: 2000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_test_participant_events_event_id ON test_participant_events (event_id)',
        'CREATE INDEX idx_test_participant_events_participant ON test_participant_events (participant_id, created)',
      ],
    })
    app.save(events)
  },
  (app) => {
    const events = app.findCollectionByNameOrId('test_participant_events')
    app.delete(events)
    const participants = app.findCollectionByNameOrId('test_participants')
    app.delete(participants)
  },
)
