 "use client"

import Link from "next/link"
import Image from "next/image"
import { LINKS } from "@/lib/links"
import { NAV_ITEMS } from "./nav"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"

type NavChild = { href: string; label: string }
type NavItem = { href: string; label: string; children?: readonly NavChild[] }

function hasChildren(item: NavItem): item is NavItem & { children: readonly NavChild[] } {
  return Array.isArray(item.children) && item.children.length > 0
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 text-sm font-semibold tracking-tight"
          aria-label="Hírös-Ablak"
        >
          <Image
            src="/img/hiros_logo.png"
            alt="Hírös-Ablak"
            width={180}
            height={44}
            priority
            className="h-9 w-auto md:h-10"
            sizes="(max-width: 768px) 140px, 180px"
          />
          <span className="sr-only">Hírös-Ablak</span>
        </Link>

        <div className="flex items-center justify-between gap-3 md:hidden">
          <OpeningHoursPill />
          <a
            href={LINKS.onlineOrdering}
            className="inline-flex rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-brand-contrast)] hover:brightness-95"
            target="_blank"
            rel="noreferrer"
          >
            Online árajánlat
          </a>
        </div>

        <nav className="hidden items-center gap-5 text-[15px] text-black/80 md:flex">
          {(NAV_ITEMS as readonly NavItem[]).map((item) => {
            if (!hasChildren(item)) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-1 py-1 hover:text-black"
                >
                  {item.label}
                </Link>
              )
            }

            const key = item.href
            const menuId = `menu-${key.replaceAll("/", "-")}`

            return (
              <div key={item.href} className="relative group">
                <Link
                  aria-haspopup="menu"
                  aria-controls={menuId}
                  className="inline-flex items-center gap-1 rounded-md px-1 py-1 hover:text-black"
                  href={item.href}
                >
                  {item.label}
                  <span className="text-xs text-black/50">
                    ▾
                  </span>
                </Link>

                <div
                  id={menuId}
                  role="menu"
                  className="invisible absolute left-0 top-full z-50 mt-2 w-72 translate-y-1 rounded-xl border border-black/10 bg-white p-2 opacity-0 shadow-sm transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
                >
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block rounded-lg px-3 py-2 text-sm text-black/80 hover:bg-black/[0.04] hover:text-black"
                      role="menuitem"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <div className="hidden items-center gap-3 lg:flex">
            <OpeningHoursPill />
          </div>
          <a
            href={LINKS.onlineOrdering}
            className="hidden rounded-full border border-black/15 bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-brand-contrast)] hover:brightness-95 md:inline-flex"
            target="_blank"
            rel="noreferrer"
          >
            Online árajánlat
          </a>
        </div>
      </div>
    </header>
  )
}

