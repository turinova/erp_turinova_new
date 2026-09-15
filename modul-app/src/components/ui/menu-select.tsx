'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
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
  /**
   * Keresőmező a listában — nagy opcióhalmazhoz (termék, díjtípus).
   * Szűr label + hint + group alapján.
   */
  searchable?: boolean
  searchPlaceholder?: string
  onChange: (value: string) => void
}

const MENU_MAX_HEIGHT_PX = 224 // max-h-56

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('hu')
}

/**
 * Stylolt lista-select — Linear/Midday sűrűség:
 * egy sor, egy hangsúly; halk csoport; check csak selectednél.
 * Viewport alján automatikusan felfelé nyílik.
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
  searchable = false,
  searchPlaceholder = 'Keresés…',
  onChange
}: MenuSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const [query, setQuery] = useState('')

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = normalizeSearch(query.trim())
    return options.filter((option) => {
      const haystack = normalizeSearch(
        [option.label, option.hint, option.group].filter(Boolean).join(' ')
      )
      return haystack.includes(q)
    })
  }, [options, query, searchable])

  const flatItems = useMemo(() => {
    const items: Array<
      | { type: 'group'; label: string }
      | { type: 'option'; option: MenuSelectOption; index: number }
    > = []
    let index = 0
    let lastGroup: string | undefined
    for (const option of filteredOptions) {
      if (option.group && option.group !== lastGroup) {
        items.push({ type: 'group', label: option.group })
        lastGroup = option.group
      }
      items.push({ type: 'option', option, index })
      index += 1
    }
    return items
  }, [filteredOptions])

  const selected = options.find((o) => o.value === value) ?? null

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const next =
      spaceBelow < MENU_MAX_HEIGHT_PX + (searchable ? 40 : 0) &&
      spaceAbove > spaceBelow
        ? 'top'
        : 'bottom'
    setPlacement(next)
  }, [open, filteredOptions.length, searchable])

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
    if (!open) {
      setQuery('')
      return
    }
    const idx = filteredOptions.findIndex((o) => o.value === value)
    setHighlight(idx >= 0 ? idx : 0)
    if (searchable) {
      // Nyitás után fókusz a keresőre — azonnali gépelés.
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open, searchable]) // eslint-disable-line react-hooks/exhaustive-deps -- csak nyitáskor

  useEffect(() => {
    if (!open) return
    const idx = filteredOptions.findIndex((o) => o.value === value)
    setHighlight(idx >= 0 ? idx : 0)
  }, [filteredOptions, open, value])

  function selectValue(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
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
      setHighlight((h) => Math.min(filteredOptions.length - 1, h + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filteredOptions[highlight]
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
          tabIndex={searchable ? undefined : -1}
          aria-activedescendant={
            filteredOptions[highlight]
              ? `${listId}-opt-${filteredOptions[highlight].value}`
              : undefined
          }
          onKeyDown={searchable ? undefined : onListKeyDown}
          className={cn(
            'absolute z-50 w-full min-w-[12rem] overflow-hidden rounded-md border border-border bg-surface shadow-elev2',
            placement === 'top'
              ? 'bottom-full mb-1'
              : 'top-full mt-1'
          )}
        >
          {searchable ? (
            <div className="border-b border-border p-1.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                  className={cn(
                    'flex h-8 w-full rounded-md border border-border bg-surface py-0 pl-7 pr-2.5 text-body text-ink',
                    'placeholder:text-ink-disabled',
                    'outline-none focus:border-border-strong focus:ring-1 focus:ring-primary/25'
                  )}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onListKeyDown}
                />
              </div>
            </div>
          ) : null}

          <div className="max-h-56 overflow-auto py-1">
            {allowEmpty && !query.trim() ? (
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

            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-2 text-body text-ink-muted">
                Nincs találat
              </p>
            ) : (
              flatItems.map((item, i) => {
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
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
