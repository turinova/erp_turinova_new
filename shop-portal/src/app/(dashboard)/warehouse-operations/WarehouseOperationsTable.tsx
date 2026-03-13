'use client'

import React, { useState, useEffect } from 'react'
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
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Link as MuiLink
} from '@mui/material'
import {
  Search as SearchIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface WarehouseOperation {
  id: string
  operation_number: string
  operation_type: string
  status: string
  shipment_id: string | null
  shipments: { id: string; shipment_number: string } | null
  warehouse_id: string
  warehouses: { id: string; name: string; code: string | null } | null
  started_at: string | null
  completed_at: string | null
  created_by_user: { id: string; email: string; full_name: string | null } | null
  completed_by_user: { id: string; email: string; full_name: string | null } | null
  note: string | null
  created_at: string
  updated_at: string
  movements_count?: number
}

interface WarehouseOperationsTableProps {
  initialWarehouseOperations: WarehouseOperation[]
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialStatus: string
  initialOperationType: string
  initialWarehouseId: string
  initialSearch: string
  warehouses: Array<{ id: string; name: string; code: string | null }>
}

// Operation type chip component
function OperationTypeChip({ type }: { type: string }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'receiving':
        return 'success' // Green
      case 'transfer':
        return 'info' // Blue
      case 'adjustment':
        return 'warning' // Orange
      case 'picking':
        return 'secondary' // Purple
      case 'return':
        return 'error' // Red
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'receiving':
        return 'Bevételezés'
      case 'transfer':
        return 'Átszállítás'
      case 'adjustment':
        return 'Kiigazítás'
      case 'picking':
        return 'Kiválasztás'
      case 'return':
        return 'Visszaküldés'
      default:
        return type
    }
  }

  return (
    <Chip
      label={getTypeLabel(type)}
      color={getTypeColor(type) as any}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  )
}

// Status chip component
function WarehouseOperationStatusChip({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'default'
      case 'in_progress':
        return 'info'
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
      case 'in_progress':
        return 'Folyamatban'
      case 'completed':
        return 'Befejezve'
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

export default function WarehouseOperationsTable({
  initialWarehouseOperations,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialOperationType,
  initialWarehouseId,
  initialSearch,
  warehouses
}: WarehouseOperationsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL state management
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const debouncedSearchTerm = useDebounce(searchTerm, 600)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [operationTypeFilter, setOperationTypeFilter] = useState(initialOperationType)
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouseId)
  const [warehouseOperations, setWarehouseOperations] = useState<WarehouseOperation[]>(initialWarehouseOperations)
  const [loading, setLoading] = useState(false)

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    if (operationTypeFilter && operationTypeFilter !== 'all') params.set('operation_type', operationTypeFilter)
    if (warehouseFilter) params.set('warehouse_id', warehouseFilter)
    if (currentPage > 1) params.set('page', currentPage.toString())
    params.set('limit', limit.toString())

    const newUrl = `/warehouse-operations?${params.toString()}`
    if (window.location.pathname + window.location.search !== newUrl) {
      router.push(newUrl)
    }
  }, [debouncedSearchTerm, statusFilter, operationTypeFilter, warehouseFilter, currentPage, limit, router])

  // Fetch data when filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
        if (operationTypeFilter && operationTypeFilter !== 'all') params.set('operation_type', operationTypeFilter)
        if (warehouseFilter) params.set('warehouse_id', warehouseFilter)
        params.set('page', currentPage.toString())
        params.set('limit', limit.toString())

        const response = await fetch(`/api/warehouse-operations?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch warehouse operations')

        const data = await response.json()
        setWarehouseOperations(data.warehouse_operations || [])
      } catch (error) {
        console.error('Error fetching warehouse operations:', error)
        toast.error('Hiba a raktári műveletek lekérdezésekor')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [debouncedSearchTerm, statusFilter, operationTypeFilter, warehouseFilter, currentPage, limit])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/warehouse-operations?${params.toString()}`)
  }

  const handleRowClick = (operation: WarehouseOperation) => {
    router.push(`/warehouse-operations/${operation.id}`)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateShort = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Raktári műveletek
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt tekintheti meg az összes raktári műveletet és a kapcsolódó készletmozgásokat.
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Keresés (műveletszám, szállítmányszám, raktár)..."
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
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Művelet típusa</InputLabel>
          <Select
            value={operationTypeFilter}
            label="Művelet típusa"
            onChange={(e) => setOperationTypeFilter(e.target.value)}
          >
            <MenuItem value="all">Összes</MenuItem>
            <MenuItem value="receiving">Bevételezés</MenuItem>
            <MenuItem value="transfer">Átszállítás</MenuItem>
            <MenuItem value="adjustment">Kiigazítás</MenuItem>
            <MenuItem value="picking">Kiválasztás</MenuItem>
            <MenuItem value="return">Visszaküldés</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            value={statusFilter}
            label="Státusz"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">Összes</MenuItem>
            <MenuItem value="waiting">Várakozik</MenuItem>
            <MenuItem value="in_progress">Folyamatban</MenuItem>
            <MenuItem value="completed">Befejezve</MenuItem>
            <MenuItem value="cancelled">Törölve</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Raktár</InputLabel>
          <Select
            value={warehouseFilter}
            label="Raktár"
            onChange={(e) => setWarehouseFilter(e.target.value)}
          >
            <MenuItem value="">Összes</MenuItem>
            {warehouses.map((warehouse) => (
              <MenuItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name} {warehouse.code && `(${warehouse.code})`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Műveletszám</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Művelet típusa</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Raktár</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Szállítmány</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Készletmozgások</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Létrehozva</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Befejezve</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Létrehozta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : warehouseOperations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchTerm || statusFilter !== 'all' || operationTypeFilter !== 'all' || warehouseFilter
                        ? 'Nincs találat a keresési feltételeknek megfelelően'
                        : 'Még nincs raktári művelet létrehozva'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              warehouseOperations.map((operation) => (
                <TableRow
                  key={operation.id}
                  hover
                  onClick={() => handleRowClick(operation)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>
                    {operation.operation_number}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <OperationTypeChip type={operation.operation_type} />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <WarehouseOperationStatusChip status={operation.status} />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {operation.warehouses?.name || '-'} {operation.warehouses?.code && `(${operation.warehouses.code})`}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {operation.shipments ? (
                      <MuiLink
                        component={NextLink}
                        href={`/shipments/${operation.shipments.id}`}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ textDecoration: 'none' }}
                      >
                        {operation.shipments.shipment_number}
                      </MuiLink>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2">
                      {operation.movements_count || 0} tétel
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {formatDate(operation.created_at)}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {formatDate(operation.completed_at)}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {operation.created_by_user?.full_name || operation.created_by_user?.email || '-'}
                  </TableCell>
                </TableRow>
              ))
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
    </Box>
  )
}
