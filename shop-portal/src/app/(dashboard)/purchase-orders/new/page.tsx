import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import NewPurchaseOrderForm from './NewPurchaseOrderForm'

export default async function NewPurchaseOrderPage() {
  const supabase = await getTenantSupabase()

  // Fetch all suppliers for dropdown
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Fetch all active warehouses for dropdown
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch all currencies for dropdown
  const { data: currencies } = await supabase
    .from('currencies')
    .select('id, name, code, symbol')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  // Fetch VAT rates
  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, name, kulcs')
    .is('deleted_at', null)
    .order('kulcs', { ascending: false })

  // Fetch units
  const { data: units } = await supabase
    .from('units')
    .select('id, name, shortform')
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
          href="/purchase-orders"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <ShoppingCartIcon fontSize="small" />
          Beszerzési rendelések
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Új beszerzési rendelés
        </Typography>
      </Breadcrumbs>

      <NewPurchaseOrderForm
        suppliers={suppliers || []}
        warehouses={warehouses || []}
        currencies={currencies || []}
        vatRates={(vatRates || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          rate: v.kulcs
        }))}
        units={units || []}
      />
    </Box>
  )
}
