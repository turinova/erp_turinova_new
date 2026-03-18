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
          type: parcels.type,
          qty: String(parcels.qty),
          weight: String(Math.max(1, Math.ceil(parcels.weight))),
          weight_in_gramm: parcels.weight_in_gramm != null ? String(parcels.weight_in_gramm) : undefined,
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
      dpi: 300,
      pdf_etiket_position: '0'
    }
  }

  try {
    const res = await fetch(`${EXPRESS_ONE_BASE}/parcel/create_labels/response_format/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    const successful = data.successfull === true
    const deliveries = data.response?.deliveries
    const first = Array.isArray(deliveries) ? deliveries[0] : null
    const code = first?.code != null ? String(first.code) : undefined
    const message = first?.message != null ? String(first.message) : undefined

    if (!successful || (code !== undefined && code !== '0')) {
      return {
        ok: false,
        error: message || data.error_messages || data.error || 'Express One hiba',
        code: code ?? data.error_code
      }
    }

    const parcelNumbers: string[] = first?.data?.parcel_numbers ?? []
    const labels = data.response?.labels
    const labelPdfBase64 =
      labels?.type === 'PDF' && typeof labels?.data === 'string' ? labels.data : undefined

    return {
      ok: true,
      parcel_numbers: parcelNumbers.length > 0 ? parcelNumbers : undefined,
      label_pdf_base64: labelPdfBase64
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Express One kapcsolat hiba'
    }
  }
}
