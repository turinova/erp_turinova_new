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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import { 
  Home as HomeIcon, 
  Save as SaveIcon, 
  Mail as MailIcon, 
  Send as SendIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'
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
  imap_host: string
  imap_port: number
  imap_secure: boolean
  created_at: string
  updated_at: string
}

interface EmailSettingsClientProps {
  initialSettings: SMTPSetting[]
}

export default function EmailSettingsClient({ initialSettings }: EmailSettingsClientProps) {
  const router = useRouter()
  const { hasAccess, loading: permissionsLoading } = usePagePermission('/email-settings')

  const [settings, setSettings] = useState<SMTPSetting[]>(initialSettings)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<SMTPSetting | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
    from_email: '',
    from_name: 'Turinova',
    signature_html: '',
    is_active: true,
    imap_host: '',
    imap_port: 993,
    imap_secure: true
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
    content: '',
    immediatelyRender: false,
  })

  // Update editor content when editing setting changes
  useEffect(() => {
    if (signatureEditor && editingSetting?.signature_html !== undefined) {
      signatureEditor.commands.setContent(editingSetting.signature_html || '')
    } else if (signatureEditor && !editingSetting) {
      signatureEditor.commands.setContent('')
    }
  }, [signatureEditor, editingSetting])

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
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: (field === 'port' || field === 'imap_port') ? parseInt(value as string) || (field === 'port' ? 465 : 993) : value
      }
      
      // Auto-fill IMAP host when SMTP host changes (if IMAP host is empty)
      if (field === 'host' && !newData.imap_host) {
        newData.imap_host = value as string
      }
      
      return newData
    })
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

    if (!editingSetting && !formData.password.trim()) {
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

    // IMAP validation (required)
    if (!formData.imap_host.trim()) {
      newErrors.imap_host = 'IMAP szerver kötelező'
    }

    if (!formData.imap_port || formData.imap_port < 1 || formData.imap_port > 65535) {
      newErrors.imap_port = 'Érvényes IMAP port szám szükséges (1-65535)'
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
      const url = editingSetting 
        ? `/api/email-settings/${editingSetting.id}`
        : '/api/email-settings'
      
      const method = editingSetting ? 'PUT' : 'POST'

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

      const savedSetting = await response.json()
      
      if (editingSetting) {
        setSettings(prev => prev.map(s => s.id === editingSetting.id ? savedSetting : s))
        toast.success('Email beállítások sikeresen frissítve')
      } else {
        setSettings(prev => [savedSetting, ...prev])
        toast.success('Email beállítások sikeresen létrehozva')
      }

      handleCloseModal()
      router.refresh()
    } catch (error: any) {
      console.error('Error saving email settings:', error)
      toast.error(error.message || 'Hiba a mentés során')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törölni szeretné ezt az email beállítást?')) {
      return
    }

    setIsDeleting(id)
    try {
      const response = await fetch(`/api/email-settings/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Hiba a törlés során')
      }

      setSettings(prev => prev.filter(s => s.id !== id))
      toast.success('Email beállítás sikeresen törölve')
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting email settings:', error)
      toast.error(error.message || 'Hiba a törlés során')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleOpenAddModal = () => {
    setEditingSetting(null)
    setFormData({
      host: '',
      port: 465,
      secure: true,
      user: '',
      password: '',
      from_email: '',
      from_name: 'Turinova',
      signature_html: '',
      is_active: true,
      imap_host: '',
      imap_port: 993,
      imap_secure: true
    })
    if (signatureEditor) {
      signatureEditor.commands.setContent('')
    }
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (setting: SMTPSetting) => {
    setEditingSetting(setting)
    setFormData({
      host: setting.host,
      port: setting.port,
      secure: setting.secure,
      user: setting.user,
      password: '', // Don't prefill password
      from_email: setting.from_email,
      from_name: setting.from_name,
      signature_html: setting.signature_html || '',
      is_active: setting.is_active,
      imap_host: setting.imap_host || setting.host, // Default to SMTP host if not set
      imap_port: setting.imap_port || 993,
      imap_secure: setting.imap_secure ?? true
    })
    if (signatureEditor) {
      signatureEditor.commands.setContent(setting.signature_html || '')
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSetting(null)
    setErrors({})
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

      {/* Page Title and Add Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Email beállítások
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenAddModal}
        >
          Új email fiók hozzáadása
        </Button>
      </Box>

      {/* Accounts Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Feladó név</TableCell>
                <TableCell>Feladó email</TableCell>
                <TableCell>SMTP szerver</TableCell>
                <TableCell>Port</TableCell>
                <TableCell align="center">Aktív</TableCell>
                <TableCell align="right">Műveletek</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      Nincs email fiók beállítva. Kattintson az "Új email fiók hozzáadása" gombra.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                settings.map((setting) => (
                  <TableRow key={setting.id} hover>
                    <TableCell>{setting.from_name}</TableCell>
                    <TableCell>{setting.from_email}</TableCell>
                    <TableCell>{setting.host}</TableCell>
                    <TableCell>{setting.port}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={setting.is_active ? 'Aktív' : 'Inaktív'}
                        color={setting.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditModal(setting)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(setting.id)}
                        color="error"
                        disabled={isDeleting === setting.id}
                      >
                        {isDeleting === setting.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Modal */}
      <Dialog
        open={isModalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          {editingSetting ? 'Email beállítások szerkesztése' : 'Új email fiók hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
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
                helperText={errors.password || (editingSetting ? 'Hagyja üresen, ha nem szeretné megváltoztatni' : '')}
                required={!editingSetting}
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

            {/* IMAP Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 500 }}>
                IMAP Beállítások (Sent mappa)
              </Typography>
              <Divider sx={{ mb: 3 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="IMAP Szerver (host)"
                value={formData.imap_host}
                onChange={handleChange('imap_host')}
                error={!!errors.imap_host}
                helperText={errors.imap_host || 'Általában ugyanaz, mint az SMTP szerver'}
                placeholder="mail.hirosablak.hu"
                required
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="IMAP Port"
                type="number"
                value={formData.imap_port}
                onChange={handleChange('imap_port')}
                error={!!errors.imap_port}
                helperText={errors.imap_port}
                inputProps={{ min: 1, max: 65535 }}
                required
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.imap_secure}
                    onChange={handleChange('imap_secure')}
                    color="primary"
                  />
                }
                label="SSL/TLS (993 port esetén)"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {formData.imap_secure ? 'SSL (993)' : 'TLS (143)'}
              </Typography>
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
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseModal}>
            Mégse
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={isTesting ? <CircularProgress size={20} /> : <SendIcon />}
            onClick={handleTest}
            disabled={isTesting || isSaving}
          >
            {isTesting ? 'Tesztelés...' : 'Kapcsolat tesztelése'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={isSaving || isTesting}
          >
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
