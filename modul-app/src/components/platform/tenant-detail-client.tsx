'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
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
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  refreshTenantOnboardingFlags,
  resetTenantUserPassword,
  updatePlatformTenantStatus,
  updateTenantMaxSeats
} from '@/lib/platform/actions'
import {
  ONBOARDING_STEPS,
  TENANT_STATUS_LABEL,
  onboardingNextStep,
  onboardingProgress,
  tenantStatusTone,
  type OnboardingFlags
} from '@/lib/platform/onboarding'
import type {
  PlatformCompanySnapshot,
  PlatformTenantKpis,
  PlatformTenantMember
} from '@/lib/platform/queries'
import type { TenantStatus } from '@/lib/supabase/database.types'

type Props = {
  tenant: {
    id: string
    name: string
    slug: string
    status: TenantStatus
    created_at: string
    max_seats: number | null
  }
  onboarding: OnboardingFlags | null
  kpis: PlatformTenantKpis
  members: PlatformTenantMember[]
  company: PlatformCompanySnapshot
  entitlementsSlot?: ReactNode
}

export function TenantDetailClient({
  tenant,
  onboarding,
  kpis,
  members,
  company,
  entitlementsSlot
}: Props) {
  const router = useRouter()
  const cancelFocusRef = useRef<HTMLButtonElement>(null)
  const [status, setStatus] = useState(tenant.status)
  const [maxSeatsInput, setMaxSeatsInput] = useState(
    tenant.max_seats === null ? '' : String(tenant.max_seats)
  )
  const [pending, startTransition] = useTransition()
  const [resetTarget, setResetTarget] =
    useState<PlatformTenantMember | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<{
    email: string
    password: string
  } | null>(null)

  const progress = onboardingProgress(onboarding)
  const nextStep = onboardingNextStep(onboarding)
  const stuck =
    progress.percent < 100 && kpis.daysSinceCreated >= 7

  useEffect(() => {
    setStatus(tenant.status)
  }, [tenant.status])

  useEffect(() => {
    setMaxSeatsInput(
      tenant.max_seats === null ? '' : String(tenant.max_seats)
    )
  }, [tenant.max_seats])

  function handleStatusSave() {
    startTransition(async () => {
      const result = await updatePlatformTenantStatus({
        tenantId: tenant.id,
        status
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Státusz frissítve.')
      router.refresh()
    })
  }

  function handleMaxSeatsSave() {
    const raw = maxSeatsInput.trim()
    const maxSeats = raw === '' ? null : Number(raw)
    if (raw !== '' && (!Number.isInteger(maxSeats) || (maxSeats as number) < 1)) {
      toast.error('Adj meg egészet (≥1), vagy hagyd üresen (korlátlan).')
      return
    }
    startTransition(async () => {
      const result = await updateTenantMaxSeats({
        tenantId: tenant.id,
        maxSeats
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Felhasználói limit mentve.')
      router.refresh()
    })
  }

  function handleRefreshOnboarding() {
    startTransition(async () => {
      const result = await refreshTenantOnboardingFlags(tenant.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Onboarding frissítve.')
      router.refresh()
    })
  }

  async function handleConfirmReset() {
    if (!resetTarget) return
    setResetLoading(true)
    try {
      const result = await resetTenantUserPassword({
        tenantId: tenant.id,
        userId: resetTarget.userId
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setResetTarget(null)
      setTempPassword({
        email: result.email || resetTarget.email,
        password: result.temporaryPassword
      })
      toast.success('Új ideiglenes jelszó beállítva.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">{tenant.name}</h1>
          <p className="mt-1 font-mono text-hint text-ink-secondary">
            {tenant.slug}
          </p>
          <p className="mt-1 text-hint text-ink-secondary">
            Létrehozva {formatDate(tenant.created_at)} ·{' '}
            {kpis.daysSinceCreated} napos · Utolsó belépés:{' '}
            {formatRelative(kpis.lastSignInAt)}
          </p>
        </div>
        <StatusBadge tone={tenantStatusTone(tenant.status)}>
          {TENANT_STATUS_LABEL[tenant.status]}
        </StatusBadge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tagok" value={String(kpis.memberCount)} />
        <Kpi
          label="Aktív login 7 / 30 nap"
          value={`${kpis.activeLogins7d} / ${kpis.activeLogins30d}`}
        />
        <Kpi label="Árajánlatok" value={String(kpis.quoteCount)} />
        <Kpi label="Megrendelések" value={String(kpis.orderCount)} />
        <Kpi
          label="Ajánlat GMV 30 nap"
          value={`${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Math.round(kpis.gmvQuotes30d))} Ft`}
        />
        <Kpi label="Kapcsolt partner" value={String(kpis.linkedPartners)} />
        <Kpi
          label="Portal beküldés 30 nap"
          value={String(kpis.portalSubmits30d)}
        />
        <Kpi label="Táblás anyag" value={String(kpis.sheetCount)} />
        <Kpi label="Élzáró" value={String(kpis.edgeCount)} />
        <Kpi label="Onboarding" value={`${progress.percent}%`} />
        <Kpi label="Kor" value={`${kpis.daysSinceCreated} nap`} />
      </div>

      {stuck ? (
        <p
          className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink"
          role="status"
        >
          Onboarding elakadt ({progress.percent}%, {kpis.daysSinceCreated}{' '}
          napja). {nextStep ?? ''}
        </p>
      ) : null}

      <section className="max-w-md space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="text-body font-semibold text-ink">Státusz</h2>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as TenantStatus)}
          disabled={pending}
        >
          {(Object.keys(TENANT_STATUS_LABEL) as TenantStatus[]).map((s) => (
            <option key={s} value={s}>
              {TENANT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button
            ref={cancelFocusRef}
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || status === tenant.status}
            onClick={() => setStatus(tenant.status)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            disabled={status === tenant.status}
            onClick={handleStatusSave}
          >
            Státusz mentése
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="mb-1 text-body font-semibold text-ink">
          Felhasználói limit
        </h2>
        <p className="mb-3 text-hint text-ink-secondary">
          Max tagság a cégben. Üres = korlátlan. Most: {members.length}
          {tenant.max_seats !== null ? ` / ${tenant.max_seats}` : ''} tag.
          Egy fiók egyszerre csak egy helyen lehet bejelentkezve.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <label
              htmlFor="max-seats"
              className="mb-1 block text-hint text-ink-secondary"
            >
              Max seat
            </label>
            <Input
              id="max-seats"
              type="number"
              min={1}
              max={500}
              placeholder="∞"
              value={maxSeatsInput}
              onChange={(e) => setMaxSeatsInput(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            disabled={
              (tenant.max_seats === null ? '' : String(tenant.max_seats)) ===
              maxSeatsInput.trim()
            }
            onClick={handleMaxSeatsSave}
          >
            Limit mentése
          </Button>
        </div>
      </section>

      {entitlementsSlot}

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-body font-semibold text-ink">Onboarding</h2>
            <p className="text-hint text-ink-secondary">
              {progress.done}/{progress.total} · {progress.percent}%
            </p>
            {nextStep ? (
              <p className="mt-1 text-hint text-ink-secondary">{nextStep}</p>
            ) : (
              <p className="mt-1 text-hint text-ink-secondary">
                Checklist kész.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={handleRefreshOnboarding}
          >
            Állapot frissítése
          </Button>
        </div>
        <ul className="space-y-1.5">
          {ONBOARDING_STEPS.map((step) => {
            const raw = onboarding?.[step.key]
            const done =
              step.key === 'first_login_at' ? Boolean(raw) : raw === true
            return (
              <li
                key={step.key}
                className="flex items-center justify-between gap-2 text-body"
              >
                <span className="text-ink">{step.label}</span>
                <StatusBadge tone={done ? 'success' : 'neutral'}>
                  {done ? 'Kész' : 'Hiányzik'}
                </StatusBadge>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="mb-3 text-body font-semibold text-ink">Cégadatok</h2>
        {!company ? (
          <p className="text-body text-ink-secondary">
            Még nincs kitöltött cégadat a tenant appban.
          </p>
        ) : (
          <dl className="grid gap-2 text-body sm:grid-cols-2">
            <SnapshotItem label="Név" value={company.name} />
            <SnapshotItem label="Email" value={company.email} />
            <SnapshotItem label="Telefon" value={company.phone_number} />
            <SnapshotItem label="Adószám" value={company.tax_number} />
            <SnapshotItem
              label="Cím"
              value={[
                company.postal_code,
                company.city,
                company.address
              ]
                .filter(Boolean)
                .join(', ') || null}
            />
            <SnapshotItem label="Ország" value={company.country} />
          </dl>
        )}
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="mb-3 text-body font-semibold text-ink">
          Felhasználók ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-body text-ink-secondary">Nincs tag.</p>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Email</DataTableHeaderCell>
                <DataTableHeaderCell>Szerep</DataTableHeaderCell>
                <DataTableHeaderCell>Utolsó belépés</DataTableHeaderCell>
                <DataTableHeaderCell>Fiók</DataTableHeaderCell>
                <DataTableHeaderCell>Csatlakozott</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  Műveletek
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {members.map((m) => (
                <DataTableRow key={m.membershipId}>
                  <DataTableCell className="font-medium text-ink">
                    {m.email}
                    {m.roleKey === 'owner' ? (
                      <span className="ml-1.5 text-hint text-ink-muted">
                        · tulajdonos
                      </span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={
                        m.roleKey === 'owner'
                          ? 'success'
                          : m.roleKey === 'admin'
                            ? 'info'
                            : 'neutral'
                      }
                    >
                      {m.role}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {formatRelative(m.lastSignInAt)}
                    {!m.lastSignInAt ? (
                      <span className="ml-1 text-hint text-warning-ink">
                        (soha)
                      </span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    {m.banned ? (
                      <StatusBadge tone="danger">Tiltva</StatusBadge>
                    ) : m.emailConfirmed ? (
                      <StatusBadge tone="success">OK</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Nem confirmed</StatusBadge>
                    )}
                  </DataTableCell>
                  <DataTableCell className="tabular-nums text-ink-secondary">
                    {formatDate(m.createdAt)}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending || resetLoading}
                      onClick={() => setResetTarget(m)}
                    >
                      Jelszó reset
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null)
        }}
        title="Ideiglenes jelszó beállítása?"
        description={
          resetTarget
            ? `${resetTarget.email} jelszava azonnal megváltozik. Az új jelszót csak egyszer mutatjuk.`
            : ''
        }
        confirmLabel="Reset"
        cancelLabel="Mégse"
        variant="danger"
        loading={resetLoading}
        onConfirm={() => void handleConfirmReset()}
      />

      <Dialog
        open={Boolean(tempPassword)}
        onOpenChange={(open) => {
          if (!open) setTempPassword(null)
        }}
      >
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Új ideiglenes jelszó</DialogTitle>
            <DialogDescription>
              Másold ki most — később nem lesz újra látható. Add át biztonságos
              csatornán: {tempPassword?.email}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-border bg-subtle px-3 py-2 font-mono text-body text-ink">
            {tempPassword?.password}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (tempPassword?.password) {
                  void navigator.clipboard.writeText(tempPassword.password)
                  toast.success('Vágólapra másolva.')
                }
              }}
            >
              Másolás
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setTempPassword(null)}
            >
              Kész
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-hint text-ink-secondary">{label}</p>
      <p className="mt-0.5 text-body font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  )
}

function SnapshotItem({
  label,
  value
}: {
  label: string
  value: string | null
}) {
  return (
    <div>
      <dt className="text-hint text-ink-secondary">{label}</dt>
      <dd className="text-ink">{value?.trim() || '—'}</dd>
    </div>
  )
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function formatRelative(iso: string | null) {
  if (!iso) return 'Soha'
  try {
    const then = new Date(iso).getTime()
    const diffMs = Date.now() - then
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'épp most'
    if (mins < 60) return `${mins} perce`
    const hours = Math.floor(mins / 60)
    if (hours < 48) return `${hours} órája`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} napja`
    return formatDate(iso)
  } catch {
    return iso
  }
}
