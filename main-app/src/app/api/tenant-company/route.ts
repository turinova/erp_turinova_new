import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function GET() {
  try {
    console.log('Fetching tenant company data...')
    
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, returning sample data...')

      // Return sample data for development
      return NextResponse.json({
        id: '1',
        name: 'Turinova Kft.',
        country: 'Magyarország',
        postal_code: '6000',
        city: 'Kecskemét',
        address: 'Mindszenti krt. 10.',
        phone_number: '+36 30 999 2800',
        email: 'info@turinova.hu',
        website: 'https://turinova.hu',
        tax_number: '12345678-1-02',
        company_registration_number: '01-09-999999',
        vat_id: 'HU12345678',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z'
      })
    }
    
    // Get the first (and only) tenant company record
    const { data, error } = await supabase!
      .from('tenant_company')
      .select('*')
      .is('deleted_at', null)
      .limit(1)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // If table doesn't exist, return sample data
      if (error.message.includes('Could not find the table') || error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('Table not found, returning sample data...')
        
return NextResponse.json({
          id: '1',
          name: 'Turinova Kft.',
          country: 'Magyarország',
          postal_code: '6000',
          city: 'Kecskemét',
          address: 'Mindszenti krt. 10.',
          phone_number: '+36 30 999 2800',
          email: 'info@turinova.hu',
          website: 'https://turinova.hu',
          tax_number: '12345678-1-02',
          company_registration_number: '01-09-999999',
          vat_id: 'HU12345678',
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z'
        })
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch tenant company data',
          error: error.message 
        },
        { status: 500 }
      )
    }
    
    console.log('Tenant company data fetched successfully:', data)
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error fetching tenant company:', error)
    
return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch tenant company',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const companyData = await request.json()
    
    console.log('Updating tenant company:', companyData)
    
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, simulating save...')

      // Simulate successful save for development
      await new Promise(resolve => setTimeout(resolve, 1000))
      
return NextResponse.json(
        { 
          success: true, 
          message: 'Tenant company updated successfully (simulated)',
          company: { ...companyData, id: '1' }
        },
        { status: 200 }
      )
    }
    
    // Update tenant company in Supabase database
    const { data, error } = await supabase!
      .from('tenant_company')
      .update({
        name: companyData.name,
        country: companyData.country,
        postal_code: companyData.postal_code,
        city: companyData.city,
        address: companyData.address,
        phone_number: companyData.phone_number,
        email: companyData.email,
        website: companyData.website,
        tax_number: companyData.tax_number,
        company_registration_number: companyData.company_registration_number,
        vat_id: companyData.vat_id,
        logo_url: companyData.logo_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyData.id)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // If table doesn't exist, simulate successful save
      if (error.message.includes('Could not find the table') || error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('Table not found, simulating save...')
        
return NextResponse.json(
          { 
            success: true, 
            message: 'Tenant company updated successfully (simulated)',
            company: { ...companyData, id: '1' }
          },
          { status: 200 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to update tenant company in database',
          error: error.message 
        },
        { status: 500 }
      )
    }
    
    console.log('Tenant company updated successfully:', data)
    
    // Return success response
    return NextResponse.json(
      { 
        success: true, 
        message: 'Tenant company updated successfully',
        company: data 
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('Error updating tenant company:', error)
    
return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update tenant company',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
