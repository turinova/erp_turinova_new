import { NextRequest, NextResponse } from 'next/server'
import { optimizedQuery, PerformanceMonitor } from '@/lib/supabase-optimized'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all currencies (optimized)...')

    const currencies = await PerformanceMonitor.measureQuery(
      'currencies-get-all',
      () => optimizedQuery.getAllActive(
        'currencies',
        'id, name, rate, created_at, updated_at, deleted_at',
        'name',
        'asc'
      )
    )

    console.log(`Fetched ${currencies.length} currencies successfully`)
    return NextResponse.json(currencies)

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
