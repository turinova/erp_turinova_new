'use client'

import React, { useState, useEffect } from 'react'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch, IconButton, InputAdornment } from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface PortalCustomer {
  id: string
  name: string
  email: string
  mobile: string
  billing_name: string | null
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  sms_notification: boolean
  selected_company_id: string | null
  created_at: string
  updated_at: string
}

interface Company {
  id: string
  name: string
  slug: string
  is_active: boolean
}

interface SettingsClientProps {
  initialCustomer: PortalCustomer
  companies: Company[]
}

export default function SettingsClient({ initialCustomer, companies }: SettingsClientProps) {
  const router = useRouter()
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<PortalCustomer>(initialCustomer)
  
  // Password change fields
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Update form data when initial customer data changes
  useEffect(() => {
    if (initialCustomer) {
      setFormData(initialCustomer)
    }
  }, [initialCustomer])

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
    if (!value) return true // Optional field
    const regex = /^\d{8}-\d-\d{2}$/
    return regex.test(value)
  }

  const validateCompanyRegNumber = (value: string) => {
    if (!value) return true // Optional field
    const regex = /^\d{2}-\d{2}-\d{6}$/
    return regex.test(value)
  }

  const handleInputChange = (field: keyof PortalCustomer, value: string | boolean) => {
    if (formData) {
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
      
      // Update the form data
      setFormData(prev => ({ ...prev, [field]: processedValue }))
      
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }))
      }
    }
  }

  const handleSave = async () => {
    if (!formData) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!formData.name.trim()) {
      newErrors.name = 'A név kötelező'
    }
    
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'A telefonszám kötelező'
    }
    
    // Validate tax number format if provided
    if (formData.billing_tax_number && formData.billing_tax_number.trim() && !validateTaxNumber(formData.billing_tax_number)) {
      newErrors.billing_tax_number = 'Az adószám formátuma helytelen (pl. 12345678-1-02)'
    }
    
    // Validate company registration number format if provided
    if (formData.billing_company_reg_number && formData.billing_company_reg_number.trim() && !validateCompanyRegNumber(formData.billing_company_reg_number)) {
      newErrors.billing_company_reg_number = 'A cégjegyzékszám formátuma helytelen (pl. 01-09-123456)'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/customer-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Beállítások sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Update local state with saved data
        setFormData(result.customer)
      } else {
        const errorData = await response.json()
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

  const handlePasswordChange = async () => {
    const passwordErrors: { [key: string]: string } = {}
    
    if (!currentPassword) {
      passwordErrors.currentPassword = 'A jelenlegi jelszó kötelező'
    }
    
    if (!newPassword) {
      passwordErrors.newPassword = 'Az új jelszó kötelező'
    } else if (newPassword.length < 6) {
      passwordErrors.newPassword = 'Az új jelszónak legalább 6 karakter hosszúnak kell lennie'
    }
    
    if (newPassword !== confirmPassword) {
      passwordErrors.confirmPassword = 'A jelszavak nem egyeznek'
    }
    
    if (Object.keys(passwordErrors).length > 0) {
      Object.values(passwordErrors).forEach(error => toast.error(error))
      return
    }
    
    setIsChangingPassword(true)
    
    try {
      const response = await fetch('/api/customer-settings/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
      })
      
      if (response.ok) {
        toast.success('Jelszó sikeresen megváltoztatva!', {
          position: "top-right",
          autoClose: 3000,
        })
        
        // Clear password fields
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Jelszó változtatás sikertelen')
      }
    } catch (error) {
      console.error('Password change error:', error)
      toast.error(`Hiba történt a jelszó változtatása során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">
          Beállítások
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Beállítások szerkesztése
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          color="primary"
          disabled={isSaving}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
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
              value={formData.name}
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
              value={formData.email}
              InputProps={{ readOnly: true }}
              variant="filled"
              helperText="Az e-mail cím nem módosítható"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Telefonszám"
              placeholder="+36 30 999 2800"
              value={formData.mobile}
              onChange={(e) => handleInputChange('mobile', e.target.value)}
              required
              error={!!errors.mobile}
              helperText={errors.mobile}
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
              value={formData.billing_name || ''}
              onChange={(e) => handleInputChange('billing_name', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Ország"
              value={formData.billing_country}
              onChange={(e) => handleInputChange('billing_country', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Város"
              value={formData.billing_city || ''}
              onChange={(e) => handleInputChange('billing_city', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Irányítószám"
              value={formData.billing_postal_code || ''}
              onChange={(e) => handleInputChange('billing_postal_code', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utca"
              value={formData.billing_street || ''}
              onChange={(e) => handleInputChange('billing_street', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Házszám"
              value={formData.billing_house_number || ''}
              onChange={(e) => handleInputChange('billing_house_number', e.target.value)}
            />
          </Grid>

          {/* Tax and Registration Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Adó- és nyilvántartási adatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Adószám"
              placeholder="12345678-1-02"
              value={formData.billing_tax_number || ''}
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
              value={formData.billing_company_reg_number || ''}
              onChange={(e) => handleInputChange('billing_company_reg_number', e.target.value)}
              error={!!errors.billing_company_reg_number}
              helperText={errors.billing_company_reg_number}
            />
          </Grid>

          {/* Company and Preferences */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Vállalat és beállítások
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Kiválasztott vállalat</InputLabel>
              <Select
                value={formData.selected_company_id || ''}
                label="Kiválasztott vállalat"
                onChange={(e) => handleInputChange('selected_company_id', e.target.value)}
              >
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.sms_notification}
                  onChange={(e) => handleInputChange('sms_notification', e.target.checked)}
                  color="primary"
                />
              }
              label="SMS értesítések küldése"
            />
          </Grid>

          {/* Metadata */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Metaadatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Létrehozva"
              value={new Date(formData.created_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utolsó módosítás"
              value={new Date(formData.updated_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Password Change Section */}
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary">
              Jelszó megváltoztatása
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Jelenlegi jelszó"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <i className={showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Új jelszó"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <i className={showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Jelszó megerősítése"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <i className={showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="warning"
              onClick={handlePasswordChange}
              disabled={isChangingPassword}
              startIcon={<i className='ri-lock-password-line' />}
            >
              {isChangingPassword ? 'Jelszó változtatása...' : 'Jelszó megváltoztatása'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

