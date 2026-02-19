// Content Extraction Service
// Handles extraction of text from PDFs, URLs, and direct text input

// Dynamic import for pdf-parse (CommonJS module)
async function loadPdfParse() {
  const pdfParseModule = await import('pdf-parse')
  return pdfParseModule.default || pdfParseModule
}
import * as cheerio from 'cheerio'

export interface ExtractedContent {
  text: string
  metadata: {
    pages?: number
    wordCount?: number
    language?: string
    title?: string
    headings?: string[]
    [key: string]: any
  }
  structured?: {
    tables?: any[]
    lists?: string[]
  }
}

/**
 * Extract text content from PDF file
 */
export async function extractPDFContent(fileBuffer: Buffer): Promise<ExtractedContent> {
  try {
    const pdfParse = await loadPdfParse()
    const pdfData = await pdfParse(fileBuffer)
    
    return {
      text: pdfData.text,
      metadata: {
        pages: pdfData.numpages,
        wordCount: pdfData.text.split(/\s+/).length,
        info: pdfData.info,
        metadata: pdfData.metadata
      },
      structured: {
        // Can be extended to extract tables, lists, etc.
      }
    }
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Scrape and extract content from URL
 */
export async function scrapeURLContent(url: string): Promise<ExtractedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove script and style elements
    $('script, style, nav, footer, header, aside').remove()

    // Extract main content
    const mainContent = $('main, article, .content, .post-content, #content').first()
    const contentText = mainContent.length > 0 
      ? mainContent.text() 
      : $('body').text()

    // Extract headings
    const headings: string[] = []
    $('h1, h2, h3').each((_, el) => {
      const headingText = $(el).text().trim()
      if (headingText) headings.push(headingText)
    })

    // Clean up text
    const cleanedText = contentText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()

    return {
      text: cleanedText,
      metadata: {
        title: $('title').text() || $('h1').first().text(),
        metaDescription: $('meta[name="description"]').attr('content') || '',
        headings: headings.slice(0, 20), // Limit to first 20 headings
        wordCount: cleanedText.split(/\s+/).length
      }
    }
  } catch (error) {
    throw new Error(`URL scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process direct text input
 */
export async function processTextContent(text: string): Promise<ExtractedContent> {
  // Clean and normalize text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    text: cleanedText,
    metadata: {
      wordCount: cleanedText.split(/\s+/).length,
      characterCount: cleanedText.length
    }
  }
}
