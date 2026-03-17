import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { notFound } from 'next/navigation'
import OrderDetailForm from './OrderDetailForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (orderError || !order) {
    notFound()
  }

  const [orderItemsRes, orderTotalsRes, shippingMethodsRes, paymentMethodsRes, connectionRes] = await Promise.all([
    supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('order_totals')
      .select('*')
      .eq('order_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('shipping_methods')
      .select('id, name, code')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('payment_methods')
      .select('id, name, code')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    order.connection_id
      ? supabase
          .from('webshop_connections')
          .select('id, name, platform_type')
          .eq('id', order.connection_id)
          .single()
      : Promise.resolve({ data: null })
  ])

  const orderItems = orderItemsRes.data ?? []
  const orderTotals = orderTotalsRes.data ?? []
  const shippingMethods = shippingMethodsRes.data ?? []
  const paymentMethods = paymentMethodsRes.data ?? []
  const connection = connectionRes.data

  let pickBatch: { id: string; code: string } | null = null
  if (order.status === 'picking' || order.status === 'picked') {
    const { data: pboList } = await supabase
      .from('pick_batch_orders')
      .select('pick_batch_id, pick_batches(id, code, status)')
      .eq('order_id', id)
      .limit(1)
    const pbo = Array.isArray(pboList) ? pboList[0] : null
    if (pbo?.pick_batches?.id) {
      const pb = pbo.pick_batches as { id: string; code: string; status: string }
      pickBatch = { id: pbo.pick_batch_id, code: pb?.code || pbo.pick_batch_id }
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link component={NextLink} href="/orders" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Rendelések
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {order.order_number}
        </Typography>
      </Breadcrumbs>

      <OrderDetailForm
        order={order}
        orderItems={orderItems}
        orderTotals={orderTotals}
        shippingMethods={shippingMethods}
        paymentMethods={paymentMethods}
        connectionName={connection?.name ?? null}
        connectionPlatform={connection?.platform_type ?? null}
        pickBatch={pickBatch}
      />
    </Box>
  )
}
