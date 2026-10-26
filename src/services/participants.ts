import pb from '@/lib/pocketbase/client'

export type TestParticipant = {
  participant_id: string
  fixture_key: string
  display_name: string
  contact_key: string
  lifecycle_status: string
  interest_id: string
  request_id: string
  created_at: string
  already_registered?: boolean
  audit_event_id?: string
}

export type ParticipantEvent = {
  id: string
  event_id: string
  participant_id: string
  actor_id: string
  event_type: string
  request_id: string
  changed_fields: string
  created: string
}

export async function promoteTestParticipant(interestId: string): Promise<TestParticipant> {
  return pb.send<TestParticipant>('/backend/v1/test-participants', {
    method: 'POST',
    body: { interest_id: interestId },
  })
}

export async function updateTestParticipant(
  participantId: string,
  payload: { display_name?: string; action?: 'cancel' | 'reopen'; reason?: string },
): Promise<{
  participant_id: string
  display_name: string
  lifecycle_status: string
  event_id: string
  event_type: string
  request_id: string
  audit_event_id: string
}> {
  return pb.send(`/backend/v1/test-participants/${participantId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function getParticipantEvents(participantId: string): Promise<ParticipantEvent[]> {
  const result = await pb.send<{ items: ParticipantEvent[] }>(
    `/api/collections/test_participant_events/records`,
    {
      method: 'GET',
      query: {
        filter: `participant_id="${participantId}"`,
        sort: 'created',
      },
    },
  )
  return result.items
}
