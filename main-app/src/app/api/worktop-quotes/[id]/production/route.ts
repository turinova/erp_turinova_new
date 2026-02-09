import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * PATCH /api/worktop-quotes/[id]/production
 * Assign a worktop quote/order to production (date and barcode only, no machine)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const worktopQuoteId = resolvedParams.id
    const body = await request.json()
    
    const { production_date, barcode } = body

    // Validation
    if (!production_date || !barcode) {
      return NextResponse.json(
        { error: 'Hiányzó adatok: dátum és vonalkód kötelező' },
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

    // Verify worktop quote exists and user has access
    const { data: quote, error: quoteError } = await supabase
      .from('worktop_quotes')
      .select('id, status, order_number, barcode')
      .eq('id', worktopQuoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Munkalap ajánlat nem található' },
        { status: 404 }
      )
    }

    // Update worktop quote with production info and change status to in_production
    // Note: production_machine_id is always NULL for worktop orders
    const { data: updatedQuote, error: updateError } = await supabase
      .from('worktop_quotes')
      .update({
        production_machine_id: null, // Worktop orders don't use production machines
        production_date,
        barcode,
        status: 'in_production',
        updated_at: new Date().toISOString()
      })
      .eq('id', worktopQuoteId)
      .select('id, status, order_number')
      .single()

    if (updateError) {
      console.error('Error updating worktop quote with production info:', updateError)
      return NextResponse.json(
        { error: 'Hiba a gyártásba adás során', details: updateError.message },
        { status: 500 }
      )
    }

    // Note: Worktop quotes don't use inventory reservation (foglalás)
    // as they use linear materials which are handled differently

    return NextResponse.json({
      success: true,
      message: 'Megrendelés sikeresen gyártásba adva',
      status: updatedQuote.status
    })

  } catch (error) {
    console.error('Worktop production assignment error:', error)
    return NextResponse.json(
      { error: 'Hiba a gyártásba adás során' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/worktop-quotes/[id]/production
 * Remove production assignment from a worktop quote/order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const worktopQuoteId = resolvedParams.id

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

    // Verify worktop quote exists
    const { data: quote, error: quoteError } = await supabase
      .from('worktop_quotes')
      .select('id, status, order_number')
      .eq('id', worktopQuoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Munkalap ajánlat nem található' },
        { status: 404 }
      )
    }

    // Remove production info and revert status to ordered
    const { error: updateError } = await supabase
      .from('worktop_quotes')
      .update({
        production_machine_id: null,
        production_date: null,
        barcode: null,
        status: 'ordered',
        updated_at: new Date().toISOString()
      })
      .eq('id', worktopQuoteId)

    if (updateError) {
      console.error('Error removing production info:', updateError)
      return NextResponse.json(
        { error: 'Hiba a gyártás törlése során', details: updateError.message },
        { status: 500 }
      )
    }

    // Note: Worktop quotes don't use inventory reservation, so no need to release

    return NextResponse.json({
      success: true,
      message: 'Gyártás hozzárendelés törölve'
    })

  } catch (error) {
    console.error('Worktop production delete error:', error)
    return NextResponse.json(
      { error: 'Hiba a gyártás törlése során' },
      { status: 500 }
    )
  }
}
