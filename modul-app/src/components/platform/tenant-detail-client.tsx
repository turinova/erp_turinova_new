'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { PhoneInput } from '@/components/patterns/phone-input'
import { MonthlyBillSummary } from '@/components/billing/monthly-bill-summary'
import { formatPhoneNumber, HU_PHONE_EXAMPLE } from '@/lib/customers/parse'
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
  ACCESS_META,
  accessRelativeHint,
  daysBetween,
  deriveAccessStatus,
  extendAccessUntil,
  formatAccessDateHu,
  parseAccessSource,
  toDateOnly,
  todayInBudapest,
  type DerivedAccessStatus
} from '@/lib/billing/access'
import {
  extendTenantAccess,
  grantTenantTrial,
  platformAddTenantMember,
  platformRemoveTenantMember,
  platformSetMembershipDisabled,
  refreshTenantOnboardingFlags,
  resetTenantUserPassword,
  revokeTenantSessions,
  revokeUserSessions,
  closePlatformTenant,
  purgePlatformTenant,
  seedDemoMasterData,
  sendTenantUserAuthEmail,
  stopTenantAccess,
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
import type { MonthlyBillEstimate } from '@/lib/billing/estimate'
import type { TenantStatus } from '@/lib/supabase/database.types'
import { usePlatformHref } from '@/lib/platform/use-platform-href'
import { cn } from '@/lib/utils'

const AUDIT_LABELS: Record<string, string> = {
  'impersonation.start': 'Belépés mint user',
  'impersonation.end': 'Support mód vége',
  'tenant.status': 'Cég státusz',
  'tenant.max_seats': 'Helyek limit',
  'tenant.ops_fields': 'Előfizetés / jegyzet',
  'tenant.access_extend': 'Hozzáférés hosszabbítás',
  'tenant.access_trial': 'Próba indítás',
  'tenant.access_stop': 'Hozzáférés leállítás',
  'tenant.demo_seed': 'Demó törzs feltöltés',
  'tenant.purge': 'Cég végleges törlés',
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

/** Lean ops: Üzem (plan+billing) · Emberek · Eszközök · Haladó */
type TabId = 'ops' | 'people' | 'devices' | 'advanced'

type Props = {
  tenant: {
    id: string
    name: string
    slug: string
    status: TenantStatus
    created_at: string
    max_seats: number | null
    access_until: string | null
    access_source: string | null
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
  monthlyBill?: MonthlyBillEstimate | null
  planLabel?: string | null
  /** Plan + add-on entitlements (eszközök nélkül). */
  entitlementsSlot?: ReactNode
  /** Jelenlét / footcounter eszköz panelek. */
  devicesSlot?: ReactNode
  /** Műhely / lapszab — partner ops link megjelenik. */
  showPartnerOps?: boolean
  /** Van-e már demó törzs (units+payment+fee+manufacturer). */
  hasDemoMaster?: boolean
}

export function TenantDetailClient({
  tenant,
  onboarding,
  kpis,
  members,
  company,
  auditRows,
  monthlyBill,
  planLabel,
  entitlementsSlot,
  devicesSlot,
  showPartnerOps = false,
  hasDemoMaster = false
}: Props) {
  const router = useRouter()
  const href = usePlatformHref()
  const [tab, setTab] = useState<TabId>('ops')
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
  const [demoSeedOpen, setDemoSeedOpen] = useState(false)
  const [demoSeedLoading, setDemoSeedLoading] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeLoading, setPurgeLoading] = useState(false)
  const [purgeSlug, setPurgeSlug] = useState('')
  const [tempPassword, setTempPassword] = useState<{
    email: string
    password: string
  } | null>(null)

  const [accessUntil, setAccessUntil] = useState(
    toDateOnly(tenant.access_until) ?? ''
  )
  const [accessAdvancedOpen, setAccessAdvancedOpen] = useState(false)
  const [extendPreview, setExtendPreview] = useState<{
    months: 1 | 12
    next: string
  } | null>(null)
  const [stopOpen, setStopOpen] = useState(false)

  const [billingNotes, setBillingNotes] = useState(tenant.billing_notes ?? '')
  const [internalNotes, setInternalNotes] = useState(
    tenant.internal_notes ?? ''
  )
  const [contactPhone, setContactPhone] = useState(
    () => formatPhoneNumber(tenant.contact_phone ?? '')
  )
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

  const accessStatus: DerivedAccessStatus = deriveAccessStatus({
    accessUntil: tenant.access_until,
    accessSource: tenant.access_source
  })
  const accessMeta = ACCESS_META[accessStatus]
  const accessUntilLabel = formatAccessDateHu(tenant.access_until)
  const accessHint = accessRelativeHint(tenant.access_until)
  const today = todayInBudapest()
  const untilOnly = toDateOnly(tenant.access_until)
  const endingSoon =
    (accessStatus === 'ok' || accessStatus === 'trial') &&
    untilOnly != null &&
    untilOnly >= today &&
    daysBetween(today, untilOnly) <= 7

  const attention =
    tenant.status === 'suspended'
      ? { text: 'A cég fel van függesztve.', tab: 'ops' as TabId }
      : accessStatus === 'grace'
        ? {
            text: `Hozzáférés lejárt (${accessUntilLabel ?? '—'}) — grace.`,
            tab: 'ops' as TabId
          }
        : accessStatus === 'expired'
          ? {
              text: 'Hozzáférés lejárt — hosszabbíts vagy állítsd le.',
              tab: 'ops' as TabId
            }
          : accessStatus === 'unset'
            ? {
                text: 'Nincs hozzáférési dátum.',
                tab: 'ops' as TabId
              }
            : endingSoon
              ? {
                  text:
                    accessStatus === 'trial'
                      ? `Próba hamarosan lejár (${accessUntilLabel}).`
                      : `Hamarosan lejár (${accessUntilLabel}).`,
                  tab: 'ops' as TabId
                }
              : stuck
                ? {
                    text: `Onboarding ${progress.percent}% — ${kpis.daysSinceCreated} napja.`,
                    tab: 'advanced' as TabId
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
    setAccessUntil(toDateOnly(tenant.access_until) ?? '')
    setBillingNotes(tenant.billing_notes ?? '')
    setInternalNotes(tenant.internal_notes ?? '')
    setContactPhone(formatPhoneNumber(tenant.contact_phone ?? ''))
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
        accessUntil: accessUntil.trim() ? accessUntil.trim() : null,
        accessSource: accessUntil.trim()
          ? parseAccessSource(tenant.access_source) ?? 'manual'
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
      toast.success('Előfizetés / jegyzet mentve.')
      setExtendPreview(null)
      router.refresh()
    })
  }

  function handleExtendConfirm() {
    if (!extendPreview) return
    const months = extendPreview.months
    startTransition(async () => {
      const result = await extendTenantAccess({
        tenantId: tenant.id,
        months
      })
      setExtendPreview(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Hozzáférés meghosszabbítva.')
      router.refresh()
    })
  }

  function handleGrantTrial() {
    startTransition(async () => {
      const result = await grantTenantTrial({ tenantId: tenant.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Próba beállítva.')
      router.refresh()
    })
  }

  function handleStopAccess() {
    startTransition(async () => {
      const result = await stopTenantAccess({ tenantId: tenant.id })
      setStopOpen(false)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Hozzáférés leállítva.')
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

  async function handleConfirmDemoSeed() {
    setDemoSeedLoading(true)
    try {
      const result = await seedDemoMasterData({ tenantId: tenant.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Demó törzs kész.')
      setDemoSeedOpen(false)
      router.refresh()
    } finally {
      setDemoSeedLoading(false)
    }
  }

  async function handleConfirmClose() {
    setCloseLoading(true)
    try {
      const result = await closePlatformTenant({ tenantId: tenant.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Cég lezárva.')
      setCloseOpen(false)
      setStatus('churned')
      router.refresh()
    } finally {
      setCloseLoading(false)
    }
  }

  async function handleConfirmPurge() {
    setPurgeLoading(true)
    try {
      const result = await purgePlatformTenant({
        tenantId: tenant.id,
        confirmSlug: purgeSlug
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Cég törölve.')
      setPurgeOpen(false)
      router.push(href('/tenants'))
      router.refresh()
    } finally {
      setPurgeLoading(false)
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
    { id: 'ops', label: 'Üzem' },
    { id: 'people', label: 'Emberek' },
    { id: 'devices', label: 'Eszközök' },
    { id: 'advanced', label: 'Haladó' }
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
            {accessMeta.opsLabel}
            {accessUntilLabel ? ` · ${accessUntilLabel}` : ''}
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


      {tab === 'ops' ? (
        <div className="space-y-4">
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
          ) : null}

          <section className="rounded-md border border-border bg-surface">
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
              <div className="min-w-0 px-3 py-3">
                <p className="truncate text-hint text-ink-secondary">Plan</p>
                <p className="mt-1 truncate text-[1.15rem] font-semibold text-ink">
                  {planLabel?.trim() || '—'}
                </p>
              </div>
              <div className="min-w-0 px-3 py-3">
                <p className="truncate text-hint text-ink-secondary">Díj (hó)</p>
                <p className="mt-1 text-[1.15rem] font-semibold tabular-nums text-ink">
                  {monthlyBill
                    ? new Intl.NumberFormat('hu-HU', {
                        maximumFractionDigits: 0
                      }).format(Math.round(monthlyBill.totalHuf))
                    : '—'}{' '}
                  <span className="text-hint font-normal text-ink-muted">
                    Ft
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="block min-w-0 px-3 py-3 text-left hover:bg-subtle"
                onClick={() => setTab('people')}
              >
                <p className="truncate text-hint text-ink-secondary">Emberek</p>
                <p className="mt-1 text-[1.15rem] font-semibold tabular-nums text-ink">
                  {kpis.memberCount}
                </p>
                <p className="mt-1 truncate text-hint text-ink-muted">
                  {seatsLabel}
                </p>
              </button>
              <div className="min-w-0 px-3 py-3">
                <p className="truncate text-hint text-ink-secondary">
                  Utolsó belépés
                </p>
                <p className="mt-1 text-[1.15rem] font-semibold text-ink">
                  {formatRelative(kpis.lastSignInAt)}
                </p>
                {kpis.smsSentThisMonth > 0 ? (
                  <p className="mt-1 truncate text-hint text-ink-muted">
                    SMS hó: {kpis.smsSentThisMonth}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {showPartnerOps ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2.5">
              <div>
                <p className="text-body font-medium text-ink">Partnerek</p>
                <p className="text-hint text-ink-secondary">
                  {kpis.linkedPartners} kapcsolva (selected_tenant)
                </p>
              </div>
              <a
                href={href(`/partnerek?tenant=${tenant.id}`)}
                className="text-[13px] font-medium text-ink underline-offset-2 hover:underline"
              >
                Partnerek megnyitása →
              </a>
            </div>
          ) : null}

          <section className="space-y-3">
            <div className="rounded-md border border-border bg-surface p-4">
              <h2 className="text-body font-semibold text-ink">Csomag</h2>
              <p className="mt-1 text-hint text-ink-secondary">
                Plan váltás bundelt add-onokkal. Eszközök külön tabon.
              </p>
            </div>
            {entitlementsSlot ?? (
              <p className="text-body text-ink-secondary">Nincs csomag panel.</p>
            )}
          </section>

          <section className="space-y-4 rounded-md border border-border bg-surface p-4">
            <div>
              <h2 className="text-body font-semibold text-ink">Előfizetés</h2>
              <p className="mt-1 text-hint text-ink-secondary">
                Fizetés és hozzáférés csak innen — a cég oldalon nincs
                self-serve. A státuszt a dátum számolja.
              </p>
            </div>

            {monthlyBill ? (
              <MonthlyBillSummary
                estimate={monthlyBill}
                variant="platform"
                footnote="Fix = plan + à la carte add-on. Bundel skip. SMS usage. Nettó."
              />
            ) : null}

            <div className="flex flex-col gap-3 rounded-md border border-border bg-subtle/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <StatusBadge tone={accessMeta.tone}>
                  {accessMeta.opsLabel}
                </StatusBadge>
                <p className="text-hint text-ink-secondary">
                  {accessStatus === 'trial'
                    ? 'Próba eddig'
                    : accessStatus === 'unset'
                      ? 'Hozzáférés'
                      : 'Hozzáférés eddig'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-body font-semibold text-ink">
                  {accessUntilLabel ?? '—'}
                </p>
                {accessHint ? (
                  <p className="text-hint text-ink-secondary">{accessHint}</p>
                ) : null}
              </div>
            </div>

            {extendPreview ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-body text-ink">
                  {extendPreview.months === 1 ? '+1 hónap' : '+1 év'} →{' '}
                  <span className="font-semibold">
                    {formatAccessDateHu(extendPreview.next) ??
                      extendPreview.next}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={pending}
                  onClick={handleExtendConfirm}
                >
                  Megerősít
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => setExtendPreview(null)}
                >
                  Mégse
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={() =>
                    setExtendPreview({
                      months: 1,
                      next: extendAccessUntil(tenant.access_until, 1)
                    })
                  }
                >
                  +1 hónap
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    setExtendPreview({
                      months: 12,
                      next: extendAccessUntil(tenant.access_until, 12)
                    })
                  }
                >
                  +1 év
                </Button>
                {accessStatus === 'unset' ||
                accessStatus === 'grace' ||
                accessStatus === 'expired' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={handleGrantTrial}
                  >
                    Próba 14 nap
                  </Button>
                ) : null}
              </div>
            )}

            <div>
              <button
                type="button"
                className="mb-2 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2 text-left text-body font-medium text-ink hover:bg-subtle/80"
                onClick={() => setAccessAdvancedOpen((v) => !v)}
                aria-expanded={accessAdvancedOpen}
              >
                <span>Haladó</span>
                <span className="text-hint text-ink-secondary">
                  {accessAdvancedOpen ? 'Elrejt' : 'Megnyit'}
                </span>
              </button>
              {accessAdvancedOpen ? (
                <div className="space-y-3 rounded-md border border-border px-3 py-3">
                  <p className="text-hint text-ink-muted">
                    Csak ha nem +1 hónap/év — pl. részév, korrekció.
                  </p>
                  <div>
                    <label
                      htmlFor="access-until"
                      className="mb-1 block text-hint text-ink-secondary"
                    >
                      Hozzáférés eddig
                    </label>
                    <Input
                      id="access-until"
                      type="date"
                      value={accessUntil}
                      onChange={(e) => setAccessUntil(e.target.value)}
                      disabled={pending}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setStopOpen(true)}
                  >
                    Leállít
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-phone"
                  className="mb-1 block text-hint text-ink-secondary"
                >
                  Kapcsolat telefon
                </label>
                <PhoneInput
                  id="contact-phone"
                  value={contactPhone}
                  onValueChange={setContactPhone}
                  disabled={pending}
                  placeholder={HU_PHONE_EXAMPLE}
                />
              </div>
              <div>
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
                  rows={3}
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
                variant="secondary"
                loading={pending}
                onClick={handleOpsSave}
              >
                Mentés
              </Button>
            </div>
          </section>
        </div>
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


      {tab === 'devices' ? (
        <section className="space-y-3">
          <div className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-body font-semibold text-ink">Eszközök</h2>
            <p className="mt-1 text-hint text-ink-secondary">
              Jelenlét terminál és belépőkamera — Bolt+ / Pro (vagy à la carte).
              Hardver egyszeri, nem havidíj.
            </p>
          </div>
          {devicesSlot ?? (
            <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-4 text-body text-ink-secondary">
              Nincs eszköz panel ehhez a céghez.
            </p>
          )}
        </section>
      ) : null}

      {tab === 'advanced' ? (
        <div className="space-y-4">
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-body font-semibold text-ink">Demó adatok</h2>
                <p className="mt-1 text-hint text-ink-secondary">
                  {hasDemoMaster
                    ? 'Törzs + katalógus már feltöltve.'
                    : 'Feltölti a demó törzset és a katalógust.'}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={hasDemoMaster || demoSeedLoading}
                onClick={() => setDemoSeedOpen(true)}
              >
                {hasDemoMaster ? 'Már feltöltve' : 'Demó adatok feltöltése'}
              </Button>
            </div>
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-body font-semibold text-ink">Onboarding</h2>
                <p className="text-hint text-ink-secondary">
                  {progress.done}/{progress.total} · {progress.percent}%
                  {nextStep ? ` · Következő: ${nextStep}` : ''}
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
          </section>

          {showPartnerOps ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2.5">
              <div>
                <p className="text-body font-medium text-ink">
                  Partnerek ({kpis.linkedPartners})
                </p>
                <p className="text-hint text-ink-secondary">
                  Teljes lista a Partnerek menüben, cégre szűrve.
                </p>
              </div>
              <a
                href={href(`/partnerek?tenant=${tenant.id}`)}
                className="text-[13px] font-medium text-ink underline-offset-2 hover:underline"
              >
                Megnyitás →
              </a>
            </div>
          ) : null}

          <section className="rounded-md border border-danger/30 bg-danger-soft/40 p-4">
            <h2 className="text-body font-semibold text-danger-ink">
              Veszélyzóna
            </h2>
            <p className="mt-1 text-hint text-ink-secondary">
              Lezárás: nincs belépés, adat megmarad. Végleges törlés: minden adat
              + orphan userek — csak lezárt cégnél.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={tenant.status === 'churned' || closeLoading}
                onClick={() => setCloseOpen(true)}
              >
                {tenant.status === 'churned' ? 'Már lezárva' : 'Cég lezárása'}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={tenant.status !== 'churned' || purgeLoading}
                onClick={() => {
                  setPurgeSlug('')
                  setPurgeOpen(true)
                }}
              >
                Végleges törlés
              </Button>
            </div>
          </section>

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
        </div>
      ) : null}

      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Leállítod a hozzáférést?"
        description="A cég holnaptól nem fér be (hozzáférés = tegnap). A státusz a dátumból jön."
        confirmLabel="Leállít"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={() => void handleStopAccess()}
      />

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
        open={demoSeedOpen}
        onOpenChange={setDemoSeedOpen}
        title="Demó adatok feltöltése?"
        description="Törzs (Kecskemét + logo, HR…) és katalógus (2 tábla, 2 él, 2 munkalap, 3 termék + képek). Ami már megvan, kihagyja."
        confirmLabel="Feltöltés"
        cancelLabel="Mégse"
        variant="primary"
        loading={demoSeedLoading}
        onConfirm={() => void handleConfirmDemoSeed()}
      />

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Cég lezárása?"
        description={`${tenant.name} státusza „Lezárva” lesz. A tagok nem léphetnek be. Az adat megmarad — később újraaktiválhatod vagy végleg törölheted.`}
        confirmLabel="Lezárás"
        cancelLabel="Mégse"
        variant="danger"
        loading={closeLoading}
        onConfirm={() => void handleConfirmClose()}
      />

      <ConfirmDialog
        open={purgeOpen}
        onOpenChange={(open) => {
          setPurgeOpen(open)
          if (!open) setPurgeSlug('')
        }}
        title="Végleges törlés?"
        description={`Minden adat, storage és a csak ehhez a céghez tartozó userek törlődnek. Írd be a slugot a megerősítéshez: ${tenant.slug}`}
        confirmLabel="Végleg törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={purgeLoading}
        onConfirm={() => void handleConfirmPurge()}
      >
        <Input
          id="purge-slug"
          value={purgeSlug}
          onChange={(e) => setPurgeSlug(e.target.value)}
          placeholder={tenant.slug}
          autoComplete="off"
          disabled={purgeLoading}
          className="font-mono"
        />
      </ConfirmDialog>

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
