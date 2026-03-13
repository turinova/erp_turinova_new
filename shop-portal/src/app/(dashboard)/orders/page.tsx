import { Box, Breadcrumbs, Link, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    search?: string
  }>
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

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  new: 'info',
  pending_review: 'warning',
  packing: 'primary',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'error'
}

export default async function OrdersPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = Math.min(parseInt(resolvedParams.limit || '20', 10), 100)
  const status = resolvedParams.status || 'all'
  const search = resolvedParams.search || ''

  let orders: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit

    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        platform_order_id,
        customer_firstname,
        customer_lastname,
        customer_email,
        total_gross,
        currency_code,
        status,
        payment_status,
        order_date,
        created_at
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('order_date', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(`order_number.ilike.${term},customer_firstname.ilike.${term},customer_lastname.ilike.${term},customer_email.ilike.${term}`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (!error && data) {
      orders = data
      totalCount = count || 0
      totalPages = Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error('Error fetching orders:', error)
  }

  const formatCurrency = (amount: number | null, currency: string = 'HUF') => {
    if (amount == null) return '-'
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Rendelések
        </Typography>
      </Breadcrumbs>

      <Typography variant="h5" sx={{ mb: 2 }}>
        Rendelések
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Link component={NextLink} href="/orders/buffer" variant="body2">
          Rendelés puffer →
        </Link>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rendelésszám</TableCell>
              <TableCell>Vásárló</TableCell>
              <TableCell>Összeg</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Fizetés</TableCell>
              <TableCell>Dátum</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Nincs megjeleníthető rendelés.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: any) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Link component={NextLink} href={`/orders/${order.id}`} fontWeight="medium">
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {order.customer_firstname} {order.customer_lastname}
                    {order.customer_email && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {order.customer_email}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(order.total_gross, order.currency_code)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[order.status] || order.status}
                      color={STATUS_COLORS[order.status] || 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={order.payment_status || 'pending'} variant="outlined" />
                  </TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell align="right">
                    <Link component={NextLink} href={`/orders/${order.id}`}>
                      Részletek
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3 }}>
          {page > 1 && (
            <Link component={NextLink} href={`/orders?page=${page - 1}${status !== 'all' ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`}>
              ← Előző
            </Link>
          )}
          <Typography variant="body2" color="text.secondary">
            {page}. oldal / {totalPages} ({totalCount} rendelés)
          </Typography>
          {page < totalPages && (
            <Link component={NextLink} href={`/orders?page=${page + 1}${status !== 'all' ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`}>
              Következő →
            </Link>
          )}
        </Box>
      )}
    </Box>
  )
}
