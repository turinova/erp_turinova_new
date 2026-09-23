// Main Optimization API — thin wrapper around shared runOptimize
import { NextRequest, NextResponse } from 'next/server'
import {
  optimizeMaterials,
  type OptimizationAlgorithm
} from '@/lib/optimization/runOptimize'
import type { SortStrategy } from '@/lib/optimization/sorting'
import type { MaterialData } from '@/types/optimization'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  const apiStartTime = performance.now()

  try {
    const input = await request.json()

    if (!input || !Array.isArray(input.materials)) {
      return NextResponse.json(
        { error: 'Invalid request data - missing materials array' },
        { status: 400, headers: corsHeaders }
      )
    }

    const algorithm = (input.algorithm as OptimizationAlgorithm) || 'ensemble'
    const sortStrategy = (input.sortStrategy as SortStrategy) || 'height'

    console.log(
      `[API] Processing optimization request with ${input.materials.length} materials (Algorithm: ${algorithm}, Sort: ${sortStrategy})`
    )

    const results = optimizeMaterials(input.materials as MaterialData[], {
      algorithm,
      sortStrategy
    })

    const totalDuration = performance.now() - apiStartTime
    console.log(
      `[API] ✅ All materials optimized in ${totalDuration.toFixed(2)}ms`
    )

    return NextResponse.json(results, { headers: corsHeaders })
  } catch (error) {
    console.error('Optimization error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Optimization service error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
