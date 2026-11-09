'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  setPartnerStatus,
  setPartnerTenant,
  unlinkPartnerTenant
} from '@/lib/platform/partner-actions'
import { formatPlatformHuf } from '@/lib/platform/partner-overview'
import type { PlatformPartnerDetail } from '@/lib/platform/partner-queries'
import type { PartnerCompanyOption } from '@/lib/partner/companies'
import { usePlatformHref } from '@/lib/platform/use-platform-href'

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
  const href = usePlatformHref()
  const p = detail.profile
  const [pending, startTransition] = useTransition()
  const [disableOpen, setDisableOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
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
        href={href('/partnerek')}
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
            {p.mustSetPassword ? (
              <StatusBadge tone="warning">Jelszó beállítás kell</StatusBadge>
            ) : null}
            {p.legacyPortalCustomerId ? (
              <StatusBadge tone="neutral">Migrált</StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 text-body text-ink-secondary">{p.email}</p>
          {isDisabled && p.disabledReason ? (
            <p className="mt-1 text-hint text-danger-ink">
              Indok: {p.disabledReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDisabled ? (
            <Button
              type="button"
              variant="primary"
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Draft" value={String(detail.draftCount)} />
        <Kpi label="Beküldés (összes)" value={String(detail.submittedCount)} />
        <Kpi
          label="GMV (összes)"
          value={formatPlatformHuf(detail.gmvSubmitted)}
        />
        <Kpi
          label="Beküldés 7 nap"
          value={`${detail.submitted7d} · ${formatPlatformHuf(detail.gmv7d)}`}
        />
        <Kpi
          label="Beküldés 30 nap"
          value={`${detail.submitted30d} · ${formatPlatformHuf(detail.gmv30d)}`}
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
              label="ÁSZF elfogadva"
              value={formatDate(p.termsAcceptedAt)}
            />
            <Row
              label="Utolsó beküldés"
              value={formatDate(detail.lastSubmittedAt)}
            />
            {p.legacyPortalCustomerId ? (
              <Row
                label="Legacy ID"
                value={p.legacyPortalCustomerId.slice(0, 8) + '…'}
              />
            ) : null}
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
                href={href(`/tenants/${p.selectedTenantId}`)}
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
              <MenuSelect
                id="partner-tenant"
                value={tenantId}
                disabled={pending || isDisabled}
                emptyLabel="Válassz…"
                options={companies.map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.city || undefined
                }))}
                onChange={setTenantId}
              />
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

        <section className="rounded-md border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-2 text-body font-semibold text-ink">
            Utolsó portal ajánlatok
          </h2>
          {detail.recentQuotes.length === 0 ? (
            <p className="text-body text-ink-secondary">
              Még nincs portal ajánlat.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.recentQuotes.map((quote) => (
                <li
                  key={quote.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-body"
                >
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums text-ink">
                      {quote.quoteNumber}
                      {quote.projectName ? (
                        <span className="ml-2 font-normal text-ink-secondary">
                          {quote.projectName}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-hint text-ink-secondary">
                      {quote.portalSubmittedAt
                        ? `Beküldve ${formatDate(quote.portalSubmittedAt)}`
                        : `Draft · létrehozva ${formatDate(quote.createdAt)}`}
                      {' · '}
                      {quote.status}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums text-ink">
                    {formatPlatformHuf(quote.totalGross)}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
