'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import {
  Save as SaveIcon,
  Info as InfoIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import EditablePurchaseOrderItemsTable from '@/components/purchasing/EditablePurchaseOrderItemsTable'

interface NewPurchaseOrderFormProps {
  suppliers: Array<{ id: string; name: string }>
  warehouses: Array<{ id: string; name: string; code: string }>
  currencies: Array<{ id: string; name: string; code: string; symbol: string }>
  vatRates: Array<{ id: string; name: string; rate: number }>
  units: Array<{ id: string; name: string; shortform: string }>
}

interface PurchaseOrderItem {
  id?: string
  product_id: string
  product_name: string
  product_sku: string
  product_supplier_id?: string
  quantity: number
  unit_cost: number
  vat_id: string
  currency_id?: string
  unit_id: string
  description?: string
}

export default function NewPurchaseOrderForm({
  suppliers,
  warehouses,
  currencies,
  vatRates,
  units
}: NewPurchaseOrderFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  
  // Initialize state with defaults (no localStorage access to avoid hydration mismatch)
  const [formData, setFormData] = useState({
    supplier_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    currency_id: '',
    note: ''
  })

  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasMounted, setHasMounted] = useState(false)
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false)

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    setHasMounted(true)
    
    // Load saved draft from localStorage
    const savedData = localStorage.getItem('new_purchase_order_draft')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        if (parsed.formData) {
          setFormData(parsed.formData)
        }
        if (parsed.items && Array.isArray(parsed.items)) {
          setItems(parsed.items)
        }
        setHasLoadedFromStorage(true)
      } catch (error) {
        console.error('Error loading draft:', error)
      }
    }
  }, [])

  // Save to localStorage whenever formData or items change (but not on initial load or when loading from storage)
  useEffect(() => {
    if (!hasMounted || !hasLoadedFromStorage) return // Don't save on initial mount or while loading from storage
    
    const draftData = {
      formData,
      items,
      timestamp: Date.now()
    }
    localStorage.setItem('new_purchase_order_draft', JSON.stringify(draftData))
  }, [formData, items, hasMounted, hasLoadedFromStorage])


  // Set default currency to HUF (base currency) - only if not loaded from localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage && currencies.length > 0 && !formData.currency_id) {
      const hufCurrency = currencies.find(c => c.code === 'HUF' || c.name === 'HUF' || c.name === 'Magyar forint')
      if (hufCurrency) {
        setFormData(prev => ({ ...prev, currency_id: hufCurrency.id }))
      } else {
        // If HUF not found, use first currency
        setFormData(prev => ({ ...prev, currency_id: currencies[0].id }))
      }
    }
  }, [currencies, formData.currency_id, hasLoadedFromStorage])

  // Set default warehouse to first warehouse - only if not loaded from localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage && warehouses.length > 0 && !formData.warehouse_id) {
      setFormData(prev => ({ ...prev, warehouse_id: warehouses[0].id }))
    }
  }, [warehouses, formData.warehouse_id, hasLoadedFromStorage])


  // Handle product selection from search
  const handleProductSelect = (product: any) => {
    if (!product || !product.has_suppliers) {
      toast.warning('Ez a termék nincs hozzárendelve beszállítóhoz. Kérjük, először adja hozzá a termékhez a beszállítót.')
      return
    }

    // If only one supplier, auto-select and add product
    if (product.suppliers.length === 1) {
      const supplier = product.suppliers[0]
      // Auto-select supplier if not already selected
      if (!formData.supplier_id || formData.supplier_id !== supplier.supplier_id) {
        setFormData(prev => ({ ...prev, supplier_id: supplier.supplier_id }))
      }
      // Add product to items
      addProductToItems(product, supplier)
      setProductSearchTerm('')
      setProductSearchResults([])
    } else {
      // Multiple suppliers - show dialog to select
      setSupplierSelectionDialog({ open: true, product })
    }
  }

  // Add product to items
  const addProductToItems = (product: any, supplier: any) => {
    const newItem: PurchaseOrderItem = {
      product_id: product.product_id,
      product_supplier_id: supplier.product_supplier_id,
      quantity: supplier.min_order_quantity || 1,
      unit_cost: supplier.default_cost || product.cost || 0,
      vat_id: product.vat_id || vatRates[0]?.id || '',
      currency_id: formData.currency_id || '',
      unit_id: product.unit_id || units[0]?.id || '',
      description: ''
    }
    setItems(prev => [...prev, newItem])
    
    // Also add to supplierProducts if supplier is already selected, so the table can display it
    if (formData.supplier_id === supplier.supplier_id) {
      const productSupplierData = {
        product_supplier_id: supplier.product_supplier_id,
        product_id: product.product_id,
        product_name: product.product_name,
        product_sku: product.product_sku,
        supplier_sku: supplier.supplier_sku,
        supplier_barcode: supplier.supplier_barcode,
        default_cost: supplier.default_cost,
        last_purchased_at: null,
        min_order_quantity: supplier.min_order_quantity || 1,
        lead_time_days: supplier.lead_time_days,
        is_preferred: supplier.is_preferred,
        vat_id: product.vat_id,
        vat_rate: product.vat_rate,
        unit_id: product.unit_id,
        unit_name: product.unit_name,
        unit_shortform: product.unit_shortform
      }
      setSupplierProducts(prev => {
        // Check if already exists
        if (prev.find(p => p.product_supplier_id === supplier.product_supplier_id)) {
          return prev
        }
        return [...prev, productSupplierData]
      })
    }
    
    toast.success(`Termék hozzáadva: ${product.product_name}`)
  }

  // Handle supplier selection from dialog
  const handleSupplierSelectFromDialog = (supplier: any) => {
    if (!supplierSelectionDialog.product) return
    
    // Auto-select supplier if not already selected
    const needsSupplierLoad = !formData.supplier_id || formData.supplier_id !== supplier.supplier_id
    if (needsSupplierLoad) {
      setFormData(prev => ({ ...prev, supplier_id: supplier.supplier_id }))
    }
    
    addProductToItems(supplierSelectionDialog.product, supplier)
    setSupplierSelectionDialog({ open: false, product: null })
    setProductSearchTerm('')
    setProductSearchResults([])
  }

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleSelectChange = (field: string) => (e: any) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Product search function for the table
  const handleProductSearch = async (searchTerm: string): Promise<any[]> => {
    try {
      const response = await fetch(`/api/products/search-for-po?q=${encodeURIComponent(searchTerm)}&limit=20`)
      if (!response.ok) {
        throw new Error('Hiba a termékek keresésekor')
      }
      const data = await response.json()
      return data.products || []
    } catch (error) {
      console.error('Error searching products:', error)
      return []
    }
  }

  const handleSave = async () => {
    // Validation
    const newErrors: Record<string, string> = {}
    if (!formData.supplier_id) newErrors.supplier_id = 'Beszállító kötelező'
    if (!formData.warehouse_id) newErrors.warehouse_id = 'Raktár kötelező'
    if (items.length === 0) {
      toast.error('Legalább egy tétel kötelező')
      return
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map(item => ({
            product_id: item.product_id,
            product_supplier_id: item.product_supplier_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            vat_id: item.vat_id,
            currency_id: item.currency_id || formData.currency_id || null,
            unit_id: item.unit_id,
            description: item.description
          }))
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const data = await response.json()
      // Clear localStorage draft after successful save
      localStorage.removeItem('new_purchase_order_draft')
      toast.success('Beszerzési rendelés sikeresen létrehozva')
      router.push(`/purchase-orders/${data.purchase_order.id}`)
    } catch (error) {
      console.error('Error creating purchase order:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Új beszerzési rendelés
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Hozzon létre egy új beszerzési rendelést. Kereshet terméket név vagy SKU alapján, vagy válasszon beszállítót és adja hozzá a tételeket.
        </Typography>
      </Box>

      {/* Form */}
      <Grid container spacing={3}>
        {/* Card: Alapinformációk */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#2196f3',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
              <Box sx={{
                p: 1,
                borderRadius: '50%',
                bgcolor: '#2196f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
              }}>
                <InfoIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
                Alapinformációk
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!!errors.supplier_id}>
                  <InputLabel>Beszállító *</InputLabel>
                  <Select
                    value={formData.supplier_id}
                    label="Beszállító *"
                    onChange={handleSelectChange('supplier_id')}
                  >
                    {suppliers.map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {errors.supplier_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {errors.supplier_id}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!!errors.warehouse_id}>
                  <InputLabel>Raktár *</InputLabel>
                  <Select
                    value={formData.warehouse_id}
                    label="Raktár *"
                    onChange={handleSelectChange('warehouse_id')}
                  >
                    {warehouses.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {errors.warehouse_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    {errors.warehouse_id}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Rendelés dátuma"
                  type="date"
                  value={formData.order_date}
                  onChange={handleInputChange('order_date')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Várható szállítási dátum"
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={handleInputChange('expected_delivery_date')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Pénznem</InputLabel>
                  <Select
                    value={formData.currency_id}
                    label="Pénznem"
                    onChange={handleSelectChange('currency_id')}
                  >
                    <MenuItem value="">Nincs</MenuItem>
                    {currencies.map((currency) => (
                      <MenuItem key={currency.id} value={currency.id}>
                        {currency.name} ({currency.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Megjegyzés"
                  multiline
                  rows={3}
                  value={formData.note}
                  onChange={handleInputChange('note')}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>


        {/* Items Section */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#9c27b0',
              borderRadius: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                p: 1,
                borderRadius: '50%',
                bgcolor: '#9c27b0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
              }}>
                <ShoppingCartIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
                Tételek
              </Typography>
            </Box>

            <EditablePurchaseOrderItemsTable
              items={items}
              onItemsChange={setItems}
              vatRates={vatRates}
              units={units}
              onProductSearch={handleProductSearch}
              orderChannels={[]}
              supplierId={formData.supplier_id || undefined}
            />
          </Paper>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                // Clear localStorage draft when canceling
                localStorage.removeItem('new_purchase_order_draft')
                router.push('/purchase-orders')
              }}
            >
              Mégse
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || !formData.supplier_id || !formData.warehouse_id || items.length === 0}
            >
              {saving ? 'Mentés...' : 'Mentés'}
            </Button>
          </Box>
        </Grid>
      </Grid>

    </Box>
  )
}

