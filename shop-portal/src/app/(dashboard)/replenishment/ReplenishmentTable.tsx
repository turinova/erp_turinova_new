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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment
} from '@mui/material'
import {
  Add as AddIcon,
  Inventory2 as Inventory2Icon,
  Link as LinkIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import NextLink from 'next/link'

export interface ReplenishmentProductRow {
  product_id: string
  product_sku: string
  product_name: string
  quantity: number
  order_item_ids: string[]
  order_ids: string[]
  order_numbers: string[]
  supplier_id: string | null
  supplier_name: string | null
  has_supplier: boolean
}

interface ReplenishmentTableProps {
  initialSupplierId?: string
  initialGroupBy?: string
  initialOrderId?: string
  suppliers?: Array<{ id: string; name: string }>
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

export default function ReplenishmentTable({
  initialSupplierId = '',
  initialGroupBy = 'product',
  initialOrderId = '',
  suppliers = []
}: ReplenishmentTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderIdFromUrl = searchParams.get('order_id')?.trim() || initialOrderId || ''

  const [lines, setLines] = useState<ReplenishmentProductRow[]>([])
  const [linesWithoutProduct, setLinesWithoutProduct] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierId)
  const [searchTerm, setSearchTerm] = useState('')
  const [createPoOpen, setCreatePoOpen] = useState(false)
  const [addToPoOpen, setAddToPoOpen] = useState(false)
  // When true/false: we know if there is at least one draft/pending_approval PO; null = not fetched yet
  const [hasDraftPos, setHasDraftPos] = useState<boolean | null>(null)

  const fetchReplenishment = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('group_by', 'product')
      if (supplierFilter) params.set('supplier_id', supplierFilter)
      if (orderIdFromUrl) params.set('order_id', orderIdFromUrl)
      const res = await fetch(`/api/replenishment?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hiba a betöltéskor')
      setLines(data.lines || [])
      setLinesWithoutProduct(data.lines_without_product || [])
      setTotalCount(data.totalCount ?? 0)
    } catch (e) {
      console.error(e)
      setLines([])
      setLinesWithoutProduct([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [supplierFilter, orderIdFromUrl])

  useEffect(() => {
    fetchReplenishment()
  }, [fetchReplenishment])

  // When selection is valid for "add to existing", check if any draft/pending_approval PO exists
  const selectedRowsForDraftCheck = lines.filter((r) => selectedIds.has(r.product_id))
  const selectionValidForAddToExisting =
    selectedRowsForDraftCheck.length > 0 && selectedRowsForDraftCheck.every((r) => r.has_supplier)
  useEffect(() => {
    if (!selectionValidForAddToExisting) {
      setHasDraftPos(null)
      return
    }
    let cancelled = false
    const fetchDraftPos = async () => {
      try {
        const res = await fetch('/api/purchase-orders?limit=100')
        const data = await res.json()
        if (cancelled || !res.ok) return
        const drafts =
          (data.purchase_orders || []).filter(
            (p: { status: string }) => p.status === 'draft' || p.status === 'pending_approval'
          )
        setHasDraftPos(drafts.length > 0)
      } catch {
        if (!cancelled) setHasDraftPos(false)
      }
    }
    fetchDraftPos()
    return () => {
      cancelled = true
    }
  }, [selectionValidForAddToExisting])

  const filteredLines = useMemo(() => {
    if (!searchTerm.trim()) return lines
    const q = searchTerm.trim().toLowerCase()
    return lines.filter(
      (r) =>
        (r.product_name || '').toLowerCase().includes(q) ||
        (r.product_sku || '').toLowerCase().includes(q)
    )
  }, [lines, searchTerm])

  const supplierGroupIndex = useMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    filteredLines.forEach((r) => {
      const sid = r.supplier_id || ''
      if (sid && !seen.has(sid)) {
        seen.add(sid)
        order.push(sid)
      }
    })
    return new Map(order.map((id, i) => [id, i]))
  }, [filteredLines])

  // Sync URL with filters (preserve order_id when present)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (supplierFilter) params.set('supplier_id', supplierFilter)
    else params.delete('supplier_id')
    if (orderIdFromUrl) params.set('order_id', orderIdFromUrl)
    else params.delete('order_id')
    const newSearch = params.toString()
    const current = typeof window !== 'undefined' ? window.location.search.slice(1) : ''
    if (newSearch !== current) {
      router.replace(`/replenishment${newSearch ? `?${newSearch}` : ''}`, { scroll: false })
    }
  }, [supplierFilter, orderIdFromUrl, router, searchParams])

  const selectableLines = filteredLines.filter((r) => r.has_supplier)
  const selectedRows = lines.filter((r) => selectedIds.has(r.product_id))
  const canCreatePo = selectedRows.length > 0
  const hasMultipleSuppliers = selectedRows.length > 0 && new Set(selectedRows.map((r) => r.supplier_id)).size > 1
  // "Hozzáadás meglévőhöz" only when every selected row has a supplier AND there is at least one draft/pending_approval PO
  const canAddToExisting =
    selectedRows.length > 0 &&
    selectedRows.every((r) => r.has_supplier) &&
    hasDraftPos === true

  const hasActiveFilters = !!supplierFilter || !!searchTerm.trim()
  const handleClearFilters = () => {
    setSupplierFilter('')
    setSearchTerm('')
    const params = new URLSearchParams()
    if (orderIdFromUrl) params.set('order_id', orderIdFromUrl)
    router.replace(`/replenishment${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(selectableLines.map((r) => r.product_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(productId)
      else next.delete(productId)
      return next
    })
  }

  const allSelected = selectableLines.length > 0 && selectableLines.every((r) => selectedIds.has(r.product_id))
  const someSelected = selectedIds.size > 0

  return (
    <Box>
      {/* Header - same structure as PO page */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Beszerzési várólista
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hiányzó tételek rendelései alapján. Válasszon termékeket, majd hozzon létre vagy bővítsen beszerzési rendelést.
          </Typography>
        </Box>
      </Box>

      {hasMultipleSuppliers && someSelected && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Több beszállító is kiválasztva. Új rendeléshez válassz csak egy beszállító tételeit, vagy szűrj beszállítóra.
        </Alert>
      )}

      {/* Filters - aligned with PO page */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Beszállító</InputLabel>
          <Select
            value={supplierFilter}
            label="Beszállító"
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <MenuItem value="">Összes</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          placeholder="Keresés: termék, cikkszám…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 280, flexGrow: 1 }}
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

      {/* Bulk actions bar - same pattern as PO page */}
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
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!canCreatePo || hasMultipleSuppliers}
            onClick={() => setCreatePoOpen(true)}
          >
            Új beszerzési rendelés ({selectedIds.size})
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<LinkIcon />}
            disabled={!canAddToExisting}
            onClick={() => setAddToPoOpen(true)}
          >
            Hozzáadás meglévőhöz ({selectedIds.size})
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<ClearIcon />} onClick={() => setSelectedIds(new Set())}>
            Kijelölés törlése
          </Button>
        </Box>
      )}

      {linesWithoutProduct.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {linesWithoutProduct.length} tétel termék nélkül: párosítsd a terméket a rendelés tételén, majd frissítsd a
          várólistát.
        </Alert>
      )}

      {/* Table - same container and row styling as PO page */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                <Checkbox
                  indeterminate={someSelected && !allSelected}
                  checked={allSelected}
                  onChange={(_, c) => handleSelectAll(c)}
                  disabled={selectableLines.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Termék</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Mennyiség</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Forrás rendelések</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : filteredLines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Inventory2Icon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {lines.length === 0
                        ? 'Nincs hiányzó tétel a várólistán.'
                        : 'Nincs találat a keresésnek megfelelően.'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredLines.map((row) => {
                const groupIdx = (row.supplier_id && supplierGroupIndex.get(row.supplier_id)) ?? 0
                const rowBg = SUPPLIER_ROW_COLORS[groupIdx % SUPPLIER_ROW_COLORS.length]
                return (
                  <TableRow
                    key={row.product_id}
                    hover
                    sx={{
                      '& td': { py: 1 },
                      backgroundColor: rowBg,
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                      <Checkbox
                        checked={selectedIds.has(row.product_id)}
                        disabled={!row.has_supplier}
                        onChange={(_, c) => handleSelectOne(row.product_id, c)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Link component={NextLink} href={`/products/${row.product_id}`} underline="hover" sx={{ fontWeight: 600 }}>
                        {row.product_name || '—'}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>{row.product_sku || '—'}</TableCell>
                    <TableCell align="right" sx={{ py: 1 }}>{row.quantity}</TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.order_numbers.slice(0, 5).map((num, i) => (
                          <Chip
                            key={row.order_ids[i]}
                            size="small"
                            label={num}
                            component={NextLink}
                            href={`/orders/${row.order_ids[i]}`}
                            clickable
                            sx={{ textDecoration: 'none' }}
                          />
                        ))}
                        {row.order_numbers.length > 5 && (
                          <Chip size="small" label={`+${row.order_numbers.length - 5}`} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>{row.has_supplier ? row.supplier_name : '— Nincs beszállító'}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Összesen {totalCount} termék (összesített hiány)
        </Typography>
      )}

      {createPoOpen && (
        <CreatePoModal
          open={createPoOpen}
          onClose={() => setCreatePoOpen(false)}
          selectedRows={selectedRows}
          suppliers={suppliers}
          onSuccess={() => {
            setCreatePoOpen(false)
            setSelectedIds(new Set())
            fetchReplenishment()
          }}
        />
      )}
      {addToPoOpen && (
        <AddToPoModal
          open={addToPoOpen}
          onClose={() => setAddToPoOpen(false)}
          selectedRows={selectedRows}
          onSuccess={() => {
            setAddToPoOpen(false)
            setSelectedIds(new Set())
            fetchReplenishment()
          }}
        />
      )}
    </Box>
  )
}

function CreatePoModal({
  open,
  onClose,
  selectedRows,
  suppliers,
  onSuccess
}: {
  open: boolean
  onClose: () => void
  selectedRows: ReplenishmentProductRow[]
  suppliers: { id: string; name: string }[]
  onSuccess: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [expectedDate, setExpectedDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const firstSupplier = selectedRows[0]?.supplier_id
    if (firstSupplier) setSupplierId(firstSupplier)
    else setSupplierId('')
    setExpectedDate('')
    setNote('')
    setError('')
  }, [open, selectedRows])

  useEffect(() => {
    if (!open) return
    const fetchWarehouses = async () => {
      try {
        const res = await fetch('/api/warehouses')
        const data = await res.json()
        if (res.ok && data.warehouses) {
          setWarehouses(data.warehouses.map((w: any) => ({ id: w.id, name: w.name || w.id })))
          if (data.warehouses[0]) setWarehouseId(data.warehouses[0].id)
        }
      } catch {
        // ignore
      }
    }
    fetchWarehouses()
  }, [open])

  const handleSubmit = async () => {
    if (!supplierId || !warehouseId) {
      setError('Beszállító és raktár kötelező.')
      return
    }
    const items = selectedRows
      .filter((r) => r.supplier_id === supplierId)
      .flatMap((r) => r.order_item_ids.map((id) => ({ order_item_id: id })))
    if (items.length === 0) {
      setError('A kiválasztott tételeknek a megadott beszállítóval kell rendelkezniük.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/replenishment/create-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          supplier_id: supplierId,
          warehouse_id: warehouseId,
          expected_delivery_date: expectedDate || undefined,
          note: note.trim() || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hiba')
      onSuccess()
      if (data.purchase_order?.id) {
        window.location.href = `/purchase-orders/${data.purchase_order.id}`
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba a létrehozáskor')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Új beszerzési rendelés</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <FormControl fullWidth size="small" sx={{ mb: 2, mt: 1 }}>
          <InputLabel>Beszállító *</InputLabel>
          <Select
            value={supplierId}
            label="Beszállító *"
            onChange={(e) => setSupplierId(e.target.value)}
          >
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Raktár *</InputLabel>
          <Select
            value={warehouseId}
            label="Raktár *"
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          size="small"
          type="date"
          label="Várható szállítás"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          size="small"
          label="Megjegyzés"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          rows={2}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Mégse</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Létrehozás…' : 'Létrehozás'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function AddToPoModal({
  open,
  onClose,
  selectedRows,
  onSuccess
}: {
  open: boolean
  onClose: () => void
  selectedRows: ReplenishmentProductRow[]
  onSuccess: () => void
}) {
  const [poId, setPoId] = useState('')
  const [draftPos, setDraftPos] = useState<{ id: string; po_number: string; supplier_id: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    const fetchPos = async () => {
      try {
        const res = await fetch('/api/purchase-orders?limit=100')
        const data = await res.json()
        if (res.ok && data.purchase_orders) {
          const drafts = data.purchase_orders.filter(
            (p: any) => p.status === 'draft' || p.status === 'pending_approval'
          )
          setDraftPos(drafts.map((p: any) => ({ id: p.id, po_number: p.po_number, supplier_id: p.supplier_id })))
          if (drafts[0]) setPoId(drafts[0].id)
        }
      } catch {
        setDraftPos([])
      }
    }
    fetchPos()
  }, [open])

  const handleSubmit = async () => {
    if (!poId) {
      setError('Válassz beszerzési rendelést.')
      return
    }
    const po = draftPos.find((p) => p.id === poId)
    const supplierId = po?.supplier_id
    const items = selectedRows
      .filter((r) => r.supplier_id === supplierId)
      .flatMap((r) => r.order_item_ids.map((id) => ({ order_item_id: id })))
    if (items.length === 0) {
      setError('A kiválasztott tételeknek a kiválasztott beszerzési rendelés beszállítójával kell rendelkezniük.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/replenishment/add-to-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_order_id: poId, items })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hiba')
      onSuccess()
      if (data.purchase_order?.id) {
        window.location.href = `/purchase-orders/${data.purchase_order.id}`
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba a hozzáadáskor')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Hozzáadás meglévő beszerzési rendeléshez</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <FormControl fullWidth size="small" sx={{ mb: 2, mt: 1 }}>
          <InputLabel>Beszerzési rendelés</InputLabel>
          <Select value={poId} label="Beszerzési rendelés" onChange={(e) => setPoId(e.target.value)}>
            {draftPos.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.po_number}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Mégse</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Hozzáadás…' : 'Hozzáadás'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
