'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

export const STOREFRONT_FOOTER_ID = 'bolt-lablec'

const REVEAL_AFTER_PX = 120
const DELTA_PX = 8

/** Mobilon lefelé görgetve elbújik, felfelé visszajön; desktopon mindig látszik. */
export function HideOnScrollHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (Math.abs(y - last) < DELTA_PX) return
        setHidden(y > last && y > REVEAL_AFTER_PX)
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <header
      data-hidden={hidden || undefined}
      className={cn(
        'sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-sm transition-transform duration-200 motion-reduce:transition-none lg:translate-y-0',
        hidden && '-translate-y-full'
      )}
    >
      {children}
    </header>
  )
}

/** Lábléc-csoport: mobilon összecsukható, desktopon (lg) mindig nyitott. */
export function FooterGroup({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <details
      {...(desktop ? { open: true } : {})}
      className="group border-b border-stone-200 lg:border-0"
    >
      <summary
        id={id}
        className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-ink lg:pointer-events-none lg:min-h-0 lg:pb-2 [&::-webkit-details-marker]:hidden"
        tabIndex={desktop ? -1 : undefined}
      >
        {title}
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-ink-secondary transition-transform group-open:rotate-180 motion-reduce:transition-none lg:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pb-4 lg:pb-0">{children}</div>
    </details>
  )
}

/**
 * Horgony (#id) navigációkor a céltól felfelé minden `<details>`-t kinyit,
 * és a cél maga is kinyílik, ha `<details>`.
 */
export function DetailsHashOpener() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      const el = document.getElementById(id)
      if (!el) return
      let node: HTMLElement | null = el
      while (node) {
        if (node instanceof HTMLDetailsElement) node.open = true
        node = node.parentElement
      }
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a[href^="#"]')
      if (a) requestAnimationFrame(open)
    }
    open()
    window.addEventListener('hashchange', open)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', open)
      document.removeEventListener('click', onClick)
    }
  }, [])
  return null
}
