'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
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
  deleteAbsenceAction
} from '@/lib/jelenlet/actions'
import type { AbsenceRow, HrEmployeeRow } from '@/lib/jelenlet/queries'
import {
  ABSENCE_TYPE_LABEL,
  ABSENCE_TYPES,
  type AbsenceType
} from '@/lib/jelenlet/types'
import { cn } from '@/lib/utils'

type Tab = 'alap' | 'tavollet'

type Props = {
  employee: HrEmployeeRow
  absences: AbsenceRow[]
  canWrite: boolean
  typeOptions: Array<{ id: string; name: string; isDefault: boolean }>
}

export function EmployeeDetailClient({
  employee,
  absences,
  canWrite,
  typeOptions
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('alap')
  const [pending, startTransition] = useTransition()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [absenceType, setAbsenceType] = useState<AbsenceType>('vacation')
  const [note, setNote] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

      <div className="flex gap-1 border-b border-border">
        {(
          [
            { id: 'alap' as const, label: 'Alap adatok' },
            { id: 'tavollet' as const, label: 'Távollét' }
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
        <div className="space-y-2.5">
          {canWrite ? (
            <div className="max-w-6xl space-y-2.5">
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
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </FormField>
                <FormField label="Vége" htmlFor="abs-end" required>
                  <Input
                    id="abs-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                <div className="sm:col-span-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={addAbsence}
                    disabled={pending || !startDate || !endDate}
                    loading={pending}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Távollét hozzáadása
                  </Button>
                </div>
              </FormSection>
            </div>
          ) : null}

          {absences.length === 0 ? (
            <p className="text-body text-ink-secondary">
              Nincs rögzített távollét.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {absences.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={a.absenceType === 'sick' ? 'warning' : 'info'}
                      >
                        {ABSENCE_TYPE_LABEL[a.absenceType]}
                      </StatusBadge>
                      <span className="text-[13px] text-ink">
                        {a.startDate}
                        {a.endDate !== a.startDate ? ` – ${a.endDate}` : ''}
                      </span>
                    </div>
                    {a.note ? (
                      <p className="text-hint text-ink-secondary">{a.note}</p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setDeleteId(a.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Törlés
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
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
