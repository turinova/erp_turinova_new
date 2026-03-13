'use client'

import React, { useState, useEffect } from 'react'
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
  Grid
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
  firstname: string | null
  lastname: string | null
  company: string | null
  address1: string
  address2: string | null
  postcode: string
  city: string
  country_code: string
  zone_name: string | null
  telephone: string | null
  is_default_billing: boolean
  is_default_shipping: boolean
}

interface CustomerAddressesCardProps {
  customerId: string
  initialAddresses: Address[]
  onUpdate: () => void
  entityType?: 'person' | 'company' | 'customer' // 'customer' for backward compatibility
}

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  billing: 'Számlázási cím',
  shipping: 'Szállítási cím',
  registered: 'Székhely',
  mailing: 'Levelezési cím'
}

export default function CustomerAddressesCard({ customerId, initialAddresses, onUpdate, entityType = 'customer' }: CustomerAddressesCardProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Update addresses when initialAddresses prop changes (after refresh)
  useEffect(() => {
    setAddresses(initialAddresses)
  }, [initialAddresses])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null)
  const [formData, setFormData] = useState({
    address_type: 'billing',
    firstname: '',
    lastname: '',
    company: '',
    address1: '',
    address2: '',
    postcode: '',
    city: '',
    country_code: 'HU',
    zone_name: '',
    telephone: '',
    is_default_billing: false,
    is_default_shipping: false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (address?: Address) => {
    if (address) {
      setEditingAddress(address)
      setFormData({
        address_type: address.address_type,
        firstname: address.firstname || '',
        lastname: address.lastname || '',
        company: address.company || '',
        address1: address.address1,
        address2: address.address2 || '',
        postcode: address.postcode,
        city: address.city,
        country_code: address.country_code || 'HU',
        zone_name: address.zone_name || '',
        telephone: address.telephone || '',
        is_default_billing: address.is_default_billing,
        is_default_shipping: address.is_default_shipping
      })
    } else {
      setEditingAddress(null)
      setFormData({
        address_type: 'billing',
        firstname: '',
        lastname: '',
        company: '',
        address1: '',
        address2: '',
        postcode: '',
        city: '',
        country_code: 'HU',
        zone_name: '',
        telephone: '',
        is_default_billing: false,
        is_default_shipping: false
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingAddress(null)
    setFormData({
      address_type: 'billing',
      firstname: '',
      lastname: '',
      company: '',
      address1: '',
      address2: '',
      postcode: '',
      city: '',
      country_code: 'HU',
      zone_name: '',
      telephone: '',
      is_default_billing: false,
      is_default_shipping: false
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

    if (!formData.address1.trim()) {
      newErrors.address1 = 'A cím kötelező'
    }
    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Az irányítószám kötelező'
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
      // Determine base path based on entity type
      const basePath = entityType === 'person' 
        ? `/api/customers/persons/${customerId}`
        : entityType === 'company'
        ? `/api/customers/companies/${customerId}`
        : `/api/customers/${customerId}`
      
      const url = editingAddress
        ? `${basePath}/addresses/${editingAddress.id}`
        : `${basePath}/addresses`
      const method = editingAddress ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address_type: formData.address_type,
          firstname: formData.firstname.trim() || null,
          lastname: formData.lastname.trim() || null,
          company: formData.company.trim() || null,
          address1: formData.address1.trim(),
          address2: formData.address2.trim() || null,
          postcode: formData.postcode.trim(),
          city: formData.city.trim(),
          country_code: formData.country_code,
          zone_name: formData.zone_name.trim() || null,
          telephone: formData.telephone.trim() || null,
          is_default_billing: formData.is_default_billing,
          is_default_shipping: formData.is_default_shipping
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
      
      // Fetch updated addresses from API
      try {
        const basePath = entityType === 'person' 
          ? `/api/customers/persons/${customerId}`
          : entityType === 'company'
          ? `/api/customers/companies/${customerId}`
          : `/api/customers/${customerId}`
        const refreshResponse = await fetch(`${basePath}/addresses`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          setAddresses(refreshData.addresses || [])
        }
      } catch (refreshError) {
        console.error('Error refreshing addresses:', refreshError)
      }
      
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
      const basePath = entityType === 'person' 
        ? `/api/customers/persons/${customerId}`
        : entityType === 'company'
        ? `/api/customers/companies/${customerId}`
        : `/api/customers/${customerId}`
      const response = await fetch(`${basePath}/addresses/${deletingAddress.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      handleCloseDeleteDialog()
      
      // Fetch updated addresses from API
      try {
        const basePath = entityType === 'person' 
          ? `/api/customers/persons/${customerId}`
          : entityType === 'company'
          ? `/api/customers/companies/${customerId}`
          : `/api/customers/${customerId}`
        const refreshResponse = await fetch(`${basePath}/addresses`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          setAddresses(refreshData.addresses || [])
        }
      } catch (refreshError) {
        console.error('Error refreshing addresses:', refreshError)
      }
      
      toast.success('Cím sikeresen törölve')
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
                  <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Név / Cég</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Cím</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Város</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Alapértelmezett</TableCell>
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
                    <TableCell sx={{ py: 1 }}>
                      {address.company || (address.firstname && address.lastname 
                        ? `${address.lastname} ${address.firstname}` 
                        : '-')}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {address.address1}
                      {address.address2 && `, ${address.address2}`}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {address.postcode} {address.city}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {address.is_default_billing && (
                          <Chip label="Számlázási" size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                        )}
                        {address.is_default_shipping && (
                          <Chip label="Szállítási" size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                        )}
                      </Box>
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAddress ? 'Cím szerkesztése' : 'Új cím hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Cím típusa</InputLabel>
              <Select
                value={formData.address_type}
                label="Cím típusa"
                onChange={(e) => setFormData(prev => ({ ...prev, address_type: e.target.value }))}
              >
                <MenuItem value="billing">Számlázási cím</MenuItem>
                <MenuItem value="shipping">Szállítási cím</MenuItem>
                <MenuItem value="registered">Székhely</MenuItem>
                <MenuItem value="mailing">Levelezési cím</MenuItem>
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Keresztnév"
                  value={formData.firstname}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstname: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Vezetéknév"
                  value={formData.lastname}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastname: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Cég neve"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Cím *"
                  value={formData.address1}
                  onChange={(e) => setFormData(prev => ({ ...prev, address1: e.target.value }))}
                  fullWidth
                  required
                  error={!!errors.address1}
                  helperText={errors.address1}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="További címadatok"
                  value={formData.address2}
                  onChange={(e) => setFormData(prev => ({ ...prev, address2: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Irányítószám *"
                  value={formData.postcode}
                  onChange={(e) => setFormData(prev => ({ ...prev, postcode: e.target.value }))}
                  fullWidth
                  required
                  error={!!errors.postcode}
                  helperText={errors.postcode}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField
                  label="Város *"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  fullWidth
                  required
                  error={!!errors.city}
                  helperText={errors.city}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Ország kód"
                  value={formData.country_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, country_code: e.target.value }))}
                  fullWidth
                  helperText="ISO kód (pl. HU, DE, AT)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Megye / Régió"
                  value={formData.zone_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, zone_name: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Telefonszám"
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_default_billing}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_default_billing: e.target.checked }))}
                      />
                    }
                    label="Alapértelmezett számlázási cím"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_default_shipping}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_default_shipping: e.target.checked }))}
                      />
                    }
                    label="Alapértelmezett szállítási cím"
                  />
                </Box>
              </Grid>
            </Grid>
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
