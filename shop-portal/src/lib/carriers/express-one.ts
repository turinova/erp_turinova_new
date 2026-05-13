/**
 * Express One Web API client (carrier integration only).
 * Used when shipping_method.carrier_provider === 'express_one'.
 * Docs: https://webservice.expressone.hu/docs/index/lang/en
 */

const EXPRESS_ONE_BASE = 'https://webservice.expressone.hu'

export interface ExpressOneAuth {
  company_id: string
  user_name: string
  password: string
}

export interface ExpressOneConsig {
  name: string
  contact_name?: string
  city: string
  street: string
  country: string
  post_code: string
  phone?: string
}

export interface ExpressOneParcels {
  type: 0 | 1 // 0 = parcel, 1 = pallet
  qty: number
  weight: number // kg, integer (Express One rounds up)
  weight_in_gramm?: number
  parcel_name?: string
  parcel_numbers?: string[]
}

export interface ExpressOneServices {
  delivery_type: string // 24H, 12H, ARU, etc.
  cod?: { amount: string } // integer as string
  notification?: { sms?: string; email?: string }
}

export interface ExpressOneCreateLabelsParams {
  auth: ExpressOneAuth
  post_date: string // YYYY-MM-DD
  consig: ExpressOneConsig
  parcels: ExpressOneParcels
  services: ExpressOneServices
  ref_number?: string
  invoice_number?: string
  note?: string
  label_format?: 'PDF' | 'ZPL' | 'EPL' | 'NONE'
  label_size?: string // A4, 100x150, etc.
}

export interface ExpressOneCreateLabelsResult {
  ok: boolean
  parcel_numbers?: string[]
  label_pdf_base64?: string
  error?: string
  code?: string
}

/** API uses typo `successfull`; live JSON may use bool, 1, or string. */
function isExpressOneSuccessfullFlag(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    return s === '1' || s === 'true'
  }
  return false
}

function stringifyExpressOneField(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length ? t : undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    const parts = value.map((x) => stringifyExpressOneField(x)).filter(Boolean) as string[]
    return parts.length ? parts.join('; ') : undefined
  }
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value)
      return s !== '{}' ? s : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

function readResponseObject(data: Record<string, unknown>): Record<string, unknown> | null {
  const r = data.response
  if (r != null && typeof r === 'object' && !Array.isArray(r)) {
    return r as Record<string, unknown>
  }
  return null
}

function extractTopLevelError(data: Record<string, unknown>): { text?: string; code?: string } {
  const text =
    stringifyExpressOneField(data.error_messages) ||
    stringifyExpressOneField(data.error) ||
    stringifyExpressOneField(readResponseObject(data)?.message as unknown)

  const code =
    data.error_code != null
      ? String(data.error_code)
      : data.error_num != null
        ? String(data.error_num)
        : undefined

  return { text, code }
}

function firstDeliveryEntry(data: Record<string, unknown>): Record<string, unknown> | null {
  const resp = readResponseObject(data)
  const deliveries = resp?.deliveries
  if (!Array.isArray(deliveries) || deliveries.length === 0) return null
  const row = deliveries[0]
  if (row != null && typeof row === 'object' && !Array.isArray(row)) {
    return row as Record<string, unknown>
  }
  return null
}

function buildCreateLabelsFailure(
  res: Response,
  data: Record<string, unknown>,
  first: Record<string, unknown> | null,
  transportOk: boolean
): ExpressOneCreateLabelsResult {
  const deliveryCode =
    first && first.code != null && String(first.code).length > 0 ? String(first.code) : undefined
  const deliveryMessage = first ? stringifyExpressOneField(first.message) : undefined
  const deliveryErrorNum = first ? stringifyExpressOneField(first.error_num) : undefined
  const top = extractTopLevelError(data)

  const segments: string[] = []
  const push = (s?: string) => {
    const t = (s || '').trim()
    if (t && !segments.includes(t)) segments.push(t)
  }

  if (deliveryMessage && deliveryMessage.toUpperCase() !== 'OK') {
    push(deliveryMessage)
  }
  push(top.text)
  if (deliveryErrorNum && deliveryErrorNum !== '0') {
    push(`error_num: ${deliveryErrorNum}`)
  }
  if (!transportOk && segments.length === 0) {
    push(`successfull=${JSON.stringify(data.successfull)}`)
  }
  if (!res.ok) {
    push(`HTTP ${res.status}`)
  }
  if (segments.length === 0 && first == null) {
    push('Hiányzó válasz: deliveries')
  }

  const error =
    segments.length > 0 ? segments.join(' — ') : res.ok ? 'Express One hiba (részletek nélkül)' : `Express One hiba (HTTP ${res.status})`

  const code =
    deliveryCode && deliveryCode !== '0'
      ? deliveryCode
      : top.code ??
        (first && first.error_num != null && String(first.error_num) !== '0'
          ? String(first.error_num)
          : undefined)

  return { ok: false, error, code }
}

