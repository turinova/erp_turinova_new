import type { MetadataRoute } from "next"
import { COMPANY } from "@/lib/company"
import { getSupabaseServerClient } from "@/lib/supabase"

type ButorlapRow = { id: string; slug: string | null; updated_at: string }
type MunkalapRow = { id: string; slug: string | null; updated_at: string }

function toIsoDate(input: string) {
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const base: MetadataRoute.Sitemap = [
    { url: `${COMPANY.website}/`, lastModified: now },
    { url: `${COMPANY.website}/kapcsolat`, lastModified: now },
    { url: `${COMPANY.website}/szolgaltatasok/lapszabaszat-es-elzaras`, lastModified: now },
    { url: `${COMPANY.website}/szolgaltatasok/online-lapszabaszat`, lastModified: now },
    { url: `${COMPANY.website}/szolgaltatasok/ipari-megoldasok/szallitolada-keszites`, lastModified: now },
    { url: `${COMPANY.website}/butorlap`, lastModified: now },
    { url: `${COMPANY.website}/munkalap`, lastModified: now },
  ]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return base

  const supabase = getSupabaseServerClient()

  const [butorlapRes, munkalapRes] = await Promise.all([
    supabase.from("public_butorlap").select("id,slug,updated_at"),
    supabase.from("public_munkalap").select("id,slug,updated_at"),
  ])

  const butorlap = ((butorlapRes.data as ButorlapRow[]) || []).filter(Boolean)
  const munkalap = ((munkalapRes.data as MunkalapRow[]) || []).filter(Boolean)

  for (const r of butorlap) {
    const path = `/butorlap/${r.slug ?? `id-${r.id}`}`
    base.push({
      url: `${COMPANY.website}${path}`,
      lastModified: toIsoDate(r.updated_at),
    })
  }

  for (const r of munkalap) {
    const path = `/munkalap/${r.slug ?? `id-${r.id}`}`
    base.push({
      url: `${COMPANY.website}${path}`,
      lastModified: toIsoDate(r.updated_at),
    })
  }

  return base
}

