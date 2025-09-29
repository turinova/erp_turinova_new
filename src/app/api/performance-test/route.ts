import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'
import { optimizedQuery, PerformanceMonitor, supabaseOptimized } from '@/lib/supabase-optimized'

export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!supabase || !supabaseOptimized) {
      return NextResponse.json({ 
        error: 'Supabase not configured',
        message: 'Performance test requires Supabase configuration'
      }, { status: 503 })
    }

    console.log('Running performance comparison test...')

    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[]
    }

    // Test 1: Units - Original vs Optimized
    console.log('Testing units performance...')
    
    // Original query
    const originalUnitsStart = performance.now()

    const { data: originalUnits } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    const originalUnitsTime = performance.now() - originalUnitsStart

    // Optimized query
    const optimizedUnits = await PerformanceMonitor.measureQuery(
      'units-optimized-test',
      () => optimizedQuery.getAllActive(
        'units',
        'id, name, shortform, created_at, updated_at, deleted_at',
        'name',
        'asc'
      )
    )

    results.tests.push({
      table: 'units',
      original: {
        time: originalUnitsTime,
        count: originalUnits?.length || 0
      },
      optimized: {
        time: PerformanceMonitor.endTimer('units-optimized-test'),
        count: optimizedUnits.length
      },
      improvement: `${((originalUnitsTime - PerformanceMonitor.endTimer('units-optimized-test')) / originalUnitsTime * 100).toFixed(1)}%`
    })

    // Test 2: Currencies - Original vs Optimized
    console.log('Testing currencies performance...')
    
    // Original query
    const originalCurrenciesStart = performance.now()

    const { data: originalCurrencies } = await supabase
      .from('currencies')
      .select('id, name, rate, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    const originalCurrenciesTime = performance.now() - originalCurrenciesStart

    // Optimized query
    const optimizedCurrencies = await PerformanceMonitor.measureQuery(
      'currencies-optimized-test',
      () => optimizedQuery.getAllActive(
        'currencies',
        'id, name, rate, created_at, updated_at, deleted_at',
        'name',
        'asc'
      )
    )

    results.tests.push({
      table: 'currencies',
      original: {
        time: originalCurrenciesTime,
        count: originalCurrencies?.length || 0
      },
      optimized: {
        time: PerformanceMonitor.endTimer('currencies-optimized-test'),
        count: optimizedCurrencies.length
      },
      improvement: `${((originalCurrenciesTime - PerformanceMonitor.endTimer('currencies-optimized-test')) / originalCurrenciesTime * 100).toFixed(1)}%`
    })

    // Test 3: Brands - Original vs Optimized
    console.log('Testing brands performance...')
    
    // Original query
    const originalBrandsStart = performance.now()

    const { data: originalBrands } = await supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    const originalBrandsTime = performance.now() - originalBrandsStart

    // Optimized query
    const optimizedBrands = await PerformanceMonitor.measureQuery(
      'brands-optimized-test',
      () => optimizedQuery.getAllActive(
        'brands',
        'id, name, comment, created_at, updated_at, deleted_at',
        'name',
        'asc'
      )
    )

    results.tests.push({
      table: 'brands',
      original: {
        time: originalBrandsTime,
        count: originalBrands?.length || 0
      },
      optimized: {
        time: PerformanceMonitor.endTimer('brands-optimized-test'),
        count: optimizedBrands.length
      },
      improvement: `${((originalBrandsTime - PerformanceMonitor.endTimer('brands-optimized-test')) / originalBrandsTime * 100).toFixed(1)}%`
    })

    // Calculate overall improvement
    const totalOriginalTime = originalUnitsTime + originalCurrenciesTime + originalBrandsTime
    const totalOptimizedTime = results.tests.reduce((sum, test) => sum + test.optimized.time, 0)
    const overallImprovement = ((totalOriginalTime - totalOptimizedTime) / totalOriginalTime * 100).toFixed(1)

    results.summary = {
      totalOriginalTime: totalOriginalTime.toFixed(2),
      totalOptimizedTime: totalOptimizedTime.toFixed(2),
      overallImprovement: `${overallImprovement}%`,
      averageImprovement: `${(results.tests.reduce((sum, test) => sum + parseFloat(test.improvement), 0) / results.tests.length).toFixed(1)}%`
    }

    console.log('Performance test completed:', results.summary)
    
return NextResponse.json(results)

  } catch (error) {
    console.error('Error running performance test:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
