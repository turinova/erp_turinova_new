import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Árak | Turinova',
  description: 'Árazás és csomagok — ajánlat alapú megoldások, bevezetés és támogatás.',
}

export default async function ArakPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-3xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Árak</h1>
        <p className='mt-3 text-slate-600'>
          A megoldásaink bevezetés- és igényfüggők (hardver/szoftver, telephelyek száma, integrációk). A találkozón gyorsan
          felmérjük az igényt, és adunk egy reális árazási keretet.
        </p>

        <div className='mt-8 rounded-2xl border border-slate-200 bg-white p-6'>
          <p className='text-sm font-semibold text-slate-900'>Mitől függ az ár?</p>
          <ul className='mt-3 space-y-2 text-sm text-slate-700'>
            <li>• Megoldás típusa (Webshop ERP / Vásárlószámláló / Munkaidő / Asztalos ERP)</li>
            <li>• Telephelyek és felhasználók száma</li>
            <li>• Integrációk (webshop, számlázó, futár, stb.)</li>
            <li>• Egyedi folyamatok és riportok</li>
          </ul>
        </div>

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

