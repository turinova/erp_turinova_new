import { createClient } from '@supabase/supabase-js'

// Performance timing utilities
const isDev = process.env.NODE_ENV !== 'production'

function logTiming(operation: string, startTime: number, additionalInfo?: string) {
  if (isDev) {
    const duration = performance.now() - startTime
    console.log(`[PERF] ${operation}: ${duration.toFixed(2)}ms${additionalInfo ? ` (${additionalInfo})` : ''}`)
  }
}

// Helper function to check if Supabase is configured
function checkSupabaseConfig() {
  if (!supabaseServer) {
    console.warn('Supabase not configured for server-side operations')
    return false
  }
  return true
}

// Server-side Supabase client with service role key for SSR
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured for server-side operations. Some features may not work.')
}

// Create a mock Supabase client for build time
const createMockSupabaseClient = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        is: () => ({
          single: () => ({ data: null, error: null })
        })
      }),
      is: () => ({
        order: () => ({ data: [], error: null })
      })
    })
  })
})

export const supabaseServer = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: {
    persistSession: false, // Don't persist session on server
    autoRefreshToken: false, // No token refresh needed on server
    detectSessionInUrl: false // No URL session detection on server
  },
  global: {
    headers: {
      'X-Client-Info': 'nextjs-server',
    },
  },
  realtime: {
    enabled: false, // Disable realtime for server-side performance
  },
}) : createMockSupabaseClient()

// Server-side optimized query functions
export async function getBrandById(id: string) {
  const { data, error } = await supabaseServer
    .from('brands')
    .select('id, name, comment, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching brand:', error)
    return null
  }

  return data
}

export async function getAllBrands() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('brands')
    .select('id, name, comment, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Brands DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching brands:', error)
    return []
  }

  logTiming('Brands Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// Materials SSR functions
export async function getMaterialById(id: string) {
  // Fetch material from materials table with pricing data
  const { data: materialData, error } = await supabaseServer
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
      brand_id,
      price_per_sqm,
      currency_id,
      vat_id,
      created_at,
      updated_at,
      brands(id, name),
      currencies(id, name),
      vat(id, name, kulcs)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching material:', error)
    return null
  }

  // Fetch settings from material_settings
  const { data: settingsData } = await supabaseServer
    .from('material_settings')
    .select('kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi, usage_limit')
    .eq('material_id', id)
    .single()

  // Fetch machine code from machine_material_map
  const { data: machineData } = await supabaseServer
    .from('machine_material_map')
    .select('machine_code')
    .eq('material_id', id)
    .eq('machine_type', 'Korpus')
    .single()

  // Transform the data to match the expected format
  return {
    id: materialData.id,
    name: materialData.name || `Material ${materialData.id}`,
    length_mm: materialData.length_mm || 2800,
    width_mm: materialData.width_mm || 2070,
    thickness_mm: materialData.thickness_mm || 18,
    grain_direction: Boolean(materialData.grain_direction),
    on_stock: materialData.on_stock !== undefined ? Boolean(materialData.on_stock) : true,
    active: materialData.active !== undefined ? Boolean(materialData.active) : true,
    image_url: materialData.image_url || null,
    brand_id: materialData.brand_id || '',
    brand_name: materialData.brands?.name || 'Unknown',
    kerf_mm: settingsData?.kerf_mm || 3,
    trim_top_mm: settingsData?.trim_top_mm || 0,
    trim_right_mm: settingsData?.trim_right_mm || 0,
    trim_bottom_mm: settingsData?.trim_bottom_mm || 0,
    trim_left_mm: settingsData?.trim_left_mm || 0,
    rotatable: settingsData?.rotatable !== false,
    waste_multi: settingsData?.waste_multi || 1.0,
    usage_limit: settingsData?.usage_limit || 0.65,
    machine_code: machineData?.machine_code || '',
    price_per_sqm: materialData.price_per_sqm || 0,
    currency_id: materialData.currency_id || null,
    vat_id: materialData.vat_id || null,
    currencies: materialData.currencies || null,
    vat: materialData.vat || null,
    created_at: materialData.created_at,
    updated_at: materialData.updated_at
  }
}

