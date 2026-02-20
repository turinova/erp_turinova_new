import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, TrendingUp as TrendingUpIcon, Link as LinkIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import CompetitorLinksManager from './CompetitorLinksManager'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getLinksData() {
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Get all competitor links with product and competitor info
  const { data: links, error } = await supabase
    .from('competitor_product_links')
    .select(`
      id,
      competitor_url,
      competitor_sku,
      competitor_product_name,
      matching_method,
      is_active,
      last_checked_at,
      last_error,
      competitor:competitors(id, name, website_url),
      product:shoprenter_products(id, sku, name, model_number, price)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching links:', error)
    return { links: [], competitors: [] }
  }

  // Get latest price for each link
  const linksWithPrices = await Promise.all(
    (links || []).map(async (link: any) => {
      const { data: latestPrice } = await supabase
        .from('competitor_prices')
        .select('price, price_gross, scraped_at')
        .eq('competitor_product_link_id', link.id)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single()

      return {
        ...link,
        latestPrice: latestPrice || null
      }
    })
  )

  // Get all competitors for dropdown
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, website_url')
    .eq('is_active', true)
    .order('name')

  return { 
    links: linksWithPrices, 
    competitors: competitors || [] 
  }
}

export default async function CompetitorLinksPage() {
  const { links, competitors } = await getLinksData()

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          component={NextLink}
          href="/competitors"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <TrendingUpIcon fontSize="small" />
          Versenytársak
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LinkIcon fontSize="small" />
          Linkek kezelése
        </Typography>
      </Breadcrumbs>

      <CompetitorLinksManager initialLinks={links} competitors={competitors} />
    </Box>
  )
}
