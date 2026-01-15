'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Breadcrumbs, 
  Link, 
  Grid, 
  Button, 
  TextField, 
  Card, 
  CardHeader, 
  CardContent, 
  Switch, 
  FormControlLabel
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Employee {
  id: string
  name: string
  employee_code: string
  rfid_card_id: string | null
  pin_code: string | null
  active: boolean
  lunch_break_start: string | null
  lunch_break_end: string | null
  works_on_saturday: boolean
  created_at: string
  updated_at: string
}

export default function NewEmployeePage() {
  const router = useRouter()
  
  // Initialize with empty employee data
  const [employee, setEmployee] = useState<Partial<Employee>>({
    name: '',
    employee_code: '',
    rfid_card_id: null,
    pin_code: null,
    active: true,
    lunch_break_start: null,
    lunch_break_end: null,
    works_on_saturday: false,
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/employees')
  }

  const handleInputChange = (field: keyof Employee, value: string | boolean | null) => {
    setEmployee(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!employee.name || !employee.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }

    if (!employee.employee_code || !employee.employee_code.trim()) {
      newErrors.employee_code = 'A dolgozói kód mező kötelező'
    }
    
    // Validate PIN code format if provided
    if (employee.pin_code && employee.pin_code.trim() !== '') {
      const pinRegex = /^[0-9]{4}$/
      if (!pinRegex.test(employee.pin_code.trim())) {
        newErrors.pin_code = 'A PIN kód pontosan 4 számjegyből kell álljon'
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: employee.name?.trim(),
          employee_code: employee.employee_code?.trim(),
          rfid_card_id: employee.rfid_card_id?.trim() || null,
          pin_code: employee.pin_code?.trim() || null,
          active: employee.active !== undefined ? employee.active : true,
          lunch_break_start: employee.lunch_break_start || null,
          lunch_break_end: employee.lunch_break_end || null,
          works_on_saturday: employee.works_on_saturday !== undefined ? employee.works_on_saturday : false,
        }),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új kolléga sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/employees')
        
        // Navigate to the new employee's detail page
        router.push(`/employees/${result.id}`)
      } else {
        const errorData = await response.json()
        
        // Handle duplicate employee_code error specifically
        if (response.status === 409 && errorData.error.includes('dolgozói kód')) {
          setErrors({ employee_code: 'Ez a dolgozói kód már létezik' })
          return
        }

        // Handle duplicate rfid_card_id error
        if (response.status === 409 && errorData.error.includes('RFID')) {
          setErrors({ rfid_card_id: 'Ez az RFID kártya ID már használatban van' })
          return
        }
        
        throw new Error(errorData.error || 'Mentés sikertelen')
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
          href="/employees"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Kollégák
        </Link>
        <Typography color="text.primary">
          Új kolléga
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új kolléga hozzáadása
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

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Alap adatok" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Név"
                    value={employee.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Dolgozói kód"
                    value={employee.employee_code || ''}
                    onChange={(e) => handleInputChange('employee_code', e.target.value)}
                    error={!!errors.employee_code}
                    helperText={errors.employee_code}
                    required
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="RFID kártya ID"
                    value={employee.rfid_card_id || ''}
                    onChange={(e) => handleInputChange('rfid_card_id', e.target.value || null)}
                    error={!!errors.rfid_card_id}
                    helperText={errors.rfid_card_id || 'RFID kártya egyedi azonosítója'}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="PIN kód"
                    value={employee.pin_code || ''}
                    onChange={(e) => handleInputChange('pin_code', e.target.value || null)}
                    error={!!errors.pin_code}
                    helperText={errors.pin_code || '4 számjegyű PIN kód'}
                    inputProps={{ maxLength: 4, pattern: '[0-9]*' }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Ebéd kezdete"
                    type="time"
                    value={employee.lunch_break_start || ''}
                    onChange={(e) => handleInputChange('lunch_break_start', e.target.value || null)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 300 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Ebéd vége"
                    type="time"
                    value={employee.lunch_break_end || ''}
                    onChange={(e) => handleInputChange('lunch_break_end', e.target.value || null)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 300 }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={employee.active !== undefined ? employee.active : true}
                        onChange={(e) => handleInputChange('active', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktív"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
