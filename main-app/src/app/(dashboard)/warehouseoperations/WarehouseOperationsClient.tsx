'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Breadcrumbs, Chip, CircularProgress, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, InputAdornment
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { usePagePermission } from '@/hooks/usePagePermission'

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
  initialStockMovements?: StockMovementRow[]
}

export default function WarehouseOperationsClient({ initialStockMovements = [] }: WarehouseOperationsClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [allStockMovements, setAllStockMovements] = useState<StockMovementRow[]>(initialStockMovements)
  const [rows, setRows] = useState<StockMovementRow[]>(initialStockMovements)
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const { hasAccess, loading: permissionLoading } = usePagePermission('/warehouseoperations')

  // Calculate movement type counts from ALL records
  const movementTypeCounts = useMemo(() => {
    return {
      all: allStockMovements.length,
      in: allStockMovements.filter(r => r.movement_type === 'in').length,
      out: allStockMovements.filter(r => r.movement_type === 'out').length,
      adjustment: allStockMovements.filter(r => r.movement_type === 'adjustment').length
    }
  }, [allStockMovements])

  // Calculate source type counts
  const sourceTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allStockMovements.forEach(r => {
      const st = r.source_type || 'unknown'
      counts[st] = (counts[st] || 0) + 1
    })
    return counts
  }, [allStockMovements])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (movementTypeFilter && movementTypeFilter !== 'all') params.set('movement_type', movementTypeFilter)
      if (sourceTypeFilter && sourceTypeFilter !== 'all') params.set('source_type', sourceTypeFilter)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/stock-movements?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a készletmozgások lekérdezésekor')
      const fetchedRows = data.stock_movements || []
      setRows(fetchedRows)
      
      // Always fetch all records to update counts
      if (movementTypeFilter !== 'all' || sourceTypeFilter !== 'all' || search.trim()) {
        fetch('/api/stock-movements')
          .then(res => res.json())
          .then(data => {
            if (data.stock_movements) {
              setAllStockMovements(data.stock_movements)
            }
          })
          .catch(console.error)
      } else {
        setAllStockMovements(fetchedRows)
      }
    } catch (e) {
      console.error(e)
      toast.error('Hiba a készletmozgások betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialStockMovements.length === 0 || movementTypeFilter !== 'all' || sourceTypeFilter !== 'all' || search.trim()) {
      fetchRows()
    } else {
      setRows(initialStockMovements)
      setAllStockMovements(initialStockMovements)
    }
  }, [movementTypeFilter, sourceTypeFilter, search])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() || movementTypeFilter !== 'all' || sourceTypeFilter !== 'all') {
        fetchRows()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

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
      return `/pos/orders/${row.source_id}`
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
          onClick={() => setMovementTypeFilter('all')}
          color={movementTypeFilter === 'all' ? 'primary' : 'default'}
          variant={movementTypeFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Bejövő (${movementTypeCounts.in})`}
          onClick={() => setMovementTypeFilter('in')}
          color={movementTypeFilter === 'in' ? 'success' : 'default'}
          variant={movementTypeFilter === 'in' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Kimenő (${movementTypeCounts.out})`}
          onClick={() => setMovementTypeFilter('out')}
          color={movementTypeFilter === 'out' ? 'error' : 'default'}
          variant={movementTypeFilter === 'out' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Igazítás (${movementTypeCounts.adjustment})`}
          onClick={() => setMovementTypeFilter('adjustment')}
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
          label={`Összes (${allStockMovements.length})`}
          onClick={() => setSourceTypeFilter('all')}
          color={sourceTypeFilter === 'all' ? 'primary' : 'default'}
          variant={sourceTypeFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        {Object.entries(sourceTypeCounts).map(([sourceType, count]) => (
          <Chip
            key={sourceType}
            label={`${getSourceTypeLabel(sourceType)} (${count})`}
            onClick={() => setSourceTypeFilter(sourceType)}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
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
      )}
    </Box>
  )
}
