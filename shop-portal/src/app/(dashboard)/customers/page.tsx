import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, People as PeopleIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CustomersTable from './CustomersTable'

export default async function CustomersPage() {
  // Fetch all active customers (persons and companies)
  let customers: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('customer_entities')
      .select(`
        id,
        entity_type,
        name,
        email,
        telephone,
        identifier,
        source,
        is_active,
        firstname,
        lastname,
        tax_number,
        created_at,
        updated_at,
        customer_groups:customer_group_id(id, name)
      `)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      customers = data
    }
  } catch (error) {
    console.error('Error fetching customers:', error)
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
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleIcon fontSize="small" />
          Vevők
        </Typography>
      </Breadcrumbs>

      <CustomersTable initialCustomers={customers} />
    </Box>
  )
}
