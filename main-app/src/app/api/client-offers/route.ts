import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getClientOffersWithPagination } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// GET - List client offers with pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const result = await getClientOffersWithPagination(page, limit, search, status)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching client offers:', error)
    return NextResponse.json(
      { error: 'Hiba a ajánlatok lekérdezésekor' },
      { status: 500 }
    )
  }
}

// POST - Create new client offer
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseWithAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )
    
    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      customer_id,
      worker_id,
      customer_name,
      customer_email,
      customer_mobile,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number,
      subtotal_net,
      total_vat,
      total_gross,
      discount_percentage,
      discount_amount,
      status,
      notes,
      items
    } = body

    // Validate required fields
    if (!customer_name) {
      return NextResponse.json(
        { error: 'Ügyfél neve kötelező' },
        { status: 400 }
      )
    }

    // Generate offer number
    const { data: offerNumberData, error: offerNumberError } = await supabaseAdmin
      .rpc('generate_client_offer_number')

    if (offerNumberError || !offerNumberData) {
      console.error('Error generating offer number:', offerNumberError)
      return NextResponse.json(
        { error: 'Hiba az ajánlatszám generálásakor' },
        { status: 500 }
      )
    }

    // Create offer
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('client_offers')
      .insert({
        offer_number: offerNumberData,
        customer_id: customer_id || null,
        worker_id: worker_id || null,
        customer_name,
        customer_email: customer_email || null,
        customer_mobile: customer_mobile || null,
        billing_name: billing_name || null,
        billing_country: billing_country || 'Magyarország',
        billing_city: billing_city || null,
        billing_postal_code: billing_postal_code || null,
        billing_street: billing_street || null,
        billing_house_number: billing_house_number || null,
        billing_tax_number: billing_tax_number || null,
        billing_company_reg_number: billing_company_reg_number || null,
        subtotal_net: subtotal_net || 0,
        total_vat: total_vat || 0,
        total_gross: total_gross || 0,
        discount_percentage: discount_percentage || 0,
        discount_amount: discount_amount || 0,
        status: status || 'draft',
        notes: notes || null,
        created_by: user.id
      })
      .select()
      .single()

    if (offerError || !offer) {
      console.error('Error creating client offer:', offerError)
      return NextResponse.json(
        { error: 'Hiba az ajánlat létrehozásakor' },
        { status: 500 }
      )
    }

    // Create items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((item: any, index: number) => ({
        client_offer_id: offer.id,
        item_type: item.item_type,
        material_id: item.material_id || null,
        accessory_id: item.accessory_id || null,
        linear_material_id: item.linear_material_id || null,
        fee_type_id: item.fee_type_id || null,
        product_name: item.product_name,
        sku: item.sku || null,
        unit: item.unit || null,
        quantity: item.quantity || 1,
        unit_price_net: item.unit_price_net || 0,
        unit_price_gross: item.unit_price_gross || 0,
        vat_id: item.vat_id || null,
        vat_percentage: item.vat_percentage || null,
        total_net: item.total_net || 0,
        total_vat: item.total_vat || 0,
        total_gross: item.total_gross || 0,
        notes: item.notes || null,
        sort_order: index
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('client_offers_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error creating client offer items:', itemsError)
        // Delete the offer if items fail
        await supabaseAdmin
          .from('client_offers')
          .delete()
          .eq('id', offer.id)
        
        return NextResponse.json(
          { error: 'Hiba a tételek létrehozásakor' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ 
      success: true, 
      offer,
      offer_id: offer.id 
    })
  } catch (error) {
    console.error('Error creating client offer:', error)
    return NextResponse.json(
      { error: 'Hiba az ajánlat létrehozásakor' },
      { status: 500 }
    )
  }
}

