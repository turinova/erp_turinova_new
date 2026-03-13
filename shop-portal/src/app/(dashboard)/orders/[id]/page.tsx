import { Box, Breadcrumbs, Link, Typography, Card, CardContent, Grid, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon, Person as PersonIcon, LocalShipping as LocalShippingIcon, Payment as PaymentIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Új',
  pending_review: 'Áttekintésre vár',
  packing: 'Csomagolás',
  shipped: 'Elküldve',
  delivered: 'Kézbesítve',
  cancelled: 'Törölve',
  refunded: 'Visszatérítve'
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await getTenantSupabase()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (orderError || !order) {
    notFound()
  }

  const { data: orderItems = [] } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const { data: orderTotals = [] } = await supabase
    .from('order_totals')
    .select('*')
    .eq('order_id', id)
    .order('sort_order', { ascending: true })

  const formatCurrency = (amount: number | string | null, currency: string = 'HUF') => {
    if (amount == null) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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
          {order.order_number}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            {order.order_number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(order.order_date)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label={STATUS_LABELS[order.status] || order.status} color="primary" variant="outlined" />
          <Chip label={order.payment_status || 'pending'} variant="outlined" />
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Vásárló */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" />
                Vásárló
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                {order.customer_firstname} {order.customer_lastname}
              </Typography>
              {order.customer_email && (
                <Typography variant="body2" color="text.secondary">
                  {order.customer_email}
                </Typography>
              )}
              {order.customer_phone && (
                <Typography variant="body2" color="text.secondary">
                  {order.customer_phone}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Szállítási cím */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalShippingIcon fontSize="small" />
                Szállítási cím
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2">
                {order.shipping_firstname} {order.shipping_lastname}
              </Typography>
              {order.shipping_company && <Typography variant="body2">{order.shipping_company}</Typography>}
              <Typography variant="body2">
                {order.shipping_address1}
                {order.shipping_address2 ? `, ${order.shipping_address2}` : ''}
              </Typography>
              <Typography variant="body2">
                {order.shipping_postcode} {order.shipping_city}
              </Typography>
              {order.shipping_country_code && <Typography variant="body2">{order.shipping_country_code}</Typography>}
              {order.shipping_method_name && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Szállítás: {order.shipping_method_name}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Fizetés */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentIcon fontSize="small" />
                Fizetés
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {order.payment_method_name && (
                <Typography variant="body2">{order.payment_method_name}</Typography>
              )}
              <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
                {formatCurrency(order.total_gross, order.currency_code)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Termékek */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Termékek
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Termék</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Mennyiség</TableCell>
                      <TableCell align="right">Egységár (bruttó)</TableCell>
                      <TableCell align="right">Összesen</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Nincs tétel.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name || '-'}</TableCell>
                          <TableCell>{item.product_sku || '-'}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price_gross, order.currency_code)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.line_total_gross, order.currency_code)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {orderTotals.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                  {orderTotals.map((t: any) => (
                    <Typography key={t.id} variant="body2">
                      {t.name}: {formatCurrency(t.value_gross, order.currency_code)}
                    </Typography>
                  ))}
                </Box>
              )}
              <Typography variant="h6" align="right" sx={{ mt: 2 }}>
                Összesen: {formatCurrency(order.total_gross, order.currency_code)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
