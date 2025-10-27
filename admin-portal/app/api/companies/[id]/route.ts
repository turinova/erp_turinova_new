import { NextRequest, NextResponse } from 'next/server'
import { deleteCompany, updateCompany } from '@/lib/supabase-server'

// DELETE /api/companies/[id] - Soft delete a company
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await deleteCompany(id)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error deleting company:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete company' },
      { status: 500 }
    )
  }
}

// PUT /api/companies/[id] - Update a company
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const updatedCompany = await updateCompany(id, body)
    
    return NextResponse.json(updatedCompany, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error updating company:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update company' },
      { status: 500 }
    )
  }
}

