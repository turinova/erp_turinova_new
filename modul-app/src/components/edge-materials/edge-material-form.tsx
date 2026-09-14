'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  createEdgeMaterial,
  updateEdgeMaterial
} from '@/lib/edge-materials/actions'
import {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  netFromGross,
  parseDecimalInput
} from '@/lib/edge-materials/parse'
import type { EdgeMaterialDetail } from '@/lib/edge-materials/queries'
import {
  ORPHAN_EQUIPMENT_MESSAGE,
  resolveAliveEquipmentId
} from '@/lib/equipment/resolve-alive'

type OptionManufacturer = { id: string; name: string }
type OptionEquipment = { id: string; name: string }
type OptionTaxRate = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

type EdgeMaterialFormProps = {
  mode: 'create' | 'edit'
  initial?: EdgeMaterialDetail | null
  manufacturers: OptionManufacturer[]
  equipment: OptionEquipment[]
  taxRates: OptionTaxRate[]
  canWrite: boolean
}

export function EdgeMaterialForm({
  mode,
  initial,
  manufacturers,
  equipment,
  taxRates,
  canWrite
}: EdgeMaterialFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const defaultTaxId =
    initial?.tax_rate_id ||
    taxRates.find((t) => t.is_default)?.id ||
    taxRates[0]?.id ||
    ''

  const [manufacturerId, setManufacturerId] = useState(
    initial?.manufacturer_id ?? manufacturers[0]?.id ?? ''
  )
  const [taxRateId, setTaxRateId] = useState(defaultTaxId)
  const [equipmentId, setEquipmentId] = useState(() => {
    const resolved = resolveAliveEquipmentId(
      initial?.equipment_id,
      equipment
    )
    return resolved.equipmentId
  })
  const [type, setType] = useState(initial?.type ?? '')
  const [decor, setDecor] = useState(initial?.decor ?? '')
  const [widthRaw, setWidthRaw] = useState(
    initial ? formatHuNumber(initial.width_mm).replace(/\s/g, '') : ''
  )
  const [thicknessRaw, setThicknessRaw] = useState(
    initial ? formatHuNumber(initial.thickness_mm).replace(/\s/g, '') : ''
  )
  const [allowanceRaw, setAllowanceRaw] = useState(
    initial ? String(initial.allowance_mm) : '0'
  )
  const [favouriteRaw, setFavouriteRaw] = useState(
    initial?.favourite_priority != null
      ? String(initial.favourite_priority)
      : ''
  )
  const [machineCode, setMachineCode] = useState(initial?.machine_code ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(() => {
    const resolved = resolveAliveEquipmentId(initial?.equipment_id, equipment)
    const errors: Record<string, string> = {}
    if (resolved.isOrphan) {
      errors.equipmentId = ORPHAN_EQUIPMENT_MESSAGE
    }
    return errors
  })

  const selectedVat = useMemo(
    () => taxRates.find((t) => t.id === taxRateId)?.rate_percent ?? 0,
    [taxRates, taxRateId]
  )

  const initialGross =
    initial != null
      ? grossFromNet(
          initial.price_net,
          taxRates.find((t) => t.id === initial.tax_rate_id)?.rate_percent ??
            selectedVat
        )
      : 0

  const [grossRaw, setGrossRaw] = useState(
    initial ? String(initialGross) : ''
  )

  const priceNet = useMemo(() => {
    const gross = parseDecimalInput(grossRaw)
    if (gross === null) return null
    return netFromGross(gross, selectedVat)
  }, [grossRaw, selectedVat])

  const missingDeps =
    manufacturers.length === 0 ||
    taxRates.length === 0 ||
    equipment.length === 0

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      if (!equipmentId) {
        setFieldErrors((prev) => ({
          ...prev,
          equipmentId: ORPHAN_EQUIPMENT_MESSAGE
        }))
        toast.error('Válassz berendezést.')
        return
      }
      if (priceNet === null) {
        setFieldErrors({ priceNet: 'Érvényes bruttó árat adj meg.' })
        toast.error('Ellenőrizd a megadott adatokat.')
        return
      }

      const payload = {
        manufacturerId,
        taxRateId,
        equipmentId,
        type,
        decor,
        widthMmRaw: widthRaw,
        thicknessMmRaw: thicknessRaw,
        priceNet,
        allowanceMmRaw: allowanceRaw,
        favouritePriorityRaw: favouriteRaw,
        active,
        machineCode
      }

      const result =
        mode === 'edit' && initial
          ? await updateEdgeMaterial({ id: initial.id, ...payload })
          : await createEdgeMaterial(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        mode === 'edit' ? 'Élzáró mentve.' : 'Élzáró létrehozva.'
      )
      setFieldErrors({})
      router.push(`/torzsadatok/alapanyagok/elzarok/${result.id}`)
      router.refresh()
    })
  }

  const title =
    mode === 'edit'
      ? initial
        ? `${initial.decor} · ${initial.type}`
        : 'Élzáró'
      : 'Új élzáró'

  return (
    <div className="pb-14">
      <PageHeader
        title={title}
        description="Törzsadatok → Alapanyagok → Élzárók"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                router.push('/torzsadatok/alapanyagok/elzarok')
              }
            >
              Vissza a listához
            </Button>
            {canWrite && !missingDeps ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Élzáró mentése
              </Button>
            ) : null}
          </div>
        }
      />

      {missingDeps ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink"
          role="status"
        >
          Élzáró felviteléhez előbb kell legalább egy{' '}
          <Link
            href="/torzsadatok/rendszer/gyartok"
            className="underline underline-offset-2"
          >
            gyártó
          </Link>
          , egy{' '}
          <Link
            href="/torzsadatok/rendszer/adonem"
            className="underline underline-offset-2"
          >
            adónem
          </Link>{' '}
          és egy{' '}
          <Link
            href="/torzsadatok/rendszer/berendezes"
            className="underline underline-offset-2"
          >
            berendezés
          </Link>
          .
        </p>
      ) : null}

      <div className="w-full max-w-6xl space-y-2.5">
        <FormSection
          title="Azonosítás"
          description="Gyártó, típus, dekor és méretek."
          columns={5}
        >
          <FormField
            label="Gyártó"
            htmlFor="edge-manufacturer"
            required
            error={fieldErrors.manufacturerId}
            className="xl:col-span-1"
          >
            <Select
              id="edge-manufacturer"
              value={manufacturerId}
              disabled={!canWrite}
              onChange={(e) => setManufacturerId(e.target.value)}
            >
              <option value="" disabled>
                Válassz…
              </option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Típus"
            htmlFor="edge-type"
            required
            error={fieldErrors.type}
            hint={!fieldErrors.type ? 'pl. ABS' : undefined}
          >
            <Input
              id="edge-type"
              value={type}
              disabled={!canWrite}
              onChange={(e) => setType(e.target.value)}
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Dekor"
            htmlFor="edge-decor"
            required
            error={fieldErrors.decor}
            hint={!fieldErrors.decor ? 'pl. U708' : undefined}
          >
            <Input
              id="edge-decor"
              value={decor}
              disabled={!canWrite}
              onChange={(e) => setDecor(e.target.value)}
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Szélesség"
            htmlFor="edge-width"
            required
            error={fieldErrors.widthMm}
          >
            <div className="relative">
              <Input
                id="edge-width"
                value={widthRaw}
                disabled={!canWrite}
                onChange={(e) => setWidthRaw(e.target.value)}
                inputMode="decimal"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>

          <FormField
            label="Vastagság"
            htmlFor="edge-thickness"
            required
            error={fieldErrors.thicknessMm}
          >
            <div className="relative">
              <Input
                id="edge-thickness"
                value={thicknessRaw}
                disabled={!canWrite}
                onChange={(e) => setThicknessRaw(e.target.value)}
                inputMode="decimal"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>
        </FormSection>

        <FormSection
          title="Ár és állapot"
          description="Bruttó árat írj; a nettó az adónemből számolódik."
          columns={4}
        >
          <FormField
            label="Bruttó ár"
            htmlFor="edge-gross"
            required
            error={fieldErrors.priceNet}
            hint={!fieldErrors.priceNet ? 'pl. 890' : undefined}
          >
            <div className="relative">
              <Input
                id="edge-gross"
                value={grossRaw}
                disabled={!canWrite}
                onChange={(e) => setGrossRaw(e.target.value)}
                inputMode="decimal"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                Ft
              </span>
            </div>
          </FormField>

          <FormField
            label="Adónem"
            htmlFor="edge-tax"
            required
            error={fieldErrors.taxRateId}
          >
            <Select
              id="edge-tax"
              value={taxRateId}
              disabled={!canWrite}
              onChange={(e) => setTaxRateId(e.target.value)}
            >
              <option value="" disabled>
                Válassz…
              </option>
              {taxRates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatHuNumber(t.rate_percent)}%)
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Nettó (számított)"
            htmlFor="edge-net"
            hint="Csak olvasható"
          >
            <Input
              id="edge-net"
              value={priceNet !== null ? formatMoneyFt(priceNet) : '—'}
              readOnly
              disabled
              tabIndex={-1}
            />
          </FormField>

          <div className="flex items-end pb-0.5">
            <Switch
              id="edge-active"
              checked={active}
              disabled={!canWrite}
              onCheckedChange={setActive}
              label="Aktív"
              description="Inaktív = kimarad az optiból."
            />
          </div>
        </FormSection>

        <FormSection
          title="Gyártás"
          description="Opti ráhagyás milliméterben."
          columns={4}
        >
          <FormField
            label="Ráhagyás"
            htmlFor="edge-allowance"
            error={fieldErrors.allowanceMm}
            hint={!fieldErrors.allowanceMm ? 'Alap: 0' : undefined}
          >
            <div className="relative">
              <Input
                id="edge-allowance"
                value={allowanceRaw}
                disabled={!canWrite}
                onChange={(e) => setAllowanceRaw(e.target.value)}
                inputMode="numeric"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>
        </FormSection>

        <FormSection
          title="Export beállítások"
          description="Berendezés és gépkód — az Excel Él Azon oszlopába kerül."
          columns={4}
        >
          <FormField
            label="Berendezés"
            htmlFor="edge-equipment"
            required
            error={fieldErrors.equipmentId}
            className="lg:col-span-2"
          >
            <Select
              id="edge-equipment"
              value={equipmentId}
              disabled={!canWrite}
              onChange={(e) => {
                setEquipmentId(e.target.value)
                if (fieldErrors.equipmentId) {
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.equipmentId
                    return next
                  })
                }
              }}
            >
              <option value="" disabled>
                Válassz…
              </option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Gépkód"
            htmlFor="edge-machine"
            required
            error={fieldErrors.machineCode}
            hint={!fieldErrors.machineCode ? 'pl. EDGE01' : undefined}
            className="lg:col-span-2"
          >
            <Input
              id="edge-machine"
              value={machineCode}
              disabled={!canWrite}
              onChange={(e) => setMachineCode(e.target.value)}
              autoComplete="off"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Kedvenc sorrend"
          description="Listában / kiválasztáskor kisebb szám = előrébb."
          columns={4}
        >
          <FormField
            label="Sorrend"
            htmlFor="edge-favourite"
            optionalLabel
            error={fieldErrors.favouritePriority}
            hint={
              !fieldErrors.favouritePriority
                ? 'Üres = nincs kedvenc'
                : undefined
            }
          >
            <Input
              id="edge-favourite"
              value={favouriteRaw}
              disabled={!canWrite}
              onChange={(e) => setFavouriteRaw(e.target.value)}
              inputMode="numeric"
            />
          </FormField>
        </FormSection>

        {canWrite && !missingDeps ? (
          <div className="sticky bottom-0 z-10 flex justify-end gap-1.5 border-t border-border bg-app/95 py-3 backdrop-blur-sm">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => router.push('/torzsadatok/alapanyagok/elzarok')}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSave}>
              Élzáró mentése
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
