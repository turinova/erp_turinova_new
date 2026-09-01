"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { TRIAL_DAYS_DEFAULT } from "@/lib/billing/plans";
import { COMPANY } from "@/lib/company";
import { appAuthHref, appPathHref } from "@/lib/hosts";

const DEMO_MAIL = `mailto:${COMPANY.emails.support}?subject=${encodeURIComponent("ProGate demo")}`;

const PLATFORM_CAPABILITIES = [
  {
    href: "#hogyan",
    title: "Self-serve rendelés",
    body: "A partner a boltodon rendel saját áron és készlettel.",
  },
  {
    href: "#demo",
    title: "Gyors rendelés widget",
    body: "Excel, szöveg, fotó, cikkszám — percek alatt kosár.",
  },
  {
    href: "#portal",
    title: "Merchant portál",
    body: "Árazás, csoportok, vevők és riport egy helyen.",
  },
  {
    href: "#csomag",
    title: "Shoprenter-natív",
    body: "Script a sablonba — a kosár a meglévő bolté.",
  },
] as const;

const PLATFORM_MODULES = [
  {
    href: "#portal",
    title: "Partnerár-motor",
    body: "Fix, sáv, csoport % — tömeges szerkesztés.",
  },
  {
    href: "#portal",
    title: "Automatizmus",
    body: "Szintlépés költés vagy rendelésszám alapján.",
  },
  {
    href: "#portal",
    title: "Vevők és riport",
    body: "Partnerek, forgalom, widget vs. bolti mix.",
  },
  {
    href: appPathHref("/tudasbazis"),
    title: "Tudásbázis",
    body: "Összekötés, script, szinkron — lépésről lépésre.",
  },
] as const;

const AUDIENCE = [
  { href: "#hogyan", title: "Nagyker / viszonteladó", body: "Ismétlődő B2B rendelés a webshopon." },
  { href: "#hogyan", title: "Shoprenter boltok", body: "API + snippet — külön B2B shop nélkül." },
  { href: "#csomag", title: "Gyártók és disztribútorok", body: "Partnerár és gyors lista egy rétegben." },
] as const;

const RESOURCES = [
  { href: "#gyik", title: "GYIK", body: "Gyakori kérdések a ProGate-ről." },
  { href: appPathHref("/tudasbazis"), title: "Segítség", body: "Telepítés, szinkron, widget." },
  { href: "/aszf", title: "ÁSZF", body: "Szerződéses feltételek." },
  { href: DEMO_MAIL, title: "Demo egyeztetés", body: "Írj a info@turinova.hu címre." },
] as const;

type MegaKey = "platform" | "audience" | "resources" | null;

