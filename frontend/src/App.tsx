import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthBootstrap } from './components/auth/AuthBootstrap'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RoleGate } from './components/auth/RoleGate'
import { RoutedPageErrorBoundary } from './components/common/AppErrorBoundary'
import { ToastViewport } from './components/common/ToastViewport'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/auth/LoginPage'
import { ReferenceLibraryPage } from './pages/admin/library/ReferenceLibraryPage'
import { AdminUsersPage } from './pages/admin/users/AdminUsersPage'
import { CalcEnginePage } from './pages/claims/calculation/CalcEnginePage'
import { CessionFilesPage } from './pages/claims/cession/CessionFilesPage'
import { SettlementsPage } from './pages/claims/settlements/SettlementsPage'
import { AuditPage } from './pages/compliance/AuditPage'
import { SanctionsPage } from './pages/compliance/SanctionsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { OperationsLandingPage } from './pages/operations/OperationsLandingPage'
import { PipelinePage } from './pages/operations/PipelinePage'
import { ReportDetailPage } from './pages/reports/ReportDetailPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { CedantDetailPage } from './pages/underwriting/cedants/CedantDetailPage'
import { CedantsPage } from './pages/underwriting/cedants/CedantsPage'
import { ContractDetailPage } from './pages/underwriting/contracts/ContractDetailPage'
import { ContractsPage } from './pages/underwriting/contracts/ContractsPage'
import { PopulationPage } from './pages/underwriting/population/PopulationPage'
import { WorklistDetailPage } from './pages/worklist/WorklistDetailPage'
import { WorklistPage } from './pages/worklist/WorklistPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <>
        <AuthBootstrap />
        <Routes>
          <Route
            path="/login"
            element={
              <RoutedPageErrorBoundary>
                <LoginPage />
              </RoutedPageErrorBoundary>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/:reportId" element={<ReportDetailPage />} />
              <Route path="/worklist" element={<WorklistPage />} />
              <Route path="/worklist/:wlId" element={<WorklistDetailPage />} />
              <Route
                path="/underwriting/cedants"
                element={
                  <RoleGate roles={['underwriter', 'super_admin']}>
                    <CedantsPage />
                  </RoleGate>
                }
              />
              <Route
                path="/underwriting/cedants/:id"
                element={
                  <RoleGate roles={['underwriter', 'super_admin']}>
                    <CedantDetailPage />
                  </RoleGate>
                }
              />
              <Route
                path="/underwriting/contracts"
                element={
                  <RoleGate roles={['underwriter', 'super_admin']}>
                    <ContractsPage />
                  </RoleGate>
                }
              />
              <Route
                path="/underwriting/contracts/:id"
                element={
                  <RoleGate roles={['underwriter', 'super_admin']}>
                    <ContractDetailPage />
                  </RoleGate>
                }
              />
              <Route
                path="/underwriting/population"
                element={
                  <RoleGate roles={['underwriter', 'super_admin']}>
                    <PopulationPage />
                  </RoleGate>
                }
              />
              <Route
                path="/claims/cession-files"
                element={
                  <RoleGate roles={['claims_ops', 'super_admin']}>
                    <CessionFilesPage />
                  </RoleGate>
                }
              />
              <Route
                path="/operations"
                element={
                  <RoleGate roles={['claims_ops', 'super_admin']}>
                    <OperationsLandingPage />
                  </RoleGate>
                }
              />
              <Route
                path="/operations/:processId"
                element={
                  <RoleGate roles={['claims_ops', 'super_admin']}>
                    <PipelinePage />
                  </RoleGate>
                }
              />
              <Route
                path="/claims/settlements"
                element={
                  <RoleGate roles={['claims_ops', 'super_admin']}>
                    <SettlementsPage />
                  </RoleGate>
                }
              />
              <Route
                path="/claims/calculation-engine"
                element={
                  <RoleGate roles={['claims_ops', 'super_admin']}>
                    <CalcEnginePage />
                  </RoleGate>
                }
              />
              <Route
                path="/compliance/audit"
                element={
                  <RoleGate roles={['compliance', 'super_admin']}>
                    <AuditPage />
                  </RoleGate>
                }
              />
              <Route
                path="/compliance/sanctions"
                element={
                  <RoleGate roles={['compliance', 'super_admin']}>
                    <SanctionsPage />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RoleGate roles={['admin', 'super_admin']}>
                    <AdminUsersPage />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/library"
                element={
                  <RoleGate roles={['admin', 'super_admin']}>
                    <ReferenceLibraryPage />
                  </RoleGate>
                }
              />
            </Route>
          </Route>
        </Routes>
        <ToastViewport />
      </>
    </QueryClientProvider>
  )
}
