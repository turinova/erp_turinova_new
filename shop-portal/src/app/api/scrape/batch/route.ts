/**
 * Batch Scraping API
 * Scrapes multiple URLs in parallel using a shared browser instance for maximum performance
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { chromium, Browser, BrowserContext } from 'playwright'
import Anthropic from '@anthropic-ai/sdk'

interface ScrapeRequest {
  linkId: string
  productId: string
  competitorId: string
  url: string
}

interface ScrapeResult {
  linkId: string
  success: boolean
  price: number | null
  priceGross: number | null
  priceType: 'gross' | 'net' | 'unknown'
  productName: string | null
  error?: string
}

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      const isRetryable = 
        error?.message?.includes('overloaded') ||
        error?.message?.includes('Overloaded') ||
        error?.status === 529 ||
        error?.status === 429 ||
        error?.error?.type === 'overloaded_error'
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Extract price using AI (Haiku for speed)
 * OPTIMIZED: Minimal prompt to avoid rate limits
 */
async function extractPriceWithAI(
  anthropic: Anthropic,
  url: string,
  textContent: string,
  html: string
): Promise<{ price: number | null; priceGross: number | null; priceType: 'gross' | 'net' | 'unknown'; productName: string | null }> {
  
  // Extract only price-relevant sections to minimize tokens
  // Look for price patterns in text first
  const priceRegex = /(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?)\s*(?:Ft|HUF|forint)/gi
  const priceMatches = textContent.match(priceRegex) || []
  
  // Get a smaller relevant section (only first 2000 chars of text)
  const shortText = textContent.substring(0, 2000)

  const prompt = `Extract the main selling price from this Hungarian product page.

URL: ${url}
Detected prices: ${priceMatches.slice(0, 5).join(', ') || 'none found'}
Page text (short): ${shortText}

Return ONLY JSON: {"price":<number>,"priceType":"gross"|"net","productName":"<name>"}
- price: number in HUF without Ft (12 345 Ft = 12345)
- priceType: "gross" if includes VAT, "net" if without (assume gross for retail)
- productName: the product name`

  let message
  try {
    message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    }))
  } catch (aiError: any) {
    console.error('AI extraction error:', aiError.message || aiError)
    throw new Error(`AI error: ${aiError.status || ''} ${aiError.message || 'Unknown AI error'}`)
  }

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    console.error('No JSON in AI response:', responseText.substring(0, 200))
    return { price: null, priceGross: null, priceType: 'unknown', productName: null }
  }

  let extracted
  try {
    extracted = JSON.parse(jsonMatch[0])
  } catch (parseError) {
    console.error('JSON parse error:', jsonMatch[0].substring(0, 200))
    return { price: null, priceGross: null, priceType: 'unknown', productName: null }
  }
  const priceType = extracted.priceType || 'gross'
  const vatRate = 27

  let priceNet: number | null = null
  let priceGross: number | null = null

  if (extracted.price !== null && extracted.price !== undefined) {
    if (priceType === 'gross') {
      priceGross = extracted.price
      priceNet = Math.round((extracted.price / (1 + vatRate / 100)) * 100) / 100
    } else {
      priceNet = extracted.price
      priceGross = Math.round((extracted.price * (1 + vatRate / 100)) * 100) / 100
    }
  }

  return {
    price: priceNet,
    priceGross: priceGross,
    priceType: priceType,
    productName: extracted.productName || null
  }
}

/**
 * Scrape a single page using an existing browser context
 */
async function scrapeSinglePage(
  browser: Browser,
  anthropic: Anthropic,
  request: ScrapeRequest
): Promise<ScrapeResult> {
  let context: BrowserContext | null = null
  
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'hu-HU'
    })

    // Set cookies to accept consent
    await context.addCookies([
      { name: 'cookieconsent_status', value: 'allow', domain: new URL(request.url).hostname, path: '/' },
      { name: 'cookie_consent', value: 'true', domain: new URL(request.url).hostname, path: '/' }
    ])

    const page = await context.newPage()
    
    // Faster navigation - don't wait for all resources
    await page.goto(request.url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    })

    // Short wait for price elements
    await page.waitForTimeout(1000)

    // Get content
    const html = await page.content()
    const textContent = await page.evaluate(() => document.body?.innerText || '')

    // Extract with AI
    const extracted = await extractPriceWithAI(anthropic, request.url, textContent, html)

    return {
      linkId: request.linkId,
      success: extracted.price !== null,
      price: extracted.price,
      priceGross: extracted.priceGross,
      priceType: extracted.priceType,
      productName: extracted.productName
    }
  } catch (error: any) {
    console.error(`Scrape failed for ${request.url}:`, error.message || error)
    return {
      linkId: request.linkId,
      success: false,
      price: null,
      priceGross: null,
      priceType: 'unknown',
      productName: null,
      error: `${error.status || ''} ${error.message || 'Failed to scrape'}`.trim()
    }
  } finally {
    if (context) {
      await context.close().catch(() => {})
    }
  }
}

/**
 * POST /api/scrape/batch
 * Batch scrape multiple URLs using a shared browser
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const { requests } = await request.json() as { requests: ScrapeRequest[] }

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ error: 'No requests provided' }, { status: 400 })
    }

    // Limit batch size
    if (requests.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 URLs per batch' }, { status: 400 })
    }

    // Auth check
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize browser ONCE for all requests
    let browser
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      })
    } catch (error: any) {
      // If Playwright's browser is missing, provide a helpful error message
      if (error.message?.includes('Executable doesn\'t exist') || error.message?.includes('browserType.launch')) {
        return NextResponse.json({ 
          error: 'Playwright browser not installed. Please run: npx playwright install chromium',
          details: error.message
        }, { status: 500 })
      }
      throw error
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    try {
      // Process URLs with controlled concurrency (2 at a time to avoid rate limits)
      const CONCURRENCY = 2
      const results: ScrapeResult[] = []
      
      for (let i = 0; i < requests.length; i += CONCURRENCY) {
        const batch = requests.slice(i, i + CONCURRENCY)
        const batchResults = await Promise.all(
          batch.map(req => scrapeSinglePage(browser, anthropic, req))
        )
        results.push(...batchResults)
        
        // Delay between batches to respect rate limits (50k tokens/min)
        if (i + CONCURRENCY < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // Save results to database
      for (const result of results) {
        if (result.success && result.price !== null) {
          // Find the link to get product_id
          const req = requests.find(r => r.linkId === result.linkId)
          if (!req) continue

          // Save price
          await supabase
            .from('competitor_prices')
            .insert({
              competitor_product_link_id: result.linkId,
              price: result.price,
              price_gross: result.priceGross,
              price_type: result.priceType,
              vat_rate: 27,
              currency: 'HUF'
            })

          // Update link
          await supabase
            .from('competitor_product_links')
            .update({
              last_checked_at: new Date().toISOString(),
              last_error: null,
              competitor_product_name: result.productName
            })
            .eq('id', result.linkId)
        } else if (result.error) {
          // Update link with error
          await supabase
            .from('competitor_product_links')
            .update({
              last_checked_at: new Date().toISOString(),
              last_error: result.error
            })
            .eq('id', result.linkId)
        }
      }

      const duration = Date.now() - startTime

      return NextResponse.json({
        success: true,
        results,
        stats: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          durationMs: duration,
          avgPerUrl: Math.round(duration / results.length)
        }
      })
    } finally {
      await browser.close()
    }
  } catch (error: any) {
    console.error('Batch scrape error:', error)
    return NextResponse.json({ 
      error: error.message || 'Batch scrape failed' 
    }, { status: 500 })
  }
}
