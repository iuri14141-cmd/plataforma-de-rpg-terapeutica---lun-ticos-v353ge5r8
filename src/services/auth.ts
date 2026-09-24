import pb from '@/lib/pocketbase/client'

export type AuthUser = {
  id: string
  email: string
  name?: string
  fixture_key?: string
  tenant_id?: string
  test_role?: string
  access_status?: string
}

export async function signIn(email: string, password: string) {
  return pb.collection('users').authWithPassword<AuthUser>(email, password)
}

export async function refreshSession() {
  if (!pb.authStore.isValid) return null
  try {
    const result = await pb.collection('users').authRefresh<AuthUser>()
    return result.record
  } catch {
    pb.authStore.clear()
    return null
  }
}

export function signOut() {
  pb.authStore.clear()
}

export function currentUser(): AuthUser | null {
  return pb.authStore.isValid ? (pb.authStore.record as AuthUser | null) : null
}
