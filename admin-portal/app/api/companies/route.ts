import { NextRequest, NextResponse } from 'next/server'
import { createCompany } from '@/lib/supabase-server'

// POST /api/companies - Create a new company
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const newCompany = await createCompany(body)
    
    return NextResponse.json(newCompany, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error creating company:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create company' },
      { status: 500 }
    )
  }
}

