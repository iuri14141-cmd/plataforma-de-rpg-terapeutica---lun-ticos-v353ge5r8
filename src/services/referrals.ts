import pb from '@/lib/pocketbase/client'

export type TestReferral = {
  referral_id: string
  referral_record_id: string
  submission_id: string
  destination: 'individual' | 'grupo'
  reason: string
  referred_by: string
  request_id: string
  created_at: string
  audit_event_id: string
  participant_created?: boolean
  participant_id?: string
}

export async function createTestReferral(
  submissionId: string,
  destination: 'individual' | 'grupo',
  reason: string,
): Promise<TestReferral> {
  return pb.send<TestReferral>('/backend/v1/test-referrals', {
    method: 'POST',
    body: { submission_id: submissionId, destination, reason },
  })
}

export type ReferralItem = {
  referral_id: string
  referral_record_id: string
  destination: string
  reason: string
  referred_by: string
  created_at: string
}

export type ReferralTimeline = {
  submission_id: string
  display_name: string
  items: ReferralItem[]
  count: number
  request_id: string
}

export async function getReferralTimeline(submissionId: string): Promise<ReferralTimeline> {
  return pb.send<ReferralTimeline>(
    `/backend/v1/test-referrals/${encodeURIComponent(submissionId)}`,
    { method: 'GET' },
  )
}
