import { readFile } from 'fs/promises'
import { join } from 'path'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import JSZip from 'jszip'

import {
  getAttendanceLogsForMonth,
  getEmployeeById,
  getEmployeeHolidays,
  getHolidaysForDateRange
} from '@/lib/supabase-server'
import {
  computeAttendanceMetrics,
  computeEarlyOvertimeMinutes,
  computeOvertimeMinutes,
  earlyOvertimePolicyFromEmployeeRow,
  getPolicyDisplayRange
} from '@/components/attendance/attendanceUtils'
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
    if (employeeIds.length > 80) {
      return NextResponse.json({ error: 'Túl sok kiválasztott kolléga (max: 80)' }, { status: 400 })
    }

    assertValidMonthYear(year, month)

    const startDate = formatDateLocal(new Date(year, month - 1, 1))
    const endDate = formatDateLocal(new Date(year, month, 0))

    const [holidays, turinovaLogoBase64] = await Promise.all([
      getHolidaysForDateRange(startDate, endDate),
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then(buf => buf.toString('base64'))
        .catch(() => '')
    ])

    browser = await launchBrowser()

    const zip = new JSZip()
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
    const monthNameAscii = monthNamesAscii[month - 1]

    const manifest: {
      generatedAt: string
      year: number
      month: number
      requestedEmployeeIds: string[]
      success: Array<{ employeeId: string; filename: string }>
      errors: Array<{ employeeId: string; error: string }>
    } = {
      generatedAt: new Date().toISOString(),
      year,
      month,
      requestedEmployeeIds: employeeIds,
      success: [],
      errors: []
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

        const daysInMonth: Date[] = []
        const d = new Date(year, month - 1, 1)
        while (d.getMonth() === month - 1) {
          daysInMonth.push(new Date(d))
          d.setDate(d.getDate() + 1)
        }

        const earlyOtPolicy = earlyOvertimePolicyFromEmployeeRow(employee as Record<string, unknown>)

        const daysData = daysInMonth.map(day => {
          const yearLocal = day.getFullYear()
          const monthLocal = String(day.getMonth() + 1).padStart(2, '0')
          const dayLocal = String(day.getDate()).padStart(2, '0')
          const dateStr = `${yearLocal}-${monthLocal}-${dayLocal}`

          const dayLog = attendanceLogs.find((log: any) => log.date === dateStr)
          const empHoliday = employeeHolidays.find((h: any) => h.date === dateStr)

          const isHolidayDay = holidays.some(h => {
            const start = new Date(h.start_date)
            const end = new Date(h.end_date)
            const checkDate = new Date(dateStr)
            return checkDate >= start && checkDate <= end
          })

          const arrival = dayLog?.arrival?.time || null
          const departure = dayLog?.departure?.time || null
          const isEmpHoliday = !!empHoliday
          const isWeekendOff = day.getDay() === 0 || ((employee.works_on_saturday === false) && day.getDay() === 6)
          const hasAttendance = !!(arrival || departure)
          const hasCompleteAttendance = !!(arrival && departure)
          const isConflictHolidayWork = isEmpHoliday && hasAttendance
          const lunchStart = employee.lunch_break_start || null
          const lunchEnd = employee.lunch_break_end || null
          const shiftS = employee.shift_start_time ? String(employee.shift_start_time).slice(0, 5) : null
          const shiftE = employee.shift_end_time ? String(employee.shift_end_time).slice(0, 5) : null
          const policyRange = getPolicyDisplayRange(arrival, departure, shiftS, shiftE)
          const overtimeEnabled = employee.overtime_enabled === true
          const overtimeMinutes = computeOvertimeMinutes(arrival, departure, shiftS, shiftE, {
            enabled: overtimeEnabled,
            graceMinutes: Number.isFinite(employee.overtime_grace_minutes) ? Number(employee.overtime_grace_minutes) : 10,
            roundingMinutes: Number.isFinite(employee.overtime_rounding_minutes) ? Number(employee.overtime_rounding_minutes) : 15,
            roundingMode: ['floor', 'nearest', 'ceil'].includes(employee.overtime_rounding_mode)
              ? employee.overtime_rounding_mode
              : 'floor',
            dailyCapMinutes: Number.isFinite(employee.overtime_daily_cap_minutes) ? Number(employee.overtime_daily_cap_minutes) : 120,
            requiresCompleteDay: employee.overtime_requires_complete_day !== false
          })

          const earlyOvertimeMinutes = computeEarlyOvertimeMinutes(arrival, departure, shiftS, earlyOtPolicy)

          let hoursWorked = 0
          if (arrival && departure) {
            hoursWorked = computeAttendanceMetrics(arrival, departure, lunchStart, lunchEnd, shiftS, shiftE).paidHours
          }

          return {
            date: dateStr,
            dayOfMonth: day.getDate(),
            dayOfWeek: day.getDay(),
            arrival,
            departure,
            displayArrival: policyRange ? policyRange.start : arrival,
            displayDeparture: policyRange ? policyRange.end : departure,
            lunchStart,
            lunchEnd,
            hoursWorked,
            overtimeMinutes,
            earlyOvertimeMinutes,
            hasAttendance,
            hasCompleteAttendance,
            isEmployeeHoliday: isEmpHoliday,
            holidayType: empHoliday?.type || null,
            isConflictHolidayWork,
            isGlobalHoliday: isHolidayDay,
            isDisabled: isWeekendOff || isHolidayDay || isEmpHoliday
          }
        })

        const conflictDays = daysData.filter(day => day.isConflictHolidayWork).length
        const saturdayDays = daysData.filter(day => day.dayOfWeek === 6 && day.hasCompleteAttendance).length

        // Bulk export is always papír nézet — 8 órás normál keret + túlóra összesítő (paperBulkEightHourDisplay).
        const totalHours = daysData.reduce((sum, day) => {
          if (day.dayOfWeek === 6) return sum
          if (day.isEmployeeHoliday) return sum
          return sum + Math.min(day.hoursWorked, 8)
        }, 0)
        const policyOtMinutes = daysData.reduce(
          (s, d) => s + d.overtimeMinutes + (d.earlyOvertimeMinutes ?? 0),
          0
        )
        const excessOver8Minutes = daysData.reduce((sum, day) => {
          if (day.dayOfWeek === 6) return sum
          if (day.isEmployeeHoliday) return sum
          const excessH = Math.max(0, day.hoursWorked - 8)
          return sum + Math.round(excessH * 60)
        }, 0)
        const totalOvertimeMinutes = policyOtMinutes + excessOver8Minutes
        const daysWorked = daysData.filter(day => day.hasCompleteAttendance && !day.isEmployeeHoliday && !day.isGlobalHoliday).length
        const absentDays = daysData.filter(day => day.isEmployeeHoliday).length

        const html = generateAttendancePdfHtml({
          employee: { name: employee.name, employee_code: employee.employee_code },
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
          mode: 'paper',
          paperBulkEightHourDisplay: true
        })

        const pdfBuffer = await renderHtmlToPdfBuffer(browser, html)

        const safeName = sanitizeFilenamePart(employee.name)
        const filename = `Jelenleti-iv-${safeName}-${year}-${monthNameAscii}.pdf`
        zip.file(filename, pdfBuffer)
        manifest.success.push({ employeeId, filename })
      } catch (e: any) {
        manifest.errors.push({ employeeId, error: e?.message || String(e) })
      }
    })

    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })

    const zipFilename = `Jelenleti-ivek-${year}-${monthNameAscii}.zip`
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
    console.error('Error generating bulk attendance PDFs:', error)
    return NextResponse.json(
      {
        error: 'Hiba történt a tömeges PDF generálása során',
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