export async function getAllMaterials() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
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

  const queryTime = performance.now()
  logTiming('Materials DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching materials:', error)
    return []
  }

  // Fetch pricing data from materials table
  const materialIds = (data || []).map(m => m.id)
  const { data: pricingData } = await supabaseServer
    .from('materials')
    .select(`
      id,
      price_per_sqm,
      active,
      vat(kulcs),
      currencies(name)
    `)
    .in('id', materialIds)

  // Create pricing map for quick lookup
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

  // Transform the data to match the expected format
  const transformedData = (data || []).map(material => {
    const pricing = pricingMap.get(material.id) || { price_per_sqm: 0, vat_percent: 0, currency: 'HUF', active: true }
    
    return {
      id: material.id,
      name: material.material_name || `Material ${material.id}`,
      length_mm: material.length_mm || 2800,
      width_mm: material.width_mm || 2070,
      thickness_mm: material.thickness_mm || 18,
      grain_direction: Boolean(material.grain_direction),
      on_stock: material.on_stock !== undefined ? Boolean(material.on_stock) : true,
      active: pricing.active !== undefined ? Boolean(pricing.active) : true,
      image_url: material.image_url || null,
      brand_id: '', // For list view, we don't need brand_id
      brand_name: material.brand_name || 'Unknown',
      kerf_mm: material.kerf_mm || 3,
      trim_top_mm: material.trim_top_mm || 0,
      trim_right_mm: material.trim_right_mm || 0,
      trim_bottom_mm: material.trim_bottom_mm || 0,
      trim_left_mm: material.trim_left_mm || 0,
      rotatable: material.rotatable !== false,
      waste_multi: material.waste_multi || 1.0,
      usage_limit: material.usage_limit !== undefined && material.usage_limit !== null ? material.usage_limit : 0.65,
      machine_code: '', // For list view, we don't need machine_code
      price_per_sqm: pricing.price_per_sqm,
      vat_percent: pricing.vat_percent,
      currency: pricing.currency,
      created_at: material.created_at,
      updated_at: material.updated_at
    }
  })

  logTiming('Materials Total', startTime, `transformed ${transformedData.length} records`)
  return transformedData
}

export async function getAllBrandsForMaterials() {
  const { data, error } = await supabaseServer
    .from('brands')
    .select('id, name, comment, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching brands for materials:', error)
    return []
  }

  return data || []
}

// Units SSR functions
export async function getUnitById(id: string) {
  const { data, error } = await supabaseServer
    .from('units')
    .select('id, name, shortform, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching unit:', error)
    return null
  }

  return data
}

export async function getAllUnits() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('units')
    .select('id, name, shortform, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Units DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching units:', error)
    return []
  }

  logTiming('Units Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// Currencies SSR functions
export async function getCurrencyById(id: string) {
  const { data, error } = await supabaseServer
    .from('currencies')
    .select('id, name, rate, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching currency:', error)
    return null
  }

  return data
}

export async function getAllCurrencies() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('currencies')
    .select('id, name, rate, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Currencies DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching currencies:', error)
    return []
  }

  logTiming('Currencies Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// VAT SSR functions
export async function getVatById(id: string) {
  const { data, error } = await supabaseServer
    .from('vat')
    .select('id, name, kulcs, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching VAT rate:', error)
    return null
  }

  return data
}

export async function getAllVatRates() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('vat')
    .select('id, name, kulcs, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('VAT DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching VAT rates:', error)
    return []
  }

  logTiming('VAT Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// Cutting Fees SSR functions
export async function getCuttingFee() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('cutting_fees')
    .select(`
      id,
      fee_per_meter,
      panthelyfuras_fee_per_hole,
      duplungolas_fee_per_sqm,
      szogvagas_fee_per_panel,
      currency_id,
      vat_id,
      currencies (
        id,
        name
      ),
      vat (
        id,
        kulcs
      ),
      created_at,
      updated_at
    `)
    .limit(1)
    .single()

  const queryTime = performance.now()
  logTiming('Cutting Fee DB Query', startTime, `fetched ${data ? 1 : 0} records`)

  if (error) {
    console.error('Error fetching cutting fee:', error)
    return null
  }

  logTiming('Cutting Fee Total', startTime, `returned ${data ? 1 : 0} records`)
  return data || null
}

