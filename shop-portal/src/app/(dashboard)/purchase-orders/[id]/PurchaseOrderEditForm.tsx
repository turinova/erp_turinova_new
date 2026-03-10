'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link
} from '@mui/material'
import {
  Save as SaveIcon,
  Info as InfoIcon,
  ShoppingCart as ShoppingCartIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  LocalShipping as LocalShippingIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  Language as InternetIcon,
  Send as SendIcon,
  Business as BusinessIcon,
  Warehouse as WarehouseIcon,
  CalendarToday as CalendarTodayIcon,
  AttachMoney as AttachMoneyIcon,
  Note as NoteIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import PurchaseOrderStatusChip from '@/components/purchasing/PurchaseOrderStatusChip'
import EditablePurchaseOrderItemsTable from '@/components/purchasing/EditablePurchaseOrderItemsTable'

interface PurchaseOrder {
  id: string
  po_number: string
  status: string
  supplier_id: string
  warehouse_id: string
  order_date: string
  expected_delivery_date: string | null
  currency_id: string | null
  note: string | null
  total_net: number
  total_vat: number
  total_gross: number
  total_weight: number
  item_count: number
  total_quantity: number
  approved_at: string | null
  approved_by: string | null
  suppliers?: { id: string; name: string } | null
  warehouses?: { id: string; name: string } | null
  currencies?: { id: string; name: string; code: string } | null
  approved_by_user?: { id: string; email: string; full_name: string } | null
  purchase_order_items?: any[]
}

interface PurchaseOrderEditFormProps {
  initialPurchaseOrder: PurchaseOrder
  suppliers: Array<{ id: string; name: string }>
  warehouses: Array<{ id: string; name: string; code: string }>
  currencies: Array<{ id: string; name: string; code: string; symbol: string }>
  vatRates: Array<{ id: string; name: string; rate: number }>
  units: Array<{ id: string; name: string; shortform: string }>
  linkedShipments: Array<{ id: string; shipment_number: string; status: string }>
  orderChannels: Array<{ id: string; channel_type: string; name: string | null; url_template: string | null; description: string | null }>
}


export default function PurchaseOrderEditForm({
  initialPurchaseOrder,
  suppliers,
  warehouses,
  currencies,
  vatRates,
  units,
  linkedShipments,
  orderChannels
}: PurchaseOrderEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder>(initialPurchaseOrder)
  const [formData, setFormData] = useState({
    supplier_id: initialPurchaseOrder.supplier_id,
    warehouse_id: initialPurchaseOrder.warehouse_id,
    order_date: initialPurchaseOrder.order_date,
    expected_delivery_date: initialPurchaseOrder.expected_delivery_date || '',
    currency_id: initialPurchaseOrder.currency_id || '',
    note: initialPurchaseOrder.note || ''
  })

  // Transform items to match EditablePurchaseOrderItemsTable format
  const [items, setItems] = useState(() => {
    return (initialPurchaseOrder.purchase_order_items || []).map((item: any) => {
      // Get supplier_sku from product_suppliers relationship, fallback to model_number, then product SKU
      // model_number is often used as the supplier/manufacturer SKU
      const supplierSku = item.product_suppliers?.supplier_sku 
        || item.products?.model_number 
        || item.products?.sku 
        || null
      
      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || '',
        product_sku: item.products?.sku || '',
        supplier_sku: supplierSku, // Use product_suppliers.supplier_sku, or model_number, or product SKU
        product_supplier_id: item.product_supplier_id,
        quantity: item.quantity,
        quantity_received: item.quantity_received || 0,
        unit_cost: item.unit_cost,
        vat_id: item.vat_id,
        unit_id: item.unit_id,
        currency_id: item.currency_id || null,
        description: item.description || ''
      }
    })
  })

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const initialStateRef = useRef<{
    formData: typeof formData
    items: typeof items
  } | null>(null)

  // Initialize initial state
  useEffect(() => {
    if (!initialStateRef.current) {
      initialStateRef.current = {
        formData: { ...formData },
        items: [...items]
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Track changes
  useEffect(() => {
    if (!initialStateRef.current) return
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialStateRef.current.formData)
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(initialStateRef.current.items)
    setHasUnsavedChanges(formChanged || itemsChanged)
  }, [formData, items])

  // Warn on browser/tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [hasUnsavedChanges])

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSelectChange = (field: string) => (e: any) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
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
    if (purchaseOrder.status === 'received') {
      toast.error('A bevételezett rendelés nem szerkeszthető')
      return
    }

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
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map(item => ({
            id: item.id,
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
      setPurchaseOrder(data.purchase_order)
      if (initialStateRef.current) {
        initialStateRef.current.formData = { ...formData }
        initialStateRef.current.items = [...items]
      }
      setHasUnsavedChanges(false)
      toast.success('Beszerzési rendelés sikeresen mentve')
      router.refresh()
    } catch (error) {
      console.error('Error saving purchase order:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (purchaseOrder.status !== 'draft' && purchaseOrder.status !== 'pending_approval') {
      toast.error('Csak vázlat vagy jóváhagyásra vár státuszú rendelés jóváhagyható')
      return
    }

    setApproving(true)
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a jóváhagyás során')
      }

      const data = await response.json()
      setPurchaseOrder(data.purchase_order)
      toast.success('Beszerzési rendelés sikeresen jóváhagyva')
      router.refresh()
    } catch (error) {
      console.error('Error approving purchase order:', error)
      toast.error(
        `Hiba a jóváhagyás során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setApproving(false)
    }
  }

  const handleCancel = async () => {
    if (purchaseOrder.status === 'received') {
      toast.error('A bevételezett rendelés nem törölhető')
      return
    }

    if (!confirm(`Biztosan törölni szeretné a ${purchaseOrder.po_number} rendelést?`)) {
      return
    }

    setCancelling(true)
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Felhasználó által törölve' })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      const data = await response.json()
      setPurchaseOrder(data.purchase_order)
      toast.success('Beszerzési rendelés sikeresen törölve')
      router.refresh()
    } catch (error) {
      console.error('Error cancelling purchase order:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setCancelling(false)
    }
  }

  const handleCreateShipment = () => {
    if (purchaseOrder.status !== 'approved') {
      toast.error('Csak jóváhagyott rendelésből hozható létre szállítmány')
      return
    }
    router.push(`/shipments/new?po_ids=${purchaseOrder.id}`)
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

  const canEdit = purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending_approval'
  const canApprove = purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending_approval'
  const canCancel = purchaseOrder.status !== 'received'
  const canCreateShipment = purchaseOrder.status === 'approved'

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {purchaseOrder.po_number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Beszállító: {purchaseOrder.suppliers?.name || '-'} | Raktár: {purchaseOrder.warehouses?.name || '-'}
            </Typography>
          </Box>
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            {canCancel && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Törlés...' : 'Törlés'}
              </Button>
            )}
            {canApprove && (
              <>
                {orderChannels.some(ch => ch.channel_type === 'email') && (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<SendIcon />}
                    onClick={() => {
                      // TODO: Implement email sending functionality
                      toast.info('E-mail küldés funkció hamarosan elérhető')
                    }}
                  >
                    E-mail küldés
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleApprove}
                  disabled={approving}
                >
                  {approving ? 'Jóváhagyás...' : purchaseOrder.status === 'pending_approval' ? 'Jóváhagyva' : 'Jóváhagyás'}
                </Button>
              </>
            )}
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
              >
                {saving ? 'Mentés...' : 'Mentés'}
              </Button>
            )}
            {canCreateShipment && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<LocalShippingIcon />}
                onClick={handleCreateShipment}
              >
                Szállítmány létrehozása
              </Button>
            )}
          </Box>
        </Box>
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              {/* Order Channel Icons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {orderChannels.map((channel) => {
                  if (channel.channel_type === 'email') {
                    return (
                      <Tooltip key={channel.id} title="E-mail rendelési csatorna">
                        <EmailIcon sx={{ color: '#2196f3', fontSize: '20px' }} />
                      </Tooltip>
                    )
                  } else if (channel.channel_type === 'phone') {
                    return (
                      <Tooltip key={channel.id} title={`Telefon: ${purchaseOrder.suppliers?.phone || '-'}`}>
                        <PhoneIcon sx={{ color: '#2196f3', fontSize: '20px' }} />
                      </Tooltip>
                    )
                  } else if (channel.channel_type === 'in_person') {
                    return (
                      <Tooltip key={channel.id} title="Személyes rendelési csatorna">
                        <PersonIcon sx={{ color: '#2196f3', fontSize: '20px' }} />
                      </Tooltip>
                    )
                  } else if (channel.channel_type === 'internet') {
                    return (
                      <Tooltip key={channel.id} title="Internet rendelési csatorna">
                        <InternetIcon sx={{ color: '#2196f3', fontSize: '20px' }} />
                      </Tooltip>
                    )
                  }
                  return null
                })}
              </Box>
            </Box>
            
            {/* Main Information Section */}
            <Grid container spacing={3}>
              {/* Beszállító & Raktár */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(33, 150, 243, 0.03)',
                  border: '1px solid',
                  borderColor: 'rgba(33, 150, 243, 0.1)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      p: 0.75,
                      borderRadius: '8px',
                      bgcolor: '#2196f3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <BusinessIcon sx={{ color: 'white', fontSize: '18px' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1565c0' }}>
                      Beszállító
                    </Typography>
                  </Box>
                  {canEdit ? (
                    <FormControl fullWidth size="small" sx={{ pl: 4.5 }}>
                      <Select
                        value={formData.supplier_id}
                        onChange={handleSelectChange('supplier_id')}
                        sx={{ bgcolor: 'white' }}
                      >
                        {suppliers.map((supplier) => (
                          <MenuItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, pl: 4.5 }}>
                      {suppliers.find(s => s.id === formData.supplier_id)?.name || '-'}
                    </Typography>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(33, 150, 243, 0.03)',
                  border: '1px solid',
                  borderColor: 'rgba(33, 150, 243, 0.1)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      p: 0.75,
                      borderRadius: '8px',
                      bgcolor: '#2196f3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <WarehouseIcon sx={{ color: 'white', fontSize: '18px' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1565c0' }}>
                      Raktár
                    </Typography>
                  </Box>
                  {canEdit ? (
                    <FormControl fullWidth size="small" sx={{ pl: 4.5 }}>
                      <Select
                        value={formData.warehouse_id}
                        onChange={handleSelectChange('warehouse_id')}
                        sx={{ bgcolor: 'white' }}
                      >
                        {warehouses.map((warehouse) => (
                          <MenuItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, pl: 4.5 }}>
                      {warehouses.find(w => w.id === formData.warehouse_id)?.name || '-'} {warehouses.find(w => w.id === formData.warehouse_id)?.code && `(${warehouses.find(w => w.id === formData.warehouse_id)?.code})`}
                    </Typography>
                  )}
                </Box>
              </Grid>

              {/* Dates Section */}
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2.5, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(255, 152, 0, 0.03)',
                  border: '1px solid',
                  borderColor: 'rgba(255, 152, 0, 0.1)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      p: 0.75,
                      borderRadius: '8px',
                      bgcolor: '#ff9800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CalendarTodayIcon sx={{ color: 'white', fontSize: '18px' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#f57c00' }}>
                      Dátumok
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                          Rendelés dátuma
                        </Typography>
                        {canEdit ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={formData.order_date}
                            onChange={handleInputChange('order_date')}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {formatDate(formData.order_date)}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                          Várható szállítás
                        </Typography>
                        {canEdit ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={formData.expected_delivery_date}
                            onChange={handleInputChange('expected_delivery_date')}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {formatDate(formData.expected_delivery_date)}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Currency & Note Section */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(76, 175, 80, 0.03)',
                  border: '1px solid',
                  borderColor: 'rgba(76, 175, 80, 0.1)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      p: 0.75,
                      borderRadius: '8px',
                      bgcolor: '#4caf50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <AttachMoneyIcon sx={{ color: 'white', fontSize: '18px' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#388e3c' }}>
                      Pénznem
                    </Typography>
                  </Box>
                  {canEdit ? (
                    <FormControl fullWidth size="small" sx={{ pl: 4.5 }}>
                      <Select
                        value={formData.currency_id}
                        onChange={handleSelectChange('currency_id')}
                        sx={{ bgcolor: 'white' }}
                      >
                        <MenuItem value="">Nincs</MenuItem>
                        {currencies.map((currency) => (
                          <MenuItem key={currency.id} value={currency.id}>
                            {currency.name} ({currency.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, pl: 4.5 }}>
                      {currencies.find(c => c.id === formData.currency_id)?.name || '-'} {currencies.find(c => c.id === formData.currency_id)?.code && `(${currencies.find(c => c.id === formData.currency_id)?.code})`}
                    </Typography>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(156, 39, 176, 0.03)',
                  border: '1px solid',
                  borderColor: 'rgba(156, 39, 176, 0.1)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      p: 0.75,
                      borderRadius: '8px',
                      bgcolor: '#9c27b0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <NoteIcon sx={{ color: 'white', fontSize: '18px' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#7b1fa2' }}>
                      Megjegyzés
                    </Typography>
                  </Box>
                  {canEdit ? (
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={3}
                      value={formData.note}
                      onChange={handleInputChange('note')}
                      placeholder="Megjegyzés hozzáadása..."
                      sx={{ 
                        '& .MuiInputBase-root': { bgcolor: 'white' },
                        pl: 4.5
                      }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', pl: 4.5 }}>
                      {formData.note || '-'}
                    </Typography>
                  )}
                </Box>
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
              orderChannels={orderChannels}
              canEdit={canEdit}
              showReceivedQuantity={true}
              poStatus={purchaseOrder.status}
            />
          </Paper>
        </Grid>

        {/* Kapcsolódó szállítmányok Card */}
        {linkedShipments && linkedShipments.length > 0 && (
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: 'white',
                border: '2px solid',
                borderColor: '#ff9800',
                borderRadius: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{
                  p: 1,
                  borderRadius: '50%',
                  bgcolor: '#ff9800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <LocalShippingIcon sx={{ color: 'white', fontSize: '24px' }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f57c00' }}>
                  Kapcsolódó szállítmányok
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Szállítmányszám</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Státusz</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {linkedShipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell>
                          <Link
                            href={`/shipments/${shipment.id}`}
                            sx={{ textDecoration: 'none', color: 'primary.main', fontWeight: 500 }}
                          >
                            {shipment.shipment_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={shipment.status === 'completed' ? 'Bevételezve' : shipment.status === 'waiting' ? 'Várakozik' : shipment.status}
                            color={shipment.status === 'completed' ? 'success' : shipment.status === 'waiting' ? 'default' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LocalShippingIcon />}
                            onClick={() => router.push(`/shipments/${shipment.id}`)}
                          >
                            Megtekintés
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onClose={() => setShowUnsavedDialog(false)}>
        <DialogTitle sx={{ bgcolor: '#f44336', color: 'white', fontWeight: 700 }}>
          Mentetlen változások
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <DialogContentText>
            Vannak elmentetlen változások. Biztosan kilépsz erről az oldalról anélkül, hogy elmentenéd őket?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowUnsavedDialog(false)} variant="outlined">
            Maradok
          </Button>
          <Button
            onClick={() => {
              if (pendingNavigation) {
                router.push(pendingNavigation)
              }
              setShowUnsavedDialog(false)
              setPendingNavigation(null)
            }}
            variant="contained"
            color="error"
          >
            Kilépés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
