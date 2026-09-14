'use client'

import { Check, ChevronDown } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'

import { cn } from '@/lib/utils'

export type MenuSelectOption = {
  value: string
  label: string
  /** Halk másodlagos szöveg a label mellett (pl. vastagság) — nem külön oszlop */
  hint?: string
  /** Csoportfej (pl. gyártó) */
  group?: string
}

type MenuSelectProps = {
  id?: string
  value: string
  options: MenuSelectOption[]
  placeholder?: string
  emptyLabel?: string
  /** false = nincs „Nincs” sor (kötelező választás, pl. anyag) */
  allowEmpty?: boolean
  disabled?: boolean
  className?: string
  onChange: (value: string) => void
}

/**
 * Stylolt lista-select — Linear/Midday sűrűség:
 * egy sor, egy hangsúly; halk csoport; check csak selectednél.
 */
export function MenuSelect({
  id,
  value,
  options,
  placeholder = 'Válassz…',
  emptyLabel = 'Nincs',
  allowEmpty = true,
  disabled = false,
  className,
  onChange
}: MenuSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const flatItems = useMemo(() => {
    const items: Array<
      | { type: 'group'; label: string }
      | { type: 'option'; option: MenuSelectOption; index: number }
    > = []
    let index = 0
    let lastGroup: string | undefined
    for (const option of options) {
      if (option.group && option.group !== lastGroup) {
        items.push({ type: 'group', label: option.group })
        lastGroup = option.group
      }
      items.push({ type: 'option', option, index })
      index += 1
    }
    return items
  }, [options])

  const selected = options.find((o) => o.value === value) ?? null

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const idx = options.findIndex((o) => o.value === value)
    setHighlight(idx >= 0 ? idx : 0)
  }, [open, options, value])

  function selectValue(next: string) {
    onChange(next)
    setOpen(false)
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(options.length - 1, h + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[highlight]
      if (opt) selectValue(opt.value)
    }
  }

  const triggerText = selected
    ? selected.hint
      ? `${selected.label} · ${selected.hint}`
      : selected.label
    : placeholder

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 text-left text-body text-ink transition-colors duration-fast',
          'hover:border-border-strong',
          'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-disabled',
          open && 'border-border-strong ring-1 ring-primary/25'
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-normal',
            !selected && 'text-ink-muted'
          )}
        >
          {triggerText}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-ink-muted transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            options[highlight]
              ? `${listId}-opt-${options[highlight].value}`
              : undefined
          }
          onKeyDown={onListKeyDown}
          className="absolute z-40 mt-1 max-h-56 w-full min-w-[12rem] overflow-auto rounded-md border border-border bg-surface py-1 shadow-elev2"
        >
          {allowEmpty ? (
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              className={cn(
                'flex min-h-8 w-full items-center px-2.5 text-left text-body font-normal text-ink-secondary',
                'hover:bg-subtle',
                value === '' && 'bg-subtle text-ink'
              )}
              onClick={() => selectValue('')}
            >
              {emptyLabel}
            </button>
          ) : null}

          {flatItems.map((item, i) => {
            if (item.type === 'group') {
              return (
                <div
                  key={`g-${item.label}-${i}`}
                  className="px-2.5 pb-0.5 pt-2 text-hint font-normal text-ink-muted"
                >
                  {item.label}
                </div>
              )
            }

            const { option, index } = item
            const isSelected = option.value === value
            const isHi = index === highlight

            return (
              <button
                key={option.value}
                type="button"
                id={`${listId}-opt-${option.value}`}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'flex min-h-8 w-full items-center gap-2 px-2.5 text-left text-body font-normal',
                  'hover:bg-subtle',
                  isHi && !isSelected && 'bg-subtle',
                  isSelected && 'bg-subtle'
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => selectValue(option.value)}
              >
                <span className="min-w-0 flex-1 truncate text-ink">
                  {option.label}
                  {option.hint ? (
                    <span className="text-ink-muted"> · {option.hint}</span>
                  ) : null}
                </span>
                {isSelected ? (
                  <Check
                    className="size-3.5 shrink-0 text-ink"
                    aria-hidden
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