export async function getMaterialPriceHistory(materialId: string) {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('material_price_history')
    .select('id, old_price_per_sqm, new_price_per_sqm, changed_at, changed_by')
    .eq('material_id', materialId)
    .order('changed_at', { ascending: false })
    .limit(10)

  const queryTime = performance.now()
  logTiming('Price History DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching price history:', error)
    return []
  }

  // Enrich with user emails using admin API
  const enrichedData = await Promise.all((data || []).map(async (h: any) => {
    let userEmail = null
    if (h.changed_by) {
      try {
        const { data: userData } = await supabaseServer.auth.admin.getUserById(h.changed_by)
        if (userData?.user) {
          userEmail = userData.user.email
        }
      } catch (err) {
        console.error('Error fetching user for price history:', err)
      }
    }
    
    return {
      ...h,
      changed_by_user: userEmail
    }
  }))

  logTiming('Price History Total', startTime, `returned ${enrichedData?.length || 0} records`)
  return enrichedData || []
}

// Customers SSR functions
export async function getCustomerById(id: string) {
  const { data, error } = await supabaseServer
    .from('customers')
    .select(`
      id,
      name,
      email,
      mobile,
      discount_percent,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching customer:', error)
    return null
  }

  return data
}

export async function getAllCustomers() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('customers')
    .select(`
      id,
      name,
      email,
      mobile,
      discount_percent,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number,
      created_at,
      updated_at
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Customers DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching customers:', error)
    return []
  }

  logTiming('Customers Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// Edge Materials SSR functions
export async function getEdgeMaterialById(id: string) {
  const { data, error } = await supabaseServer
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
      brands (
        name
      ),
      vat (
        name,
        kulcs
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching edge material:', error)
    return null
  }

  // Fetch machine code from machine_edge_material_map
  const { data: machineData } = await supabaseServer
    .from('machine_edge_material_map')
    .select('machine_code')
    .eq('edge_material_id', id)
    .eq('machine_type', 'Korpus')
    .single()

  return {
    ...data,
    machine_code: machineData?.machine_code || ''
  }
}

export async function getAllEdgeMaterials() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
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
      brands (
        name
      ),
      vat (
        name,
        kulcs
      )
    `)
    .is('deleted_at', null)
    .order('type', { ascending: true })
    .order('decor', { ascending: true })

  const queryTime = performance.now()
  logTiming('Edge Materials DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching edge materials:', error)
    return []
  }

  logTiming('Edge Materials Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

export async function getAllBrandsForEdgeMaterials() {
  const { data, error } = await supabaseServer
    .from('brands')
    .select('id, name, comment, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching brands for edge materials:', error)
    return []
  }

  return data || []
}

export async function getAllVatRatesForEdgeMaterials() {
  const { data, error } = await supabaseServer
    .from('vat')
    .select('id, name, kulcs, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching VAT rates for edge materials:', error)
    return []
  }

  return data || []
}

// Linear Materials SSR functions
export async function getAllLinearMaterials() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('linear_materials')
    .select(`
      id,
      brand_id,
      name,
      width,
      length,
      thickness,
      type,
      image_url,
      price_per_m,
      currency_id,
      vat_id,
      on_stock,
      active,
      created_at,
      updated_at,
      brands (
        name
      ),
      currencies (
        name
      ),
      vat (
        name,
        kulcs
      )
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Linear Materials DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching linear materials:', error)
    return []
  }

  // Fetch machine codes for all linear materials
  const linearMaterialIds = data?.map(lm => lm.id) || []
  const { data: machineCodes } = await supabaseServer
    .from('machine_linear_material_map')
    .select('linear_material_id, machine_code')
    .in('linear_material_id', linearMaterialIds)
    .eq('machine_type', 'Korpus')

  const machineCodeMap = new Map(
    machineCodes?.map(mc => [mc.linear_material_id, mc.machine_code]) || []
  )

  // Transform data to include machine codes
  const transformedData = data?.map(lm => ({
    ...lm,
    machine_code: machineCodeMap.get(lm.id) || '',
    brand_name: lm.brands?.name || '',
    currency_code: lm.currencies?.name || '',
    currency_name: lm.currencies?.name || '',
    vat_name: lm.vat?.name || '',
    vat_percent: lm.vat?.kulcs || 0
  })) || []

  logTiming('Linear Materials Total', startTime, `returned ${transformedData.length} records`)
  
  return transformedData
}

