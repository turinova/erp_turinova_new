import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalShipping as LocalShippingIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import SupplierEditForm from './SupplierEditForm'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  // Fetch supplier with related data
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !supplier) {
    notFound()
  }

  // Fetch addresses
  const { data: addresses } = await supabase
    .from('supplier_addresses')
    .select('*')
    .eq('supplier_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  // Fetch bank accounts
  const { data: bankAccounts } = await supabase
    .from('supplier_bank_accounts')
    .select('*')
    .eq('supplier_id', id)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // Fetch order channels
  const { data: orderChannels } = await supabase
    .from('supplier_order_channels')
    .select('*')
    .eq('supplier_id', id)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // Fetch VAT rates for dropdown
  // Note: column is 'kulcs' in DB, we alias it to rate for the UI
  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, name, kulcs')
    .is('deleted_at', null)
    .order('kulcs', { ascending: false })

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
          href="/suppliers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Beszállítók
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocalShippingIcon fontSize="small" />
          {supplier.name}
        </Typography>
      </Breadcrumbs>

      <SupplierEditForm 
        initialSupplier={{
          ...supplier,
          addresses: addresses || [],
          bank_accounts: bankAccounts || [],
          order_channels: orderChannels || []
        }}
        vatRates={(vatRates || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          rate: v.kulcs
        }))}
      />
    </Box>
  )
}
