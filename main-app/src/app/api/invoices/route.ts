import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// GET /api/invoices - List all invoices with pagination and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * limit

    // Build query
    let query = supabaseAdmin
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('provider', 'szamlazz_hu')
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim()
      // Search by invoice number, customer name, or customer_id (exact match for UUID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm)
      if (isUuid) {
        // If search term looks like a UUID, search by customer_id exactly
        query = query.eq('customer_id', searchTerm)
      } else {
        // Otherwise search by invoice number or customer name
        query = query.or(
          `internal_number.ilike.%${searchTerm}%,provider_invoice_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`
        )
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching invoices:', error)
      return NextResponse.json({ error: 'Hiba a számlák lekérdezésekor' }, { status: 500 })
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      invoices: data || [],
      totalCount,
      totalPages,
      currentPage: page,
      limit
    })
  } catch (error: any) {
    console.error('Unhandled error in GET /api/invoices:', error)
    return NextResponse.json(
      { error: error.message || 'Belső hiba a számlák lekérdezésekor' },
      { status: 500 }
    )
  }
}

