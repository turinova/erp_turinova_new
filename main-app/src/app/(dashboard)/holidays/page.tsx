import { getAllHolidays } from '@/lib/supabase-server'
import HolidaysList from './HolidaysList'

export default async function HolidaysPage() {
  const initialHolidays = await getAllHolidays()

  return <HolidaysList initialHolidays={initialHolidays} />
}
