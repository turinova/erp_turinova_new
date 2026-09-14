import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { StatusBadge } from '@/components/patterns/status-badge'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { formatPlatformHuf } from '@/lib/platform/partner-overview'
import { getPlatformPartnerDetail } from '@/lib/platform/partner-queries'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Partner · Platform' }
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

export default async function PlatformPartnerDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const detail = await getPlatformPartnerDetail(ctx.admin, id)
  if (!detail) notFound()

  const p = detail.profile
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

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-h1 text-ink">{p.name}</h1>
        <StatusBadge tone={detail.emailConfirmed ? 'success' : 'warning'}>
          {detail.emailConfirmed ? 'Email OK' : 'Email nem erősített'}
        </StatusBadge>
      </div>
      <p className="text-body text-ink-secondary">{p.email}</p>

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
          </dl>
        </section>

        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-2 text-body font-semibold text-ink">
            Kapcsolt cég
          </h2>
          {p.selectedTenantId && detail.companyName ? (
            <p>
              <Link
                href={`/platform/tenants/${p.selectedTenantId}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                {detail.companyName}
              </Link>
            </p>
          ) : (
            <p className="text-body text-ink-secondary">Nincs kapcsolt cég.</p>
          )}
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
