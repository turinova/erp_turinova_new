import type { SupabaseClient } from '@supabase/supabase-js'

/** Közös készlet-panel adat (termék / táblás / szálas detail). */
export type ProcurementWarehouseStock = {
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  on_hand: number
}

export type ProcurementStockMovementRow = {
  id: string
  created_at: string
  movement_type: 'in' | 'out'
  quantity: number
  warehouse_name: string
  warehouse_code: string
  source_type: string
  receipt_id: string | null
  receipt_number: string | null
  po_id: string | null
  po_number: string | null
  transfer_id: string | null
  transfer_number: string | null
  cso_id: string | null
  cso_order_number: string | null
  sale_id: string | null
  sale_number: string | null
}

export type ProcurementRelatedPoRow = {
  id: string
  po_number: string
  status: string
  supplier_name: string
  ordered_qty: number
  received_qty: number
  remaining_qty: number
}

export type ProcurementStockPanel = {
  total_on_hand: number
  by_warehouse: ProcurementWarehouseStock[]
  on_order_qty: number
  open_po_count: number
  movements: ProcurementStockMovementRow[]
  related_orders: ProcurementRelatedPoRow[]
}

type MaterialKind = 'sheet' | 'linear'

function emptyPanel(): ProcurementStockPanel {
  return {
    total_on_hand: 0,
    by_warehouse: [],
    on_order_qty: 0,
    open_po_count: 0,
    movements: [],
    related_orders: []
  }
}

