import { NextRequest, NextResponse } from 'next/server'
import { createTenant, createAdminClient } from '@/lib/supabase-server'

// GET /api/tenants?slug=xxx - Check if slug is available
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ exists: false })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('[API] Error checking slug:', error)
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({ exists: !!data })
  } catch (error: any) {
    console.error('[API] Error checking slug:', error)
    return NextResponse.json({ exists: false })
  }
}

// POST /api/tenants - Create a new tenant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const newTenant = await createTenant(body)
    
    return NextResponse.json(newTenant, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error creating tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create tenant' },
      { status: 500 }
    )
  }
}
