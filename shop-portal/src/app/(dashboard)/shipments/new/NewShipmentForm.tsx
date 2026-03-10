'use client'

import React, { useState } from 'react'
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
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import {
  Save as SaveIcon,
  Info as InfoIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import Link from '@mui/material/Link'

interface PurchaseOrder {
  id: string
  po_number: string
  status: string
  supplier_id: string
  suppliers: { id: string; name: string } | null
  warehouse_id: string
  warehouses: { id: string; name: string; code: string } | null
  order_date: string
  expected_delivery_date: string | null
  currency_id: string | null
  currencies: { id: string; name: string; code: string } | null
}

interface NewShipmentFormProps {
  purchaseOrders: PurchaseOrder[]
  warehouses: Array<{ id: string; name: string; code: string }>
  currencies: Array<{ id: string; name: string; code: string; symbol: string }>
}

export default function NewShipmentForm({
  purchaseOrders,
  warehouses,
  currencies
}: NewShipmentFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Get default values from purchase orders
  const firstPO = purchaseOrders[0]
  
  // Get earliest order_date for purchased_date
  const earliestOrderDate = purchaseOrders
    .map(po => po.order_date)
    .sort()[0]
  
  // Get latest expected_delivery_date for expected_arrival_date
  const latestExpectedDate = purchaseOrders
    .map(po => po.expected_delivery_date)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null
  
  // Format dates for input fields (YYYY-MM-DD)
  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }
  
  const [formData, setFormData] = useState({
    supplier_id: firstPO.supplier_id,
    warehouse_id: firstPO.warehouse_id,
    expected_arrival_date: formatDateForInput(latestExpectedDate),
    purchased_date: formatDateForInput(earliestOrderDate),
    currency_id: firstPO.currency_id || '',
    note: ''
  })

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  const handleSave = async () => {
    // Validation
    if (!formData.supplier_id || !formData.warehouse_id) {
      toast.error('Beszállító és raktár kötelező')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: formData.supplier_id,
          warehouse_id: formData.warehouse_id,
          purchase_order_ids: purchaseOrders.map(po => po.id),
          expected_arrival_date: formData.expected_arrival_date || null,
          purchased_date: formData.purchased_date || null,
          currency_id: formData.currency_id || null,
          note: formData.note?.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a szállítmány létrehozásakor')
      }

      const data = await response.json()
      toast.success('Szállítmány sikeresen létrehozva')
      router.push(`/shipments/${data.shipment.id}`)
    } catch (error) {
      console.error('Error creating shipment:', error)
      toast.error(
        `Hiba a szállítmány létrehozásakor: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Új szállítmány létrehozása
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {purchaseOrders.length} beszerzési rendelés kiválasztva
        </Typography>
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
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Beszállító *
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    {firstPO.suppliers?.name || '-'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Raktár *</InputLabel>
                  <Select
                    value={formData.warehouse_id}
                    label="Raktár *"
                    onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value }))}
                  >
                    {warehouses.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    PO létrehozva
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
                    {formatDate(firstPO.order_date)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Várható érkezési dátum"
                  type="date"
                  value={formData.expected_arrival_date}
                  onChange={handleInputChange('expected_arrival_date')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Vásárolva dátum"
                  type="date"
                  value={formData.purchased_date}
                  onChange={handleInputChange('purchased_date')}
                  InputLabelProps={{ shrink: true }}
                />
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

        {/* Kapcsolódó beszerzési rendelések Card */}
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
                    <TableCell sx={{ fontWeight: 700 }}>Raktár</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
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
                          label={po.status === 'approved' ? 'Jóváhagyva' : po.status}
                          size="small"
                          color="success"
                        />
                      </TableCell>
                      <TableCell>{formatDate(po.order_date)}</TableCell>
                      <TableCell>{po.warehouses?.name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => router.back()}
              disabled={saving}
            >
              Mégse
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Létrehozás...' : 'Létrehozás'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
