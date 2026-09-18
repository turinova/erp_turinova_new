'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Users } from 'lucide-react'
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
import { MenuSelect } from '@/components/ui/menu-select'
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
  removeTenantMember,
  setMembershipDisabled,
  updateMemberDisplayName,
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
  currentUserId: string
}

const CATEGORIES: AppPageCategory[] = [
  'Fő',
  'Műhely',
  'Beszerzés',
  'Törzsadatok',
  'Beállítások'
]

const ROLE_HINTS: Record<Exclude<TenantRole, 'owner'>, string> = {
  admin: 'Felhasználókat és beállításokat is kezelhet.',
  member: 'Napi munka: ajánlat, raktár, értékesítés — a jogok szerint.',
  viewer: 'Csak nézhet, nem módosíthat.'
}

function roleTone(role: TenantRole): 'success' | 'info' | 'neutral' | 'warning' {
  if (role === 'owner') return 'success'
  if (role === 'admin') return 'info'
  if (role === 'viewer') return 'warning'
  return 'neutral'
}

function initialsFromRow(row: TenantUserListItem) {
  const name = row.displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const local = row.email.split('@')[0] || '?'
  return local.slice(0, 2).toUpperCase()
}

function personLabel(row: TenantUserListItem) {
  return row.displayName?.trim() || row.email
}

