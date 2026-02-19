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
  IconButton,
  Tooltip,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Sync as SyncIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import type { ShopRenterProduct } from '@/lib/products-server'

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
  const [syncingProductId, setSyncingProductId] = useState<string | null>(null)

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
        toast.error('Hiba történt az adatok betöltése során')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Hiba történt az adatok betöltése során')
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
        toast.error('Hiba történt az adatok betöltése során')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Hiba történt az adatok betöltése során')
    } finally {
      setIsLoading(false)
    }
  }

  // Use search results if searching, otherwise use regular products
  const displayProducts = searchTerm && searchTerm.length >= 2 ? searchResults : products
  const displayTotalCount = searchTerm && searchTerm.length >= 2 ? searchTotalCount : totalCount
  const displayTotalPages = searchTerm && searchTerm.length >= 2 ? searchTotalPages : totalPages
  const displayCurrentPage = searchTerm && searchTerm.length >= 2 ? 1 : page

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

  // Handle product click - navigate to edit page
  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  // Handle sync product
  const handleSyncProduct = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    try {
      setSyncingProductId(productId)
      
      const response = await fetch(`/api/products/${productId}/sync`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Termék sikeresen szinkronizálva!')
        // Refresh current page data
        try {
          const refreshResponse = await fetch(`/api/products/paginated?page=${page}&limit=${currentPageSize}`)
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            setProducts(refreshData.products)
          }
        } catch (refreshError) {
          console.error('Error refreshing products:', refreshError)
        }
      } else {
        toast.error(`Szinkronizálás sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error syncing product:', error)
      toast.error('Hiba a termék szinkronizálásakor')
    } finally {
      setSyncingProductId(null)
    }
  }

  return (
    <Box>
      {/* Search Bar - matches accessories page placement exactly */}
      <TextField
        fullWidth
        placeholder="Keresés SKU vagy név alapján..."
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

      {/* Products Table - matches accessories page styling exactly */}
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Szinkronizálás</TableCell>
              <TableCell>Utolsó szinkronizálás</TableCell>
              <TableCell align="right">Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleProductClick(product.id)}
                >
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.name || '-'}</TableCell>
                  <TableCell>{getStatusChip(product)}</TableCell>
                  <TableCell>{getSyncStatusChip(product)}</TableCell>
                  <TableCell>
                    {product.last_synced_at 
                      ? new Date(product.last_synced_at).toLocaleString('hu-HU')
                      : '-'
                    }
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Szinkronizálás">
                      <IconButton
                        size="small"
                        onClick={(e) => handleSyncProduct(product.id, e)}
                        disabled={syncingProductId === product.id}
                      >
                        {syncingProductId === product.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <SyncIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Szerkesztés">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleProductClick(product.id)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls - matches accessories page layout */}
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
