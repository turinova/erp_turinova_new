import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Business as BusinessIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import ManufacturersTable from './ManufacturersTable'

export default async function ManufacturersPage() {
  // Fetch all active manufacturers
  let manufacturers: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('manufacturers')
      .select('id, name, description, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      manufacturers = data
    }
  } catch (error) {
    console.error('Error fetching manufacturers:', error)
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
          <BusinessIcon fontSize="small" />
          Gyártók
        </Typography>
      </Breadcrumbs>

      <ManufacturersTable initialManufacturers={manufacturers} />
    </Box>
  )
}
