import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate required fields
    const {
      fee_per_meter,
      panthelyfuras_fee_per_hole,
      duplungolas_fee_per_sqm,
      szogvagas_fee_per_panel,
      machine_threshold,
      currency_id,
      vat_id
    } = body

    if (!fee_per_meter || fee_per_meter <= 0) {
      return NextResponse.json(
        { error: 'A vágási díj kötelező és pozitív szám kell legyen' },
        { status: 400 }
      )
    }

    if (panthelyfuras_fee_per_hole < 0) {
      return NextResponse.json(
        { error: 'A pánthelyfúrási díj nem lehet negatív' },
        { status: 400 }
      )
    }

    if (duplungolas_fee_per_sqm < 0) {
      return NextResponse.json(
        { error: 'A duplungolási díj nem lehet negatív' },
        { status: 400 }
      )
    }

    if (szogvagas_fee_per_panel < 0) {
      return NextResponse.json(
        { error: 'A szögvágási díj nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!currency_id) {
      return NextResponse.json(
        { error: 'A pénznem kötelező' },
        { status: 400 }
      )
    }

    if (!vat_id) {
      return NextResponse.json(
        { error: 'Az ÁFA kulcs kötelező' },
        { status: 400 }
      )
    }

    if (machine_threshold !== undefined && (machine_threshold < 0 || machine_threshold === null)) {
      return NextResponse.json(
        { error: 'A géphozzárendelési küszöbérték nem lehet negatív' },
        { status: 400 }
      )
    }

    // Update the cutting fee
    const updateData: any = {
      fee_per_meter: parseFloat(fee_per_meter),
      panthelyfuras_fee_per_hole: parseFloat(panthelyfuras_fee_per_hole),
      duplungolas_fee_per_sqm: parseFloat(duplungolas_fee_per_sqm),
      szogvagas_fee_per_panel: parseFloat(szogvagas_fee_per_panel),
      currency_id,
      vat_id,
      updated_at: new Date().toISOString()
    }

    if (machine_threshold !== undefined) {
      updateData.machine_threshold = parseFloat(machine_threshold)
    }

    const { data, error } = await supabaseServer
      .from('cutting_fees')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        fee_per_meter,
        panthelyfuras_fee_per_hole,
        duplungolas_fee_per_sqm,
        szogvagas_fee_per_panel,
        machine_threshold,
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
      .single()

    if (error) {
      console.error('Error updating cutting fee:', error)
      return NextResponse.json(
        { error: 'Hiba történt a mentés során', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ cuttingFee: data })
  } catch (error) {
    console.error('Error in cutting-fees PATCH:', error)
    return NextResponse.json(
      { error: 'Belső szerver hiba' },
      { status: 500 }
    )
  }
}
