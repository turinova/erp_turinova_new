import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET - Fetch current customer's settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch customer data
    const { data: customer, error } = await supabase
      .from('portal_customers')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching customer settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    return NextResponse.json({ customer })
  } catch (error: any) {
    console.error('Unexpected error in GET customer-settings:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update current customer's settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    console.log(`Updating customer settings for user ${user.id}:`, body)
    
    // Update customer data (email is read-only, don't include it in update)
    const { data: customer, error } = await supabase
      .from('portal_customers')
      .update({
        name: body.name,
        mobile: body.mobile,
        billing_name: body.billing_name,
        billing_country: body.billing_country,
        billing_city: body.billing_city,
        billing_postal_code: body.billing_postal_code,
        billing_street: body.billing_street,
        billing_house_number: body.billing_house_number,
        billing_tax_number: body.billing_tax_number,
        billing_company_reg_number: body.billing_company_reg_number,
        selected_company_id: body.selected_company_id,
        sms_notification: body.sms_notification,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating customer settings:', error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    console.log('Customer settings updated successfully!')
    return NextResponse.json({ customer })

  } catch (error: any) {
    console.error('Unexpected error in PATCH customer-settings:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

