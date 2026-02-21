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
  } | null
  children?: Array<{
    id: string
    sku: string
    name: string | null
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
 * Generate enhanced JSON-LD structured data for a product
 */
export function generateProductStructuredData(
  product: StructuredDataProduct,
  options: StructuredDataOptions = {}
): object {
  const currency = options.currency || 'HUF'
  const shopUrl = options.shopUrl || ''
  const shopName = options.shopName || ''

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
    schema.productGroupID = product.sku
    // ProductGroup doesn't support sku, gtin, model - these go in variants
  } else {
    schema.sku = product.sku
    
    // Add GTIN if available (Product only)
    if (product.gtin) {
      schema.gtin = product.gtin
    }

    // Add model number as additional identifier (Product only)
    if (product.model_number) {
      schema.model = product.model_number
    }
  }

  // Add description
  if (product.description?.description) {
    // Strip HTML tags for plain text description
    const plainDescription = product.description.description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
      .substring(0, 5000) // Limit length
    
    if (plainDescription) {
      schema.description = plainDescription
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

  // Helper function to extract value from object/array/primitive (reusable for parent and child attributes)
  const extractValue = (val: any): string | number | null => {
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
  
  // Add product attributes as additionalProperty
  if (product.product_attributes && product.product_attributes.length > 0) {
    schema.additionalProperty = product.product_attributes
      .filter(attr => attr.name && attr.value !== null && attr.value !== undefined && attr.value !== '')
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

  // Add brand if available (from database field, or extract from attributes/name as fallback)
  let brandName = product.brand || null
  if (!brandName) {
    brandName = extractBrandName(product)
  }
  if (brandName) {
    schema.brand = {
      '@type': 'Brand',
      name: brandName
    }
  }

  // Add offers (only for Product type, not ProductGroup)
  // ProductGroup doesn't support offers - variants should have their own offers
  if (!hasVariants && product.price !== null && product.price !== undefined) {
    const availability = product.status === 1 
      ? 'https://schema.org/InStock' 
      : 'https://schema.org/OutOfStock'
    
    schema.offers = {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: currency,
      availability: availability,
      itemCondition: 'https://schema.org/NewCondition',
      url: product.product_url || `${shopUrl}/product/${product.sku}`,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 year from now
    }
  }
  
  // For ProductGroup with variants, include parent product as first variant with its offer
  if (hasVariants && product.price !== null && product.price !== undefined) {
    const availability = product.status === 1 
      ? 'https://schema.org/InStock' 
      : 'https://schema.org/OutOfStock'
    
    // Create parent product variant with offer
    // Include all Product-specific fields (sku, gtin, model, image) in the variant
    const parentVariant: any = {
      '@type': 'Product',
      sku: product.sku,
      name: product.name || product.sku,
      offers: {
        '@type': 'Offer',
        price: product.price.toString(),
        priceCurrency: currency,
        availability: availability,
        itemCondition: 'https://schema.org/NewCondition',
        url: product.product_url || `${shopUrl}/product/${product.sku}`,
        priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }
    
    // Add GTIN and model to parent variant (Product-specific fields)
    if (product.gtin) {
      parentVariant.gtin = product.gtin
    }
    if (product.model_number) {
      parentVariant.model = product.model_number
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
      const childAdditionalProperty = child.product_attributes
        ?.filter(attr => attr.name && attr.value !== null && attr.value !== undefined && attr.value !== '')
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
        .filter((item: any) => item !== null) || []

      const childProduct: any = {
        '@type': 'Product',
        sku: child.sku,
        name: child.name || child.sku,
        additionalProperty: childAdditionalProperty
      }
      
      // Add image to child variant (required by Google for Merchant Listings)
      // Use child's images if available, otherwise fallback to parent's image
      if (child.images && child.images.length > 0) {
        childProduct.image = child.images
      } else if (product.images && product.images.length > 0) {
        // Fallback to parent image if child has no images
        childProduct.image = product.images
          .filter(img => img.url)
          .map(img => img.url)
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
    schema.isVariantOf = {
      '@type': 'ProductGroup',
      name: product.parent.name || product.parent.sku,
      productGroupID: product.parent.sku
    }
  }

  // Add URL if available
  if (product.product_url) {
    schema.url = product.product_url
  }

  return schema
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
