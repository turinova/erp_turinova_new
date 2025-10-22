import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - Get single machine by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    console.log(`Fetching machine ${id}`)
    
    const { data: machine, error } = await supabaseServer
      .from('production_machines')
      .select('id, machine_name, comment, usage_limit_per_day, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    console.log(`Machine fetched successfully: ${machine.machine_name}`)
    
    return NextResponse.json(machine)
    
  } catch (error) {
    console.error('Error fetching machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update machine
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Updating machine ${id}`)

    const machineData = await request.json()

    // Validate required fields
    if (!machineData.machine_name) {
      return NextResponse.json({ error: 'Machine name is required' }, { status: 400 })
    }

    if (!machineData.usage_limit_per_day) {
      return NextResponse.json({ error: 'Usage limit per day is required' }, { status: 400 })
    }

    const updateData = {
      machine_name: machineData.machine_name,
      comment: machineData.comment || null,
      usage_limit_per_day: machineData.usage_limit_per_day,
      updated_at: new Date().toISOString()
    }

    const { data: machine, error } = await supabaseServer
      .from('production_machines')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, machine_name, comment, usage_limit_per_day, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('machine_name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy gép már létezik ezzel a névvel',
            error: 'Machine name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to update machine' }, { status: 500 })
    }

    console.log(`Machine updated successfully: ${machine.machine_name}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Machine updated successfully',
        data: machine
      }
    )

  } catch (error) {
    console.error('Error updating machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Soft delete machine
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Deleting machine ${id}`)

    const { error } = await supabaseServer
      .from('production_machines')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to delete machine' }, { status: 500 })
    }

    console.log(`Machine deleted successfully: ${id}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Machine deleted successfully'
      }
    )

  } catch (error) {
    console.error('Error deleting machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
