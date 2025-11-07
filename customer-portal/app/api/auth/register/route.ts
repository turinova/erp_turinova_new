import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      email, 
      mobile, 
      password, 
      billing_name, 
      billing_country, 
      billing_city, 
      billing_postal_code, 
      billing_street, 
      billing_house_number, 
      billing_tax_number, 
      billing_company_reg_number, 
      selected_company_id, 
      sms_notification 
    } = body

    if (!name || !email || !mobile || !password || !selected_company_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('=== Creating new customer registration ===')
    const supabaseAdmin = createAdminClient()

    // 1. Create user in Supabase Auth using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      phone: mobile,
      user_metadata: {
        name,
        mobile,
        selected_company_id,
        sms_notification: sms_notification || false
      }
    })

    if (authError) {
      console.error('Supabase Auth user creation error:', authError)

      const message = authError.message?.toLowerCase().includes('already registered')
        ? 'Ezzel az e-mail címmel már regisztráltak.'
        : 'Nem sikerült létrehozni a felhasználót.'

      return NextResponse.json({ error: message }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // 2. Create record in portal_customers table
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('portal_customers')
      .insert({
        id: authData.user.id,
        name,
        email,
        mobile,
        billing_name: billing_name || null,
        billing_country: billing_country || 'Magyarország',
        billing_city: billing_city || null,
        billing_postal_code: billing_postal_code || null,
        billing_street: billing_street || null,
        billing_house_number: billing_house_number || null,
        billing_tax_number: billing_tax_number || null,
        billing_company_reg_number: billing_company_reg_number || null,
        selected_company_id,
        sms_notification: sms_notification || false,
        email_verified: true, // Matches email_confirm: true
        is_active: true
      })
      .select()
      .single()

    if (customerError) {
      console.error('Portal customer creation error:', customerError)
      // Try to delete the auth user if portal_customers creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Nem sikerült létrehozni az ügyfélprofilt.' }, { status: 500 })
    }

    console.log('Customer registered successfully:', customerData.email)
    return NextResponse.json({ 
      message: 'Sikeres regisztráció!', 
      user: customerData
    }, { status: 200 })

  } catch (error: any) {
    console.error('Unexpected registration error:', error)
    return NextResponse.json({ error: 'Váratlan hiba történt a regisztráció során.' }, { status: 500 })
  }
}
