'use client'

import { useCallback, useEffect, useRef } from 'react'

import {
  looksLikeBarcode,
  prepareBarcodeQuery
} from '@/lib/pos/barcode'
import { charFromWedgeKeyboardEvent } from '@/lib/scanner/normalize-wedge'

/**
 * Max gap between keys to confirm USB wedge (ms).
 * Humans typing are typically >100 ms; cheap USB/BT scanners often 40–80 ms
 * (HU layout + kereső fókusz — 45 ms alatt DT-CZ… soha nem confirmálódott).
 */
const WEDGE_GAP_MS = 90
/** Max total span for a confirmed search-field wedge burst (ms). */
const WEDGE_MAX_SPAN_MS = 900

function isHardBlockTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  if (el.closest('[role="listbox"]') || el.closest('[role="dialog"]')) {
    return true
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (
      type === 'password' ||
      type === 'number' ||
      type === 'email' ||
      type === 'date' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'file'
    ) {
      return true
    }
  }
  return false
}

/** Visible text/search input — may receive wedge while focused. */
function isSearchLikeInput(
  el: EventTarget | null,
  trapEl: HTMLInputElement | null
): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false
  if (el === trapEl) return false
  if (isHardBlockTarget(el)) return false
  const type = (el.type || 'text').toLowerCase()
  return type === 'text' || type === 'search' || type === ''
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )
  proto?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

type SearchBurst = {
  chars: string
  startedAt: number
  lastAt: number
  /** False until 2nd key within WEDGE_GAP — typing stays native until then. */
  confirmed: boolean
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
 *
 * Keresőmező: 1. billentyű native (gépelés OK); 2. gyors billentyű → wedge
 * confirm + remap — betű–betű is (pl. DT-CZ…), ne csak Digit/Minus start.
 * Lassú gépelés (gap > WEDGE_GAP) soha nem wipe-eli a mezőt.
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

  const burstRef = useRef<SearchBurst | null>(null)

  const focusTrap = useCallback(() => {
    if (!enabled) return
    const el = document.activeElement
    if (isHardBlockTarget(el)) return
    if (isSearchLikeInput(el, inputRef.current)) return
    if (
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable) &&
      el !== inputRef.current
    ) {
      return
    }
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

  const runScan = useCallback(
    async (rawValue: string, clearInput?: HTMLInputElement | null) => {
      if (lockRef.current) return
      const { raw, normalized } = prepareBarcodeQuery(rawValue)
      const code = normalized || raw
      if (!code || !looksLikeBarcode(code)) return

      lockRef.current = true
      bufferRef.current = ''
      burstRef.current = null
      if (inputRef.current) inputRef.current.value = ''
      if (clearInput) setNativeInputValue(clearInput, '')
      try {
        await onScanRef.current(normalized || raw, raw)
      } finally {
        lockRef.current = false
        if (inputRef.current) inputRef.current.value = ''
        focusTrap()
      }
    },
    [focusTrap]
  )

  const scheduleIdleScan = useCallback(
    (value: string, clearInput?: HTMLInputElement | null) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const t = value.trim()
        if (t.length < minLength) return
        if (!looksLikeBarcode(t)) return
        void runScan(t, clearInput)
      }, idleMs)
    },
    [idleMs, minLength, runScan]
  )

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (lockRef.current) return
      const active = document.activeElement

      if (isHardBlockTarget(active) && active !== inputRef.current) return

      // Typing edits — drop provisional wedge state
      if (e.key === 'Backspace' || e.key === 'Delete') {
        burstRef.current = null
        return
      }

      const inSearch = isSearchLikeInput(active, inputRef.current)
      const inTrap = active === inputRef.current
      const freeFocus =
        inTrap ||
        !(
          active instanceof HTMLElement &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable)
        )

      // --- Enter ---
      if (e.key === 'Enter') {
        if (freeFocus) {
          const buf = bufferRef.current.trim()
          if (!buf) return
          e.preventDefault()
          e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          void runScan(buf)
          return
        }
        if (inSearch) {
          const burst = burstRef.current
          const field = (active as HTMLInputElement).value.trim()
          const candidate =
            burst?.confirmed && burst.chars.trim()
              ? burst.chars.trim()
              : field
          burstRef.current = null
          if (!candidate || !looksLikeBarcode(candidate)) return
          e.preventDefault()
          e.stopPropagation()
          if (timerRef.current) clearTimeout(timerRef.current)
          void runScan(candidate, active as HTMLInputElement)
          return
        }
        return
      }

      const ch = charFromWedgeKeyboardEvent(e)
      if (!ch) return

      const isDigitOrLetter =
        e.code.startsWith('Digit') || e.code.startsWith('Key')
      const isBarcodeChar =
        isDigitOrLetter ||
        e.code === 'Minus' ||
        e.code === 'Equal' ||
        e.code === 'Period' ||
        e.code === 'Slash'

      // --- Free focus / trap: classic buffer ---
      if (freeFocus) {
        if (bufferRef.current.length === 0 && !isDigitOrLetter) return
        e.preventDefault()
        e.stopPropagation()
        bufferRef.current += ch
        if (inputRef.current) inputRef.current.value = bufferRef.current
        scheduleIdleScan(bufferRef.current)
        return
      }

      // --- Search field: provisional → confirm on 2nd fast key ---
      if (!inSearch) return

      const now = Date.now()
      const burst = burstRef.current
      const continuing =
        burst != null && now - burst.lastAt <= WEDGE_GAP_MS

      // Slow / new sequence — never preventDefault (typing stays native)
      if (!continuing) {
        if (!isBarcodeChar) {
          burstRef.current = null
          return
        }
        burstRef.current = {
          chars: ch,
          startedAt: now,
          lastAt: now,
          confirmed: false
        }
        return
      }

      // Fast 2nd key → confirm wedge (letter–letter too: DT-CZ… / SKU+szám)
      // Scanner gap ~5–20 ms; human typing rarely <45 ms — false steal rare.
      // looksLikeBarcode at idle/Enter rejects short words (asztal…).
      if (!burst.confirmed) {
        if (!isBarcodeChar) {
          burstRef.current = null
          return
        }
        e.preventDefault()
        e.stopPropagation()
        burst.confirmed = true
        burst.chars += ch
        burst.lastAt = now
        const input = active as HTMLInputElement
        setNativeInputValue(input, burst.chars)
        scheduleIdleScan(burst.chars, input)
        return
      }

      // Confirmed burst continues
      if (!isBarcodeChar) {
        burstRef.current = null
        return
      }
      const span = now - burst.startedAt
      if (span > WEDGE_MAX_SPAN_MS && burst.chars.length < minLength) {
        burstRef.current = null
        return
      }

      e.preventDefault()
      e.stopPropagation()
      burst.chars += ch
      burst.lastAt = now
      const input = active as HTMLInputElement
      setNativeInputValue(input, burst.chars)
      scheduleIdleScan(burst.chars, input)
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [enabled, minLength, runScan, scheduleIdleScan])

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
        bufferRef.current = e.target.value
        scheduleIdleScan(e.target.value)
      }}
      onKeyDown={(e) => {
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
          if (isHardBlockTarget(el)) return
          if (isSearchLikeInput(el, inputRef.current)) return
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

export { fetchPosBarcodeLookupCached as fetchPosBarcodeLookup } from '@/lib/pos/pos-barcode-client'
