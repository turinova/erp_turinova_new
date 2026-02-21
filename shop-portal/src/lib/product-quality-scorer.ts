// Product Quality Scorer
// Calculates quality scores for products based on SEO and data completeness factors

export interface QualityScoreResult {
  overall_score: number
  content_score: number
  image_score: number
  technical_score: number
  performance_score: number
  completeness_score: number
  competitive_score: number
  priority_score: number
  is_parent: boolean
  issues: Array<{
    type: string
    severity: 'critical' | 'warning' | 'info'
    message: string
    points_lost: number
  }>
  blocking_issues: string[]
}

export interface ProductData {
  id: string
  connection_id: string
  parent_product_id: string | null
  sku: string
  name: string | null
  model_number: string | null
  gtin: string | null
  price: number | null
  status: number
  url_slug: string | null
  sync_status: string
  sync_error: string | null
  product_attributes: Array<{
    type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
    name: string
    value: any
  }> | null
  // Description data
  description?: {
    description: string | null
    meta_title: string | null
    meta_description: string | null
  } | null
  // Image data
  images?: Array<{
    alt_text: string | null
    alt_text_status: string
  }> | null
  // Search Console data (from parent if child)
  search_console?: {
    impressions: number
    clicks: number
    avg_position: number
    avg_ctr: number
  } | null
  // Indexing status
  indexing_status?: {
    is_indexed: boolean
    has_issues: boolean
    coverage_state?: string | null
    indexing_state?: string | null
    // Enhanced fields
    page_fetch_state?: string | null
    page_fetch_error?: string | null
    mobile_usability_issues?: Array<{
      issue: string
      severity: 'ERROR' | 'WARNING'
      description: string
    }> | null
    mobile_usability_passed?: boolean
    core_web_vitals?: {
      lcp?: number | null
      inp?: number | null
      cls?: number | null
    } | null
    structured_data_issues?: Array<{
      type: string
      severity: 'ERROR' | 'WARNING'
      message: string
    }> | null
    rich_results_eligible?: string[] | null
    sitemap_status?: string | null
  } | null
  // Competitor data
  competitor_tracking_enabled: boolean
  competitor_price?: number | null
}

/**
 * Count attributes that have actual values (not empty/null)
 */
function countAttributesWithValues(attributes: ProductData['product_attributes']): number {
  if (!attributes || !Array.isArray(attributes)) {
    return 0
  }
  
  return attributes.filter(attr => {
    if (!attr || !attr.value) {
      return false
    }
    
    // For LIST attributes, check if array has values
    if (attr.type === 'LIST') {
      return Array.isArray(attr.value) && attr.value.length > 0
    }
    
    // For TEXT attributes, check if string is not empty
    if (attr.type === 'TEXT') {
      if (Array.isArray(attr.value)) {
        // TEXT can also be an array of objects with value property
        return attr.value.some((v: any) => v && v.value && String(v.value).trim().length > 0)
      }
      return String(attr.value).trim().length > 0
    }
    
    // For INTEGER/FLOAT, check if it's a valid number
    if (attr.type === 'INTEGER' || attr.type === 'FLOAT') {
      const num = typeof attr.value === 'number' ? attr.value : parseFloat(attr.value)
      return !isNaN(num)
    }
    
    // Default: check if value exists and is truthy
    return !!attr.value
  }).length
}

/**
 * Calculate quality score for a product
 */
export function calculateProductQualityScore(product: ProductData): QualityScoreResult {
  // Determine if parent or child
  const isParent = !product.parent_product_id || product.parent_product_id === product.id
  
  if (isParent) {
    return calculateParentProductScore(product)
  } else {
    return calculateChildProductScore(product)
  }
}

/**
 * Calculate score for parent/standalone products
 */
