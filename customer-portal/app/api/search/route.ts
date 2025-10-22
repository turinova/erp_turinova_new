import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ materials: [], linearMaterials: [] })
    }
    
    const searchTerm = query.trim()
    console.log('[Customer Portal] Searching for:', searchTerm)
    
    // Step 1: Get current authenticated customer from portal database
    const portalSupabase = await createClient()
    const { data: { user }, error: userError } = await portalSupabase.auth.getUser()
    
    if (userError || !user) {
      console.error('User not authenticated:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Step 2: Get customer's selected company
    const { data: customer, error: customerError } = await portalSupabase
      .from('portal_customers')
      .select('selected_company_id')
      .eq('id', user.id)
      .single()
    
    if (customerError || !customer || !customer.selected_company_id) {
      console.error('Customer or selected company not found:', customerError)
      return NextResponse.json({ error: 'No company selected' }, { status: 400 })
    }
    
    // Step 3: Get company's Supabase credentials
    const { data: company, error: companyError } = await portalSupabase
      .from('companies')
      .select('id, name, supabase_url, supabase_anon_key')
      .eq('id', customer.selected_company_id)
      .eq('is_active', true)
      .single()
    
    if (companyError || !company) {
      console.error('Company not found or inactive:', companyError)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    
    console.log(`[Customer Portal] Searching in company database: ${company.name}`)
    
    // Step 4: Create Supabase client for the company's database
    const companySupabase = createSupabaseClient(company.supabase_url, company.supabase_anon_key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    
    // Step 5: Search materials and linear_materials in parallel in the company database
    const [materialsResult, linearMaterialsResult] = await Promise.all([
      // Search materials table
      companySupabase
        .from('materials')
        .select(`
          id,
          name,
          brand_id,
          length_mm,
          width_mm,
          thickness_mm,
          price_per_sqm,
          vat_id,
          brands (name),
          vat (kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `%${searchTerm}%`)
        .limit(50),
      
      // Search linear_materials table
      companySupabase
        .from('linear_materials')
        .select(`
          id,
          name,
          brand_id,
          length,
          width,
          thickness,
          price_per_m,
          vat_id,
          type,
          brands (name),
          vat (kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `%${searchTerm}%`)
        .limit(50)
    ])
    
    if (materialsResult.error) {
      console.error('Materials search error:', materialsResult.error)
      return NextResponse.json({ error: 'Failed to search materials' }, { status: 500 })
    }
    
    if (linearMaterialsResult.error) {
      console.error('Linear materials search error:', linearMaterialsResult.error)
      return NextResponse.json({ error: 'Failed to search linear materials' }, { status: 500 })
    }
    
    const materials = materialsResult.data || []
    const linearMaterials = linearMaterialsResult.data || []
    
    console.log(`[Customer Portal] Found ${materials.length} materials and ${linearMaterials.length} linear materials in ${company.name} database`)
    
    // Add cache control headers for dynamic search results
    const response = NextResponse.json({ 
      materials, 
      linearMaterials 
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (error) {
    console.error('[Customer Portal] Search API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
