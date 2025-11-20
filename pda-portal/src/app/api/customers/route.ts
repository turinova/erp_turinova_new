import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    let query = supabaseAdmin
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
    
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,mobile.ilike.%${searchQuery}%,billing_name.ilike.%${searchQuery}%`)
    }
    
    const { data: customers, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    return NextResponse.json(customers || [])
    
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

