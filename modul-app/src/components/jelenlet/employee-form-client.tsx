'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Archive } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  archiveEmployeeAction,
  softDeleteEmployeeAction,
  upsertEmployeeAction
} from '@/lib/jelenlet/actions'
import type { HrEmployeeRow } from '@/lib/jelenlet/queries'

const ROUNDING_OPTIONS = [
  { value: 'floor', label: 'Lefelé' },
  { value: 'nearest', label: 'Legközelebbi' },
  { value: 'ceil', label: 'Felfelé' }
]

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
  const ot = employee?.overtimeDetails
  const [otRoundingMinutes, setOtRoundingMinutes] = useState(
    String(ot?.roundingMinutes ?? 15)
  )
  const [otRoundingMode, setOtRoundingMode] = useState<string>(
    ot?.roundingMode ?? 'floor'
  )
  const [earlyEnabled, setEarlyEnabled] = useState(ot?.earlyEnabled ?? false)
  const [earlyTrigger, setEarlyTrigger] = useState(ot?.earlyTriggerTime ?? '07:00')
  const [earlyPayUntil, setEarlyPayUntil] = useState(ot?.earlyPayUntilTime ?? '')
  const [earlyMax, setEarlyMax] = useState(String(ot?.earlyMaxMinutes ?? 30))
  const [earlyGrace, setEarlyGrace] = useState(String(ot?.earlyGraceMinutes ?? 0))
  const [pinCode, setPinCode] = useState(employee?.pinCode ?? '')
  const [rfidCardId, setRfidCardId] = useState(employee?.rfidCardId ?? '')
  const [notes, setNotes] = useState(employee?.notes ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

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
          overtimeRoundingMinutes: Number(otRoundingMinutes) || 15,
          overtimeRoundingMode: otRoundingMode as 'floor' | 'nearest' | 'ceil',
          earlyOvertimeEnabled: earlyEnabled,
          earlyOvertimeTriggerTime: earlyTrigger || null,
          earlyOvertimePayUntilTime: earlyPayUntil || null,
          earlyOvertimeMaxMinutes: Number(earlyMax) || 0,
          earlyOvertimeGraceMinutes: Number(earlyGrace) || 0,
          pinCode: pinCode || null,
          rfidCardId: rfidCardId || null,
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

  function confirmDelete() {
    if (!canWrite || !employee?.id) return
    startTransition(async () => {
      const result = await softDeleteEmployeeAction({ id: employee.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setDeleteOpen(false)
      toast.success('Dolgozó törölve.')
      router.push('/dolgozok')
      router.refresh()
    })
  }

  function confirmArchive() {
    if (!canWrite || !employee?.id) return
    startTransition(async () => {
      const result = await archiveEmployeeAction({ id: employee.id })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setArchiveOpen(false)
      toast.success('Dolgozó archiválva.')
      router.refresh()
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
            label="Szombaton dolgozhat"
            description="Ha dolgozik, rögzíthető. Üres szombat nem pótolnivaló."
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
        description="Műszak utáni és korai túlóra — a belső jelenléti íven jelenik meg."
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
            <FormField
              label="Kerekítés (perc)"
              htmlFor="ot-round"
              hint="A túlóra ennyi perces egységekben számít."
            >
              <Input
                id="ot-round"
                type="number"
                min={1}
                max={120}
                value={otRoundingMinutes}
                onChange={(e) => setOtRoundingMinutes(e.target.value)}
                disabled={!canWrite}
              />
            </FormField>
            <FormField label="Kerekítés iránya" htmlFor="ot-round-mode">
              <MenuSelect
                id="ot-round-mode"
                value={otRoundingMode}
                options={ROUNDING_OPTIONS}
                allowEmpty={false}
                onChange={setOtRoundingMode}
                disabled={!canWrite}
              />
            </FormField>
            <div className="sm:col-span-4">
              <Switch
                id="emp-early-ot"
                checked={earlyEnabled}
                onCheckedChange={setEarlyEnabled}
                disabled={!canWrite}
                label="Korai túlóra (műszak előtt)"
                description="Ha a dolgozó a megadott időnél korábban érkezik, a műszak előtti rész túlórának számít."
              />
            </div>
            {earlyEnabled ? (
              <>
                <FormField
                  label="Ennél korábbi érkezés"
                  htmlFor="early-trigger"
                  hint="Pl. 07:00 — utána érkezve nincs korai túlóra."
                >
                  <Input
                    id="early-trigger"
                    type="time"
                    value={earlyTrigger}
                    onChange={(e) => setEarlyTrigger(e.target.value)}
                    disabled={!canWrite}
                  />
                </FormField>
                <FormField
                  label="Fizetett eddig"
                  htmlFor="early-until"
                  optionalLabel
                  hint="Üresen: a műszak kezdetéig."
                >
                  <Input
                    id="early-until"
                    type="time"
                    value={earlyPayUntil}
                    onChange={(e) => setEarlyPayUntil(e.target.value)}
                    disabled={!canWrite}
                  />
                </FormField>
                <FormField label="Maximum (perc)" htmlFor="early-max">
                  <Input
                    id="early-max"
                    type="number"
                    min={0}
                    max={480}
                    value={earlyMax}
                    onChange={(e) => setEarlyMax(e.target.value)}
                    disabled={!canWrite}
                  />
                </FormField>
                <FormField
                  label="Türelmi idő (perc)"
                  htmlFor="early-grace"
                  hint="Ennyi perc korai érkezés még nem túlóra."
                >
                  <Input
                    id="early-grace"
                    type="number"
                    min={0}
                    max={240}
                    value={earlyGrace}
                    onChange={(e) => setEarlyGrace(e.target.value)}
                    disabled={!canWrite}
                  />
                </FormField>
              </>
            ) : null}
          </>
        ) : null}
      </FormSection>

      <FormSection
        title="Terminál"
        description="PIN és RFID a jelenlét terminálhoz."
        columns={4}
      >
        <FormField
          label="PIN"
          htmlFor="emp-pin"
          optionalLabel
          error={fieldErrors.pinCode}
          hint="Pontosan 4 számjegy."
        >
          <Input
            id="emp-pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pinCode}
            onChange={(e) =>
              setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            disabled={!canWrite}
            placeholder="0000"
          />
        </FormField>
        <FormField
          label="RFID kártya"
          htmlFor="emp-rfid"
          optionalLabel
          error={fieldErrors.rfidCardId}
          hint="NFC/RFID UID (pl. 8C93E105)."
          className="sm:col-span-2"
        >
          <Input
            id="emp-rfid"
            autoComplete="off"
            value={rfidCardId}
            onChange={(e) => setRfidCardId(e.target.value.toUpperCase())}
            disabled={!canWrite}
            placeholder="8C93E105"
          />
        </FormField>
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
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-1.5 border-t border-border bg-app/95 py-3 backdrop-blur-sm">
          <div className="flex gap-1.5">
            {isEdit ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setArchiveOpen(true)}
                >
                  <Archive className="size-3.5" aria-hidden />
                  Dolgozó archiválása
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  className="text-danger-ink hover:bg-danger-soft"
                  onClick={() => setDeleteOpen(true)}
                >
                  Dolgozó törlése
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex gap-1.5">
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
        </div>
      ) : null}
    </div>
  )

  const deleteDialog =
    isEdit && canWrite ? (
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteOpen(false)
        }}
        title="Dolgozó törlése"
        description={`Biztosan törlöd „${employee?.name ?? 'ezt a dolgozót'}”? Mindenhonnan eltűnik, jelenléti ív sem készíthető róla. Kilépett dolgozónál inkább archiváld.`}
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={confirmDelete}
      />
    ) : null

  const archiveDialog =
    isEdit && canWrite ? (
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setArchiveOpen(false)
        }}
        title="Dolgozó archiválása"
        description={`„${employee?.name ?? 'A dolgozó'}” kikerül a listából, a naptárból és a terminálról; PIN és RFID kártya felszabadul. A jelenlét, a távollétek és a jelenléti ív megmarad, és bármikor visszaállítható.`}
        confirmLabel="Dolgozó archiválása"
        cancelLabel="Mégse"
        variant="primary"
        loading={pending}
        onConfirm={confirmArchive}
      />
    ) : null

  if (embedded) {
    return (
      <>
        {formBody}
        {deleteDialog}
        {archiveDialog}
      </>
    )
  }

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
            {isEdit && canWrite ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                className="text-danger-ink hover:bg-danger-soft"
                onClick={() => setDeleteOpen(true)}
              >
                Törlés
              </Button>
            ) : null}
            {canWrite ? (
              <Button type="button" loading={pending} onClick={save}>
                {isEdit ? 'Dolgozó mentése' : 'Dolgozó létrehozása'}
              </Button>
            ) : null}
          </div>
        }
      />
      {formBody}
      {deleteDialog}
      {archiveDialog}
    </div>
  )
}
