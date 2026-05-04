// Plain HTML template function for Attendance PDF (no React)

interface Employee {
  name: string
  employee_code: string
  employee_type?: string | null
}

interface DayData {
  date: string
  dayOfMonth: number
  dayOfWeek: number
  arrival: string | null
  departure: string | null
  displayArrival: string | null
  displayDeparture: string | null
  lunchStart: string | null
  lunchEnd: string | null
  hoursWorked: number
  overtimeMinutes: number
  /** Pre-shift (műszak előtti) túlóra, perc */
  earlyOvertimeMinutes?: number
  hasAttendance: boolean
  hasCompleteAttendance: boolean
  isEmployeeHoliday: boolean
  holidayType: string | null
  isConflictHolidayWork: boolean
  isGlobalHoliday: boolean
  isDisabled: boolean
}

interface AttendancePdfTemplateProps {
  employee: Employee
  year: number
  month: number
  daysData: DayData[]
  summary: {
    totalHours: number
    daysWorked: number
    absentDays: number
    conflictDays: number
    saturdayDays?: number
    totalOvertimeMinutes: number
  }
  turinovaLogoBase64?: string
  mode?: 'paper' | 'actual' | 'official'
  /**
   * Tömeges papír PDF: napi max. 8 óra „ledolgozott”, a feletti + szabály szerinti túlóra a „+” részben;
   * havi összesítő a `summary` mezőkből (bulk route számolja).
   */
  paperBulkEightHourDisplay?: boolean
}

// Format date as "MM.DD DayName"
const formatDate = (dateStr: string, dayOfWeek: number): string => {
  const dayNames = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dayName = dayNames[dayOfWeek]
  
  return `${month}.${day} ${dayName}`
}

// Format time as "HH:MM"
const formatTime = (time: string | null): string => {
  if (!time) return '-'
  return time
}

// Format lunch break as "HH:MM - HH:MM"
const formatLunchBreak = (start: string | null, end: string | null): string => {
  if (!start || !end) return '-'
  return `${start} - ${end}`
}

// Escape HTML to prevent XSS
const escapeHtml = (text: string | null | undefined) => {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Papír nézet: a ledolgozott óra cellában feltünteti a napi túlórát (késő + előtti), ha > 0. */
function appendPaperOvertimeToHoursDisplay(hoursDisplay: string, totalOvertimeMinutes: number): string {
  if (totalOvertimeMinutes <= 0) return hoursDisplay
  const otHours = (totalOvertimeMinutes / 60).toFixed(2)
  return `${hoursDisplay} + ${otHours} óra`
}

/** Tömeges papír: max. 8 óra normál; a feletti ledolgozott + műszak előtti/utáni perc órában a „+” részben. */
function formatBulkPaperEightHourHoursCell(day: DayData): string {
  const hw = Number(day.hoursWorked) || 0
  const polMin = (Number(day.overtimeMinutes) || 0) + (Number(day.earlyOvertimeMinutes) || 0)
  const excessH = Math.max(0, hw - 8)
  const plusH = excessH + polMin / 60
  const capH = Math.min(hw, 8)

  if (hw <= 0 && polMin <= 0) return '-'
  if (plusH <= 0) return hw > 0 ? `${hw.toFixed(2)} óra` : '-'
  return `${capH.toFixed(2)} óra + ${plusH.toFixed(2)} óra`
}

function employeeTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'BOLTI_DOLGOZO':
      return 'Bolti Dolgozó'
    case 'LAPSZABASZ':
      return 'Lapszabász'
    case 'ELZARO':
      return 'Élzáró'
    case 'ASZTALOS':
      return 'Asztalos'
    case 'IRODA':
      return 'Iroda'
    case 'MUHELY':
    default:
      return 'Műhely'
  }
}

