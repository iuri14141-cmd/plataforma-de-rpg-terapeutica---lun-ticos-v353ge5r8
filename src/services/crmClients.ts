import pb from '@/lib/pocketbase/client'

export type CrmClient = {
  id: string
  name: string
  email: string
  phone: string
  updated_at: string
}

export type CrmClientsResult = {
  clients: CrmClient[]
  total: number
}

export async function listCrmClients(): Promise<CrmClientsResult> {
  try {
    return await pb.send<CrmClientsResult>('/backend/v1/clients', {
      method: 'GET',
    })
  } catch (requestError) {
    throw crmErrorToFriendly(requestError)
  }
}

// O backend já devolve mensagens em pt-BR no corpo ({ error: "..." }); a
// mensagem crua do SDK (ex.: "Failed to fetch", status 0) não serve ao usuário.
function crmErrorToFriendly(requestError: unknown): Error {
  const err = requestError as { status?: number; response?: { error?: unknown } }

  if (err?.status === 401 || err?.status === 403) {
    return new Error(
      'Sua sessão expirou ou você não tem acesso a esta área. Entre novamente na plataforma.',
    )
  }

  const backendMessage =
    err?.response && typeof err.response === 'object'
      ? String((err.response as { error?: unknown }).error ?? '').trim()
      : ''

  if (backendMessage) {
    return new Error(backendMessage)
  }

  if (err?.status === 502) {
    return new Error('O CRM não respondeu como esperado. Tente novamente em instantes.')
  }

  if (err?.status === 0 || err?.status === undefined) {
    return new Error(
      'Não foi possível falar com o servidor da plataforma. Verifique sua conexão e tente novamente.',
    )
  }

  return new Error('Ocorreu um erro inesperado ao carregar os clientes. Tente novamente.')
}
