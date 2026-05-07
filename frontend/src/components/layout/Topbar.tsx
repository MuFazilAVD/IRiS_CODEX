import { ChevronDown, LogOut } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useUiStore } from '../../store/uiStore'

const roleLabels = {
  admin: 'Admin',
  underwriter: 'Underwriting',
  claims_ops: 'Claims Ops',
  compliance: 'Compliance',
}

export function Topbar() {
  const { user, activeRole, setActiveRole, logout } = useAuth()
  const { sidebarCollapsed } = useUiStore()

  const initials = user?.full_name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      className={`fixed right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-iris-border bg-white px-6 ${
        sidebarCollapsed ? 'left-16' : 'left-60'
      }`}
    >
      <span className="text-xs text-iris-text-secondary">Production · EU-WEST-2 · SOC 2 Type II</span>
      <div className="flex items-center gap-4">
        {user?.role === 'super_admin' ? (
          <label className="inline-flex items-center gap-2 rounded-md border border-iris-border bg-white px-3 py-2 text-sm text-iris-text-primary">
            <span className="hidden text-xs text-iris-text-secondary md:inline">Role</span>
            <select
              className="bg-transparent text-sm outline-none"
              value={activeRole ?? 'admin'}
              onChange={(event) => setActiveRole(event.target.value as 'admin' | 'underwriter' | 'claims_ops' | 'compliance')}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-iris-text-muted" />
          </label>
        ) : null}
        <div className="flex items-center gap-3 rounded-full border border-iris-border px-2 py-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-iris-blue text-sm font-semibold text-white">
            {initials ?? 'IR'}
          </div>
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-iris-text-primary">{user?.full_name}</p>
            <p className="text-xs text-iris-text-secondary">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button className="rounded p-1 text-iris-text-secondary hover:bg-iris-bg" onClick={logout} type="button">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
