import type { ReactNode } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Component } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface AppErrorBoundaryProps {
  children: ReactNode
  resetKey?: string
  scope: 'app' | 'page'
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('IRiS UI error boundary captured a rendering failure', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      scope: this.props.scope,
    })
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKey && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} scope={this.props.scope} />
    }

    return this.props.children
  }
}

function ErrorFallback({ onReset, scope }: { onReset: () => void; scope: 'app' | 'page' }) {
  const navigate = useNavigate()
  const title = scope === 'app' ? 'IRiS hit an unexpected application error' : 'This page hit an unexpected rendering error'
  const subtitle =
    scope === 'app'
      ? 'The shell did not finish rendering cleanly. You can retry the current view or return to the dashboard.'
      : 'The current module failed while rendering. Retrying or navigating away will reset the boundary.'

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[620px] rounded-[28px] border border-[#F4C8C9] bg-white p-8 shadow-[0_18px_50px_rgba(13,27,42,0.12)]">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[#FDEDEC] p-3 text-[#922B21]">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Error Boundary</p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight text-iris-text-primary">{title}</h1>
            <p className="mt-2 text-[14px] leading-6 text-iris-text-secondary">{subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={onReset} type="button">
                <RotateCcw className="h-4 w-4" />
                Retry Render
              </button>
              <button className="btn-secondary" onClick={() => navigate('/dashboard')} type="button">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </button>
              <button className="btn-secondary" onClick={() => window.location.reload()} type="button">
                Hard Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RoutedPageErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <AppErrorBoundary resetKey={location.pathname} scope="page">
      {children}
    </AppErrorBoundary>
  )
}
