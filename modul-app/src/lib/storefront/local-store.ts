'use client'

/**
 * Boltonkénti (origin) böngésző-tár: kosár, nemrég megnézett, legutóbbi keresések.
 * useSyncExternalStore + `storage` esemény → a fülek között is szinkronban marad.
 */

import { useSyncExternalStore } from 'react'

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()
const cache = new Map<string, { raw: string | null; value: unknown }>()

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return fallback
  }
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value as T
  let value: T = fallback
  if (raw) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = fallback
    }
  }
  cache.set(key, { raw, value })
  return value
}

function emit(key: string) {
  for (const l of listeners.get(key) ?? []) l()
}

export function writeLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* privát mód / tele tár */
  }
  emit(key)
}

export function readLocal<T>(key: string, fallback: T): T {
  return read(key, fallback)
}

function subscribe(key: string, l: Listener) {
  const set = listeners.get(key) ?? new Set<Listener>()
  set.add(l)
  listeners.set(key, set)
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) l()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    set.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

/** SSR-en és hidratáláskor `fallback` — nincs hidratálási eltérés. */
export function useLocal<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (l) => subscribe(key, l),
    () => read(key, fallback),
    () => fallback
  )
}
