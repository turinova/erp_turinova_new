import { readFile } from 'fs/promises'
import { join } from 'path'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import JSZip from 'jszip'

import { getAllEmployees, getAttendanceLogsForMonth, getEmployeeById, getEmployeeHolidays, getHolidaysForDateRange } from '@/lib/supabase-server'
import { computeAttendanceMetrics } from '@/components/attendance/attendanceUtils'
import generateAttendancePdfHtml from '../../../[id]/attendance/pdf/pdf-template'

export const runtime = 'nodejs'

const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sanitizeFilenamePart(input: string): string {
  return input.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'employee'
}

function assertValidMonthYear(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Érvénytelen év paraméter')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Érvénytelen hónap paraméter')
  }
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null
  return parts[0] * 60 + parts[1]
}

function minutesToTimeString(totalMinutes: number): string {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const m = String(totalMinutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function isWeekday(d: Date): boolean {
  const dow = d.getDay()
  return dow >= 1 && dow <= 5
}

function nextMonday(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  const daysUntilMonday = (8 - dow) % 7 || 7
  d.setDate(d.getDate() + daysUntilMonday)
  return d
}

function dayKey(date: Date): string {
  return formatDateLocal(date)
}

async function launchBrowser() {
  if (isProduction) {
    const puppeteerCore = await import('puppeteer-core')
    const chromium = await import('@sparticuz/chromium')
    return puppeteerCore.default.launch({
      args: [
        ...chromium.default.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain'
      ],
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless
    })
  }

  const puppeteer = await import('puppeteer')
  return puppeteer.default.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--no-sandbox']
  })
}

async function renderHtmlToPdfBuffer(browser: any, html: string): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (req: any) => req.abort())

    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 50))

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1,
      margin: { top: '8mm', right: '4mm', bottom: '8mm', left: '4mm' }
    })

    return pdfBuffer
  } finally {
    await page.close().catch(() => {})
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = next++
      if (idx >= items.length) return
      results[idx] = await fn(items[idx], idx)
    }
  })

  await Promise.all(workers)
  return results
}

type BulkBody = {
  employeeIds: string[]
  year: number
  month: number
}

