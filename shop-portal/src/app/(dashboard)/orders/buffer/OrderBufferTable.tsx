'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  CircularProgress,
  Checkbox,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Popover,
  Link,
  TextField,
  Chip
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon
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
    payment_method_name: string | null
    shipping_method_name: string | null
    product_count?: number
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
  initialDateFrom?: string
  initialDateTo?: string
  initialShippingMethod?: string
}

function formatWaitingTime(receivedAt: string): string {
  const received = new Date(receivedAt).getTime()
  const now = Date.now()
  const diffMs = now - received
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'most'
  if (diffMins < 60) return `${diffMins} perc`
  if (diffHours < 24) return `${diffHours} óra`
  if (diffDays === 1) return '1 nap'
  return `${diffDays} nap`
}

/** Returns 'fresh' | 'medium' | 'old' for waiting time chip color */
function getWaitingTier(receivedAt: string): 'fresh' | 'medium' | 'old' {
  const diffMs = Date.now() - new Date(receivedAt).getTime()
  const diffHours = diffMs / 3600000
  if (diffHours < 1) return 'fresh'
  if (diffHours < 24) return 'medium'
  return 'old'
}

const METHOD_CHIP_PALETTE = [
  { bgcolor: 'rgba(25, 118, 210, 0.12)', color: '#1565c0', borderColor: 'rgba(25, 118, 210, 0.35)' },
  { bgcolor: 'rgba(94, 53, 177, 0.12)', color: '#5e35b1', borderColor: 'rgba(94, 53, 177, 0.35)' },
  { bgcolor: 'rgba(0, 121, 107, 0.12)', color: '#00695c', borderColor: 'rgba(0, 121, 107, 0.35)' },
  { bgcolor: 'rgba(230, 81, 0, 0.12)', color: '#e65100', borderColor: 'rgba(230, 81, 0, 0.35)' },
  { bgcolor: 'rgba(121, 85, 72, 0.12)', color: '#5d4037', borderColor: 'rgba(121, 85, 72, 0.35)' },
  { bgcolor: 'rgba(26, 35, 126, 0.12)', color: '#1a237e', borderColor: 'rgba(26, 35, 126, 0.35)' }
]

function chipStyleForMethod(value: string): (typeof METHOD_CHIP_PALETTE)[0] {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash) + value.charCodeAt(i)
  return METHOD_CHIP_PALETTE[Math.abs(hash) % METHOD_CHIP_PALETTE.length]
}

const FULFILLABILITY_LABELS: Record<string, string> = {
  all: 'Raktáron',
  partial: 'Részben',
  none: 'Hiány',
  unknown: 'Ellenőrzés'
}

