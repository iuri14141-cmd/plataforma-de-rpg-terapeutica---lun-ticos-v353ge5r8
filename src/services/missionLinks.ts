import pb from '@/lib/pocketbase/client'

export type MissionLink = {
  link_id: string
  mission_id: string
  participant_id: string
  status: string
  linked_by: string
  created_at: string
  request_id: string
  event_id?: string
  audit_event_id?: string
  already_linked?: boolean
}

export type TenantParticipant = {
  participant_id: string
  display_name: string
  contact_key: string
  lifecycle_status: string
}

export type ParticipantMissionView = {
  participant: { display_name: string; tenant_id: string }
  missions: Array<{
    mission_id: string
    title: string
    modality: string
    objective: string
    status: string
    linked_at: string
  }>
}

export async function createTestMissionLink(
  missionId: string,
  participantId: string,
): Promise<MissionLink> {
  return pb.send<MissionLink>('/backend/v1/test-mission-links', {
    method: 'POST',
    body: { mission_id: missionId, participant_id: participantId },
  })
}

export async function removeTestMissionLink(linkId: string): Promise<MissionLink> {
  return pb.send<MissionLink>(`/backend/v1/test-mission-links/${linkId}`, {
    method: 'DELETE',
  })
}

export async function listTenantMissionLinks(): Promise<MissionLink[]> {
  const result = await pb.send<{
    items: Array<{
      id: string
      mission_id: string
      participant_id: string
      status: string
      linked_by: string
      created: string
    }>
  }>('/api/collections/test_mission_links/records', {
    method: 'GET',
    query: { sort: '-created', perPage: '50' },
  })
  return result.items.map((item) => ({
    link_id: item.id,
    mission_id: item.mission_id,
    participant_id: item.participant_id,
    status: item.status,
    linked_by: item.linked_by,
    created_at: item.created,
    request_id: '',
  }))
}

export async function listTenantParticipants(): Promise<TenantParticipant[]> {
  const result = await pb.send<{
    items: Array<{
      id: string
      display_name: string
      contact_key: string
      lifecycle_status: string
    }>
  }>('/api/collections/test_participants/records', {
    method: 'GET',
    query: { sort: '-created', perPage: '50' },
  })
  return result.items.map((item) => ({
    participant_id: item.id,
    display_name: item.display_name,
    contact_key: item.contact_key,
    lifecycle_status: item.lifecycle_status,
  }))
}

export async function getParticipantMissionView(): Promise<ParticipantMissionView> {
  return pb.send<ParticipantMissionView>('/backend/v1/test-mission-participant-view', {
    method: 'GET',
  })
}
