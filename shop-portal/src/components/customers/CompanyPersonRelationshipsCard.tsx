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
  Person as PersonIcon,
  Link as LinkIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface Relationship {
  id: string
  person_id: string
  role: string
  is_primary: boolean
  notes: string | null
  persons: {
    id: string
    firstname: string
    lastname: string
    email: string | null
    telephone: string | null
  } | null
  person?: {
    id: string
    name: string
    firstname: string
    lastname: string
    email: string | null
    telephone: string | null
  } | null
}

interface CompanyPersonRelationshipsCardProps {
  companyId: string
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

export default function CompanyPersonRelationshipsCard({ 
  companyId, 
  initialRelationships, 
  onUpdate 
}: CompanyPersonRelationshipsCardProps) {
  const router = useRouter()
  const [relationships, setRelationships] = useState<Relationship[]>(initialRelationships)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null)
  const [deletingRelationship, setDeletingRelationship] = useState<Relationship | null>(null)
  const [persons, setPersons] = useState<Array<{ id: string; name: string; firstname: string; lastname: string }>>([])
  const [loadingPersons, setLoadingPersons] = useState(false)
  const [formData, setFormData] = useState({
    person_id: '',
    role: 'contact_person',
    is_primary: false,
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load persons for dropdown
  useEffect(() => {
    const loadPersons = async () => {
      setLoadingPersons(true)
      try {
        const response = await fetch('/api/customers/persons')
        if (response.ok) {
          const data = await response.json()
          const formattedPersons = (data.persons || []).map((p: any) => ({
            id: p.id,
            name: p.name || `${p.lastname} ${p.firstname}`.trim(),
            firstname: p.firstname,
            lastname: p.lastname
          }))
          setPersons(formattedPersons)
        }
      } catch (error) {
        console.error('Error loading persons:', error)
      } finally {
        setLoadingPersons(false)
      }
    }
    loadPersons()
  }, [])

  // Update relationships when initialRelationships prop changes
  useEffect(() => {
    setRelationships(initialRelationships.map(rel => ({
      ...rel,
      person: rel.persons ? {
        ...rel.persons,
        name: `${rel.persons.lastname} ${rel.persons.firstname}`.trim()
      } : null
    })))
  }, [initialRelationships])

  const handleOpenDialog = (relationship?: Relationship) => {
    if (relationship) {
      setEditingRelationship(relationship)
      setFormData({
        person_id: relationship.person_id,
        role: relationship.role || 'contact_person',
        is_primary: relationship.is_primary || false,
        notes: relationship.notes || ''
      })
    } else {
      setEditingRelationship(null)
      setFormData({
        person_id: '',
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
      person_id: '',
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

    if (!formData.person_id) {
      newErrors.person_id = 'A személy kiválasztása kötelező'
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
        : `/api/customers/companies/${companyId}/relationships`
      const method = editingRelationship ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          person_id: formData.person_id,
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
        const refreshResponse = await fetch(`/api/customers/companies/${companyId}/relationships`)
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
      const refreshResponse = await fetch(`/api/customers/companies/${companyId}/relationships`)
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

  // Filter out already linked persons
  const availablePersons = persons.filter(
    person => !relationships.some(rel => rel.person_id === person.id)
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
              <PersonIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#f57c00' }}>
              Kapcsolattartók
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={availablePersons.length === 0}
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
            <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Még nincs kapcsolattartó
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              disabled={availablePersons.length === 0}
            >
              Kapcsolat hozzáadása
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>E-mail</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Telefon</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Szerepkör</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Elsődleges</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Műveletek</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {relationships.map((relationship) => {
                  const person = relationship.person || relationship.persons
                  const personName = person 
                    ? `${person.lastname} ${person.firstname}`.trim()
                    : '-'
                  return (
                    <TableRow key={relationship.id} hover>
                      <TableCell sx={{ py: 1 }}>
                        <MuiLink
                          component="button"
                          variant="body2"
                          onClick={() => router.push(`/customers/persons/${relationship.person_id}`)}
                          sx={{ 
                            textDecoration: 'none',
                            color: 'primary.main',
                            fontWeight: 500,
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {personName}
                        </MuiLink>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {person?.email || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {person?.telephone || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Chip
                          label={ROLE_LABELS[relationship.role] || relationship.role}
                          size="small"
                          sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
                        />
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
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRelationship ? 'Kapcsolat szerkesztése' : 'Új kapcsolattartó'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Autocomplete
              options={editingRelationship ? persons : availablePersons}
              getOptionLabel={(option) => option.name}
              value={persons.find(p => p.id === formData.person_id) || null}
              onChange={(_, newValue) => {
                setFormData(prev => ({ ...prev, person_id: newValue?.id || '' }))
              }}
              disabled={editingRelationship !== null}
              loading={loadingPersons}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Személy *"
                  error={!!errors.person_id}
                  helperText={errors.person_id}
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
              label="Elsődleges kapcsolattartó"
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
            Biztosan törölni szeretné a kapcsolatot <strong>"{deletingRelationship?.person?.name || (deletingRelationship?.persons ? `${deletingRelationship.persons.lastname} ${deletingRelationship.persons.firstname}`.trim() : '')}"</strong> személlyel?
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
