/**
 * Structured Data (JSON-LD) Generation Service
 * Generates Schema.org structured data for parent-child product relationships
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface ProductGroupVariant {
  sku: string
  name: string | null
  modelNumber: string | null
  price: number | null
  url: string | null
  gtin: string | null
}

/**
 * Generate ProductGroup JSON-LD structured data for a parent product
 * This helps search engines understand variant relationships
 */
export async function generateProductGroupStructuredData(
  supabase: any,
  productId: string
): Promise<{ success: boolean; jsonLd: any; error?: string }> {
  try {
    // Get parent product
    const { data: parentProduct, error: parentError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        sku,
        name,
        model_number,
        price,
        product_url,
        url_slug,
        gtin,
        connection_id,
        shoprenter_product_descriptions!inner (
          name,
          language_code
        )
      `)
      .eq('id', productId)
      .eq('status', 1)
      .single()

    if (parentError || !parentProduct) {
      return {
        success: false,
        jsonLd: null,
        error: 'Parent product not found'
      }
    }

    // Get all child products (variants)
    const { data: childProducts, error: childrenError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        sku,
        name,
        model_number,
        price,
        product_url,
        url_slug,
        gtin
      `)
      .eq('parent_product_id', productId)
      .eq('status', 1)

    if (childrenError) {
      console.error('Error fetching child products:', childrenError)
      return {
        success: false,
        jsonLd: null,
        error: 'Error fetching child products'
      }
    }

    // If no children, don't generate ProductGroup (just regular Product schema)
    if (!childProducts || childProducts.length === 0) {
      return {
        success: false,
        jsonLd: null,
        error: 'No child products found - ProductGroup not applicable'
      }
    }

    // Get Hungarian description for product name
    const huDescription = (parentProduct.shoprenter_product_descriptions || []).find(
      (d: any) => d.language_code === 'hu'
    ) || { name: parentProduct.name || parentProduct.sku }

    // Get connection to build shop URL
    const { data: connection } = await supabase
      .from('connections')
      .select('api_url')
      .eq('id', parentProduct.connection_id)
      .single()

    const shopName = connection?.api_url
      ? connection.api_url.match(/https?:\/\/([^.]+)\.api/)?.[1]
      : null

    const baseUrl = shopName ? `https://${shopName}.shoprenter.hu` : null
    const parentUrl = parentProduct.product_url || 
      (baseUrl && parentProduct.url_slug ? `${baseUrl}/${parentProduct.url_slug}` : null)

    // Build ProductGroup JSON-LD
    const productGroup: any = {
      '@context': 'https://schema.org',
      '@type': 'ProductGroup',
      name: huDescription.name || parentProduct.name || parentProduct.sku,
      productGroupID: parentProduct.sku,
      ...(parentProduct.model_number && { model: parentProduct.model_number }),
      ...(parentUrl && { url: parentUrl }),
      hasVariant: childProducts.map((child: any) => {
        const childUrl = child.product_url || 
          (baseUrl && child.url_slug ? `${baseUrl}/${child.url_slug}` : null)
        
        return {
          '@type': 'Product',
          sku: child.sku,
          name: child.name || child.sku,
          ...(child.model_number && { model: child.model_number }),
          ...(child.price && {
            offers: {
              '@type': 'Offer',
              price: child.price,
              priceCurrency: 'HUF',
              availability: 'https://schema.org/InStock'
            }
          }),
          ...(childUrl && { url: childUrl }),
          ...(child.gtin && { gtin: child.gtin })
        }
      })
    }

    // Add offers for parent if available
    if (parentProduct.price) {
      productGroup.offers = {
        '@type': 'AggregateOffer',
        priceCurrency: 'HUF',
        lowPrice: Math.min(
          parentProduct.price,
          ...childProducts.map((c: any) => c.price || Infinity).filter((p: number) => p !== Infinity)
        ),
        highPrice: Math.max(
          parentProduct.price,
          ...childProducts.map((c: any) => c.price || 0).filter((p: number) => p > 0)
        ),
        offerCount: childProducts.length + 1,
        availability: 'https://schema.org/InStock'
      }
    }

    return {
      success: true,
      jsonLd: productGroup
    }
  } catch (error) {
    console.error('Error generating ProductGroup structured data:', error)
    return {
      success: false,
      jsonLd: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Save structured data to database
 */
export async function saveStructuredData(
  supabase: any,
  productId: string,
  structuredDataType: string,
  jsonLdData: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('product_structured_data')
      .upsert({
        product_id: productId,
        structured_data_type: structuredDataType,
        json_ld_data: jsonLdData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'product_id,structured_data_type'
      })

    if (error) {
      console.error('Error saving structured data:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving structured data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get structured data for a product
 */
export async function getStructuredData(
  supabase: any,
  productId: string,
  structuredDataType: string = 'ProductGroup'
): Promise<{ success: boolean; jsonLd: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('product_structured_data')
      .select('json_ld_data')
      .eq('product_id', productId)
      .eq('structured_data_type', structuredDataType)
      .single()

    if (error || !data) {
      return {
        success: false,
        jsonLd: null,
        error: 'Structured data not found'
      }
    }

    return {
      success: true,
      jsonLd: data.json_ld_data
    }
  } catch (error) {
    console.error('Error fetching structured data:', error)
    return {
      success: false,
      jsonLd: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
