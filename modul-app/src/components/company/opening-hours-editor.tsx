'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DAY_KEYS,
  DAY_LABEL,
  type DayKey,
  type OpeningHoursDraft
} from '@/lib/opening-hours'
import { cn } from '@/lib/utils'

const WEEKDAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

export function OpeningHoursEditor({
  draft,
  onChange,
  note,
  onNoteChange,
  errors,
  disabled
}: {
  draft: OpeningHoursDraft
  onChange: (next: OpeningHoursDraft) => void
  note: string
  onNoteChange: (next: string) => void
  errors: Partial<Record<DayKey, string>>
  disabled: boolean
}) {
  function patch(day: DayKey, value: Partial<OpeningHoursDraft[DayKey]>) {
    onChange({ ...draft, [day]: { ...draft[day], ...value } })
  }

  function copyMondayToWeekdays() {
    const next = { ...draft }
    for (const day of WEEKDAYS) next[day] = { ...draft.mon }
    onChange(next)
  }

  return (
    <div className="max-w-xl space-y-3">
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-body">
          <thead className="bg-subtle text-[12px] text-ink-secondary">
            <tr>
              <th className="h-8 px-3 text-left font-medium">Nap</th>
              <th className="h-8 px-3 text-left font-medium">Nyitva</th>
              <th className="h-8 px-3 text-left font-medium">Nyitás</th>
              <th className="h-8 px-3 text-left font-medium">Zárás</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DAY_KEYS.map((day) => {
              const d = draft[day]
              const error = errors[day]
              return (
                <tr key={day} className={cn(error && 'bg-danger-soft/40')}>
                  <td className="h-10 px-3 font-medium text-ink">
                    {DAY_LABEL[day]}
                    {error ? (
                      <p className="text-hint font-normal text-danger-ink" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3">
                    <label className="inline-flex items-center gap-2 text-ink">
                      <input
                        type="checkbox"
                        className="size-4 accent-ink"
                        checked={!d.closed}
                        disabled={disabled}
                        onChange={(e) => patch(day, { closed: !e.target.checked })}
                      />
                      {d.closed ? 'Zárva' : 'Nyitva'}
                    </label>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      type="time"
                      aria-label={`${DAY_LABEL[day]} nyitás`}
                      value={d.from}
                      disabled={disabled || d.closed}
                      onChange={(e) => patch(day, { from: e.target.value })}
                      className="w-28"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      type="time"
                      aria-label={`${DAY_LABEL[day]} zárás`}
                      value={d.to}
                      disabled={disabled || d.closed}
                      onChange={(e) => patch(day, { to: e.target.value })}
                      className="w-28"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={copyMondayToWeekdays}
        className="text-hint font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
      >
        Hétfő beállítása keddtől péntekig is
      </button>

      <div className="space-y-1">
        <label
          htmlFor="company-opening-note"
          className="block text-hint text-ink-secondary"
        >
          Ünnepi / rendkívüli nyitvatartás (nem kötelező)
        </label>
        <Textarea
          id="company-opening-note"
          value={note}
          maxLength={300}
          rows={2}
          disabled={disabled}
          placeholder="pl. December 24. – január 2. zárva."
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
    </div>
  )
}
