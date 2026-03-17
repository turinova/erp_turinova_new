import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PickBatchDetail from './PickBatchDetail'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PickBatchDetailPage({ params }: PageProps) {
  const { id } = await params

  try {
    const supabase = await getTenantSupabase()

    const { data: batch, error: batchError } = await supabase
      .from('pick_batches')
      .select(`
        id,
        code,
        name,
        status,
        created_by,
        created_by_user:created_by(id, email, full_name),
        started_at,
        completed_at,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single()

    if (batchError || !batch) notFound()

    const { data: batchOrders } = await supabase
      .from('pick_batch_orders')
      .select('order_id')
      .eq('pick_batch_id', id)
      .order('created_at', { ascending: true })

    const orderIds = (batchOrders || []).map((r: any) => r.order_id)
    let orders: any[] = []
    let order_items_by_order: Record<string, any[]> = {}

    if (orderIds.length > 0) {
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_firstname,
          customer_lastname,
          customer_email,
          status,
          shipping_method_name,
          order_date,
          total_gross,
          currency_code
        `)
        .in('id', orderIds)
        .is('deleted_at', null)

      const orderMap = new Map((ordersData || []).map((o: any) => [o.id, o]))
      orders = orderIds.map((oid: string) => orderMap.get(oid)).filter(Boolean)

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, order_id, product_name, product_sku, quantity, product_gtin')
        .in('order_id', orderIds)
        .is('deleted_at', null)
        .order('order_id', { ascending: true })
        .order('product_sku', { ascending: true })

      for (const oid of orderIds) {
        order_items_by_order[oid] = (orderItems || []).filter((i: any) => i.order_id === oid)
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
            Rendelések
          </Link>
          <Link component={NextLink} href="/pick-batches" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Begyűjtések
          </Link>
          <Typography color="text.primary">{batch.code}</Typography>
        </Breadcrumbs>

        <PickBatchDetail
          initialBatch={batch}
          initialOrders={orders}
          initialOrderItemsByOrder={order_items_by_order}
        />
      </Box>
    )
  } catch {
    notFound()
  }
}
