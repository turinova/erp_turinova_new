'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Button, Breadcrumbs, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel, Link, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, Checkbox, InputAdornment, Tooltip, Pagination
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Add as AddIcon, Check as ApproveIcon, Delete as DeleteIcon, Search as SearchIcon, LocalShipping as ShippingIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useDebounce } from '@/hooks/useDebounce'

interface ShipmentInfo {
  id: string
  number: string
}

interface PurchaseOrderRow {
  id: string
  po_number: string
  status: string
  partner_name: string
  items_count: number
  net_total: number | null
  created_at: string
  expected_date: string | null
  shipments: ShipmentInfo[]
  has_stock_movements?: boolean
}

interface PurchaseOrderListClientProps {
  initialPurchaseOrders: PurchaseOrderRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialStatusFilter: string
  initialPageSize: number
}

export default function PurchaseOrderListClient({ 
  initialPurchaseOrders,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialStatusFilter,
  initialPageSize = 50
}: PurchaseOrderListClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState<PurchaseOrderRow[]>(initialPurchaseOrders)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [partnerSearch, setPartnerSearch] = useState<string>(initialSearchTerm)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [mounted, setMounted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [shipmentConfirmOpen, setShipmentConfirmOpen] = useState(false)
  const [pendingShipmentPoId, setPendingShipmentPoId] = useState<string | null>(null)
  const debouncedSearchTerm = useDebounce(partnerSearch, 500)

  // Fetch total counts for filters (always show total, not filtered count)
  const [statusCounts, setStatusCounts] = useState({
    all: totalCount,
    draft: 0,
    confirmed: 0,
    partial: 0,
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
        const res = await fetch('/api/purchase-order')
        const data = await res.json()
        if (res.ok && data.purchase_orders) {
          const all = data.purchase_orders
          setStatusCounts({
            all: all.length,
            draft: all.filter((r: PurchaseOrderRow) => r.status === 'draft').length,
            confirmed: all.filter((r: PurchaseOrderRow) => r.status === 'confirmed').length,
            partial: all.filter((r: PurchaseOrderRow) => r.status === 'partial').length,
            received: all.filter((r: PurchaseOrderRow) => r.status === 'received').length,
            cancelled: all.filter((r: PurchaseOrderRow) => r.status === 'cancelled').length
          })
        }
      } catch (e) {
        console.error('Error fetching filter counts:', e)
      }
    }
    fetchCounts()
  }, [])

  // Update rows when initialPurchaseOrders changes (from server-side pagination)
  useEffect(() => {
    setRows(initialPurchaseOrders)
    setClientPage(currentPage)
  }, [initialPurchaseOrders, currentPage])

  // Handle filter changes - navigate to page 1 with new filters
  const handleFilterChange = (newStatus: string) => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (newStatus !== 'all') params.set('status', newStatus)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/purchase-order?${params.toString()}`)
  }

  // Handle search - navigate to page 1 with search term
  useEffect(() => {
    if (!mounted) return
    
    const params = new URLSearchParams()
    params.set('page', '1')
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/purchase-order?${params.toString()}`)
  }, [debouncedSearchTerm, mounted, router, statusFilter, pageSize])

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (debouncedSearchTerm.trim()) params.set('search', debouncedSearchTerm.trim())
    if (pageSize !== 50) params.set('limit', pageSize.toString())
    router.push(`/purchase-order?${params.toString()}`)
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
    router.push(`/purchase-order?${params.toString()}`)
  }


  const handleApprove = async () => {
    if (selectedIds.size === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/purchase-order/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), new_status: 'confirmed' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a jóváhagyáskor')
      toast.success(`Jóváhagyva: ${data.updated_count}`)
      setSelectedIds(new Set())
      // Refresh the page to show updated data
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a jóváhagyás során')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateShipment = () => {
    if (selectedIds.size !== 1) return
    const poId = Array.from(selectedIds)[0]
    const selectedPo = rows.find(r => r.id === poId)
    if (!selectedPo || selectedPo.status !== 'confirmed') {
      toast.warning('Csak visszaigazolt (confirmed) rendelésből hozhatsz létre szállítmányt')
      return
    }
    setPendingShipmentPoId(poId)
    setShipmentConfirmOpen(true)
  }

  const handleConfirmCreateShipment = async () => {
    if (!pendingShipmentPoId) return
    setShipmentConfirmOpen(false)
    setBusy(true)
    try {
      const res = await fetch('/api/shipments/from-purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_order_id: pendingShipmentPoId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a szállítmány létrehozásakor')
      toast.success('Szállítmány létrehozva')
      setSelectedIds(new Set())
      setPendingShipmentPoId(null)
      router.push(`/shipments/${data.id}`)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Hiba a szállítmány létrehozásakor')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    
    // Check if any selected PO has stock movements or invalid status
    const selectedPos = Array.from(selectedIds).map(id => rows.find(r => r.id === id)).filter(Boolean) as PurchaseOrderRow[]
    const hasStockMovements = selectedPos.some(po => po.has_stock_movements)
    const invalidStatus = selectedPos.some(po => !['draft', 'confirmed'].includes(po.status))
    
    if (hasStockMovements) {
      toast.warning('A kiválasztott rendelések közül van olyan, amelyhez már történt bevételezés. Ezek nem törölhetők.')
      return
    }
    
    if (invalidStatus) {
      toast.warning('Csak vázlat vagy visszaigazolt státuszú rendelések törölhetők.')
      return
    }
    
    setBusy(true)
    try {
      const res = await fetch('/api/purchase-order/bulk-delete', {
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
      const cancelledCount = data.cancelled_count || 0
      
      if (deletedCount > 0 && cancelledCount > 0) {
        toast.success(`Törölve: ${deletedCount}, Törölve: ${cancelledCount}`)
      } else if (deletedCount > 0) {
        toast.success(`Törölve: ${deletedCount}`)
      } else if (cancelledCount > 0) {
        toast.success(`Törölve: ${cancelledCount}`)
      }
      
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
        <Typography color="text.primary">Beszállítói rendelések</Typography>
      </Breadcrumbs>

      {/* Status chips row (like Orders) */}
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
          label={`Megrendelve (${statusCounts.confirmed})`}
          onClick={() => {
            setStatusFilter('confirmed')
            handleFilterChange('confirmed')
          }}
          color={statusFilter === 'confirmed' ? 'success' : 'default'}
          variant={statusFilter === 'confirmed' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Részben beérkezett (${statusCounts.partial})`}
          onClick={() => {
            setStatusFilter('partial')
            handleFilterChange('partial')
          }}
          color={statusFilter === 'partial' ? 'info' : 'default'}
          variant={statusFilter === 'partial' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Beérkezett (${statusCounts.received})`}
          onClick={() => {
            setStatusFilter('received')
            handleFilterChange('received')
          }}
          color={statusFilter === 'received' ? 'primary' : 'default'}
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

      {/* Search and actions */}
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/purchase-order/new')}
        >
          Új beszállítói rendelés
        </Button>
      </Stack>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'primary.lighter', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedIds.size} kijelölve):
          </Typography>
          {(() => {
            const selectedPos = Array.from(selectedIds).map(id => rows.find(r => r.id === id)).filter(Boolean) as PurchaseOrderRow[]
            const allAreDraft = selectedPos.length > 0 && selectedPos.every(po => po.status === 'draft')
            
            if (!allAreDraft) return null
            
            return (
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={handleApprove}
                disabled={busy}
                size="small"
              >
                Jóváhagyás
              </Button>
            )
          })()}
          {selectedIds.size === 1 && (() => {
            const selectedPo = rows.find(r => r.id === Array.from(selectedIds)[0])
            const hasShipments = selectedPo?.shipments && selectedPo.shipments.length > 0
            return selectedPo?.status === 'confirmed' && !hasShipments ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={<ShippingIcon />}
                onClick={handleCreateShipment}
                disabled={busy}
                size="small"
              >
                Szállítmány létrehozás
              </Button>
            ) : null
          })()}
          {(() => {
            const selectedPos = Array.from(selectedIds).map(id => rows.find(r => r.id === id)).filter(Boolean) as PurchaseOrderRow[]
            const hasStockMovements = selectedPos.some(po => po.has_stock_movements)
            const invalidStatus = selectedPos.some(po => !['draft', 'confirmed'].includes(po.status))
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
                <Tooltip title="A kiválasztott rendelések közül van olyan, amelyhez már történt bevételezés. Ezek nem törölhetők.">
                  <span>{button}</span>
                </Tooltip>
              )
            }
            
            if (invalidStatus) {
              return (
                <Tooltip title="Csak vázlat vagy visszaigazolt státuszú rendelések törölhetők.">
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
                <TableCell>Beszerzési rendelés szám</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell>Beszállító</TableCell>
                <TableCell align="right">Tételek száma</TableCell>
                <TableCell align="right">Nettó összesen</TableCell>
                <TableCell>Létrehozva</TableCell>
                <TableCell>Várható időpont</TableCell>
                <TableCell>Szállítmányok</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Nincs megjeleníthető beszerzési rendelés.
                  </TableCell>
                </TableRow>
              ) : rows.map(row => {
                const isSelected = selectedIds.has(row.id)
                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isSelected}
                    onClick={() => router.push(`/purchase-order/${row.id}`)}
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
                    <TableCell>{row.po_number}</TableCell>
                    <TableCell>
                      {(() => {
                        const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
                          draft: { label: 'Várakozik', color: 'warning' },
                          confirmed: { label: 'Megrendelve', color: 'success' },
                          partial: { label: 'Részben beérkezett', color: 'info' },
                          received: { label: 'Beérkezett', color: 'primary' },
                          cancelled: { label: 'Törölve', color: 'error' }
                        }
                        const statusInfo = statusMap[row.status] || { label: row.status, color: 'default' as const }
                        return (
                          <Chip 
                            label={statusInfo.label} 
                            size="small" 
                            color={statusInfo.color}
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell>{row.partner_name}</TableCell>
                    <TableCell align="right">{row.items_count}</TableCell>
                    <TableCell align="right">{row.net_total ? new Intl.NumberFormat('hu-HU').format(row.net_total) + ' Ft' : '-'}</TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('hu-HU') : ''}</TableCell>
                    <TableCell>{row.expected_date ? new Date(row.expected_date).toLocaleDateString('hu-HU') : '-'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {row.shipments && row.shipments.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.shipments.map((shipment) => (
                            <Link
                              key={shipment.id}
                              component={NextLink}
                              href={`/shipments/${shipment.id}`}
                              underline="hover"
                              onClick={(e) => e.stopPropagation()}
                              sx={{ fontWeight: 500 }}
                            >
                              {shipment.number}
                            </Link>
                          ))}
                        </Box>
                      ) : (
                        '-'
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
          {debouncedSearchTerm || statusFilter !== 'all'
            ? `Keresési eredmény: ${totalCount} rendelés` 
            : `Összesen ${totalCount} rendelés`
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

      {/* Shipment Creation Confirmation Dialog */}
      <Dialog
        open={shipmentConfirmOpen}
        onClose={() => {
          setShipmentConfirmOpen(false)
          setPendingShipmentPoId(null)
        }}
        aria-labelledby="shipment-dialog-title"
        aria-describedby="shipment-dialog-description"
      >
        <DialogTitle id="shipment-dialog-title">
          Szállítmány létrehozása
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="shipment-dialog-description">
            Biztosan létre szeretnéd hozni a szállítmányt ehhez a beszerzési rendeléshez?
            A szállítmány létrehozása után a rendelés tételei a szállítmányhoz lesznek kapcsolva.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShipmentConfirmOpen(false)
              setPendingShipmentPoId(null)
            }}
            disabled={busy}
          >
            Mégse
          </Button>
          <Button
            onClick={handleConfirmCreateShipment}
            variant="contained"
            color="primary"
            disabled={busy}
            startIcon={busy ? <CircularProgress size={18} /> : <ShippingIcon />}
          >
            {busy ? 'Létrehozás...' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}


