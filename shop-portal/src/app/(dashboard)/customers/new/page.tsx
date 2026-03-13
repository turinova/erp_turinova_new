import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, People as PeopleIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CustomerNewForm from './CustomerNewForm'

export default async function CustomerNewPage() {
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
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleIcon fontSize="small" />
          Új vevő
        </Typography>
      </Breadcrumbs>

      <CustomerNewForm 
        customerGroups={customerGroups || []}
      />
    </Box>
  )
}
