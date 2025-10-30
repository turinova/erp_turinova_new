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
      base_price,
      multiplier,
      price_per_sqm,
      partners_id,
      units_id,
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
    base_price: materialData.base_price || 0,
    multiplier: materialData.multiplier || 1.38,
    price_per_sqm: materialData.price_per_sqm || 0,
    partners_id: materialData.partners_id || null,
    units_id: materialData.units_id || null,
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
  
  // Use the same query structure as the API for consistency
  let query = supabaseServer
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
      partners:partners_id(name),
      units:units_id(name, shortform),
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
    .order('created_at', { ascending: false })

  const { data, error } = await query

  const queryTime = performance.now()
  logTiming('Materials DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching materials:', error)
    return []
  }

  // Transform the data to match the expected format (same as API)
  const transformedData = (data || []).map(material => {
    // material_settings is now a single object, not an array
    const settings = material.material_settings
    const brandName = material.brands?.name || 'Unknown'
    const vatPercent = material.vat?.kulcs || 0
    const partnerName = material.partners?.name || null
    const unitName = material.units?.name || null
    const unitShortform = material.units?.shortform || null
    
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
      kerf_mm: settings?.kerf_mm || 3,
      trim_top_mm: settings?.trim_top_mm || 10,
      trim_right_mm: settings?.trim_right_mm || 10,
      trim_bottom_mm: settings?.trim_bottom_mm || 10,
      trim_left_mm: settings?.trim_left_mm || 10,
      rotatable: settings?.rotatable ?? true,
      waste_multi: settings?.waste_multi || 1,
      usage_limit: settings?.usage_limit !== undefined && settings?.usage_limit !== null ? settings.usage_limit : 0.65,
      base_price: material.base_price || 0,
      multiplier: material.multiplier || 1.38,
      price_per_sqm: material.price_per_sqm || 0, // Keep for backward compatibility
      partner_name: partnerName,
      unit_name: unitName,
      unit_shortform: unitShortform,
      vat_percent: vatPercent,
      created_at: material.created_at,
      updated_at: material.updated_at
    }
  })

  logTiming('Materials Total', startTime, `transformed ${transformedData.length} records`)
  return transformedData
}

// Get materials with pagination
export async function getMaterialsWithPagination(page: number = 1, limit: number = 50) {
  const startTime = performance.now()
  
  const offset = (page - 1) * limit
  
  // Get total count
  const { count } = await supabaseServer
    .from('materials')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  // Get paginated data using the same query structure as getAllMaterials
  const { data, error } = await supabaseServer
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
      partners:partners_id(name),
      units:units_id(name, shortform),
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
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const queryTime = performance.now()
  logTiming('Materials Paginated DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching materials:', error)
    return { materials: [], totalCount: 0, totalPages: 0, currentPage: page }
  }

  // Transform the data to match the expected format (same as getAllMaterials)
  const transformedData = (data || []).map(material => {
    // material_settings is now a single object, not an array
    const settings = material.material_settings
    const brandName = material.brands?.name || 'Unknown'
    const vatPercent = material.vat?.kulcs || 0
    const partnerName = material.partners?.name || null
    const unitName = material.units?.name || null
    const unitShortform = material.units?.shortform || null
    
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
      kerf_mm: settings?.kerf_mm || 3,
      trim_top_mm: settings?.trim_top_mm || 10,
      trim_right_mm: settings?.trim_right_mm || 10,
      trim_bottom_mm: settings?.trim_bottom_mm || 10,
      trim_left_mm: settings?.trim_left_mm || 10,
      rotatable: settings?.rotatable ?? true,
      waste_multi: settings?.waste_multi || 1,
      usage_limit: settings?.usage_limit !== undefined && settings?.usage_limit !== null ? settings.usage_limit : 0.65,
      base_price: material.base_price || 0,
      multiplier: material.multiplier || 1.38,
      price_per_sqm: material.price_per_sqm || 0, // Keep for backward compatibility
      partner_name: partnerName,
      unit_name: unitName,
      unit_shortform: unitShortform,
      vat_percent: vatPercent,
      created_at: material.created_at,
      updated_at: material.updated_at
    }
  })

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / limit)

  logTiming('Materials Paginated Total', startTime, `returned ${transformedData.length} records, page ${page}/${totalPages}`)
  
  return {
    materials: transformedData,
    totalCount,
    totalPages,
    currentPage: page
  }
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

// Production Machines SSR functions
export async function getAllProductionMachines() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('production_machines')
    .select('id, machine_name, comment, usage_limit_per_day, created_at, updated_at')
    .is('deleted_at', null)
    .order('machine_name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Production Machines DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching production machines:', error)
    return []
  }

  logTiming('Production Machines Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

export async function getProductionMachineById(id: string) {
  const { data, error } = await supabaseServer
    .from('production_machines')
    .select('id, machine_name, comment, usage_limit_per_day, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching production machine:', error)
    return null
  }

  return data
}