export default function generateAttendancePdfHtml({
  employee,
  year,
  month,
  daysData,
  summary,
  turinovaLogoBase64,
  mode = 'paper',
  paperBulkEightHourDisplay = false
}: AttendancePdfTemplateProps): string {
  const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
  const monthName = monthNames[month - 1]

  const viewLabel = mode === 'paper' ? 'Papír nézet' : mode === 'official' ? 'Hivatalos jelenléti ív' : 'Tényleges nézet'

  // Build table rows
  const tableRows = daysData.map(day => {
    const totalOvertimeMinutes = day.overtimeMinutes + (day.earlyOvertimeMinutes ?? 0)
    const hasNoData = !day.arrival && !day.departure
    const isHoliday = day.isEmployeeHoliday
    const isSickLeave = day.holidayType === 'Betegszabadság'
    const isConflict = day.isConflictHolidayWork
    const isSaturday = day.dayOfWeek === 6
    
    let statusDisplay = '-'
    if (mode === 'official') {
      // Official/legal sheet:
      // - Holidays/leave always shown as leave (0h), even if there was real attendance.
      // - Uses generated "official" times (arrival/departure) directly.
      if (isSaturday) statusDisplay = day.hoursWorked > 0 ? 'SZOMBATI MUNKA' : '-'
      else if (day.isGlobalHoliday) statusDisplay = 'MUNKASZÜNET'
      else if (isHoliday) statusDisplay = isSickLeave ? 'BETEGSZABADSÁG' : 'SZABADSÁG'
      else if (day.hasAttendance && !day.hasCompleteAttendance) statusDisplay = 'HIÁNYOS'
      else if (day.hasCompleteAttendance) statusDisplay = 'MUNKA'
    } else if (mode === 'paper') {
      // Saturday: keep holiday labels ONLY when there is no work logged.
      // - If worked (complete): SZOMBATI MUNKA
      // - If partial log: SZOMBAT
      // - If no log: preserve MUNKASZÜNET / SZABADSÁG / BETEGSZABADSÁG, otherwise "-"
      if (isSaturday) {
        if (day.hasCompleteAttendance) statusDisplay = 'SZOMBATI MUNKA'
        else if (!hasNoData) statusDisplay = 'SZOMBAT'
        else if (day.isGlobalHoliday) statusDisplay = 'MUNKASZÜNET'
        else if (isHoliday) statusDisplay = isSickLeave ? 'BETEGSZABADSÁG' : 'SZABADSÁG'
        else statusDisplay = '-'
      }
      else if (isConflict) statusDisplay = isSickLeave ? 'BETEGSZABADSÁG + MUNKA' : 'SZABADSÁG + MUNKA'
      else if (isHoliday) statusDisplay = isSickLeave ? 'BETEGSZABADSÁG' : 'SZABADSÁG'
      else if (day.isGlobalHoliday) statusDisplay = 'MUNKASZÜNET'
      else if (day.hasAttendance && !day.hasCompleteAttendance) statusDisplay = 'HIÁNYOS'
      else if (day.hasCompleteAttendance) statusDisplay = 'MUNKA'
    } else {
      if (isSaturday) {
        if (day.hasCompleteAttendance) statusDisplay = 'SZOMBATI MUNKA'
        else if (!hasNoData) statusDisplay = 'SZOMBAT'
        else if (day.isGlobalHoliday) statusDisplay = 'MUNKASZÜNET'
        else if (isHoliday) statusDisplay = isSickLeave ? 'BETEGSZABADSÁG' : 'SZABADSÁG'
        else statusDisplay = '-'
      }
      else if (isConflict) statusDisplay = 'SZABADSÁG + MUNKA'
      else if (isHoliday) statusDisplay = isSickLeave ? 'BETEGSZABADSÁG' : 'SZABADSÁG'
      else if (day.isGlobalHoliday && day.hasAttendance) statusDisplay = 'MUNKASZÜNET + MUNKA'
      else if (day.isGlobalHoliday) statusDisplay = 'MUNKASZÜNET'
      else if (day.hasAttendance && !day.hasCompleteAttendance) statusDisplay = 'HIÁNYOS'
      else if (day.hasCompleteAttendance) statusDisplay = 'MUNKA'
    }
    
    // Determine what to display based on mode
    let arrivalDisplay: string
    let departureDisplay: string
    let lunchDisplay: string
    let hoursDisplay: string
    let overtimeDisplay: string
    
    if (mode === 'official') {
      if (day.isGlobalHoliday || isHoliday) {
        arrivalDisplay = '-'
        departureDisplay = '-'
        lunchDisplay = '-'
        if (day.isGlobalHoliday) hoursDisplay = '<strong>MUNKASZÜNET</strong>'
        else hoursDisplay = isSickLeave ? '<strong>BETEG SZABADSÁG</strong>' : '<strong>SZABADSÁG</strong>'
        overtimeDisplay = '-'
      } else {
        arrivalDisplay = formatTime(day.arrival)
        departureDisplay = formatTime(day.departure)
        lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
        hoursDisplay = day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)} óra` : '-'
        overtimeDisplay = '-'
      }
    } else if (mode === 'paper') {
      if (isSaturday) {
        // Saturday: show times (if any). Ledolgozott óra a cellában (havi összesítő továbbra is kizárja a szombatot).
        // Paper view must show raw recorded times (not policy-clipped display times).
        arrivalDisplay = formatTime(day.arrival)
        departureDisplay = formatTime(day.departure)
        lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
        hoursDisplay = day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)} óra` : '-'
        overtimeDisplay = '-'
      } else if (isHoliday && day.hoursWorked > 0) {
        // Paper mode: employee holiday with work (conflict) should show the work, but keep the holiday context.
        // Paper view must show raw recorded times (not policy-clipped display times).
        arrivalDisplay = formatTime(day.arrival)
        departureDisplay = formatTime(day.departure)
        lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
        const holidayLabel = isSickLeave ? 'BETEG SZABADSÁG' : 'SZABADSÁG'
        hoursDisplay = `${day.hoursWorked.toFixed(2)} óra <span style="font-size: 0.75em; color: #666; font-style: italic;">(${holidayLabel})</span>`
        overtimeDisplay = '-'
      } else if (isHoliday) {
        // Paper mode: hide attendance details for employee holiday days
        arrivalDisplay = '-'
        departureDisplay = '-'
        lunchDisplay = '-'
        hoursDisplay = isSickLeave ? '<strong>BETEG SZABADSÁG</strong>' : '<strong>SZABADSÁG</strong>'
        overtimeDisplay = '-'
      } else {
        // Not a holiday: show normal data
        // Paper view must show raw recorded times (not policy-clipped display times).
        arrivalDisplay = formatTime(day.arrival)
        departureDisplay = formatTime(day.departure)
        lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
        hoursDisplay = day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)} óra` : '-'
        overtimeDisplay = '-'
      }

      if (paperBulkEightHourDisplay) {
        const strongLeave = hoursDisplay.includes('<strong>')
        if (!strongLeave) {
          // Csak hétközi „szabadság + munka” ág illeszkedik a (SZABADSÁG) címkéhez; szombat külön ág.
          if (isHoliday && day.hoursWorked > 0 && !isSaturday) {
            const holidayLabel = isSickLeave ? 'BETEG SZABADSÁG' : 'SZABADSÁG'
            const core = formatBulkPaperEightHourHoursCell(day)
            hoursDisplay = `${core} <span style="font-size: 0.75em; color: #666; font-style: italic;">(${holidayLabel})</span>`
          } else {
            hoursDisplay = formatBulkPaperEightHourHoursCell(day)
          }
        }
      } else {
        hoursDisplay = appendPaperOvertimeToHoursDisplay(hoursDisplay, totalOvertimeMinutes)
      }
    } else {
      // Actual mode: show all real data, including holiday-work conflicts
      if (isHoliday && day.hoursWorked > 0) {
        // Holiday with work: show times and hours with badge
        arrivalDisplay = formatTime(day.displayArrival)
        departureDisplay = formatTime(day.displayDeparture)
        lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
        const holidayLabel = isSickLeave ? 'BETEG SZABADSÁG' : 'SZABADSÁG'
        hoursDisplay = `${day.hoursWorked.toFixed(2)} óra <span style="font-size: 0.75em; color: #666; font-style: italic;">(${holidayLabel})</span>`
        overtimeDisplay = totalOvertimeMinutes > 0 ? `${(totalOvertimeMinutes / 60).toFixed(2)} óra` : '-'
      } else if (isHoliday && !day.arrival && !day.departure) {
        // Holiday with no work: show "-" for times, "SZABADSÁG" for hours
        arrivalDisplay = '-'
        departureDisplay = '-'
        lunchDisplay = '-'
        hoursDisplay = isSickLeave ? '<strong>BETEG SZABADSÁG</strong>' : '<strong>SZABADSÁG</strong>'
        overtimeDisplay = '-'
      } else {
        // Normal day: show all data
        arrivalDisplay = formatTime(day.displayArrival)
        departureDisplay = formatTime(day.displayDeparture)
        lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
        hoursDisplay = day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)} óra` : '-'
        overtimeDisplay = totalOvertimeMinutes > 0 ? `${(totalOvertimeMinutes / 60).toFixed(2)} óra` : '-'
      }
    }
    
    return `
      <tr>
        <td>${formatDate(day.date, day.dayOfWeek)}</td>
        <td>${arrivalDisplay}</td>
        <td>${lunchDisplay}</td>
        <td>${departureDisplay}</td>
        <td>${statusDisplay}</td>
        <td align="right">${hoursDisplay}</td>
        ${mode === 'actual' ? `<td align="right">${overtimeDisplay}</td>` : ''}
      </tr>
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      @page {
        margin: 0;
        size: A4;
      }
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 9px;
        color: #212121;
        background: white;
        padding: 6mm 4mm 6mm 4mm;
        line-height: 1.1;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .paper-badge {
        position: fixed;
        top: 6mm;
        right: 4mm;
        z-index: 9999;
        border: 2px solid #000000;
        border-radius: 6px;
        padding: 3px 6px;
        background: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .paper-badge__monogram {
        width: 18px;
        height: 18px;
        border: 2px solid #000000;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 12px;
        line-height: 1;
        color: #000000;
      }
      .paper-badge__text {
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #000000;
        white-space: nowrap;
      }
      .content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 12mm);
      }
      .header {
        margin-bottom: 0.6em;
        text-align: center;
      }
      .title {
        font-size: 16px;
        font-weight: 700;
        color: #212121;
        margin-bottom: 0.2em;
      }
      .month-name {
        font-size: 12px;
        font-weight: 600;
        color: #424242;
        margin-bottom: 0.6em;
      }
      .employee-info {
        margin-bottom: 0.6em;
        font-size: 13px;
        border: 1px solid #000000;
        padding: 8px 10px;
        background-color: #f9f9f9;
      }
      .employee-info-row {
        margin-bottom: 0.15em;
      }
      .employee-label {
        font-weight: 600;
        display: inline-block;
        width: 140px;
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 0.8em;
        font-size: 8px;
      }
      th {
        background-color: #f5f5f5;
        border: 1px solid #000000;
        padding: 5px 6px;
        text-align: left;
        font-weight: 600;
        font-size: 8px;
      }
      th:last-child {
        text-align: right;
      }
      td {
        border: 1px solid #000000;
        padding: 6px 6px;
        font-size: 8px;
        line-height: 1.4;
      }
      td:last-child {
        text-align: right;
      }
      .summary-section {
        margin-top: 0.6em;
        margin-bottom: 0.6em;
        font-size: 11px;
        border: 1px solid #000000;
        padding: 8px 10px;
        background-color: #f9f9f9;
      }
      .summary-row {
        margin-bottom: 0.3em;
      }
      .summary-row:last-child {
        margin-bottom: 0;
      }
      .summary-label {
        font-weight: 600;
        display: inline-block;
        width: 130px;
        font-size: 11px;
      }
      .signature-section {
        margin-top: auto;
        margin-bottom: 0.5em;
        display: flex;
        justify-content: flex-end;
        align-items: flex-end;
      }
      .signature-box {
        text-align: center;
        width: 180px;
      }
      .signature-line {
        border-bottom: 1px dotted #000000;
        margin-bottom: 0.3em;
        height: 28px;
      }
      .signature-label {
        font-size: 11px;
        font-weight: 500;
      }
      .footer {
        margin-top: auto;
        padding-top: 0.6em;
        border-top: 1px solid #000000;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8px;
        color: #666666;
      }
      .footer-text {
        flex: 1;
      }
      .footer-logo {
        height: 16px;
        width: auto;
        margin-left: 0.8em;
      }
    </style>
  </head>
  <body>
    ${mode === 'paper' ? `
    <div class="paper-badge" aria-hidden="true">
      <div class="paper-badge__monogram">P</div>
      <div class="paper-badge__text">PAPÍR NÉZET</div>
    </div>
    ` : ''}
    <div class="content-wrapper">
      <div class="header">
        <div class="title">Jelenléti ív</div>
        <div class="month-name">${year} ${monthName}</div>
      </div>

      <div class="employee-info">
        <div class="employee-info-row">
          <span class="employee-label">Munkavállaló neve:</span>
          <span style="font-size: 13px;">${escapeHtml(employee.name)}</span>
        </div>
        ${mode === 'official' ? `
        <div class="employee-info-row">
          <span class="employee-label">Munkakör:</span>
          <span style="font-size: 13px;">${escapeHtml(employeeTypeLabel(employee.employee_type))}</span>
        </div>
        ` : `
        <div class="employee-info-row">
          <span class="employee-label">Nézet:</span>
          <span style="font-size: 13px;">${viewLabel}</span>
        </div>
        `}
      </div>

      <table>
        <thead>
          <tr>
            <th>Dátum</th>
            <th>Érkezés</th>
            <th>Munkaidő szünet</th>
            <th>Távozás</th>
            <th>Státusz</th>
            <th>Ledolgozott óra</th>
            ${mode === 'actual' ? '<th>Túlóra</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="summary-section">
        <div class="summary-row">
          <span class="summary-label">Összes dolgozott óra:</span>
          <span style="font-size: 11px;">${summary.totalHours.toFixed(2)} óra</span>
        </div>
        ${mode === 'paper' ? `
        <div class="summary-row">
          <span class="summary-label">Szombati napok:</span>
          <span style="font-size: 11px;">${Number(summary.saturdayDays || 0)} nap</span>
        </div>
        ` : ''}
        <div class="summary-row">
          <span class="summary-label">Dolgozott napok:</span>
          <span style="font-size: 11px;">${summary.daysWorked} nap</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Távollét:</span>
          <span style="font-size: 11px;">${summary.absentDays} nap</span>
        </div>
        ${(mode === 'actual' || mode === 'paper') ? `
        <div class="summary-row">
          <span class="summary-label">Szabadság + munka:</span>
          <span style="font-size: 11px;">${summary.conflictDays} nap</span>
        </div>
        ` : ''}
        ${mode === 'actual' || mode === 'paper' ? `
        <div class="summary-row">
          <span class="summary-label">Összes túlóra:</span>
          <span style="font-size: 11px;">${(summary.totalOvertimeMinutes / 60).toFixed(2)} óra</span>
        </div>
        ` : ''}
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Engedélyező Aláírása</div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-text">
          Ez az dokumentum a Turinova belső irányítási rendszerrel készült.
        </div>
        ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
      </div>
    </div>
  </body>
</html>`
}
