'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  IconButton,
  TextField,
  InputAdornment,
  Alert
} from '@mui/material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'
import {
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  QrCodeScanner as ScanIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Piszkozat', color: '#ffffff', bgColor: '#78909c' },
  in_progress: { label: 'Folyamatban', color: '#ffffff', bgColor: '#1565c0' },
  completed: { label: 'Kész', color: '#ffffff', bgColor: '#2e7d32' },
  cancelled: { label: 'Megszakítva', color: '#ffffff', bgColor: '#c62828' }
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Új',
  picking: 'Szedés alatt',
  picked: 'Szedve'
}

function PickBatchStatusChip({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: '#ffffff', bgColor: '#757575' }
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

function creatorDisplay(created_by_user: { full_name?: string | null; email?: string } | null): string {
  if (!created_by_user) return '–'
  if (created_by_user.full_name?.trim()) return created_by_user.full_name.trim()
  return created_by_user.email || '–'
}

interface PickBatchDetailProps {
  initialBatch: any
  initialOrders: any[]
  initialOrderItemsByOrder: Record<string, any[]>
  initialTotalItems?: number
}

export default function PickBatchDetail({
  initialBatch,
  initialOrders,
  initialOrderItemsByOrder,
  initialTotalItems = 0
}: PickBatchDetailProps) {
  const router = useRouter()
  const [batch, setBatch] = useState(initialBatch)
  const [orders, setOrders] = useState(initialOrders)
  const [orderItemsByOrder, setOrderItemsByOrder] = useState(initialOrderItemsByOrder)
  const [loading, setLoading] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [orderSearchTerm, setOrderSearchTerm] = useState('')
  const [modalSearchTerm, setModalSearchTerm] = useState('')

  const totalItems = useMemo(() => {
    return Object.values(orderItemsByOrder).reduce((sum, items) => sum + items.length, 0)
  }, [orderItemsByOrder])

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/pick-batches/${batch.id}`)
    if (!res.ok) return
    const data = await res.json()
    setBatch(data.pick_batch)
    setOrders(data.orders || [])
    setOrderItemsByOrder(data.order_items_by_order || {})
  }, [batch.id])

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pick-batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Hiba')
      }
      const data = await res.json()
      setBatch(data.pick_batch)
      toast.success(newStatus === 'in_progress' ? 'Begyűjtés indítva' : newStatus === 'completed' ? 'Begyűjtés kész' : 'Begyűjtés megszakítva')
      router.refresh()
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = async () => {
    setAddModalOpen(true)
    setSelectedOrderIds(new Set())
    setModalSearchTerm('')
    setLoadingAvailable(true)
    try {
      const res = await fetch(`/api/pick-batches/available-orders?exclude_batch_id=${batch.id}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        setAvailableOrders(data.orders || [])
      }
    } finally {
      setLoadingAvailable(false)
    }
  }

  const handleAddOrders = async () => {
    if (selectedOrderIds.size === 0) {
      toast.info('Válasszon legalább egy rendelést')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/pick-batches/${batch.id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: Array.from(selectedOrderIds) })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Hiba')
      }
      toast.success('Rendelések hozzáadva')
      setAddModalOpen(false)
      router.refresh()
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/pick-batches/${batch.id}/orders/${orderId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Hiba')
      }
      toast.success('Rendelés eltávolítva')
      router.refresh()
      await refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Hiba')
    }
  }

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–'

  const canAddOrders = batch.status === 'draft'
  const canRemoveOrder = batch.status === 'draft'

  const filteredOrders = useMemo(() => {
    if (!orderSearchTerm.trim()) return orders
    const q = orderSearchTerm.trim().toLowerCase()
    return orders.filter(
      (o: any) =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_firstname || '').toLowerCase().includes(q) ||
        (o.customer_lastname || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q)
    )
  }, [orders, orderSearchTerm])

  const filteredAvailableOrders = useMemo(() => {
    if (!modalSearchTerm.trim()) return availableOrders
    const q = modalSearchTerm.trim().toLowerCase()
    return availableOrders.filter(
      (o: any) =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_firstname || '').toLowerCase().includes(q) ||
        (o.customer_lastname || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q)
    )
  }, [availableOrders, modalSearchTerm])

  const nextStepMessage =
    batch.status === 'draft'
      ? 'Következő lépés: add hozzá a rendeléseket, majd indítsd a begyűjtést.'
      : batch.status === 'in_progress'
        ? 'Következő lépés: menj a Picking módba és szedd össze a tételeket, vagy zárd le a begyűjtést.'
        : batch.status === 'completed'
          ? 'A begyűjtés kész.'
          : batch.status === 'cancelled'
            ? 'A begyűjtés megszakítva.'
            : ''

  return (
    <Box>
      <Box sx={{ '@media print': { display: 'none' } }}>
        {/* Header: title + subtitle (Notion-style context) */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {batch.code}
            </Typography>
            <PickBatchStatusChip status={batch.status} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Itt láthatod a begyűjtés tartalmát, kezelheted a rendeléseket, és indíthatod vagy lezárhatod a szedést.
          </Typography>

          {/* Summary: X rendelés, Y tétel */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>{orders.length}</strong> rendelés, <strong>{totalItems}</strong> tétel összesen
          </Typography>

          {/* Meta: Létrehozta, Létrehozva, Indítva, Befejezve */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Létrehozta: {creatorDisplay(batch.created_by_user)} · Létrehozva: {formatDate(batch.created_at)}
            {batch.started_at && ` · Indítva: ${formatDate(batch.started_at)}`}
            {batch.completed_at && ` · Befejezve: ${formatDate(batch.completed_at)}`}
          </Typography>

          {/* Next-step hint */}
          {nextStepMessage && (
            <Alert severity={batch.status === 'completed' ? 'success' : batch.status === 'cancelled' ? 'info' : 'info'} sx={{ mb: 2 }} icon={false}>
              {nextStepMessage}
            </Alert>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            {batch.status === 'draft' && (
              <>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddModal} size="small">
                  Rendelések hozzáadása
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={loading || orders.length === 0}
                  size="small"
                >
                  Begyűjtés indítása
                </Button>
              </>
            )}
            {batch.status === 'in_progress' && (
              <>
                <Button variant="contained" startIcon={<ScanIcon />} component={NextLink} href={`/pick-batches/${batch.id}/pick`} size="small">
                  Picking mód (szkennelés)
                </Button>
                <Button variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => handleStatusChange('completed')} disabled={loading} size="small">
                  Begyűjtés kész
                </Button>
              </>
            )}
            {(batch.status === 'draft' || batch.status === 'in_progress') && (
              <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => handleStatusChange('cancelled')} disabled={loading} size="small">
                Megszakítás
              </Button>
            )}
          </Box>
        </Box>

        {/* Orders section */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Rendelések a begyűjtésben ({orders.length})
        </Typography>

        {orders.length > 0 && (
          <TextField
            placeholder="Keresés a listában: rendelésszám, vásárló neve…"
            value={orderSearchTerm}
            onChange={(e) => setOrderSearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 1.5, minWidth: 280 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        )}

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Rendelésszám</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Vásárló</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Tételek</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Dátum</TableCell>
                {canRemoveOrder && <TableCell sx={{ fontWeight: 600, py: 1, width: 60 }}></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canRemoveOrder ? 6 : 5} align="center" sx={{ py: 4 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                      <Typography variant="body1" color="text.secondary">
                        Nincs még rendelés a begyűjtésben. Add hozzá rendeléseket a «Rendelések hozzáadása» gombbal, majd indítsd a begyűjtést.
                      </Typography>
                      {canAddOrders && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddModal} size="small">
                          Rendelések hozzáadása
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canRemoveOrder ? 6 : 5} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">Nincs találat a keresésnek megfelelően.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o: any) => (
                  <TableRow key={o.id} sx={{ '& td': { py: 1 } }}>
                    <TableCell>
                      <Link component={NextLink} href={`/orders/${o.id}`} sx={{ fontWeight: 600 }}>
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {o.customer_firstname} {o.customer_lastname}
                    </TableCell>
                    <TableCell align="right">{(orderItemsByOrder[o.id] || []).length}</TableCell>
                    <TableCell>{ORDER_STATUS_LABELS[o.status] || o.status}</TableCell>
                    <TableCell>{formatDate(o.order_date)}</TableCell>
                    {canRemoveOrder && (
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => handleRemoveOrder(o.id)} aria-label="Eltávolítás">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rendelések hozzáadása a begyűjtéshez</DialogTitle>
        <DialogContent>
          {loadingAvailable ? (
            <Typography>Betöltés…</Typography>
          ) : availableOrders.length === 0 ? (
            <Typography color="text.secondary">Nincs csomagolható rendelés, vagy mind már begyűjtésben van.</Typography>
          ) : (
            <>
              <TextField
                placeholder="Keresés: rendelésszám, vásárló…"
                value={modalSearchTerm}
                onChange={(e) => setModalSearchTerm(e.target.value)}
                size="small"
                fullWidth
                sx={{ mt: 1, mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell padding="checkbox" sx={{ fontWeight: 600 }}></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Rendelésszám</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Vásárló</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAvailableOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                          <Typography color="text.secondary">Nincs találat a keresésnek megfelelően.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAvailableOrders.map((o: any) => (
                        <TableRow key={o.id}>
                          <TableCell padding="checkbox">
                            <Checkbox checked={selectedOrderIds.has(o.id)} onChange={() => toggleSelectOrder(o.id)} />
                          </TableCell>
                          <TableCell>{o.order_number}</TableCell>
                          <TableCell>
                            {o.customer_firstname} {o.customer_lastname}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddModalOpen(false)}>Mégse</Button>
          <Button variant="contained" onClick={handleAddOrders} disabled={loading || selectedOrderIds.size === 0}>
            Hozzáadás ({selectedOrderIds.size})
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