// Fee Types SSR functions
export async function getAllFeeTypes() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('feetypes')
    .select(`
      id, 
      name, 
      net_price, 
      created_at, 
      updated_at,
      vat_id,
      currency_id,
      vat (
        id,
        name,
        kulcs
      ),
      currencies (
        id,
        name
      )
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Fee Types DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching fee types:', error)
    return []
  }

  // Transform the data to include calculated fields
  const transformedData = data?.map(feeType => ({
    ...feeType,
    vat_name: feeType.vat?.name || '',
    vat_percent: feeType.vat?.kulcs || 0,
    currency_name: feeType.currencies?.name || '',
    vat_amount: (feeType.net_price * (feeType.vat?.kulcs || 0)) / 100,
    gross_price: feeType.net_price + ((feeType.net_price * (feeType.vat?.kulcs || 0)) / 100)
  })) || []

  logTiming('Fee Types Total', startTime, `returned ${transformedData.length} records`)
  return transformedData
}

export async function getFeeTypeById(id: string) {
  const { data, error } = await supabaseServer
    .from('feetypes')
    .select(`
      id, 
      name, 
      net_price, 
      created_at, 
      updated_at,
      vat_id,
      currency_id,
      vat (
        id,
        name,
        kulcs
      ),
      currencies (
        id,
        name
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching fee type:', error)
    return null
  }

  // Transform the data to include calculated fields
  const transformedData = {
    ...data,
    vat_name: data.vat?.name || '',
    vat_percent: data.vat?.kulcs || 0,
    currency_name: data.currencies?.name || '',
    vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
    gross_price: data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
  }

  return transformedData
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

// Payment Methods SSR functions
export async function getAllPaymentMethods() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('payment_methods')
    .select('id, name, comment, active, created_at, updated_at')
    .is('deleted_at', null) // Exclude soft-deleted records
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Payment Methods DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching payment methods:', error)
    return []
  }

  logTiming('Payment Methods Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

// Customer Portal Draft Quotes SSR function (for dashboard)
export async function getCustomerPortalDraftQuotes() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('quotes')
    .select(`
      id,
      final_total_after_discount,
      created_at,
      payment_method_id,
      customers(
        id,
        name
      ),
      payment_methods(
        id,
        name
      )
    `)
    .eq('source', 'customer_portal')
    .eq('status', 'draft')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const queryTime = performance.now()
  logTiming('Customer Portal Quotes DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching customer portal draft quotes:', error)
    return []
  }

  // Transform data
  const transformedQuotes = data?.map(quote => ({
    id: quote.id,
    customer_name: quote.customers?.name || 'Unknown',
    final_total_after_discount: quote.final_total_after_discount,
    payment_method_name: quote.payment_methods?.name || null,
    created_at: quote.created_at
  })) || []

  logTiming('Customer Portal Quotes Total', startTime, `returned ${transformedQuotes.length} records`)
  return transformedQuotes
}

