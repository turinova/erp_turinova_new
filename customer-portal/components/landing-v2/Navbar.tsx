'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { FUNKCIOK_MENU } from '@/components/landing-v2/funkciok-menu-data'
import { LANDING_V2_NAV, LANDING_V2_NAV_ANCHORS_AFTER_FUNKCIOK, LANDING_V2_DEMO } from '@/components/landing-v2/landing-v2-nav'

const anchorNavLinks = LANDING_V2_NAV_ANCHORS_AFTER_FUNKCIOK

const navLinkClass =
  'px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const [mobileFunkciokOpen, setMobileFunkciokOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const openMega = useCallback(() => {
    clearCloseTimer()
    setMegaOpen(true)
  }, [clearCloseTimer])

  const closeMegaDelayed = useCallback(() => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setMegaOpen(false), 180)
  }, [clearCloseTimer])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!megaOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMegaOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [megaOpen])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  return (
    <header
      className={[
        'sticky top-0 z-50 w-full transition-all duration-200 overflow-visible',
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200'
          : 'bg-white border-b border-slate-100',
      ].join(' ')}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link href="/v2" className="flex items-center gap-2">
              <img
                src="/images/turinova-logo.png"
                alt="Turinova"
                style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Fő navigáció">
            <Link href={LANDING_V2_NAV[0].href} className={navLinkClass}>
              {LANDING_V2_NAV[0].label}
            </Link>

            <div className="relative" onMouseEnter={openMega} onMouseLeave={closeMegaDelayed}>
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
                aria-expanded={megaOpen}
                aria-haspopup="true"
                onClick={() => setMegaOpen(o => !o)}
              >
                Funkciók
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${megaOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {megaOpen && (
                <div
                  className="fixed inset-x-0 top-16 z-40 border-b border-slate-200 bg-white shadow-xl shadow-slate-200/40"
                  onMouseEnter={openMega}
                  onMouseLeave={closeMegaDelayed}
                >
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                      {FUNKCIOK_MENU.map(section => (
                        <div key={section.id}>
                          <p className="text-xs font-bold uppercase tracking-wider text-orange-600">{section.title}</p>
                          <p className="mt-1 text-xs text-slate-500 leading-snug">{section.tagline}</p>
                          <ul className="mt-4 space-y-1">
                            {section.items.map(item => (
                              <li key={item.slug}>
                                <Link
                                  href={`/v2/funkciok/${item.slug}`}
                                  className="group block rounded-lg px-2 py-2 -mx-2 hover:bg-slate-50 transition-colors"
                                  onClick={() => setMegaOpen(false)}
                                >
                                  <span className="text-sm font-medium text-slate-800 group-hover:text-orange-700">
                                    {item.label}
                                  </span>
                                  <span className="block text-xs text-slate-500 leading-snug mt-0.5">{item.description}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href="/v2/funkciok"
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                        onClick={() => setMegaOpen(false)}
                      >
                        Összes funkció egy oldalon →
                      </Link>
                      <Link
                        href="/v2#funkciok"
                        className="text-sm text-slate-500 hover:text-slate-800"
                        onClick={() => setMegaOpen(false)}
                      >
                        Ugrás a landing szekcióhoz
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {anchorNavLinks.map(link => (
              <a key={link.label} href={link.href} className={navLinkClass}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href={LANDING_V2_DEMO.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors duration-150 shadow-sm shadow-orange-200"
            >
              {LANDING_V2_DEMO.label}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Menü bezárása' : 'Menü megnyitása'}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white max-h-[min(85vh,calc(100dvh-4rem))] overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col gap-1">
            <Link
              href={LANDING_V2_NAV[0].href}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-50"
            >
              {LANDING_V2_NAV[0].label}
            </Link>

            <button
              type="button"
              onClick={() => setMobileFunkciokOpen(v => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-50"
              aria-expanded={mobileFunkciokOpen}
            >
              Funkciók
              <svg
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${mobileFunkciokOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {mobileFunkciokOpen && (
              <div className="pl-2 pb-2 space-y-4 border-b border-slate-100 mb-2">
                {FUNKCIOK_MENU.map(section => (
                  <div key={section.id}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600 px-3">{section.title}</p>
                    <p className="text-[11px] text-slate-500 px-3 mt-0.5">{section.tagline}</p>
                    <ul className="mt-2 space-y-0.5">
                      {section.items.map(item => (
                        <li key={item.slug}>
                          <Link
                            href={`/v2/funkciok/${item.slug}`}
                            onClick={() => {
                              setMobileOpen(false)
                              setMobileFunkciokOpen(false)
                            }}
                            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className="font-medium">{item.label}</span>
                            <span className="block text-xs text-slate-500 mt-0.5">{item.description}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Link
                  href="/v2/funkciok"
                  onClick={() => {
                    setMobileOpen(false)
                    setMobileFunkciokOpen(false)
                  }}
                  className="block px-3 py-2 text-sm font-medium text-orange-600"
                >
                  Összes funkció egy oldalon →
                </Link>
              </div>
            )}

            {anchorNavLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50"
              >
                {link.label}
              </a>
            ))}

            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
              <a
                href={LANDING_V2_DEMO.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 text-center shadow-sm shadow-orange-200"
              >
                {LANDING_V2_DEMO.label} →
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
