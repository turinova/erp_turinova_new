'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { MonthlyBillSummary } from '@/components/billing/monthly-bill-summary'
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
import { MenuSelect } from '@/components/ui/menu-select'
import { Input } from '@/components/ui/input'
import {
  platformAddTenantMember,
  platformRemoveTenantMember,
  platformSetMembershipDisabled,
  refreshTenantOnboardingFlags,
  resetTenantUserPassword,
  revokeTenantSessions,
  revokeUserSessions,
  sendTenantUserAuthEmail,
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
  PlatformLinkedPartner,
  PlatformTenantKpis,
  PlatformTenantMember
} from '@/lib/platform/queries'
import type { MonthlyBillEstimate } from '@/lib/billing/estimate'
import type { TenantStatus } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

const BILLING_LABELS: Record<string, string> = {
  none: 'Nincs',
  trial: 'Trial',
  active: 'Fizet',
  past_due: 'Hátralék',
  canceled: 'Lemondva'
}

const AUDIT_LABELS: Record<string, string> = {
  'impersonation.start': 'Belépés mint user',
  'impersonation.end': 'Support mód vége',
  'tenant.status': 'Cég státusz',
  'tenant.max_seats': 'Helyek limit',
  'tenant.ops_fields': 'Előfizetés / jegyzet',
  'user.password_reset': 'Ideiglenes jelszó',
  'user.recovery_email': 'Jelszó email',
  'user.invite_email': 'Meghívó email',
  'user.sessions_revoke': 'User kiléptetése',
  'tenant.sessions_revoke': 'Mindenki kiléptetése',
  'user.member_add': 'Tag hozzáadva',
  'user.member_disable': 'Belépés kikapcsolva',
  'user.member_enable': 'Belépés engedélyezve',
  'user.member_remove': 'Tag eltávolítva'
}

type TabId = 'overview' | 'people' | 'billing' | 'package' | 'audit'

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
  linkedPartners: PlatformLinkedPartner[]
  company: PlatformCompanySnapshot
  auditRows: PlatformAuditRow[]
  monthlyBill?: MonthlyBillEstimate | null
  planLabel?: string | null
  entitlementsSlot?: ReactNode
}

