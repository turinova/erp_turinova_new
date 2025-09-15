import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all currencies (optimized)...')
    
    const startTime = performance.now()
    
    const { data: currencies, error } = await supabase
      .from('currencies')
      .select('id, name, rate, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Currencies query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching currencies:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    console.log(`Fetched ${currencies?.length || 0} currencies successfully`)
    return NextResponse.json(currencies || [])

  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, rate } = body

    if (!name || rate === undefined) {
      return NextResponse.json({ error: 'Name and rate are required' }, { status: 400 })
    }

    console.log('Creating new currency (optimized)...')

    const newCurrency = await PerformanceMonitor.measureQuery(
      'currencies-create',
      () => optimizedQuery.create('currencies', {
        name,
        rate: parseFloat(rate),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    )

    console.log('Currency created successfully:', newCurrency)
    return NextResponse.json(newCurrency, { status: 201 })

  } catch (error) {
    console.error('Error creating currency:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
