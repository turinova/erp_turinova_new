'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MenuSelect,
  type MenuSelectOption
} from '@/components/ui/menu-select'
import type { OptiCustomerOption } from '@/lib/customers/queries'

type Props = {
  id?: string
  value: string
  /** SSR seed / kiválasztott ügyfél — mindig megjelenik a listában. */
  seed?: OptiCustomerOption[]
  placeholder?: string
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
  className?: string
  onChange: (customerId: string, customer: OptiCustomerOption | null) => void
}

const DEBOUNCE_MS = 200

async function fetchCustomers(q: string): Promise<OptiCustomerOption[]> {
  const sp = new URLSearchParams()
  if (q.trim()) sp.set('q', q.trim())
  sp.set('limit', '25')
  const res = await fetch(`/api/customers/search?${sp.toString()}`, {
    credentials: 'same-origin'
  })
  const data = (await res.json()) as {
    rows?: OptiCustomerOption[]
    error?: string
  }
  if (!res.ok) throw new Error(data.error || 'Keresés sikertelen.')
  return data.rows ?? []
}

export function CustomerMenuSelect({
  id,
  value,
  seed = [],
  placeholder = 'Ügyfél keresése…',
  allowEmpty = true,
  emptyLabel = 'Nincs / vendég',
  disabled = false,
  className,
  onChange
}: Props) {
  const [rows, setRows] = useState<OptiCustomerOption[]>(seed)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef(new Map<string, OptiCustomerOption>())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqRef = useRef(0)

  useEffect(() => {
    for (const c of seed) cacheRef.current.set(c.id, c)
  }, [seed])

  useEffect(() => {
    if (!value) return
    if (cacheRef.current.has(value)) return
    const hit = seed.find((c) => c.id === value)
    if (hit) cacheRef.current.set(hit.id, hit)
  }, [value, seed])

  const runSearch = useCallback(async (q: string) => {
    const req = ++reqRef.current
    setLoading(true)
    setError(null)
    try {
      const next = await fetchCustomers(q)
      if (req !== reqRef.current) return
      for (const c of next) cacheRef.current.set(c.id, c)
      setRows(next)
    } catch (err) {
      if (req !== reqRef.current) return
      setError(err instanceof Error ? err.message : 'Keresés sikertelen.')
      setRows([])
    } finally {
      if (req === reqRef.current) setLoading(false)
    }
  }, [])

  const onQueryChange = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void runSearch(q)
      }, DEBOUNCE_MS)
    },
    [runSearch]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const options: MenuSelectOption[] = useMemo(() => {
    const byId = new Map<string, OptiCustomerOption>()
    for (const c of rows) byId.set(c.id, c)
    if (value) {
      const selected =
        cacheRef.current.get(value) ?? seed.find((c) => c.id === value)
      if (selected) byId.set(selected.id, selected)
    }
    return [...byId.values()].map((c) => ({
      value: c.id,
      label: c.name,
      hint:
        [c.billing_name && c.billing_name !== c.name ? c.billing_name : null, c.mobile, c.email]
          .filter(Boolean)
          .join(' · ') || undefined
    }))
  }, [rows, value, seed])

  return (
    <div className={className}>
      <MenuSelect
        id={id}
        value={value}
        options={options}
        placeholder={placeholder}
        allowEmpty={allowEmpty}
        emptyLabel={emptyLabel}
        disabled={disabled}
        searchable
        filterLocally={false}
        loading={loading}
        searchPlaceholder="Név, cég, telefon, email…"
        onQueryChange={onQueryChange}
        onChange={(idNext) => {
          if (!idNext) {
            onChange('', null)
            return
          }
          const c =
            cacheRef.current.get(idNext) ??
            rows.find((x) => x.id === idNext) ??
            seed.find((x) => x.id === idNext) ??
            null
          onChange(idNext, c)
        }}
      />
      {error ? (
        <p className="mt-1 text-hint text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
