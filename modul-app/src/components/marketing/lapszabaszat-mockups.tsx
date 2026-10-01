import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import {
  QUOTE_PIPELINE_STEPS,
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import { cn } from '@/lib/utils'

/**
 * Statikus UI-másolatok az éles lapszab / partner / scanner képernyőkről.
 * Címkék, badge-ek, gombok = forráskód (`partner-quotes-list-client`,
 * `quote-detail-client`, `assign-production-dialog`, `scanner-client`,
 * `handover-dialog`, Opti stripök). Nincs marketing-lábléc a mock belsejében.
 */

function AppFrame({
  path,
  children,
  className
}: {
  path: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-app shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-ink-muted">
          {path}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function FakeButton({
  children,
  variant = 'secondary',
  className,
  size = 'md'
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium',
        size === 'sm' ? 'h-7 px-2.5' : 'h-8 px-3',
        variant === 'primary' && 'bg-primary text-white',
        variant === 'secondary' &&
          'border border-border bg-surface text-ink',
        variant === 'ghost' && 'text-ink-secondary',
        className
      )}
    >
      {children}
    </span>
  )
}

function SumChip({
  label,
  value,
  tone,
  emphasize
}: {
  label: string
  value: string
  tone: 'neutral' | 'warning' | 'success'
  emphasize?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md px-2.5 py-1.5',
        tone === 'neutral' && 'bg-subtle text-ink',
        tone === 'warning' && 'bg-warning-soft text-warning-ink',
        tone === 'success' &&
          (emphasize
            ? 'bg-success text-white'
            : 'bg-success-soft text-success-ink')
      )}
    >
      <p
        className={cn(
          'text-[10px] font-semibold leading-none',
          emphasize ? 'text-white/90' : 'opacity-90'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-[12.5px] font-bold tabular-nums leading-tight tracking-tight',
          emphasize && 'text-[14px]'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** Hero crop: Opti panelek + azonnali bruttó + mentés CTA. */
export function PartnerOptiPriceMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="turinova.hu/opti" className={className}>
      <p className="text-[15px] font-semibold tracking-tight text-ink">Opti</p>
      <p className="mt-0.5 text-[12px] text-ink-secondary">Konyha – Fekete</p>

      <div className="mt-2.5 overflow-hidden rounded-md border border-border bg-surface">
        <div className="border-b border-border bg-subtle px-3 py-1.5 text-[13px] font-medium text-ink">
          EGGER W980 ST2
        </div>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[12px] font-medium text-ink-secondary">
              <th className="px-3 py-2 font-medium">Szálirány</th>
              <th className="px-3 py-2 font-medium">Keresztirány</th>
              <th className="px-3 py-2 text-right font-medium">Darab</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 tabular-nums text-ink">720</td>
              <td className="px-3 py-2 tabular-nums text-ink">560</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">4</td>
            </tr>
            <tr>
              <td className="px-3 py-2 tabular-nums text-ink">1200</td>
              <td className="px-3 py-2 tabular-nums text-ink">400</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">2</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="mt-2.5 overflow-hidden rounded-lg border border-border border-l-[3px] border-l-success bg-surface">
        <header className="bg-success-soft/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink">2. Árajánlat</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <SumChip label="Nettó" value="38 268 Ft" tone="neutral" />
              <span className="text-[12px] text-ink-muted" aria-hidden>
                +
              </span>
              <SumChip label="ÁFA" value="10 332 Ft" tone="warning" />
              <span className="text-[12px] text-ink-muted" aria-hidden>
                =
              </span>
              <SumChip
                label="Bruttó végösszeg"
                value="48 600 Ft"
                tone="success"
                emphasize
              />
            </div>
          </div>
        </header>
      </section>

      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-border border-l-[3px] border-l-ink bg-surface px-3 py-2.5">
        <p className="text-[13px] font-semibold text-ink">3. Mentés</p>
        <FakeButton variant="primary">Ajánlat mentése</FakeButton>
      </div>
    </AppFrame>
  )
}

/** @deprecated alias — hero továbbra is ezt importálja */
export const PartnerPriceMockup = PartnerOptiPriceMockup

/**
 * Partner megrendelések – marketing crop: Szám + Fizetés + Státusz + Bruttó.
 * (Az éles app több oszlopos; a landing egy pillantásra olvasható.)
 * Státusz/fizetés címkék: marketing-egységesítés (Kész / Fizetésre vár).
 */
export function PartnerOrdersMockup({ className }: { className?: string }) {
  const rows = [
    {
      order: 'O-2026-042',
      project: 'Konyha – Fekete',
      paymentLabel: 'Kifizetve',
      paymentTone: 'success' as const,
      statusLabel: 'Kész',
      statusTone: 'warning' as const,
      gross: '48 600 Ft',
      highlight: true
    },
    {
      order: 'O-2026-038',
      project: 'Fürdő polcok',
      paymentLabel: 'Részben fizetve',
      paymentTone: 'warning' as const,
      statusLabel: 'Gyártásban',
      statusTone: 'active' as const,
      gross: '22 150 Ft',
      highlight: false
    },
    {
      order: 'O-2026-031',
      project: 'Iroda asztallap',
      paymentLabel: 'Fizetésre vár',
      paymentTone: 'danger' as const,
      statusLabel: 'Megrendelve',
      statusTone: 'success' as const,
      gross: '31 200 Ft',
      highlight: false
    }
  ]

  return (
    <AppFrame path="turinova.hu/megrendelesek" className={className}>
      <p className="text-[15px] font-semibold tracking-tight text-ink">
        Megrendelések
      </p>

      <div className="relative mt-2.5 max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <span className="flex h-8 w-full items-center rounded-md border border-border bg-surface pl-8 pr-2 text-[13px] text-ink-muted">
          Keresés…
        </span>
      </div>

      <div className="mt-2.5 overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-subtle text-[12px] font-medium text-ink-secondary">
              <th className="px-3 py-2 font-medium">Szám</th>
              <th className="px-3 py-2 font-medium">Fizetés</th>
              <th className="px-3 py-2 font-medium">Státusz</th>
              <th className="px-3 py-2 text-right font-medium">Bruttó</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.order}
                className={cn(
                  'border-b border-border last:border-0',
                  r.highlight && 'bg-warning-soft/40'
                )}
              >
                <td className="px-3 py-2.5 align-top">
                  <p className="font-medium tabular-nums text-ink">{r.order}</p>
                  <p className="text-[12px] text-ink-secondary">{r.project}</p>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <StatusBadge tone={r.paymentTone}>{r.paymentLabel}</StatusBadge>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <StatusBadge tone={r.statusTone}>{r.statusLabel}</StatusBadge>
                </td>
                <td className="px-3 py-2.5 text-right align-top tabular-nums font-medium text-ink">
                  {r.gross}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppFrame>
  )
}

