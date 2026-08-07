"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { MobileNavPanel, MenuIcon } from "@/components/site/nav/MobileNavOverlay"
import { LocaleSwitch } from "@/components/site/nav/LocaleSwitch"
import { NavChevron } from "@/components/site/nav/NavChevron"
import { ServicesDropdown } from "@/components/site/nav/ServicesDropdown"
import { COMPANY } from "@/lib/company"
import { HEADER_CTA, NAV_ITEMS, type NavItem } from "@/lib/nav-data"

function hasChildren(
  item: NavItem,
): item is NavItem & {
  children: readonly { href: string; label: string }[]
} {
  return "children" in item && Array.isArray(item.children) && item.children.length > 0
}

function getScrollY() {
  return window.__lenis?.scroll ?? window.scrollY ?? 0
}

/**
 * Floating glass pill nav (Kriss form × Notion behavior).
 * No flip labels, no hide-on-scroll — fast, AI-forward chrome.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const locale: "hu" | "en" | "de" = pathname?.startsWith("/en")
    ? "en"
    : pathname?.startsWith("/de")
      ? "de"
      : "hu"
  const isHome = pathname === "/" || pathname === "/en" || pathname === "/de"
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const servicesCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const openServices = useCallback(() => {
    if (servicesCloseTimer.current) {
      clearTimeout(servicesCloseTimer.current)
      servicesCloseTimer.current = null
    }
    setServicesOpen(true)
  }, [])
  const closeServices = useCallback(() => {
    if (servicesCloseTimer.current) clearTimeout(servicesCloseTimer.current)
    servicesCloseTimer.current = setTimeout(() => {
      setServicesOpen(false)
      servicesCloseTimer.current = null
    }, 200)
  }, [])

  useEffect(() => {
    return () => {
      if (servicesCloseTimer.current) clearTimeout(servicesCloseTimer.current)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => {
      setScrolled(getScrollY() > 24)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })

    let unsub: (() => void) | undefined
    const attachLenis = () => {
      const lenis = window.__lenis
      if (!lenis || unsub) return
      const result = lenis.on("scroll", onScroll) as void | (() => void)
      if (typeof result === "function") unsub = result
    }
    attachLenis()
    const poll = window.setInterval(attachLenis, 200)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearInterval(poll)
      unsub?.()
    }
  }, [])

  const servicesActive =
    pathname?.startsWith("/szolgaltatasok") ||
    pathname?.startsWith("/en/services") ||
    pathname?.startsWith("/de/services")

  const ctaLabel =
    locale === "hu" ? HEADER_CTA.label : locale === "de" ? HEADER_CTA.labelDe : HEADER_CTA.labelEn

  const homeHref = locale === "en" ? "/en" : locale === "de" ? "/de" : "/"
  const contactHref =
    locale === "en" ? "/en/contact" : locale === "de" ? "/de/contact" : HEADER_CTA.href

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && href !== "/en" && href !== "/de" && pathname?.startsWith(href))

  return (
    <header
      className={[
        "site-header site-header--float",
        isHome ? "site-header--home" : "",
        scrolled || menuOpen ? "site-header--scrolled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="header-float-shell relative">
        <div className="header-logo-slot">
          <button
            type="button"
            className="header-burger md:hidden"
            aria-expanded={menuOpen}
            aria-label={locale === "hu" ? "Menü" : "Menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon open={menuOpen} />
          </button>

          <Link
            href={homeHref}
            className="header-logo-link"
            aria-label={`${COMPANY.brand} főoldal`}
            onClick={closeMenu}
          >
            <Image
              src="/img/logo.svg"
              alt={COMPANY.brand}
              width={180}
              height={58}
              className="header-logo-img"
              style={{ width: "auto" }}
              priority
            />
          </Link>
        </div>

        <div className="header-glass-pill hidden md:flex">
          <nav
            className="header-pill-nav"
            aria-label={locale === "hu" ? "Fő navigáció" : "Main navigation"}
          >
            {NAV_ITEMS.map((item) => {
              if (hasChildren(item)) {
                return (
                  <div
                    key={item.href}
                    className="header-pill-item"
                    onMouseEnter={openServices}
                    onMouseLeave={closeServices}
                  >
                    <button
                      type="button"
                      aria-expanded={servicesOpen}
                      aria-haspopup="menu"
                      className={`header-pill-link ${
                        servicesOpen || servicesActive ? "is-active" : ""
                      }`}
                      onMouseEnter={openServices}
                      onFocus={openServices}
                      onClick={() => {
                        const hoverFine =
                          typeof window !== "undefined" &&
                          window.matchMedia("(hover: hover) and (pointer: fine)")
                            .matches
                        if (hoverFine) {
                          setServicesOpen(true)
                          return
                        }
                        setServicesOpen((v) => !v)
                      }}
                    >
                      {item.label}
                      <NavChevron open={servicesOpen} />
                    </button>
                    <ServicesDropdown
                      open={servicesOpen}
                      onOpenChange={setServicesOpen}
                      align="left"
                    />
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`header-pill-link ${isActive(item.href) ? "is-active" : ""}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <LocaleSwitch locale={locale} className="header-pill-locale" />

          <Link href={contactHref} className="header-pill-cta">
            {ctaLabel}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <MobileNavPanel open={menuOpen} onClose={closeMenu} locale={locale} />
      </div>
    </header>
  )
}
