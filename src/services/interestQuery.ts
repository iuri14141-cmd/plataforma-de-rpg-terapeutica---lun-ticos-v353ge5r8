import pb from '@/lib/pocketbase/client'
import type { TestInterest } from '@/services/interests'

export async function getLatestTenantInterest(): Promise<TestInterest | null> {
  const result = await pb.send<{ items: TestInterest[] }>(
    '/api/collections/test_interests/records',
    {
      method: 'GET',
      query: { sort: '-created', perPage: '1' },
    },
  )
  return result.items[0] ?? null
}
