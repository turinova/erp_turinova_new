import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { barcode } = body

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json(
        { error: 'Vonalkód szükséges' },
        { status: 400 }
      )
    }

    const trimmedBarcode = barcode.trim()

    if (trimmedBarcode.length === 0 || trimmedBarcode.length > 64) {
      return NextResponse.json(
        { error: 'A vonalkód hossza 1-64 karakter között lehet' },
        { status: 400 }
      )
    }

    // Check uniqueness - ensure no other accessory has this barcode
    const { data: existingAccessory, error: checkError } = await supabaseServer
      .from('accessories')
      .select('id, name')
      .eq('barcode', trimmedBarcode)
      .neq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking barcode uniqueness:', checkError)
      return NextResponse.json(
        { error: 'Hiba a vonalkód ellenőrzésekor' },
        { status: 500 }
      )
    }

    if (existingAccessory) {
      return NextResponse.json(
        { error: `Ez a vonalkód már használatban van: ${existingAccessory.name}` },
        { status: 409 }
      )
    }

    // Update the barcode
    const { data, error } = await supabaseServer
      .from('accessories')
      .update({
        barcode: trimmedBarcode,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, name, sku, barcode')
      .single()

    if (error) {
      console.error('Error updating barcode:', error)
      return NextResponse.json(
        { error: 'Hiba a vonalkód frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      accessory: data
    })
  } catch (error) {
    console.error('Error in barcode update:', error)
    return NextResponse.json(
      { error: 'Váratlan hiba történt' },
      { status: 500 }
    )
  }
}

