import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory2 as Inventory2Icon } from '@mui/icons-material'
import NextLink from 'next/link'
import ReplenishmentTable from './ReplenishmentTable'

interface PageProps {
  searchParams?: Promise<{
    supplier_id?: string
    group_by?: string
    order_id?: string
  }>
}

export default async function ReplenishmentPage({ searchParams }: PageProps = {}) {
  const resolved = searchParams ? await searchParams : {}
  const supplierId = resolved.supplier_id || ''
  const groupBy = resolved.group_by || 'product'
  const orderId = resolved.order_id || ''

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
          href="/purchase-orders"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Beszerzés
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Inventory2Icon fontSize="small" />
          Beszállítói várólista
        </Typography>
      </Breadcrumbs>

      <ReplenishmentTable
        initialSupplierId={supplierId}
        initialGroupBy={groupBy}
        initialOrderId={orderId}
      />
    </Box>
  )
}
