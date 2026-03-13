import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Person as PersonIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PersonEditForm from './PersonEditForm'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  // Fetch person with related data
  const { data: person, error } = await supabase
    .from('customer_persons')
    .select(`
      *,
      customer_groups:customer_group_id(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !person) {
    notFound()
  }

  // Fetch addresses (check both person_id and customer_entity_id for backward compatibility)
  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select('*')
    .or(`person_id.eq.${id},customer_entity_id.eq.${id}`)
    .is('deleted_at', null)
    .order('is_default_billing', { ascending: false })
    .order('is_default_shipping', { ascending: false })
    .order('created_at', { ascending: true })

  // Fetch bank accounts
  const { data: bankAccounts } = await supabase
    .from('customer_bank_accounts')
    .select(`
      *,
      currencies:currency_id(id, code, name, symbol)
    `)
    .or(`person_id.eq.${id},customer_entity_id.eq.${id}`)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // Fetch platform mappings
  const { data: platformMappings } = await supabase
    .from('customer_platform_mappings')
    .select(`
      *,
      webshop_connections:connection_id(id, name, platform_type, is_active)
    `)
    .eq('person_id', id)

  // Fetch relationships (companies this person is linked to)
  const { data: relationships } = await supabase
    .from('customer_person_company_relationships')
    .select(`
      *,
      companies:company_id(id, name, email, telephone)
    `)
    .eq('person_id', id)
    .is('deleted_at', null)

  // Fetch customer groups for dropdown
  const { data: customerGroups } = await supabase
    .from('customer_groups')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Fetch currencies for bank accounts
  const { data: currencies } = await supabase
    .from('currencies')
    .select('id, code, name, symbol')
    .is('deleted_at', null)
    .order('code', { ascending: true })

  // Format person name
  const personName = `${person.lastname} ${person.firstname}`.trim()

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
          href="/customers/persons"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Személyek
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonIcon fontSize="small" />
          {personName}
        </Typography>
      </Breadcrumbs>

      <PersonEditForm 
        initialPerson={{
          ...person,
          name: personName,
          addresses: addresses || [],
          bank_accounts: bankAccounts || [],
          platform_mappings: platformMappings || [],
          relationships: relationships || []
        }}
        customerGroups={customerGroups || []}
        currencies={currencies || []}
      />
    </Box>
  )
}
