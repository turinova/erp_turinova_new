'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Shield, Users } from 'lucide-react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  APP_PAGES,
  PAGE_ACCESS_TEMPLATES,
  type AppPageCategory,
  type PageAccessTemplateId
} from '@/lib/permissions/pages'
import type { TenantRole } from '@/lib/supabase/database.types'
import type { TenantSeatInfo } from '@/lib/tenancy/seats'
import {
  createTenantUser,
  getMembershipPageAccess,
  updateMembershipPageAccess,
  updateMembershipRole,
  type TenantUserListItem
} from '@/lib/users/actions'

type UsersClientProps = {
  rows: TenantUserListItem[]
  loadError: string | null
  serviceRoleMissing: boolean
  entitledPages: string[]
  seats: TenantSeatInfo
}

const CATEGORIES: AppPageCategory[] = [
  'Fő',
  'Műhely',
  'Törzsadatok',
  'Beállítások'
]

function roleTone(role: TenantRole): 'success' | 'info' | 'neutral' | 'warning' {
  if (role === 'owner') return 'success'
  if (role === 'admin') return 'info'
  if (role === 'viewer') return 'warning'
  return 'neutral'
}

export function UsersClient({
  rows,
  loadError,
  serviceRoleMissing,
  entitledPages,
  seats
}: UsersClientProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [permsTarget, setPermsTarget] = useState<TenantUserListItem | null>(
    null
  )

  const seatLabel =
    seats.maxSeats === null
      ? `${seats.usedSeats} felhasználó`
      : `${seats.usedSeats} / ${seats.maxSeats} felhasználó`

  return (
    <div>
      <PageHeader
        title="Felhasználók"
        description={`Cégtagok és oldaljogok — ${seatLabel}. Egy fiók egyszerre egy helyen lehet bejelentkezve.`}
        actions={
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            disabled={serviceRoleMissing || seats.atLimit}
          >
            <Plus className="size-3.5" aria-hidden />
            Új felhasználó
          </Button>
        }
      />

      {seats.atLimit ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-ink"
          role="status"
        >
          Elérted a felhasználói limitt ({seats.usedSeats}/{seats.maxSeats}).
          Bővítéshez keresd a platform operátort.
        </p>
      ) : null}

      {serviceRoleMissing ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-ink"
          role="status"
        >
          A felhasználó létrehozáshoz add meg a{' '}
          <code className="text-hint">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
          környezeti változót a szerveren.
        </p>
      ) : null}

      {loadError ? (
        <p
          className="rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <Users className="size-8 text-ink-secondary" aria-hidden />
          <p className="text-body text-ink-secondary">Nincs felhasználó.</p>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Email</DataTableHeaderCell>
              <DataTableHeaderCell>Szerep</DataTableHeaderCell>
              <DataTableHeaderCell>Csatlakozott</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => (
              <DataTableRow key={row.membershipId}>
                <DataTableCell className="font-medium text-ink">
                  {row.email}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={roleTone(row.role)}>
                    {row.roleLabel}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="tabular-nums text-ink-secondary">
                  {formatDate(row.createdAt)}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPermsTarget(row)}
                  >
                    <Shield className="size-3.5" aria-hidden />
                    Jogok
                  </Button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          setCreateOpen(false)
          router.refresh()
        }}
      />

      {permsTarget ? (
        <PermissionsDialog
          open={Boolean(permsTarget)}
          user={permsTarget}
          entitledPages={entitledPages}
          onOpenChange={(open) => {
            if (!open) setPermsTarget(null)
          }}
          onSuccess={() => {
            setPermsTarget(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [template, setTemplate] = useState<PageAccessTemplateId>('office')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setPassword('')
    setRole('member')
    setTemplate('office')
    setError(null)
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const result = await createTenantUser({
        email,
        password,
        role,
        template
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success('Felhasználó létrehozva.')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[440px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Új felhasználó</DialogTitle>
          <DialogDescription>
            Email, jelszó, szerep és oldaljog-sablon. A jogosultságok később
            finomhangolhatók.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Email" htmlFor="new-user-email">
            <Input
              id="new-user-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Ideiglenes jelszó" htmlFor="new-user-password">
            <Input
              id="new-user-password"
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Legalább 8 karakter"
            />
          </FormField>
          <FormField label="Szerep" htmlFor="new-user-role">
            <Select
              id="new-user-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'admin' | 'member' | 'viewer')
              }
            >
              <option value="admin">Adminisztrátor</option>
              <option value="member">Tag</option>
              <option value="viewer">Csak megtekintés</option>
            </Select>
          </FormField>
          <FormField label="Oldaljog sablon" htmlFor="new-user-template">
            <Select
              id="new-user-template"
              value={template}
              onChange={(e) =>
                setTemplate(e.target.value as PageAccessTemplateId)
              }
            >
              {(
                Object.entries(PAGE_ACCESS_TEMPLATES) as Array<
                  [PageAccessTemplateId, { label: string }]
                >
              ).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </FormField>
          {error ? (
            <p className="text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            onClick={() => void handleCreate()}
          >
            Létrehozás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({
  open,
  user,
  entitledPages,
  onOpenChange,
  onSuccess
}: {
  open: boolean
  user: TenantUserListItem
  entitledPages: string[]
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [access, setAccess] = useState<Record<string, boolean>>({})
  const [role, setRole] = useState(user.role)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [entitled, setEntitled] = useState<string[]>(entitledPages)

  useEffect(() => {
    if (!open) return
    setRole(user.role)
    setError(null)
    setFetching(true)
    void getMembershipPageAccess(user.membershipId).then((result) => {
      if (result.error) {
        setError(result.error)
        setAccess({})
      } else {
        setAccess(result.map)
        if (result.entitledPages.length > 0) {
          setEntitled(result.entitledPages)
        }
      }
      setFetching(false)
    })
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, user.membershipId, user.role])

  const entitledSet = useMemo(() => new Set(entitled), [entitled])

  const visiblePages = useMemo(
    () =>
      APP_PAGES.filter(
        (p) => Boolean(p.always) || entitledSet.has(p.key)
      ),
    [entitledSet]
  )

  const byCategory = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      pages: visiblePages.filter((p) => p.category === category)
    })).filter((g) => g.pages.length > 0)
  }, [visiblePages])

  function applyTemplate(id: PageAccessTemplateId) {
    const keys = new Set(PAGE_ACCESS_TEMPLATES[id].keys)
    const next: Record<string, boolean> = { ...access }
    for (const page of visiblePages) {
      next[page.key] = Boolean(page.always) || keys.has(page.key)
    }
    setAccess(next)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      if (user.role !== 'owner' && role !== user.role && role !== 'owner') {
        const roleResult = await updateMembershipRole({
          membershipId: user.membershipId,
          role: role as Exclude<TenantRole, 'owner'>
        })
        if (!roleResult.ok) {
          setError(roleResult.message)
          return
        }
      }

      const result = await updateMembershipPageAccess({
        membershipId: user.membershipId,
        access
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success('Jogok mentve.')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[520px] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Jogok — {user.email}</DialogTitle>
          <DialogDescription>
            Pipáld ki az oldalakat a cég csomagjából, amiket a felhasználó
            láthat.
          </DialogDescription>
        </DialogHeader>

        {user.role !== 'owner' ? (
          <FormField label="Szerep" htmlFor="perm-role">
            <Select
              id="perm-role"
              value={role === 'owner' ? 'admin' : role}
              onChange={(e) =>
                setRole(e.target.value as TenantRole)
              }
              disabled={loading || fetching}
            >
              <option value="admin">Adminisztrátor</option>
              <option value="member">Tag</option>
              <option value="viewer">Csak megtekintés</option>
            </Select>
          </FormField>
        ) : (
          <p className="text-hint text-ink-secondary">
            Tulajdonos — a szerep nem módosítható.
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {(
            Object.entries(PAGE_ACCESS_TEMPLATES) as Array<
              [PageAccessTemplateId, { label: string }]
            >
          ).map(([id, meta]) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading || fetching}
              onClick={() => applyTemplate(id)}
            >
              {meta.label}
            </Button>
          ))}
        </div>

        {fetching ? (
          <p className="text-body text-ink-secondary">Betöltés…</p>
        ) : (
          <div className="space-y-4">
            {byCategory.map((group) => (
              <div key={group.category}>
                <p className="mb-1.5 text-hint font-semibold text-ink-secondary">
                  {group.category}
                </p>
                <ul className="space-y-1.5">
                  {group.pages.map((page) => (
                    <li key={page.key}>
                      <label className="flex cursor-pointer items-center gap-2 text-body text-ink">
                        <input
                          type="checkbox"
                          className="size-3.5 rounded border-border"
                          checked={Boolean(access[page.key])}
                          disabled={
                            Boolean(page.always) || loading || fetching
                          }
                          onChange={(e) =>
                            setAccess((prev) => ({
                              ...prev,
                              [page.key]: e.target.checked
                            }))
                          }
                        />
                        <span>{page.label}</span>
                        {page.always ? (
                          <span className="text-hint text-ink-muted">
                            (kötelező)
                          </span>
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <p className="text-body text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={fetching}
            onClick={() => void handleSave()}
          >
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
