import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET — data to build PO supplier e-mail (draft only, supplier must have e-mail order channel).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select(
        `
        id,
        po_number,
        status,
        supplier_id,
        email_sent,
        suppliers:supplier_id(id, name, email, email_po_intro_html),
        purchase_order_items(
          id,
          quantity,
          products:product_id(id, name, sku, model_number),
          product_suppliers:product_supplier_id(id, supplier_sku),
          units:unit_id(id, name, shortform)
        )
      `
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (poErr || !po) {
      return NextResponse.json({ error: 'Beszerzési rendelés nem található' }, { status: 404 })
    }

    if (po.status !== 'draft') {
      return NextResponse.json(
        { error: 'Csak vázlat státuszú rendeléshez küldhet e-mailt.' },
        { status: 400 }
      )
    }

    const { data: emailChannels } = await supabase
      .from('supplier_order_channels')
      .select('id')
      .eq('supplier_id', po.supplier_id)
      .eq('channel_type', 'email')
      .is('deleted_at', null)
      .limit(1)

    const supplierHasEmailChannel = Boolean(emailChannels?.length)

    const { data: conn } = await supabase
      .from('email_smtp_connections')
      .select('id')
      .is('deleted_at', null)
      .maybeSingle()

    const { data: channelSettings } = await supabase
      .from('email_outbound_channel_settings')
      .select('purchase_order_identity_id')
      .maybeSingle()

    let identities: Array<{
      id: string
      from_name: string
      from_email: string
      signature_html: string | null
      is_default: boolean
    }> = []

    if (conn?.id) {
      const { data: idRows } = await supabase
        .from('email_sending_identities')
        .select('id, from_name, from_email, signature_html, is_default')
        .eq('connection_id', conn.id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      identities = idRows || []
    }

    const defaultFromChannel = channelSettings?.purchase_order_identity_id as string | null | undefined
    const defaultIdentityId =
      (defaultFromChannel && identities.some((i) => i.id === defaultFromChannel)
        ? defaultFromChannel
        : null) ||
      identities.find((i) => i.is_default)?.id ||
      identities[0]?.id ||
      null

    const rawSup = po.suppliers as unknown
    const supplier = (Array.isArray(rawSup) ? rawSup[0] : rawSup) as {
      id: string
      name: string
      email: string | null
      email_po_intro_html: string | null
    } | null

    const itemsRaw = (po.purchase_order_items || []).filter((row: any) => !row.deleted_at)

    const items = itemsRaw.map((item: any, idx: number) => {
      const supplierSku =
        item.product_suppliers?.supplier_sku ||
        item.products?.model_number ||
        item.products?.sku ||
        ''
      return {
        line: idx + 1,
        product_name: item.products?.name || '',
        sku: item.products?.sku || '',
        supplier_sku: supplierSku,
        quantity: Number(item.quantity) || 0,
        unit_shortform: item.units?.shortform || item.units?.name || ''
      }
    })

    const subject = `Beszerzési rendelés — ${po.po_number}`

    return NextResponse.json({
      po_number: po.po_number,
      email_sent: Boolean(po.email_sent),
      supplier_has_email_channel: supplierHasEmailChannel,
      default_to: (supplier?.email || '').trim(),
      subject,
      email_po_intro_html: supplier?.email_po_intro_html || '',
      items,
      identities,
      default_identity_id: defaultIdentityId,
      smtp_configured: Boolean(conn?.id && identities.length > 0)
    })
  } catch (e) {
    console.error('[email-compose]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
