import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Egyedi fejlesztés | Turinova',
  description: 'Egyedi fejlesztés és integrációk: rendszerek összekötése, workflow automatizmusok, migráció.',
}

export default async function EgyediFejlesztesPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-3xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Egyedi fejlesztés</h1>
        <p className='mt-3 text-slate-600'>
          Ha a kész megoldások nem fedik le a működésedet, integrációt és folyamatot építünk — a te cégedre.
        </p>
        <ul className='mt-6 space-y-2 text-slate-700 text-sm'>
          <li>• Rendszerösszekötés (webshop / számlázás / logisztika / belső eszközök)</li>
          <li>• Egyedi üzleti workflow-k</li>
          <li>• Migráció és automatizálás</li>
        </ul>
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

