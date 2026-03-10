import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Warehouse as WarehouseIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import WarehousesTable from './WarehousesTable'

export default async function WarehousesPage() {
  // Fetch all warehouses
  let warehouses: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, code, is_active, created_at, updated_at')
      .order('name', { ascending: true })

    if (!error && data) {
      warehouses = data
    }
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
        <Link
          component={NextLink}
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WarehouseIcon fontSize="small" />
          Raktárak
        </Typography>
      </Breadcrumbs>

      <WarehousesTable initialWarehouses={warehouses} />
    </Box>
  )
}
