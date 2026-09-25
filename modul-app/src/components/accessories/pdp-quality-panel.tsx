'use client'

import { Check, CircleAlert } from 'lucide-react'

import type { PdpQuality } from '@/lib/webshop/pdp-quality'

export function PdpQualityPanel({ result }: { result: PdpQuality }) {
  return (
    <div className="col-span-full rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2.5 py-2">
        <p className="text-label font-semibold text-ink">
          Termékoldal-minőség{' '}
          <span className="font-normal tabular-nums text-ink-secondary">{result.score}/100</span>
        </p>
        <p className="text-hint text-ink-secondary">
          {result.checks.length - result.failing.length}/{result.checks.length} rendben
        </p>
      </div>
      {result.failing.length === 0 ? (
        <p className="flex items-center gap-1.5 px-2.5 py-2 text-hint text-ink-secondary">
          <Check className="size-3.5 text-success-ink" aria-hidden />
          Minden megvan, amit a vásárló a döntéshez keres.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {result.failing.map((c) => (
            <li key={c.id} className="flex gap-2 px-2.5 py-2">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning-ink" aria-hidden />
              <div className="min-w-0">
                <p className="text-hint font-medium text-ink">
                  {c.label}
                  <span className="ml-1.5 font-normal text-ink-secondary">hiányzik</span>
                </p>
                <p className="text-hint text-ink-secondary">{c.fix}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
