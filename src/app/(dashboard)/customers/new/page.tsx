'use client'

import React, { useState } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  discount_percent: number
  created_at: string
}

export default function NewCustomerPage() {
  const router = useRouter()
  
  // Initialize with empty customer data
  const [customer, setCustomer] = useState<Customer>({
    id: '',
    name: '',
    email: '',
    mobile: '',
    billing_name: '',
    billing_country: 'Magyarország',
    billing_city: '',
    billing_postal_code: '',
    billing_street: '',
    billing_house_number: '',
    billing_tax_number: '',
    billing_company_reg_number: '',
    discount_percent: 0,
    created_at: new Date().toISOString()
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/customers')
  }

  // Phone number formatting helper
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // If it starts with 36, keep it as is, otherwise add 36
    let formatted = digits

    if (!digits.startsWith('36') && digits.length > 0) {
      formatted = '36' + digits
    }
    
    // Format: +36 30 999 2800
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

  // Hungarian tax number (adószám) formatting helper
  const formatTaxNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // Format: xxxxxxxx-y-zz (8 digits, 1 digit, 2 digits)
    if (digits.length <= 8) {
      return digits
    } else if (digits.length <= 9) {
      return `${digits.substring(0, 8)}-${digits.substring(8)}`
    } else if (digits.length <= 11) {
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9)}`
    } else {
      // Limit to 11 digits total
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9, 11)}`
    }
  }

  // Hungarian company registration number (cégjegyzékszám) formatting helper
  const formatCompanyRegNumber = (value: string) => {
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

  // Validation helpers
  const validateTaxNumber = (value: string) => {
    const regex = /^\d{8}-\d-\d{2}$/

    
return regex.test(value)
  }

  const validateCompanyRegNumber = (value: string) => {
    const regex = /^\d{2}-\d{2}-\d{6}$/

    
return regex.test(value)
  }

  const handleInputChange = (field: keyof Customer, value: string | number) => {
    let processedValue = value
    
    // Format phone number if it's the mobile field
    if (field === 'mobile' && typeof value === 'string') {
      processedValue = formatPhoneNumber(value)
    }
    
    // Format tax number if it's the billing_tax_number field
    if (field === 'billing_tax_number' && typeof value === 'string') {
      processedValue = formatTaxNumber(value)
    }
    
    // Format company registration number if it's the billing_company_reg_number field
    if (field === 'billing_company_reg_number' && typeof value === 'string') {
      processedValue = formatCompanyRegNumber(value)
    }
    
    setCustomer(prev => ({ ...prev, [field]: processedValue }))


    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!customer.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    // Validate tax number format if provided
    if (customer.billing_tax_number && customer.billing_tax_number.trim() && !validateTaxNumber(customer.billing_tax_number)) {
      newErrors.billing_tax_number = 'Az adószám formátuma helytelen (pl. 12345678-1-02)'
    }
    
    // Validate company registration number format if provided
    if (customer.billing_company_reg_number && customer.billing_company_reg_number.trim() && !validateCompanyRegNumber(customer.billing_company_reg_number)) {
      newErrors.billing_company_reg_number = 'A cégjegyzékszám formátuma helytelen (pl. 01-09-123456)'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      
return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customer),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új ügyfél sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache and navigate to the new customer's detail page
        invalidateApiCache('/api/customers')
        router.push(`/customers/${result.data.id}`)
      } else {
        const errorData = await response.json()
        
        // Handle duplicate email error specifically
        if (response.status === 409 && errorData.message.includes('e-mail')) {
          setErrors({ email: 'Egy ügyfél már létezik ezzel az e-mail címmel' })
          
return
        }
        
        throw new Error(errorData.message || 'Mentés sikertelen')
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
          href="/customers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/customers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Ügyfelek
        </Link>
        <Typography color="text.primary">
          Új ügyfél
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új ügyfél hozzáadása
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
              value={customer.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="E-mail"
              type="email"
              value={customer.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={!!errors.email}
              helperText={errors.email}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Telefonszám"
              placeholder="+36 30 999 2800"
              value={customer.mobile || ''}
              onChange={(e) => handleInputChange('mobile', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Kedvezmény (%)"
              type="number"
              value={customer.discount_percent}
              onChange={(e) => handleInputChange('discount_percent', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
            />
          </Grid>

          {/* Billing Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Számlázási adatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Számlázási név"
              value={customer.billing_name || ''}
              onChange={(e) => handleInputChange('billing_name', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Ország"
              value={customer.billing_country || ''}
              onChange={(e) => handleInputChange('billing_country', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Város"
              value={customer.billing_city || ''}
              onChange={(e) => handleInputChange('billing_city', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Irányítószám"
              value={customer.billing_postal_code || ''}
              onChange={(e) => handleInputChange('billing_postal_code', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utca"
              value={customer.billing_street || ''}
              onChange={(e) => handleInputChange('billing_street', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Házszám"
              value={customer.billing_house_number || ''}
              onChange={(e) => handleInputChange('billing_house_number', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Adószám"
              placeholder="12345678-1-02"
              value={customer.billing_tax_number || ''}
              onChange={(e) => handleInputChange('billing_tax_number', e.target.value)}
              error={!!errors.billing_tax_number}
              helperText={errors.billing_tax_number}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Cégjegyzékszám"
              placeholder="01-09-123456"
              value={customer.billing_company_reg_number || ''}
              onChange={(e) => handleInputChange('billing_company_reg_number', e.target.value)}
              error={!!errors.billing_company_reg_number}
              helperText={errors.billing_company_reg_number}
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
