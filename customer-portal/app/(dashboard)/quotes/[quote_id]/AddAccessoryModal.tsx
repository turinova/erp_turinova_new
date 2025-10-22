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
  base_price: number
  multiplier: number
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
    base_price: '',
    multiplier: 1.38,
    net_price: 0,
    gross_price: 0,
    vat_id: '',
    currency_id: '',
    units_id: '',
    partners_id: '',
    quantity: 1 as number | ''
  })
  const [loading, setLoading] = useState(false)

  // Calculate basePrice for display and validation
  const basePrice = parseFloat(String(accessoryData.base_price)) || 0

  // Helper function to get default values
  const getDefaultValues = () => {
    const defaultVat = vatRates.find(vat => vat.kulcs === 27) // 27% VAT
    const defaultCurrency = currencies.find(currency => currency.name === 'HUF') // HUF currency
    const defaultUnit = units.find(unit => unit.shortform === 'db') // db unit
    
    return {
      vat_id: defaultVat?.id || '',
      currency_id: defaultCurrency?.id || '',
      units_id: defaultUnit?.id || ''
    }
  }

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedAccessory(null)
      const defaults = getDefaultValues()
      
      setAccessoryData({
        name: '',
        sku: '',
        base_price: '',
        multiplier: 1.38,
        net_price: 0,
        gross_price: 0,
        vat_id: defaults.vat_id,
        currency_id: defaults.currency_id,
        units_id: defaults.units_id,
        partners_id: '',
        quantity: 1
      })
    }
  }, [open, vatRates, currencies, units])

  // Auto-calculate net_price when base_price or multiplier changes
  useEffect(() => {
    const basePrice = parseFloat(String(accessoryData.base_price)) || 0
    const netPrice = Math.round(basePrice * accessoryData.multiplier)
    setAccessoryData(prev => ({ ...prev, net_price: netPrice }))
  }, [accessoryData.base_price, accessoryData.multiplier])

  // Auto-calculate gross_price when net_price or VAT changes
  useEffect(() => {
    const selectedVat = vatRates.find(v => v.id === accessoryData.vat_id)
    const vatRate = selectedVat ? selectedVat.kulcs / 100 : 0
    const grossPrice = Math.round(accessoryData.net_price * (1 + vatRate))
    setAccessoryData(prev => ({ ...prev, gross_price: grossPrice }))
  }, [accessoryData.net_price, accessoryData.vat_id, vatRates])

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

    if (basePrice <= 0) {
      toast.error('A beszerzési ár nagyobb kell legyen nullánál!', {
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

    const finalQuantity = typeof accessoryData.quantity === 'number' ? accessoryData.quantity : parseInt(String(accessoryData.quantity)) || 1
    
    if (finalQuantity < 1) {
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
        // Convert gross price to net price for API
        const selectedVat = vatRates.find(v => v.id === accessoryData.vat_id)
        const vatRate = selectedVat ? selectedVat.kulcs / 100 : 0
        const netPrice = accessoryData.gross_price / (1 + vatRate)

        // Update the accessory in the accessories table globally
        const updateResponse = await fetch(`/api/accessories/${selectedAccessory.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: accessoryData.name,
            sku: accessoryData.sku,
            base_price: basePrice,
            multiplier: accessoryData.multiplier,
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
        // Convert gross price to net price for API
        const selectedVat = vatRates.find(v => v.id === accessoryData.vat_id)
        const vatRate = selectedVat ? selectedVat.kulcs / 100 : 0
        const netPrice = accessoryData.gross_price / (1 + vatRate)

        // Create new accessory in accessories table
        const createResponse = await fetch('/api/accessories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: accessoryData.name,
            sku: accessoryData.sku,
            base_price: basePrice,
            multiplier: accessoryData.multiplier,
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
          quantity: finalQuantity,
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
      accessoryData.base_price !== selectedAccessory.base_price ||
      accessoryData.multiplier !== selectedAccessory.multiplier ||
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
  const previewQuantity = typeof accessoryData.quantity === 'number' ? accessoryData.quantity : (accessoryData.quantity === '' ? 0 : parseInt(String(accessoryData.quantity)) || 0)
  const calculatedGrossTotal = accessoryData.gross_price * previewQuantity
  const calculatedNetTotal = calculatedGrossTotal / (1 + vatRate)
  const calculatedVatTotal = calculatedGrossTotal - calculatedNetTotal

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Termék hozzáadása</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Row 1: Termék neve, SKU */}
          <Grid item xs={12} sm={6}>
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
                  const defaults = getDefaultValues()
                  setAccessoryData({
                    name: newValue,
                    sku: '',
                    base_price: 0,
                    multiplier: 1.38,
                    net_price: 0,
                    gross_price: 0,
                    vat_id: defaults.vat_id,
                    currency_id: defaults.currency_id,
                    units_id: defaults.units_id,
                    partners_id: '',
                    quantity: 1
                  })
                } else if (newValue) {
                  // User selected an existing accessory
                  setSelectedAccessory(newValue)
                  setAccessoryData({
                    name: newValue.name,
                    sku: newValue.sku,
                    base_price: newValue.base_price,
                    multiplier: newValue.multiplier,
                    net_price: newValue.net_price,
                    gross_price: newValue.gross_price, // API returns gross_price in transformed data
                    vat_id: newValue.vat_id,
                    currency_id: newValue.currency_id,
                    units_id: newValue.units_id,
                    partners_id: newValue.partners_id,
                    quantity: 1
                  })
                } else {
                  // User cleared selection
                  setSelectedAccessory(null)
                  const defaults = getDefaultValues()
                  setAccessoryData({
                    name: '',
                    sku: '',
                    base_price: 0,
                    multiplier: 1.38,
                    net_price: 0,
                    gross_price: 0,
                    vat_id: defaults.vat_id,
                    currency_id: defaults.currency_id,
                    units_id: defaults.units_id,
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

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="SKU *"
              value={accessoryData.sku}
              onChange={(e) => setAccessoryData(prev => ({ ...prev, sku: e.target.value }))}
              required
            />
          </Grid>

          {/* Row 2: Mennyiség, Alapár, Szorzó */}
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Mennyiség *"
              type="number"
              value={accessoryData.quantity}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || val === '0') {
                  setAccessoryData(prev => ({ ...prev, quantity: '' as any }))
                } else {
                  setAccessoryData(prev => ({ ...prev, quantity: parseInt(val) || 1 }))
                }
              }}
              onBlur={(e) => {
                // Set to 1 if empty on blur
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  setAccessoryData(prev => ({ ...prev, quantity: 1 }))
                }
              }}
              inputProps={{ min: 1 }}
              required
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Beszerzési ár (Ft) *"
              type="number"
              value={accessoryData.base_price}
              onChange={(e) => setAccessoryData(prev => ({ ...prev, base_price: e.target.value }))}
              inputProps={{ min: 0, step: 1 }}
              required
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Árrés szorzó *"
              type="number"
              value={accessoryData.multiplier}
              onChange={(e) => setAccessoryData(prev => ({ ...prev, multiplier: parseFloat(e.target.value) || 1.38 }))}
              inputProps={{ min: 1.0, max: 5.0, step: 0.01 }}
              required
            />
          </Grid>

          {/* Row 3: ÁFA, Pénznem, Mértékegység */}
          <Grid item xs={12} sm={4}>
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

          <Grid item xs={12} sm={4}>
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

          <Grid item xs={12} sm={4}>
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

          {/* Row 4: Partner */}
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
                <Typography variant="body2">Beszerzési ár:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(basePrice)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Árrés szorzó:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {accessoryData.multiplier}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Nettó ár/egység:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(accessoryData.net_price)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Bruttó ár/egység:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(accessoryData.gross_price)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Mennyiség:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {previewQuantity}
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
