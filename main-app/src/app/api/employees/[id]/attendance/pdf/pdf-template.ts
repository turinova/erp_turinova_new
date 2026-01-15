// Plain HTML template function for Attendance PDF (no React)

interface Employee {
  name: string
  employee_code: string
}

interface DayData {
  date: string
  dayOfMonth: number
  dayOfWeek: number
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
  hoursWorked: number
  isEmployeeHoliday: boolean
  holidayType: string | null
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
  }
  turinovaLogoBase64?: string
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

export default function generateAttendancePdfHtml({
  employee,
  year,
  month,
  daysData,
  summary,
  turinovaLogoBase64
}: AttendancePdfTemplateProps): string {
  const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
  const monthName = monthNames[month - 1]

  // Build table rows
  const tableRows = daysData.map(day => {
    const hasNoData = !day.arrival && !day.departure
    const isHoliday = day.isEmployeeHoliday
    const isSickLeave = day.holidayType === 'Betegszabadság'
    const hoursDisplay = isHoliday 
      ? (isSickLeave ? '<strong>BETEG SZABADSÁG</strong>' : '<strong>SZABADSÁG</strong>')
      : (day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(2)} óra` : '-')
    
    // Replace lunch break with "-" if no data, keep date as is
    const lunchDisplay = hasNoData ? '-' : formatLunchBreak(day.lunchStart, day.lunchEnd)
    
    return `
      <tr>
        <td>${formatDate(day.date, day.dayOfWeek)}</td>
        <td>${formatTime(day.arrival)}</td>
        <td>${lunchDisplay}</td>
        <td>${formatTime(day.departure)}</td>
        <td align="right">${hoursDisplay}</td>
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
      </div>

      <table>
        <thead>
          <tr>
            <th>Dátum</th>
            <th>Érkezés</th>
            <th>Munkaidő szünet</th>
            <th>Távozás</th>
            <th>Ledolgozott óra</th>
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
        <div class="summary-row">
          <span class="summary-label">Dolgozott napok:</span>
          <span style="font-size: 11px;">${summary.daysWorked} nap</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Távollét:</span>
          <span style="font-size: 11px;">${summary.absentDays} nap</span>
        </div>
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
