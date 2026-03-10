import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as ShippingIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { notFound } from 'next/navigation'
import ShipmentEditForm from './ShipmentEditForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ShipmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  // Fetch shipment with all relationships
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(`
      *,
      suppliers:supplier_id(id, name),
      warehouses:warehouse_id(id, name, code),
      currencies:currency_id(id, name, code, symbol),
      shipment_purchase_orders(
        purchase_orders:purchase_order_id(id, po_number, status, order_date, expected_delivery_date)
      ),
      warehouse_operations:warehouse_operations!shipment_id(
        id,
        operation_number,
        status,
        operation_type,
        completed_at
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !shipment) {
    notFound()
  }

  // Fetch shipment items
  const { data: shipmentItems, error: itemsError } = await supabase
    .from('shipment_items')
    .select(`
      *,
      products:product_id(id, name, sku, model_number),
      vat:vat_id(id, name, kulcs),
      currencies:currency_id(id, name, code, symbol),
      purchase_order_items:purchase_order_item_id(
        id,
        quantity,
        product_supplier_id,
        product_suppliers:product_supplier_id(id, supplier_sku)
      )
    `)
    .eq('shipment_id', id)
    .order('created_at', { ascending: true })

  if (itemsError) {
    console.error('Error fetching shipment items:', itemsError)
  }

  // Enrich shipment items with product_suppliers data from purchase_order_items
  const enrichedItems = (shipmentItems || []).map((item: any) => ({
    ...item,
    product_suppliers: item.purchase_order_items?.product_suppliers || null
  }))

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

  // Fetch products for search (for adding unexpected items)
  const { data: products } = await supabase
    .from('shoprenter_products')
    .select('id, name, sku, model_number, cost, vat_id, unit_id')
    .is('deleted_at', null)
    .limit(1000) // For search, we'll use API endpoint

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
          href="/shipments"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <ShippingIcon fontSize="small" />
          Szállítmányok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {shipment.shipment_number}
        </Typography>
      </Breadcrumbs>

      <ShipmentEditForm
        initialShipment={shipment}
        initialItems={enrichedItems}
        vatRates={(vatRates || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          rate: v.kulcs
        }))}
        units={units || []}
      />
    </Box>
  )
}
