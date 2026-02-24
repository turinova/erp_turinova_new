// Structured Data Generator
// Generates enhanced JSON-LD structured data for products with all attributes

export interface StructuredDataProduct {
  id: string
  sku: string
  name: string | null
  model_number: string | null
  gtin: string | null
  brand: string | null  // Brand/manufacturer name from ShopRenter
  price: number | null
  status: number
  product_url: string | null
  product_attributes: Array<{
    type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
    name: string // Internal identifier
    display_name?: string | null // Display name from AttributeDescription - PRIMARY for display
    prefix?: string | null
    postfix?: string | null
    value: any
  }> | null
  parent_product_id: string | null
  description?: {
    description: string | null
    meta_title: string | null
    meta_description: string | null
  } | null
  images?: Array<{
    url: string
    alt_text: string | null
  }> | null
  parent?: {
    id: string
    sku: string
    name: string | null
    product_attributes?: Array<{
      type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
      name: string
      display_name?: string | null
      value: any
    }> | null
  } | null
  children?: Array<{
    id: string
    sku: string
    name: string | null
    model_number?: string | null
    gtin?: string | null
    price?: number | null
    status?: number
    product_url?: string | null
    images?: string[] | null  // Array of image URLs for child variants
    product_attributes: Array<{
      type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
      name: string
      value: any
    }> | null
  }> | null
}

export interface StructuredDataOptions {
  currency?: string
  shopUrl?: string
  shopName?: string
}

/**
 * Decode HTML entities in a string
 * Handles both named entities (&lt;, &gt;) and numeric entities (&#8217;, &#x27;)
 */
function decodeHtmlEntities(text: string): string {
  return text
    // Common named entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&euro;/g, '€')
    .replace(/&pound;/g, '£')
    .replace(/&yen;/g, '¥')
    .replace(/&cent;/g, '¢')
    // Decode numeric entities (e.g., &#8217;, &#160;)
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10)
      if (code >= 0 && code <= 1114111) {
        return String.fromCharCode(code)
      }
      return ''
    })
    // Decode hex entities (e.g., &#x27;, &#xA0;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16)
      if (code >= 0 && code <= 1114111) {
        return String.fromCharCode(code)
      }
      return ''
    })
}

/**
 * Extract FAQ questions and answers from description HTML
 */
function extractFAQFromDescription(description: string): Array<{ question: string; answer: string }> {
  if (!description) {
    console.log('[FAQ EXTRACTION] No description provided')
    return []
  }
  
  console.log('[FAQ EXTRACTION] Starting extraction. Description length:', description.length)
  
  // CRITICAL: Decode HTML entities FIRST (description may be stored with encoded entities)
  // Check if description has encoded entities
  const hasEncodedEntities = description.includes('&lt;') || description.includes('&gt;') || description.includes('&quot;')
  console.log('[FAQ EXTRACTION] Has encoded HTML entities:', hasEncodedEntities)
  
  // Decode HTML entities to get actual HTML tags
  const decodedDescription = decodeHtmlEntities(description)
  
  console.log('[FAQ EXTRACTION] Decoded description length:', decodedDescription.length)
  console.log('[FAQ EXTRACTION] Contains "Gyakran ismételt kérdések":', decodedDescription.includes('Gyakran ismételt kérdések'))
  console.log('[FAQ EXTRACTION] Contains "GYIK":', decodedDescription.includes('GYIK'))
  console.log('[FAQ EXTRACTION] Contains "Gyakori kérdések":', decodedDescription.includes('Gyakori kérdések'))
  
  const faqs: Array<{ question: string; answer: string }> = []
  
  // Try multiple patterns to find FAQ section - more flexible matching
  // Now using decoded description with actual HTML tags
  const patterns = [
    // Pattern 1: Standard format with optional text before/after heading keywords
    /<h2[^>]*>(?:.*?)?(?:Gyakran ismételt kérdések|Gyakori kérdések|GYIK)(?:.*?)?<\/h2>(.*?)(?=<h2|<\/body>|$)/is,
    // Pattern 2: More flexible - heading text can appear anywhere in h2 tag
    /<h2[^>]*>.*?(?:Gyakran ismételt kérdések|Gyakori kérdések|GYIK).*?<\/h2>(.*?)(?=<h2|$)/is,
    // Pattern 3: If FAQ is the last section (no following h2), capture everything after heading
    /<h2[^>]*>.*?(?:Gyakran ismételt kérdések|Gyakori kérdések|GYIK).*?<\/h2>(.*)/is,
  ]
  
  let faqContent = ''
  let matchedPattern = 0
  
  for (let i = 0; i < patterns.length; i++) {
    const match = decodedDescription.match(patterns[i])
    if (match && match[1] && match[1].trim().length > 0) {
      faqContent = match[1]
      matchedPattern = i + 1
      console.log(`[FAQ EXTRACTION] Found FAQ section with pattern ${matchedPattern}, content length:`, faqContent.length)
      break
    }
  }
  
  if (!faqContent) {
    // Log diagnostic information
    const last500Chars = decodedDescription.substring(Math.max(0, decodedDescription.length - 500))
    console.log('[FAQ EXTRACTION] No FAQ section found. Last 500 chars of decoded description:', last500Chars)
    console.log('[FAQ EXTRACTION] Description ends with:', decodedDescription.substring(Math.max(0, decodedDescription.length - 100)))
    return []
  }
  
  // Helper function to clean text: decode entities, strip HTML tags, normalize whitespace
  const cleanText = (text: string): string => {
    // First decode HTML entities (in case they're still encoded)
    let cleaned = decodeHtmlEntities(text)
    // Then strip HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '')
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    return cleaned
  }
  
  // Extract Q&A pairs: <h3>Question</h3> <p>Answer</p> or <h3>Question</h3> followed by <p>Answer</p>
  // Pattern matches h3 followed by one or more p tags (handles multi-paragraph answers)
  const qaPattern = /<h3[^>]*>(.*?)<\/h3>\s*(<p[^>]*>.*?<\/p>(?:\s*<p[^>]*>.*?<\/p>)*)/gis
  let match
  let qaCount = 0
  
  while ((match = qaPattern.exec(faqContent)) !== null) {
    qaCount++
    const question = cleanText(match[1])
    
    // Extract all paragraphs for the answer
    const answerParagraphs = match[2].match(/<p[^>]*>(.*?)<\/p>/gis)
    if (!answerParagraphs) {
      console.log(`[FAQ EXTRACTION] Q&A ${qaCount}: No answer paragraphs found for question:`, question.substring(0, 50))
      continue
    }
    
    const answer = answerParagraphs
      .map(p => {
        const pMatch = p.match(/<p[^>]*>(.*?)<\/p>/is)
        return pMatch ? cleanText(pMatch[1]) : ''
      })
      .filter(p => p.length > 0)
      .join(' ')
    
    // Only add if both question and answer are meaningful
    if (question && answer && question.length > 10 && answer.length > 20) {
      faqs.push({ question, answer })
      console.log(`[FAQ EXTRACTION] Extracted FAQ ${faqs.length}:`, question.substring(0, 60) + '...')
    } else {
      console.log(`[FAQ EXTRACTION] Q&A ${qaCount} rejected - Question length:`, question.length, 'Answer length:', answer.length)
    }
  }
  
  console.log(`[FAQ EXTRACTION] Total FAQs extracted: ${faqs.length} out of ${qaCount} Q&A pairs found`)
  return faqs
}

