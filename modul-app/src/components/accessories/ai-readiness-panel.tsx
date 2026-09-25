'use client'

import { Check, CircleAlert, X } from 'lucide-react'

import type { AiReadiness } from '@/lib/webshop/ai-readiness'
import { cn } from '@/lib/utils'

export function AiReadinessPanel({ result }: { result: AiReadiness }) {
  const failing = [...result.blockers, ...result.warnings]
  return (
    <div className="col-span-full rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2.5 py-2">
        <p className="text-label font-semibold text-ink">
          AI-készség{' '}
          <span className="font-normal tabular-nums text-ink-secondary">
            {result.score}/100
          </span>
        </p>
        <p
          className={cn(
            'inline-flex items-center gap-1 text-hint font-medium',
            result.feedEligible ? 'text-success-ink' : 'text-danger-ink'
          )}
        >
          {result.feedEligible ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <X className="size-3.5" aria-hidden />
          )}
          {result.feedEligible
            ? 'Bekerül a Google és ChatGPT feedbe'
            : 'Kimarad a feedekből, amíg a pirosakat nem javítod'}
        </p>
      </div>
      {failing.length === 0 ? (
        <p className="px-2.5 py-2 text-hint text-ink-secondary">
          Minden ellenőrzés rendben — az AI keresők pontosan tudják ajánlani.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {failing.map((c) => (
            <li key={c.id} className="flex gap-2 px-2.5 py-2">
              {c.severity === 'blocker' ? (
                <X className="mt-0.5 size-3.5 shrink-0 text-danger-ink" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning-ink" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-hint font-medium text-ink">
                  {c.label}
                  <span className="ml-1.5 font-normal text-ink-secondary">
                    {c.severity === 'blocker' ? 'kötelező' : 'ajánlott'}
                  </span>
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
