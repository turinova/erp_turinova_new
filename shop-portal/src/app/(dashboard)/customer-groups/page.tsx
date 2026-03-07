import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, People as PeopleIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CustomerGroupsTable from './CustomerGroupsTable'

export default async function CustomerGroupsPage() {
  // Fetch all active customer groups
  let customerGroups: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('customer_groups')
      .select('id, name, code, description, shoprenter_customer_group_id, is_default, is_active, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      customerGroups = data
    }
  } catch (error) {
    console.error('Error fetching customer groups:', error)
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
          Árazás
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleIcon fontSize="small" />
          Vevőcsoportok
        </Typography>
      </Breadcrumbs>

      <CustomerGroupsTable initialCustomerGroups={customerGroups} />
    </Box>
  )
}
