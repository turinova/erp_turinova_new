import { getStorefrontShell } from '@/lib/storefront/shell'
import { siteUrl, STOREFRONT_SEARCH } from '@/lib/storefront/url'

export const revalidate = 3600

/** Csak modelltanítás; a keresés/ajánlás botjai (OAI-SearchBot, ChatGPT-User, PerplexityBot) mindig mehetnek. */
const TRAINING_BOTS = [
  'GPTBot',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'ClaudeBot',
  'Applebot-Extended',
  'Bytespider'
]

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ site: string }> }
) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) return new Response('Not found', { status: 404 })

  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /api/', `Disallow: ${STOREFRONT_SEARCH}`, '']
  if (!shell.settings.allowAiTraining) {
    for (const ua of TRAINING_BOTS) lines.push(`User-agent: ${ua}`, 'Disallow: /', '')
  }
  lines.push(`Sitemap: ${siteUrl(shell.tenant.base, '/sitemap.xml')}`, '')

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
