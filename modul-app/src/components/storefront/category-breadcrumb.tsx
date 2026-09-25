'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'

import { categoryPath } from '@/lib/storefront/url'

export type CrumbCategory = { id: string; name: string; slug: string; productCount: number }

/**
 * Kattintható morzsamenü. Az utolsó kategória-elem panelt nyit a testvér-kategóriákkal,
 * hogy PDP-ről vagy listáról egy érintéssel lehessen váltani.
 */
export function CategoryBreadcrumb({
  home,
  chain,
  siblings,
  current
}: {
  home: { label: string; href: string }
  chain: CrumbCategory[]
  siblings: CrumbCategory[]
  /** Záró, nem link elem (pl. terméknév) — ha nincs, az utolsó kategória az aktuális. */
  current?: string
}) {
  const last = chain[chain.length - 1]
  const parents = current ? chain : chain.slice(0, -1)
  const switchable = last && siblings.length > 1

  return (
    <nav aria-label="Morzsamenü">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-ink-secondary">
        <li className="inline-flex items-center">
          <Link href={home.href} className="cursor-pointer hover:text-ink hover:underline">
            {home.label}
          </Link>
        </li>
        {parents.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3 shrink-0 text-ink-muted" aria-hidden />
            {c === last && switchable ? (
              <SiblingSheet current={c} siblings={siblings} />
            ) : (
              <Link
                href={categoryPath(c.slug)}
                className="cursor-pointer hover:text-ink hover:underline"
              >
                {c.name}
              </Link>
            )}
          </li>
        ))}
        {!current && last ? (
          <li className="inline-flex items-center gap-1">
            <ChevronRight className="size-3 shrink-0 text-ink-muted" aria-hidden />
            {switchable ? (
              <SiblingSheet current={last} siblings={siblings} ariaCurrent />
            ) : (
              <span aria-current="page" className="text-ink">
                {last.name}
              </span>
            )}
          </li>
        ) : null}
      </ol>
    </nav>
  )
}

/** Mobil morzsamenü: egyetlen „‹ szülő” link a legközelebbi kategóriára. */
export function CategoryBackLink({
  home,
  chain,
  className
}: {
  home: { label: string; href: string }
  chain: CrumbCategory[]
  className?: string
}) {
  const leaf = chain[chain.length - 1]
  return (
    <nav aria-label="Vissza a kategóriához" className={className}>
      <Link
        href={leaf ? categoryPath(leaf.slug) : home.href}
        className="inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1 text-[13px] text-ink-secondary hover:text-ink"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{leaf ? leaf.name : 'Összes kategória'}</span>
      </Link>
    </nav>
  )
}

function SiblingSheet({
  current,
  siblings,
  ariaCurrent = false
}: {
  current: CrumbCategory
  siblings: CrumbCategory[]
  ariaCurrent?: boolean
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        className="inline-flex cursor-pointer items-center gap-0.5 rounded px-0.5 text-ink hover:underline"
        aria-current={ariaCurrent ? 'page' : undefined}
      >
        {current.name}
        <ChevronDown className="size-3.5" aria-hidden />
        <span className="sr-only">— kategória váltása</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-lg bg-white pb-6 shadow-lg sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-24 sm:w-[420px] sm:-translate-x-1/2 sm:rounded-lg">
          <div className="flex h-14 items-center justify-between border-b border-stone-200 px-4">
            <DialogPrimitive.Title className="text-[15px] font-semibold text-ink">
              Kategória váltása
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100"
              aria-label="Bezárás"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Azonos szintű kategóriák listája.
          </DialogPrimitive.Description>
          <ul>
            {siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={categoryPath(s.slug)}
                  aria-current={s.id === current.id ? 'page' : undefined}
                  className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-[15px] text-ink hover:bg-stone-50 aria-[current=page]:font-semibold"
                >
                  <span>{s.name}</span>
                  <span className="text-[13px] tabular-nums text-ink-secondary">
                    {s.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
