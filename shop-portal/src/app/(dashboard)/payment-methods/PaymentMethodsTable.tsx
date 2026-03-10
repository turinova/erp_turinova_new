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
  FormControlLabel
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Payment as PaymentIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface PaymentMethod {
  id: string
  name: string
  comment: string | null
  active: boolean
  created_at: string
  updated_at: string
}

interface PaymentMethodsTableProps {
  initialPaymentMethods: PaymentMethod[]
}

export default function PaymentMethodsTable({ initialPaymentMethods }: PaymentMethodsTableProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null)
  const [formData, setFormData] = useState({ name: '', comment: '', active: true })
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method)
      setFormData({
        name: method.name,
        comment: method.comment || '',
        active: method.active
      })
    } else {
      setEditingMethod(null)
      setFormData({ name: '', comment: '', active: true })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingMethod(null)
    setFormData({ name: '', comment: '', active: true })
    setErrors({})
  }

  const handleOpenDeleteDialog = (method: PaymentMethod) => {
    setDeletingMethod(method)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingMethod(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(paymentMethods.map(m => m.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (methodId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(methodId)) {
      newSelected.delete(methodId)
    } else {
      newSelected.add(methodId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (method: PaymentMethod) => {
    handleOpenDialog(method)
  }

  const isAllSelected = paymentMethods.length > 0 && selectedIds.size === paymentMethods.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < paymentMethods.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedMethods = paymentMethods.filter(m => selectedIds.has(m.id))
    if (selectedMethods.length === 1) {
      setDeletingMethod(selectedMethods[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingMethod(selectedMethods[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedMethods = paymentMethods.filter(m => selectedIds.has(m.id))
    if (selectedMethods.length > 0) {
      handleOpenDialog(selectedMethods[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A fizetési mód neve kötelező'
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
      const url = editingMethod
        ? `/api/payment-methods/${editingMethod.id}`
        : '/api/payment-methods'
      const method = editingMethod ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          comment: formData.comment.trim() || null,
          active: formData.active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedMethod = result.payment_method

      if (editingMethod) {
        setPaymentMethods(prev =>
          prev.map(method => (method.id === editingMethod.id ? updatedMethod : method))
        )
        toast.success('Fizetési mód sikeresen frissítve')
      } else {
        setPaymentMethods(prev => [...prev, updatedMethod].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Fizetési mód sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving payment method:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingMethod) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/payment-methods/${deletingMethod.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setPaymentMethods(prev => prev.filter(method => method.id !== deletingMethod.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingMethod.id)
        return newSet
      })
      toast.success('Fizetési mód sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting payment method:', error)
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
          Fizetési módok kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a fizetési módokat, amelyeket a beszállítóknál használhat. A fizetési módok globálisan elérhetők minden beszállítónál.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a fizetési módokról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A fizetési módok <strong>globálisan</strong> elérhetők - egyszer hozza létre, minden beszállítónál használhatja</li>
            <li>A fizetési módokat a beszállítók fizetési beállításainál választhatja ki</li>
            <li>Inaktív módok nem jelennek meg a dropdown listában</li>
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
          Új fizetési mód
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
                  disabled={paymentMethods.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Leírás</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paymentMethods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PaymentIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs fizetési mód létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első fizetési módot
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paymentMethods.map((method) => (
                <TableRow 
                  key={method.id} 
                  hover
                  selected={selectedIds.has(method.id)}
                  onClick={() => handleRowClick(method)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(method.id)}
                      onChange={(e) => handleSelectOne(method.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {method.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {method.comment || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={method.active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        ...(method.active 
                          ? { bgcolor: '#4caf50', color: 'white' }
                          : { bgcolor: '#f44336', color: 'white' }
                        )
                      }}
                    />
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
          {editingMethod ? 'Fizetési mód szerkesztése' : 'Új fizetési mód létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Fizetési mód neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "Készpénz", "Átutalás", "Utánvét"'}
              placeholder="Készpénz"
            />
            <TextField
              label="Leírás"
              value={formData.comment}
              onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
              fullWidth
              multiline
              rows={3}
              helperText="Opcionális leírás a fizetési módról"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                />
              }
              label="Aktív"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingMethod ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingMethod?.name}"</strong> fizetési módot?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak beszállítók, amelyek ezt a fizetési módot használják, azok továbbra is
              működni fognak, de a fizetési mód törlés után nem lesz elérhető új beszállítókhoz.
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
