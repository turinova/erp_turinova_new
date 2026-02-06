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
    // We now accept gross prices directly
    const {
      kereszt_vagas_fee_gross,
      hosszanti_vagas_fee_per_meter_gross,
      ives_vagas_fee_gross,
      szogvagas_fee_gross,
      kivagas_fee_gross,
      elzaro_fee_per_meter_gross,
      osszemaras_fee_gross,
      currency_id,
      vat_id
    } = body

    // Validate all gross fees are positive numbers
    if (!kereszt_vagas_fee_gross || kereszt_vagas_fee_gross < 0) {
      return NextResponse.json(
        { error: 'A kereszt vágás díj kötelező és nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!hosszanti_vagas_fee_per_meter_gross || hosszanti_vagas_fee_per_meter_gross < 0) {
      return NextResponse.json(
        { error: 'A hosszanti vágás díj kötelező és nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!ives_vagas_fee_gross || ives_vagas_fee_gross < 0) {
      return NextResponse.json(
        { error: 'Az íves vágás díj kötelező és nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!szogvagas_fee_gross || szogvagas_fee_gross < 0) {
      return NextResponse.json(
        { error: 'A szögvágás díj kötelező és nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!kivagas_fee_gross || kivagas_fee_gross < 0) {
      return NextResponse.json(
        { error: 'A kivágás díj kötelező és nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!elzaro_fee_per_meter_gross || elzaro_fee_per_meter_gross < 0) {
      return NextResponse.json(
        { error: 'Az élzáró díj kötelező és nem lehet negatív' },
        { status: 400 }
      )
    }

    if (!osszemaras_fee_gross || osszemaras_fee_gross < 0) {
      return NextResponse.json(
        { error: 'Az összemarás díj kötelező és nem lehet negatív' },
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

    // Get VAT rate to calculate net prices from gross
    const { data: vatData, error: vatError } = await supabaseServer
      .from('vat')
      .select('kulcs')
      .eq('id', vat_id)
      .single()

    if (vatError || !vatData) {
      return NextResponse.json(
        { error: 'Hiba történt az ÁFA kulcs lekérdezésénél' },
        { status: 500 }
      )
    }

    const vatRate = vatData.kulcs / 100

    // Calculate net prices from gross prices
    const kereszt_vagas_fee = Math.round(parseFloat(kereszt_vagas_fee_gross) / (1 + vatRate))
    const hosszanti_vagas_fee_per_meter = Math.round(parseFloat(hosszanti_vagas_fee_per_meter_gross) / (1 + vatRate))
    const ives_vagas_fee = Math.round(parseFloat(ives_vagas_fee_gross) / (1 + vatRate))
    const szogvagas_fee = Math.round(parseFloat(szogvagas_fee_gross) / (1 + vatRate))
    const kivagas_fee = Math.round(parseFloat(kivagas_fee_gross) / (1 + vatRate))
    const elzaro_fee_per_meter = Math.round(parseFloat(elzaro_fee_per_meter_gross) / (1 + vatRate))
    const osszemaras_fee = Math.round(parseFloat(osszemaras_fee_gross) / (1 + vatRate))

    // Update the worktop config fee - store both gross and net
    const updateData: any = {
      kereszt_vagas_fee,
      hosszanti_vagas_fee_per_meter,
      ives_vagas_fee,
      szogvagas_fee,
      kivagas_fee,
      elzaro_fee_per_meter,
      osszemaras_fee,
      kereszt_vagas_fee_gross: parseFloat(kereszt_vagas_fee_gross),
      hosszanti_vagas_fee_per_meter_gross: parseFloat(hosszanti_vagas_fee_per_meter_gross),
      ives_vagas_fee_gross: parseFloat(ives_vagas_fee_gross),
      szogvagas_fee_gross: parseFloat(szogvagas_fee_gross),
      kivagas_fee_gross: parseFloat(kivagas_fee_gross),
      elzaro_fee_per_meter_gross: parseFloat(elzaro_fee_per_meter_gross),
      osszemaras_fee_gross: parseFloat(osszemaras_fee_gross),
      currency_id,
      vat_id,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabaseServer
      .from('worktop_config_fees')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        kereszt_vagas_fee,
        hosszanti_vagas_fee_per_meter,
        ives_vagas_fee,
        szogvagas_fee,
        kivagas_fee,
        elzaro_fee_per_meter,
        osszemaras_fee,
        kereszt_vagas_fee_gross,
        hosszanti_vagas_fee_per_meter_gross,
        ives_vagas_fee_gross,
        szogvagas_fee_gross,
        kivagas_fee_gross,
        elzaro_fee_per_meter_gross,
        osszemaras_fee_gross,
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
      console.error('Error updating worktop config fee:', error)
      // PGRST116 = no rows found
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'A munki beállítások nem találhatók. Kérjük, először hozza létre az adatbázisban.' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Hiba történt a mentés során', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ worktopConfigFee: data })
  } catch (error) {
    console.error('Error in worktop-config-fees PATCH:', error)
    return NextResponse.json(
      { error: 'Belső szerver hiba' },
      { status: 500 }
    )
  }
}
