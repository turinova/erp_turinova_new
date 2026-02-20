import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * PUT /api/products/[id]/competitor-links/[linkId]
 * Update a competitor link
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { linkId } = await params
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { competitor_url, competitor_sku, competitor_product_name, is_active } = body

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (competitor_url !== undefined) updateData.competitor_url = competitor_url
    if (competitor_sku !== undefined) updateData.competitor_sku = competitor_sku
    if (competitor_product_name !== undefined) updateData.competitor_product_name = competitor_product_name
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: link, error } = await supabase
      .from('competitor_product_links')
      .update(updateData)
      .eq('id', linkId)
      .select(`
        *,
        competitor:competitors(*)
      `)
      .single()

    if (error) {
      console.error('Error updating competitor link:', error)
      return NextResponse.json({ error: 'Failed to update competitor link' }, { status: 500 })
    }

    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('Error updating competitor link:', error)
    return NextResponse.json({ error: 'Failed to update competitor link' }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]/competitor-links/[linkId]
 * Delete a competitor link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { linkId } = await params
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { error } = await supabase
      .from('competitor_product_links')
      .delete()
      .eq('id', linkId)

    if (error) {
      console.error('Error deleting competitor link:', error)
      return NextResponse.json({ error: 'Failed to delete competitor link' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Versenytárs link törölve' })
  } catch (error) {
    console.error('Error deleting competitor link:', error)
    return NextResponse.json({ error: 'Failed to delete competitor link' }, { status: 500 })
  }
}
