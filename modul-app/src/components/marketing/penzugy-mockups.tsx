import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Statikus marketing mock: Számlázz.hu integráció jelzés.
 * Nagy logo, nincs hamis számla-papír / form. Nincs scroll, nincs interaktivitás.
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
      {children}
    </div>
  )
}

export function PenzugySzamlaMockup({ className }: { className?: string }) {
  return (
    <AppFrame
      path="turinova.hu/penzugy"
      className={className}
    >
      <div
        className="pointer-events-none flex aspect-[4/3] select-none flex-col items-center justify-center gap-3 bg-surface px-6 py-10 sm:aspect-[16/10]"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketing/szamlazzhu-logo-orange.png"
          alt="számlázz.hu"
          width={220}
          height={190}
          className="h-auto w-[min(100%,14rem)] object-contain sm:w-[16rem]"
        />
        <p className="text-center text-[13px] text-ink-secondary">
          Számlázás a Számlázz.hu-n keresztül
        </p>
      </div>
    </AppFrame>
  )
}
