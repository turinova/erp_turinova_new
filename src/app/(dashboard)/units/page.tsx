'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface Unit {
  id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
}

export default function UnitsPage() {
  const router = useRouter()
  
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch units from API
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/units/optimized')
        if (response.ok) {
          const data = await response.json()
          setUnits(data)
        } else {
          console.error('Failed to fetch units')
          // Fallback to sample data
          setUnits([
            {
              id: '1',
              name: 'Darab',
              shortform: 'db',
              created_at: '2025-09-13T06:00:00Z',
              updated_at: '2025-09-13T06:00:00Z'
            },
            {
              id: '2',
              name: 'Kilogramm',
              shortform: 'kg',
              created_at: '2025-09-13T06:00:00Z',
              updated_at: '2025-09-13T06:00:00Z'
            }
          ])
        }
      } catch (error) {
        console.error('Failed to fetch units:', error)
        // Fallback to sample data
        setUnits([
          {
            id: '1',
            name: 'Darab',
            shortform: 'db',
            created_at: '2025-09-13T06:00:00Z',
            updated_at: '2025-09-13T06:00:00Z'
          },
          {
            id: '2',
            name: 'Kilogramm',
            shortform: 'kg',
            created_at: '2025-09-13T06:00:00Z',
            updated_at: '2025-09-13T06:00:00Z'
          }
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchUnits()
  }, [])

  // Filter units based on search term
  const filteredUnits = useMemo(() => {
    if (!searchTerm) return units
    
    const term = searchTerm.toLowerCase()
    return units.filter(unit => 
      unit.name.toLowerCase().includes(term) ||
      unit.shortform.toLowerCase().includes(term)
    )
  }, [units, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedUnits(filteredUnits.map(unit => unit.id))
    } else {
      setSelectedUnits([])
    }
  }

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    )
  }

  const isAllSelected = selectedUnits.length === filteredUnits.length && filteredUnits.length > 0
  const isIndeterminate = selectedUnits.length > 0 && selectedUnits.length < filteredUnits.length

  const handleRowClick = (unitId: string) => {
    router.push(`/units/${unitId}`)
  }

  const handleAddNewUnit = () => {
    router.push('/units/new')
  }

  const handleDeleteClick = () => {
    if (selectedUnits.length === 0) {
      toast.warning('Válasszon ki legalább egy egységet a törléshez!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      return
    }
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedUnits.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete units one by one
      const deletePromises = selectedUnits.map(unitId => 
        fetch(`/api/units/${unitId}`, {
          method: 'DELETE',
        })
      )
      
      const results = await Promise.allSettled(deletePromises)
      
      // Check if all deletions were successful
      const failedDeletions = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok)
      )
      
      if (failedDeletions.length === 0) {
        // All deletions successful
        toast.success(`${selectedUnits.length} egység sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Remove deleted units from local state
        setUnits(prev => prev.filter(unit => !selectedUnits.includes(unit.id)))
        setSelectedUnits([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} egység törlése sikertelen!`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Hiba történt a törlés során!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Egységek betöltése...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Egységek
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedUnits.length === 0}
        >
          Törlés ({selectedUnits.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewUnit}
        >
          Új egység hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név vagy rövidítés szerint..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mt: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Rövidítés</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUnits.map((unit) => (
              <TableRow 
                key={unit.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(unit.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedUnits.includes(unit.id)}
                    onChange={() => handleSelectUnit(unit.id)}
                  />
                </TableCell>
                <TableCell>{unit.name}</TableCell>
                <TableCell>{unit.shortform}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Egységek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedUnits.length} egységet? 
            Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel} 
            disabled={isDeleting}
          >
            Mégse
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
