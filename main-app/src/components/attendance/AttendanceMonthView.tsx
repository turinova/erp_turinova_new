'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  IconButton,
  Paper,
  Divider,
  Stack,
  Tooltip,
  Chip
} from '@mui/material'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Clear as ClearIcon
} from '@mui/icons-material'
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'
import { toast } from 'react-toastify'

import {
  getDaysInMonth,
  formatDateLocal,
  formatDateHu,
  isSunday,
  isSaturday,
  isToday,
  findPublicHolidayForDate,
  type PublicHolidayRow,
  computeAttendanceMetrics,
  timeStringToDate,
  dateToTimeString,
  getCalendarCells,
  WEEKDAY_LABELS_HU
} from './attendanceUtils'

export interface DayData {
  date: Date
  arrival: string | null
  arrivalLogId: string | null
  arrivalManuallyEdited: boolean
  lunchStart: string | null
  lunchEnd: string | null
  departure: string | null
  departureLogId: string | null
  departureManuallyEdited: boolean

  /** Paid hours (inside shift window, lunch deducted on paid segment) */
  hoursWorked: number

  /** Full span minus lunch (audit) */
  actualHours: number
  earlyMinutes: number
  lateMinutes: number
  isDisabled: boolean
  isEmployeeHoliday: boolean
  holidayType?: string
}

interface AttendanceMonthViewProps {
  employeeId: string
  lunchBreakStart: string | null
  lunchBreakEnd: string | null
  worksOnSaturday: boolean

  /** Planned paid window (HH:mm). Both null = no clipping; paid = actual. */
  shiftStart?: string | null
  shiftEnd?: string | null
}

type DraftDayTimes = {
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
}

function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null

  const parts = value.split(':')

  if (parts.length < 2) return value

  const hh = parts[0].padStart(2, '0')
  const mm = parts[1].padStart(2, '0')

  return `${hh}:${mm}`
}

const MONTH_NAMES = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December'
]

function buildEmptyMonth(
  year: number,
  month: number,
  lunchStart: string | null,
  lunchEnd: string | null,
  worksOnSaturday: boolean
): DayData[] {
  return getDaysInMonth(year, month).map(date => ({
    date,
    arrival: null,
    arrivalLogId: null,
    arrivalManuallyEdited: false,
    lunchStart: lunchStart || null,
    lunchEnd: lunchEnd || null,
    departure: null,
    departureLogId: null,
    departureManuallyEdited: false,
    hoursWorked: 0,
    actualHours: 0,
    earlyMinutes: 0,
    lateMinutes: 0,
    isDisabled: isSunday(date) || (!worksOnSaturday && isSaturday(date)),
    isEmployeeHoliday: false,
    holidayType: undefined
  }))
}

function getDayCellVisual(
  day: DayData,
  publicHolidays: PublicHolidayRow[],
  worksOnSaturday: boolean
): {
  line1: string
  line2: string
  tooltip: string
  bgcolor: string
  borderColor: string

  /** Larger first line for arrival–departure time range */
  emphasizeLine1: boolean
} {
  const ph = findPublicHolidayForDate(day.date, publicHolidays)

  const weekendOff = (isSunday(day.date) || (isSaturday(day.date) && !worksOnSaturday)) && !ph

  if (day.isEmployeeHoliday && !day.arrival && !day.departure) {
    const sick = day.holidayType === 'Betegszabadság'

    return {
      line1: sick ? 'Beteg' : 'Szab.',
      line2: 'Távollét',
      tooltip: sick ? 'Betegszabadság' : 'Szabadság',
      bgcolor: sick ? 'rgba(211, 47, 47, 0.08)' : 'rgba(46, 125, 50, 0.1)',
      borderColor: 'transparent',
      emphasizeLine1: false
    }
  }

  if (day.isDisabled && ph) {
    const national = ph.type === 'national'

    return {
      line1: ph.name,
      line2: national ? 'Állami ünnep' : 'Céges ünnep',
      tooltip: ph.name,
      bgcolor: national ? 'rgba(25, 118, 210, 0.09)' : 'rgba(123, 31, 162, 0.08)',
      borderColor: 'transparent',
      emphasizeLine1: false
    }
  }

  if (day.isDisabled && weekendOff) {
    return {
      line1: '—',
      line2: 'Hétvége',
      tooltip: 'Hétvége',
      bgcolor: 'action.hover',
      borderColor: 'transparent',
      emphasizeLine1: false
    }
  }

  if (day.isDisabled) {
    return {
      line1: '—',
      line2: 'Nem munkanap',
      tooltip: '',
      bgcolor: 'action.hover',
      borderColor: 'transparent',
      emphasizeLine1: false
    }
  }

  if (day.arrival && day.departure) {
    const tipParts = [`Fizetett: ${day.hoursWorked.toFixed(2)} ó`]

    if (Math.abs(day.actualHours - day.hoursWorked) > 0.01) {
      tipParts.push(`Teljes jelenlét (ebéd nélkül): ${day.actualHours.toFixed(2)} ó`)
    }

    if (day.earlyMinutes > 0) tipParts.push(`Korán: ${day.earlyMinutes} p (ellenőrzés)`)
    if (day.lateMinutes > 0) tipParts.push(`Későn: ${day.lateMinutes} p (ellenőrzés)`)

    return {
      line1: `${day.arrival} – ${day.departure}`,
      line2: `${day.hoursWorked.toFixed(1)} ó`,
      tooltip: tipParts.join(' · '),
      bgcolor: 'background.paper',
      borderColor: 'divider',
      emphasizeLine1: true
    }
  }

  if (day.arrival || day.departure) {
    return {
      line1: 'Hiányos',
      line2: day.arrival || day.departure || '—',
      tooltip: 'Hiányos rögzítés',
      bgcolor: 'rgba(237, 108, 2, 0.1)',
      borderColor: 'warning.main',
      emphasizeLine1: false
    }
  }

  return {
    line1: '—',
    line2: '',
    tooltip: '',
    bgcolor: 'background.paper',
    borderColor: 'divider',
    emphasizeLine1: false
  }
}

