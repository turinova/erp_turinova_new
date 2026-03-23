import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon, Add as AddIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import OrderDetailForm from '../[id]/OrderDetailForm'

export default async function NewOrderPage() {
  const supabase = await getTenantSupabase()

  const [shippingMethodsRes, paymentMethodsRes] = await Promise.all([
    supabase
      .from('shipping_methods')
      .select('id, name, code')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('payment_methods')
      .select('id, name, code')
      .is('deleted_at', null)
      .order('name', { ascending: true })
  ])

  const shippingMethods = shippingMethodsRes.data ?? []
  const paymentMethods = paymentMethodsRes.data ?? []

  const now = new Date().toISOString()

  const order = {
    id: '',
    order_number: 'Új rendelés',
    order_date: now,
    status: 'new',
    currency_code: 'HUF',
    total_gross: 0,
    total_net: 0,
    subtotal_net: 0,
    subtotal_gross: 0,
    tax_amount: 0,
    discount_amount: 0,
    shipping_total_net: 0,
    shipping_total_gross: 0,
    payment_total_net: 0,
    payment_total_gross: 0,
    payment_status: 'pending',
    fulfillability_status: 'unknown',
    connection_id: null,
    platform_order_id: null,
    customer_comment: null,
    internal_notes: null,
    customer_person_id: null,
    customer_company_id: null,
    customer_company_name: '',
    customer_firstname: '',
    customer_lastname: '',
    customer_email: '',
    customer_phone: '',
    billing_firstname: '',
    billing_lastname: '',
    billing_company: '',
    billing_address1: '',
    billing_address2: '',
    billing_city: '',
    billing_postcode: '',
    billing_country_code: 'HU',
    billing_tax_number: '',
    shipping_firstname: '',
    shipping_lastname: '',
    shipping_company: '',
    shipping_address1: '',
    shipping_address2: '',
    shipping_city: '',
    shipping_postcode: '',
    shipping_country_code: 'HU',
    shipping_method_id: null,
    shipping_method_name: '',
    shipping_method_code: null,
    tracking_number: '',
    expected_delivery_date: '',
    payment_method_id: null,
    payment_method_name: '',
    payment_method_code: null,
    payment_method_after: true
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link component={NextLink} href="/orders" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Rendelések
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AddIcon fontSize="small" sx={{ opacity: 0.8 }} />
          Új rendelés
        </Typography>
      </Breadcrumbs>

      <OrderDetailForm
        mode="create"
        order={order}
        orderItems={[]}
        orderTotals={[]}
        shippingMethods={shippingMethods}
        paymentMethods={paymentMethods}
        connectionName={null}
        connectionPlatform={null}
        pickBatch={null}
      />
    </Box>
  )
}
