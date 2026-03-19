'use client'

import React, { useState, useEffect } from 'react'
import SupplierEmailPoIntroEditor from '@/components/suppliers/SupplierEmailPoIntroEditor'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Checkbox,
  FormControlLabel,
  Alert,
  Link
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface OrderChannel {
  id: string
  channel_type: string
  name: string | null
  url_template: string | null
  description: string | null
  is_default: boolean
}

interface OrderChannelsCardProps {
  supplierId: string
  initialOrderChannels: OrderChannel[]
  /** Beszállítói PO e-mail bevezető (suppliers.email_po_intro_html) — szerkesztés e-mail csatorna dialógusban */
  emailPoIntroHtml?: string | null
  onUpdate: () => void
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  email: 'E-mail',
  phone: 'Telefon',
  in_person: 'Személyes',
  internet: 'Internet'
}

export default function OrderChannelsCard({
  supplierId,
  initialOrderChannels,
  emailPoIntroHtml = null,
  onUpdate
}: OrderChannelsCardProps) {
  const [orderChannels, setOrderChannels] = useState<OrderChannel[]>(initialOrderChannels)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<OrderChannel | null>(null)
  const [deletingChannel, setDeletingChannel] = useState<OrderChannel | null>(null)
  const [formData, setFormData] = useState({
    channel_type: 'email',
    name: '',
    url_template: '',
    description: '',
    is_default: false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [emailPoIntroDraft, setEmailPoIntroDraft] = useState('')
  const [introEditorMountKey, setIntroEditorMountKey] = useState(0)

  useEffect(() => {
    setOrderChannels(initialOrderChannels)
  }, [initialOrderChannels])

  const handleOpenDialog = (channel?: OrderChannel) => {
    const intro = emailPoIntroHtml ?? ''
    setEmailPoIntroDraft(intro)
    setIntroEditorMountKey((k) => k + 1)
    if (channel) {
      setEditingChannel(channel)
      setFormData({
        channel_type: channel.channel_type,
        name: channel.name || '',
        url_template: channel.url_template || '',
        description: channel.description || '',
        is_default: channel.is_default
      })
    } else {
      setEditingChannel(null)
      setFormData({
        channel_type: 'email',
        name: '',
        url_template: '',
        description: '',
        is_default: false
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingChannel(null)
    setFormData({
      channel_type: 'email',
      name: '',
      url_template: '',
      description: '',
      is_default: false
    })
    setErrors({})
  }

  const handleOpenDeleteDialog = (channel: OrderChannel) => {
    setDeletingChannel(channel)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingChannel(null)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.channel_type) {
      newErrors.channel_type = 'A rendelési csatorna típusa kötelező'
    }

    // If internet type, url_template is required
    if (formData.channel_type === 'internet' && !formData.url_template.trim()) {
      newErrors.url_template = 'Az internetes rendeléshez URL sablon kötelező'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      const url = editingChannel
        ? `/api/suppliers/${supplierId}/order-channels/${editingChannel.id}`
        : `/api/suppliers/${supplierId}/order-channels`
      const method = editingChannel ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel_type: formData.channel_type,
          name: formData.name.trim() || null,
          url_template: formData.url_template.trim() || null,
          description: formData.description.trim() || null,
          is_default: formData.is_default
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedChannel = result.order_channel

      if (formData.channel_type === 'email') {
        const patchRes = await fetch(`/api/suppliers/${supplierId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_po_intro_html: emailPoIntroDraft.trim() ? emailPoIntroDraft : null
          })
        })
        if (!patchRes.ok) {
          const errJson = await patchRes.json().catch(() => ({}))
          throw new Error(errJson.error || 'Hiba a bevezető szöveg mentésekor')
        }
      }

      if (editingChannel) {
        // If setting as default, unset others
        if (formData.is_default) {
          setOrderChannels(prev =>
            prev.map(ch => ({
              ...ch,
              is_default: ch.id === editingChannel.id ? true : false
            }))
          )
        } else {
          setOrderChannels(prev =>
            prev.map(ch => (ch.id === editingChannel.id ? updatedChannel : ch))
          )
        }
        toast.success('Rendelési csatorna sikeresen frissítve')
      } else {
        // If setting as default, unset others
        if (formData.is_default) {
          setOrderChannels(prev =>
            prev.map(ch => ({ ...ch, is_default: false })).concat(updatedChannel)
          )
        } else {
          setOrderChannels(prev => [...prev, updatedChannel])
        }
        toast.success('Rendelési csatorna sikeresen hozzáadva')
      }

      handleCloseDialog()
      onUpdate()
    } catch (error) {
      console.error('Error saving order channel:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingChannel) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/order-channels/${deletingChannel.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setOrderChannels(prev => prev.filter(ch => ch.id !== deletingChannel.id))
      toast.success('Rendelési csatorna sikeresen törölve')
      handleCloseDeleteDialog()
      onUpdate()
    } catch (error) {
      console.error('Error deleting order channel:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  const testUrlTemplate = (urlTemplate: string) => {
    // Replace placeholders with example values
    const testUrl = urlTemplate
      .replace(/\{\{sku\}\}/g, 'TEST-SKU-123')
      .replace(/\{\{name\}\}/g, 'Test Product')
      .replace(/\{\{ean\}\}/g, '1234567890123')
    window.open(testUrl, '_blank')
  }

  return (
    <>
      <Paper 
        elevation={0}
        sx={{ 
          p: 3,
          bgcolor: 'white',
          border: '2px solid',
          borderColor: '#9c27b0',
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: '#9c27b0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
            }}>
              <ShoppingCartIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
              Rendelési csatornák
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              borderColor: '#9c27b0',
              color: '#7b1fa2',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#7b1fa2',
                bgcolor: '#f3e5f5'
              }
            }}
          >
            Új csatorna
          </Button>
        </Box>

        {orderChannels.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Még nincs rendelési csatorna hozzáadva
          </Typography>
        ) : (
          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{
              borderColor: '#ce93d8',
              '& .MuiTableRow-root:hover': {
                bgcolor: '#fce4ec'
              }
            }}
          >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#fce4ec' }}>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Típus</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Név</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>URL sablon</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Alapértelmezett</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, width: 120, fontSize: '0.875rem' }}>Műveletek</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderChannels.map((channel) => (
                    <TableRow key={channel.id} hover>
                      <TableCell sx={{ py: 1 }}>
                        <Chip
                          label={CHANNEL_TYPE_LABELS[channel.channel_type] || channel.channel_type}
                          size="small"
                          sx={{
                            borderColor: '#9c27b0',
                            color: '#7b1fa2',
                            fontWeight: 500
                          }}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>{channel.name || '-'}</TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {channel.url_template ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {channel.url_template}
                            </Typography>
                            {channel.channel_type === 'internet' && (
                              <IconButton
                                size="small"
                                onClick={() => testUrlTemplate(channel.url_template!)}
                                title="URL tesztelése"
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {channel.is_default && (
                          <Chip 
                            label="Alapértelmezett" 
                            size="small" 
                            sx={{
                              bgcolor: '#9c27b0',
                              color: 'white',
                              fontWeight: 500
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(channel)}
                          sx={{ mr: 0.5 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDeleteDialog(channel)}
                        >
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingChannel ? 'Rendelési csatorna szerkesztése' : 'Új rendelési csatorna hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth required error={!!errors.channel_type}>
              <InputLabel>Rendelési csatorna típusa</InputLabel>
              <Select
                value={formData.channel_type}
                label="Rendelési csatorna típusa"
                onChange={(e) => setFormData(prev => ({ ...prev, channel_type: e.target.value }))}
              >
                <MenuItem value="email">E-mail</MenuItem>
                <MenuItem value="phone">Telefon</MenuItem>
                <MenuItem value="in_person">Személyes</MenuItem>
                <MenuItem value="internet">Internet</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Név"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              helperText="Opcionális név a csatornához (pl. 'Webshop keresés SKU alapján')"
            />

            {formData.channel_type === 'email' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Beszerzési rendelés e-mail — bevezető szöveg
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ez a szöveg a beszállítónak küldött rendelés e-mail elején jelenik meg (a tételek és aláírás
                  utána következnek). A mentés a csatornával együtt történik.
                </Typography>
                <SupplierEmailPoIntroEditor
                  key={introEditorMountKey}
                  initialContent={emailPoIntroDraft}
                  onHtmlChange={setEmailPoIntroDraft}
                />
              </Box>
            )}

            {formData.channel_type === 'internet' && (
              <>
                <TextField
                  label="URL sablon *"
                  value={formData.url_template}
                  onChange={(e) => setFormData(prev => ({ ...prev, url_template: e.target.value }))}
                  fullWidth
                  required
                  error={!!errors.url_template}
                  helperText={
                    errors.url_template ||
                    'Használjon helyőrzőket: {{sku}}, {{supplier_sku}}, {{name}}, {{ean}}. Példa: https://example.com/search?q={{supplier_sku}}'
                  }
                  placeholder="https://www.zar-vasalas.hu/shop_searchcomplex.php?search={{sku}}&overlay=search_error_no"
                />
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Elérhető helyőrzők:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li><code>{'{{sku}}'}</code> - Termék SKU</li>
                      <li><code>{'{{supplier_sku}}'}</code> - Gyártói cikkszám</li>
                      <li><code>{'{{name}}'}</code> - Termék neve</li>
                      <li><code>{'{{ean}}'}</code> - EAN kód</li>
                    </ul>
                  </Typography>
                </Alert>
              </>
            )}

            <TextField
              label="Leírás"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              helperText="Opcionális leírás a rendelési csatornáról"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                />
              }
              label="Alapértelmezett rendelési csatorna"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingChannel ? 'Frissítés' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné ezt a rendelési csatornát?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting}>
            Mégse
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
