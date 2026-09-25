'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import {
  CATALOG_END_ID,
  CATALOG_TOOLBAR_ID,
  CHIP,
  CHIP_IDLE,
  CHIP_ON
} from '@/components/storefront/catalog-ui'
import { STOREFRONT_FOOTER_ID } from '@/components/storefront/storefront-scroll'
import { buttonVariants } from '@/components/ui/button'
import type { CatalogFacet } from '@/lib/storefront/catalog'
import {
  CATALOG_PARAM,
  CATALOG_SORTS,
  catalogHref,
  parsePriceParam,
  type CatalogParams,
  type CatalogSort
} from '@/lib/storefront/catalog-params'
import { cn } from '@/lib/utils'

const OPEN_EVENT = 'bolt:szurok'
const COUNT_DEBOUNCE_MS = 250

function openFilters() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function FilterChip({ activeCount }: { activeCount: number }) {
  return (
    <button
      type="button"
      onClick={openFilters}
      aria-haspopup="dialog"
      className={cn(CHIP, activeCount > 0 ? CHIP_ON : CHIP_IDLE)}
    >
      <SlidersHorizontal className="size-4" aria-hidden />
      Szűrés
      {activeCount > 0 ? (
        <span className="tabular-nums">
          {activeCount}
          <span className="sr-only"> aktív szűrő</span>
        </span>
      ) : null}
    </button>
  )
}

