import { useAuth } from '@/features/auth/auth-context'
import { apiGet } from '@/lib/api'
import type { Period } from '@/lib/pulse-types'
import { useCachedResource } from '@/lib/use-cached-resource'

/** `/api/m/v1/<path>` az aktív céggel; `period: null` = időszak-független végpont. */
export function useMobileApi<T>(path: string, period: Period | null, enabled = true) {
  const { current } = useAuth()
  const tenantId = current?.tenantId ?? null
  const key = enabled && tenantId ? `api:${path}:${tenantId}:${period ?? '-'}` : null
  return useCachedResource<T>(key, () =>
    apiGet<T>(path, period ? { tenant: tenantId ?? '', period } : { tenant: tenantId ?? '' })
  )
}
