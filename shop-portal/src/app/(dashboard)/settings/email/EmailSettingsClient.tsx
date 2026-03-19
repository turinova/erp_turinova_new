'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import '@/libs/styles/tiptapEditor.css'
import type { InitialChannelSettings, InitialConnection, InitialIdentity } from './emailSettingsTypes'

type Props = {
  initialConnection: InitialConnection
  initialIdentities: InitialIdentity[]
  initialChannelSettings: InitialChannelSettings
}

export default function EmailSettingsClient({
  initialConnection,
  initialIdentities,
  initialChannelSettings
}: Props) {
  const [connection, setConnection] = useState<InitialConnection>(initialConnection)
  const [identities, setIdentities] = useState<InitialIdentity[]>(initialIdentities)
  const [loading, setLoading] = useState(false)

  const [host, setHost] = useState(initialConnection?.host || '')
  const [port, setPort] = useState(initialConnection?.port ?? 587)
  const [secure, setSecure] = useState(initialConnection?.secure ?? false)
  const [smtpUser, setSmtpUser] = useState(initialConnection?.smtp_username || '')
  const [password, setPassword] = useState('')
  const [imapHost, setImapHost] = useState(initialConnection?.imap_host || '')
  const [imapPort, setImapPort] = useState(initialConnection?.imap_port ?? '')
  const [imapSecure, setImapSecure] = useState(initialConnection?.imap_secure ?? true)

  const [identityDialogOpen, setIdentityDialogOpen] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState<InitialIdentity | null>(null)
  const [idFormName, setIdFormName] = useState('')
  const [idFormEmail, setIdFormEmail] = useState('')
  const [idFormDefault, setIdFormDefault] = useState(false)
  const [idSaving, setIdSaving] = useState(false)

  const [testOpen, setTestOpen] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testIdentityId, setTestIdentityId] = useState<string>('')
  const [testSending, setTestSending] = useState(false)

  const [deleteConnOpen, setDeleteConnOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<InitialIdentity | null>(null)

  const [poChannelId, setPoChannelId] = useState(
    () => initialChannelSettings.purchase_order_identity_id || ''
  )
  const [statusChannelId, setStatusChannelId] = useState(
    () => initialChannelSettings.order_status_notification_identity_id || ''
  )
  const [channelSaving, setChannelSaving] = useState(false)

  const refreshAll = useCallback(async () => {
    try {
      const [cRes, iRes, chRes] = await Promise.all([
        fetch('/api/settings/email/connection'),
        fetch('/api/settings/email/identities'),
        fetch('/api/settings/email/channels')
      ])
      const cJson = await cRes.json()
      const iJson = await iRes.json()
      const chJson = await chRes.json()
      if (cRes.ok && cJson.connection !== undefined) {
        setConnection(cJson.connection)
        if (cJson.connection) {
          setHost(cJson.connection.host)
          setPort(cJson.connection.port)
          setSecure(cJson.connection.secure)
          setSmtpUser(cJson.connection.smtp_username)
          setImapHost(cJson.connection.imap_host || '')
          setImapPort(cJson.connection.imap_port ?? '')
          setImapSecure(cJson.connection.imap_secure ?? true)
        } else {
          setHost('')
          setPort(587)
          setSecure(false)
          setSmtpUser('')
          setImapHost('')
          setImapPort('')
          setImapSecure(true)
        }
      }
      if (iRes.ok && Array.isArray(iJson.identities)) {
        setIdentities(iJson.identities)
      }
      if (chRes.ok && chJson.settings) {
        setPoChannelId(chJson.settings.purchase_order_identity_id || '')
        setStatusChannelId(chJson.settings.order_status_notification_identity_id || '')
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const signatureEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Aláírás (opcionális)…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] })
    ],
    content: '',
    immediatelyRender: false
  })

  useEffect(() => {
    if (!signatureEditor) return
    if (identityDialogOpen) {
      const html = editingIdentity?.signature_html || ''
      signatureEditor.commands.setContent(html || '<p></p>')
    }
  }, [signatureEditor, identityDialogOpen, editingIdentity])

  const openNewIdentity = () => {
    setEditingIdentity(null)
    setIdFormName('')
    setIdFormEmail('')
    setIdFormDefault(identities.length === 0)
    setIdentityDialogOpen(true)
  }

  const openEditIdentity = (row: InitialIdentity) => {
    setEditingIdentity(row)
    setIdFormName(row.from_name)
    setIdFormEmail(row.from_email)
    setIdFormDefault(row.is_default)
    setIdentityDialogOpen(true)
  }

  const saveConnection = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/email/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port,
          secure,
          smtp_username: smtpUser.trim(),
          password: password.trim() || undefined,
          provider_type: 'smtp_custom',
          imap_host: imapHost.trim() || null,
          imap_port: imapPort === '' ? null : Number(imapPort),
          imap_secure: imapHost.trim() ? imapSecure : null
        })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Mentés sikertelen')
        return
      }
      toast.success('Levelező szerver mentve')
      setPassword('')
      setConnection(data.connection)
      await refreshAll()
    } finally {
      setLoading(false)
    }
  }

  const removeConnection = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/email/connection', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Törlés sikertelen')
        return
      }
      toast.success('Levelező szerver eltávolítva')
      setDeleteConnOpen(false)
      setConnection(null)
      setIdentities([])
      setHost('')
      setPort(587)
      setSecure(false)
      setSmtpUser('')
      setPassword('')
      setImapHost('')
      setImapPort('')
      setPoChannelId('')
      setStatusChannelId('')
    } finally {
      setLoading(false)
    }
  }

  const saveChannelSettings = async () => {
    setChannelSaving(true)
    try {
      const res = await fetch('/api/settings/email/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_order_identity_id: poChannelId || null,
          order_status_notification_identity_id: statusChannelId || null
        })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Mentés sikertelen')
        return
      }
      toast.success('Cél szerinti küldő címek mentve')
      await refreshAll()
    } finally {
      setChannelSaving(false)
    }
  }

  const saveIdentity = async () => {
    if (!signatureEditor) return
    setIdSaving(true)
    try {
      const signature_html = signatureEditor.getHTML()
      const payload = {
        from_name: idFormName.trim(),
        from_email: idFormEmail.trim().toLowerCase(),
        is_default: idFormDefault,
        signature_html
      }
      const url = editingIdentity
        ? `/api/settings/email/identities/${editingIdentity.id}`
        : '/api/settings/email/identities'
      const res = await fetch(url, {
        method: editingIdentity ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Mentés sikertelen')
        return
      }
      toast.success(editingIdentity ? 'Küldő cím frissítve' : 'Küldő cím létrehozva')
      setIdentityDialogOpen(false)
      await refreshAll()
    } finally {
      setIdSaving(false)
    }
  }

  const removeIdentity = async () => {
    if (!deleteId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/email/identities/${deleteId.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Törlés sikertelen')
        return
      }
      toast.success('Küldő cím törölve')
      setDeleteId(null)
      await refreshAll()
    } finally {
      setLoading(false)
    }
  }

  const sendTest = async () => {
    setTestSending(true)
    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testTo.trim(),
          identity_id: testIdentityId || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) {
        const parts = [data.error, data.detail].filter(Boolean)
        toast.error(parts.length ? parts.join(' — ') : 'Küldés sikertelen')
        return
      }
      toast.success('Teszt e-mail elküldve')
      setTestOpen(false)
      setTestTo('')
    } finally {
      setTestSending(false)
    }
  }

  const applyPreset = (kind: 'gmail' | 'm365' | 'rackhost') => {
    if (kind === 'rackhost') {
      setHost('smtp.rackhost.hu')
      setPort(465)
      setSecure(true)
      setImapHost('imap.rackhost.hu')
      setImapPort(993)
      setImapSecure(true)
      toast.info('Rackhost SMTP/IMAP értékek kitöltve — mentse a kapcsolatot.')
      return
    }
    if (kind === 'gmail') {
      setHost('smtp.gmail.com')
      setPort(465)
      setSecure(true)
      setImapHost('imap.gmail.com')
      setImapPort(993)
      setImapSecure(true)
      toast.info('Gmail SMTP értékek kitöltve — mentse a kapcsolatot.')
    } else {
      setHost('smtp.office365.com')
      setPort(587)
      setSecure(false)
      setImapHost('outlook.office365.com')
      setImapPort(993)
      setImapSecure(true)
      toast.info('Microsoft 365 SMTP értékek kitöltve — mentse a kapcsolatot.')
    }
  }

  const hasConnection = !!connection?.id
  const canTest = hasConnection && identities.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Provider placeholders */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
          Csatlakozás (később)
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined" sx={{ opacity: 0.72, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>
                  Google (Gmail / Workspace)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Hamarosan: bejelentkezés Google fiókkal, alkalmazásjelszó nélkül.
                </Typography>
                <Button disabled sx={{ mt: 2 }} size="small" variant="outlined">
                  Hamarosan
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined" sx={{ opacity: 0.72, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600}>
                  Microsoft 365
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Hamarosan: Microsoft bejelentkezés és Graph API küldés.
                </Typography>
                <Button disabled sx={{ mt: 2 }} size="small" variant="outlined">
                  Hamarosan
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* SMTP */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, letterSpacing: '-0.01em' }}>
          Levelező szerver bejelentkezés (SMTP)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720, lineHeight: 1.6 }}>
          Ez a <strong>postafiók</strong>, amivel az ERP bejelentkezik a kiszolgálóra (ugyanaz, mint Outlookban: host, port,
          SSL, <strong>teljes e-mail cím</strong> felhasználóként + jelszó). Egy aktív szerver van; onnan több küldő cím
          is használható, ha a tárhely engedi.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip label="Rackhost" size="small" onClick={() => applyPreset('rackhost')} variant="outlined" />
          <Chip label="Gmail" size="small" onClick={() => applyPreset('gmail')} variant="outlined" />
          <Chip label="Microsoft 365" size="small" onClick={() => applyPreset('m365')} variant="outlined" />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Kiszolgáló (host)"
              fullWidth
              size="small"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.example.com"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              label="Port"
              fullWidth
              size="small"
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value, 10) || 0)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControlLabel
              control={<Checkbox checked={secure} onChange={(_, c) => setSecure(c)} />}
              label="SSL (pl. 465)"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Felhasználónév (teljes e-mail)"
              fullWidth
              size="small"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              autoComplete="off"
              helperText="Pl. info@pelda.hu — annak a fióknak a jelszava, amivel belépsz."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label={connection?.has_password ? 'Jelszó (hagyja üresen, ha nem változik)' : 'Jelszó'}
              fullWidth
              size="small"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Grid>
        </Grid>

        <Accordion sx={{ mt: 2, boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'action.hover' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" fontWeight={500}>
              Haladó: IMAP (opcionális)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              A kimenő levélhez nem kell; később használható pl. „Elküldve” mappa szinkronhoz.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="IMAP host"
                  fullWidth
                  size="small"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="IMAP port"
                  fullWidth
                  size="small"
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <FormControlLabel
                  control={<Checkbox checked={imapSecure} onChange={(_, c) => setImapSecure(c)} />}
                  label="IMAP SSL"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 3, alignItems: 'center' }}>
          <Button variant="contained" onClick={saveConnection} disabled={loading}>
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Szerver mentése'}
          </Button>
          <Tooltip title={!canTest ? 'Előbb mentse a szervert és adjon meg legalább egy küldő címet' : ''}>
            <span>
              <Button
                variant="text"
                color="inherit"
                size="small"
                startIcon={<SendIcon fontSize="small" />}
                disabled={!canTest || loading}
                onClick={() => {
                  const def = identities.find((i) => i.is_default) || identities[0]
                  setTestIdentityId(def?.id || '')
                  setTestOpen(true)
                }}
                sx={{ color: 'text.secondary' }}
              >
                Teszt e-mail küldése
              </Button>
            </span>
          </Tooltip>
          {hasConnection && (
            <Button color="error" variant="outlined" onClick={() => setDeleteConnOpen(true)} disabled={loading}>
              Kapcsolat eltávolítása
            </Button>
          )}
        </Box>

        {connection?.has_password && (
          <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 16 }} />
            Jelszó mentve a szerveren
          </Typography>
        )}
      </Paper>

      {/* Identities */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, letterSpacing: '-0.01em' }}>
              Küldő címek (feladó)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680, lineHeight: 1.6 }}>
              A levél <strong>Feladó</strong> sorában megjelenő név és cím, plusz opcionális aláírás. Több cím is lehet;
              az <strong>alapértelmezett</strong> címhez járó jelölés a „Hol milyen címről küldünk” résznél használható
              visszaállításként. A választott feladót a levelező szervernek is el kell fogadnia.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openNewIdentity}
            disabled={!hasConnection}
          >
            Új küldő cím
          </Button>
        </Box>

        {!hasConnection ? (
          <Typography color="text.secondary" sx={{ py: 3 }}>
            Előbb mentse a levelező szervert, utána adhat hozzá küldő címeket.
          </Typography>
        ) : identities.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3 }}>
            Még nincs küldő cím. Vegyen fel legalább egyet (pl. noreply@… vagy info@…), majd állítsa be lent, melyiket
            mire használjuk.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Megjelenő név</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>E-mail</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Alapértelmezett</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Művelet
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {identities.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.from_name}</TableCell>
                    <TableCell>{row.from_email}</TableCell>
                    <TableCell>
                      {row.is_default ? <Chip size="small" color="primary" label="Alapértelmezett" /> : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEditIdentity(row)} aria-label="Szerkesztés">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteId(row)} aria-label="Törlés" color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Channel → identity (saved; PO send / status mail wiring later) */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, letterSpacing: '-0.01em' }}>
          Hol milyen címről küldünk
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720, lineHeight: 1.6 }}>
          Itt elmentjük, melyik <strong>küldő cím</strong> tartozik a következő funkciókhoz. Ha üresen hagyja, később a
          rendszer az <strong>alapértelmezett</strong> küldő címet veheti alapul.
        </Typography>

        {!hasConnection || identities.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            Előbb állítsa be a szervert és vegyen fel legalább egy küldő címet.
          </Typography>
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Beszerzés — beszállítói rendelés (PO)"
                  value={poChannelId}
                  onChange={(e) => setPoChannelId(e.target.value)}
                  helperText="A beszállítónak küldött levelekhez. A tényleges küldés a beszerzési modul bekötésekor indul."
                >
                  <MenuItem value="">
                    <em>Alapértelmezett küldő cím</em>
                  </MenuItem>
                  {identities.map((i) => (
                    <MenuItem key={i.id} value={i.id}>
                      {i.from_name} — {i.from_email}
                      {i.is_default ? ' (alapértelmezett)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Rendelés — státusz értesítések"
                  value={statusChannelId}
                  onChange={(e) => setStatusChannelId(e.target.value)}
                  helperText="Jelenleg csak beállítás; az automatikus státusz e-mailek küldése később kapcsolódik."
                >
                  <MenuItem value="">
                    <em>Alapértelmezett küldő cím</em>
                  </MenuItem>
                  {identities.map((i) => (
                    <MenuItem key={i.id} value={i.id}>
                      {i.from_name} — {i.from_email}
                      {i.is_default ? ' (alapértelmezett)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Button
              variant="outlined"
              onClick={saveChannelSettings}
              disabled={channelSaving}
              sx={{ mt: 2 }}
            >
              {channelSaving ? 'Mentés…' : 'Cél szerinti küldő címek mentése'}
            </Button>
          </>
        )}
      </Paper>

      {/* Identity dialog */}
      <Dialog open={identityDialogOpen} onClose={() => !idSaving && setIdentityDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingIdentity ? 'Küldő cím szerkesztése' : 'Új küldő cím'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Megjelenő név"
            fullWidth
            size="small"
            sx={{ mt: 1, mb: 2 }}
            value={idFormName}
            onChange={(e) => setIdFormName(e.target.value)}
          />
          <TextField
            label="E-mail cím (Feladó)"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={idFormEmail}
            onChange={(e) => setIdFormEmail(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox checked={idFormDefault} onChange={(_, c) => setIdFormDefault(c)} />}
            label="Alapértelmezett automatikus e-mailekhez"
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Aláírás (HTML)
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 1, '& .ProseMirror': { minHeight: 120 } }}>
            {signatureEditor && <EditorContent editor={signatureEditor} />}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIdentityDialogOpen(false)} disabled={idSaving}>
            Mégse
          </Button>
          <Button variant="contained" onClick={saveIdentity} disabled={idSaving}>
            {idSaving ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test dialog */}
      <Dialog open={testOpen} onClose={() => !testSending && setTestOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Teszt e-mail</DialogTitle>
        <DialogContent>
          <TextField
            label="Címzett"
            fullWidth
            size="small"
            sx={{ mt: 1, mb: 2 }}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="sajat@email.hu"
          />
          <TextField
            select
            label="Küldő cím"
            fullWidth
            size="small"
            value={testIdentityId}
            onChange={(e) => setTestIdentityId(e.target.value)}
          >
            {identities.map((i) => (
              <MenuItem key={i.id} value={i.id}>
                {i.from_name} ({i.from_email}){i.is_default ? ' — alapértelmezett' : ''}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTestOpen(false)} disabled={testSending}>
            Mégse
          </Button>
          <Button variant="contained" onClick={sendTest} disabled={testSending || !testTo.trim()}>
            {testSending ? 'Küldés…' : 'Küldés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete connection */}
      <Dialog open={deleteConnOpen} onClose={() => !loading && setDeleteConnOpen(false)}>
        <DialogTitle>Kapcsolat eltávolítása</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Biztosan törli a levelező szervert? Előbb törölje az összes küldő címet — ha még vannak címek, a törlés nem
            engedélyezett.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConnOpen(false)}>Mégse</Button>
          <Button color="error" variant="contained" onClick={removeConnection} disabled={loading}>
            Eltávolítás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete identity */}
      <Dialog open={!!deleteId} onClose={() => !loading && setDeleteId(null)}>
        <DialogTitle>Küldő cím törlése</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Törli: <strong>{deleteId?.from_email}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Mégse</Button>
          <Button color="error" variant="contained" onClick={removeIdentity} disabled={loading}>
            Törlés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
