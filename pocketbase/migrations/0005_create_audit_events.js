migrate(
  (app) => {
    const collection = new Collection({
      name: 'audit_events',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, min: 8, max: 64 },
        { name: 'request_id', type: 'text', required: true, min: 4, max: 64 },
        {
          name: 'action',
          type: 'select',
          required: true,
          values: ['list', 'view', 'probe'],
          maxSelect: 1,
        },
        { name: 'target_type', type: 'text', required: true, max: 64 },
        { name: 'target_id', type: 'text', max: 64 },
        {
          name: 'outcome',
          type: 'select',
          required: true,
          values: ['allowed', 'denied'],
          maxSelect: 1,
        },
        { name: 'rule_id', type: 'text', required: true, max: 32 },
        { name: 'actor_id', type: 'text', max: 64 },
        { name: 'tenant_id', type: 'text', max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_audit_events_event_id ON audit_events (event_id)',
        'CREATE UNIQUE INDEX idx_audit_events_request_id ON audit_events (request_id)',
        'CREATE INDEX idx_audit_events_outcome_created ON audit_events (outcome, created)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('audit_events')
    app.delete(collection)
  },
)
