'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Chip,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface BufferEntry {
  id: string
  connection_id: string
  platform_order_id: string
  platform_order_resource_id: string | null
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'blacklisted'
  is_blacklisted: boolean
  blacklist_reason: string | null
  received_at: string
  created_at: string
  updated_at: string
  connection: {
    id: string
    name: string
    api_url: string
  } | null
  order_summary: {
    customer_name: string | null
    customer_email: string | null
    total: string | null
    currency: string
    date_created: string | null
    order_status: string | null
  }
}

interface OrderBufferTableProps {
  initialEntries: BufferEntry[]
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialStatus: string
  initialConnectionId: string | null
}

export default function OrderBufferTable({
  initialEntries,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialConnectionId
}: OrderBufferTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [entries, setEntries] = useState<BufferEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entriesToDelete, setEntriesToDelete] = useState<string[]>([])
  const [creatingTest, setCreatingTest] = useState(false)

  // Fetch data
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      params.set('page', currentPage.toString())
      params.set('limit', limit.toString())
      if (initialConnectionId) {
        params.set('connection_id', initialConnectionId)
      }

      const response = await fetch(`/api/orders/buffer?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch buffer entries')

      const data = await response.json()
      setEntries(data.entries || [])
    } catch (error) {
      console.error('Error fetching buffer entries:', error)
      toast.error('Hiba a buffer bejegyzések lekérdezésekor')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, currentPage, limit, initialConnectionId])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/orders/buffer?${params.toString()}`)
  }

  const handleStatusChange = (event: any) => {
    const newStatus = event.target.value
    setStatusFilter(newStatus)
    const params = new URLSearchParams()
    params.set('status', newStatus)
    params.set('page', '1')
    router.push(`/orders/buffer?${params.toString()}`)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(entries.map(e => e.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = new Set(selectedIds)
    if (event.target.checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleProcess = async (id: string) => {
    setProcessingId(id)
    try {
      const response = await fetch(`/api/orders/buffer/${id}/process`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process buffer entry')
      }

      const data = await response.json()
      toast.success(`Rendelés létrehozva: ${data.order_number || data.order_id}`)
      
      // Refresh entries
      await fetchEntries()
    } catch (error) {
      console.error('Error processing buffer entry:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba a buffer bejegyzés feldolgozásakor')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (ids: string[]) => {
    try {
      const response = await fetch('/api/orders/buffer', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })

      if (!response.ok) throw new Error('Failed to delete buffer entries')

      toast.success(`${ids.length} bejegyzés törölve`)
      setDeleteDialogOpen(false)
      setEntriesToDelete([])
      setSelectedIds(new Set())
      await fetchEntries()
    } catch (error) {
      console.error('Error deleting buffer entries:', error)
      toast.error('Hiba a bejegyzések törlésekor')
    }
  }

  const handleCreateTest = async () => {
    setCreatingTest(true)
    try {
      const response = await fetch('/api/orders/buffer/test/create', {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create test order')
      }

      const data = await response.json()
      toast.success(`Teszt rendelés létrehozva: ${data.order_id}`)
      await fetchEntries()
    } catch (error) {
      console.error('Error creating test order:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba a teszt rendelés létrehozásakor')
    } finally {
      setCreatingTest(false)
    }
  }

  const getStatusChip = (status: string, isBlacklisted: boolean) => {
    if (isBlacklisted) {
      return <Chip icon={<BlockIcon />} label="Feketelistán" color="error" size="small" />
    }

    switch (status) {
      case 'pending':
        return <Chip icon={<WarningIcon />} label="Függőben" color="warning" size="small" />
      case 'processing':
        return <Chip icon={<CircularProgress size={16} />} label="Feldolgozás..." color="info" size="small" />
      case 'processed':
        return <Chip icon={<CheckCircleIcon />} label="Feldolgozva" color="success" size="small" />
      case 'failed':
        return <Chip icon={<CancelIcon />} label="Sikertelen" color="error" size="small" />
      default:
        return <Chip label={status} size="small" />
    }
  }

  const formatCurrency = (amount: string | null, currency: string = 'HUF') => {
    if (!amount) return '-'
    const num = parseFloat(amount)
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Rendelés puffer
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={creatingTest ? <CircularProgress size={16} /> : <AddIcon />}
            onClick={handleCreateTest}
            disabled={creatingTest || loading}
          >
            Teszt rendelés
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchEntries}
            disabled={loading}
          >
            Frissítés
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                setEntriesToDelete(Array.from(selectedIds))
                setDeleteDialogOpen(true)
              }}
            >
              Törlés ({selectedIds.size})
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            value={statusFilter}
            label="Státusz"
            onChange={handleStatusChange}
          >
            <MenuItem value="pending">Függőben</MenuItem>
            <MenuItem value="processing">Feldolgozás alatt</MenuItem>
            <MenuItem value="processed">Feldolgozva</MenuItem>
            <MenuItem value="failed">Sikertelen</MenuItem>
            <MenuItem value="blacklisted">Feketelistán</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {entries.length === 0 && !loading ? (
        <Alert severity="info">
          Nincsenek buffer bejegyzések a kiválasztott szűrőkkel.
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedIds.size > 0 && selectedIds.size < entries.length}
                      checked={entries.length > 0 && selectedIds.size === entries.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Platform rendelés ID</TableCell>
                  <TableCell>Kapcsolat</TableCell>
                  <TableCell>Vásárló</TableCell>
                  <TableCell>Összeg</TableCell>
                  <TableCell>Fogadva</TableCell>
                  <TableCell>Státusz</TableCell>
                  <TableCell align="right">Műveletek</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onChange={(e) => handleSelectOne(entry.id, e)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {entry.platform_order_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {entry.connection?.name || '-'}
                        {entry.connection?.api_url && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {entry.connection.api_url}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.order_summary.customer_name || '-'}
                        {entry.order_summary.customer_email && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {entry.order_summary.customer_email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(entry.order_summary.total, entry.order_summary.currency)}
                      </TableCell>
                      <TableCell>
                        {formatDate(entry.received_at)}
                      </TableCell>
                      <TableCell>
                        {getStatusChip(entry.status, entry.is_blacklisted)}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Részletek">
                            <IconButton
                              size="small"
                              component={NextLink}
                              href={`/orders/buffer/${entry.id}`}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {entry.status === 'pending' && !entry.is_blacklisted && (
                            <Tooltip title="Feldolgozás">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleProcess(entry.id)}
                                disabled={processingId === entry.id}
                              >
                                {processingId === entry.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <PlayArrowIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {entriesToDelete.length} bejegyzést?
            Ez a művelet nem visszavonható.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Mégse</Button>
          <Button onClick={() => handleDelete(entriesToDelete)} color="error" variant="contained">
            Törlés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
