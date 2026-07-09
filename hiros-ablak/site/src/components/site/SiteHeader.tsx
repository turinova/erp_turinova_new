"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { LINKS } from "@/lib/links"
import { NAV_ITEMS } from "./nav"
import { OpeningHoursPill } from "@/components/site/OpeningHoursPill"

type NavChild = { href: string; label: string }
type NavItem = { href: string; label: string; children?: readonly NavChild[] }

function hasChildren(item: NavItem): item is NavItem & { children: readonly NavChild[] } {
  return Array.isArray(item.children) && item.children.length > 0
}

const externalLinkProps = { target: "_blank" as const, rel: "noreferrer" as const }

function OnlineQuoteLinks({
  onNavigate,
  layout,
}: {
  onNavigate?: () => void
  layout: "drawer" | "dropdown"
}) {
  if (layout === "drawer") {
    return (
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">Online árajánlat</p>
        <a
          href={LINKS.login}
          {...externalLinkProps}
          onClick={onNavigate}
          className="flex w-full items-center justify-center rounded-full border border-black/15 bg-white px-4 py-3 text-sm font-semibold text-black/85 hover:bg-black/[0.04]"
        >
          Bejelentkezés
        </a>
        <a
          href={LINKS.register}
          {...externalLinkProps}
          onClick={onNavigate}
          className="flex w-full items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
        >
          Regisztráció
        </a>
      </div>
    )
  }

  return (
    <div className="relative group">
      <button
        type="button"
        aria-haspopup="menu"
        aria-controls="online-quote-menu"
        className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-brand-contrast)] hover:brightness-95"
      >
        Online árajánlat
        <span className="text-xs opacity-80" aria-hidden>
          ▾
        </span>
      </button>
      <div
        id="online-quote-menu"
        role="menu"
        className="invisible absolute right-0 top-full z-50 mt-2 w-52 translate-y-1 rounded-xl border border-black/10 bg-white p-2 opacity-0 shadow-sm transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <a
          href={LINKS.login}
          {...externalLinkProps}
          role="menuitem"
          className="block rounded-lg px-3 py-2.5 text-sm font-medium text-black/80 hover:bg-black/[0.04] hover:text-black"
        >
          Bejelentkezés
        </a>
        <a
          href={LINKS.register}
          {...externalLinkProps}
          role="menuitem"
          className="block rounded-lg px-3 py-2.5 text-sm font-medium text-black/80 hover:bg-black/[0.04] hover:text-black"
        >
          Regisztráció
        </a>
      </div>
    </div>
  )
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  )
}

function MobileNavDrawer({
  open,
  onClose,
  panelId,
}: {
  open: boolean
  onClose: () => void
  panelId: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open || !mounted) return null

  const drawer = (
    <div className="fixed inset-0 z-[110] md:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Menü bezárása"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Főmenü"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <span className="text-sm font-semibold text-black/90">Menü</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-black/70 hover:bg-black/[0.05] hover:text-black"
            aria-label="Menü bezárása"
          >
            <MenuIcon open />
          </button>
        </div>

        <div className="border-b border-black/10 px-4 py-3">
          <OpeningHoursPill />
        </div>

        <nav
          className="flex-1 overflow-y-auto px-2 py-2"
          aria-label="Mobil navigáció"
        >
          <ul className="grid gap-0.5">
            {(NAV_ITEMS as readonly NavItem[]).map((item) => {
              if (!hasChildren(item)) {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="block rounded-xl px-3 py-3 text-[15px] font-medium text-black/85 hover:bg-black/[0.04] hover:text-black"
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              }

              return (
                <li key={item.href}>
                  <details className="group rounded-xl">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-3 text-[15px] font-medium text-black/85 hover:bg-black/[0.04] [&::-webkit-details-marker]:hidden">
                      <span>{item.label}</span>
                      <span
                        aria-hidden
                        className="text-xs text-black/45 transition-transform group-open:rotate-180"
                      >
                        ▾
                      </span>
                    </summary>
                    <ul className="mb-2 ml-1 grid gap-0.5 border-l border-black/10 pl-3">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onClose}
                            className="block rounded-lg px-3 py-2.5 text-sm text-black/75 hover:bg-black/[0.04] hover:text-black"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-black/10 p-4">
          <OnlineQuoteLinks layout="drawer" onNavigate={onClose} />
        </div>
      </div>
    </div>
  )

  return createPortal(drawer, document.body)
}

export function SiteHeader() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const panelId = useId().replace(/:/g, "")

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {/* Mobile: menu + logo + CTA */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-black/10 px-3 text-sm font-medium text-black/80 hover:bg-black/[0.04]"
            aria-expanded={menuOpen}
            aria-controls={panelId}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MenuIcon open={menuOpen} />
            <span>Menü</span>
          </button>

          <Link
            href="/"
            className="min-w-0 flex-1"
            aria-label="Hírös-Ablak főoldal"
            onClick={closeMenu}
          >
            <Image
              src="/img/hiros_logo.png"
              alt="Hírös-Ablak"
              width={180}
              height={44}
              priority
              className="h-9 w-auto max-w-[140px]"
              sizes="140px"
            />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex shrink-0 rounded-full bg-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 sm:px-4 sm:text-sm"
          >
            Árajánlat
          </button>
        </div>

        <MobileNavDrawer
          open={menuOpen}
          onClose={closeMenu}
          panelId={panelId}
        />

        {/* Desktop */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
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
              className="h-10 w-auto"
              sizes="180px"
            />
            <span className="sr-only">Hírös-Ablak</span>
          </Link>

          <nav
            className="flex items-center gap-5 text-[15px] text-black/80"
            aria-label="Fő navigáció"
          >
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

              const menuId = `menu-${item.href.replaceAll("/", "-")}`

              return (
                <div key={item.href} className="relative group">
                  <Link
                    aria-haspopup="menu"
                    aria-controls={menuId}
                    className="inline-flex items-center gap-1 rounded-md px-1 py-1 hover:text-black"
                    href={item.href}
                  >
                    {item.label}
                    <span className="text-xs text-black/50">▾</span>
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

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 lg:flex">
              <OpeningHoursPill />
            </div>
            <OnlineQuoteLinks layout="dropdown" />
          </div>
        </div>
      </div>
    </header>
  )
}
