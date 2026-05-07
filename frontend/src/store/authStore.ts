import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AppRole, User } from '../types/api'

type EffectiveRole = Exclude<AppRole, 'super_admin'>
type SessionStatus = 'unknown' | 'authenticated' | 'anonymous'

function deriveActiveRole(user: User | null, activeRole: EffectiveRole | null): EffectiveRole | null {
  if (!user) {
    return null
  }

  if (user.role === 'super_admin') {
    return activeRole ?? 'admin'
  }

  return user.role
}

interface AuthState {
  user: User | null
  token: string | null
  activeRole: EffectiveRole | null
  hasHydrated: boolean
  sessionStatus: SessionStatus
  setSession: (user: User, token: string) => void
  validateSession: (user: User) => void
  markHydrated: () => void
  setActiveRole: (role: EffectiveRole) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      activeRole: null,
      hasHydrated: false,
      sessionStatus: 'unknown',
      setSession: (user, token) =>
        set((state) => ({
          user,
          token,
          activeRole: deriveActiveRole(user, state.activeRole),
          hasHydrated: true,
          sessionStatus: 'authenticated',
        })),
      validateSession: (user) =>
        set((state) => ({
          user,
          activeRole: deriveActiveRole(user, state.activeRole),
          hasHydrated: true,
          sessionStatus: 'authenticated',
        })),
      markHydrated: () =>
        set((state) => ({
          activeRole: deriveActiveRole(state.user, state.activeRole),
          hasHydrated: true,
          sessionStatus: state.user && state.token ? 'unknown' : 'anonymous',
        })),
      setActiveRole: (role) => set({ activeRole: role }),
      logout: () =>
        set({
          user: null,
          token: null,
          activeRole: null,
          hasHydrated: true,
          sessionStatus: 'anonymous',
        }),
    }),
    {
      name: 'iris-auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        activeRole: state.activeRole,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    },
  ),
)
