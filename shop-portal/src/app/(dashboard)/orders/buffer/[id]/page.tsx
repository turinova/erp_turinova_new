import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, ShoppingCart as ShoppingCartIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import OrderBufferDetail from './OrderBufferDetail'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderBufferDetailPage({ params }: PageProps) {
  const { id } = await params

  // Fetch buffer entry
  let bufferEntry: any = null

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/orders/buffer/${id}`, {
      cache: 'no-store'
    })

    if (response.ok) {
      const data = await response.json()
      bufferEntry = data.entry
    } else if (response.status === 404) {
      notFound()
    }
  } catch (error) {
    console.error('Error fetching buffer entry:', error)
  }

  if (!bufferEntry) {
    notFound()
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
        <Link
          component={NextLink}
          href="/orders/buffer"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Rendelés puffer
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShoppingCartIcon fontSize="small" />
          Buffer bejegyzés
        </Typography>
      </Breadcrumbs>

      <OrderBufferDetail initialEntry={bufferEntry} />
    </Box>
  )
}
