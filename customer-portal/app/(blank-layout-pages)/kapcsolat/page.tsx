import type { Metadata } from 'next'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Kapcsolat | Turinova',
  description: 'Találkozó egyeztetés és kapcsolatfelvétel.',
}

export default async function KapcsolatPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-3xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Kapcsolat</h1>
        <p className='mt-3 text-slate-600'>
          Írj vagy hívj minket, és egyeztetünk egy rövid (20 perces) találkozót, ahol megnézzük, melyik megoldás illik hozzád.
        </p>

        <div className='mt-8 rounded-2xl border border-slate-200 bg-white p-6'>
          <p className='text-sm font-semibold text-slate-900'>Elérhetőségek</p>
          <div className='mt-3 space-y-2 text-sm text-slate-700'>
            <p>
              E-mail: <a className='text-orange-700 hover:underline' href='mailto:info@turinova.hu'>info@turinova.hu</a>
            </p>
            <p>
              Telefon: <a className='text-orange-700 hover:underline' href='tel:+36309992800'>+36 30 999 2800</a>
            </p>
          </div>
        </div>

        <div id='demo' className='mt-10 scroll-mt-24 rounded-2xl border border-orange-200 bg-orange-50/40 p-6'>
          <p className='text-sm font-semibold text-slate-900'>Találkozó egyeztetés</p>
          <p className='mt-2 text-sm text-slate-700'>
            Küldj egy e-mailt a témával (Webshop ERP / Vásárlószámláló / Munkaidő / Asztalos ERP / Egyedi), és 1 munkanapon belül visszajelzünk.
          </p>
          <div className='mt-4 flex flex-wrap gap-3'>
            <a
              className='inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors'
              href='mailto:info@turinova.hu?subject=Tal%C3%A1lkoz%C3%B3%20egyeztet%C3%A9s'
            >
              E-mail küldése
            </a>
            <a
              className='inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors'
              href='tel:+36309992800'
            >
              Telefonhívás
            </a>
          </div>
        </div>
      </main>
    </MarketingShell>
  )
}

