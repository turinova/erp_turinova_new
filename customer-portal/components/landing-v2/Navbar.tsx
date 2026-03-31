'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const navLinks = [
  { label: 'Funkciók', href: '#features' },
  { label: 'Integrációk', href: '#integrations' },
  { label: 'Árazás', href: '#pricing' },
  { label: 'GYIK', href: '#faq' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/v2" className="flex items-center gap-2">
              <img
                src="/images/turinova-logo.png"
                alt="Turinova"
                style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
            >
              Bejelentkezés
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors duration-150 shadow-sm shadow-orange-200"
            >
              Demo foglalása
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
            aria-label="Menü megnyitása"
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col gap-1">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 text-center border border-slate-200 transition-colors duration-150"
              >
                Bejelentkezés
              </Link>
              <a
                href="#demo"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 text-center transition-colors duration-150 shadow-sm shadow-orange-200"
              >
                Demo foglalása →
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
