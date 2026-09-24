import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  currentUser,
  refreshSession,
  signIn as signInService,
  signOut as signOutService,
  type AuthUser,
} from '@/services/auth'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(currentUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(pb.authStore.isValid ? (record as AuthUser | null) : null)
    })

    if (pb.authStore.isValid) {
      void refreshSession()
        .then((record) => setUser(record as AuthUser | null))
        .finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }

    return unsubscribe
  }, [])

  async function signIn(email: string, password: string) {
    const result = await signInService(email, password)
    setUser(result.record as AuthUser)
    return result.record as AuthUser
  }

  function signOut() {
    signOutService()
    setUser(null)
  }

  return {
    user,
    loading,
    isAuthenticated: pb.authStore.isValid,
    signIn,
    signOut,
  }
}
