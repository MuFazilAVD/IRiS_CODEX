import type { ComponentType } from 'react'
import {
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  ChevronLeft,
  Database,
  DollarSign,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  Shield,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { MetLifeLogo } from '../common/MetLifeLogo'
import { useAuth } from '../../hooks/useAuth'
import type { AppRole } from '../../types/api'
import { useUiStore } from '../../store/uiStore'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
}

interface NavSection {
  label: string
  roles: AppRole[]
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    label: 'Operations',
    roles: ['super_admin', 'admin', 'underwriter', 'claims_ops', 'compliance'],
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Worklist', to: '/worklist', icon: ListTodo },
    ],
  },
  {
    label: 'Underwriting',
    roles: ['underwriter', 'super_admin'],
    items: [
      { label: 'Cedants', to: '/underwriting/cedants', icon: Building2 },
      { label: 'Contract Management', to: '/underwriting/contracts', icon: FileText },
      { label: 'Population', to: '/underwriting/population', icon: Users },
    ],
  },
  {
    label: 'Claims & Settlement',
    roles: ['claims_ops', 'super_admin'],
    items: [
      { label: 'Cession Files', to: '/claims/cession-files', icon: FolderOpen },
      { label: 'Settlements', to: '/claims/settlements', icon: DollarSign },
      { label: 'Calc Engine', to: '/claims/calculation-engine', icon: Calculator },
    ],
  },
  {
    label: 'Compliance',
    roles: ['compliance', 'super_admin'],
    items: [
      { label: 'Sanctions', to: '/compliance/sanctions', icon: Shield },
      { label: 'Audit', to: '/compliance/audit', icon: FileText },
      { label: 'Screening Cache', to: '/compliance/screening-cache', icon: Database },
    ],
  },
  {
    label: 'Reporting',
    roles: ['super_admin', 'admin', 'underwriter', 'claims_ops', 'compliance'],
    items: [{ label: 'Reports', to: '/reports', icon: BarChart3 }],
  },
  {
    label: 'Administration',
    roles: ['admin', 'super_admin'],
    items: [
      { label: 'Users & Roles', to: '/admin/users', icon: Users },
      { label: 'Reference Library', to: '/admin/library', icon: BookOpen },
    ],
  },
]

export function Sidebar() {
  const { user, effectiveRole } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const sidebarRole = user?.role === 'super_admin' ? 'super_admin' : effectiveRole

  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#112233] bg-iris-navy text-white transition-all ${sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
    >
      <div className="flex h-[72px] items-center gap-1 px-4">
        <div className="rounded-xl px-2 py-1.5 shadow-sm">
          <MetLifeLogo className={sidebarCollapsed ? 'h-7 w-9' : 'h-7 w-[108px]'} showWordmark={!sidebarCollapsed} />
        </div>
        {!sidebarCollapsed ? (
          <>
            {/* Transparent Pipe Divider */}
            <div className="h-6 w-px bg-white/20" />

            <div className="relative -top-[1px] text-lg font-bold leading-none tracking-tight text-white">
              IRiS
            </div>
          </>
        ) : null}
      </div>

      <div className="nav-scrollbar flex-1 overflow-y-auto px-2 pb-4">
        {sections
          .filter((section) => sidebarRole && section.roles.includes(sidebarRole))
          .map((section) => (
            <div key={section.label} className="mb-5">
              {!sidebarCollapsed ? (
                <div className="px-3 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#546E7A]">
                  {section.label}
                </div>
              ) : null}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${isActive
                        ? 'border-l-2 border-iris-teal bg-iris-navy-light text-white'
                        : 'text-iris-text-muted hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? <span>{item.label}</span> : null}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="mt-auto border-t border-white/10 px-3 py-4">
        <button
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-iris-text-muted hover:bg-white/10 hover:text-white"
          onClick={toggleSidebar}
          type="button"
        >
          <ChevronLeft className={`h-4 w-4 transition ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          {!sidebarCollapsed ? <span>Collapse menu</span> : null}
        </button>
        {!sidebarCollapsed ? (
          <div className="mt-3 px-2 text-[10px] text-[#546E7A]">
            <p>IRiS v2025.04.29</p>
            <p>Build 4182</p>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
