'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  TextField, 
  InputAdornment, 
  CircularProgress,
  Chip,
  Checkbox,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  Alert,
  LinearProgress
} from '@mui/material'
import { 
  Search as SearchIcon, 
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HelpOutline as HelpOutlineIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import type { ShopRenterProduct } from '@/lib/products-server'

interface IndexingStatus {
  product_id: string
  is_indexed: boolean
  last_checked: string | null
  coverage_state: string | null
}

interface ProductsTableProps {
  initialProducts: ShopRenterProduct[]
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialSearch: string
}

export default function ProductsTable({ 
  initialProducts,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialSearch
}: ProductsTableProps) {
  const router = useRouter()
  const [products, setProducts] = useState<ShopRenterProduct[]>(initialProducts)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  
  // Selection state (for bulk operations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Indexing status state
  const [indexingStatuses, setIndexingStatuses] = useState<Map<string, IndexingStatus>>(new Map())
  const [isLoadingIndexStatus, setIsLoadingIndexStatus] = useState(false)

  // Search Console sync state
  const [isSyncingSearchConsole, setIsSyncingSearchConsole] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(currentPage)
  const [currentPageSize, setCurrentPageSize] = useState(limit)
  const [isLoading, setIsLoading] = useState(false)

  // Server-side search with pagination
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ShopRenterProduct[]>([])
  const [searchTotalCount, setSearchTotalCount] = useState(0)
  const [searchTotalPages, setSearchTotalPages] = useState(0)

  // Search effect - fetch from API route
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}&page=1&limit=${currentPageSize}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.products)
          setSearchTotalCount(data.totalCount)
          setSearchTotalPages(data.totalPages)
        } else {
          console.error('Search failed:', response.statusText)
          setSearchResults([])
          setSearchTotalCount(0)
          setSearchTotalPages(0)
        }
      } catch (error) {
        console.error('Error searching products:', error)
        setSearchResults([])
        setSearchTotalCount(0)
        setSearchTotalPages(0)
      } finally {
        setIsSearching(false)
      }
    }, 300) // Debounce search

    return () => clearTimeout(searchTimeout)
  }, [searchTerm, currentPageSize])

  // Fetch indexing statuses for displayed products
  const fetchIndexingStatuses = async (productIds: string[]) => {
    if (productIds.length === 0) return
    
    setIsLoadingIndexStatus(true)
    try {
      const response = await fetch('/api/search-console/indexing-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        const newStatuses = new Map<string, IndexingStatus>(indexingStatuses)
        for (const status of data.statuses || []) {
          newStatuses.set(status.product_id, status)
        }
        setIndexingStatuses(newStatuses)
      }
    } catch (error) {
      console.error('Error fetching indexing statuses:', error)
    } finally {
      setIsLoadingIndexStatus(false)
    }
  }

  // Handle Search Console refresh for selected products
  const handleSearchConsoleRefresh = async () => {
    if (selectedIds.size === 0) return
    
    setIsSyncingSearchConsole(true)
    setSyncError(null)
    setSyncSuccess(null)
    setSyncProgress({ current: 0, total: selectedIds.size })

    try {
      // Process in batches of 10
      const productIdsArray = Array.from(selectedIds)
      const batchSize = 10
      let processedCount = 0

      for (let i = 0; i < productIdsArray.length; i += batchSize) {
        const batch = productIdsArray.slice(i, i + batchSize)
        
        const response = await fetch('/api/search-console/batch-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: batch, days: 30 })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to sync Search Console data')
        }

        const data = await response.json()
        processedCount += batch.length
        setSyncProgress({ current: processedCount, total: selectedIds.size })

        // Update indexing statuses from results
        const newStatuses = new Map<string, IndexingStatus>(indexingStatuses)
        for (const result of data.results || []) {
          if (result.success && result.isIndexed !== undefined) {
            const existing = newStatuses.get(result.productId)
            newStatuses.set(result.productId, {
              product_id: result.productId,
              is_indexed: result.isIndexed,
              last_checked: new Date().toISOString(),
              coverage_state: existing?.coverage_state || null
            })
          }
        }
        setIndexingStatuses(newStatuses)

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < productIdsArray.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      setSyncSuccess(`${selectedIds.size} termék Search Console adatai frissítve`)
      // Refresh indexing statuses after sync
      await fetchIndexingStatuses(productIdsArray)
    } catch (error) {
      console.error('Error syncing Search Console:', error)
      setSyncError(error instanceof Error ? error.message : 'Hiba történt a szinkronizálás során')
    } finally {
      setIsSyncingSearchConsole(false)
      setSyncProgress({ current: 0, total: 0 })
    }
  }

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
  }

  // Handle page change - fetch from API route
  const handlePageChange = async (_event: React.ChangeEvent<unknown>, newPage: number) => {
    setIsLoading(true)
    setPage(newPage)
    
    try {
      const response = await fetch(`/api/products/paginated?page=${newPage}&limit=${currentPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
      } else {
        console.error('Failed to fetch products')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle limit change - fetch from API route
  const handleLimitChange = async (event: any) => {
    const newPageSize = Number(event.target.value)
    setIsLoading(true)
    setCurrentPageSize(newPageSize)
    setPage(1) // Reset to first page when changing page size
    
    try {
      const response = await fetch(`/api/products/paginated?page=1&limit=${newPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
        setPage(1)
      } else {
        console.error('Failed to fetch products')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Use search results if searching, otherwise use regular products
  const displayProducts = searchTerm && searchTerm.length >= 2 ? searchResults : products
  const displayTotalCount = searchTerm && searchTerm.length >= 2 ? searchTotalCount : totalCount
  const displayTotalPages = searchTerm && searchTerm.length >= 2 ? searchTotalPages : totalPages
  const displayCurrentPage = searchTerm && searchTerm.length >= 2 ? 1 : page

  // Fetch indexing status when products change
  useEffect(() => {
    const productIds = displayProducts.map(p => p.id)
    if (productIds.length > 0) {
      fetchIndexingStatuses(productIds)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProducts.map(p => p.id).join(',')])

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(displayProducts.map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedIds(newSelected)
  }

  const isAllSelected = displayProducts.length > 0 && selectedIds.size === displayProducts.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < displayProducts.length

  // Get status chip
  const getStatusChip = (product: ShopRenterProduct) => {
    if (product.status === 1) {
      return (
        <Chip 
          label="Aktív" 
          size="small" 
          color="success"
          icon={<CheckCircleIcon />}
        />
      )
    }
    return (
      <Chip 
        label="Inaktív" 
        size="small" 
        color="error"
        icon={<CancelIcon />}
      />
    )
  }

  // Get sync status chip
  const getSyncStatusChip = (product: ShopRenterProduct) => {
    if (product.sync_status === 'synced') {
      return (
        <Chip 
          label="Szinkronizálva" 
          size="small" 
          color="success"
        />
      )
    }
    if (product.sync_status === 'error') {
      return (
        <Chip 
          label="Hiba" 
          size="small" 
          color="error"
        />
      )
    }
    return (
      <Chip 
        label="Függőben" 
        size="small" 
        color="warning"
      />
    )
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('hu-HU', { 
      style: 'currency', 
      currency: 'HUF',
      maximumFractionDigits: 0
    }).format(price)
  }

  // Get indexing status icon
  const getIndexingStatusIcon = (productId: string) => {
    const status = indexingStatuses.get(productId)
    
    if (!status) {
      return (
        <Tooltip title="Nincs adat - kattints a Search Console frissítésre">
          <HelpOutlineIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Tooltip>
      )
    }

    if (status.is_indexed) {
      return (
        <Tooltip title={`Indexelve\n${status.last_checked ? `Ellenőrizve: ${new Date(status.last_checked).toLocaleDateString('hu-HU')}` : ''}`}>
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
        </Tooltip>
      )
    }

    return (
      <Tooltip title={`Nincs indexelve\n${status.coverage_state || ''}\n${status.last_checked ? `Ellenőrizve: ${new Date(status.last_checked).toLocaleDateString('hu-HU')}` : ''}`}>
        <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} />
      </Tooltip>
    )
  }

  // Handle product click - navigate to edit page
  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  return (
    <Box>
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Keresés név, SKU, gyártói cikkszám vagy GTIN alapján..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        disabled={isSearching || isLoading}
        sx={{ mt: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {isSearching ? <CircularProgress size={20} /> : <SearchIcon />}
            </InputAdornment>
          ),
        }}
      />

      {/* Selected count indicator and actions */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="primary">
            {selectedIds.size} termék kiválasztva
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={isSyncingSearchConsole ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={handleSearchConsoleRefresh}
            disabled={isSyncingSearchConsole || selectedIds.size === 0}
          >
            {isSyncingSearchConsole 
              ? `Search Console frissítése (${syncProgress.current}/${syncProgress.total})...` 
              : 'Search Console frissítése'}
          </Button>
        </Box>
      )}

      {/* Sync progress bar */}
      {isSyncingSearchConsole && (
        <LinearProgress 
          variant="determinate" 
          value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}
          sx={{ mb: 2 }}
        />
      )}

      {/* Success/Error alerts */}
      {syncSuccess && (
        <Alert severity="success" onClose={() => setSyncSuccess(null)} sx={{ mb: 2 }}>
          {syncSuccess}
        </Alert>
      )}
      {syncError && (
        <Alert severity="error" onClose={() => setSyncError(null)} sx={{ mb: 2 }}>
          {syncError}
        </Alert>
      )}

      {/* Products Table */}
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 50 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={displayProducts.length === 0}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Gyártói cikkszám</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Nettó ár</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Szinkron</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                <Tooltip title="Google Indexelés - A keresési eredményekben megjelenik-e">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    Indexelve
                    {isLoadingIndexStatus && <CircularProgress size={12} />}
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {isLoading || isSearching ? 'Betöltés...' : (searchTerm && searchTerm.length >= 2 ? 'Nincs találat' : 'Nincsenek termékek')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayProducts.map((product) => (
                <TableRow
                  key={product.id}
                  hover
                  selected={selectedIds.has(product.id)}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleProductClick(product.id)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onChange={(e) => handleSelectOne(product.id, e)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {product.sku}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {product.model_number || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {product.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {formatPrice(product.price)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(product)}</TableCell>
                  <TableCell>{getSyncStatusChip(product)}</TableCell>
                  <TableCell align="center">
                    {getIndexingStatusIcon(product.id)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {searchTerm && searchTerm.length >= 2 
              ? `Keresési eredmény: ${displayTotalCount} termék` 
              : `Összesen ${displayTotalCount} termék`
            }
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Oldal mérete</InputLabel>
            <Select
              value={currentPageSize}
              onChange={handleLimitChange}
              label="Oldal mérete"
              disabled={isLoading || isSearching}
            >
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={200}>200</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        {displayTotalPages > 1 && (
          <Pagination
            count={displayTotalPages}
            page={displayCurrentPage}
            onChange={handlePageChange}
            color="primary"
            disabled={isLoading || isSearching}
            showFirstButton
            showLastButton
          />
        )}
      </Box>
    </Box>
  )
}
