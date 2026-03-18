'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
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
  Checkbox,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Menu,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalShipping as LocalShippingIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Shipment {
  id: string
  shipment_number: string
  status: string
  supplier_id: string
  suppliers: { id: string; name: string } | null
  warehouse_id: string
  warehouses: { id: string; name: string; code: string } | null
  expected_arrival_date: string | null
  actual_arrival_date: string | null
  purchased_date: string | null
  currency_id: string | null
  currencies: { id: string; name: string; code: string } | null
  created_at: string
  updated_at: string
}

interface ShipmentsTableProps {
  initialShipments: Shipment[]
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialStatus: string
  initialSearch: string
  initialSupplierId?: string
  suppliers?: Array<{ id: string; name: string }>
}

const SHIPMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  waiting: { label: 'Várakozik', color: '#ffffff', bgColor: '#78909c' },
  completed: { label: 'Bevételezve', color: '#ffffff', bgColor: '#2e7d32' },
  cancelled: { label: 'Törölve', color: '#ffffff', bgColor: '#c62828' }
}

function ShipmentStatusChip({ status }: { status: string }) {
  const config = SHIPMENT_STATUS_CONFIG[status] || { label: status, color: '#ffffff', bgColor: '#757575' }
  return (
    <Chip
      label={config.label}
      size="small"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24
      }}
    />
  )
}

const SUPPLIER_ROW_COLORS = [
  '#E3F2FD',
  '#E8F5E9',
  '#FFF8E1',
  '#FFE0B2',
  '#F3E5F5',
  '#FCE4EC',
  '#E0F2F1',
  '#E8EAF6'
]

