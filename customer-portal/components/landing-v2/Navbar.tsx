'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LANDING_V2_DEMO } from '@/components/landing-v2/landing-v2-nav'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const ctaClass =
    'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors'

  return (
    <header
      className={[
        'sticky top-0 z-50 w-full transition-all duration-200',
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200'
          : 'bg-white border-b border-slate-100',
      ].join(' ')}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/images/turinova-logo.png"
              alt="Turinova"
              style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
            />
          </Link>

          <div className="hidden sm:flex items-center">
            <a href={LANDING_V2_DEMO.href} className={ctaClass}>
              {LANDING_V2_DEMO.label}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
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
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-4">
          <a
            href={LANDING_V2_DEMO.href}
            onClick={() => setMobileOpen(false)}
            className={`${ctaClass} w-full justify-center`}
          >
            {LANDING_V2_DEMO.label}
          </a>
        </div>
      )}
    </header>
  )
}
