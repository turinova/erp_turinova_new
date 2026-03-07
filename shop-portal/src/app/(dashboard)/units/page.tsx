import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Scale as ScaleIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import UnitsTable from './UnitsTable'

export default async function UnitsPage() {
  // Fetch all active units
  let units: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      units = data
    }
  } catch (error) {
    console.error('Error fetching units:', error)
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
          <ScaleIcon fontSize="small" />
          Mértékegységek
        </Typography>
      </Breadcrumbs>

      <UnitsTable initialUnits={units} />
    </Box>
  )
}
