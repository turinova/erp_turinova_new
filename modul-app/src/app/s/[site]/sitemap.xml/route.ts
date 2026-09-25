import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { getStorefrontShell } from '@/lib/storefront/shell'
import { categoryPath, productPath, siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'

export const revalidate = 3600

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ site: string }> }
) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) return new Response('Not found', { status: 404 })
  const { admin, tenant, categories } = shell

  const entries: { loc: string; lastmod?: string; changefreq?: string }[] = [
    { loc: siteUrl(tenant.base, STOREFRONT_HOME), changefreq: 'daily' }
  ]
  for (const c of categories) {
    if (c.productCount === 0) continue
    entries.push({ loc: siteUrl(tenant.base, categoryPath(c.slug)), changefreq: 'daily' })
  }

  const { data, error } = await fetchAllPages<{ web_slug: string; updated_at: string | null }>(
    (from, to) =>
      admin
        .from('storefront_products')
        .select('web_slug, updated_at')
        .eq('tenant_id', tenant.id)
        .eq('sellable_web', true)
        .eq('active', true)
        .is('deleted_at', null)
        .not('web_slug', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    45000
  )
  if (error) console.error('storefront sitemap', error)
  for (const r of data) {
    entries.push({
      loc: siteUrl(tenant.base, productPath(r.web_slug)),
      lastmod: r.updated_at ?? undefined
    })
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (e) =>
        `<url><loc>${esc(e.loc)}</loc>` +
        (e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : '') +
        (e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : '') +
        '</url>'
    ),
    '</urlset>'
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
