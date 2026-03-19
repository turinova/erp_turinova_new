import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  enrichPurchaseOrdersWithSupplierEmailChannel,
  type PoListRow
} from '@/lib/enrich-purchase-orders-email-channel'
import PurchaseOrdersTable from './PurchaseOrdersTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    search?: string
    supplier_id?: string
  }>
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '20', status: 'all', search: '', supplier_id: '' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '20', 10)
  const status = resolvedParams.status || 'all'
  const search = resolvedParams.search || ''
  const supplier_id = resolvedParams.supplier_id || ''

  // Fetch purchase orders
  let purchaseOrders: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit
    const validSupplierId = supplier_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplier_id) ? supplier_id : null

    if (search) {
      // Same as API: text match + product match, then list by merged ids (relation in select required for suppliers.name filter)
      let textMatchQuery = supabase
        .from('purchase_orders')
        .select('id,suppliers:supplier_id(name)')
        .is('deleted_at', null)
        .or(`po_number.ilike.%${search}%,suppliers.name.ilike.%${search}%`)
      if (status && status !== 'all') textMatchQuery = textMatchQuery.eq('status', status)
      if (validSupplierId) textMatchQuery = textMatchQuery.eq('supplier_id', validSupplierId)
      const { data: textIds } = await textMatchQuery

      let productPoIds: string[] = []
      const { data: products } = await supabase
        .from('shoprenter_products')
        .select('id')
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        .is('deleted_at', null)
        .limit(5000)
      if (products && products.length > 0) {
        const productIds = products.map((p: { id: string }) => p.id)
        const { data: poi } = await supabase
          .from('purchase_order_items')
          .select('purchase_order_id')
          .in('product_id', productIds)
          .is('deleted_at', null)
        if (poi) productPoIds = [...new Set(poi.map((r: { purchase_order_id: string }) => r.purchase_order_id))]
      }

      const mergedIds = [...new Set([...(textIds || []).map((r: { id: string }) => r.id), ...productPoIds])]
      if (mergedIds.length > 0) {
        let listQuery = supabase
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
          .in('id', mergedIds)
          .order('created_at', { ascending: false })
        if (status && status !== 'all') listQuery = listQuery.eq('status', status)
        if (validSupplierId) listQuery = listQuery.eq('supplier_id', validSupplierId)
        const { data: listData, count: listCount } = await listQuery.range(offset, offset + limit - 1)
        if (listData) {
          purchaseOrders = listData
          totalCount = listCount || 0
          totalPages = Math.ceil(totalCount / limit)
        }
      }
    } else {
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
      if (status && status !== 'all') query = query.eq('status', status)
      if (validSupplierId) query = query.eq('supplier_id', validSupplierId)
      const { data, error, count } = await query.range(offset, offset + limit - 1)
      if (!error && data) {
        purchaseOrders = data
        totalCount = count || 0
        totalPages = Math.ceil(totalCount / limit)
      }
    }
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
  }

  try {
    const supabaseEnrich = await getTenantSupabase()
    purchaseOrders = await enrichPurchaseOrdersWithSupplierEmailChannel(
      supabaseEnrich,
      purchaseOrders as PoListRow[]
    )
  } catch (e) {
    console.error('Error enriching purchase orders:', e)
  }

  // Fetch suppliers for filter dropdown
  let suppliers: Array<{ id: string; name: string }> = []
  try {
    const supabase = await getTenantSupabase()
    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (suppliersData) suppliers = suppliersData
  } catch {
    // ignore
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
        initialSupplierId={supplier_id || undefined}
        suppliers={suppliers}
      />
    </Box>
  )
}
