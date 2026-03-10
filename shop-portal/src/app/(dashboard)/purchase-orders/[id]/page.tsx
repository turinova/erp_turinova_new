import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PurchaseOrderEditForm from './PurchaseOrderEditForm'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  // Fetch purchase order with all relationships
  const { data: purchaseOrder, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      suppliers:supplier_id(id, name, email, phone),
      warehouses:warehouse_id(id, name, code),
      currencies:currency_id(id, name, code, symbol),
      approved_by_user:approved_by(id, email, full_name),
      purchase_order_items(
        *,
        products:product_id(id, name, sku, gtin, internal_barcode, model_number),
        product_suppliers:product_supplier_id(id, supplier_sku, supplier_barcode),
        vat:vat_id(id, name, kulcs),
        currencies:currency_id(id, name, code, symbol),
        units:unit_id(id, name, shortform)
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !purchaseOrder) {
    notFound()
  }

  // Filter out soft-deleted items
  if (purchaseOrder.purchase_order_items) {
    purchaseOrder.purchase_order_items = purchaseOrder.purchase_order_items.filter(
      (item: any) => !item.deleted_at
    )
  }

  // Fetch all suppliers for dropdown
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Fetch all active warehouses for dropdown
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch all currencies for dropdown
  const { data: currencies } = await supabase
    .from('currencies')
    .select('id, name, code, symbol')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Fetch VAT rates
  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, name, kulcs')
    .is('deleted_at', null)
    .order('kulcs', { ascending: false })

  // Fetch units
  const { data: units } = await supabase
    .from('units')
    .select('id, name, shortform')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Fetch linked shipments
  const { data: shipmentLinks } = await supabase
    .from('shipment_purchase_orders')
    .select(`
      shipments:shipment_id(id, shipment_number, status, expected_arrival_date, actual_arrival_date)
    `)
    .eq('purchase_order_id', id)

  const linkedShipments = shipmentLinks?.map((link: any) => link.shipments).filter(Boolean) || []

  // Fetch received quantities for each PO item from completed shipments
  const poItemIds = (purchaseOrder.purchase_order_items || []).map((item: any) => item.id)
  let receivedQuantitiesMap = new Map<string, number>()
  
  if (poItemIds.length > 0) {
    // Get all shipment IDs linked to this PO
    const { data: linkedShipmentIds } = await supabase
      .from('shipment_purchase_orders')
      .select('shipment_id')
      .eq('purchase_order_id', id)

    if (linkedShipmentIds && linkedShipmentIds.length > 0) {
      const shipmentIds = linkedShipmentIds.map((link: any) => link.shipment_id)

      // Get completed shipments
      const { data: completedShipments } = await supabase
        .from('shipments')
        .select('id')
        .in('id', shipmentIds)
        .eq('status', 'completed')
        .is('deleted_at', null)

      if (completedShipments && completedShipments.length > 0) {
        const completedShipmentIds = completedShipments.map((s: any) => s.id)

        // Get received quantities from completed shipments
        const { data: receivedData } = await supabase
          .from('shipment_items')
          .select('purchase_order_item_id, received_quantity, shipment_id')
          .in('purchase_order_item_id', poItemIds)
          .in('shipment_id', completedShipmentIds)

        if (receivedData) {
          receivedData.forEach((row: any) => {
            const poItemId = row.purchase_order_item_id
            const qty = Number(row.received_quantity) || 0
            receivedQuantitiesMap.set(poItemId, (receivedQuantitiesMap.get(poItemId) || 0) + qty)
          })
        }
      }
    }
  }

  // Add quantity_received to each item
  if (purchaseOrder.purchase_order_items) {
    purchaseOrder.purchase_order_items = purchaseOrder.purchase_order_items.map((item: any) => ({
      ...item,
      quantity_received: receivedQuantitiesMap.get(item.id) || 0
    }))
  }

  // Fetch supplier order channels
  const { data: orderChannels } = await supabase
    .from('supplier_order_channels')
    .select('id, channel_type, name, url_template, description')
    .eq('supplier_id', purchaseOrder.supplier_id)
    .is('deleted_at', null)

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          component={NextLink}
          href="/purchase-orders"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <ShoppingCartIcon fontSize="small" />
          Beszerzési rendelések
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {purchaseOrder.po_number}
        </Typography>
      </Breadcrumbs>

      <PurchaseOrderEditForm
        initialPurchaseOrder={purchaseOrder}
        suppliers={suppliers || []}
        warehouses={warehouses || []}
        currencies={currencies || []}
        vatRates={(vatRates || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          rate: v.kulcs
        }))}
        units={units || []}
        linkedShipments={linkedShipments}
        orderChannels={orderChannels || []}
      />
    </Box>
  )
}
