import { NextRequest, NextResponse } from 'next/server'
import { createTenant } from '@/lib/supabase-server'

// POST /api/tenants - Create a new tenant
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const newTenant = await createTenant(body)
    
    return NextResponse.json(newTenant, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error creating tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create tenant' },
      { status: 500 }
    )
  }
}
