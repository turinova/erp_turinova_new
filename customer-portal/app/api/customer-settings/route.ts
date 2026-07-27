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
    const { sanitizeWorkshopLogoDataUrl } = await import('@/lib/customer-facing-pdf-extras')

    let workshopLogo: string | null | undefined = undefined
    if ('workshop_logo_data_url' in body) {
      if (body.workshop_logo_data_url === null || body.workshop_logo_data_url === '') {
        workshopLogo = null
      } else {
        const cleaned = sanitizeWorkshopLogoDataUrl(body.workshop_logo_data_url)
        if (!cleaned) {
          return NextResponse.json(
            { error: 'Érvénytelen vagy túl nagy logo (max. ~500 KB, PNG/JPG/WEBP)' },
            { status: 400 }
          )
        }
        workshopLogo = cleaned
      }
    }

    // Only update fields present in the body (supports logo-only PATCH from studio).
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }
    const optionalFields = [
      'name',
      'mobile',
      'billing_name',
      'billing_country',
      'billing_city',
      'billing_postal_code',
      'billing_street',
      'billing_house_number',
      'billing_tax_number',
      'billing_company_reg_number',
      'selected_company_id',
      'sms_notification'
    ] as const
    for (const key of optionalFields) {
      if (key in body) updatePayload[key] = body[key]
    }
    if (workshopLogo !== undefined) {
      updatePayload.workshop_logo_data_url = workshopLogo
    }
    if (Object.keys(updatePayload).length <= 1) {
      return NextResponse.json({ error: 'Nincs frissítendő mező' }, { status: 400 })
    }

    const { data: customer, error } = await supabase
      .from('portal_customers')
      .update(updatePayload)
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