export async function getPaymentMethodById(id: string) {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('payment_methods')
    .select('id, name, comment, active, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  const queryTime = performance.now()
  logTiming('Payment Method By ID Query', startTime, `fetched 1 record`)

  if (error) {
    console.error('Error fetching payment method by ID:', error)
    return null
  }

  logTiming('Payment Method By ID Total', startTime, `returned payment method`)
  return data
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
      sms_notification,
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
      sms_notification,
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
      base_price,
      multiplier,
      price_per_m,
      partners_id,
      units_id,
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

// Get tenant company (for default email in customer auto-creation and quote display)
export async function getTenantCompany() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('tenant_company')
    .select('id, name, country, postal_code, city, address, phone_number, email, website, tax_number, company_registration_number, vat_id')
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
  
  console.log(`[SSR] Fetching quote ${quoteId} - OPTIMIZED`)

  try {
    // OPTIMIZATION: Fetch all data in parallel instead of sequential
    const parallelStartTime = performance.now()
    
    const [quoteResult, panelsResult, pricingResult, feesResult, accessoriesResult, tenantCompany, paymentsResult] = await Promise.all([
      // 1. Quote with customer data and production machine
      supabaseServer
        .from('quotes')
        .select(`
          id,
          quote_number,
          order_number,
          status,
          payment_status,
          payment_method_id,
          source,
          customer_id,
          discount_percent,
          production_machine_id,
          production_date,
          barcode,
          comment,
          total_net,
          total_vat,
          total_gross,
          final_total_after_discount,
          fees_total_net,
          fees_total_vat,
          fees_total_gross,
          accessories_total_net,
          accessories_total_vat,
          accessories_total_gross,
          created_at,
          updated_at,
          ready_notification_sent_at,
          last_storage_reminder_sent_at,
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
          ),
          production_machines(
            id,
            machine_name
          ),
          payment_methods(
            id,
            name
          )
        `)
        .eq('id', quoteId)
        .is('deleted_at', null)
        .single(),

      // 2. Panels with materials
      supabaseServer
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
        .order('created_at', { ascending: true }),

      // 3. Pricing with breakdowns
      supabaseServer
        .from('quote_materials_pricing')
        .select(`
          id, material_id, material_name, board_width_mm, board_length_mm, thickness_mm, grain_direction,
          on_stock, boards_used, usage_percentage, pricing_method, charged_sqm,
          price_per_sqm, vat_rate, currency, usage_limit, waste_multi,
          material_net, material_vat, material_gross,
          edge_materials_net, edge_materials_vat, edge_materials_gross,
          cutting_length_m, cutting_net, cutting_vat, cutting_gross,
          services_net, services_vat, services_gross,
          total_net, total_vat, total_gross,
          materials(id, name, brands(name)),
          quote_edge_materials_breakdown(
            id, edge_material_id, edge_material_name, total_length_m, price_per_m,
            net_price, vat_amount, gross_price
          ),
          quote_services_breakdown(
            id, service_type, quantity, unit_price, net_price, vat_amount, gross_price
          )
        `)
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true }),

      // 4. Fees
      supabaseServer
        .from('quote_fees')
        .select(`
          id, fee_name, quantity, unit_price_net, vat_rate, vat_amount, gross_price, currency_id, comment,
          created_at,
          feetypes(id, name),
          currencies(id, name)
        `)
        .eq('quote_id', quoteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),

      // 5. Accessories
      supabaseServer
        .from('quote_accessories')
        .select(`
          id, accessory_name, sku, quantity, unit_price_net, vat_rate, unit_name, currency_id,
          total_net, total_vat, total_gross, created_at,
          accessories(id, name, sku),
          units(id, name, shortform),
          currencies(id, name)
        `)
        .eq('quote_id', quoteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),

      // 6. Tenant company
      getTenantCompany(),

      // 7. Payments (for orders)
      supabaseServer
        .from('quote_payments')
        .select('*')
        .eq('quote_id', quoteId)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false })
    ])

    logTiming('Parallel Queries Complete', parallelStartTime, 'all 7 queries executed in parallel')

    // Extract data and errors from results
    const { data: quote, error: quoteError } = quoteResult
    const { data: panels, error: panelsError } = panelsResult
    const { data: pricingData, error: pricingError } = pricingResult
    const { data: fees, error: feesError } = feesResult
    const { data: accessories, error: accessoriesError } = accessoriesResult
    const { data: payments, error: paymentsError } = paymentsResult

    // Handle errors
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

    if (panelsError) {
      console.error('[SSR] Error fetching panels:', panelsError)
    }

    if (pricingError) {
      console.error('[SSR] Error fetching pricing:', pricingError)
      console.log('[SSR] Continuing without pricing data...')
    }

    if (feesError) {
      console.error('[SSR] Error fetching fees:', feesError)
    }

    if (accessoriesError) {
      console.error('[SSR] Error fetching accessories:', accessoriesError)
    }

    // Log individual query results for debugging
    console.log(`[PERF] Quote data: ${quote ? 'OK' : 'MISSING'}`)
    console.log(`[PERF] Panels: ${panels?.length || 0} records`)
    console.log(`[PERF] Pricing: ${pricingData?.length || 0} records`)
    console.log(`[PERF] Fees: ${fees?.length || 0} records`)
    console.log(`[PERF] Accessories: ${accessories?.length || 0} records`)
    console.log(`[PERF] Payments: ${payments?.length || 0} records`)
    console.log(`[PERF] Company: ${tenantCompany ? 'OK' : 'MISSING'}`)

    // Fetch machine codes for panels (for cutting list)
    const materialIds = panels?.map(p => p.material_id) || []
    const edgeMaterialIds = panels?.flatMap(p => [
      p.edge_material_a_id,
      p.edge_material_b_id,
      p.edge_material_c_id,
      p.edge_material_d_id
    ].filter(Boolean)) || []

    const machineCodesStartTime = performance.now()
    const [materialMaps, edgeMaterialMaps] = await Promise.all([
      materialIds.length > 0 ? supabaseServer
        .from('machine_material_map')
        .select('material_id, machine_code')
        .in('material_id', materialIds)
        .eq('machine_type', 'Korpus') : Promise.resolve({ data: [] }),
      
      edgeMaterialIds.length > 0 ? supabaseServer
        .from('machine_edge_material_map')
        .select('edge_material_id, machine_code')
        .in('edge_material_id', edgeMaterialIds)
        .eq('machine_type', 'Korpus') : Promise.resolve({ data: [] })
    ])

    logTiming('Machine Codes Fetch', machineCodesStartTime, `fetched ${materialMaps.data?.length || 0} material codes, ${edgeMaterialMaps.data?.length || 0} edge codes`)

    // Create lookup maps for machine codes
    const materialCodeMap = new Map(
      materialMaps.data?.map(m => [m.material_id, m.machine_code]) || []
    )
    const edgeCodeMap = new Map(
      edgeMaterialMaps.data?.map(e => [e.edge_material_id, e.machine_code]) || []
    )

    // Enrich panels with machine codes for cutting list
    const enrichedPanels = panels?.map(panel => ({
      ...panel,
      material_machine_code: materialCodeMap.get(panel.material_id) || '',
      edge_a_code: panel.edge_material_a_id ? edgeCodeMap.get(panel.edge_material_a_id) || null : null,
      edge_b_code: panel.edge_material_b_id ? edgeCodeMap.get(panel.edge_material_b_id) || null : null,
      edge_c_code: panel.edge_material_c_id ? edgeCodeMap.get(panel.edge_material_c_id) || null : null,
      edge_d_code: panel.edge_material_d_id ? edgeCodeMap.get(panel.edge_material_d_id) || null : null
    })) || []

    // Transform the response to include all necessary data
    const transformedQuote = {
      id: quote.id,
      quote_number: quote.quote_number,
      order_number: quote.order_number || null,
      status: quote.status,
      payment_status: quote.payment_status || 'not_paid',
      payment_method_id: quote.payment_method_id || null,
      payment_methods: quote.payment_methods || null,
      source: quote.source || 'internal',
      customer_id: quote.customer_id,
      discount_percent: quote.discount_percent,
      comment: quote.comment || null,
      production_machine_id: quote.production_machine_id || null,
      production_date: quote.production_date || null,
      barcode: quote.barcode || null,
      production_machine: quote.production_machines || null,
      customer: quote.customers,
      panels: enrichedPanels,
      pricing: pricingData || [],
      fees: fees || [],
      accessories: accessories || [],
      payments: payments || [],
      tenant_company: tenantCompany,
      totals: {
        total_net: quote.total_net,
        total_vat: quote.total_vat,
        total_gross: quote.total_gross,
        final_total_after_discount: quote.final_total_after_discount,
        fees_total_net: quote.fees_total_net || 0,
        fees_total_vat: quote.fees_total_vat || 0,
        fees_total_gross: quote.fees_total_gross || 0,
        accessories_total_net: quote.accessories_total_net || 0,
        accessories_total_vat: quote.accessories_total_vat || 0,
        accessories_total_gross: quote.accessories_total_gross || 0
      },
      created_at: quote.created_at,
      updated_at: quote.updated_at
    }

    logTiming('Quote Fetch Total', startTime, `returned quote ${quote.quote_number} with ${panels?.length || 0} panels`)
    console.log(`[SSR] Quote fetched successfully: ${quote.quote_number} (OPTIMIZED)`)
    
    return transformedQuote

  } catch (error) {
    console.error('[SSR] Error fetching quote:', error)
    logTiming('Quote Fetch Error', startTime)
    return null
  }
}

