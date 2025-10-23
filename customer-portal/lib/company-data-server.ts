import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side functions to fetch data from the selected company's database
 * EXACT COPY of main app logic, just with company database selection
 */

interface CompanyCredentials {
  supabase_url: string
  supabase_anon_key: string
}

/**
 * Get all materials from the company's database
 * Uses materials_with_settings view + pricing data (EXACT main app pattern)
 */
export async function getCompanyMaterials(companyCredentials: CompanyCredentials) {
  const { supabase_url, supabase_anon_key } = companyCredentials
  
  const companySupabase = createSupabaseClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'customer-portal-ssr',
      },
    },
  })
  
  // Step 1: Fetch from materials_with_settings view (main app pattern)
  const { data, error } = await companySupabase
    .from('materials_with_settings')
    .select(`
      id, 
      material_name, 
      length_mm, 
      width_mm, 
      thickness_mm, 
      grain_direction, 
      on_stock,
      image_url, 
      brand_name,
      kerf_mm, 
      trim_top_mm, 
      trim_right_mm, 
      trim_bottom_mm, 
      trim_left_mm, 
      rotatable, 
      waste_multi, 
      usage_limit,
      created_at, 
      updated_at
    `)
    .order('material_name', { ascending: true })
  
  if (error) {
    console.error('[Company Data] Materials fetch error:', error)
    throw new Error(`Failed to fetch materials: ${error.message}`)
  }
  
  // Step 2: Fetch pricing data from materials table
  const materialIds = (data || []).map(m => m.id)
  const { data: pricingData } = await companySupabase
    .from('materials')
    .select(`
      id,
      price_per_sqm,
      active,
      vat(kulcs),
      currencies(name)
    `)
    .in('id', materialIds)
  
  // Step 3: Create pricing map
  const pricingMap = new Map(
    (pricingData || []).map(p => [
      p.id, 
      { 
        price_per_sqm: p.price_per_sqm || 0, 
        vat_percent: p.vat?.kulcs || 0,
        currency: p.currencies?.name || 'HUF',
        active: p.active !== undefined ? p.active : true
      }
    ])
  )
  
  // Step 4: Transform data (main app pattern)
  const transformedData = (data || []).map(material => {
    const pricing = pricingMap.get(material.id) || { price_per_sqm: 0, vat_percent: 0, currency: 'HUF', active: true }
    
    return {
      id: material.id,
      name: material.material_name || `Material ${material.id}`,
      length_mm: material.length_mm || 2800,
      width_mm: material.width_mm || 2070,
      thickness_mm: material.thickness_mm || 18,
      grain_direction: material.grain_direction || 0,
      on_stock: material.on_stock !== undefined ? material.on_stock : true,
      image_url: material.image_url || null,
      brand_name: material.brand_name || 'Unknown',
      kerf_mm: material.kerf_mm || 4,
      trim_top_mm: material.trim_top_mm || 0,
      trim_right_mm: material.trim_right_mm || 0,
      trim_bottom_mm: material.trim_bottom_mm || 0,
      trim_left_mm: material.trim_left_mm || 0,
      rotatable: material.rotatable !== undefined ? material.rotatable : true,
      waste_multi: material.waste_multi || 0,
      usage_limit: material.usage_limit || null,
      price_per_sqm: pricing.price_per_sqm,
      vat_percent: pricing.vat_percent,
      currency: pricing.currency,
      active: pricing.active,
      created_at: material.created_at,
      updated_at: material.updated_at
    }
  })
  
  return transformedData
}

/**
 * Get all edge materials from the company's database
 * EXACT main app pattern
 */
export async function getCompanyEdgeMaterials(companyCredentials: CompanyCredentials) {
  const { supabase_url, supabase_anon_key } = companyCredentials
  
  const companySupabase = createSupabaseClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'customer-portal-ssr',
      },
    },
  })
  
  const { data, error } = await companySupabase
    .from('edge_materials')
    .select(`
      id,
      brand_id,
      type,
      thickness,
      width,
      decor,
      price,
      vat_id,
      active,
      ráhagyás,
      favourite_priority,
      created_at,
      updated_at,
      brands (name),
      vat (name, kulcs)
    `)
    .is('deleted_at', null)
    .order('type', { ascending: true })
    .order('decor', { ascending: true })
  
  if (error) {
    console.error('[Company Data] Edge materials fetch error:', error)
    throw new Error(`Failed to fetch edge materials: ${error.message}`)
  }
  
  return data || []
}

