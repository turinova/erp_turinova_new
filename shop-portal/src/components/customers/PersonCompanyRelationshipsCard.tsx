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
  Autocomplete,
  Link as MuiLink
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Link as LinkIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface Relationship {
  id: string
  company_id: string
  role: string
  is_primary: boolean
  notes: string | null
  companies: {
    id: string
    name: string
    email: string | null
    telephone: string | null
    tax_number: string | null
  } | null
}

interface PersonCompanyRelationshipsCardProps {
  personId: string
  initialRelationships: Relationship[]
  onUpdate: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Tulajdonos',
  contact_person: 'Kapcsolattartó',
  manager: 'Menedzser',
  accountant: 'Könyvelő',
  other: 'Egyéb'
}

export default function PersonCompanyRelationshipsCard({ 
  personId, 
  initialRelationships, 
  onUpdate 
}: PersonCompanyRelationshipsCardProps) {
  const router = useRouter()
  const [relationships, setRelationships] = useState<Relationship[]>(initialRelationships)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null)
  const [deletingRelationship, setDeletingRelationship] = useState<Relationship | null>(null)
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [formData, setFormData] = useState({
    company_id: '',
    role: 'contact_person',
    is_primary: false,
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load companies for dropdown
  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true)
      try {
        const response = await fetch('/api/customers/companies')
        if (response.ok) {
          const data = await response.json()
          setCompanies(data.companies || [])
        }
      } catch (error) {
        console.error('Error loading companies:', error)
      } finally {
        setLoadingCompanies(false)
      }
    }
    loadCompanies()
  }, [])

  // Update relationships when initialRelationships prop changes
  useEffect(() => {
    setRelationships(initialRelationships)
  }, [initialRelationships])

  const handleOpenDialog = (relationship?: Relationship) => {
    if (relationship) {
      setEditingRelationship(relationship)
      setFormData({
        company_id: relationship.company_id,
        role: relationship.role || 'contact_person',
        is_primary: relationship.is_primary || false,
        notes: relationship.notes || ''
      })
    } else {
      setEditingRelationship(null)
      setFormData({
        company_id: '',
        role: 'contact_person',
        is_primary: false,
        notes: ''
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingRelationship(null)
    setFormData({
      company_id: '',
      role: 'contact_person',
      is_primary: false,
      notes: ''
    })
    setErrors({})
  }

  const handleOpenDeleteDialog = (relationship: Relationship) => {
    setDeletingRelationship(relationship)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingRelationship(null)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.company_id) {
      newErrors.company_id = 'A cég kiválasztása kötelező'
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
      const url = editingRelationship
        ? `/api/customers/relationships/${editingRelationship.id}`
        : `/api/customers/persons/${personId}/relationships`
      const method = editingRelationship ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_id: formData.company_id,
          role: formData.role,
          is_primary: formData.is_primary,
          notes: formData.notes.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedRelationship = result.relationship

      if (editingRelationship) {
        setRelationships(prev =>
          prev.map(rel => (rel.id === editingRelationship.id ? updatedRelationship : rel))
        )
        toast.success('Kapcsolat sikeresen frissítve')
      } else {
        // Fetch updated relationships
        const refreshResponse = await fetch(`/api/customers/persons/${personId}/relationships`)
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          setRelationships(refreshData.relationships || [])
        }
        toast.success('Kapcsolat sikeresen létrehozva')
      }

      handleCloseDialog()
      onUpdate()
    } catch (error) {
      console.error('Error saving relationship:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRelationship) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/customers/relationships/${deletingRelationship.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      handleCloseDeleteDialog()

      // Fetch updated relationships
      const refreshResponse = await fetch(`/api/customers/persons/${personId}/relationships`)
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setRelationships(refreshData.relationships || [])
      }

      toast.success('Kapcsolat sikeresen törölve')
      onUpdate()
    } catch (error) {
      console.error('Error deleting relationship:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  // Filter out already linked companies
  const availableCompanies = companies.filter(
    company => !relationships.some(rel => rel.company_id === company.id)
  )

  return (
    <>
      <Paper 
        elevation={0}
        sx={{ 
          p: 3,
          bgcolor: 'white',
          border: '2px solid',
          borderColor: '#ff9800',
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
              bgcolor: '#ff9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
            }}>
              <BusinessIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#f57c00' }}>
              Cég kapcsolatok
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={availableCompanies.length === 0}
            sx={{
              borderColor: '#ff9800',
              color: '#f57c00',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#f57c00',
                bgcolor: '#fff3e0'
              }
            }}
          >
            Új kapcsolat
          </Button>
        </Box>

        {relationships.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <BusinessIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Még nincs cég kapcsolat
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              disabled={availableCompanies.length === 0}
            >
              Kapcsolat hozzáadása
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Cég neve</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Szerepkör</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Adószám</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Elsődleges</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Műveletek</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {relationships.map((relationship) => (
                  <TableRow key={relationship.id} hover>
                    <TableCell sx={{ py: 1 }}>
                      <MuiLink
                        component="button"
                        variant="body2"
                        onClick={() => router.push(`/customers/companies/${relationship.company_id}`)}
                        sx={{ 
                          textDecoration: 'none',
                          color: 'primary.main',
                          fontWeight: 500,
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        {relationship.companies?.name || '-'}
                      </MuiLink>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Chip
                        label={ROLE_LABELS[relationship.role] || relationship.role}
                        size="small"
                        sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {relationship.companies?.tax_number || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {relationship.is_primary && (
                        <Chip
                          label="Elsődleges"
                          size="small"
                          sx={{ bgcolor: '#4caf50', color: 'white' }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(relationship)}
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(relationship)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRelationship ? 'Kapcsolat szerkesztése' : 'Új cég kapcsolat'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Autocomplete
              options={editingRelationship ? companies : availableCompanies}
              getOptionLabel={(option) => option.name}
              value={companies.find(c => c.id === formData.company_id) || null}
              onChange={(_, newValue) => {
                setFormData(prev => ({ ...prev, company_id: newValue?.id || '' }))
              }}
              disabled={editingRelationship !== null}
              loading={loadingCompanies}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cég *"
                  error={!!errors.company_id}
                  helperText={errors.company_id}
                  required
                />
              )}
            />
            <FormControl fullWidth>
              <InputLabel>Szerepkör</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                label="Szerepkör"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_primary}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                />
              }
              label="Elsődleges kapcsolat"
            />
            <TextField
              label="Megjegyzések"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a kapcsolatot a <strong>"{deletingRelationship?.companies?.name}"</strong> céggel?
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
