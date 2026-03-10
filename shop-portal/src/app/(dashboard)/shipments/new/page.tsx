import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as ShippingIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { notFound } from 'next/navigation'
import NewShipmentForm from './NewShipmentForm'

interface PageProps {
  searchParams?: Promise<{
    po_ids?: string
  }>
}

export default async function NewShipmentPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const poIdsParam = resolvedParams.po_ids || ''
  
  if (!poIdsParam) {
    notFound()
  }

  const poIds = poIdsParam.split(',').filter(Boolean)
  if (poIds.length === 0) {
    notFound()
  }

  const supabase = await getTenantSupabase()

  // Fetch purchase orders
  const { data: purchaseOrders, error } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      status,
      supplier_id,
      suppliers:supplier_id(id, name),
      warehouse_id,
      warehouses:warehouse_id(id, name, code),
      order_date,
      expected_delivery_date,
      currency_id,
      currencies:currency_id(id, name, code)
    `)
    .in('id', poIds)
    .is('deleted_at', null)

  if (error || !purchaseOrders || purchaseOrders.length === 0) {
    notFound()
  }

  // Validate all are approved and have same supplier
  const firstSupplierId = purchaseOrders[0].supplier_id
  const allApproved = purchaseOrders.every(po => po.status === 'approved')
  const sameSupplier = purchaseOrders.every(po => po.supplier_id === firstSupplierId)

  if (!allApproved || !sameSupplier) {
    notFound()
  }

  // Fetch all warehouses
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch all currencies
  const { data: currencies } = await supabase
    .from('currencies')
    .select('id, name, code, symbol')
    .is('deleted_at', null)
    .order('name', { ascending: true })

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
          Új szállítmány
        </Typography>
      </Breadcrumbs>

      <NewShipmentForm
        purchaseOrders={purchaseOrders}
        warehouses={warehouses || []}
        currencies={currencies || []}
      />
    </Box>
  )
}
