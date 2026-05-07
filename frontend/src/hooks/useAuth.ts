import { useAuthStore } from '../store/authStore'
import type { AppRole } from '../types/api'

export function useAuth() {
  const { user, token, activeRole, logout, setActiveRole, hasHydrated, sessionStatus } = useAuthStore()

  const effectiveRole: AppRole | null =
    user?.role === 'super_admin' ? activeRole ?? 'admin' : user?.role ?? null

  return {
    user,
    token,
    activeRole,
    effectiveRole,
    hasHydrated,
    sessionStatus,
    isAuthenticated: sessionStatus === 'authenticated' && Boolean(user && token),
    isSessionPending: !hasHydrated || sessionStatus === 'unknown',
    logout,
    setActiveRole,
  }
}
