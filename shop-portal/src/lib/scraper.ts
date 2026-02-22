/**
 * Web Scraper Utility
 * Uses Playwright for JS-rendered pages and Claude AI for price extraction
 */

import { chromium } from 'playwright'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Retry helper with exponential backoff for API calls
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
      
      // Check if it's an overloaded error or rate limit
      const isRetryable = 
        error?.message?.includes('overloaded') ||
        error?.message?.includes('Overloaded') ||
        error?.status === 529 ||
        error?.status === 429 ||
        error?.error?.type === 'overloaded_error'
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error
      }
      
      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = baseDelayMs * Math.pow(2, attempt)
      console.log(`API overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

interface ScrapeResult {
  success: boolean
  price: number | null           // Nettó price (for comparison)
  priceGross: number | null      // Bruttó price (original scraped)
  priceType: 'gross' | 'net' | 'unknown'  // What type was scraped
  vatRate: number                // VAT rate used for conversion (default 27%)
  originalPrice: number | null   // Original/list price before discount
  currency: string
  inStock: boolean | null
  productName: string | null
  rawHtmlHash: string
  scrapeDurationMs: number
  aiModelUsed: string
  error?: string
  extractedData?: Record<string, any>
  // Learning data - patterns discovered during this scrape
  learnedPatterns?: LearnedPatterns
}

/**
 * Learned patterns from successful scrapes
 * These are saved to the competitor's scrape_config for future use
 */
export interface LearnedPatterns {
  priceSelector?: string        // CSS selector where price was found
  priceFormat?: string          // How price is formatted (e.g., "12 345 Ft")
  priceContainerHtml?: string   // Example HTML snippet of the price area
  detectedPriceType: 'gross' | 'net' | 'unknown'
  detectedVatRate: number
  currencySymbol?: string
  confidence: number
  extractedAt: string
}

/**
 * Scrape configuration hints from previous successful scrapes
 */
export interface ScrapeConfig {
  priceSelector?: string
  priceFormat?: string
  exampleHtml?: string
  priceType?: 'gross' | 'net'
  vatRate?: number
  successCount?: number
  lastSuccessAt?: string
  lastUpdatedAt?: string
}

interface PageContent {
  html: string
  textContent: string
  title: string
  url: string
}

/**
 * Fetch page content using Playwright headless browser
 */
export async function fetchPageContent(url: string): Promise<PageContent> {
  let browser
  
  try {
    // Try to launch with Playwright's bundled Chromium
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
      const helpfulError = new Error(
        'Playwright browser not installed. Please run: npx playwright install chromium\n' +
        'Original error: ' + error.message
      )
      helpfulError.stack = error.stack
      throw helpfulError
    }
    throw error
  }

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'hu-HU'
    })

    const page = await context.newPage()
    
    // Set cookies to accept any cookie consent
    await context.addCookies([
      { name: 'cookieconsent_status', value: 'allow', domain: new URL(url).hostname, path: '/' },
      { name: 'cookie_consent', value: 'true', domain: new URL(url).hostname, path: '/' }
    ])

    // Navigate with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })

    // Wait for price elements to load (common selectors)
    await page.waitForTimeout(2000)

    // Try to close any cookie popups
    try {
      const cookieSelectors = [
        'button:has-text("Elfogadom")',
        'button:has-text("Rendben")',
        'button:has-text("OK")',
        'button:has-text("Accept")',
        '[class*="cookie"] button',
        '[id*="cookie"] button'
      ]
      
      for (const selector of cookieSelectors) {
        const btn = page.locator(selector).first()
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click().catch(() => {})
          break
        }
      }
    } catch {
      // Ignore cookie popup errors
    }

    // Get page content
    const html = await page.content()
    const textContent = await page.evaluate(() => document.body?.innerText || '')
    const title = await page.title()

    return { html, textContent, title, url }
  } finally {
    await browser.close()
  }
}

/**
 * Extract price using Claude AI
 * @param pageContent - The page content to analyze
 * @param hints - Optional hints from previous successful scrapes (from competitor's scrape_config)
 */
export async function extractPriceWithAI(
  pageContent: PageContent, 
  hints?: ScrapeConfig
): Promise<ScrapeResult> {
  const startTime = Date.now()
  
  // Create a hash of the HTML for change detection
  const rawHtmlHash = await hashString(pageContent.html)
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  // Truncate HTML if too long (keep important parts)
  let htmlForAnalysis = pageContent.html
  if (htmlForAnalysis.length > 50000) {
    // Keep first 25k and last 25k characters
    htmlForAnalysis = htmlForAnalysis.substring(0, 25000) + '\n...[truncated]...\n' + htmlForAnalysis.substring(htmlForAnalysis.length - 25000)
  }

  // Build hints section if we have learned patterns
  let hintsSection = ''
  if (hints && hints.successCount && hints.successCount > 0) {
    hintsSection = `
LEARNED PATTERNS FROM PREVIOUS SUCCESSFUL SCRAPES (${hints.successCount} successful extractions):
- Price is typically ${hints.priceType || 'gross'} (${hints.priceType === 'net' ? 'without VAT' : 'with VAT'})
- VAT rate: ${hints.vatRate || 27}%
${hints.priceSelector ? `- Price is usually found in: ${hints.priceSelector}` : ''}
${hints.priceFormat ? `- Price format example: ${hints.priceFormat}` : ''}
${hints.exampleHtml ? `- Example HTML from previous scrape:\n${hints.exampleHtml.substring(0, 500)}` : ''}

USE THESE PATTERNS as a starting point, but verify they still match the current page structure.
`
  }

  const prompt = `You are a price extraction expert. Analyze this Hungarian e-commerce product page and extract pricing information.

URL: ${pageContent.url}
Page Title: ${pageContent.title}
${hintsSection}
TEXT CONTENT:
${pageContent.textContent.substring(0, 10000)}

HTML (truncated):
${htmlForAnalysis.substring(0, 30000)}

Extract the following information in JSON format:
{
  "price": <number or null - the current selling price in Hungarian Forint (HUF), WITHOUT "Ft" suffix, just the number>,
  "originalPrice": <number or null - the original/list price if there's a discount, otherwise null>,
  "priceType": <"gross" or "net" or "unknown" - whether the price includes VAT (ÁFA)>,
  "currency": "HUF",
  "inStock": <boolean or null - true if in stock, false if out of stock, null if unknown>,
  "productName": <string or null - the product name as shown on the page>,
  "confidence": <number 0-100 - how confident you are in the extraction>,
  "priceSelector": <string or null - CSS selector that could be used to find this price element>,
  "priceContainerHtml": <string or null - a SHORT (max 200 chars) HTML snippet showing the price element and its immediate parent>
}

CRITICAL - Price Type Detection:
- "Bruttó ár", "ÁFA-val", "ÁFÁ-val", "27% ÁFA", "Ft/db" without net mention = "gross" (includes VAT)
- "Nettó ár", "ÁFA nélkül", "Nettó:", "+ ÁFA" = "net" (without VAT)
- Most B2C Hungarian webshops show GROSS (bruttó) prices by default
- B2B sites may show NET prices
- If you see both, extract the GROSS price (what customer pays)
- If uncertain, assume "gross" for Hungarian retail sites

Other Important Notes:
- Hungarian prices often use spaces as thousand separators (e.g., "12 345 Ft" = 12345)
- Look for prices near "Ár:", "Akciós ár:", "Bruttó ár:", "Nettó ár:" labels
- The main price is usually the largest, most prominent price on the page
- If you see multiple prices, prefer the "current" or "discounted" price over the "original" price
- For priceSelector, try to identify a reusable CSS selector (class or ID based)
- Return ONLY the JSON object, no other text`

  try {
    // Using Haiku for faster extraction (10x faster than Sonnet, still accurate for simple price extraction)
    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        { role: 'user', content: prompt }
      ]
    }))

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const extracted = JSON.parse(jsonMatch[0])
    
    const scrapeDurationMs = Date.now() - startTime

    // Determine price type (default to gross for Hungarian retail)
    const priceType: 'gross' | 'net' | 'unknown' = extracted.priceType || 'gross'
    const vatRate = 27 // Hungarian VAT rate
    
    // Calculate nettó price for comparison
    let priceNet: number | null = null
    let priceGross: number | null = null
    
    if (extracted.price !== null && extracted.price !== undefined) {
      if (priceType === 'gross') {
        // Scraped price is bruttó, calculate nettó
        priceGross = extracted.price
        priceNet = Math.round((extracted.price / (1 + vatRate / 100)) * 100) / 100
      } else if (priceType === 'net') {
        // Scraped price is already nettó
        priceNet = extracted.price
        priceGross = Math.round((extracted.price * (1 + vatRate / 100)) * 100) / 100
      } else {
        // Unknown - assume gross (most common for Hungarian retail)
        priceGross = extracted.price
        priceNet = Math.round((extracted.price / (1 + vatRate / 100)) * 100) / 100
      }
    }

    // Build learned patterns for saving back to competitor config
    const learnedPatterns: LearnedPatterns = {
      priceSelector: extracted.priceSelector || undefined,
      priceFormat: extracted.price ? `${extracted.price.toLocaleString('hu-HU')} Ft` : undefined,
      priceContainerHtml: extracted.priceContainerHtml || undefined,
      detectedPriceType: priceType,
      detectedVatRate: vatRate,
      currencySymbol: 'Ft',
      confidence: extracted.confidence || 50,
      extractedAt: new Date().toISOString()
    }

    return {
      success: true,
      price: priceNet,              // Nettó for comparison
      priceGross: priceGross,       // Original bruttó
      priceType: priceType,
      vatRate: vatRate,
      originalPrice: extracted.originalPrice,
      currency: extracted.currency || 'HUF',
      inStock: extracted.inStock,
      productName: extracted.productName,
      rawHtmlHash,
      learnedPatterns,              // Include learned patterns for saving
      scrapeDurationMs,
      aiModelUsed: 'claude-haiku-4-5-20251001',
      extractedData: {
        confidence: extracted.confidence,
        pageTitle: pageContent.title,
        scrapedPriceType: priceType
      }
    }
  } catch (error: any) {
    const scrapeDurationMs = Date.now() - startTime
    
    return {
      success: false,
      price: null,
      priceGross: null,
      priceType: 'unknown' as const,
      vatRate: 27,
      originalPrice: null,
      currency: 'HUF',
      inStock: null,
      productName: null,
      rawHtmlHash,
      scrapeDurationMs,
      aiModelUsed: 'claude-haiku-4-5-20251001',
      error: error.message || 'Unknown error during AI extraction'
    }
  }
}

/**
 * Full scrape: fetch page and extract price
 */
/**
 * Scrape a competitor product page for price
 * @param url - The product page URL to scrape
 * @param hints - Optional hints from previous successful scrapes
 */
export async function scrapeCompetitorPrice(
  url: string, 
  hints?: ScrapeConfig
): Promise<ScrapeResult> {
  try {
    // Fetch page content with Playwright
    const pageContent = await fetchPageContent(url)
    
    // Extract price with AI (pass hints if available)
    const result = await extractPriceWithAI(pageContent, hints)
    
    return result
  } catch (error: any) {
    return {
      success: false,
      price: null,
      priceGross: null,
      priceType: 'unknown',
      vatRate: 27,
      originalPrice: null,
      currency: 'HUF',
      inStock: null,
      productName: null,
      rawHtmlHash: '',
      scrapeDurationMs: 0,
      aiModelUsed: 'claude-haiku-4-5-20251001',
      error: error.message || 'Failed to fetch page'
    }
  }
}

/**
 * Simple string hash function
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
}

