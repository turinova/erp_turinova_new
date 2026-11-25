'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { HandoverDialog } from '@/components/manual-orders/manual-order-dialogs'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { searchManualOrdersAction } from '@/lib/manual-orders/actions'
import type { MoSearchHit } from '@/lib/manual-orders/queries'
import { MO_STATUS_LABEL, MO_STATUS_TONE } from '@/lib/manual-orders/types'

/** Kereső: „Kézi rendelések” találati csoport + gyors átadás. */
export function ManualOrderSearchHits({ q }: { q: string }) {
  const [hits, setHits] = useState<MoSearchHit[]>([])
  const [handover, setHandover] = useState<MoSearchHit | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      void searchManualOrdersAction(term).then((res) => {
        if (alive && res.ok) setHits(res.hits)
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, tick])

  if (hits.length === 0) return null

  return (
    <section className="mb-4 space-y-1.5" aria-label="Kézi rendelések">
      <h2 className="text-label text-ink-secondary">Kézi rendelések</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {hits.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-body">
            <Link href={`/kezi-rendelesek/${h.id}`} className="min-w-0 flex-1 underline-offset-2 hover:underline">
              <span className="font-medium text-ink">{h.customerName}</span>
              <span className="text-ink-secondary"> · {h.orderNumber}</span>
              {h.customerMobile ? <span className="text-hint text-ink-secondary"> · {h.customerMobile}</span> : null}
            </Link>
            <StatusBadge tone={MO_STATUS_TONE[h.status]}>{MO_STATUS_LABEL[h.status]}</StatusBadge>
            <span className="text-hint text-ink-secondary">
              {h.readyItems.length} átvehető{h.waitingCount > 0 ? ` · ${h.waitingCount} még úton` : ''}
            </span>
            <Button size="sm" disabled={h.readyItems.length === 0} onClick={() => setHandover(h)}>
              Átadás
            </Button>
          </li>
        ))}
      </ul>
      {handover ? (
        <HandoverDialog
          open
          onOpenChange={(o) => !o && setHandover(null)}
          customerName={handover.customerName}
          items={handover.readyItems.map((i) => ({ ...i, ready: true, statusLabel: 'Megjött' }))}
          note={handover.waitingCount > 0 ? `${handover.waitingCount} tétel még nem jött meg.` : null}
          onDone={() => setTick((n) => n + 1)}
        />
      ) : null}
    </section>
  )
}
