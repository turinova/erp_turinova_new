'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import {
  Search as SearchIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Clear as ClearIcon,
  Send as SendIcon,
  Check as CheckIcon,
  EmailOutlined as EmailOutlinedIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import PurchaseOrderStatusChip from '@/components/purchasing/PurchaseOrderStatusChip'
import PurchaseOrderEmailModal from '@/components/purchasing/PurchaseOrderEmailModal'

interface PurchaseOrder {
  id: string
  po_number: string
  status: string
  supplier_id: string
  suppliers: { id: string; name: string } | null
  warehouse_id: string
  warehouses: { id: string; name: string } | null
  order_date: string
  expected_delivery_date: string | null
  total_net: number
  total_vat: number
  total_gross: number
  item_count: number
  email_sent: boolean
  email_sent_at: string | null
  created_at: string
  updated_at: string
  /** Set by API/SSR enrichment from supplier_order_channels */
  supplier_has_email_channel?: boolean
}

interface PurchaseOrdersTableProps {
  initialPurchaseOrders: PurchaseOrder[]
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialStatus: string
  initialSearch: string
  initialSupplierId?: string
  suppliers?: Array<{ id: string; name: string }>
}

export default function PurchaseOrdersTable({
  initialPurchaseOrders,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialSearch,
  initialSupplierId = '',
  suppliers = []
}: PurchaseOrdersTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const debouncedSearchTerm = useDebounce(searchTerm, 600)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierId || '')
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialPurchaseOrders)
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: (() => void) | null
  }>({ open: false, title: '', message: '', onConfirm: null })
  const [emailModalPoId, setEmailModalPoId] = useState<string | null>(null)

  useEffect(() => {
    setPurchaseOrders(initialPurchaseOrders)
  }, [initialPurchaseOrders])

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    if (supplierFilter) params.set('supplier_id', supplierFilter)
    if (currentPage > 1) params.set('page', currentPage.toString())
    params.set('limit', limit.toString())

    const newUrl = `/purchase-orders?${params.toString()}`
    if (window.location.pathname + window.location.search !== newUrl) {
      router.push(newUrl)
    }
  }, [debouncedSearchTerm, statusFilter, supplierFilter, currentPage, limit, router])

  // Fetch data when filters change
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

        const response = await fetch(`/api/purchase-orders?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch purchase orders')

        const data = await response.json()
        setPurchaseOrders(data.purchase_orders || [])
      } catch (error) {
        console.error('Error fetching purchase orders:', error)
        toast.error('Hiba a beszerzési rendelések lekérdezésekor')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [debouncedSearchTerm, statusFilter, supplierFilter, currentPage, limit])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/purchase-orders?${params.toString()}`)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(purchaseOrders.map(po => po.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (poId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(poId)) {
      newSelected.delete(poId)
    } else {
      newSelected.add(poId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (po: PurchaseOrder) => {
    router.push(`/purchase-orders/${po.id}`)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  const isAllSelected = purchaseOrders.length > 0 && selectedIds.size === purchaseOrders.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < purchaseOrders.length

  // Notion/Figma-style pastel palette: same-supplier rows share one color
  const SUPPLIER_ROW_COLORS = [
    '#E3F2FD', // blue
    '#E8F5E9', // green
    '#FFF8E1', // amber
    '#FFE0B2', // orange
    '#F3E5F5', // purple
    '#FCE4EC', // pink
    '#E0F2F1', // teal
    '#E8EAF6'  // indigo
  ]

  // Same-supplier rows get the same background (by order of first appearance)
  const supplierGroupIndex = useMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    purchaseOrders.forEach(po => {
      const sid = po.supplier_id || ''
      if (sid && !seen.has(sid)) {
        seen.add(sid)
        order.push(sid)
      }
    })
    return new Map(order.map((id, i) => [id, i]))
  }, [purchaseOrders])

  // Check if selected POs can create a shipment
  const canCreateShipment = useMemo(() => {
    if (selectedIds.size === 0) return false
    
    const selectedPOs = purchaseOrders.filter(po => selectedIds.has(po.id))
    
    if (selectedPOs.length === 0) return false
    
    // All must be approved
    const allApproved = selectedPOs.every(po => po.status === 'approved')
    if (!allApproved) return false
    
    // All must have same supplier
    const firstSupplierId = selectedPOs[0].supplier_id
    if (!firstSupplierId) return false
    
    const sameSupplier = selectedPOs.every(po => po.supplier_id === firstSupplierId)
    
    return sameSupplier
  }, [selectedIds, purchaseOrders])

  const handleCreateShipment = () => {
    if (!canCreateShipment) return
    
    const selectedPOIds = Array.from(selectedIds).join(',')
    router.push(`/shipments/new?po_ids=${selectedPOIds}`)
  }

  const selectedPOs = useMemo(
    () => purchaseOrders.filter(po => selectedIds.has(po.id)),
    [purchaseOrders, selectedIds]
  )

  const canBulkApprove = useMemo(() => {
    if (selectedIds.size === 0) return false
    return selectedPOs.every(po => po.status === 'draft' || po.status === 'pending_approval')
  }, [selectedIds.size, selectedPOs])

  const canBulkCancel = useMemo(() => {
    if (selectedIds.size === 0) return false
    return selectedPOs.every(po => po.status !== 'received' && po.status !== 'cancelled')
  }, [selectedIds.size, selectedPOs])

  const canBulkDelete = useMemo(() => {
    if (selectedIds.size === 0) return false
    return selectedPOs.every(po => po.status !== 'received')
  }, [selectedIds.size, selectedPOs])

  const canBulkSendEmail = useMemo(() => {
    if (selectedIds.size !== 1) return false
    const po = selectedPOs[0]
    return Boolean(
      po &&
        po.status === 'draft' &&
        po.supplier_has_email_channel === true
    )
  }, [selectedIds.size, selectedPOs])

  const emailSendDisabledReason = useMemo(() => {
    if (selectedIds.size === 0) {
      return 'Jelöljön ki pontosan egy rendelést az e-mail küldéshez.'
    }
    if (selectedIds.size > 1) {
      return 'Egyszerre csak egy rendeléshez küldhet e-mailt.'
    }
    const po = selectedPOs[0]
    if (!po) return 'A kijelölt rendelés nem található a listában.'
    if (po.status !== 'draft') {
      return 'Csak vázlat státuszú rendeléshez küldhet e-mailt a beszállítónak.'
    }
    if (!po.supplier_has_email_channel) {
      return 'A beszállítónak nincs e-mail típusú rendelési csatornája. Állítsa be a beszállító „Rendelési csatornák” között.'
    }
    return ''
  }, [selectedIds.size, selectedPOs])

  const handleBulkSendEmail = () => {
    if (!canBulkSendEmail) return
    const id = Array.from(selectedIds)[0]
    if (id) setEmailModalPoId(id)
  }

  const refreshList = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter) params.set('supplier_id', supplierFilter)
      params.set('page', currentPage.toString())
      params.set('limit', limit.toString())
      const res = await fetch(`/api/purchase-orders?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setPurchaseOrders(data.purchase_orders || [])
      }
    } catch {
      // ignore
    }
  }, [debouncedSearchTerm, statusFilter, supplierFilter, currentPage, limit])

  const handleBulkApprove = async () => {
    if (!canBulkApprove || selectedIds.size === 0) return
    setBulkLoading(true)
    let ok = 0
    let err = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/purchase-orders/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
        if (res.ok) ok++
        else err++
      } catch {
        err++
      }
    }
    setBulkLoading(false)
    if (ok) {
      await refreshList()
      setSelectedIds(new Set())
      toast.success(`${ok} rendelés jóváhagyva.`)
    }
    if (err) toast.error(`${err} rendelés jóváhagyása sikertelen.`)
  }

  const executeBulkCancel = useCallback(async () => {
    setBulkLoading(true)
    let ok = 0
    let err = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/purchase-orders/${id}/cancel`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Tömeges stornó' }) })
        if (res.ok) ok++
        else err++
      } catch {
        err++
      }
    }
    setBulkLoading(false)
    if (ok) {
      await refreshList()
      setSelectedIds(new Set())
      toast.success(`${ok} rendelés stornózva.`)
    }
    if (err) toast.error(`${err} rendelés stornózása sikertelen (pl. kapcsolódó szállítmány).`)
  }, [selectedIds, refreshList])

  const executeBulkDelete = useCallback(async () => {
    setBulkLoading(true)
    let ok = 0
    let err = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' })
        if (res.ok) ok++
        else err++
      } catch {
        err++
      }
    }
    setBulkLoading(false)
    if (ok) {
      await refreshList()
      setSelectedIds(new Set())
      toast.success(`${ok} rendelés törölve.`)
    }
    if (err) toast.error(`${err} rendelés törlése sikertelen (pl. kapcsolódó szállítmány).`)
  }, [selectedIds, refreshList])

  const handleBulkCancel = () => {
    if (!canBulkCancel || selectedIds.size === 0) return
    setConfirmDialog({
      open: true,
      title: 'Stornó',
      message: `Biztosan stornózza a ${selectedIds.size} kijelölt rendelést?`,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, open: false, onConfirm: null }))
        executeBulkCancel()
      }
    })
  }

  const handleBulkDelete = () => {
    if (!canBulkDelete || selectedIds.size === 0) return
    setConfirmDialog({
      open: true,
      title: 'Törlés',
      message: `Biztosan törli a ${selectedIds.size} kijelölt rendelést?`,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, open: false, onConfirm: null }))
        executeBulkDelete()
      }
    })
  }

  const handleConfirmDialogClose = () => {
    setConfirmDialog(prev => ({ ...prev, open: false, onConfirm: null }))
  }

  const hasActiveFilters = (statusFilter && statusFilter !== 'all') || !!supplierFilter || !!debouncedSearchTerm
  const handleClearFilters = () => {
    setStatusFilter('all')
    setSupplierFilter('')
    setSearchTerm('')
    router.push(`/purchase-orders?limit=${limit}`)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Beszerzési rendelések
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Itt kezelheti a beszerzési rendeléseket. Hozzon létre új rendelést, jóváhagyja vagy törölje a meglévőket.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/purchase-orders/new')}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
          >
            Új beszerzési rendelés
          </Button>
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
            <MenuItem value="draft">Vázlat</MenuItem>
            <MenuItem value="pending_approval">Jóváhagyásra vár</MenuItem>
            <MenuItem value="approved">Jóváhagyva</MenuItem>
            <MenuItem value="partially_received">Részben bevételezve</MenuItem>
            <MenuItem value="received">Bevételezve</MenuItem>
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
          placeholder="Keresés: rendelésszám, beszállító, termék, cikkszám…"
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
          <Tooltip
            title={emailSendDisabledReason}
            disableHoverListener={canBulkSendEmail}
            arrow
          >
            <span>
              <Button
                size="small"
                variant="contained"
                color="info"
                startIcon={<SendIcon />}
                onClick={handleBulkSendEmail}
                disabled={!canBulkSendEmail || bulkLoading}
              >
                E-mail küldés (1)
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleBulkApprove}
            disabled={!canBulkApprove || bulkLoading}
          >
            Jóváhagyás ({selectedIds.size})
          </Button>
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<CancelIcon />}
            onClick={handleBulkCancel}
            disabled={!canBulkCancel || bulkLoading}
          >
            Stornó ({selectedIds.size})
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
            disabled={!canBulkDelete || bulkLoading}
          >
            Törlés ({selectedIds.size})
          </Button>
          {canCreateShipment && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<LocalShippingIcon />}
              onClick={handleCreateShipment}
              disabled={bulkLoading}
            >
              Szállítmány létrehozása ({selectedIds.size})
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<ClearIcon />}
            onClick={() => setSelectedIds(new Set())}
            sx={{ borderColor: 'divider', color: 'text.secondary' }}
          >
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
                  disabled={purchaseOrders.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rendelésszám</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Raktár</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rendelés dátuma</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Várható szállítás</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Összesen</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'center' }}>Tételek</TableCell>
              <TableCell
                sx={{ fontWeight: 600, py: 1, textAlign: 'center', width: 40, maxWidth: 40, px: 0.5 }}
              >
                <Tooltip title="E-mail">
                  <EmailOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', verticalAlign: 'middle' }} />
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : purchaseOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Nincs találat a keresési feltételeknek megfelelően'
                        : 'Még nincs beszerzési rendelés létrehozva'}
                    </Typography>
                    {!searchTerm && statusFilter === 'all' && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/purchase-orders/new')}
                      >
                        Hozzon létre első beszerzési rendelést
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              purchaseOrders.map((po) => {
                const groupIdx = supplierGroupIndex.get(po.supplier_id || '') ?? 0
                const sameSupplierBg = SUPPLIER_ROW_COLORS[groupIdx % SUPPLIER_ROW_COLORS.length]
                return (
                <TableRow
                  key={po.id}
                  hover
                  selected={selectedIds.has(po.id)}
                  onClick={() => handleRowClick(po)}
                  sx={{
                    cursor: 'pointer',
                    '& td': { py: 1 },
                    backgroundColor: sameSupplierBg,
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(po.id)}
                      onChange={(e) => handleSelectOne(po.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>
                    {po.po_number}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {po.suppliers?.name || '-'}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {po.warehouses?.name || '-'}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <PurchaseOrderStatusChip status={po.status} />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {formatDate(po.order_date)}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {formatDate(po.expected_delivery_date)}
                  </TableCell>
                  <TableCell sx={{ py: 1, textAlign: 'right', fontWeight: 600 }}>
                    {formatPrice(po.total_gross)}
                  </TableCell>
                  <TableCell sx={{ py: 1, textAlign: 'center' }}>
                    {po.item_count}
                  </TableCell>
                  <TableCell
                    sx={{ py: 1, textAlign: 'center', width: 40, maxWidth: 40, px: 0.5 }}
                  >
                    {po.email_sent ? (
                      <Tooltip
                        title={
                          po.email_sent_at
                            ? `Elküldve: ${new Date(po.email_sent_at).toLocaleString('hu-HU')}`
                            : 'Elküldve'
                        }
                      >
                        <CheckIcon
                          fontSize="small"
                          sx={{ color: 'success.main', verticalAlign: 'middle' }}
                          aria-label="E-mail elküldve"
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary" component="span">
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ); })
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

      {emailModalPoId && (
        <PurchaseOrderEmailModal
          open={Boolean(emailModalPoId)}
          purchaseOrderId={emailModalPoId}
          onClose={() => setEmailModalPoId(null)}
          onSent={async () => {
            setEmailModalPoId(null)
            setSelectedIds(new Set())
            await refreshList()
          }}
        />
      )}

      {/* Bulk confirmation dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleConfirmDialogClose}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose} autoFocus>
            Mégse
          </Button>
          <Button
            onClick={() => {
              confirmDialog.onConfirm?.()
            }}
            color="primary"
            variant="contained"
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
