import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// DELETE /api/employees/[id]/holidays/[holiday_id] - Delete employee holiday
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; holiday_id: string }> }
) {
  try {
    const resolvedParams = await params
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

    const { error } = await supabase
      .from('employee_holidays')
      .delete()
      .eq('id', resolvedParams.holiday_id)
      .eq('employee_id', resolvedParams.id)

    if (error) {
      console.error('Error deleting employee holiday:', error)
      return NextResponse.json({ error: 'Hiba történt a szabadság törlése során' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in employee holiday DELETE API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
