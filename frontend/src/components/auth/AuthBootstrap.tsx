import { useEffect } from 'react'

import { api } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import type { User } from '../../types/api'

export function AuthBootstrap() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const sessionStatus = useAuthStore((state) => state.sessionStatus)
  const validateSession = useAuthStore((state) => state.validateSession)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    if (!hasHydrated || sessionStatus !== 'unknown') {
      return
    }

    if (!token || !user) {
      logout()
      return
    }

    const controller = new AbortController()
    let isActive = true

    async function validatePersistedSession() {
      try {
        const { data } = await api.get<User>('/auth/me', { signal: controller.signal })
        if (isActive) {
          validateSession(data)
        }
      } catch {
        if (!controller.signal.aborted && isActive) {
          logout()
        }
      }
    }

    void validatePersistedSession()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [hasHydrated, logout, sessionStatus, token, user, validateSession])

  return null
}
