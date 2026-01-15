import { getHolidayById } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import HolidayEditClient from './HolidayEditClient'

export default async function HolidayEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const initialHoliday = await getHolidayById(id)

  if (!initialHoliday) {
    notFound()
  }

  return <HolidayEditClient initialHoliday={initialHoliday} />
}