/**
 * Generate FAQPage schema from FAQ questions and answers
 */
function generateFAQPageSchema(
  faqs: Array<{ question: string; answer: string }>,
  productUrl: string | null
): object | null {
  if (!faqs || faqs.length === 0) return null
  
  return {
    '@context': 'https://schema.org/',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    })),
    ...(productUrl ? { url: productUrl } : {})
  }
}

/**
 * Helper function to extract value from object/array/primitive
 * Used by multiple functions for attribute value extraction
 */
function extractValue(val: any): string | number | null {
  // Handle null/undefined
  if (val === null || val === undefined) {
    return null
  }

  // Handle primitives
  if (typeof val !== 'object') {
    return typeof val === 'number' ? val : String(val)
  }

  // Handle arrays
  if (Array.isArray(val)) {
    const extracted = val
      .map(v => extractValue(v))
      .filter(v => v !== null && v !== undefined && String(v) !== 'null' && String(v) !== 'undefined')
    return extracted.length > 0 ? extracted.join(', ') : null
  }

  // Handle objects - try multiple strategies
  // Strategy 1: Language-specific (Hungarian first, then others)
  if (val.hu && typeof val.hu === 'string') {
    return val.hu
  }
  if (val.name && typeof val.name === 'string') {
    return val.name
  }
  if (val.description && typeof val.description === 'string') {
    return val.description
  }
  if (val.value !== undefined && val.value !== null) {
    const extracted = extractValue(val.value)
    if (extracted !== null) {
      return extracted
    }
  }

  // Strategy 2: Find first string value in object
  for (const [key, v] of Object.entries(val)) {
    if (typeof v === 'string' && v.trim() !== '') {
      return v
    }
    if (typeof v === 'number') {
      return v
    }
  }

  // Strategy 3: If object has a single property, use it
  const keys = Object.keys(val)
  if (keys.length === 1) {
    const extracted = extractValue(val[keys[0]])
    if (extracted !== null) {
      return extracted
    }
  }

  return null
}

/**
 * Determine if an attribute is variant-specific by comparing parent vs children
 * Generic approach - works for any product type (size, color, material, etc.)
 */
