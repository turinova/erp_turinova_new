'use client'

import { useCallback, useEffect, useRef } from 'react'

import {
  looksLikeBarcode,
  prepareBarcodeQuery
} from '@/lib/pos/barcode'
import { charFromWedgeKeyboardEvent } from '@/lib/scanner/normalize-wedge'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  if (el.closest('[role="listbox"]') || el.closest('[role="dialog"]')) {
    return true
  }
  return false
}

export type BarcodeWedgeTrapProps = {
  /** false = trap ki (pl. dialógus nyitva) */
  enabled?: boolean
  /**
   * Teljes scan (Enter vagy idle timeout).
   * `normalized` = HU wedge remap; `raw` = trimelt nyers.
   */
  onScan: (normalized: string, raw: string) => void | Promise<void>
  /** Min. karakter idle timeout előtt (default 6 — egyezik looksLikeBarcode-dal) */
  minLength?: number
  /** Idle ms Enter nélkül (default 100) — POS mintája */
  idleMs?: number
}

/**
 * Rejtett fókusz-trap USB wedge scannerhez.
 * Document capture + e.code map (HU layout Digit0→ö bypass).
 * BUTTON fókusz után soft reclaim (nem sticky).
 * Exact scan: idle / Enter — NEM a látható kereső debounce.
 */
export function BarcodeWedgeTrap({
  enabled = true,
  onScan,
  minLength = 6,
  idleMs = 100
}: BarcodeWedgeTrapProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockRef = useRef(false)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const focusTrap = useCallback(() => {
    if (!enabled) return
    const el = document.activeElement
    if (isTypingTarget(el) && el !== inputRef.current) return
    inputRef.current?.focus({ preventScroll: true })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    focusTrap()
  }, [enabled, focusTrap])

  useEffect(() => {
    if (!enabled) return
    function onVisibility() {
      if (document.visibilityState === 'visible') focusTrap()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled, focusTrap])

  const runScan = useCallback(async (rawValue: string) => {
    if (lockRef.current) return
    const { raw, normalized } = prepareBarcodeQuery(rawValue)
    const code = normalized || raw
    if (!code || !looksLikeBarcode(code)) return

    lockRef.current = true
    bufferRef.current = ''
    if (inputRef.current) inputRef.current.value = ''
    try {
      await onScanRef.current(normalized || raw, raw)
    } finally {
      lockRef.current = false
      if (inputRef.current) inputRef.current.value = ''
      focusTrap()
    }
  }, [focusTrap])

  const scheduleIdleScan = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const t = value.trim()
        if (t.length >= minLength && looksLikeBarcode(t)) {
          void runScan(t)
        }
      }, idleMs)
    },
    [idleMs, minLength, runScan]
  )

  // Document capture: működik gomb / body fókusznál is (nem kell INPUT)
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (lockRef.current) return
      const active = document.activeElement
      // Valódi gépelés más mezőben → ne lopjuk el
      if (isTypingTarget(active) && active !== inputRef.current) return

      if (e.key === 'Enter') {
        const buf = bufferRef.current.trim()
        if (!buf) return
        e.preventDefault()
        e.stopPropagation()
        if (timerRef.current) clearTimeout(timerRef.current)
        void runScan(buf)
        return
      }

      const ch = charFromWedgeKeyboardEvent(e)
      if (!ch) return

      // Ne kezdjünk scannel +/- / . / / egyedül (POS qty shortcutok)
      const isDigitOrLetter =
        e.code.startsWith('Digit') || e.code.startsWith('Key')
      if (bufferRef.current.length === 0 && !isDigitOrLetter) return

      e.preventDefault()
      e.stopPropagation()
      bufferRef.current += ch
      if (inputRef.current) inputRef.current.value = bufferRef.current
      scheduleIdleScan(bufferRef.current)
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [enabled, runScan, scheduleIdleScan])

  if (!enabled) return null

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label="Vonalkód olvasó"
      className="pointer-events-none fixed left-[-9999px] h-px w-px opacity-0"
      autoComplete="off"
      tabIndex={-1}
      onChange={(e) => {
        // Paste / fallback path (ha a capture nem futott)
        bufferRef.current = e.target.value
        scheduleIdleScan(e.target.value)
      }}
      onKeyDown={(e) => {
        // Enter a trap inputon (capture mellett is)
        if (e.key === 'Enter') {
          e.preventDefault()
          if (timerRef.current) clearTimeout(timerRef.current)
          const v =
            bufferRef.current.trim() ||
            (e.target as HTMLInputElement).value.trim()
          if (v) void runScan(v)
        }
      }}
      onBlur={() => {
        window.setTimeout(() => {
          const el = document.activeElement
          if (isTypingTarget(el) && el !== inputRef.current) return
          focusTrap()
        }, 120)
      }}
    />
  )
}

export async function fetchAccessoryBarcodeLookup(
  code: string
): Promise<
  | { ok: true; id: string; name: string; sku: string }
  | { ok: false; message: string; notFound?: boolean }
> {
  const sp = new URLSearchParams({ q: code })
  const res = await fetch(`/api/barcode-lookup?${sp.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  const data = (await res.json()) as
    | {
        ok: true
        product: { id: string; name: string; sku: string }
      }
    | { ok: false; message: string; notFound?: boolean }

  if (!res.ok || !data.ok) {
    if ('ok' in data && data.ok === false) {
      return {
        ok: false,
        message: data.message || 'Vonalkód nem található.',
        notFound: data.notFound ?? res.status === 404
      }
    }
    return { ok: false, message: 'Vonalkód keresés sikertelen.' }
  }

  return {
    ok: true,
    id: data.product.id,
    name: data.product.name,
    sku: data.product.sku
  }
}

export async function fetchPosBarcodeLookup(
  code: string,
  warehouseId: string
): Promise<
  | {
      ok: true
      product: import('@/lib/sales/queries').SaleProductSearchItem
    }
  | { ok: false; message: string; notFound?: boolean }
> {
  const sp = new URLSearchParams({ q: code, warehouseId })
  const res = await fetch(`/api/pos/barcode-lookup?${sp.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  const data = (await res.json()) as
    | {
        ok: true
        product: import('@/lib/sales/queries').SaleProductSearchItem
      }
    | { ok: false; message: string; notFound?: boolean }

  if (!res.ok || !data.ok) {
    if ('ok' in data && data.ok === false) {
      return {
        ok: false,
        message: data.message || 'Vonalkód nem található.',
        notFound: data.notFound ?? res.status === 404
      }
    }
    return { ok: false, message: 'Vonalkód keresés sikertelen.' }
  }

  return { ok: true, product: data.product }
}
