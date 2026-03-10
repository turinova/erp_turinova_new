import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PurchaseOrdersTable from './PurchaseOrdersTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    search?: string
  }>
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps = {}) {
  // Get initial page data from URL params
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '20', status: 'all', search: '' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '20', 10)
  const status = resolvedParams.status || 'all'
  const search = resolvedParams.search || ''

  // Fetch purchase orders
  let purchaseOrders: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        status,
        supplier_id,
        suppliers:supplier_id(id, name),
        warehouse_id,
        warehouses:warehouse_id(id, name),
        order_date,
        expected_delivery_date,
        total_net,
        total_vat,
        total_gross,
        item_count,
        email_sent,
        email_sent_at,
        created_at,
        updated_at
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply search filter
    if (search) {
      query = query.or(`po_number.ilike.%${search}%,suppliers.name.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (!error && data) {
      purchaseOrders = data
      totalCount = count || 0
      totalPages = Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
  }

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
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Beszerzési rendelések
        </Typography>
      </Breadcrumbs>

      <PurchaseOrdersTable
        initialPurchaseOrders={purchaseOrders}
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
