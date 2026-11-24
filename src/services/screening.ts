import pb from '@/lib/pocketbase/client'

export type ScreeningSubmission = {
  duplicate?: boolean
  submission_id: string
  display_name: string
  contact_key: string
  status: string
  request_id: string
  tenant_id: string
  created_at: string
  audit_event_id: string
}

export type ScreeningInput = {
  display_name: string
  contact_key: string
  motivation: string
  goal: string
  ack_not_replacement: boolean
  ack_no_diagnosis: boolean
  consent_recording: boolean
  consent_confidentiality: boolean
}

export async function createScreeningSubmission(
  input: ScreeningInput,
): Promise<ScreeningSubmission> {
  return pb.send<ScreeningSubmission>('/backend/v1/test-screening-submissions', {
    method: 'POST',
    body: input,
  })
}

export type ScreeningQueueItem = {
  submission_id: string
  display_name: string
  contact_key: string
  motivation: string
  goal: string
  ack_not_replacement: boolean
  ack_no_diagnosis: boolean
  consent_recording: boolean
  consent_confidentiality: boolean
  status: string
  created_at: string
}

export type ScreeningQueue = {
  items: ScreeningQueueItem[]
  count: number
  request_id: string
}

export async function getScreeningQueue(): Promise<ScreeningQueue> {
  return pb.send<ScreeningQueue>('/backend/v1/test-screening-queue', {
    method: 'GET',
  })
}
