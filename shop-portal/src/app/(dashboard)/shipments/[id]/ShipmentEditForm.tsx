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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Autocomplete
} from '@mui/material'
import {
  Save as SaveIcon,
  Info as InfoIcon,
  ShoppingCart as ShoppingCartIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  LocalShipping as LocalShippingIcon,
  Business as BusinessIcon,
  Warehouse as WarehouseIcon,
  CalendarToday as CalendarTodayIcon,
  Event as EventIcon,
  AttachMoney as AttachMoneyIcon,
  Note as NoteIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import Link from '@mui/material/Link'
import ShipmentItemsTable from '@/components/purchasing/ShipmentItemsTable'

interface ShipmentItem {
  id: string
  shipment_id: string
  purchase_order_item_id: string | null
  product_id: string
  products: { id: string; name: string; sku: string; model_number: string | null } | null
  product_suppliers: { id: string; supplier_sku: string | null } | null
  expected_quantity: number
  received_quantity: number
  unit_cost: number | null
  vat_id: string | null
  vat: { id: string; name: string; kulcs: number } | null
  currency_id: string | null
  is_unexpected: boolean
  purchase_order_items: { id: string; quantity: number } | null
}

interface Shipment {
  id: string
  shipment_number: string
  status: string
  supplier_id: string
  suppliers: { id: string; name: string } | null
  warehouse_id: string
  warehouses: { id: string; name: string; code: string } | null
  expected_arrival_date: string | null
  actual_arrival_date: string | null
  purchased_date: string | null
  currency_id: string | null
  currencies: { id: string; name: string; code: string } | null
  note: string | null
  created_at: string
  shipment_purchase_orders: Array<{
    purchase_orders: { id: string; po_number: string; status: string; order_date: string; expected_delivery_date: string | null } | null
  }>
  warehouse_operations?: Array<{
    id: string
    operation_number: string
    status: string
    operation_type: string
    completed_at: string | null
  }>
}

interface ShipmentEditFormProps {
  initialShipment: Shipment
  initialItems: ShipmentItem[]
  vatRates: Array<{ id: string; name: string; rate: number }>
  units: Array<{ id: string; name: string; shortform: string }>
}

export default function ShipmentEditForm({
  initialShipment,
  initialItems,
  vatRates,
  units
}: ShipmentEditFormProps) {
  const router = useRouter()
  const [shipment, setShipment] = useState(initialShipment)
  const [items, setItems] = useState(initialItems)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)

  const canEdit = shipment.status === 'waiting'
  const canComplete = shipment.status === 'waiting'

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save shipment header changes
      const response = await fetch(`/api/shipments/${shipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_arrival_date: shipment.expected_arrival_date,
          actual_arrival_date: shipment.actual_arrival_date,
          purchased_date: shipment.purchased_date,
          note: shipment.note
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      // Separate new items (temp IDs) from existing items (real UUIDs)
      const newItems = items.filter(item => item.id && item.id.startsWith('temp-'))
      const existingItems = items.filter(item => item.id && !item.id.startsWith('temp-'))

      // Create new items
      for (const item of newItems) {
        const createResponse = await fetch(`/api/shipments/${shipment.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: item.product_id,
            received_quantity: item.received_quantity,
            unit_cost: item.unit_cost,
            vat_id: item.vat_id,
            currency_id: item.currency_id
          })
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          throw new Error(errorData.error || 'Hiba az új tétel létrehozásakor')
        }

        const createdData = await createResponse.json()
        // Update the item ID in local state
        const itemIndex = items.findIndex(i => i.id === item.id)
        if (itemIndex !== -1) {
          const updatedItems = [...items]
          updatedItems[itemIndex] = { ...updatedItems[itemIndex], id: createdData.item.id }
          setItems(updatedItems)
        }
      }

      // Update existing items
      if (existingItems.length > 0) {
        const itemsResponse = await fetch(`/api/shipments/${shipment.id}/items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: existingItems.map(item => ({
              id: item.id,
              received_quantity: item.received_quantity,
              unit_cost: item.unit_cost,
              vat_id: item.vat_id
            }))
          })
        })

        if (!itemsResponse.ok) {
          const errorData = await itemsResponse.json()
          throw new Error(errorData.error || 'Hiba a tételek frissítésekor')
        }
      }

      toast.success('Szállítmány sikeresen mentve')
      setHasUnsavedChanges(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving shipment:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setCompleteConfirmOpen(false)
    setCompleting(true)
    try {
      const response = await fetch(`/api/shipments/${shipment.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a bevételezés során')
      }

      const data = await response.json()
      toast.success('Szállítmány sikeresen bevételezve')
      // Force full page reload to show updated status
      window.location.reload()
    } catch (error) {
      console.error('Error completing shipment:', error)
      toast.error(
        `Hiba a bevételezés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setCompleting(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {shipment.shipment_number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Beszállító: {shipment.suppliers?.name || '-'} | Raktár: {shipment.warehouses?.name || '-'}
            </Typography>
          </Box>
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            {canEdit && (
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
              >
                {saving ? 'Mentés...' : 'Mentés'}
              </Button>
            )}
            {canComplete && (
              <Button
                variant="contained"
                color="success"
                startIcon={completing ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                onClick={() => setCompleteConfirmOpen(true)}
                disabled={completing}
              >
                {completing ? 'Bevételezés...' : 'Szállítmány bevételezése'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Form */}
      <Grid container spacing={3}>
        {/* Alapadatok Card */}
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
                Alapadatok
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <Chip
                  label={shipment.status === 'waiting' ? 'Várakozik' : shipment.status === 'completed' ? 'Bevételezve' : shipment.status}
                  color={shipment.status === 'completed' ? 'success' : shipment.status === 'waiting' ? 'warning' : 'default'}
                  sx={{ fontWeight: 600 }}
                />
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
                  <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, pl: 4.5 }}>
                    {shipment.suppliers?.name || '-'}
                  </Typography>
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
                  <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, pl: 4.5 }}>
                    {shipment.warehouses?.name || '-'} {shipment.warehouses?.code && `(${shipment.warehouses.code})`}
                  </Typography>
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
                          PO létrehozva
                        </Typography>
                        {canEdit ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={shipment.shipment_purchase_orders?.[0]?.purchase_orders?.order_date || ''}
                            onChange={(e) => {
                              // This is read-only, but keeping for consistency
                            }}
                            InputLabelProps={{ shrink: true }}
                            disabled
                            sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {shipment.shipment_purchase_orders?.[0]?.purchase_orders?.order_date 
                              ? formatDate(shipment.shipment_purchase_orders[0].purchase_orders.order_date)
                              : '-'}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                          Szállítmány létrehozva
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                          {formatDate(shipment.created_at)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                          Várható érkezés
                        </Typography>
                        {canEdit ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={shipment.expected_arrival_date || ''}
                            onChange={(e) => setShipment(prev => ({ ...prev, expected_arrival_date: e.target.value || null }))}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {formatDate(shipment.expected_arrival_date)}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                          Tényleges érkezés
                        </Typography>
                        {canEdit ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={shipment.actual_arrival_date || ''}
                            onChange={(e) => setShipment(prev => ({ ...prev, actual_arrival_date: e.target.value || null }))}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {formatDate(shipment.actual_arrival_date)}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                          Vásárolva
                        </Typography>
                        {canEdit ? (
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={shipment.purchased_date || ''}
                            onChange={(e) => setShipment(prev => ({ ...prev, purchased_date: e.target.value || null }))}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {formatDate(shipment.purchased_date)}
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
                  <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, pl: 4.5 }}>
                    {shipment.currencies?.name || '-'} {shipment.currencies?.code && `(${shipment.currencies.code})`}
                  </Typography>
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
                      value={shipment.note || ''}
                      onChange={(e) => setShipment(prev => ({ ...prev, note: e.target.value }))}
                      placeholder="Megjegyzés hozzáadása..."
                      sx={{ 
                        '& .MuiInputBase-root': { bgcolor: 'white' },
                        pl: 4.5
                      }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', pl: 4.5 }}>
                      {shipment.note || '-'}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Raktári művelet Card */}
        {shipment.warehouse_operations && shipment.warehouse_operations.length > 0 && (
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
                  Raktári művelet
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {shipment.warehouse_operations.map((op) => (
                  <Grid item xs={12} key={op.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {op.operation_number}
                      </Typography>
                      <Chip
                        label={op.status === 'completed' ? 'Befejezve' : op.status === 'waiting' ? 'Várakozik' : 'Folyamatban'}
                        color={op.status === 'completed' ? 'success' : op.status === 'waiting' ? 'default' : 'warning'}
                        size="small"
                      />
                      {op.completed_at && (
                        <Typography variant="body2" color="text.secondary">
                          Befejezve: {new Date(op.completed_at).toLocaleDateString('hu-HU')}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Kapcsolódó beszerzési rendelések Card */}
        {shipment.shipment_purchase_orders && shipment.shipment_purchase_orders.length > 0 && (
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
                  Kapcsolódó beszerzési rendelések
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Rendelésszám</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Státusz</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Rendelés dátuma</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Várható szállítás</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shipment.shipment_purchase_orders.map((link, idx) => {
                      const po = link.purchase_orders
                      if (!po) return null
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Link
                              component={NextLink}
                              href={`/purchase-orders/${po.id}`}
                              sx={{ fontWeight: 500 }}
                            >
                              {po.po_number}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={po.status === 'approved' ? 'Jóváhagyva' : po.status === 'partially_received' ? 'Részben bevételezve' : po.status === 'received' ? 'Bevételezve' : po.status}
                              size="small"
                              color={
                                po.status === 'received' ? 'success' :
                                po.status === 'partially_received' ? 'warning' :
                                po.status === 'approved' ? 'info' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{formatDate(po.order_date)}</TableCell>
                          <TableCell>{formatDate(po.expected_delivery_date)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Tételek Card */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#4caf50',
              borderRadius: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                p: 1,
                borderRadius: '50%',
                bgcolor: '#4caf50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
              }}>
                <ShoppingCartIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#388e3c' }}>
                Tételek
              </Typography>
            </Box>

            <ShipmentItemsTable
              items={items}
              onItemsChange={(newItems) => {
                setItems(newItems)
                setHasUnsavedChanges(true)
              }}
              vatRates={vatRates}
              units={units}
              canEdit={canEdit}
              onProductSearch={async (searchTerm: string) => {
                const response = await fetch(`/api/products/search-for-po?q=${encodeURIComponent(searchTerm)}&limit=20`)
                if (!response.ok) {
                  console.error('Error searching products:', response.statusText)
                  return []
                }
                const data = await response.json()
                return data.products || []
              }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Complete Confirmation Dialog */}
      <Dialog open={completeConfirmOpen} onClose={() => setCompleteConfirmOpen(false)}>
        <DialogTitle>Szállítmány bevételezése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan be szeretnéd vételezni ezt a szállítmányt? Ez létrehozza a készletmozgásokat és frissíti a beszerzési rendelések státuszát.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteConfirmOpen(false)} disabled={completing}>
            Mégse
          </Button>
          <Button
            onClick={handleComplete}
            variant="contained"
            color="success"
            disabled={completing}
            startIcon={completing ? <CircularProgress size={18} /> : <CheckCircleIcon />}
          >
            {completing ? 'Bevételezés...' : 'Bevételezés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