// Get quotes with pagination (for quotes list page)
export async function getQuotesWithPagination(page: number = 1, limit: number = 20, searchTerm?: string) {
  const startTime = performance.now()
  
  console.log(`[SSR] Fetching quotes page ${page}, limit ${limit}, search: "${searchTerm || 'none'}"`)

  try {
    const offset = (page - 1) * limit
    
    // Build query with search if provided
    let query = supabaseServer
      .from('quotes')
      .select(`
        id,
        quote_number,
        status,
        source,
        payment_method_id,
        final_total_after_discount,
        updated_at,
        customers!inner(
          id,
          name
        ),
        payment_methods(
          id,
          name
        )
      `, { count: 'exact' })
      .eq('status', 'draft') // Only show draft quotes, not orders
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply search filter if provided
    if (searchTerm && searchTerm.trim()) {
      query = query.ilike('customers.name', `%${searchTerm.trim()}%`)
    }

    const { data: quotes, error: quotesError, count } = await query

    if (quotesError) {
      console.error('[SSR] Error fetching quotes:', quotesError)
      logTiming('Quotes Fetch Failed', startTime)
      return { quotes: [], totalCount: 0, totalPages: 0 }
    }

    // Transform the data to flatten customer name and payment method
    const transformedQuotes = quotes?.map(quote => ({
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      source: quote.source || 'internal',
      customer_name: quote.customers?.name || 'Unknown Customer',
      payment_method_id: quote.payment_method_id,
      payment_method_name: quote.payment_methods?.name || null,
      final_total_after_discount: quote.final_total_after_discount,
      updated_at: quote.updated_at
    })) || []

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    logTiming('Quotes Fetch Total', startTime, `returned ${transformedQuotes.length} quotes (page ${page}/${totalPages})`)
    console.log(`[SSR] Quotes fetched successfully: ${transformedQuotes.length} quotes, total: ${totalCount}`)
    
    return {
      quotes: transformedQuotes,
      totalCount,
      totalPages,
      currentPage: page
    }

  } catch (error) {
    console.error('[SSR] Error fetching quotes:', error)
    logTiming('Quotes Fetch Error', startTime)
    return { quotes: [], totalCount: 0, totalPages: 0 }
  }
}

