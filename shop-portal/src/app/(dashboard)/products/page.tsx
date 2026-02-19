import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getAllProducts } from '@/lib/products-server'
import ProductsTable from './ProductsTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    search?: string
  }>
}

export default async function ProductsPage({ searchParams }: PageProps = {}) {
  // Get initial page data (first page, default limit)
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '50', search: '' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)

  // Fetch initial data (no search on initial load)
  const result = await getAllProducts(page, limit, '')

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
          <InventoryIcon fontSize="small" />
          Termékek
        </Typography>
      </Breadcrumbs>

      <ProductsTable 
        initialProducts={result.products}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
        currentPage={result.currentPage}
        limit={result.limit}
        initialSearch=""
      />
    </Box>
  )
}
