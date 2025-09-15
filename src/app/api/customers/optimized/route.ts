import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all customers (optimized)...')
    
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, returning sample data...')
      // Return sample data for development
      const sampleCustomers = [
        {
          id: 'b016c425-ff23-4340-98b6-55148c597b7a',
          name: 'Mező Dávid',
          email: 'zsofia.nagy@example.com',
          mobile: '+36 20 765 1202',
          discount_percent: 10,
          billing_name: 'Nagy Zsófia',
          billing_country: 'Magyarország',
          billing_city: 'Budapest',
          billing_postal_code: '1051',
          billing_street: 'Bajcsy-Zsilinszky út',
          billing_house_number: '5',
          billing_tax_number: '23123123-1-23',
          billing_company_reg_number: '32-13-213123'
        },
        {
          id: 'fcee2e83-beb7-4bc0-b2d1-05b76f1bf681',
          name: 'Kovács Péter',
          email: 'peter.kovacs@example.com',
          mobile: '+36 30 999 2800',
          discount_percent: 10,
          billing_name: 'Kovács Kft.',
          billing_country: 'Hungary',
          billing_city: 'Kecskemét',
          billing_postal_code: '6000',
          billing_street: 'Mindszenti krt.',
          billing_house_number: '10',
          billing_tax_number: '12345678-1-02',
          billing_company_reg_number: '01-09-999999'
        }
      ]
      return NextResponse.json(sampleCustomers, { status: 200 })
    }
    
    const startTime = performance.now()
    
    // Single optimized query with all columns - FAST!
    const { data, error } = await supabase!
      .from('customers')
      .select('id, name, email, mobile, discount_percent, billing_name, billing_country, billing_city, billing_postal_code, billing_street, billing_house_number, billing_tax_number, billing_company_reg_number, created_at, updated_at')
      .is('deleted_at', null)
      .order('name')

    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Customers query took: ${queryTime.toFixed(2)}ms`)
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch customers from database',
          error: error.message 
        },
        { status: 500 }
      )
    }
    
    console.log(`Fetched ${data?.length || 0} customers successfully`)
    
    return NextResponse.json(data || [], { status: 200 })
    
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch customers',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
