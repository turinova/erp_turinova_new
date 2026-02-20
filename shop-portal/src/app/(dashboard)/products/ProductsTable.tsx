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
  InputLabel
} from '@mui/material'
import { 
  Search as SearchIcon, 
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material'
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
  
  // Selection state (for future bulk operations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

      {/* Selected count indicator */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="primary">
            {selectedIds.size} termék kiválasztva
          </Typography>
        </Box>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {displayProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
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
