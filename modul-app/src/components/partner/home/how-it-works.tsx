import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

const STEPS = [
  {
    key: 'opti',
    color: 'bg-tile-opti',
    title: 'Opti',
    text: 'Add meg a lapokat az Optiban, és mentsd el.',
    linkLabel: 'Opti megnyitása'
  },
  {
    key: 'quotes',
    color: 'bg-tile-quotes',
    title: 'Ajánlataim',
    text: 'Az Ajánlataimnál küldd be a cégnek. Ettől lesz rendelés.',
    linkLabel: 'Ajánlataim'
  },
  {
    key: 'orders',
    color: 'bg-tile-orders',
    title: 'Rendeléseim',
    text: 'A Rendeléseimnél látod, mikor viheted el, és mennyit kell fizetni.',
    linkLabel: 'Rendeléseim'
  }
] as const

export function HowItWorks({
  hrefs,
  defaultOpen
}: {
  hrefs: { opti: string; quotes: string; orders: string }
  /** Új felhasználónál (nincs beküldött rendelés) nyitva. */
  defaultOpen: boolean
}) {
  return (
    <details
      id="hogyan-mukodik"
      open={defaultOpen}
      className="group scroll-mt-20 rounded-lg border border-border bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 text-[17px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Hogyan működik a rendelés?
        <ChevronRight
          className="size-5 text-ink-muted transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <ol className="grid gap-3 border-t border-border px-5 py-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex gap-3">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold text-white',
                step.color
              )}
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-ink">
                <span className="sr-only">{i + 1}. lépés: </span>
                {step.title}
              </p>
              <p className="mt-0.5 text-[15px] text-ink-secondary">
                {step.text}
              </p>
              <Link
                href={hrefs[step.key]}
                className="mt-1.5 inline-flex items-center gap-1 text-[15px] font-medium text-ink no-underline hover:underline"
              >
                {step.linkLabel}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
