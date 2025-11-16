import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = (searchParams.get('sku') || '').trim()
    if (!sku) {
      return NextResponse.json({ ok: false, error: 'SKU is required' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('accessories')
      .select('id')
      .eq('sku', sku)
      .is('deleted_at', null)
      .limit(1)

    if (error) {
      console.error('Error validating SKU:', error)
      return NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 500 })
    }

    const exists = Array.isArray(data) && data.length > 0
    return NextResponse.json({ ok: true, unique: !exists })
  } catch (e) {
    console.error('SKU validation exception:', e)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}

