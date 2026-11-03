// Desassociação manual missão–participante (F1-T08, RN-1.15).
// Champion do tenant da sessão desvincula um vínculo ativo do MESMO tenant.
// Evento append-only link_removed com ator; a reabertura da missão não
// restaura vínculo revogado (não há ação de restauração automática).
// Confirmação só após persistência do vínculo e do evento.
routerAdd(
  'DELETE',
  '/backend/v1/test-mission-links/{id}',
  (e) => {
    const linkId = e.request.pathValue('id')

    const auth = e.auth
    if (!auth) {
      return e.json(401, { error: 'sessão ausente' })
    }

    if (auth.getString('access_status') !== 'active') {
      return e.json(403, { error: 'acesso revogado', rule_id: 'RN-1.05' })
    }

    if (auth.getString('test_role') !== 'champion') {
      return e.json(403, { error: 'somente champion desvincula participante', rule_id: 'RN-1.03' })
    }

    const authTenant = auth.getString('tenant_id')

    let link
    try {
      link = $app.findRecordById('test_mission_links', linkId)
    } catch (_) {
      return e.json(404, { error: 'vínculo não encontrado' })
    }

    if (link.getString('tenant_id') !== authTenant) {
      return e.json(403, {
        error: 'recurso fora do contexto autorizado',
        rule_id: 'RN-1.02',
      })
    }

    if (link.getString('status') !== 'active') {
      return e.json(409, { error: 'vínculo já está desfeito' })
    }

    const requestId = e.request.id || $security.randomString(16)

    link.set('status', 'unlinked')
    link.set('unlinked_by', auth.id)
    $app.save(link)

    const event = new Record($app.findCollectionByNameOrId('test_mission_link_events'))
    event.set('event_id', 'evt-' + $security.randomString(12))
    event.set('link_id', link.id)
    event.set('mission_id', link.getString('mission_id'))
    event.set('participant_id', link.getString('participant_id'))
    event.set('actor_id', auth.id)
    event.set('event_type', 'link_removed')
    event.set('request_id', requestId)
    $app.save(event)

    const audit = new Record($app.findCollectionByNameOrId('audit_events'))
    audit.set('event_id', 'unlink-' + $security.randomString(12))
    audit.set('request_id', requestId)
    audit.set('action', 'probe')
    audit.set('target_type', 'test_mission_links')
    audit.set('target_id', link.id)
    audit.set('outcome', 'allowed')
    audit.set('rule_id', 'RN-1.15')
    audit.set('actor_id', auth.id)
    audit.set('tenant_id', authTenant)
    $app.save(audit)

    return e.json(200, {
      link_id: link.id,
      mission_id: link.getString('mission_id'),
      participant_id: link.getString('participant_id'),
      status: link.getString('status'),
      unlinked_by: auth.id,
      request_id: requestId,
      event_id: event.id,
      audit_event_id: audit.id,
    })
  },
  $apis.requireAuth(),
)
