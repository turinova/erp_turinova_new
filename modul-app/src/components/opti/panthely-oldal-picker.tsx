'use client'

import { useRef } from 'react'

import type { PanthelyOldal } from '@/lib/opti/panel-draft'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{
  value: PanthelyOldal
  label: string
  squareLabel: string
}> = [
  { value: 'hosszu', label: 'Hosszú', squareLabel: 'Szálirány' },
  { value: 'rovid', label: 'Rövid', squareLabel: 'Kereszt' }
]

type PanthelyOldalPickerProps = {
  value: PanthelyOldal
  /** Négyzetes panel: a szálirány dönt, nem a hossz. */
  square?: boolean
  disabled?: boolean
  onChange: (value: PanthelyOldal) => void
  /** Enter = panel mentése, mint a többi beviteli mezőn. */
  onEnter?: () => void
}

export function PanthelyOldalPicker({
  value,
  square = false,
  disabled,
  onChange,
  onEnter
}: PanthelyOldalPickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) return
      e.preventDefault()
      onEnter?.()
      return
    }
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown'
    ) {
      e.preventDefault()
      const next = (index + 1) % OPTIONS.length
      onChange(OPTIONS[next].value)
      refs.current[next]?.focus()
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pánthely oldal"
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-md border border-border bg-subtle p-0.5',
        disabled && 'opacity-50'
      )}
    >
      {OPTIONS.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'h-full rounded px-2.5 text-label transition-colors duration-fast ease-flat',
              checked
                ? 'bg-surface font-medium text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink',
              disabled && 'cursor-not-allowed'
            )}
          >
            {square ? option.squareLabel : option.label}
          </button>
        )
      })}
    </div>
  )
}
