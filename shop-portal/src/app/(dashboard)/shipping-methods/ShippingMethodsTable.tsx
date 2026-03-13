'use client'

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Checkbox,
  Chip,
  FormControlLabel
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  LocalShipping as ShippingIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface ShippingMethod {
  id: string
  name: string
  code: string | null
  extension: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ShippingMethodsTableProps {
  initialShippingMethods: ShippingMethod[]
}

export default function ShippingMethodsTable({ initialShippingMethods }: ShippingMethodsTableProps) {
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>(initialShippingMethods)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null)
  const [deletingMethod, setDeletingMethod] = useState<ShippingMethod | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    extension: '',
    is_active: true
  })
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (method?: ShippingMethod) => {
    if (method) {
      setEditingMethod(method)
      setFormData({
        name: method.name,
        code: method.code || '',
        extension: method.extension || '',
        is_active: method.is_active
      })
    } else {
      setEditingMethod(null)
      setFormData({ name: '', code: '', extension: '', is_active: true })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingMethod(null)
    setFormData({ name: '', code: '', extension: '', is_active: true })
    setErrors({})
  }

  const handleOpenDeleteDialog = (method: ShippingMethod) => {
    setDeletingMethod(method)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingMethod(null)
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(new Set(shippingMethods.map(m => m.id)))
    else setSelectedIds(new Set())
  }

  const handleSelectOne = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setErrors({ name: 'A szállítási mód neve kötelező' })
      return false
    }
    setErrors({})
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const url = editingMethod ? `/api/shipping-methods/${editingMethod.id}` : '/api/shipping-methods'
      const method = editingMethod ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          extension: formData.extension.trim() || null,
          is_active: formData.is_active
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Hiba a mentés során')
      }
      const result = await res.json()
      const row = result.shipping_method
      if (editingMethod) {
        setShippingMethods(prev =>
          prev.map(m => (m.id === editingMethod.id ? row : m))
        )
        toast.success('Szállítási mód frissítve')
      } else {
        setShippingMethods(prev =>
          [...prev, row].sort((a, b) => a.name.localeCompare(b.name))
        )
        toast.success('Szállítási mód létrehozva')
      }
      handleCloseDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingMethod) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/shipping-methods/${deletingMethod.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Hiba a törlés során')
      }
      setShippingMethods(prev => prev.filter(m => m.id !== deletingMethod.id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(deletingMethod.id)
        return next
      })
      toast.success('Szállítási mód törölve')
      handleCloseDeleteDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setDeleting(false)
    }
  }

  const isAllSelected =
    shippingMethods.length > 0 && selectedIds.size === shippingMethods.length
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < shippingMethods.length

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Szállítási módok kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Törzsadatok a webshop szállítási módjaihoz. A kapcsolatoknál leképezheti a platform kódokat az ERP szállítási módokra.
        </Typography>
      </Box>

      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
        A szállítási mód kódot (pl. GLSPARCELPOINT) a webshop kapcsolatnál lehet leképezni az ERP módra. Ha nincs leképezés, a rendszer a kód alapján próbál egyezni.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        {selectedIds.size > 0 && (
          <>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => {
                const first = shippingMethods.find(m => selectedIds.has(m.id))
                if (first) handleOpenDialog(first)
              }}
            >
              Szerkesztés ({selectedIds.size})
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                const first = shippingMethods.find(m => selectedIds.has(m.id))
                if (first) handleOpenDeleteDialog(first)
              }}
            >
              Törlés ({selectedIds.size})
            </Button>
          </>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ ml: 'auto' }}
        >
          Új szállítási mód
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={shippingMethods.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Kód</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Extension</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shippingMethods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ShippingIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs szállítási mód
                    </Typography>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                      Új szállítási mód
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              shippingMethods.map(method => (
                <TableRow
                  key={method.id}
                  hover
                  selected={selectedIds.has(method.id)}
                  onClick={() => handleOpenDialog(method)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell
                    padding="checkbox"
                    onClick={e => e.stopPropagation()}
                    sx={{ width: 40, py: 1 }}
                  >
                    <Checkbox
                      checked={selectedIds.has(method.id)}
                      onChange={e => handleSelectOne(method.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1, fontWeight: 500 }}>{method.name}</TableCell>
                  <TableCell sx={{ py: 1 }}>{method.code || '-'}</TableCell>
                  <TableCell sx={{ py: 1 }}>{method.extension || '-'}</TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={method.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      color={method.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMethod ? 'Szállítási mód szerkesztése' : 'Új szállítási mód'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Név"
            fullWidth
            required
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={!!errors.name}
            helperText={errors.name}
          />
          <TextField
            margin="dense"
            label="Kód"
            fullWidth
            placeholder="pl. GLS, GLSPARCELPOINT"
            value={formData.code}
            onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Extension"
            fullWidth
            placeholder="pl. GLSPARCELPOINT"
            value={formData.extension}
            onChange={e => setFormData(prev => ({ ...prev, extension: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_active}
                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              />
            }
            label="Aktív"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Mégse</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés</DialogTitle>
        <DialogContent>
          {deletingMethod && (
            <Typography>
              Biztosan törli a(z) &quot;{deletingMethod.name}&quot; szállítási módot?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Mégse</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Törlés…' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
