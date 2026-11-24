import pb from '@/lib/pocketbase/client'

export type ScreeningDecision = {
  decision_id: string
  decision_record_id: string
  submission_id: string
  decision: 'elegivel' | 'nao_elegivel' | 'pendente'
  reason: string
  decided_by: string
  submission_status: string
  request_id: string
  created_at: string
  audit_event_id: string
}

export async function createScreeningDecision(
  submissionId: string,
  decision: 'elegivel' | 'nao_elegivel' | 'pendente',
  reason: string,
): Promise<ScreeningDecision> {
  return pb.send<ScreeningDecision>('/backend/v1/test-screening-decisions', {
    method: 'POST',
    body: { submission_id: submissionId, decision, reason },
  })
}

export type ScreeningDecisionItem = {
  decision_id: string
  decision_record_id: string
  decision: string
  reason: string
  decided_by: string
  created_at: string
}

export type ScreeningDecisionTimeline = {
  submission_id: string
  display_name: string
  submission_status: string
  items: ScreeningDecisionItem[]
  count: number
  request_id: string
}

export async function getScreeningDecisionTimeline(
  submissionId: string,
): Promise<ScreeningDecisionTimeline> {
  return pb.send<ScreeningDecisionTimeline>(
    `/backend/v1/test-screening-decisions/${encodeURIComponent(submissionId)}`,
    { method: 'GET' },
  )
}