/** Staff detail + gyártásba adás dialóg. */
export function ProductionAssignMockup({ className }: { className?: string }) {
  const status = 'ordered' as const
  const currentIdx = QUOTE_PIPELINE_STEPS.indexOf(status)

  return (
    <AppFrame path="turinova.hu/ajanlatok/…" className={className}>
      <p className="text-[11px] text-ink-muted">← Lista</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-ink">
            Megrendelés: O-2026-042
          </p>
          <p className="text-[12px] text-ink-secondary">Árajánlat Q-2026-018</p>
        </div>
        <StatusBadge tone={quoteStatusTone(status)}>
          {QUOTE_STATUS_LABEL[status]}
        </StatusBadge>
      </div>

      <div className="mt-2.5 space-y-1">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1" aria-hidden>
          {QUOTE_PIPELINE_STEPS.map((step, idx) => {
            const done = currentIdx > idx
            const current = currentIdx === idx
            return (
              <li key={step} className="flex items-center gap-1">
                {idx > 0 ? (
                  <span className="text-[11px] text-ink-muted">→</span>
                ) : null}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px]',
                    current && 'bg-ink font-medium text-surface',
                    done && !current && 'font-medium text-ink',
                    !done && !current && 'text-ink-secondary'
                  )}
                >
                  {QUOTE_STATUS_LABEL[step]}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="text-[13px] text-ink-secondary">
          Következő:{' '}
          <span className="font-medium text-ink">Gyártásba adás</span>
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-[14px] font-semibold text-ink">Gyártásba adás</p>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            Megrendelés: <strong className="text-ink">O-2026-042</strong>. A
            gép, a dátum és a vonalkód megadása kötelező.
          </p>
        </div>
        <div className="space-y-2.5 p-3">
          <div>
            <p className="text-[11px] font-medium text-ink">
              Gyártógép <span className="text-danger-ink">*</span>
            </p>
            <p className="mt-0.5 rounded-md border border-border bg-app px-2 py-1.5 text-[13px] text-ink">
              Szabászgép 1
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ink">
              Gyártás dátuma <span className="text-danger-ink">*</span>
            </p>
            <p className="mt-0.5 rounded-md border border-border bg-app px-2 py-1.5 text-[13px] tabular-nums text-ink">
              2026. 10. 03.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ink">
              Vonalkód <span className="text-danger-ink">*</span>
            </p>
            <p className="mt-0.5 rounded-md border border-border bg-app px-2 py-1.5 font-mono text-[13px] text-ink">
              482910473821
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <FakeButton variant="secondary">Mégse</FakeButton>
            <FakeButton variant="primary">Gyártásba adás</FakeButton>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

/** Scanner crop: vonalkód + készre SMS dialóg + telefon. */
export function ScanSmsMockup({ className }: { className?: string }) {
  const smsBody =
    'Kedves Fekete Peter! A rendelese elkeszult, atveheto. Anyag: EGGER W980 ST2. Udvozlettel: Minta Lapszabaszat'

  return (
    <AppFrame path="turinova.hu/scanner" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold tracking-tight text-ink">
          Vonalkód-olvasó
        </p>
        <span className="inline-flex h-7 items-center rounded-md bg-ink px-2.5 text-[12px] font-medium text-surface">
          Lista
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[12px] font-medium text-ink">Vonalkód</p>
          <span className="flex h-10 w-full items-center rounded-md border border-border bg-surface px-3 font-mono text-[14px] tabular-nums text-ink">
            482910473821
          </span>
        </div>
        <FakeButton variant="primary" className="h-10 shrink-0">
          Gyártás kész (1)
        </FakeButton>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[14px] font-semibold text-ink">
              Készre állítás + SMS
            </p>
          </div>
          <div className="px-3 py-2.5">
            <div className="flex items-start gap-2 rounded-md border border-border px-2.5 py-2">
              <span
                className="mt-0.5 inline-block size-3.5 rounded border border-ink bg-ink"
                aria-hidden
              />
              <div>
                <p className="text-[13px] font-semibold text-ink">
                  O-2026-042{' '}
                  <span className="font-normal text-ink-secondary">
                    · Fekete Péter
                  </span>
                </p>
                <p className="text-[12px] text-ink-secondary">+36 30 111 2233</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-3 py-2.5">
            <FakeButton variant="secondary">Mégse</FakeButton>
            <FakeButton variant="primary">Készre állítás + 1 SMS</FakeButton>
          </div>
        </div>

        <div
          className="mx-auto w-[148px] shrink-0 rounded-[1.25rem] border border-border bg-surface p-2 shadow-sm"
          aria-hidden
        >
          <div className="rounded-[0.9rem] bg-app px-2.5 py-3">
            <p className="text-center text-[10px] font-medium text-ink-muted">
              14:32
            </p>
            <div className="mt-2 rounded-lg bg-surface px-2.5 py-2 text-[10.5px] leading-snug text-ink shadow-sm ring-1 ring-border">
              <p className="font-semibold">Minta Lapszabaszat</p>
              <p className="mt-1 break-words text-ink-secondary">{smsBody}</p>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

/** Átadás dialóg + átvételi elismervény (vevői példány). */
export function HandoverMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="turinova.hu/ajanlatok/…" className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[14px] font-semibold text-ink">
              Átadás a megrendelőnek
            </p>
            <p className="mt-0.5 text-[12px] text-ink-secondary">
              O-2026-042 · Fekete Péter. A rendelés állapota: Lezárva.
            </p>
          </div>
          <div className="space-y-3 p-3">
            <p className="text-[13px] text-ink-secondary">
              A megrendelés ki van fizetve. Átadod a megrendelőnek?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <FakeButton variant="secondary">Mégse</FakeButton>
              <FakeButton variant="primary">Átadás</FakeButton>
            </div>
          </div>
        </div>

        <div className="mx-auto w-[200px] shrink-0 rounded-md border border-border bg-surface px-3 py-3 text-[11px] leading-snug text-ink shadow-sm">
          <p className="text-center text-[12px] font-semibold">
            Átvételi elismervény
          </p>
          <p className="mt-1 text-center text-[10px] text-ink-muted">
            Vevői példány
          </p>
          <div className="mt-2.5 space-y-1 border-t border-dashed border-border pt-2">
            <p>
              <span className="text-ink-muted">Megrendelés:</span> O-2026-042
            </p>
            <p>
              <span className="text-ink-muted">Ügyfél:</span> Fekete Péter
            </p>
            <p className="mt-1.5">EGGER W980 ST2 · 6 db</p>
            <p>Élzáró: 12,40 m</p>
          </div>
          <p className="mt-2.5 text-[9.5px] leading-snug text-ink-muted">
            Az áru csak ennek az elismervénynek a bemutatásával adható ki.
          </p>
          <div className="mt-3 border-t border-dashed border-border pt-2">
            <p className="text-[10px] text-ink-muted">Ügyfél aláírása:</p>
            <div className="mt-1 h-5 border-b border-border" />
          </div>
          <div className="mt-2">
            <StatusBadge tone={quoteStatusTone('finished')}>
              {QUOTE_STATUS_LABEL.finished}
            </StatusBadge>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
