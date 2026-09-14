'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
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
  updateTenantMaxSeats,
  updateTenantOpsFields
} from '@/lib/platform/actions'
import type { PlatformAuditRow } from '@/lib/platform/audit'
import { startImpersonation } from '@/lib/platform/impersonation'
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
import { cn } from '@/lib/utils'

const BILLING_LABELS: Record<string, string> = {
  none: 'Nincs',
  trial: 'Trial',
  active: 'Aktív (fizet)',
  past_due: 'Lejárt / hátralék',
  canceled: 'Lemondva'
}

const AUDIT_LABELS: Record<string, string> = {
  'impersonation.start': 'Impersonation indítva',
  'impersonation.end': 'Impersonation vége',
  'tenant.status': 'Cég státusz',
  'tenant.max_seats': 'Seat limit',
  'tenant.ops_fields': 'Billing / notes',
  'user.password_reset': 'Jelszó reset'
}

type TabId = 'overview' | 'people' | 'billing' | 'audit'

type Props = {
  tenant: {
    id: string
    name: string
    slug: string
    status: TenantStatus
    created_at: string
    max_seats: number | null
    billing_status: string
    trial_ends_at: string | null
    paid_through: string | null
    billing_notes: string | null
    internal_notes: string | null
    contact_phone: string | null
    contact_email: string | null
  }
  onboarding: OnboardingFlags | null
  kpis: PlatformTenantKpis
  members: PlatformTenantMember[]
  company: PlatformCompanySnapshot
  auditRows: PlatformAuditRow[]
  entitlementsSlot?: ReactNode
}

