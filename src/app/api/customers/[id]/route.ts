import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PATCH - Update customer
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log(`Updating customer ${id}:`, body)
    
    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        name: body.name,
        email: body.email,
        mobile: body.mobile,
        billing_name: body.billing_name,
        billing_country: body.billing_country,
        billing_city: body.billing_city,
        billing_postal_code: body.billing_postal_code,
        billing_street: body.billing_street,
        billing_house_number: body.billing_house_number,
        billing_tax_number: body.billing_tax_number,
        billing_company_reg_number: body.billing_company_reg_number,
        discount_percent: parseFloat(body.discount_percent) || 0,
        sms_notification: body.sms_notification || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
        error: 'Failed to update customer', 
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log(`Customer updated successfully: ${body.name}`)
    
    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete customer
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting customer ${id}`)

    // Try soft delete first
    let { error } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')

      const result = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
    }

    console.log(`Customer ${id} deleted successfully`)
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get single customer
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching customer ${id}`)

    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, email, mobile, discount_percent, sms_notification, billing_name, billing_country, billing_city, billing_postal_code, billing_street, billing_house_number, billing_tax_number, billing_company_reg_number, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    console.log(`Customer fetched successfully: ${customer.name}`)
    return NextResponse.json(customer)

  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
