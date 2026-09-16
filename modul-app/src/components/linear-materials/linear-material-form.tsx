'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { LinearMaterialImageField } from '@/components/linear-materials/linear-material-image-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import {
  parseOptionalPurchaseMargin,
  sellGrossFromPurchase
} from '@/lib/pricing/margin'
import {
  createLinearMaterial,
  updateLinearMaterial
} from '@/lib/linear-materials/actions'
import {
  LINEAR_MATERIAL_TYPES,
  LINEAR_MATERIAL_TYPE_LABELS,
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  netFromGross,
  parseDecimalInput,
  type LinearMaterialType
} from '@/lib/linear-materials/parse'
import type { LinearMaterialDetail } from '@/lib/linear-materials/queries'

type Option = { id: string; name: string }
type OptionTaxRate = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

type LinearMaterialFormProps = {
  mode: 'create' | 'edit'
  initial?: LinearMaterialDetail | null
  tenantId: string
  manufacturers: Option[]
  taxRates: OptionTaxRate[]
  canWrite: boolean
}

export function LinearMaterialForm({
  mode,
  initial,
  tenantId,
  manufacturers,
  taxRates,
  canWrite
}: LinearMaterialFormProps) {
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
  const [name, setName] = useState(initial?.name ?? '')
  const [materialType, setMaterialType] = useState<LinearMaterialType>(
    initial?.material_type ?? 'munkalap'
  )
  const [lengthRaw, setLengthRaw] = useState(
    initial ? String(initial.length_mm) : '4100'
  )
  const [widthRaw, setWidthRaw] = useState(
    initial ? String(initial.width_mm) : '600'
  )
  const [thicknessRaw, setThicknessRaw] = useState(
    initial
      ? formatHuNumber(initial.thickness_mm).replace(/\s/g, '')
      : '36'
  )
  const [onStock, setOnStock] = useState(initial?.on_stock ?? true)
  const [active, setActive] = useState(initial?.active ?? true)
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.image_url ?? null
  )

  const initialVat =
    taxRates.find((t) => t.id === (initial?.tax_rate_id || defaultTaxId))
      ?.rate_percent ?? 27
  const initialGross = initial
    ? grossFromNet(initial.price_net, initialVat)
    : 0
  const [grossRaw, setGrossRaw] = useState(
    initialGross > 0 ? String(initialGross) : ''
  )
  const [purchaseRaw, setPurchaseRaw] = useState(
    initial?.purchase_price_net != null
      ? String(initial.purchase_price_net)
      : ''
  )
  const [marginRaw, setMarginRaw] = useState(
    initial?.margin_factor != null ? String(initial.margin_factor) : ''
  )

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const vatPercent =
    taxRates.find((t) => t.id === taxRateId)?.rate_percent ?? 0
  const grossValue = parseDecimalInput(grossRaw)
  const priceNet =
    grossValue === null ? null : netFromGross(grossValue, vatPercent)

  const missingDeps = manufacturers.length === 0 || taxRates.length === 0

  function handleSave() {
    if (priceNet === null) {
      setFieldErrors({ priceNet: 'Érvényes bruttó árat adj meg.' })
      toast.error('Ellenőrizd a megadott adatokat.')
      return
    }

    const purchaseParsed = parseOptionalPurchaseMargin(purchaseRaw, marginRaw)
    if (!purchaseParsed.ok) {
      setFieldErrors(purchaseParsed.fieldErrors)
      toast.error('Ellenőrizd a beszerzési árat / árrés szorzót.')
      return
    }

    startTransition(async () => {
      const payload = {
        manufacturerId,
        taxRateId,
        name,
        materialType,
        lengthMmRaw: lengthRaw,
        widthMmRaw: widthRaw,
        thicknessMmRaw: thicknessRaw,
        onStock,
        active,
        imageUrl,
        priceNet,
        purchasePriceNet: purchaseParsed.purchasePriceNet,
        marginFactor: purchaseParsed.marginFactor
      }

      const result =
        mode === 'edit' && initial
          ? await updateLinearMaterial({ ...payload, id: initial.id })
          : await createLinearMaterial(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        mode === 'edit' ? 'Szálas anyag mentve.' : 'Szálas anyag létrehozva.'
      )
      router.push(`/torzsadatok/alapanyagok/szalas-anyagok/${result.id}`)
      router.refresh()
    })
  }

  return (
    <div>
      <PageHeader
        title={mode === 'edit' ? name || 'Szálas anyag' : 'Új szálas anyag'}
        description="Törzsadatok → Alapanyagok → Szálas anyagok"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                router.push('/torzsadatok/alapanyagok/szalas-anyagok')
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
          </Link>{' '}
          és egy{' '}
          <Link
            href="/torzsadatok/rendszer/adonem"
            className="underline underline-offset-2"
          >
            adónem
          </Link>
          .
        </p>
      ) : null}

      <div className="w-full max-w-6xl space-y-2.5">
        <FormSection
          title="Azonosítás"
          description="Gyártó, típus, név, méretek, kép és elérhetőség."
          columns={2}
        >
          <div className="col-span-full grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem] lg:items-start">
            <div className="space-y-2.5">
              <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
                <FormField
                  label="Gyártó"
                  htmlFor="linear-manufacturer"
                  required
                  error={fieldErrors.manufacturerId}
                >
                  <MenuSelect
                    id="linear-manufacturer"
                    value={manufacturerId}
                    disabled={!canWrite}
                    allowEmpty={false}
                    placeholder="Válassz…"
                    options={manufacturers.map((m) => ({
                      value: m.id,
                      label: m.name
                    }))}
                    onChange={setManufacturerId}
                  />
                </FormField>

                <FormField
                  label="Típus"
                  htmlFor="linear-type"
                  required
                  error={fieldErrors.materialType}
                >
                  <MenuSelect
                    id="linear-type"
                    value={materialType}
                    disabled={!canWrite}
                    allowEmpty={false}
                    options={LINEAR_MATERIAL_TYPES.map((t) => ({
                      value: t,
                      label: LINEAR_MATERIAL_TYPE_LABELS[t]
                    }))}
                    onChange={(v) =>
                      setMaterialType(v as LinearMaterialType)
                    }
                  />
                </FormField>
              </div>

              <FormField
                label="Anyag neve"
                htmlFor="linear-name"
                required
                error={fieldErrors.name}
              >
                <Input
                  id="linear-name"
                  value={name}
                  disabled={!canWrite}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </FormField>

              <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-3">
                <FormField
                  label="Hossz"
                  htmlFor="linear-length"
                  required
                  error={fieldErrors.lengthMm}
                  hint="mm"
                >
                  <Input
                    id="linear-length"
                    value={lengthRaw}
                    disabled={!canWrite}
                    onChange={(e) => setLengthRaw(e.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField
                  label="Szélesség"
                  htmlFor="linear-width"
                  required
                  error={fieldErrors.widthMm}
                  hint="mm"
                >
                  <Input
                    id="linear-width"
                    value={widthRaw}
                    disabled={!canWrite}
                    onChange={(e) => setWidthRaw(e.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField
                  label="Vastagság"
                  htmlFor="linear-thickness"
                  required
                  error={fieldErrors.thicknessMm}
                  hint="mm"
                >
                  <Input
                    id="linear-thickness"
                    value={thicknessRaw}
                    disabled={!canWrite}
                    onChange={(e) => setThicknessRaw(e.target.value)}
                    inputMode="decimal"
                  />
                </FormField>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
                <Switch
                  id="linear-active"
                  checked={active}
                  disabled={!canWrite}
                  onCheckedChange={setActive}
                  label="Aktív"
                />
                <Switch
                  id="linear-stock"
                  checked={onStock}
                  disabled={!canWrite}
                  onCheckedChange={setOnStock}
                  label="Raktáron"
                  description="Jelzi, hogy van belőle készleten."
                />
              </div>
            </div>

            <FormField
              label="Kép"
              htmlFor="linear-image"
              optionalLabel
              error={fieldErrors.imageUrl}
              className="lg:justify-self-end"
            >
              <LinearMaterialImageField
                tenantId={tenantId}
                value={imageUrl}
                onChange={setImageUrl}
                disabled={!canWrite}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Árazás"
          description="Bruttó Ft/m; opcionálisan beszerzés × árrés szorzó. A nettó automatikusan számolódik."
          columns={4}
        >
          <div className="col-span-full grid grid-cols-1 items-end gap-x-3 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <FormField
              label="Beszerzési nettó / m"
              htmlFor="linear-purchase"
              optionalLabel
              error={fieldErrors.purchasePriceNet}
            >
              <div className="relative">
                <Input
                  id="linear-purchase"
                  value={purchaseRaw}
                  disabled={!canWrite}
                  onChange={(e) => setPurchaseRaw(e.target.value)}
                  inputMode="decimal"
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                  Ft
                </span>
              </div>
            </FormField>

            <FormField
              label="Árrés szorzó"
              htmlFor="linear-margin"
              optionalLabel
              error={fieldErrors.marginFactor}
            >
              <Input
                id="linear-margin"
                value={marginRaw}
                disabled={!canWrite}
                onChange={(e) => setMarginRaw(e.target.value)}
                inputMode="decimal"
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-label select-none text-transparent"
                aria-hidden
              >
                .
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={!canWrite}
                onClick={() => {
                  const parsed = parseOptionalPurchaseMargin(
                    purchaseRaw,
                    marginRaw
                  )
                  if (!parsed.ok) {
                    setFieldErrors(parsed.fieldErrors)
                    toast.error('Ellenőrizd a beszerzési árat / szorzót.')
                    return
                  }
                  if (
                    parsed.purchasePriceNet == null ||
                    parsed.marginFactor == null
                  ) {
                    toast.error('Add meg a beszerzési nettót és a szorzót.')
                    return
                  }
                  setGrossRaw(
                    String(
                      sellGrossFromPurchase(
                        parsed.purchasePriceNet,
                        parsed.marginFactor,
                        vatPercent
                      )
                    )
                  )
                  setFieldErrors((prev) => {
                    const next = { ...prev }
                    delete next.purchasePriceNet
                    delete next.marginFactor
                    delete next.priceNet
                    return next
                  })
                  toast.success('Eladási bruttó kiszámolva.')
                }}
              >
                Eladási ár számítása
              </Button>
            </div>
          </div>

          <FormField
            label="Bruttó ár / m"
            htmlFor="linear-gross"
            required
            error={fieldErrors.priceNet}
            hint={!fieldErrors.priceNet ? 'pl. 12000' : undefined}
          >
            <div className="relative">
              <Input
                id="linear-gross"
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
            htmlFor="linear-tax"
            required
            error={fieldErrors.taxRateId}
          >
            <MenuSelect
              id="linear-tax"
              value={taxRateId}
              disabled={!canWrite}
              allowEmpty={false}
              placeholder="Válassz…"
              options={taxRates.map((t) => ({
                value: t.id,
                label: `${t.name} (${formatHuNumber(t.rate_percent)}%)`
              }))}
              onChange={setTaxRateId}
            />
          </FormField>

          <FormField
            label="Nettó / m"
            htmlFor="linear-net"
            hint="Számított"
            className="lg:col-span-2"
          >
            <Input
              id="linear-net"
              value={priceNet !== null ? formatMoneyFt(priceNet) : '—'}
              readOnly
              disabled
              tabIndex={-1}
            />
          </FormField>
        </FormSection>

        {canWrite && !missingDeps ? (
          <div className="sticky bottom-0 z-10 flex justify-end gap-1.5 border-t border-border bg-app/95 py-3 backdrop-blur-sm">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                router.push('/torzsadatok/alapanyagok/szalas-anyagok')
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