export default function OrderBufferTable({
  initialEntries,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialConnectionId,
  initialDateFrom = '',
  initialDateTo = '',
  initialShippingMethod = ''
}: OrderBufferTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [entries, setEntries] = useState<BufferEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter] = useState(initialStatus)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [shippingMethodFilter, setShippingMethodFilter] = useState(initialShippingMethod)
  const [fulfillabilityFilter, setFulfillabilityFilter] = useState<string>('')
  const [shippingMethods, setShippingMethods] = useState<string[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entriesToDelete, setEntriesToDelete] = useState<string[]>([])
  const [stockSummaries, setStockSummaries] = useState<Record<string, 'all' | 'partial' | 'none' | 'unknown'>>({})
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)
  const [popoverEntryId, setPopoverEntryId] = useState<string | null>(null)
  const [stockDetailItems, setStockDetailItems] = useState<Array<{ product_name: string; quantity_ordered: number; quantity_available: number; quantity_needed: number }>>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      params.set('page', currentPage.toString())
      params.set('limit', limit.toString())
      if (initialConnectionId) params.set('connection_id', initialConnectionId)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (shippingMethodFilter) params.set('shipping_method', shippingMethodFilter)

      const response = await fetch(`/api/orders/buffer?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch buffer entries')
      const data = await response.json()
      const list = data.entries || []
      setEntries(list)
      if (list.length > 0 && statusFilter === 'pending') {
        const ids = list.map((e: BufferEntry) => e.id).slice(0, 50)
        const sumRes = await fetch(`/api/orders/buffer/stock-summaries?ids=${ids.join(',')}`)
        if (sumRes.ok) {
          const { summaries } = await sumRes.json()
          setStockSummaries(summaries || {})
        } else {
          setStockSummaries({})
        }
      } else {
        setStockSummaries({})
      }
    } catch (error) {
      console.error('Error fetching buffer entries:', error)
      toast.error('Hiba a buffer bejegyzések lekérdezésekor')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, currentPage, limit, initialConnectionId, dateFrom, dateTo, shippingMethodFilter])

  const fetchShippingMethods = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (initialConnectionId) params.set('connection_id', initialConnectionId)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await fetch(`/api/orders/buffer/filters?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setShippingMethods(data.shipping_methods || [])
      }
    } catch {
      setShippingMethods([])
    }
  }, [statusFilter, initialConnectionId, dateFrom, dateTo])

  useEffect(() => {
    fetchShippingMethods()
  }, [fetchShippingMethods])

  useEffect(() => {
    setEntries(initialEntries)
    setDateFrom(initialDateFrom)
    setDateTo(initialDateTo)
    setShippingMethodFilter(initialShippingMethod)
  }, [initialEntries, initialDateFrom, initialDateTo, initialShippingMethod])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const displayEntries = fulfillabilityFilter
    ? entries.filter(e => (stockSummaries[e.id] || 'unknown') === fulfillabilityFilter)
    : entries

  const availableFulfillability = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => {
      set.add(stockSummaries[e.id] ?? 'unknown')
    })
    return Array.from(set).sort((a, b) => {
      const order = ['all', 'partial', 'none', 'unknown']
      return order.indexOf(a) - order.indexOf(b)
    })
  }, [entries, stockSummaries])

  const applyFiltersToUrl = useCallback((updates: { page?: number; date_from?: string; date_to?: string; shipping_method?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (updates.page != null) params.set('page', String(updates.page))
    if (updates.date_from !== undefined) updates.date_from ? params.set('date_from', updates.date_from) : params.delete('date_from')
    if (updates.date_to !== undefined) updates.date_to ? params.set('date_to', updates.date_to) : params.delete('date_to')
    if (updates.shipping_method !== undefined) updates.shipping_method ? params.set('shipping_method', updates.shipping_method) : params.delete('shipping_method')
    router.push(`/orders/buffer?${params.toString()}`)
  }, [router, searchParams])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    applyFiltersToUrl({ page })
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const visibleIds = displayEntries.map(e => e.id)
    setSelectedIds(event.target.checked ? new Set(visibleIds) : new Set())
  }

  const handleSelectOne = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const next = new Set(selectedIds)
    if (event.target.checked) next.add(id)
    else next.delete(id)
    setSelectedIds(next)
  }

  const handleProcess = async (id: string) => {
    setProcessingId(id)
    try {
      const response = await fetch(`/api/orders/buffer/${id}/process`, { method: 'POST' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process buffer entry')
      }
      const data = await response.json()
      toast.success(`Rendelés létrehozva: ${data.order_number || data.order_id}`)
      await fetchEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hiba a feldolgozás során')
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
      toast.error('Hiba a bejegyzések törlésekor')
    }
  }

  const formatCurrency = (amount: string | null, currency: string = 'HUF') => {
    if (!amount) return '—'
    const num = parseFloat(amount)
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('hu-HU', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleOpenFulfillability = async (event: React.MouseEvent<HTMLElement>, entryId: string) => {
    event.stopPropagation()
    setPopoverAnchor(event.currentTarget)
    setPopoverEntryId(entryId)
    setStockDetailItems([])
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/orders/buffer/${entryId}/stock-detail`)
      if (res.ok) {
        const data = await res.json()
        const items = data.items || []
        setStockDetailItems(items)
        // Cache summary for this row so pill shows without another fetch (list stays fast)
        if (items.length > 0) {
          let allOk = true
          let anyOk = false
          items.forEach((it: { quantity_available: number; quantity_needed: number }) => {
            if (it.quantity_available >= it.quantity_needed) anyOk = true
            else allOk = false
          })
          const summary: 'all' | 'partial' | 'none' = allOk && anyOk ? 'all' : anyOk ? 'partial' : 'none'
          setStockSummaries(prev => ({ ...prev, [entryId]: summary }))
        }
      }
    } catch {
      setStockDetailItems([])
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCloseFulfillability = () => {
    setPopoverAnchor(null)
    setPopoverEntryId(null)
    setStockDetailItems([])
  }

  const syncFiltersToUrl = () => {
    applyFiltersToUrl({ page: 1, date_from: dateFrom, date_to: dateTo, shipping_method: shippingMethodFilter })
  }

  return (
    <Box>
      {/* Filters + bulk delete only */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <TextField
            size="small"
            label="Létrehozva ettől"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            onBlur={syncFiltersToUrl}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            label="Létrehozva eddig"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            onBlur={syncFiltersToUrl}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="buffer-shipping-label">Szállítási mód</InputLabel>
            <Select
              labelId="buffer-shipping-label"
              value={shippingMethodFilter}
              label="Szállítási mód"
              onChange={e => {
                setShippingMethodFilter(e.target.value)
                applyFiltersToUrl({ page: 1, shipping_method: e.target.value })
              }}
              sx={{ bgcolor: '#fafbfc', borderRadius: 1, border: '1px solid', borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <MenuItem value="">Mind</MenuItem>
              {shippingMethods.map(name => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
              Teljesíthetőség:
            </Typography>
            <Button
              size="small"
              variant={fulfillabilityFilter === '' ? 'contained' : 'outlined'}
              onClick={() => setFulfillabilityFilter('')}
              sx={{ minWidth: 48 }}
            >
              Mind
            </Button>
            {availableFulfillability.map(value => (
              <Button
                key={value}
                size="small"
                variant={fulfillabilityFilter === value ? 'contained' : 'outlined'}
                onClick={() => setFulfillabilityFilter(value)}
                sx={{
                  minWidth: 48,
                  ...(fulfillabilityFilter === value && value === 'all' && { bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }),
                  ...(fulfillabilityFilter === value && value === 'partial' && { bgcolor: '#ef6c00', '&:hover': { bgcolor: '#e65100' } }),
                  ...(fulfillabilityFilter === value && (value === 'none' || value === 'unknown') && { bgcolor: '#c62828', '&:hover': { bgcolor: '#b71c1c' } })
                }}
              >
                {FULFILLABILITY_LABELS[value] ?? value}
              </Button>
            ))}
          </Box>
        </Box>
        {selectedIds.size > 0 && (
          <Button
            variant="text"
            size="small"
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

      {displayEntries.length === 0 && !loading ? (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.02)',
            borderColor: 'rgba(0,0,0,0.08)'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Nincsenek bejegyzések a kiválasztott szűrővel.
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.08)',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: '#fafbfc'
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 40, py: 1, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>
                        <Checkbox
                          size="small"
                          checked={displayEntries.length > 0 && displayEntries.every(e => selectedIds.has(e.id))}
                          indeterminate={displayEntries.some(e => selectedIds.has(e.id)) && !displayEntries.every(e => selectedIds.has(e.id))}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Bolti</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Vásárló</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Összeg</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Létrehozva</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Fizetés</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Szállítás</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Várakozás</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider' }}>Teljesíthetőség</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', py: 1.25, bgcolor: 'rgba(0,0,0,0.04)', borderBottom: 1, borderColor: 'divider', width: 120 }}>Műveletek</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : (
                  displayEntries.map((entry) => {
                    const fulfill = stockSummaries[entry.id]
                    const rowBg =
                      fulfill === 'all'
                        ? 'rgba(232, 245, 233, 0.45)'
                        : fulfill === 'partial'
                          ? 'rgba(255, 243, 224, 0.55)'
                          : fulfill === 'none' || fulfill === 'unknown'
                            ? 'rgba(255, 235, 238, 0.45)'
                            : undefined
                    const rowBgHover =
                      fulfill === 'all'
                        ? 'rgba(200, 230, 201, 0.5)'
                        : fulfill === 'partial'
                          ? 'rgba(255, 224, 178, 0.55)'
                          : fulfill === 'none' || fulfill === 'unknown'
                            ? 'rgba(255, 205, 210, 0.5)'
                            : undefined
                    return (
                    <TableRow
                      key={entry.id}
                      hover
                      sx={{
                        bgcolor: rowBg,
                        '&:hover': { bgcolor: rowBgHover ?? 'action.hover' },
                        '& td': { py: 1, borderBottom: 1, borderColor: 'divider' }
                      }}
                    >
                      <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          size="small"
                          checked={selectedIds.has(entry.id)}
                          onChange={e => handleSelectOne(entry.id, e)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {entry.connection?.name || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={entry.order_summary.customer_email || entry.platform_order_id}>
                          <Link
                            component={NextLink}
                            href={
                              entry.order_summary.customer_email
                                ? `/customers/persons?q=${encodeURIComponent(entry.order_summary.customer_email)}`
                                : '/customers/persons'
                            }
                            sx={{
                              fontWeight: 500,
                              fontSize: '0.875rem',
                              color: 'primary.main',
                              textDecoration: 'none',
                              '&:hover': { textDecoration: 'underline' },
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {entry.order_summary.customer_name || '—'}
                          </Link>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatCurrency(entry.order_summary.total, entry.order_summary.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateShort(entry.order_summary.date_created || entry.received_at)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 100 }}>
                        {entry.order_summary.payment_method_name ? (
                          <Tooltip title={entry.order_summary.payment_method_name}>
                            <Chip
                              size="small"
                              label={entry.order_summary.payment_method_name}
                              sx={{
                                height: 22,
                                maxWidth: '100%',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                border: '1px solid',
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                },
                                ...chipStyleForMethod(entry.order_summary.payment_method_name)
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 100 }}>
                        {entry.order_summary.shipping_method_name ? (
                          <Tooltip title={entry.order_summary.shipping_method_name}>
                            <Chip
                              size="small"
                              label={entry.order_summary.shipping_method_name}
                              sx={{
                                height: 22,
                                maxWidth: '100%',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                border: '1px solid',
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                },
                                ...chipStyleForMethod(entry.order_summary.shipping_method_name)
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={new Date(entry.received_at).toLocaleString('hu-HU')}>
                          <Chip
                            size="small"
                            icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                            label={formatWaitingTime(entry.received_at)}
                            sx={{
                              height: 22,
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              border: '1px solid',
                              ...(getWaitingTier(entry.received_at) === 'fresh' && {
                                bgcolor: 'rgba(46, 125, 50, 0.12)',
                                color: '#2e7d32',
                                borderColor: 'rgba(46, 125, 50, 0.35)',
                                '& .MuiChip-icon': { color: '#2e7d32' }
                              }),
                              ...(getWaitingTier(entry.received_at) === 'medium' && {
                                bgcolor: 'rgba(239, 108, 0, 0.12)',
                                color: '#e65100',
                                borderColor: 'rgba(239, 108, 0, 0.35)',
                                '& .MuiChip-icon': { color: '#e65100' }
                              }),
                              ...(getWaitingTier(entry.received_at) === 'old' && {
                                bgcolor: 'rgba(198, 40, 40, 0.12)',
                                color: '#c62828',
                                borderColor: 'rgba(198, 40, 40, 0.35)',
                                '& .MuiChip-icon': { color: '#c62828' }
                              })
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Tooltip title={stockSummaries[entry.id] != null ? 'Részletek' : 'Kattintson a raktár ellenőrzéséhez'}>
                          <Box
                            component="button"
                            type="button"
                            onClick={e => handleOpenFulfillability(e, entry.id)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              border: '1px solid',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              ...(stockSummaries[entry.id] === 'all'
                                ? { bgcolor: '#e8f5e9', color: '#1b5e20', borderColor: '#a5d6a7' }
                                : stockSummaries[entry.id] === 'partial'
                                  ? { bgcolor: '#fff8e1', color: '#e65100', borderColor: '#ffcc80' }
                                  : stockSummaries[entry.id] === 'none' || stockSummaries[entry.id] === 'unknown'
                                    ? { bgcolor: '#ffebee', color: '#b71c1c', borderColor: '#ef9a9a' }
                                    : { bgcolor: '#fafafa', color: '#616161', borderColor: 'rgba(0,0,0,0.12)' }),
                              '&:hover': { opacity: 0.92 }
                            }}
                          >
                            {stockSummaries[entry.id] === 'all' && <CheckCircleIcon sx={{ fontSize: 16 }} />}
                            {stockSummaries[entry.id] === 'partial' && <WarningIcon sx={{ fontSize: 16 }} />}
                            {(stockSummaries[entry.id] === 'none' || stockSummaries[entry.id] === 'unknown') && (
                              <ErrorIcon sx={{ fontSize: 16 }} />
                            )}
                            {stockSummaries[entry.id] == null && <ScheduleIcon sx={{ fontSize: 16 }} />}
                            {stockSummaries[entry.id] === 'all' && 'Raktáron'}
                            {stockSummaries[entry.id] === 'partial' && 'Részben'}
                            {(stockSummaries[entry.id] === 'none' || stockSummaries[entry.id] === 'unknown') && 'Hiány'}
                            {stockSummaries[entry.id] == null && 'Ellenőrzés'}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" onClick={e => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {entry.status === 'pending' && !entry.is_blacklisted && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={processingId === entry.id ? <CircularProgress size={14} /> : <PlayArrowIcon fontSize="small" />}
                              onClick={() => handleProcess(entry.id)}
                              disabled={processingId === entry.id}
                              sx={{ minWidth: 0, textTransform: 'none' }}
                            >
                              Feldolgozás
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="small"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>Törlés</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törli a kiválasztott {entriesToDelete.length} bejegyzést? Ez nem visszavonható.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Mégse</Button>
          <Button onClick={() => handleDelete(entriesToDelete)} color="error" variant="contained">
            Törlés
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={handleCloseFulfillability}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              minWidth: 400,
              maxWidth: 'calc(100vw - 24px)',
              border: '1px solid',
              borderColor: 'rgba(33, 150, 243, 0.3)',
              bgcolor: '#f5f9ff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }
          }
        }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary', fontSize: '0.8125rem' }}>
            Teljesíthetőség
          </Typography>
          {loadingDetail ? (
            <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={22} />
            </Box>
          ) : stockDetailItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Nincs termék adat.</Typography>
          ) : (
            <TableContainer sx={{ overflow: 'hidden' }}>
              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', py: 0.5, borderColor: 'rgba(0,0,0,0.08)', minWidth: 0 }}>Termék neve</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.7rem', py: 0.5, width: 72, borderColor: 'rgba(0,0,0,0.08)' }}>Rendelt</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.7rem', py: 0.5, width: 80, borderColor: 'rgba(0,0,0,0.08)' }}>Elérhető</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.7rem', py: 0.5, width: 88, borderColor: 'rgba(0,0,0,0.08)' }}>Szükséges</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockDetailItems.map((item, idx) => (
                    <TableRow key={idx} sx={{ '& td': { py: 0.5, borderColor: 'rgba(0,0,0,0.06)', bgcolor: 'white' } }}>
                      <TableCell
                        sx={{
                          fontSize: '0.75rem',
                          minWidth: 0,
                          maxWidth: 280,
                          wordBreak: 'break-word',
                          whiteSpace: 'normal',
                          lineHeight: 1.3
                        }}
                      >
                        {item.product_name}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{item.quantity_ordered}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{item.quantity_available}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{item.quantity_needed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Popover>
    </Box>
  )
}
