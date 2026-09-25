import { childCategories, getStorefrontShell } from '@/lib/storefront/shell'
import {
  categoryPath,
  siteUrl,
  STOREFRONT_HOME
} from '@/lib/storefront/url'
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
  for (const top of childCategories(categories, null)) {
    lines.push(`- [${top.name}](${absoluteUrl(categoryPath(top.slug))}): ${top.productCount} termék`)
    for (const sub of childCategories(categories, top.id)) {
      lines.push(`  - [${sub.name}](${absoluteUrl(categoryPath(sub.slug))}): ${sub.productCount} termék`)
    }
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
  if (settings.termsUrl) lines.push(`- [ÁSZF](${settings.termsUrl})`)
  lines.push(`- [Bolt](${absoluteUrl(STOREFRONT_HOME)})`, '')

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
