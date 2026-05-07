import { AxiosError } from 'axios'
import { Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { AuthStatusScreen } from '../../components/auth/AuthStatusScreen'
import { MetLifeLogo } from '../../components/common/MetLifeLogo'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import type { AuthResponse } from '../../types/api'

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isSessionPending } = useAuth()
  const setSession = useAuthStore((state) => state.setSession)

  const [email, setEmail] = useState('admin@metlife-re.demo')
  const [password, setPassword] = useState('demo1234')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isSessionPending) {
    return <AuthStatusScreen message="Restoring sign-in status..." />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
      setSession(data.user, data.access_token)
      navigate('/dashboard', { replace: true })
    } catch (exception) {
      const axiosError = exception as AxiosError<{ details?: string }>
      if (axiosError.response?.data?.details) {
        setError(axiosError.response.data.details)
      } else if (axiosError.code === 'ERR_NETWORK') {
        setError('Unable to reach the auth service. Check that the backend is running and that the frontend origin is allowed.')
      } else {
        setError('Unable to sign in right now. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSso() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<AuthResponse>('/auth/sso')
      setSession(data.user, data.access_token)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Enterprise SSO is currently unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg flex min-h-screen items-center justify-center px-6 py-16">
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-4 text-white">
          <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
            <MetLifeLogo className="h-12 w-[150px]" />
          </div>
          <div className="h-10 w-px bg-white/20" />
          <div>
            <div className="text-2xl font-bold">IRiS</div>
            <div className="text-sm text-slate-300">Intelligent Reinsurance System</div>
          </div>
        </div>

        <div className="rounded-xl bg-white px-10 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-iris-text-primary">Secure sign-in</h1>
            <p className="mt-2 text-sm text-iris-text-secondary">Sign in to your workspace</p>
            <p className="mt-1 text-xs text-iris-text-muted">Enterprise SSO, MFA-enforced for production</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-iris-text-secondary" htmlFor="email">
                Email
              </label>
              <div className="input-shell">
                <Mail className="h-4 w-4 text-iris-text-muted" />
                <input
                  autoComplete="username"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-iris-text-secondary" htmlFor="password">
                  Password
                </label>
                <button className="text-sm text-iris-blue" type="button">
                  Forgot password?
                </button>
              </div>
              <div className="input-shell">
                <Lock className="h-4 w-4 text-iris-text-muted" />
                <input
                  autoComplete="current-password"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {error ? <div className="rounded-md bg-[#FDEDEC] px-3 py-2 text-sm text-[#922B21]">{error}</div> : null}

            <button className="btn-primary w-full justify-center" disabled={loading} type="submit">
              {loading ? 'Signing in...' : 'Sign in to IRiS'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-iris-text-muted">
            <span className="h-px flex-1 bg-iris-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-iris-border" />
          </div>

          <button className="btn-secondary w-full justify-center" disabled={loading} onClick={handleSso} type="button">
            Continue with Enterprise SSO
          </button>
        </div>
      </div>
    </div>
  )
}
