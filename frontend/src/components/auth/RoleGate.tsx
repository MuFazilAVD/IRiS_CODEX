import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import type { AppRole } from '../../types/api'

interface RoleGateProps {
  roles: AppRole[]
  children: ReactNode
}

export function RoleGate({ roles, children }: RoleGateProps) {
  const { user, effectiveRole } = useAuth()

  if (user?.role === 'super_admin') {
    return <>{children}</>
  }

  if (!effectiveRole || !roles.includes(effectiveRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
