'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { HandoverSlipPreview } from '@/components/handover-slip/handover-slip-preview'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { Button } from '@/components/ui/button'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { sampleHandoverSlipData } from '@/lib/handover-slip/build-data'
import { saveHandoverSlipSettingsAction } from '@/lib/handover-slip/actions'
import { printHandoverSlip } from '@/lib/handover-slip/print'
import { requestUsbPrinter } from '@/lib/handover-slip/webusb'
import {
  resolveSlipCopyTypes,
  type HandoverSlipCopyType,
  type HandoverSlipSettings
} from '@/lib/handover-slip/types'

type Props = {
  initial: HandoverSlipSettings
  canWrite: boolean
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="py-1">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        label={label}
        description={hint}
      />
    </div>
  )
}

export function HandoverSlipSettingsClient({ initial, canWrite }: Props) {
  const [settings, setSettings] = useState<HandoverSlipSettings>(initial)
  const [previewCopy, setPreviewCopy] =
    useState<HandoverSlipCopyType>('original')
  const [pending, startTransition] = useTransition()
  const sample = useMemo(() => sampleHandoverSlipData(), [])

  const copyTypes = resolveSlipCopyTypes(settings)
  const effectivePreview: HandoverSlipCopyType =
    copyTypes.length === 0
      ? 'customer'
      : copyTypes.includes(previewCopy)
        ? previewCopy
        : copyTypes[0]

  function patch(p: Partial<HandoverSlipSettings>) {
    setSettings((s) => ({ ...s, ...p }))
  }

  function save() {
    startTransition(async () => {
      const result = await saveHandoverSlipSettingsAction(settings)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Átvételi blokk beállítások mentve.')
    })
  }

  async function testPrint() {
    const types = resolveSlipCopyTypes(settings)
    if (types.length === 0) {
      toast.message('Példányszám: semmi — nincs mit nyomtatni.')
      return
    }
    const usb = await requestUsbPrinter()
    const result = await printHandoverSlip({
      data: sample,
      settings,
      copyTypes: types,
      usbDevice: usb
    })
    toast.success(
      result.method === 'webusb'
        ? 'Teszt blokk elküldve a nyomtatónak.'
        : 'Böngészős nyomtatás megnyitva.'
    )
  }

  const disabled = !canWrite || pending

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Átvételi blokk</h1>
          <p className="mt-1 max-w-xl text-body text-ink-secondary">
            Opti átadáskor hőnyomtatóra kerülő elismervény. A Lapszabászat része —
            kapcsold ki, ha nem kell.
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            variant="primary"
            loading={pending}
            onClick={save}
          >
            Mentés
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <FormSection title="Általános" columns={1}>
            <ToggleRow
              id="hs-enabled"
              label="Átadáskor nyomtatás"
              hint="Ha ki van kapcsolva, az átadás megy, blokk nélkül."
              checked={settings.enabled}
              disabled={disabled}
              onChange={(v) => patch({ enabled: v })}
            />
            <FormField label="Példányszám" htmlFor="hs-copies">
              <MenuSelect
                id="hs-copies"
                value={String(settings.copies)}
                disabled={disabled || !settings.enabled}
                allowEmpty={false}
                options={[
                  { value: '0', label: 'Semmi' },
                  { value: '1', label: '1 példány' },
                  { value: '2', label: '2 példány (eredeti + vevői)' }
                ]}
                onChange={(v) =>
                  patch({ copies: Number(v) as 0 | 1 | 2 })
                }
              />
            </FormField>
            {settings.copies === 1 ? (
              <FormField label="Az egy példány típusa" htmlFor="hs-single">
                <MenuSelect
                  id="hs-single"
                  value={settings.singleCopyKind}
                  disabled={disabled || !settings.enabled}
                  allowEmpty={false}
                  options={[
                    { value: 'customer', label: 'Vevői' },
                    { value: 'original', label: 'Üzleti (aláírással)' }
                  ]}
                  onChange={(v) =>
                    patch({
                      singleCopyKind: v as 'customer' | 'original'
                    })
                  }
                />
              </FormField>
            ) : null}
            <ToggleRow
              id="hs-auto"
              label="Automatikus nyomtatás átadáskor"
              checked={settings.autoOnHandover}
              disabled={disabled || !settings.enabled}
              onChange={(v) => patch({ autoOnHandover: v })}
            />
          </FormSection>

          <FormSection title="Fejléc" columns={1}>
            <ToggleRow
              id="hs-addr"
              label="Cég cím"
              checked={settings.showCompanyAddress}
              disabled={disabled}
              onChange={(v) => patch({ showCompanyAddress: v })}
            />
            <ToggleRow
              id="hs-phone"
              label="Telefon"
              checked={settings.showCompanyPhone}
              disabled={disabled}
              onChange={(v) => patch({ showCompanyPhone: v })}
            />
            <ToggleRow
              id="hs-email"
              label="E-mail"
              checked={settings.showCompanyEmail}
              disabled={disabled}
              onChange={(v) => patch({ showCompanyEmail: v })}
            />
            <ToggleRow
              id="hs-tax"
              label="Adószám"
              checked={settings.showTaxNumber}
              disabled={disabled}
              onChange={(v) => patch({ showTaxNumber: v })}
            />
            <ToggleRow
              id="hs-order"
              label="Megrendelésszám"
              checked={settings.showOrderNumber}
              disabled={disabled}
              onChange={(v) => patch({ showOrderNumber: v })}
            />
            <ToggleRow
              id="hs-cust"
              label="Ügyfél neve"
              checked={settings.showCustomerName}
              disabled={disabled}
              onChange={(v) => patch({ showCustomerName: v })}
            />
            <ToggleRow
              id="hs-bc"
              label="Vonalkód"
              checked={settings.showBarcode}
              disabled={disabled}
              onChange={(v) => patch({ showBarcode: v })}
            />
            <ToggleRow
              id="hs-dt"
              label="Nyomtatás ideje"
              checked={settings.showPrintDatetime}
              disabled={disabled}
              onChange={(v) => patch({ showPrintDatetime: v })}
            />
          </FormSection>

          <FormSection title="Tételek" columns={1}>
            <ToggleRow
              id="hs-mat"
              label="Anyagok"
              checked={settings.showMaterials}
              disabled={disabled}
              onChange={(v) => patch({ showMaterials: v })}
            />
            <ToggleRow
              id="hs-edge"
              label="Élzárás (méter)"
              hint="Anyagsorok alatt."
              checked={settings.showEdge}
              disabled={disabled || !settings.showMaterials}
              onChange={(v) => patch({ showEdge: v })}
            />
            <ToggleRow
              id="hs-svc"
              label="Szolgáltatások (pl. szabás)"
              checked={settings.showServices}
              disabled={disabled}
              onChange={(v) => patch({ showServices: v })}
            />
            <FormField label="Mennyiség formátum" htmlFor="hs-qty">
              <MenuSelect
                id="hs-qty"
                value={settings.qtyFormat}
                disabled={disabled}
                allowEmpty={false}
                options={[
                  { value: 'm2_db', label: 'm² / db' },
                  { value: 'm2_only', label: 'Csak m²' },
                  { value: 'boards_only', label: 'Csak db' }
                ]}
                onChange={(v) =>
                  patch({
                    qtyFormat: v as HandoverSlipSettings['qtyFormat']
                  })
                }
              />
            </FormField>
          </FormSection>

          <FormSection title="Jogi szöveg és aláírás" columns={1}>
            <ToggleRow
              id="hs-legal"
              label="Jogi szöveg"
              checked={settings.showLegalText}
              disabled={disabled}
              onChange={(v) => patch({ showLegalText: v })}
            />
            <FormField label="Jogi szöveg" htmlFor="hs-legal-text">
              <Textarea
                id="hs-legal-text"
                rows={4}
                value={settings.legalText}
                disabled={disabled || !settings.showLegalText}
                maxLength={800}
                onChange={(e) => patch({ legalText: e.target.value })}
              />
            </FormField>
            <ToggleRow
              id="hs-gate"
              label="Kapu szöveg (csak üzleti példány)"
              checked={settings.showGateLine}
              disabled={disabled}
              onChange={(v) => patch({ showGateLine: v })}
            />
            <FormField label="Kapu szöveg" htmlFor="hs-gate-text">
              <Textarea
                id="hs-gate-text"
                rows={2}
                value={settings.gateLineText}
                disabled={disabled || !settings.showGateLine}
                maxLength={200}
                onChange={(e) => patch({ gateLineText: e.target.value })}
              />
            </FormField>
            <ToggleRow
              id="hs-sig"
              label="Aláírás mezők (csak üzleti példány)"
              checked={settings.showSignatures}
              disabled={disabled}
              onChange={(v) => patch({ showSignatures: v })}
            />
            <FormField label="Vevői példány felirat" htmlFor="hs-cust-label">
              <input
                id="hs-cust-label"
                className="flex h-8 w-full rounded-md border border-border bg-canvas px-2 text-body text-ink"
                value={settings.customerCopyLabel}
                disabled={disabled}
                maxLength={40}
                onChange={(e) => patch({ customerCopyLabel: e.target.value })}
              />
            </FormField>
          </FormSection>
        </div>

        <div className="space-y-3 lg:sticky lg:top-16 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body font-medium text-ink">Előnézet</p>
            {copyTypes.length > 1 ? (
              <MenuSelect
                id="hs-preview-copy"
                value={effectivePreview}
                allowEmpty={false}
                options={copyTypes.map((t) => ({
                  value: t,
                  label: t === 'original' ? 'Üzleti' : 'Vevői'
                }))}
                onChange={(v) =>
                  setPreviewCopy(v as HandoverSlipCopyType)
                }
              />
            ) : null}
          </div>
          {settings.enabled && settings.copies > 0 ? (
            <HandoverSlipPreview
              data={sample}
              settings={settings}
              copyType={effectivePreview}
            />
          ) : (
            <p className="rounded-md border border-border bg-subtle px-3 py-4 text-body text-ink-secondary">
              Nyomtatás kikapcsolva vagy példányszám: semmi.
            </p>
          )}
          {canWrite ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void testPrint()}
            >
              Teszt blokk nyomtatása
            </Button>
          ) : null}
          <p className="text-hint text-ink-secondary">
            Chrome / Edge + USB hőnyomtató. Ha nincs WebUSB, böngészős nyomtatás
            nyílik.
          </p>
        </div>
      </div>
    </div>
  )
}
