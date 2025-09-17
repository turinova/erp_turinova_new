import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { redisCache } from '@/lib/redis'

const CACHE_TTL = 300 // 5 minutes in seconds

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cacheKey = `unit:${id}`
    console.log(`Fetching unit ${id} with Redis caching...`)

    // Try to get from Redis cache first
    const cachedUnit = await redisCache.get<any>(cacheKey)
    if (cachedUnit) {
      console.log(`Unit ${id} served from Redis cache`)
      return NextResponse.json(cachedUnit, {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Source': 'Redis',
        },
      })
    }

    console.log(`Redis cache miss for unit ${id}, fetching from database...`)
    const startTime = performance.now()

    const { data: unit, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at, deleted_at')
      .eq('id', id)
      .single()

    const endTime = performance.now()
    const queryTime = endTime - startTime
    console.log(`Unit ${id} database query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch unit' }, { status: 500 })
    }

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    console.log('Unit fetched successfully:', unit)

    // Cache the result in Redis
    await redisCache.set(cacheKey, unit, CACHE_TTL)

    return NextResponse.json(unit, {
      headers: {
        'X-Cache': 'MISS',
        'X-Cache-Source': 'Database',
        'X-Cache-Time': `${queryTime.toFixed(2)}ms`,
      },
    })

  } catch (error) {
    console.error('Error fetching unit with Redis caching:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Updating unit ${id}, invalidating Redis cache...`)
    const unitData = await request.json()

    const { data: unit, error } = await supabase
      .from('units')
      .update({
        name: unitData.name,
        shortform: unitData.shortform,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy egység már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
    }

    // Invalidate cache for this specific unit and all units list
    await redisCache.del(`unit:${id}`)
    await redisCache.delPattern('units:*')

    console.log('Unit updated successfully and cache invalidated:', unit)
    return NextResponse.json({
      success: true,
      message: 'Unit updated successfully',
      unit: unit
    })

  } catch (error) {
    console.error('Error updating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Soft deleting unit ${id}, invalidating Redis cache...`)

    // Try soft delete first
    let { error } = await supabase
      .from('units')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')
      const result = await supabase
        .from('units')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
    }

    // Invalidate cache for this specific unit and all units list
    await redisCache.del(`unit:${id}`)
    await redisCache.delPattern('units:*')

    console.log(`Unit ${id} deleted successfully and cache invalidated`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
