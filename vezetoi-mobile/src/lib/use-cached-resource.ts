import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

const PREFIX = 'vezetoi.cache.'
const STALE_MS = 60_000
const INTERVAL_MS = 5 * 60_000

type Cached<T> = { data: T; at: number }

export type CachedResource<T> = {
  data: T | null
  /** ms epoch — az utolsó sikeres betöltés ideje (cache-ből is). */
  updatedAt: number | null
  /** Az utolsó frissítés nem sikerült (a régi adat megmaradhat). */
  error: boolean
  /** Még nincs megjeleníthető adat. */
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<void>
}

/**
 * Az utolsó ismert adatot azonnal mutatja (AsyncStorage), közben frissít.
 * Frissít: kulcsváltáskor, előtérbe jövéskor (ha >1 perces), és 5 percenként, amíg a képernyő fókuszban van.
 */
export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>
): CachedResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const keyRef = useRef(key)
  keyRef.current = key
  const inflightKey = useRef<string | null>(null)
  const updatedRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    const k = keyRef.current
    if (!k || inflightKey.current === k) return
    inflightKey.current = k
    setFetching(true)
    try {
      const next = await fetcherRef.current()
      if (keyRef.current !== k) return
      const at = Date.now()
      setData(next)
      setUpdatedAt(at)
      updatedRef.current = at
      setError(false)
      void AsyncStorage.setItem(PREFIX + k, JSON.stringify({ data: next, at } satisfies Cached<T>))
    } catch (e) {
      console.warn('useCachedResource', k, e)
      if (keyRef.current === k) setError(true)
    } finally {
      if (inflightKey.current === k) {
        inflightKey.current = null
        setFetching(false)
      }
    }
  }, [])

  useEffect(() => {
    setData(null)
    setUpdatedAt(null)
    updatedRef.current = null
    setError(false)
    if (!key) return
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFIX + key)
        if (!cancelled && raw) {
          const cached = JSON.parse(raw) as Cached<T>
          setData(cached.data)
          setUpdatedAt(cached.at)
          updatedRef.current = cached.at
        }
      } catch {
        // sérült cache: nem baj, jön a friss
      }
      if (!cancelled) void load()
    })()
    return () => {
      cancelled = true
    }
  }, [key, load])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      const at = updatedRef.current
      if (!at || Date.now() - at > STALE_MS) void load()
    })
    return () => sub.remove()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => void load(), INTERVAL_MS)
      return () => clearInterval(id)
    }, [load])
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return {
    data,
    updatedAt,
    error,
    loading: key != null && data == null && (fetching || !error),
    refreshing,
    refresh
  }
}
