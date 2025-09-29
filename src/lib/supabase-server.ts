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
  // Fetch material from materials_with_settings view
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
      created_at, 
      updated_at
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching material:', error)
    return null
  }

  // Fetch brand_id from materials table
  const { data: materialData } = await supabaseServer
    .from('materials')
    .select('brand_id')
    .eq('id', id)
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
    id: data.id,
    name: data.material_name || `Material ${data.id}`,
    length_mm: data.length_mm || 2800,
    width_mm: data.width_mm || 2070,
    thickness_mm: data.thickness_mm || 18,
    grain_direction: Boolean(data.grain_direction),
    on_stock: data.on_stock !== undefined ? Boolean(data.on_stock) : true,
    image_url: data.image_url || null,
    brand_id: materialData?.brand_id || '',
    brand_name: data.brand_name || 'Unknown',
    kerf_mm: data.kerf_mm || 3,
    trim_top_mm: data.trim_top_mm || 0,
    trim_right_mm: data.trim_right_mm || 0,
    trim_bottom_mm: data.trim_bottom_mm || 0,
    trim_left_mm: data.trim_left_mm || 0,
    rotatable: data.rotatable !== false,
    waste_multi: data.waste_multi || 1.0,
    machine_code: machineData?.machine_code || '',
    created_at: data.created_at,
    updated_at: data.updated_at
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

  // Transform the data to match the expected format
  const transformedData = (data || []).map(material => ({
    id: material.id,
    name: material.material_name || `Material ${material.id}`,
    length_mm: material.length_mm || 2800,
    width_mm: material.width_mm || 2070,
    thickness_mm: material.thickness_mm || 18,
    grain_direction: Boolean(material.grain_direction),
    on_stock: material.on_stock !== undefined ? Boolean(material.on_stock) : true,
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
    machine_code: '', // For list view, we don't need machine_code
    created_at: material.created_at,
    updated_at: material.updated_at
  }))

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

  return data
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

// Companies SSR functions
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
