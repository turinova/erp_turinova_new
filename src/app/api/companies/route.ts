import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching companies...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabaseServer
      .from('tenant_company')
      .select('id, name, country, postal_code, city, address, phone_number, email, website, tax_number, company_registration_number, vat_id, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`)
    }
    
    const { data: companies, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      
      // If table doesn't exist, return sample data
      if (error.message.includes('Could not find the table') || error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('Table not found, returning sample data...')
        
        const sampleData = [{
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
        }]

        return NextResponse.json(sampleData)
      }
      
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
    }

    console.log(`Fetched ${companies?.length || 0} companies successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(companies || [])
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error) {
    console.error('Error fetching companies:', error)
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new company...')
    
    const companyData = await request.json()
    
    // Prepare company data with timestamp
    const newCompany = {
      name: companyData.name || '',
      country: companyData.country || '',
      postal_code: companyData.postal_code || '',
      city: companyData.city || '',
      address: companyData.address || '',
      phone_number: companyData.phone_number || '',
      email: companyData.email || '',
      website: companyData.website || '',
      tax_number: companyData.tax_number || '',
      company_registration_number: companyData.company_registration_number || '',
      vat_id: companyData.vat_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Insert company into Supabase database
    const { data: company, error } = await supabaseServer
      .from('tenant_company')
      .insert([newCompany])
      .select('id, name, country, postal_code, city, address, phone_number, email, website, tax_number, company_registration_number, vat_id, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle duplicate name error specifically
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Egy cég már létezik ezzel a névvel',
            error: 'Name already exists' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
    }
    
    console.log('Company created successfully:', company)
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Company created successfully',
        company: company
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('Error creating company:', error)
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
