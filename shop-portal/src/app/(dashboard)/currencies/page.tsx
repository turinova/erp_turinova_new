import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, CurrencyExchange as CurrencyExchangeIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CurrenciesTable from './CurrenciesTable'

export default async function CurrenciesPage() {
  // Fetch all active currencies
  let currencies: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('currencies')
      .select('id, name, code, symbol, rate, is_base, created_at, updated_at')
      .is('deleted_at', null)
      .order('is_base', { ascending: false })
      .order('name', { ascending: true })

    if (!error && data) {
      currencies = data
    }
  } catch (error) {
    console.error('Error fetching currencies:', error)
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
          <CurrencyExchangeIcon fontSize="small" />
          Pénznemek
        </Typography>
      </Breadcrumbs>

      <CurrenciesTable initialCurrencies={currencies} />
    </Box>
  )
}
