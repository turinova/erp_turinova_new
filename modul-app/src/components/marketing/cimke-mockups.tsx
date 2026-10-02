'use client'

import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'

import { ProductLabelSheet } from '@/components/labels/product-label-sheet'
import { LABEL_TEMPLATES } from '@/lib/labels/layout'
import type { LabelFields, ProductLabelPayload } from '@/lib/labels/types'
import { cn } from '@/lib/utils'

/**
 * Statikus UI-másolat: címkenyomtatás dialóg (`ProductLabelPrintDialog`).
 * Belépés: terméklista Printer gomb. Crop: nincs név/ár/példány form,
 * nincs scroll, nincs DB, nincs interaktivitás.
 */

const PAYLOAD: ProductLabelPayload = {
  id: 'mock-1',
  name: 'Blum soft-close',
  sku: 'BL-SC-35',
  barcode: '5991234567890',
  barcodeInternal: null,
  priceGross: 4_890,
  unitShortform: 'db'
}

/** Polc sablon — egyezik a marketing bulletökkel (név, ár, vonalkód). */
const FIELDS: LabelFields = LABEL_TEMPLATES.find((t) => t.id === 'shelf')!.fields(
  true
)

const FIELD_CHIPS: Array<{ key: keyof LabelFields; label: string }> = [
  { key: 'showName', label: 'Név' },
  { key: 'showSku', label: 'SKU' },
  { key: 'showPrice', label: 'Ár' },
  { key: 'showBarcode', label: 'Vonalkód' }
]

function AppFrame({
  path,
  children,
  className
}: {
  path: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-app shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-ink-muted">
          {path}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export function CimkeNyomtatasMockup({ className }: { className?: string }) {
  return (
    <AppFrame
      path="turinova.hu/torzsadatok/alapanyagok/termekek"
      className={className}
    >
      <div
        className="pointer-events-none select-none overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        aria-hidden
      >
        <div className="space-y-1 border-b border-border px-4 py-3">
          <p className="text-[15px] font-semibold leading-none text-ink">
            Címke nyomtatása
          </p>
          <p className="text-[12.5px] text-ink-secondary">
            Az előnézet élőben követi a beállításokat. Kikapcsolt mezőknél a
            vonalkód nagyobb helyet kap.
          </p>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-stone-50 p-4">
            <p className="text-hint text-ink-secondary">Előnézet · 33×25 mm</p>
            <div className="rounded-md border border-border bg-white p-3 shadow-sm">
              <ProductLabelSheet
                payload={PAYLOAD}
                fields={FIELDS}
                productName={PAYLOAD.name}
                price={PAYLOAD.priceGross}
                unitShortform={PAYLOAD.unitShortform}
                size="33x25"
                mode="preview"
                previewScale={7.5}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <fieldset className="space-y-1.5">
              <legend className="text-label font-medium text-ink">Sablon</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {LABEL_TEMPLATES.map((tpl) => {
                  const active = tpl.id === 'shelf'
                  return (
                    <span
                      key={tpl.id}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-left',
                        active
                          ? 'border-primary bg-primary-soft'
                          : 'border-border bg-surface'
                      )}
                    >
                      <span className="block text-[13px] font-medium text-ink">
                        {tpl.label}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        {tpl.hint}
                      </span>
                    </span>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-1.5">
              <legend className="text-label font-medium text-ink">Mezők</legend>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_CHIPS.map(({ key, label }) => {
                  const on = FIELDS[key]
                  return (
                    <span
                      key={key}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
                        on
                          ? 'border-primary/30 bg-primary text-white'
                          : 'border-border bg-surface text-ink-secondary'
                      )}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-auto flex items-center justify-end gap-2 pt-1">
              <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink">
                Mégse
              </span>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-white">
                <Printer className="size-3.5" aria-hidden />
                Nyomtatás
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
