'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { upsertEmployeeAction } from '@/lib/jelenlet/actions'
import type { HrEmployeeRow } from '@/lib/jelenlet/queries'

type TypeOption = { id: string; name: string; isDefault: boolean }

type Props = {
  employee?: HrEmployeeRow | null
  canWrite: boolean
  typeOptions: TypeOption[]
  /** Detail tabban: nincs saját PageHeader / sticky bar */
  embedded?: boolean
}

export function EmployeeFormClient({
  employee,
  canWrite,
  typeOptions,
  embedded = false
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(employee?.id)

  const defaultTypeId =
    employee?.employeeTypeId ||
    typeOptions.find((t) => t.isDefault)?.id ||
    typeOptions[0]?.id ||
    ''

  const [name, setName] = useState(employee?.name ?? '')
  const [code, setCode] = useState(employee?.code ?? '')
  const [employeeTypeId, setEmployeeTypeId] = useState(defaultTypeId)
  const [active, setActive] = useState(employee?.active ?? true)
  const [shiftStart, setShiftStart] = useState(employee?.shiftStart ?? '08:00')
  const [shiftEnd, setShiftEnd] = useState(employee?.shiftEnd ?? '16:00')
  const [lunchStart, setLunchStart] = useState(employee?.lunchStart ?? '12:00')
  const [lunchEnd, setLunchEnd] = useState(employee?.lunchEnd ?? '12:30')
  const [worksOnSaturday, setWorksOnSaturday] = useState(
    employee?.worksOnSaturday ?? false
  )
  const [overtimeEnabled, setOvertimeEnabled] = useState(
    employee?.overtimeEnabled ?? false
  )
  const [overtimeGraceMinutes, setOvertimeGraceMinutes] = useState(
    String(employee?.overtimeGraceMinutes ?? 15)
  )
  const [overtimeDailyCapMinutes, setOvertimeDailyCapMinutes] = useState(
    String(employee?.overtimeDailyCapMinutes ?? 180)
  )
  const [notes, setNotes] = useState(employee?.notes ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function save() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await upsertEmployeeAction({
        id: employee?.id,
        values: {
          name,
          code,
          employeeTypeId,
          active,
          shiftStart,
          shiftEnd,
          lunchStart,
          lunchEnd,
          worksOnSaturday,
          overtimeEnabled,
          overtimeGraceMinutes: Number(overtimeGraceMinutes) || 0,
          overtimeDailyCapMinutes: Number(overtimeDailyCapMinutes) || 0,
          notes: notes || null
        }
      })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      setFieldErrors({})
      toast.success(isEdit ? 'Dolgozó mentve.' : 'Dolgozó létrehozva.')
      if (result.id && !embedded) {
        router.push(`/dolgozok/${result.id}`)
        router.refresh()
      } else {
        router.refresh()
      }
    })
  }

  const formBody = (
    <div className="w-full max-w-6xl space-y-2.5">
      <FormSection
        title="Alapadatok"
        description="Név, azonosító és státusz."
        columns={4}
      >
        <FormField
          label="Név"
          htmlFor="emp-name"
          required
          error={fieldErrors.name}
          className="sm:col-span-2"
        >
          <Input
            id="emp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canWrite}
            autoComplete="name"
          />
        </FormField>
        <FormField
          label="Kód"
          htmlFor="emp-code"
          optionalLabel
          error={fieldErrors.code}
        >
          <Input
            id="emp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!canWrite}
          />
        </FormField>
        <FormField
          label="Típus"
          htmlFor="emp-type"
          error={fieldErrors.employeeTypeId}
        >
          {typeOptions.length === 0 ? (
            <p className="text-hint text-ink-secondary">
              Nincs típus.{' '}
              <Link
                href="/dolgozok/tipusok"
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                Hozz létre típust
              </Link>
              .
            </p>
          ) : (
            <MenuSelect
              id="emp-type"
              value={employeeTypeId}
              allowEmpty={false}
              disabled={!canWrite}
              options={typeOptions.map((t) => ({
                value: t.id,
                label: t.name
              }))}
              onChange={setEmployeeTypeId}
            />
          )}
        </FormField>
        <div className="sm:col-span-2 flex flex-col gap-3 pt-1">
          <Switch
            id="emp-active"
            checked={active}
            onCheckedChange={setActive}
            disabled={!canWrite}
            label="Aktív"
            description="Inaktív dolgozó nem jelenik meg a naptáron."
          />
          <Switch
            id="emp-saturday"
            checked={worksOnSaturday}
            onCheckedChange={setWorksOnSaturday}
            disabled={!canWrite}
            label="Szombaton dolgozik"
            description="A hiányzó napok számításánál a szombat is munkanap."
          />
        </div>
      </FormSection>

      <FormSection
        title="Műszak és ebéd"
        description="Fizetett órák ablakja — a naptár ebből számol."
        columns={4}
      >
        <FormField label="Műszak eleje" htmlFor="shift-start">
          <Input
            id="shift-start"
            type="time"
            value={shiftStart ?? ''}
            onChange={(e) => setShiftStart(e.target.value)}
            disabled={!canWrite}
          />
        </FormField>
        <FormField label="Műszak vége" htmlFor="shift-end">
          <Input
            id="shift-end"
            type="time"
            value={shiftEnd ?? ''}
            onChange={(e) => setShiftEnd(e.target.value)}
            disabled={!canWrite}
          />
        </FormField>
        <FormField label="Ebéd eleje" htmlFor="lunch-start" optionalLabel>
          <Input
            id="lunch-start"
            type="time"
            value={lunchStart ?? ''}
            onChange={(e) => setLunchStart(e.target.value)}
            disabled={!canWrite}
          />
        </FormField>
        <FormField label="Ebéd vége" htmlFor="lunch-end" optionalLabel>
          <Input
            id="lunch-end"
            type="time"
            value={lunchEnd ?? ''}
            onChange={(e) => setLunchEnd(e.target.value)}
            disabled={!canWrite}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Túlóra"
        description="Egyszerű műszak utáni túlóra szabály."
        columns={4}
      >
        <div className="sm:col-span-4">
          <Switch
            id="emp-ot"
            checked={overtimeEnabled}
            onCheckedChange={setOvertimeEnabled}
            disabled={!canWrite}
            label="Túlóra számítás"
            description="Ha ki van kapcsolva, nincs túlóra a naptár összesítőben."
          />
        </div>
        {overtimeEnabled ? (
          <>
            <FormField
              label="Türelmi idő (perc)"
              htmlFor="ot-grace"
              hint="Ennyi perc után indul a túlóra."
            >
              <Input
                id="ot-grace"
                type="number"
                min={0}
                value={overtimeGraceMinutes}
                onChange={(e) => setOvertimeGraceMinutes(e.target.value)}
                disabled={!canWrite}
              />
            </FormField>
            <FormField
              label="Napi maximum (perc)"
              htmlFor="ot-cap"
              hint="Ennél több túlórát egy napra nem számol."
            >
              <Input
                id="ot-cap"
                type="number"
                min={0}
                value={overtimeDailyCapMinutes}
                onChange={(e) => setOvertimeDailyCapMinutes(e.target.value)}
                disabled={!canWrite}
              />
            </FormField>
          </>
        ) : null}
      </FormSection>

      <FormSection title="Megjegyzés" columns={2}>
        <FormField
          label="Megjegyzés"
          htmlFor="emp-notes"
          optionalLabel
          className="sm:col-span-2"
        >
          <Textarea
            id="emp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canWrite}
            rows={3}
          />
        </FormField>
      </FormSection>

      {canWrite ? (
        <div className="sticky bottom-0 z-10 flex justify-end gap-1.5 border-t border-border bg-app/95 py-3 backdrop-blur-sm">
          {!embedded ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => router.push('/dolgozok')}
            >
              Mégse
            </Button>
          ) : null}
          <Button type="button" loading={pending} onClick={save}>
            {isEdit ? 'Dolgozó mentése' : 'Dolgozó létrehozása'}
          </Button>
        </div>
      ) : null}
    </div>
  )

  if (embedded) return formBody

  return (
    <div className="pb-14">
      <PageHeader
        title={isEdit ? (employee?.name ?? 'Dolgozó') : 'Új dolgozó'}
        description="Alapadatok, műszak és túlóra szabály."
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/dolgozok')}
            >
              Vissza a listához
            </Button>
            {canWrite ? (
              <Button type="button" loading={pending} onClick={save}>
                {isEdit ? 'Dolgozó mentése' : 'Dolgozó létrehozása'}
              </Button>
            ) : null}
          </div>
        }
      />
      {formBody}
    </div>
  )
}
