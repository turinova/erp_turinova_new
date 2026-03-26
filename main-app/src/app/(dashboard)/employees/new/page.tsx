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
  Switch,
  FormControlLabel,
  Paper,
  Stack,
  MenuItem,
  Select,
  InputLabel,
  FormControl
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'

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
  shift_start_time: string | null
  shift_end_time: string | null
  timezone: string
  overtime_enabled: boolean
  overtime_grace_minutes: number
  overtime_rounding_minutes: number
  overtime_rounding_mode: 'floor' | 'nearest' | 'ceil'
  overtime_daily_cap_minutes: number
  overtime_requires_complete_day: boolean
  created_at: string
  updated_at: string
}

function timeInputValue(t: string | null | undefined): string {
  if (!t) return ''
  
return t.length >= 5 ? t.slice(0, 5) : t
}

function timeStringToDate(value: string | null | undefined): Date | null {
  const t = timeInputValue(value)
  if (!t) return null
  const [h, m] = t.split(':')
  if (h === undefined || m === undefined) return null
  const d = new Date()
  d.setHours(Number(h), Number(m), 0, 0)
  return d
}

function dateToTimeString(value: Date | null): string | null {
  if (!value) return null
  const h = String(value.getHours()).padStart(2, '0')
  const m = String(value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export default function NewEmployeePage() {
  const router = useRouter()

  const [employee, setEmployee] = useState<Partial<Employee>>({
    name: '',
    employee_code: '',
    rfid_card_id: null,
    pin_code: null,
    active: true,
    lunch_break_start: null,
    lunch_break_end: null,
    works_on_saturday: false,
    shift_start_time: null,
    shift_end_time: null,
    timezone: 'Europe/Budapest',
    overtime_enabled: false,
    overtime_grace_minutes: 10,
    overtime_rounding_minutes: 15,
    overtime_rounding_mode: 'floor',
    overtime_daily_cap_minutes: 120,
    overtime_requires_complete_day: true
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/employees')
  }

  const handleInputChange = (field: keyof Employee, value: string | boolean | number | null) => {
    setEmployee(prev => ({ ...prev, [field]: value }))

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }

    if (field === 'shift_start_time' || field === 'shift_end_time') {
      setErrors(prev => (prev.shift ? { ...prev, shift: '' } : prev))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}

    if (!employee.name || !employee.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }

    if (!employee.employee_code || !employee.employee_code.trim()) {
      newErrors.employee_code = 'A dolgozói kód mező kötelező'
    }

    if (employee.pin_code && employee.pin_code.trim() !== '') {
      const pinRegex = /^[0-9]{4}$/

      if (!pinRegex.test(employee.pin_code.trim())) {
        newErrors.pin_code = 'A PIN kód pontosan 4 számjegyből kell álljon'
      }
    }

    const ss = employee.shift_start_time?.trim() || null
    const se = employee.shift_end_time?.trim() || null

    if ((ss && !se) || (!ss && se)) {
      newErrors.shift = 'A műszak kezdetét és végét együtt adja meg, vagy mindkettőt hagyja üresen.'
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
          'Content-Type': 'application/json'
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
          shift_start_time: ss || null,
          shift_end_time: se || null,
          timezone: employee.timezone?.trim() || 'Europe/Budapest',
          overtime_enabled: employee.overtime_enabled === true,
          overtime_grace_minutes: Number(employee.overtime_grace_minutes) || 0,
          overtime_rounding_minutes: Number(employee.overtime_rounding_minutes) || 15,
          overtime_rounding_mode: employee.overtime_rounding_mode || 'floor',
          overtime_daily_cap_minutes: Number(employee.overtime_daily_cap_minutes) || 0,
          overtime_requires_complete_day: employee.overtime_requires_complete_day !== false
        })
      })

      if (response.ok) {
        const result = await response.json()

        toast.success('Új kolléga sikeresen létrehozva!', {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        })

        invalidateApiCache('/api/employees')

        router.push(`/employees/${result.id}`)
      } else {
        const errorData = await response.json()

        if (response.status === 409 && errorData.error?.includes?.('dolgozói kód')) {
          setErrors({ employee_code: 'Ez a dolgozói kód már létezik' })
          
return
        }

        if (response.status === 409 && errorData.error?.includes?.('RFID')) {
          setErrors({ rfid_card_id: 'Ez az RFID kártya ID már használatban van' })
          
return
        }

        throw new Error(errorData.error || 'Mentés sikertelen')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error(`Hiba történt a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
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
        <Typography color="text.primary">Új kolléga</Typography>
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
            aria-label="Új kolléga mentése"
          >
            {isSaving ? 'Mentés...' : 'Adatok mentése'}
          </Button>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack} aria-label="Vissza a listához">
            Vissza a listához
          </Button>
        </Box>
      </Box>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Alap adatok
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            Ugyanazok a beállítások, mint a szerkesztő nézetben: a <strong>tervezett műszak</strong> határozza meg a{' '}
            <strong>fizetett órát</strong> a jelenlét nézetben; az ebédszünetet mindkét számításnál levonjuk, ha
            átfed a munkaidővel.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Személyes adatok
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Név"
                value={employee.name || ''}
                onChange={e => handleInputChange('name', e.target.value)}
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
                onChange={e => handleInputChange('employee_code', e.target.value)}
                error={!!errors.employee_code}
                helperText={errors.employee_code}
                required
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Belépés (kártya / PIN)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A beléptető terminálhoz. Ha nincs RFID, a PIN-nel is lehet jelentkezni.
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="RFID kártya ID"
                value={employee.rfid_card_id || ''}
                onChange={e => handleInputChange('rfid_card_id', e.target.value || null)}
                error={!!errors.rfid_card_id}
                helperText={errors.rfid_card_id || 'Opcionális'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="PIN kód"
                value={employee.pin_code || ''}
                onChange={e => handleInputChange('pin_code', e.target.value || null)}
                error={!!errors.pin_code}
                helperText={errors.pin_code || '4 számjegy, opcionális'}
                inputProps={{ maxLength: 4, pattern: '[0-9]*' }}
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Tervezett műszak (fizetett idő)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Csak ez az idősáv számít bele a <strong>fizetett órába</strong>. A korábbi érkezés és a későbbi távozás
            megmarad ellenőrzésként, de nem növeli a fizetett órát.
          </Typography>
          {errors.shift && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {errors.shift}
            </Typography>
          )}
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <TimePicker
                  label="Műszak kezdete"
                  value={timeStringToDate(employee.shift_start_time)}
                  onChange={newValue => handleInputChange('shift_start_time', dateToTimeString(newValue))}
                  ampm={false}
                  disabled={isSaving}
                  minutesStep={5}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      helperText: 'Példa: 08:00 — üresen: nincs műszakkorlát'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TimePicker
                  label="Műszak vége"
                  value={timeStringToDate(employee.shift_end_time)}
                  onChange={newValue => handleInputChange('shift_end_time', dateToTimeString(newValue))}
                  ampm={false}
                  disabled={isSaving}
                  minutesStep={5}
                  slotProps={{ textField: { fullWidth: true, size: 'small', helperText: 'Példa: 17:00' } }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Időzóna"
                  value={employee.timezone || ''}
                  onChange={e => handleInputChange('timezone', e.target.value)}
                  helperText="Általában: Europe/Budapest"
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Túlóra szabály (dolgozó szint)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Alapból kikapcsolt. Ha engedélyezed, a műszak utáni percekből túlórát számolunk.
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={employee.overtime_enabled === true}
                    onChange={e => handleInputChange('overtime_enabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Túlóra engedélyezve"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Grace (perc)"
                value={employee.overtime_grace_minutes ?? 10}
                onChange={e => handleInputChange('overtime_grace_minutes', Number(e.target.value))}
                inputProps={{ min: 0, max: 180 }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Kerekítés (perc)"
                value={employee.overtime_rounding_minutes ?? 15}
                onChange={e => handleInputChange('overtime_rounding_minutes', Number(e.target.value))}
                inputProps={{ min: 1, max: 60 }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Kerekítés mód</InputLabel>
                <Select
                  label="Kerekítés mód"
                  value={employee.overtime_rounding_mode || 'floor'}
                  onChange={e => handleInputChange('overtime_rounding_mode', e.target.value as Employee['overtime_rounding_mode'])}
                >
                  <MenuItem value="floor">Lefelé</MenuItem>
                  <MenuItem value="nearest">Legközelebbi</MenuItem>
                  <MenuItem value="ceil">Felfelé</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Napi limit (perc)"
                value={employee.overtime_daily_cap_minutes ?? 120}
                onChange={e => handleInputChange('overtime_daily_cap_minutes', Number(e.target.value))}
                inputProps={{ min: 0, max: 1440 }}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={employee.overtime_requires_complete_day !== false}
                    onChange={e => handleInputChange('overtime_requires_complete_day', e.target.checked)}
                    color="primary"
                  />
                }
                label="Csak teljes napnál számoljon túlórát (érkezés + távozás)"
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Ebédszünet (számoláshoz)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Levonjuk a tényleges és a fizetett időből is, ha az ebéd átfed a munkaidővel.
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TimePicker
                  label="Ebéd kezdete"
                  value={timeStringToDate(employee.lunch_break_start)}
                  onChange={newValue => handleInputChange('lunch_break_start', dateToTimeString(newValue))}
                  ampm={false}
                  disabled={isSaving}
                  minutesStep={5}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TimePicker
                  label="Ebéd vége"
                  value={timeStringToDate(employee.lunch_break_end)}
                  onChange={newValue => handleInputChange('lunch_break_end', dateToTimeString(newValue))}
                  ampm={false}
                  disabled={isSaving}
                  minutesStep={5}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Státusz és munkanapok
          </Typography>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={employee.active !== undefined ? employee.active : true}
                  onChange={e => handleInputChange('active', e.target.checked)}
                  color="primary"
                />
              }
              label="Aktív"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={employee.works_on_saturday !== undefined ? employee.works_on_saturday : false}
                  onChange={e => handleInputChange('works_on_saturday', e.target.checked)}
                  color="primary"
                />
              }
              label="Szombaton is dolgozik (jelenlét nézetben nem szürkítjük ki)"
            />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}
