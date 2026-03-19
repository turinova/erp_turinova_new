'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Send as SendIcon,
  MarkEmailRead as MarkEmailReadIcon,
  TableChart as TableChartIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import OrderStatusTemplateRichEditor from '@/components/settings/order-notifications/OrderStatusTemplateRichEditor'
import { ORDER_STATUS_LABEL_HU, ORDER_STATUS_MERGE_GROUPS } from '@/lib/order-status-notification-merge'

export type TemplateRow = {
  id: string
  order_status: string
  enabled: boolean
  subject_template: string
  body_html: string
  sort_order: number
  updated_at?: string
}

const SUBJECT_FIELDS = ORDER_STATUS_MERGE_GROUPS.flatMap((g) =>
  g.fields.filter((f) => !f.bodyOnly)
)

export default function OrderStatusNotificationsClient() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [edit, setEdit] = useState<TemplateRow | null>(null)
  const [subjectDraft, setSubjectDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const subjectRef = useRef<HTMLInputElement | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/email/order-status-templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Betöltés sikertelen')
      setTemplates(data.templates || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useMemo(() => {
    load()
  }, [load])

  const openEdit = (row: TemplateRow) => {
    setEdit(row)
    setSubjectDraft(row.subject_template)
    setBodyDraft(row.body_html)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEdit(null)
  }

  const saveDialog = async () => {
    if (!edit) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/email/order-status-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: [
            {
              order_status: edit.order_status,
              subject_template: subjectDraft,
              body_html: bodyDraft
            }
          ]
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mentés sikertelen')
      setTemplates(data.templates || [])
      toast.success('Sablon mentve')
      closeDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (row: TemplateRow, enabled: boolean) => {
    try {
      const res = await fetch('/api/settings/email/order-status-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: [{ order_status: row.order_status, enabled }]
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Frissítés sikertelen')
      setTemplates(data.templates || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba')
    }
  }

  const sendTest = async () => {
    if (!edit) return
    setTestLoading(true)
    try {
      const res = await fetch('/api/settings/email/order-status-templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_status: edit.order_status })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail || 'Teszt sikertelen')
      toast.success('Teszt e-mail elküldve')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Teszt sikertelen')
    } finally {
      setTestLoading(false)
    }
  }

  const insertSubjectToken = useCallback((key: string) => {
    const token = `{{${key}}}`
    const el = subjectRef.current
    setSubjectDraft((s) => {
      const start = el?.selectionStart ?? s.length
      const end = el?.selectionEnd ?? start
      const next = s.slice(0, start) + token + s.slice(end)
      const pos = start + token.length
      setTimeout(() => {
        try {
          el?.setSelectionRange(pos, pos)
          el?.focus()
        } catch {
          // ignore
        }
      }, 0)
      return next
    })
  }, [])

  const appendBodyToken = useCallback((key: string) => {
    setBodyDraft((b) => `${b}{{${key}}}`)
  }, [])

  const subjectChipRow = useMemo(
    () => (
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {SUBJECT_FIELDS.map((f) => (
          <Chip
            key={f.key}
            size="small"
            label={f.label}
            onClick={() => insertSubjectToken(f.key)}
            sx={{
              cursor: 'pointer',
              fontWeight: 500,
              bgcolor: 'action.hover',
              border: '1px solid transparent',
              '&:hover': { bgcolor: 'action.selected', borderColor: 'divider' }
            }}
          />
        ))}
      </Stack>
    ),
    [insertSubjectToken]
  )

  return (
    <Box>
      <Alert
        severity="info"
        icon={<MarkEmailReadIcon />}
        sx={{
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
          '& .MuiAlert-message': { width: '100%' }
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.65, color: 'text.primary' }}>
          A levél a <strong>státusz váltásakor</strong> megy ki, ha a sor aktív. Feladó:{' '}
          <Box component={NextLink} href="/settings/email" sx={{ fontWeight: 600, color: 'primary.main' }}>
            E-mail → Csatornák → Rendelés — státusz értesítések
          </Box>
          . A <strong>{'{{order_items_table}}'}</strong> a levél küldésekor töltődik fel (kép, név, SKU, mennyiség,
          összeg).
        </Typography>
      </Alert>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            Sablonok
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
            Kapcsolja be, hol értesüljön a vevő. Szerkesztésnél változókat szúrhat be — csoportokba rendezve.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: 12 } }}>
                  <TableCell>Státusz</TableCell>
                  <TableCell align="center" sx={{ width: 88 }}>
                    Aktív
                  </TableCell>
                  <TableCell>Tárgy</TableCell>
                  <TableCell align="right" sx={{ width: 72 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((row) => (
                  <TableRow key={row.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {ORDER_STATUS_LABEL_HU[row.order_status] || row.order_status}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={row.enabled}
                        onChange={(_, c) => toggleEnabled(row, c)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap title={row.subject_template} color="text.secondary">
                        {row.subject_template}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(row)} aria-label="Szerkesztés">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            pb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
              {edit ? ORDER_STATUS_LABEL_HU[edit.order_status] || edit.order_status : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sablon szerkesztése
            </Typography>
          </Box>
          <IconButton onClick={closeDialog} size="small" sx={{ mt: -0.5 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
            A <strong>tárgyban</strong> nincs táblázat-változó. A levéltörzsben csoportok szerint szúrhat be mezőket; a
            tételek táblázat egy kattintással is beszúrható.
          </Typography>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 1,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'text.secondary'
            }}
          >
            Tárgy — változók
          </Typography>
          {subjectChipRow}

          <TextField
            inputRef={subjectRef}
            fullWidth
            size="small"
            label="Tárgy"
            value={subjectDraft}
            onChange={(e) => setSubjectDraft(e.target.value)}
            sx={{ mt: 2, mb: 3 }}
          />

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 1.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'text.secondary'
            }}
          >
            Levéltörzs — változók
          </Typography>

          <Stack spacing={2} sx={{ mb: 2 }}>
            {ORDER_STATUS_MERGE_GROUPS.map((group) => (
              <Paper
                key={group.id}
                elevation={0}
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'grey.50'
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>
                  {group.title}
                </Typography>
                {group.hint && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                    {group.hint}
                  </Typography>
                )}
                {group.id === 'items' ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TableChartIcon />}
                    onClick={() => appendBodyToken('order_items_table')}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { borderColor: 'text.secondary', bgcolor: 'background.paper' }
                    }}
                  >
                    Tételek táblázat beszúrása
                  </Button>
                ) : (
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {group.fields.map((f) => (
                      <Chip
                        key={f.key}
                        size="small"
                        label={f.label}
                        onClick={() => appendBodyToken(f.key)}
                        sx={{
                          cursor: 'pointer',
                          fontWeight: 500,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Levéltörzs
          </Typography>
          <OrderStatusTemplateRichEditor html={bodyDraft} onHtmlChange={setBodyDraft} />
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1,
            flexWrap: 'wrap',
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}
        >
          <Button onClick={closeDialog} sx={{ textTransform: 'none' }}>
            Mégse
          </Button>
          <Button
            variant="outlined"
            startIcon={testLoading ? <CircularProgress size={18} /> : <SendIcon />}
            onClick={sendTest}
            disabled={testLoading || !edit}
            sx={{ textTransform: 'none' }}
          >
            Teszt e-mail
          </Button>
          <Button variant="contained" onClick={saveDialog} disabled={saving} sx={{ textTransform: 'none' }}>
            {saving ? <CircularProgress size={22} /> : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
