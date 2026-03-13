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
  Alert,
  Checkbox,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  CloudSync as CloudSyncIcon,
  Create as CreateIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter, useSearchParams } from 'next/navigation'

interface Person {
  id: string
  name: string
  firstname: string
  lastname: string
  email: string | null
  telephone: string | null
  identifier: string | null
  source: 'local' | 'webshop_sync'
  is_active: boolean
  tax_number: string | null
  created_at: string
  updated_at: string
  customer_groups: {
    id: string
    name: string
  } | null
}

interface PersonsTableProps {
  initialPersons: Person[]
}

export default function PersonsTable({ initialPersons }: PersonsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qFromUrl = searchParams.get('q') ?? ''
  const [persons, setPersons] = useState<Person[]>(initialPersons)
  const [filteredPersons, setFilteredPersons] = useState<Person[]>(initialPersons)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState(qFromUrl)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'webshop_sync'>('all')

  // Filter persons based on search and filters
  React.useEffect(() => {
    let filtered = persons

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.identifier?.toLowerCase().includes(query) ||
        p.firstname?.toLowerCase().includes(query) ||
        p.lastname?.toLowerCase().includes(query) ||
        p.tax_number?.toLowerCase().includes(query)
      )
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(p => p.source === sourceFilter)
    }

    setFilteredPersons(filtered)
  }, [persons, searchQuery, sourceFilter])

  const handleOpenDeleteDialog = (person: Person) => {
    setDeletingPerson(person)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingPerson(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(filteredPersons.map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (personId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(personId)) {
      newSelected.delete(personId)
    } else {
      newSelected.add(personId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (person: Person) => {
    router.push(`/customers/persons/${person.id}`)
  }

  const isAllSelected = filteredPersons.length > 0 && selectedIds.size === filteredPersons.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredPersons.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedPersons = filteredPersons.filter(p => selectedIds.has(p.id))
    if (selectedPersons.length === 1) {
      setDeletingPerson(selectedPersons[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingPerson(selectedPersons[0])
      setDeleteDialogOpen(true)
    }
  }

  const handleDelete = async () => {
    if (!deletingPerson) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/customers/persons/${deletingPerson.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setPersons(prev => prev.filter(person => person.id !== deletingPerson.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingPerson.id)
        return newSet
      })
      toast.success('Személy sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting person:', error)
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
          Személyek kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a személyeket. Minden személyhez megadhat címeket, bankszámlákat, és kapcsolhatja őket vevőcsoportokhoz vagy cégekhez.
        </Typography>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Keresés név, e-mail, azonosító szerint..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button
          variant={sourceFilter === 'local' ? 'contained' : 'outlined'}
          onClick={() => setSourceFilter(sourceFilter === 'local' ? 'all' : 'local')}
          startIcon={<CreateIcon />}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Helyi
        </Button>
        <Button
          variant={sourceFilter === 'webshop_sync' ? 'contained' : 'outlined'}
          onClick={() => setSourceFilter(sourceFilter === 'webshop_sync' ? 'all' : 'webshop_sync')}
          startIcon={<CloudSyncIcon />}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Webshop
        </Button>
      </Box>

      {/* Action Buttons - Above Table */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'nowrap', alignItems: 'center' }}>
        {selectedIds.size > 0 && (
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
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/customers/persons/new')}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', ml: 'auto' }}
        >
          Új személy
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
                  disabled={filteredPersons.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>E-mail</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Telefon</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Forrás</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPersons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PersonIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchQuery || sourceFilter !== 'all'
                        ? 'Nincs találat a szűrési feltételeknek megfelelően'
                        : 'Még nincs személy létrehozva'}
                    </Typography>
                    {!searchQuery && sourceFilter === 'all' && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/customers/persons/new')}
                      >
                        Hozzon létre első személyt
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredPersons.map((person) => (
                <TableRow 
                  key={person.id} 
                  hover
                  selected={selectedIds.has(person.id)}
                  onClick={() => handleRowClick(person)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(person.id)}
                      onChange={(e) => handleSelectOne(person.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {person.name}
                    </Typography>
                    {person.identifier && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        ID: {person.identifier}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {person.email || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {person.telephone || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      icon={person.source === 'local' ? <CreateIcon /> : <CloudSyncIcon />}
                      label={person.source === 'local' ? 'Helyi' : 'Webshop'}
                      size="small"
                      sx={{
                        bgcolor: person.source === 'local' ? '#4caf50' : '#9c27b0',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {person.customer_groups?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={person.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        ...(person.is_active 
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingPerson?.name}"</strong> személyt?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! A személy törlése után az összes kapcsolódó adat (címek, bankszámlák, cég kapcsolatok) is törlődik.
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
