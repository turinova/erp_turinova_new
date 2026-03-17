import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/replenishment/add-to-po
 * Add selected várólista lines (order_item_ids) to an existing draft/pending_approval PO and link them.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { purchase_order_id, items = [] } = body

    if (!purchase_order_id) {
      return NextResponse.json(
        { error: 'purchase_order_id kötelező' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy tétel kötelező' },
        { status: 400 }
      )
    }

    const orderItemIds = items
      .filter((it: any) => it.order_item_id)
      .map((it: any) => it.order_item_id)
    if (orderItemIds.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy order_item_id kötelező' },
        { status: 400 }
      )
    }

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status, supplier_id')
      .eq('id', purchase_order_id)
      .is('deleted_at', null)
      .single()

    if (poError || !po) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Csak piszkozat vagy jóváhagyásra váró rendeléshez adhat hozzá tételeket' },
        { status: 400 }
      )
    }

    const supplierId = po.supplier_id

    const { data: orderItems, error: oiError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity')
      .in('id', orderItemIds)
      .is('deleted_at', null)
      .is('purchase_order_id', null)

    if (oiError || !orderItems?.length) {
      return NextResponse.json(
        { error: 'A kiválasztott tételek nem találhatók vagy már hozzá lettek rendelve.' },
        { status: 400 }
      )
    }

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

    const { data: psList, error: psError } = await supabase
      .from('product_suppliers')
      .select('id, product_id, default_cost')
      .eq('supplier_id', supplierId)
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

    const { data: products } = await supabase
      .from('shoprenter_products')
      .select('id, vat_id, unit_id, cost')
      .in('id', productIds)
      .is('deleted_at', null)
    const productMap = new Map((products || []).map((p: any) => [p.id, p]))

    const { data: supplierRow } = await supabase
      .from('suppliers')
      .select('default_vat_id')
      .eq('id', supplierId)
      .is('deleted_at', null)
      .single()

    const { data: vatRows } = await supabase.from('vat').select('id').is('deleted_at', null).limit(1)
    const defaultVatId = (vatRows && vatRows[0]?.id) || null
    const { data: unitRows } = await supabase
      .from('units')
      .select('id')
      .eq('shortform', 'db')
      .is('deleted_at', null)
      .limit(1)
    const defaultUnitId = (unitRows && unitRows[0]?.id) || null

    const addedItems: any[] = []
    const affectedOrderIds = new Set<string>()

    for (const pid of productIds) {
      const rec = byProduct.get(pid)!
      const ps = psByProduct.get(pid)!
      const prod = productMap.get(pid) as { vat_id?: string; unit_id?: string; cost?: number } | undefined
      const vatId = prod?.vat_id || supplierRow?.default_vat_id || defaultVatId
      const unitId = prod?.unit_id || defaultUnitId
      const unitCost = Number(ps.default_cost) || Number(prod?.cost) || 0

      if (!vatId || !unitId) continue

      const { data: newItem, error: insertErr } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: purchase_order_id,
          product_id: pid,
          product_supplier_id: ps.id,
          quantity: rec.quantity,
          unit_cost: unitCost,
          vat_id: vatId,
          currency_id: null,
          unit_id: unitId
        })
        .select('id, product_id')
        .single()

      if (insertErr) {
        console.error('Add PO item error:', insertErr)
        continue
      }

      addedItems.push(newItem)

      for (const oiId of rec.orderItemIds) {
        const oi = orderItems.find((x: any) => x.id === oiId)
        if (oi) affectedOrderIds.add(oi.order_id)
        await supabase
          .from('order_items')
          .update({
            purchase_order_id: purchase_order_id,
            purchase_order_item_id: (newItem as any).id,
            updated_at: new Date().toISOString()
          })
          .eq('id', oiId)
      }
    }

    // Recalculate PO totals
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select('quantity, unit_cost, vat_id')
      .eq('purchase_order_id', purchase_order_id)
      .is('deleted_at', null)
    const { data: vatRates } = await supabase.from('vat').select('id, kulcs').is('deleted_at', null)
    const vatMap = new Map((vatRates?.data || []).map((v: any) => [v.id, v.kulcs || 0]))
    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    let totalQuantity = 0
    for (const it of poItems || []) {
      const lineNet = Math.round(Number(it.unit_cost) * Number(it.quantity))
      const lineVat = Math.round(lineNet * (vatMap.get(it.vat_id) || 0) / 100)
      totalNet += lineNet
      totalVat += lineVat
      totalGross += lineNet + lineVat
      totalQuantity += Number(it.quantity)
    }
    await supabase
      .from('purchase_orders')
      .update({
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross,
        total_quantity: totalQuantity,
        item_count: (poItems || []).length
      })
      .eq('id', purchase_order_id)

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
      .eq('id', purchase_order_id)
      .single()

    return NextResponse.json({
      purchase_order: fullPo || po,
      added_items: addedItems
    })
  } catch (error) {
    console.error('Replenishment add-to-po error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