/**
 * Get cutting fee from the company's database
 * Uses cutting_fees table (not settings) - EXACT main app pattern
 */
export async function getCompanyCuttingFee(companyCredentials: CompanyCredentials) {
  const startTime = performance.now()
  const { supabase_url, supabase_anon_key } = companyCredentials
  
  const companySupabase = createSupabaseClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'customer-portal-ssr',
      },
    },
  })
  
  const { data, error } = await companySupabase
    .from('cutting_fees')
    .select(`
      id,
      fee_per_meter,
      panthelyfuras_fee_per_hole,
      duplungolas_fee_per_sqm,
      szogvagas_fee_per_panel,
      currency_id,
      vat_id,
      currencies (id, name),
      vat (id, kulcs),
      created_at,
      updated_at
    `)
    .limit(1)
    .single()
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
    console.error('[Company Data] Cutting fee fetch error:', error)
  }
  
  // If no cutting fee in company DB, provide a default structure with zero fees
  // This allows the quote calculation to work and display the sections
  if (!data) {
    return {
      id: null,
      fee_per_meter: 0,
      panthelyfuras_fee_per_hole: 0,
      duplungolas_fee_per_sqm: 0,
      szogvagas_fee_per_panel: 0,
      currency_id: null,
      vat_id: null,
      currencies: { id: null, name: 'HUF' },
      vat: { id: null, kulcs: 27 },
      created_at: null,
      updated_at: null
    }
  }
  
  return data
}

/**
 * Get company information from the company's tenant_company table
 * Used for displaying company details on quotes/orders
 */
export async function getCompanyInfo(companyCredentials: CompanyCredentials) {
  const startTime = performance.now()
  const { supabase_url, supabase_anon_key } = companyCredentials
  
  const companySupabase = createSupabaseClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'customer-portal-ssr',
      },
    },
  })
  
  console.log('[Company Data] Fetching company info from tenant_company table...')
  
  const { data, error } = await companySupabase
    .from('tenant_company')
    .select('*')
    .limit(1)
    .single()
  
  if (error) {
    console.error('[Company Data] Company info fetch error:', error)
    console.error('[Company Data] Error code:', error.code)
    console.error('[Company Data] Error message:', error.message)
    console.error('[Company Data] Error details:', error.details)
    return null
  }
  
  console.log('[Company Data] Company info loaded successfully:', data?.name)
  
  const queryTime = performance.now()
  console.log(`[Company Data] Company info fetched in ${(queryTime - startTime).toFixed(2)}ms`)
  
  return data
}

/**
 * Get active payment methods from the company's database
 * Only returns active payment methods for customer selection
 */
export async function getCompanyPaymentMethods(companyCredentials: CompanyCredentials) {
  const startTime = performance.now()
  const { supabase_url, supabase_anon_key } = companyCredentials
  
  const companySupabase = createSupabaseClient(supabase_url, supabase_anon_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'customer-portal-ssr',
      },
    },
  })
  
  console.log('[Company Data] Fetching active payment methods...')
  
  const { data, error } = await companySupabase
    .from('payment_methods')
    .select('id, name, comment, active')
    .eq('active', true)  // Only active payment methods
    .is('deleted_at', null)  // Not soft-deleted
    .order('name', { ascending: true })
  
  if (error) {
    console.error('[Company Data] Payment methods fetch error:', error)
    return []  // Return empty array on error
  }
  
  const queryTime = performance.now()
  console.log(`[Company Data] Fetched ${data?.length || 0} active payment methods in ${(queryTime - startTime).toFixed(2)}ms`)
  
  return data || []
}

/**
 * Fetch all company data in parallel
 * EXACT main app pattern
 */
export async function getAllCompanyData(companyCredentials: CompanyCredentials) {
  const startTime = performance.now()
  
  try {
    const [materials, edgeMaterials, cuttingFee] = await Promise.all([
      getCompanyMaterials(companyCredentials),
      getCompanyEdgeMaterials(companyCredentials),
      getCompanyCuttingFee(companyCredentials)
    ])
    
    const totalTime = performance.now() - startTime
    console.log(`[Company Data] Fetched all data in ${totalTime.toFixed(2)}ms - Materials: ${materials.length}, Edge Materials: ${edgeMaterials.length}`)
    
    return {
      materials,
      edgeMaterials,
      cuttingFee
    }
  } catch (error: any) {
    console.error('[Company Data] Failed to fetch company data:', error)
    throw error
  }
}
