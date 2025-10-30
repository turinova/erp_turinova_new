import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { processFoglalás } from '@/lib/inventory'

/**
 * PATCH /api/quotes/[id]/production
 * Assign a quote/order to production machine
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const quoteId = resolvedParams.id
    const body = await request.json()
    
    const { production_machine_id, production_date, barcode } = body

    // Validation
    if (!production_machine_id || !production_date || !barcode) {
      return NextResponse.json(
        { error: 'Hiányzó adatok: gép, dátum és vonalkód kötelező' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify quote exists and user has access
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, status, order_number')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }

    // Verify machine exists
    const { data: machine, error: machineError } = await supabase
      .from('production_machines')
      .select('id, machine_name')
      .eq('id', production_machine_id)
      .is('deleted_at', null)
      .single()

    if (machineError || !machine) {
      return NextResponse.json(
        { error: 'Gép nem található' },
        { status: 404 }
      )
    }

    // Update quote with production info and change status to in_production
    const { data: updatedQuote, error: updateError } = await supabase
      .from('quotes')
      .update({
        production_machine_id,
        production_date,
        barcode,
        status: 'in_production',
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)
      .select('id, status, order_number')
      .single()

    if (updateError) {
      console.error('Error updating quote with production info:', updateError)
      return NextResponse.json(
        { error: 'Hiba a gyártásba adás során', details: updateError.message },
        { status: 500 }
      )
    }

    // Phase 2: Process inventory reservation (foglalás)
    let inventoryResult = null
    const inventoryStartTime = performance.now()
    console.log(`[Inventory] Triggering foglalás for quote ${quoteId}`)
    
    try {
      inventoryResult = await processFoglalás([quoteId])
      const inventoryDuration = performance.now() - inventoryStartTime
      
      console.log(`[PERF] Inventory Reservation: ${inventoryDuration.toFixed(2)}ms`)
      console.log(`[Inventory] Results: ${inventoryResult.processed} materials reserved, ${inventoryResult.skipped} skipped, ${inventoryResult.errors.length} errors`)
      
      // Log errors but don't fail the production assignment
      if (inventoryResult.errors.length > 0) {
        console.warn('[Inventory] Errors during reservation:', inventoryResult.errors)
      }
    } catch (error) {
      console.error('[Inventory] Exception during reservation:', error)
      // Don't fail the production assignment if inventory fails
    }

    return NextResponse.json({
      success: true,
      message: 'Megrendelés sikeresen gyártásba adva',
      status: updatedQuote.status,
      inventory: inventoryResult ? {
        materials_reserved: inventoryResult.processed,
        skipped: inventoryResult.skipped,
        errors: inventoryResult.errors
      } : null
    })

  } catch (error) {
    console.error('Production assignment error:', error)
    return NextResponse.json(
      { error: 'Hiba a gyártásba adás során' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/quotes/[id]/production
 * Remove production assignment from a quote/order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const quoteId = resolvedParams.id

    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify quote exists
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, status, order_number')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }

    // Remove production info and revert status to ordered
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        production_machine_id: null,
        production_date: null,
        barcode: null,
        status: 'ordered',
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)

    if (updateError) {
      console.error('Error removing production info:', updateError)
      return NextResponse.json(
        { error: 'Hiba a gyártás törlése során', details: updateError.message },
        { status: 500 }
      )
    }

    // Phase 2: Release inventory reservations when cancelling production
    console.log(`[Inventory] Releasing reservations for quote ${quoteId}`)
    
    try {
      // Find and delete all 'reserved' transactions for this quote
      const { error: deleteError } = await supabase
        .from('material_inventory_transactions')
        .delete()
        .eq('reference_type', 'quote')
        .eq('reference_id', quoteId)
        .eq('transaction_type', 'reserved')

      if (deleteError) {
        console.error('[Inventory] Error releasing reservations:', deleteError)
        // Don't fail the operation, just log
      } else {
        console.log('[Inventory] ✓ Reservations released successfully')
      }
    } catch (error) {
      console.error('[Inventory] Exception releasing reservations:', error)
      // Don't fail the production deletion if inventory fails
    }

    return NextResponse.json({
      success: true,
      message: 'Gyártás hozzárendelés törölve'
    })

  } catch (error) {
    console.error('Production delete error:', error)
    return NextResponse.json(
      { error: 'Hiba a gyártás törlése során' },
      { status: 500 }
    )
  }
}