function isVariantSpecificAttribute(
  attrName: string,
  parentValue: any,
  children: Array<{ product_attributes?: Array<{ name: string; value: any }> | null }>
): boolean {
  if (!children || children.length === 0) return false
  
  const parentExtracted = extractValue(parentValue)
  if (!parentExtracted) return false
  
  // Check if any child has a different value for this attribute
  for (const child of children) {
    if (!child.product_attributes) continue
    
    const childAttr = child.product_attributes.find(a => 
      a.name === attrName || 
      a.name?.toLowerCase() === attrName.toLowerCase()
    )
    
    if (childAttr) {
      const childExtracted = extractValue(childAttr.value)
      // If values differ, it's variant-specific
      if (String(parentExtracted) !== String(childExtracted)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Generate stable productGroupID from product name and key attributes
 * This should be consistent across all variants (not the SKU)
 */
function generateProductGroupID(product: StructuredDataProduct): string {
  // Extract key differentiating attributes (color, type, model) that are common to all variants
  const keyAttributes: string[] = []
  
  if (product.product_attributes && product.product_attributes.length > 0) {
    // Look for attributes that define the product group (not variant-specific)
    // Common group attributes: color (szin), type/model (típus), brand (márka)
    const groupAttributeNames = ['szin', 'color', 'típus', 'type', 'model', 'márka', 'brand']
    
    product.product_attributes.forEach(attr => {
      const attrName = (attr.name || '').toLowerCase()
      const displayName = (attr.display_name || '').toLowerCase()
      
      // Check if this is a group-level attribute (not variant-specific like size)
      if (groupAttributeNames.some(key => attrName.includes(key) || displayName.includes(key))) {
        const value = extractValue(attr.value)
        if (value && typeof value === 'string' && !value.includes('-') && !value.includes('től')) {
          // Not a range, so it's a group-level attribute
          keyAttributes.push(String(value).toUpperCase().replace(/\s+/g, '-'))
        }
      }
    })
  }
  
  // Extract from product name: remove size-specific parts, keep type/model
  let baseName = product.name || product.sku || ''
  // Remove size patterns (e.g., "350mm", "400mm", "500mm")
  baseName = baseName.replace(/\s*\d+\s*mm\s*/gi, '')
  baseName = baseName.replace(/\s*\d+\s*cm\s*/gi, '')
  // Remove SKU-like patterns at the end
  baseName = baseName.replace(/\s+[A-Z]{2,}\d+[A-Z]*\s*$/i, '')
  // Clean up and create identifier
  const nameParts = baseName
    .split(/\s+/)
    .filter(part => part.length > 2 && !/^\d+$/.test(part))
    .slice(0, 4) // Take first 4 meaningful words
    .map(part => part.toUpperCase().replace(/[^A-Z0-9]/g, '-'))
    .filter(part => part.length > 0)
  
  // Combine name parts with key attributes
  const identifierParts = [...nameParts, ...keyAttributes].filter(Boolean)
  
  if (identifierParts.length > 0) {
    return identifierParts.join('-').substring(0, 100) // Limit length
  }
  
  // Fallback: use first part of SKU (before numbers) + key attributes
  const skuBase = product.sku.replace(/\d+.*$/, '').toUpperCase()
  return skuBase || `GROUP-${product.sku}`
}

/**
 * Check if an attribute value represents a range (not variant-specific)
 */
function isRangeValue(value: any): boolean {
  if (!value) return false
  const str = String(value).toLowerCase()
  // Check for range indicators
  return str.includes('-') && (
    str.includes('mm') || str.includes('cm') || str.includes('m') ||
    str.includes('től') || str.includes('ig') || str.includes('to') || str.includes('from')
  ) || /\d+\s*-\s*\d+/.test(str)
}

/**
 * Extract numeric value from variant name/SKU
 * Generic approach - works for any numeric attribute (size, weight, capacity, etc.)
 * Returns: { value: number, unit: string } or null
 */
function extractNumericValueFromVariant(
  variantName: string,
  variantSku: string
): { value: number; unit: string } | null {
  // Try to extract from name (e.g., "350mm", "400mm", "5kg", "10L")
  const nameMatch = variantName.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|kg|g|ml|l|m2|m3)/i)
  if (nameMatch) {
    return {
      value: parseFloat(nameMatch[1].replace(',', '.')),
      unit: nameMatch[2]
    }
  }
  
  // Try to extract from SKU if it contains reasonable numeric values
  const skuMatch = variantSku.match(/(\d{3,})/)
  if (skuMatch) {
    const num = parseInt(skuMatch[1], 10)
    // If it's a reasonable size (100-1000 range), assume mm
    if (num >= 100 && num <= 1000) {
      return { value: num, unit: 'mm' }
    }
  }
  
  return null
}

/**
 * Find range attribute and replace with specific value
 * Generic approach - works for any range attribute
 */
function replaceRangeWithSpecificValue(
  attributes: Array<{ name: string; display_name?: string | null; value: any }>,
  specificValue: { value: number; unit: string } | null,
  attributeNamePattern: string // e.g., "hossz|length", "méret|size"
): Array<{ name: string; display_name?: string | null; value: any }> {
  if (!specificValue) return attributes
  
  return attributes.map(attr => {
    const attrName = (attr.name || '').toLowerCase()
    const displayName = (attr.display_name || '').toLowerCase()
    
    // Check if this is the range attribute we want to replace
    if (attributeNamePattern.split('|').some(pattern => 
      attrName.includes(pattern.toLowerCase()) || displayName.includes(pattern.toLowerCase())
    )) {
      const extractedValue = extractValue(attr.value)
      
      // If it's a range, replace with specific value
      if (extractedValue && isRangeValue(extractedValue)) {
        return {
          ...attr,
          value: `${specificValue.value} ${specificValue.unit}`
        }
      }
    }
    
    return attr
  })
}

/**
 * Generate calculated properties based on variant-specific values
 * Generic approach - works for any product type
 */
function generateCalculatedProperties(
  variantName: string,
  variantSku: string,
  parentAttributes: Array<{ name: string; display_name?: string | null; value: any }> | null
): Array<{ '@type': 'PropertyValue'; name: string; value: string }> {
  const calculated: Array<{ '@type': 'PropertyValue'; name: string; value: string }> = []
  
  // Extract numeric value from variant
  const numericValue = extractNumericValueFromVariant(variantName, variantSku)
  
  if (numericValue && parentAttributes) {
    // Look for parent attributes that might need calculation
    // Generic patterns: "hossz" → "korpuszmélység", "szélesség" → "min. szélesség", etc.
    for (const parentAttr of parentAttributes) {
      const attrName = (parentAttr.name || '').toLowerCase()
      const displayName = (parentAttr.display_name || '').toLowerCase()
      
      // Pattern: if parent has "Névleges hossz" or "hossz", calculate "Korpusz mélység" or "Min. korpuszmélység"
      if ((attrName.includes('hossz') || displayName.includes('hossz') || 
           attrName.includes('length') || displayName.includes('length')) &&
          numericValue.unit === 'mm') {
        const calculatedDepth = numericValue.value + 5 // Generic calculation: value + 5mm
        calculated.push({
          '@type': 'PropertyValue',
          name: 'Min. korpuszmélység',
          value: `${calculatedDepth} mm`
        })
      }
      
      // Add more generic calculation patterns here if needed
      // e.g., width → min width, height → min height, etc.
    }
  }
  
  return calculated
}

/**
 * Get group-level properties from parent (same across all variants)
 * Generic approach - returns 3-5 key properties that are constant
 */
function getGroupLevelProperties(
  parentAttributes: Array<{ name: string; display_name?: string | null; value: any }> | null,
  children: Array<{ product_attributes?: Array<{ name: string; value: any }> | null }>
): Array<{ '@type': 'PropertyValue'; name: string; value: string | number }> {
  if (!parentAttributes || !children || children.length === 0) return []
  
  const groupLevel: Array<{ '@type': 'PropertyValue'; name: string; value: string | number }> = []
  
  // Find attributes that are the same across all variants (group-level)
  for (const parentAttr of parentAttributes) {
    const parentExtracted = extractValue(parentAttr.value)
    if (!parentExtracted) continue
    
    // Skip if it's a range
    if (isRangeValue(parentExtracted)) continue
    
    // Check if all children have the same value
    let allSame = true
    for (const child of children) {
      if (!child.product_attributes) {
        allSame = false
        break
      }
      
      const childAttr = child.product_attributes.find(a => 
        a.name === parentAttr.name || 
        a.name?.toLowerCase() === parentAttr.name?.toLowerCase()
      )
      
      if (!childAttr) {
        allSame = false
        break
      }
      
      const childExtracted = extractValue(childAttr.value)
      if (String(childExtracted) !== String(parentExtracted)) {
        allSame = false
        break
      }
    }
    
    // If all variants have the same value, it's group-level
    if (allSame) {
      groupLevel.push({
        '@type': 'PropertyValue',
        name: parentAttr.display_name || parentAttr.name,
        value: parentExtracted
      })
    }
  }
  
  // Return top 5 most important (prioritize technical specs)
  // Generic priority: exclude variant-specific patterns, prioritize technical attributes
  const priorityAttributes = ['kávamagasság', 'teherbírás', 'szín', 'kihúzhatóság', 'vastagság', 
                             'magasság', 'capacity', 'load', 'color', 'extension', 'thickness']
  
  return groupLevel
    .sort((a, b) => {
      const aPriority = priorityAttributes.some(p => a.name.toLowerCase().includes(p)) ? 1 : 0
      const bPriority = priorityAttributes.some(p => b.name.toLowerCase().includes(p)) ? 1 : 0
      return bPriority - aPriority
    })
    .slice(0, 5) // Top 5 group-level properties
}

/**
 * Create a concise schema description (200-250 chars) from HTML description
 * Aggressively removes all HTML, CSS, and JavaScript to create clean plain text
 * GLOBAL FIX - works for all product types
 */
function createSchemaDescription(htmlDescription: string): string {
  if (!htmlDescription) return ''
  
  // First, decode HTML entities (handles &lt; &gt; etc.)
  let plain = decodeHtmlEntities(htmlDescription)
  
  // Remove <style> tags and their content (CSS)
  plain = plain.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  
  // Remove <script> tags and their content (JavaScript)
  plain = plain.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
  
  // Strip ALL HTML tags (including broken ones like </p><p>)
  plain = plain.replace(/<[^>]*>/g, ' ')
  
  // Remove CSS-like patterns (e.g., body{font-family:...} or font-family:Roboto;)
  plain = plain.replace(/\{[^}]*\}/g, ' ') // Remove { ... } blocks (CSS rules)
  plain = plain.replace(/[a-z-]+:\s*[^;]+;?/gi, ' ') // Remove CSS properties (e.g., font-family:Roboto;)
  
  // Remove any remaining HTML entity fragments
  plain = plain.replace(/&[a-z]+;/gi, ' ')
  plain = plain.replace(/&#\d+;/g, ' ')
  plain = plain.replace(/&#x[0-9a-f]+;/gi, ' ')
  
  // Clean whitespace: multiple spaces/newlines/tabs to single space
  plain = plain.replace(/\s+/g, ' ').trim()
  
  // Extract first meaningful sentences (skip very short ones)
  const sentences = plain.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 200) // Minimum 15 chars for meaningful sentence
  
  // Take first 1-2 sentences, limit to 250 chars (safety margin)
  let result = sentences.slice(0, 2).join('. ')
  
  // If still too long, truncate at word boundary
  if (result.length > 250) {
    result = result.substring(0, 247)
    const lastSpace = result.lastIndexOf(' ')
    if (lastSpace > 150) {
      result = result.substring(0, lastSpace)
    }
    result += '.'
  } else if (result && !result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) {
    result += '.'
  }
  
  return result || plain.substring(0, 250).trim()
}

/**
 * Format GTIN as gtin13 or gtin14 based on length
 */
function formatGTIN(gtin: string | null): { gtin13?: string; gtin14?: string; gtin?: string } | null {
  if (!gtin) return null
  
  // Remove non-digits
  const digits = gtin.replace(/\D/g, '')
  
  if (digits.length === 13) {
    return { gtin13: digits }
  } else if (digits.length === 14) {
    return { gtin14: digits }
  } else if (digits.length > 0) {
    return { gtin: digits }
  }
  
  return null
}

/**
 * Generate enhanced JSON-LD structured data for a product
 * Returns either a single Product/ProductGroup schema, or an array of [Product, FAQPage] schemas
 */
export function generateProductStructuredData(
  product: StructuredDataProduct,
  options: StructuredDataOptions = {}
): object | Array<object> {
  const currency = options.currency || 'HUF'
  const shopUrl = options.shopUrl || ''
  const shopName = options.shopName || ''

  // IMPORTANT: Extract FAQ from ORIGINAL description BEFORE any processing
  // This ensures we get the full description even if it gets truncated later
  const originalDescription = product.description?.description || ''
  console.log('[STRUCTURED DATA] Product SKU:', product.sku)
  console.log('[STRUCTURED DATA] Original description length:', originalDescription.length)
  console.log('[STRUCTURED DATA] Description exists:', !!originalDescription)
  
  const faqs = extractFAQFromDescription(originalDescription)
  const faqSchema = generateFAQPageSchema(faqs, product.product_url)
  
  if (faqSchema) {
    console.log('[STRUCTURED DATA] FAQPage schema generated with', faqs.length, 'questions')
  } else {
    console.log('[STRUCTURED DATA] No FAQPage schema generated (no FAQs found)')
  }

  // Determine if this is a parent product with variants
  const isSelfReferencing = product.parent_product_id === product.id
  const hasVariants = product.children && product.children.length > 0
  
  // Base schema - use ProductGroup if has variants, Product otherwise
  const schema: any = {
    '@context': 'https://schema.org/',
    '@type': hasVariants ? 'ProductGroup' : 'Product',
    name: product.name || product.sku,
  }
  
  // Add productGroupID for ProductGroup, sku/gtin/model for Product
  if (hasVariants) {
    // Generate stable productGroupID from product name/attributes (not SKU)
    schema.productGroupID = generateProductGroupID(product)
    // ProductGroup doesn't support sku, gtin, model - these go in variants
  } else {
    schema.sku = product.sku
    
    // Format GTIN properly (gtin13 or gtin14)
    const gtinData = formatGTIN(product.gtin)
    if (gtinData) {
      Object.assign(schema, gtinData)
    }

    // Add model number as mpn (Manufacturer Part Number) and model
    if (product.model_number) {
      schema.mpn = product.model_number // Manufacturer Part Number (preferred)
      schema.model = product.model_number // Also keep model for compatibility
    }
  }

  // Add description (concise version for schema, 150-300 chars)
  if (product.description?.description) {
    const schemaDescription = createSchemaDescription(product.description.description)
    if (schemaDescription) {
      schema.description = schemaDescription
    }
  }

  // Add images
  if (product.images && product.images.length > 0) {
    schema.image = product.images
      .filter(img => img.url)
      .map(img => img.url)
    
    // Schema.org requires at least one image
    if (schema.image.length === 0) {
      delete schema.image
    }
  }

  // extractValue is now a top-level function, no need to redefine it here
  
  // Add product attributes as additionalProperty
  // For ProductGroup: only include group-level attributes (exclude variant-specific)
  if (product.product_attributes && product.product_attributes.length > 0) {
    schema.additionalProperty = product.product_attributes
      .filter(attr => {
        // Basic validation
        if (!attr.name || attr.value === null || attr.value === undefined || attr.value === '') {
          return false
        }
        
        // For ProductGroup: exclude variant-specific attributes
        if (hasVariants) {
          // Check if this attribute differs between variants
          if (isVariantSpecificAttribute(attr.name, attr.value, product.children || [])) {
            return false // Exclude variant-specific attributes
          }
          
          // Also exclude ranges (these are group-level but not useful in ProductGroup)
          const extractedValue = extractValue(attr.value)
          if (extractedValue && isRangeValue(extractedValue)) {
            return false
          }
        }
        
        return true
      })
      .map(attr => {
        const extractedValue = extractValue(attr.value)

        // Skip if we couldn't extract a valid value
        if (extractedValue === null || 
            extractedValue === undefined || 
            String(extractedValue) === 'null' || 
            String(extractedValue) === 'undefined' ||
            String(extractedValue) === '[object Object]' ||
            String(extractedValue).trim() === '') {
          return null
        }

        return {
          '@type': 'PropertyValue',
          name: attr.display_name || attr.name, // Use display_name (from AttributeDescription) as primary
          value: extractedValue
        }
      })
      .filter((item: any) => item !== null) // Remove null items
    
    if (schema.additionalProperty.length === 0) {
      delete schema.additionalProperty
    }
  }

  // Add brand and manufacturer if available
  let brandName = product.brand || null
  if (!brandName) {
    brandName = extractBrandName(product)
  }
  if (brandName) {
    schema.brand = {
      '@type': 'Brand',
      name: brandName
    }
    // Also add manufacturer (same as brand for most cases)
    schema.manufacturer = {
      '@type': 'Organization',
      name: brandName
    }
  }

  // Add offers (only for Product type, not ProductGroup)
  // ProductGroup doesn't support offers - variants should have their own offers
  if (!hasVariants && product.price !== null && product.price !== undefined) {
    const availability = product.status === 1 
      ? 'https://schema.org/InStock' 
      : 'https://schema.org/OutOfStock'
    
    const offer: any = {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: currency,
      availability: availability,
      itemCondition: 'https://schema.org/NewCondition',
      url: product.product_url || `${shopUrl}/product/${product.sku}`,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year from now
    }
    
    // Add commerce extras (optional but improves Google Shopping)
    if (shopName) {
      offer.seller = {
        '@type': 'Organization',
        name: shopName
      }
    }
    
    schema.offers = offer
  }
  
  // For ProductGroup with variants, include parent product as first variant with its offer
  if (hasVariants && product.price !== null && product.price !== undefined) {
    const availability = product.status === 1 
      ? 'https://schema.org/InStock' 
      : 'https://schema.org/OutOfStock'
    
    // Create parent product variant with offer
    // Include all Product-specific fields (sku, gtin, model, image) in the variant
    const parentOffer: any = {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: currency,
      availability: availability,
      itemCondition: 'https://schema.org/NewCondition',
      url: product.product_url || `${shopUrl}/product/${product.sku}`,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
    
    // Add commerce extras (optional but improves Google Shopping)
    if (shopName) {
      parentOffer.seller = {
        '@type': 'Organization',
        name: shopName
      }
    }
    
    const parentVariant: any = {
      '@type': 'Product',
      sku: product.sku,
      name: product.name || product.sku,
      offers: parentOffer
    }
    
    // Add GTIN (formatted as gtin13/gtin14) and mpn to parent variant
    const parentGtinData = formatGTIN(product.gtin)
    if (parentGtinData) {
      Object.assign(parentVariant, parentGtinData)
    }
    if (product.model_number) {
      parentVariant.mpn = product.model_number // Manufacturer Part Number (preferred)
      parentVariant.model = product.model_number // Also keep model for compatibility
    }
    
    // Add image to parent variant (required by Google for Merchant Listings)
    if (product.images && product.images.length > 0) {
      parentVariant.image = product.images
        .filter(img => img.url)
        .map(img => img.url)
    }
    
    // Add parent product attributes if available
    if (product.product_attributes && product.product_attributes.length > 0) {
      const parentAdditionalProperty = product.product_attributes
        .filter(attr => attr.name && attr.value !== null && attr.value !== undefined && attr.value !== '')
        .map(attr => {
          const extractedValue = extractValue(attr.value)
          if (extractedValue === null || 
              extractedValue === undefined || 
              String(extractedValue) === 'null' || 
              String(extractedValue) === 'undefined' ||
              String(extractedValue) === '[object Object]' ||
              String(extractedValue).trim() === '') {
            return null
          }
          return {
            '@type': 'PropertyValue',
            name: attr.display_name || attr.name,
            value: extractedValue
          }
        })
        .filter((item: any) => item !== null)
      
      if (parentAdditionalProperty.length > 0) {
        parentVariant.additionalProperty = parentAdditionalProperty
      }
    }
    
    // Store parent variant to prepend to hasVariant array
    ;(schema as any)._parentVariant = parentVariant
  }

  // Handle parent-child relationships
  // According to Schema.org:
  // - Product type does NOT support hasVariant property
  // - ProductGroup type DOES support hasVariant property
  // - For parent products with variants, use ProductGroup as main type
  if (hasVariants) {
    // This is a parent product - use hasVariant (valid for ProductGroup)
    const variants = product.children.map(child => {
      // Extract numeric value from variant name/SKU (generic)
      const numericValue = extractNumericValueFromVariant(child.name || '', child.sku)
      
      // Get variant attributes and replace ranges with specific values
      let childAttributes = child.product_attributes || []
      
      // Replace range attributes with specific values (generic pattern matching)
      if (numericValue) {
        // Common range attribute patterns (generic - works for any product)
        const rangePatterns = ['hossz|length', 'méret|size', 'szélesség|width', 'magasság|height', 'mélység|depth']
        
        for (const pattern of rangePatterns) {
          childAttributes = replaceRangeWithSpecificValue(childAttributes, numericValue, pattern)
        }
      }
      
      // Filter variant attributes: only include variant-specific values
      // Exclude: ranges, group-level attributes (same as parent)
      const childAdditionalProperty = childAttributes
        ?.filter(attr => {
          // Basic validation
          if (!attr.name || attr.value === null || attr.value === undefined || attr.value === '') {
            return false
          }
          
          // Extract value and check if it's a range
          const extractedValue = extractValue(attr.value)
          if (!extractedValue || 
              extractedValue === null || 
              extractedValue === undefined || 
              String(extractedValue) === 'null' || 
              String(extractedValue) === 'undefined' ||
              String(extractedValue) === '[object Object]' ||
              String(extractedValue).trim() === '') {
            return false
          }
          
          // Exclude range values (e.g., "300-550 mm", "300 től 550 ig")
          // These are group-level attributes, not variant-specific
          if (isRangeValue(extractedValue)) {
            return false
          }
          
          // Exclude attributes that are the same as parent (group-level attributes)
          if (product.product_attributes) {
            const parentAttr = product.product_attributes.find(a => 
              a.name === attr.name || 
              a.name?.toLowerCase() === attr.name?.toLowerCase()
            )
            if (parentAttr) {
              const parentExtracted = extractValue(parentAttr.value)
              // If values are the same, it's group-level, exclude from variant
              if (String(extractedValue) === String(parentExtracted)) {
                return false
              }
            }
          }
          
          return true
        })
        .map(attr => {
          const extractedValue = extractValue(attr.value)
          
          return {
            '@type': 'PropertyValue',
            name: attr.display_name || attr.name, // Use display_name (from AttributeDescription) as primary
            value: extractedValue
          }
        })
        .filter((item: any) => item !== null) || []
      
      // Add calculated properties (generic - e.g., korpuszmélység = hossz + 5mm)
      const calculatedProps = generateCalculatedProperties(
        child.name || '',
        child.sku,
        product.product_attributes || null
      )
      childAdditionalProperty.push(...calculatedProps)
      
      // Add group-level properties (3-5 key properties same across all variants)
      const groupLevelProps = getGroupLevelProperties(
        product.product_attributes || null,
        product.children || []
      )
      childAdditionalProperty.push(...groupLevelProps)

      const childProduct: any = {
        '@type': 'Product',
        sku: child.sku,
        name: child.name || child.sku,
        additionalProperty: childAdditionalProperty
      }
      
      // Add GTIN (formatted as gtin13/gtin14) and mpn if available (variant-specific identifiers)
      const childGtinData = formatGTIN(child.gtin || null)
      if (childGtinData) {
        Object.assign(childProduct, childGtinData)
      }
      if (child.model_number) {
        childProduct.mpn = child.model_number // Manufacturer Part Number (preferred)
        childProduct.model = child.model_number // Also keep model for compatibility
      }
      
      // Add image to child variant (required by Google for Merchant Listings)
      // Use child's images if available, otherwise fallback to parent's image
      // Helper function to ensure absolute URLs
      const ensureAbsoluteUrl = (url: string): string => {
        if (!url) return ''
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url
        }
        // If relative, prepend shop URL
        return shopUrl ? `${shopUrl}/${url.replace(/^\//, '')}` : url
      }
      
      if (child.images && child.images.length > 0) {
        childProduct.image = child.images
          .map(img => typeof img === 'string' ? ensureAbsoluteUrl(img) : ensureAbsoluteUrl(img.url || ''))
          .filter(url => url)
      } else if (product.images && product.images.length > 0) {
        // Fallback to parent image if child has no images
        childProduct.image = product.images
          .filter(img => img.url)
          .map(img => ensureAbsoluteUrl(img.url))
          .filter(url => url)
      }
      
      // Add offer (CRITICAL - required for Google Merchant Listings)
      // Each variant must have its own offer with price, availability, and URL
      if (child.price !== null && child.price !== undefined) {
        const availability = (child.status === 1 || child.status === undefined) 
          ? 'https://schema.org/InStock' 
          : 'https://schema.org/OutOfStock'
        
        const childOffer: any = {
          '@type': 'Offer',
          price: child.price.toString(),
          priceCurrency: currency,
          availability: availability,
          itemCondition: 'https://schema.org/NewCondition',
          url: child.product_url || (shopUrl ? `${shopUrl}/product/${child.sku}` : ''),
          priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year from now
        }
        
        // Add commerce extras (optional but improves Google Shopping)
        if (shopName) {
          childOffer.seller = {
            '@type': 'Organization',
            name: shopName
          }
        }
        
        childProduct.offers = childOffer
      }
      
      return childProduct
    })
    
    // Prepend parent product as first variant (with its offer)
    if ((schema as any)._parentVariant) {
      schema.hasVariant = [(schema as any)._parentVariant, ...variants]
      delete (schema as any)._parentVariant
    } else {
      schema.hasVariant = variants
    }
  } else if (product.parent_product_id && product.parent && !isSelfReferencing) {
    // This is a child product - reference parent (only if not self-referencing)
    // Generate productGroupID from parent (same logic as ProductGroup)
    const parentForGroupID: StructuredDataProduct = {
      ...product,
      sku: product.parent.sku,
      name: product.parent.name,
      product_attributes: product.parent.product_attributes || null
    }
    const parentGroupID = generateProductGroupID(parentForGroupID)
    
    schema.isVariantOf = {
      '@type': 'ProductGroup',
      name: product.parent.name || product.parent.sku,
      productGroupID: parentGroupID
    }
  }

  // Add URL if available
  if (product.product_url) {
    schema.url = product.product_url
  }

  // Add @id to schemas for @graph structure (optional but improves entity linking)
  if (hasVariants && schema.productGroupID) {
    schema['@id'] = `#product-group-${schema.productGroupID}`
    
    // Add @id to all variants
    if (schema.hasVariant && Array.isArray(schema.hasVariant)) {
      schema.hasVariant.forEach((variant: any, index: number) => {
        if (variant.sku) {
          variant['@id'] = `#product-${variant.sku}`
        }
      })
    }
  } else if (product.sku) {
    schema['@id'] = `#product-${product.sku}`
  }
  
  if (faqSchema) {
    faqSchema['@id'] = `#faq-page-${product.sku}`
  }

  // Return both schemas if FAQ exists, otherwise just Product schema
  // Optionally wrap in @graph for better entity linking (pro feature)
  if (faqSchema) {
    console.log('[STRUCTURED DATA] Returning array with Product and FAQPage schemas')
    
    // Return as @graph if we have multiple schemas with @id
    if (schema['@id'] && faqSchema['@id']) {
      // Remove @context from individual schemas when using @graph
      // @context should only be at the root level
      const schemaWithoutContext = { ...schema }
      delete schemaWithoutContext['@context']
      
      const faqSchemaWithoutContext = { ...faqSchema }
      delete faqSchemaWithoutContext['@context']
      
      return {
        '@context': 'https://schema.org/',
        '@graph': [schemaWithoutContext, faqSchemaWithoutContext]
      }
    }
    
    // Fallback: return array of schemas (keep @context in each for standalone use)
    return [schema, faqSchema]
  }
  
  console.log('[STRUCTURED DATA] Returning single Product schema (no FAQ)')
  return schema // Return single schema if no FAQ
}

/**
 * Extract brand name from product attributes or name
 */
function extractBrandName(product: StructuredDataProduct): string | null {
  // Try to find brand in attributes
  if (product.product_attributes) {
    const brandAttr = product.product_attributes.find(
      attr => attr.name.toLowerCase().includes('brand') || 
              attr.name.toLowerCase().includes('márka') ||
              attr.name.toLowerCase().includes('gyártó')
    )
    if (brandAttr && brandAttr.value) {
      return String(brandAttr.value)
    }
  }

  // Try to extract from product name (common patterns)
  if (product.name) {
    // Look for patterns like "BrandName Product Name"
    const parts = product.name.split(' ')
    if (parts.length > 1) {
      // Common brand patterns in first 1-2 words
      const potentialBrand = parts.slice(0, 2).join(' ')
      if (potentialBrand.length > 2 && potentialBrand.length < 30) {
        return potentialBrand
      }
    }
  }

  return null
}
