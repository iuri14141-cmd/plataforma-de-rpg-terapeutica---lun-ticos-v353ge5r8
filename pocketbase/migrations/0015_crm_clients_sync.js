// Coleções da integração incremental com o CRM.
//
// - crm_clients: cópia local dos clientes vindos do CRM (upsert pelo id
//   externo). O id do registro é o próprio id do CRM, para upsert direto.
// - crm_sync_state: registro único de estado da sincronização (maior
//   "updated" já recebido do CRM, usado como ?since= nas chamadas seguintes).
migrate(
  (app) => {
    // ----- crm_clients -----
    if (!app.hasTable('crm_clients')) {
      const clients = new Collection({
        name: 'crm_clients',
        type: 'base',
        // Leitura para qualquer sessão autenticada; escrita só para o hook
        // (que roda como superusuário e ignora as regras).
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          // Id do cliente no CRM (texto, porque o id externo pode não ser
          // compatível com o formato de id do PocketBase).
          { name: 'crm_id', type: 'text', required: true, min: 1, max: 255 },
          { name: 'name', type: 'text', required: true, max: 255 },
          { name: 'email', type: 'email', required: false },
          { name: 'phone', type: 'text', required: false, max: 64 },
          // Data de atualização no CRM, no formato "2026-11-23 14:42:44.832Z".
          { name: 'crm_updated', type: 'text', required: false, max: 64 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_crm_clients_crm_id ON crm_clients (crm_id)'],
      })
      app.save(clients)
    }

    // ----- crm_sync_state -----
    if (!app.hasTable('crm_sync_state')) {
      const state = new Collection({
        name: 'crm_sync_state',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'key', type: 'text', required: true, min: 1, max: 64 },
          // Maior "updated" já recebido do CRM (normalizado ISO, UTC).
          { name: 'last_updated', type: 'text', required: false, max: 64 },
          // Último sincronismo bem-sucedido (ISO, UTC).
          { name: 'last_synced_at', type: 'text', required: false, max: 64 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_crm_sync_state_key ON crm_sync_state (key)'],
      })
      app.save(state)
    }
  },
  (app) => {
    for (const name of ['crm_clients', 'crm_sync_state']) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
