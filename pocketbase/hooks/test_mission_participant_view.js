// Visão limitada do participante (F1-T08, CA-1-12, RN-1.14).
// Resolve quem é a sessão via test_identities.user_id e devolve SOMENTE as
// missões com vínculo ativo do participante no tenant da sessão, com campos
// compartilhados (título, modalidade, objetivo, estado). Sem ficha, histórico
// ou dados privados de outro participante. Sem vínculo → lista vazia.
routerAdd(
  'GET',
  '/backend/v1/test-mission-participant-view',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'participant') {
      return e.json(403, { error: 'rota exclusiva de participante', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')
    if (!authTenant) {
      return e.json(403, { error: 'tenant ausente na sessão', rule_id: 'RN-1.01' })
    }

    // Resolve a identidade sintética da sessão (user_id → identity → fixture).
    let identity = null
    try {
      identity = $app.findFirstRecordByFilter(
        'test_identities',
        "user_id = '" + auth.id.replace(/'/g, "''") + "'",
      )
    } catch (_) {
      identity = null
    }

    if (!identity) {
      return e.json(403, { error: 'identidade de teste não encontrada', rule_id: 'RN-1.01' })
    }

    // Participante da sessão: vínculo determinístico identity_id (F1-T08).
    // Fallback legado: contact_key = e-mail da identidade (participantes antigos).
    let participant = null
    try {
      participant = $app.findFirstRecordByFilter(
        'test_participants',
        "tenant_id = '" +
          authTenant.replace(/'/g, "''") +
          "' && identity_id = '" +
          identity.id.replace(/'/g, "''") +
          "'",
      )
    } catch (_) {
      participant = null
    }

    if (!participant) {
      const contactKey = identity.getString('email').toLowerCase()
      try {
        participant = $app.findFirstRecordByFilter(
          'test_participants',
          "tenant_id = '" +
            authTenant.replace(/'/g, "''") +
            "' && contact_key = '" +
            contactKey.replace(/'/g, "''") +
            "'",
        )
      } catch (_) {
        participant = null
      }
    }

    if (!participant) {
      return e.json(200, {
        participant: {
          display_name: identity.getString('display_name'),
          tenant_id: authTenant,
        },
        missions: [],
      })
    }

    let links = []
    try {
      links = $app.findRecordsByFilter(
        'test_mission_links',
        "tenant_id = '" + authTenant.replace(/'/g, "''") + "' && status = 'active'",
        '-created',
        50,
        0,
      )
    } catch (_) {
      links = []
    }

    const missions = []
    for (const link of links) {
      if (link.getString('participant_id') !== participant.id) {
        continue
      }

      let mission = null
      try {
        mission = $app.findRecordById('test_missions', link.getString('mission_id'))
      } catch (_) {
        continue
      }

      if (mission.getString('tenant_id') !== authTenant) {
        continue
      }

      missions.push({
        mission_id: mission.id,
        title: mission.getString('title'),
        modality: mission.getString('modality'),
        objective: mission.getString('objective'),
        status: mission.getString('status'),
        linked_at: link.getString('created'),
      })
    }

    return e.json(200, {
      participant: {
        display_name: participant.getString('display_name'),
        tenant_id: authTenant,
      },
      missions: missions,
    })
  },
  $apis.requireAuth(),
)
