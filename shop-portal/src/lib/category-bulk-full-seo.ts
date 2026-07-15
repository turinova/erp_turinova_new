/**
 * Single-category full SEO generation (GEO + meta) for bulk operations.
 */

import { generateCategoryGeoContent } from '@/lib/ai-category-geo-service'
import { generateCategoryMetaFields } from '@/lib/category-meta-generation-service'
import {
  HU_LANG_ID,
  validateCategoryGeoContent
} from '@/lib/category-geo-validator'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

export const FULL_SEO_CREDITS_PER_CATEGORY = 1

export interface CategoryFullSeoResult {
  categoryId: string
  categoryName: string
  status: 'generated' | 'skipped' | 'failed'
  error?: string
  validationErrors?: string[]
  validationWarnings?: string[]
  creditsUsed: number
  fieldsUpdated: string[]
}

function getHuDescription(category: any) {
  return (
    category.shoprenter_category_descriptions?.find((d: any) => d.language_id === HU_LANG_ID) ||
    category.shoprenter_category_descriptions?.[0]
  )
}

export function categoryNeedsFullSeo(desc: any | undefined, onlyMissing: boolean): boolean {
  if (!onlyMissing) return true
  if (!desc) return true

  const hasIntro = (desc.description || '').replace(/<[^>]+>/g, '').trim().length >= 30
  const hasFooter = (desc.footer_seo_text || '').replace(/<[^>]+>/g, '').trim().length >= 80
  const hasMetaTitle = (desc.custom_title || '').trim().length >= 10
  const hasMetaDesc = (desc.meta_description || '').trim().length >= 50

  return !(hasIntro && hasFooter && hasMetaTitle && hasMetaDesc)
}

export async function persistCategoryFullSeoFields(
  supabase: any,
  categoryId: string,
  fields: {
    name?: string
    custom_title?: string
    meta_description?: string
    description?: string
    footer_seo_text?: string
  }
): Promise<void> {
  const { data: existing } = await supabase
    .from('shoprenter_category_descriptions')
    .select('id')
    .eq('category_id', categoryId)
    .eq('language_id', HU_LANG_ID)
    .maybeSingle()

  const updateData: Record<string, string | null> = {
    updated_at: new Date().toISOString()
  }
  if (fields.name !== undefined) updateData.name = fields.name || null
  if (fields.custom_title !== undefined) updateData.custom_title = fields.custom_title || null
  if (fields.meta_description !== undefined) updateData.meta_description = fields.meta_description || null
  if (fields.description !== undefined) updateData.description = fields.description || null
  if (fields.footer_seo_text !== undefined) updateData.footer_seo_text = fields.footer_seo_text || null

  if (existing?.id) {
    const { error } = await supabase
      .from('shoprenter_category_descriptions')
      .update(updateData)
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const tempShoprenterId = Buffer.from(`manual-category-desc-${categoryId}-${HU_LANG_ID}`).toString('base64')
    const { error } = await supabase.from('shoprenter_category_descriptions').insert({
      category_id: categoryId,
      language_id: HU_LANG_ID,
      shoprenter_id: tempShoprenterId,
      ...updateData
    })
    if (error) throw new Error(error.message)
  }

  if (fields.name) {
    await supabase.from('shoprenter_categories').update({ name: fields.name }).eq('id', categoryId)
  }

  await supabase
    .from('shoprenter_categories')
    .update({ sync_status: 'pending', sync_error: null })
    .eq('id', categoryId)
}

export async function generateCategoryFullSeo(
  supabase: any,
  categoryId: string,
  userId: string,
  options: {
    onlyMissing?: boolean
    skipOnValidationError?: boolean
    useProductData?: boolean
  } = {}
): Promise<CategoryFullSeoResult> {
  const { onlyMissing = true, skipOnValidationError = true, useProductData = true } = options

  const { data: category, error } = await supabase
    .from('shoprenter_categories')
    .select(`id, name, shoprenter_category_descriptions(*)`)
    .eq('id', categoryId)
    .is('deleted_at', null)
    .single()

  if (error || !category) {
    return {
      categoryId,
      categoryName: '—',
      status: 'failed',
      error: 'Kategória nem található',
      creditsUsed: 0,
      fieldsUpdated: []
    }
  }

  const huDesc = getHuDescription(category)
  const categoryName = huDesc?.name || category.name || 'Kategória'

  if (!categoryNeedsFullSeo(huDesc, onlyMissing)) {
    return {
      categoryId,
      categoryName,
      status: 'skipped',
      creditsUsed: 0,
      fieldsUpdated: []
    }
  }

  let creditsUsed = 0
  const fieldsUpdated: string[] = []

  try {
    const geo = await generateCategoryGeoContent(supabase, categoryId, {
      profile: 'geo-full',
      useProductData
    })

    const validation = validateCategoryGeoContent(geo.description, geo.footerSeoText)
    if (skipOnValidationError && !validation.valid) {
      return {
        categoryId,
        categoryName,
        status: 'failed',
        error: validation.errors.join('; '),
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
        creditsUsed: 0,
        fieldsUpdated
      }
    }

    const meta = await generateCategoryMetaFields(
      supabase,
      categoryId,
      userId,
      ['meta_title', 'meta_description'],
      { trackCredits: false }
    )

    await persistCategoryFullSeoFields(supabase, categoryId, {
      custom_title: meta.meta_title,
      meta_description: meta.meta_description,
      description: geo.description,
      footer_seo_text: geo.footerSeoText
    })

    creditsUsed = FULL_SEO_CREDITS_PER_CATEGORY
    await trackAIUsage({
      userId,
      featureType: 'category_geo_description',
      tokensUsed: geo.tokensUsed + meta.tokensUsed,
      modelUsed: geo.modelUsed || 'bulk-full-seo',
      categoryId,
      creditsUsed: FULL_SEO_CREDITS_PER_CATEGORY,
      creditType: 'ai_generation',
      metadata: { bulk: true, profile: 'full-seo', flatRate: true }
    })

    if (meta.meta_title) fieldsUpdated.push('custom_title')
    if (meta.meta_description) fieldsUpdated.push('meta_description')
    fieldsUpdated.push('description', 'footer_seo_text')

    return {
      categoryId,
      categoryName,
      status: 'generated',
      validationWarnings: validation.warnings,
      creditsUsed,
      fieldsUpdated
    }
  } catch (e: any) {
    return {
      categoryId,
      categoryName,
      status: 'failed',
      error: e?.message || 'Generálási hiba',
      creditsUsed,
      fieldsUpdated
    }
  }
}
