import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Business as BusinessIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CompanyNewForm from './CompanyNewForm'

export default async function CompanyNewPage() {
  const supabase = await getTenantSupabase()

  // Fetch customer groups for dropdown
  const { data: customerGroups } = await supabase
    .from('customer_groups')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

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
        <Link
          component={NextLink}
          href="/customers/companies"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Cégek
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <BusinessIcon fontSize="small" />
          Új cég
        </Typography>
      </Breadcrumbs>

      <CompanyNewForm 
        customerGroups={customerGroups || []}
      />
    </Box>
  )
}
