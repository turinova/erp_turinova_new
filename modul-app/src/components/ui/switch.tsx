'use client'

import { cn } from '@/lib/utils'

type SwitchProps = {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description?: string
}

export function Switch({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  description
}: SwitchProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-fast',
          checked
            ? 'border-primary bg-primary'
            : 'border-border bg-subtle',
          disabled && 'opacity-50'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-elev1 transition-transform duration-fast',
            checked && 'translate-x-4'
          )}
        />
      </button>
      <div className="min-w-0">
        <label htmlFor={id} className="text-label text-ink cursor-pointer">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-hint text-ink-secondary">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