// Get orders with pagination (for orders list page)
export async function getOrdersWithPagination(page: number = 1, limit: number = 20, searchTerm?: string) {
  const startTime = performance.now()
  
  console.log(`[SSR] Fetching orders page ${page}, limit ${limit}, search: "${searchTerm || 'none'}"`)

  try {
    const offset = (page - 1) * limit
    
    // If search term is provided, we need to find orders that match either customer name or material names
    if (searchTerm && searchTerm.trim()) {
      const trimmedSearch = searchTerm.trim()
      
      // First, find materials that match the search term
      console.log(`[SSR] Searching materials for: "${trimmedSearch}"`)
      const { data: matchingMaterials, error: materialsError } = await supabaseServer
        .from('materials')
        .select('id')
        .ilike('name', `%${trimmedSearch}%`)
      
      if (materialsError) {
        console.error('[SSR] Error searching materials:', materialsError)
      }
      
      const materialIds = matchingMaterials?.map(m => m.id) || []
      console.log(`[SSR] Found ${materialIds.length} matching materials`)
      
      // Then find quote IDs that have panels using these materials
      let materialMatchIds: string[] = []
      if (materialIds.length > 0) {
        console.log(`[SSR] Searching quote_panels for material IDs: ${materialIds.join(', ')}`)
        const { data: materialMatches, error: panelsError } = await supabaseServer
          .from('quote_panels')
          .select('quote_id')
          .in('material_id', materialIds)
        
        if (panelsError) {
          console.error('[SSR] Error searching quote_panels:', panelsError)
        }
        
        materialMatchIds = materialMatches?.map(m => m.quote_id) || []
        console.log(`[SSR] Found ${materialMatchIds.length} matching quote panels`)
      }
      
      // Build query with OR condition for customer name OR material matches
      console.log(`[SSR] Building query with materialMatchIds: ${materialMatchIds.length} matches`)
      let query = supabaseServer
        .from('quotes')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          final_total_after_discount,
          updated_at,
          production_machine_id,
          production_date,
          barcode,
          customers!inner(
            id,
            name,
            mobile,
            email
          ),
          production_machines(
            id,
            machine_name
          )
        `, { count: 'exact' })
        .in('status', ['ordered', 'in_production', 'ready', 'finished', 'cancelled'])
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      // Execute two separate queries and combine results
      console.log(`[SSR] Executing separate queries for customer and material matches...`)
      
      // Query 1: Customer name matches
      const customerQuery = supabaseServer
        .from('quotes')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          final_total_after_discount,
          updated_at,
          production_machine_id,
          production_date,
          ready_at,
          barcode,
          customers!inner(
            id,
            name,
            mobile,
            email
          ),
          production_machines(
            id,
            machine_name
          )
        `, { count: 'exact' })
        .in('status', ['ordered', 'in_production', 'ready', 'finished', 'cancelled'])
        .is('deleted_at', null)
        .ilike('customers.name', `%${trimmedSearch}%`)
        .order('updated_at', { ascending: false})
        .range(offset, offset + limit - 1)

      // Query 2: Material matches (if any)
      let materialQuery = null
      if (materialMatchIds.length > 0) {
        materialQuery = supabaseServer
          .from('quotes')
          .select(`
            id,
            order_number,
            status,
            payment_status,
            final_total_after_discount,
            updated_at,
            production_machine_id,
            production_date,
            barcode,
            customers!inner(
              id,
              name,
              mobile,
              email
            ),
            production_machines(
              id,
              machine_name
            )
          `, { count: 'exact' })
          .in('status', ['ordered', 'in_production', 'ready', 'finished', 'cancelled'])
          .is('deleted_at', null)
          .in('id', materialMatchIds)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1)
      }

      // Execute both queries
      const [customerResult, materialResult] = await Promise.all([
        customerQuery,
        materialQuery || Promise.resolve({ data: [], error: null, count: 0 })
      ])

      const { data: customerOrders, error: customerError, count: customerCount } = customerResult
      const { data: materialOrders, error: materialError, count: materialCount } = materialResult

      if (customerError) {
        console.error('[SSR] Error fetching customer orders:', customerError)
        logTiming('Orders Fetch Failed', startTime)
        return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
      }

      if (materialError) {
        console.error('[SSR] Error fetching material orders:', materialError)
        logTiming('Orders Fetch Failed', startTime)
        return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
      }

      // Combine and deduplicate results
      const allOrders = [...(customerOrders || []), ...(materialOrders || [])]
      const uniqueOrders = allOrders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
      )

      // Sort by updated_at descending
      uniqueOrders.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

      // Apply pagination to combined results
      const paginatedOrders = uniqueOrders.slice(0, limit)
      const totalCount = uniqueOrders.length
      const totalPages = Math.ceil(totalCount / limit)

      console.log(`[SSR] Combined results: ${uniqueOrders.length} total, ${paginatedOrders.length} on page`)

      // Use the combined results as orders
      const orders = paginatedOrders
      
      // Get payment totals for all orders (for payment modal)
      const { data: paymentTotals } = await supabaseServer
        .from('quote_payments')
        .select('quote_id, amount')
        .in('quote_id', orders?.map(o => o.id) || [])

      const totalPaidByOrder = (paymentTotals || []).reduce((acc: Record<string, number>, p: any) => {
        acc[p.quote_id] = (acc[p.quote_id] || 0) + p.amount
        return acc
      }, {})

      // Transform the data
      const transformedOrders = orders?.map(order => ({
        id: order.id,
        order_number: order.order_number || 'N/A',
        status: order.status,
        payment_status: order.payment_status || 'not_paid',
        customer_name: order.customers?.name || 'Unknown Customer',
        customer_mobile: order.customers?.mobile || '',
        customer_email: order.customers?.email || '',
        final_total: order.final_total_after_discount || 0,
        total_paid: totalPaidByOrder[order.id] || 0,
        remaining_balance: (order.final_total_after_discount || 0) - (totalPaidByOrder[order.id] || 0),
        updated_at: order.updated_at,
        production_machine_id: order.production_machine_id || null,
        production_machine_name: order.production_machines?.machine_name || null,
        production_date: order.production_date || null,
        barcode: order.barcode || ''
      })) || []

      return {
        orders: transformedOrders,
        totalCount,
        totalPages,
        currentPage: page
      }
    }
    
    // No search term - regular query
    let query = supabaseServer
      .from('quotes')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        final_total_after_discount,
        updated_at,
        production_machine_id,
        production_date,
        ready_at,
        barcode,
        customers!inner(
          id,
          name,
          mobile,
          email
        ),
        production_machines(
          id,
          machine_name
        )
      `, { count: 'exact' })
      .in('status', ['ordered', 'in_production', 'ready', 'finished', 'cancelled'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: orders, error: ordersError, count } = await query

    if (ordersError) {
      console.error('[SSR] Error fetching orders:', ordersError)
      console.error('[SSR] Error details:', JSON.stringify(ordersError, null, 2))
      logTiming('Orders Fetch Failed', startTime)
      return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    // Get payment totals for all orders (for payment modal)
    const { data: paymentTotals } = await supabaseServer
      .from('quote_payments')
      .select('quote_id, amount')
      .in('quote_id', orders?.map(o => o.id) || [])

    const totalPaidByOrder = (paymentTotals || []).reduce((acc, p) => {
      acc[p.quote_id] = (acc[p.quote_id] || 0) + p.amount
      return acc
    }, {} as Record<string, number>)

    // Transform the data
    const transformedOrders = orders?.map(order => ({
      id: order.id,
      order_number: order.order_number || 'N/A',
      status: order.status,
      payment_status: order.payment_status || 'not_paid',
      customer_name: order.customers?.name || 'Unknown Customer',
      customer_mobile: order.customers?.mobile || '',
      customer_email: order.customers?.email || '',
      final_total: order.final_total_after_discount || 0,
      total_paid: totalPaidByOrder[order.id] || 0,
      remaining_balance: (order.final_total_after_discount || 0) - (totalPaidByOrder[order.id] || 0),
      updated_at: order.updated_at,
      production_machine_id: order.production_machine_id || null,
      production_machine_name: order.production_machines?.machine_name || null,
      production_date: order.production_date || null,
      ready_at: order.ready_at || null,
      barcode: order.barcode || ''
    })) || []

    const totalCount = count || 0
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0

    console.log(`[SSR] Pagination calculation: totalCount=${totalCount}, limit=${limit}, totalPages=${totalPages}`)
    logTiming('Orders Fetch Total', startTime, `returned ${transformedOrders.length} orders (page ${page}/${totalPages})`)
    console.log(`[SSR] Orders fetched successfully: ${transformedOrders.length} orders, total: ${totalCount}`)
    
    return {
      orders: transformedOrders,
      totalCount,
      totalPages,
      currentPage: page
    }
  } catch (error) {
    console.error('[SSR] Error fetching orders:', error)
    console.error('[SSR] Error details:', JSON.stringify(error, null, 2))
    console.error('[SSR] Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('[SSR] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    logTiming('Orders Fetch Error', startTime)
    return { orders: [], totalCount: 0, totalPages: 0, currentPage: page }
  }
}

// Accessories SSR functions
export async function getAllAccessories() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('accessories')
    .select(`
      id, 
      name, 
      sku, 
      base_price,
      multiplier,
      net_price, 
      created_at, 
      updated_at,
      vat_id,
      currency_id,
      units_id,
      partners_id,
      vat (
        id,
        name,
        kulcs
      ),
      currencies (
        id,
        name
      ),
      units (
        id,
        name,
        shortform
      ),
      partners (
        id,
        name
      )
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Accessories DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching accessories:', error)
    return []
  }

  // Transform the data to include calculated fields
  const transformedData = data?.map(accessory => ({
    ...accessory,
    vat_name: accessory.vat?.name || '',
    vat_percent: accessory.vat?.kulcs || 0,
    currency_name: accessory.currencies?.name || '',
    unit_name: accessory.units?.name || '',
    unit_shortform: accessory.units?.shortform || '',
    partner_name: accessory.partners?.name || '',
    vat_amount: (accessory.net_price * (accessory.vat?.kulcs || 0)) / 100,
    gross_price: accessory.net_price + ((accessory.net_price * (accessory.vat?.kulcs || 0)) / 100)
  })) || []

  logTiming('Accessories Total', startTime, `returned ${transformedData.length} records`)
  return transformedData
}