export function ProGateLandingNav() {
  const [fixed, setFixed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mega, setMega] = useState<MegaKey>(null);

  useEffect(() => {
    const onScroll = () => {
      setFixed(window.scrollY > 48);
    };
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

  return (
    <header
      id="pg-header"
      className={`pg-nav${fixed ? " pg-nav--fixed" : ""}${mobileOpen ? " pg-nav--mobile-open" : ""}`}
    >
      <div className="pg-nav-inner">
        <a href="#top" className="pg-nav-logo" aria-label="ProGate" onClick={closeMobile}>
          <TurinovaWordmark height={fixed ? 32 : 36} />
        </a>

        <nav
          className="pg-nav-desktop"
          aria-label="Főmenü"
          onMouseLeave={() => setMega(null)}
        >
          <ul className="pg-nav-list">
            <li
              className="pg-nav-item pg-nav-item--mega"
              onMouseEnter={() => setMega("platform")}
            >
              <a
                href="#hogyan"
                className="pg-nav-link"
                aria-expanded={mega === "platform"}
              >
                <span>Termék</span>
                <Chevron />
              </a>
              <div
                className={`pg-mega${mega === "platform" ? " pg-mega--open" : ""}`}
                role="region"
                aria-label="Termék"
              >
                <div className="pg-mega-grid">
                  <div className="pg-mega-col pg-mega-col--hero">
                    <span className="pg-mega-h">Áttekintés</span>
                    <a href="#hogyan" className="pg-mega-hero">
                      <span className="pg-mega-hero-art" aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="pg-mega-hero-t">B2B réteg a boltodon</span>
                      <span className="pg-mega-hero-s">
                        Partnerár, gyors rendelés és merchant portál a meglévő
                        Shoprenter webshopra — külön B2B shop nélkül.
                      </span>
                    </a>
                  </div>
                  <div className="pg-mega-col">
                    <span className="pg-mega-h">Képességek</span>
                    {PLATFORM_CAPABILITIES.map((item) => (
                      <a key={item.title} href={item.href} className="pg-mega-item">
                        <span className="pg-mega-item-t">{item.title}</span>
                        <span className="pg-mega-item-s">{item.body}</span>
                      </a>
                    ))}
                  </div>
                  <div className="pg-mega-col">
                    <span className="pg-mega-h">Modulok</span>
                    {PLATFORM_MODULES.map((item) => (
                      <a key={item.title} href={item.href} className="pg-mega-item">
                        <span className="pg-mega-item-t">{item.title}</span>
                        <span className="pg-mega-item-s">{item.body}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </li>

            <li
              className="pg-nav-item pg-nav-item--mega"
              onMouseEnter={() => setMega("audience")}
            >
              <a href="#hogyan" className="pg-nav-link" aria-expanded={mega === "audience"}>
                <span>Kiknek</span>
                <Chevron />
              </a>
              <div
                className={`pg-mega pg-mega--sm${mega === "audience" ? " pg-mega--open" : ""}`}
                role="region"
                aria-label="Kiknek"
              >
                <div className="pg-mega-grid pg-mega-grid--2">
                  <div className="pg-mega-col">
                    <span className="pg-mega-h">Célcsoport</span>
                    {AUDIENCE.map((item) => (
                      <a key={item.title} href={item.href} className="pg-mega-item">
                        <span className="pg-mega-item-t">{item.title}</span>
                        <span className="pg-mega-item-s">{item.body}</span>
                      </a>
                    ))}
                  </div>
                  <div className="pg-mega-col pg-mega-col--cta">
                    <span className="pg-mega-h">Következő lépés</span>
                    <p className="pg-mega-blurb">
                      {TRIAL_DAYS_DEFAULT} nap próba kártya nélkül, magyar support.
                    </p>
                    <Link href={appAuthHref("/signup")} className="pg-nav-btn pg-nav-btn--solid">
                      Ingyen kipróbálom →
                    </Link>
                    <a href={DEMO_MAIL} className="pg-mega-text-link">
                      Demo egyeztetés →
                    </a>
                  </div>
                </div>
              </div>
            </li>

            <li className="pg-nav-item" onMouseEnter={() => setMega(null)}>
              <a href="#csomag" className="pg-nav-link">
                Csomagok
              </a>
            </li>

            <li
              className="pg-nav-item pg-nav-item--mega"
              onMouseEnter={() => setMega("resources")}
            >
              <a href="#gyik" className="pg-nav-link" aria-expanded={mega === "resources"}>
                <span>Segítség</span>
                <Chevron />
              </a>
              <div
                className={`pg-mega pg-mega--sm${mega === "resources" ? " pg-mega--open" : ""}`}
                role="region"
                aria-label="Segítség"
              >
                <div className="pg-mega-grid pg-mega-grid--1">
                  <div className="pg-mega-col">
                    <span className="pg-mega-h">Források</span>
                    {RESOURCES.map((item) => (
                      <a key={item.title} href={item.href} className="pg-mega-item">
                        <span className="pg-mega-item-t">{item.title}</span>
                        <span className="pg-mega-item-s">{item.body}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </nav>

        <div className="pg-nav-actions">
          <Link href={appAuthHref("/signup")} className="pg-nav-btn pg-nav-btn--ghost hide-narrow">
            Ingyen kipróbálom <em>→</em>
          </Link>
          <Link href={appAuthHref("/login")} className="pg-nav-btn pg-nav-btn--border hide-narrow">
            Belépés <em>→</em>
          </Link>
          <a href={DEMO_MAIL} className="pg-nav-btn pg-nav-btn--demo">
            Demo
          </a>
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
          <p className="pg-mnav-label">Termék</p>
          <a href="#hogyan" onClick={closeMobile}>
            Hogyan működik
          </a>
          <a href="#demo" onClick={closeMobile}>
            Demó
          </a>
          <a href="#portal" onClick={closeMobile}>
            Portál
          </a>
          <a href="#csomag" onClick={closeMobile}>
            Csomagok
          </a>
          <a href="#gyik" onClick={closeMobile}>
            GYIK
          </a>
          <a href={appPathHref("/tudasbazis")} onClick={closeMobile}>
            Tudásbázis
          </a>
          <div className="pg-mnav-cta">
            <Link href={appAuthHref("/signup")} className="pg-nav-btn pg-nav-btn--solid" onClick={closeMobile}>
              {TRIAL_DAYS_DEFAULT} nap próba →
            </Link>
            <Link href={appAuthHref("/login")} className="pg-nav-btn pg-nav-btn--border-dark" onClick={closeMobile}>
              Belépés
            </Link>
            <a href={DEMO_MAIL} className="pg-nav-btn pg-nav-btn--demo" onClick={closeMobile}>
              Demo egyeztetés
            </a>
          </div>
        </div>
        <div className="pg-mnav-bar" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </header>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
