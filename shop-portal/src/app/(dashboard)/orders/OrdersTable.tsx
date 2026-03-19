'use client'

import { useState, useCallback } from 'react'
import {
  Box,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip
} from '@mui/material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import OrdersTableBody, { type OrderRow } from './OrdersTableBody'
import { getAllowedNextStatus } from '@/lib/order-status'

interface OrdersTableProps {
  orders: OrderRow[]
  batchByOrderId?: Record<string, { id: string; code: string }>
  /** True when URL filters/search/limit differ from defaults — improves empty-state copy */
  hasActiveFilters?: boolean
}

export default function OrdersTable({ orders, batchByOrderId = {}, hasActiveFilters = false }: OrdersTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [addToBatchModalOpen, setAddToBatchModalOpen] = useState(false)
  const [addToBatchLoading, setAddToBatchLoading] = useState(false)
  const [draftBatches, setDraftBatches] = useState<{ id: string; code: string }[]>([])
  const [addToBatchMode, setAddToBatchMode] = useState<'new' | 'existing'>('new')
  const [existingBatchId, setExistingBatchId] = useState<string>('')

  const canCancel = useCallback((order: OrderRow) => {
    return getAllowedNextStatus(order.status ?? '').includes('cancelled')
  }, [])

  const cancelableSelected = orders.filter((o) => selectedIds.has(o.id) && canCancel(o))
  const hasCancelableSelected = cancelableSelected.length > 0

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(orders.map((o) => o.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [orders]
  )

  const handleBulkCancel = useCallback(async () => {
    if (!hasCancelableSelected) return
    setBulkLoading(true)
    try {
      let ok = 0
      let fail = 0
      for (const order of cancelableSelected) {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' })
        })
        if (res.ok) ok += 1
        else fail += 1
      }
      setSelectedIds(new Set())
      if (ok) toast.success(`${ok} rendelés megszüntetve`)
      if (fail) toast.error(`${fail} rendelés megszüntetése sikertelen`)
      router.refresh()
    } finally {
      setBulkLoading(false)
    }
  }, [cancelableSelected, hasCancelableSelected, router])

  const isCsomagolhato = useCallback((order: OrderRow) => {
    return order.status === 'new' && order.fulfillability_status === 'fully_fulfillable'
  }, [])
  const selectedOrders = orders.filter((o) => selectedIds.has(o.id))
  const selectedCsomagolhato = selectedOrders.filter(isCsomagolhato)
  const canAddToBatch = selectedCsomagolhato.length > 0 && selectedCsomagolhato.length === selectedOrders.length

  const openAddToBatchModal = useCallback(async () => {
    if (!canAddToBatch) return
    setAddToBatchModalOpen(true)
    setAddToBatchMode('new')
    setExistingBatchId('')
    try {
      const res = await fetch('/api/pick-batches?status=draft&limit=50')
      if (res.ok) {
        const data = await res.json()
        setDraftBatches((data.pick_batches || []).map((b: any) => ({ id: b.id, code: b.code })))
      }
    } catch (e) {
      console.error(e)
    }
  }, [canAddToBatch])

  const handleAddToBatch = useCallback(async () => {
    const orderIds = Array.from(selectedCsomagolhato.map((o) => o.id))
    if (orderIds.length === 0) return
    setAddToBatchLoading(true)
    try {
      let batchId: string
      if (addToBatchMode === 'new') {
        const createRes = await fetch('/api/pick-batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          throw new Error(err.error || 'Hiba')
        }
        const createData = await createRes.json()
        batchId = createData.pick_batch.id
      } else {
        batchId = existingBatchId
        if (!batchId) {
          toast.error('Válasszon begyűjtést')
          return
        }
      }
      const addRes = await fetch(`/api/pick-batches/${batchId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds })
      })
      if (!addRes.ok) {
        const err = await addRes.json().catch(() => ({}))
        throw new Error(err.error || 'Hiba')
      }
      toast.success(addToBatchMode === 'new' ? 'Begyűjtés létrehozva, rendelések hozzáadva' : 'Rendelések hozzáadva a begyűjtéshez')
      setSelectedIds(new Set())
      setAddToBatchModalOpen(false)
      router.refresh()
      if (addToBatchMode === 'new') {
        router.push(`/pick-batches/${batchId}`)
      }
    } catch (e: any) {
      toast.error(e.message || 'Hiba')
    } finally {
      setAddToBatchLoading(false)
    }
  }, [addToBatchMode, existingBatchId, selectedCsomagolhato, router])

  const allSelected = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0

  const addToBatchTooltip = !someSelected
    ? ''
    : !canAddToBatch
      ? 'Csak „Új” státuszú és teljes készletű (csomagolható) rendelések tehetők begyűjtésbe. A kijelölésnek kizárólag ilyen sorokból állhat.'
      : ''

  const bulkCancelTooltip = !someSelected
    ? ''
    : !hasCancelableSelected
      ? 'A kijelöltek közül egyiknél sem engedélyezett a megszüntetés (a státusz már nem vihető „Törölve” állapotba).'
      : ''

  return (
    <>
      {someSelected && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Tooltip title={addToBatchTooltip} arrow disableHoverListener={canAddToBatch}>
            <span>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                disabled={!canAddToBatch || bulkLoading}
                onClick={openAddToBatchModal}
              >
                Begyűjtésbe ({selectedCsomagolhato.length})
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={bulkCancelTooltip} arrow disableHoverListener={hasCancelableSelected}>
            <span>
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={!hasCancelableSelected || bulkLoading}
                onClick={handleBulkCancel}
              >
                {bulkLoading ? 'Folyamatban…' : `Kijelöltek törlése (${cancelableSelected.length})`}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="text"
            size="small"
            onClick={() => setSelectedIds(new Set())}
          >
            Kijelölés törlése
          </Button>
        </Box>
      )}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflowX: 'auto'
        }}
      >
        <Table size="small" sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={someSelected && !allSelected}
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Rendelésszám</TableCell>
              <TableCell>Vásárló</TableCell>
              <TableCell>Forrás</TableCell>
              <TableCell>Bruttó összesen</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Fizetés</TableCell>
              <TableCell sx={{ minWidth: 120, maxWidth: 160 }}>Szállítás / fizetés</TableCell>
              <TableCell>Dátum</TableCell>
            </TableRow>
          </TableHead>
          <OrdersTableBody
            orders={orders}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            batchByOrderId={batchByOrderId}
            hasActiveFilters={hasActiveFilters}
          />
        </Table>
      </TableContainer>

      <Dialog open={addToBatchModalOpen} onClose={() => setAddToBatchModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Begyűjtésbe helyezés</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Módszer</InputLabel>
            <Select
              value={addToBatchMode}
              label="Módszer"
              onChange={(e) => setAddToBatchMode(e.target.value as 'new' | 'existing')}
            >
              <MenuItem value="new">Új begyűjtés</MenuItem>
              <MenuItem value="existing">Meglévőhöz</MenuItem>
            </Select>
          </FormControl>
          {addToBatchMode === 'existing' && (
            <FormControl fullWidth size="small" sx={{ mt: 2 }}>
              <InputLabel>Begyűjtés</InputLabel>
              <Select
                value={existingBatchId}
                label="Begyűjtés"
                onChange={(e) => setExistingBatchId(e.target.value)}
              >
                <MenuItem value="">—</MenuItem>
                {draftBatches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.code}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddToBatchModalOpen(false)}>Mégse</Button>
          <Button
            variant="contained"
            onClick={handleAddToBatch}
            disabled={addToBatchLoading || (addToBatchMode === 'existing' && !existingBatchId)}
          >
            {addToBatchLoading ? 'Folyamatban…' : addToBatchMode === 'new' ? 'Új begyűjtés + hozzáadás' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