// Get accessories with pagination
export async function getAccessoriesWithPagination(page: number = 1, limit: number = 100) {
  const startTime = performance.now()
  
  const offset = (page - 1) * limit
  
  // Get total count
  const { count } = await supabaseServer
    .from('accessories')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  // Get paginated data
  const { data, error } = await supabaseServer
    .from('accessories')
    .select(`
      id, 
      name, 
      sku, 
      base_price,
      multiplier,
      net_price, 
      created_at, 
      updated_at,
      vat_id,
      currency_id,
      units_id,
      partners_id,
      vat (
        id,
        name,
        kulcs
      ),
      currencies (
        id,
        name
      ),
      units (
        id,
        name,
        shortform
      ),
      partners (
        id,
        name
      )
    `)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  const queryTime = performance.now()
  logTiming('Accessories Paginated DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching accessories:', error)
    return { accessories: [], totalCount: 0, totalPages: 0, currentPage: page }
  }

  // Transform the data to include calculated fields
  const transformedData = data?.map(accessory => ({
    ...accessory,
    vat_name: accessory.vat?.name || '',
    vat_percent: accessory.vat?.kulcs || 0,
    currency_name: accessory.currencies?.name || '',
    unit_name: accessory.units?.name || '',
    unit_shortform: accessory.units?.shortform || '',
    partner_name: accessory.partners?.name || '',
    vat_amount: (accessory.net_price * (accessory.vat?.kulcs || 0)) / 100,
    gross_price: accessory.net_price + ((accessory.net_price * (accessory.vat?.kulcs || 0)) / 100)
  })) || []

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / limit)

  logTiming('Accessories Paginated Total', startTime, `returned ${transformedData.length} of ${totalCount} records`)
  
  return {
    accessories: transformedData,
    totalCount,
    totalPages,
    currentPage: page
  }
}

