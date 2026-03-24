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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

type FeeType = 'SHIPPING' | 'PAYMENT' | 'PACKAGING' | 'STORAGE' | 'SERVICE' | 'OTHER'

interface FeeDefinition {
  id: string
  code: string
  name: string
  type: FeeType
  default_vat_rate: number
  default_net: number | null
  default_gross: number | null
  price_mode: 'fixed' | 'per_order' | 'manual_only'
  is_active: boolean
  is_system: boolean
  allow_manual_edit: boolean
  allow_delete_from_order: boolean
  sort_order: number
}

interface Props {
  initialFees: FeeDefinition[]
  vatRates: Array<{ id: string; name: string; kulcs: number }>
}

const feeTypes: FeeType[] = ['SHIPPING', 'PAYMENT', 'PACKAGING', 'STORAGE', 'SERVICE', 'OTHER']

export default function FeesTable({ initialFees, vatRates }: Props) {
  const [fees, setFees] = useState<FeeDefinition[]>(initialFees || [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<FeeDefinition | null>(null)
  const [deletingFee, setDeletingFee] = useState<FeeDefinition | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'OTHER' as FeeType,
    default_vat_rate: 27,
    default_gross: '',
    is_active: true,
    allow_manual_edit: true,
    allow_delete_from_order: true,
    sort_order: 100
  })

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'OTHER',
      default_vat_rate: 27,
      default_gross: '',
      is_active: true,
      allow_manual_edit: true,
      allow_delete_from_order: true,
      sort_order: 100
    })
  }

  const openDialog = (fee?: FeeDefinition) => {
    if (fee) {
      setEditingFee(fee)
      setFormData({
        code: fee.code,
        name: fee.name,
        type: fee.type,
        default_vat_rate: Number(fee.default_vat_rate) || 27,
        default_gross: fee.default_gross != null ? String(fee.default_gross) : '',
        is_active: fee.is_active,
        allow_manual_edit: fee.allow_manual_edit,
        allow_delete_from_order: fee.allow_delete_from_order,
        sort_order: Number(fee.sort_order) || 100
      })
    } else {
      setEditingFee(null)
      resetForm()
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Kód és név kötelező')
      return
    }
    setSaving(true)
    try {
      const url = editingFee ? `/api/fees/${editingFee.id}` : '/api/fees'
      const method = editingFee ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          type: formData.type,
          default_vat_rate: formData.default_vat_rate,
          default_gross: formData.default_gross === '' ? null : Number(formData.default_gross),
          is_active: formData.is_active,
          allow_manual_edit: formData.allow_manual_edit,
          allow_delete_from_order: formData.allow_delete_from_order,
          sort_order: formData.sort_order
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mentés sikertelen')
      const row = data.fee as FeeDefinition
      if (editingFee) {
        setFees(prev => prev.map(f => (f.id === editingFee.id ? row : f)))
      } else {
        setFees(prev => [...prev, row])
      }
      setDialogOpen(false)
      setEditingFee(null)
      resetForm()
      toast.success('Díj mentve')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingFee) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/fees/${deletingFee.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Törlés sikertelen')
      setFees(prev => prev.filter(f => f.id !== deletingFee.id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(deletingFee.id)
        return next
      })
      setDeleteDialogOpen(false)
      setDeletingFee(null)
      toast.success('Díj törölve')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Törlés sikertelen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Díj törzsadatok
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Katalógus alapú díjkezelés rendeléshez és számlázáshoz. A díjak rendelés szinten hozzáadhatók, szerkeszthetők és soft-delete-elve eltávolíthatók.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        A <strong>SHIPPING</strong> és <strong>PAYMENT</strong> típusú díjak az order fejléc díj mezőit is frissítik.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>
          Új díj
        </Button>
        {selectedIds.size === 1 && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              const row = fees.find(f => selectedIds.has(f.id))
              if (row) openDialog(row)
            }}
          >
            Szerkesztés
          </Button>
        )}
        {selectedIds.size === 1 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => {
              const row = fees.find(f => selectedIds.has(f.id))
              if (row) {
                setDeletingFee(row)
                setDeleteDialogOpen(true)
              }
            }}
          >
            Törlés
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={fees.length > 0 && selectedIds.size === fees.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < fees.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(fees.map(f => f.id)))
                    else setSelectedIds(new Set())
                  }}
                />
              </TableCell>
              <TableCell>Kód</TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Típus</TableCell>
              <TableCell align="right">Alapértelmezett bruttó</TableCell>
              <TableCell align="right">ÁFA %</TableCell>
              <TableCell align="right">Sorrend</TableCell>
              <TableCell>Állapot</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fees.map(fee => (
              <TableRow key={fee.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.has(fee.id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds)
                      if (e.target.checked) next.add(fee.id)
                      else next.delete(fee.id)
                      setSelectedIds(next)
                    }}
                  />
                </TableCell>
                <TableCell>{fee.code}</TableCell>
                <TableCell>{fee.name}</TableCell>
                <TableCell>{fee.type}</TableCell>
                <TableCell align="right">{fee.default_gross ?? '-'}</TableCell>
                <TableCell align="right">{fee.default_vat_rate}</TableCell>
                <TableCell align="right">{fee.sort_order}</TableCell>
                <TableCell>
                  {fee.is_active ? <Chip label="Aktív" size="small" color="success" /> : <Chip label="Inaktív" size="small" />}
                </TableCell>
              </TableRow>
            ))}
            {fees.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">Nincs még díj törzsadat.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFee ? 'Díj szerkesztése' : 'Új díj'}</DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <TextField
            label="Kód"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Név"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Típus"
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as FeeType }))}
            fullWidth
            sx={{ mb: 2 }}
          >
            {feeTypes.map(t => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label="Alapértelmezett bruttó"
            value={formData.default_gross}
            onChange={(e) => setFormData(prev => ({ ...prev, default_gross: e.target.value }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="ÁFA kulcs"
            value={formData.default_vat_rate}
            onChange={(e) => setFormData(prev => ({ ...prev, default_vat_rate: Number(e.target.value) || 0 }))}
            fullWidth
            sx={{ mb: 2 }}
          >
            {vatRates.map(v => (
              <MenuItem key={v.id} value={v.kulcs}>
                {v.name} ({v.kulcs}%)
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label="Sorrend"
            value={formData.sort_order}
            onChange={(e) => setFormData(prev => ({ ...prev, sort_order: Number(e.target.value) || 100 }))}
            fullWidth
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={<Checkbox checked={formData.is_active} onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))} />}
            label="Aktív"
          />
          <FormControlLabel
            control={<Checkbox checked={formData.allow_manual_edit} onChange={(e) => setFormData(prev => ({ ...prev, allow_manual_edit: e.target.checked }))} />}
            label="Rendelésben szerkeszthető"
          />
          <FormControlLabel
            control={<Checkbox checked={formData.allow_delete_from_order} onChange={(e) => setFormData(prev => ({ ...prev, allow_delete_from_order: e.target.checked }))} />}
            label="Rendelésből törölhető"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Mégse</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Díj törlése</DialogTitle>
        <DialogContent>
          <Typography>Biztosan törlöd ezt a díjat? (soft delete)</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Mégse</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

