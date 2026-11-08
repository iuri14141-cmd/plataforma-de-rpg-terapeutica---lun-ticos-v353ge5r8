migrate(
  (app) => {
    const participants = app.findCollectionByNameOrId('test_participants')
    const identitiesId = app.findCollectionByNameOrId('test_identities').id

    if (!participants.fields.getByName('identity_id')) {
      participants.fields.add(
        new RelationField({
          name: 'identity_id',
          required: false,
          collectionId: identitiesId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(participants)
  },
  (app) => {
    const participants = app.findCollectionByNameOrId('test_participants')
    participants.fields.removeByName('identity_id')
    app.save(participants)
  },
)
