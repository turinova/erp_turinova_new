'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { SheetMaterialImageField } from '@/components/sheet-materials/sheet-material-image-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  createSheetMaterial,
  updateSheetMaterial
} from '@/lib/sheet-materials/actions'
import {
  boardNetFromPricePerSqm,
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  netFromGross,
  parseDecimalInput,
  parseIntegerInput,
  squareMeters
} from '@/lib/sheet-materials/parse'
import type { SheetMaterialDetail } from '@/lib/sheet-materials/queries'
import {
  ORPHAN_EQUIPMENT_MESSAGE,
  resolveAliveEquipmentId
} from '@/lib/equipment/resolve-alive'

type Option = { id: string; name: string }
type OptionTaxRate = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

type SheetMaterialFormProps = {
  mode: 'create' | 'edit'
  initial?: SheetMaterialDetail | null
  tenantId: string
  manufacturers: Option[]
  equipment: Option[]
  taxRates: OptionTaxRate[]
  canWrite: boolean
}

export function SheetMaterialForm({
  mode,
  initial,
  tenantId,
  manufacturers,
  equipment,
  taxRates,
  canWrite
}: SheetMaterialFormProps) {
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
  const [name, setName] = useState(initial?.name ?? '')
  const [lengthRaw, setLengthRaw] = useState(
    initial ? String(initial.length_mm) : '2800'
  )
  const [widthRaw, setWidthRaw] = useState(
    initial ? String(initial.width_mm) : '2070'
  )
  const [thicknessRaw, setThicknessRaw] = useState(
    initial
      ? formatHuNumber(initial.thickness_mm).replace(/\s/g, '')
      : '18'
  )
  const [onStock, setOnStock] = useState(initial?.on_stock ?? true)
  const [active, setActive] = useState(initial?.active ?? true)
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.image_url ?? null
  )

  const [trimTopRaw, setTrimTopRaw] = useState(
    String(initial?.trim_top_mm ?? 0)
  )
  const [trimRightRaw, setTrimRightRaw] = useState(
    String(initial?.trim_right_mm ?? 0)
  )
  const [trimBottomRaw, setTrimBottomRaw] = useState(
    String(initial?.trim_bottom_mm ?? 0)
  )
  const [trimLeftRaw, setTrimLeftRaw] = useState(
    String(initial?.trim_left_mm ?? 0)
  )
  const [kerfRaw, setKerfRaw] = useState(String(initial?.kerf_mm ?? 3))
  const [wasteRaw, setWasteRaw] = useState(
    initial
      ? formatHuNumber(initial.waste_multi).replace(/\s/g, '')
      : '1,2'
  )
  const [usagePercentRaw, setUsagePercentRaw] = useState(
    initial
      ? String(Math.round(initial.usage_limit * 100))
      : '65'
  )
  const [grainDirection, setGrainDirection] = useState(
    initial?.grain_direction ?? false
  )
  const [rotatable, setRotatable] = useState(initial?.rotatable ?? true)
  const [machineCode, setMachineCode] = useState(initial?.machine_code ?? '')
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

  const lengthMm = parseIntegerInput(lengthRaw)
  const widthMm = parseIntegerInput(widthRaw)

  const boardPreview = useMemo(() => {
    if (priceNet === null || lengthMm === null || widthMm === null) {
      return null
    }
    const sqm = squareMeters(lengthMm, widthMm)
    const boardNet = boardNetFromPricePerSqm(lengthMm, widthMm, priceNet)
    const boardGross = grossFromNet(boardNet, selectedVat)
    return { sqm, boardNet, boardGross }
  }, [priceNet, lengthMm, widthMm, selectedVat])

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
        name,
        lengthMmRaw: lengthRaw,
        widthMmRaw: widthRaw,
        thicknessMmRaw: thicknessRaw,
        onStock,
        active,
        imageUrl,
        trimTopMmRaw: trimTopRaw,
        trimRightMmRaw: trimRightRaw,
        trimBottomMmRaw: trimBottomRaw,
        trimLeftMmRaw: trimLeftRaw,
        kerfMmRaw: kerfRaw,
        wasteMultiRaw: wasteRaw,
        usageLimitPercentRaw: usagePercentRaw,
        grainDirection,
        rotatable,
        priceNet,
        machineCode
      }

      const result =
        mode === 'edit' && initial
          ? await updateSheetMaterial({ id: initial.id, ...payload })
          : await createSheetMaterial(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        mode === 'edit' ? 'Táblás anyag mentve.' : 'Táblás anyag létrehozva.'
      )
      setFieldErrors({})
      router.push(`/torzsadatok/alapanyagok/tablas-anyagok/${result.id}`)
      router.refresh()
    })
  }

  const title =
    mode === 'edit'
      ? (initial?.name ?? 'Táblás anyag')
      : 'Új táblás anyag'

  return (
    <div className="pb-14">
      <PageHeader
        title={title}
        description="Törzsadatok → Alapanyagok → Táblás anyagok"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                router.push('/torzsadatok/alapanyagok/tablas-anyagok')
              }
            >
              Vissza a listához
            </Button>
            {canWrite && !missingDeps ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Anyag mentése
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
          Felvitelhez kell legalább egy{' '}
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
          description="Gyártó, név, méretek, kép és elérhetőség."
          columns={2}
        >
          <div className="col-span-full grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem] lg:items-start">
            <div className="space-y-2.5">
              <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-3">
                <FormField
                  label="Gyártó"
                  htmlFor="sheet-manufacturer"
                  required
                  error={fieldErrors.manufacturerId}
                >
                  <Select
                    id="sheet-manufacturer"
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
                  label="Anyag neve"
                  htmlFor="sheet-name"
                  required
                  error={fieldErrors.name}
                  className="sm:col-span-2"
                >
                  <Input
                    id="sheet-name"
                    value={name}
                    disabled={!canWrite}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                  />
                </FormField>

                <FormField
                  label="Hossz"
                  htmlFor="sheet-length"
                  required
                  error={fieldErrors.lengthMm}
                >
                  <div className="relative">
                    <Input
                      id="sheet-length"
                      value={lengthRaw}
                      disabled={!canWrite}
                      onChange={(e) => setLengthRaw(e.target.value)}
                      inputMode="numeric"
                      className="pr-10"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                      mm
                    </span>
                  </div>
                </FormField>

                <FormField
                  label="Szélesség"
                  htmlFor="sheet-width"
                  required
                  error={fieldErrors.widthMm}
                >
                  <div className="relative">
                    <Input
                      id="sheet-width"
                      value={widthRaw}
                      disabled={!canWrite}
                      onChange={(e) => setWidthRaw(e.target.value)}
                      inputMode="numeric"
                      className="pr-10"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                      mm
                    </span>
                  </div>
                </FormField>

                <FormField
                  label="Vastagság"
                  htmlFor="sheet-thickness"
                  required
                  error={fieldErrors.thicknessMm}
                >
                  <div className="relative">
                    <Input
                      id="sheet-thickness"
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
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-app p-2.5">
                  <Switch
                    id="sheet-active"
                    checked={active}
                    disabled={!canWrite}
                    onCheckedChange={setActive}
                    label="Aktív"
                    description="Megjelenik a listában és az optimalizálásban."
                  />
                </div>
                <div className="rounded-md border border-border bg-app p-2.5">
                  <Switch
                    id="sheet-on-stock"
                    checked={onStock}
                    disabled={!canWrite}
                    onCheckedChange={setOnStock}
                    label="Raktáron"
                    description="Jelzi, hogy van belőle készleten (még nincs készletmozgás)."
                  />
                </div>
              </div>
            </div>

            <FormField
              label="Kép"
              htmlFor="sheet-image"
              optionalLabel
              error={fieldErrors.imageUrl}
              className="lg:justify-self-end"
            >
              <SheetMaterialImageField
                tenantId={tenantId}
                value={imageUrl}
                onChange={setImageUrl}
                disabled={!canWrite}
                showGrainHint={grainDirection}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Árazás"
          description="Bruttó Ft/m²; a nettó és a tábla ár automatikusan számolódik."
          columns={4}
        >
          <FormField
            label="Bruttó ár / m²"
            htmlFor="sheet-gross"
            required
            error={fieldErrors.priceNet}
            hint={!fieldErrors.priceNet ? 'pl. 8900' : undefined}
          >
            <div className="relative">
              <Input
                id="sheet-gross"
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
            htmlFor="sheet-tax"
            required
            error={fieldErrors.taxRateId}
          >
            <Select
              id="sheet-tax"
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
            label="Nettó / m²"
            htmlFor="sheet-net"
            hint="Számított"
            className="lg:col-span-2"
          >
            <Input
              id="sheet-net"
              value={priceNet !== null ? formatMoneyFt(priceNet) : '—'}
              readOnly
              disabled
              tabIndex={-1}
            />
          </FormField>

          <div className="rounded-md border border-border bg-app p-2.5 sm:col-span-2 lg:col-span-4">
            <p className="mb-1.5 text-hint text-ink-secondary">Tábla ár</p>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <div>
                <p className="text-hint text-ink-muted">Terület</p>
                <p className="text-body text-ink">
                  {boardPreview
                    ? `${formatHuNumber(boardPreview.sqm, 3)} m²`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-hint text-ink-muted">Nettó tábla</p>
                <p className="text-body font-medium text-ink">
                  {boardPreview
                    ? formatMoneyFt(boardPreview.boardNet)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-hint text-ink-muted">Bruttó tábla</p>
                <p className="text-body font-medium text-ink">
                  {boardPreview
                    ? formatMoneyFt(boardPreview.boardGross)
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Export beállítások"
          description="Berendezés és gépkód — az Excel cutting list Azonosító oszlopába kerül."
          columns={4}
        >
          <FormField
            label="Berendezés"
            htmlFor="sheet-equipment"
            required
            error={fieldErrors.equipmentId}
            className="lg:col-span-2"
          >
            <Select
              id="sheet-equipment"
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
            htmlFor="sheet-machine"
            required
            error={fieldErrors.machineCode}
            hint={!fieldErrors.machineCode ? 'pl. MAT01' : undefined}
            className="lg:col-span-2"
          >
            <Input
              id="sheet-machine"
              value={machineCode}
              disabled={!canWrite}
              onChange={(e) => setMachineCode(e.target.value)}
              autoComplete="off"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Optimalizálás"
          description="Általában a gyári alap elég; csak opti hiba esetén módosítsd."
          columns={4}
        >
          <p className="col-span-full text-hint font-medium text-ink-secondary">
            Szélezés
          </p>

          <FormField
            label="Felső trim"
            htmlFor="sheet-trim-top"
            error={fieldErrors.trimTopMm}
          >
            <div className="relative">
              <Input
                id="sheet-trim-top"
                value={trimTopRaw}
                disabled={!canWrite}
                onChange={(e) => setTrimTopRaw(e.target.value)}
                inputMode="numeric"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>

          <FormField
            label="Jobb trim"
            htmlFor="sheet-trim-right"
            error={fieldErrors.trimRightMm}
          >
            <div className="relative">
              <Input
                id="sheet-trim-right"
                value={trimRightRaw}
                disabled={!canWrite}
                onChange={(e) => setTrimRightRaw(e.target.value)}
                inputMode="numeric"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>

          <FormField
            label="Alsó trim"
            htmlFor="sheet-trim-bottom"
            error={fieldErrors.trimBottomMm}
          >
            <div className="relative">
              <Input
                id="sheet-trim-bottom"
                value={trimBottomRaw}
                disabled={!canWrite}
                onChange={(e) => setTrimBottomRaw(e.target.value)}
                inputMode="numeric"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>

          <FormField
            label="Bal trim"
            htmlFor="sheet-trim-left"
            error={fieldErrors.trimLeftMm}
          >
            <div className="relative">
              <Input
                id="sheet-trim-left"
                value={trimLeftRaw}
                disabled={!canWrite}
                onChange={(e) => setTrimLeftRaw(e.target.value)}
                inputMode="numeric"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>

          <p className="col-span-full text-hint font-medium text-ink-secondary">
            Vágás
          </p>

          <FormField
            label="Penge vastagság"
            htmlFor="sheet-kerf"
            error={fieldErrors.kerfMm}
          >
            <div className="relative">
              <Input
                id="sheet-kerf"
                value={kerfRaw}
                disabled={!canWrite}
                onChange={(e) => setKerfRaw(e.target.value)}
                inputMode="numeric"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                mm
              </span>
            </div>
          </FormField>

          <FormField
            label="Hulladékszorzó"
            htmlFor="sheet-waste"
            error={fieldErrors.wasteMulti}
            hint={!fieldErrors.wasteMulti ? 'Alap: 1,2' : undefined}
          >
            <Input
              id="sheet-waste"
              value={wasteRaw}
              disabled={!canWrite}
              onChange={(e) => setWasteRaw(e.target.value)}
              inputMode="decimal"
            />
          </FormField>

          <FormField
            label="Kihasználtság küszöb"
            htmlFor="sheet-usage"
            error={fieldErrors.usageLimit}
            hint={!fieldErrors.usageLimit ? 'Alap: 65%' : undefined}
            className="lg:col-span-2"
          >
            <div className="relative">
              <Input
                id="sheet-usage"
                value={usagePercentRaw}
                disabled={!canWrite}
                onChange={(e) => setUsagePercentRaw(e.target.value)}
                inputMode="decimal"
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                %
              </span>
            </div>
          </FormField>

          <p className="col-span-full text-hint font-medium text-ink-secondary">
            Irány
          </p>

          <div className="col-span-full flex flex-col gap-3 sm:flex-row sm:gap-8">
            <Switch
              id="sheet-grain"
              checked={grainDirection}
              disabled={!canWrite}
              onCheckedChange={setGrainDirection}
              label="Szálirány"
              description="Figyelembe veszi a szálirányt az optinál."
            />
            <Switch
              id="sheet-rotatable"
              checked={rotatable}
              disabled={!canWrite}
              onCheckedChange={setRotatable}
              label="Forgatható"
              description="A darabok elforgathatók a táblán."
            />
          </div>
        </FormSection>

        {canWrite && !missingDeps ? (
          <div className="sticky bottom-0 z-10 flex justify-end gap-1.5 border-t border-border bg-app/95 py-3 backdrop-blur-sm">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                router.push('/torzsadatok/alapanyagok/tablas-anyagok')
              }
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSave}>
              Anyag mentése
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
