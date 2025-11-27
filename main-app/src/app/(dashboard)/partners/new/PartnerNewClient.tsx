'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

interface Currency {
  id: string
  name: string
  rate: number
  created_at: string
  updated_at: string
}

interface PartnerNewClientProps {
  allVatRates: VatRate[]
  allCurrencies: Currency[]
}

interface NewPartner {
  name: string
  country: string
  postal_code: string
  city: string
  address: string
  mobile: string
  email: string
  tax_number: string
  company_registration_number: string
  bank_account: string
  notes: string
  status: string
  contact_person: string
  vat_id: string
  currency_id: string
  payment_terms: number
}

export default function PartnerNewClient({ allVatRates, allCurrencies }: PartnerNewClientProps) {
  const router = useRouter()

  const [partner, setPartner] = useState<NewPartner>({
    name: '',
    country: '',
    postal_code: '',
    city: '',
    address: '',
    mobile: '',
    email: '',
    tax_number: '',
    company_registration_number: '',
    bank_account: '',
    notes: '',
    status: 'active',
    contact_person: '',
    vat_id: '',
    currency_id: '2dc21d30-c7e8-4d3a-b57a-1e0a4870ec1b', // HUF as default
    payment_terms: 30
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/partners')
  }

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    let formatted = digits

    if (!digits.startsWith('36') && digits.length > 0) {
      formatted = '36' + digits
    }

    if (formatted.length >= 2) {
      const countryCode = formatted.substring(0, 2)
      const areaCode = formatted.substring(2, 4)
      const firstPart = formatted.substring(4, 7)
      const secondPart = formatted.substring(7, 11)

      let result = `+${countryCode}`

      if (areaCode) result += ` ${areaCode}`
      if (firstPart) result += ` ${firstPart}`
      if (secondPart) result += ` ${secondPart}`

      return result
    }

    return value
  }

  const formatTaxNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length > 8) {
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9, 11)}`
    }
    return value
  }

  const formatCompanyRegistrationNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // Format: xx-yy-zzzzzz (2 digits, 2 digits, 6 digits)
    if (digits.length <= 2) {
      return digits
    } else if (digits.length <= 4) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`
    } else if (digits.length <= 10) {
      return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4)}`
    } else {
      // Limit to 10 digits total
      return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 10)}`
    }
  }

  const handleInputChange = (field: keyof NewPartner, value: string | number) => {
    let processedValue = value

    // Format company registration number if it's the company_registration_number field
    if (field === 'company_registration_number') {
      processedValue = formatCompanyRegistrationNumber(value as string)
    }

    setPartner(prev => ({ ...prev, [field]: processedValue }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}

    // Validate required fields - only név is required
    if (!partner.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }

    // Optional email validation if provided
    if (partner.email && partner.email.trim() && !/\S+@\S+\.\S+/.test(partner.email)) {
      newErrors.email = 'Érvénytelen email formátum'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(partner),
      })

      if (response.ok) {
        const result = await response.json()

        toast.success('Új beszállító sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/partners')

        // Redirect to the new partner's edit page
        router.push(`/partners/${result.id}`)
      } else {
        // Handle empty or non-JSON response
        let errorMessage = 'Mentés sikertelen'
        try {
          const text = await response.text()
          if (text) {
            const errorData = JSON.parse(text)
            errorMessage = errorData.error || errorData.message || errorMessage
          } else {
            errorMessage = response.statusText || errorMessage
          }
        } catch (e) {
          // Response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error(`Hiba történt a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/partners"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Beszállítók
        </Link>
        <Typography color="text.primary">
          Új beszállító
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új beszállító hozzáadása
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            color="primary"
            disabled={isSaving}
          >
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Vissza
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary">
              Alapadatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Név"
              value={partner.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
              placeholder="Beszállító neve"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Kapcsolattartó neve"
              value={partner.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)}
              placeholder="Kapcsolattartó neve"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="E-mail"
              type="email"
              value={partner.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={!!errors.email}
              helperText={errors.email}
              placeholder="email@example.com"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Mobil"
              value={formatPhoneNumber(partner.mobile)}
              onChange={(e) => handleInputChange('mobile', e.target.value)}
              placeholder="+36 30 123 4567"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Státusz</InputLabel>
              <Select
                value={partner.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                label="Státusz"
              >
                <MenuItem value="active">Aktív</MenuItem>
                <MenuItem value="inactive">Inaktív</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Address Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Címadatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Ország"
              value={partner.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="Ország"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Irányítószám"
              value={partner.postal_code}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
              placeholder="Irányítószám"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Település"
              value={partner.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="Település"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utca, házszám"
              value={partner.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Utca, házszám"
            />
          </Grid>

          {/* Financial Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Pénzügyi adatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Adószám"
              value={formatTaxNumber(partner.tax_number)}
              onChange={(e) => handleInputChange('tax_number', e.target.value)}
              placeholder="12345678-1-02"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Cégjegyzékszám"
              value={partner.company_registration_number}
              onChange={(e) => handleInputChange('company_registration_number', e.target.value)}
              placeholder="01-09-123456"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Bankszámlaszám"
              value={partner.bank_account}
              onChange={(e) => handleInputChange('bank_account', e.target.value)}
              placeholder="Bankszámlaszám"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>ÁFA kulcs</InputLabel>
              <Select
                value={partner.vat_id}
                onChange={(e) => handleInputChange('vat_id', e.target.value)}
                label="ÁFA kulcs"
              >
                <MenuItem value="">
                  <em>Nincs kiválasztva</em>
                </MenuItem>
                {allVatRates.map((vatRate) => (
                  <MenuItem key={vatRate.id} value={vatRate.id}>
                    {vatRate.name} ({vatRate.kulcs}%)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Pénznem</InputLabel>
              <Select
                value={partner.currency_id}
                onChange={(e) => handleInputChange('currency_id', e.target.value)}
                label="Pénznem"
              >
                <MenuItem value="">
                  <em>Nincs kiválasztva</em>
                </MenuItem>
                {allCurrencies.map((currency) => (
                  <MenuItem key={currency.id} value={currency.id}>
                    {currency.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Fizetési határidő (nap)"
              type="number"
              value={partner.payment_terms}
              onChange={(e) => handleInputChange('payment_terms', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0 }}
              placeholder="0"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Megjegyzés"
              multiline
              rows={4}
              value={partner.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Ide írhatja a beszállítóval kapcsolatos megjegyzéseket..."
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
