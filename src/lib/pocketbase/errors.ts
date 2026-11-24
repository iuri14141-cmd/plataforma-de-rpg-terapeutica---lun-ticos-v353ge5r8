import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.'
  }
  const body = error.response as Record<string, unknown> | undefined
  const bodyMessage = body && typeof body.error === 'string' ? body.error.trim() : ''
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) return msgs.join(' ')
  if (bodyMessage) return bodyMessage
  if (error.status === 0) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.'
  }
  return error.message || 'Ocorreu um erro inesperado. Tente novamente.'
}
