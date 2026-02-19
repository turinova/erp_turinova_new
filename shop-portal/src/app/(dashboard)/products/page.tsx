import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getAllProducts } from '@/lib/products-server'
import ProductsTable from './ProductsTable'

export default async function ProductsPage() {
  const products = await getAllProducts()

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
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <InventoryIcon fontSize="small" />
          Termékek
        </Typography>
      </Breadcrumbs>

      <ProductsTable initialProducts={products} />
    </Box>
  )
}
