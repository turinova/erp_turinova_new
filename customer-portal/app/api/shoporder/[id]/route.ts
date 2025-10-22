import { NextRequest, NextResponse } from 'next/server'
import { getShopOrderById } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = resolvedParams.id

    const orderData = await getShopOrderById(orderId)

    if (!orderData) {
      return NextResponse.json({ error: 'Shop order not found' }, { status: 404 })
    }

    return NextResponse.json(orderData)
  } catch (error) {
    console.error('Error fetching shop order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
