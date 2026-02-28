import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'
import { fetchShopRenterTaxClasses } from '@/lib/shoprenter-tax-class'

/**
 * GET /api/connections/[id]/tax-class-mappings
 * Get all taxClass mappings for a connection
 */
export async function GET(
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
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(id, supabase)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get all VAT rates
    const { data: vatRates, error: vatError } = await supabase
      .from('vat')
      .select('id, name, kulcs')
      .is('deleted_at', null)
      .order('kulcs', { ascending: true })

    if (vatError) {
      console.error('Error fetching VAT rates:', vatError)
      return NextResponse.json(
        { error: 'Hiba az ÁFA kulcsok lekérdezésekor' },
        { status: 500 }
      )
    }

    // Get all mappings
    const { data: mappings, error: mappingError } = await supabase
      .from('shoprenter_tax_class_mappings')
      .select('vat_id, shoprenter_tax_class_id, shoprenter_tax_class_name')
      .eq('connection_id', id)

    if (mappingError) {
      console.error('Error fetching mappings:', mappingError)
      return NextResponse.json(
        { error: 'Hiba a leképezések lekérdezésekor' },
        { status: 500 }
      )
    }

    // Get ShopRenter taxClasses
    let shoprenterTaxClasses: any[] = []
    try {
      const shopName = extractShopNameFromUrl(connection.api_url)
      if (shopName) {
        const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
          shopName,
          connection.username,
          connection.password,
          connection.api_url
        )
        shoprenterTaxClasses = await fetchShopRenterTaxClasses(apiBaseUrl, authHeader)
      }
    } catch (error) {
      console.warn('Error fetching ShopRenter taxClasses:', error)
      // Continue without ShopRenter taxClasses
    }

    return NextResponse.json({
      vatRates: vatRates || [],
      mappings: mappings || [],
      shoprenterTaxClasses
    })
  } catch (error) {
    console.error('Error in tax-class-mappings GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/connections/[id]/tax-class-mappings
 * Create or update a taxClass mapping
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
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { vat_id, shoprenter_tax_class_id, shoprenter_tax_class_name } = body

    if (!vat_id || !shoprenter_tax_class_id) {
      return NextResponse.json(
        { error: 'vat_id és shoprenter_tax_class_id megadása kötelező' },
        { status: 400 }
      )
    }

    // Upsert mapping
    const { data, error } = await supabase
      .from('shoprenter_tax_class_mappings')
      .upsert({
        connection_id: id,
        vat_id,
        shoprenter_tax_class_id,
        shoprenter_tax_class_name: shoprenter_tax_class_name || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'connection_id,vat_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving mapping:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a leképezés mentésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ mapping: data })
  } catch (error) {
    console.error('Error in tax-class-mappings POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/connections/[id]/tax-class-mappings
 * Delete a taxClass mapping
 */
export async function DELETE(
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
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const vat_id = searchParams.get('vat_id')

    if (!vat_id) {
      return NextResponse.json(
        { error: 'vat_id megadása kötelező' },
        { status: 400 }
      )
    }

    // Delete mapping
    const { error } = await supabase
      .from('shoprenter_tax_class_mappings')
      .delete()
      .eq('connection_id', id)
      .eq('vat_id', vat_id)

    if (error) {
      console.error('Error deleting mapping:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a leképezés törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in tax-class-mappings DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
