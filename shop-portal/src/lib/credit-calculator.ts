/**
 * Credit Calculator for AI Features
 * Calculates credit cost for different AI operations
 */

export type AIFeatureType = 
  | 'meta_title' 
  | 'meta_keywords' 
  | 'meta_description' 
  | 'url_slug' 
  | 'product_tags'
  | 'product_description'
  | 'category_description'
  | 'category_meta'
  | 'image_alt_text'
  | 'competitor_price_scrape'
  | 'competitor_content_scrape'

/**
 * Calculate credits needed for an AI generation feature
 */
export function calculateCreditsForAI(
  featureType: AIFeatureType,
  tokensUsed?: number
): number {
  const creditMap: Record<AIFeatureType, number> = {
    'meta_title': 1,
    'meta_keywords': 1,
    'meta_description': 1,
    'url_slug': 1,
    'product_tags': 1,
    'product_description': 5, // More expensive - large token usage
    'category_description': 3,
    'category_meta': 1,
    'image_alt_text': 1, // Image alt text generation
    'competitor_price_scrape': 2, // Playwright + AI extraction
    'competitor_content_scrape': 3, // HTML fetch + AI analysis
  }
  
  return creditMap[featureType] || 1
}

/**
 * Calculate credits for competitor scraping
 */
export function calculateCreditsForCompetitor(
  scrapeType: 'price' | 'content'
): number {
  return scrapeType === 'price' ? 2 : 3
}

/**
 * Get credit cost display text for UI
 */
export function getCreditCostText(featureType: AIFeatureType): string {
  const credits = calculateCreditsForAI(featureType)
  if (credits === 1) {
    return '1 credit'
  }
  return `${credits} credits`
}
