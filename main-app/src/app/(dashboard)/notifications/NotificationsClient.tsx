'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Stack
} from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon, Info as InfoIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface SmsSettings {
  id: string
  message_template: string
  created_at: string
  updated_at: string
}

interface NotificationsClientProps {
  initialSettings: SmsSettings | null
  companyName: string
}

export default function NotificationsClient({ initialSettings, companyName }: NotificationsClientProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [messageTemplate, setMessageTemplate] = useState(initialSettings?.message_template || '')

  // Update form data when initial settings change
  useEffect(() => {
    if (initialSettings) {
      setMessageTemplate(initialSettings.message_template)
    }
  }, [initialSettings])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!messageTemplate.trim()) {
      toast.error('Az üzenet sablon nem lehet üres')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/sms-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_template: messageTemplate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Hiba történt a mentés során')
      }

      toast.success('SMS sablon sikeresen mentve')
      
      // Refresh the page to show updated data
      router.refresh()
    } catch (error) {
      console.error('Error saving SMS settings:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a mentés során')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle reset to default
  const handleReset = () => {
    const defaultTemplate = 'Kedves {customer_name}! Az On {order_number} szamu rendelese elkeszult es atvehetο. Udvozlettel, {company_name}'
    setMessageTemplate(defaultTemplate)
  }

  // Count characters
  const charCount = messageTemplate.length
  const isOverLimit = charCount > 160

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary">Értesítések</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          SMS Értesítési Beállítások
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Szerkeszd az SMS értesítések szövegét, amelyet az ügyfelek kapnak, amikor a rendelésük elkészül
        </Typography>
      </Box>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Paper sx={{ p: 3, mb: 3 }}>
          {/* SMS Template Section */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            SMS Üzenet Sablon
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Üzenet szövege"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            placeholder="Kedves {customer_name}! Az On {order_number} szamu rendelese elkeszult es atvehetο. Udvozlettel, {company_name}"
            sx={{ mb: 2 }}
          />
          
          {/* Character counter outside TextField to avoid HTML nesting issue */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Írj be tetszőleges szöveget a változókkal együtt
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ color: isOverLimit ? 'error.main' : charCount > 140 ? 'warning.main' : 'text.secondary' }}
            >
              {charCount}/160 karakter
              {isOverLimit && ' (Túl hosszú! Több SMS-t fog küldeni)'}
            </Typography>
          </Box>

          {/* Available Variables */}
          <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              <strong>Elérhető változók:</strong>
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip label="{customer_name}" size="small" color="primary" variant="outlined" />
              <Chip label="{order_number}" size="small" color="primary" variant="outlined" />
              <Chip label="{company_name}" size="small" color="primary" variant="outlined" />
              <Chip label="{material_name}" size="small" color="primary" variant="outlined" />
            </Stack>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              • <strong>{'{customer_name}'}</strong> - Ügyfél neve (pl.: Mező Dávid)
              <br />
              • <strong>{'{order_number}'}</strong> - Megrendelés száma (pl.: ORD-2025-10-22-001)
              <br />
              • <strong>{'{company_name}'}</strong> - Cég neve (pl.: Turinova)
              <br />
              • <strong>{'{material_name}'}</strong> - Felhasznált anyagok egyedi listája (pl.: EGGER U999 ST9, KRONOSPAN K001)
            </Typography>
          </Alert>

          {/* ASCII Warning */}
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>⚠️ Fontos!</strong> Használj ASCII karaktereket az SMS-ben!
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              • ő, Ő → o, O
              <br />
              • ű, Ű → u, U
              <br />
              • á, Á → a, A
              <br />
              • é, É → e, E
              <br />
              • í, Í → i, I
              <br />
              • ó, Ó → o, O
              <br />
              • ö, Ö → o, O
              <br />
              • ü, Ü → u, U
            </Typography>
          </Alert>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              disabled={isSaving || !messageTemplate.trim()}
            >
              {isSaving ? 'Mentés...' : 'Mentés'}
            </Button>
            <Button
              type="button"
              variant="outlined"
              onClick={handleReset}
              disabled={isSaving}
            >
              Alapértelmezett visszaállítása
            </Button>
          </Box>
        </Paper>
      </form>

      {/* Preview Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Előnézet (példa adatokkal)
        </Typography>
        <Box
          sx={{
            p: 2,
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {messageTemplate
            .replace(/{customer_name}/g, 'Mezo David')
            .replace(/{order_number}/g, 'ORD-2025-10-22-001')
            .replace(/{company_name}/g, companyName)
            .replace(/{material_name}/g, 'EGGER U999 ST9, KRONOSPAN K001')}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Ez egy előnézet valós adatokkal. Az ügyfelek ezt az üzenetet fogják látni.
        </Typography>
      </Paper>
    </Box>
  )
}

