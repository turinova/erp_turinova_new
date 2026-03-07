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
  Tooltip,
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

interface Unit {
  id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
}

interface UnitsTableProps {
  initialUnits: Unit[]
}

export default function UnitsTable({ initialUnits }: UnitsTableProps) {
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null)
  const [formData, setFormData] = useState({ name: '', shortform: '' })
  const [errors, setErrors] = useState<{ name?: string; shortform?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit)
      setFormData({ name: unit.name, shortform: unit.shortform })
    } else {
      setEditingUnit(null)
      setFormData({ name: '', shortform: '' })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingUnit(null)
    setFormData({ name: '', shortform: '' })
    setErrors({})
  }

  const handleOpenDeleteDialog = (unit: Unit) => {
    setDeletingUnit(unit)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingUnit(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(units.map(u => u.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (unitId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId)
    } else {
      newSelected.add(unitId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (unit: Unit) => {
    // Open edit dialog when row is clicked
    handleOpenDialog(unit)
  }

  const isAllSelected = units.length > 0 && selectedIds.size === units.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < units.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedUnits = units.filter(u => selectedIds.has(u.id))
    if (selectedUnits.length === 1) {
      setDeletingUnit(selectedUnits[0])
      setDeleteDialogOpen(true)
    } else {
      // For multiple, we'll delete the first one and show dialog
      setDeletingUnit(selectedUnits[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedUnits = units.filter(u => selectedIds.has(u.id))
    if (selectedUnits.length > 0) {
      handleOpenDialog(selectedUnits[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; shortform?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A mértékegység neve kötelező'
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
      const url = editingUnit
        ? `/api/units/${editingUnit.id}`
        : '/api/units'
      const method = editingUnit ? 'PUT' : 'POST'

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
      const updatedUnit = result.unit

      if (editingUnit) {
        setUnits(prev =>
          prev.map(unit => (unit.id === editingUnit.id ? updatedUnit : unit))
        )
        toast.success('Mértékegység sikeresen frissítve')
      } else {
        setUnits(prev => [...prev, updatedUnit].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Mértékegység sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving unit:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingUnit) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/units/${deletingUnit.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setUnits(prev => prev.filter(unit => unit.id !== deletingUnit.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingUnit.id)
        return newSet
      })
      toast.success('Mértékegység sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting unit:', error)
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
          Mértékegységek kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a mértékegységeket (mértékegységeket), amelyeket a termékeknél használhat.
          A mértékegységek határozzák meg, hogy a termékek mennyiségét milyen egységben jelenítjük meg (pl. "5 db", "2 kg").
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a mértékegységekről:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A <strong>név</strong> a teljes mértékegység neve (pl. "Darab", "Kilogramm")</li>
            <li>A <strong>rövidítés</strong> a ShopRenter-be küldendő érték (pl. "db", "kg")</li>
            <li>A rövidítés kerül a ShopRenter <code>measurementUnit</code> mezőbe</li>
            <li>Példa: Név: "Darab", Rövidítés: "db" → ShopRenter-ben "5 db" jelenik meg</li>
            <li>A mértékegységeket a termékeknél választhatja ki a mértékegység mezőben</li>
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
          Új mértékegység
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
                  disabled={units.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rövidítés</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Példa</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ScaleIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs mértékegység létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első mértékegységet
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit) => (
                <TableRow 
                  key={unit.id} 
                  hover
                  selected={selectedIds.has(unit.id)}
                  onClick={() => handleRowClick(unit)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(unit.id)}
                      onChange={(e) => handleSelectOne(unit.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {unit.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={unit.shortform}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>5 {unit.shortform}</strong> = 5 {unit.name}
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
          {editingUnit ? 'Mértékegység szerkesztése' : 'Új mértékegység létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Mértékegység neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "Darab", "Kilogramm", "Méter"'}
              placeholder="Darab"
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
                'A ShopRenter-be küldendő rövidítés (pl. "db", "kg", "m"). Maximum 10 karakter.'
              }
              placeholder="db"
              inputProps={{ maxLength: 10 }}
            />
            {formData.name && formData.shortform && !errors.name && !errors.shortform && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Példa megjelenítés:
                </Typography>
                <Typography variant="body2">
                  <strong>5 {formData.shortform}</strong> = 5 {formData.name}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
                  Ez az érték kerül a ShopRenter <code>measurementUnit</code> mezőbe.
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
            {saving ? 'Mentés...' : editingUnit ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingUnit?.name}" ({deletingUnit?.shortform})</strong> mértékegységet?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak termékek, amelyek ezt a mértékegységet használják, azok továbbra is
              működni fognak, de a mértékegység törlés után nem lesz elérhető új termékekhez.
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