async function getMaterialProcurementStock(
  supabase: SupabaseClient,
  tenantId: string,
  kind: MaterialKind,
  materialId: string
): Promise<ProcurementStockPanel> {
  const empty = emptyPanel()
  const movementsTable =
    kind === 'sheet' ? 'sheet_stock_movements' : 'linear_stock_movements'
  const materialCol =
    kind === 'sheet' ? 'sheet_material_id' : 'linear_material_id'
  const poItemCol =
    kind === 'sheet' ? 'sheet_material_id' : 'linear_material_id'

  const [
    { data: balanceRows, error: balanceErr },
    { data: recentMoves, error: recentErr }
  ] = await Promise.all([
    supabase
      .from(movementsTable)
      .select(
        `
          quantity,
          movement_type,
          warehouse_id,
          warehouses ( name, code )
        `
      )
      .eq('tenant_id', tenantId)
      .eq(materialCol, materialId),
    supabase
      .from(movementsTable)
      .select(
        `
          id,
          created_at,
          movement_type,
          quantity,
          source_type,
          source_id,
          warehouse_id,
          warehouses ( name, code )
        `
      )
      .eq('tenant_id', tenantId)
      .eq(materialCol, materialId)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  if (balanceErr) {
    console.error('getMaterialProcurementStock balance', balanceErr.message)
    throw new Error('Nem sikerült lekérdezni a készletet.')
  }
  if (recentErr) {
    console.error('getMaterialProcurementStock recent', recentErr.message)
    throw new Error('Nem sikerült lekérdezni a készletmozgásokat.')
  }

  const byWh = new Map<string, { name: string; code: string; onHand: number }>()
  let total = 0

  for (const row of balanceRows ?? []) {
    const qty = Number(row.quantity)
    const delta =
      row.movement_type === 'in'
        ? qty
        : row.movement_type === 'out'
          ? -qty
          : 0
    total += delta

    const whJoin = row.warehouses as
      | { name: string; code: string }
      | { name: string; code: string }[]
      | null
    const wh = Array.isArray(whJoin) ? whJoin[0] : whJoin
    const whId = row.warehouse_id as string
    const prev = byWh.get(whId) ?? {
      name: wh?.name ?? '—',
      code: wh?.code ?? '',
      onHand: 0
    }
    prev.onHand += delta
    byWh.set(whId, prev)
  }

  const by_warehouse: ProcurementWarehouseStock[] = [...byWh.entries()]
    .map(([warehouse_id, v]) => ({
      warehouse_id,
      warehouse_name: v.name,
      warehouse_code: v.code,
      on_hand: v.onHand
    }))
    .filter((r) => Math.abs(r.on_hand) > 0.0001)
    .sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name, 'hu'))

  const recent = recentMoves ?? []
  const receiptIds = [
    ...new Set(
      recent
        .filter((m) => m.source_type === 'purchase_receipt' && m.source_id)
        .map((m) => m.source_id as string)
    )
  ]
  const saleIds = [
    ...new Set(
      recent
        .filter((m) => m.source_type === 'sale' && m.source_id)
        .map((m) => m.source_id as string)
    )
  ]

  const receiptMeta = new Map<
    string,
    {
      receipt_number: string
      po_id: string | null
      po_number: string | null
    }
  >()
  const saleMeta = new Map<string, string>()

  if (receiptIds.length > 0) {
    const { data: receipts, error: recErr } = await supabase
      .from('goods_receipts')
      .select(
        `
        id,
        receipt_number,
        purchase_order_id,
        purchase_orders ( po_number )
      `
      )
      .eq('tenant_id', tenantId)
      .in('id', receiptIds)

    if (recErr) {
      console.error('getMaterialProcurementStock receipts', recErr.message)
    } else {
      for (const r of receipts ?? []) {
        const pos = r.purchase_orders as
          | { po_number: string }
          | { po_number: string }[]
          | null
        const po = Array.isArray(pos) ? pos[0] : pos
        receiptMeta.set(r.id, {
          receipt_number: r.receipt_number,
          po_id: (r.purchase_order_id as string) ?? null,
          po_number: po?.po_number ?? null
        })
      }
    }
  }

  if (saleIds.length > 0) {
    const { data: sales, error: saleErr } = await supabase
      .from('sales_orders')
      .select('id, sale_number')
      .eq('tenant_id', tenantId)
      .in('id', saleIds)
    if (saleErr) {
      console.error('getMaterialProcurementStock sales', saleErr.message)
    } else {
      for (const s of sales ?? []) {
        saleMeta.set(s.id, s.sale_number)
      }
    }
  }

  const movements: ProcurementStockMovementRow[] = recent.map((row) => {
    const whJoin = row.warehouses as
      | { name: string; code: string }
      | { name: string; code: string }[]
      | null
    const wh = Array.isArray(whJoin) ? whJoin[0] : whJoin
    const meta =
      row.source_type === 'purchase_receipt' && row.source_id
        ? receiptMeta.get(row.source_id as string)
        : undefined
    const saleNumber =
      row.source_type === 'sale' && row.source_id
        ? saleMeta.get(row.source_id as string)
        : undefined

    return {
      id: row.id,
      created_at: row.created_at,
      movement_type: row.movement_type as 'in' | 'out',
      quantity: Math.abs(Number(row.quantity)),
      warehouse_name: wh?.name ?? '—',
      warehouse_code: wh?.code ?? '',
      source_type: row.source_type,
      receipt_id: meta ? (row.source_id as string) : null,
      receipt_number: meta?.receipt_number ?? null,
      po_id: meta?.po_id ?? null,
      po_number: meta?.po_number ?? null,
      transfer_id: null,
      transfer_number: null,
      cso_id: null,
      cso_order_number: null,
      sale_id: saleNumber ? (row.source_id as string) : null,
      sale_number: saleNumber ?? null
    }
  })

  const { data: poItems, error: poErr } = await supabase
    .from('purchase_order_items')
    .select(
      `
      id,
      quantity,
      purchase_order_id,
      purchase_orders!inner (
        id,
        po_number,
        status,
        deleted_at,
        suppliers ( name )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq(poItemCol, materialId)
    .is('deleted_at', null)
    .limit(80)

  if (poErr) {
    console.error('getMaterialProcurementStock poItems', poErr.message)
    return {
      ...empty,
      total_on_hand: total,
      by_warehouse,
      movements
    }
  }

  type PoBag = {
    id: string
    po_number: string
    status: string
    deleted_at: string | null
    suppliers: { name: string } | { name: string }[] | null
  }

  const openStatuses = new Set(['ordered', 'partial'])
  const itemIds: string[] = []
  const poAgg = new Map<
    string,
    {
      po_number: string
      status: string
      supplier_name: string
      ordered_qty: number
      itemIds: string[]
    }
  >()

  for (const row of poItems ?? []) {
    const pos = row.purchase_orders as PoBag | PoBag[] | null
    const po = Array.isArray(pos) ? pos[0] : pos
    if (!po || po.deleted_at) continue
    if (!openStatuses.has(po.status) && po.status !== 'received') continue

    const suppliers = po.suppliers
    const supplier = Array.isArray(suppliers) ? suppliers[0] : suppliers
    const existing = poAgg.get(po.id) ?? {
      po_number: po.po_number,
      status: po.status,
      supplier_name: supplier?.name ?? '—',
      ordered_qty: 0,
      itemIds: []
    }
    existing.ordered_qty += Number(row.quantity)
    existing.itemIds.push(row.id)
    poAgg.set(po.id, existing)
    itemIds.push(row.id)
  }

  const receivedByItem = new Map<string, number>()
  if (itemIds.length > 0) {
    const { data: gri, error: griErr } = await supabase
      .from('goods_receipt_items')
      .select(
        `
        purchase_order_item_id,
        quantity_received,
        goods_receipts!inner ( status, deleted_at )
      `
      )
      .eq('tenant_id', tenantId)
      .in('purchase_order_item_id', itemIds)
      .is('deleted_at', null)

    if (griErr) {
      console.error('getMaterialProcurementStock gri', griErr.message)
    } else {
      for (const row of gri ?? []) {
        const gr = row.goods_receipts as
          | { status: string; deleted_at: string | null }
          | { status: string; deleted_at: string | null }[]
          | null
        const receipt = Array.isArray(gr) ? gr[0] : gr
        if (!receipt || receipt.deleted_at || receipt.status !== 'received') {
          continue
        }
        const key = row.purchase_order_item_id as string
        if (!key) continue
        receivedByItem.set(
          key,
          (receivedByItem.get(key) ?? 0) + Number(row.quantity_received)
        )
      }
    }
  }

  let on_order_qty = 0
  const related_orders: ProcurementRelatedPoRow[] = []

  for (const [poId, agg] of poAgg) {
    let received = 0
    for (const itemId of agg.itemIds) {
      received += receivedByItem.get(itemId) ?? 0
    }
    const remaining = Math.max(0, agg.ordered_qty - received)
    if (openStatuses.has(agg.status)) {
      on_order_qty += remaining
    }
    related_orders.push({
      id: poId,
      po_number: agg.po_number,
      status: agg.status,
      supplier_name: agg.supplier_name,
      ordered_qty: agg.ordered_qty,
      received_qty: received,
      remaining_qty: remaining
    })
  }

  related_orders.sort((a, b) => {
    const aOpen = openStatuses.has(a.status) ? 0 : 1
    const bOpen = openStatuses.has(b.status) ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    return b.po_number.localeCompare(a.po_number, 'hu')
  })

  const open_po_count = related_orders.filter((r) =>
    openStatuses.has(r.status)
  ).length

  return {
    total_on_hand: total,
    by_warehouse,
    on_order_qty,
    open_po_count,
    movements,
    related_orders: related_orders.slice(0, 5)
  }
}

export async function getSheetProcurementStock(
  supabase: SupabaseClient,
  tenantId: string,
  sheetMaterialId: string
): Promise<ProcurementStockPanel> {
  return getMaterialProcurementStock(
    supabase,
    tenantId,
    'sheet',
    sheetMaterialId
  )
}

export async function getLinearProcurementStock(
  supabase: SupabaseClient,
  tenantId: string,
  linearMaterialId: string
): Promise<ProcurementStockPanel> {
  return getMaterialProcurementStock(
    supabase,
    tenantId,
    'linear',
    linearMaterialId
  )
}
