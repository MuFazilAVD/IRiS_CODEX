import { IRiSChatbot } from '../common/IRiSChatbot'
import { RoutedPageErrorBoundary } from '../common/AppErrorBoundary'
import { Outlet } from 'react-router-dom'

import { useUiStore } from '../../store/uiStore'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const { sidebarCollapsed } = useUiStore()

  return (
    <div className="min-h-screen bg-iris-bg">
      <Sidebar />
      <div className={sidebarCollapsed ? 'ml-16 transition-all' : 'ml-60 transition-all'}>
        <Topbar />
        <main className="min-h-[calc(100vh-56px)] px-6 pb-8 pt-[80px] text-[13px] leading-5">
          <RoutedPageErrorBoundary>
            <Outlet />
          </RoutedPageErrorBoundary>
        </main>
        <IRiSChatbot />
      </div>
    </div>
  )
}
