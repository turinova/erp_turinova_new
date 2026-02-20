import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, TrendingUp as TrendingUpIcon, Dashboard as DashboardIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import CompetitorDashboard from './CompetitorDashboard'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getDashboardData() {
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

  // Get all competitor links with their latest prices and product info
  const { data: links, error } = await supabase
    .from('competitor_product_links')
    .select(`
      id,
      competitor_url,
      last_checked_at,
      competitor:competitors(id, name, website_url),
      product:shoprenter_products(id, sku, name, model_number, price)
    `)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching competitor links:', error)
    return { links: [], priceComparisons: [] }
  }

  // For each link, get the latest price
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

  // Calculate price comparisons
  const priceComparisons = linksWithPrices
    .filter((link: any) => link.product?.price && link.latestPrice?.price)
    .map((link: any) => {
      const ourPrice = link.product.price
      const competitorPrice = link.latestPrice.price
      const difference = ourPrice - competitorPrice
      const percentDiff = ((difference / competitorPrice) * 100)
      
      return {
        linkId: link.id,
        productId: link.product.id,
        sku: link.product.sku,
        productName: link.product.name,
        modelNumber: link.product.model_number,
        ourPrice,
        competitorName: link.competitor?.name || 'Unknown',
        competitorPrice,
        difference,
        percentDiff,
        lastChecked: link.last_checked_at,
        competitorUrl: link.competitor_url
      }
    })

  return { links: linksWithPrices, priceComparisons }
}

export default async function CompetitorDashboardPage() {
  const { priceComparisons } = await getDashboardData()

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
          <DashboardIcon fontSize="small" />
          Dashboard
        </Typography>
      </Breadcrumbs>

      <CompetitorDashboard initialData={priceComparisons} />
    </Box>
  )
}
