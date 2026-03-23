import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { retryWithBackoff } from '@/lib/retry-with-backoff'

/**
 * Batch fetch AttributeDescriptions for multiple attributes
 * (extracted from route handler so Next.js route typing stays valid)
 */
export async function batchFetchAttributeDescriptions(
  apiBaseUrl: string,
  authHeader: string,
  attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }>,
  options?: { tenantId?: string }
): Promise<Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>> {
  const results = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
  const limiter = getShopRenterRateLimiter(options?.tenantId)

  if (attributeRequests.length === 0) {
    return results
  }

  try {
    const batchRequests = attributeRequests.map(req => {
      let queryParam = ''
      if (req.attributeType === 'LIST') {
        queryParam = `listAttributeId=${encodeURIComponent(req.attributeId)}`
      } else if (req.attributeType === 'TEXT') {
        queryParam = `textAttributeId=${encodeURIComponent(req.attributeId)}`
      } else if (req.attributeType === 'INTEGER' || req.attributeType === 'FLOAT') {
        queryParam = `numberAttributeId=${encodeURIComponent(req.attributeId)}`
      }

      const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
      return {
        method: 'GET',
        uri: `${apiBaseUrl}/attributeDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
      }
    })

    const BATCH_SIZE = 200
    const indexedRequests = batchRequests
      .map((req, idx) => ({ req, attr: attributeRequests[idx] }))
      .filter(x => x.req.uri.includes('AttributeId='))

    if (indexedRequests.length === 0) {
      return results
    }

    for (let i = 0; i < indexedRequests.length; i += BATCH_SIZE) {
      const chunk = indexedRequests.slice(i, i + BATCH_SIZE)
      const batch = chunk.map(x => x.req)
      const correspondingAttributeRequests = chunk.map(x => x.attr)

      const batchPayload = {
        data: {
          requests: batch
        }
      }

      const batchResponse = await limiter.execute(() =>
        retryWithBackoff(
          () =>
            fetch(`${apiBaseUrl}/batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: authHeader
              },
              body: JSON.stringify(batchPayload),
              signal: AbortSignal.timeout(120000)
            }),
          {
            maxRetries: 4,
            initialDelayMs: 1500,
            maxDelayMs: 45000,
            retryableStatusCodes: [429, 500, 502, 503, 504]
          }
        )
      )

      if (batchResponse.ok) {
        const batchData = await batchResponse.json()
        const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []

        for (let j = 0; j < batchResponses.length && j < correspondingAttributeRequests.length; j++) {
          const batchItem = batchResponses[j]
          const attrReq = correspondingAttributeRequests[j]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)

          if (statusCode >= 200 && statusCode < 300) {
            const data = batchItem.response?.body
            if (process.env.NODE_ENV !== 'production') {
              console.log(
                `[SYNC] Batch AttributeDescription response for ${attrReq.attributeId} (type: ${attrReq.attributeType}):`,
                JSON.stringify(data, null, 2).substring(0, 400)
              )
            }

            let items = data?.items || data?.response?.items || []

            if (!items.length && data && (data.name || data.id)) {
              const desc = data
              results.set(attrReq.attributeId, {
                display_name: desc.name || null,
                prefix: desc.prefix || null,
                postfix: desc.postfix || null
              })
              console.log(
                `[SYNC] Batch AttributeDescription (single object) for ${attrReq.attributeId}: name="${desc.name}", prefix="${desc.prefix}", postfix="${desc.postfix}"`
              )
            } else if (items.length > 0) {
              const desc = items[0]
              if (desc.href && !desc.name && !desc.id) {
                console.log(
                  `[SYNC] Batch AttributeDescription item only has href for ${attrReq.attributeId}, fetching full data: ${desc.href}`
                )
                try {
                  const fullResponse = await limiter.execute(() =>
                    fetch(desc.href, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      signal: AbortSignal.timeout(15000)
                    })
                  )

                  if (fullResponse.ok) {
                    const fullDesc = await fullResponse.json()
                    results.set(attrReq.attributeId, {
                      display_name: fullDesc.name || null,
                      prefix: fullDesc.prefix || null,
                      postfix: fullDesc.postfix || null
                    })
                    console.log(
                      `[SYNC] Batch AttributeDescription (fetched from href) for ${attrReq.attributeId}: name="${fullDesc.name}", prefix="${fullDesc.prefix}", postfix="${fullDesc.postfix}"`
                    )
                  } else {
                    console.warn(
                      `[SYNC] Failed to fetch full AttributeDescription from href for ${attrReq.attributeId}: ${fullResponse.status}`
                    )
                    results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                  }
                } catch (fetchError) {
                  console.warn(`[SYNC] Failed to fetch full AttributeDescription from href for ${attrReq.attributeId}:`, fetchError)
                  results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                }
              } else {
                results.set(attrReq.attributeId, {
                  display_name: desc.name || null,
                  prefix: desc.prefix || null,
                  postfix: desc.postfix || null
                })
                console.log(
                  `[SYNC] Batch AttributeDescription (from items array) for ${attrReq.attributeId}: name="${desc.name}", prefix="${desc.prefix}", postfix="${desc.postfix}"`
                )
              }
            } else if (data?.first?.href || data?.href) {
              const fetchUrl = data.first?.href || data.href
              console.log(`[SYNC] Batch AttributeDescription response has no items, but has href. Fetching from: ${fetchUrl}`)
              try {
                const fullResponse = await limiter.execute(() =>
                  fetch(fetchUrl, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(15000)
                  })
                )

                if (fullResponse.ok) {
                  const fullData = await fullResponse.json()
                  const fullItems = fullData?.items || fullData?.response?.items || []

                  if (fullItems.length > 0) {
                    const desc = fullItems[0]
                    results.set(attrReq.attributeId, {
                      display_name: desc.name || null,
                      prefix: desc.prefix || null,
                      postfix: desc.postfix || null
                    })
                    console.log(
                      `[SYNC] Batch AttributeDescription (fetched from pagination href) for ${attrReq.attributeId}: name="${desc.name}", prefix="${desc.prefix}", postfix="${desc.postfix}"`
                    )
                  } else {
                    console.warn(`[SYNC] Fetched from href but still no items found for ${attrReq.attributeId}`)
                    results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                  }
                } else {
                  console.warn(
                    `[SYNC] Failed to fetch AttributeDescription from pagination href for ${attrReq.attributeId}: ${fullResponse.status}`
                  )
                  results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                }
              } catch (fetchError) {
                console.warn(`[SYNC] Failed to fetch AttributeDescription from pagination href for ${attrReq.attributeId}:`, fetchError)
                results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
              }
            } else {
              console.warn(
                `[SYNC] No AttributeDescription items found for ${attrReq.attributeId} (type: ${attrReq.attributeType}). Response data:`,
                JSON.stringify(data, null, 2).substring(0, 300)
              )
              results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
            }
          } else {
            const errorText =
              batchItem.response?.body?.error ||
              batchItem.response?.body?.message ||
              JSON.stringify(batchItem.response?.body || {}).substring(0, 200)
            if (statusCode === 404) {
              console.warn(`[SYNC] AttributeDescription 404 for ${attrReq.attributeId} — using internal name fallback`)
            } else {
              console.warn(`[SYNC] AttributeDescription API error for ${attrReq.attributeId}: status ${statusCode} - ${errorText}`)
            }
            results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
          }
        }
      } else {
        const errText = await batchResponse.text().catch(() => '')
        console.error(`[SYNC] AttributeDescription batch POST failed: ${batchResponse.status} ${errText.substring(0, 300)}`)
      }
    }
  } catch (error) {
    console.error('[SYNC] Error batch fetching attribute descriptions:', error)
  }

  return results
}

