import { NextRequest, NextResponse } from 'next/server'
import { supabaseOptimized } from '@/lib/supabase-optimized'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database performance...')
    
    const startTime = performance.now()
    
    // Test simple query
    const { data: units, error } = await supabaseOptimized
      .from('units')
      .select('id, name, shortform')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Direct query took: ${queryTime.toFixed(2)}ms`)
    console.log(`Units count: ${units?.length || 0}`)
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      queryTime: `${queryTime.toFixed(2)}ms`,
      unitsCount: units?.length || 0,
      sampleData: units?.slice(0, 3) || [],
      message: queryTime > 100 ? 'SLOW QUERY DETECTED' : 'Query is fast'
    })
    
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
