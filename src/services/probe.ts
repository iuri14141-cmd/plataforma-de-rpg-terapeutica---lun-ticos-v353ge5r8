import pb from '@/lib/pocketbase/client'

export type ProbeResult = {
  outcome: 'allowed' | 'denied'
  rule_id?: string
  error?: string
  identity?: {
    id: string
    fixture_key: string
    display_name: string
    role: string
    tenant_id: string
    status: string
  }
}

export async function probeTestAccess(fixtureKey: string): Promise<ProbeResult> {
  return pb.send<ProbeResult>('/backend/v1/test-access/probe', {
    method: 'POST',
    body: { fixture_key: fixtureKey },
  })
}
