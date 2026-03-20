import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Payment as PaymentIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import PaymentMethodsTable from './PaymentMethodsTable'

export default async function PaymentMethodsPage() {
  // Fetch all active payment methods
  let paymentMethods: any[] = []
  try {
    const supabase = await getTenantSupabase()
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, name, comment, active, import_payment_policy, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (!error && data) {
      paymentMethods = data
    }
  } catch (error) {
    console.error('Error fetching payment methods:', error)
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
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PaymentIcon fontSize="small" />
          Fizetési módok
        </Typography>
      </Breadcrumbs>

      <PaymentMethodsTable initialPaymentMethods={paymentMethods} />
    </Box>
  )
}
