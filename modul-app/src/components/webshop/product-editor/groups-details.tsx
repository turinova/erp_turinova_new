'use client'

import { ImageIcon, X } from 'lucide-react'
import { useState } from 'react'

import { MediaPickerDialog } from '@/components/media/media-picker-dialog'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { countryOptions } from '@/lib/geo/countries'
import { NET_UNIT_LABEL, NET_UNITS } from '@/lib/storefront/unit-price'

import type { GroupProps } from './groups-content'
import { ListEditor, PriceTierEditor } from './list-editor'

const COUNTRY_OPTIONS = countryOptions().map((c) => ({
  value: c.code,
  label: c.name,
  group: c.common ? 'Gyakori' : 'Összes ország'
}))

function UnitInput({
  id,
  value,
  onChange,
  unit,
  disabled
}: {
  id: string
  value: string
  onChange: (v: string) => void
  unit: string
  disabled: boolean
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        disabled={disabled}
        className="pr-10"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
        {unit}
      </span>
    </div>
  )
}

export function PackagingGroup({
  web,
  patch,
  disabled,
  fieldErrors,
  unitShortform
}: GroupProps & { unitShortform: string }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        <FormField
          label="Nettó tartalom"
          htmlFor="shop-net-qty"
          optionalLabel
          error={fieldErrors.webNetQuantity}
          hint="Pl. 400 ml vagy 3 kg. Ebből számoljuk a literenkénti / kilónkénti árat."
        >
          <div className="flex gap-1.5">
            <Input
              id="shop-net-qty"
              value={web.netQuantityRaw}
              onChange={(e) => patch({ netQuantityRaw: e.target.value })}
              inputMode="decimal"
              disabled={disabled}
              className="min-w-0 flex-1"
            />
            <MenuSelect
              id="shop-net-unit"
              value={web.netUnit}
              onChange={(v) => patch({ netUnit: v })}
              disabled={disabled}
              placeholder="Egység"
              emptyLabel="Nincs"
              className="w-28 shrink-0"
              options={NET_UNITS.map((u) => ({ value: u, label: NET_UNIT_LABEL[u] }))}
            />
          </div>
        </FormField>
        <FormField
          label="Hány darab van egy csomagban"
          htmlFor="shop-multipack"
          optionalLabel
          error={fieldErrors.webMultipack}
          hint="Csak ha egy eladott egységben több ugyanolyan darab van (pl. 6 db-os csomag)."
        >
          <Input
            id="shop-multipack"
            value={web.multipackRaw}
            onChange={(e) => patch({ multipackRaw: e.target.value.replace(/[^\d]/g, '') })}
            inputMode="numeric"
            disabled={disabled}
          />
        </FormField>
      </div>

      <Switch
        id="shop-bundle"
        checked={web.isBundle}
        disabled={disabled}
        onCheckedChange={(v) => patch({ isBundle: v })}
        label="Csomagajánlat"
        description="Több különböző termék egy áron. Sorold fel őket alább a csomag tartalmánál."
      />

      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        <FormField
          label="Mi van a dobozban"
          htmlFor="shop-box"
          optionalLabel
          hint="Egy sor = egy tétel. Pl. „2 db M4×25 csavar”."
        >
          <ListEditor
            id="shop-box"
            value={web.boxContentsRaw}
            onChange={(v) => patch({ boxContentsRaw: v })}
            disabled={disabled}
            addLabel="Új tétel"
            placeholder="1 db zsanér"
          />
        </FormField>
        <FormField
          label="Mennyiségi ár"
          htmlFor="shop-tiers"
          optionalLabel
          error={fieldErrors.webPriceTiers}
          hint="Több darab vásárlásakor olcsóbb egységár. Nettó forintban."
        >
          <PriceTierEditor
            value={web.priceTiersRaw}
            onChange={(v) => patch({ priceTiersRaw: v })}
            disabled={disabled}
            unit={unitShortform}
          />
        </FormField>
        <FormField
          label="Listaár (bruttó)"
          htmlFor="shop-compare"
          optionalLabel
          error={fieldErrors.webCompareAtPrice}
          hint="Nem jelenik meg áthúzva. Árcsökkentéskor a bolt magától az előző 30 nap legalacsonyabb árát mutatja."
        >
          <UnitInput
            id="shop-compare"
            value={web.compareAtRaw}
            onChange={(v) => patch({ compareAtRaw: v.replace(/[^\d]/g, '') })}
            unit="Ft"
            disabled={disabled}
          />
        </FormField>
      </div>
    </div>
  )
}

