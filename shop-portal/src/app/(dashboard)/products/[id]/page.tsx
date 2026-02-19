import { notFound } from 'next/navigation'
import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon, Edit as EditIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getProductById } from '@/lib/products-server'
import ProductEditForm from './ProductEditForm'

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProductById(id)

  if (!product) {
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
          href="/products"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <InventoryIcon fontSize="small" />
          Termékek
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <EditIcon fontSize="small" />
          {product.sku}
        </Typography>
      </Breadcrumbs>

      <ProductEditForm product={product} />
    </Box>
  )
}
