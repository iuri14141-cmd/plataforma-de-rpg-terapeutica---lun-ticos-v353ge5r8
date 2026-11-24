migrate(
  (app) => {
    const missions = app.findCollectionByNameOrId('test_missions')

    if (!missions.fields.getByName('group_min')) {
      missions.fields.add(
        new NumberField({ name: 'group_min', required: false, onlyInt: true, min: 1, max: 99 }),
      )
    }
    if (!missions.fields.getByName('group_max')) {
      missions.fields.add(
        new NumberField({ name: 'group_max', required: false, onlyInt: true, min: 1, max: 99 }),
      )
    }
    if (!missions.fields.getByName('sessions_total')) {
      missions.fields.add(
        new NumberField({
          name: 'sessions_total',
          required: false,
          onlyInt: true,
          min: 1,
          max: 999,
        }),
      )
    }
    if (!missions.fields.getByName('frequency')) {
      missions.fields.add(
        new SelectField({
          name: 'frequency',
          required: false,
          maxSelect: 1,
          values: ['semanal', 'quinzenal', 'mensal'],
        }),
      )
    }
    app.save(missions)
  },
  (app) => {
    const missions = app.findCollectionByNameOrId('test_missions')
    missions.fields.removeByName('frequency')
    missions.fields.removeByName('sessions_total')
    missions.fields.removeByName('group_max')
    missions.fields.removeByName('group_min')
    app.save(missions)
  },
)
