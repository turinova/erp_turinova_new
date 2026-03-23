import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'
import { getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'
import { escapeXml } from '@/lib/szamlazz-shop-xml'

function buildDeleteXml(agentKey: string, invoiceNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamladbkdel xmlns="http://www.szamlazz.hu/xmlszamladbkdel" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamladbkdel http://www.szamlazz.hu/docs/xsds/szamladbkdel/xmlszamladbkdel.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
  </fejlec>
</xmlszamladbkdel>`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : ''
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Számlaszám szükséges' }, { status: 400 })
    }

    const { data: order } = await supabase
      .from('orders')
      .select('connection_id')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    const connection = await getSzamlazzConnectionForOrder(supabase, order)
    if (!connection?.password) {
      return NextResponse.json({ error: 'Nincs Számlázz kapcsolat' }, { status: 400 })
    }

    const agentKey = String(connection.password).trim()
    const xmlRequest = buildDeleteXml(agentKey, invoiceNumber)
    const apiUrl = normalizeSzamlazzApiUrl(connection.api_url)
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_dijbekero_torlese', xmlBlob, 'delete.xml')

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000)
    })

    const responseText = await response.text()
    const successMatch = responseText.match(/<sikeres>([^<]+)<\/sikeres>/i)
    const isSuccessful = successMatch && successMatch[1].toLowerCase() === 'true'

    if (!isSuccessful) {
      const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
      const code = errorCodeMatch ? errorCodeMatch[1] : 'Unknown'
      const msg = errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'

      if (code === '335') {
        return NextResponse.json({
          success: true,
          message: 'Preview számla már törölve volt vagy nem létezett'
        })
      }

      return NextResponse.json(
        { error: `Szamlazz.hu hiba (${code}): ${msg}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, message: 'Preview számla törölve' })
  } catch (e) {
    console.error('delete-preview-invoice', e)
    return NextResponse.json({ error: 'Belső hiba' }, { status: 500 })
  }
}
