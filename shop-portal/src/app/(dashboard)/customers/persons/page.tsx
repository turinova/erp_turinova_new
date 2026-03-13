import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Person as PersonIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PersonsTable from './PersonsTable'

export default async function PersonsPage() {
  // Fetch all active persons
  let persons: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('customer_persons')
      .select(`
        id,
        firstname,
        lastname,
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
      .order('lastname', { ascending: true })
      .order('firstname', { ascending: true })

    if (!error && data) {
      persons = data.map((person: any) => ({
        ...person,
        name: `${person.lastname} ${person.firstname}`.trim()
      }))
    }
  } catch (error) {
    console.error('Error fetching persons:', error)
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
          <PersonIcon fontSize="small" />
          Személyek
        </Typography>
      </Breadcrumbs>

      <PersonsTable initialPersons={persons} />
    </Box>
  )
}
