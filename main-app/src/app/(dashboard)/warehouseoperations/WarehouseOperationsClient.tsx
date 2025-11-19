'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Breadcrumbs, Chip, CircularProgress, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, InputAdornment, Pagination, Select, MenuItem, FormControl
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useDebounce } from '@/hooks/useDebounce'

interface StockMovementRow {
  id: string
  stock_movement_number: string
  warehouse_name: string
  product_type: string
  product_name: string
  sku: string
  quantity: number
  movement_type: string
  source_type: string
  source_id: string | null
  source_reference: string
  created_at: string
  note: string
}

interface WarehouseOperationsClientProps {
  initialStockMovements: StockMovementRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialMovementType: string
  initialSourceType: string
  initialPageSize: number
}

export default function WarehouseOperationsClient({ 
  initialStockMovements,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialMovementType,
  initialSourceType,
  initialPageSize = 50
}: WarehouseOperationsClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<StockMovementRow[]>(initialStockMovements)
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>(initialMovementType)
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>(initialSourceType)
  const [search, setSearch] = useState<string>(initialSearchTerm)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [mounted, setMounted] = useState(false)
  const { hasAccess, loading: permissionLoading } = usePagePermission('/warehouseoperations')
  const debouncedSearchTerm = useDebounce(search, 500)

  // Fetch total counts for filters (always show total, not filtered count)
  const [movementTypeCounts, setMovementTypeCounts] = useState({
    all: totalCount,
    in: 0,
    out: 0,
    adjustment: 0
  })
  const [sourceTypeCounts, setSourceTypeCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch filter counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/stock-movements')
        const data = await res.json()
        if (res.ok && data.stock_movements) {
          const all = data.stock_movements
          setMovementTypeCounts({
            all: all.length,
            in: all.filter((r: StockMovementRow) => r.movement_type === 'in').length,
            out: all.filter((r: StockMovementRow) => r.movement_type === 'out').length,
            adjustment: all.filter((r: StockMovementRow) => r.movement_type === 'adjustment').length
          })
          
          const counts: Record<string, number> = {}
          all.forEach((r: StockMovementRow) => {
            const st = r.source_type || 'unknown'
            counts[st] = (counts[st] || 0) + 1
          })
          setSourceTypeCounts(counts)
        }
      } catch (e) {
        console.error('Error fetching filter counts:', e)
      }
    }
    fetchCounts()
  }, [])

  // Update rows when initialStockMovements changes (from server-side pagination)
  useEffect(() => {
    setRows(initialStockMovements)
    setClientPage(currentPage)
  }, [initialStockMovements, currentPage])

  // Handle filter changes - navigate to page 1 with new filters
  const handleFilterChange = (newMovementType: string, newSourceType: string) => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (newMovementType !== 'all') params.set('movement_type', newMovementType)
    if (newSourceType !== 'all') params.set('source_type', newSourceType)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/warehouseoperations?${params.toString()}`)
  }

  // Handle search - navigate to page 1 with search term
  useEffect(() => {
    if (!mounted) return
    
    const params = new URLSearchParams()
    params.set('page', '1')
    if (movementTypeFilter !== 'all') params.set('movement_type', movementTypeFilter)
    if (sourceTypeFilter !== 'all') params.set('source_type', sourceTypeFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/warehouseoperations?${params.toString()}`)
  }, [debouncedSearchTerm, mounted, router, movementTypeFilter, sourceTypeFilter, pageSize])

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (movementTypeFilter !== 'all') params.set('movement_type', movementTypeFilter)
    if (sourceTypeFilter !== 'all') params.set('source_type', sourceTypeFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/warehouseoperations?${params.toString()}`)
  }

  // Handle page size change
  const handlePageSizeChange = (event: any) => {
    const newPageSize = parseInt(event.target.value, 10)
    setPageSize(newPageSize)
    const params = new URLSearchParams()
    params.set('page', '1') // Reset to first page
    if (movementTypeFilter !== 'all') params.set('movement_type', movementTypeFilter)
    if (sourceTypeFilter !== 'all') params.set('source_type', sourceTypeFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    params.set('limit', newPageSize.toString())
    router.push(`/warehouseoperations?${params.toString()}`)
  }

  if (permissionLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Betöltés...</Typography>
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Nincs jogosultsága az oldal megtekintéséhez.</Typography>
      </Box>
    )
  }

  const getSourceTypeLabel = (sourceType: string) => {
    const labels: Record<string, string> = {
      'pos_sale': 'POS eladás',
      'purchase_receipt': 'Beszerzési bevételezés',
      'quote': 'Árajánlat',
      'adjustment': 'Készletigazítás'
    }
    return labels[sourceType] || sourceType
  }

  const getSourceLink = (row: StockMovementRow) => {
    if (row.source_type === 'pos_sale' && row.source_id) {
      return `/pos-orders/${row.source_id}`
    } else if (row.source_type === 'purchase_receipt' && row.source_id) {
      return `/shipments/${row.source_id}`
    }
    return null
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={NextLink} href="/home" underline="hover" color="inherit">
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">Műveletek</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Készletmozgások
      </Typography>

      {/* Movement Type Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Mozgás típus:
        </Typography>
        <Chip
          label={`Összes (${movementTypeCounts.all})`}
          onClick={() => {
            setMovementTypeFilter('all')
            handleFilterChange('all', sourceTypeFilter)
          }}
          color={movementTypeFilter === 'all' ? 'primary' : 'default'}
          variant={movementTypeFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Bejövő (${movementTypeCounts.in})`}
          onClick={() => {
            setMovementTypeFilter('in')
            handleFilterChange('in', sourceTypeFilter)
          }}
          color={movementTypeFilter === 'in' ? 'success' : 'default'}
          variant={movementTypeFilter === 'in' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Kimenő (${movementTypeCounts.out})`}
          onClick={() => {
            setMovementTypeFilter('out')
            handleFilterChange('out', sourceTypeFilter)
          }}
          color={movementTypeFilter === 'out' ? 'error' : 'default'}
          variant={movementTypeFilter === 'out' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Igazítás (${movementTypeCounts.adjustment})`}
          onClick={() => {
            setMovementTypeFilter('adjustment')
            handleFilterChange('adjustment', sourceTypeFilter)
          }}
          color={movementTypeFilter === 'adjustment' ? 'warning' : 'default'}
          variant={movementTypeFilter === 'adjustment' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Source Type Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Forrás típus:
        </Typography>
        <Chip
          label={`Összes (${totalCount})`}
          onClick={() => {
            setSourceTypeFilter('all')
            handleFilterChange(movementTypeFilter, 'all')
          }}
          color={sourceTypeFilter === 'all' ? 'primary' : 'default'}
          variant={sourceTypeFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        {Object.entries(sourceTypeCounts).map(([sourceType, count]) => (
          <Chip
            key={sourceType}
            label={`${getSourceTypeLabel(sourceType)} (${count})`}
            onClick={() => {
              setSourceTypeFilter(sourceType)
              handleFilterChange(movementTypeFilter, sourceType)
            }}
            color={sourceTypeFilter === sourceType ? 'primary' : 'default'}
            variant={sourceTypeFilter === sourceType ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      {/* Search */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés termék neve, SKU vagy mozgás szám szerint..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Mozgás szám</TableCell>
              <TableCell>Dátum</TableCell>
              <TableCell>Raktár</TableCell>
              <TableCell>Termék típus</TableCell>
              <TableCell>Termék név</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Mennyiség</TableCell>
              <TableCell>Mozgás típus</TableCell>
              <TableCell>Forrás típus</TableCell>
              <TableCell>Forrás</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  Nincs megjeleníthető készletmozgás.
                </TableCell>
              </TableRow>
            ) : rows.map(row => {
                const sourceLink = getSourceLink(row)
                const quantityColor = row.quantity > 0 ? 'success.main' : row.quantity < 0 ? 'error.main' : 'text.primary'
                const quantitySign = row.quantity > 0 ? '+' : ''
                
                return (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ cursor: sourceLink ? 'pointer' : 'default' }}
                    onClick={() => sourceLink && router.push(sourceLink)}
                  >
                    <TableCell><strong>{row.stock_movement_number}</strong></TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('hu-HU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : ''}</TableCell>
                    <TableCell>{row.warehouse_name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={row.product_type === 'accessory' ? 'Kellék' : row.product_type === 'material' ? 'Táblás anyag' : 'Szálas anyag'} 
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{row.product_name || '-'}</TableCell>
                    <TableCell>{row.sku || '-'}</TableCell>
                    <TableCell align="right">
                      <Typography sx={{ color: quantityColor, fontWeight: 500 }}>
                        {quantitySign}{new Intl.NumberFormat('hu-HU', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(row.quantity)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.movement_type === 'in' ? 'Bejövő' : row.movement_type === 'out' ? 'Kimenő' : 'Igazítás'} 
                        size="small"
                        color={
                          row.movement_type === 'in' ? 'success' :
                          row.movement_type === 'out' ? 'error' :
                          'warning'
                        }
                      />
                    </TableCell>
                    <TableCell>{getSourceTypeLabel(row.source_type)}</TableCell>
                    <TableCell>
                      {sourceLink ? (
                        <Link
                          component={NextLink}
                          href={sourceLink}
                          onClick={(e) => e.stopPropagation()}
                          underline="hover"
                        >
                          {row.source_reference}
                        </Link>
                      ) : (
                        row.source_reference
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {debouncedSearchTerm || movementTypeFilter !== 'all' || sourceTypeFilter !== 'all'
            ? `Keresési eredmény: ${totalCount} készletmozgás` 
            : `Összesen ${totalCount} készletmozgás`
          }
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={pageSize}
              onChange={handlePageSizeChange}
              displayEmpty
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            Oldal mérete
          </Typography>
        </Box>
        
        <Pagination
          count={totalPages}
          page={clientPage}
          onChange={handlePageChange}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    </Box>
  )
}
