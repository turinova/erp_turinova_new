'use client'

import React, { useState, useEffect } from 'react'
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface PurchaseOrderItem {
  id: string
  product_id: string
  product_supplier_id: string | null
  quantity: number
  unit_cost: number
  vat_id: string
  currency_id: string | null
  unit_id: string
  description: string | null
  received_quantity: number
  products?: { id: string; name: string; sku: string } | null
  product_suppliers?: { id: string; supplier_sku: string } | null
  vat?: { id: string; name: string; kulcs: number } | null
  currencies?: { id: string; name: string; code: string } | null
  units?: { id: string; name: string; shortform: string } | null
}

interface PurchaseOrderItemsTableProps {
  purchaseOrderId: string
  purchaseOrderStatus: string
  supplierId: string
  initialItems: PurchaseOrderItem[]
  suppliers: Array<{ id: string; name: string }>
  vatRates: Array<{ id: string; name: string; rate: number }>
  currencies: Array<{ id: string; name: string; code: string; symbol: string }>
  units: Array<{ id: string; name: string; shortform: string }>
  onItemsChange: (items: PurchaseOrderItem[]) => void
}

export default function PurchaseOrderItemsTable({
  purchaseOrderId,
  purchaseOrderStatus,
  supplierId,
  initialItems,
  suppliers,
  vatRates,
  currencies,
  units,
  onItemsChange
}: PurchaseOrderItemsTableProps) {
  const [items, setItems] = useState<PurchaseOrderItem[]>(initialItems)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseOrderItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<PurchaseOrderItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [supplierProducts, setSupplierProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const canEdit = purchaseOrderStatus === 'draft' || purchaseOrderStatus === 'pending_approval'

  // Load supplier products when dialog opens
  useEffect(() => {
    if (dialogOpen && supplierId && !editingItem) {
      setLoadingProducts(true)
      fetch(`/api/products/supplier/${supplierId}`)
        .then(res => res.json())
        .then(data => {
          setSupplierProducts(data.products || [])
        })
        .catch(err => {
          console.error('Error fetching supplier products:', err)
          toast.error('Hiba a termékek lekérdezésekor')
        })
        .finally(() => setLoadingProducts(false))
    }
  }, [dialogOpen, supplierId, editingItem])

  const [formData, setFormData] = useState({
    product_id: '',
    product_supplier_id: '',
    quantity: '',
    unit_cost: '',
    vat_id: '',
    currency_id: '',
    unit_id: '',
    description: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleOpenDialog = (item?: PurchaseOrderItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        product_id: item.product_id,
        product_supplier_id: item.product_supplier_id || '',
        quantity: item.quantity.toString(),
        unit_cost: item.unit_cost.toString(),
        vat_id: item.vat_id,
        currency_id: item.currency_id || '',
        unit_id: item.unit_id,
        description: item.description || ''
      })
    } else {
      setEditingItem(null)
      setFormData({
        product_id: '',
        product_supplier_id: '',
        quantity: '',
        unit_cost: '',
        vat_id: '',
        currency_id: '',
        unit_id: '',
        description: ''
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingItem(null)
    setFormData({
      product_id: '',
      product_supplier_id: '',
      quantity: '',
      unit_cost: '',
      vat_id: '',
      currency_id: '',
      unit_id: '',
      description: ''
    })
    setErrors({})
  }

  const handleSaveItem = async () => {
    // Validation
    const newErrors: Record<string, string> = {}
    if (!formData.product_id) newErrors.product_id = 'Termék kötelező'
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) newErrors.quantity = 'Mennyiség pozitív szám kell legyen'
    if (!formData.unit_cost || parseFloat(formData.unit_cost) < 0) newErrors.unit_cost = 'Egységár nem lehet negatív'
    if (!formData.vat_id) newErrors.vat_id = 'ÁFA kötelező'
    if (!formData.unit_id) newErrors.unit_id = 'Mértékegység kötelező'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      const url = editingItem
        ? `/api/purchase-orders/${purchaseOrderId}/items/${editingItem.id}`
        : `/api/purchase-orders/${purchaseOrderId}/items`
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formData.product_id,
          product_supplier_id: formData.product_supplier_id || null,
          quantity: parseFloat(formData.quantity),
          unit_cost: parseFloat(formData.unit_cost),
          vat_id: formData.vat_id,
          currency_id: formData.currency_id || null,
          unit_id: formData.unit_id,
          description: formData.description || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const data = await response.json()
      
      if (editingItem) {
        setItems(prev => prev.map(item => item.id === editingItem.id ? data.item : item))
      } else {
        setItems(prev => [...prev, data.item])
      }

      toast.success(editingItem ? 'Tétel sikeresen frissítve' : 'Tétel sikeresen hozzáadva')
      handleCloseDialog()
      onItemsChange(items)
      // Refresh page to get updated totals
      window.location.reload()
    } catch (error) {
      console.error('Error saving item:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDeleteDialog = (item: PurchaseOrderItem) => {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingItem(null)
  }

  const handleDeleteItem = async () => {
    if (!deletingItem) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/items/${deletingItem.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setItems(prev => prev.filter(item => item.id !== deletingItem.id))
      toast.success('Tétel sikeresen törölve')
      handleCloseDeleteDialog()
      onItemsChange(items)
      // Refresh page to get updated totals
      window.location.reload()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  const calculateLineTotal = (item: PurchaseOrderItem) => {
    const vatRate = item.vat?.kulcs || 0
    const lineNet = Math.round(item.unit_cost * item.quantity)
    const lineVat = Math.round(lineNet * vatRate / 100)
    const lineGross = lineNet + lineVat
    return { lineNet, lineVat, lineGross }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  // Calculate totals
  const totals = items.reduce((acc, item) => {
    const { lineNet, lineVat, lineGross } = calculateLineTotal(item)
    acc.net += lineNet
    acc.vat += lineVat
    acc.gross += lineGross
    return acc
  }, { net: 0, vat: 0, gross: 0 })

  return (
    <Box>
      {/* Action Bar */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Rendelési tételek
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Tétel hozzáadása
          </Button>
        )}
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Termék</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító SKU</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Mennyiség</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Egységár</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>ÁFA</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Nettó</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>ÁFA</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Bruttó</TableCell>
              {purchaseOrderStatus !== 'draft' && purchaseOrderStatus !== 'pending_approval' && (
                <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Bevételezve</TableCell>
              )}
              {canEdit && (
                <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}></TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 10 : 9} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs tétel hozzáadva
                    </Typography>
                    {canEdit && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                      >
                        Hozzon létre első tételeket
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item) => {
                  const { lineNet, lineVat, lineGross } = calculateLineTotal(item)
                  return (
                    <TableRow key={item.id} hover sx={{ '& td': { py: 1 } }}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.products?.name || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            SKU: {item.products?.sku || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{item.product_suppliers?.supplier_sku || '-'}</TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {item.quantity} {item.units?.shortform || ''}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {formatPrice(item.unit_cost)}
                      </TableCell>
                      <TableCell>
                        {item.vat?.name || '-'} ({item.vat?.kulcs || 0}%)
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatPrice(lineNet)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {formatPrice(lineVat)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatPrice(lineGross)}
                      </TableCell>
                      {purchaseOrderStatus !== 'draft' && purchaseOrderStatus !== 'pending_approval' && (
                        <TableCell sx={{ textAlign: 'right' }}>
                          {item.received_quantity || 0} {item.units?.shortform || ''}
                        </TableCell>
                      )}
                      {canEdit && (
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Szerkesztés">
                              <IconButton size="small" onClick={() => handleOpenDialog(item)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Törlés">
                              <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(item)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                {/* Summary Row */}
                <TableRow sx={{ backgroundColor: 'action.hover', '& td': { py: 1.5, fontWeight: 700 } }}>
                  <TableCell colSpan={5} sx={{ textAlign: 'right', fontWeight: 700 }}>
                    Összesen:
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatPrice(totals.net)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatPrice(totals.vat)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem' }}>
                    {formatPrice(totals.gross)}
                  </TableCell>
                  {purchaseOrderStatus !== 'draft' && purchaseOrderStatus !== 'pending_approval' && (
                    <TableCell></TableCell>
                  )}
                  {canEdit && <TableCell></TableCell>}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Tétel szerkesztése' : 'Új tétel hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {loadingProducts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <FormControl fullWidth required error={!!errors.product_id} disabled={!!editingItem}>
                <InputLabel>Termék *</InputLabel>
                <Select
                  value={formData.product_id}
                  label="Termék *"
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, product_id: e.target.value }))
                    const product = supplierProducts.find(p => p.product_id === e.target.value)
                    if (product) {
                      setFormData(prev => ({
                        ...prev,
                        product_supplier_id: product.product_supplier_id || '',
                        unit_cost: product.default_cost?.toString() || '',
                        vat_id: product.vat_id || prev.vat_id,
                        unit_id: product.unit_id || prev.unit_id
                      }))
                    }
                  }}
                >
                  {supplierProducts.map((product) => (
                    <MenuItem key={product.product_id} value={product.product_id}>
                      {product.product_name} {product.supplier_sku ? `(${product.supplier_sku})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {errors.product_id && (
              <Typography variant="caption" color="error" sx={{ mt: -1.5, ml: 1.75 }}>
                {errors.product_id}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Mennyiség *"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                error={!!errors.quantity}
                helperText={errors.quantity}
              />
              <FormControl fullWidth error={!!errors.unit_id}>
                <InputLabel>Mértékegység *</InputLabel>
                <Select
                  value={formData.unit_id}
                  label="Mértékegység *"
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_id: e.target.value }))}
                >
                  {units.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.shortform})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <TextField
              fullWidth
              label="Egységár *"
              type="number"
              value={formData.unit_cost}
              onChange={(e) => setFormData(prev => ({ ...prev, unit_cost: e.target.value }))}
              error={!!errors.unit_cost}
              helperText={errors.unit_cost}
            />
            <FormControl fullWidth error={!!errors.vat_id}>
              <InputLabel>ÁFA *</InputLabel>
              <Select
                value={formData.vat_id}
                label="ÁFA *"
                onChange={(e) => setFormData(prev => ({ ...prev, vat_id: e.target.value }))}
              >
                {vatRates.map((vat) => (
                  <MenuItem key={vat.id} value={vat.id}>
                    {vat.name} ({vat.rate}%)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Megjegyzés"
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Mégse</Button>
          <Button onClick={handleSaveItem} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Tétel törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné ezt a tételeket?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Mégse</Button>
          <Button onClick={handleDeleteItem} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
