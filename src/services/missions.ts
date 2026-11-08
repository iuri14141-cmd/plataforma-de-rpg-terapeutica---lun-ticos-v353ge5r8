import pb from '@/lib/pocketbase/client'

export type TestMission = {
  mission_id: string
  fixture_key: string
  title: string
  modality: string
  objective: string
  status: string
  tenant_id: string
  request_id: string
  created_at: string
  event_id: string
  audit_event_id: string
}

export type MissionUpdateResult = {
  mission_id: string
  title: string
  status: string
  before_status: string
  event_id: string
  event_type: string
  request_id: string
  audit_event_id: string
}

export async function createTestMission(
  title: string,
  modality: 'individual' | 'grupo',
  objective: string,
): Promise<TestMission> {
  return pb.send<TestMission>('/backend/v1/test-missions', {
    method: 'POST',
    body: { title, modality, objective },
  })
}

export async function updateTestMission(
  missionId: string,
  action: 'activate' | 'pause' | 'cancel' | 'reopen',
): Promise<MissionUpdateResult> {
  return pb.send<MissionUpdateResult>(`/backend/v1/test-missions/${missionId}`, {
    method: 'PATCH',
    body: { action },
  })
}

export async function listTenantMissions(): Promise<TestMission[]> {
  const result = await pb.send<{ items: TestMission[] }>('/api/collections/test_missions/records', {
    method: 'GET',
    query: { sort: '-created', perPage: '20' },
  })
  return result.items
}

export type MissionEventView = {
  id: string
  event_type: string
  before_status: string
  after_status: string
  actor_id: string
  request_id: string
  created: string
}

export async function getMissionTimeline(missionId: string): Promise<MissionEventView[]> {
  const result = await pb.send<{
    items: MissionEventView[]
  }>('/api/collections/test_mission_events/records', {
    method: 'GET',
    query: {
      filter: `mission_id="${missionId}"`,
      sort: 'created',
      perPage: '50',
    },
  })
  return result.items
}
