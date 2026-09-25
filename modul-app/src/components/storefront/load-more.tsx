'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { CATALOG_END_ID } from '@/components/storefront/catalog-ui'
import { CATALOG_PAGE_SIZE } from '@/lib/storefront/catalog-params'
import { cn } from '@/lib/utils'

/** Kumulatív „?page=N”: vissza gombbal ugyanott folytatódik a lista. */
export function LoadMore({
  shown,
  total,
  nextHref
}: {
  shown: number
  total: number
  nextHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const pct = total > 0 ? Math.min(100, Math.round((shown / total) * 100)) : 100

  if (!nextHref && shown <= CATALOG_PAGE_SIZE) return <div id={CATALOG_END_ID} />

  return (
    <div id={CATALOG_END_ID} className="mx-auto flex max-w-[360px] flex-col items-center gap-3 pt-8">
      <p className="text-[13px] tabular-nums text-ink-secondary" aria-live="polite">
        {shown} / {total} termék
      </p>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-stone-200" aria-hidden>
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      {nextHref ? (
        <a
          href={nextHref}
          rel="next"
          aria-busy={pending || undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
            e.preventDefault()
            if (pending) return
            startTransition(() => router.push(nextHref, { scroll: false }))
          }}
          className={cn(
            'mt-1 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-white text-[15px] font-medium text-ink hover:border-ink',
            pending && 'pointer-events-none opacity-70'
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? 'Betöltés…' : 'Továbbiak betöltése'}
        </a>
      ) : null}
    </div>
  )
}
