'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  Tooltip
} from '@mui/material'
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalShipping as LocalShippingIcon
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
}

// Status chip component for shipments
function ShipmentStatusChip({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'default'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Várakozik'
      case 'completed':
        return 'Bevételezve'
      case 'cancelled':
        return 'Törölve'
      default:
        return status
    }
  }

  return (
    <Chip
      label={getStatusLabel(status)}
      color={getStatusColor(status) as any}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}

export default function ShipmentsTable({
  initialShipments,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialSearch
}: ShipmentsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL state management
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const debouncedSearchTerm = useDebounce(searchTerm, 600)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [shipments, setShipments] = useState<Shipment[]>(initialShipments)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; shipment: Shipment } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    if (currentPage > 1) params.set('page', currentPage.toString())
    params.set('limit', limit.toString())

    const newUrl = `/shipments?${params.toString()}`
    if (window.location.pathname + window.location.search !== newUrl) {
      router.push(newUrl)
    }
  }, [debouncedSearchTerm, statusFilter, currentPage, limit, router])

  // Fetch data when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
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
  }, [debouncedSearchTerm, statusFilter, currentPage, limit])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/shipments?${params.toString()}`)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(shipments.map(s => s.id)))
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const selectedShipments = shipments.filter(s => selectedIds.has(s.id))
    
    // Check if any selected shipment is completed
    const hasCompleted = selectedShipments.some(s => s.status === 'completed')
    if (hasCompleted) {
      toast.error('Bevételezett szállítmányok nem törölhetők')
      return
    }

    if (!confirm(`Biztosan törölni szeretné a kiválasztott ${selectedIds.size} szállítmányt?`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch('/api/shipments/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setShipments(prev => prev.filter(s => !selectedIds.has(s.id)))
      setSelectedIds(new Set())
      toast.success(`${selectedIds.size} szállítmány sikeresen törölve`)
      
      // Refresh data
      router.refresh()
    } catch (error) {
      console.error('Error bulk deleting shipments:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  const isAllSelected = shipments.length > 0 && selectedIds.size === shipments.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < shipments.length

  // Check if selected shipments can be deleted
  const canDeleteSelected = useMemo(() => {
    if (selectedIds.size === 0) return false
    const selectedShipments = shipments.filter(s => selectedIds.has(s.id))
    // Can delete if all are 'waiting' or 'cancelled', but NOT 'completed'
    return selectedShipments.every(s => s.status === 'waiting' || s.status === 'cancelled')
  }, [selectedIds, shipments])

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
        {canDeleteSelected && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
            disabled={deleting}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
          >
            Törlés ({selectedIds.size})
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Keresés (szállítmányszám, beszállító, raktár)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 300, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
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
      </Box>

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
                  disabled={shipments.length === 0}
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
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Nincs találat a keresési feltételeknek megfelelően'
                        : 'Még nincs szállítmány létrehozva'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => {
                const canDelete = shipment.status === 'waiting' || shipment.status === 'cancelled'
                
                return (
                  <TableRow
                    key={shipment.id}
                    hover
                    selected={selectedIds.has(shipment.id)}
                    onClick={() => handleRowClick(shipment)}
                    sx={{ cursor: 'pointer', '& td': { py: 1 } }}
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
    </Box>
  )
}
