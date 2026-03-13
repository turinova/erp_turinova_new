import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import OrderBufferTable from './OrderBufferTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    status?: string
    connection_id?: string
  }>
}

export default async function OrderBufferPage({ searchParams }: PageProps = {}) {
  // Get initial page data from URL params
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '50', status: 'pending' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const status = resolvedParams.status || 'pending'
  const connectionId = resolvedParams.connection_id || null

  // Fetch buffer entries directly from Supabase
  let bufferEntries: any[] = []
  let totalCount = 0
  let totalPages = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit

    // Build query with webhook_data included
    let query = supabase
      .from('order_buffer')
      .select(`
        id,
        connection_id,
        platform_order_id,
        platform_order_resource_id,
        status,
        is_blacklisted,
        blacklist_reason,
        received_at,
        created_at,
        updated_at,
        webhook_data,
        webshop_connections!order_buffer_connection_id_fkey (
          id,
          name,
          api_url
        )
      `, { count: 'exact' })
      .eq('status', status)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by connection if provided
    if (connectionId) {
      query = query.eq('connection_id', connectionId)
    }

    const { data: bufferEntriesData, error, count } = await query

    if (!error && bufferEntriesData) {
      // Extract order summary from webhook_data
      const enrichedEntries = bufferEntriesData.map((entry: any) => {
        const webhookData = entry.webhook_data as any
        const orderData = webhookData?.orders?.order?.[0] || webhookData?.order || webhookData

        return {
          ...entry,
          connection: entry.webshop_connections,
          order_summary: {
            customer_name: orderData?.firstname && orderData?.lastname
              ? `${orderData.firstname} ${orderData.lastname}`
              : null,
            customer_email: orderData?.email || null,
            total: orderData?.totalGross || orderData?.total || null,
            currency: orderData?.currency?.code || orderData?.currency || 'HUF',
            date_created: orderData?.dateCreated || null,
            order_status: orderData?.orderStatus?.name || orderData?.orderHistory?.statusText || null
          }
        }
      })

      bufferEntries = enrichedEntries
      totalCount = count || 0
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
      />
    </Box>
  )
}
