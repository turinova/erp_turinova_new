'use client'

import { useState, useCallback } from 'react'
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
  IconButton
} from '@mui/material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'
import {
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  QrCodeScanner as ScanIcon
} from '@mui/icons-material'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Piszkozat',
  in_progress: 'Folyamatban',
  completed: 'Kész',
  cancelled: 'Megszakítva'
}

interface PickBatchDetailProps {
  initialBatch: any
  initialOrders: any[]
  initialOrderItemsByOrder: Record<string, any[]>
}

export default function PickBatchDetail({
  initialBatch,
  initialOrders,
  initialOrderItemsByOrder
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
    } catch (e: any) {
      toast.error(e.message || 'Hiba')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = async () => {
    setAddModalOpen(true)
    setSelectedOrderIds(new Set())
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
    } catch (e: any) {
      toast.error(e.message || 'Hiba')
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
    } catch (e: any) {
      toast.error(e.message || 'Hiba')
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

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')

  const canAddOrders = batch.status === 'draft'
  const canRemoveOrder = batch.status === 'draft'

  return (
    <Box>
      <Box sx={{ '@media print': { display: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={600}>
          {batch.code}
        </Typography>
        <Chip label={STATUS_LABELS[batch.status] || batch.status} color={batch.status === 'completed' ? 'success' : batch.status === 'cancelled' ? 'error' : 'primary'} size="small" />
        <Box sx={{ flex: 1 }} />
        {batch.status === 'draft' && (
          <>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddModal} size="small">
              Rendelések hozzáadása
            </Button>
            <Button variant="contained" startIcon={<PlayIcon />} onClick={() => handleStatusChange('in_progress')} disabled={loading || orders.length === 0} size="small">
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

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Létrehozva: {formatDate(batch.created_at)} · Befejezve: {formatDate(batch.completed_at)}
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Rendelések ({orders.length})
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rendelésszám</TableCell>
              <TableCell>Vásárló</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Dátum</TableCell>
              {canRemoveOrder && <TableCell width={60}></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canRemoveOrder ? 5 : 4} align="center" sx={{ py: 2 }}>
                  Nincs rendelés a begyűjtésben.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link component={NextLink} href={`/orders/${o.id}`}>
                      {o.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{o.customer_firstname} {o.customer_lastname}</TableCell>
                  <TableCell>{o.status}</TableCell>
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
        <DialogTitle>Rendelések hozzáadása</DialogTitle>
        <DialogContent>
          {loadingAvailable ? (
            <Typography>Betöltés…</Typography>
          ) : availableOrders.length === 0 ? (
            <Typography color="text.secondary">Nincs csomagolható rendelés, vagy mind már begyűjtésben van.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedOrderIds.size === availableOrders.length}
                        indeterminate={selectedOrderIds.size > 0 && selectedOrderIds.size < availableOrders.length}
                        onChange={(_, checked) => setSelectedOrderIds(checked ? new Set(availableOrders.map((o: any) => o.id)) : new Set())}
                      />
                    </TableCell>
                    <TableCell>Rendelésszám</TableCell>
                    <TableCell>Vásárló</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableOrders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedOrderIds.has(o.id)} onChange={() => toggleSelectOrder(o.id)} />
                      </TableCell>
                      <TableCell>{o.order_number}</TableCell>
                      <TableCell>{o.customer_firstname} {o.customer_lastname}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
