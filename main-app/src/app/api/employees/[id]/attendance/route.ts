import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/employees/[id]/attendance?year=2026&month=1
// Fetch attendance logs for a specific employee and month
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '2026')
    const month = parseInt(searchParams.get('month') || '1')

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    // Use optimized view instead of raw table - eliminates JavaScript processing
    const { data, error } = await supabase
      .from('attendance_daily_summary')
      .select('scan_date, latest_arrival_time, latest_departure_time, arrival_id, departure_id, arrival_manually_edited, departure_manually_edited')
      .eq('employee_id', id)
      .gte('scan_date', startDate)
      .lte('scan_date', endDate)
      .order('scan_date', { ascending: true })

    if (error) {
      console.error('Error fetching attendance logs:', error)
      return NextResponse.json({ error: 'Hiba történt a jelenléti adatok lekérdezése során' }, { status: 500 })
    }

    // Helper function to format time in UTC (avoid timezone issues)
    const formatTimeUTC = (isoString: string | null): string | null => {
      if (!isoString) return null
      const date = new Date(isoString)
      const hours = String(date.getUTCHours()).padStart(2, '0')
      const minutes = String(date.getUTCMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    // Convert view data to response format (already grouped by date)
    const result = (data || []).map((row) => ({
      date: row.scan_date,
      arrival: row.latest_arrival_time ? {
        id: row.arrival_id,
        time: formatTimeUTC(row.latest_arrival_time), // HH:MM format in UTC
        manually_edited: row.arrival_manually_edited || false
      } : null,
      departure: row.latest_departure_time ? {
        id: row.departure_id,
        time: formatTimeUTC(row.latest_departure_time), // HH:MM format in UTC
        manually_edited: row.departure_manually_edited || false
      } : null
    }))

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in attendance GET API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/employees/[id]/attendance
// Create or update attendance log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { date, scanType, time, locationId } = body

    if (!date || !scanType || !time || !locationId) {
      return NextResponse.json({ error: 'Hiányzó adatok' }, { status: 400 })
    }

    if (!['arrival', 'departure'].includes(scanType)) {
      return NextResponse.json({ error: 'Érvénytelen scan_type' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Combine date and time into a timestamp
    const scanTime = new Date(`${date}T${time}:00`).toISOString()

    // Check if a log already exists for this employee, location, date, and scan type
    // Prioritize manually edited logs, then latest by time
    const { data: existingLogs } = await supabase
      .from('attendance_logs')
      .select('id, manually_edited')
      .eq('employee_id', id)
      .eq('location_id', locationId)
      .eq('scan_date', date)
      .in('scan_type', scanType === 'arrival' ? ['arrival', 'arrival_pin'] : ['departure', 'departure_pin'])
      .order('manually_edited', { ascending: false })  // Prioritize manually edited logs first
      .order('scan_time', { ascending: false })  // Then by latest time
      .limit(1)

    if (existingLogs && existingLogs.length > 0) {
      // Update existing log (always take the latest)
      // Mark as manually_edited since this is a manual edit
      const { data, error } = await supabase
        .from('attendance_logs')
        .update({
          scan_time: scanTime,
          scan_type: scanType,
          manually_edited: true
        })
        .eq('id', existingLogs[0].id)
        .select()
        .single()

      if (error) {
        console.error('Error updating attendance log:', error)
        return NextResponse.json({ error: 'Hiba történt a jelenléti adat frissítése során' }, { status: 500 })
      }

      return NextResponse.json(data, { status: 200 })
    } else {
      // Create new log
      // Mark as manually_edited since this is a manual edit
      const { data, error } = await supabase
        .from('attendance_logs')
        .insert({
          employee_id: id,
          location_id: locationId,
          scan_time: scanTime,
          scan_type: scanType,
          pin_used: false,
          manually_edited: true
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating attendance log:', error)
        return NextResponse.json({ error: 'Hiba történt a jelenléti adat létrehozása során' }, { status: 500 })
      }

      return NextResponse.json(data, { status: 201 })
    }

  } catch (error) {
    console.error('Error in attendance POST API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/employees/[id]/attendance?logId=uuid
// Delete an attendance log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const logId = searchParams.get('logId')

    if (!logId) {
      return NextResponse.json({ error: 'Log ID megadása kötelező' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify the log belongs to this employee
    const { data: log } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('id', logId)
      .eq('employee_id', id)
      .single()

    if (!log) {
      return NextResponse.json({ error: 'Jelenléti adat nem található' }, { status: 404 })
    }

    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', logId)

    if (error) {
      console.error('Error deleting attendance log:', error)
      return NextResponse.json({ error: 'Hiba történt a jelenléti adat törlése során' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error) {
    console.error('Error in attendance DELETE API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
