'use client'

import React, { useState, useMemo } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useApiCache } from '@/hooks/useApiCache'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Currency {
  id: string
  name: string
  rate: number
  created_at: string
  updated_at: string
}

export default function CurrenciesPage() {
  const router = useRouter()
  
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use unified API with caching
  const { data: currencies = [], isLoading, error, refresh } = useApiCache<Currency[]>('/api/currencies', {
    ttl: 2 * 60 * 1000, // 2 minutes cache
    staleWhileRevalidate: true
  })

  // Filter currencies based on search term (client-side fallback)
  const filteredCurrencies = useMemo(() => {
    if (!currencies || !Array.isArray(currencies)) return []
    if (!searchTerm) return currencies
    
    const term = searchTerm.toLowerCase()
    return currencies.filter(currency => 
      currency.name.toLowerCase().includes(term) ||
      currency.rate.toString().includes(term)
    )
  }, [currencies, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedCurrencies(filteredCurrencies.map(currency => currency.id))
    } else {
      setSelectedCurrencies([])
    }
  }

  const handleSelectCurrency = (currencyId: string) => {
    setSelectedCurrencies(prev => 
      prev.includes(currencyId) 
        ? prev.filter(id => id !== currencyId)
        : [...prev, currencyId]
    )
  }

  const isAllSelected = selectedCurrencies.length === filteredCurrencies.length && filteredCurrencies.length > 0
  const isIndeterminate = selectedCurrencies.length > 0 && selectedCurrencies.length < filteredCurrencies.length

  const handleRowClick = (currencyId: string) => {
    router.push(`/currencies/${currencyId}`)
  }

  const handleAddNewCurrency = () => {
    router.push('/currencies/new')
  }

  const handleDeleteClick = () => {
    if (selectedCurrencies.length === 0) {
      toast.warning('Válasszon ki legalább egy pénznemet a törléshez!', {
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
    if (selectedCurrencies.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete currencies one by one
      const deletePromises = selectedCurrencies.map(currencyId => 
        fetch(`/api/currencies/${currencyId}`, {
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
        toast.success(`${selectedCurrencies.length} pénznem sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Invalidate cache and refresh data
        invalidateApiCache('/api/currencies')
        await refresh()
        setSelectedCurrencies([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} pénznem törlése sikertelen!`, {
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
        <Typography sx={{ ml: 2 }}>Pénznemek betöltése...</Typography>
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
          Pénznemek
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedCurrencies.length === 0}
        >
          Törlés ({selectedCurrencies.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewCurrency}
        >
          Új pénznem hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név vagy árfolyam szerint..."
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
              <TableCell>Árfolyam (HUF alap)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCurrencies.map((currency) => (
              <TableRow 
                key={currency.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(currency.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCurrencies.includes(currency.id)}
                    onChange={() => handleSelectCurrency(currency.id)}
                  />
                </TableCell>
                <TableCell>{currency.name}</TableCell>
                <TableCell>{currency.rate.toFixed(4)}</TableCell>
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
          Pénznemek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedCurrencies.length} pénznemet? 
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
