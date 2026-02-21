import { notFound } from 'next/navigation'
import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Category as CategoryIcon, Edit as EditIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getCategoryWithDescriptions } from '@/lib/categories-server'
import CategoryEditForm from './CategoryEditForm'

export default async function CategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const category = await getCategoryWithDescriptions(id)

  if (!category) {
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
          href="/categories"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <CategoryIcon fontSize="small" />
          Kategóriák
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <EditIcon fontSize="small" />
          {category.name || 'Kategória szerkesztése'}
        </Typography>
      </Breadcrumbs>

      <CategoryEditForm category={category} />
    </Box>
  )
}
