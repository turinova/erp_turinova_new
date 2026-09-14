'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  setPartnerStatus,
  setPartnerTenant,
  unlinkPartnerTenant
} from '@/lib/platform/partner-actions'
import { startPartnerImpersonation } from '@/lib/platform/impersonation'
import { formatPlatformHuf } from '@/lib/platform/partner-overview'
import type { PlatformPartnerDetail } from '@/lib/platform/partner-queries'
import type { PartnerCompanyOption } from '@/lib/partner/companies'

type Props = {
  detail: PlatformPartnerDetail
  companies: PartnerCompanyOption[]
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('hu-HU', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PartnerDetailClient({ detail, companies }: Props) {
  const router = useRouter()
  const p = detail.profile
  const [pending, startTransition] = useTransition()
  const [disableOpen, setDisableOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [disableReason, setDisableReason] = useState('')
  const [tenantId, setTenantId] = useState(p.selectedTenantId ?? '')
  const [actionLoading, setActionLoading] = useState(false)

  const isDisabled = p.status === 'disabled'

  function refresh() {
    router.refresh()
  }

  function handleEnable() {
    startTransition(async () => {
      const result = await setPartnerStatus({
        userId: p.userId,
        status: 'active'
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Partner aktív.')
      refresh()
    })
  }

  async function handleDisable() {
    setActionLoading(true)
    try {
      const result = await setPartnerStatus({
        userId: p.userId,
        status: 'disabled',
        reason: disableReason
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setDisableOpen(false)
      setDisableReason('')
      toast.success(result.message ?? 'Partner kikapcsolva.')
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnlink() {
    setActionLoading(true)
    try {
      const result = await unlinkPartnerTenant({ userId: p.userId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setUnlinkOpen(false)
      setTenantId('')
      toast.success(result.message ?? 'Leválasztva.')
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  function handleSetTenant() {
    if (!tenantId) {
      toast.error('Válassz céget.')
      return
    }
    startTransition(async () => {
      const result = await setPartnerTenant({
        userId: p.userId,
        tenantId
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Cég beállítva.')
      refresh()
    })
  }

  async function handleImpersonate() {
    setActionLoading(true)
    try {
      const result = await startPartnerImpersonation({ userId: p.userId })
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
      setActionLoading(false)
      setImpersonateOpen(false)
    }
  }

  const address = [
    p.billingPostalCode,
    p.billingCity,
    [p.billingStreet, p.billingHouseNumber].filter(Boolean).join(' ')
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-4">
      <Link
        href="/platform/partnerek"
        className="text-hint text-ink-secondary no-underline hover:underline"
      >
        ← Partnerek
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-ink">{p.name}</h1>
            <StatusBadge tone={isDisabled ? 'danger' : 'success'}>
              {isDisabled ? 'Kikapcsolva' : 'Aktív'}
            </StatusBadge>
            <StatusBadge tone={detail.emailConfirmed ? 'success' : 'warning'}>
              {detail.emailConfirmed ? 'Email OK' : 'Email nem erősített'}
            </StatusBadge>
          </div>
          <p className="mt-1 text-body text-ink-secondary">{p.email}</p>
          {isDisabled && p.disabledReason ? (
            <p className="mt-1 text-hint text-danger-ink">
              Indok: {p.disabledReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pending || actionLoading || isDisabled}
            onClick={() => setImpersonateOpen(true)}
          >
            Belépés mint partner…
          </Button>
          {isDisabled ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={handleEnable}
            >
              Újra aktív
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || actionLoading}
              onClick={() => setDisableOpen(true)}
            >
              Kikapcsolás
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Draft ajánlat" value={String(detail.draftCount)} />
        <Kpi label="Beküldés" value={String(detail.submittedCount)} />
        <Kpi
          label="Beküldött GMV"
          value={formatPlatformHuf(detail.gmvSubmitted)}
        />
        <Kpi label="Utolsó belépés" value={formatDate(detail.lastSignInAt)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-2 text-body font-semibold text-ink">Profil</h2>
          <dl className="space-y-1.5 text-body">
            <Row label="Telefon" value={p.mobile ?? '—'} />
            <Row label="Regisztráció" value={formatDate(p.createdAt)} />
            <Row
              label="Utolsó beküldés"
              value={formatDate(detail.lastSubmittedAt)}
            />
            {isDisabled ? (
              <Row label="Kikapcsolva" value={formatDate(p.disabledAt)} />
            ) : null}
          </dl>
        </section>

        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-2 text-body font-semibold text-ink">
            Kapcsolt cég
          </h2>
          {p.selectedTenantId && detail.companyName ? (
            <p className="mb-3">
              <Link
                href={`/platform/tenants/${p.selectedTenantId}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                {detail.companyName}
              </Link>
            </p>
          ) : (
            <p className="mb-3 text-body text-ink-secondary">
              Nincs kapcsolt cég — a partner a Beállításokban újra választhat.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="partner-tenant"
                className="mb-1 block text-hint text-ink-secondary"
              >
                Cég (support)
              </label>
              <Select
                id="partner-tenant"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={pending || isDisabled}
              >
                <option value="">Válassz…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` · ${c.city}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={pending}
              disabled={isDisabled || !tenantId}
              onClick={handleSetTenant}
            >
              Beállítás
            </Button>
            {p.selectedTenantId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending || actionLoading}
                onClick={() => setUnlinkOpen(true)}
              >
                Leválasztás
              </Button>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-2 text-body font-semibold text-ink">Számlázás</h2>
          <dl className="space-y-1.5 text-body">
            <Row label="Név" value={p.billingName ?? '—'} />
            <Row label="Adószám" value={p.billingTaxNumber ?? '—'} />
            <Row label="Cím" value={address || '—'} />
          </dl>
        </section>
      </div>

      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Partner kikapcsolása?"
        description="App-szintű tiltás: nem tud belépni. Auth fiók megmarad (nincs ban)."
        confirmLabel="Kikapcsolás"
        cancelLabel="Mégse"
        variant="danger"
        loading={actionLoading}
        onConfirm={() => void handleDisable()}
      >
        <div className="mt-3">
          <label
            htmlFor="disable-reason"
            className="mb-1 block text-hint text-ink-secondary"
          >
            Indok (opcionális)
          </label>
          <Input
            id="disable-reason"
            value={disableReason}
            onChange={(e) => setDisableReason(e.target.value)}
            placeholder="pl. spam / ügyfél kérés"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title="Cég leválasztása?"
        description="A partner a saját Beállítások oldalán újra választhat céget."
        confirmLabel="Leválasztás"
        cancelLabel="Mégse"
        loading={actionLoading}
        onConfirm={() => void handleUnlink()}
      />

      <ConfirmDialog
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        title="Belépés mint ez a partner?"
        description={`${p.email} nevében nyílik az asztalos portál (írható, 60 perc).`}
        confirmLabel="Belépés mint…"
        cancelLabel="Mégse"
        loading={actionLoading}
        onConfirm={() => void handleImpersonate()}
      />
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-3">
      <p className="text-hint text-ink-secondary">{label}</p>
      <p className="mt-1 text-body font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="w-28 shrink-0 text-hint text-ink-secondary">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}
