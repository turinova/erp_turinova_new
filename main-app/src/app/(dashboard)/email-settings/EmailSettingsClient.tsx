'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  Grid,
  Divider,
  Button,
  TextField,
  CircularProgress,
  FormControlLabel,
  Switch
} from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon, Mail as MailIcon, Send as SendIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import '@/libs/styles/tiptapEditor.css'

interface SMTPSetting {
  id: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from_email: string
  from_name: string
  signature_html: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface EmailSettingsClientProps {
  initialSettings: SMTPSetting | null
}

export default function EmailSettingsClient({ initialSettings }: EmailSettingsClientProps) {
  const router = useRouter()
  const { hasAccess, loading: permissionsLoading } = usePagePermission('/email-settings')

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [formData, setFormData] = useState({
    host: initialSettings?.host || '',
    port: initialSettings?.port || 465,
    secure: initialSettings?.secure ?? true,
    user: initialSettings?.user || '',
    password: '', // Don't prefill password
    from_email: initialSettings?.from_email || '',
    from_name: initialSettings?.from_name || 'Turinova',
    signature_html: initialSettings?.signature_html || '',
    is_active: initialSettings?.is_active ?? true
  })

  // Initialize TipTap editor for signature
  const signatureEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Írja be az aláírást...'
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
    ],
    content: initialSettings?.signature_html || '',
    immediatelyRender: false,
  })

  // Update editor content when initialSettings changes
  useEffect(() => {
    if (signatureEditor && initialSettings?.signature_html !== undefined) {
      signatureEditor.commands.setContent(initialSettings.signature_html || '')
    }
  }, [signatureEditor, initialSettings?.signature_html])

  if (permissionsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az oldal megtekintéséhez
        </Typography>
      </Box>
    )
  }

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData(prev => ({
      ...prev,
      [field]: field === 'port' ? parseInt(value as string) || 465 : value
    }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.host.trim()) {
      newErrors.host = 'SMTP szerver kötelező'
    }

    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Érvényes port szám szükséges (1-65535)'
    }

    if (!formData.user.trim()) {
      newErrors.user = 'Felhasználónév kötelező'
    }

    if (!initialSettings && !formData.password.trim()) {
      newErrors.password = 'Jelszó kötelező'
    }

    if (!formData.from_email.trim()) {
      newErrors.from_email = 'Feladó email cím kötelező'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.from_email)) {
      newErrors.from_email = 'Érvényes email cím szükséges'
    }

    if (!formData.from_name.trim()) {
      newErrors.from_name = 'Feladó név kötelező'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleTest = async () => {
    // Basic validation for test
    if (!formData.host.trim() || !formData.port || !formData.user.trim() || !formData.password.trim() || !formData.from_email.trim()) {
      toast.error('Kérjük, töltse ki az összes mezőt a teszteléshez')
      return
    }

    setIsTesting(true)
    try {
      const response = await fetch('/api/email-settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: formData.host,
          port: formData.port,
          secure: formData.secure,
          user: formData.user,
          password: formData.password,
          from_email: formData.from_email,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(result.message || 'SMTP kapcsolat sikeres!')
      } else {
        toast.error(result.error || 'SMTP kapcsolat hiba')
      }
    } catch (error: any) {
      console.error('Error testing SMTP connection:', error)
      toast.error('Hiba a kapcsolat tesztelése során: ' + (error.message || 'Ismeretlen hiba'))
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Kérjük, javítsa ki a hibákat')
      return
    }

    setIsSaving(true)
    try {
      const url = initialSettings 
        ? `/api/email-settings/${initialSettings.id}`
        : '/api/email-settings'
      
      const method = initialSettings ? 'PUT' : 'POST'

      // Get signature HTML from editor
      const signatureHtml = signatureEditor?.getHTML() || ''

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          signature_html: signatureHtml
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Hiba a mentés során')
      }

      toast.success('Email beállítások sikeresen mentve')
      router.refresh()
    } catch (error: any) {
      console.error('Error saving email settings:', error)
      toast.error(error.message || 'Hiba a mentés során')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <MailIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Email beállítások
        </Typography>
      </Breadcrumbs>

      {/* Page Title */}
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Email beállítások
      </Typography>

      {/* Form Card */}
      <Paper sx={{ p: 4 }}>
        <Grid container spacing={3}>
          {/* SMTP Server */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
              SMTP Szerver
            </Typography>
            <Divider sx={{ mb: 3 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="SMTP Szerver (host)"
              value={formData.host}
              onChange={handleChange('host')}
              error={!!errors.host}
              helperText={errors.host}
              placeholder="mail.hirosablak.hu"
              required
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Port"
              type="number"
              value={formData.port}
              onChange={handleChange('port')}
              error={!!errors.port}
              helperText={errors.port}
              inputProps={{ min: 1, max: 65535 }}
              required
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.secure}
                  onChange={handleChange('secure')}
                  color="primary"
                />
              }
              label="SSL/TLS (465 port esetén)"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {formData.secure ? 'SSL (465)' : 'TLS (587)'}
            </Typography>
          </Grid>

          {/* Authentication */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 500 }}>
              Hitelesítés
            </Typography>
            <Divider sx={{ mb: 3 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Felhasználónév"
              value={formData.user}
              onChange={handleChange('user')}
              error={!!errors.user}
              helperText={errors.user}
              placeholder="teszt@hirosablak.hu"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Jelszó"
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              error={!!errors.password}
              helperText={errors.password || (initialSettings ? 'Hagyja üresen, ha nem szeretné megváltoztatni' : '')}
              required={!initialSettings}
            />
          </Grid>

          {/* Email Settings */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 500 }}>
              Email Beállítások
            </Typography>
            <Divider sx={{ mb: 3 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Feladó email cím"
              type="email"
              value={formData.from_email}
              onChange={handleChange('from_email')}
              error={!!errors.from_email}
              helperText={errors.from_email}
              placeholder="teszt@hirosablak.hu"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Feladó név"
              value={formData.from_name}
              onChange={handleChange('from_name')}
              error={!!errors.from_name}
              helperText={errors.from_name}
              placeholder="Turinova"
              required
            />
          </Grid>

          {/* Signature */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 500 }}>
              Email Aláírás
            </Typography>
            <Divider sx={{ mb: 3 }} />
          </Grid>

          <Grid item xs={12}>
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                minHeight: '200px',
                '& .ProseMirror': {
                  minHeight: '200px',
                  fontSize: '14px',
                  p: 2
                }
              }}
            >
              <EditorContent editor={signatureEditor} />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Az aláírás manuálisan beszúrható az email szerkesztőben
            </Typography>
          </Grid>

          {/* Active Status */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={handleChange('is_active')}
                  color="primary"
                />
              }
              label="Aktív"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Csak az aktív beállítások használhatók email küldéshez
            </Typography>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                size="large"
                startIcon={isTesting ? <CircularProgress size={20} /> : <SendIcon />}
                onClick={handleTest}
                disabled={isTesting || isSaving}
              >
                {isTesting ? 'Tesztelés...' : 'Kapcsolat tesztelése'}
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={isSaving || isTesting}
              >
                {isSaving ? 'Mentés...' : 'Mentés'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

