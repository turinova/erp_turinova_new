import type { Metadata } from 'next'
import Link from 'next/link'
import { FUNKCIOK_MENU } from '@/components/landing-v2/funkciok-menu-data'

export const metadata: Metadata = {
  title: 'Funkciók | Turinova',
  description:
    'Alap ERP funkciók, innovatív AI és piaci eszközök, valamint egyedi fejlesztés. Válaszd ki, mire van szükséged.',
}

export default function FunkciokHubPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Funkciók</h1>
        <p className="mt-3 text-lg text-slate-600 max-w-2xl leading-relaxed">
          Válaszd ki a területet, ami téged érint: alap működés, innovatív AI és piaci modulok, vagy egyedi fejlesztés.
        </p>

        <div className="mt-12 space-y-14">
          {FUNKCIOK_MENU.map(section => (
            <section key={section.id} aria-labelledby={`hub-${section.id}`}>
              <h2 id={`hub-${section.id}`} className="text-xl font-bold text-slate-900">
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{section.tagline}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map(item => (
                  <li key={item.slug}>
                    <Link
                      href={`/v2/funkciok/${item.slug}`}
                      className="block rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
                    >
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      <span className="mt-1 block text-sm text-slate-600 leading-snug">{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-slate-200 flex flex-wrap gap-4">
          <Link href="/v2#funkciok" className="text-sm font-medium text-orange-600 hover:text-orange-700">
            Vissza a landing szekcióhoz ↗
          </Link>
          <Link href="/v2" className="text-sm text-slate-600 hover:text-slate-900">
            Főoldal
          </Link>
        </div>
      </div>
    </div>
  )
}
