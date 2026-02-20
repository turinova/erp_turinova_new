import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/competitors/[id]
 * Get a specific competitor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: competitor, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    return NextResponse.json(competitor)
  } catch (error) {
    console.error('Error fetching competitor:', error)
    return NextResponse.json({ error: 'Failed to fetch competitor' }, { status: 500 })
  }
}

/**
 * PUT /api/competitors/[id]
 * Update a competitor
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, website_url, is_active, scrape_config } = body

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (website_url !== undefined) updateData.website_url = website_url
    if (is_active !== undefined) updateData.is_active = is_active
    if (scrape_config !== undefined) updateData.scrape_config = scrape_config

    const { data: competitor, error } = await supabase
      .from('competitors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating competitor:', error)
      return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, competitor })
  } catch (error) {
    console.error('Error updating competitor:', error)
    return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 })
  }
}

/**
 * DELETE /api/competitors/[id]
 * Delete a competitor
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { error } = await supabase
      .from('competitors')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting competitor:', error)
      return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Versenytárs törölve' })
  } catch (error) {
    console.error('Error deleting competitor:', error)
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 })
  }
}
