import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Category as CategoryIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getCategoriesForConnection } from '@/lib/categories-server'
import { getAllConnections } from '@/lib/connections-server'
import CategoriesTable from './CategoriesTable'

interface PageProps {
  searchParams?: Promise<{
    connectionId?: string
    search?: string
  }>
}

export default async function CategoriesPage({ searchParams }: PageProps = {}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const connectionId = resolvedParams.connectionId || ''
  const search = resolvedParams.search || ''

  // Get all connections
  const connections = await getAllConnections()
  
  // Get categories for selected connection (or all if no connection selected)
  let categories: any[] = []
  const selectedConnId = connectionId || (connections.length > 0 ? connections[0].id : '')
  if (selectedConnId) {
    try {
      categories = await getCategoriesForConnection(selectedConnId)
    } catch (error) {
      console.error('Error fetching categories:', error)
      categories = []
    }
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
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CategoryIcon fontSize="small" />
          Kategóriák
        </Typography>
      </Breadcrumbs>

      <CategoriesTable 
        initialCategories={categories}
        connections={connections}
        initialConnectionId={selectedConnId}
        initialSearch={search}
      />
    </Box>
  )
}
