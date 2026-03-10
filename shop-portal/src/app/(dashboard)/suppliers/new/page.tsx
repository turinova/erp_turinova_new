import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as LocalShippingIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import SupplierEditForm from './SupplierNewForm'

export default async function SupplierNewPage() {
  const supabase = await getTenantSupabase()

  // Fetch VAT rates for dropdown
  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, name, rate')
    .is('deleted_at', null)
    .order('rate', { ascending: false })

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
          href="/suppliers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Beszállítók
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocalShippingIcon fontSize="small" />
          Új beszállító
        </Typography>
      </Breadcrumbs>

      <SupplierEditForm 
        initialSupplier={null}
        vatRates={vatRates || []}
      />
    </Box>
  )
}
