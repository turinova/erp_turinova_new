import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name || !name.trim()) {
      return NextResponse.json({ exists: false })
    }

    // Check if customer with this name exists (excluding soft-deleted)
    const { data: existingCustomer, error } = await supabaseServer
      .from('customers')
      .select('id')
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected
      console.error('Error checking customer name:', error)
      return NextResponse.json({ 
        error: 'Failed to check customer name',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      exists: !!existingCustomer 
    })

  } catch (error) {
    console.error('Error in customer name check:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
