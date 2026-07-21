import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Rólunk | Turinova',
  description: 'Turinova — magyar csapat, bevezetés és támogatás.',
}

export default async function RolunkPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-3xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Rólunk</h1>
        <p className='mt-3 text-slate-600'>
          Magyar csapat vagyunk, és olyan szoftver + hardver megoldásokat építünk, amik valódi üzleti folyamatokat tesznek
          átláthatóvá és automatizálhatóvá.
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

