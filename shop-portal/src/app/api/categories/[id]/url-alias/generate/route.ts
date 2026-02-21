import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/categories/[id]/url-alias/generate
 * Generate SEO-optimized URL slug using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get category with descriptions
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select(`
        id,
        name,
        url_slug,
        shoprenter_category_descriptions (
          name,
          language_id
        )
      `)
      .eq('id', id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { success: false, error: 'Kategória nem található' },
        { status: 404 }
      )
    }

    // Get Hungarian description
    const huDescription = (category.shoprenter_category_descriptions || []).find(
      (d: any) => d.language_id?.includes('hu') || d.language_id === 'hu'
    ) || { name: category.name || '' }

    // Get parent category name (if available)
    const { data: parentCategoryData } = await supabase
      .from('shoprenter_categories')
      .select(`
        name,
        shoprenter_category_descriptions (
          name,
          language_id
        )
      `)
      .eq('id', (category as any).parent_category_id)
      .single()

    let parentCategoryName = ''
    if (parentCategoryData?.shoprenter_category_descriptions) {
      const parentDesc = parentCategoryData.shoprenter_category_descriptions.find(
        (d: any) => d.language_id?.includes('hu') || d.language_id === 'hu'
      )
      parentCategoryName = parentDesc?.name || parentCategoryData.name || ''
    }

    // Prepare AI prompt
    const categoryName = huDescription.name || category.name || ''
    const currentSlug = category.url_slug || ''

    const prompt = `Generate an SEO-optimized URL slug for this Hungarian e-commerce category:

Category Name: ${categoryName}
Parent Category: ${parentCategoryName || '(nincs)'}
Current URL Slug: ${currentSlug || '(nincs)'}

Requirements:
- Hungarian language, convert accents to ASCII (á→a, é→e, í→i, ó→o, ö→o, ő→o, ú→u, ü→u, ű→u)
- Maximum 60 characters
- Use hyphens (-) between words
- Include primary keyword from category name
- No stop words (a, az, és, vagy, van, volt, lesz)
- Lowercase only
- No special characters except hyphens
- Make it readable and SEO-friendly
- If parent category exists, consider including it in the slug

Return ONLY the slug, nothing else. Example: "konyhai-butorok" or "konyhai-butorok-szekrenyek"`

    // Call Claude AI
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        { role: 'user', content: prompt }
      ]
    })

    const generatedSlug = message.content[0].type === 'text' 
      ? message.content[0].text.trim()
      : ''

    if (!generatedSlug) {
      return NextResponse.json(
        { success: false, error: 'AI nem tudott URL slug-ot generálni' },
        { status: 500 }
      )
    }

    // Sanitize the generated slug
    const sanitizedSlug = generatedSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) // Enforce max length

    return NextResponse.json({
      success: true,
      data: {
        suggestedSlug: sanitizedSlug,
        currentSlug: currentSlug || '',
        previewUrl: sanitizedSlug ? `https://turinovakft.hu/${sanitizedSlug}` : null
      }
    })
  } catch (error: any) {
    console.error('Error generating URL alias:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt az AI generálás során' },
      { status: 500 }
    )
  }
}
