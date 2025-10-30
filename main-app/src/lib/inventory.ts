/**
 * Material Inventory Management
 * Phase 1: Bevételezés (Inbound) with Average Cost tracking
 * 
 * Purpose: Track material movements and costs for inventory management
 * Method: Transaction-based log with average cost valuation
 */

import { supabaseServer } from './supabase-server'

// ============================================
// Types
// ============================================

export interface CreateInventoryTransactionParams {
  material_id: string
  sku: string
  transaction_type: 'in' | 'out' | 'reserved' | 'released'
  quantity: number // positive for 'in'/'reserved', negative for 'out'
  unit_price?: number | null // Required for 'in'/'out', NULL for 'reserved'/'released'
  reference_type: 'shop_order_item' | 'quote' | 'manual'
  reference_id: string
  comment?: string
}

export interface InventoryProcessingResult {
  processed: number
  skipped: number
  errors: string[]
}

// ============================================
// Core Functions
// ============================================

/**
 * Create a new inventory transaction
 * @param params Transaction parameters
 * @returns Success status and optional error message
 */
export async function createInventoryTransaction(
  params: CreateInventoryTransactionParams
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Inventory] Creating transaction:`, {
      sku: params.sku,
      type: params.transaction_type,
      quantity: params.quantity,
      unit_price: params.unit_price,
      reference: `${params.reference_type}:${params.reference_id.substring(0, 8)}`
    })

    const { error } = await supabaseServer
      .from('material_inventory_transactions')
      .insert({
        material_id: params.material_id,
        sku: params.sku,
        transaction_type: params.transaction_type,
        quantity: params.quantity,
        unit_price: params.unit_price || null,
        reference_type: params.reference_type,
        reference_id: params.reference_id,
        comment: params.comment || null
      })

    if (error) {
      console.error('[Inventory] Transaction creation failed:', error)
      return { success: false, error: error.message }
    }

    console.log(`[Inventory] ✓ Transaction created successfully`)
    return { success: true }
  } catch (error) {
    console.error('[Inventory] Unexpected error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get material_id by SKU (machine_code)
 * Uses cached lookup via machine_material_map
 * 
 * @param sku Machine code to lookup
 * @returns material_id or null if not found
 */
export async function getMaterialIdBySKU(sku: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseServer
      .from('machine_material_map')
      .select('material_id')
      .eq('machine_code', sku)
      .eq('machine_type', 'Korpus')
      .single()

    if (error || !data) {
      console.warn(`[Inventory] Material not found for SKU: ${sku}`)
      return null
    }

    return data.material_id
  } catch (error) {
    console.error('[Inventory] Error fetching material by SKU:', error)
    return null
  }
}

/**
 * Calculate average cost for a material
 * Used for 'out' transactions in future phases
 * 
 * @param materialId Material UUID
 * @returns Average cost per board or null
 */
export async function getAverageCost(materialId: string): Promise<number | null> {
  try {
    const { data, error } = await supabaseServer
      .from('material_inventory_summary')
      .select('average_cost_per_board')
      .eq('material_id', materialId)
      .single()

    if (error || !data) {
      console.warn(`[Inventory] Could not fetch average cost for material: ${materialId}`)
      return null
    }

    return Number(data.average_cost_per_board) || null
  } catch (error) {
    console.error('[Inventory] Error fetching average cost:', error)
    return null
  }
}

// ============================================
// Phase 1: Bevételezés (Inbound)
// ============================================

/**
 * Process bevételezés (inbound) for shop_order_items
 * Called when items status changes to 'arrived'
 * 
 * Workflow:
 * 1. Fetch item details (sku, quantity, base_price)
 * 2. Skip if no SKU (not a material)
 * 3. Get material_id from machine_code
 * 4. Create 'in' transaction with price
 * 
 * @param itemIds Array of shop_order_item UUIDs
 * @returns Processing results with counts and errors
 */
export async function processBevételezés(
  itemIds: string[]
): Promise<InventoryProcessingResult> {
  const startTime = performance.now()
  const results: InventoryProcessingResult = {
    processed: 0,
    skipped: 0,
    errors: []
  }

  console.log(`[Inventory] Processing bevételezés for ${itemIds.length} items`)

  // Batch fetch all items for performance
  const { data: items, error: fetchError } = await supabaseServer
    .from('shop_order_items')
    .select('id, sku, product_name, quantity, base_price, status')
    .in('id', itemIds)

  if (fetchError) {
    console.error('[Inventory] Failed to fetch items:', fetchError)
    results.errors.push(`Batch fetch failed: ${fetchError.message}`)
    return results
  }

  if (!items || items.length === 0) {
    console.warn('[Inventory] No items found for provided IDs')
    return results
  }

  // Process each item
  for (const item of items) {
    try {
      // Skip if no SKU (not a material)
      if (!item.sku || item.sku.trim() === '') {
        console.log(`[Inventory] Skipping item ${item.id}: No SKU (not a material)`)
        results.skipped++
        continue
      }

      // Get material_id from SKU
      const materialId = await getMaterialIdBySKU(item.sku)
      if (!materialId) {
        console.warn(`[Inventory] Skipping item ${item.id}: Material not found for SKU ${item.sku}`)
        results.skipped++
        continue
      }

      // Validate quantity and price
      if (!item.quantity || item.quantity <= 0) {
        console.warn(`[Inventory] Skipping item ${item.id}: Invalid quantity ${item.quantity}`)
        results.skipped++
        continue
      }

      if (!item.base_price || item.base_price <= 0) {
        console.warn(`[Inventory] Skipping item ${item.id}: Invalid base_price ${item.base_price}`)
        results.skipped++
        continue
      }

      // Create inbound transaction
      const transactionResult = await createInventoryTransaction({
        material_id: materialId,
        sku: item.sku,
        transaction_type: 'in',
        quantity: item.quantity, // positive
        unit_price: item.base_price,
        reference_type: 'shop_order_item',
        reference_id: item.id,
        comment: `Bevételezés: ${item.product_name}`
      })

      if (transactionResult.success) {
        results.processed++
        console.log(`[Inventory] ✓ Processed item ${item.id}: +${item.quantity} boards of ${item.sku} @ ${item.base_price} Ft/board`)
      } else {
        results.errors.push(`Item ${item.id} (${item.sku}): ${transactionResult.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Item ${item.id}: ${errorMsg}`)
      console.error(`[Inventory] Error processing item ${item.id}:`, error)
    }
  }

  const duration = performance.now() - startTime
  console.log(`[Inventory] Bevételezés complete in ${duration.toFixed(2)}ms: ${results.processed} processed, ${results.skipped} skipped, ${results.errors.length} errors`)
  
  return results
}

// ============================================
// Phase 2: Foglalás (Reservation)
// ============================================

/**
 * Process foglalás (reservation) for quotes
 * Called when quote status changes to 'in_production'
 * 
 * Workflow:
 * 1. Fetch quote with quote_materials_pricing
 * 2. For each material pricing with boards_used > 0
 * 3. Get material SKU from machine_material_map
 * 4. Create 'reserved' transaction (no price)
 * 
 * @param quoteIds Array of quote UUIDs
 * @returns Processing results with counts and errors
 */
export async function processFoglalás(
  quoteIds: string[]
): Promise<InventoryProcessingResult> {
  const startTime = performance.now()
  const results: InventoryProcessingResult = {
    processed: 0,
    skipped: 0,
    errors: []
  }

  console.log(`[Inventory] Processing foglalás for ${quoteIds.length} quotes`)

  for (const quoteId of quoteIds) {
    try {
      // Fetch quote with materials pricing
      const { data: quote, error: quoteError } = await supabaseServer
        .from('quotes')
        .select(`
          id,
          quote_number,
          order_number,
          status
        `)
        .eq('id', quoteId)
        .single()

      if (quoteError || !quote) {
        results.errors.push(`Quote ${quoteId}: Failed to fetch`)
        console.error(`[Inventory] Failed to fetch quote ${quoteId}:`, quoteError)
        continue
      }

      // Fetch materials pricing for this quote
      const { data: pricingData, error: pricingError } = await supabaseServer
        .from('quote_materials_pricing')
        .select(`
          id,
          material_id,
          material_name,
          boards_used
        `)
        .eq('quote_id', quoteId)

      if (pricingError) {
        results.errors.push(`Quote ${quoteId}: Failed to fetch pricing`)
        console.error(`[Inventory] Failed to fetch pricing for quote ${quoteId}:`, pricingError)
        continue
      }

      if (!pricingData || pricingData.length === 0) {
        console.log(`[Inventory] Skipping quote ${quoteId}: No materials pricing`)
        results.skipped++
        continue
      }

      // Process each material
      for (const pricing of pricingData) {
        try {
          // Skip if no boards used
          if (!pricing.boards_used || pricing.boards_used <= 0) {
            console.log(`[Inventory] Skipping pricing ${pricing.id}: No boards used (${pricing.boards_used})`)
            continue
          }

          // Get SKU from machine_material_map
          const { data: machineData, error: machineError } = await supabaseServer
            .from('machine_material_map')
            .select('machine_code')
            .eq('material_id', pricing.material_id)
            .eq('machine_type', 'Korpus')
            .single()

          if (machineError || !machineData) {
            console.warn(`[Inventory] Skipping material ${pricing.material_id}: No machine_code found`)
            continue
          }

          const sku = machineData.machine_code

          // Create reservation transaction
          const transactionResult = await createInventoryTransaction({
            material_id: pricing.material_id,
            sku: sku,
            transaction_type: 'reserved',
            quantity: pricing.boards_used, // positive (absolute value)
            unit_price: null, // No price for reservations
            reference_type: 'quote',
            reference_id: quoteId,
            comment: `Foglalva: ${quote.order_number || quote.quote_number} - ${pricing.material_name}`
          })

          if (transactionResult.success) {
            results.processed++
            console.log(`[Inventory] ✓ Reserved ${pricing.boards_used} boards of ${sku} for quote ${quote.order_number || quote.quote_number}`)
          } else {
            results.errors.push(`Material ${pricing.material_id}: ${transactionResult.error}`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Inventory] Error processing material ${pricing.material_id}:`, error)
          // Don't fail the whole quote, continue with next material
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Quote ${quoteId}: ${errorMsg}`)
      console.error(`[Inventory] Error processing quote ${quoteId}:`, error)
    }
  }

  const duration = performance.now() - startTime
  console.log(`[Inventory] Foglalás complete in ${duration.toFixed(2)}ms: ${results.processed} processed, ${results.skipped} skipped, ${results.errors.length} errors`)
  
  return results
}

// ============================================
// Phase 3: Kivételezés (Consumption)
// ============================================

/**
 * Process kivételezés (consumption) for quotes
 * Called when quote status changes to 'ready'
 * 
 * Workflow:
 * 1. Fetch quote with quote_materials_pricing
 * 2. For each material pricing with boards_used > 0:
 *    a. Release reservation (delete 'reserved' transaction)
 *    b. Create 'out' transaction with average cost
 * 3. Reduces on_hand stock
 * 
 * @param quoteIds Array of quote UUIDs
 * @returns Processing results with counts and errors
 */
export async function processKivételezés(
  quoteIds: string[]
): Promise<InventoryProcessingResult> {
  const startTime = performance.now()
  const results: InventoryProcessingResult = {
    processed: 0,
    skipped: 0,
    errors: []
  }

  console.log(`[Inventory] Processing kivételezés for ${quoteIds.length} quotes`)

  for (const quoteId of quoteIds) {
    try {
      // Fetch quote with materials pricing
      const { data: quote, error: quoteError } = await supabaseServer
        .from('quotes')
        .select(`
          id,
          quote_number,
          order_number,
          status
        `)
        .eq('id', quoteId)
        .single()

      if (quoteError || !quote) {
        results.errors.push(`Quote ${quoteId}: Failed to fetch`)
        console.error(`[Inventory] Failed to fetch quote ${quoteId}:`, quoteError)
        continue
      }

      // Fetch materials pricing for this quote
      const { data: pricingData, error: pricingError } = await supabaseServer
        .from('quote_materials_pricing')
        .select(`
          id,
          material_id,
          material_name,
          boards_used
        `)
        .eq('quote_id', quoteId)

      if (pricingError) {
        results.errors.push(`Quote ${quoteId}: Failed to fetch pricing`)
        console.error(`[Inventory] Failed to fetch pricing for quote ${quoteId}:`, pricingError)
        continue
      }

      if (!pricingData || pricingData.length === 0) {
        console.log(`[Inventory] Skipping quote ${quoteId}: No materials pricing`)
        results.skipped++
        continue
      }

      // Process each material
      for (const pricing of pricingData) {
        try {
          // Skip if no boards used
          if (!pricing.boards_used || pricing.boards_used <= 0) {
            console.log(`[Inventory] Skipping pricing ${pricing.id}: No boards used (${pricing.boards_used})`)
            continue
          }

          // Get SKU from machine_material_map
          const { data: machineData, error: machineError } = await supabaseServer
            .from('machine_material_map')
            .select('machine_code')
            .eq('material_id', pricing.material_id)
            .eq('machine_type', 'Korpus')
            .single()

          if (machineError || !machineData) {
            console.warn(`[Inventory] Skipping material ${pricing.material_id}: No machine_code found`)
            continue
          }

          const sku = machineData.machine_code

          // Step 1: Release reservation (delete 'reserved' transaction)
          console.log(`[Inventory] Releasing reservation for ${sku}...`)
          const { error: deleteError } = await supabaseServer
            .from('material_inventory_transactions')
            .delete()
            .eq('reference_type', 'quote')
            .eq('reference_id', quoteId)
            .eq('transaction_type', 'reserved')
            .eq('material_id', pricing.material_id)

          if (deleteError) {
            console.error(`[Inventory] Error releasing reservation for ${sku}:`, deleteError)
            // Continue anyway to create 'out' transaction
          } else {
            console.log(`[Inventory] ✓ Released reservation for ${sku}`)
          }

          // Step 2: Get average cost for this material
          const avgCost = await getAverageCost(pricing.material_id)
          if (!avgCost || avgCost <= 0) {
            console.warn(`[Inventory] No average cost for ${sku}, using 0`)
          }

          // Step 3: Create consumption transaction (deduct from stock)
          const transactionResult = await createInventoryTransaction({
            material_id: pricing.material_id,
            sku: sku,
            transaction_type: 'out',
            quantity: -pricing.boards_used, // negative!
            unit_price: avgCost || 0, // Use average cost
            reference_type: 'quote',
            reference_id: quoteId,
            comment: `Kivételezés: ${quote.order_number || quote.quote_number} - ${pricing.material_name}`
          })

          if (transactionResult.success) {
            results.processed++
            const cogs = pricing.boards_used * (avgCost || 0)
            console.log(`[Inventory] ✓ Consumed ${pricing.boards_used} boards of ${sku} @ ${avgCost} Ft (COGS: ${cogs} Ft) for ${quote.order_number || quote.quote_number}`)
          } else {
            results.errors.push(`Material ${pricing.material_id}: ${transactionResult.error}`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Inventory] Error processing material ${pricing.material_id}:`, error)
          // Don't fail the whole quote, continue with next material
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Quote ${quoteId}: ${errorMsg}`)
      console.error(`[Inventory] Error processing quote ${quoteId}:`, error)
    }
  }

  const duration = performance.now() - startTime
  console.log(`[Inventory] Kivételezés complete in ${duration.toFixed(2)}ms: ${results.processed} materials consumed, ${results.skipped} skipped, ${results.errors.length} errors`)
  
  return results
}