/**
 * Create parcel and get label (Express One create_labels).
 * Single shipment per order. Returns parcel number(s) and label PDF base64.
 */
export async function expressOneCreateLabels(
  params: ExpressOneCreateLabelsParams
): Promise<ExpressOneCreateLabelsResult> {
  const {
    auth,
    post_date,
    consig,
    parcels,
    services,
    ref_number = '',
    invoice_number = '',
    note = '',
    label_format = 'PDF',
    label_size = 'A4'
  } = params

  const body = {
    auth: {
      company_id: auth.company_id,
      user_name: auth.user_name,
      password: auth.password
    },
    deliveries: [
      {
        post_date,
        consig: {
          name: (consig.name || '').slice(0, 100),
          contact_name: (consig.contact_name ?? '').slice(0, 100),
          city: (consig.city || '').slice(0, 25),
          street: (consig.street || '').slice(0, 100),
          country: (consig.country || 'HU').slice(0, 2),
          post_code: String(consig.post_code || '').slice(0, 6),
          phone: (consig.phone ?? '').slice(0, 20)
        },
        parcels: {
          type: String(parcels.type),
          qty: String(parcels.qty),
          weight: String(Math.max(1, Math.ceil(parcels.weight))),
          ...(parcels.weight_in_gramm != null ? { weight_in_gramm: String(parcels.weight_in_gramm) } : {}),
          parcel_name: parcels.parcel_name ?? '',
          parcel_numbers: parcels.parcel_numbers ?? []
        },
        services: {
          delivery_type: services.delivery_type,
          ...(services.cod && { cod: { amount: String(services.cod.amount) } }),
          ...(services.notification && { notification: services.notification })
        },
        ref_number: ref_number.slice(0, 50),
        invoice_number: invoice_number.slice(0, 15),
        note: note.slice(0, 255)
      }
    ],
    labels: {
      data_type: label_format,
      size: label_size,
      dpi: '300',
      pdf_etiket_position: '0'
    }
  }

  try {
    const res = await fetch(`${EXPRESS_ONE_BASE}/parcel/create_labels/response_format/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const transportOk = isExpressOneSuccessfullFlag(data.successfull)
    const first = firstDeliveryEntry(data)
    const deliveryCode =
      first && first.code != null && String(first.code).length > 0 ? String(first.code) : undefined

    const dataObj = first?.data
    const parcelNumbersFromData =
      dataObj != null && typeof dataObj === 'object' && !Array.isArray(dataObj)
        ? (dataObj as Record<string, unknown>).parcel_numbers
        : undefined
    const hasParcelNumbers =
      Array.isArray(parcelNumbersFromData) &&
      parcelNumbersFromData.some((x) => x != null && String(x).length > 0)

    const businessSuccess =
      transportOk &&
      first != null &&
      (deliveryCode === '0' || (deliveryCode === undefined && hasParcelNumbers))

    if (!businessSuccess) {
      return buildCreateLabelsFailure(res, data, first, transportOk)
    }

    const parcelNumbers: string[] = Array.isArray(parcelNumbersFromData)
      ? parcelNumbersFromData.map((x) => String(x)).filter(Boolean)
      : []
    const labels = readResponseObject(data)?.labels as { type?: string; data?: string } | undefined
    const labelPdfBase64 =
      labels?.type === 'PDF' && typeof labels?.data === 'string' ? labels.data : undefined

    return {
      ok: true,
      parcel_numbers: parcelNumbers.length > 0 ? parcelNumbers : undefined,
      label_pdf_base64: labelPdfBase64
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Express One kapcsolat hiba'
    return {
      ok: false,
      error: message || 'Express One kapcsolat hiba'
    }
  }
}
