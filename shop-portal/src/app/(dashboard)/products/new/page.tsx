import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon, Add as AddIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import ProductEditForm from '../[id]/ProductEditForm'

export default function NewProductPage() {
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
        <Link
          component={NextLink}
          href="/products"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <InventoryIcon fontSize="small" />
          Termékek
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AddIcon fontSize="small" />
          Új termék
        </Typography>
      </Breadcrumbs>

      <ProductEditForm product={null} />
    </Box>
  )
}