export async function getLinearMaterialById(id: string) {
  const { data, error } = await supabaseServer
    .from('linear_materials')
    .select(`
      id,
      brand_id,
      name,
      width,
      length,
      thickness,
      type,
      image_url,
      price_per_m,
      currency_id,
      vat_id,
      on_stock,
      active,
      created_at,
      updated_at,
      brands (
        name
      ),
      currencies (
        name
      ),
      vat (
        name,
        kulcs
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching linear material:', error)
    return null
  }

  // Fetch machine code
  const { data: machineData } = await supabaseServer
    .from('machine_linear_material_map')
    .select('machine_code')
    .eq('linear_material_id', id)
    .eq('machine_type', 'Korpus')
    .single()

  return {
    ...data,
    machine_code: machineData?.machine_code || ''
  }
}

export async function getAllBrandsForLinearMaterials() {
  const { data, error} = await supabaseServer
    .from('brands')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching brands for linear materials:', error)
    return []
  }

  return data || []
}

export async function getAllVatRatesForLinearMaterials() {
  const { data, error } = await supabaseServer
    .from('vat')
    .select('id, name, kulcs')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching VAT rates for linear materials:', error)
    return []
  }

  return data || []
}

export async function getAllCurrenciesForLinearMaterials() {
  const { data, error } = await supabaseServer
    .from('currencies')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching currencies for linear materials:', error)
    return []
  }

  return data || []
}

// Companies SSR functions
// Partners SSR functions
export async function getPartnerById(id: string) {
  const { data, error } = await supabaseServer
    .from('partners')
    .select(`
      id,
      name,
      country,
      postal_code,
      city,
      address,
      mobile,
      email,
      tax_number,
      company_registration_number,
      bank_account,
      notes,
      status,
      contact_person,
      vat_id,
      currency_id,
      payment_terms,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching partner:', error)
    return null
  }

  return data
}

export async function getAllPartners() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('partners')
    .select(`
      id,
      name,
      country,
      postal_code,
      city,
      address,
      mobile,
      email,
      tax_number,
      company_registration_number,
      bank_account,
      notes,
      status,
      contact_person,
      vat_id,
      currency_id,
      payment_terms,
      created_at,
      updated_at
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Partners DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching partners:', error)
    return []
  }

  logTiming('Partners Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

export async function getAllVatRatesForPartners() {
  const { data, error } = await supabaseServer
    .from('vat')
    .select('id, name, kulcs, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching VAT rates for partners:', error)
    return []
  }

  return data || []
}

export async function getAllCurrenciesForPartners() {
  const { data, error } = await supabaseServer
    .from('currencies')
    .select('id, name, rate, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching currencies for partners:', error)
    return []
  }

  return data || []
}

export async function getCompanyById(id: string) {
  const { data, error } = await supabaseServer
    .from('tenant_company')
    .select(`
      id,
      name,
      country,
      postal_code,
      city,
      address,
      phone_number,
      email,
      website,
      tax_number,
      company_registration_number,
      vat_id,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching company:', error)
    return null
  }

  return data
}

