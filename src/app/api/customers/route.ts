import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - List all customers with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching customers...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabaseServer
      .from('customers')
      .select(`
        id,
        name,
        email,
        mobile,
        discount_percent,
        sms_notification,
        billing_name,
        billing_country,
        billing_city,
        billing_postal_code,
        billing_street,
        billing_house_number,
        billing_tax_number,
        billing_company_reg_number,
        created_at,
        updated_at
      `)
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,mobile.ilike.%${searchQuery}%,billing_name.ilike.%${searchQuery}%`)
    }
    
    const { data: customers, error } = await query
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    console.log(`Fetched ${customers?.length || 0} customers successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(customers || [])
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new customer
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new customer...')
    
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    // Prepare data for insertion
    const newCustomer = {
      name: body.name,
      email: body.email || '',
      mobile: body.mobile || '',
      billing_name: body.billing_name || '',
      billing_country: body.billing_country || 'Magyarország',
      billing_city: body.billing_city || '',
      billing_postal_code: body.billing_postal_code || '',
      billing_street: body.billing_street || '',
      billing_house_number: body.billing_house_number || '',
      billing_tax_number: body.billing_tax_number || '',
      billing_company_reg_number: body.billing_company_reg_number || '',
      discount_percent: parseFloat(body.discount_percent) || 0,
      sms_notification: body.sms_notification || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: customer, error } = await supabaseServer
      .from('customers')
      .insert([newCustomer])
      .select('id, name, email, mobile, discount_percent, sms_notification, billing_name, billing_country, billing_city, billing_postal_code, billing_street, billing_house_number, billing_tax_number, billing_company_reg_number, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      // Handle specific error cases
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy ügyfél már létezik ezzel az e-mail címmel',
            error: 'Email already exists'
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ 
        error: 'Failed to create customer',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log('Customer created successfully:', customer)
    
    return NextResponse.json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
