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
    return { links: [], priceComparisons: [], metrics: null, competitorStats: [] }
  }

  // Get total products count for coverage calculation
  const { count: totalProducts } = await supabase
    .from('shoprenter_products')
    .select('*', { count: 'exact', head: true })

  // For each link, get the latest price and price history
  const linksWithPrices = await Promise.all(
    (links || []).map(async (link: any) => {
      const { data: latestPrice } = await supabase
        .from('competitor_prices')
        .select('price, price_gross, scraped_at, in_stock')
        .eq('competitor_product_link_id', link.id)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single()

      // Get price history for trends (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: priceHistory } = await supabase
        .from('competitor_prices')
        .select('price, scraped_at')
        .eq('competitor_product_link_id', link.id)
        .gte('scraped_at', thirtyDaysAgo.toISOString())
        .order('scraped_at', { ascending: true })

      return {
        ...link,
        latestPrice: latestPrice || null,
        priceHistory: priceHistory || []
      }
    })
  )

  // Get competitor statistics
  const competitorStatsMap = new Map()
  linksWithPrices.forEach((link: any) => {
    const competitorId = link.competitor?.id
    const competitorName = link.competitor?.name || 'Unknown'
    if (!competitorId) return

    if (!competitorStatsMap.has(competitorId)) {
      competitorStatsMap.set(competitorId, {
        id: competitorId,
        name: competitorName,
        totalProducts: 0,
        weAreCheaper: 0,
        weAreExpensive: 0,
        similar: 0
      })
    }

    const stats = competitorStatsMap.get(competitorId)
    stats.totalProducts++

    if (link.product?.price && link.latestPrice?.price) {
      const ourPrice = link.product.price
      const competitorPrice = link.latestPrice.price
      const percentDiff = ((ourPrice - competitorPrice) / competitorPrice) * 100

      if (percentDiff < -2) {
        stats.weAreCheaper++
      } else if (percentDiff > 2) {
        stats.weAreExpensive++
      } else {
        stats.similar++
      }
    }
  })

  const competitorStats = Array.from(competitorStatsMap.values())

  // Calculate price comparisons
  const priceComparisons = linksWithPrices
    .filter((link: any) => link.product?.price && link.latestPrice?.price)
    .map((link: any) => {
      const ourPrice = link.product.price
      const competitorPrice = link.latestPrice.price
      const difference = ourPrice - competitorPrice
      const percentDiff = ((difference / competitorPrice) * 100)
      
      // Calculate days since last check
      const daysSinceCheck = link.last_checked_at 
        ? Math.floor((Date.now() - new Date(link.last_checked_at).getTime()) / (1000 * 60 * 60 * 24))
        : null
      
      return {
        linkId: link.id,
        productId: link.product.id,
        sku: link.product.sku,
        productName: link.product.name,
        modelNumber: link.product.model_number,
        ourPrice,
        competitorName: link.competitor?.name || 'Unknown',
        competitorId: link.competitor?.id,
        competitorPrice,
        difference,
        percentDiff,
        lastChecked: link.last_checked_at,
        daysSinceCheck,
        competitorUrl: link.competitor_url,
        inStock: link.latestPrice?.in_stock,
        priceHistory: link.priceHistory || []
      }
    })

  // Calculate enhanced metrics
  const totalComparisons = priceComparisons.length
  const cheaper = priceComparisons.filter(p => p.percentDiff < -2).length
  const moreExpensive = priceComparisons.filter(p => p.percentDiff > 2).length
  const similar = priceComparisons.filter(p => p.percentDiff >= -2 && p.percentDiff <= 2).length

  // Financial impact: potential revenue loss where we're more expensive
  const potentialRevenueLoss = priceComparisons
    .filter(p => p.percentDiff > 0)
    .reduce((sum, p) => sum + Math.max(0, p.difference), 0)

  // Average price difference (weighted)
  const avgPriceDiff = totalComparisons > 0
    ? priceComparisons.reduce((sum, p) => sum + p.percentDiff, 0) / totalComparisons
    : 0

  // Data freshness: how many checked in last 24h
  const now = Date.now()
  const oneDayAgo = now - (24 * 60 * 60 * 1000)
  const freshData = priceComparisons.filter(p => 
    p.lastChecked && new Date(p.lastChecked).getTime() > oneDayAgo
  ).length
  const freshDataPercent = totalComparisons > 0 
    ? Math.round((freshData / totalComparisons) * 100) 
    : 0

  // Stale data (>7 days)
  const staleData = priceComparisons.filter(p => 
    p.daysSinceCheck !== null && p.daysSinceCheck > 7
  ).length

  // Coverage: products with competitor data vs total products
  const coverage = totalProducts && totalProducts > 0
    ? Math.round((totalComparisons / totalProducts) * 100)
    : 0

  const metrics = {
    totalComparisons,
    cheaper,
    moreExpensive,
    similar,
    potentialRevenueLoss,
    avgPriceDiff,
    freshData,
    freshDataPercent,
    staleData,
    coverage,
    totalProducts: totalProducts || 0
  }

  return { links: linksWithPrices, priceComparisons, metrics, competitorStats }
}

export default async function CompetitorDashboardPage() {
  const { priceComparisons, metrics, competitorStats } = await getDashboardData()

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

      <CompetitorDashboard 
        initialData={priceComparisons} 
        metrics={metrics}
        competitorStats={competitorStats}
      />
    </Box>
  )
}
