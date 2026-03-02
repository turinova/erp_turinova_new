import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Receipt as ReceiptIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import VatRatesTable from './VatRatesTable'

export default async function VatRatesPage() {
  // Fetch all active VAT rates
  let vatRates: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('vat')
      .select('id, name, kulcs, created_at, updated_at')
      .is('deleted_at', null)
      .order('kulcs', { ascending: true })

    if (!error && data) {
      vatRates = data
    }
  } catch (error) {
    console.error('Error fetching VAT rates:', error)
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
          <ReceiptIcon fontSize="small" />
          Áfák
        </Typography>
      </Breadcrumbs>

      <VatRatesTable initialVatRates={vatRates} />
    </Box>
  )
}
