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
// Future Phases (Phase 2 & 3)
// ============================================

/**
 * Process foglalás (reservation) - Phase 2
 * Called when quote status changes to 'in_production'
 * TODO: Implement in Phase 2
 */
export async function processFoglalás(quoteIds: string[]): Promise<InventoryProcessingResult> {
  console.log('[Inventory] Foglalás not yet implemented (Phase 2)')
  return { processed: 0, skipped: quoteIds.length, errors: [] }
}

/**
 * Process kivételezés (consumption) - Phase 3
 * Called when quote status changes to 'ready'
 * TODO: Implement in Phase 3
 */
export async function processKivételezés(quoteIds: string[]): Promise<InventoryProcessingResult> {
  console.log('[Inventory] Kivételezés not yet implemented (Phase 3)')
  return { processed: 0, skipped: quoteIds.length, errors: [] }
}

