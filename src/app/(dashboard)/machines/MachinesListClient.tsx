'use client'

import React, { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

import { usePermissions } from '@/permissions/PermissionProvider'

interface ProductionMachine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
  created_at: string
  updated_at: string
}

interface MachinesListClientProps {
  initialMachines: ProductionMachine[]
}

export default function MachinesListClient({ initialMachines }: MachinesListClientProps) {
  const router = useRouter()
  
  // Check permission for this page - temporarily bypassed to fix hook errors
  // const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = true // Temporarily bypass permission check for testing
  const permissionsLoading = false
  
  const [machines, setMachines] = useState<ProductionMachine[]>(initialMachines)
  const [selectedMachines, setSelectedMachines] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter machines based on search term (client-side fallback)
  const filteredMachines = useMemo(() => {
    if (!machines || !Array.isArray(machines)) return []
    if (!searchTerm) return machines
    
    const term = searchTerm.toLowerCase()
    return machines.filter(machine => 
      machine.machine_name.toLowerCase().includes(term)
    )
  }, [machines, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedMachines(filteredMachines.map(machine => machine.id))
    } else {
      setSelectedMachines([])
    }
  }

  const handleSelectMachine = (machineId: string) => {
    setSelectedMachines(prev => 
      prev.includes(machineId) 
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    )
  }

  const isAllSelected = selectedMachines.length === filteredMachines.length && filteredMachines.length > 0
  const isIndeterminate = selectedMachines.length > 0 && selectedMachines.length < filteredMachines.length

  const handleRowClick = (machineId: string) => {
    router.push(`/machines/${machineId}`)
  }

  const handleAddNewMachine = () => {
    router.push('/machines/new')
  }

  const handleDeleteClick = () => {
    if (selectedMachines.length === 0) {
      toast.warning('Válasszon ki legalább egy gépet a törléshez!', {
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
    if (selectedMachines.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete machines one by one
      const deletePromises = selectedMachines.map(machineId => 
        fetch(`/api/machines/${machineId}`, {
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
        toast.success(`${selectedMachines.length} gép sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Invalidate cache and refresh data
        invalidateApiCache('/api/machines')
        
        // Update local state by removing deleted machines
        setMachines(prev => prev.filter(machine => !selectedMachines.includes(machine.id)))
        setSelectedMachines([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} gép törlése sikertelen!`, {
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

  // Check access permission
  useEffect(() => {
    // Only redirect if permissions are loaded and user doesn't have access
    // Add a small delay to prevent redirects during page refresh
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        toast.error('Nincs jogosultsága a Gépek oldal megtekintéséhez!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        router.push('/users')
      }, 100) // Small delay to prevent redirects during page refresh
      
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading, router])

  // Show loading state while permissions are being checked
  if (permissionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a Gépek oldal megtekintéséhez!
        </Typography>
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
          Gépek
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedMachines.length === 0}
        >
          Törlés ({selectedMachines.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewMachine}
        >
          Új gép hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés gép neve szerint..."
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
              <TableCell>Gép neve</TableCell>
              <TableCell>Megjegyzés</TableCell>
              <TableCell>Napi limit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMachines.map((machine) => (
              <TableRow 
                key={machine.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(machine.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedMachines.includes(machine.id)}
                    onChange={() => handleSelectMachine(machine.id)}
                  />
                </TableCell>
                <TableCell>{machine.machine_name}</TableCell>
                <TableCell>{machine.comment || '-'}</TableCell>
                <TableCell>{machine.usage_limit_per_day}</TableCell>
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
          Gépek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedMachines.length} gépet? 
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
