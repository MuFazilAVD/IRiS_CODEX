import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AuthStatusScreen } from './AuthStatusScreen'
import { useAuth } from '../../hooks/useAuth'

export function ProtectedRoute() {
  const { isAuthenticated, isSessionPending } = useAuth()
  const location = useLocation()

  if (isSessionPending) {
    return <AuthStatusScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
