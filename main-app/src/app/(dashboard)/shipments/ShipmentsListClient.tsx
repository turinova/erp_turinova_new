'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Breadcrumbs, Chip, CircularProgress, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, InputAdornment, Checkbox, Button, Tooltip
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Search as SearchIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

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
  initialShipments?: ShipmentRow[]
}

export default function ShipmentsListClient({ initialShipments = [] }: ShipmentsListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Store ALL records (including deleted) for accurate counts
  const [allShipments, setAllShipments] = useState<ShipmentRow[]>(initialShipments)
  // Filtered/displayed records - by default show only non-deleted
  const [rows, setRows] = useState<ShipmentRow[]>(initialShipments.filter(s => !s.deleted_at))
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [partnerSearch, setPartnerSearch] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Calculate status counts from ALL records, not filtered rows
  const statusCounts = useMemo(() => {
    const nonDeletedRows = allShipments.filter(r => !r.deleted_at)
    const deletedRows = allShipments.filter(r => r.deleted_at)
    
    return {
      all: nonDeletedRows.length,
      draft: nonDeletedRows.filter(r => r.status === 'draft').length,
      received: nonDeletedRows.filter(r => r.status === 'received').length,
      cancelled: deletedRows.length
    }
  }, [allShipments])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (partnerSearch.trim()) params.set('search', partnerSearch.trim())
      const res = await fetch(`/api/shipments?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a szállítmányok lekérdezésekor')
      const fetchedRows = data.shipments || []
      setRows(fetchedRows)
      
      // Always fetch all records (including deleted) to update counts
      // Need to fetch both non-deleted and deleted shipments
      Promise.all([
        fetch('/api/shipments?status=all').then(res => res.json()),
        fetch('/api/shipments?status=cancelled').then(res => res.json())
      ])
        .then(([allData, cancelledData]) => {
          const allNonDeleted = allData.shipments || []
          const allDeleted = cancelledData.shipments || []
          // Merge and deduplicate by id
          const merged = [...allNonDeleted, ...allDeleted]
          const unique = Array.from(new Map(merged.map(s => [s.id, s])).values())
          setAllShipments(unique)
        })
        .catch(console.error)
    } catch (e) {
      console.error(e)
      toast.error('Hiba a szállítmányok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  // Only fetch if we don't have initial data or when filters change
  useEffect(() => {
    if (initialShipments.length === 0 || statusFilter !== 'all' || partnerSearch.trim()) {
      fetchRows()
    } else {
      // Use initial data when no filters are applied
      // Show only non-deleted in rows, but keep all in allShipments for counts
      setRows(initialShipments.filter(s => !s.deleted_at))
      setAllShipments(initialShipments)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])
  
  useEffect(() => {
    if (partnerSearch.trim()) {
      const h = setTimeout(() => { fetchRows() }, 400)
      return () => clearTimeout(h)
    } else if (initialShipments.length > 0 && statusFilter === 'all') {
      // Reset to initial data when search is cleared and no status filter
      // Show only non-deleted in rows, but keep all in allShipments for counts
      setRows(initialShipments.filter(s => !s.deleted_at))
      setAllShipments(initialShipments)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerSearch])

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
      // Refresh both filtered rows and all records
      fetchRows()
      // Also fetch all records to update counts (including deleted)
      if (statusFilter !== 'all' || partnerSearch.trim()) {
        Promise.all([
          fetch('/api/shipments?status=all').then(res => res.json()),
          fetch('/api/shipments?status=cancelled').then(res => res.json())
        ])
          .then(([allData, cancelledData]) => {
            const allNonDeleted = allData.shipments || []
            const allDeleted = cancelledData.shipments || []
            // Merge and deduplicate by id
            const merged = [...allNonDeleted, ...allDeleted]
            const unique = Array.from(new Map(merged.map(s => [s.id, s])).values())
            setAllShipments(unique)
          })
          .catch(console.error)
      }
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
          onClick={() => setStatusFilter('all')}
          color={statusFilter === 'all' ? 'primary' : 'default'}
          variant={statusFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Várakozik (${statusCounts.draft})`}
          onClick={() => setStatusFilter('draft')}
          color={statusFilter === 'draft' ? 'warning' : 'default'}
          variant={statusFilter === 'draft' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Bevételezve (${statusCounts.received})`}
          onClick={() => setStatusFilter('received')}
          color={statusFilter === 'received' ? 'success' : 'default'}
          variant={statusFilter === 'received' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.cancelled})`}
          onClick={() => setStatusFilter('cancelled')}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
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
      )}
    </Box>
  )
}