export async function getAccessoryById(id: string) {
  const { data, error } = await supabaseServer
    .from('accessories')
    .select(`
      id, 
      name, 
      sku, 
      base_price,
      multiplier,
      net_price, 
      created_at, 
      updated_at,
      vat_id,
      currency_id,
      units_id,
      partners_id,
      vat (
        id,
        name,
        kulcs
      ),
      currencies (
        id,
        name
      ),
      units (
        id,
        name,
        shortform
      ),
      partners (
        id,
        name
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching accessory:', error)
    return null
  }

  // Transform the data to include calculated fields
  const transformedData = {
    ...data,
    vat_name: data.vat?.name || '',
    vat_percent: data.vat?.kulcs || 0,
    currency_name: data.currencies?.name || '',
    unit_name: data.units?.name || '',
    unit_shortform: data.units?.shortform || '',
    partner_name: data.partners?.name || '',
    vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
    gross_price: data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
  }

  return transformedData
}


// Workers functions
export async function getAllWorkers() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('workers')
    .select('id, name, nickname, mobile, color, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const queryTime = performance.now()
  logTiming('Workers DB Query', startTime, `fetched ${data?.length || 0} records`)

  if (error) {
    console.error('Error fetching workers:', error)
    return []
  }

  logTiming('Workers Total', startTime, `returned ${data?.length || 0} records`)
  return data || []
}

export async function getWorkerById(id: string) {
  const { data, error } = await supabaseServer
    .from('workers')
    .select('id, name, nickname, mobile, color, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching worker:', error)
    return null
  }

  return data
}

// Shop Orders functions
export async function getAllShopOrders() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('shop_orders')
    .select(`
      id,
      order_number,
      worker_id,
      customer_name,
      customer_email,
      customer_mobile,
      customer_discount,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number,
      status,
      created_at,
      updated_at,
      sms_sent_at,
      workers(name, nickname),
      shop_order_items(
        id,
        product_name,
        sku,
        type,
        quantity,
        status,
        base_price,
        multiplier,
        vat_id,
        currency_id,
        units(name, shortform),
        partners(name)
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const queryTime = performance.now()
  logTiming('getAllShopOrders Query', startTime, `Found ${data?.length || 0} orders`)

  if (error) {
    console.error('Error fetching shop orders:', error)
    return []
  }

  // Transform data for better performance
  const transformedOrders = data?.map(order => ({
    id: order.id,
    order_number: order.order_number,
    worker_id: order.worker_id,
    worker_name: order.workers?.name || '',
    worker_nickname: order.workers?.nickname || '',
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_mobile: order.customer_mobile,
    customer_discount: order.customer_discount,
    billing_name: order.billing_name,
    billing_country: order.billing_country,
    billing_city: order.billing_city,
    billing_postal_code: order.billing_postal_code,
    billing_street: order.billing_street,
    billing_house_number: order.billing_house_number,
    billing_tax_number: order.billing_tax_number,
    billing_company_reg_number: order.billing_company_reg_number,
    status: order.status,
    created_at: order.created_at,
    updated_at: order.updated_at,
    sms_sent_at: order.sms_sent_at,
    items_count: order.shop_order_items?.length || 0,
    items: order.shop_order_items?.map(item => ({
      id: item.id,
      product_name: item.product_name,
      sku: item.sku,
      type: item.type,
      quantity: item.quantity,
      status: item.status,
      base_price: item.base_price,
      multiplier: item.multiplier,
      vat_id: item.vat_id,
      currency_id: item.currency_id,
      unit_name: item.units?.name || '',
      unit_shortform: item.units?.shortform || '',
      partner_name: item.partners?.name || ''
    })) || []
  })) || []

  logTiming('getAllShopOrders Total', startTime, `Transformed ${transformedOrders.length} orders`)
  return transformedOrders
}

// Get single shop order by ID with all data (for detail page)
export async function getShopOrderById(orderId: string) {
  const startTime = performance.now()
  
  console.log(`[SSR] Fetching shop order ${orderId}`)

  try {
    // Fetch all data in parallel
    const parallelStartTime = performance.now()
    
    const [orderResult, tenantCompany] = await Promise.all([
      // 1. Shop order with worker data
      supabaseServer
        .from('shop_orders')
        .select(`
          id,
          order_number,
          worker_id,
          customer_name,
          customer_email,
          customer_mobile,
          customer_discount,
          billing_name,
          billing_country,
          billing_city,
          billing_postal_code,
          billing_street,
          billing_house_number,
          billing_tax_number,
          billing_company_reg_number,
          status,
          created_at,
          updated_at,
          sms_sent_at,
          workers(
            id,
            name,
            nickname,
            mobile,
            color
          )
        `)
        .eq('id', orderId)
        .is('deleted_at', null)
        .single(),

      // 2. Tenant company
      getTenantCompany()
    ])

    // 3. Shop order items with related data
    const { data: itemsData, error: itemsError } = await supabaseServer
      .from('shop_order_items')
      .select(`
        id,
        product_name,
        sku,
        type,
        base_price,
        multiplier,
        quantity,
        megjegyzes,
        status,
        created_at,
        units(
          id,
          name,
          shortform
        ),
        partners(
          id,
          name
        ),
        vat(
          id,
          kulcs
        ),
        currencies(
          id,
          name
        )
      `)
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    logTiming('Parallel Queries Complete', parallelStartTime, 'all queries executed in parallel')

    // Extract data and errors from results
    const { data: order, error: orderError } = orderResult

    // Handle errors
    if (orderError) {
      console.error('[SSR] Error fetching shop order:', orderError)
      logTiming('Shop Order Fetch Failed', startTime)
      return null
    }

    if (itemsError) {
      console.error('[SSR] Error fetching shop order items:', itemsError)
      logTiming('Shop Order Items Fetch Failed', startTime)
      return null
    }

    if (!order) {
      console.error('[SSR] Shop order not found:', orderId)
      logTiming('Shop Order Not Found', startTime)
      return null
    }

    // Calculate totals
    const items = itemsData || []
    const totals = items.reduce((acc, item) => {
      const netPrice = item.base_price * item.multiplier
      const grossPrice = netPrice * (1 + (item.vat?.kulcs || 0) / 100)
      const itemTotal = grossPrice * item.quantity
      const discountAmount = itemTotal * (order.customer_discount / 100)
      
      acc.total_net += netPrice * item.quantity
      acc.total_gross += itemTotal
      acc.final_total += itemTotal - discountAmount
      acc.discount_amount += discountAmount
      
      return acc
    }, {
      total_net: 0,
      total_gross: 0,
      final_total: 0,
      discount_amount: 0
    })

    // Transform the response
    const transformedOrder = {
      id: order.id,
      order_number: order.order_number,
      worker_id: order.worker_id,
      worker: order.workers,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_mobile: order.customer_mobile,
      customer_discount: order.customer_discount,
      billing_name: order.billing_name,
      billing_country: order.billing_country,
      billing_city: order.billing_city,
      billing_postal_code: order.billing_postal_code,
      billing_street: order.billing_street,
      billing_house_number: order.billing_house_number,
      billing_tax_number: order.billing_tax_number,
      billing_company_reg_number: order.billing_company_reg_number,
      status: order.status,
      items: items,
      tenant_company: tenantCompany,
      totals: totals,
      created_at: order.created_at,
      updated_at: order.updated_at,
      sms_sent_at: order.sms_sent_at
    }

    logTiming('Shop Order Fetch Total', startTime, `returned order ${order.order_number} with ${items.length} items`)
    console.log(`[SSR] Shop order fetched successfully: ${order.order_number}`)
    
    return transformedOrder

  } catch (error) {
    console.error('[SSR] Error fetching shop order:', error)
    logTiming('Shop Order Fetch Error', startTime)
    return null
  }
}

// Fetch all shop order items for supplier orders page
export async function getAllShopOrderItems(page: number = 1, limit: number = 50, search: string = '', status: string = '', partnerId: string = '') {
  if (!checkSupabaseConfig()) return { items: [], totalCount: 0, totalPages: 0 }

  const startTime = performance.now()
  const offset = (page - 1) * limit

  try {
    console.log(`[SSR] Fetching shop order items page ${page}, limit ${limit}, search: "${search}", status: "${status}", partner: "${partnerId}"`)

    // Build the query with joins to get all related data
    let query = supabaseServer
      .from('shop_order_items')
      .select(`
        id,
        product_name,
        sku,
        quantity,
        base_price,
        multiplier,
        megjegyzes,
        status,
        created_at,
        updated_at,
        order_id,
        units_id,
        partner_id,
        vat_id,
        shop_orders!inner (
          id,
          customer_name,
          customer_mobile,
          order_number
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        ),
        vat (
          id,
          name,
          kulcs
        )
      `, { count: 'exact' })
      .is('shop_orders.deleted_at', null)

    // Apply filters
    if (search && search.length >= 2) {
      query = query.or(`product_name.ilike.%${search}%,sku.ilike.%${search}%,shop_orders.customer_name.ilike.%${search}%`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    logTiming('Shop Order Items DB Query', startTime, `Found ${data?.length || 0} items`)

    if (error) {
      console.error('[SSR] Error fetching shop order items:', error)
      return { items: [], totalCount: 0, totalPages: 0 }
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    // Transform the data to include calculated fields
    const items = data?.map(item => {
      const grossUnitPrice = Math.round((item.base_price || 0) * (item.multiplier || 1) * (1 + (item.vat?.kulcs || 0) / 100))
      
      return {
        id: item.id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        megjegyzes: item.megjegyzes,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        order_id: item.order_id,
        customer_name: item.shop_orders?.customer_name,
        customer_mobile: item.shop_orders?.customer_mobile,
        order_number: item.shop_orders?.order_number,
        unit_name: item.units?.name,
        unit_shortform: item.units?.shortform,
        partner_name: item.partners?.name,
        partner_id: item.partner_id,
        vat_name: item.vat?.name,
        vat_percent: item.vat?.kulcs,
        base_price: item.base_price,
        multiplier: item.multiplier,
        gross_unit_price: grossUnitPrice,
        gross_total: Math.round(grossUnitPrice * item.quantity)
      }
    }) || []

    logTiming('Shop Order Items Total', startTime, `Transformed ${items.length} items`)
    console.log(`[SSR] Shop order items fetched successfully: ${items.length} items, total: ${totalCount}`)

    return {
      items,
      totalCount,
      totalPages,
      currentPage: page,
      limit
    }

  } catch (error) {
    console.error('[SSR] Error fetching shop order items:', error)
    logTiming('Shop Order Items Fetch Error', startTime)
    return { items: [], totalCount: 0, totalPages: 0 }
  }
}

/**
 * Get all SMS settings (message templates)
 */
export async function getAllSmsSettings() {
  if (!checkSupabaseConfig()) return []

  const startTime = performance.now()

  try {
    const { data, error } = await supabaseServer!
      .from('sms_settings')
      .select('*')
      .order('template_name', { ascending: true })

    if (error) {
      console.error('[SSR] Error fetching SMS settings:', error)
      logTiming('SMS Settings Fetch Error', startTime)
      return []
    }

    logTiming('SMS Settings Fetch', startTime)
    return data || []
  } catch (error) {
    console.error('[SSR] Exception fetching SMS settings:', error)
    logTiming('SMS Settings Fetch Error', startTime)
    return []
  }
}

/**
 * Get SMS settings (message template) - DEPRECATED, use getAllSmsSettings
 * Kept for backward compatibility
 */
export async function getSmsSettings() {
  const templates = await getAllSmsSettings()
  return templates.length > 0 ? templates[0] : null
}
