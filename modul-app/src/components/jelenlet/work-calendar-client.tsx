'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  checkWorkCalendarUpsert,
  deleteWorkCalendarDay,
  seedHuHolidaysForYear,
  updateWorkCalendarDay,
  upsertWorkCalendarRange
} from '@/lib/jelenlet/work-calendar-actions'
import type { HrWorkCalendarRow, WorkCalendarDayType } from '@/lib/jelenlet/types'
import {
  WORK_CALENDAR_DAY_TYPE_LABEL,
  WORK_CALENDAR_DAY_TYPES
} from '@/lib/jelenlet/types'
import { WEEKDAY_SHORT_HU } from '@/lib/jelenlet/hours'
import { cn } from '@/lib/utils'

type Props = {
  initialRows: HrWorkCalendarRow[]
  year: number
  dayTypeFilter: WorkCalendarDayType | 'all'
  canWrite: boolean
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: HrWorkCalendarRow }

function dayTypeTone(
  t: WorkCalendarDayType
): 'info' | 'warning' | 'success' | 'neutral' {
  switch (t) {
    case 'national':
      return 'info'
    case 'company':
      return 'warning'
    case 'relocated_work':
      return 'success'
    case 'relocated_rest':
      return 'neutral'
  }
}

function weekdayLabel(ymd: string): string {
  const d = new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10))
  )
  return WEEKDAY_SHORT_HU[d.getDay()] ?? ''
}

function formatYmdHu(ymd: string): string {
  const y = ymd.slice(0, 4)
  const m = ymd.slice(5, 7)
  const d = ymd.slice(8, 10)
  return `${y}.${m}.${d}.`
}

const TYPE_OPTIONS = WORK_CALENDAR_DAY_TYPES.map((t) => ({
  value: t,
  label: WORK_CALENDAR_DAY_TYPE_LABEL[t]
}))

