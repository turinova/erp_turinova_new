import { ArrowRight, Handshake, MessageSquare, Printer, Smartphone } from 'lucide-react'
import Link from 'next/link'

import type { ReviewClickStats } from '@/lib/reviews/queries'
import type { ReviewFunnel } from '@/lib/reviews/queue-queries'
import type { ReviewSettings } from '@/lib/reviews/settings'

const nf = new Intl.NumberFormat('hu-HU')

function pct(part: number, whole: number): string | null {
  if (whole <= 0) return null
  return `${Math.round((part / whole) * 100)}%`
}

export function ReviewOverview({
  funnel,
  clicks,
  settings,
  hasSms,
  hasPartnerPortal,
  hasLink
}: {
  funnel: ReviewFunnel
  clicks: ReviewClickStats
  settings: ReviewSettings
  hasSms: boolean
  hasPartnerPortal: boolean
  hasLink: boolean
}) {
  const steps = [
    { label: 'Átadott lapszabászat', value: funnel.handedOver, hint: null },
    { label: 'Köszönő SMS elküldve', value: funnel.smsSent, hint: pct(funnel.smsSent, funnel.handedOver) },
    { label: 'Link megnyitva (összes csatorna)', value: funnel.opened, hint: null },
    {
      label: 'Új Google-értékelés',
      value: funnel.newReviews,
      hint: funnel.newReviews == null ? 'Places API kulcs és Place ID kell' : null
    }
  ]
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0))

  const todos: { text: string; href: string }[] = []
  if (!hasLink) todos.push({ text: 'Add meg a Google értékelő linket', href: '/beallitasok/cegadatok' })
  if (funnel.pendingToday > 0) {
    todos.push({
      text: `${nf.format(funnel.pendingToday)} köszönő SMS megy ki ma`,
      href: '?tab=utemezett'
    })
  }
  if (settings.thankSmsEnabled && funnel.noConsentRecent > 0) {
    todos.push({
      text: `${nf.format(funnel.noConsentRecent)} új vevő nem kér értékelés-kérő SMS-t (30 nap)`,
      href: '/ugyfelek'
    })
  }
  if (hasLink && !settings.handoverQrEnabled) {
    todos.push({ text: 'A QR-kód az átvételi blokkon ki van kapcsolva, pedig ingyenes', href: '?tab=csatornak' })
  }

  const tiles = [
    { label: 'Státusz oldal', value: clicks.status, icon: Smartphone, on: settings.statusPageEnabled },
    { label: 'QR-kód', value: clicks.qr, icon: Printer, on: settings.handoverQrEnabled },
    { label: 'Köszönő SMS', value: clicks.sms, icon: MessageSquare, on: settings.thankSmsEnabled && hasSms },
    ...(hasPartnerPortal
      ? [{ label: 'Partnerportál', value: clicks.partner, icon: Handshake, on: settings.partnerPortalEnabled }]
      : []),
    { label: 'Egyéb', value: clicks.other, icon: ArrowRight, on: null as boolean | null }
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="text-body font-semibold text-ink">Utolsó 30 nap</h2>
        <ol className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-body text-ink-secondary">{s.label}</span>
              <span className="h-2 rounded-full bg-subtle" aria-hidden>
                <span
                  className="block h-full rounded-full bg-ink"
                  style={{ width: `${((s.value ?? 0) / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-body tabular-nums text-ink">
                {s.value == null ? '—' : nf.format(s.value)}
                {s.hint ? <span className="ml-1.5 text-hint text-ink-muted">{s.hint}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="px-0.5 text-body font-semibold text-ink">Megnyitások csatornánként</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {tiles.map(({ label, value, icon: Icon, on }) => (
            <div key={label} className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-hint text-ink-secondary">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </p>
              <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-ink">{nf.format(value)}</p>
              {on != null ? (
                <p className={on ? 'text-hint text-success-ink' : 'text-hint text-ink-muted'}>
                  {on ? 'Bekapcsolva' : 'Kikapcsolva'}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="px-0.5 text-hint text-ink-muted">A link-előnézetek (Messenger, Viber stb.) nem számítanak.</p>
      </section>

      {todos.length > 0 ? (
        <section className="rounded-md border border-border bg-surface p-3">
          <h2 className="text-body font-semibold text-ink">Teendők</h2>
          <ul className="mt-2 divide-y divide-border">
            {todos.map((t) => (
              <li key={t.text}>
                <Link
                  href={t.href}
                  className="flex items-center justify-between gap-2 py-2 text-body text-ink no-underline hover:underline"
                >
                  {t.text}
                  <ArrowRight className="size-3.5 shrink-0 text-ink-secondary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
