import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * Check which shop_orders are eligible for Beszerzés SMS
 * Eligibility criteria:
 * 1. Shop order would become 'finished' after updating selected items to 'arrived'
 * 2. Customer has valid mobile number
 */
export async function POST(request: NextRequest) {
  try {
    const { item_ids } = await request.json()

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'No item IDs provided' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch selected items with their order information
    const { data: selectedItems, error: itemsError } = await supabase
      .from('shop_order_items')
      .select(`
        id,
        order_id,
        status,
        base_price,
        multiplier,
        quantity,
        vat:vat_id(kulcs),
        shop_orders!inner(
          id,
          order_number,
          customer_name,
          customer_mobile,
          customer_discount,
          created_at
        )
      `)
      .in('id', item_ids)
      .is('deleted_at', null)

    if (itemsError) {
      console.error('Error fetching selected items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    // Group items by order_id
    const orderGroups = new Map<string, any[]>()
    selectedItems?.forEach(item => {
      const orderId = item.order_id
      if (!orderGroups.has(orderId)) {
        orderGroups.set(orderId, [])
      }
      orderGroups.get(orderId)!.push(item)
    })

    const eligibleOrders: any[] = []

    // For each unique shop_order, check if it would become 'finished'
    for (const [orderId, itemsInOrder] of orderGroups.entries()) {
      const orderInfo = itemsInOrder[0].shop_orders

      // Skip if no mobile number
      if (!orderInfo.customer_mobile || orderInfo.customer_mobile.trim() === '') {
        continue
      }

      // Fetch ALL items for this order (to check if it would become finished)
      const { data: allOrderItems, error: allItemsError } = await supabase
        .from('shop_order_items')
        .select('id, status, base_price, multiplier, quantity, vat:vat_id(kulcs)')
        .eq('order_id', orderId)
        .is('deleted_at', null)

      if (allItemsError || !allOrderItems) {
        console.error('Error fetching all order items:', allItemsError)
        continue
      }

      // Simulate status after update: selected items become 'arrived'
      const selectedItemIds = new Set(item_ids)
      const simulatedStatuses = allOrderItems.map(item => {
        if (selectedItemIds.has(item.id)) {
          return 'arrived'
        }
        return item.status
      })

      // Check if all non-deleted items would be 'arrived' (status = 'finished')
      const nonDeletedCount = simulatedStatuses.filter(s => s !== 'deleted').length
      const arrivedCount = simulatedStatuses.filter(s => s === 'arrived').length

      const wouldBeFinished = nonDeletedCount > 0 && arrivedCount === nonDeletedCount

      if (!wouldBeFinished) {
        continue
      }

      // Calculate total price (excluding deleted items)
      let totalPrice = 0
      for (const item of allOrderItems) {
        if (item.status === 'deleted') continue

        const netPrice = item.base_price * item.multiplier
        const vatRate = item.vat?.kulcs || 0
        const grossPrice = netPrice * (1 + vatRate / 100)
        const itemTotal = grossPrice * item.quantity
        const discountAmount = itemTotal * (orderInfo.customer_discount / 100)
        const itemFinal = itemTotal - discountAmount

        totalPrice += itemFinal
      }

      // Round to integer
      totalPrice = Math.round(totalPrice)

      // Format price
      const totalPriceFormatted = new Intl.NumberFormat('hu-HU').format(totalPrice) + ' Ft'

      // Format date as YYYY-MM-DD
      const createdDate = new Date(orderInfo.created_at).toISOString().split('T')[0]

      eligibleOrders.push({
        order_id: orderId,
        order_number: orderInfo.order_number,
        customer_name: orderInfo.customer_name,
        customer_mobile: orderInfo.customer_mobile,
        total_price: totalPrice,
        total_price_formatted: totalPriceFormatted,
        created_at: createdDate
      })
    }

    return NextResponse.json({
      sms_eligible_orders: eligibleOrders
    })

  } catch (error) {
    console.error('Error checking SMS eligibility:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

