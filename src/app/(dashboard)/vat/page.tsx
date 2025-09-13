'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

export default function VatPage() {
  const router = useRouter()
  
  const [vatRates, setVatRates] = useState<VatRate[]>([])
  const [selectedVatRates, setSelectedVatRates] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch VAT rates from API
  useEffect(() => {
    const fetchVatRates = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/vat')
        if (response.ok) {
          const data = await response.json()
          setVatRates(data)
        } else {
          console.error('Failed to fetch VAT rates')
          // Fallback to sample data
          setVatRates([
            {
              id: '1',
              name: 'ÁFA mentes',
              kulcs: 0.00,
              created_at: '2025-09-13T06:00:00Z',
              updated_at: '2025-09-13T06:00:00Z'
            },
            {
              id: '2',
              name: 'ÁFA 27%',
              kulcs: 27.00,
              created_at: '2025-09-13T06:00:00Z',
              updated_at: '2025-09-13T06:00:00Z'
            }
          ])
        }
      } catch (error) {
        console.error('Failed to fetch VAT rates:', error)
        // Fallback to sample data
        setVatRates([
          {
            id: '1',
            name: 'ÁFA mentes',
            kulcs: 0.00,
            created_at: '2025-09-13T06:00:00Z',
            updated_at: '2025-09-13T06:00:00Z'
          },
          {
            id: '2',
            name: 'ÁFA 27%',
            kulcs: 27.00,
            created_at: '2025-09-13T06:00:00Z',
            updated_at: '2025-09-13T06:00:00Z'
          }
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchVatRates()
  }, [])

  // Filter VAT rates based on search term
  const filteredVatRates = useMemo(() => {
    if (!searchTerm) return vatRates
    
    const term = searchTerm.toLowerCase()
    return vatRates.filter(vatRate => 
      vatRate.name.toLowerCase().includes(term) ||
      vatRate.kulcs.toString().includes(term)
    )
  }, [vatRates, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedVatRates(filteredVatRates.map(vatRate => vatRate.id))
    } else {
      setSelectedVatRates([])
    }
  }

  const handleSelectVatRate = (vatRateId: string) => {
    setSelectedVatRates(prev => 
      prev.includes(vatRateId) 
        ? prev.filter(id => id !== vatRateId)
        : [...prev, vatRateId]
    )
  }

  const isAllSelected = selectedVatRates.length === filteredVatRates.length && filteredVatRates.length > 0
  const isIndeterminate = selectedVatRates.length > 0 && selectedVatRates.length < filteredVatRates.length

  const handleRowClick = (vatRateId: string) => {
    router.push(`/vat/${vatRateId}`)
  }

  const handleAddNewVatRate = () => {
    router.push('/vat/new')
  }

  const handleDeleteClick = () => {
    if (selectedVatRates.length === 0) {
      toast.warning('Válasszon ki legalább egy adónemet a törléshez!', {
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
    if (selectedVatRates.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete VAT rates one by one
      const deletePromises = selectedVatRates.map(vatRateId => 
        fetch(`/api/vat/${vatRateId}`, {
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
        toast.success(`${selectedVatRates.length} adónem sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Remove deleted VAT rates from local state
        setVatRates(prev => prev.filter(vatRate => !selectedVatRates.includes(vatRate.id)))
        setSelectedVatRates([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} adónem törlése sikertelen!`, {
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
        <Typography sx={{ ml: 2 }}>Adónemek betöltése...</Typography>
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
          Adónemek
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedVatRates.length === 0}
        >
          Törlés ({selectedVatRates.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewVatRate}
        >
          Új adónem hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név vagy kulcs szerint..."
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
              <TableCell>Kulcs (%)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVatRates.map((vatRate) => (
              <TableRow 
                key={vatRate.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(vatRate.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedVatRates.includes(vatRate.id)}
                    onChange={() => handleSelectVatRate(vatRate.id)}
                  />
                </TableCell>
                <TableCell>{vatRate.name}</TableCell>
                <TableCell>{vatRate.kulcs}%</TableCell>
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
          Adónemek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedVatRates.length} adónemet? 
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
