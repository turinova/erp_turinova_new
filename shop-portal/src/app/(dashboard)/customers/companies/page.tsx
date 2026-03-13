import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Business as BusinessIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CompaniesTable from './CompaniesTable'

export default async function CompaniesPage() {
  // Fetch all active companies
  let companies: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('customer_companies')
      .select(`
        id,
        name,
        email,
        telephone,
        identifier,
        source,
        is_active,
        tax_number,
        created_at,
        updated_at,
        customer_groups:customer_group_id(id, name)
      `)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      companies = data
    }
  } catch (error) {
    console.error('Error fetching companies:', error)
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
          href="/customers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Vevők
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <BusinessIcon fontSize="small" />
          Cégek
        </Typography>
      </Breadcrumbs>

      <CompaniesTable initialCompanies={companies} />
    </Box>
  )
}
