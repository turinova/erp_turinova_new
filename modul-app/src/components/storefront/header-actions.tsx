'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Menu, ShoppingBag, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { cartCount, useCart } from '@/lib/storefront/cart'
import { categoryPath, STOREFRONT_CART, STOREFRONT_HOME } from '@/lib/storefront/url'

const iconBtn =
  'relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-stone-100'

export function CartButton() {
  const count = cartCount(useCart())
  return (
    <Link
      href={STOREFRONT_CART}
      className={iconBtn}
      aria-label={count > 0 ? `Kosár, ${count} termék` : 'Kosár'}
    >
      <ShoppingBag className="size-[18px]" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute right-1 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold tabular-nums text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}

export type MenuCategory = {
  id: string
  name: string
  slug: string
  parentId: string | null
  productCount: number
}

const row =
  'flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] text-ink hover:bg-stone-50'

export function CategoryMenu({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState<MenuCategory[]>([])

  const visible = categories.filter((c) => c.productCount > 0)
  const current = path[path.length - 1] ?? null
  const level = visible.filter((c) => c.parentId === (current?.id ?? null))
  const hasChildren = (id: string) => visible.some((c) => c.parentId === id)

  if (visible.length === 0) return null

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setPath([])
      }}
    >
      <DialogPrimitive.Trigger className={`${iconBtn} -ml-2 lg:hidden`} aria-label="Kategóriák">
        <Menu className="size-5" aria-hidden />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-stone-200 px-2">
            {current ? (
              <button
                type="button"
                onClick={() => setPath((p) => p.slice(0, -1))}
                className={iconBtn}
                aria-label="Vissza"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
            ) : null}
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate px-2 text-[16px] font-semibold text-ink">
              {current ? current.name : 'Kategóriák'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Válassz kategóriát
            </DialogPrimitive.Description>
            <DialogPrimitive.Close className={iconBtn} aria-label="Menü bezárása">
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <li>
              <DialogPrimitive.Close asChild>
                <Link
                  href={current ? categoryPath(current.slug) : STOREFRONT_HOME}
                  className={`${row} font-medium`}
                >
                  <span className="flex-1">
                    {current ? `Összes: ${current.name}` : 'Összes kategória'}
                  </span>
                  {current ? (
                    <span className="text-[13px] tabular-nums text-ink-muted">
                      {current.productCount}
                    </span>
                  ) : null}
                </Link>
              </DialogPrimitive.Close>
            </li>
            {level.map((c) => (
              <li key={c.id}>
                {hasChildren(c.id) ? (
                  <button type="button" onClick={() => setPath((p) => [...p, c])} className={row}>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-[13px] tabular-nums text-ink-muted">{c.productCount}</span>
                    <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                  </button>
                ) : (
                  <DialogPrimitive.Close asChild>
                    <Link href={categoryPath(c.slug)} className={row}>
                      <span className="flex-1">{c.name}</span>
                      <span className="text-[13px] tabular-nums text-ink-muted">{c.productCount}</span>
                    </Link>
                  </DialogPrimitive.Close>
                )}
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
