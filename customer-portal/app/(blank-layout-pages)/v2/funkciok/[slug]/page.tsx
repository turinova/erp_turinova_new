import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFunkcioBySlug, isValidFunkcioSlug } from '@/components/landing-v2/funkciok-menu-data'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!isValidFunkcioSlug(slug)) return { title: 'Funkció | Turinova' }
  const data = getFunkcioBySlug(slug)
  if (!data) return { title: 'Funkció | Turinova' }
  return {
    title: `${data.label} | Turinova`,
    description: data.description,
  }
}

export default async function FunkcioDetailPage({ params }: Props) {
  const { slug } = await params
  if (!isValidFunkcioSlug(slug)) notFound()

  const data = getFunkcioBySlug(slug)
  if (!data) notFound()

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-2">{data.sectionTitle}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{data.label}</h1>
        <p className="mt-2 text-lg text-slate-600 leading-relaxed">{data.description}</p>
        <p className="mt-6 text-slate-600 leading-relaxed">
          Ez az oldal hamarosan bővebb tartalommal bővül. Addig is írj nekünk, vagy foglalj demót, és élőben
          megmutatjuk, hogyan illeszkedik a webshopodhoz.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/v2#demo"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors shadow-sm shadow-orange-200"
          >
            Demo foglalása
          </Link>
          <Link href="/v2/funkciok" className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Összes funkció
          </Link>
          <Link href="/v2" className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            ← Vissza a főoldalra
          </Link>
        </div>
      </div>
    </div>
  )
}
