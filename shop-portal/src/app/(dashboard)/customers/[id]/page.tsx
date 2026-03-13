import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, People as PeopleIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import CustomerEditForm from './CustomerEditForm'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  // Fetch customer with related data
  const { data: customer, error } = await supabase
    .from('customer_entities')
    .select(`
      *,
      customer_groups:customer_group_id(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !customer) {
    notFound()
  }

  // Fetch addresses
  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_entity_id', id)
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
    .eq('customer_entity_id', id)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // Fetch platform mappings
  const { data: platformMappings } = await supabase
    .from('customer_entity_platform_mappings')
    .select(`
      *,
      webshop_connections:connection_id(id, name, platform_type)
    `)
    .eq('customer_entity_id', id)

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
          {customer.name}
        </Typography>
      </Breadcrumbs>

      <CustomerEditForm 
        initialCustomer={{
          ...customer,
          addresses: addresses || [],
          bank_accounts: bankAccounts || [],
          platform_mappings: platformMappings || []
        }}
        customerGroups={customerGroups || []}
        currencies={currencies || []}
      />
    </Box>
  )
}
