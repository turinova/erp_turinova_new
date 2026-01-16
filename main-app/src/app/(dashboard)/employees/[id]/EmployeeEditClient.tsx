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
  Card, 
  CardHeader, 
  CardContent, 
  Switch, 
  FormControlLabel,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  IconButton
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon, ExpandMore as ExpandMoreIcon, Add as AddIcon, Delete as DeleteIcon, PictureAsPdf as PictureAsPdfIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'
import TabContext from '@mui/lab/TabContext'
import CustomTabList from '@core/components/mui/TabList'
import Tab from '@mui/material/Tab'
import TabPanel from '@mui/lab/TabPanel'
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

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

interface EmployeeEditClientProps {
  initialEmployee: Employee
}

// Helper function to get all days in a month
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const date = new Date(year, month - 1, 1)
  
  while (date.getMonth() === month - 1) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  
  return days
}

// Helper function to format date as YYYY-MM-DD in local timezone (not UTC)
function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function to format date as "MM.DD DayName"
function formatDate(date: Date): string {
  const dayNames = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dayName = dayNames[date.getDay()]
  
  return `${month}.${day} ${dayName}`
}

// Helper function to check if date is Sunday
function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

// Helper function to check if date is Saturday
function isSaturday(date: Date): boolean {
  return date.getDay() === 6
}

// Helper function to check if date is today
function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

// Helper function to check if date falls within any holiday range
function isHoliday(date: Date, holidays: Array<{ start_date: string; end_date: string }>): boolean {
  if (!holidays || holidays.length === 0) return false
  
  const dateStr = date.toISOString().split('T')[0]
  
  return holidays.some(holiday => {
    const startDate = new Date(holiday.start_date)
    const endDate = new Date(holiday.end_date)
    const checkDate = new Date(dateStr)
    
    return checkDate >= startDate && checkDate <= endDate
  })
}

// Helper function to calculate hours worked
// Formula: (Departure - Arrival) - (Lunch End - Lunch Start)
function calculateHours(startTime: string | null, endTime: string | null, lunchStart: string | null, lunchEnd: string | null): number {
  // Need both arrival and departure to calculate hours
  if (!startTime || !endTime) return 0
  
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  
  // Calculate total minutes from arrival to departure
  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
  
  // Deduct lunch break time if both lunch start and end are provided
  if (lunchStart && lunchEnd) {
    const lunchStartTime = new Date(`2000-01-01T${lunchStart}`)
    const lunchEndTime = new Date(`2000-01-01T${lunchEnd}`)
    const lunchMinutes = (lunchEndTime.getTime() - lunchStartTime.getTime()) / (1000 * 60)
    
    // Only deduct if lunch minutes is positive (valid time range)
    if (lunchMinutes > 0) {
      totalMinutes -= lunchMinutes
    }
  }
  
  // Return hours rounded to 2 decimals, ensure non-negative
  const hours = Math.max(0, totalMinutes / 60)
  return Math.round(hours * 100) / 100
}

