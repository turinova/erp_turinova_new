"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { TRIAL_DAYS_DEFAULT } from "@/lib/billing/plans";
import { COMPANY } from "@/lib/company";
import { appAuthHref, marketingHomeHref } from "@/lib/hosts";

/**
 * Flat marketing nav — one product, three jumps, one CTA.
 * Shoprenter pitch: clean, not a suite mega-menu.
 */

type NavItem =
  | { label: string; kind: "section"; hash: string }
  | { label: string; kind: "route"; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Hogyan", kind: "section", hash: "#demo" },
  { label: "Kiknek", kind: "section", hash: "#kiknek" },
  { label: "Árak", kind: "section", hash: "#csomag" },
];

export function ProGateLandingNav() {
  const pathname = usePathname() || "/";
  const onHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Light chrome on inner pages; on home only after scroll (over dark hero). */
  const fixed = !onHome || scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);
  const home = marketingHomeHref();

  const items = NAV_ITEMS.map((item) => {
    if (item.kind === "route") {
      return { label: item.label, href: item.href, isRoute: true as const };
    }
    return {
      label: item.label,
      href: onHome ? item.hash : `/${item.hash}`,
      isRoute: false as const,
    };
  });

  return (
    <header
      id="pg-header"
      className={`pg-nav${fixed ? " pg-nav--fixed" : ""}${mobileOpen ? " pg-nav--mobile-open" : ""}`}
    >
      <div className="pg-nav-inner">
        <Link
          href={home}
          className="pg-nav-logo"
          aria-label="ProGate"
          onClick={closeMobile}
        >
          <TurinovaWordmark height={fixed ? 32 : 36} />
        </Link>

        <nav className="pg-nav-desktop" aria-label="Főmenü">
          <ul className="pg-nav-list">
            {items.map((item) => (
              <li key={item.label} className="pg-nav-item">
                {item.isRoute ? (
                  <Link href={item.href} className="pg-nav-link">
                    {item.label}
                  </Link>
                ) : (
                  <a href={item.href} className="pg-nav-link">
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="pg-nav-actions">
          <Link href={appAuthHref("/login")} className="pg-nav-link-quiet hide-narrow">
            Belépés
          </Link>
          <Link href={appAuthHref("/signup")} className="pg-nav-btn pg-nav-btn--solid">
            {TRIAL_DAYS_DEFAULT} nap próba
          </Link>
          <button
            type="button"
            className="pg-nav-burger"
            aria-label={mobileOpen ? "Menü bezárása" : "Menü megnyitása"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className={`pg-mnav${mobileOpen ? " pg-mnav--open" : ""}`} aria-hidden={!mobileOpen}>
        <div className="pg-mnav-head">
          <TurinovaWordmark height={32} />
          <button type="button" className="pg-mnav-close" aria-label="Bezárás" onClick={closeMobile}>
            ×
          </button>
        </div>
        <div className="pg-mnav-body">
          {items.map((item) =>
            item.isRoute ? (
              <Link key={item.label} href={item.href} onClick={closeMobile}>
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} onClick={closeMobile}>
                {item.label}
              </a>
            ),
          )}
          <div className="pg-mnav-cta">
            <Link
              href={appAuthHref("/signup")}
              className="pg-nav-btn pg-nav-btn--solid"
              onClick={closeMobile}
            >
              {TRIAL_DAYS_DEFAULT} nap próba →
            </Link>
            <Link
              href={appAuthHref("/login")}
              className="pg-nav-btn pg-nav-btn--border-dark"
              onClick={closeMobile}
            >
              Belépés
            </Link>
            <a
              href={`mailto:${COMPANY.emails.support}`}
              className="pg-mnav-mail"
              onClick={closeMobile}
            >
              {COMPANY.emails.support}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
