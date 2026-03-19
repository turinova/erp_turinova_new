import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

function stripConnection(row: Record<string, unknown> | null) {
  if (!row) return null
  const { password: _p, ...rest } = row
  return {
    ...rest,
    has_password: typeof row.password === 'string' && row.password.length > 0
  }
}

/** Align with nodemailer: 465 = implicit TLS; 587/2525 = STARTTLS */
function normalizeSmtpSecure(port: number, secure: boolean): boolean {
  if (port === 465) return true
  if (port === 587 || port === 2525) return false
  return secure
}

/**
 * GET — SMTP connection without password
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('email_smtp_connections')
      .select('*')
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('email connection GET:', error)
      return NextResponse.json({ error: 'Nem sikerült betölteni a beállításokat' }, { status: 500 })
    }

    return NextResponse.json({ connection: stripConnection(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT — upsert single connection; omit password field when empty to keep existing
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const host = String(body.host || '').trim()
    const port = parseInt(String(body.port ?? '587'), 10)
    const secure = normalizeSmtpSecure(port, Boolean(body.secure))
    const smtp_username = String(body.smtp_username || body.user || '').trim()
    const password =
      typeof body.password === 'string' && body.password.length > 0 ? body.password : null
    const provider_type = String(body.provider_type || 'smtp_custom').trim()
    const imap_host = body.imap_host != null ? String(body.imap_host).trim() || null : null
    const imap_port =
      body.imap_port != null && String(body.imap_port).trim() !== ''
        ? parseInt(String(body.imap_port), 10)
        : null
    const imap_secure =
      typeof body.imap_secure === 'boolean' ? body.imap_secure : body.imap_port != null ? true : null

    if (!['smtp_custom', 'gmail_oauth', 'microsoft_oauth'].includes(provider_type)) {
      return NextResponse.json({ error: 'Érvénytelen szolgáltató típus' }, { status: 400 })
    }
    if (provider_type !== 'smtp_custom') {
      return NextResponse.json(
        { error: 'Csak az egyéni SMTP konfigurálható jelenleg. A Google / Microsoft hamarosan.' },
        { status: 400 }
      )
    }

    if (!host || !Number.isFinite(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: 'Érvényes kiszolgáló és port megadása kötelező' }, { status: 400 })
    }
    if (!smtp_username) {
      return NextResponse.json({ error: 'Felhasználónév megadása kötelező' }, { status: 400 })
    }

    const { data: existing, error: exErr } = await supabase
      .from('email_smtp_connections')
      .select('id, password')
      .is('deleted_at', null)
      .maybeSingle()

    if (exErr) {
      console.error(exErr)
      return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
    }

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        host,
        port,
        secure,
        smtp_username,
        provider_type,
        imap_host,
        imap_port,
        imap_secure,
        updated_at: new Date().toISOString()
      }
      if (password != null) {
        updatePayload.password = password
      } else if (!existing.password) {
        return NextResponse.json(
          { error: 'Első mentéskor a jelszó megadása kötelező' },
          { status: 400 }
        )
      }

      const { data: updated, error: upErr } = await supabase
        .from('email_smtp_connections')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('*')
        .single()

      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
      }

      return NextResponse.json({ connection: stripConnection(updated as Record<string, unknown>) })
    }

    if (password == null) {
      return NextResponse.json({ error: 'Jelszó megadása kötelező' }, { status: 400 })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('email_smtp_connections')
      .insert({
        host,
        port,
        secure,
        smtp_username,
        password,
        provider_type,
        imap_host,
        imap_port,
        imap_secure
      })
      .select('*')
      .single()

    if (insErr) {
      console.error(insErr)
      return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ connection: stripConnection(inserted as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE — soft delete only when no active identities
 */
export async function DELETE() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conn, error: cErr } = await supabase
      .from('email_smtp_connections')
      .select('id')
      .is('deleted_at', null)
      .maybeSingle()

    if (cErr || !conn) {
      return NextResponse.json({ error: 'Nincs aktív kapcsolat' }, { status: 404 })
    }

    const { count, error: iErr } = await supabase
      .from('email_sending_identities')
      .select('id', { count: 'exact', head: true })
      .eq('connection_id', conn.id)
      .is('deleted_at', null)

    if (iErr) {
      return NextResponse.json({ error: 'Ellenőrzés sikertelen' }, { status: 500 })
    }
    if (count && count > 0) {
      return NextResponse.json(
        {
          error:
            'Előbb törölje az összes küldő címet, mielőtt eltávolítja a levelező szervert.'
        },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const { error: dErr } = await supabase
      .from('email_smtp_connections')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', conn.id)

    if (dErr) {
      return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
