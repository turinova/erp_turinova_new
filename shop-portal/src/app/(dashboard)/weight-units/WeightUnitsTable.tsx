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
  Chip,
  Checkbox
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Scale as ScaleIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface WeightUnit {
  id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
}

interface WeightUnitsTableProps {
  initialWeightUnits: WeightUnit[]
}

export default function WeightUnitsTable({ initialWeightUnits }: WeightUnitsTableProps) {
  const [weightUnits, setWeightUnits] = useState<WeightUnit[]>(initialWeightUnits)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingWeightUnit, setEditingWeightUnit] = useState<WeightUnit | null>(null)
  const [deletingWeightUnit, setDeletingWeightUnit] = useState<WeightUnit | null>(null)
  const [formData, setFormData] = useState({ name: '', shortform: '' })
  const [errors, setErrors] = useState<{ name?: string; shortform?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (weightUnit?: WeightUnit) => {
    if (weightUnit) {
      setEditingWeightUnit(weightUnit)
      setFormData({ name: weightUnit.name, shortform: weightUnit.shortform })
    } else {
      setEditingWeightUnit(null)
      setFormData({ name: '', shortform: '' })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingWeightUnit(null)
    setFormData({ name: '', shortform: '' })
    setErrors({})
  }

  const handleOpenDeleteDialog = (weightUnit: WeightUnit) => {
    setDeletingWeightUnit(weightUnit)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingWeightUnit(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(weightUnits.map(w => w.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (weightUnitId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(weightUnitId)) {
      newSelected.delete(weightUnitId)
    } else {
      newSelected.add(weightUnitId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (weightUnit: WeightUnit) => {
    // Open edit dialog when row is clicked
    handleOpenDialog(weightUnit)
  }

  const isAllSelected = weightUnits.length > 0 && selectedIds.size === weightUnits.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < weightUnits.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedWeightUnits = weightUnits.filter(w => selectedIds.has(w.id))
    if (selectedWeightUnits.length === 1) {
      setDeletingWeightUnit(selectedWeightUnits[0])
      setDeleteDialogOpen(true)
    } else {
      // For multiple, we'll delete the first one and show dialog
      setDeletingWeightUnit(selectedWeightUnits[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedWeightUnits = weightUnits.filter(w => selectedIds.has(w.id))
    if (selectedWeightUnits.length > 0) {
      handleOpenDialog(selectedWeightUnits[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; shortform?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A súlymérték neve kötelező'
    }

    if (!formData.shortform.trim()) {
      newErrors.shortform = 'A rövidítés kötelező'
    } else if (formData.shortform.trim().length > 10) {
      newErrors.shortform = 'A rövidítés maximum 10 karakter lehet'
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
      const url = editingWeightUnit
        ? `/api/weight-units/${editingWeightUnit.id}`
        : '/api/weight-units'
      const method = editingWeightUnit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          shortform: formData.shortform.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedWeightUnit = result.weightUnit

      if (editingWeightUnit) {
        setWeightUnits(prev =>
          prev.map(weightUnit => (weightUnit.id === editingWeightUnit.id ? updatedWeightUnit : weightUnit))
        )
        toast.success('Súlymérték sikeresen frissítve')
      } else {
        setWeightUnits(prev => [...prev, updatedWeightUnit].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Súlymérték sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving weight unit:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingWeightUnit) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/weight-units/${deletingWeightUnit.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setWeightUnits(prev => prev.filter(weightUnit => weightUnit.id !== deletingWeightUnit.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingWeightUnit.id)
        return newSet
      })
      toast.success('Súlymérték sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting weight unit:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Súlymértékek kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a súlymértékeket, amelyeket a termékek súlyának megadásához használhat.
          A súlymértékek határozzák meg, hogy a termékek súlyát milyen egységben jelenítjük meg (pl. "2 kg", "500 g").
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a súlymértékekről:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A <strong>név</strong> a teljes súlymérték neve (pl. "Kilogramm", "Gramm")</li>
            <li>A <strong>rövidítés</strong> a ShopRenter-be küldendő érték (pl. "kg", "g")</li>
            <li>A rövidítés kerül a ShopRenter <code>weightUnit</code> mezőbe</li>
            <li>Példa: Név: "Kilogramm", Rövidítés: "kg" → ShopRenter-ben "2 kg" jelenik meg</li>
            <li>A súlymértékeket a termékeknél választhatja ki a súlymérték mezőben</li>
            <li>Automatikusan létrejönnek, amikor termékeket szinkronizál ShopRenter-ből</li>
          </ul>
        </Typography>
      </Alert>

      {/* Action Buttons - Above Table */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'nowrap', alignItems: 'center' }}>
        {selectedIds.size > 0 && (
          <>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleBulkEdit}
              disabled={selectedIds.size === 0}
              sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
              Szerkesztés ({selectedIds.size})
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
              Törlés ({selectedIds.size})
            </Button>
          </>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', ml: 'auto' }}
        >
          Új súlymérték
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={weightUnits.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rövidítés</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Példa</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {weightUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ScaleIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs súlymérték létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első súlymértéket
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              weightUnits.map((weightUnit) => (
                <TableRow 
                  key={weightUnit.id} 
                  hover
                  selected={selectedIds.has(weightUnit.id)}
                  onClick={() => handleRowClick(weightUnit)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(weightUnit.id)}
                      onChange={(e) => handleSelectOne(weightUnit.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {weightUnit.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={weightUnit.shortform}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>2 {weightUnit.shortform}</strong> = 2 {weightUnit.name}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingWeightUnit ? 'Súlymérték szerkesztése' : 'Új súlymérték létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Súlymérték neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "Kilogramm", "Gramm", "Ton"'}
              placeholder="Kilogramm"
            />
            <TextField
              label="Rövidítés"
              value={formData.shortform}
              onChange={(e) => setFormData(prev => ({ ...prev, shortform: e.target.value }))}
              fullWidth
              required
              error={!!errors.shortform}
              helperText={
                errors.shortform ||
                'A ShopRenter-be küldendő rövidítés (pl. "kg", "g", "t"). Maximum 10 karakter.'
              }
              placeholder="kg"
              inputProps={{ maxLength: 10 }}
            />
            {formData.name && formData.shortform && !errors.name && !errors.shortform && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Példa megjelenítés:
                </Typography>
                <Typography variant="body2">
                  <strong>2 {formData.shortform}</strong> = 2 {formData.name}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
                  Ez az érték kerül a ShopRenter <code>weightUnit</code> mezőbe.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingWeightUnit ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingWeightUnit?.name}" ({deletingWeightUnit?.shortform})</strong> súlymértéket?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak termékek, amelyek ezt a súlymértéket használják, azok továbbra is
              működni fognak, de a súlymérték törlés után nem lesz elérhető új termékekhez.
            </Typography>
          </Alert>
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
    </Box>
  )
}
