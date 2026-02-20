/**
 * Canonical URL Management Service
 * Manages canonical URLs for child products (pointing to parent)
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Update canonical URLs for all child products of a parent
 * Sets child canonical_url to point to parent product URL
 */
export async function updateCanonicalUrlsForChildren(
  supabase: any,
  parentProductId: string
): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    // Get parent product URL
    const { data: parentProduct, error: parentError } = await supabase
      .from('shoprenter_products')
      .select('id, product_url, url_slug, connection_id')
      .eq('id', parentProductId)
      .single()

    if (parentError || !parentProduct) {
      return {
        success: false,
        updated: 0,
        error: 'Parent product not found'
      }
    }

    // Get parent URL (prefer product_url, fallback to constructing from url_slug)
    let parentUrl = parentProduct.product_url
    if (!parentUrl && parentProduct.url_slug) {
      // Get connection to build shop URL
      const { data: connection } = await supabase
        .from('connections')
        .select('api_url')
        .eq('id', parentProduct.connection_id)
        .single()

      const shopName = connection?.api_url
        ? connection.api_url.match(/https?:\/\/([^.]+)\.api/)?.[1]
        : null

      if (shopName) {
        parentUrl = `https://${shopName}.shoprenter.hu/${parentProduct.url_slug}`
      }
    }

    if (!parentUrl) {
      return {
        success: false,
        updated: 0,
        error: 'Parent product URL not available'
      }
    }

    // Update all child products to point canonical_url to parent
    const { data: updated, error: updateError } = await supabase
      .from('shoprenter_products')
      .update({ canonical_url: parentUrl })
      .eq('parent_product_id', parentProductId)
      .select('id')

    if (updateError) {
      console.error('Error updating canonical URLs:', updateError)
      return {
        success: false,
        updated: 0,
        error: updateError.message
      }
    }

    return {
      success: true,
      updated: updated?.length || 0
    }
  } catch (error) {
    console.error('Error updating canonical URLs:', error)
    return {
      success: false,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Update canonical URL for a single child product
 */
export async function updateCanonicalUrlForChild(
  supabase: any,
  childProductId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get child product and its parent
    const { data: childProduct, error: childError } = await supabase
      .from('shoprenter_products')
      .select('id, parent_product_id, connection_id')
      .eq('id', childProductId)
      .single()

    if (childError || !childProduct) {
      return {
        success: false,
        error: 'Child product not found'
      }
    }

    if (!childProduct.parent_product_id) {
      return {
        success: false,
        error: 'Product is not a child product'
      }
    }

    // Update using parent
    const result = await updateCanonicalUrlsForChildren(supabase, childProduct.parent_product_id)
    
    if (!result.success) {
      return result
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Error updating canonical URL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Clear canonical URL (set to null) for a product
 * Useful when a child product becomes a parent or standalone
 */
export async function clearCanonicalUrl(
  supabase: any,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shoprenter_products')
      .update({ canonical_url: null })
      .eq('id', productId)

    if (error) {
      console.error('Error clearing canonical URL:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Error clearing canonical URL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
