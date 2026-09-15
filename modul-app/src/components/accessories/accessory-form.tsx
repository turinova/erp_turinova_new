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
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import {
  createAccessory,
  updateAccessory
} from '@/lib/accessories/actions'
import {
  formatHuNumber,
  formatMoneyFt,
  netFromGross,
  parseIntegerInput
} from '@/lib/accessories/parse'
import type {
  AccessoryListItem,
  AccessoryManufacturerOption,
  AccessoryTaxOption,
  AccessoryUnitOption
} from '@/lib/accessories/queries'

const LIST_PATH = '/torzsadatok/alapanyagok/termekek'

type AccessoryFormProps = {
  mode: 'create' | 'edit'
  initial?: AccessoryListItem | null
  manufacturers: AccessoryManufacturerOption[]
  taxRates: AccessoryTaxOption[]
  units: AccessoryUnitOption[]
  canWrite: boolean
}

function defaultUnitId(units: AccessoryUnitOption[]): string {
  return (
    units.find((u) => u.shortform.toLowerCase() === 'db')?.id ||
    units[0]?.id ||
    ''
  )
}

export function AccessoryForm({
  mode,
  initial,
  manufacturers,
  taxRates,
  units,
  canWrite
}: AccessoryFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const defaultTaxId =
    initial?.tax_rate_id ||
    taxRates.find((t) => t.is_default)?.id ||
    taxRates[0]?.id ||
    ''

  const [name, setName] = useState(initial?.name ?? '')
  const [manufacturerId, setManufacturerId] = useState(
    initial?.manufacturer_id ?? manufacturers[0]?.id ?? ''
  )
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [barcodeInternal, setBarcodeInternal] = useState(
    initial?.barcode_internal ?? ''
  )
  const [taxRateId, setTaxRateId] = useState(defaultTaxId)
  const [unitId, setUnitId] = useState(
    initial?.unit_id ?? defaultUnitId(units)
  )
  const [grossRaw, setGrossRaw] = useState(
    initial ? String(initial.price_gross) : ''
  )
  const [active, setActive] = useState(initial?.active ?? true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const vatPercent =
    taxRates.find((t) => t.id === taxRateId)?.rate_percent ?? 0
  const selectedUnit = units.find((u) => u.id === unitId)
  const unitShort = selectedUnit?.shortform ?? 'db'
  const priceNet = useMemo(() => {
    const gross = parseIntegerInput(grossRaw)
    if (gross === null) return null
    return netFromGross(gross, vatPercent)
  }, [grossRaw, vatPercent])

  const missingDeps =
    manufacturers.length === 0 || taxRates.length === 0 || units.length === 0

  function handleSave() {
    if (!canWrite) return
    if (priceNet === null) {
      setFieldErrors({ priceNet: 'Érvényes bruttó árat adj meg.' })
      toast.error('Ellenőrizd a megadott adatokat.')
      return
    }

    startTransition(async () => {
      const payload = {
        name,
        manufacturerId,
        sku,
        barcode,
        barcodeInternal,
        taxRateId,
        unitId,
        priceNet,
        active
      }
      const result =
        mode === 'edit' && initial
          ? await updateAccessory({ ...payload, id: initial.id })
          : await createAccessory(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(mode === 'edit' ? 'Termék mentve.' : 'Termék létrehozva.')
      setFieldErrors({})
      router.push(`${LIST_PATH}/${result.id}`)
      router.refresh()
    })
  }

  const title =
    mode === 'edit'
      ? initial
        ? initial.name
        : 'Termék'
      : 'Új termék'

  return (
    <div className="pb-14">
      <PageHeader
        title={title}
        description="Törzsadatok → Alapanyagok → Termékek"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(LIST_PATH)}
            >
              Vissza a listához
            </Button>
            {canWrite && !missingDeps ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Termék mentése
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
          Termék felviteléhez előbb kell legalább egy{' '}
          <Link
            href="/torzsadatok/rendszer/gyartok"
            className="underline underline-offset-2"
          >
            gyártó
          </Link>
          ,{' '}
          <Link
            href="/torzsadatok/rendszer/adonem"
            className="underline underline-offset-2"
          >
            adónem
          </Link>{' '}
          és{' '}
          <Link
            href="/torzsadatok/rendszer/egysegek"
            className="underline underline-offset-2"
          >
            egység
          </Link>
          .
        </p>
      ) : null}

      {!canWrite ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary"
          role="status"
        >
          Csak olvasási jogod van — a mezők nem szerkeszthetők.
        </p>
      ) : null}

      <div className="w-full max-w-6xl space-y-2.5">
        <FormSection
          title="Azonosítás"
          description="Név, gyártó, SKU és vonalkódok."
          columns={4}
        >
          <FormField
            label="Termék neve"
            htmlFor="accessory-name"
            required
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="accessory-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoFocus={mode === 'create'}
              disabled={pending || !canWrite}
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Gyártó"
            htmlFor="accessory-manufacturer"
            required
            error={fieldErrors.manufacturerId}
          >
            <MenuSelect
              id="accessory-manufacturer"
              value={manufacturerId}
              disabled={pending || !canWrite}
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
            label="SKU"
            htmlFor="accessory-sku"
            required
            error={fieldErrors.sku}
          >
            <Input
              id="accessory-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              maxLength={100}
              disabled={pending || !canWrite}
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Gyártói vonalkód"
            htmlFor="accessory-barcode"
            optionalLabel
            error={fieldErrors.barcode}
          >
            <Input
              id="accessory-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              maxLength={64}
              disabled={pending || !canWrite}
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Belső vonalkód"
            htmlFor="accessory-barcode-internal"
            optionalLabel
            error={fieldErrors.barcodeInternal}
          >
            <Input
              id="accessory-barcode-internal"
              value={barcodeInternal}
              onChange={(e) => setBarcodeInternal(e.target.value)}
              maxLength={64}
              disabled={pending || !canWrite}
              autoComplete="off"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Árazás"
          description="Egység, bruttó ár és adónem. A nettó számított."
          columns={4}
        >
          <FormField
            label="Egység"
            htmlFor="accessory-unit"
            required
            error={fieldErrors.unitId}
          >
            <MenuSelect
              id="accessory-unit"
              value={unitId}
              disabled={pending || !canWrite}
              allowEmpty={false}
              placeholder="Válassz…"
              options={units.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.shortform})`
              }))}
              onChange={setUnitId}
            />
          </FormField>

          <FormField
            label="Bruttó ár"
            htmlFor="accessory-gross"
            required
            error={fieldErrors.priceNet}
            hint={!fieldErrors.priceNet ? `Ft / ${unitShort}` : undefined}
          >
            <div className="relative">
              <Input
                id="accessory-gross"
                value={grossRaw}
                onChange={(e) => setGrossRaw(e.target.value)}
                inputMode="numeric"
                disabled={pending || !canWrite}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                Ft
              </span>
            </div>
          </FormField>

          <FormField
            label="Adónem"
            htmlFor="accessory-tax"
            required
            error={fieldErrors.taxRateId}
          >
            <MenuSelect
              id="accessory-tax"
              value={taxRateId}
              disabled={pending || !canWrite}
              allowEmpty={false}
              placeholder="Válassz…"
              options={taxRates.map((t) => ({
                value: t.id,
                label: `${t.name} (${formatHuNumber(t.rate_percent)}%)`
              }))}
              onChange={setTaxRateId}
            />
          </FormField>

          <FormField label="Nettó" htmlFor="accessory-net" hint="Számított">
            <Input
              id="accessory-net"
              value={priceNet !== null ? formatMoneyFt(priceNet) : '—'}
              readOnly
              disabled
              tabIndex={-1}
            />
          </FormField>

          <div className="sm:col-span-2">
            <Switch
              id="accessory-active"
              checked={active}
              disabled={pending || !canWrite}
              onCheckedChange={setActive}
              label="Aktív"
              description="Inaktív termék később nem választható az ajánlaton."
            />
          </div>
        </FormSection>
      </div>
    </div>
  )
}
