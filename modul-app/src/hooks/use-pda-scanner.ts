'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react'

import { looksLikeBarcode } from '@/lib/pos/barcode'

const REFLECT_MS = 50
const BUFFER_IDLE_MS = 80
const MAX_BUFFER_MS = 400
const DUPLICATE_MS = 220

type Options = {
  enabled: boolean
  /** Dialógus / ügyfél sheet / látható kereső fókusz — ne lopjuk el a fókuszt. */
  paused: boolean
  onScan: (code: string) => void
}

/**
 * PDA wedge scan: rejtett sink + re-focus + globális billentyűbuffer.
 * Soft keyboard: inputMode=none; focus({ preventScroll: true }).
 */
export function usePdaScanner({ enabled, paused, onScan }: Options): {
  sinkRef: RefObject<HTMLInputElement | null>
  sinkProps: {
    ref: RefObject<HTMLInputElement | null>
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
    onBlur: () => void
  }
} {
  const sinkRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const valueRef = useRef('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bufferRef = useRef({ chars: '', startedAt: 0, lastAt: 0 })
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScanRef = useRef<{ code: string; at: number } | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const writeValue = useCallback((v: string) => {
    valueRef.current = v
    setValue(v)
  }, [])

  const focusSink = useCallback(() => {
    if (!enabledRef.current || pausedRef.current) return
    const el = sinkRef.current
    if (!el || document.activeElement === el) return
    const active = document.activeElement as HTMLElement | null
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable) &&
      active !== el
    ) {
      return
    }
    try {
      el.focus({ preventScroll: true })
    } catch {
      el.focus()
    }
  }, [])

  const emitScan = useCallback(
    (raw: string) => {
      const code = raw.trim()
      if (!code) return
      const now = Date.now()
      const prev = lastScanRef.current
      if (prev && prev.code === code && now - prev.at < DUPLICATE_MS) {
        writeValue('')
        focusSink()
        return
      }
      lastScanRef.current = { code, at: now }
      writeValue('')
      onScanRef.current(code)
      window.setTimeout(focusSink, REFLECT_MS)
    },
    [focusSink, writeValue]
  )

  const scheduleFromSink = useCallback(
    (raw: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const t = raw.trim()
        if (t && looksLikeBarcode(t)) emitScan(t)
      }, BUFFER_IDLE_MS)
    },
    [emitScan]
  )

  useEffect(() => {
    if (!enabled) return
    const t = window.setTimeout(focusSink, 80)
    return () => window.clearTimeout(t)
  }, [enabled, paused, focusSink])

  useEffect(() => {
    if (!enabled) return

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        window.setTimeout(focusSink, 100)
      }
    }
    const onWinFocus = () => window.setTimeout(focusSink, 100)
    const onPageShow = () => window.setTimeout(focusSink, 100)

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onWinFocus)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onWinFocus)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [enabled, focusSink])

  useEffect(() => {
    if (!enabled) return

    const flushBuffer = () => {
      const { chars, startedAt } = bufferRef.current
      bufferRef.current = { chars: '', startedAt: 0, lastAt: 0 }
      const t = chars.trim()
      if (!t) return
      const span = Date.now() - (startedAt || Date.now())
      if (looksLikeBarcode(t) || (t.length >= 6 && span <= MAX_BUFFER_MS)) {
        emitScan(t)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        active !== sinkRef.current &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (bufferTimer.current) clearTimeout(bufferTimer.current)
        if (bufferRef.current.chars) {
          flushBuffer()
        } else if (valueRef.current.trim()) {
          emitScan(valueRef.current)
        }
        return
      }

      if (e.key.length !== 1) return

      e.preventDefault()
      const now = Date.now()
      if (
        !bufferRef.current.startedAt ||
        now - bufferRef.current.lastAt > MAX_BUFFER_MS
      ) {
        bufferRef.current = { chars: e.key, startedAt: now, lastAt: now }
      } else {
        bufferRef.current.chars += e.key
        bufferRef.current.lastAt = now
      }
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
      bufferTimer.current = setTimeout(flushBuffer, BUFFER_IDLE_MS)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
    }
  }, [enabled, emitScan])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    sinkRef,
    sinkProps: {
      ref: sinkRef,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (pausedRef.current) {
          writeValue('')
          return
        }
        if (document.activeElement !== sinkRef.current) {
          writeValue('')
          return
        }
        const v = e.target.value
        writeValue(v)
        scheduleFromSink(v)
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        const t = valueRef.current.trim()
        if (t) emitScan(t)
      },
      onBlur: () => {
        window.setTimeout(focusSink, 10)
      }
    }
  }
}
