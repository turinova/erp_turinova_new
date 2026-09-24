'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Delete } from 'lucide-react'

type Props = {
  value: number
  onChange: (next: number) => void
  className?: string
}

/** Érintő készpénz számbillentyűzet (Ft egész). */
export function PosCashNumpad({ value, onChange, className }: Props) {
  function appendDigit(d: string) {
    const cur = String(Math.max(0, Math.round(value) || 0))
    const next = cur === '0' ? d : `${cur}${d}`
    const n = Number(next)
    if (!Number.isFinite(n) || next.length > 9) return
    onChange(n)
  }

  function backspace() {
    const cur = String(Math.max(0, Math.round(value) || 0))
    if (cur.length <= 1) {
      onChange(0)
      return
    }
    onChange(Number(cur.slice(0, -1)) || 0)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {keys.map((k) => (
        <Button
          key={k}
          type="button"
          variant="secondary"
          className="h-14 text-[18px] font-semibold tabular-nums"
          aria-label={k === '⌫' ? 'Törlés' : k}
          onClick={() => {
            if (k === '⌫') backspace()
            else if (k === '00') {
              appendDigit('0')
              appendDigit('0')
            } else appendDigit(k)
          }}
        >
          {k === '⌫' ? <Delete className="size-5" aria-hidden /> : k}
        </Button>
      ))}
    </div>
  )
}
