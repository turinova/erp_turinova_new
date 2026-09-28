import { formatFt } from '@/lib/storefront/format'
import { childCategories, getStorefrontShell, type StorefrontCategory } from '@/lib/storefront/shell'
import {
  categoryPath,
  siteUrl,
  STOREFRONT_HOME
} from '@/lib/storefront/url'
import { legalPath, LEGAL_DOCS } from '@/lib/webshop/legal/constants'
import { LEGAL_DOC_KINDS } from '@/lib/webshop/legal/types'
import { STATUTORY_RETURN_DAYS } from '@/lib/webshop/settings'

export const revalidate = 3600

/** llms.txt — rövid, gépnek szóló térkép a boltról (llmstxt.org formátum). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ site: string }> }
) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) return new Response('Not found', { status: 404 })
  const { seller, settings, categories, tenant } = shell
  const absoluteUrl = (path: string) => siteUrl(tenant.base, path)
  const returnDays = Math.max(settings.returnDays ?? STATUTORY_RETURN_DAYS, STATUTORY_RETURN_DAYS)

  const lines: string[] = [
    `# ${seller.name}`,
    '',
    `> Magyar webbolt. Árak bruttó forintban (ÁFA-val). ${returnDays} napos elállás.` +
      (settings.shippingFeeGross != null
        ? settings.shippingFeeGross === 0
          ? ' Ingyenes szállítás.'
          : ` Szállítás ${settings.shippingFeeGross} Ft` +
            (settings.freeShippingThresholdGross != null
              ? `, ${settings.freeShippingThresholdGross} Ft felett ingyenes.`
              : '.')
        : ''),
    '',
    'Minden termékoldal schema.org Product / ProductGroup JSON-LD-t tartalmaz (ár, készlet, kulcsméretek, szállítás, visszaküldés).',
    '',
    '## Kategóriák',
    ''
  ]
  const line = (c: StorefrontCategory, indent: string) =>
    `${indent}- [${c.name}](${absoluteUrl(categoryPath(c.slug))}): ${c.productCount} termék` +
    (c.priceFrom != null ? `, ${formatFt(c.priceFrom)}-tól` : '') +
    (c.intro ? `. ${c.intro}` : '')
  for (const top of childCategories(categories, null)) {
    lines.push(line(top, ''))
    for (const sub of childCategories(categories, top.id)) lines.push(line(sub, '  '))
  }
  lines.push(
    '',
    '## Keresés és adatok',
    '',
    `- [Google Merchant feed](${absoluteUrl('/feeds/google.xml')})`,
    `- [Termékfeed (JSONL)](${absoluteUrl('/feeds/openai.jsonl')})`,
    `- [Sitemap](${absoluteUrl('/sitemap.xml')})`,
    '',
    '## Kapcsolat',
    ''
  )
  if (seller.email) lines.push(`- E-mail: ${seller.email}`)
  if (seller.phone) lines.push(`- Telefon: ${seller.phone}`)
  lines.push(`- [Bolt](${absoluteUrl(STOREFRONT_HOME)})`, '', '## Vásárlói információk', '')
  const docHref = (href: string) => (href.startsWith('/') ? absoluteUrl(href) : href)
  lines.push(`- [${LEGAL_DOCS.aszf.title}](${docHref(settings.termsUrl)})`)
  lines.push(`- [${LEGAL_DOCS.adatkezeles.title}](${docHref(settings.privacyUrl)})`)
  for (const kind of LEGAL_DOC_KINDS) {
    if (kind === 'aszf' || kind === 'adatkezeles') continue
    lines.push(`- [${LEGAL_DOCS[kind].title}](${absoluteUrl(legalPath(kind))})`)
  }
  lines.push('')

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
