'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import type { StorefrontCard } from '@/lib/storefront/catalog'
import { formatFt } from '@/lib/storefront/format'
import { STOREFRONT_SEARCH } from '@/lib/storefront/url'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; items: StorefrontCard[]; total: number }
  | { status: 'error' }

export function StorefrontSearchOverlay() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setState({ status: 'idle' })
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setState({ status: 'loading' })
      try {
        const res = await fetch(
          `/api/storefront/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal }
        )
        const json = (await res.json()) as { items: StorefrontCard[]; total: number }
        setState({ status: 'done', items: json.items ?? [], total: json.total ?? 0 })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState({ status: 'error' })
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q])

  function submit() {
    const term = q.trim()
    if (!term) return
    setOpen(false)
    router.push(`${STOREFRONT_SEARCH}?q=${encodeURIComponent(term)}`)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100"
        aria-label="Keresés a boltban"
      >
        <Search className="size-[18px]" aria-hidden />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 top-0 z-50 flex max-h-dvh flex-col bg-white shadow-lg sm:inset-x-auto sm:left-1/2 sm:top-16 sm:w-[560px] sm:-translate-x-1/2 sm:rounded-lg"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">Keresés a boltban</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Név, cikkszám vagy méret, pl. „fogantyú 160 mm fekete”.
          </DialogPrimitive.Description>
          <form
            role="search"
            className="flex h-14 items-center gap-1 border-b border-stone-200 px-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <DialogPrimitive.Close
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100 sm:hidden"
              aria-label="Vissza"
            >
              <ArrowLeft className="size-[18px]" aria-hidden />
            </DialogPrimitive.Close>
            <label htmlFor="sf-search" className="sr-only">
              Keresés
            </label>
            <input
              ref={inputRef}
              id="sf-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Termék, cikkszám vagy méret"
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[16px] text-ink outline-none placeholder:text-ink-muted"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ('')
                  inputRef.current?.focus()
                }}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-stone-100"
                aria-label="Keresőmező törlése"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
            {state.status === 'idle' ? (
              <p className="px-4 py-6 text-[14px] text-ink-secondary">
                Írj be legalább 2 karaktert. Méretre is kereshetsz, pl. „160 mm”.
              </p>
            ) : state.status === 'loading' ? (
              <p className="px-4 py-6 text-[14px] text-ink-secondary">Keresés…</p>
            ) : state.status === 'error' ? (
              <p className="px-4 py-6 text-[14px] text-ink-secondary">
                Most nem sikerült keresni. Próbáld újra.
              </p>
            ) : state.items.length === 0 ? (
              <p className="px-4 py-6 text-[14px] text-ink-secondary">
                Nincs találat erre: „{q.trim()}”. Próbáld rövidebben, vagy nézd meg a
                kategóriákat.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-stone-100">
                  {state.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`/p/${encodeURIComponent(item.slug)}`}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-stone-50"
                      >
                        <span className="size-12 shrink-0 overflow-hidden rounded bg-stone-100">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="size-full object-contain p-1"
                              loading="lazy"
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[14px] font-medium text-ink">
                            {item.title}
                          </span>
                          <span className="text-[13px] tabular-nums text-ink-secondary">
                            {formatFt(item.priceGross)} ·{' '}
                            {item.inStock ? 'Raktáron' : 'Nincs készleten'}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={submit}
                  className="w-full cursor-pointer border-t border-stone-200 px-4 py-3 text-left text-[14px] font-semibold text-ink hover:bg-stone-50"
                >
                  Összes találat ({state.total})
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
