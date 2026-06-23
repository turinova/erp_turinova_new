'use client'

import { useQuery } from '@tanstack/react-query'

import type { TvDashboardPayload } from '@/types/tv-dashboard'

const REFRESH_MS = 90_000

async function fetchTvDashboard(): Promise<TvDashboardPayload> {
  const res = await fetch('/api/tv/dashboard', { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<TvDashboardPayload>
}

export function useTvDashboard() {
  const query = useQuery({
    queryKey: ['tv-dashboard'],
    queryFn: fetchTvDashboard,
    refetchInterval: REFRESH_MS,
    staleTime: 60_000
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.isError ? 'Betöltési hiba' : null,
    refresh: query.refetch,
    isFetching: query.isFetching
  }
}
