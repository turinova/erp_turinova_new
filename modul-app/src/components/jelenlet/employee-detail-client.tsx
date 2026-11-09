'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Archive, CalendarDays, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EmployeeFormClient } from '@/components/jelenlet/employee-form-client'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  createAbsenceAction,
  deleteAbsenceAction,
  restoreEmployeeAction
} from '@/lib/jelenlet/actions'
import { budapestTodayYmd } from '@/lib/jelenlet/hours'
import type { AbsenceRow, HrEmployeeRow } from '@/lib/jelenlet/queries'
import {
  ABSENCE_TYPE_LABEL,
  ABSENCE_TYPES,
  type AbsenceType
} from '@/lib/jelenlet/types'
import { cn } from '@/lib/utils'

type Tab = 'alap' | 'tavollet'

const MONTH_SHORT = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.'
]
const DOW_SHORT = ['v', 'h', 'k', 'sze', 'cs', 'p', 'szo']

function utcDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

function formatAbsenceDay(ymd: string, withYear: boolean): string {
  const d = utcDate(ymd)
  const base = `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}. (${DOW_SHORT[d.getUTCDay()]})`
  return withYear ? `${d.getUTCFullYear()}. ${base}` : base
}

function formatAbsenceRange(start: string, end: string): string {
  if (start === end) return formatAbsenceDay(start, true)
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${formatAbsenceDay(start, true)} – ${formatAbsenceDay(end, !sameYear)}`
}

function absenceDayCount(start: string, end: string): number {
  return Math.round((utcDate(end).getTime() - utcDate(start).getTime()) / 86_400_000) + 1
}

function weekdayCount(start: string, end: string): number {
  let n = 0
  const d = utcDate(start)
  const last = utcDate(end).getTime()
  while (d.getTime() <= last) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) n++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return n
}

type Props = {
  employee: HrEmployeeRow
  absences: AbsenceRow[]
  canWrite: boolean
  typeOptions: Array<{ id: string; name: string; isDefault: boolean }>
}

export function EmployeeDetailClient({
  employee,
  absences,
  canWrite: canWriteRole,
  typeOptions
}: Props) {
  const router = useRouter()
  const archived = Boolean(employee.archivedAt)
  const canWrite = canWriteRole && !archived
  const [tab, setTab] = useState<Tab>('alap')
  const [pending, startTransition] = useTransition()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [absenceType, setAbsenceType] = useState<AbsenceType>('vacation')
  const [note, setNote] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const today = budapestTodayYmd()
  const rangeError =
    startDate && endDate && endDate < startDate
      ? 'A vége nem lehet a kezdet előtt.'
      : null

  const { upcoming, past, vacationWeekdaysThisYear } = useMemo(() => {
    const year = today.slice(0, 4)
    const upcomingRows = absences
      .filter((a) => a.endDate >= today)
      .sort((x, y) => x.startDate.localeCompare(y.startDate))
    const pastRows = absences.filter((a) => a.endDate < today)
    let weekdays = 0
    for (const a of absences) {
      if (a.absenceType !== 'vacation') continue
      const from = a.startDate < `${year}-01-01` ? `${year}-01-01` : a.startDate
      const to = a.endDate > `${year}-12-31` ? `${year}-12-31` : a.endDate
      if (from <= to) weekdays += weekdayCount(from, to)
    }
    return { upcoming: upcomingRows, past: pastRows, vacationWeekdaysThisYear: weekdays }
  }, [absences, today])

  function addAbsence() {
    startTransition(async () => {
      const result = await createAbsenceAction({
        employeeId: employee.id,
        values: { startDate, endDate, absenceType, note: note || null }
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Távollét rögzítve.')
      setStartDate('')
      setEndDate('')
      setNote('')
      router.refresh()
    })
  }

  function restore() {
    startTransition(async () => {
      const result = await restoreEmployeeAction({ id: employee.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Dolgozó visszaállítva inaktívként. Kapcsold aktívra és adj meg PIN-t.')
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deleteAbsenceAction({
        employeeId: employee.id,
        absenceId: deleteId
      })
      setDeleteId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Távollét törölve.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={employee.name}
        description={
          employee.code
            ? `Kód: ${employee.code}`
            : 'Dolgozó adatok és távollét.'
        }
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/dolgozok')}
            >
              Vissza a listához
            </Button>
            <Link
              href="/jelenlet"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
            >
              <CalendarDays className="size-3.5" aria-hidden />
              Jelenlét naptár
            </Link>
          </div>
        }
      />

      {archived ? (
        <div
          role="status"
          className="flex max-w-6xl flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3.5 py-2.5"
        >
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <Archive className="size-4 text-ink-secondary" aria-hidden />
            <span>
              <span className="font-medium">Archivált dolgozó</span>
              {' — '}
              {new Date(employee.archivedAt!).toLocaleDateString('hu-HU')} óta. Az
              adatai csak olvashatók; jelenléti ív továbbra is készíthető.
            </span>
          </div>
          {canWriteRole ? (
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={restore}
            >
              Dolgozó visszaállítása
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-border">
        {(
          [
            { id: 'alap' as const, label: 'Alap adatok' },
            {
              id: 'tavollet' as const,
              label: absences.length > 0 ? `Távollét (${absences.length})` : 'Távollét'
            }
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'px-3 py-2 text-[13px] font-medium',
              tab === t.id
                ? 'border-b-2 border-ink text-ink'
                : 'text-ink-secondary hover:text-ink'
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'alap' ? (
        <EmployeeFormClient
          employee={employee}
          canWrite={canWrite}
          typeOptions={typeOptions}
          embedded
        />
      ) : (
        <div className="w-full max-w-6xl space-y-2.5">
          {canWrite ? (
            <FormSection
              title="Távollét hozzáadása"
              description="Szabadság, betegszabadság vagy egyéb távollét."
              columns={4}
            >
              <FormField label="Kezdet" htmlFor="abs-start" required>
                <Input
                  id="abs-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartDate(v)
                    if (v && (!endDate || endDate < v)) setEndDate(v)
                  }}
                />
              </FormField>
              <FormField
                label="Vége"
                htmlFor="abs-end"
                required
                error={rangeError ?? undefined}
              >
                <Input
                  id="abs-end"
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-invalid={Boolean(rangeError)}
                />
              </FormField>
              <FormField label="Típus" htmlFor="abs-type">
                <MenuSelect
                  id="abs-type"
                  value={absenceType}
                  allowEmpty={false}
                  options={ABSENCE_TYPES.map((t) => ({
                    value: t,
                    label: ABSENCE_TYPE_LABEL[t]
                  }))}
                  onChange={(v) => setAbsenceType(v as AbsenceType)}
                />
              </FormField>
              <FormField label="Megjegyzés" htmlFor="abs-note" optionalLabel>
                <Input
                  id="abs-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
              <div className="flex items-center justify-end gap-3 sm:col-span-2 lg:col-span-4">
                {startDate && endDate && !rangeError ? (
                  <span className="text-hint text-ink-secondary">
                    {formatAbsenceRange(startDate, endDate)} ·{' '}
                    {absenceDayCount(startDate, endDate)} nap
                  </span>
                ) : null}
                <Button
                  type="button"
                  onClick={addAbsence}
                  disabled={pending || !startDate || !endDate || Boolean(rangeError)}
                  loading={pending}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Távollét hozzáadása
                </Button>
              </div>
            </FormSection>
          ) : null}

          <section className="rounded-md border border-border bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-2 px-3.5 pb-2.5 pt-3.5">
              <div className="space-y-0.5">
                <h2 className="text-h3 text-ink">Távollétek</h2>
                <p className="text-hint text-ink-secondary">
                  A naptár és a jelenléti ív ezekből számol.
                </p>
              </div>
              {absences.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-hint text-ink-secondary">
                  <span className="tabular-nums">{absences.length} bejegyzés</span>
                  {vacationWeekdaysThisYear > 0 ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">
                        Idei szabadság: {vacationWeekdaysThisYear} hétköznap
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {absences.length === 0 ? (
              <p className="border-t border-border px-3.5 py-6 text-center text-body text-ink-secondary">
                Még nincs rögzített távollét.
                {canWrite ? ' Fent adhatsz hozzá szabadságot vagy betegszabadságot.' : ''}
              </p>
            ) : (
              <>
                {[
                  { key: 'upcoming', label: 'Folyamatban és közelgő', rows: upcoming },
                  { key: 'past', label: 'Korábbi', rows: past }
                ]
                  .filter((g) => g.rows.length > 0)
                  .map((g) => (
                    <div key={g.key}>
                      <h3 className="border-t border-border bg-subtle px-3.5 py-1.5 text-[12px] font-medium text-ink-secondary">
                        {g.label} ({g.rows.length})
                      </h3>
                      <ul className="divide-y divide-border border-t border-border">
                        {g.rows.map((a) => {
                          const ongoing = a.startDate <= today && a.endDate >= today
                          return (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-3 px-3.5 py-2"
                            >
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
                                <StatusBadge
                                  tone={a.absenceType === 'sick' ? 'warning' : 'info'}
                                >
                                  {ABSENCE_TYPE_LABEL[a.absenceType]}
                                </StatusBadge>
                                <span className="text-[13px] font-medium text-ink">
                                  {formatAbsenceRange(a.startDate, a.endDate)}
                                </span>
                                <span className="text-[13px] tabular-nums text-ink-secondary">
                                  {absenceDayCount(a.startDate, a.endDate)} nap
                                </span>
                                {ongoing ? (
                                  <StatusBadge tone="active">Most tart</StatusBadge>
                                ) : null}
                                {a.note ? (
                                  <span className="basis-full truncate text-hint text-ink-secondary">
                                    {a.note}
                                  </span>
                                ) : null}
                              </div>
                              {canWrite ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setDeleteId(a.id)}
                                  aria-label={`${ABSENCE_TYPE_LABEL[a.absenceType]} törlése: ${formatAbsenceRange(a.startDate, a.endDate)}`}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                  Törlés
                                </Button>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
              </>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
        title="Távollét törlése"
        description="Biztosan törlöd ezt a távollétet?"
        confirmLabel="Törlés"
        variant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
