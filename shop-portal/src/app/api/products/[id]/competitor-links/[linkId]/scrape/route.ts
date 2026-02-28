import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { scrapeCompetitorPrice, ScrapeConfig } from '@/lib/scraper'
import { checkAvailableCredits } from '@/lib/credit-checker'
import { calculateCreditsForCompetitor } from '@/lib/credit-calculator'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

/**
 * POST /api/products/[id]/competitor-links/[linkId]/scrape
 * Scrape the competitor page and extract price using AI
 * Uses learned patterns from competitor's scrape_config if available
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id: productId, linkId } = await params
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check credits before scraping (price scrape = 2 credits)
    const creditsNeeded = calculateCreditsForCompetitor('price')
    const creditCheck = await checkAvailableCredits(user.id, creditsNeeded)
    if (!creditCheck.hasEnough) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient credits for scraping',
        credits: {
          available: creditCheck.available,
          required: creditCheck.required,
          limit: creditCheck.limit,
          used: creditCheck.used
        }
      }, { status: 402 }) // 402 Payment Required
    }

    // Get the competitor link with competitor details (including scrape_config)
    const { data: link, error: linkError } = await supabase
      .from('competitor_product_links')
      .select(`
        *,
        competitor:competitors(*)
      `)
      .eq('id', linkId)
      .eq('product_id', productId)
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'Competitor link not found' }, { status: 404 })
    }

    // Extract scrape hints from competitor's learned config
    const scrapeHints: ScrapeConfig | undefined = link.competitor?.scrape_config 
      ? {
          priceSelector: link.competitor.scrape_config.priceSelector,
          priceFormat: link.competitor.scrape_config.priceFormat,
          exampleHtml: link.competitor.scrape_config.exampleHtml,
          priceType: link.competitor.scrape_config.priceType,
          vatRate: link.competitor.scrape_config.vatRate,
          successCount: link.competitor.scrape_config.successCount || 0,
          lastSuccessAt: link.competitor.scrape_config.lastSuccessAt
        }
      : undefined

    // Scrape the competitor page (with learned hints if available)
    console.log(`Scraping ${link.competitor_url} for competitor ${link.competitor.name}...`)
    if (scrapeHints?.successCount) {
      console.log(`Using learned patterns from ${scrapeHints.successCount} previous successful scrapes`)
    }
    const scrapeResult = await scrapeCompetitorPrice(link.competitor_url, scrapeHints)

    if (!scrapeResult.success) {
      // Update link with error
      await supabase
        .from('competitor_product_links')
        .update({ 
          last_checked_at: new Date().toISOString(),
          last_error: scrapeResult.error || 'Unknown scraping error'
        })
        .eq('id', linkId)

      return NextResponse.json({
        success: false,
        error: scrapeResult.error || 'Failed to scrape page'
      }, { status: 500 })
    }

    // Save the price to competitor_prices table
    const { data: priceRecord, error: priceError } = await supabase
      .from('competitor_prices')
      .insert({
        competitor_product_link_id: linkId,
        price: scrapeResult.price,           // Nettó (for comparison)
        price_gross: scrapeResult.priceGross, // Bruttó (original scraped)
        price_type: scrapeResult.priceType,   // 'gross', 'net', or 'unknown'
        vat_rate: scrapeResult.vatRate,       // VAT rate used (27%)
        original_price: scrapeResult.originalPrice,
        currency: scrapeResult.currency,
        in_stock: scrapeResult.inStock,
        extracted_product_name: scrapeResult.productName,
        extracted_data: scrapeResult.extractedData,
        raw_html_hash: scrapeResult.rawHtmlHash,
        scrape_duration_ms: scrapeResult.scrapeDurationMs,
        ai_model_used: scrapeResult.aiModelUsed
      })
      .select()
      .single()

    if (priceError) {
      console.error('Error saving price:', priceError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save price data'
      }, { status: 500 })
    }

    // Update link's last_checked_at and clear error
    await supabase
      .from('competitor_product_links')
      .update({ 
        last_checked_at: new Date().toISOString(),
        last_error: null,
        // Also update competitor product name if extracted and not set
        ...(scrapeResult.productName && !link.competitor_product_name ? {
          competitor_product_name: scrapeResult.productName
        } : {})
      })
      .eq('id', linkId)

    // Update competitor's last_scraped_at AND save learned patterns
    const existingConfig = link.competitor?.scrape_config || {}
    const successCount = (existingConfig.successCount || 0) + 1
    
    // Build updated scrape_config with learned patterns
    const updatedScrapeConfig = {
      ...existingConfig,
      // Update with new patterns if they have higher confidence or are new
      ...(scrapeResult.learnedPatterns?.priceSelector && {
        priceSelector: scrapeResult.learnedPatterns.priceSelector
      }),
      ...(scrapeResult.learnedPatterns?.priceFormat && {
        priceFormat: scrapeResult.learnedPatterns.priceFormat
      }),
      ...(scrapeResult.learnedPatterns?.priceContainerHtml && {
        exampleHtml: scrapeResult.learnedPatterns.priceContainerHtml
      }),
      priceType: scrapeResult.priceType !== 'unknown' 
        ? scrapeResult.priceType 
        : existingConfig.priceType,
      vatRate: scrapeResult.vatRate,
      successCount: successCount,
      lastSuccessAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      // Track confidence over time
      averageConfidence: existingConfig.averageConfidence
        ? Math.round((existingConfig.averageConfidence * (successCount - 1) + (scrapeResult.learnedPatterns?.confidence || 50)) / successCount)
        : scrapeResult.learnedPatterns?.confidence || 50
    }

    await supabase
      .from('competitors')
      .update({ 
        last_scraped_at: new Date().toISOString(),
        scrape_config: updatedScrapeConfig
      })
      .eq('id', link.competitor_id)

    console.log(`Updated scrape_config for ${link.competitor.name}: ${successCount} successful scrapes`)

    // Track credit usage for competitor scraping
    await trackAIUsage({
      userId: user.id,
      featureType: 'competitor_price_scrape',
      tokensUsed: scrapeResult.aiModelUsed ? 500 : 0, // Estimate tokens for AI extraction
      modelUsed: scrapeResult.aiModelUsed || 'playwright',
      productId: productId,
      creditsUsed: creditsNeeded,
      creditType: 'competitor_scrape',
      metadata: {
        linkId,
        competitorId: link.competitor_id,
        competitorName: link.competitor?.name,
        price: scrapeResult.price,
        success: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Ár sikeresen ellenőrizve',
      price: priceRecord,
      scrapeResult: {
        price: scrapeResult.price,           // Nettó
        priceGross: scrapeResult.priceGross, // Bruttó
        priceType: scrapeResult.priceType,   // 'gross' or 'net'
        vatRate: scrapeResult.vatRate,
        originalPrice: scrapeResult.originalPrice,
        currency: scrapeResult.currency,
        inStock: scrapeResult.inStock,
        productName: scrapeResult.productName,
        scrapeDurationMs: scrapeResult.scrapeDurationMs,
        confidence: scrapeResult.extractedData?.confidence
      },
      credits: {
        used: creditsNeeded,
        remaining: creditCheck.available - creditsNeeded
      }
    })
  } catch (error: any) {
    console.error('Error during scrape:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to scrape competitor price'
    }, { status: 500 })
  }
}