type DayStatusMeta = {
  label: string
  color: 'success' | 'warning' | 'error' | 'info' | 'default'
}

function getDayStatus(day: DayData, publicHolidays: PublicHolidayRow[], worksOnSaturday: boolean): DayStatusMeta | null {
  const ph = findPublicHolidayForDate(day.date, publicHolidays)
  const weekendOff = isSunday(day.date) || (isSaturday(day.date) && !worksOnSaturday)

  if (day.isEmployeeHoliday && !day.arrival && !day.departure) {
    return {
      label: day.holidayType === 'Betegszabadság' ? 'Betegszabadság' : 'Szabadság',
      color: day.holidayType === 'Betegszabadság' ? 'error' : 'success'
    }
  }

  if (ph || weekendOff) return { label: 'Munkaszünet', color: 'default' }

  if (day.arrival || day.departure) {
    if (!(day.arrival && day.departure)) return { label: 'Hiányos', color: 'warning' }
    if (day.earlyMinutes > 0 && day.lateMinutes > 0) return { label: 'Korai + Késői', color: 'warning' }
    if (day.earlyMinutes > 0) return { label: 'Korai', color: 'info' }
    if (day.lateMinutes > 0) return { label: 'Késői', color: 'info' }
    
return { label: 'OK', color: 'success' }
  }

  return null
}

