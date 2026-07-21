import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Referenciák | Turinova',
  description: 'Referenciák és esettanulmányok — feltöltés alatt.',
}

export default async function ReferenciakPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-3xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Referenciák</h1>
        <p className='mt-3 text-slate-600'>
          Oldal feltöltés alatt. Találkozón konkrét példákat és demót mutatunk az iparágadnak megfelelően.
        </p>
        <div className='mt-8'>
          <Link
            href='/kapcsolat#demo'
            className='inline-flex items-center justify-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-colors'
          >
            Találkozó egyeztetés →
          </Link>
        </div>
      </main>
    </MarketingShell>
  )
}

