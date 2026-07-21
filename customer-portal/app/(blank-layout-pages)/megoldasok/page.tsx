import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Megoldások | Turinova',
  description: 'Turinova megoldások: Webshop ERP, vásárlószámláló, munkaidő nyilvántartás, asztalos ERP és egyedi fejlesztés.',
}

const solutions = [
  { title: 'Webshop ERP', href: '/v2', desc: 'Rendelés–készlet–számlázás automatizálva.' },
  { title: 'Vásárlószámláló (Footcounter)', href: '/vasarloszamlalo', desc: 'Forgalom → konverzió → jobb döntések.' },
  { title: 'Munkaidő nyilvántartás (Attendance)', href: '/munkaido-nyilvantartas', desc: 'Munkaidő és jelenlét rendben, viták nélkül.' },
  { title: 'Asztalos ERP', href: '/asztalos-erp', desc: 'Árajánlat → gyártás → átadás egyben.' },
  { title: 'Egyedi fejlesztés', href: '/egyedi-fejlesztes', desc: 'Integrációk és folyamatok a te működésedre.' },
] as const

export default async function MegoldasokPage() {
  return (
    <MarketingShell>
      <main className='mx-auto max-w-5xl px-6 py-14'>
        <h1 className='text-3xl font-semibold text-slate-900'>Megoldások</h1>
        <p className='mt-3 text-slate-600 max-w-2xl'>
          Válaszd ki, mi a legfontosabb most. Ha nem vagy biztos benne, kérj találkozót, és segítünk a legjobb irányt megtalálni.
        </p>

        <div className='mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {solutions.map(s => (
            <Link
              key={s.href}
              href={s.href}
              className='rounded-2xl border border-slate-200 bg-white p-6 hover:border-orange-200 hover:bg-orange-50/30 transition-colors'
            >
              <p className='text-sm font-semibold text-slate-900'>{s.title}</p>
              <p className='mt-1 text-sm text-slate-600 leading-snug'>{s.desc}</p>
            </Link>
          ))}
        </div>

        <div className='mt-12'>
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