function calculateParentProductScore(product: ProductData): QualityScoreResult {
  const issues: QualityScoreResult['issues'] = []
  const blockingIssues: string[] = []
  
  // ===== CATEGORY 1: CONTENT QUALITY (35 points max) =====
  let contentScore = 0
  
  // Description presence (0-10 points)
  const description = product.description?.description || ''
  const descriptionLength = description.length
  
  // Debug logging
  console.log('[QUALITY SCORE] Content scoring for product:', product.sku)
  console.log('[QUALITY SCORE] Description length:', descriptionLength)
  console.log('[QUALITY SCORE] Has description object:', !!product.description)
  console.log('[QUALITY SCORE] Meta title:', product.description?.meta_title || 'MISSING')
  console.log('[QUALITY SCORE] Meta description:', product.description?.meta_description || 'MISSING')
  
  let descPresencePoints = 0
  if (descriptionLength === 0) {
    issues.push({
      type: 'missing_description',
      severity: 'critical',
      message: 'Nincs termékleírás',
      points_lost: 10
    })
    blockingIssues.push('missing_description')
  } else if (descriptionLength < 100) {
    descPresencePoints = 3
    contentScore += 3
    issues.push({
      type: 'short_description',
      severity: 'warning',
      message: `Rövid leírás (${descriptionLength} karakter)`,
      points_lost: 7
    })
  } else if (descriptionLength < 500) {
    descPresencePoints = 7
    contentScore += 7
  } else {
    descPresencePoints = 10
    contentScore += 10
  }
  console.log('[QUALITY SCORE] Description presence points:', descPresencePoints)
  
  // Description quality (0-10 points)
  let descQualityPoints = 0
  if (descriptionLength > 0) {
    let qualityPoints = 0
    // Check for length (redundant but ensures minimum quality)
    if (descriptionLength > 100) {
      qualityPoints += 2
      console.log('[QUALITY SCORE] Quality: +2 for length > 100')
    }
    // Check for keywords (basic - could check if name appears)
    // Try to match product name or key parts of it (SKU, model number, or main product name)
    // Decode HTML entities first (e.g., &lt;h2&gt; becomes <h2>)
    let nameMatch = false
    if (product.name) {
      const productNameLower = product.name.toLowerCase()
      // Decode HTML entities for matching
      let descForMatching = description
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
      const descLower = descForMatching.toLowerCase()
      
      // Debug: Show what we're searching for and a sample of the description
      console.log('[QUALITY SCORE] Quality: Searching for product name:', productNameLower)
      console.log('[QUALITY SCORE] Quality: Searching for SKU:', product.sku?.toLowerCase() || 'N/A')
      console.log('[QUALITY SCORE] Quality: Description sample (first 200 chars after decode):', descLower.substring(0, 200))
      
      // Try exact match first
      if (descLower.includes(productNameLower)) {
        nameMatch = true
        console.log('[QUALITY SCORE] Quality: Found exact product name match')
      } else {
        // Try matching SKU first (most reliable identifier)
        if (product.sku) {
          const skuLower = product.sku.toLowerCase()
          if (descLower.includes(skuLower)) {
            nameMatch = true
            console.log('[QUALITY SCORE] Quality: Found SKU match:', product.sku)
          } else {
            console.log('[QUALITY SCORE] Quality: SKU not found. Looking for:', skuLower, 'in description')
          }
        }
        
        // Try model number
        if (!nameMatch && product.model_number) {
          const modelLower = product.model_number.toLowerCase()
          if (descLower.includes(modelLower)) {
            nameMatch = true
            console.log('[QUALITY SCORE] Quality: Found model number match:', product.model_number)
          }
        }
        
        // Try matching first significant words (e.g., "K-StrongMax 89" from "K-StrongMax 89 40kg, sötétszürke")
        if (!nameMatch) {
          const nameWords = productNameLower.split(/[\s,]+/).filter(w => w.length > 2 && !w.match(/^\d+[a-z]*$/))
          if (nameWords.length > 0) {
            // Try first 2 words, then first 3 words if needed
            const mainName2 = nameWords.slice(0, 2).join(' ')
            const mainName3 = nameWords.length >= 3 ? nameWords.slice(0, 3).join(' ') : ''
            if (descLower.includes(mainName2)) {
              nameMatch = true
              console.log('[QUALITY SCORE] Quality: Found main name match (2 words):', mainName2)
            } else if (mainName3 && descLower.includes(mainName3)) {
              nameMatch = true
              console.log('[QUALITY SCORE] Quality: Found main name match (3 words):', mainName3)
            }
          }
        }
      }
    }
    
    // Check for ShopRenter dynamic tags (valid placeholders that will be replaced with actual values)
    const hasDynamicTags = description.includes('[PRODUCT]') || 
                          description.includes('[SKU]') || 
                          description.includes('[SERIAL]')
    
    if (nameMatch || hasDynamicTags) {
      qualityPoints += 3
      if (hasDynamicTags) {
        console.log('[QUALITY SCORE] Quality: +3 for ShopRenter dynamic tags ([PRODUCT], [SKU], etc.) in description')
      } else {
        console.log('[QUALITY SCORE] Quality: +3 for product name/SKU in description')
      }
    } else {
      console.log('[QUALITY SCORE] Quality: Product name not found in description. Product name:', product.name, 'SKU:', product.sku)
    }
    // Check for Q&A section (multiple indicators)
    const hasQA = description.includes('?') || 
                  description.includes('Gyakran ismételt kérdések') ||
                  description.includes('Gyakori kérdések') ||
                  description.includes('<h3>') // Q&A questions are typically in h3 tags
    if (hasQA) {
      qualityPoints += 2
      console.log('[QUALITY SCORE] Quality: +2 for Q&A section')
    }
    // Formatting check (has paragraphs/line breaks/HTML structure)
    // Check for HTML tags (case-insensitive and handle escaped HTML like &lt;h2&gt;)
    const descLower = description.toLowerCase()
    const hasFormatting = description.includes('\n') || 
                          descLower.includes('<p>') ||
                          descLower.includes('</p>') ||
                          descLower.includes('&lt;p&gt;') || // Escaped HTML
                          descLower.includes('&lt;/p&gt;') ||
                          descLower.includes('<h2>') || // Section headings
                          descLower.includes('</h2>') ||
                          descLower.includes('&lt;h2&gt;') || // Escaped HTML
                          descLower.includes('&lt;/h2&gt;') ||
                          descLower.includes('<h3>') || // Subsections/Q&A
                          descLower.includes('</h3>') ||
                          descLower.includes('&lt;h3&gt;') || // Escaped HTML
                          descLower.includes('&lt;/h3&gt;') ||
                          descLower.includes('<ul>') || // Lists
                          descLower.includes('</ul>') ||
                          descLower.includes('&lt;ul&gt;') || // Escaped HTML
                          descLower.includes('&lt;/ul&gt;') ||
                          descLower.includes('<li>') ||  // List items
                          descLower.includes('</li>') ||
                          descLower.includes('&lt;li&gt;') || // Escaped HTML
                          descLower.includes('&lt;/li&gt;')
    if (hasFormatting) {
      qualityPoints += 2
      console.log('[QUALITY SCORE] Quality: +2 for HTML formatting (including escaped HTML)')
    } else {
      console.log('[QUALITY SCORE] Quality: No HTML formatting detected')
    }
    
    // Check for structured content (multiple sections)
    // Use case-insensitive regex to find h2 tags (handle both opening and closing tags)
    // Also check for escaped HTML entities
    const h2OpeningMatches = description.match(/<h2[^>]*>/gi) || []
    const h2ClosingMatches = description.match(/<\/h2>/gi) || []
    // Check for escaped HTML (e.g., &lt;h2&gt;)
    const h2EscapedMatches = description.match(/&lt;h2[^&]*&gt;/gi) || []
    const sectionCount = Math.max(h2OpeningMatches.length, h2ClosingMatches.length, h2EscapedMatches.length)
    
    // Debug: Show a sample of the description to see format
    if (sectionCount === 0) {
      const descSample = description.substring(0, 500).replace(/\n/g, '\\n')
      console.log('[QUALITY SCORE] Quality: Description sample (first 500 chars):', descSample)
      // Also check if description contains "h2" at all
      const hasH2Text = description.toLowerCase().includes('h2') || description.toLowerCase().includes('áttekintés')
      console.log('[QUALITY SCORE] Quality: Contains "h2" text:', hasH2Text)
      console.log('[QUALITY SCORE] Quality: Contains "Áttekintés":', description.includes('Áttekintés'))
    }
    console.log('[QUALITY SCORE] Quality: H2 opening tags found:', h2OpeningMatches.length, 'matches:', h2OpeningMatches.slice(0, 3))
    console.log('[QUALITY SCORE] Quality: H2 closing tags found:', h2ClosingMatches.length)
    console.log('[QUALITY SCORE] Quality: H2 escaped tags found:', h2EscapedMatches.length)
    console.log('[QUALITY SCORE] Quality: Total h2 sections detected:', sectionCount)
    
    if (sectionCount >= 3) {
      qualityPoints += 1 // Bonus for well-structured content with multiple sections
      console.log('[QUALITY SCORE] Quality: +1 bonus for 3+ sections')
    } else if (sectionCount > 0) {
      console.log('[QUALITY SCORE] Quality: Found', sectionCount, 'sections but need 3+ for bonus')
    } else {
      // If no h2 tags found but description has section-like content, check for other indicators
      const hasSectionHeaders = description.includes('Áttekintés') || 
                                description.includes('Főbb jellemzők') ||
                                description.includes('Összefoglalás')
      if (hasSectionHeaders && descriptionLength > 1000) {
        console.log('[QUALITY SCORE] Quality: No h2 tags but has section-like content, might be plain text format')
      }
    }
    descQualityPoints = Math.min(qualityPoints, 10) // Cap at 10 points
    contentScore += descQualityPoints
    console.log('[QUALITY SCORE] Description quality points:', descQualityPoints, '(total quality checks:', qualityPoints, ')')
  }
  
  // Meta title (0-8 points)
  const metaTitle = product.description?.meta_title || ''
  let metaTitlePoints = 0
  if (!metaTitle) {
    issues.push({
      type: 'missing_meta_title',
      severity: 'critical',
      message: 'Nincs meta cím',
      points_lost: 8
    })
    blockingIssues.push('missing_meta_title')
    console.log('[QUALITY SCORE] Meta title: MISSING (0 points)')
  } else {
    const titleLength = metaTitle.length
    console.log('[QUALITY SCORE] Meta title length:', titleLength, 'chars')
    if (titleLength < 30 || titleLength > 70) {
      metaTitlePoints = 2
      contentScore += 2
      issues.push({
        type: 'poor_meta_title',
        severity: 'warning',
        message: `Meta cím hossza nem optimális (${titleLength} karakter)`,
        points_lost: 6
      })
      console.log('[QUALITY SCORE] Meta title: +2 (poor length)')
    } else if (titleLength >= 50 && titleLength <= 60) {
      metaTitlePoints = 6
      contentScore += 6
      console.log('[QUALITY SCORE] Meta title: +6 (optimal length 50-60)')
    } else {
      metaTitlePoints = 4
      contentScore += 4
      console.log('[QUALITY SCORE] Meta title: +4 (good length 30-50 or 60-70)')
    }
    // Check if keyword-rich (product name or ShopRenter dynamic tags)
    const hasProductName = product.name && metaTitle.toLowerCase().includes(product.name.toLowerCase())
    const hasDynamicTags = metaTitle.includes('[PRODUCT]') || 
                          metaTitle.includes('[SKU]') || 
                          metaTitle.includes('[SERIAL]') ||
                          metaTitle.includes('[CATEGORY]')
    
    if (hasProductName || hasDynamicTags) {
      contentScore += 2
      metaTitlePoints += 2
      if (hasDynamicTags) {
        console.log('[QUALITY SCORE] Meta title: +2 (contains ShopRenter dynamic tags like [PRODUCT])')
      } else {
        console.log('[QUALITY SCORE] Meta title: +2 (contains product name)')
      }
    } else {
      console.log('[QUALITY SCORE] Meta title: Product name not found. Product name:', product.name, 'Meta title:', metaTitle)
    }
    console.log('[QUALITY SCORE] Meta title total points:', metaTitlePoints)
  }
  
  // Meta description (0-7 points)
  const metaDescription = product.description?.meta_description || ''
  let metaDescPoints = 0
  if (!metaDescription) {
    issues.push({
      type: 'missing_meta_description',
      severity: 'warning',
      message: 'Nincs meta leírás',
      points_lost: 7
    })
    console.log('[QUALITY SCORE] Meta description: MISSING (0 points)')
  } else {
    // Calculate actual rendered length by replacing ShopRenter dynamic tags with actual values
    let renderedDesc = metaDescription
    if (renderedDesc.includes('[PRODUCT]')) {
      renderedDesc = renderedDesc.replace(/\[PRODUCT\]/g, product.name || '')
    }
    if (renderedDesc.includes('[SKU]')) {
      renderedDesc = renderedDesc.replace(/\[SKU\]/g, product.sku || '')
    }
    if (renderedDesc.includes('[SERIAL]')) {
      renderedDesc = renderedDesc.replace(/\[SERIAL\]/g, product.model_number || '')
    }
    if (renderedDesc.includes('[CATEGORY]')) {
      // Category not available in product data, but estimate ~10 chars
      renderedDesc = renderedDesc.replace(/\[CATEGORY\]/g, 'kategória')
    }
    if (renderedDesc.includes('[PRICE]')) {
      // Price not available in product data, but estimate ~8 chars (e.g., "12 345 Ft")
      renderedDesc = renderedDesc.replace(/\[PRICE\]/g, '12 345 Ft')
    }
    
    const descLength = renderedDesc.length
    const storedLength = metaDescription.length
    console.log('[QUALITY SCORE] Meta description stored length:', storedLength, 'chars')
    console.log('[QUALITY SCORE] Meta description rendered length:', descLength, 'chars (after tag replacement)')
    
    if (descLength >= 150 && descLength <= 160) {
      metaDescPoints = 5
      contentScore += 5
      console.log('[QUALITY SCORE] Meta description: +5 (optimal length 150-160)')
    } else if (descLength > 100) {
      metaDescPoints = 3
      contentScore += 3
      console.log('[QUALITY SCORE] Meta description: +3 (good length >100)')
    } else {
      metaDescPoints = 2
      contentScore += 2
      console.log('[QUALITY SCORE] Meta description: +2 (short length <100)')
    }
    // Check if compelling (has call to action or product benefits)
    // Check both stored and rendered versions
    const compellingMatch = renderedDesc.match(/ingyenes|szállítás|garanci|akció|kedvezmény/i) ||
                           metaDescription.match(/ingyenes|szállítás|garanci|akció|kedvezmény/i)
    if (compellingMatch) {
      contentScore += 2
      metaDescPoints += 2
      console.log('[QUALITY SCORE] Meta description: +2 (compelling keywords found:', compellingMatch[0], ')')
    } else {
      console.log('[QUALITY SCORE] Meta description: No compelling keywords found. Rendered desc:', renderedDesc.substring(0, 100))
    }
    console.log('[QUALITY SCORE] Meta description total points:', metaDescPoints)
  }
  
  console.log('[QUALITY SCORE] CONTENT SCORE BREAKDOWN:')
  console.log('[QUALITY SCORE]   Description presence:', descPresencePoints, '/10')
  console.log('[QUALITY SCORE]   Description quality:', descQualityPoints, '/10')
  console.log('[QUALITY SCORE]   Meta title:', metaTitlePoints, '/8')
  console.log('[QUALITY SCORE]   Meta description:', metaDescPoints, '/7')
  console.log('[QUALITY SCORE]   TOTAL CONTENT SCORE:', contentScore, '/35')
  
  // ===== CATEGORY 2: IMAGE OPTIMIZATION (25 points max) =====
  let imageScore = 0
  const images = product.images || []
  const imageCount = images.length
  
  if (imageCount === 0) {
    issues.push({
      type: 'no_images',
      severity: 'critical',
      message: 'Nincs termékkép',
      points_lost: 25
    })
    blockingIssues.push('no_images')
  } else {
    // Image count (0-8 points)
    if (imageCount >= 5) {
      imageScore += 8
    } else if (imageCount >= 3) {
      imageScore += 6
    } else if (imageCount >= 1) {
      imageScore += 3
    }
    
    // Alt text coverage (0-12 points)
    const imagesWithAlt = images.filter(img => img.alt_text && img.alt_text.trim().length > 0).length
    const altCoverage = imageCount > 0 ? (imagesWithAlt / imageCount) * 100 : 0
    
    if (altCoverage === 100) {
      imageScore += 12
    } else if (altCoverage >= 91) {
      imageScore += 10
    } else if (altCoverage >= 51) {
      imageScore += 8
    } else if (altCoverage >= 1) {
      imageScore += 4
    } else {
      issues.push({
        type: 'no_alt_text',
        severity: 'critical',
        message: 'Nincs alt szöveg a képeken',
        points_lost: 12
      })
    }
    
    // Alt text quality (0-5 points)
    if (altCoverage > 0) {
      const altTexts = images
        .filter(img => img.alt_text)
        .map(img => img.alt_text!.toLowerCase())
      
      // Check for generic alt text
      const genericTerms = ['kép', 'fotó', 'image', 'photo', 'termék']
      const hasGeneric = altTexts.some(alt => genericTerms.some(term => alt.includes(term)))
      
      if (!hasGeneric && altTexts.length > 0) {
        // Check if descriptive (has product name or attributes)
        const hasDescriptive = altTexts.some(alt => 
          (product.name && alt.includes(product.name.toLowerCase())) ||
          alt.length > 30
        )
        if (hasDescriptive) {
          imageScore += 5
        } else {
          imageScore += 3
        }
      } else {
        imageScore += 1
        issues.push({
          type: 'generic_alt_text',
          severity: 'warning',
          message: 'Általános alt szövegek',
          points_lost: 4
        })
      }
    }
  }
  
  // ===== CATEGORY 3: TECHNICAL SEO (20 points max) =====
  let technicalScore = 0
  
  // URL quality (0-7 points)
  const urlSlug = product.url_slug || ''
  if (!urlSlug) {
    technicalScore += 1
  } else {
    // Check for special characters, numbers at end, etc.
    const hasSpecialChars = /[^a-z0-9\-]/.test(urlSlug.toLowerCase())
    const hasNumbers = /\d/.test(urlSlug)
    const slugLength = urlSlug.length
    
    if (hasSpecialChars) {
      technicalScore += 2
    } else if (slugLength > 100) {
      technicalScore += 3
    } else if (slugLength > 50) {
      technicalScore += 4
    } else {
      technicalScore += 5
    }
    
    // Check if keyword-rich (contains product name or SKU)
    if (product.name) {
      const nameWords = product.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      const hasKeywords = nameWords.some(word => urlSlug.toLowerCase().includes(word))
      if (hasKeywords) {
        technicalScore += 2
      }
    }
  }
  
  // Indexing status (0-6 points)
  if (product.indexing_status) {
    const idxStatus = product.indexing_status
    
    if (idxStatus.is_indexed && !idxStatus.has_issues) {
      technicalScore += 6
    } else if (idxStatus.is_indexed) {
      technicalScore += 3
      
      // Add specific issues based on enhanced data
      // Only treat as error if it's an actual error state (not SUCCESS or PASS)
      const successStates = ['SUCCESS', 'PASS']
      if (idxStatus.page_fetch_state && !successStates.includes(idxStatus.page_fetch_state)) {
        issues.push({
          type: 'page_fetch_error',
          severity: 'critical',
          message: `Oldal betöltési hiba: ${idxStatus.page_fetch_error || idxStatus.page_fetch_state}`,
          points_lost: 3
        })
      } else {
        issues.push({
          type: 'indexing_issues',
          severity: 'warning',
          message: 'Indexelési problémák',
          points_lost: 3
        })
      }
    } else {
      // Not indexed - check why
      // Only treat as error if it's an actual error state (not SUCCESS or PASS)
      const successStates = ['SUCCESS', 'PASS']
      let notIndexedMessage = 'Nincs indexelve'
      if (idxStatus.page_fetch_state && !successStates.includes(idxStatus.page_fetch_state)) {
        notIndexedMessage = `Nincs indexelve: ${idxStatus.page_fetch_error || idxStatus.page_fetch_state}`
      } else if (idxStatus.coverage_state) {
        notIndexedMessage = `Nincs indexelve: ${idxStatus.coverage_state}`
      }
      
      issues.push({
        type: 'not_indexed',
        severity: 'critical',
        message: notIndexedMessage,
        points_lost: 6
      })
    }
    
    // Mobile usability issues (additional penalty)
    if (idxStatus.mobile_usability_issues && idxStatus.mobile_usability_issues.length > 0) {
      const criticalMobileIssues = idxStatus.mobile_usability_issues.filter((issue: any) => issue.severity === 'ERROR')
      if (criticalMobileIssues.length > 0) {
        issues.push({
          type: 'mobile_usability_errors',
          severity: 'warning',
          message: `${criticalMobileIssues.length} mobil használhatósági hiba`,
          points_lost: 2
        })
        // Reduce technical score for mobile issues (but don't double-penalize if already has indexing issues)
        if (idxStatus.is_indexed && !idxStatus.has_issues) {
          technicalScore = Math.max(0, technicalScore - 2)
        }
      }
    }
    
    // Structured data issues (additional penalty)
    if (idxStatus.structured_data_issues && idxStatus.structured_data_issues.length > 0) {
      const criticalDataIssues = idxStatus.structured_data_issues.filter((issue: any) => issue.severity === 'ERROR')
      if (criticalDataIssues.length > 0) {
        issues.push({
          type: 'structured_data_errors',
          severity: 'warning',
          message: `${criticalDataIssues.length} strukturált adat hiba`,
          points_lost: 1
        })
      }
    }
  } else {
    // No data - assume not checked
    technicalScore += 2
  }
  
  // Sync status (0-7 points)
  if (product.sync_status === 'synced' && !product.sync_error) {
    technicalScore += 7
  } else if (product.sync_status === 'synced') {
    technicalScore += 4
    issues.push({
      type: 'sync_warning',
      severity: 'warning',
      message: 'Szinkronizálás figyelmeztetéssel',
      points_lost: 3
    })
  } else {
    technicalScore += 0
    issues.push({
      type: 'sync_error',
      severity: 'critical',
      message: 'Szinkronizálási hiba',
      points_lost: 7
    })
    blockingIssues.push('sync_error')
  }
  
  // ===== CATEGORY 4: SEARCH PERFORMANCE (5 points max) =====
  let performanceScore = 0
  
  if (product.search_console) {
    // Impressions (0-2 points)
    if (product.search_console.impressions >= 100) {
      performanceScore += 2
    } else if (product.search_console.impressions > 0) {
      performanceScore += 1
    }
    
    // Average position (0-3 points)
    const avgPos = product.search_console.avg_position
    if (avgPos > 0 && avgPos <= 9) {
      performanceScore += 3
    } else if (avgPos > 9 && avgPos <= 19) {
      performanceScore += 2
    } else if (avgPos > 19) {
      performanceScore += 1
    }
  }
  
  // ===== CATEGORY 5: DATA COMPLETENESS (10 points max) =====
  let completenessScore = 0
  
  // Essential fields (0-5 points)
  if (product.sku) completenessScore += 1
  if (product.model_number) completenessScore += 1
  if (product.gtin) completenessScore += 1
  if (product.price) {
    completenessScore += 1
  } else {
    issues.push({
      type: 'missing_price',
      severity: 'critical',
      message: 'Nincs ár',
      points_lost: 1
    })
    blockingIssues.push('missing_price')
  }
  if (product.status === 1) completenessScore += 1
  
  // Count only attributes with actual values (not empty/null)
  const attributesWithValues = countAttributesWithValues(product.product_attributes)
  console.log('[QUALITY SCORE] Completeness: Attributes with values:', attributesWithValues)
  
  // Attributes with values (0-4 points) - scaled by quantity
  if (attributesWithValues >= 10) {
    completenessScore += 4
    console.log('[QUALITY SCORE] Completeness: +4 for 10+ attributes with values')
  } else if (attributesWithValues >= 6) {
    completenessScore += 3
    console.log('[QUALITY SCORE] Completeness: +3 for 6-9 attributes with values')
  } else if (attributesWithValues >= 3) {
    completenessScore += 2
    console.log('[QUALITY SCORE] Completeness: +2 for 3-5 attributes with values')
  } else if (attributesWithValues >= 1) {
    completenessScore += 1
    console.log('[QUALITY SCORE] Completeness: +1 for 1-2 attributes with values')
  } else {
    console.log('[QUALITY SCORE] Completeness: No attributes with values')
  }
  
  // Product relationships (0-1 point)
  // Give bonus point if product has good attribute coverage (3+ attributes)
  if (attributesWithValues >= 3) {
    completenessScore += 1
    console.log('[QUALITY SCORE] Completeness: +1 bonus for good attribute coverage (3+ attributes)')
  }
  
  console.log('[QUALITY SCORE] Completeness total score:', completenessScore, '/10')
  
  // ===== CATEGORY 6: COMPETITIVE POSITIONING (5 points max) =====
  let competitiveScore = 0
  
  console.log('[QUALITY SCORE] Competitive scoring:', {
    competitor_tracking_enabled: product.competitor_tracking_enabled,
    competitor_price: product.competitor_price,
    product_price: product.price
  })
  
  if (product.competitor_tracking_enabled) {
    competitiveScore += 2
    console.log('[QUALITY SCORE] Competitor tracking enabled, base score: 2')
    
    if (product.competitor_price && product.price) {
      const competitorPriceNum = typeof product.competitor_price === 'string' ? parseFloat(product.competitor_price) : product.competitor_price
      const productPriceNum = typeof product.price === 'string' ? parseFloat(product.price) : product.price
      
      if (!isNaN(competitorPriceNum) && !isNaN(productPriceNum) && competitorPriceNum > 0) {
        const priceDiff = ((competitorPriceNum - productPriceNum) / competitorPriceNum) * 100
        console.log('[QUALITY SCORE] Price comparison:', {
          competitor_price: competitorPriceNum,
          product_price: productPriceNum,
          price_diff_percent: priceDiff
        })
        
        if (priceDiff > 10) {
          competitiveScore += 3 // Best price (we're 10%+ cheaper)
          console.log('[QUALITY SCORE] Best price (10%+ cheaper), adding 3 points')
        } else if (priceDiff > 0) {
          competitiveScore += 2 // Competitive (we're cheaper)
          console.log('[QUALITY SCORE] Competitive (cheaper), adding 2 points')
        } else if (priceDiff > -10) {
          competitiveScore += 1 // Slightly higher (within 10%)
          console.log('[QUALITY SCORE] Slightly higher (within 10%), adding 1 point')
        } else {
          console.log('[QUALITY SCORE] More than 10% higher, no additional points')
        }
      } else {
        console.warn('[QUALITY SCORE] Invalid price values for comparison:', {
          competitor_price: competitorPriceNum,
          product_price: productPriceNum
        })
      }
    } else {
      console.warn('[QUALITY SCORE] Missing price data:', {
        has_competitor_price: !!product.competitor_price,
        has_product_price: !!product.price
      })
    }
  }
  
  console.log('[QUALITY SCORE] Final competitive score:', competitiveScore)
  
  // ===== CALCULATE OVERALL SCORE =====
  let overallScore = contentScore + imageScore + technicalScore + performanceScore + completenessScore + competitiveScore
  
  // Apply blocking rules (minimum thresholds)
  if (blockingIssues.includes('missing_description')) {
    overallScore = Math.min(overallScore, 50)
  }
  if (blockingIssues.includes('missing_meta_title')) {
    overallScore = Math.min(overallScore, 60)
  }
  if (blockingIssues.includes('no_images')) {
    overallScore = Math.min(overallScore, 50)
  }
  if (blockingIssues.includes('missing_price')) {
    overallScore = Math.min(overallScore, 70)
  }
  if (blockingIssues.includes('sync_error')) {
    overallScore = Math.min(overallScore, 60)
  }
  
  // Calculate priority score
  const impactMultiplier = 1.0 // Base multiplier
  const priorityScore = (100 - overallScore) * impactMultiplier
  
  return {
    overall_score: Math.round(overallScore),
    content_score: Math.round(contentScore),
    image_score: Math.round(imageScore),
    technical_score: Math.round(technicalScore),
    performance_score: Math.round(performanceScore),
    completeness_score: Math.round(completenessScore),
    competitive_score: Math.round(competitiveScore),
    priority_score: Math.round(priorityScore * 100) / 100,
    is_parent: true,
    issues,
    blocking_issues: blockingIssues
  }
}