export function UsersClient({
  rows,
  loadError,
  serviceRoleMissing,
  entitledPages,
  seats,
  currentUserId
}: UsersClientProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TenantUserListItem | null>(null)

  const seatLabel =
    seats.maxSeats === null
      ? `${seats.usedSeats} hely foglalt`
      : `${seats.usedSeats} / ${seats.maxSeats} hely`

  return (
    <div>
      <PageHeader
        title="Felhasználók"
        description={`Akik beléphetnek a cégbe. ${seatLabel}.`}
        actions={
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
            disabled={serviceRoleMissing || seats.atLimit}
          >
            <Plus className="size-3.5" aria-hidden />
            Felhasználó hozzáadása
          </Button>
        }
      />

      {seats.atLimit ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-ink"
          role="status"
        >
          Nincs több hely ({seats.usedSeats}/{seats.maxSeats}). Bővítéshez
          írj a supportnak.
        </p>
      ) : null}

      {serviceRoleMissing ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-ink"
          role="status"
        >
          Most nem lehet felhasználót felvenni vagy módosítani. Írj a
          supportnak.
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
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <Users className="size-8 text-ink-secondary" aria-hidden />
          <p className="text-body text-ink-secondary">
            Még nincs felhasználó a cégben.
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={serviceRoleMissing || seats.atLimit}
            onClick={() => setCreateOpen(true)}
          >
            Felhasználó hozzáadása
          </Button>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Felhasználó</DataTableHeaderCell>
              <DataTableHeaderCell>Szerep</DataTableHeaderCell>
              <DataTableHeaderCell>Belépés</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const isDisabled = row.status === 'disabled'
              return (
                <DataTableRow key={row.membershipId}>
                  <DataTableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-[10px] font-semibold text-ink"
                        aria-hidden
                      >
                        {initialsFromRow(row)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {personLabel(row)}
                        </p>
                        {row.displayName?.trim() ? (
                          <p className="truncate text-hint text-ink-secondary">
                            {row.email}
                          </p>
                        ) : (
                          <p className="truncate text-hint text-ink-muted">
                            Nincs megjelenített név
                          </p>
                        )}
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={roleTone(row.role)}>
                      {row.roleLabel}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={isDisabled ? 'warning' : 'success'}>
                      {isDisabled ? 'Kikapcsolva' : 'Beléphet'}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditTarget(row)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Szerkesztés
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              )
            })}
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

      {editTarget ? (
        <EditMemberDialog
          open={Boolean(editTarget)}
          user={editTarget}
          currentUserId={currentUserId}
          entitledPages={entitledPages}
          serviceRoleMissing={serviceRoleMissing}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
          onSuccess={() => {
            setEditTarget(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
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
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [template, setTemplate] = useState<PageAccessTemplateId>('office')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setDisplayName('')
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
        displayName: displayName.trim() || undefined,
        role,
        template
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success('Felhasználó hozzáadva.')
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
          <DialogTitle>Felhasználó hozzáadása</DialogTitle>
          <DialogDescription>
            Add meg a nevet és az emailt. Az ideiglenes jelszót add oda a
            kollégának. Ha az email már létezik, csak a céghez kapcsoljuk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Név" htmlFor="new-user-name">
            <Input
              id="new-user-name"
              type="text"
              autoComplete="off"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Pl. Kovács Anna"
            />
          </FormField>
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
              placeholder="Új fióknál legalább 8 karakter"
            />
            <p className="mt-1 text-hint text-ink-muted">
              Ezt add oda neki — meglévő fióknál üresen hagyhatod.
            </p>
          </FormField>
          <FormField label="Szerep" htmlFor="new-user-role">
            <MenuSelect
              id="new-user-role"
              value={role}
              allowEmpty={false}
              options={[
                { value: 'admin', label: 'Adminisztrátor' },
                { value: 'member', label: 'Tag' },
                { value: 'viewer', label: 'Csak megtekintés' }
              ]}
              onChange={(v) =>
                setRole(v as 'admin' | 'member' | 'viewer')
              }
            />
            <p className="mt-1 text-hint text-ink-muted">{ROLE_HINTS[role]}</p>
          </FormField>
          <FormField label="Kezdő jogosultság" htmlFor="new-user-template">
            <MenuSelect
              id="new-user-template"
              value={template}
              allowEmpty={false}
              options={[
                { value: 'full', label: 'Teljes' },
                { value: 'office', label: 'Iroda' },
                { value: 'workshop', label: 'Műhely' }
              ]}
              onChange={(v) => setTemplate(v as PageAccessTemplateId)}
            />
            <p className="mt-1 text-hint text-ink-muted">
              Később a Szerkesztés alatt finomhangolható.
            </p>
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
            Hozzáadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditMemberDialog({
  open,
  user,
  currentUserId,
  entitledPages,
  serviceRoleMissing,
  onOpenChange,
  onSuccess
}: {
  open: boolean
  user: TenantUserListItem
  currentUserId: string
  entitledPages: string[]
  serviceRoleMissing: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const [access, setAccess] = useState<Record<string, boolean>>({})
  const [role, setRole] = useState(user.role)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [entitled, setEntitled] = useState<string[]>(entitledPages)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const isSelf = user.userId === currentUserId
  const isDisabled = user.status === 'disabled'
  const isOwner = user.role === 'owner'

  useEffect(() => {
    if (!open) return
    setDisplayName(user.displayName ?? '')
    setRole(user.role)
    setError(null)
    setShowAdvanced(false)
    setConfirmDisable(false)
    setConfirmRemove(false)
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
  }, [open, user.membershipId, user.role, user.displayName])

  const entitledSet = useMemo(() => new Set(entitled), [entitled])

  const visiblePages = useMemo(
    () =>
      APP_PAGES.filter((p) => {
        if (p.key === '/beallitasok/elofizetes') return false
        if (p.key === '/beallitasok/profil') return false
        return Boolean(p.always) || entitledSet.has(p.key)
      }),
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
      const nameResult = await updateMemberDisplayName({
        membershipId: user.membershipId,
        displayName
      })
      if (!nameResult.ok) {
        setError(nameResult.message)
        return
      }

      if (!isOwner && role !== user.role && role !== 'owner') {
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
      toast.success('Felhasználó mentve.')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleAccess() {
    setLoading(true)
    setError(null)
    try {
      const result = await setMembershipDisabled({
        membershipId: user.membershipId,
        disabled: !isDisabled
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(
        isDisabled
          ? 'Belépés újra engedélyezve.'
          : 'Belépés kikapcsolva.'
      )
      onSuccess()
    } finally {
      setLoading(false)
      setConfirmDisable(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    setError(null)
    try {
      const result = await removeTenantMember({
        membershipId: user.membershipId
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success('Felhasználó eltávolítva a cégből.')
      onSuccess()
    } finally {
      setLoading(false)
      setConfirmRemove(false)
    }
  }

  if (confirmDisable) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[420px]"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isDisabled
                ? 'Belépés engedélyezése'
                : 'Belépés kikapcsolása'}
            </DialogTitle>
            <DialogDescription>
              {isDisabled ? (
                <>
                  <strong className="font-medium text-ink">
                    {personLabel(user)}
                  </strong>{' '}
                  újra beléphet a cégbe.
                </>
              ) : (
                <>
                  <strong className="font-medium text-ink">
                    {personLabel(user)}
                  </strong>{' '}
                  nem fog tudni belépni. A fiók a listán marad — később
                  visszakapcsolható.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
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
              onClick={() => setConfirmDisable(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              variant={isDisabled ? 'primary' : 'danger'}
              loading={loading}
              onClick={() => void handleToggleAccess()}
            >
              {isDisabled ? 'Engedélyezés' : 'Kikapcsolás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (confirmRemove) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[420px]"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Eltávolítás a cégből</DialogTitle>
            <DialogDescription>
              <strong className="font-medium text-ink">
                {personLabel(user)}
              </strong>{' '}
              azonnal elveszíti a belépést ehhez a céghez. A fiók és a korábbi
              rögzítések megmaradnak. A hely felszabadul.
            </DialogDescription>
          </DialogHeader>
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
              onClick={() => setConfirmRemove(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={loading}
              onClick={() => void handleRemove()}
            >
              Eltávolítás a cégből
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[480px] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Felhasználó szerkesztése</DialogTitle>
          <DialogDescription>
            Név, szerep és belépés. A részletes oldaljogok alább
            megnyithatók.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Név" htmlFor="edit-user-name">
            <Input
              id="edit-user-name"
              type="text"
              autoComplete="off"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading || fetching}
              placeholder="Megjelenített név"
            />
          </FormField>

          <FormField label="Email" htmlFor="edit-user-email">
            <Input
              id="edit-user-email"
              type="email"
              value={user.email}
              disabled
              readOnly
            />
          </FormField>

          {isOwner ? (
            <p className="text-hint text-ink-secondary">
              Tulajdonos — a szerep nem módosítható.
            </p>
          ) : (
            <FormField label="Szerep" htmlFor="edit-user-role">
              <MenuSelect
                id="edit-user-role"
                value={role === 'owner' ? 'admin' : role}
                disabled={loading || fetching || isSelf}
                allowEmpty={false}
                options={[
                  { value: 'admin', label: 'Adminisztrátor' },
                  { value: 'member', label: 'Tag' },
                  { value: 'viewer', label: 'Csak megtekintés' }
                ]}
                onChange={(v) => setRole(v as TenantRole)}
              />
              {role !== 'owner' ? (
                <p className="mt-1 text-hint text-ink-muted">
                  {ROLE_HINTS[role as Exclude<TenantRole, 'owner'>]}
                </p>
              ) : null}
              {isSelf ? (
                <p className="mt-1 text-hint text-ink-muted">
                  A saját szerepedet nem módosíthatod.
                </p>
              ) : null}
            </FormField>
          )}

          <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
            <p className="text-hint font-medium text-ink">Belépés</p>
            <p className="mt-0.5 text-hint text-ink-secondary">
              {isDisabled
                ? 'Jelenleg nem léphet be a cégbe.'
                : 'Beléphet a cégbe.'}
              {isSelf
                ? ' (Saját magadnál ez nem állítható.)'
                : null}
            </p>
            {!isSelf ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={loading || serviceRoleMissing}
                onClick={() => setConfirmDisable(true)}
              >
                {isDisabled
                  ? 'Belépés engedélyezése'
                  : 'Belépés kikapcsolása'}
              </Button>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              className="text-[12.5px] font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced
                ? 'Részletes oldaljogok elrejtése'
                : 'Részletes oldaljogok…'}
            </button>

            {showAdvanced ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['full', 'Teljes'],
                      ['office', 'Iroda'],
                      ['workshop', 'Műhely']
                    ] as Array<[PageAccessTemplateId, string]>
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={loading || fetching}
                      onClick={() => applyTemplate(id)}
                    >
                      {label}
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
                                    Boolean(page.always) ||
                                    loading ||
                                    fetching
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
              </div>
            ) : null}
          </div>

          {!isSelf ? (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-hint text-ink-muted">
                Csatlakozott:{' '}
                <span className="tabular-nums text-ink-secondary">
                  {formatDate(user.createdAt)}
                </span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger-ink hover:bg-danger-soft"
                disabled={loading || serviceRoleMissing}
                onClick={() => setConfirmRemove(true)}
              >
                Eltávolítás a cégből
              </Button>
            </div>
          ) : (
            <p className="border-t border-border pt-3 text-hint text-ink-muted">
              Csatlakozott:{' '}
              <span className="tabular-nums">{formatDate(user.createdAt)}</span>
            </p>
          )}

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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}