export async function getAllCompanies() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('tenant_company')
    .select(`
      id,
      name,
      country,
      postal_code,
      city,
      address,
      phone_number,
      email,
      website,
      tax_number,
      company_registration_number,
      vat_id,
      created_at,
      updated_at
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Companies DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching companies:', error)
    return []
  }

  logTiming('Companies Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// Get tenant company (for default email in customer auto-creation)
export async function getTenantCompany() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('tenant_company')
    .select('id, name, email')
    .is('deleted_at', null)
    .limit(1)
    .single()

  const queryTime = performance.now()
  logTiming('Tenant Company DB Query', startTime, `fetched ${data ? 1 : 0} records`)

  if (error) {
    console.error('Error fetching tenant company:', error)
    return null
  }

  logTiming('Tenant Company Total', startTime, `returned ${data ? 1 : 0} records`)
  return data
}

// Media files SSR function
export async function getAllMediaFiles() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('media_files')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)

  const queryTime = performance.now()
  logTiming('Media Files DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching media files:', error)
    return []
  }

  // Transform to match expected format
  const transformedFiles = data?.map(file => ({
    id: file.id,
    name: file.original_filename,  // Show original filename
    storedName: file.stored_filename,  // Include stored name for reference
    path: file.storage_path,
    fullUrl: file.full_url,
    size: file.size,
    created_at: file.created_at,
    updated_at: file.updated_at
  })) || []

  logTiming('Media Files Total', startTime, `returned ${transformedFiles.length} records`)
  return transformedFiles
}

// Get single quote by ID with all data (for editing)
export async function getQuoteById(quoteId: string) {
  const startTime = performance.now()
  
  console.log(`[SSR] Fetching quote ${quoteId}`)

  try {
    // Fetch quote with customer data
    const { data: quote, error: quoteError } = await supabaseServer
      .from('quotes')
      .select(`
        id,
        quote_number,
        status,
        customer_id,
        discount_percent,
        total_net,
        total_vat,
        total_gross,
        final_total_after_discount,
        created_at,
        updated_at,
        customers(
          id,
          name,
          email,
          mobile,
          discount_percent,
          billing_name,
          billing_country,
          billing_city,
          billing_postal_code,
          billing_street,
          billing_house_number,
          billing_tax_number,
          billing_company_reg_number
        )
      `)
      .eq('id', quoteId)
      .is('deleted_at', null)
      .single()

    if (quoteError) {
      console.error('[SSR] Error fetching quote:', quoteError)
      logTiming('Quote Fetch Failed', startTime)
      return null
    }

    if (!quote) {
      console.error('[SSR] Quote not found:', quoteId)
      logTiming('Quote Not Found', startTime)
      return null
    }

    logTiming('Quote DB Query', startTime, `fetched quote ${quote.quote_number}`)

    // Fetch panels for this quote
    const panelStartTime = performance.now()
    const { data: panels, error: panelsError } = await supabaseServer
      .from('quote_panels')
      .select(`
        id,
        material_id,
        width_mm,
        height_mm,
        quantity,
        label,
        edge_material_a_id,
        edge_material_b_id,
        edge_material_c_id,
        edge_material_d_id,
        panthelyfuras_quantity,
        panthelyfuras_oldal,
        duplungolas,
        szogvagas,
        materials(id, name, brand_id, length_mm, width_mm, brands(name))
      `)
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true })

    if (panelsError) {
      console.error('[SSR] Error fetching panels:', panelsError)
      logTiming('Panels Fetch Failed', panelStartTime)
      return null
    }

    logTiming('Panels DB Query', panelStartTime, `fetched ${panels?.length || 0} panels`)

    // Transform the response to include all necessary data
    const transformedQuote = {
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      customer_id: quote.customer_id,
      discount_percent: quote.discount_percent,
      customer: quote.customers,
      panels: panels || [],
      totals: {
        total_net: quote.total_net,
        total_vat: quote.total_vat,
        total_gross: quote.total_gross,
        final_total_after_discount: quote.final_total_after_discount
      },
      created_at: quote.created_at,
      updated_at: quote.updated_at
    }

    logTiming('Quote Fetch Total', startTime, `returned quote ${quote.quote_number} with ${panels?.length || 0} panels`)
    console.log(`[SSR] Quote fetched successfully: ${quote.quote_number}`)
    
    return transformedQuote

  } catch (error) {
    console.error('[SSR] Error fetching quote:', error)
    logTiming('Quote Fetch Error', startTime)
    return null
  }
}
