'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { saveFootcounterOpenHoursAction } from '@/lib/footcounter/actions'
import {
  formatHoursLabel,
  type FootcounterOpenHours
} from '@/lib/footcounter/open-hours'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h)

export function BelepokOpenHoursSettings({
  initial
}: {
  initial: FootcounterOpenHours
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [weekdayOpen, setWeekdayOpen] = useState(initial.weekdayOpen)
  const [weekdayClose, setWeekdayClose] = useState(initial.weekdayClose)
  const [saturdayOn, setSaturdayOn] = useState(
    initial.saturdayOpen != null && initial.saturdayClose != null
  )
  const [saturdayOpenHour, setSaturdayOpenHour] = useState(
    initial.saturdayOpen ?? 8
  )
  const [saturdayCloseHour, setSaturdayCloseHour] = useState(
    initial.saturdayClose ?? 12
  )

  function onSave() {
    startTransition(async () => {
      const res = await saveFootcounterOpenHoursAction({
        weekdayOpen,
        weekdayClose,
        saturdayOpen: saturdayOn,
        saturdayOpenHour,
        saturdayCloseHour
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success('Nyitvatartás mentve.')
      setOpen(false)
      router.refresh()
    })
  }

  const summary = saturdayOn
    ? `H–P ${formatHoursLabel(initial.weekdayOpen, initial.weekdayClose)} · Szo ${formatHoursLabel(initial.saturdayOpen ?? 8, initial.saturdayClose ?? 12)}`
    : `H–P ${formatHoursLabel(initial.weekdayOpen, initial.weekdayClose)} · Szo zárva`

  return (
    <section className="rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-ink">Nyitvatartás</p>
          <p className="text-[11.5px] text-ink-secondary">
            Chart és KPI csak ebben az időben · {summary}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Bezár' : 'Beállítás'}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fc-weekday-open">Hétköznap nyitás</Label>
              <Select
                id="fc-weekday-open"
                value={String(weekdayOpen)}
                onChange={(e) => setWeekdayOpen(Number(e.target.value))}
                disabled={pending}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-weekday-close">Hétköznap zárás</Label>
              <Select
                id="fc-weekday-close"
                value={String(weekdayClose)}
                onChange={(e) => setWeekdayClose(Number(e.target.value))}
                disabled={pending}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Switch
            id="fc-saturday-on"
            checked={saturdayOn}
            onCheckedChange={setSaturdayOn}
            disabled={pending}
            label="Szombat nyitva"
            description="Kikapcsolva: szombat zárva a chartokon"
          />

          {saturdayOn ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fc-sat-open">Szombat nyitás</Label>
                <Select
                  id="fc-sat-open"
                  value={String(saturdayOpenHour)}
                  onChange={(e) => setSaturdayOpenHour(Number(e.target.value))}
                  disabled={pending}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fc-sat-close">Szombat zárás</Label>
                <Select
                  id="fc-sat-close"
                  value={String(saturdayCloseHour)}
                  onChange={(e) => setSaturdayCloseHour(Number(e.target.value))}
                  disabled={pending}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : null}

          <p className="text-[11.5px] text-ink-muted">
            A számláló továbbra is egész nap rögzít; a megjelenítés és a
            kezdőlap widget csak a nyitvatartást mutatja.
          </p>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={onSave} disabled={pending}>
              {pending ? 'Mentés…' : 'Mentés'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