export default function AttendanceMonthView({
  employeeId,
  lunchBreakStart,
  lunchBreakEnd,
  worksOnSaturday,
  shiftStart = null,
  shiftEnd = null
}: AttendanceMonthViewProps) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)

  const [daysData, setDaysData] = useState<DayData[]>(() =>
    buildEmptyMonth(now.getFullYear(), now.getMonth() + 1, lunchBreakStart, lunchBreakEnd, worksOnSaturday)
  )

  const [locationId, setLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [holidays, setHolidays] = useState<PublicHolidayRow[]>([])

  const [employeeHolidays, setEmployeeHolidays] = useState<
    Array<{ id: string; date: string; type: string; name: string | null }>
  >([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null)

  const [draftTimes, setDraftTimes] = useState<DraftDayTimes>({
    arrival: null,
    departure: null,
    lunchStart: null,
    lunchEnd: null
  })

  const selectedDay = selectedIndex !== null ? daysData[selectedIndex] : null
  const selectedDayStatus = selectedDay ? getDayStatus(selectedDay, holidays, worksOnSaturday) : null

  const draftMetrics = useMemo(
    () =>
      computeAttendanceMetrics(
        draftTimes.arrival,
        draftTimes.departure,
        draftTimes.lunchStart,
        draftTimes.lunchEnd,
        shiftStart,
        shiftEnd
      ),
    [draftTimes, shiftStart, shiftEnd]
  )

  useEffect(() => {
    if (!drawerOpen || !selectedDay) return
    setDraftTimes({
      arrival: normalizeTimeValue(selectedDay.arrival),
      departure: normalizeTimeValue(selectedDay.departure),
      lunchStart: normalizeTimeValue(selectedDay.lunchStart),
      lunchEnd: normalizeTimeValue(selectedDay.lunchEnd)
    })
  }, [drawerOpen, selectedDay])

  const mergeFetchedData = useCallback(
    (
      prevDays: DayData[],
      activeHolidays: PublicHolidayRow[],
      empHolidays: Array<{ id: string; date: string; type: string; name: string | null }>,
      logs: any[]
    ) => {
      return prevDays.map(day => {
        const dateStr = formatDateLocal(day.date)
        const dayLog = logs.find((log: any) => log.date === dateStr)
        const empHoliday = empHolidays.find((h: any) => h.date === dateStr)
        const isHolidayDay = !!findPublicHolidayForDate(day.date, activeHolidays)
        const isEmpHoliday = !!empHoliday

        const shouldBeDisabled = isSunday(day.date) || (!worksOnSaturday && isSaturday(day.date)) || isHolidayDay

        const updatedDay: DayData = {
          ...day,
          isDisabled: shouldBeDisabled,
          isEmployeeHoliday: isEmpHoliday,
          holidayType: empHoliday?.type
        }

        if (dayLog) {
          const arrival = dayLog.arrival?.time || null
          const departure = dayLog.departure?.time || null

          const m = computeAttendanceMetrics(
            arrival,
            departure,
            day.lunchStart,
            day.lunchEnd,
            shiftStart,
            shiftEnd
          )

          return {
            ...updatedDay,
            arrival,
            arrivalLogId: dayLog.arrival?.id || null,
            arrivalManuallyEdited: dayLog.arrival?.manually_edited || false,
            departure,
            departureLogId: dayLog.departure?.id || null,
            departureManuallyEdited: dayLog.departure?.manually_edited || false,
            hoursWorked: m.paidHours,
            actualHours: m.actualHours,
            earlyMinutes: m.earlyMinutes,
            lateMinutes: m.lateMinutes
          }
        }

        return {
          ...updatedDay,
          hoursWorked: 0,
          actualHours: 0,
          earlyMinutes: 0,
          lateMinutes: 0
        }
      })
    },
    [worksOnSaturday, shiftStart, shiftEnd]
  )

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const startDate = new Date(viewYear, viewMonth - 1, 1).toISOString().split('T')[0]
      const endDate = new Date(viewYear, viewMonth, 0).toISOString().split('T')[0]

      setDaysData(buildEmptyMonth(viewYear, viewMonth, lunchBreakStart, lunchBreakEnd, worksOnSaturday))

      try {
        const [locationResponse, holidaysResponse, employeeHolidaysResponse, logsResponse] = await Promise.all([
          fetch('/api/locations?active=true&limit=1'),
          fetch(`/api/holidays?start_date=${startDate}&end_date=${endDate}`),
          fetch(`/api/employees/${employeeId}/holidays?year=${viewYear}&month=${viewMonth}`),
          fetch(`/api/employees/${employeeId}/attendance?year=${viewYear}&month=${viewMonth}`)
        ])

        if (locationResponse.ok) {
          const locations = await locationResponse.json()

          if (locations?.length > 0) setLocationId(locations[0].id)
        }

        let activeHolidays: PublicHolidayRow[] = []

        if (holidaysResponse.ok) {
          const holidaysData = await holidaysResponse.json()

          activeHolidays = (holidaysData as Array<Record<string, unknown>>)
            .filter(h => h.active)
            .map(h => ({
              name: String(h.name ?? ''),
              start_date: String(h.start_date),
              end_date: String(h.end_date),
              type: h.type === 'company' ? 'company' : 'national'
            }))
          setHolidays(activeHolidays)
        }

        let empHolidays: Array<{ id: string; date: string; type: string; name: string | null }> = []

        if (employeeHolidaysResponse.ok) {
          empHolidays = await employeeHolidaysResponse.json()
          setEmployeeHolidays(empHolidays)
        }

        if (logsResponse.ok) {
          const logs = await logsResponse.json()

          setDaysData(prev => mergeFetchedData(prev, activeHolidays, empHolidays, logs))
        } else {
          setDaysData(prev => mergeFetchedData(prev, activeHolidays, empHolidays, []))
        }
      } catch (e) {
        console.error('Error fetching attendance data:', e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    const handleHolidayChange = () => {
      fetchData()
    }

    window.addEventListener(`employee-holiday-changed-${employeeId}`, handleHolidayChange)

    return () => window.removeEventListener(`employee-holiday-changed-${employeeId}`, handleHolidayChange)
  }, [employeeId, viewYear, viewMonth, lunchBreakStart, lunchBreakEnd, worksOnSaturday, shiftStart, shiftEnd, mergeFetchedData])

  useEffect(() => {
    setDaysData(prev =>
      prev.map(day => {
        const dateStr = formatDateLocal(day.date)
        const empHoliday = employeeHolidays.find(h => h.date === dateStr)
        const isHolidayDay = !!findPublicHolidayForDate(day.date, holidays)
        const isEmpHoliday = !!empHoliday
        let metrics = { paid: 0, actual: 0, early: 0, late: 0 }

        if (day.arrival && day.departure) {
          const m = computeAttendanceMetrics(
            day.arrival,
            day.departure,
            day.lunchStart,
            day.lunchEnd,
            shiftStart,
            shiftEnd
          )

          metrics = { paid: m.paidHours, actual: m.actualHours, early: m.earlyMinutes, late: m.lateMinutes }
        }

        return {
          ...day,
          isDisabled: isSunday(day.date) || (!worksOnSaturday && isSaturday(day.date)) || isHolidayDay,
          isEmployeeHoliday: isEmpHoliday,
          holidayType: empHoliday?.type,
          hoursWorked: metrics.paid,
          actualHours: metrics.actual,
          earlyMinutes: metrics.early,
          lateMinutes: metrics.late
        }
      })
    )
  }, [holidays, worksOnSaturday, employeeHolidays, shiftStart, shiftEnd])

  const updateDraftTime = (field: 'arrival' | 'lunchStart' | 'lunchEnd' | 'departure', value: string) => {
    setDraftTimes(prev => ({ ...prev, [field]: normalizeTimeValue(value) }))
  }

  const validateDraft = (draft: DraftDayTimes): boolean => {
    const hasInvalidFormat = (v: string | null) => !!v && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v)

    if (
      hasInvalidFormat(draft.arrival) ||
      hasInvalidFormat(draft.departure) ||
      hasInvalidFormat(draft.lunchStart) ||
      hasInvalidFormat(draft.lunchEnd)
    ) {
      toast.error('Érvénytelen időformátum. Használja az ÓÓ:PP formátumot.', { position: 'top-right' })

      return false
    }

    if (draft.arrival && draft.departure) {
      const arrivalTime = new Date(`2000-01-01T${draft.arrival}`)
      const departureTime = new Date(`2000-01-01T${draft.departure}`)

      if (departureTime <= arrivalTime) {
        toast.error('A távozás ideje nem lehet korábbi vagy egyenlő az érkezés idejével.', { position: 'top-right' })

        return false
      }

      const hoursDiff = (departureTime.getTime() - arrivalTime.getTime()) / (1000 * 60 * 60)

      if (hoursDiff > 12) {
        toast.error('A munkavégzés időtartama nem lehet több 12 óránál.', { position: 'top-right' })

        return false
      }
    }

    if (draft.lunchStart && draft.lunchEnd) {
      const lunchStartTime = new Date(`2000-01-01T${draft.lunchStart}`)
      const lunchEndTime = new Date(`2000-01-01T${draft.lunchEnd}`)

      if (lunchEndTime <= lunchStartTime) {
        toast.error('Az ebéd vége nem lehet korábbi vagy egyenlő az ebéd kezdetével.', { position: 'top-right' })

        return false
      }
    }

    return true
  }

  const totalHours = daysData.reduce((sum, day) => sum + day.hoursWorked, 0)
  const totalActualHours = daysData.reduce((sum, day) => sum + day.actualHours, 0)
  const totalEarlyMinutes = daysData.reduce((sum, day) => sum + day.earlyMinutes, 0)
  const totalLateMinutes = daysData.reduce((sum, day) => sum + day.lateMinutes, 0)
  const daysWorked = daysData.filter(day => day.arrival && day.departure && !day.isDisabled).length

  const incompleteDays = daysData.filter(
    day => !day.isDisabled && (day.arrival || day.departure) && !(day.arrival && day.departure)
  ).length

  const handleSaveDay = async () => {
    if (selectedIndex === null || !selectedDay) return
    if (!validateDraft(draftTimes)) return

    if (!locationId) {
      toast.error('Helyszín ID hiányzik', { position: 'top-right' })

      return
    }

    const dayIndex = selectedIndex
    const dateStr = formatDateLocal(selectedDay.date)

    setIsSaving(true)

    try {
      for (const field of ['arrival', 'departure'] as const) {
        const original = selectedDay[field]
        const nextValue = draftTimes[field]

        if (original === nextValue) continue

        if (nextValue) {
          const response = await fetch(`/api/employees/${employeeId}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: dateStr,
              scanType: field === 'arrival' ? 'arrival' : 'departure',
              time: nextValue,
              locationId
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))

            throw new Error(errorData.error || 'Mentés sikertelen')
          }

          const log = await response.json()

          setDaysData(prev => {
            const u = [...prev]

            u[dayIndex][field] = nextValue

            if (field === 'arrival') {
              u[dayIndex].arrivalLogId = log.id
              u[dayIndex].arrivalManuallyEdited = log.manually_edited || false
            } else {
              u[dayIndex].departureLogId = log.id
              u[dayIndex].departureManuallyEdited = log.manually_edited || false
            }

            return u
          })
        } else {
          const logId = field === 'arrival' ? selectedDay.arrivalLogId : selectedDay.departureLogId

          if (logId) {
            const response = await fetch(`/api/employees/${employeeId}/attendance?logId=${logId}`, {
              method: 'DELETE'
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))

              throw new Error(errorData.error || 'Törlés sikertelen')
            }
          }

          setDaysData(prev => {
            const u = [...prev]

            u[dayIndex][field] = null
            if (field === 'arrival') u[dayIndex].arrivalLogId = null
            else u[dayIndex].departureLogId = null

            return u
          })
        }
      }

      setDaysData(prev => {
        const u = [...prev]

        u[dayIndex].lunchStart = draftTimes.lunchStart
        u[dayIndex].lunchEnd = draftTimes.lunchEnd

        const m = computeAttendanceMetrics(
          u[dayIndex].arrival,
          u[dayIndex].departure,
          u[dayIndex].lunchStart,
          u[dayIndex].lunchEnd,
          shiftStart,
          shiftEnd
        )

        u[dayIndex].hoursWorked = m.paidHours
        u[dayIndex].actualHours = m.actualHours
        u[dayIndex].earlyMinutes = m.earlyMinutes
        u[dayIndex].lateMinutes = m.lateMinutes

        return u
      })

      toast.success('Napi adatok mentve', { position: 'top-right' })
      setDrawerOpen(false)
    } catch (error) {
      console.error('Error saving attendance log:', error)
      toast.error(`Hiba történt a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: 'top-right'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleGeneratePdf = async (mode: 'holiday' | 'work') => {
    setIsGeneratingPdf(true)
    setExportMenuAnchor(null)

    try {
      const response = await fetch(
        `/api/employees/${employeeId}/attendance/pdf?year=${viewYear}&month=${viewMonth}&mode=${mode}`
      )

      if (!response.ok) {
        let errorMessage = 'Hiba történt a PDF generálása során'

        try {
          const errorData = await response.json()

          errorMessage = errorData.error || errorMessage
          if (errorData.details) errorMessage += `: ${errorData.details}`
        } catch {
          const text = await response.text().catch(() => '')

          errorMessage = text || errorMessage
        }

        throw new Error(errorMessage)
      }

      const contentType = response.headers.get('content-type')

      if (!contentType?.includes('application/pdf')) {
        const text = await response.text()

        console.error('Unexpected response type:', contentType, text)
        throw new Error('A válasz nem PDF formátumú')
      }

      const blob = await response.blob()

      if (blob.size === 0) throw new Error('A generált PDF üres')
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url

      const monthNamesAscii = [
        'Januar',
        'Februar',
        'Marcius',
        'Aprilis',
        'Majus',
        'Junius',
        'Julius',
        'Augusztus',
        'Szeptember',
        'Oktober',
        'November',
        'December'
      ]

      link.download = `Jelenleti-iv-${viewYear}-${monthNamesAscii[viewMonth - 1]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF sikeresen generálva és letöltve', { position: 'top-right' })
    } catch (error: unknown) {
      console.error('Error generating PDF:', error)
      toast.error(
        'Hiba történt a PDF generálása során: ' + (error instanceof Error ? error.message : 'Ismeretlen hiba'),
        { position: 'top-right' }
      )
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear(y => y - 1)
    } else setViewMonth(m => m - 1)
  }

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear(y => y + 1)
    } else setViewMonth(m => m + 1)
  }

  const cells = getCalendarCells(daysData.length, viewYear, viewMonth)

  const openDay = (idx: number | null) => {
    if (idx === null) return
    setSelectedIndex(idx)
    setDrawerOpen(true)
  }

  const handleSetEmployeeHoliday = async (holidayType: 'Szabadság' | 'Betegszabadság') => {
    if (!selectedDay) return
    const date = formatDateLocal(selectedDay.date)

    setIsSaving(true)

    try {
      const response = await fetch(`/api/employees/${employeeId}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type: holidayType,
          name: null
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        throw new Error(errorData.error || 'Távollét mentése sikertelen')
      }

      toast.success(`${holidayType} rögzítve`, { position: 'top-right' })
      window.dispatchEvent(new CustomEvent(`employee-holiday-changed-${employeeId}`))
    } catch (error) {
      console.error('Error setting employee holiday:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: 'top-right'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveEmployeeHoliday = async () => {
    if (!selectedDay) return
    const date = formatDateLocal(selectedDay.date)
    const holiday = employeeHolidays.find(h => h.date === date)

    if (!holiday?.id) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/employees/${employeeId}/holidays/${holiday.id}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        throw new Error(errorData.error || 'Távollét törlése sikertelen')
      }

      toast.success('Távollét törölve', { position: 'top-right' })
      window.dispatchEvent(new CustomEvent(`employee-holiday-changed-${employeeId}`))
    } catch (error) {
      console.error('Error removing employee holiday:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: 'top-right'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden'
        }}
      >
        {/* Header: month nav + actions */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: theme => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50')
          }}
        >
          <Stack direction='row' alignItems='center' spacing={1}>
            <IconButton
              onClick={goPrevMonth}
              size='small'
              aria-label='Előző hónap'
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant='h6' sx={{ fontWeight: 600, minWidth: 200, textAlign: 'center' }}>
              {viewYear}. {MONTH_NAMES[viewMonth - 1]}
            </Typography>
            <IconButton
              onClick={goNextMonth}
              size='small'
              aria-label='Következő hónap'
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>

          <Stack direction='row' spacing={1} alignItems='center'>
            <Button
              size='small'
              variant='outlined'
              color='inherit'
              startIcon={isGeneratingPdf ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
              onClick={e => setExportMenuAnchor(e.currentTarget)}
              disabled={isGeneratingPdf}
              sx={{ textTransform: 'none', borderColor: 'divider' }}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              <MenuItem onClick={() => handleGeneratePdf('holiday')} disabled={isGeneratingPdf}>
                PDF — szabadság nézet
              </MenuItem>
              <MenuItem onClick={() => handleGeneratePdf('work')} disabled={isGeneratingPdf}>
                PDF — munka nézet
              </MenuItem>
            </Menu>
          </Stack>
        </Box>

        <Box sx={{ px: 2.5, py: 2 }}>
          <Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap='wrap' sx={{ gap: 1 }}>
              <Chip
                label={`Fizetett összesen: ${totalHours.toFixed(2)} ó`}
                color='primary'
                variant='outlined'
                size='small'
              />
              <Chip label={`Tényleges összesen: ${totalActualHours.toFixed(2)} ó`} size='small' variant='outlined' />
              <Chip label={`Korai: ${totalEarlyMinutes} p`} size='small' variant='outlined' />
              <Chip label={`Késői: ${totalLateMinutes} p`} size='small' variant='outlined' />
              <Chip label={`Teljes napok: ${daysWorked}`} size='small' variant='outlined' />
              <Chip
                label={`Hiányos napok: ${incompleteDays}`}
                size='small'
                variant='outlined'
                color={incompleteDays > 0 ? 'warning' : 'default'}
              />
            </Stack>
          </Paper>

          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Kattintson egy napra a részletek megnyitásához. A <strong>fizetett óra</strong> a tervezett műszak
            szerint számolódik (ha van beállítva az „Alap adatok” fülön); a korai érkezés és késői távozás csak
            ellenőrzésre jelenik meg.
          </Typography>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 0.5,
                    mb: 0.5
                  }}
                >
                  {WEEKDAY_LABELS_HU.map(w => (
                    <Typography
                      key={w}
                      variant='caption'
                      color='text.secondary'
                      sx={{ textAlign: 'center', fontWeight: 600, py: 0.5 }}
                    >
                      {w}
                    </Typography>
                  ))}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 0.75
                  }}
                >
                  {cells.map((dayIdx, i) => {
                    if (dayIdx === null) {
                      return <Box key={`empty-${i}`} sx={{ minHeight: 88 }} />
                    }

                    const day = daysData[dayIdx]
                    const visual = getDayCellVisual(day, holidays, worksOnSaturday)
                    const status = getDayStatus(day, holidays, worksOnSaturday)
                    const today = isToday(day.date)

                    return (
                      <Tooltip key={formatDateLocal(day.date)} title={visual.tooltip || ''} enterDelay={400}>
                        <Paper
                          elevation={0}
                          onClick={() => openDay(dayIdx)}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            minHeight: visual.emphasizeLine1 ? 102 : 88,
                            p: 1,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: today ? 'primary.main' : visual.borderColor,
                            bgcolor: visual.bgcolor,
                            boxShadow: today ? theme => `0 0 0 2px ${theme.palette.primary.main}` : 'none',
                            transition: 'filter 0.15s ease',
                            '&:hover': {
                              filter: theme => (theme.palette.mode === 'dark' ? 'brightness(1.08)' : 'brightness(0.96)')
                            }
                          }}
                        >
                          <Typography variant='subtitle2' fontWeight={700} sx={{ lineHeight: 1.2 }}>
                            {day.date.getDate()}
                          </Typography>
                          {status && (
                            <Chip
                              label={status.label}
                              size='small'
                              color={status.color}
                              variant='outlined'
                              sx={{ mt: 0.5, alignSelf: 'flex-start', height: 18, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                          <Typography
                            variant='caption'
                            component='div'
                            sx={{
                              color: 'text.primary',
                              display: 'block',
                              lineHeight: 1.3,
                              mt: 0.5,
                              fontWeight: visual.emphasizeLine1 ? 600 : 500,
                              fontSize: visual.emphasizeLine1 ? '0.875rem' : '0.7rem',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              whiteSpace: 'normal',
                              hyphens: 'auto'
                            }}
                          >
                            {visual.line1}
                          </Typography>
                          {visual.line2 ? (
                            visual.emphasizeLine1 ? (
                              <Chip
                                label={visual.line2}
                                size='small'
                                color='primary'
                                variant='outlined'
                                sx={{
                                  mt: 0.5,
                                  height: 'auto',
                                  maxWidth: '100%',
                                  alignSelf: 'flex-start',
                                  borderWidth: 1.5,
                                  '& .MuiChip-label': {
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    px: 0.75,
                                    py: 0.35,
                                    whiteSpace: 'normal',
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word'
                                  }
                                }}
                              />
                            ) : (
                              <Typography
                                variant='caption'
                                component='div'
                                color='text.secondary'
                                sx={{
                                  fontSize: '0.65rem',
                                  lineHeight: 1.25,
                                  mt: 0.25,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'anywhere',
                                  whiteSpace: 'normal'
                                }}
                              >
                                {visual.line2}
                              </Typography>
                            )
                          ) : null}
                        </Paper>
                      </Tooltip>
                    )
                  })}
                </Box>

                <Stack
                  direction='row'
                  flexWrap='wrap'
                  sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}
                >
                  {[
                    { label: 'Hétvége', bg: 'action.hover' },
                    { label: 'Állami ünnep', bg: 'rgba(25, 118, 210, 0.09)' },
                    { label: 'Céges ünnep', bg: 'rgba(123, 31, 162, 0.08)' },
                    { label: 'Szabadság', bg: 'rgba(46, 125, 50, 0.1)' },
                    { label: 'Betegszabadság', bg: 'rgba(211, 47, 47, 0.08)' },
                    { label: 'Hiányos', bg: 'rgba(237, 108, 2, 0.1)' },
                    { label: 'Teljes nap (fizetett)', bg: 'background.paper' }
                  ].map(item => (
                    <Stack key={item.label} direction='row' alignItems='center' spacing={0.75}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: 0.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: item.bg
                        }}
                      />
                      <Typography variant='caption' color='text.secondary'>
                        {item.label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog
        open={drawerOpen}
        onClose={() => {
          if (isSaving) return
          setDrawerOpen(false)
        }}
        maxWidth='sm'
        fullWidth
        PaperProps={{ elevation: 0, sx: { borderRadius: 2, border: '1px solid', borderColor: 'divider' } }}
      >
        {selectedDay && selectedIndex !== null && (
          <>
            <DialogTitle component='div' sx={{ pb: 0 }}>
              <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={1} sx={{ pr: 1 }}>
                <Typography variant='h6' component='h2' fontWeight={600} sx={{ fontSize: '1.125rem' }}>
                  {formatDateHu(selectedDay.date)}
                </Typography>
                {selectedDayStatus && (
                  <Chip
                    label={selectedDayStatus.label}
                    size='small'
                    color={selectedDayStatus.color}
                    variant='outlined'
                  />
                )}
              </Stack>
              {selectedDay.isEmployeeHoliday && (
                <Typography variant='body2' color='text.secondary' component='p' sx={{ mt: 0.5 }}>
                  {selectedDay.holidayType === 'Betegszabadság' ? 'Betegszabadság' : 'Szabadság'} (Távollét fül)
                </Typography>
              )}
            </DialogTitle>
            <DialogContent>
              {(() => {
                const dateStr = formatDateLocal(selectedDay.date)
                const linkedHoliday = employeeHolidays.find(h => h.date === dateStr)
                const isPublicHoliday = !!findPublicHolidayForDate(selectedDay.date, holidays)
                const isWeekendOff = isSunday(selectedDay.date) || (isSaturday(selectedDay.date) && !worksOnSaturday)
                const canQuickHoliday = !isPublicHoliday && !isWeekendOff

                return (
                  <>
                    {canQuickHoliday && (
                      <Paper variant='outlined' sx={{ p: 1.5, mb: 2 }}>
                        <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                          Gyors távollét beállítás
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <Button
                            size='small'
                            variant='outlined'
                            onClick={() => handleSetEmployeeHoliday('Szabadság')}
                            disabled={isSaving}
                            sx={{ textTransform: 'none' }}
                          >
                            Szabadság
                          </Button>
                          <Button
                            size='small'
                            variant='outlined'
                            color='error'
                            onClick={() => handleSetEmployeeHoliday('Betegszabadság')}
                            disabled={isSaving}
                            sx={{ textTransform: 'none' }}
                          >
                            Betegszabadság
                          </Button>
                          {linkedHoliday && (
                            <Button
                              size='small'
                              variant='text'
                              color='inherit'
                              onClick={handleRemoveEmployeeHoliday}
                              disabled={isSaving}
                              sx={{ textTransform: 'none' }}
                            >
                              Távollét törlése
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    )}

                    {selectedDay.isDisabled ? (
                <Typography variant='body2' color='text.secondary' sx={{ py: 2 }}>
                  Ezen a napon nem rögzíthető munkaidő (hétvége vagy ünnepnap).
                </Typography>
              ) : (
                <Stack spacing={2.5} sx={{ pt: 1 }}>
                  <Box>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 0.5 }}>
                      Érkezés
                    </Typography>
                    <Stack direction='row' alignItems='center' spacing={1}>
                      <TimePicker
                        value={timeStringToDate(draftTimes.arrival)}
                        onChange={nv => updateDraftTime('arrival', nv ? dateToTimeString(nv) : '')}
                        disabled={isSaving}
                        ampm={false}
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true,
                            error: !draftTimes.arrival && !!draftTimes.departure
                          }
                        }}
                      />
                      <Tooltip title='Mező ürítése'>
                        <span>
                          <IconButton
                            size='small'
                            aria-label='Érkezés törlése'
                            onClick={() => updateDraftTime('arrival', '')}
                            disabled={isSaving || !draftTimes.arrival}
                            edge='end'
                          >
                            <ClearIcon fontSize='small' />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {selectedDay.arrival && (
                        <Tooltip title={selectedDay.arrivalManuallyEdited ? 'Kézi bevitel' : 'Olvasó / PIN'}>
                          <Typography
                            variant='caption'
                            color={selectedDay.arrivalManuallyEdited ? 'primary' : 'text.secondary'}
                          >
                            {selectedDay.arrivalManuallyEdited ? 'Kézi' : 'Eszköz'}
                          </Typography>
                        </Tooltip>
                      )}
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 0.5 }}>
                      Távozás
                    </Typography>
                    <Stack direction='row' alignItems='center' spacing={1}>
                      <TimePicker
                        value={timeStringToDate(draftTimes.departure)}
                        onChange={nv => updateDraftTime('departure', nv ? dateToTimeString(nv) : '')}
                        disabled={isSaving}
                        ampm={false}
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true,
                            error: !!draftTimes.arrival && !draftTimes.departure
                          }
                        }}
                      />
                      <Tooltip title='Mező ürítése'>
                        <span>
                          <IconButton
                            size='small'
                            aria-label='Távozás törlése'
                            onClick={() => updateDraftTime('departure', '')}
                            disabled={isSaving || !draftTimes.departure}
                            edge='end'
                          >
                            <ClearIcon fontSize='small' />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {selectedDay.departure && (
                        <Tooltip title={selectedDay.departureManuallyEdited ? 'Kézi bevitel' : 'Olvasó / PIN'}>
                          <Typography
                            variant='caption'
                            color={selectedDay.departureManuallyEdited ? 'primary' : 'text.secondary'}
                          >
                            {selectedDay.departureManuallyEdited ? 'Kézi' : 'Eszköz'}
                          </Typography>
                        </Tooltip>
                      )}
                    </Stack>
                  </Box>
                  <Divider />
                  <Typography variant='caption' color='text.secondary'>
                    Ebédszünet (csak a számoláshoz; alapértelmezés az „Alap adatok” fülön)
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TimePicker
                      label='Ebéd kezdete'
                      value={timeStringToDate(draftTimes.lunchStart)}
                      onChange={nv => updateDraftTime('lunchStart', nv ? dateToTimeString(nv) : '')}
                      disabled={isSaving}
                      ampm={false}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                    <TimePicker
                      label='Ebéd vége'
                      value={timeStringToDate(draftTimes.lunchEnd)}
                      onChange={nv => updateDraftTime('lunchEnd', nv ? dateToTimeString(nv) : '')}
                      disabled={isSaving}
                      ampm={false}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Stack>
                  <Paper variant='outlined' sx={{ p: 1.5, bgcolor: theme => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50') }}>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 0.5 }}>
                      Összegzés (mentés után is így számolódik)
                    </Typography>
                    <Typography variant='body2'>
                      Fizetett idő:{' '}
                      <strong>{draftMetrics.paidHours > 0 ? `${draftMetrics.paidHours.toFixed(2)} óra` : '—'}</strong>
                    </Typography>
                    {shiftStart && shiftEnd && (
                      <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                        Tervezett műszak: {shiftStart} – {shiftEnd}
                      </Typography>
                    )}
                    {(draftMetrics.earlyMinutes > 0 || draftMetrics.lateMinutes > 0) && (
                      <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                        Ellenőrzés: {draftMetrics.earlyMinutes > 0 ? `korán ${draftMetrics.earlyMinutes} p` : ''}
                        {draftMetrics.earlyMinutes > 0 && draftMetrics.lateMinutes > 0 ? ' · ' : ''}
                        {draftMetrics.lateMinutes > 0 ? `későn ${draftMetrics.lateMinutes} p` : ''}
                        {' — nem növeli a fizetett órát'}
                      </Typography>
                    )}
                  </Paper>
                </Stack>
              )}
                  </>
                )
              })()}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                onClick={() => setDrawerOpen(false)}
                variant='text'
                sx={{ textTransform: 'none' }}
                disabled={isSaving}
              >
                Bezárás
              </Button>
              <Button variant='contained' onClick={handleSaveDay} disabled={isSaving || !!selectedDay.isDisabled}>
                {isSaving ? 'Mentés...' : 'Mentés'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </LocalizationProvider>
  )
}
