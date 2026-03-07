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
  Checkbox
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Business as BusinessIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Manufacturer {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

interface ManufacturersTableProps {
  initialManufacturers: Manufacturer[]
}

export default function ManufacturersTable({ initialManufacturers }: ManufacturersTableProps) {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>(initialManufacturers)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [deletingManufacturer, setDeletingManufacturer] = useState<Manufacturer | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (manufacturer?: Manufacturer) => {
    if (manufacturer) {
      setEditingManufacturer(manufacturer)
      setFormData({
        name: manufacturer.name,
        description: manufacturer.description || ''
      })
    } else {
      setEditingManufacturer(null)
      setFormData({ name: '', description: '' })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingManufacturer(null)
    setFormData({ name: '', description: '', website: '', logo_url: '' })
    setErrors({})
  }

  const handleOpenDeleteDialog = (manufacturer: Manufacturer) => {
    setDeletingManufacturer(manufacturer)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingManufacturer(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(manufacturers.map(m => m.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (manufacturerId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(manufacturerId)) {
      newSelected.delete(manufacturerId)
    } else {
      newSelected.add(manufacturerId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (manufacturer: Manufacturer) => {
    // Open edit dialog when row is clicked
    handleOpenDialog(manufacturer)
  }

  const isAllSelected = manufacturers.length > 0 && selectedIds.size === manufacturers.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < manufacturers.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedManufacturers = manufacturers.filter(m => selectedIds.has(m.id))
    if (selectedManufacturers.length === 1) {
      setDeletingManufacturer(selectedManufacturers[0])
      setDeleteDialogOpen(true)
    } else {
      // For multiple, we'll delete the first one and show dialog
      setDeletingManufacturer(selectedManufacturers[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedManufacturers = manufacturers.filter(m => selectedIds.has(m.id))
    if (selectedManufacturers.length > 0) {
      handleOpenDialog(selectedManufacturers[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A gyártó neve kötelező'
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
      const url = editingManufacturer
        ? `/api/manufacturers/${editingManufacturer.id}`
        : '/api/manufacturers'
      const method = editingManufacturer ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedManufacturer = result.manufacturer

      if (editingManufacturer) {
        setManufacturers(prev =>
          prev.map(manufacturer => (manufacturer.id === editingManufacturer.id ? updatedManufacturer : manufacturer))
        )
        toast.success('Gyártó sikeresen frissítve')
      } else {
        setManufacturers(prev => [...prev, updatedManufacturer].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Gyártó sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving manufacturer:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingManufacturer) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/manufacturers/${deletingManufacturer.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setManufacturers(prev => prev.filter(manufacturer => manufacturer.id !== deletingManufacturer.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingManufacturer.id)
        return newSet
      })
      toast.success('Gyártó sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting manufacturer:', error)
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
          Gyártók kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a gyártókat/márkákat, amelyeket a termékeknél használhat. A gyártók globálisan elérhetők minden platformon.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a gyártókról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A gyártók <strong>globálisan</strong> elérhetők - egyszer hozza létre, minden platformon használhatja</li>
            <li>Automatikusan létrejönnek, amikor termékeket szinkronizál ShopRenter-ből</li>
            <li>A gyártókat a termékeknél választhatja ki a gyártó mezőben</li>
            <li>Opcionálisan megadhat leírást is</li>
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
          Új gyártó
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
                  disabled={manufacturers.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Leírás</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {manufacturers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <BusinessIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs gyártó létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első gyártót
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              manufacturers.map((manufacturer) => (
                <TableRow 
                  key={manufacturer.id} 
                  hover
                  selected={selectedIds.has(manufacturer.id)}
                  onClick={() => handleRowClick(manufacturer)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(manufacturer.id)}
                      onChange={(e) => handleSelectOne(manufacturer.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {manufacturer.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {manufacturer.description || '-'}
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
          {editingManufacturer ? 'Gyártó szerkesztése' : 'Új gyártó létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Gyártó neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "Samsung", "Apple", "Nike"'}
              placeholder="Samsung"
            />
            <TextField
              label="Leírás"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={3}
              helperText="Opcionális leírás a gyártóról"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingManufacturer ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingManufacturer?.name}"</strong> gyártót?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak termékek, amelyek ezt a gyártót használják, azok továbbra is
              működni fognak, de a gyártó törlés után nem lesz elérhető új termékekhez.
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
