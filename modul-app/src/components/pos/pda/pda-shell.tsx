'use client'

import { cn } from '@/lib/utils'
import { usePdaViewport } from '@/hooks/use-pda-viewport'

type Props = {
  children: React.ReactNode
  className?: string
}

/**
 * PDA fullscreen shell: fixed visual viewport height, no page scroll,
 * safe-area padding. Children use flex column + inner scroll.
 */
export function PdaShell({ children, className }: Props) {
  const { standalone } = usePdaViewport()

  return (
    <div
      data-pda-shell
      data-standalone={standalone ? 'true' : 'false'}
      className={cn(
        'pda-shell fixed inset-x-0 z-10 flex flex-col overflow-hidden bg-app',
        'top-[var(--pda-vv-top,0px)] h-[var(--pda-vv-height,100dvh)]',
        'pt-[env(safe-area-inset-top,0px)]',
        standalone && 'pda-shell--standalone',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PdaScroll({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  )
}
