import { headers } from 'next/headers'
import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import OrderBufferTable from './OrderBufferTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    connection_id?: string
    date_from?: string
    date_to?: string
    shipping_method?: string
  }>
}

export default async function OrderBufferPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '50', status: 'pending' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const status = resolvedParams.status || 'pending'
  const connectionId = resolvedParams.connection_id || null
  const dateFrom = resolvedParams.date_from || ''
  const dateTo = resolvedParams.date_to || ''
  const shippingMethod = resolvedParams.shipping_method || ''

  let bufferEntries: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const params = new URLSearchParams()
    params.set('status', status)
    params.set('page', String(page))
    params.set('limit', String(limit))
    if (connectionId) params.set('connection_id', connectionId)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    if (shippingMethod) params.set('shipping_method', shippingMethod)
    const cookie = (await headers()).get('cookie') || ''
    const res = await fetch(`${base}/api/orders/buffer?${params.toString()}`, {
      cache: 'no-store',
      headers: { cookie }
    })
    if (res.ok) {
      const data = await res.json()
      bufferEntries = data.entries || []
      totalCount = data.pagination?.total ?? 0
      totalPages = Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error('Error fetching buffer entries:', error)
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
          href="/orders"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Rendelések
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Rendelés puffer
        </Typography>
      </Breadcrumbs>

      <OrderBufferTable
        initialEntries={bufferEntries}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        limit={limit}
        initialStatus={status}
        initialConnectionId={connectionId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        initialShippingMethod={shippingMethod}
      />
    </Box>
  )
}
