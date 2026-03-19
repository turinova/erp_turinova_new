import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { sanitizeEmailBodyHtml } from '@/lib/email-signature-sanitize'

const ALLOWED_STATUSES = new Set([
  'pending_review',
  'new',
  'picking',
  'picked',
  'verifying',
  'packing',
  'awaiting_carrier',
  'shipped',
  'ready_for_pickup',
  'delivered',
  'cancelled',
  'refunded'
])

/**
 * GET — list all order status e-mail templates (sorted).
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('order_status_email_templates')
      .select('id, order_status, enabled, subject_template, body_html, sort_order, updated_at')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error(error)
      return NextResponse.json(
        { error: 'A sablonok betöltése sikertelen. Futtatta a 20250421 migrációt?' },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type TemplatePatch = {
  order_status?: string
  enabled?: boolean
  subject_template?: string
  body_html?: string
}

/**
 * PUT — update multiple templates (body: { templates: TemplatePatch[] }).
 * Each item must include order_status; merges enabled, subject_template, body_html.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const list = Array.isArray(body.templates) ? body.templates : []
    if (list.length === 0) {
      return NextResponse.json({ error: 'templates tömb kötelező' }, { status: 400 })
    }

    for (const item of list as TemplatePatch[]) {
      const st = typeof item.order_status === 'string' ? item.order_status : ''
      if (!ALLOWED_STATUSES.has(st)) {
        return NextResponse.json({ error: `Érvénytelen order_status: ${st}` }, { status: 400 })
      }
    }

    for (const item of list as TemplatePatch[]) {
      const st = item.order_status as string
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof item.enabled === 'boolean') patch.enabled = item.enabled
      if (typeof item.subject_template === 'string') {
        const s = item.subject_template.replace(/[\r\n]+/g, ' ').trim().slice(0, 998)
        if (!s) {
          return NextResponse.json({ error: `Üres tárgy nem engedélyezett (${st})` }, { status: 400 })
        }
        patch.subject_template = s
      }
      if (typeof item.body_html === 'string') {
        try {
          patch.body_html = sanitizeEmailBodyHtml(item.body_html)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Érvénytelen HTML'
          return NextResponse.json({ error: `${st}: ${msg}` }, { status: 400 })
        }
      }

      if (Object.keys(patch).length <= 1) continue

      const { error: upErr } = await supabase
        .from('order_status_email_templates')
        .update(patch)
        .eq('order_status', st)

      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: upErr.message || 'Mentés sikertelen' }, { status: 500 })
      }
    }

    const { data } = await supabase
      .from('order_status_email_templates')
      .select('id, order_status, enabled, subject_template, body_html, sort_order, updated_at')
      .order('sort_order', { ascending: true })

    return NextResponse.json({ templates: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
