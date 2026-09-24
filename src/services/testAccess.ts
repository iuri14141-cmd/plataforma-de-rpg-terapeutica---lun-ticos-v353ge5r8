import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export type TestIdentity = RecordModel & {
  fixture_key: string
  display_name: string
  role: string
  tenant_id: string
  status: string
  user_id?: string
  is_synthetic: boolean
}

export async function getAccessibleTestIdentities() {
  return pb.collection('test_identities').getFullList<TestIdentity>({
    sort: 'display_name',
    fields: 'id,fixture_key,display_name,role,tenant_id,status,user_id,is_synthetic',
  })
}
