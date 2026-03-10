'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Tooltip,
  Chip,
  CircularProgress
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
  Star as StarIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface ProductSupplier {
  id: string
  supplier_id: string
  supplier_sku: string | null
  supplier_barcode: string | null
  default_cost: number | null
  last_purchased_at: string | null
  min_order_quantity: number
  lead_time_days: number | null
  is_preferred: boolean
  is_active: boolean
  suppliers?: {
    id: string
    name: string
    email: string | null
    phone: string | null
    status: string
  } | null
}

interface ProductSuppliersCardProps {
  productId: string
}

export default function ProductSuppliersCard({ productId }: ProductSuppliersCardProps) {
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<ProductSupplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<ProductSupplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_sku: '',
    supplier_barcode: '',
    default_cost: '',
    min_order_quantity: '1',
    lead_time_days: '',
    is_preferred: false,
    is_active: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load data
  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load product suppliers
      const psResponse = await fetch(`/api/products/${productId}/suppliers`)
      if (psResponse.ok) {
        const psData = await psResponse.json()
        setProductSuppliers(psData.product_suppliers || [])
      }

      // Load all suppliers
      const sResponse = await fetch('/api/suppliers')
      if (sResponse.ok) {
        const sData = await sResponse.json()
        setSuppliers(sData.suppliers || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (supplier?: ProductSupplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        supplier_id: supplier.supplier_id,
        supplier_sku: supplier.supplier_sku || '',
        supplier_barcode: supplier.supplier_barcode || '',
        default_cost: supplier.default_cost?.toString() || '',
        min_order_quantity: supplier.min_order_quantity.toString(),
        lead_time_days: supplier.lead_time_days?.toString() || '',
        is_preferred: supplier.is_preferred,
        is_active: supplier.is_active
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        supplier_id: '',
        supplier_sku: '',
        supplier_barcode: '',
        default_cost: '',
        min_order_quantity: '1',
        lead_time_days: '',
        is_preferred: false,
        is_active: true
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSupplier(null)
    setFormData({
      supplier_id: '',
      supplier_sku: '',
      supplier_barcode: '',
      default_cost: '',
      min_order_quantity: '1',
      lead_time_days: '',
      is_preferred: false,
      is_active: true
    })
    setErrors({})
  }

  const handleSave = async () => {
    // Validation
    const newErrors: Record<string, string> = {}
    if (!formData.supplier_id) newErrors.supplier_id = 'Beszállító kötelező'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      const url = editingSupplier
        ? `/api/products/${productId}/suppliers/${formData.supplier_id}`
        : `/api/products/${productId}/suppliers`
      const method = editingSupplier ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: formData.supplier_id,
          supplier_sku: formData.supplier_sku || null,
          supplier_barcode: formData.supplier_barcode || null,
          default_cost: formData.default_cost ? parseFloat(formData.default_cost) : null,
          min_order_quantity: parseInt(formData.min_order_quantity) || 1,
          lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
          is_preferred: formData.is_preferred,
          is_active: formData.is_active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      toast.success(editingSupplier ? 'Beszállító sikeresen frissítve' : 'Beszállító sikeresen hozzáadva')
      handleCloseDialog()
      loadData()
    } catch (error) {
      console.error('Error saving supplier:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDeleteDialog = (supplier: ProductSupplier) => {
    setDeletingSupplier(supplier)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingSupplier(null)
  }

  const handleDelete = async () => {
    if (!deletingSupplier) return

    setDeleting(true)
    try {
      const response = await fetch(
        `/api/products/${productId}/suppliers/${deletingSupplier.supplier_id}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      toast.success('Beszállító sikeresen eltávolítva')
      handleCloseDeleteDialog()
      loadData()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
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

  // Get available suppliers (not already added)
  const availableSuppliers = suppliers.filter(
    s => !productSuppliers.some(ps => ps.supplier_id === s.id && ps.id !== editingSupplier?.id)
  )

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#ff9800',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#ff9800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
        }}>
          <StoreIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#f57c00' }}>
          Beszállítók
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={availableSuppliers.length === 0}
          sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' } }}
        >
          Beszállító hozzáadása
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : productSuppliers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <StoreIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Még nincs beszállító hozzárendelve
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={availableSuppliers.length === 0}
          >
            Hozzon létre első beszállítót
          </Button>
        </Box>
      ) : (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító SKU</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Beszállító vonalkód</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Alapértelmezett ár</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Min. rendelés</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Szállítási idő</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productSuppliers.map((ps) => (
                <TableRow key={ps.id} hover sx={{ '& td': { py: 1 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {ps.is_preferred && (
                        <StarIcon sx={{ fontSize: 18, color: '#ff9800' }} />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: ps.is_preferred ? 600 : 400 }}>
                        {ps.suppliers?.name || '-'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{ps.supplier_sku || '-'}</TableCell>
                  <TableCell>{ps.supplier_barcode || '-'}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{formatPrice(ps.default_cost)}</TableCell>
                  <TableCell>{ps.min_order_quantity}</TableCell>
                  <TableCell>{ps.lead_time_days ? `${ps.lead_time_days} nap` : '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={ps.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        bgcolor: ps.is_active ? '#4caf50' : '#f44336',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Szerkesztés">
                        <IconButton size="small" onClick={() => handleOpenDialog(ps)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Törlés">
                        <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(ps)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSupplier ? 'Beszállító szerkesztése' : 'Beszállító hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth required error={!!errors.supplier_id} disabled={!!editingSupplier}>
              <InputLabel>Beszállító *</InputLabel>
              <Select
                value={formData.supplier_id}
                label="Beszállító *"
                onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
              >
                {availableSuppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {errors.supplier_id && (
              <Typography variant="caption" color="error" sx={{ mt: -1.5, ml: 1.75 }}>
                {errors.supplier_id}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Beszállító SKU"
                value={formData.supplier_sku}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier_sku: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Beszállító vonalkód"
                value={formData.supplier_barcode}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier_barcode: e.target.value }))}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Alapértelmezett ár"
                type="number"
                value={formData.default_cost}
                onChange={(e) => setFormData(prev => ({ ...prev, default_cost: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Minimális rendelési mennyiség"
                type="number"
                value={formData.min_order_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, min_order_quantity: e.target.value }))}
              />
            </Box>
            <TextField
              fullWidth
              label="Szállítási idő (nap)"
              type="number"
              value={formData.lead_time_days}
              onChange={(e) => setFormData(prev => ({ ...prev, lead_time_days: e.target.value }))}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Előnyben részesített</InputLabel>
                <Select
                  value={formData.is_preferred ? 'true' : 'false'}
                  label="Előnyben részesített"
                  onChange={(e) => setFormData(prev => ({ ...prev, is_preferred: e.target.value === 'true' }))}
                >
                  <MenuItem value="false">Nem</MenuItem>
                  <MenuItem value="true">Igen</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Státusz</InputLabel>
                <Select
                  value={formData.is_active ? 'true' : 'false'}
                  label="Státusz"
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                >
                  <MenuItem value="true">Aktív</MenuItem>
                  <MenuItem value="false">Inaktív</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Mégse</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Beszállító eltávolítása</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan eltávolítja ezt a beszállítót a termékből?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Mégse</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
