/**
 * Competitor Content Scraper
 * Extracts keywords, phrases, and content structure from competitor product pages
 * for use in AI-generated product descriptions
 */

import { fetchPageContent } from './scraper'
import Anthropic from '@anthropic-ai/sdk'

export interface CompetitorContent {
  url: string
  title: string
  keywords: string[]
  keyPhrases: string[]
  description: string | null
  mainFeatures: string[]
  benefits: string[]
  specifications: Record<string, string>
  contentStructure: {
    headings: string[]
    sections: string[]
  }
  error?: string
}

/**
 * Extract content and keywords from a competitor product page using AI
 */
export async function scrapeCompetitorContent(url: string): Promise<CompetitorContent> {
  try {
    // Fetch page content
    const pageContent = await fetchPageContent(url)
    
    // Extract content with AI
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // Truncate HTML if too long (keep important parts)
    let htmlForAnalysis = pageContent.html
    if (htmlForAnalysis.length > 100000) {
      // Keep first 50k and last 50k chars (header + footer + main content)
      htmlForAnalysis = htmlForAnalysis.substring(0, 50000) + 
                       '\n... [middle content truncated] ...\n' + 
                       htmlForAnalysis.substring(htmlForAnalysis.length - 50000)
    }

    const prompt = `Analyze this product page and extract SEO-relevant content, keywords, and structure.

URL: ${url}
Title: ${pageContent.title}

HTML Content (truncated if too long):
${htmlForAnalysis.substring(0, 100000)}

Text Content:
${pageContent.textContent.substring(0, 20000)}

Extract the following information in JSON format:
1. **keywords**: Array of important SEO keywords (5-15 keywords, Hungarian preferred)
2. **keyPhrases**: Array of important phrases customers use (3-8 phrases, Hungarian preferred)
3. **description**: The main product description text (if available, in Hungarian)
4. **mainFeatures**: Array of main product features mentioned (5-10 features, Hungarian)
5. **benefits**: Array of benefits highlighted (3-6 benefits, Hungarian)
6. **specifications**: Object with key-value pairs of specifications (e.g., {"Méret": "400mm", "Teherbírás": "40kg"})
7. **contentStructure**: Object with:
   - headings: Array of main headings (h1, h2, h3) found on the page
   - sections: Array of main content sections identified

Focus on:
- Hungarian keywords and phrases that customers would search for
- Product-specific terminology
- Features and benefits that are emphasized
- Technical specifications
- Content structure that works well for SEO

Return ONLY valid JSON, no markdown, no code blocks. Example format:
{
  "keywords": ["fiókrendszer", "40kg", "teherbírás"],
  "keyPhrases": ["40kg teherbírású fiókrendszer", "teljes kihúzás"],
  "description": "Product description text...",
  "mainFeatures": ["Teljes kihúzás", "40kg teherbírás"],
  "benefits": ["Könnyű használat", "Tartós kivitel"],
  "specifications": {"Méret": "400mm", "Teherbírás": "40kg"},
  "contentStructure": {
    "headings": ["Termékleírás", "Specifikációk"],
    "sections": ["Áttekintés", "Jellemzők", "Specifikációk"]
  }
}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', // Use cheaper model for content extraction
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI')
    }

    // Parse JSON response
    let extracted: Partial<CompetitorContent>
    try {
      // Remove any markdown code blocks if present
      const jsonText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(jsonText)
    } catch (parseError) {
      console.error(`Failed to parse competitor content JSON for ${url}:`, parseError)
      // Fallback: extract basic info
      extracted = {
        keywords: extractBasicKeywords(pageContent.textContent),
        keyPhrases: [],
        mainFeatures: [],
        benefits: [],
        specifications: {},
        contentStructure: {
          headings: [],
          sections: []
        }
      }
    }

    return {
      url,
      title: pageContent.title,
      keywords: extracted.keywords || [],
      keyPhrases: extracted.keyPhrases || [],
      description: extracted.description || null,
      mainFeatures: extracted.mainFeatures || [],
      benefits: extracted.benefits || [],
      specifications: extracted.specifications || {},
      contentStructure: extracted.contentStructure || { headings: [], sections: [] }
    }
  } catch (error: any) {
    console.error(`Error scraping competitor content from ${url}:`, error)
    return {
      url,
      title: '',
      keywords: [],
      keyPhrases: [],
      description: null,
      mainFeatures: [],
      benefits: [],
      specifications: {},
      contentStructure: { headings: [], sections: [] },
      error: error.message || 'Failed to scrape content'
    }
  }
}

/**
 * Extract basic keywords from text (fallback method)
 */
function extractBasicKeywords(text: string): string[] {
  // Simple keyword extraction: find Hungarian words that are likely product-related
  const words = text.toLowerCase()
    .replace(/[^\w\sáéíóöőúüű]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
  
  // Common Hungarian product-related words
  const productTerms = [
    'fiók', 'rendszer', 'csukló', 'csúszka', 'teherbírás', 'méret',
    'szín', 'anyag', 'beszerelés', 'kivitel', 'minőség', 'tartós',
    'könnyű', 'praktikus', 'konyha', 'szekrény', 'gránit', 'kompozit'
  ]
  
  const found = new Set<string>()
  for (const word of words) {
    if (productTerms.some(term => word.includes(term) || term.includes(word))) {
      found.add(word)
    }
  }
  
  return Array.from(found).slice(0, 10)
}

/**
 * Scrape multiple competitor URLs and aggregate content
 */
export async function scrapeMultipleCompetitorContents(urls: string[]): Promise<CompetitorContent[]> {
  const results: CompetitorContent[] = []
  
  // Process with limited concurrency to avoid rate limits
  const CONCURRENCY = 2
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(url => scrapeCompetitorContent(url))
    )
    results.push(...batchResults)
    
    // Delay between batches
    if (i + CONCURRENCY < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  return results
}

/**
 * Aggregate competitor content into a single set of keywords and insights
 */
export function aggregateCompetitorContent(contents: CompetitorContent[]): {
  allKeywords: string[]
  allKeyPhrases: string[]
  commonFeatures: string[]
  commonBenefits: string[]
  contentStructureInsights: string[]
} {
  const keywordCounts = new Map<string, number>()
  const phraseCounts = new Map<string, number>()
  const featureCounts = new Map<string, number>()
  const benefitCounts = new Map<string, number>()
  const structureInsights: string[] = []
  
  for (const content of contents) {
    // Count keywords
    for (const keyword of content.keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1)
    }
    
    // Count phrases
    for (const phrase of content.keyPhrases) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1)
    }
    
    // Count features
    for (const feature of content.mainFeatures) {
      featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1)
    }
    
    // Count benefits
    for (const benefit of content.benefits) {
      benefitCounts.set(benefit, (benefitCounts.get(benefit) || 0) + 1)
    }
    
    // Collect structure insights
    if (content.contentStructure.headings.length > 0) {
      structureInsights.push(...content.contentStructure.headings)
    }
    if (content.contentStructure.sections.length > 0) {
      structureInsights.push(...content.contentStructure.sections)
    }
  }
  
  // Get top keywords (appearing in 2+ competitors or high frequency)
  const allKeywords = Array.from(keywordCounts.entries())
    .filter(([_, count]) => count >= 2 || count >= contents.length * 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword]) => keyword)
  
  // Get top phrases
  const allKeyPhrases = Array.from(phraseCounts.entries())
    .filter(([_, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase]) => phrase)
  
  // Get common features (appearing in 2+ competitors)
  const commonFeatures = Array.from(featureCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([feature]) => feature)
  
  // Get common benefits
  const commonBenefits = Array.from(benefitCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8)
    .map(([benefit]) => benefit)
  
  return {
    allKeywords,
    allKeyPhrases,
    commonFeatures,
    commonBenefits,
    contentStructureInsights: Array.from(new Set(structureInsights)).slice(0, 10)
  }
}
