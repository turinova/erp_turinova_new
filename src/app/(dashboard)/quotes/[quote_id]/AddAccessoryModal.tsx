'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  TextField,
  Autocomplete,
  Grid
} from '@mui/material'
import { toast } from 'react-toastify'

interface Accessory {
  id: string
  name: string
  sku: string
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  vat_percent: number
  vat_amount: number
  gross_price: number
  unit_name: string
  unit_shortform: string
  currency_name: string
  partner_name: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

interface Currency {
  id: string
  name: string
}

interface Unit {
  id: string
  name: string
  shortform: string
}

interface Partner {
  id: string
  name: string
}

interface AddAccessoryModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  onSuccess: () => void
  accessories: Accessory[]
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
}

export default function AddAccessoryModal({ 
  open, 
  onClose, 
  quoteId, 
  onSuccess,
  accessories,
  vatRates,
  currencies,
  units,
  partners
}: AddAccessoryModalProps) {
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null)
  const [accessoryData, setAccessoryData] = useState({
    name: '',
    sku: '',
    net_price: 0,
    vat_id: '',
    currency_id: '',
    units_id: '',
    partners_id: '',
    quantity: 1
  })
  const [loading, setLoading] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedAccessory(null)
      setAccessoryData({
        name: '',
        sku: '',
        net_price: 0,
        vat_id: '',
        currency_id: '',
        units_id: '',
        partners_id: '',
        quantity: 1
      })
    }
  }, [open])

  const handleSubmit = async () => {
    // Validation
    if (!accessoryData.name.trim()) {
      toast.error('Kérjük, adja meg a termék nevét!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    if (!accessoryData.sku.trim()) {
      toast.error('Kérjük, adja meg az SKU-t!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    if (accessoryData.net_price <= 0) {
      toast.error('A nettó ár nagyobb kell legyen nullánál!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    if (!accessoryData.vat_id || !accessoryData.currency_id || !accessoryData.units_id || !accessoryData.partners_id) {
      toast.error('Kérjük, töltse ki az összes mezőt!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    if (accessoryData.quantity < 1) {
      toast.error('A mennyiség legalább 1 kell legyen!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    setLoading(true)
    try {
      let accessoryId = selectedAccessory?.id

      // If user modified an existing accessory or creating new one
      if (selectedAccessory && hasAccessoryDataChanged()) {
        // Update the accessory in the accessories table globally
        const updateResponse = await fetch(`/api/accessories/${selectedAccessory.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: accessoryData.name,
            sku: accessoryData.sku,
            net_price: accessoryData.net_price,
            vat_id: accessoryData.vat_id,
            currency_id: accessoryData.currency_id,
            units_id: accessoryData.units_id,
            partners_id: accessoryData.partners_id
          }),
        })

        if (!updateResponse.ok) {
          throw new Error('Failed to update accessory')
        }
      } else if (!selectedAccessory) {
        // Create new accessory in accessories table
        const createResponse = await fetch('/api/accessories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: accessoryData.name,
            sku: accessoryData.sku,
            net_price: accessoryData.net_price,
            vat_id: accessoryData.vat_id,
            currency_id: accessoryData.currency_id,
            units_id: accessoryData.units_id,
            partners_id: accessoryData.partners_id
          }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          throw new Error(errorData.error || 'Failed to create accessory')
        }

        const createdAccessory = await createResponse.json()
        accessoryId = createdAccessory.id
      }

      // Add accessory to quote
      const response = await fetch(`/api/quotes/${quoteId}/accessories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessory_id: accessoryId,
          quantity: accessoryData.quantity,
        }),
      })

      if (response.ok) {
        toast.success('Termék sikeresen hozzáadva!', {
          position: "top-right",
          autoClose: 3000,
        })
        onSuccess()
        onClose()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a termék hozzáadása során!', {
          position: "top-right",
          autoClose: 3000,
        })
      }
    } catch (error) {
      console.error('Error adding accessory:', error)
      toast.error(`Hiba: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: "top-right",
        autoClose: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  const hasAccessoryDataChanged = () => {
    if (!selectedAccessory) return false
    return (
      accessoryData.name !== selectedAccessory.name ||
      accessoryData.sku !== selectedAccessory.sku ||
      accessoryData.net_price !== selectedAccessory.net_price ||
      accessoryData.vat_id !== selectedAccessory.vat_id ||
      accessoryData.currency_id !== selectedAccessory.currency_id ||
      accessoryData.units_id !== selectedAccessory.units_id ||
      accessoryData.partners_id !== selectedAccessory.partners_id
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate preview
  const selectedVat = vatRates.find(v => v.id === accessoryData.vat_id)
  const vatRate = selectedVat ? selectedVat.kulcs / 100 : 0
  const calculatedNetTotal = accessoryData.net_price * accessoryData.quantity
  const calculatedVatTotal = calculatedNetTotal * vatRate
  const calculatedGrossTotal = calculatedNetTotal + calculatedVatTotal

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Termék hozzáadása</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Accessory Name - Autocomplete with freeSolo */}
          <Grid item xs={12}>
            <Autocomplete
              fullWidth
              freeSolo
              options={accessories}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
              value={selectedAccessory}
              onChange={(event, newValue) => {
                if (typeof newValue === 'string') {
                  // User typed a new accessory name
                  setSelectedAccessory(null)
                  setAccessoryData({
                    name: newValue,
                    sku: '',
                    net_price: 0,
                    vat_id: '',
                    currency_id: '',
                    units_id: '',
                    partners_id: '',
                    quantity: 1
                  })
                } else if (newValue) {
                  // User selected an existing accessory
                  setSelectedAccessory(newValue)
                  setAccessoryData({
                    name: newValue.name,
                    sku: newValue.sku,
                    net_price: newValue.net_price,
                    vat_id: newValue.vat_id,
                    currency_id: newValue.currency_id,
                    units_id: newValue.units_id,
                    partners_id: newValue.partners_id,
                    quantity: 1
                  })
                } else {
                  // User cleared selection
                  setSelectedAccessory(null)
                  setAccessoryData({
                    name: '',
                    sku: '',
                    net_price: 0,
                    vat_id: '',
                    currency_id: '',
                    units_id: '',
                    partners_id: '',
                    quantity: 1
                  })
                }
              }}
              onInputChange={(event, newInputValue) => {
                if (event && newInputValue && !accessories.find(a => a.name === newInputValue)) {
                  // User is typing a new accessory name
                  setSelectedAccessory(null)
                  setAccessoryData(prev => ({
                    ...prev,
                    name: newInputValue
                  }))
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Termék neve (válasszon vagy írjon be új nevet) *"
                  required
                />
              )}
            />
          </Grid>

          {/* SKU */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="SKU *"
              value={accessoryData.sku}
              onChange={(e) => setAccessoryData(prev => ({ ...prev, sku: e.target.value }))}
              required
            />
          </Grid>

          {/* Quantity */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Mennyiség *"
              type="number"
              value={accessoryData.quantity}
              onChange={(e) => setAccessoryData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              inputProps={{ min: 1 }}
              required
            />
          </Grid>

          {/* Net Price */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Nettó ár *"
              type="number"
              value={accessoryData.net_price}
              onChange={(e) => setAccessoryData(prev => ({ ...prev, net_price: parseFloat(e.target.value) || 0 }))}
              inputProps={{ min: 0, step: 1 }}
              required
            />
          </Grid>

          {/* VAT */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>ÁFA *</InputLabel>
              <Select
                value={accessoryData.vat_id}
                onChange={(e) => setAccessoryData(prev => ({ ...prev, vat_id: e.target.value }))}
                label="ÁFA *"
              >
                {vatRates.map((vat) => (
                  <MenuItem key={vat.id} value={vat.id}>
                    {vat.name} ({vat.kulcs}%)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Currency */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Pénznem *</InputLabel>
              <Select
                value={accessoryData.currency_id}
                onChange={(e) => setAccessoryData(prev => ({ ...prev, currency_id: e.target.value }))}
                label="Pénznem *"
              >
                {currencies.map((currency) => (
                  <MenuItem key={currency.id} value={currency.id}>
                    {currency.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Unit */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Mértékegység *</InputLabel>
              <Select
                value={accessoryData.units_id}
                onChange={(e) => setAccessoryData(prev => ({ ...prev, units_id: e.target.value }))}
                label="Mértékegység *"
              >
                {units.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    {unit.name} ({unit.shortform})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Partner */}
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Partner *</InputLabel>
              <Select
                value={accessoryData.partners_id}
                onChange={(e) => setAccessoryData(prev => ({ ...prev, partners_id: e.target.value }))}
                label="Partner *"
              >
                {partners.map((partner) => (
                  <MenuItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Price Preview */}
          <Grid item xs={12}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: 1,
                borderColor: 'grey.300',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Ár előnézet:
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Nettó ár/egység:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(accessoryData.net_price)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Mennyiség:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {accessoryData.quantity}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
                <Typography variant="body2">Nettó összesen:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(calculatedNetTotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">ÁFA összesen ({selectedVat?.kulcs || 0}%):</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(calculatedVatTotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
                <Typography variant="body2" fontWeight="bold">
                  Bruttó összesen:
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  {formatCurrency(calculatedGrossTotal)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Mégse
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Hozzáadás...' : 'Hozzáadás'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
