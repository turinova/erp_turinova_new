'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'

import type { Mode } from '@core/types'
import { MARKETING_COMPANY_LINKS, MARKETING_SOLUTIONS, MARKETING_TOP_LINKS } from './marketing-nav-data'

type Props = {
  mode: Mode
  variant: 'desktop' | 'mobile'
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
}

function useOnRouteChange(cb: () => void) {
  const pathname = usePathname()
  const cbRef = useRef(cb)
  cbRef.current = cb

  useEffect(() => {
    cbRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
}

export default function MarketingNav({ variant, isDrawerOpen, setIsDrawerOpen }: Props) {
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isDesktop = !isBelowLgScreen

  // Desktop mega menu state
  const [megaOpen, setMegaOpen] = useState(false)
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
    closeTimer.current = setTimeout(() => setMegaOpen(false), 140)
  }, [clearCloseTimer])

  useEffect(() => {
    if (!megaOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMegaOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [megaOpen])

  // Mobile drawer state (accordions)
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(true)
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false)

  // Close drawer on route changes (mobile)
  useOnRouteChange(() => {
    setIsDrawerOpen(false)
  })

  // If we’re desktop, keep drawer closed
  useEffect(() => {
    if (isDesktop && isDrawerOpen) setIsDrawerOpen(false)
  }, [isDesktop, isDrawerOpen, setIsDrawerOpen])

  const desktopLinks = useMemo(() => MARKETING_TOP_LINKS, [])

  if (variant === 'desktop') {
    // Only render on desktop layout branch
    if (!isDesktop) return null

    return (
      <nav className='flex items-center gap-1.5' aria-label='Fő navigáció'>
        {/* Solutions mega menu */}
        <div className='relative' onMouseEnter={openMega} onMouseLeave={closeMegaDelayed}>
          <Button
            type='button'
            variant='text'
            color='inherit'
            className='font-medium'
            aria-expanded={megaOpen}
            aria-haspopup='true'
            onClick={() => setMegaOpen(o => !o)}
            endIcon={<i className={`ri-arrow-down-s-line ${megaOpen ? 'rotate-180' : ''}`} />}
          >
            Megoldások
          </Button>

          {megaOpen && (
            <div
              className='fixed inset-x-0 top-[72px] z-[60] border-b border-[rgba(0,0,0,0.08)] bg-white shadow-xl'
              onMouseEnter={openMega}
              onMouseLeave={closeMegaDelayed}
            >
              <div className='mx-auto max-w-[1200px] px-6 py-8'>
                <div className='flex items-end justify-between gap-6 mb-6'>
                  <div>
                    <p className='text-xs font-semibold tracking-wide text-slate-500 uppercase'>Megoldások</p>
                    <p className='text-lg font-semibold text-slate-900'>Válaszd ki, mi a legfontosabb most</p>
                  </div>
                  <Button component={Link} href='/kapcsolat#demo' variant='contained' onClick={() => setMegaOpen(false)}>
                    Találkozó egyeztetés
                  </Button>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {MARKETING_SOLUTIONS.map(s => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className='group rounded-2xl border border-slate-200 bg-white p-5 hover:border-orange-200 hover:bg-orange-50/30 transition-colors'
                      onClick={() => setMegaOpen(false)}
                    >
                      <p className='text-sm font-semibold text-slate-900 group-hover:text-orange-700'>{s.label}</p>
                      {s.description && (
                        <p className='mt-1 text-sm text-slate-600 leading-snug'>{s.description}</p>
                      )}
                      {s.bullets && s.bullets.length > 0 && (
                        <ul className='mt-3 space-y-1.5'>
                          {s.bullets.slice(0, 3).map(b => (
                            <li key={b} className='text-xs text-slate-500 flex items-start gap-2'>
                              <span className='mt-[3px] w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0' />
                              <span className='leading-snug'>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  ))}
                </div>

                <div className='mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-4'>
                  <Link
                    href='/megoldasok'
                    className='text-sm font-medium text-orange-700 hover:text-orange-800'
                    onClick={() => setMegaOpen(false)}
                  >
                    Összes megoldás →
                  </Link>
                  <div className='text-xs text-slate-500'>
                    Magyar piacra · bevezetés és támogatás
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {desktopLinks.map(l => (
          <Button key={l.href} component={Link} href={l.href} variant='text' color='inherit' className='font-medium'>
            {l.label}
          </Button>
        ))}

        {/* Company dropdown (simple) */}
        <div className='relative'>
          <Button
            type='button'
            variant='text'
            color='inherit'
            className='font-medium'
            aria-haspopup='true'
            onClick={() => setMegaOpen(false)}
          >
            <Link href='/kapcsolat' className='no-underline text-inherit'>
              Kapcsolat
            </Link>
          </Button>
        </div>
      </nav>
    )
  }

  // Mobile drawer renderer (always mounted via Header)
  if (variant === 'mobile') {
    if (isDesktop) return null

    return (
      <Drawer
        variant='temporary'
        anchor='left'
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': { width: ['100%', 340] } }}
      >
        <div className='p-5'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-semibold text-slate-900'>Turinova</p>
            <IconButton onClick={() => setIsDrawerOpen(false)} aria-label='Menü bezárása'>
              <i className='ri-close-line' />
            </IconButton>
          </div>

          <Divider sx={{ my: 2 }} />

          <div className='flex flex-col gap-1'>
            <Button component={Link} href='/' variant='text' color='inherit' className='justify-start'>
              Főoldal
            </Button>

            <Button
              type='button'
              variant='text'
              color='inherit'
              className='justify-start'
              onClick={() => setMobileSolutionsOpen(v => !v)}
              endIcon={<i className={`ri-arrow-down-s-line ${mobileSolutionsOpen ? 'rotate-180' : ''}`} />}
            >
              Megoldások
            </Button>
            <Collapse in={mobileSolutionsOpen}>
              <div className='flex flex-col gap-0.5 ps-2'>
                {MARKETING_SOLUTIONS.map(s => (
                  <Button
                    key={s.href}
                    component={Link}
                    href={s.href}
                    variant='text'
                    color='inherit'
                    className='justify-start'
                  >
                    {s.label}
                  </Button>
                ))}
                <Button component={Link} href='/megoldasok' variant='text' color='inherit' className='justify-start'>
                  Összes megoldás
                </Button>
              </div>
            </Collapse>

            {MARKETING_TOP_LINKS.map(l => (
              <Button key={l.href} component={Link} href={l.href} variant='text' color='inherit' className='justify-start'>
                {l.label}
              </Button>
            ))}

            <Button
              type='button'
              variant='text'
              color='inherit'
              className='justify-start'
              onClick={() => setMobileCompanyOpen(v => !v)}
              endIcon={<i className={`ri-arrow-down-s-line ${mobileCompanyOpen ? 'rotate-180' : ''}`} />}
            >
              Cég
            </Button>
            <Collapse in={mobileCompanyOpen}>
              <div className='flex flex-col gap-0.5 ps-2'>
                {MARKETING_COMPANY_LINKS.map(l => (
                  <Button
                    key={l.href}
                    component={Link}
                    href={l.href}
                    variant='text'
                    color='inherit'
                    className='justify-start'
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
            </Collapse>
          </div>

          <Divider sx={{ my: 2 }} />

          <div className='flex flex-col gap-2'>
            <Button component={Link} href='/kapcsolat#demo' variant='contained' onClick={() => setIsDrawerOpen(false)} fullWidth>
              Találkozó egyeztetés
            </Button>
            <Button component={Link} href='/login' variant='outlined' onClick={() => setIsDrawerOpen(false)} fullWidth>
              Bejelentkezés
            </Button>
          </div>
        </div>
      </Drawer>
    )
  }

  return null
}