// Helper function to convert "HH:MM" string to Date object for TimePicker
function timeStringToDate(timeStr: string | null): Date | null {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

// Helper function to convert Date object to "HH:MM" string
function dateToTimeString(date: Date | null): string {
  if (!date) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

interface DayData {
  date: Date
  arrival: string | null
  arrivalLogId: string | null
  lunchStart: string | null
  lunchEnd: string | null
  departure: string | null
  departureLogId: string | null
  hoursWorked: number
  isDisabled: boolean
  isEmployeeHoliday: boolean
  holidayType?: string
}

interface AttendanceAccordionProps {
  employeeId: string
  lunchBreakStart: string | null
  lunchBreakEnd: string | null
  worksOnSaturday: boolean
}

function AttendanceAccordion({ employeeId, lunchBreakStart, lunchBreakEnd, worksOnSaturday }: AttendanceAccordionProps) {
  const currentDate = new Date(2026, 0, 15) // 2026-01-15
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1 // January = 1
  
  const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
  const monthName = monthNames[month - 1]
  
  // Get all days in the month
  const daysInMonth = getDaysInMonth(year, month)
  
  // Initialize day data with lunch break times pre-filled
  const [daysData, setDaysData] = useState<DayData[]>(
    daysInMonth.map(date => ({
      date,
      arrival: null,
      arrivalLogId: null,
      lunchStart: lunchBreakStart || null,
      lunchEnd: lunchBreakEnd || null,
      departure: null,
      departureLogId: null,
      hoursWorked: 0,
      isDisabled: isSunday(date) || (!worksOnSaturday && isSaturday(date)),
      isEmployeeHoliday: false,
      holidayType: undefined
    }))
  )
  
  const [locationId, setLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [holidays, setHolidays] = useState<Array<{ start_date: string; end_date: string }>>([])
  const [employeeHolidays, setEmployeeHolidays] = useState<Array<{ id: string; date: string; type: string; name: string | null }>>([])
  
  // Fetch default location ID, attendance logs, and holidays on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch first active location
        const locationResponse = await fetch('/api/locations?active=true&limit=1')
        if (locationResponse.ok) {
          const locations = await locationResponse.json()
          if (locations && locations.length > 0) {
            setLocationId(locations[0].id)
          }
        }
        
        // Calculate date range for the month
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]
        
        // Fetch holidays for this month
        const holidaysResponse = await fetch(`/api/holidays?start_date=${startDate}&end_date=${endDate}`)
        let activeHolidays: Array<{ start_date: string; end_date: string }> = []
        if (holidaysResponse.ok) {
          const holidaysData = await holidaysResponse.json()
          activeHolidays = holidaysData.filter((h: any) => h.active)
          setHolidays(activeHolidays)
        }
        
        // Fetch employee holidays for this month
        const employeeHolidaysResponse = await fetch(`/api/employees/${employeeId}/holidays?year=${year}&month=${month}`)
        let empHolidays: Array<{ id: string; date: string; type: string; name: string | null }> = []
        if (employeeHolidaysResponse.ok) {
          empHolidays = await employeeHolidaysResponse.json()
          setEmployeeHolidays(empHolidays)
        }
        
        // Fetch attendance logs for this month
        const logsResponse = await fetch(`/api/employees/${employeeId}/attendance?year=${year}&month=${month}`)
        if (logsResponse.ok) {
          const logs = await logsResponse.json()
          
          // Map logs to days and update disabled status based on holidays
          setDaysData(prev => prev.map(day => {
            const dateStr = formatDateLocal(day.date)
            const dayLog = logs.find((log: any) => log.date === dateStr)
            const empHoliday = empHolidays.find((h: any) => h.date === dateStr)
            
            const isHolidayDay = isHoliday(day.date, activeHolidays)
            const isEmpHoliday = !!empHoliday
            const shouldBeDisabled = isSunday(day.date) || (!worksOnSaturday && isSaturday(day.date)) || isHolidayDay || isEmpHoliday
            
            const updatedDay = {
              ...day,
              isDisabled: shouldBeDisabled,
              isEmployeeHoliday: isEmpHoliday,
              holidayType: empHoliday?.type
            }
            
            if (dayLog) {
              const arrival = dayLog.arrival?.time || null
              const departure = dayLog.departure?.time || null
              
              // Calculate hours worked (always calculate if there are logs, even if day is disabled)
              // Only set to 0 if it's an employee holiday
              const hours = isEmpHoliday ? 0 : calculateHours(arrival, departure, day.lunchStart, day.lunchEnd)
              
              // Debug log for Saturday
              if (isSaturday(day.date)) {
                console.log(`Saturday ${dateStr}: arrival=${arrival}, departure=${departure}, hours=${hours}, isEmpHoliday=${isEmpHoliday}, isDisabled=${shouldBeDisabled}, worksOnSaturday=${worksOnSaturday}`)
              }
              
              return {
                ...updatedDay,
                arrival,
                arrivalLogId: dayLog.arrival?.id || null,
                departure,
                departureLogId: dayLog.departure?.id || null,
                hoursWorked: hours
              }
            } else {
              // Debug log for Saturday when no log found
              if (isSaturday(day.date)) {
                console.log(`Saturday ${dateStr}: No log found. Available logs:`, logs.map((l: any) => l.date))
              }
            }
            
            // Even if no log, keep existing hoursWorked if it was set
            return updatedDay
          }))
        } else {
          // If logs fetch fails, still update disabled status based on holidays
          setDaysData(prev => prev.map(day => {
            const dateStr = formatDateLocal(day.date)
            const empHoliday = empHolidays.find((h: any) => h.date === dateStr)
            const isHolidayDay = isHoliday(day.date, activeHolidays)
            const isEmpHoliday = !!empHoliday
            return {
              ...day,
              isDisabled: isSunday(day.date) || (!worksOnSaturday && isSaturday(day.date)) || isHolidayDay || isEmpHoliday,
              isEmployeeHoliday: isEmpHoliday,
              holidayType: empHoliday?.type,
              hoursWorked: isEmpHoliday ? 0 : day.hoursWorked
            }
          }))
        }
      } catch (error) {
        console.error('Error fetching attendance data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [employeeId, year, month])
  
  // Update disabled status when holidays or employee holidays change
  useEffect(() => {
    setDaysData(prev => prev.map(day => {
      const dateStr = formatDateLocal(day.date)
      const empHoliday = employeeHolidays.find((h: any) => h.date === dateStr)
      const isHolidayDay = isHoliday(day.date, holidays)
      const isEmpHoliday = !!empHoliday
      
      // Recalculate hours if it's an employee holiday (set to 0) or if we have arrival/departure
      let hoursWorked = day.hoursWorked
      if (isEmpHoliday) {
        hoursWorked = 0
      } else if (day.arrival && day.departure) {
        // Recalculate hours if we have both arrival and departure (always calculate, even if day is disabled)
        hoursWorked = calculateHours(day.arrival, day.departure, day.lunchStart, day.lunchEnd)
      }
      
      // Debug log for Saturday
      if (isSaturday(day.date) && day.arrival && day.departure) {
        console.log(`Saturday useEffect ${dateStr}: arrival=${day.arrival}, departure=${day.departure}, hours=${hoursWorked}, isDisabled=${isSunday(day.date) || (!worksOnSaturday && isSaturday(day.date)) || isHolidayDay || isEmpHoliday}`)
      }
      
      return {
        ...day,
        isDisabled: isSunday(day.date) || (!worksOnSaturday && isSaturday(day.date)) || isHolidayDay || isEmpHoliday,
        isEmployeeHoliday: isEmpHoliday,
        holidayType: empHoliday?.type,
        hoursWorked: hoursWorked
      }
    }))
  }, [holidays, worksOnSaturday, employeeHolidays])
  
  const handleTimeChange = async (dayIndex: number, field: 'arrival' | 'lunchStart' | 'lunchEnd' | 'departure', value: string) => {
    if (!locationId) {
      toast.error('Helyszín ID hiányzik', { position: "top-right" })
      return
    }
    
    const day = daysData[dayIndex]
    const dateStr = formatDateLocal(day.date)
    
    // Update local state immediately
    setDaysData(prev => {
      const updated = [...prev]
      const updatedDay = {
        ...updated[dayIndex],
        [field]: value || null
      }
      
      // Recalculate hours worked
      updatedDay.hoursWorked = calculateHours(
        updatedDay.arrival,
        updatedDay.departure,
        updatedDay.lunchStart,
        updatedDay.lunchEnd
      )
      
      updated[dayIndex] = updatedDay
      return updated
    })
    
    // Handle arrival/departure changes (save to database)
    if (field === 'arrival' || field === 'departure') {
      setIsSaving(true)
      try {
        const scanType = field === 'arrival' ? 'arrival' : 'departure'
        
        if (value) {
          // Create or update log
          const response = await fetch(`/api/employees/${employeeId}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: dateStr,
              scanType,
              time: value,
              locationId
            })
          })
          
          if (response.ok) {
            const log = await response.json()
            
            // Update log ID in state
            setDaysData(prev => {
              const updated = [...prev]
              if (field === 'arrival') {
                updated[dayIndex].arrivalLogId = log.id
              } else {
                updated[dayIndex].departureLogId = log.id
              }
              return updated
            })
          } else {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Mentés sikertelen')
          }
        } else {
          // Delete log if time is cleared
          const logId = field === 'arrival' ? day.arrivalLogId : day.departureLogId
          
          if (logId) {
            const response = await fetch(`/api/employees/${employeeId}/attendance?logId=${logId}`, {
              method: 'DELETE'
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'Törlés sikertelen')
            }
            
            // Clear log ID in state
            setDaysData(prev => {
              const updated = [...prev]
              if (field === 'arrival') {
                updated[dayIndex].arrivalLogId = null
              } else {
                updated[dayIndex].departureLogId = null
              }
              return updated
            })
          }
        }
      } catch (error) {
        console.error('Error saving attendance log:', error)
        toast.error(`Hiba történt a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
          position: "top-right"
        })
        
        // Revert local state on error
        setDaysData(prev => {
          const updated = [...prev]
          updated[dayIndex] = {
            ...day,
            [field]: day[field === 'arrival' ? 'arrival' : 'departure']
          }
          return updated
        })
      } finally {
        setIsSaving(false)
      }
    }
  }
  
  // Calculate summary statistics
  const totalHours = daysData.reduce((sum, day) => sum + day.hoursWorked, 0)
  const daysWorked = daysData.filter(day => day.arrival && day.departure && !day.isDisabled && !day.isEmployeeHoliday).length
  const absentDays = daysData.filter(day => day.isEmployeeHoliday).length

  // Handle PDF generation
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}/attendance/pdf?year=${year}&month=${month}`)
      
      if (!response.ok) {
        let errorMessage = 'Hiba történt a PDF generálása során'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`
          }
        } catch (e) {
          // If response is not JSON, try to get text
          const text = await response.text().catch(() => '')
          errorMessage = text || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text()
        console.error('Unexpected response type:', contentType, text)
        throw new Error('A válasz nem PDF formátumú')
      }

      // Get PDF blob
      const blob = await response.blob()
      
      if (blob.size === 0) {
        throw new Error('A generált PDF üres')
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Use ASCII-safe month names for filename
      const monthNamesAscii = ['Januar', 'Februar', 'Marcius', 'Aprilis', 'Majus', 'Junius', 'Julius', 'Augusztus', 'Szeptember', 'Oktober', 'November', 'December']
      const monthNameForFile = monthNamesAscii[month - 1]
      link.download = `Jelenleti-iv-${year}-${monthNameForFile}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF sikeresen generálva és letöltve', { position: "top-right" })
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      toast.error('Hiba történt a PDF generálása során: ' + (error.message || 'Ismeretlen hiba'), {
        position: "top-right"
      })
    } finally {
      setIsGeneratingPdf(false)
    }
  }
  
  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="attendance-2026-january-content"
        id="attendance-2026-january-header"
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {year} {monthName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip 
              label={`Összes óra: ${totalHours.toFixed(2)} óra`} 
              color="primary" 
              variant="outlined"
              size="small"
            />
            <Chip 
              label={`Dolgozott napok: ${daysWorked}`} 
              color="success" 
              variant="outlined"
              size="small"
            />
            <Chip 
              label={`Távollét: ${absentDays}`} 
              color="warning" 
              variant="outlined"
              size="small"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={isGeneratingPdf ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
              onClick={(e) => {
                e.stopPropagation()
                handleGeneratePdf()
              }}
              disabled={isGeneratingPdf}
              sx={{ ml: 1 }}
            >
              {isGeneratingPdf ? 'Generálás...' : 'PDF'}
            </Button>
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
          <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Dátum</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Érkezés</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ebédszünet kezdet</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ebédszünet vége</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Távozás</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Dolgozott óra</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {daysData.map((day, index) => {
                const isTodayDate = isToday(day.date)
                return (
                <TableRow 
                  key={index}
                  sx={{
                    backgroundColor: day.isEmployeeHoliday 
                      ? (day.holidayType === 'Betegszabadság' ? '#ffebee' : 'success.light')
                      : day.isDisabled 
                        ? 'action.disabledBackground' 
                        : 'inherit',
                    borderLeft: day.isEmployeeHoliday && !isTodayDate ? '4px solid' : (isTodayDate ? '2px solid' : 'none'),
                    borderRight: isTodayDate ? '2px solid' : 'none',
                    borderTop: isTodayDate ? '2px solid' : 'none',
                    borderBottom: isTodayDate ? '2px solid' : 'none',
                    borderColor: isTodayDate ? 'success.main' : (day.isEmployeeHoliday ? (day.holidayType === 'Betegszabadság' ? 'error.main' : 'success.main') : 'transparent'),
                    '&:hover': day.isDisabled ? {} : { backgroundColor: day.isEmployeeHoliday ? (day.holidayType === 'Betegszabadság' ? '#ffebee' : 'success.light') : 'action.hover' }
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {day.isEmployeeHoliday && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: day.holidayType === 'Betegszabadság' ? 'error.main' : 'success.main',
                            fontWeight: 600
                          }}
                        >
                          {day.holidayType === 'Betegszabadság' ? '🌡️' : '☀️'}
                        </Typography>
                      )}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: day.isDisabled ? 'text.disabled' : 'text.primary',
                          fontWeight: day.isDisabled ? 'normal' : 500
                        }}
                      >
                        {formatDate(day.date)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <TimePicker
                      value={timeStringToDate(day.arrival)}
                      onChange={(newValue) => {
                        const timeStr = newValue ? dateToTimeString(newValue) : ''
                        handleTimeChange(index, 'arrival', timeStr)
                      }}
                      disabled={day.isDisabled}
                      ampm={false}
                      slotProps={{
                        textField: {
                          size: 'small',
                          error: !day.isDisabled && !day.arrival && !!day.departure,
                          sx: { width: 120 }
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TimePicker
                      value={timeStringToDate(day.lunchStart)}
                      onChange={(newValue) => {
                        const timeStr = newValue ? dateToTimeString(newValue) : ''
                        handleTimeChange(index, 'lunchStart', timeStr)
                      }}
                      disabled={day.isDisabled}
                      ampm={false}
                      slotProps={{
                        textField: {
                          size: 'small',
                          sx: { width: 120 }
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TimePicker
                      value={timeStringToDate(day.lunchEnd)}
                      onChange={(newValue) => {
                        const timeStr = newValue ? dateToTimeString(newValue) : ''
                        handleTimeChange(index, 'lunchEnd', timeStr)
                      }}
                      disabled={day.isDisabled}
                      ampm={false}
                      slotProps={{
                        textField: {
                          size: 'small',
                          sx: { width: 120 }
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TimePicker
                      value={timeStringToDate(day.departure)}
                      onChange={(newValue) => {
                        const timeStr = newValue ? dateToTimeString(newValue) : ''
                        handleTimeChange(index, 'departure', timeStr)
                      }}
                      disabled={day.isDisabled}
                      ampm={false}
                      slotProps={{
                        textField: {
                          size: 'small',
                          error: !day.isDisabled && !!day.arrival && !day.departure,
                          sx: { width: 120 }
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 600,
                        color: day.hoursWorked > 0 ? 'text.primary' : 'text.disabled'
                      }}
                    >
                      {day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)} óra` : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        </LocalizationProvider>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

export default function EmployeeEditClient({ initialEmployee }: EmployeeEditClientProps) {
  const router = useRouter()
  
  // Ensure works_on_saturday has a default value if undefined (for existing employees before migration)
  const [employee, setEmployee] = useState<Employee>({
    ...initialEmployee,
    works_on_saturday: initialEmployee.works_on_saturday !== undefined ? initialEmployee.works_on_saturday : false
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

  const handleInputChange = (field: keyof Employee, value: string | boolean | null) => {
    setEmployee(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
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

      {/* Tabs */}
      <TabContext value={activeTab}>
        <CustomTabList pill='true' onChange={handleTabChange} aria-label='employee tabs'>
          <Tab value='1' label='Alap adatok' />
          <Tab value='2' label='Jelenlét' />
          <Tab value='3' label='Távollét' />
        </CustomTabList>

        {/* Tab 1: Alap adatok */}
        <TabPanel value='1' sx={{ p: 0, pt: 3 }}>
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
                        value={employee.name}
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
                        value={employee.employee_code}
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
                        helperText="RFID kártya egyedi azonosítója"
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
                            checked={employee.active}
                            onChange={(e) => handleInputChange('active', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Aktív"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={employee.works_on_saturday !== undefined ? employee.works_on_saturday : false}
                            onChange={(e) => handleInputChange('works_on_saturday', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Dolgozik szombaton"
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Létrehozva"
                        value={new Date(employee.created_at).toLocaleString('hu-HU')}
                        disabled
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Frissítve"
                        value={new Date(employee.updated_at).toLocaleString('hu-HU')}
                        disabled
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Jelenlét */}
        <TabPanel value='2' sx={{ p: 0, pt: 3 }}>
          <AttendanceAccordion 
            key={`${employee.id}-${employee.works_on_saturday}`}
            employeeId={employee.id} 
            lunchBreakStart={employee.lunch_break_start}
            lunchBreakEnd={employee.lunch_break_end}
            worksOnSaturday={employee.works_on_saturday !== undefined ? employee.works_on_saturday : false}
          />
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