export function TenantDetailClient({
  tenant,
  onboarding,
  kpis,
  members,
  linkedPartners,
  company,
  auditRows,
  monthlyBill,
  planLabel,
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
  const [emailTarget, setEmailTarget] =
    useState<PlatformTenantMember | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [revokeUserTarget, setRevokeUserTarget] =
    useState<PlatformTenantMember | null>(null)
  const [revokeTenantOpen, setRevokeTenantOpen] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState(false)
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

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole, setAddRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [addLoading, setAddLoading] = useState(false)
  const [removeTarget, setRemoveTarget] =
    useState<PlatformTenantMember | null>(null)

  const progress = onboardingProgress(onboarding)
  const nextStep = onboardingNextStep(onboarding)
  const stuck = progress.percent < 100 && kpis.daysSinceCreated >= 7

  const primaryMember =
    members.find((m) => m.roleKey === 'owner' && m.status === 'active' && !m.banned) ??
    members.find((m) => m.roleKey === 'admin' && m.status === 'active' && !m.banned) ??
    members.find((m) => m.status === 'active' && !m.banned) ??
    null

  const seatsLabel =
    tenant.max_seats === null
      ? `${members.filter((m) => m.status === 'active').length} ember`
      : `${members.filter((m) => m.status === 'active').length} / ${tenant.max_seats} hely`

  const trialSoon =
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  const attention =
    tenant.status === 'suspended'
      ? { text: 'A cég fel van függesztve.', tab: 'overview' as TabId }
      : tenant.billing_status === 'past_due'
        ? { text: 'Hátralék van az előfizetésen.', tab: 'billing' as TabId }
        : trialSoon
          ? {
              text: `Trial hamarosan lejár (${formatDate(tenant.trial_ends_at!)}).`,
              tab: 'billing' as TabId
            }
          : stuck
            ? {
                text: `Onboarding ${progress.percent}% — ${kpis.daysSinceCreated} napja.`,
                tab: 'overview' as TabId
              }
            : null

  function personLabel(m: PlatformTenantMember) {
    return m.displayName?.trim() || m.email
  }

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

  async function handleConfirmAuthEmail() {
    if (!emailTarget) return
    setEmailLoading(true)
    try {
      const result = await sendTenantUserAuthEmail({
        tenantId: tenant.id,
        userId: emailTarget.userId,
        mode: 'auto'
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setEmailTarget(null)
      toast.success(result.message ?? 'Auth email elküldve.')
      router.refresh()
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleConfirmRevokeUser() {
    if (!revokeUserTarget) return
    setRevokeLoading(true)
    try {
      const result = await revokeUserSessions({
        tenantId: tenant.id,
        userId: revokeUserTarget.userId
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setRevokeUserTarget(null)
      toast.success(result.message ?? 'Sessionök törölve.')
    } finally {
      setRevokeLoading(false)
    }
  }

  async function handleConfirmRevokeTenant() {
    setRevokeLoading(true)
    try {
      const result = await revokeTenantSessions({ tenantId: tenant.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setRevokeTenantOpen(false)
      toast.success(result.message ?? 'Cég sessionök törölve.')
    } finally {
      setRevokeLoading(false)
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
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      if (result.handoffUrl) {
        window.location.assign(result.handoffUrl)
        return
      }
      toast.error('Hiányzó handoff URL.')
    } finally {
      setImpersonateLoading(false)
    }
  }

  async function handleAddMember() {
    setAddLoading(true)
    try {
      const result = await platformAddTenantMember({
        tenantId: tenant.id,
        email: addEmail,
        password: addPassword,
        displayName: addName.trim() || undefined,
        role: addRole
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Hozzáadva.')
      setAddOpen(false)
      setAddName('')
      setAddEmail('')
      setAddPassword('')
      setAddRole('member')
      router.refresh()
    } finally {
      setAddLoading(false)
    }
  }

  function handleToggleDisabled(m: PlatformTenantMember) {
    const disable = m.status === 'active'
    startTransition(async () => {
      const result = await platformSetMembershipDisabled({
        tenantId: tenant.id,
        membershipId: m.membershipId,
        disabled: disable
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        disable ? 'Belépés kikapcsolva.' : 'Belépés újra engedélyezve.'
      )
      router.refresh()
    })
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return
    setAddLoading(true)
    try {
      const result = await platformRemoveTenantMember({
        tenantId: tenant.id,
        membershipId: removeTarget.membershipId
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setRemoveTarget(null)
      toast.success(result.message ?? 'Eltávolítva.')
      router.refresh()
    } finally {
      setAddLoading(false)
    }
  }

  function memberInitials(m: PlatformTenantMember) {
    const name = m.displayName?.trim()
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    const local = m.email.split('@')[0] || '?'
    return local.slice(0, 2).toUpperCase()
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Összegzés' },
    { id: 'people', label: 'Emberek' },
    { id: 'billing', label: 'Előfizetés' },
    { id: 'package', label: 'Csomag' },
    { id: 'audit', label: 'Napló' }
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-ink">{tenant.name}</h1>
            <StatusBadge tone={tenantStatusTone(tenant.status)}>
              {TENANT_STATUS_LABEL[tenant.status]}
            </StatusBadge>
          </div>
          <p className="mt-1 text-hint text-ink-secondary">
            <span className="font-mono">{tenant.slug}</span>
            {' · '}
            {kpis.daysSinceCreated} napos
            {' · '}
            Utoljára: {formatRelative(kpis.lastSignInAt)}
            {' · '}
            {BILLING_LABELS[tenant.billing_status] ?? tenant.billing_status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setTab('people')}
          >
            Emberek
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!primaryMember || impersonateLoading}
            loading={impersonateLoading && impersonateTarget?.userId === primaryMember?.userId}
            onClick={() => {
              if (primaryMember) setImpersonateTarget(primaryMember)
            }}
          >
            Belépés a cégbe
          </Button>
        </div>
      </div>

      {!primaryMember ? (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
          Nincs beléphető user — add hozzá az Emberek tabon, aztán lépj be mint
          ő.
        </p>
      ) : null}

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
          {attention ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5">
              <p className="text-body text-warning-ink">{attention.text}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setTab(attention.tab)}
              >
                Megnyitás
              </Button>
            </div>
          ) : nextStep ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2.5">
              <div>
                <p className="text-hint font-medium text-ink-secondary">
                  Következő
                </p>
                <p className="text-body text-ink">{nextStep}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={handleRefreshOnboarding}
              >
                Frissítés
              </Button>
            </div>
          ) : null}

          <section className="rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <h2 className="text-body font-semibold text-ink">Pillantás</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-y-0">
              <button
                type="button"
                className="block min-w-0 px-3 py-3 text-left hover:bg-subtle"
                onClick={() => setTab('people')}
              >
                <p className="truncate text-hint text-ink-secondary">Emberek</p>
                <p className="mt-1 text-[1.5rem] font-semibold tabular-nums leading-none text-ink">
                  {kpis.memberCount}
                </p>
                <p className="mt-1 truncate text-hint text-ink-muted">
                  {seatsLabel}
                </p>
              </button>
              <div className="min-w-0 px-3 py-3">
                <p className="truncate text-hint text-ink-secondary">
                  7 nap aktív
                </p>
                <p className="mt-1 text-[1.5rem] font-semibold tabular-nums leading-none text-ink">
                  {kpis.activeLogins7d}
                </p>
                <p className="mt-1 truncate text-hint text-ink-muted">
                  {kpis.activeLogins30d} / 30 nap
                </p>
              </div>
              <div className="min-w-0 px-3 py-3">
                <p className="truncate text-hint text-ink-secondary">
                  Forgalom 30 nap
                </p>
                <p className="mt-1 text-[1.5rem] font-semibold tabular-nums leading-none text-ink">
                  {new Intl.NumberFormat('hu-HU', {
                    maximumFractionDigits: 0
                  }).format(Math.round(kpis.gmvQuotes30d))}{' '}
                  Ft
                </p>
                <p className="mt-1 truncate text-hint text-ink-muted">
                  Ajánlat (nem előfizetés)
                </p>
              </div>
              <button
                type="button"
                className="block min-w-0 px-3 py-3 text-left hover:bg-subtle"
                onClick={() => setTab('package')}
              >
                <p className="truncate text-hint text-ink-secondary">Csomag</p>
                <p className="mt-1 truncate text-[1.25rem] font-semibold leading-none text-ink">
                  {planLabel?.trim() || '—'}
                </p>
                <p className="mt-1 truncate text-hint text-ink-muted">
                  {kpis.linkedPartners} partner
                </p>
              </button>
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="mb-3 text-body font-semibold text-ink">
              Cég és helyek
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="tenant-status"
                  className="mb-1 block text-hint text-ink-secondary"
                >
                  Státusz
                </label>
                <MenuSelect
                  id="tenant-status"
                  value={status}
                  disabled={pending}
                  allowEmpty={false}
                  options={(
                    Object.keys(TENANT_STATUS_LABEL) as TenantStatus[]
                  ).map((key) => ({
                    value: key,
                    label: TENANT_STATUS_LABEL[key]
                  }))}
                  onChange={(v) => setStatus(v as TenantStatus)}
                />
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
              <div className="w-28">
                <label
                  htmlFor="max-seats"
                  className="mb-1 block text-hint text-ink-secondary"
                >
                  Max hely
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
                Helyek mentése
              </Button>
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-body font-semibold text-ink">Onboarding</h2>
                <p className="text-hint text-ink-secondary">
                  {progress.done}/{progress.total} · {progress.percent}%
                </p>
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
            {progress.percent < 100 ? (
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
            ) : (
              <p className="text-body text-success-ink">Onboarding kész.</p>
            )}
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
                <SnapshotItem
                  label="Email"
                  value={company.email}
                  href={
                    company.email ? `mailto:${company.email}` : undefined
                  }
                />
                <SnapshotItem
                  label="Telefon"
                  value={company.phone_number}
                  href={
                    company.phone_number
                      ? `tel:${company.phone_number}`
                      : undefined
                  }
                />
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
            {(tenant.contact_phone || tenant.contact_email) && (
              <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-body sm:grid-cols-2">
                <SnapshotItem
                  label="Kapcsolat telefon"
                  value={tenant.contact_phone}
                  href={
                    tenant.contact_phone
                      ? `tel:${tenant.contact_phone}`
                      : undefined
                  }
                />
                <SnapshotItem
                  label="Kapcsolat email"
                  value={tenant.contact_email}
                  href={
                    tenant.contact_email
                      ? `mailto:${tenant.contact_email}`
                      : undefined
                  }
                />
              </dl>
            )}
          </section>

          {linkedPartners.length > 0 ? (
            <section className="rounded-md border border-border bg-surface p-4">
              <h2 className="mb-3 text-body font-semibold text-ink">
                Kapcsolt partnerek ({linkedPartners.length})
              </h2>
              <ul className="divide-y divide-border">
                {linkedPartners.map((p) => (
                  <li key={p.userId}>
                    <a
                      href={`/platform/partnerek/${p.userId}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 no-underline hover:bg-subtle"
                    >
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-hint text-ink-secondary">
                        {p.email}
                        {p.status === 'disabled' ? ' · kikapcsolva' : ''}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === 'people' ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-body font-semibold text-ink">
                Emberek ({members.length})
              </h2>
              <p className="text-hint text-ink-secondary">{seatsLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || revokeLoading || members.length === 0}
                onClick={() => setRevokeTenantOpen(true)}
              >
                Összes kiléptetése
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || addLoading}
                onClick={() => setAddOpen(true)}
              >
                Felhasználó hozzáadása
              </Button>
            </div>
          </div>
          {members.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-subtle px-3 py-6 text-center">
              <p className="text-body text-ink">Még nincs felhasználó.</p>
              <p className="mt-1 text-hint text-ink-secondary">
                Adj hozzá usert, aztán lépj be mint ő.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={() => setAddOpen(true)}
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
                  <DataTableHeaderCell>Utoljára</DataTableHeaderCell>
                  <DataTableHeaderCell className="text-right">
                    Műveletek
                  </DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {members.map((m) => {
                  const isDisabled = m.status === 'disabled'
                  return (
                    <DataTableRow key={m.membershipId}>
                      <DataTableCell>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-[10px] font-semibold text-ink"
                            aria-hidden
                          >
                            {memberInitials(m)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {personLabel(m)}
                            </p>
                            {m.displayName?.trim() ? (
                              <p className="truncate text-hint text-ink-secondary">
                                {m.email}
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
                      <DataTableCell>
                        {m.banned ? (
                          <StatusBadge tone="danger">Tiltva</StatusBadge>
                        ) : isDisabled ? (
                          <StatusBadge tone="warning">Kikapcsolva</StatusBadge>
                        ) : m.emailConfirmed ? (
                          <StatusBadge tone="success">Beléphet</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">Nincs confirm</StatusBadge>
                        )}
                      </DataTableCell>
                      <DataTableCell className="text-ink-secondary">
                        {formatRelative(m.lastSignInAt)}
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
                              emailLoading ||
                              impersonateLoading ||
                              m.banned ||
                              isDisabled
                            }
                            onClick={() => setImpersonateTarget(m)}
                          >
                            Belépés mint…
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={pending || emailLoading || m.banned}
                            onClick={() => setEmailTarget(m)}
                          >
                            Jelszó email
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending || resetLoading}
                            onClick={() => setResetTarget(m)}
                          >
                            Ideiglenes jelszó
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending || revokeLoading}
                            onClick={() => setRevokeUserTarget(m)}
                          >
                            Kiléptetés
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleToggleDisabled(m)}
                          >
                            {isDisabled ? 'Engedélyezés' : 'Kikapcsolás'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending || addLoading}
                            onClick={() => setRemoveTarget(m)}
                          >
                            Eltávolítás
                          </Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}
              </DataTableBody>
            </DataTable>
          )}
        </section>
      ) : null}

      {tab === 'billing' ? (
        <section className="space-y-4 rounded-md border border-border bg-surface p-4">
          <div>
            <h2 className="text-body font-semibold text-ink">Előfizetés</h2>
            <p className="mt-1 text-hint text-ink-secondary">
              Fizetés és állapot csak innen — a cég oldalon nincs self-serve.
              A számla kívül készül; itt az állapot és a havi becslés.
            </p>
          </div>

          {monthlyBill ? (
            <MonthlyBillSummary
              estimate={monthlyBill}
              variant="platform"
              footnote="Fix = plan + aktív add-onok. Usage = sikeres SMS db × egységár. Minden összeg nettó. Árváltozás a katalógusban a következő becslésre érvényes."
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="billing-status"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Fizetési státusz
              </label>
              <MenuSelect
                id="billing-status"
                value={billingStatus}
                disabled={pending}
                allowEmpty={false}
                options={Object.entries(BILLING_LABELS).map(([k, label]) => ({
                  value: k,
                  label
                }))}
                onChange={setBillingStatus}
              />
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
                Előfizetés megjegyzés
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

      {tab === 'package' ? (
        <section className="space-y-3">
          <div className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-body font-semibold text-ink">Csomag</h2>
            <p className="mt-1 text-hint text-ink-secondary">
              Plan, add-onok és eszközök — ami a cégben megjelenik.
              {planLabel?.trim()
                ? ` Jelenlegi: ${planLabel.trim()}.`
                : ' Még nincs plan.'}
            </p>
          </div>
          {entitlementsSlot ?? (
            <p className="text-body text-ink-secondary">
              Nincs csomag panel.
            </p>
          )}
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
            ? `${personLabel(resetTarget)} jelszava azonnal megváltozik. Az új jelszót csak egyszer mutatjuk.`
            : ''
        }
        confirmLabel="Beállítás"
        cancelLabel="Mégse"
        variant="danger"
        loading={resetLoading}
        onConfirm={() => void handleConfirmReset()}
      />

      <ConfirmDialog
        open={Boolean(emailTarget)}
        onOpenChange={(open) => {
          if (!open) setEmailTarget(null)
        }}
        title="Jelszó-visszaállító email?"
        description={
          emailTarget
            ? `Auth emailt küldünk: ${emailTarget.email}.`
            : ''
        }
        confirmLabel="Email küldése"
        cancelLabel="Mégse"
        variant="primary"
        loading={emailLoading}
        onConfirm={() => void handleConfirmAuthEmail()}
      />

      <ConfirmDialog
        open={Boolean(revokeUserTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeUserTarget(null)
        }}
        title="Kiléptetés?"
        description={
          revokeUserTarget
            ? `${personLabel(revokeUserTarget)} minden app sessionje lejár — újra be kell lépnie.`
            : ''
        }
        confirmLabel="Kiléptetés"
        cancelLabel="Mégse"
        variant="danger"
        loading={revokeLoading}
        onConfirm={() => void handleConfirmRevokeUser()}
      />

      <ConfirmDialog
        open={revokeTenantOpen}
        onOpenChange={setRevokeTenantOpen}
        title="Mindenkit kiléptetünk?"
        description="Minden tag app sessionje érvénytelenítve lesz. A support belépések nem."
        confirmLabel="Összes kiléptetése"
        cancelLabel="Mégse"
        variant="danger"
        loading={revokeLoading}
        onConfirm={() => void handleConfirmRevokeTenant()}
      />

      <ConfirmDialog
        open={Boolean(impersonateTarget)}
        onOpenChange={(open) => {
          if (!open) setImpersonateTarget(null)
        }}
        title="Belépés mint ez a felhasználó?"
        description={
          impersonateTarget
            ? `${personLabel(impersonateTarget)} nevében nyílik az app (írható, 60 perc). Erős bannerrel kiléphetsz.`
            : ''
        }
        confirmLabel="Belépés mint…"
        cancelLabel="Mégse"
        loading={impersonateLoading}
        onConfirm={() => void handleConfirmImpersonate()}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title="Felhasználó eltávolítása?"
        description={
          removeTarget
            ? `${personLabel(removeTarget)} elveszíti a hozzáférést ehhez a céghez. A fiók maga megmarad.`
            : ''
        }
        confirmLabel="Eltávolítás"
        cancelLabel="Mégse"
        variant="danger"
        loading={addLoading}
        onConfirm={() => void handleConfirmRemove()}
      />

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open && !addLoading) setAddOpen(false)
          else setAddOpen(open)
        }}
      >
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Felhasználó hozzáadása</DialogTitle>
            <DialogDescription>
              Manuális fiók — email + ideiglenes jelszó. Nincs meghívó email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="add-name"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Megjelenített név
              </label>
              <Input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                disabled={addLoading}
                placeholder="Pl. Kovács Anna"
              />
            </div>
            <div>
              <label
                htmlFor="add-email"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Email
              </label>
              <Input
                id="add-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                disabled={addLoading}
                autoComplete="off"
              />
            </div>
            <div>
              <label
                htmlFor="add-password"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Ideiglenes jelszó
              </label>
              <Input
                id="add-password"
                type="text"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                disabled={addLoading}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label
                htmlFor="add-role"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Szerep
              </label>
              <MenuSelect
                id="add-role"
                value={addRole}
                disabled={addLoading}
                allowEmpty={false}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'member', label: 'Tag' },
                  { value: 'viewer', label: 'Megtekintő' }
                ]}
                onChange={(v) =>
                  setAddRole(v as 'admin' | 'member' | 'viewer')
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={addLoading}
              onClick={() => setAddOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={addLoading}
              disabled={!addEmail.trim() || addPassword.length < 8}
              onClick={() => void handleAddMember()}
            >
              Hozzáadás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function SnapshotItem({
  label,
  value,
  href
}: {
  label: string
  value: string | null | undefined
  href?: string
}) {
  const display = value?.trim() || '—'
  return (
    <div>
      <dt className="text-hint text-ink-secondary">{label}</dt>
      <dd className="text-ink">
        {href && value?.trim() ? (
          <a href={href} className="text-ink underline-offset-2 hover:underline">
            {display}
          </a>
        ) : (
          display
        )}
      </dd>
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
