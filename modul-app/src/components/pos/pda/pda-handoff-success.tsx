'use client'

import { Button } from '@/components/ui/button'

type Props = {
  code: string
  onNewCart: () => void
  onHub: () => void
}

/** Certainty screen after PDA → pult handoff. */
export function PdaHandoffSuccess({ code, onNewCart, onHub }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <p className="text-center text-[15px] font-medium text-ink-secondary">
        Átadva a pultra
      </p>
      <p className="text-center text-[48px] font-semibold tabular-nums tracking-tight text-ink">
        {code}
      </p>
      <p className="max-w-xs text-center text-body text-ink-muted">
        Menj a pulthoz — ott átveszik ezzel a kóddal.
      </p>
      <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
        <Button type="button" className="h-14 text-[15px]" onClick={onNewCart}>
          Új kosár
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12"
          onClick={onHub}
        >
          Vissza a kezdőlapra
        </Button>
      </div>
    </div>
  )
}
