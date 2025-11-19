'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Breadcrumbs, Chip, CircularProgress, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, InputAdornment, Checkbox, Button, Tooltip, Pagination, Select, MenuItem, FormControl
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Search as SearchIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useDebounce } from '@/hooks/useDebounce'

interface ShipmentRow {
  id: string
  shipment_number: string
  po_number: string
  purchase_order_id: string
  status: string
  partner_name: string
  warehouse_name: string
  items_count: number
  net_total: number
  gross_total: number
  created_at: string
  shipment_date: string | null
  deleted_at: string | null
  has_stock_movements?: boolean
}

interface ShipmentsListClientProps {
  initialShipments: ShipmentRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialStatusFilter: string
  initialPageSize: number
}

export default function ShipmentsListClient({ 
  initialShipments,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialStatusFilter,
  initialPageSize = 50
}: ShipmentsListClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState<ShipmentRow[]>(initialShipments)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [partnerSearch, setPartnerSearch] = useState<string>(initialSearchTerm)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [mounted, setMounted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const debouncedSearchTerm = useDebounce(partnerSearch, 500)

  // Fetch total counts for filters (always show total, not filtered count)
  const [statusCounts, setStatusCounts] = useState({
    all: totalCount,
    draft: 0,
    received: 0,
    cancelled: 0
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch filter counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Fetch all non-deleted and deleted shipments separately
        const [allRes, cancelledRes] = await Promise.all([
          fetch('/api/shipments?status=all'),
          fetch('/api/shipments?status=cancelled')
        ])
        const [allData, cancelledData] = await Promise.all([
          allRes.json(),
          cancelledRes.json()
        ])
        
        if (allRes.ok && cancelledRes.ok) {
          const allNonDeleted = allData.shipments || []
          const allDeleted = cancelledData.shipments || []
          setStatusCounts({
            all: allNonDeleted.length,
            draft: allNonDeleted.filter((r: ShipmentRow) => r.status === 'draft').length,
            received: allNonDeleted.filter((r: ShipmentRow) => r.status === 'received').length,
            cancelled: allDeleted.length
          })
        }
      } catch (e) {
        console.error('Error fetching filter counts:', e)
      }
    }
    fetchCounts()
  }, [])

  // Update rows when initialShipments changes (from server-side pagination)
  useEffect(() => {
    setRows(initialShipments)
    setClientPage(currentPage)
  }, [initialShipments, currentPage])

  // Handle filter changes - navigate to page 1 with new filters
  const handleFilterChange = (newStatus: string) => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (newStatus !== 'all') params.set('status', newStatus)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/shipments?${params.toString()}`)
  }

  // Handle search - navigate to page 1 with search term
  useEffect(() => {
    if (!mounted) return
    
    const params = new URLSearchParams()
    params.set('page', '1')
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/shipments?${params.toString()}`)
  }, [debouncedSearchTerm, mounted, router, statusFilter, pageSize])

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/shipments?${params.toString()}`)
  }

  // Handle page size change
  const handlePageSizeChange = (event: any) => {
    const newPageSize = parseInt(event.target.value, 10)
    setPageSize(newPageSize)
    const params = new URLSearchParams()
    params.set('page', '1') // Reset to first page
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    params.set('limit', newPageSize.toString())
    router.push(`/shipments?${params.toString()}`)
  }


  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    
    // Check if any selected shipment has stock movements or invalid status
    const selectedShipments = Array.from(selectedIds).map(id => rows.find(r => r.id === id)).filter(Boolean) as ShipmentRow[]
    const hasStockMovements = selectedShipments.some(s => s.has_stock_movements)
    const invalidStatus = selectedShipments.some(s => s.status !== 'draft')
    
    if (hasStockMovements) {
      toast.warning('A kiválasztott szállítmányok közül van olyan, amelyhez már történt bevételezés. Ezek nem törölhetők.')
      return
    }
    
    if (invalidStatus) {
      toast.warning('Csak várakozó státuszú szállítmányok törölhetők.')
      return
    }
    
    setBusy(true)
    try {
      const res = await fetch('/api/shipments/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.warning(data?.error || 'Hiba a törléskor')
        throw new Error(data?.error || 'Hiba a törléskor')
      }
      
      const deletedCount = data.deleted_count || 0
      toast.success(`Törölve: ${deletedCount}`)
      setSelectedIds(new Set())
      // Refresh the page to show updated data
      router.refresh()
    } catch (e) {
      console.error(e)
      // Error toast already shown above if it was a 400
      if (!(e instanceof Error && e.message.includes('bevételezés'))) {
        toast.error('Hiba a törlés során')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary">Beszerzés</Typography>
        <Typography color="text.primary">Szállítmányok</Typography>
      </Breadcrumbs>

      {/* Status chips row */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${statusCounts.all})`}
          onClick={() => {
            setStatusFilter('all')
            handleFilterChange('all')
          }}
          color={statusFilter === 'all' ? 'primary' : 'default'}
          variant={statusFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Várakozik (${statusCounts.draft})`}
          onClick={() => {
            setStatusFilter('draft')
            handleFilterChange('draft')
          }}
          color={statusFilter === 'draft' ? 'warning' : 'default'}
          variant={statusFilter === 'draft' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Bevételezve (${statusCounts.received})`}
          onClick={() => {
            setStatusFilter('received')
            handleFilterChange('received')
          }}
          color={statusFilter === 'received' ? 'success' : 'default'}
          variant={statusFilter === 'received' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.cancelled})`}
          onClick={() => {
            setStatusFilter('cancelled')
            handleFilterChange('cancelled')
          }}
          color={statusFilter === 'cancelled' ? 'error' : 'default'}
          variant={statusFilter === 'cancelled' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Search */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés beszállító neve szerint..."
          value={partnerSearch}
          onChange={(e) => setPartnerSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'primary.lighter', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedIds.size} kijelölve):
          </Typography>
          {(() => {
            const selectedShipments = Array.from(selectedIds).map(id => rows.find(r => r.id === id)).filter(Boolean) as ShipmentRow[]
            const hasStockMovements = selectedShipments.some(s => s.has_stock_movements)
            const invalidStatus = selectedShipments.some(s => s.status !== 'draft')
            const isDisabled = busy || hasStockMovements || invalidStatus
            
            const button = (
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                disabled={isDisabled}
                size="small"
              >
                Törlés
              </Button>
            )
            
            if (hasStockMovements) {
              return (
                <Tooltip title="A kiválasztott szállítmányok közül van olyan, amelyhez már történt bevételezés. Ezek nem törölhetők.">
                  <span>{button}</span>
                </Tooltip>
              )
            }
            
            if (invalidStatus) {
              return (
                <Tooltip title="Csak várakozó státuszú szállítmányok törölhetők.">
                  <span>{button}</span>
                </Tooltip>
              )
            }
            
            return button
          })()}
        </Box>
      )}

      <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.size === rows.length && rows.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < rows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(rows.map(r => r.id)))
                      } else {
                        setSelectedIds(new Set())
                      }
                    }}
                  />
                </TableCell>
                <TableCell>SZ szám</TableCell>
                <TableCell>PO szám</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell>Partner</TableCell>
                <TableCell>Raktár</TableCell>
                <TableCell align="right">Tételek száma</TableCell>
                <TableCell align="right">Nettó összesen</TableCell>
                <TableCell align="right">Bruttó összesen</TableCell>
                <TableCell>Létrehozva</TableCell>
                <TableCell>Szállítmány dátuma</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    Nincs megjeleníthető szállítmány.
                  </TableCell>
                </TableRow>
              ) : rows.map(row => {
                const isSelected = selectedIds.has(row.id)
                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isSelected}
                    onClick={() => router.push(`/shipments/${row.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds(prev => {
                            const copy = new Set(prev)
                            if (copy.has(row.id)) copy.delete(row.id)
                            else copy.add(row.id)
                            return copy
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell><strong>{row.shipment_number}</strong></TableCell>
                    <TableCell>
                      <Link
                        component={NextLink}
                        href={`/purchase-order/${row.purchase_order_id}`}
                        onClick={(e) => e.stopPropagation()}
                        underline="hover"
                      >
                        {row.po_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.status === 'draft' ? 'Várakozik' : row.status === 'received' ? 'Bevételezve' : row.status === 'cancelled' ? 'Törölve' : row.status} 
                        size="small"
                        color={
                          row.status === 'draft' ? 'warning' :
                          row.status === 'received' ? 'success' :
                          row.status === 'cancelled' ? 'error' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{row.partner_name}</TableCell>
                    <TableCell>{row.warehouse_name}</TableCell>
                    <TableCell align="right">{row.items_count}</TableCell>
                    <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(row.net_total)} Ft</TableCell>
                    <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(row.gross_total)} Ft</TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('hu-HU') : ''}</TableCell>
                    <TableCell>{row.shipment_date ? new Date(row.shipment_date).toLocaleDateString('hu-HU') : '-'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {debouncedSearchTerm || statusFilter !== 'all'
            ? `Keresési eredmény: ${totalCount} szállítmány` 
            : `Összesen ${totalCount} szállítmány`
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

