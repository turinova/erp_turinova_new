'use client'

import React, { useState, useEffect } from 'react'

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
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  Stack,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import TabContext from '@mui/lab/TabContext'

import Tab from '@mui/material/Tab'
import TabPanel from '@mui/lab/TabPanel'

import CustomTabList from '@core/components/mui/TabList'
import { invalidateApiCache } from '@/hooks/useApiCache'
import AttendanceMonthView from '@/components/attendance/AttendanceMonthView'
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'

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

  /** Planned paid shift (TIME from DB); use HH:mm in forms */
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

interface EmployeeEditClientProps {
  initialEmployee: Employee
}


export default function EmployeeEditClient({ initialEmployee }: EmployeeEditClientProps) {
  const router = useRouter()
  
  // Ensure works_on_saturday has a default value if undefined (for existing employees before migration)
  const [employee, setEmployee] = useState<Employee>({
    ...initialEmployee,
    works_on_saturday: initialEmployee.works_on_saturday !== undefined ? initialEmployee.works_on_saturday : false,
    shift_start_time: initialEmployee.shift_start_time ?? null,
    shift_end_time: initialEmployee.shift_end_time ?? null,
    timezone: initialEmployee.timezone || 'Europe/Budapest',
    overtime_enabled: initialEmployee.overtime_enabled === true,
    overtime_grace_minutes: Number.isFinite(initialEmployee.overtime_grace_minutes) ? initialEmployee.overtime_grace_minutes : 10,
    overtime_rounding_minutes: Number.isFinite(initialEmployee.overtime_rounding_minutes) ? initialEmployee.overtime_rounding_minutes : 15,
    overtime_rounding_mode: ['floor', 'nearest', 'ceil'].includes(initialEmployee.overtime_rounding_mode) ? initialEmployee.overtime_rounding_mode : 'floor',
    overtime_daily_cap_minutes: Number.isFinite(initialEmployee.overtime_daily_cap_minutes) ? initialEmployee.overtime_daily_cap_minutes : 120,
    overtime_requires_complete_day: initialEmployee.overtime_requires_complete_day !== false
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('1')

  const handleBack = () => {
    router.push('/employees')
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue)
  }

  const handleInputChange = (field: keyof Employee, value: string | boolean | number | null) => {
    setEmployee(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }

    if (field === 'shift_start_time' || field === 'shift_end_time') {
      setErrors(prev => (prev.shift ? { ...prev, shift: '' } : prev))
    }
  }

  const handleSave = async () => {
    if (!employee) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!employee.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }

    if (!employee.employee_code.trim()) {
      newErrors.employee_code = 'A dolgozói kód mező kötelező'
    }
    
    // Validate PIN code format if provided
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
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: employee.name.trim(),
          employee_code: employee.employee_code.trim(),
          rfid_card_id: employee.rfid_card_id?.trim() || null,
          pin_code: employee.pin_code?.trim() || null,
          active: employee.active,
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
        }),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Dolgozó adatok sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Update local state with saved data
        setEmployee(result)
        
        // Invalidate cache to refresh list page
        invalidateApiCache('/api/employees')
      } else {
        const errorData = await response.json()

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
          {employee.name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Kolléga szerkesztése
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            color="primary"
            disabled={isSaving}
            aria-label="Dolgozó adatainak mentése"
          >
            {isSaving ? 'Mentés...' : 'Adatok mentése'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            aria-label="Vissza a lista nézethez"
          >
            Vissza a listához
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <TabContext value={activeTab}>
        <CustomTabList pill='true' onChange={handleTabChange} aria-label='employee tabs'>
          <Tab value='1' label='Jelenlét' />
          <Tab value='2' label='Alap adatok' />
          <Tab value='3' label='Távollét' />
        </CustomTabList>

        {/* Tab 1: Jelenlét */}
        <TabPanel value='1' sx={{ p: 0, pt: 3, width: '100%', maxWidth: '100%' }}>
          <AttendanceMonthView
            employeeId={employee.id}
            lunchBreakStart={employee.lunch_break_start}
            lunchBreakEnd={employee.lunch_break_end}
            worksOnSaturday={employee.works_on_saturday !== undefined ? employee.works_on_saturday : false}
            shiftStart={timeInputValue(employee.shift_start_time)}
            shiftEnd={timeInputValue(employee.shift_end_time)}
            overtimePolicy={{
              enabled: employee.overtime_enabled,
              graceMinutes: employee.overtime_grace_minutes,
              roundingMinutes: employee.overtime_rounding_minutes,
              roundingMode: employee.overtime_rounding_mode,
              dailyCapMinutes: employee.overtime_daily_cap_minutes,
              requiresCompleteDay: employee.overtime_requires_complete_day
            }}
          />
        </TabPanel>

        {/* Tab 2: Alap adatok */}
        <TabPanel value='2' sx={{ p: 0, pt: 3 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Alap adatok
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
                Itt állítod be, mi számít fizetett órának ennél a dolgozónál.
              </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2.5 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Azonosítás
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Név"
                        value={employee.name}
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
                        value={employee.employee_code}
                        onChange={e => handleInputChange('employee_code', e.target.value)}
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
                        onChange={e => handleInputChange('rfid_card_id', e.target.value || null)}
                        helperText="Opcionális"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="PIN kód"
                        value={employee.pin_code || ''}
                        onChange={e => handleInputChange('pin_code', e.target.value || null)}
                        error={!!errors.pin_code}
                        helperText={errors.pin_code || '4 számjegy'}
                        inputProps={{ maxLength: 4, pattern: '[0-9]*' }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Túlóra szabály (dolgozó szint)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Alapértelmezésben kikapcsolt. Csak ennél a dolgozónál számol műszak utáni túlórát.
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={employee.overtime_enabled}
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
                        value={employee.overtime_grace_minutes}
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
                        value={employee.overtime_rounding_minutes}
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
                          value={employee.overtime_rounding_mode}
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
                        value={employee.overtime_daily_cap_minutes}
                        onChange={e => handleInputChange('overtime_daily_cap_minutes', Number(e.target.value))}
                        inputProps={{ min: 0, max: 1440 }}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={employee.overtime_requires_complete_day}
                            onChange={e => handleInputChange('overtime_requires_complete_day', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Csak teljes napnál számoljon túlórát (érkezés + távozás kötelező)"
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Fizetett idő szabály
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    A fizetett óra csak a műszakon belül számolódik. Korai/késői jelenlét csak ellenőrzés.
                  </Typography>
                  {errors.shift && (
                    <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                      {errors.shift}
                    </Typography>
                  )}
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TimePicker
                          label="Műszak kezdete"
                          value={timeStringToDate(employee.shift_start_time)}
                          onChange={newValue => handleInputChange('shift_start_time', dateToTimeString(newValue))}
                          ampm={false}
                          disabled={isSaving}
                          minutesStep={5}
                          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TimePicker
                          label="Műszak vége"
                          value={timeStringToDate(employee.shift_end_time)}
                          onChange={newValue => handleInputChange('shift_end_time', dateToTimeString(newValue))}
                          ampm={false}
                          disabled={isSaving}
                          minutesStep={5}
                          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
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
                      <Grid item xs={12} sm={6} md={3}>
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
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Elérhetőség
                  </Typography>
                  <Stack spacing={1.5}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={employee.active}
                          onChange={e => handleInputChange('active', e.target.checked)}
                            color="primary"
                          />
                        }
                      label="Aktív dolgozó"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={employee.works_on_saturday !== undefined ? employee.works_on_saturday : false}
                          onChange={e => handleInputChange('works_on_saturday', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Dolgozik szombaton"
                      />
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            <Accordion disableGutters elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 2, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Technikai adatok
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Időzóna"
                      value={employee.timezone}
                      onChange={e => handleInputChange('timezone', e.target.value)}
                      helperText="Alapértelmezés: Europe/Budapest"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Létrehozva"
                        value={new Date(employee.created_at).toLocaleString('hu-HU')}
                        disabled
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                      label="Utoljára frissítve"
                        value={new Date(employee.updated_at).toLocaleString('hu-HU')}
                        disabled
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </TabPanel>

        {/* Tab 3: Szabadságok */}
        <TabPanel value='3' sx={{ p: 0, pt: 3 }}>
          <EmployeeHolidaysTab employeeId={employee.id} />
        </TabPanel>
      </TabContext>
    </Box>
  )
}

// Employee Holidays Tab Component
interface EmployeeHolidaysTabProps {
  employeeId: string
}

function EmployeeHolidaysTab({ employeeId }: EmployeeHolidaysTabProps) {
  const [holidays, setHolidays] = useState<Array<{ id: string; date: string; type: string; name: string | null; created_at: string; updated_at: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayType, setNewHolidayType] = useState<'Szabadság' | 'Betegszabadság'>('Szabadság')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Fetch all holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/employees/${employeeId}/holidays`)

        if (response.ok) {
          const data = await response.json()

          setHolidays(data)
        }
      } catch (error) {
        console.error('Error fetching holidays:', error)
        toast.error('Hiba történt a szabadságok lekérdezése során', { position: "top-right" })
      } finally {
        setIsLoading(false)
      }
    }

    fetchHolidays()
  }, [employeeId])

  const handleAddHoliday = async () => {
    if (!newHolidayDate) {
      toast.error('Dátum megadása kötelező', { position: "top-right" })
      
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/employees/${employeeId}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newHolidayDate,
          type: newHolidayType,
          name: newHolidayName.trim() || null
        })
      })

      if (response.ok) {
        toast.success('Szabadság sikeresen hozzáadva', { position: "top-right" })
        setAddDialogOpen(false)
        setNewHolidayDate('')
        setNewHolidayType('Szabadság')
        setNewHolidayName('')

        // Refresh holidays list
        const refreshResponse = await fetch(`/api/employees/${employeeId}/holidays`)

        if (refreshResponse.ok) {
          const data = await refreshResponse.json()

          setHolidays(data)
        }


        // Dispatch event to refresh attendance data
        window.dispatchEvent(new CustomEvent(`employee-holiday-changed-${employeeId}`))
      } else {
        const errorData = await response.json()

        toast.error(errorData.error || 'Hiba történt a szabadság hozzáadása során', { position: "top-right" })
      }
    } catch (error) {
      console.error('Error adding holiday:', error)
      toast.error('Hiba történt a szabadság hozzáadása során', { position: "top-right" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteHolidays = async () => {
    setIsSaving(true)

    try {
      const deletePromises = selectedHolidays.map(holidayId =>
        fetch(`/api/employees/${employeeId}/holidays/${holidayId}`, { method: 'DELETE' })
      )

      const results = await Promise.allSettled(deletePromises)
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))

      if (failed.length === 0) {
        toast.success(`${selectedHolidays.length} szabadság sikeresen törölve`, { position: "top-right" })
        setSelectedHolidays([])
        setDeleteDialogOpen(false)

        // Refresh holidays list
        const refreshResponse = await fetch(`/api/employees/${employeeId}/holidays`)

        if (refreshResponse.ok) {
          const data = await refreshResponse.json()

          setHolidays(data)
        }


        // Dispatch event to refresh attendance data
        window.dispatchEvent(new CustomEvent(`employee-holiday-changed-${employeeId}`))
      } else {
        toast.error(`${failed.length} szabadság törlése sikertelen`, { position: "top-right" })
      }
    } catch (error) {
      console.error('Error deleting holidays:', error)
      toast.error('Hiba történt a szabadságok törlése során', { position: "top-right" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedHolidays(holidays.map(h => h.id))
    } else {
      setSelectedHolidays([])
    }
  }

  const handleSelectHoliday = (holidayId: string) => {
    setSelectedHolidays(prev =>
      prev.includes(holidayId) ? prev.filter(id => id !== holidayId) : [...prev, holidayId]
    )
  }

  const isAllSelected = selectedHolidays.length === holidays.length && holidays.length > 0
  const isIndeterminate = selectedHolidays.length > 0 && selectedHolidays.length < holidays.length

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedHolidays.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isSaving}
            >
              Törlés ({selectedHolidays.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{
              backgroundColor: '#000000',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#333333' }
            }}
          >
            Új szabadság hozzáadása
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Dátum</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Típus</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Megjegyzés</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Nincs szabadság ebben a hónapban
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((holiday) => (
                  <TableRow key={holiday.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedHolidays.includes(holiday.id)}
                        onChange={() => handleSelectHoliday(holiday.id)}
                      />
                    </TableCell>
                    <TableCell>{formatDate(holiday.date)}</TableCell>
                    <TableCell>
                      <Chip
                        label={holiday.type}
                        color={holiday.type === 'Szabadság' ? 'primary' : 'secondary'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{holiday.name || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Új szabadság hozzáadása</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              fullWidth
              type="date"
              label="Dátum"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Típus</InputLabel>
              <Select
                value={newHolidayType}
                onChange={(e) => setNewHolidayType(e.target.value as 'Szabadság' | 'Betegszabadság')}
                label="Típus"
              >
                <MenuItem value="Szabadság">Szabadság</MenuItem>
                <MenuItem value="Betegszabadság">Betegszabadság</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Megjegyzés (opcionális)"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={isSaving}>
            Mégse
          </Button>
          <Button onClick={handleAddHoliday} variant="contained" disabled={isSaving || !newHolidayDate}>
            {isSaving ? 'Hozzáadás...' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Szabadságok törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a kiválasztott {selectedHolidays.length} szabadságot? Ez a művelet nem vonható vissza.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isSaving}>
            Mégse
          </Button>
          <Button onClick={handleDeleteHolidays} color="error" variant="contained" disabled={isSaving}>
            {isSaving ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