export function TenantDetailClient({
  tenant,
  onboarding,
  kpis,
  members,
  company,
  auditRows,
  entitlementsSlot
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('overview')
  const [status, setStatus] = useState(tenant.status)
  const [maxSeatsInput, setMaxSeatsInput] = useState(
    tenant.max_seats === null ? '' : String(tenant.max_seats)
  )
  const [pending, startTransition] = useTransition()
  const [resetTarget, setResetTarget] =
    useState<PlatformTenantMember | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [impersonateTarget, setImpersonateTarget] =
    useState<PlatformTenantMember | null>(null)
  const [impersonateLoading, setImpersonateLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<{
    email: string
    password: string
  } | null>(null)

  const [billingStatus, setBillingStatus] = useState(tenant.billing_status)
  const [trialEndsAt, setTrialEndsAt] = useState(
    toDateInput(tenant.trial_ends_at)
  )
  const [paidThrough, setPaidThrough] = useState(
    toDateInput(tenant.paid_through)
  )
  const [billingNotes, setBillingNotes] = useState(tenant.billing_notes ?? '')
  const [internalNotes, setInternalNotes] = useState(
    tenant.internal_notes ?? ''
  )
  const [contactPhone, setContactPhone] = useState(tenant.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(tenant.contact_email ?? '')

  const progress = onboardingProgress(onboarding)
  const nextStep = onboardingNextStep(onboarding)
  const stuck = progress.percent < 100 && kpis.daysSinceCreated >= 7

  useEffect(() => {
    setStatus(tenant.status)
  }, [tenant.status])

  useEffect(() => {
    setMaxSeatsInput(
      tenant.max_seats === null ? '' : String(tenant.max_seats)
    )
  }, [tenant.max_seats])

  useEffect(() => {
    setBillingStatus(tenant.billing_status)
    setTrialEndsAt(toDateInput(tenant.trial_ends_at))
    setPaidThrough(toDateInput(tenant.paid_through))
    setBillingNotes(tenant.billing_notes ?? '')
    setInternalNotes(tenant.internal_notes ?? '')
    setContactPhone(tenant.contact_phone ?? '')
    setContactEmail(tenant.contact_email ?? '')
  }, [tenant])

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

  function handleOpsSave() {
    startTransition(async () => {
      const result = await updateTenantOpsFields({
        tenantId: tenant.id,
        billingStatus,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        paidThrough: paidThrough
          ? new Date(paidThrough).toISOString()
          : null,
        billingNotes,
        internalNotes,
        contactPhone,
        contactEmail
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Billing / notes mentve.')
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

  async function handleConfirmImpersonate() {
    if (!impersonateTarget) return
    setImpersonateLoading(true)
    try {
      const result = await startImpersonation({
        tenantId: tenant.id,
        userId: impersonateTarget.userId
      })
      if (result && !result.ok) {
        toast.error(result.message)
      }
    } catch {
      // redirect
    } finally {
      setImpersonateLoading(false)
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Áttekintés' },
    { id: 'people', label: 'Emberek' },
    { id: 'billing', label: 'Billing / notes' },
    { id: 'audit', label: 'Audit' }
  ]

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
            {formatRelative(kpis.lastSignInAt)} · Billing:{' '}
            {BILLING_LABELS[tenant.billing_status] ?? tenant.billing_status}
          </p>
        </div>
        <StatusBadge tone={tenantStatusTone(tenant.status)}>
          {TENANT_STATUS_LABEL[tenant.status]}
        </StatusBadge>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'h-8 rounded-md px-2.5 text-[13px] font-medium transition-colors',
              tab === t.id
                ? 'bg-subtle text-ink'
                : 'text-ink-secondary hover:bg-subtle hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
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
            <Kpi label="Onboarding" value={`${progress.percent}%`} />
          </div>

          {stuck ? (
            <p
              className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink"
              role="status"
            >
              Stuck onboarding — {progress.percent}% {kpis.daysSinceCreated} nap
              után.
            </p>
          ) : null}

          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="mb-3 text-body font-semibold text-ink">
              Cég státusz
            </h2>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label
                  htmlFor="tenant-status"
                  className="mb-1 block text-hint text-ink-secondary"
                >
                  Státusz
                </label>
                <Select
                  id="tenant-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TenantStatus)}
                  disabled={pending}
                >
                  {(
                    Object.keys(TENANT_STATUS_LABEL) as TenantStatus[]
                  ).map((key) => (
                    <option key={key} value={key}>
                      {TENANT_STATUS_LABEL[key]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
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
              Max tagság. Üres = korlátlan. Most: {members.length}
              {tenant.max_seats !== null ? ` / ${tenant.max_seats}` : ''} tag.
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
                variant="secondary"
                size="sm"
                loading={pending}
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
                ) : null}
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
                Még nincs kitöltött cégadat.
              </p>
            ) : (
              <dl className="grid gap-2 text-body sm:grid-cols-2">
                <SnapshotItem label="Név" value={company.name} />
                <SnapshotItem label="Email" value={company.email} />
                <SnapshotItem label="Telefon" value={company.phone_number} />
                <SnapshotItem label="Adószám" value={company.tax_number} />
                <SnapshotItem
                  label="Cím"
                  value={
                    [company.postal_code, company.city, company.address]
                      .filter(Boolean)
                      .join(', ') || null
                  }
                />
              </dl>
            )}
          </section>
        </>
      ) : null}

      {tab === 'people' ? (
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
                    <DataTableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={
                            pending ||
                            resetLoading ||
                            impersonateLoading ||
                            m.banned
                          }
                          onClick={() => setImpersonateTarget(m)}
                        >
                          Belépés mint…
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending || resetLoading}
                          onClick={() => setResetTarget(m)}
                        >
                          Jelszó reset
                        </Button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </section>
      ) : null}

      {tab === 'billing' ? (
        <section className="space-y-4 rounded-md border border-border bg-surface p-4">
          <div>
            <h2 className="text-body font-semibold text-ink">
              Manuális billing
            </h2>
            <p className="mt-1 text-hint text-ink-secondary">
              A számlázás külön rendszerben történik — itt csak az állapotot
              rögzíted.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="billing-status"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Billing státusz
              </label>
              <Select
                id="billing-status"
                value={billingStatus}
                onChange={(e) => setBillingStatus(e.target.value)}
                disabled={pending}
              >
                {Object.entries(BILLING_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="trial-ends"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Trial vége
              </label>
              <Input
                id="trial-ends"
                type="date"
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <label
                htmlFor="paid-through"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Fizetve eddig
              </label>
              <Input
                id="paid-through"
                type="date"
                value={paidThrough}
                onChange={(e) => setPaidThrough(e.target.value)}
                disabled={pending}
              />
            </div>
            <div>
              <label
                htmlFor="contact-phone"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Kapcsolat telefon
              </label>
              <Input
                id="contact-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="contact-email"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Kapcsolat email
              </label>
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="billing-notes"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Billing megjegyzés
              </label>
              <textarea
                id="billing-notes"
                rows={2}
                value={billingNotes}
                onChange={(e) => setBillingNotes(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="internal-notes"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Belső jegyzet (CS / sales)
              </label>
              <textarea
                id="internal-notes"
                rows={4}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              loading={pending}
              onClick={handleOpsSave}
            >
              Mentés
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-3 text-body font-semibold text-ink">
            Audit (ez a cég)
          </h2>
          {auditRows.length === 0 ? (
            <p className="text-body text-ink-secondary">Még nincs bejegyzés.</p>
          ) : (
            <ul className="divide-y divide-border">
              {auditRows.map((row) => (
                <li key={row.id} className="py-2.5">
                  <p className="text-body font-medium text-ink">
                    {AUDIT_LABELS[row.action] ?? row.action}
                  </p>
                  <p className="text-hint text-ink-secondary">
                    {formatDateTime(row.created_at)}
                    {row.actor_email ? ` · ${row.actor_email}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

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

      <ConfirmDialog
        open={Boolean(impersonateTarget)}
        onOpenChange={(open) => {
          if (!open) setImpersonateTarget(null)
        }}
        title="Belépés mint ez a felhasználó?"
        description={
          impersonateTarget
            ? `${impersonateTarget.email} nevében nyílik az app (írható, 60 perc). Erős bannerrel kiléphetsz.`
            : ''
        }
        confirmLabel="Belépés mint…"
        cancelLabel="Mégse"
        loading={impersonateLoading}
        onConfirm={() => void handleConfirmImpersonate()}
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
              Másold ki most — később nem lesz újra látható:{' '}
              {tempPassword?.email}
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

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
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
  value: string | null | undefined
}) {
  return (
    <div>
      <dt className="text-hint text-ink-secondary">{label}</dt>
      <dd className="text-ink">{value?.trim() || '—'}</dd>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('hu-HU')
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('hu-HU')
}

function formatRelative(iso: string | null) {
  if (!iso) return 'soha'
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} perce`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} órája`
  const days = Math.floor(hours / 24)
  return `${days} napja`
}
