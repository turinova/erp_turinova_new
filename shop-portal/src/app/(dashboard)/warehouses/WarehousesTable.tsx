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
  Checkbox,
  FormControlLabel
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Warehouse as WarehouseIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Warehouse {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface WarehousesTableProps {
  initialWarehouses: Warehouse[]
}

export default function WarehousesTable({ initialWarehouses }: WarehousesTableProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', is_active: true })
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWarehouse(warehouse)
      setFormData({ name: warehouse.name, code: warehouse.code, is_active: warehouse.is_active })
    } else {
      setEditingWarehouse(null)
      setFormData({ name: '', code: '', is_active: true })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingWarehouse(null)
    setFormData({ name: '', code: '', is_active: true })
    setErrors({})
  }

  const handleOpenDeleteDialog = (warehouse: Warehouse) => {
    setDeletingWarehouse(warehouse)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingWarehouse(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(warehouses.map(w => w.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (warehouseId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(warehouseId)) {
      newSelected.delete(warehouseId)
    } else {
      newSelected.add(warehouseId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (warehouse: Warehouse) => {
    handleOpenDialog(warehouse)
  }

  const isAllSelected = warehouses.length > 0 && selectedIds.size === warehouses.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < warehouses.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedWarehouses = warehouses.filter(w => selectedIds.has(w.id))
    if (selectedWarehouses.length === 1) {
      setDeletingWarehouse(selectedWarehouses[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingWarehouse(selectedWarehouses[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedWarehouses = warehouses.filter(w => selectedIds.has(w.id))
    if (selectedWarehouses.length > 0) {
      handleOpenDialog(selectedWarehouses[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; code?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A raktár neve kötelező'
    }

    if (!formData.code.trim()) {
      newErrors.code = 'A raktár kódja kötelező'
    } else if (formData.code.trim().length > 20) {
      newErrors.code = 'A kód maximum 20 karakter lehet'
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
      const url = editingWarehouse
        ? `/api/warehouses/${editingWarehouse.id}`
        : '/api/warehouses'
      const method = editingWarehouse ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          is_active: formData.is_active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedWarehouse = result.warehouse

      if (editingWarehouse) {
        setWarehouses(prev =>
          prev.map(warehouse => (warehouse.id === editingWarehouse.id ? updatedWarehouse : warehouse))
        )
        toast.success('Raktár sikeresen frissítve')
      } else {
        setWarehouses(prev => [...prev, updatedWarehouse].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Raktár sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving warehouse:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingWarehouse) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/warehouses/${deletingWarehouse.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setWarehouses(prev => prev.filter(warehouse => warehouse.id !== deletingWarehouse.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingWarehouse.id)
        return newSet
      })
      toast.success('Raktár sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting warehouse:', error)
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
          Raktárak kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a raktárakat, amelyeket a beszerzési rendeléseknél és készletkezelésnél használhat.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a raktárakról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A <strong>név</strong> a raktár teljes neve (pl. "Főraktár", "Külső raktár")</li>
            <li>A <strong>kód</strong> egy rövid azonosító (pl. "FŐ", "KÜLSŐ")</li>
            <li>A kód egyedi kell legyen az aktív raktárak között</li>
            <li>Inaktív raktárak nem jelennek meg a beszerzési rendeléseknél</li>
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
          Új raktár
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
                  disabled={warehouses.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Kód</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <WarehouseIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs raktár létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első raktárt
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((warehouse) => (
                <TableRow 
                  key={warehouse.id} 
                  hover
                  selected={selectedIds.has(warehouse.id)}
                  onClick={() => handleRowClick(warehouse)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(warehouse.id)}
                      onChange={(e) => handleSelectOne(warehouse.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {warehouse.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {warehouse.code}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={warehouse.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        bgcolor: warehouse.is_active ? '#4caf50' : '#f44336',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingWarehouse ? 'Raktár szerkesztése' : 'Új raktár'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              label="Raktár neve *"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              error={!!errors.name}
              helperText={errors.name}
            />
            <TextField
              fullWidth
              label="Raktár kódja *"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              error={!!errors.code}
              helperText={errors.code || 'Rövid azonosító (pl. "FŐ", "KÜLSŐ")'}
              inputProps={{ maxLength: 20 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Aktív"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Mégse</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Raktár törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a "{deletingWarehouse?.name}" raktárt?
          </Typography>
          {deletingWarehouse && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              A raktár inaktívvá válik, de nem törlődik véglegesen. Ha a raktár használatban van beszerzési rendelésekben vagy szállítmányokban, a törlés nem lehetséges.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Mégse</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
