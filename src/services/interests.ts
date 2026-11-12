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

export type FailureProbeResult = {
  duplicate?: boolean
  interest_id?: string
  display_name?: string
  contact_key?: string
  status?: string
  request_id?: string
  created_at?: string
}

export async function createTestInterestWithFailureMode(
  displayName: string,
  contactKey: string,
): Promise<FailureProbeResult> {
  return pb.send<FailureProbeResult>('/backend/v1/test-interests-failure-probe', {
    method: 'POST',
    body: { display_name: displayName, contact_key: contactKey },
  })
}

export type InterestListItem = {
  interest_id: string
  display_name: string
  contact_key: string
  status: string
  created_at: string
}

export async function listTenantInterests(): Promise<InterestListItem[]> {
  // Sem filtro: o RLS da coleção já restringe a listagem ao tenant da sessão.
  // (Filtro anterior contact_key="" era inválido e escondia as fichas.)
  const result = await pb.send<{
    items: Array<{
      id: string
      display_name: string
      contact_key: string
      status: string
      created: string
    }>
  }>('/api/collections/test_interests/records', {
    method: 'GET',
    query: { sort: '-created', perPage: '50' },
  })
  return result.items.map((item) => ({
    interest_id: item.id,
    display_name: item.display_name,
    contact_key: item.contact_key,
    status: item.status,
    created_at: item.created,
  }))
}
