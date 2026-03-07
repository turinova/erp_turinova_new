import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * Ensure a manufacturer exists in the manufacturers table, create it if it doesn't
 * @param supabase Supabase client
 * @param manufacturerName The manufacturer/brand name (e.g., "Samsung", "Apple")
 * @returns The manufacturer ID if found or created, null if manufacturerName is empty
 */
async function ensureManufacturerExists(supabase: any, manufacturerName: string | null | undefined): Promise<string | null> {
  if (!manufacturerName || !manufacturerName.trim()) {
    return null
  }

  const trimmedName = manufacturerName.trim()

  // Check if manufacturer already exists by name
  const { data: existingManufacturer } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('name', trimmedName)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingManufacturer) {
    return existingManufacturer.id
  }

  // Manufacturer doesn't exist, create it
  const { data: newManufacturer, error } = await supabase
    .from('manufacturers')
    .insert({
      name: trimmedName
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[BACKFILL] Failed to create manufacturer "${trimmedName}":`, error)
    // Don't throw - just log and return null
    return null
  }

  console.log(`[BACKFILL] Auto-created manufacturer: "${trimmedName}"`)
  return newManufacturer.id
}

/**
 * POST /api/products/backfill-manufacturers
 * Backfill erp_manufacturer_id for existing products that have brand but no erp_manufacturer_id
 * NOTE: This endpoint is deprecated after brand column removal. It will only work on databases that still have the brand column.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all products with brand but no erp_manufacturer_id
    const { data: products, error: productsError } = await supabase
      .from('shoprenter_products')
      .select('id, sku, brand, erp_manufacturer_id')
      .not('brand', 'is', null)
      .is('erp_manufacturer_id', null)
      .is('deleted_at', null)

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return NextResponse.json(
        { error: 'Hiba a termékek lekérdezésekor' },
        { status: 500 }
      )
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nincs szinkronizálandó termék',
        updated: 0,
        total: 0
      })
    }

    console.log(`[BACKFILL] Found ${products.length} products to backfill manufacturers for`)

    let updated = 0
    let errors = 0
    const errorMessages: string[] = []

    // Process products in batches to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)
      
      for (const product of batch) {
        try {
          if (!product.brand || product.brand.trim() === '') {
            continue
          }

          // Get or create manufacturer
          const erp_manufacturer_id = await ensureManufacturerExists(supabase, product.brand)

          if (erp_manufacturer_id) {
            // Update product with erp_manufacturer_id
            const { error: updateError } = await supabase
              .from('shoprenter_products')
              .update({ erp_manufacturer_id })
              .eq('id', product.id)

            if (updateError) {
              console.error(`[BACKFILL] Error updating product ${product.sku}:`, updateError)
              errors++
              errorMessages.push(`${product.sku}: ${updateError.message}`)
            } else {
              updated++
              if (updated % 50 === 0) {
                console.log(`[BACKFILL] Progress: ${updated}/${products.length} products updated`)
              }
            }
          } else {
            console.warn(`[BACKFILL] Could not create/get manufacturer for product ${product.sku} with brand "${product.brand}"`)
            errors++
            errorMessages.push(`${product.sku}: Nem sikerült létrehozni/lekérni a gyártót`)
          }
        } catch (error) {
          console.error(`[BACKFILL] Error processing product ${product.sku}:`, error)
          errors++
          errorMessages.push(`${product.sku}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill befejezve: ${updated} termék frissítve, ${errors} hiba`,
      updated,
      errors,
      total: products.length,
      errorMessages: errorMessages.slice(0, 20) // Limit error messages to first 20
    })
  } catch (error) {
    console.error('Error in backfill manufacturers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
