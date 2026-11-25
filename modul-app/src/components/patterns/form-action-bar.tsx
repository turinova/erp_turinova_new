'use client'

import { useEffect, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type FormActionBarProps = {
  /** Bal oldal: összesítő / hiányzó adatok. */
  summary?: ReactNode
  /** Jobb oldal: gombok, a primary utolsó (jobb szélen). */
  children: ReactNode
  /** Ctrl/⌘+Enter → ez fut (általában a primary mentés). */
  onSubmitShortcut?: () => void
  className?: string
}

/** Űrlap alsó, rögzített akciósávja — a Mentés mindig itt van (docs/03 §7). */
export function FormActionBar({
  summary,
  children,
  onSubmitShortcut,
  className
}: FormActionBarProps) {
  useEffect(() => {
    if (!onSubmitShortcut) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onSubmitShortcut?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSubmitShortcut])

  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-1 border-t border-border bg-canvas/95 px-1 py-2.5 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-body text-ink-secondary">{summary}</div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {children}
        </div>
      </div>
    </div>
  )
}
