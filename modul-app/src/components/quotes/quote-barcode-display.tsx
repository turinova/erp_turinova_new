'use client'

import dynamic from 'next/dynamic'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

function sanitizeBarcodeForCODE128(barcode: string): string {
  let sanitized = barcode.replace(/[^\x20-\x7E]/g, '')
  if (!sanitized) sanitized = '0'
  return sanitized
}

type QuoteBarcodeDisplayProps = {
  barcode: string
  className?: string
}

export function QuoteBarcodeDisplay({
  barcode,
  className
}: QuoteBarcodeDisplayProps) {
  const value = sanitizeBarcodeForCODE128(barcode)

  return (
    <div
      className={
        className ??
        'flex flex-col items-center justify-center rounded-md border-2 border-border bg-surface px-3 py-2'
      }
    >
      <p className="mb-1 text-hint text-ink-secondary">Vonalkód</p>
      <Barcode
        value={value}
        format="CODE128"
        width={1.6}
        height={48}
        displayValue={false}
        margin={4}
      />
      <p className="mt-1 font-mono text-body tracking-widest text-ink">
        {barcode}
      </p>
    </div>
  )
}
