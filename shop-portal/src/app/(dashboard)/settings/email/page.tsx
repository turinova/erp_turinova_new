import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { Home as HomeIcon, Settings as SettingsIcon, Email as EmailIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import EmailSettingsClient from './EmailSettingsClient'
import type { InitialChannelSettings, InitialConnection, InitialIdentity } from './emailSettingsTypes'

export default async function EmailSettingsPage() {
  const supabase = await getTenantSupabase()

  let initialConnection: InitialConnection = null
  let initialIdentities: InitialIdentity[] = []
  const initialChannelSettings: InitialChannelSettings = {
    purchase_order_identity_id: null,
    order_status_notification_identity_id: null
  }

  try {
    const { data: connRow } = await supabase
      .from('email_smtp_connections')
      .select('*')
      .is('deleted_at', null)
      .maybeSingle()

    if (connRow) {
      const r = connRow as Record<string, unknown>
      initialConnection = {
        id: String(r.id),
        host: String(r.host),
        port: Number(r.port),
        secure: Boolean(r.secure),
        smtp_username: String(r.smtp_username),
        has_password: typeof r.password === 'string' && r.password.length > 0,
        imap_host: r.imap_host != null ? String(r.imap_host) : null,
        imap_port: r.imap_port != null ? Number(r.imap_port) : null,
        imap_secure: typeof r.imap_secure === 'boolean' ? r.imap_secure : null,
        provider_type: String(r.provider_type || 'smtp_custom')
      }
    }

    if (initialConnection?.id) {
      const { data: ids } = await supabase
        .from('email_sending_identities')
        .select('id, from_name, from_email, signature_html, is_default, sort_order')
        .eq('connection_id', initialConnection.id)
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      initialIdentities = (ids || []) as InitialIdentity[]
    }

    const { data: chRow, error: chErr } = await supabase
      .from('email_outbound_channel_settings')
      .select('*')
      .maybeSingle()
    if (!chErr && chRow) {
      const c = chRow as Record<string, unknown>
      initialChannelSettings.purchase_order_identity_id =
        c.purchase_order_identity_id != null ? String(c.purchase_order_identity_id) : null
      initialChannelSettings.order_status_notification_identity_id =
        c.order_status_notification_identity_id != null
          ? String(c.order_status_notification_identity_id)
          : null
    } else if (chErr) {
      console.warn('Email channel settings (migration 20250419 not applied?):', chErr.message)
    }
  } catch (e) {
    console.error('Email settings page load:', e)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SettingsIcon fontSize="small" />
          Beállítások
        </Typography>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <EmailIcon fontSize="small" />
          E-mail
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, letterSpacing: '-0.02em' }}>
        E-mail — kimenő levelek
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720, lineHeight: 1.6 }}>
        <strong>Egy</strong> bejelentkezés a levelező szerverre (SMTP), és tetszőleges számú <strong>küldő cím</strong>{' '}
        (feladó név + e-mail + aláírás). A szerver ugyanaz marad; a levél kinézete címenként változhat — ha a tárhely
        engedi a választott feladót.
      </Typography>

      <EmailSettingsClient
        initialConnection={initialConnection}
        initialIdentities={initialIdentities}
        initialChannelSettings={initialChannelSettings}
      />
    </Box>
  )
}
