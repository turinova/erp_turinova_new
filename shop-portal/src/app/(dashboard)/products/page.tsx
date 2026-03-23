import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Inventory as InventoryIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getAllProducts, getQualityScoresBatch, getIndexingStatusesBatch, type ProductStructureFilter } from '@/lib/products-server'
import ProductsTable from './ProductsTable'

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    search?: string
    structure?: ProductStructureFilter
    parentId?: string
    includeParent?: string
  }>
}

export default async function ProductsPage({ searchParams }: PageProps = {}) {
  // Get initial page data from URL params
  const resolvedParams = searchParams ? await searchParams : { page: '1', limit: '50', search: '', structure: 'all' as ProductStructureFilter, parentId: '', includeParent: '0' }
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const search = resolvedParams.search || ''
  const structure = (resolvedParams.structure || 'all') as ProductStructureFilter
  const parentId = resolvedParams.parentId || ''
  const includeParent = resolvedParams.includeParent === '1'

  // Fetch initial data with search if provided
  const result = await getAllProducts(page, limit, search, {
    structure,
    parentId,
    includeParent
  })

  // Fetch quality scores and indexing statuses in batch (server-side)
  const productIds = result.products.map(p => p.id)
  const [initialQualityScores, initialIndexingStatuses] = await Promise.all([
    getQualityScoresBatch(productIds),
    getIndexingStatusesBatch(productIds)
  ])

  // Convert Maps to plain objects for serialization
  const qualityScoresObj = Object.fromEntries(initialQualityScores)
  const indexingStatusesObj = Object.fromEntries(initialIndexingStatuses)

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
        initialQualityScores={qualityScoresObj}
        initialIndexingStatuses={indexingStatusesObj}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
        currentPage={result.currentPage}
        limit={result.limit}
        initialSearch={search}
        initialStructure={structure}
        initialParentId={parentId}
        initialIncludeParent={includeParent}
      />
    </Box>
  )
}
