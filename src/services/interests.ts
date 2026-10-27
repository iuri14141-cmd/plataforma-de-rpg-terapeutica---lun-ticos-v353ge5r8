import pb from '@/lib/pocketbase/client'

export type TestInterest = {
  duplicate?: boolean
  interest_id: string
  fixture_key: string
  display_name: string
  contact_key: string
  status: string
  request_id: string
  tenant_id: string
  created_at: string
  audit_event_id: string
}

export async function createTestInterest(
  displayName: string,
  contactKey: string,
): Promise<TestInterest> {
  return pb.send<TestInterest>('/backend/v1/test-interests', {
    method: 'POST',
    body: { display_name: displayName, contact_key: contactKey },
  })
}
