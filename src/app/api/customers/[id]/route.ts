import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const customerId = resolvedParams.id
    const customerData = await request.json()
    
    console.log(`Updating customer ${customerId}:`, customerData)
    
    // Check if the ID is a simple number (for development/testing)
    const isSimpleId = /^\d+$/.test(customerId)
    
    if (isSimpleId) {
      console.log('Simple ID detected, simulating save...')
      // Simulate successful save for development with simple IDs
      await new Promise(resolve => setTimeout(resolve, 1000))
      return NextResponse.json(
        { 
          success: true, 
          message: 'Customer updated successfully (simulated)',
          customer: { ...customerData, id: customerId }
        },
        { status: 200 }
      )
    }
    
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, simulating save...')
      // Simulate successful save for development
      await new Promise(resolve => setTimeout(resolve, 1000))
      return NextResponse.json(
        { 
          success: true, 
          message: 'Customer updated successfully (simulated)',
          customer: { ...customerData, id: customerId }
        },
        { status: 200 }
      )
    }
    
    // Update customer in Supabase database (only for valid UUIDs)
    const { data, error } = await supabase!
      .from('customers')
      .update({
        name: customerData.name,
        email: customerData.email,
        mobile: customerData.mobile,
        billing_name: customerData.billing_name,
        billing_country: customerData.billing_country,
        billing_city: customerData.billing_city,
        billing_postal_code: customerData.billing_postal_code,
        billing_street: customerData.billing_street,
        billing_house_number: customerData.billing_house_number,
        billing_tax_number: customerData.billing_tax_number,
        billing_company_reg_number: customerData.billing_company_reg_number,
        discount_percent: customerData.discount_percent
      })
      .eq('id', customerId)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to update customer in database',
          error: error.message 
        },
        { status: 500 }
      )
    }
    
    console.log('Customer updated successfully:', data)
    
    // Return success response
    return NextResponse.json(
      { 
        success: true, 
        message: 'Customer updated successfully',
        customer: data 
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update customer',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const customerId = resolvedParams.id
    
    console.log(`Deleting customer ${customerId}...`)
    
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, returning mock deletion...')
      // Return mock success for development
      return NextResponse.json(
        { 
          success: true, 
          message: 'Customer deleted successfully',
          customerId: customerId
        },
        { status: 200 }
      )
    }
    
    // Delete customer from Supabase database
    const { error } = await supabase!
      .from('customers')
      .delete()
      .eq('id', customerId)
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to delete customer from database',
          error: error.message 
        },
        { status: 500 }
      )
    }
    
    console.log(`Customer ${customerId} deleted successfully`)
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Customer deleted successfully',
        customerId: customerId
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to delete customer',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const customerId = resolvedParams.id
    
    console.log(`Fetching customer ${customerId}`)
    
    // Check if the ID is a simple number (for development/testing)
    const isSimpleId = /^\d+$/.test(customerId)
    
    if (isSimpleId) {
      console.log('Simple ID detected, returning sample data...')
      // Return sample data for development with simple IDs
      const sampleCustomer = {
        id: customerId,
        name: 'Kovács Péter',
        email: 'peter.kovacs@example.com',
        mobile: '+36 30 123 4567',
        billing_name: 'Kovács Kft.',
        billing_country: 'Hungary',
        billing_city: 'Kecskemét',
        billing_postal_code: '6000',
        billing_street: 'Mindszenti krt.',
        billing_house_number: '10',
        billing_tax_number: '12345678-1-02',
        billing_company_reg_number: '01-09-999999',
        discount_percent: 5.00,
        created_at: '2024-01-15T10:30:00Z'
      }
      return NextResponse.json(sampleCustomer, { status: 200 })
    }
    
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, returning sample data...')
      // Return sample data for development
      const sampleCustomer = {
        id: customerId,
        name: 'Kovács Péter',
        email: 'peter.kovacs@example.com',
        mobile: '+36 30 123 4567',
        billing_name: 'Kovács Kft.',
        billing_country: 'Hungary',
        billing_city: 'Kecskemét',
        billing_postal_code: '6000',
        billing_street: 'Mindszenti krt.',
        billing_house_number: '10',
        billing_tax_number: '12345678-1-02',
        billing_company_reg_number: '01-09-999999',
        discount_percent: 5.00,
        created_at: '2024-01-15T10:30:00Z'
      }
      return NextResponse.json(sampleCustomer, { status: 200 })
    }
    
    // Fetch customer from Supabase database (only for valid UUIDs)
    const { data, error } = await supabase!
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch customer from database',
          error: error.message 
        },
        { status: 500 }
      )
    }
    
    if (!data) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Customer not found' 
        },
        { status: 404 }
      )
    }
    
    console.log('Customer fetched successfully:', data)
    
    return NextResponse.json(data, { status: 200 })
    
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch customer',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