export function DimensionsGroup({
  web,
  patch,
  disabled,
  tenantId
}: GroupProps & { tenantId: string }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const dims = [
    ['productLengthRaw', 'Hossz', 'cm'],
    ['productWidthRaw', 'Szélesség', 'cm'],
    ['productHeightRaw', 'Magasság', 'cm'],
    ['productWeightRaw', 'Súly', 'kg']
  ] as const
  const ship = [
    ['shippingLengthRaw', 'Hossz', 'cm'],
    ['shippingWidthRaw', 'Szélesség', 'cm'],
    ['shippingHeightRaw', 'Magasság', 'cm'],
    ['shippingWeightRaw', 'Súly', 'kg']
  ] as const

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-label font-semibold text-ink">A termék mérete</p>
        <p className="text-hint text-ink-secondary">
          Csak akkor add meg, ha pontosan tudod — a termékoldal műszaki adatai között jelenik meg.
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 lg:grid-cols-4">
          {dims.map(([key, label, unit]) => (
            <FormField key={key} label={label} htmlFor={`shop-${key}`} optionalLabel>
              <UnitInput
                id={`shop-${key}`}
                value={web[key]}
                onChange={(v) => patch({ [key]: v })}
                unit={unit}
                disabled={disabled}
              />
            </FormField>
          ))}
        </div>
      </div>

      <FormField
        label="Méretrajz"
        htmlFor="shop-dimension-image"
        optionalLabel
        hint="Méretezett rajz vagy fotó. A kulcsadatok mellett jelenik meg."
      >
        {web.dimensionImageUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={web.dimensionImageUrl}
              alt="Méretrajz"
              className="size-16 rounded border border-border bg-surface object-contain"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => setPickerOpen(true)}
            >
              Csere
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => patch({ dimensionImageUrl: '' })}
            >
              <X className="size-3.5" aria-hidden />
              Eltávolítás
            </Button>
          </div>
        ) : (
          <Button
            id="shop-dimension-image"
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            <ImageIcon className="size-3.5" aria-hidden />
            Méretrajz kiválasztása
          </Button>
        )}
      </FormField>

      <div className="space-y-1.5">
        <p className="text-label font-semibold text-ink">Szállítási csomag</p>
        <p className="text-hint text-ink-secondary">
          A becsomagolt termék. Ha üresen hagyod, a bolt beállításaiban megadott alapméret számít.
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 lg:grid-cols-4">
          {ship.map(([key, label, unit]) => (
            <FormField key={key} label={label} htmlFor={`shop-${key}`} optionalLabel>
              <UnitInput
                id={`shop-${key}`}
                value={web[key]}
                onChange={(v) => patch({ [key]: v })}
                unit={unit}
                disabled={disabled}
              />
            </FormField>
          ))}
        </div>
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tenantId={tenantId}
        onSelect={(url) => {
          patch({ dimensionImageUrl: url })
          setPickerOpen(false)
        }}
      />
    </div>
  )
}

export function CompositionGroup({ web, patch, disabled, fieldErrors }: GroupProps) {
  return (
    <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
      <FormField
        label="Összetevők, anyag"
        htmlFor="shop-ingredients"
        optionalLabel
        hint="Élelmiszer: összetevők és allergének. Kozmetikum: INCI lista. Ruha: anyagösszetétel."
      >
        <Textarea
          id="shop-ingredients"
          value={web.ingredients}
          onChange={(e) => patch({ ingredients: e.target.value })}
          rows={3}
          maxLength={4000}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label="Használat, ápolás"
        htmlFor="shop-usage"
        optionalLabel
        hint="Hogyan kell használni, adagolni, tisztítani."
      >
        <Textarea
          id="shop-usage"
          value={web.usage}
          onChange={(e) => patch({ usage: e.target.value })}
          rows={3}
          maxLength={4000}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label="Figyelmeztetés"
        htmlFor="shop-safety"
        optionalLabel
        hint="Pl. „Gyermekek elől elzárva tartandó — apró alkatrészek.”"
      >
        <Textarea
          id="shop-safety"
          value={web.safetyInfo}
          onChange={(e) => patch({ safetyInfo: e.target.value })}
          rows={2}
          maxLength={2000}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label="Hol gyártották"
        htmlFor="shop-origin"
        optionalLabel
        error={fieldErrors.webCountryOfOrigin}
        hint="A termékoldalon és a keresőknek átadott adatokban jelenik meg."
      >
        <MenuSelect
          id="shop-origin"
          value={web.countryOfOrigin}
          onChange={(v) => patch({ countryOfOrigin: v })}
          disabled={disabled}
          placeholder="Válassz országot"
          emptyLabel="Nincs megadva"
          searchable
          searchPlaceholder="Ország keresése"
          options={COUNTRY_OPTIONS}
        />
      </FormField>
    </div>
  )
}
