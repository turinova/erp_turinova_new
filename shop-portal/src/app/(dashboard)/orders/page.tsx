import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import OrdersPageClient from './OrdersPageClient'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    search?: string
  }>
}

export default async function OrdersPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = Math.min(parseInt(resolvedParams.limit || '20', 10), 100)
  const status = resolvedParams.status || 'all'
  const search = resolvedParams.search || ''

  let orders: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit

    let query = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        platform_order_id,
        connection_id,
        customer_firstname,
        customer_lastname,
        customer_email,
        total_gross,
        currency_code,
        status,
        fulfillability_status,
        payment_status,
        shipping_method_name,
        payment_method_name,
        order_date,
        created_at
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('order_date', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(
        `order_number.ilike.${term},customer_firstname.ilike.${term},customer_lastname.ilike.${term},customer_email.ilike.${term}`
      )
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (!error && data) {
      orders = data
      totalCount = count || 0
      totalPages = Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error('Error fetching orders:', error)
  }

  let batchByOrderId: Record<string, { id: string; code: string }> = {}
  try {
    const pickingIds = (orders as any[])
      .filter((o: any) => o.status === 'picking' || o.status === 'picked')
      .map((o: any) => o.id)
    if (pickingIds.length > 0) {
      const supabase = await getTenantSupabase()
      const { data: pbo } = await supabase
        .from('pick_batch_orders')
        .select('order_id, pick_batch_id, pick_batches(id, code, status)')
        .in('order_id', pickingIds)
      const active = (pbo || []).filter(
        (r: any) => r.pick_batches && (r.pick_batches.status === 'in_progress' || r.pick_batches.status === 'completed')
      )
      active.forEach((r: any) => {
        batchByOrderId[r.order_id] = { id: r.pick_batch_id, code: r.pick_batches?.code || r.pick_batch_id }
      })
    }
  } catch (e) {
    console.error('Error fetching batch info for orders:', e)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Rendelések
        </Typography>
      </Breadcrumbs>

      <OrdersPageClient
        orders={orders}
        batchByOrderId={batchByOrderId}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        limit={limit}
        initialStatus={status}
        initialSearch={search}
      />
    </Box>
  )
}
