'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

const MONTH_NAMES = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december'
]

export function BelepokMonthStepper({
  year,
  month,
  minYear = 2026,
  minMonth = 1
}: {
  year: number
  month: number
  minYear?: number
  minMonth?: number
}) {
  const router = useRouter()

  const now = new Date()
  const maxYear = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric'
    }).format(now)
  )
  const maxMonth = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      month: 'numeric'
    }).format(now)
  )

  const atMin = year < minYear || (year === minYear && month <= minMonth)
  const atMax = year > maxYear || (year === maxYear && month >= maxMonth)

  function go(nextYear: number, nextMonth: number) {
    const params = new URLSearchParams()
    params.set('year', String(nextYear))
    params.set('month', String(nextMonth))
    router.push(`/belepok?${params.toString()}`)
  }

  function prev() {
    if (atMin) return
    if (month === 1) go(year - 1, 12)
    else go(year, month - 1)
  }

  function next() {
    if (atMax) return
    if (month === 12) go(year + 1, 1)
    else go(year, month + 1)
  }

  const label = `${year}. ${MONTH_NAMES[month - 1]}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-body font-semibold text-ink">Havi belépők</h2>
        <p className="text-hint text-ink-secondary">{label}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Előző hónap"
          disabled={atMin}
          onClick={prev}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Következő hónap"
          disabled={atMax}
          onClick={next}
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
