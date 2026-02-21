// Product Quality Service
// Fetches product data and calculates quality scores

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { calculateProductQualityScore, ProductData, QualityScoreResult } from './product-quality-scorer'

/**
 * Fetch all necessary data for a product and calculate quality score
 */
export async function calculateAndStoreProductScore(
  supabase: any,
  productId: string
): Promise<QualityScoreResult | null> {
  try {
    // Fetch product basic data
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        connection_id,
        parent_product_id,
        sku,
        name,
        model_number,
        gtin,
        price,
        status,
        url_slug,
        sync_status,
        sync_error,
        product_attributes,
        competitor_tracking_enabled
      `)
      .eq('id', productId)
      .single()

    if (productError || !product) {
      console.error('[QUALITY SCORE] Product not found:', productError)
      return null
    }

    // Fetch description data (Hungarian)
    const { data: description, error: descError } = await supabase
      .from('shoprenter_product_descriptions')
      .select('description, meta_title, meta_description')
      .eq('product_id', productId)
      .eq('language_code', 'hu')
      .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no description exists
    
    if (descError && descError.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK (no description yet)
      console.warn('[QUALITY SCORE] Error fetching description:', descError)
    }
    
    if (description) {
      console.log('[QUALITY SCORE] Description found, length:', description.description?.length || 0)
    } else {
      console.log('[QUALITY SCORE] No description found for product:', productId)
    }

    // Fetch images
    const { data: images } = await supabase
      .from('product_images')
      .select('alt_text, alt_text_status')
      .eq('product_id', productId)
      .order('is_main_image', { ascending: false })
      .order('sort_order', { ascending: true })

    // Fetch indexing status
    const { data: indexingStatus } = await supabase
      .from('product_indexing_status')
      .select('is_indexed, has_issues, coverage_state, indexing_state, page_fetch_state, page_fetch_error, mobile_usability_issues, mobile_usability_passed, core_web_vitals, structured_data_issues, rich_results_eligible, sitemap_status')
      .eq('product_id', productId)
      .maybeSingle()

    // Determine if parent or child
    const isParent = !product.parent_product_id || product.parent_product_id === product.id
    
    // For child products, inherit Search Console data from parent
    let searchConsoleData = null
    let parentId = productId
    
    if (!isParent && product.parent_product_id) {
      parentId = product.parent_product_id
    }

    // Fetch Search Console performance (from parent if child)
    const { data: searchPerformance } = await supabase
      .from('product_search_performance')
      .select('impressions, clicks, ctr, position')
      .eq('product_id', parentId)
      .order('date', { ascending: false })
      .limit(30) // Last 30 days

    if (searchPerformance && searchPerformance.length > 0) {
      const totalImpressions = searchPerformance.reduce((sum, p) => sum + (p.impressions || 0), 0)
      const totalClicks = searchPerformance.reduce((sum, p) => sum + (p.clicks || 0), 0)
      const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
      const avgPosition = searchPerformance.reduce((sum, p) => sum + (p.position || 0), 0) / searchPerformance.length

      searchConsoleData = {
        impressions: totalImpressions,
        clicks: totalClicks,
        avg_ctr: avgCtr,
        avg_position: avgPosition
      }
    }

    // Fetch competitor price (check for competitor links regardless of tracking flag)
    // If competitor links exist, we should consider them for scoring
    let competitorPrice = null
    let hasCompetitorLinks = false
    
    console.log('[QUALITY SCORE] Checking competitor data for product:', productId)
    console.log('[QUALITY SCORE] competitor_tracking_enabled flag:', product.competitor_tracking_enabled)
    
    // Get latest competitor price from competitor_product_links -> competitor_prices
    const { data: competitorLinks, error: linksError } = await supabase
      .from('competitor_product_links')
      .select('id')
      .eq('product_id', productId)
      .eq('is_active', true)

    if (linksError) {
      console.error('[QUALITY SCORE] Error fetching competitor links:', linksError)
    }

    console.log('[QUALITY SCORE] Found competitor links:', competitorLinks?.length || 0)

    if (competitorLinks && competitorLinks.length > 0) {
      hasCompetitorLinks = true
      
      // Get the latest price from all competitor links for this product
      const linkIds = competitorLinks.map(link => link.id)
      
      // Get latest price for each link
      const pricePromises = linkIds.map(async (linkId) => {
        const { data: latestPrice, error: priceError } = await supabase
          .from('competitor_prices')
          .select('price')
          .eq('competitor_product_link_id', linkId)
          .order('scraped_at', { ascending: false })
          .limit(1)
          .single()
        
        if (priceError && priceError.code !== 'PGRST116') {
          // PGRST116 = not found, which is OK
          console.error(`[QUALITY SCORE] Error fetching price for link ${linkId}:`, priceError)
        }
        
        return latestPrice?.price || null
      })
      
      const prices = await Promise.all(pricePromises)
      console.log('[QUALITY SCORE] Fetched prices (raw):', prices)
      
      // Convert to numbers and filter valid prices
      const validPrices = prices
        .map(p => {
          if (p === null || p === undefined) return null
          const num = typeof p === 'string' ? parseFloat(p) : Number(p)
          return !isNaN(num) && num > 0 ? num : null
        })
        .filter((p): p is number => p !== null)
      
      console.log('[QUALITY SCORE] Valid prices (numbers):', validPrices)
      
      if (validPrices.length > 0) {
        // Use the lowest competitor price (most competitive)
        competitorPrice = Math.min(...validPrices)
        console.log('[QUALITY SCORE] Using competitor price:', competitorPrice)
      } else {
        console.warn('[QUALITY SCORE] No valid competitor prices found - prices may not be scraped yet')
      }
    } else {
      console.warn('[QUALITY SCORE] No active competitor links found for product')
    }
    
    // If we have competitor links but tracking isn't enabled, we should still consider it
    // But we'll use the hasCompetitorLinks flag to determine if we should score
    if (hasCompetitorLinks && !product.competitor_tracking_enabled) {
      console.warn('[QUALITY SCORE] Competitor links exist but competitor_tracking_enabled is false')
    }

    // Build product data object
    const productData: ProductData = {
      id: product.id,
      connection_id: product.connection_id,
      parent_product_id: product.parent_product_id,
      sku: product.sku,
      name: product.name,
      model_number: product.model_number,
      gtin: product.gtin,
      price: product.price,
      status: product.status,
      url_slug: product.url_slug,
      sync_status: product.sync_status,
      sync_error: product.sync_error,
      product_attributes: product.product_attributes,
      description: description ? {
        description: description.description,
        meta_title: description.meta_title,
        meta_description: description.meta_description
      } : null,
      images: images || [],
      search_console: searchConsoleData ? {
        impressions: searchConsoleData.impressions,
        clicks: searchConsoleData.clicks,
        avg_position: searchConsoleData.avg_position,
        avg_ctr: searchConsoleData.avg_ctr
      } : null,
      indexing_status: indexingStatus ? {
        is_indexed: indexingStatus.is_indexed,
        has_issues: indexingStatus.has_issues,
        coverage_state: indexingStatus.coverage_state,
        indexing_state: indexingStatus.indexing_state,
        page_fetch_state: indexingStatus.page_fetch_state,
        page_fetch_error: indexingStatus.page_fetch_error,
        mobile_usability_issues: indexingStatus.mobile_usability_issues,
        mobile_usability_passed: indexingStatus.mobile_usability_passed,
        core_web_vitals: indexingStatus.core_web_vitals,
        structured_data_issues: indexingStatus.structured_data_issues,
        rich_results_eligible: indexingStatus.rich_results_eligible,
        sitemap_status: indexingStatus.sitemap_status
      } : null,
      // Enable tracking if we have competitor links, even if flag wasn't set
      competitor_tracking_enabled: hasCompetitorLinks || product.competitor_tracking_enabled,
      competitor_price: competitorPrice
    }

    console.log('[QUALITY SCORE] Product data for scoring:', {
      product_id: productData.id,
      competitor_tracking_enabled: productData.competitor_tracking_enabled,
      has_competitor_links: hasCompetitorLinks,
      competitor_price: productData.competitor_price,
      product_price: productData.price,
      price_types: {
        competitor_price_type: typeof productData.competitor_price,
        product_price_type: typeof productData.price
      }
    })

    // Calculate score
    const scoreResult = calculateProductQualityScore(productData)

    // Store score in database
    const { data: storedData, error: storeError } = await supabase
      .from('product_quality_scores')
      .upsert({
        product_id: productId,
        connection_id: product.connection_id,
        is_parent: scoreResult.is_parent,
        overall_score: scoreResult.overall_score,
        content_score: scoreResult.content_score,
        image_score: scoreResult.image_score,
        technical_score: scoreResult.technical_score,
        performance_score: scoreResult.performance_score,
        completeness_score: scoreResult.completeness_score,
        competitive_score: scoreResult.competitive_score,
        priority_score: scoreResult.priority_score,
        issues: scoreResult.issues,
        blocking_issues: scoreResult.blocking_issues,
        last_calculated_at: new Date().toISOString(),
        calculation_version: '1.0'
      }, {
        onConflict: 'product_id'
      })
      .select()

    if (storeError) {
      console.error('[QUALITY SCORE] Error storing score:', storeError)
      console.error('[QUALITY SCORE] Product ID:', productId)
      console.error('[QUALITY SCORE] Score data:', {
        overall_score: scoreResult.overall_score,
        is_parent: scoreResult.is_parent
      })
      // Don't return null on store error - the calculation succeeded, just storage failed
      // This way we can see the actual error
      throw new Error(`Failed to store score: ${storeError.message}`)
    }

    if (!storedData || storedData.length === 0) {
      console.warn('[QUALITY SCORE] Upsert returned no data for product:', productId)
    } else {
      console.log('[QUALITY SCORE] Successfully stored score for product:', productId, 'Score:', scoreResult.overall_score)
    }

    return scoreResult
  } catch (error) {
    console.error('[QUALITY SCORE] Error calculating score:', error)
    return null
  }
}

/**
 * Calculate scores for multiple products (bulk)
 */
export async function calculateBulkProductScores(
  supabase: any,
  productIds: string[]
): Promise<{ success: number; failed: number; errors: Array<{ productId: string; error: string }> }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ productId: string; error: string }>
  }

  for (const productId of productIds) {
    try {
      const score = await calculateAndStoreProductScore(supabase, productId)
      if (score) {
        results.success++
      } else {
        results.failed++
        results.errors.push({ productId, error: 'Failed to calculate score' })
      }
    } catch (error: any) {
      results.failed++
      results.errors.push({
        productId,
        error: error?.message || 'Unknown error'
      })
    }
  }

  return results
}
