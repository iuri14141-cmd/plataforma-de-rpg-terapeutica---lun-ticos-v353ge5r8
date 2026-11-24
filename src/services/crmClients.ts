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
    const err = requestError as { status?: number }
    if (err?.status === 401 || err?.status === 403) {
      throw new Error(
        'Sua sessão expirou ou você não tem acesso a esta área. Entre novamente na plataforma.',
      )
    }
    throw requestError
  }
}
