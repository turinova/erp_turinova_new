import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { notFound } from 'next/navigation'
import OrderDetailForm from './OrderDetailForm'

interface PageProps {
  params: Promise<{ id: string }>
}

type OrderHistoryRow = {
  id: string
  status: string
  comment: string | null
  source: string
  changed_at: string
  changed_by: string | null
  platform_status_id: string | null
  platform_status_text: string | null
}

type OrderPaymentRow = {
  id: string
  order_id: string
  amount: number
  payment_method_id: string | null
  payment_method_name: string | null
  payment_date: string
  transaction_id: string | null
  reference_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

type OrderInvoiceRow = {
  id: string
  internal_number: string
  provider_invoice_number: string | null
  invoice_type: string
  gross_total: number | null
  payment_status: string | null
  pdf_url: string | null
  connection_id: string | null
  created_at: string
  payment_due_date: string | null
  fulfillment_date: string | null
  is_storno_of_invoice_id: string | null
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

  const [
    orderItemsRes,
    orderTotalsRes,
    shippingMethodsRes,
    paymentMethodsRes,
    connectionRes,
    orderHistoryRes,
    orderPaymentsRes,
    invoicesRes,
    szamlazzCountRes
  ] = await Promise.all([
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
      : Promise.resolve({ data: null }),
    supabase
      .from('order_status_history')
      .select('id, status, comment, source, changed_at, changed_by, platform_status_id, platform_status_text')
      .eq('order_id', id)
      .order('changed_at', { ascending: false }),
    supabase
      .from('order_payments')
      .select(
        'id, order_id, amount, payment_method_id, payment_method_name, payment_date, transaction_id, reference_number, notes, created_by, created_at'
      )
      .eq('order_id', id)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select(
        'id, internal_number, provider_invoice_number, invoice_type, gross_total, payment_status, pdf_url, connection_id, created_at, payment_due_date, fulfillment_date, is_storno_of_invoice_id'
      )
      .eq('related_order_type', 'order')
      .eq('related_order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('webshop_connections')
      .select('id', { count: 'exact', head: true })
      .eq('connection_type', 'szamlazz')
      .eq('is_active', true)
      .is('deleted_at', null)
  ])

  const orderItems = orderItemsRes.data ?? []
  const orderTotals = orderTotalsRes.data ?? []
  const shippingMethods = shippingMethodsRes.data ?? []
  const paymentMethods = paymentMethodsRes.data ?? []
  const connection = connectionRes.data
  const orderHistory = (orderHistoryRes.data ?? []) as OrderHistoryRow[]
  const initialOrderPayments = (orderPaymentsRes.data ?? []) as OrderPaymentRow[]
  const initialInvoices = (invoicesRes.error ? [] : (invoicesRes.data ?? [])) as OrderInvoiceRow[]
  const hasSzamlazzConnection = (szamlazzCountRes.count ?? 0) > 0

  const changedByIds = [
    ...new Set(
      [...orderHistory.map((h) => h.changed_by), ...initialOrderPayments.map((p) => p.created_by)].filter(
        Boolean
      )
    )
  ] as string[]
  let actorNameById: Record<string, string> = {}
  if (changedByIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', changedByIds)
    actorNameById = Object.fromEntries(
      (users ?? []).map((u: any) => [u.id, (u.full_name || u.email || '').trim() || u.id])
    )
  }

  let pickBatch: { id: string; code: string } | null = null
  if (order.status === 'picking' || order.status === 'picked') {
    const { data: pboList } = await supabase
      .from('pick_batch_orders')
      .select('pick_batch_id, pick_batches(id, code, status)')
      .eq('order_id', id)
      .limit(1)
    const pbo = Array.isArray(pboList) ? pboList[0] : null
    const pbRaw = pbo?.pick_batches
    const pb = Array.isArray(pbRaw) ? pbRaw[0] : pbRaw
    if (pbo && pb && typeof pb === 'object' && 'id' in pb) {
      const p = pb as { id: string; code: string; status: string }
      pickBatch = { id: pbo.pick_batch_id, code: p.code || pbo.pick_batch_id }
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
        orderHistory={orderHistory}
        initialOrderPayments={initialOrderPayments}
        actorNameById={actorNameById}
        initialInvoices={initialInvoices}
        hasSzamlazzConnection={hasSzamlazzConnection}
      />
    </Box>
  )
}
