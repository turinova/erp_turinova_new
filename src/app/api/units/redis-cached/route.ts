import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redisCache } from '@/lib/redis'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Cache configuration
const CACHE_KEY = 'units:all'
const CACHE_TTL = 300 // 5 minutes in seconds

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching units with Redis caching...')
    
    const startTime = performance.now()
    
    // Try to get from Redis cache first
    const cachedUnits = await redisCache.get(CACHE_KEY)
    
    if (cachedUnits) {
      const endTime = performance.now()
      const totalTime = endTime - startTime
      console.log(`Units served from Redis cache in ${totalTime.toFixed(2)}ms`)
      
      return NextResponse.json(cachedUnits, {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Time': totalTime.toFixed(2) + 'ms',
          'X-Cache-Source': 'Redis'
        }
      })
    }
    
    // Cache miss - fetch from database
    console.log('Cache miss - fetching units from database...')
    const dbStartTime = performance.now()
    
    const { data: units, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at, deleted_at')
      .is('deleted_at', null) // Only fetch active records
      .order('name', { ascending: true })
    
    const dbEndTime = performance.now()
    const dbQueryTime = dbEndTime - dbStartTime
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
    }
    
    const unitsData = units || []
    
    // Cache the result in Redis
    await redisCache.set(CACHE_KEY, unitsData, CACHE_TTL)
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    console.log(`Units query took: ${dbQueryTime.toFixed(2)}ms`)
    console.log(`Total time (with caching): ${totalTime.toFixed(2)}ms`)
    console.log(`Fetched ${unitsData.length} units successfully`)
    
    return NextResponse.json(unitsData, {
      headers: {
        'X-Cache': 'MISS',
        'X-DB-Query-Time': dbQueryTime.toFixed(2) + 'ms',
        'X-Total-Time': totalTime.toFixed(2) + 'ms',
        'X-Cache-Source': 'Database'
      }
    })
    
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new unit and invalidating cache...')
    
    const unitData = await request.json()
    
    const newUnit = {
      name: unitData.name || '',
      shortform: unitData.shortform || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: unit, error } = await supabase
      .from('units')
      .insert([newUnit])
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
      
      return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
    }
    
    // Invalidate cache after creating new unit
    await redisCache.del(CACHE_KEY)
    console.log('Cache invalidated after unit creation')
    
    console.log('Unit created successfully:', unit)
    
    return NextResponse.json(
      {
        success: true,
        message: 'Unit created successfully',
        unit: unit
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
