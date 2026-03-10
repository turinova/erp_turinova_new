'use client'

import React, { useState } from 'react'
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
  Chip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationOnIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Address {
  id: string
  address_type: string
  country: string
  postal_code: string | null
  city: string
  street: string | null
  address_line_2: string | null
}

interface AddressesCardProps {
  supplierId: string
  initialAddresses: Address[]
  onUpdate: () => void
}

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  headquarters: 'Székhely',
  billing: 'Számlázási cím',
  shipping: 'Szállítási cím',
  other: 'Egyéb'
}

export default function AddressesCard({ supplierId, initialAddresses, onUpdate }: AddressesCardProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null)
  const [formData, setFormData] = useState({
    address_type: 'headquarters',
    country: 'Magyarország',
    postal_code: '',
    city: '',
    street: '',
    address_line_2: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (address?: Address) => {
    if (address) {
      setEditingAddress(address)
      setFormData({
        address_type: address.address_type,
        country: address.country,
        postal_code: address.postal_code || '',
        city: address.city,
        street: address.street || '',
        address_line_2: address.address_line_2 || ''
      })
    } else {
      setEditingAddress(null)
      setFormData({
        address_type: 'headquarters',
        country: 'Magyarország',
        postal_code: '',
        city: '',
        street: '',
        address_line_2: ''
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingAddress(null)
    setFormData({
      address_type: 'headquarters',
      country: 'Magyarország',
      postal_code: '',
      city: '',
      street: '',
      address_line_2: ''
    })
    setErrors({})
  }

  const handleOpenDeleteDialog = (address: Address) => {
    setDeletingAddress(address)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingAddress(null)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.address_type) {
      newErrors.address_type = 'A cím típusa kötelező'
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Az ország kötelező'
    }
    if (!formData.city.trim()) {
      newErrors.city = 'A város kötelező'
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
      const url = editingAddress
        ? `/api/suppliers/${supplierId}/addresses/${editingAddress.id}`
        : `/api/suppliers/${supplierId}/addresses`
      const method = editingAddress ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address_type: formData.address_type,
          country: formData.country.trim(),
          postal_code: formData.postal_code.trim() || null,
          city: formData.city.trim(),
          street: formData.street.trim() || null,
          address_line_2: formData.address_line_2.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedAddress = result.address

      if (editingAddress) {
        setAddresses(prev =>
          prev.map(addr => (addr.id === editingAddress.id ? updatedAddress : addr))
        )
        toast.success('Cím sikeresen frissítve')
      } else {
        setAddresses(prev => [...prev, updatedAddress])
        toast.success('Cím sikeresen hozzáadva')
      }

      handleCloseDialog()
      onUpdate()
    } catch (error) {
      console.error('Error saving address:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingAddress) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/addresses/${deletingAddress.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setAddresses(prev => prev.filter(addr => addr.id !== deletingAddress.id))
      toast.success('Cím sikeresen törölve')
      handleCloseDeleteDialog()
      onUpdate()
    } catch (error) {
      console.error('Error deleting address:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Paper 
        elevation={0}
        sx={{ 
          p: 3,
          bgcolor: 'white',
          border: '2px solid',
          borderColor: '#4caf50',
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
              bgcolor: '#4caf50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
            }}>
              <LocationOnIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
              Címek
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              borderColor: '#4caf50',
              color: '#2e7d32',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#388e3c',
                bgcolor: '#e8f5e9'
              }
            }}
          >
            Új cím
          </Button>
        </Box>

          {addresses.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              Még nincs cím hozzáadva
            </Typography>
          ) : (
            <TableContainer 
              component={Paper} 
              variant="outlined"
              sx={{
                borderColor: '#c8e6c9',
                '& .MuiTableRow-root:hover': {
                  bgcolor: '#f1f8f4'
                }
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f1f8f4' }}>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Típus</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Ország</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Város</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Cím</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, width: 100, fontSize: '0.875rem' }}>Műveletek</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {addresses.map((address) => (
                    <TableRow key={address.id} hover>
                      <TableCell sx={{ py: 1 }}>
                        <Chip
                          label={ADDRESS_TYPE_LABELS[address.address_type] || address.address_type}
                          size="small"
                          sx={{
                            borderColor: '#4caf50',
                            color: '#2e7d32',
                            fontWeight: 500
                          }}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>{address.country}</TableCell>
                      <TableCell sx={{ py: 1 }}>{address.city}</TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {[address.street, address.postal_code].filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(address)}
                          sx={{ mr: 0.5 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDeleteDialog(address)}
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAddress ? 'Cím szerkesztése' : 'Új cím hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth required error={!!errors.address_type}>
              <InputLabel>Cím típusa</InputLabel>
              <Select
                value={formData.address_type}
                label="Cím típusa"
                onChange={(e) => setFormData(prev => ({ ...prev, address_type: e.target.value }))}
              >
                <MenuItem value="headquarters">Székhely</MenuItem>
                <MenuItem value="billing">Számlázási cím</MenuItem>
                <MenuItem value="shipping">Szállítási cím</MenuItem>
                <MenuItem value="other">Egyéb</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Ország *"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              fullWidth
              required
              error={!!errors.country}
              helperText={errors.country}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2 }}>
              <TextField
                label="Irányítószám"
                value={formData.postal_code}
                onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                fullWidth
              />

              <TextField
                label="Város *"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                fullWidth
                required
                error={!!errors.city}
                helperText={errors.city}
              />
            </Box>

            <TextField
              label="Utca, házszám"
              value={formData.street}
              onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
              fullWidth
            />

            <TextField
              label="További címadatok"
              value={formData.address_line_2}
              onChange={(e) => setFormData(prev => ({ ...prev, address_line_2: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingAddress ? 'Frissítés' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné ezt a címet?
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
