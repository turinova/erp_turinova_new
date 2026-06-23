import type { Metadata } from 'next'
import { DM_Sans, Inter } from 'next/font/google'

import TvQueryProvider from './providers/TvQueryProvider'
import './styles/tv.global.css'

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-display'
})

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-data'
})

export const metadata: Metadata = {
  title: 'TV kijelző',
  description: 'Turinova gyártási és üzleti TV dashboard'
}

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dmSans.variable} ${inter.variable}`}>
      <TvQueryProvider>{children}</TvQueryProvider>
    </div>
  )
}