export function WorkCalendarClient({
  initialRows,
  year,
  dayTypeFilter,
  canWrite
}: Props) {
  const router = useRouter()
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<HrWorkCalendarRow | null>(
    null
  )
  const [pending, startTransition] = useTransition()

  const [dayType, setDayType] = useState<WorkCalendarDayType>('company')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [name, setName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [replaceConfirm, setReplaceConfirm] = useState<{
    conflicts: Array<{
      workDate: string
      dayType: WorkCalendarDayType
      name: string
    }>
    attendanceCount: number
    absenceCount: number
  } | null>(null)

  const [seedOpen, setSeedOpen] = useState(false)
  const [seedYear, setSeedYear] = useState(String(year))

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 1, y, y + 1, y + 2].map((v) => ({
      value: String(v),
      label: String(v)
    }))
  }, [])

  const filterOptions = useMemo(
    () => [
      { value: 'all', label: 'Mind' },
      ...TYPE_OPTIONS
    ],
    []
  )

  function push(next: { year?: number; type?: string }) {
    const params = new URLSearchParams()
    params.set('year', String(next.year ?? year))
    const t = next.type ?? dayTypeFilter
    if (t && t !== 'all') params.set('type', t)
    router.push(`/jelenlet/naptar?${params.toString()}`)
  }

  function openCreate() {
    setDayType('company')
    setStartDate('')
    setEndDate('')
    setName('')
    setFieldErrors({})
    setReplaceConfirm(null)
    setEditor({ mode: 'create' })
  }

  function openEdit(row: HrWorkCalendarRow) {
    setDayType(row.dayType)
    setStartDate(row.workDate)
    setEndDate('')
    setName(row.name)
    setFieldErrors({})
    setReplaceConfirm(null)
    setEditor({ mode: 'edit', row })
  }

  function closeEditor() {
    if (pending) return
    setEditor({ mode: 'closed' })
    setReplaceConfirm(null)
    setFieldErrors({})
  }

  function saveCreate(replaceExisting: boolean) {
    startTransition(async () => {
      if (!replaceExisting) {
        const check = await checkWorkCalendarUpsert({
          startDate,
          endDate: endDate || undefined,
          dayType,
          name
        })
        if (!check.ok) {
          setFieldErrors(check.fieldErrors ?? {})
          toast.error(check.message)
          return
        }
        if (
          (check.conflicts && check.conflicts.length > 0) ||
          (check.attendanceCount ?? 0) > 0
        ) {
          setReplaceConfirm({
            conflicts: check.conflicts ?? [],
            attendanceCount: check.attendanceCount ?? 0,
            absenceCount: check.absenceCount ?? 0
          })
          return
        }
      }

      const result = await upsertWorkCalendarRange({
        startDate,
        endDate: endDate || undefined,
        dayType,
        name,
        replaceExisting
      })

      if (!result.ok) {
        if (result.conflicts && result.conflicts.length > 0) {
          setReplaceConfirm({
            conflicts: result.conflicts,
            attendanceCount: result.attendanceCount ?? 0,
            absenceCount: result.absenceCount ?? 0
          })
          return
        }
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        result.replaced
          ? `Mentve (${result.inserted ?? 0} új, ${result.replaced} csere).`
          : 'Naptári nap mentve.'
      )
      setReplaceConfirm(null)
      setEditor({ mode: 'closed' })
      router.refresh()
    })
  }

  function saveEdit() {
    if (editor.mode !== 'edit') return
    startTransition(async () => {
      const result = await updateWorkCalendarDay({
        id: editor.row.id,
        dayType,
        name
      })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success('Nap mentve.')
      setEditor({ mode: 'closed' })
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteWorkCalendarDay({ id: deleteTarget.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${deleteTarget.name}” törölve.`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  function handleSeed() {
    startTransition(async () => {
      const result = await seedHuHolidaysForYear({ year: Number(seedYear) })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        result.inserted
          ? `${result.inserted} nap betöltve (${seedYear}).`
          : `Nincs új nap (${seedYear}) — a meglévők megmaradtak.`
      )
      setSeedOpen(false)
      push({ year: Number(seedYear) })
      router.refresh()
    })
  }

  const editorOpen = editor.mode !== 'closed'
  const typeHint =
    dayType === 'relocated_work'
      ? 'Ez a nap minden dolgozónál munkanap lesz (hiányzó nap is számolódik).'
      : dayType === 'relocated_rest' || dayType === 'company' || dayType === 'national'
        ? 'Ez a nap minden dolgozónál pihenő — a hiányzó napokba nem számít bele.'
        : undefined

  return (
    <div>
      <PageHeader
        title="Munkarend / ünnepek"
        description="Ezek a napok minden dolgozóra érvényesek a naptáron és a hivatalos jelenléti íven."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/jelenlet"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
            >
              <CalendarDays className="size-3.5" aria-hidden />
              Jelenlét naptár
            </Link>
            {canWrite ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSeedOpen(true)}
                >
                  Nemzeti ünnepek betöltése
                </Button>
                <Button type="button" onClick={openCreate}>
                  <Plus className="size-3.5" aria-hidden />
                  Új nap
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FormField label="Év" htmlFor="wc-year" className="w-[7.5rem]">
          <MenuSelect
            id="wc-year"
            value={String(year)}
            options={yearOptions}
            allowEmpty={false}
            onChange={(v) => push({ year: Number(v) })}
          />
        </FormField>
        <div className="flex flex-wrap gap-1.5 pt-5">
          {filterOptions.map((f) => (
            <button
              key={f.value}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[13px]',
                dayTypeFilter === f.value
                  ? 'bg-ink text-white'
                  : 'bg-subtle text-ink-secondary hover:bg-border/60'
              )}
              onClick={() => push({ type: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <CalendarDays className="size-8 text-ink-secondary" aria-hidden />
          <div className="space-y-1">
            <p className="text-body font-medium text-ink">Még nincs nap</p>
            <p className="max-w-sm text-body text-ink-secondary">
              Töltsd be a nemzeti ünnepeket, vagy add hozzá a céges szünnapot /
              áthelyezett napot.
            </p>
          </div>
          {canWrite ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSeedOpen(true)}
              >
                Nemzeti ünnepek betöltése
              </Button>
              <Button type="button" onClick={openCreate}>
                <Plus className="size-3.5" aria-hidden />
                Új nap
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Dátum</DataTableHeaderCell>
              <DataTableHeaderCell>Nap</DataTableHeaderCell>
              <DataTableHeaderCell>Típus</DataTableHeaderCell>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell className="tabular-nums font-medium">
                  {formatYmdHu(row.workDate)}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {weekdayLabel(row.workDate)}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={dayTypeTone(row.dayType)}>
                    {WORK_CALENDAR_DAY_TYPE_LABEL[row.dayType]}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell>{row.name || '—'}</DataTableCell>
                <DataTableCell className="text-right">
                  {canWrite ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        Szerkesztés
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-ink hover:text-danger-ink"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Törlés
                      </Button>
                    </div>
                  ) : (
                    <span className="text-hint text-ink-muted">—</span>
                  )}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editor.mode === 'edit' ? 'Nap szerkesztése' : 'Új naptári nap'}
            </DialogTitle>
            <DialogDescription>
              Globális nap — minden dolgozóra érvényes.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (editor.mode === 'edit') saveEdit()
              else saveCreate(false)
            }}
          >
            <FormField
              label="Típus"
              htmlFor="wc-type"
              error={fieldErrors.dayType}
              hint={typeHint}
            >
              <MenuSelect
                id="wc-type"
                value={dayType}
                options={TYPE_OPTIONS}
                allowEmpty={false}
                onChange={(v) => setDayType(v as WorkCalendarDayType)}
              />
            </FormField>

            <FormField
              label="Kezdő dátum"
              htmlFor="wc-start"
              required
              error={fieldErrors.startDate}
            >
              <Input
                id="wc-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={editor.mode === 'edit'}
              />
            </FormField>

            {editor.mode === 'create' ? (
              <FormField
                label="Záró dátum"
                htmlFor="wc-end"
                optionalLabel
                error={fieldErrors.endDate}
                hint="Üresen hagyva egy nap. Max. 31 nap."
              >
                <Input
                  id="wc-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FormField>
            ) : null}

            <FormField
              label="Név"
              htmlFor="wc-name"
              required
              error={fieldErrors.name}
              hint={
                !fieldErrors.name
                  ? 'pl. Karácsony, Céges szünnap, Áthelyezett munkanap'
                  : undefined
              }
            >
              <Input
                id="wc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={closeEditor}
              >
                Mégse
              </Button>
              <Button type="submit" loading={pending}>
                Mentés
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nemzeti ünnepek betöltése</DialogTitle>
            <DialogDescription>
              Beépített HU lista (ünnep + áthelyezett). A meglévő napokat nem
              írja felül.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Év" htmlFor="seed-year">
            <MenuSelect
              id="seed-year"
              value={seedYear}
              options={[
                { value: '2026', label: '2026' },
                { value: '2027', label: '2027' }
              ]}
              allowEmpty={false}
              onChange={setSeedYear}
              disabled={pending}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setSeedOpen(false)}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSeed}>
              Betöltés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(replaceConfirm)}
        onOpenChange={(open) => {
          if (!open && !pending) setReplaceConfirm(null)
        }}
        title="Megerősítés"
        description={
          replaceConfirm
            ? [
                replaceConfirm.conflicts.length > 0
                  ? `${replaceConfirm.conflicts.length} napon már van bejegyzés (lecserélődik): ${replaceConfirm.conflicts
                      .slice(0, 5)
                      .map(
                        (c) =>
                          `${c.workDate} · ${WORK_CALENDAR_DAY_TYPE_LABEL[c.dayType]}`
                      )
                      .join('; ')}${replaceConfirm.conflicts.length > 5 ? '…' : ''}`
                  : null,
                replaceConfirm.attendanceCount > 0
                  ? `${replaceConfirm.attendanceCount} jelenlét-rögzítés esik ezekre a napokra — a naptár ettől még munkaszünet/ünnep lesz.`
                  : null,
                replaceConfirm.absenceCount > 0
                  ? `${replaceConfirm.absenceCount} távollét fedi ezeket a napokat — a naptár ünnepet mutat.`
                  : null,
                'Folytatod?'
              ]
                .filter(Boolean)
                .join(' ')
            : ''
        }
        confirmLabel="Csere és mentés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={() => saveCreate(true)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null)
        }}
        title="Nap törlése"
        description={
          deleteTarget
            ? deleteTarget.dayType === 'national'
              ? `Biztosan törlöd a nemzeti ünnepet („${deleteTarget.name}”, ${formatYmdHu(deleteTarget.workDate)})?`
              : `Biztosan törlöd a(z) „${deleteTarget.name}” napot (${formatYmdHu(deleteTarget.workDate)})?`
            : ''
        }
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
