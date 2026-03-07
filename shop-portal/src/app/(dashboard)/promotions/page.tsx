import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, LocalOffer as LocalOfferIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PromotionsTable from './PromotionsTable'

export default async function PromotionsPage() {
  // Fetch all promotions
  let promotions: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('product_specials')
      .select(`
        *,
        shoprenter_products (
          id,
          name,
          sku,
          shoprenter_id
        ),
        customer_groups (
          id,
          name,
          code
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!error && data) {
      promotions = data
    }
  } catch (error) {
    console.error('Error fetching promotions:', error)
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
          <LocalOfferIcon fontSize="small" />
          Akciók
        </Typography>
      </Breadcrumbs>

      <PromotionsTable initialPromotions={promotions} />
    </Box>
  )
}
