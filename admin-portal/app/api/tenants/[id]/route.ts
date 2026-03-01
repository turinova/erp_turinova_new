import { NextRequest, NextResponse } from 'next/server'
import { getTenantById, deleteTenant, updateTenant } from '@/lib/supabase-server'

// GET /api/tenants/[id] - Get tenant by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenant = await getTenantById(id)
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }
    
    return NextResponse.json(tenant)
  } catch (error: any) {
    console.error('[API] Error fetching tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tenant' },
      { status: 500 }
    )
  }
}

// DELETE /api/tenants/[id] - Soft delete a tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await deleteTenant(id)
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error deleting tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete tenant' },
      { status: 500 }
    )
  }
}

// PUT /api/tenants/[id] - Update a tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    await updateTenant(id, body)
    
    // Fetch updated tenant with all related data
    const updatedTenant = await getTenantById(id)
    
    if (!updatedTenant) {
      return NextResponse.json({ error: 'Tenant not found after update' }, { status: 404 })
    }
    
    return NextResponse.json(updatedTenant, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error updating tenant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update tenant' },
      { status: 500 }
    )
  }
}
