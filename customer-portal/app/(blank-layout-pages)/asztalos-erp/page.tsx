import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Asztalos ERP | Turinova',
  description: 'ERP asztalos vállalkozásoknak: árajánlat, megrendelés, gyártás és fizetések követése.',
}

export default async function AsztalosErpPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-3xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Asztalos ERP</h1>
        <p className='mt-3 text-slate-600'>
          Oldal feltöltés alatt. A találkozón megmutatjuk az ajánlat → megrendelés → gyártás folyamatot és a kapcsolódó dokumentumokat.
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

