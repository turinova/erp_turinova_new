'use client'

import dynamic from 'next/dynamic'

import { formatMaterialQty } from '@/lib/handover-slip/build-data'
import type {
  HandoverSlipCopyType,
  HandoverSlipData,
  HandoverSlipSettings
} from '@/lib/handover-slip/types'
import { cn } from '@/lib/utils'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

function sanitizeBarcodeForCODE128(barcode: string): string {
  let sanitized = barcode.replace(/[^\x20-\x7E]/g, '')
  if (!sanitized) sanitized = '0'
  return sanitized
}

type HandoverSlipPreviewProps = {
  data: HandoverSlipData
  settings: HandoverSlipSettings
  copyType: HandoverSlipCopyType
  className?: string
}

export function HandoverSlipPreview({
  data,
  settings,
  copyType,
  className
}: HandoverSlipPreviewProps) {
  return (
    <div
      className={cn(
        'mx-auto w-[302px] rounded-md border border-border bg-white p-3 font-mono text-[11px] leading-snug text-ink shadow-sm',
        className
      )}
      aria-label="Átvételi blokk előnézet"
    >
      <p className="text-center text-[13px] font-bold">Átvételi elismervény</p>
      {copyType === 'customer' ? (
        <p className="mt-0.5 text-center text-[12px] font-bold">
          {settings.customerCopyLabel}
        </p>
      ) : null}
      <div className="my-1 border-t border-dashed border-ink/40" />
      <p className="text-center text-[12px] font-bold">{data.company.name}</p>
      {settings.showCompanyAddress ? (
        <p className="text-center text-ink-secondary">
          {[data.company.postalCode, data.company.city, data.company.address]
            .filter(Boolean)
            .join(' ')}
        </p>
      ) : null}
      {settings.showCompanyPhone && data.company.phone ? (
        <p className="text-center text-ink-secondary">{data.company.phone}</p>
      ) : null}
      {settings.showCompanyEmail && data.company.email ? (
        <p className="text-center text-ink-secondary">{data.company.email}</p>
      ) : null}
      {settings.showTaxNumber && data.company.taxNumber ? (
        <p className="text-center text-ink-secondary">
          Adószám: {data.company.taxNumber}
        </p>
      ) : null}

      <div className="my-2 border-t border-dashed border-ink/40" />
      {settings.showOrderNumber ? (
        <p>
          <span className="font-semibold">Megrendelés:</span> {data.orderNumber}
        </p>
      ) : null}
      {settings.showCustomerName ? (
        <p>
          <span className="font-semibold">Ügyfél:</span> {data.customerName}
        </p>
      ) : null}
      <div className="my-2 border-t border-dashed border-ink/40" />

      {settings.showMaterials
        ? data.materials.map((m) => (
            <div key={m.name + m.chargedSqm} className="mb-1">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 break-words">{m.name}</span>
                <span className="shrink-0 tabular-nums">
                  {formatMaterialQty(m, settings.qtyFormat)}
                </span>
              </div>
              {settings.showEdge && m.edgeLengthM > 0.001 ? (
                <p className="text-right text-ink-secondary">
                  Élzáró: {m.edgeLengthM.toFixed(2)} m
                </p>
              ) : null}
            </div>
          ))
        : null}

      {settings.showServices && data.services.length > 0 ? (
        <>
          <div className="my-2 border-t border-dashed border-ink/40" />
          {data.services.map((s) => (
            <div key={s.name} className="flex justify-between gap-2">
              <span>{s.name}</span>
              <span className="tabular-nums">
                {s.quantity} {s.unit}
              </span>
            </div>
          ))}
        </>
      ) : null}

      {settings.showLegalText ? (
        <p className="mt-3 text-center text-[10px] leading-snug text-ink-secondary">
          {settings.legalText}
        </p>
      ) : null}

      {copyType === 'original' && settings.showGateLine ? (
        <p className="mt-2 text-center text-[10px] font-semibold">
          {settings.gateLineText}
        </p>
      ) : null}

      {settings.showPrintDatetime ? (
        <p className="mt-2 text-center text-[10px] text-ink-secondary">
          Nyomtatva: {new Date().toLocaleString('hu-HU')}
        </p>
      ) : null}

      {copyType === 'original' && settings.showSignatures ? (
        <div className="mt-3 space-y-3">
          <div>
            <p>Ügyfél aláírása:</p>
            <div className="mt-4 border-b border-dashed border-ink/50" />
          </div>
          <div>
            <p>Átadó munkatárs neve:</p>
            <div className="mt-4 border-b border-dashed border-ink/50" />
          </div>
        </div>
      ) : null}

      {settings.showBarcode && data.barcode ? (
        <div className="mt-3 flex flex-col items-center">
          <Barcode
            value={sanitizeBarcodeForCODE128(data.barcode)}
            format="CODE128"
            width={1.4}
            height={44}
            displayValue={false}
            margin={0}
            background="#ffffff"
            lineColor="#000000"
          />
          <p className="mt-1 tracking-widest text-ink">{data.barcode}</p>
        </div>
      ) : null}
    </div>
  )
}