export default function ShipmentsTable({
  initialShipments,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialSearch,
  initialSupplierId = '',
  suppliers = []
}: ShipmentsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const debouncedSearchTerm = useDebounce(searchTerm, 600)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierId || '')
  const [shipments, setShipments] = useState<Shipment[]>(initialShipments)
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; shipment: Shipment } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: (() => void) | null
  }>({ open: false, title: '', message: '', onConfirm: null })

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    if (supplierFilter) params.set('supplier_id', supplierFilter)
    if (currentPage > 1) params.set('page', currentPage.toString())
    params.set('limit', limit.toString())

    const newUrl = `/shipments?${params.toString()}`
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== newUrl) {
      router.push(newUrl)
    }
  }, [debouncedSearchTerm, statusFilter, supplierFilter, currentPage, limit, router])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
        if (supplierFilter) params.set('supplier_id', supplierFilter)
        params.set('page', currentPage.toString())
        params.set('limit', limit.toString())

        const response = await fetch(`/api/shipments?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch shipments')

        const data = await response.json()
        setShipments(data.shipments || [])
      } catch (error) {
        console.error('Error fetching shipments:', error)
        toast.error('Hiba a szállítmányok lekérdezésekor')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [debouncedSearchTerm, statusFilter, supplierFilter, currentPage, limit])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/shipments?${params.toString()}`)
  }

  const deletableShipments = useMemo(() => shipments.filter(s => s.status === 'waiting' || s.status === 'cancelled'), [shipments])
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(deletableShipments.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (shipmentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(shipmentId)) {
      newSelected.delete(shipmentId)
    } else {
      newSelected.add(shipmentId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (shipment: Shipment) => {
    router.push(`/shipments/${shipment.id}`)
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, shipment: Shipment) => {
    event.stopPropagation()
    setMenuAnchor({ el: event.currentTarget, shipment })
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleView = () => {
    if (menuAnchor) {
      router.push(`/shipments/${menuAnchor.shipment.id}`)
    }
    handleMenuClose()
  }

  const handleEdit = () => {
    if (menuAnchor) {
      router.push(`/shipments/${menuAnchor.shipment.id}`)
    }
    handleMenuClose()
  }

  const handleDelete = async () => {
    if (!menuAnchor) return

    const shipment = menuAnchor.shipment
    handleMenuClose()

    // Check if can be deleted
    if (shipment.status === 'completed') {
      toast.error('Bevételezett szállítmány nem törölhető')
      return
    }

    if (!confirm(`Biztosan törölni szeretné a ${shipment.shipment_number} szállítmányt?`)) {
      return
    }

    try {
      const response = await fetch(`/api/shipments/${shipment.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setShipments(prev => prev.filter(s => s.id !== shipment.id))
      toast.success('Szállítmány sikeresen törölve')
    } catch (error) {
      console.error('Error deleting shipment:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    }
  }

  const refreshList = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter) params.set('supplier_id', supplierFilter)
      params.set('page', currentPage.toString())
      params.set('limit', limit.toString())
      const res = await fetch(`/api/shipments?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setShipments(data.shipments || [])
      }
    } catch {
      // ignore
    }
  }, [debouncedSearchTerm, statusFilter, supplierFilter, currentPage, limit])

  const executeBulkDelete = useCallback(async () => {
    setBulkLoading(true)
    try {
      const res = await fetch('/api/shipments/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hiba a törlés során')
      await refreshList()
      setSelectedIds(new Set())
      toast.success(`${selectedIds.size} szállítmány törölve.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba a törlés során')
    } finally {
      setBulkLoading(false)
    }
  }, [selectedIds, refreshList])

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmDialog({
      open: true,
      title: 'Törlés',
      message: `Biztosan törli a ${selectedIds.size} kijelölt szállítmányt?`,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, open: false, onConfirm: null }))
        executeBulkDelete()
      }
    })
  }

  const handleConfirmDialogClose = () => {
    setConfirmDialog(prev => ({ ...prev, open: false, onConfirm: null }))
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  const isAllSelected = deletableShipments.length > 0 && selectedIds.size === deletableShipments.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < deletableShipments.length

  const selectedShipments = useMemo(() => shipments.filter(s => selectedIds.has(s.id)), [shipments, selectedIds])
  const canBulkDelete = useMemo(() => {
    if (selectedIds.size === 0) return false
    return selectedShipments.every(s => s.status === 'waiting' || s.status === 'cancelled')
  }, [selectedIds.size, selectedShipments])

  const supplierGroupIndex = useMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    shipments.forEach(s => {
      const sid = s.supplier_id || ''
      if (sid && !seen.has(sid)) {
        seen.add(sid)
        order.push(sid)
      }
    })
    return new Map(order.map((id, i) => [id, i]))
  }, [shipments])

  const hasActiveFilters = (statusFilter && statusFilter !== 'all') || !!supplierFilter || !!debouncedSearchTerm
  const handleClearFilters = () => {
    setStatusFilter('all')
    setSupplierFilter('')
    setSearchTerm('')
    router.push(`/shipments?limit=${limit}`)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Szállítmányok
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Itt kezelheti a szállítmányokat. Tekintse meg a részleteket vagy törölje a meglévőket.
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            value={statusFilter}
            label="Státusz"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">Összes</MenuItem>
            <MenuItem value="waiting">Várakozik</MenuItem>
            <MenuItem value="completed">Bevételezve</MenuItem>
            <MenuItem value="cancelled">Törölve</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Beszállító</InputLabel>
          <Select
            value={supplierFilter}
            label="Beszállító"
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <MenuItem value="">Összes</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          placeholder="Keresés: szállítmányszám, beszállító, raktár…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 320, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        {hasActiveFilters && (
          <Button size="small" onClick={handleClearFilters} sx={{ alignSelf: 'center' }}>
            Szűrők törlése
          </Button>
        )}
      </Box>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            py: 1.5,
            px: 2,
            borderRadius: 1,
            bgcolor: 'action.selected',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedIds.size} kijelölve
          </Typography>
          {bulkLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={14} />
              Folyamatban…
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
            disabled={!canBulkDelete || bulkLoading}
          >
            Törlés ({selectedIds.size})
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<ClearIcon />} onClick={() => setSelectedIds(new Set())}>
            Kijelölés törlése
          </Button>
        </Box>
      )}

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={deletableShipments.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Szállítmányszám</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Raktár</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Várható érkezés</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Tényleges érkezés</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, width: 50 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <LocalShippingIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchTerm || statusFilter !== 'all' || supplierFilter
                        ? 'Nincs találat a keresési feltételeknek megfelelően'
                        : 'Még nincs szállítmány létrehozva'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => {
                const canDelete = shipment.status === 'waiting' || shipment.status === 'cancelled'
                const groupIdx = supplierGroupIndex.get(shipment.supplier_id || '') ?? 0
                const rowBg = SUPPLIER_ROW_COLORS[groupIdx % SUPPLIER_ROW_COLORS.length]
                return (
                  <TableRow
                    key={shipment.id}
                    hover
                    selected={selectedIds.has(shipment.id)}
                    onClick={() => handleRowClick(shipment)}
                    sx={{
                      cursor: 'pointer',
                      '& td': { py: 1 },
                      backgroundColor: rowBg,
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                      <Checkbox
                        checked={selectedIds.has(shipment.id)}
                        onChange={(e) => handleSelectOne(shipment.id, e)}
                        disabled={!canDelete}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1 }}>
                      {shipment.shipment_number}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {shipment.suppliers?.name || '-'}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {shipment.warehouses?.name || '-'} {shipment.warehouses?.code && `(${shipment.warehouses.code})`}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <ShipmentStatusChip status={shipment.status} />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {formatDate(shipment.expected_arrival_date)}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {formatDate(shipment.actual_arrival_date)}
                    </TableCell>
                    <TableCell sx={{ py: 1, width: 50 }} onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, shipment)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          Megtekintés
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Szerkesztés
        </MenuItem>
        {menuAnchor && (menuAnchor.shipment.status === 'waiting' || menuAnchor.shipment.status === 'cancelled') && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Törlés
          </MenuItem>
        )}
      </Menu>

      <Dialog open={confirmDialog.open} onClose={handleConfirmDialogClose}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose}>Mégse</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmDialog.onConfirm?.()}
          >
            Törlés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
