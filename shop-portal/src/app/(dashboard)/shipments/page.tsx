import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as LocalShippingIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import ShipmentsTable from './ShipmentsTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    search?: string
    supplier_id?: string
  }>
}

export default async function ShipmentsPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '20', status: 'all', search: '', supplier_id: '' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '20', 10)
  const status = resolvedParams.status || 'all'
  const search = resolvedParams.search || ''
  const supplierId = resolvedParams.supplier_id || ''

  let shipments: any[] = []
  let totalCount = 0
  let totalPages = 0
  let suppliers: { id: string; name: string }[] = []

  try {
    const supabase = await getTenantSupabase()

    const { data: suppliersData } = await supabase.from('suppliers').select('id, name').is('deleted_at', null).order('name')
    suppliers = (suppliersData || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))

    const offset = (page - 1) * limit
    const selectColumns = `
      id,
      shipment_number,
      status,
      supplier_id,
      suppliers:supplier_id(id, name),
      warehouse_id,
      warehouses:warehouse_id(id, name, code),
      expected_arrival_date,
      actual_arrival_date,
      purchased_date,
      currency_id,
      currencies:currency_id(id, name, code),
      created_at,
      updated_at
    `
    const validSupplierUuid = supplierId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplierId)

    if (search) {
      const byNumber = await supabase.from('shipments').select('id').is('deleted_at', null).ilike('shipment_number', `%${search}%`)
      const idsByNumber = (byNumber.data || []).map((r: { id: string }) => r.id)
      const bySupplier = await supabase.from('shipments').select('id,suppliers:supplier_id(name)').is('deleted_at', null).ilike('suppliers.name', `%${search}%`)
      const idsBySupplier = (bySupplier.data || []).map((r: { id: string }) => r.id)
      const byWarehouse = await supabase.from('shipments').select('id,warehouses:warehouse_id(name)').is('deleted_at', null).ilike('warehouses.name', `%${search}%`)
      const idsByWarehouse = (byWarehouse.data || []).map((r: { id: string }) => r.id)
      const mergedIds = [...new Set([...idsByNumber, ...idsBySupplier, ...idsByWarehouse])]
      if (mergedIds.length > 0) {
        let listQuery = supabase.from('shipments').select(selectColumns, { count: 'exact' }).is('deleted_at', null).in('id', mergedIds).order('created_at', { ascending: false })
        if (status && status !== 'all') listQuery = listQuery.eq('status', status)
        if (validSupplierUuid) listQuery = listQuery.eq('supplier_id', supplierId)
        const res = await listQuery.range(offset, offset + limit - 1)
        if (!res.error && res.data) {
          shipments = res.data
          totalCount = res.count || 0
          totalPages = Math.ceil(totalCount / limit)
        }
      }
    } else {
      let query = supabase.from('shipments').select(selectColumns, { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false })
      if (status && status !== 'all') query = query.eq('status', status)
      if (validSupplierUuid) query = query.eq('supplier_id', supplierId)
      const res = await query.range(offset, offset + limit - 1)
      if (!res.error && res.data) {
        shipments = res.data
        totalCount = res.count || 0
        totalPages = Math.ceil(totalCount / limit)
      }
    }
  } catch (error) {
    console.error('Error fetching shipments:', error)
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
          <LocalShippingIcon fontSize="small" />
          Szállítmányok
        </Typography>
      </Breadcrumbs>

      <ShipmentsTable
        initialShipments={shipments}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        limit={limit}
        initialStatus={status}
        initialSearch={search}
        initialSupplierId={supplierId}
        suppliers={suppliers}
      />
    </Box>
  )
}