/**
 * Batch fetch AttributeWidgetDescriptions for multiple widgets to get group names
 */
export async function batchFetchAttributeWidgetDescriptions(
  apiBaseUrl: string,
  authHeader: string,
  widgetRequests: Array<{ widgetId: string; widgetType: 'LIST' | 'NUMBER' }>,
  options?: { tenantId?: string }
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  const limiter = getShopRenterRateLimiter(options?.tenantId)

  if (widgetRequests.length === 0) {
    return results
  }

  try {
    const batchRequests = widgetRequests.map(req => {
      let queryParam = ''
      if (req.widgetType === 'LIST') {
        queryParam = `listAttributeWidgetId=${encodeURIComponent(req.widgetId)}`
      } else if (req.widgetType === 'NUMBER') {
        queryParam = `numberAttributeWidgetId=${encodeURIComponent(req.widgetId)}`
      }

      const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
      return {
        method: 'GET',
        uri: `${apiBaseUrl}/attributeWidgetDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
      }
    })

    const BATCH_SIZE = 200
    const indexedWidgetRequests = batchRequests
      .map((req, idx) => ({ req, w: widgetRequests[idx] }))
      .filter(x => x.req.uri.includes('WidgetId='))

    if (indexedWidgetRequests.length === 0) {
      return results
    }

    for (let i = 0; i < indexedWidgetRequests.length; i += BATCH_SIZE) {
      const chunk = indexedWidgetRequests.slice(i, i + BATCH_SIZE)
      const batch = chunk.map(x => x.req)
      const correspondingWidgetRequests = chunk.map(x => x.w)

      const batchPayload = {
        data: {
          requests: batch
        }
      }

      const batchResponse = await limiter.execute(() =>
        retryWithBackoff(
          () =>
            fetch(`${apiBaseUrl}/batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: authHeader
              },
              body: JSON.stringify(batchPayload),
              signal: AbortSignal.timeout(120000)
            }),
          {
            maxRetries: 4,
            initialDelayMs: 1500,
            maxDelayMs: 45000,
            retryableStatusCodes: [429, 500, 502, 503, 504]
          }
        )
      )

      if (batchResponse.ok) {
        const batchData = await batchResponse.json()
        const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []

        for (let j = 0; j < batchResponses.length && j < correspondingWidgetRequests.length; j++) {
          const batchItem = batchResponses[j]
          const widgetReq = correspondingWidgetRequests[j]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)

          if (statusCode >= 200 && statusCode < 300) {
            const data = batchItem.response?.body
            const items = data?.items || data?.response?.items || []

            if (items.length > 0) {
              const desc = items[0]
              const groupName = desc.label || null
              if (groupName) {
                console.log(`[SYNC] Found group_name "${groupName}" for widget ${widgetReq.widgetId}`)
              }
              results.set(widgetReq.widgetId, groupName)
            } else {
              console.warn(`[SYNC] No items found in widget description response for widget ${widgetReq.widgetId}`)
              results.set(widgetReq.widgetId, null)
            }
          } else {
            const errorMsg = batchItem.response?.body?.error || batchItem.response?.body?.message || 'Unknown error'
            console.warn(`[SYNC] Failed to fetch widget description for ${widgetReq.widgetId}: status ${statusCode}, error: ${errorMsg}`)
            results.set(widgetReq.widgetId, null)
          }
        }
      } else {
        const errText = await batchResponse.text().catch(() => '')
        console.error(`[SYNC] Widget description batch POST failed: ${batchResponse.status} ${errText.substring(0, 300)}`)
      }
    }
  } catch (error) {
    console.error('[SYNC] Error batch fetching attribute widget descriptions:', error)
  }

  return results
}
