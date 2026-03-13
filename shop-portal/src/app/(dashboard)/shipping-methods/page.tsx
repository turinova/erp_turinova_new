import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as ShippingIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import ShippingMethodsTable from './ShippingMethodsTable'

export default async function ShippingMethodsPage() {
  let shippingMethods: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('id, name, code, extension, is_active, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      shippingMethods = data
    }
  } catch (error) {
    console.error('Error fetching shipping methods:', error)
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
        <Link component={NextLink} href="#" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShippingIcon fontSize="small" />
          Szállítási módok
        </Typography>
      </Breadcrumbs>

      <ShippingMethodsTable initialShippingMethods={shippingMethods} />
    </Box>
  )
}
