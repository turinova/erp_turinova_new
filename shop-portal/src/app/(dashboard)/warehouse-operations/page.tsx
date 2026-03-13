import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import WarehouseOperationsTable from './WarehouseOperationsTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    operation_type?: string
    warehouse_id?: string
    search?: string
  }>
}

export default async function WarehouseOperationsPage({ searchParams }: PageProps = {}) {
  // Get initial page data from URL params
  const resolvedParams = searchParams ? await searchParams : { 
    page: '1', 
    limit: '20', 
    status: 'all', 
    operation_type: 'all',
    warehouse_id: '',
    search: ''
  }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '20', 10)
  const status = resolvedParams.status || 'all'
  const operation_type = resolvedParams.operation_type || 'all'
  const warehouse_id = resolvedParams.warehouse_id || ''
  const search = resolvedParams.search || ''

  // Fetch warehouse operations
  let warehouseOperations: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit

    // Build query directly with Supabase
    let query = supabase
      .from('warehouse_operations')
      .select(`
        id,
        operation_number,
        operation_type,
        status,
        shipment_id,
        shipments:shipment_id(id, shipment_number),
        warehouse_id,
        warehouses:warehouse_id(id, name, code),
        started_at,
        completed_at,
        created_by,
        created_by_user:created_by(id, email, full_name),
        completed_by,
        completed_by_user:completed_by(id, email, full_name),
        note,
        created_at,
        updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (operation_type && operation_type !== 'all') {
      query = query.eq('operation_type', operation_type)
    }
    if (search) {
      query = query.ilike('operation_number', `%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (!error && data) {
      // Get stock movements count for each warehouse operation
      const operationsWithCounts = await Promise.all(
        data.map(async (op: any) => {
          const { count: movementsCount } = await supabase
            .from('stock_movements')
            .select('*', { count: 'exact', head: true })
            .eq('warehouse_operation_id', op.id)

          return {
            ...op,
            movements_count: movementsCount || 0
          }
        })
      )

      warehouseOperations = operationsWithCounts
      totalCount = count || 0
      totalPages = Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error('Error fetching warehouse operations:', error)
  }

  // Fetch warehouses for filter
  let warehouses: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data: warehousesData } = await supabase
      .from('warehouses')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')

    warehouses = warehousesData || []
  } catch (error) {
    console.error('Error fetching warehouses:', error)
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
          <InventoryIcon fontSize="small" />
          Raktári műveletek
        </Typography>
      </Breadcrumbs>

      <WarehouseOperationsTable
        initialWarehouseOperations={warehouseOperations}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        limit={limit}
        initialStatus={status}
        initialOperationType={operation_type}
        initialWarehouseId={warehouse_id}
        initialSearch={search}
        warehouses={warehouses}
      />
    </Box>
  )
}
