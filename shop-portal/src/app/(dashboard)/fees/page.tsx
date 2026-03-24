import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalOffer as PriceTagIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import FeesTable from './FeesTable'

export default async function FeesPage() {
  let fees: any[] = []
  let vatRates: Array<{ id: string; name: string; kulcs: number }> = []
  try {
    const supabase = await getTenantSupabase()
    const [feesRes, vatRes] = await Promise.all([
      supabase
        .from('fee_definitions')
        .select('id, code, name, type, default_vat_rate, default_net, default_gross, price_mode, is_active, is_system, allow_manual_edit, allow_delete_from_order, sort_order, created_at, updated_at')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('vat')
        .select('id, name, kulcs')
        .is('deleted_at', null)
        .order('kulcs', { ascending: true })
    ])
    if (!feesRes.error && feesRes.data) fees = feesRes.data
    if (!vatRes.error && vatRes.data) vatRates = vatRes.data
  } catch (e) {
    console.error('Error loading fees page', e)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link component={NextLink} href="#" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PriceTagIcon fontSize="small" />
          Díjak
        </Typography>
      </Breadcrumbs>

      <FeesTable initialFees={fees} vatRates={vatRates} />
    </Box>
  )
}

