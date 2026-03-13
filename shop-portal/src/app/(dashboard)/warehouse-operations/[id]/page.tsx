import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import WarehouseOperationDetailForm from './WarehouseOperationDetailForm'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WarehouseOperationDetailPage({ params }: PageProps) {
  const { id } = await params

  try {
    const supabase = await getTenantSupabase()

    // Fetch warehouse operation
    const { data: warehouseOp, error } = await supabase
      .from('warehouse_operations')
      .select(`
        *,
        shipments:shipment_id(id, shipment_number, status),
        warehouses:warehouse_id(id, name, code),
        created_by_user:created_by(id, email, full_name),
        completed_by_user:completed_by(id, email, full_name)
      `)
      .eq('id', id)
      .single()

    if (error || !warehouseOp) {
      notFound()
    }

    // Fetch stock movements
    const { data: stockMovements, error: movementsError } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products:product_id(id, name, sku),
        warehouses:warehouse_id(id, name),
        created_by_user:created_by(id, email, full_name)
      `)
      .eq('warehouse_operation_id', id)
      .order('created_at', { ascending: false })

    if (movementsError) {
      console.error('Error fetching stock movements:', movementsError)
    }

    // Fetch units separately for products
    const movements = stockMovements || []
    if (movements.length > 0) {
      const productIds = movements
        .map((m: any) => m.product_id)
        .filter(Boolean)
      
      if (productIds.length > 0) {
        const { data: productsWithUnits } = await supabase
          .from('shoprenter_products')
          .select('id, unit_id')
          .in('id', productIds)

        const unitIds = (productsWithUnits || [])
          .map((p: any) => p.unit_id)
          .filter(Boolean)

        let unitsMap = new Map()
        if (unitIds.length > 0) {
          const { data: units } = await supabase
            .from('units')
            .select('id, name, shortform')
            .in('id', unitIds)

          unitsMap = new Map((units || []).map((u: any) => [u.id, u]))
        }

        // Map units to movements
        const productUnitMap = new Map(
          (productsWithUnits || []).map((p: any) => [p.id, p.unit_id])
        )

        movements.forEach((movement: any) => {
          if (movement.product_id) {
            const unitId = productUnitMap.get(movement.product_id)
            movement.products = {
              ...movement.products,
              unit: unitId ? unitsMap.get(unitId) || null : null
            }
          }
        })
      }
    }

    // Calculate summary
    // Note: quantity can be positive (for 'in') or negative (for 'out')
    const summary = {
      total_items: movements.length,
      total_in: movements
        .filter((m: any) => m.movement_type === 'in' || m.movement_type === 'transfer_in')
        .reduce((sum: number, m: any) => {
          const qty = parseFloat(m.quantity || 0)
          return sum + Math.abs(qty) // Always use absolute value for 'in' movements
        }, 0),
      total_out: movements
        .filter((m: any) => m.movement_type === 'out' || m.movement_type === 'transfer_out')
        .reduce((sum: number, m: any) => {
          const qty = parseFloat(m.quantity || 0)
          return sum + Math.abs(qty) // Always use absolute value for 'out' movements
        }, 0),
      total_net: movements
        .filter((m: any) => m.unit_cost && m.unit_cost > 0)
        .reduce((sum: number, m: any) => {
          const qty = parseFloat(m.quantity || 0)
          const cost = parseFloat(m.unit_cost || 0)
          // Use absolute quantity * cost for all movements
          return sum + (Math.abs(qty) * cost)
        }, 0),
      total_vat: 0,
      total_gross: 0
    }

    const warehouseOperation = warehouseOp

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
            href="/warehouse-operations"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <InventoryIcon fontSize="small" />
            Raktári műveletek
          </Link>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {warehouseOperation.operation_number}
          </Typography>
        </Breadcrumbs>

        <WarehouseOperationDetailForm
          initialWarehouseOperation={warehouseOperation}
          initialStockMovements={stockMovements}
          initialSummary={summary}
        />
      </Box>
    )
  } catch (error) {
    console.error('Error fetching warehouse operation:', error)
    notFound()
  }
}
