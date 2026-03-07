'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface CustomerGroup {
  id: string
  name: string
  code: string
  price_multiplier: number | null
  is_default: boolean
}

interface CustomerGroupPrice {
  id: string
  price: number
  is_active: boolean
  shoprenter_customer_group_price_id: string | null
  last_synced_at: string | null
  customer_group_id: string
  customer_groups: CustomerGroup
}

interface CustomerGroupPricingCardProps {
  productId: string
  isVisible?: boolean // Only load data when component is visible
}

export default function CustomerGroupPricingCard({ productId, isVisible = true }: CustomerGroupPricingCardProps) {
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [prices, setPrices] = useState<CustomerGroupPrice[]>([])
  const [product, setProduct] = useState<{ cost: number | null; price: number | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState<CustomerGroupPrice | null>(null)
  const [deletingPrice, setDeletingPrice] = useState<CustomerGroupPrice | null>(null)
  const [formData, setFormData] = useState({
    customer_group_id: '',
    price: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load customer groups
  const loadCustomerGroups = async () => {
    try {
      setLoadingGroups(true)
      const response = await fetch('/api/customer-groups')
      const result = await response.json()
      if (result.customerGroups) {
        setCustomerGroups(result.customerGroups)
      }
    } catch (error) {
      console.error('Error loading customer groups:', error)
      toast.error('Hiba a vevőcsoportok betöltésekor')
    } finally {
      setLoadingGroups(false)
    }
  }

  // Load product data (cost and base price)
  const loadProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      const result = await response.json()
      if (result.product) {
        setProduct({
          cost: result.product.cost ? parseFloat(result.product.cost) : null,
          price: result.product.price ? parseFloat(result.product.price) : null
        })
      }
    } catch (error) {
      console.error('Error loading product:', error)
    }
  }

  // Load prices for this product
  const loadPrices = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/customer-group-prices`)
      const result = await response.json()
      if (result.prices) {
        setPrices(result.prices)
      }
    } catch (error) {
      console.error('Error loading customer group prices:', error)
      toast.error('Hiba a vevőcsoport árak betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only load data when component is visible
    if (productId && isVisible) {
      loadProduct()
      loadCustomerGroups()
      loadPrices()
    }
  }, [productId, isVisible])

  // Auto-calculate price when customer group is selected and has multiplier
  useEffect(() => {
    if (formData.customer_group_id && !editingPrice) {
      const selectedGroup = customerGroups.find(g => g.id === formData.customer_group_id)
      if (selectedGroup?.price_multiplier && product?.cost && product.cost > 0) {
        const calculatedPrice = product.cost * selectedGroup.price_multiplier
        setFormData(prev => ({ ...prev, price: calculatedPrice.toFixed(2) }))
      }
    }
  }, [formData.customer_group_id, customerGroups, product, editingPrice])

  const handleOpenDialog = (price?: CustomerGroupPrice) => {
    if (price) {
      setEditingPrice(price)
      setFormData({
        customer_group_id: price.customer_group_id,
        price: price.price.toString()
      })
    } else {
      setEditingPrice(null)
      setFormData({
        customer_group_id: '',
        price: ''
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingPrice(null)
    setFormData({
      customer_group_id: '',
      price: ''
    })
  }

  const handleOpenDeleteDialog = (price: CustomerGroupPrice) => {
    setDeletingPrice(price)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingPrice(null)
  }

  const handleSave = async () => {
    if (!formData.customer_group_id || !formData.price) {
      toast.warning('Vevőcsoport és ár megadása kötelező')
      return
    }

    const priceValue = parseFloat(formData.price)
    if (isNaN(priceValue) || priceValue < 0) {
      toast.warning('Érvényes ár megadása kötelező')
      return
    }

    setSaving(true)
    try {
      const url = editingPrice
        ? `/api/products/${productId}/customer-group-prices/${editingPrice.id}`
        : `/api/products/${productId}/customer-group-prices`
      const method = editingPrice ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_group_id: formData.customer_group_id,
          price: priceValue
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      
      if (editingPrice) {
        toast.success('Vevőcsoport ár sikeresen frissítve')
      } else {
        toast.success('Vevőcsoport ár sikeresen létrehozva')
      }

      handleCloseDialog()
      await loadPrices()
    } catch (error) {
      console.error('Error saving customer group price:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingPrice) return

    setDeleting(true)
    try {
      const response = await fetch(
        `/api/products/${productId}/customer-group-prices/${deletingPrice.id}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      toast.success('Vevőcsoport ár sikeresen törölve')
      handleCloseDeleteDialog()
      await loadPrices()
    } catch (error) {
      console.error('Error deleting customer group price:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  // Get available customer groups (not already used)
  const availableCustomerGroups = customerGroups.filter(
    group => !prices.some(p => p.customer_group_id === group.id && p.id !== editingPrice?.id)
  )

  // Calculate margin if we have base price (would need to fetch from product)
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#e74c3c',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: '50%',
            bgcolor: '#e74c3c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
          }}
        >
          <AttachMoneyIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#c0392b' }}>
          Vevőcsoport Árak
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={loadingGroups || availableCustomerGroups.length === 0}
          sx={{
            bgcolor: '#e74c3c',
            '&:hover': {
              bgcolor: '#c0392b'
            }
          }}
        >
          Új vevőcsoport ár
        </Button>
        {availableCustomerGroups.length === 0 && customerGroups.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Minden vevőcsoporthoz már van ár beállítva
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : prices.length === 0 ? (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: 1, 
          mt: 1.5, 
          mb: 2,
          p: 1.5,
          bgcolor: 'rgba(231, 76, 60, 0.08)',
          borderRadius: 1,
          borderLeft: '3px solid #e74c3c'
        }}>
          <InfoIcon sx={{ color: '#c0392b', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: '#c0392b', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            Még nincs vevőcsoport ár beállítva. Kattintson az "Új vevőcsoport ár" gombra a hozzáadáshoz.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Szorzó</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Ár</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>vs Alapár</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>vs Költség</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Árrés %</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1 }}>ShopRenter</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, width: 120 }}>Műveletek</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prices.map((price) => {
                const group = price.customer_groups
                const basePrice = product?.price || 0
                const cost = product?.cost || 0
                const differenceFromBase = price.price - basePrice
                const differencePercent = basePrice > 0 ? ((differenceFromBase / basePrice) * 100) : 0
                const marginVsCost = price.price - cost
                const marginPercent = cost > 0 ? ((marginVsCost / cost) * 100) : 0
                
                return (
                  <TableRow key={price.id} hover>
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {group.name}
                        </Typography>
                        {group.is_default && (
                          <Chip
                            label="Alapértelmezett"
                            size="small"
                            color="success"
                            sx={{ fontSize: '0.7rem', height: '20px' }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {group.code}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {group.price_multiplier ? (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {group.price_multiplier.toFixed(4)}x
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Manuális
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#e74c3c' }}>
                        {formatPrice(price.price)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {basePrice > 0 ? (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 500,
                            color: differenceFromBase >= 0 ? 'success.main' : 'error.main'
                          }}
                        >
                          {differenceFromBase >= 0 ? '+' : ''}{formatPrice(differenceFromBase)}
                          <br />
                          <Typography component="span" variant="caption" color="text.secondary">
                            ({differencePercent >= 0 ? '+' : ''}{differencePercent.toFixed(1)}%)
                          </Typography>
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {cost > 0 ? (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 500,
                            color: marginVsCost >= 0 ? 'success.main' : 'error.main'
                          }}
                        >
                          {marginVsCost >= 0 ? '+' : ''}{formatPrice(marginVsCost)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {cost > 0 ? (
                        <Chip
                          label={`${marginPercent >= 0 ? '+' : ''}${marginPercent.toFixed(1)}%`}
                          size="small"
                          color={marginPercent >= 0 ? 'success' : 'error'}
                          sx={{ fontWeight: 600 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Chip
                        label={price.is_active ? 'Aktív' : 'Inaktív'}
                        size="small"
                        color={price.is_active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {price.shoprenter_customer_group_price_id ? (
                        <Tooltip title={price.shoprenter_customer_group_price_id}>
                          <Chip
                            label="Szinkronizálva"
                            size="small"
                            color="success"
                            sx={{ fontSize: '0.7rem', height: '20px' }}
                          />
                        </Tooltip>
                      ) : (
                        <Chip
                          label="Nincs szinkronizálva"
                          size="small"
                          color="warning"
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Szerkesztés">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(price)}
                            sx={{ color: '#2196f3' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Törlés">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDeleteDialog(price)}
                            sx={{ color: '#e74c3c' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPrice ? 'Vevőcsoport ár szerkesztése' : 'Új vevőcsoport ár létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Vevőcsoport</InputLabel>
              <Select
                value={formData.customer_group_id}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_group_id: e.target.value }))}
                label="Vevőcsoport"
                disabled={loadingGroups || !!editingPrice}
              >
                {editingPrice ? (
                  <MenuItem value={editingPrice.customer_group_id}>
                    {editingPrice.customer_groups.name} ({editingPrice.customer_groups.code})
                  </MenuItem>
                ) : (
                  availableCustomerGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} ({group.code})
                      {group.is_default && (
                        <Chip
                          label="Alapértelmezett"
                          size="small"
                          color="success"
                          sx={{ ml: 1, fontSize: '0.7rem', height: '18px' }}
                        />
                      )}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <TextField
              label="Ár (HUF)"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              fullWidth
              required
              inputProps={{ min: 0, step: 1 }}
              helperText={
                formData.customer_group_id && customerGroups.find(g => g.id === formData.customer_group_id)?.price_multiplier
                  ? "Az ár automatikusan számolódik a szorzó alapján. Módosíthatja manuálisan."
                  : "A termék ára ezen vevőcsoport számára"
              }
            />
            {formData.price && !isNaN(parseFloat(formData.price)) && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>Ár:</strong> {formatPrice(parseFloat(formData.price))}
                </Typography>
                {product?.cost && product.cost > 0 && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Költség:</strong> {formatPrice(product.cost)} | <strong>Árrés:</strong> {formatPrice(parseFloat(formData.price) - product.cost)} ({((parseFloat(formData.price) - product.cost) / product.cost * 100).toFixed(1)}%)
                  </Typography>
                )}
                {product?.price && product.price > 0 && (
                  <Typography variant="body2">
                    <strong>Alapár:</strong> {formatPrice(product.price)} | <strong>Különbség:</strong> {formatPrice(parseFloat(formData.price) - product.price)} ({((parseFloat(formData.price) - product.price) / product.price * 100).toFixed(1)}%)
                  </Typography>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingPrice ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a{' '}
            <strong>
              {deletingPrice?.customer_groups.name} ({deletingPrice?.customer_groups.code})
            </strong>{' '}
            vevőcsoport árát?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Ez a művelet törli a vevőcsoport árát. A vevőcsoport továbbra is elérhető marad.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting}>
            Mégse
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
