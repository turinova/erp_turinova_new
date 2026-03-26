import { readFile } from 'fs/promises'

import { join } from 'path'

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'


import { getEmployeeById, getAttendanceLogsForMonth, getHolidaysForDateRange, getEmployeeHolidays } from '@/lib/supabase-server'
import { computeAttendanceMetrics, computeOvertimeMinutes, getPolicyDisplayRange } from '@/components/attendance/attendanceUtils'
import generateAttendancePdfHtml from './pdf-template'

// Dynamic imports based on environment
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const modeRaw = searchParams.get('mode') || 'paper'
    const mode = modeRaw === 'holiday' ? 'paper' : modeRaw === 'work' ? 'actual' : modeRaw // backward compatibility

    if (!id) {
      return NextResponse.json({ error: 'Érvénytelen alkalmazott azonosító' }, { status: 400 })
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Érvénytelen év paraméter' }, { status: 400 })
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Érvénytelen hónap paraméter' }, { status: 400 })
    }
    if (mode !== 'paper' && mode !== 'actual') {
      return NextResponse.json({ error: 'Érvénytelen mód. Használja: paper | actual' }, { status: 400 })
    }

    // Fetch employee data
    const employee = await getEmployeeById(id)

    if (!employee) {
      return NextResponse.json({ error: 'Alkalmazott nem található' }, { status: 404 })
    }

    // Calculate date range for the month
    // month is 1-indexed (1 = January), so month - 1 is 0-indexed for Date constructor
    const startDate = formatDateLocal(new Date(year, month - 1, 1))

    // new Date(year, month, 0) gives last day of previous month, so with 1-indexed month, this gives last day of current month
    const endDate = formatDateLocal(new Date(year, month, 0))

    // Fetch attendance logs, holidays, and employee holidays in parallel
    const [attendanceLogs, holidays, employeeHolidays] = await Promise.all([
      getAttendanceLogsForMonth(id, year, month),
      getHolidaysForDateRange(startDate, endDate),
      getEmployeeHolidays(id, year, month)
    ])

    // Get all days in the month
    const daysInMonth: Date[] = []
    const date = new Date(year, month - 1, 1)

    while (date.getMonth() === month - 1) {
      daysInMonth.push(new Date(date))
      date.setDate(date.getDate() + 1)
    }

    // Process days data
    const daysData = daysInMonth.map(day => {
      // Use local date string instead of ISO to avoid timezone issues
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
        roundingMode: ['floor', 'nearest', 'ceil'].includes(employee.overtime_rounding_mode) ? employee.overtime_rounding_mode : 'floor',
        dailyCapMinutes: Number.isFinite(employee.overtime_daily_cap_minutes) ? Number(employee.overtime_daily_cap_minutes) : 120,
        requiresCompleteDay: employee.overtime_requires_complete_day !== false
      })

      // Fizetett óra: műszakhoz képest (ugyanaz a logika, mint a jelenlét nézetben)
      let hoursWorked = 0

      if (arrival && departure) {
        hoursWorked = computeAttendanceMetrics(arrival, departure, lunchStart, lunchEnd, shiftS, shiftE).paidHours
      }

      return {
        date: dateStr,
        dayOfMonth: day.getDate(),
        dayOfWeek: day.getDay(), // 0 = Sunday, 6 = Saturday
        arrival,
        departure,
        displayArrival: policyRange ? policyRange.start : arrival,
        displayDeparture: policyRange ? policyRange.end : departure,
        lunchStart,
        lunchEnd,
        hoursWorked,
        overtimeMinutes,
        hasAttendance,
        hasCompleteAttendance,
        isEmployeeHoliday: isEmpHoliday,
        holidayType: empHoliday?.type || null,
        isConflictHolidayWork,
        isGlobalHoliday: isHolidayDay,
        isDisabled: isWeekendOff || isHolidayDay || isEmpHoliday
      }
    })

    // Calculate summary statistics based on mode
    let totalHours: number
    let daysWorked: number
    let absentDays: number
    let totalOvertimeMinutes: number
    const conflictDays = daysData.filter(day => day.isConflictHolidayWork).length
    
    if (mode === 'paper') {
      // Paper mode: holiday days are treated as leave even if attendance exists
      totalHours = daysData.reduce((sum, day) => {
        return sum + (day.isEmployeeHoliday ? 0 : day.hoursWorked)
      }, 0)
      totalOvertimeMinutes = 0
      daysWorked = daysData.filter(day => day.hasCompleteAttendance && !day.isEmployeeHoliday && !day.isGlobalHoliday).length
      absentDays = daysData.filter(day => day.isEmployeeHoliday).length
    } else {
      // Actual mode: count all real worked hours/days, including attendance on holidays
      totalHours = daysData.reduce((sum, day) => sum + day.hoursWorked, 0)
      totalOvertimeMinutes = daysData.reduce((sum, day) => sum + day.overtimeMinutes, 0)
      daysWorked = daysData.filter(day => day.hasCompleteAttendance).length

      // Count holidays that don't have attendance as absent
      absentDays = daysData.filter(day => day.isEmployeeHoliday && !day.hasAttendance).length
    }

    // Fetch Turinova logo
    const turinovaLogoBase64 = await readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
      .then(buf => buf.toString('base64'))
      .catch(() => {
        console.warn('Could not load Turinova logo file')
        
return ''
      })

    // Generate HTML string
    const fullHtml = generateAttendancePdfHtml({
      employee: {
        name: employee.name,
        employee_code: employee.employee_code
      },
      year,
      month,
      daysData,
      summary: {
        totalHours,
        daysWorked,
        absentDays,
        conflictDays,
        totalOvertimeMinutes
      },
      turinovaLogoBase64,
      mode: mode as 'paper' | 'actual'
    })

    // Launch Puppeteer
    let browser
    
    if (isProduction) {
      // Production: Use puppeteer-core with Vercel-optimized Chromium
      const puppeteerCore = await import('puppeteer-core')
      const chromium = await import('@sparticuz/chromium')
      
      browser = await puppeteerCore.default.launch({
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
          '--use-mock-keychain',
        ],
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      })
    } else {
      // Development: Use puppeteer (includes bundled Chromium)
      const puppeteer = await import('puppeteer')
      
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-sandbox',
        ],
      })
    }

    const page = await browser.newPage()
    
    // Disable unnecessary features for better performance
    await page.setJavaScriptEnabled(false)
    
    // Block all network requests (images are already base64 embedded)
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      req.abort()
    })
    
    // Set content and wait for rendering
    await page.setContent(fullHtml, {
      waitUntil: 'domcontentloaded'
    })
    
    // Small delay for images to render
    await new Promise(resolve => setTimeout(resolve, 50))

    // Generate PDF with optimized settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1,
      margin: {
        top: '8mm',
        right: '4mm',
        bottom: '8mm',
        left: '4mm'
      }
    })

    await browser.close()

    // Return PDF
    // Sanitize filename by removing special characters and using ASCII-safe version
    const sanitizedName = employee.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')

    // Use ASCII-safe month name for filename
    const monthNamesAscii = ['Januar', 'Februar', 'Marcius', 'Aprilis', 'Majus', 'Junius', 'Julius', 'Augusztus', 'Szeptember', 'Oktober', 'November', 'December']
    const monthNameAscii = monthNamesAscii[month - 1]
    const filename = `Jelenleti-iv-${sanitizedName}-${year}-${monthNameAscii}.pdf`

    // RFC 5987 encoded filename for proper UTF-8 support
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error generating attendance PDF:', error)
    console.error('Error stack:', error.stack)
    
return NextResponse.json({ 
      error: 'Hiba történt a PDF generálása során',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
