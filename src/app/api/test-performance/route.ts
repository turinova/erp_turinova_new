import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('Performance test started...')
    
    // Test 1: Simple query
    const queryStart = Date.now()

    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .limit(5)

    const queryTime = Date.now() - queryStart
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        queryTime,
        totalTime: Date.now() - startTime
      })
    }
    
    const totalTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      data: data,
      queryTime,
      totalTime,
      performance: {
        queryTimeMs: queryTime,
        totalTimeMs: totalTime,
        recordCount: data?.length || 0
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalTime: Date.now() - startTime
    })
  }
}