/** Natív select a chip alatt: mobilon a rendszer-választó nyílik. */
export function SortChip({
  base,
  params,
  sort,
  options,
  className
}: {
  base: string
  params: CatalogParams
  sort: CatalogSort
  options: CatalogSort[]
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const current = CATALOG_SORTS.find((s) => s.value === sort)?.label ?? 'Ajánlott'
  return (
    <label className={cn(CHIP, CHIP_IDLE, 'relative', pending && 'opacity-70', className)}>
      <ArrowUpDown className="size-4" aria-hidden />
      <span className="sr-only">Rendezés: </span>
      {current}
      <ChevronDown className="size-4 text-ink-secondary" aria-hidden />
      <select
        value={sort}
        onChange={(e) => {
          const v = e.target.value as CatalogSort
          startTransition(() =>
            router.push(
              catalogHref(base, params, {
                [CATALOG_PARAM.sort]: v === 'ajanlott' ? undefined : v
              })
            )
          )
        }}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {CATALOG_SORTS.filter((s) => options.includes(s.value)).map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}

type LiveResult = {
  total: number
  facets: CatalogFacet[]
  priceBounds: { min: number; max: number } | null
}

function filterKeys(facets: CatalogFacet[]): string[] {
  return [
    ...facets.map((f) => f.param),
    CATALOG_PARAM.inStock,
    CATALOG_PARAM.priceMin,
    CATALOG_PARAM.priceMax
  ]
}

const huInt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })

export function CatalogFilterSheet({
  categorySlug,
  base,
  params,
  facets,
  sort,
  sortOptions,
  total,
  priceBounds,
  activeCount
}: {
  categorySlug: string
  base: string
  params: CatalogParams
  facets: CatalogFacet[]
  sort: CatalogSort
  sortOptions: CatalogSort[]
  total: number
  priceBounds: { min: number; max: number } | null
  activeCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CatalogParams>({})
  const [live, setLive] = useState<LiveResult | null>(null)
  const [loading, setLoading] = useState(false)
  const pushedRef = useRef(false)

  const keys = filterKeys(facets)

  const start = useCallback(() => {
    const d: CatalogParams = { [CATALOG_PARAM.sort]: sort === 'ajanlott' ? undefined : sort }
    for (const k of filterKeys(facets)) d[k] = params[k]
    setDraft(d)
    setLive(null)
    setOpen(true)
    window.history.pushState({ ...window.history.state, boltSzurok: true }, '')
    pushedRef.current = true
  }, [facets, params, sort])

  useEffect(() => {
    const onOpen = () => start()
    const onPop = () => {
      if (!pushedRef.current) return
      pushedRef.current = false
      setOpen(false)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen)
      window.removeEventListener('popstate', onPop)
    }
  }, [start])

  const dismiss = () => {
    if (pushedRef.current) {
      window.history.back()
    } else {
      setOpen(false)
    }
  }

  const draftQuery = (() => {
    const qs = new URLSearchParams({ k: categorySlug })
    for (const k of keys) {
      const v = draft[k]
      if (v) qs.set(k, v)
    }
    return qs.toString()
  })()

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/storefront/category-count?${draftQuery}`, {
          signal: ctrl.signal
        })
        if (res.ok) setLive((await res.json()) as LiveResult)
      } catch {
        /* megszakítva */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, COUNT_DEBOUNCE_MS)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [open, draftQuery])

  const shownFacets = live?.facets ?? facets
  const shownTotal = live?.total ?? total
  const bounds = live?.priceBounds ?? priceBounds
  const set = (k: string, v: string | undefined) => setDraft((d) => ({ ...d, [k]: v }))
  const draftActive = keys.filter((k) => Boolean(draft[k])).length

  const apply = () => {
    const patch: CatalogParams = { [CATALOG_PARAM.sort]: draft[CATALOG_PARAM.sort] }
    for (const k of keys) patch[k] = draft[k]
    const href = catalogHref(base, params, patch)
    pushedRef.current = false
    setOpen(false)
    router.replace(href)
  }

  return (
    <>
      <FloatingFilterPill activeCount={activeCount} onOpen={start} />
      <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? start() : dismiss())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[92svh] flex-col rounded-t-xl bg-white shadow-lg outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[400px] sm:rounded-none"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 pl-4 pr-1.5">
              <DialogPrimitive.Title className="text-[16px] font-semibold text-ink">
                Szűrés és rendezés
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100"
                aria-label="Bezárás"
              >
                <X className="size-5" aria-hidden />
              </DialogPrimitive.Close>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4">
              <fieldset>
                <legend className="mb-2 text-[14px] font-semibold text-ink">Rendezés</legend>
                <div className="divide-y divide-stone-100 rounded-md border border-stone-200">
                  {CATALOG_SORTS.filter((s) => sortOptions.includes(s.value)).map((s) => {
                    const checked = (draft[CATALOG_PARAM.sort] ?? 'ajanlott') === s.value
                    return (
                      <label
                        key={s.value}
                        className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-[15px] text-ink"
                      >
                        {s.label}
                        <input
                          type="radio"
                          name="rendezes"
                          value={s.value}
                          checked={checked}
                          onChange={() =>
                            set(CATALOG_PARAM.sort, s.value === 'ajanlott' ? undefined : s.value)
                          }
                          className="size-5 cursor-pointer accent-ink"
                        />
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-stone-200 px-3 text-[15px] text-ink">
                Csak raktáron lévők
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft[CATALOG_PARAM.inStock] === '1'}
                  onChange={(e) => set(CATALOG_PARAM.inStock, e.target.checked ? '1' : undefined)}
                  className="size-5 cursor-pointer accent-ink"
                />
              </label>

              {shownFacets.map((f) => (
                <fieldset key={f.param}>
                  <legend className="mb-2 text-[14px] font-semibold text-ink">{f.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {f.values.map((v) => {
                      const on = draft[f.param] === v.value
                      const empty = v.count === 0 && !on
                      return (
                        <button
                          key={v.value}
                          type="button"
                          aria-pressed={on}
                          disabled={empty}
                          onClick={() => set(f.param, on ? undefined : v.value)}
                          className={cn(
                            CHIP,
                            'tabular-nums',
                            on ? CHIP_ON : CHIP_IDLE,
                            empty && 'cursor-not-allowed border-stone-200 text-ink-muted hover:border-stone-200'
                          )}
                        >
                          {on ? <Check className="size-4" aria-hidden /> : null}
                          {v.label}
                          <span className={on ? 'text-white/80' : 'text-ink-secondary'}>
                            {v.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ))}

              <fieldset>
                <legend className="mb-2 text-[14px] font-semibold text-ink">Ár (Ft)</legend>
                <div className="grid grid-cols-2 gap-3">
                  <PriceInput
                    id="szuro-ar-tol"
                    label="Legalább"
                    value={draft[CATALOG_PARAM.priceMin]}
                    hint={bounds ? huInt.format(bounds.min) : undefined}
                    onChange={(v) => set(CATALOG_PARAM.priceMin, v)}
                  />
                  <PriceInput
                    id="szuro-ar-ig"
                    label="Legfeljebb"
                    value={draft[CATALOG_PARAM.priceMax]}
                    hint={bounds ? huInt.format(bounds.max) : undefined}
                    onChange={(v) => set(CATALOG_PARAM.priceMax, v)}
                  />
                </div>
              </fieldset>
            </div>

            <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t border-stone-200 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
              <button
                type="button"
                disabled={draftActive === 0}
                onClick={() =>
                  setDraft((d) => {
                    const next = { ...d }
                    for (const k of keys) next[k] = undefined
                    return next
                  })
                }
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'h-12 px-4 text-[15px]')}
              >
                Törlés
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={shownTotal === 0}
                className={cn(buttonVariants({ size: 'lg' }), 'h-12 text-[15px] font-semibold')}
              >
                <span aria-live="polite" className={cn('tabular-nums', loading && 'opacity-70')}>
                  {shownTotal === 0 ? 'Nincs ilyen termék' : `${shownTotal} termék mutatása`}
                </span>
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

function PriceInput({
  id,
  label,
  value,
  hint,
  onChange
}: {
  id: string
  label: string
  value: string | undefined
  hint?: string
  onChange: (v: string | undefined) => void
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[13px] text-ink-secondary">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value ?? ''}
        placeholder={hint}
        onChange={(e) => {
          const n = parsePriceParam(e.target.value)
          onChange(n == null ? undefined : String(n))
        }}
        className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-[16px] tabular-nums text-ink outline-none placeholder:text-ink-muted focus-visible:border-ink focus-visible:ring-1 focus-visible:ring-ink"
      />
    </div>
  )
}

/** Csak mobilon: ha az eszközsor kigördült, és a lista vége / lábléc még nem látszik. */
function FloatingFilterPill({
  activeCount,
  onOpen
}: {
  activeCount: number
  onOpen: () => void
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const toolbar = document.getElementById(CATALOG_TOOLBAR_ID)
    if (!toolbar) return
    const state = { toolbarAbove: false, endVisible: false }
    const sync = () => setShow(state.toolbarAbove && !state.endVisible)
    const toolbarObs = new IntersectionObserver(([e]) => {
      if (!e) return
      state.toolbarAbove = !e.isIntersecting && e.boundingClientRect.top < 0
      sync()
    })
    toolbarObs.observe(toolbar)
    const ends = [CATALOG_END_ID, STOREFRONT_FOOTER_ID]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    const visible = new Set<Element>()
    const endObs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target)
        else visible.delete(e.target)
      }
      state.endVisible = visible.size > 0
      sync()
    })
    for (const el of ends) endObs.observe(el)
    return () => {
      toolbarObs.disconnect()
      endObs.disconnect()
    }
  }, [])

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-40 flex justify-center transition-[opacity,transform] duration-200 motion-reduce:transition-none lg:hidden',
        'bottom-[max(env(safe-area-inset-bottom),16px)]',
        show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
      aria-hidden={!show}
    >
      <button
        type="button"
        onClick={onOpen}
        tabIndex={show ? 0 : -1}
        className={cn(
          'inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white shadow-lg',
          show && 'pointer-events-auto'
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Szűrés és rendezés
        {activeCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[12px] font-semibold tabular-nums text-ink">
            {activeCount}
            <span className="sr-only"> aktív szűrő</span>
          </span>
        ) : null}
      </button>
    </div>
  )
}
