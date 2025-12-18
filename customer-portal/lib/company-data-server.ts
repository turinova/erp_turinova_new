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
  
  // Step 1: Fetch from materials table with settings join (EXACT main app pattern)
  const { data, error } = await companySupabase
    .from('materials')
    .select(`
      id,
      name,
      length_mm,
      width_mm,
      thickness_mm,
      grain_direction,
      on_stock,
      active,
      image_url,
      base_price,
      multiplier,
      price_per_sqm,
      created_at,
      updated_at,
      brands:brand_id(name),
      vat:vat_id(kulcs),
      currencies:currency_id(name),
      material_settings!left(
        kerf_mm,
        trim_top_mm,
        trim_right_mm,
        trim_bottom_mm,
        trim_left_mm,
        rotatable,
        waste_multi,
        usage_limit
      )
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('[Company Data] Materials fetch error:', error)
    throw new Error(`Failed to fetch materials: ${error.message}`)
  }
  
  // Step 2: Transform data (EXACT main app pattern)
  const transformedData = (data || []).map(material => {
    const settings = material.material_settings
    const brandName = material.brands?.name || 'Unknown'
    const vatPercent = material.vat?.kulcs || 0
    const currencyName = material.currencies?.name || 'HUF'
    
    return {
      id: material.id,
      name: material.name,
      brand_name: brandName,
      material_name: material.name,
      length_mm: material.length_mm,
      width_mm: material.width_mm,
      thickness_mm: material.thickness_mm,
      grain_direction: material.grain_direction,
      on_stock: material.on_stock,
      active: material.active !== undefined ? material.active : true,
      image_url: material.image_url,
      kerf_mm: settings?.kerf_mm ?? 3,
      trim_top_mm: settings?.trim_top_mm ?? 10,
      trim_right_mm: settings?.trim_right_mm ?? 10,
      trim_bottom_mm: settings?.trim_bottom_mm ?? 10,
      trim_left_mm: settings?.trim_left_mm ?? 10,
      rotatable: settings?.rotatable ?? true,
      waste_multi: settings?.waste_multi ?? 1,
      usage_limit: settings?.usage_limit !== undefined && settings?.usage_limit !== null ? settings.usage_limit : 0.65,
      base_price: material.base_price || 0,
      multiplier: material.multiplier || 1.38,
      price_per_sqm: material.price_per_sqm || 0,
      vat_percent: vatPercent,
      currency: currencyName,
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
 * Get VAT rates from the company's database
 * Used for PDF generation
 */
export async function getCompanyVatRates(companyCredentials: CompanyCredentials) {
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
    .from('vat')
    .select('id, name, kulcs, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('[Company Data] VAT rates fetch error:', error)
    return []
  }
  
  return data || []
}

/**
 * Get material machine codes by IDs from the company's database
 * Used for PDF generation (cutting list)
 */
export async function getMaterialMachineCodes(
  companyCredentials: CompanyCredentials,
  materialIds: string[]
): Promise<Map<string, string>> {
  if (materialIds.length === 0) {
    return new Map()
  }
  
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
    .from('materials')
    .select('id, machine_code, name')
    .in('id', materialIds)
    .is('deleted_at', null)
  
  if (error) {
    console.error('[Company Data] Material machine codes fetch error:', error)
    return new Map()
  }
  
  const map = new Map<string, string>()
  data?.forEach(material => {
    // Use machine_code if available, otherwise fall back to material name
    const code = material.machine_code || material.name || ''
    if (code) {
      map.set(material.id, code)
    }
  })
  
  return map
}

/**
 * Get edge material codes by IDs from the company's database
 * Used for PDF generation (cutting list)
 * Edge code format: type-width/thickness-decor
 */
export async function getEdgeMaterialCodes(
  companyCredentials: CompanyCredentials,
  edgeMaterialIds: string[]
): Promise<Map<string, string>> {
  if (edgeMaterialIds.length === 0) {
    return new Map()
  }
  
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
    .select('id, type, width, thickness, decor')
    .in('id', edgeMaterialIds)
    .is('deleted_at', null)
  
  if (error) {
    console.error('[Company Data] Edge material codes fetch error:', error)
    return new Map()
  }
  
  const map = new Map<string, string>()
  data?.forEach(edge => {
    // Format: type-width/thickness-decor
    const code = `${edge.type}-${edge.width}/${edge.thickness}-${edge.decor}`
    map.set(edge.id, code)
  })
  
  return map
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
