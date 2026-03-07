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
  Switch,
  FormControlLabel
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface CustomerGroup {
  id: string
  name: string
  code: string
  description: string | null
  shoprenter_customer_group_id: string | null
  price_multiplier: number | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CustomerGroupsTableProps {
  initialCustomerGroups: CustomerGroup[]
}

export default function CustomerGroupsTable({ initialCustomerGroups }: CustomerGroupsTableProps) {
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>(initialCustomerGroups)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<CustomerGroup | null>(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    code: '', 
    description: '',
    price_multiplier: '',
    is_default: false,
    is_active: true
  })
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (group?: CustomerGroup) => {
    if (group) {
      setEditingGroup(group)
      setFormData({ 
        name: group.name, 
        code: group.code, 
        description: group.description || '',
        price_multiplier: group.price_multiplier?.toString() || '',
        is_default: group.is_default,
        is_active: group.is_active
      })
    } else {
      setEditingGroup(null)
      setFormData({ name: '', code: '', description: '', price_multiplier: '', is_default: false, is_active: true })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingGroup(null)
    setFormData({ name: '', code: '', description: '', price_multiplier: '', is_default: false, is_active: true })
    setErrors({})
  }

  const handleOpenDeleteDialog = (group: CustomerGroup) => {
    setDeletingGroup(group)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingGroup(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(customerGroups.map(g => g.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (groupId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId)
    } else {
      newSelected.add(groupId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (group: CustomerGroup) => {
    handleOpenDialog(group)
  }

  const isAllSelected = customerGroups.length > 0 && selectedIds.size === customerGroups.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < customerGroups.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedGroups = customerGroups.filter(g => selectedIds.has(g.id))
    if (selectedGroups.length === 1) {
      setDeletingGroup(selectedGroups[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingGroup(selectedGroups[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedGroups = customerGroups.filter(g => selectedIds.has(g.id))
    if (selectedGroups.length > 0) {
      handleOpenDialog(selectedGroups[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; code?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A vevőcsoport neve kötelező'
    }

    if (!formData.code.trim()) {
      newErrors.code = 'A kód kötelező'
    } else {
      const codeRegex = /^[A-Z0-9_]+$/
      if (!codeRegex.test(formData.code.trim().toUpperCase())) {
        newErrors.code = 'A kód csak nagybetűket, számokat és aláhúzást tartalmazhat'
      }
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
      const url = editingGroup
        ? `/api/customer-groups/${editingGroup.id}`
        : '/api/customer-groups'
      const method = editingGroup ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description.trim() || null,
          price_multiplier: formData.price_multiplier ? parseFloat(formData.price_multiplier) : null,
          is_default: formData.is_default,
          is_active: formData.is_active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedGroup = result.customerGroup

      if (editingGroup) {
        setCustomerGroups(prev =>
          prev.map(group => (group.id === editingGroup.id ? updatedGroup : group))
        )
        toast.success('Vevőcsoport sikeresen frissítve')
      } else {
        setCustomerGroups(prev => [...prev, updatedGroup].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Vevőcsoport sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving customer group:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingGroup) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/customer-groups/${deletingGroup.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setCustomerGroups(prev => prev.filter(group => group.id !== deletingGroup.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingGroup.id)
        return newSet
      })
      toast.success('Vevőcsoport sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting customer group:', error)
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
          Vevőcsoportok kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a vevőcsoportokat, amelyek segítségével különböző árazási szinteket állíthat be.
          A vevőcsoportok a ShopRenter vevőcsoportokhoz kapcsolódnak.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a vevőcsoportokról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A <strong>név</strong> a vevőcsoport megjelenített neve (pl. "Vevők", "Kereskedők")</li>
            <li>A <strong>kód</strong> egyedi azonosító (pl. "CUSTOMERS", "RETAILERS")</li>
            <li>A kód csak nagybetűket, számokat és aláhúzást tartalmazhat</li>
            <li>Az <strong>alapértelmezett</strong> vevőcsoport az, amelyik minden vásárlóhoz automatikusan hozzárendelődik</li>
            <li>A vevőcsoportokhoz külön árakat lehet beállítani a termékeknél</li>
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
          Új vevőcsoport
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
                  disabled={customerGroups.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Kód</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Árazási szorzó</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Alapértelmezett</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>ShopRenter ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customerGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PeopleIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs vevőcsoport létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első vevőcsoportot
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              customerGroups.map((group) => (
                <TableRow 
                  key={group.id} 
                  hover
                  selected={selectedIds.has(group.id)}
                  onClick={() => handleRowClick(group)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(group.id)}
                      onChange={(e) => handleSelectOne(group.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {group.name}
                    </Typography>
                    {group.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {group.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={group.code}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {group.price_multiplier ? (
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {group.price_multiplier.toFixed(4)}x
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Manuális
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {group.is_default ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Alapértelmezett"
                        size="small"
                        color="success"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={group.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      color={group.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {group.shoprenter_customer_group_id ? (
                      <Tooltip title={group.shoprenter_customer_group_id}>
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {group.shoprenter_customer_group_id.substring(0, 20)}...
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Nincs szinkronizálva
                      </Typography>
                    )}
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
          {editingGroup ? 'Vevőcsoport szerkesztése' : 'Új vevőcsoport létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Vevőcsoport neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "Vevők", "Kereskedők", "VIP"'}
              placeholder="Vevők"
            />
            <TextField
              label="Kód"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              fullWidth
              required
              error={!!errors.code}
              helperText={errors.code || 'Egyedi azonosító (pl. "CUSTOMERS", "RETAILERS"). Csak nagybetűk, számok és aláhúzás.'}
              placeholder="CUSTOMERS"
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
            <TextField
              label="Leírás"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={3}
              helperText="Opcionális leírás a vevőcsoportról"
            />
            <TextField
              label="Árazási szorzó"
              type="number"
              value={formData.price_multiplier}
              onChange={(e) => setFormData(prev => ({ ...prev, price_multiplier: e.target.value }))}
              fullWidth
              inputProps={{ step: '0.0001', min: '0' }}
              helperText="Automatikus ár számítás: Költség × Szorzó = Ár (pl. 1.1 = 10% felár). Üresen hagyva manuális árazás."
              placeholder="1.1000"
            />
            {formData.price_multiplier && !isNaN(parseFloat(formData.price_multiplier)) && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Példa:</strong> Ha a termék költsége 5,000 Ft és a szorzó {formData.price_multiplier}, 
                  akkor az automatikus ár: <strong>{parseFloat(formData.price_multiplier) * 5000} Ft</strong>
                </Typography>
              </Alert>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                />
              }
              label="Alapértelmezett vevőcsoport"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Aktív"
            />
            {formData.is_default && (
              <Alert severity="info">
                Az alapértelmezett vevőcsoport minden új vásárlóhoz automatikusan hozzárendelődik.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingGroup ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingGroup?.name}" ({deletingGroup?.code})</strong> vevőcsoportot?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak termékek, amelyekhez ezt a vevőcsoportot használják az árazásnál,
              azok továbbra is működni fognak, de a vevőcsoport törlés után nem lesz elérhető új termékekhez.
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