export async function POST(request: NextRequest) {
  let browser: any | null = null
  try {
    const body = (await request.json()) as Partial<BulkBody>
    const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds.filter(Boolean) : []
    const year = Number(body.year)
    const month = Number(body.month)

    if (employeeIds.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott kolléga' }, { status: 400 })
    }
    if (employeeIds.length > 200) {
      return NextResponse.json({ error: 'Túl sok kiválasztott kolléga (max: 200)' }, { status: 400 })
    }

    assertValidMonthYear(year, month)

    const startDate = formatDateLocal(new Date(year, month - 1, 1))
    const endDate = formatDateLocal(new Date(year, month, 0))

    const [holidays, turinovaLogoBase64, allEmployees] = await Promise.all([
      getHolidaysForDateRange(startDate, endDate),
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then(buf => buf.toString('base64'))
        .catch(() => ''),
      getAllEmployees()
    ])

    // Coverage assignment uses all active eligible employees (IRODA + BOLTI_DOLGOZO).
    const eligible = allEmployees
      .filter(e => e.employee_type === 'IRODA' || e.employee_type === 'BOLTI_DOLGOZO')
      .map(e => ({ id: e.id, employee_code: e.employee_code }))
      .sort((a, b) => a.employee_code.localeCompare(b.employee_code, 'hu'))

    browser = await launchBrowser()

    const zip = new JSZip()
    const monthNamesHu = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
    const monthNameHu = monthNamesHu[month - 1]

    const manifest: {
      generatedAt: string
      year: number
      month: number
      requestedEmployeeIds: string[]
      coveragePoolSize: number
      success: Array<{ employeeId: string; filename: string }>
      errors: Array<{ employeeId: string; error: string }>
    } = {
      generatedAt: new Date().toISOString(),
      year,
      month,
      requestedEmployeeIds: employeeIds,
      coveragePoolSize: eligible.length,
      success: [],
      errors: []
    }

    const daysInMonth: Date[] = []
    const d0 = new Date(year, month - 1, 1)
    while (d0.getMonth() === month - 1) {
      daysInMonth.push(new Date(d0))
      d0.setDate(d0.getDate() + 1)
    }

    const coverageByDate: Record<string, { openId: string | null; closeId: string | null }> = {}
    for (let i = 0; i < daysInMonth.length; i++) {
      const day = daysInMonth[i]
      if (!isWeekday(day)) continue
      if (eligible.length === 0) {
        coverageByDate[dayKey(day)] = { openId: null, closeId: null }
        continue
      }
      const open = eligible[i % eligible.length]?.id ?? null
      const close = eligible[(i + 1) % eligible.length]?.id ?? open
      coverageByDate[dayKey(day)] = { openId: open, closeId: close }
    }

    const isGlobalHolidayDate = (dateStr: string): boolean => {
      return holidays.some(h => {
        const start = new Date(h.start_date)
        const end = new Date(h.end_date)
        const checkDate = new Date(dateStr)
        return checkDate >= start && checkDate <= end
      })
    }

    const concurrency = Math.min(4, Math.max(1, Number(process.env.PDF_BULK_CONCURRENCY || 3)))

    await mapWithConcurrency(employeeIds, concurrency, async employeeId => {
      try {
        const employee = await getEmployeeById(employeeId)
        if (!employee) throw new Error('Alkalmazott nem található')

        const [attendanceLogs, employeeHolidays] = await Promise.all([
          getAttendanceLogsForMonth(employeeId, year, month),
          getEmployeeHolidays(employeeId, year, month)
        ])

        // Saturday minutes (actual, capped at 4h) map -> reduction applied on next Monday (or next working day if Monday is leave/holiday)
        const reduceMap: Record<string, number> = {}

        for (const day of daysInMonth) {
          if (day.getDay() !== 6) continue
          const dateStr = dayKey(day)
          const dayLog = attendanceLogs.find((log: any) => log.date === dateStr)
          const arrival = dayLog?.arrival?.time || null
          const departure = dayLog?.departure?.time || null
          if (!arrival || !departure) continue

          const lunchStart = employee.lunch_break_start || null
          const lunchEnd = employee.lunch_break_end || null
          const metrics = computeAttendanceMetrics(arrival, departure, lunchStart, lunchEnd, null, null)
          const satMinutes = Math.min(240, Math.max(0, Math.round(metrics.actualHours * 60)))
          if (satMinutes <= 0) continue

          let target = nextMonday(day)
          // If Monday is leave/holiday, find next weekday that is not leave/holiday.
          for (let tries = 0; tries < 10; tries++) {
            const tStr = dayKey(target)
            const isEmpHoliday = employeeHolidays.some((h: any) => h.date === tStr)
            const isGlobal = isGlobalHolidayDate(tStr)
            if (target.getDay() >= 1 && target.getDay() <= 5 && !isEmpHoliday && !isGlobal) {
              reduceMap[tStr] = Math.min(480, (reduceMap[tStr] || 0) + satMinutes)
              break
            }
            target.setDate(target.getDate() + 1)
          }
        }

        const lunchConfiguredStart = employee.lunch_break_start ? String(employee.lunch_break_start).slice(0, 5) : null
        const lunchConfiguredEnd = employee.lunch_break_end ? String(employee.lunch_break_end).slice(0, 5) : null
        const lunchDurationMinutes = (() => {
          const s = parseTimeToMinutes(lunchConfiguredStart)
          const e = parseTimeToMinutes(lunchConfiguredEnd)
          if (s === null || e === null || e <= s) return 30
          return e - s
        })()

        const daysData = daysInMonth.map((day, idx) => {
          const dateStr = dayKey(day)
          const empHoliday = employeeHolidays.find((h: any) => h.date === dateStr)
          const isEmpHoliday = !!empHoliday
          const isSickLeave = empHoliday?.type === 'Betegszabadság'
          const isGlobalHoliday = isGlobalHolidayDate(dateStr)

          // Official export: holidays/leave always override to leave with 0h, no times.
          if (isGlobalHoliday || isEmpHoliday) {
            return {
              date: dateStr,
              dayOfMonth: day.getDate(),
              dayOfWeek: day.getDay(),
              arrival: null,
              departure: null,
              displayArrival: null,
              displayDeparture: null,
              lunchStart: null,
              lunchEnd: null,
              hoursWorked: 0,
              overtimeMinutes: 0,
              hasAttendance: false,
              hasCompleteAttendance: false,
              isEmployeeHoliday: isEmpHoliday,
              holidayType: isEmpHoliday ? (isSickLeave ? 'Betegszabadság' : 'Szabadság') : null,
              isConflictHolidayWork: false,
              isGlobalHoliday: isGlobalHoliday,
              isDisabled: true
            }
          }

          // Saturday: show at most 4h if there was real attendance; otherwise blank.
          if (day.getDay() === 6) {
            const dayLog = attendanceLogs.find((log: any) => log.date === dateStr)
            const arrivalReal = dayLog?.arrival?.time || null
            const departureReal = dayLog?.departure?.time || null
            let satMinutes = 0
            if (arrivalReal && departureReal) {
              const metrics = computeAttendanceMetrics(arrivalReal, departureReal, lunchConfiguredStart, lunchConfiguredEnd, null, null)
              satMinutes = Math.min(240, Math.max(0, Math.round(metrics.actualHours * 60)))
            }
            const start = '08:00'
            const startM = parseTimeToMinutes(start) || 480
            const end = minutesToTimeString(startM + satMinutes)
            const has = satMinutes > 0

            return {
              date: dateStr,
              dayOfMonth: day.getDate(),
              dayOfWeek: day.getDay(),
              arrival: has ? start : null,
              departure: has ? end : null,
              displayArrival: has ? start : null,
              displayDeparture: has ? end : null,
              lunchStart: null,
              lunchEnd: null,
              hoursWorked: Math.round((satMinutes / 60) * 100) / 100,
              overtimeMinutes: 0,
              hasAttendance: has,
              hasCompleteAttendance: has,
              isEmployeeHoliday: false,
              holidayType: null,
              isConflictHolidayWork: false,
              isGlobalHoliday: false,
              isDisabled: false
            }
          }

          // Sunday: always blank in official export.
          if (day.getDay() === 0) {
            return {
              date: dateStr,
              dayOfMonth: day.getDate(),
              dayOfWeek: day.getDay(),
              arrival: null,
              departure: null,
              displayArrival: null,
              displayDeparture: null,
              lunchStart: null,
              lunchEnd: null,
              hoursWorked: 0,
              overtimeMinutes: 0,
              hasAttendance: false,
              hasCompleteAttendance: false,
              isEmployeeHoliday: false,
              holidayType: null,
              isConflictHolidayWork: false,
              isGlobalHoliday: false,
              isDisabled: true
            }
          }

          // Weekday: if there is no real complete attendance (arrival + departure), keep the day blank.
          // This is critical: do NOT generate official times for days without real logs.
          const dayLog = attendanceLogs.find((log: any) => log.date === dateStr)
          const realArrival = dayLog?.arrival?.time || null
          const realDeparture = dayLog?.departure?.time || null
          if (!realArrival || !realDeparture) {
            return {
              date: dateStr,
              dayOfMonth: day.getDate(),
              dayOfWeek: day.getDay(),
              arrival: null,
              departure: null,
              displayArrival: null,
              displayDeparture: null,
              lunchStart: null,
              lunchEnd: null,
              hoursWorked: 0,
              overtimeMinutes: 0,
              hasAttendance: false,
              hasCompleteAttendance: false,
              isEmployeeHoliday: false,
              holidayType: null,
              isConflictHolidayWork: false,
              isGlobalHoliday: false,
              isDisabled: false
            }
          }

          // Weekday official templates for coverage
          const coverage = coverageByDate[dateStr] || { openId: null, closeId: null }
          const isOpen = coverage.openId === employeeId
          const isClose = coverage.closeId === employeeId

          const start = isOpen ? '08:00' : isClose ? '08:30' : idx % 2 === 0 ? '08:00' : '08:30'
          const startM0 = parseTimeToMinutes(start) || 480

          const reduction = Math.min(480, Math.max(0, reduceMap[dateStr] || 0))
          // Push start later by reduction minutes; keep end fixed by template + lunch duration.
          const endM = startM0 + 480 + lunchDurationMinutes
          const startM = Math.min(endM, startM0 + reduction)

          const arrival = minutesToTimeString(startM)
          const departure = minutesToTimeString(endM)

          // Keep employee lunch if it fits; otherwise omit (short day due to Saturday reduction).
          const remainingSpanMinutes = Math.max(0, endM - startM)
          const allowLunch = remainingSpanMinutes >= 360 // keep lunch only if day still at least 6h span
          const lunchStart = allowLunch ? lunchConfiguredStart : null
          const lunchEnd = allowLunch ? lunchConfiguredEnd : null

          const metrics = computeAttendanceMetrics(arrival, departure, lunchStart, lunchEnd, null, null)
          const paidHoursCapped = Math.min(8, Math.max(0, metrics.actualHours)) // should be <= 8 by construction

          return {
            date: dateStr,
            dayOfMonth: day.getDate(),
            dayOfWeek: day.getDay(),
            arrival,
            departure,
            displayArrival: arrival,
            displayDeparture: departure,
            lunchStart,
            lunchEnd,
            hoursWorked: Math.round(paidHoursCapped * 100) / 100,
            overtimeMinutes: 0,
            hasAttendance: true,
            hasCompleteAttendance: true,
            isEmployeeHoliday: false,
            holidayType: null,
            isConflictHolidayWork: false,
            isGlobalHoliday: false,
            isDisabled: false
          }
        })

        const totalHours = daysData.reduce((sum, day) => sum + (day.hoursWorked || 0), 0)
        const daysWorked = daysData.filter(day => day.hasCompleteAttendance && day.hoursWorked > 0).length
        const absentDays = daysData.filter(day => day.isEmployeeHoliday && !day.hasAttendance).length
        const conflictDays = 0
        const saturdayDays = daysData.filter(day => day.dayOfWeek === 6 && day.hoursWorked > 0).length
        const totalOvertimeMinutes = 0

        const html = generateAttendancePdfHtml({
          employee: { name: employee.name, employee_code: employee.employee_code, employee_type: employee.employee_type },
          year,
          month,
          daysData,
          summary: {
            totalHours,
            daysWorked,
            absentDays,
            conflictDays,
            saturdayDays,
            totalOvertimeMinutes
          },
          turinovaLogoBase64,
          mode: 'official'
        })

        const pdfBuffer = await renderHtmlToPdfBuffer(browser, html)
        const safeName = sanitizeFilenamePart(employee.name)
        const filename = `Jelenleti-iv-${year}-${monthNameHu}-${safeName}.pdf`
        zip.file(filename, pdfBuffer)
        manifest.success.push({ employeeId, filename })
      } catch (e: any) {
        manifest.errors.push({ employeeId, error: e?.message || String(e) })
      }
    })

    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })

    const zipFilename = `Jelenleti-ivek-${year}-${monthNameHu}.zip`
    const encodedFilename = encodeURIComponent(zipFilename)

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': zipBuffer.length.toString()
      }
    })
  } catch (error: any) {
    console.error('Error generating bulk official attendance PDFs:', error)
    return NextResponse.json(
      {
        error: 'Hiba történt a hivatalos jelenléti ívek generálása során',
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}

