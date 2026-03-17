import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/replenishment/create-po
 * Create a new purchase order from selected várólista lines (order_item_ids) and link them.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      items = [],
      supplier_id,
      warehouse_id,
      currency_id,
      expected_delivery_date,
      note
    } = body

    if (!supplier_id || !warehouse_id) {
      return NextResponse.json(
        { error: 'Beszállító és raktár kötelező' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy tétel kötelező' },
        { status: 400 }
      )
    }

    // Resolve to order_item_ids
    const orderItemIds: string[] = []
    for (const it of items) {
      if (it.order_item_id) {
        orderItemIds.push(it.order_item_id)
      }
    }
    if (orderItemIds.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy order_item_id kötelező' },
        { status: 400 }
      )
    }

    // Load order_items (must be not deleted, not already on PO)
    const { data: orderItems, error: oiError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity')
      .in('id', orderItemIds)
      .is('deleted_at', null)
      .is('purchase_order_id', null)

    if (oiError || !orderItems?.length) {
      return NextResponse.json(
        { error: 'A kiválasztott tételek nem találhatók vagy már hozzá lettek rendelve egy beszerzéshez.' },
        { status: 400 }
      )
    }

    // Aggregate by product_id (sum quantity, collect order_item ids)
    const byProduct = new Map<string, { quantity: number; orderItemIds: string[] }>()
    for (const oi of orderItems as { id: string; product_id: string | null; quantity: number }[]) {
      if (!oi.product_id) continue
      const key = oi.product_id
      if (!byProduct.has(key)) byProduct.set(key, { quantity: 0, orderItemIds: [] })
      const rec = byProduct.get(key)!
      rec.quantity += parseInt(String(oi.quantity), 10) || 0
      rec.orderItemIds.push(oi.id)
    }

    const productIds = [...byProduct.keys()]
    if (productIds.length === 0) {
      return NextResponse.json(
        { error: 'Nincs érvényes termék a kiválasztott tételek között.' },
        { status: 400 }
      )
    }

    // Ensure all products have this supplier
    const { data: psList, error: psError } = await supabase
      .from('product_suppliers')
      .select('id, product_id, default_cost')
      .eq('supplier_id', supplier_id)
      .in('product_id', productIds)
      .is('deleted_at', null)
      .eq('is_active', true)

    if (psError) {
      console.error('product_suppliers error:', psError)
      return NextResponse.json({ error: psError.message }, { status: 500 })
    }

    const psByProduct = new Map((psList || []).map((p: any) => [p.product_id, p]))
    const missingSupplier = productIds.filter((pid) => !psByProduct.has(pid))
    if (missingSupplier.length > 0) {
      return NextResponse.json(
        {
          error: 'Egy vagy több termék nincs kapcsolva ehhez a beszállítóhoz.',
          product_ids: missingSupplier
        },
        { status: 400 }
      )
    }

    // Products + VAT/unit fallbacks
    const { data: products } = await supabase
      .from('shoprenter_products')
      .select('id, vat_id, unit_id, cost')
      .in('id', productIds)
      .is('deleted_at', null)

    const productMap = new Map((products || []).map((p: any) => [p.id, p]))

    const { data: supplierRow } = await supabase
      .from('suppliers')
      .select('default_vat_id')
      .eq('id', supplier_id)
      .is('deleted_at', null)
      .single()

    const { data: vatRows } = await supabase
      .from('vat')
      .select('id')
      .is('deleted_at', null)
      .limit(1)
    const defaultVatId = (vatRows && vatRows[0]?.id) || null

    const { data: unitRows } = await supabase
      .from('units')
      .select('id')
      .eq('shortform', 'db')
      .is('deleted_at', null)
      .limit(1)
    const defaultUnitId = (unitRows && unitRows[0]?.id) || null

    const missingVat = productIds.filter((pid) => {
      const p = productMap.get(pid)
      return !p?.vat_id && !supplierRow?.default_vat_id && !defaultVatId
    })
    const missingUnit = productIds.filter((pid) => {
      const p = productMap.get(pid)
      return !p?.unit_id && !defaultUnitId
    })
    if (missingVat.length > 0 || missingUnit.length > 0) {
      return NextResponse.json(
        {
          error: 'ÁFA vagy mértékegység hiányzik egy vagy több termékhez. Kérjük állítsa be a terméknél vagy a beszállítónál.',
          missing_vat_product_ids: missingVat,
          missing_unit_product_ids: missingUnit
        },
        { status: 400 }
      )
    }

    const poItems: { product_id: string; product_supplier_id: string; quantity: number; unit_cost: number; vat_id: string; unit_id: string }[] = []
    for (const pid of productIds) {
      const rec = byProduct.get(pid)!
      const ps = psByProduct.get(pid)!
      const prod = productMap.get(pid) as { vat_id?: string; unit_id?: string; cost?: number } | undefined
      const vatId = prod?.vat_id || supplierRow?.default_vat_id || defaultVatId
      const unitId = prod?.unit_id || defaultUnitId
      const unitCost = Number(ps.default_cost) || Number(prod?.cost) || 0
      poItems.push({
        product_id: pid,
        product_supplier_id: ps.id,
        quantity: rec.quantity,
        unit_cost: unitCost,
        vat_id: vatId,
        unit_id: unitId
      })
    }

    const vatRates = await supabase.from('vat').select('id, kulcs').is('deleted_at', null)
    const vatMap = new Map((vatRates.data || []).map((v: any) => [v.id, v.kulcs || 0]))

    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    let totalQuantity = 0
    for (const it of poItems) {
      const lineNet = Math.round(it.unit_cost * it.quantity)
      const vatPct = vatMap.get(it.vat_id) || 0
      const lineVat = Math.round(lineNet * vatPct / 100)
      totalNet += lineNet
      totalVat += lineVat
      totalGross += lineNet + lineVat
      totalQuantity += it.quantity
    }

    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id,
        warehouse_id,
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: expected_delivery_date || null,
        currency_id: currency_id || null,
        note: note?.trim() || null,
        status: 'draft',
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross,
        total_weight: 0,
        item_count: poItems.length,
        total_quantity: totalQuantity
      })
      .select()
      .single()

    if (poError) {
      console.error('Create PO error:', poError)
      return NextResponse.json(
        { error: poError.message || 'Hiba a beszerzési rendelés létrehozásakor' },
        { status: 500 }
      )
    }

    const insertPayload = poItems.map((it) => ({
      purchase_order_id: purchaseOrder.id,
      product_id: it.product_id,
      product_supplier_id: it.product_supplier_id,
      quantity: it.quantity,
      unit_cost: it.unit_cost,
      vat_id: it.vat_id,
      currency_id: currency_id || null,
      unit_id: it.unit_id
    }))

    const { data: createdPoItems, error: itemsErr } = await supabase
      .from('purchase_order_items')
      .insert(insertPayload)
      .select('id, product_id')

    if (itemsErr || !createdPoItems?.length) {
      await supabase.from('purchase_orders').delete().eq('id', purchaseOrder.id)
      return NextResponse.json(
        { error: itemsErr?.message || 'Hiba a tételsorok létrehozásakor' },
        { status: 500 }
      )
    }

    const poItemByProduct = new Map((createdPoItems as { id: string; product_id: string }[]).map((i) => [i.product_id, i.id]))

    const affectedOrderIds = new Set<string>()
    for (const oi of orderItems as { id: string; order_id: string; product_id: string | null }[]) {
      if (!oi.product_id) continue
      const poItemId = poItemByProduct.get(oi.product_id)
      if (!poItemId) continue
      affectedOrderIds.add(oi.order_id)
      await supabase
        .from('order_items')
        .update({
          purchase_order_id: purchaseOrder.id,
          purchase_order_item_id: poItemId,
          updated_at: new Date().toISOString()
        })
        .eq('id', oi.id)
    }

    for (const orderId of affectedOrderIds) {
      await supabase
        .from('orders')
        .update({ fulfillability_status: 'po_created', updated_at: new Date().toISOString() })
        .eq('id', orderId)
    }

    const { data: fullPo } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers:supplier_id(id, name),
        warehouses:warehouse_id(id, name),
        purchase_order_items(*)
      `)
      .eq('id', purchaseOrder.id)
      .single()

    return NextResponse.json(
      { purchase_order: fullPo || purchaseOrder },
      { status: 201 }
    )
  } catch (error) {
    console.error('Replenishment create-po error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
