'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MenuSelect,
  type MenuSelectOption
} from '@/components/ui/menu-select'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'

type Props = {
  id?: string
  value: string
  /** SSR / kiválasztott anyag — mindig a listában marad. */
  seed?: OptiSheetMaterialOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  selectClassName?: string
  portal?: boolean
  onChange: (
    sheetId: string,
    sheet: OptiSheetMaterialOption | null
  ) => void
}

const DEBOUNCE_MS = 200

function sheetHint(m: OptiSheetMaterialOption): string | undefined {
  const parts = [
    m.machine_code.trim() || null,
    `${m.thickness_mm} mm`
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

async function fetchSheets(q: string): Promise<OptiSheetMaterialOption[]> {
  const sp = new URLSearchParams()
  if (q.trim()) sp.set('q', q.trim())
  sp.set('limit', '40')
  const res = await fetch(`/api/opti/sheet-materials?${sp.toString()}`, {
    credentials: 'same-origin'
  })
  const data = (await res.json()) as {
    rows?: OptiSheetMaterialOption[]
    error?: string
  }
  if (!res.ok) throw new Error(data.error || 'Keresés sikertelen.')
  return data.rows ?? []
}

export function SheetMaterialMenuSelect({
  id,
  value,
  seed = [],
  placeholder = 'Válassz anyagot…',
  disabled = false,
  className,
  selectClassName,
  portal = true,
  onChange
}: Props) {
  const [rows, setRows] = useState<OptiSheetMaterialOption[]>(seed)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef(new Map<string, OptiSheetMaterialOption>())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqRef = useRef(0)

  useEffect(() => {
    for (const m of seed) cacheRef.current.set(m.id, m)
  }, [seed])

  useEffect(() => {
    if (!value) return
    if (cacheRef.current.has(value)) return
    const hit = seed.find((m) => m.id === value)
    if (hit) cacheRef.current.set(hit.id, hit)
  }, [value, seed])

  const runSearch = useCallback(async (q: string) => {
    const req = ++reqRef.current
    setLoading(true)
    setError(null)
    try {
      const next = await fetchSheets(q)
      if (req !== reqRef.current) return
      for (const m of next) cacheRef.current.set(m.id, m)
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
    const byId = new Map<string, OptiSheetMaterialOption>()
    for (const m of rows) byId.set(m.id, m)
    if (value) {
      const selected =
        cacheRef.current.get(value) ?? seed.find((m) => m.id === value)
      if (selected) byId.set(selected.id, selected)
    }
    return [...byId.values()].map((m) => ({
      value: m.id,
      label: m.name,
      hint: sheetHint(m),
      group: m.manufacturer_name
    }))
  }, [rows, value, seed])

  return (
    <div className={className}>
      <MenuSelect
        id={id}
        value={value}
        options={options}
        placeholder={placeholder}
        allowEmpty={false}
        disabled={disabled}
        portal={portal}
        searchable
        filterLocally={false}
        loading={loading}
        searchPlaceholder="Keresés név / gépkód…"
        className={selectClassName}
        onQueryChange={onQueryChange}
        onChange={(idNext) => {
          if (!idNext) {
            onChange('', null)
            return
          }
          const m =
            cacheRef.current.get(idNext) ??
            rows.find((x) => x.id === idNext) ??
            seed.find((x) => x.id === idNext) ??
            null
          onChange(idNext, m)
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
