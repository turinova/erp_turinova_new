import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/competitors
 * Get all competitors
 */
export async function GET(request: NextRequest) {
  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: competitors, error } = await supabase
      .from('competitors')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching competitors:', error)
      return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 })
    }

    return NextResponse.json(competitors || [])
  } catch (error) {
    console.error('Error fetching competitors:', error)
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 })
  }
}

/**
 * POST /api/competitors
 * Create a new competitor
 */
export async function POST(request: NextRequest) {
  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, website_url, is_active } = body

    if (!name || !website_url) {
      return NextResponse.json(
        { error: 'Név és weboldal URL megadása kötelező' },
        { status: 400 }
      )
    }

    const { data: competitor, error } = await supabase
      .from('competitors')
      .insert({
        name,
        website_url,
        is_active: is_active ?? true,
        scrape_config: {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating competitor:', error)
      return NextResponse.json({ error: 'Failed to create competitor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, competitor })
  } catch (error) {
    console.error('Error creating competitor:', error)
    return NextResponse.json({ error: 'Failed to create competitor' }, { status: 500 })
  }
}
