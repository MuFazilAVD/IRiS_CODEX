import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, ShieldX } from 'lucide-react'

import { api } from '../../../api/client'
import { Breadcrumbs } from '../../../components/common/Breadcrumbs'
import { PageHeader } from '../../../components/common/PageHeader'
import { TableSkeleton } from '../../../components/common/Skeleton'
import { StatusBadge } from '../../../components/common/StatusBadge'
import { useUiStore } from '../../../store/uiStore'
import type {
  AdminAccessLogsPayload,
  AdminApprovalMatrixPayload,
  AdminCreateUserResponse,
  AdminPermissionsPayload,
  AdminUserRecord,
  AdminUsersPayload,
  AppRole,
} from '../../../types/api'

type UsersTab = 'users' | 'permissions' | 'approval_matrix' | 'access_logs'
const ROLE_OPTIONS: AppRole[] = ['super_admin', 'admin', 'underwriter', 'claims_ops', 'compliance']

export function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<UsersTab>('users')
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null)
  const pushToast = useUiStore((state) => state.pushToast)

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<AdminUsersPayload>('/admin/users')).data,
  })

  const permissionsQuery = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => (await api.get<AdminPermissionsPayload>('/admin/permissions')).data,
  })

  const approvalMatrixQuery = useQuery({
    queryKey: ['admin-approval-matrix'],
    queryFn: async () => (await api.get<AdminApprovalMatrixPayload>('/admin/approval-matrix')).data,
  })

  const accessLogsQuery = useQuery({
    queryKey: ['admin-access-logs'],
    queryFn: async () => (await api.get<AdminAccessLogsPayload>('/admin/audit-log')).data,
  })

  async function refreshAll() {
    await Promise.all([usersQuery.refetch(), accessLogsQuery.refetch()])
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Administration' }, { label: 'Users & Roles' }]} />
      <PageHeader
        title="User & Role Management"
        action={
          <button className="btn-primary" onClick={() => setNewUserOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            New User
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <TabButton active={activeTab === 'users'} label="Users" onClick={() => setActiveTab('users')} />
        <TabButton active={activeTab === 'permissions'} label="Permissions" onClick={() => setActiveTab('permissions')} />
        <TabButton active={activeTab === 'approval_matrix'} label="Approval Matrix" onClick={() => setActiveTab('approval_matrix')} />
        <TabButton active={activeTab === 'access_logs'} label="Access Logs" onClick={() => setActiveTab('access_logs')} />
      </div>

      {activeTab === 'users' ? (
        <section className="rounded-[22px] border border-iris-border bg-white shadow-sm">
          <div className="border-b border-[#E8EDF2] px-5 py-4">
            <p className="text-[18px] font-bold text-iris-text-primary">{usersQuery.data?.total ?? 0} users</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-[#F8F9FA]">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading ? null : (
                  (usersQuery.data?.users ?? []).map((user) => (
                    <tr key={user.id} className="border-t border-[#EEF2F5]">
                      <td className="px-4 py-3 font-medium text-iris-text-primary">{user.full_name ?? '-'}</td>
                      <td className="px-4 py-3 text-iris-text-secondary">{user.email}</td>
                      <td className="px-4 py-3">
                        <RolePill role={user.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={user.status}>{titleCase(user.status)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-iris-text-secondary">{formatTimestamp(user.last_login)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-secondary" onClick={() => setEditingUser(user)} type="button">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            className="btn-secondary border-[#F4C8C9] text-[#922B21] hover:bg-[#FFF5F5]"
                            onClick={() => void handleRevoke(user, pushToast, refreshAll)}
                            type="button"
                          >
                            <ShieldX className="h-4 w-4" />
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {usersQuery.isLoading ? <TableSkeleton columns={6} rows={6} /> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'permissions' ? (
        <MatrixPanel
          columns={['Module', 'View', 'Edit', 'Approve', 'Override']}
          rows={(permissionsQuery.data?.items ?? []).map((item) => [item.module, item.view.join(' · '), item.edit.join(' · '), item.approve.join(' · '), item.override.join(' · ')])}
          loading={permissionsQuery.isLoading}
          title="Module Permissions Matrix"
        />
      ) : null}

      {activeTab === 'approval_matrix' ? (
        <MatrixPanel
          columns={['Action', 'Threshold', 'Required Approvers']}
          rows={(approvalMatrixQuery.data?.items ?? []).map((item) => [item.action, item.threshold, item.required_approvers])}
          loading={approvalMatrixQuery.isLoading}
          title="Approval Thresholds"
        />
      ) : null}

      {activeTab === 'access_logs' ? (
        <MatrixPanel
          columns={['Timestamp', 'User', 'Resource', 'Action', 'IP']}
          rows={(accessLogsQuery.data?.items ?? []).map((item) => [
            formatTimestamp(item.timestamp),
            item.user,
            item.resource,
            item.action,
            item.ip,
          ])}
          loading={accessLogsQuery.isLoading}
          title="Access Events (last 24h)"
          actionColumnIndex={3}
        />
      ) : null}

      {newUserOpen ? (
        <NewUserModal
          onClose={() => setNewUserOpen(false)}
          onCreated={async (response) => {
            setNewUserOpen(false)
            await refreshAll()
            pushToast({
              tone: 'success',
              message: `${response.email} created. Temporary password: ${response.temp_password}`,
            })
          }}
          onError={(message) => pushToast({ tone: 'error', message })}
        />
      ) : null}

      {editingUser ? (
        <EditUserDrawer
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={async (message) => {
            setEditingUser(null)
            await refreshAll()
            pushToast({ tone: 'success', message })
          }}
          onError={(message) => pushToast({ tone: 'error', message })}
        />
      ) : null}
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={active ? 'btn-primary' : 'btn-secondary'} onClick={onClick} type="button">
      {label}
    </button>
  )
}

function RolePill({ role }: { role: AppRole }) {
  const style =
    role === 'underwriter'
      ? 'bg-[#EAF2FF] text-[#1F5FAA]'
      : role === 'claims_ops'
        ? 'bg-[#E8F8F5] text-[#0E6251]'
        : role === 'compliance'
          ? 'bg-[#FEF5E7] text-[#AF601A]'
          : role === 'admin'
            ? 'bg-[#F2F3F4] text-[#626567]'
            : 'bg-[#0D1B2A] text-white'
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${style}`}>{roleLabel(role)}</span>
}

function MatrixPanel({
  title,
  columns,
  rows,
  loading,
  actionColumnIndex,
}: {
  title: string
  columns: string[]
  rows: string[][]
  loading: boolean
  actionColumnIndex?: number
}) {
  return (
    <section className="rounded-[22px] border border-iris-border bg-white shadow-sm">
      <div className="border-b border-[#E8EDF2] px-5 py-4">
        <p className="text-[18px] font-bold text-iris-text-primary">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#F8F9FA]">
            <tr>
              {columns.map((label) => (
                <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-text-secondary">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? null : (
              rows.map((row, index) => (
                <tr key={`${row[0]}-${index}`} className="border-t border-[#EEF2F5]">
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-iris-text-secondary">
                      {actionColumnIndex === cellIndex ? <ActionBadge action={cell} /> : <span className="text-iris-text-primary">{cell}</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {loading ? <TableSkeleton columns={columns.length} rows={5} /> : null}
      </div>
    </section>
  )
}

function ActionBadge({ action }: { action: string }) {
  const style =
    action === 'CREATE'
      ? 'bg-[#D5F5E3] text-[#1E8449]'
      : action === 'EDIT'
        ? 'bg-[#EAF2FF] text-[#1F5FAA]'
        : action === 'DOWNLOAD'
          ? 'bg-[#FEF5E7] text-[#AF601A]'
          : action === 'DELETE'
            ? 'bg-[#FDEDEC] text-[#922B21]'
            : 'bg-[#F2F3F4] text-[#626567]'
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${style}`}>{action}</span>
}

function NewUserModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void
  onCreated: (response: AdminCreateUserResponse) => Promise<void>
  onError: (message: string) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('underwriter')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setBusy(true)
    try {
      const { data } = await api.post<AdminCreateUserResponse>('/admin/users', {
        full_name: fullName,
        email,
        role,
      })
      await onCreated(data)
    } catch (caughtError: unknown) {
      onError(extractErrorMessage(caughtError) ?? 'Unable to create the user.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalFrame title="New User" onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Full Name">
          <input className="field-input" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label="Email">
          <input className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Role">
          <select className="field-input" value={role} onChange={(event) => setRole(event.target.value as AppRole)}>
            {ROLE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} type="button">
          Cancel
        </button>
        <button className="btn-primary" disabled={busy || !fullName || !email} onClick={() => void handleSubmit()} type="button">
          {busy ? 'Creating...' : 'Create & Send Invite'}
        </button>
      </div>
    </ModalFrame>
  )
}

function EditUserDrawer({
  user,
  onClose,
  onSaved,
  onError,
}: {
  user: AdminUserRecord
  onClose: () => void
  onSaved: (message: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [role, setRole] = useState<AppRole>(user.role)
  const [status, setStatus] = useState(user.status)
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    setBusy(true)
    try {
      await api.patch(`/admin/users/${user.id}`, { role, status })
      await onSaved(`${user.email} updated.`)
    } catch (caughtError: unknown) {
      onError(extractErrorMessage(caughtError) ?? 'Unable to update the user.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#0D1B2A]/25">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-iris-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E8EDF2] px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-text-muted">Edit User</p>
            <h2 className="mt-2 text-[22px] font-bold text-iris-text-primary">{user.full_name ?? user.email}</h2>
          </div>
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="grid gap-4 px-6 py-5">
          <Field label="Name">
            <div className="field-input bg-[#F8FAFC]">{user.full_name ?? '-'}</div>
          </Field>
          <Field label="Email">
            <div className="field-input bg-[#F8FAFC]">{user.email}</div>
          </Field>
          <Field label="Role">
            <select className="field-input" value={role} onChange={(event) => setRole(event.target.value as AppRole)}>
              {ROLE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="field-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminUserRecord['status'])}
            >
              <option value="active">active</option>
              <option value="invited">invited</option>
              <option value="suspended">suspended</option>
              <option value="inactive">inactive</option>
            </select>
          </Field>
        </div>
        <div className="mt-auto flex justify-end gap-2 border-t border-[#E8EDF2] px-6 py-4">
          <button className="btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => void handleSave()} type="button">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalFrame({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0D1B2A]/25 p-4">
      <div className="w-full max-w-[560px] rounded-[24px] border border-iris-border bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[22px] font-bold text-iris-text-primary">{title}</h2>
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-iris-text-muted">{label}</p>
      {children}
    </label>
  )
}

async function handleRevoke(
  user: AdminUserRecord,
  pushToast: (toast: { tone: 'success' | 'error'; message: string }) => string,
  refreshAll: () => Promise<void>,
) {
  if (!window.confirm(`Revoke access for ${user.email}?`)) {
    return
  }

  try {
    await api.delete(`/admin/users/${user.id}`)
    await refreshAll()
    pushToast({ tone: 'success', message: `${user.email} revoked and marked suspended.` })
  } catch (caughtError: unknown) {
    pushToast({ tone: 'error', message: extractErrorMessage(caughtError) ?? 'Unable to revoke this user.' })
  }
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function roleLabel(role: AppRole) {
  if (role === 'underwriter') {
    return 'Underwriting'
  }
  if (role === 'claims_ops') {
    return 'Claims Ops'
  }
  if (role === 'super_admin') {
    return 'Super Admin'
  }
  return titleCase(role)
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return '—'
  }
  return value.replace('T', ' ').replace('Z', '').slice(0, 16)
}

function extractErrorMessage(caughtError: unknown) {
  const maybeMessage = caughtError as { response?: { data?: { details?: string } } }
  return maybeMessage.response?.data?.details
}
