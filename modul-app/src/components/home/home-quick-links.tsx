import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

import { findNavLinkByPath } from '@/lib/navigation'

export type HomeQuickLink = { href: string; label: string; navPath: string; tone: string }

/**
 * Fix sorrend — a térbeli megszokás miatt nem rendeződik át magától.
 * Piros tónus szándékosan nincs: hibát / törlést jelez.
 */
export const HOME_QUICK_LINKS: HomeQuickLink[] = [
  { href: '/scanner', label: 'Scanner', navPath: '/scanner', tone: 'bg-sky-700 hover:bg-sky-600 focus-visible:ring-sky-700' },
  { href: '/kereso', label: 'Kereső', navPath: '/kereso', tone: 'bg-indigo-700 hover:bg-indigo-600 focus-visible:ring-indigo-700' },
  { href: '/opti', label: 'Opti', navPath: '/opti', tone: 'bg-orange-700 hover:bg-orange-600 focus-visible:ring-orange-700' },
  { href: '/kezi-rendelesek/uj', label: 'Kézi rendelés', navPath: '/kezi-rendelesek', tone: 'bg-emerald-700 hover:bg-emerald-600 focus-visible:ring-emerald-700' },
  { href: '/torzsadatok/alapanyagok/termekek', label: 'Termékek', navPath: '/torzsadatok/alapanyagok/termekek', tone: 'bg-slate-700 hover:bg-slate-600 focus-visible:ring-slate-700' }
]

export function HomeQuickLinks({ links }: { links: HomeQuickLink[] }) {
  if (links.length === 0) return null
  return (
    <nav aria-label="Gyors elérés" className="mb-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((l) => {
          const Icon = findNavLinkByPath(l.navPath)?.icon
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`group relative flex h-[88px] flex-col justify-between rounded-lg p-3 text-white no-underline shadow-[inset_0_-3px_0_rgb(0_0_0/0.22)] transition-[background-color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0 ${l.tone}`}
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-white/15">
                  {Icon ? <Icon className="size-5 text-white" aria-hidden /> : null}
                </span>
                <ArrowUpRight
                  className="absolute right-2.5 top-2.5 size-4 -translate-x-1 translate-y-1 text-white/0 transition-all duration-150 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-white/80 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0 group-focus-visible:text-white/80 motion-reduce:transition-none"
                  aria-hidden
                />
                <span className="truncate text-body font-semibold leading-tight">{l.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
