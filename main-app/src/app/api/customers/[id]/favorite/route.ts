import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data: current, error: fetchError } = await supabase
      .from('customers')
      .select('is_favorite')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const newValue = !current.is_favorite

    const { error: updateError } = await supabase
      .from('customers')
      .update({ is_favorite: newValue })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 })
    }

    return NextResponse.json({ is_favorite: newValue })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