/**
 * Calculate score for child/variant products
 */
function calculateChildProductScore(product: ProductData): QualityScoreResult {
  const issues: QualityScoreResult['issues'] = []
  const blockingIssues: string[] = []
  
  // ===== CATEGORY 1: CONTENT QUALITY (10 points max) =====
  let contentScore = 0
  
  // Product attributes (0-10 points) - most important for variants
  // Only count attributes with actual values
  const attributesWithValues = countAttributesWithValues(product.product_attributes)
  
  if (attributesWithValues > 0) {
    const variantAttributes = ['meret', 'size', 'szin', 'color', 'szélesség', 'width', 'magasság', 'height']
    const variantAttrsWithValues = product.product_attributes!.filter(attr => {
      if (!attr || !attr.value) return false
      
      // Check if attribute has value
      const hasValue = attr.type === 'LIST' 
        ? (Array.isArray(attr.value) && attr.value.length > 0)
        : (attr.type === 'TEXT' 
          ? (Array.isArray(attr.value) ? attr.value.some((v: any) => v && v.value) : String(attr.value).trim().length > 0)
          : !!attr.value)
      
      if (!hasValue) return false
      
      // Check if it's a variant attribute
      return variantAttributes.some(variant => attr.name.toLowerCase().includes(variant))
    })
    
    if (variantAttrsWithValues.length >= 2) {
      contentScore += 10
    } else if (variantAttrsWithValues.length >= 1 || attributesWithValues >= 1) {
      contentScore += 5
    }
  } else {
    issues.push({
      type: 'missing_variant_attributes',
      severity: 'critical',
      message: 'Nincsenek variáns attribútumok',
      points_lost: 10
    })
    blockingIssues.push('missing_variant_attributes')
  }
  
  // ===== CATEGORY 2: IMAGE OPTIMIZATION (0 points) =====
  // Child products use parent's images - not scored
  
  // ===== CATEGORY 3: TECHNICAL SEO (25 points max) =====
  let technicalScore = 0
  
  // URL quality (0-8 points)
  const urlSlug = product.url_slug || ''
  if (urlSlug) {
    const hasSpecialChars = /[^a-z0-9\-]/.test(urlSlug.toLowerCase())
    if (!hasSpecialChars && urlSlug.length <= 100) {
      technicalScore += 6
      if (urlSlug.length <= 50) {
        technicalScore += 2
      }
    } else {
      technicalScore += 2
    }
  } else {
    technicalScore += 1
  }
  
  // Indexing status (0-8 points)
  if (product.indexing_status) {
    if (product.indexing_status.is_indexed && !product.indexing_status.has_issues) {
      technicalScore += 8
    } else if (product.indexing_status.is_indexed) {
      technicalScore += 4
    }
  } else {
    technicalScore += 2
  }
  
  // Sync status (0-9 points)
  if (product.sync_status === 'synced' && !product.sync_error) {
    technicalScore += 9
  } else if (product.sync_status === 'synced') {
    technicalScore += 4
  } else {
    blockingIssues.push('sync_error')
  }
  
  // ===== CATEGORY 4: SEARCH PERFORMANCE (5 points max) =====
  // Inherit from parent (already passed in product.search_console)
  let performanceScore = 0
  if (product.search_console) {
    if (product.search_console.impressions >= 100) {
      performanceScore += 2
    } else if (product.search_console.impressions > 0) {
      performanceScore += 1
    }
    
    const avgPos = product.search_console.avg_position
    if (avgPos > 0 && avgPos <= 9) {
      performanceScore += 3
    } else if (avgPos > 9 && avgPos <= 19) {
      performanceScore += 2
    } else if (avgPos > 19) {
      performanceScore += 1
    }
  }
  
  // ===== CATEGORY 5: DATA COMPLETENESS (50 points max) =====
  let completenessScore = 0
  
  // Essential fields (0-30 points)
  if (product.sku) completenessScore += 5
  else {
    blockingIssues.push('missing_sku')
  }
  if (product.model_number) completenessScore += 5
  if (product.gtin) completenessScore += 5
  if (product.price) {
    completenessScore += 10
  } else {
    blockingIssues.push('missing_price')
  }
  if (product.status === 1) completenessScore += 5
  
  // Variant attributes (0-20 points)
  // Only count attributes with actual values (not empty/null)
  // Reuse attributesWithValues calculated earlier in content quality section
  if (attributesWithValues >= 3) {
    completenessScore += 20
  } else if (attributesWithValues === 2) {
    completenessScore += 15
  } else if (attributesWithValues === 1) {
    completenessScore += 10
  }
  
  // ===== CATEGORY 6: COMPETITIVE POSITIONING (10 points max) =====
  let competitiveScore = 0
  
  console.log('[QUALITY SCORE] Competitive scoring (child):', {
    competitor_tracking_enabled: product.competitor_tracking_enabled,
    competitor_price: product.competitor_price,
    product_price: product.price
  })
  
  if (product.competitor_tracking_enabled) {
    competitiveScore += 4
    console.log('[QUALITY SCORE] Competitor tracking enabled (child), base score: 4')
    
    if (product.competitor_price && product.price) {
      const competitorPriceNum = typeof product.competitor_price === 'string' ? parseFloat(product.competitor_price) : product.competitor_price
      const productPriceNum = typeof product.price === 'string' ? parseFloat(product.price) : product.price
      
      if (!isNaN(competitorPriceNum) && !isNaN(productPriceNum) && competitorPriceNum > 0) {
        const priceDiff = ((competitorPriceNum - productPriceNum) / competitorPriceNum) * 100
        console.log('[QUALITY SCORE] Price comparison (child):', {
          competitor_price: competitorPriceNum,
          product_price: productPriceNum,
          price_diff_percent: priceDiff
        })
        
        if (priceDiff > 10) {
          competitiveScore += 6 // Best price (we're 10%+ cheaper)
          console.log('[QUALITY SCORE] Best price (10%+ cheaper), adding 6 points')
        } else if (priceDiff > 0) {
          competitiveScore += 4 // Competitive (we're cheaper)
          console.log('[QUALITY SCORE] Competitive (cheaper), adding 4 points')
        } else if (priceDiff > -10) {
          competitiveScore += 2 // Slightly higher (within 10%)
          console.log('[QUALITY SCORE] Slightly higher (within 10%), adding 2 points')
        } else {
          console.log('[QUALITY SCORE] More than 10% higher, no additional points')
        }
      } else {
        console.warn('[QUALITY SCORE] Invalid price values for comparison (child):', {
          competitor_price: competitorPriceNum,
          product_price: productPriceNum
        })
      }
    } else {
      console.warn('[QUALITY SCORE] Missing price data (child):', {
        has_competitor_price: !!product.competitor_price,
        has_product_price: !!product.price
      })
    }
  }
  
  console.log('[QUALITY SCORE] Final competitive score (child):', competitiveScore)
  
  // ===== CALCULATE OVERALL SCORE =====
  // Note: imageScore is 0 for child products (they use parent's images)
  let overallScore = contentScore + technicalScore + performanceScore + completenessScore + competitiveScore
  
  // Apply blocking rules
  if (blockingIssues.includes('missing_sku')) {
    overallScore = Math.min(overallScore, 50)
  }
  if (blockingIssues.includes('missing_price')) {
    overallScore = Math.min(overallScore, 60)
  }
  if (blockingIssues.includes('missing_variant_attributes')) {
    overallScore = Math.min(overallScore, 70)
  }
  if (blockingIssues.includes('sync_error')) {
    overallScore = Math.min(overallScore, 60)
  }
  
  // Calculate priority score
  const priorityScore = (100 - overallScore) * 1.0
  
  return {
    overall_score: Math.round(overallScore),
    content_score: Math.round(contentScore),
    image_score: 0, // Not applicable for child products
    technical_score: Math.round(technicalScore),
    performance_score: Math.round(performanceScore),
    completeness_score: Math.round(completenessScore),
    competitive_score: Math.round(competitiveScore),
    priority_score: Math.round(priorityScore * 100) / 100,
    is_parent: false,
    issues,
    blocking_issues: blockingIssues
  }
}
