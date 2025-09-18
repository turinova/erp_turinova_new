'use client'

import React, { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { useApiCache, invalidateApiCache } from '../../../hooks/useApiCache'

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

export default function GyartokPage() {
  const router = useRouter()
  
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use cached API data with 2-minute TTL
  const { data: brands = [], isLoading, error, refresh } = useApiCache<Brand[]>('/api/brands', {
    ttl: 2 * 60 * 1000, // 2 minutes cache
    staleWhileRevalidate: true
  })

  // Filter brands based on search term (client-side fallback)
  const filteredBrands = useMemo(() => {
    if (!brands || !Array.isArray(brands)) return []
    if (!searchTerm) return brands
    
    const term = searchTerm.toLowerCase()

    
return brands.filter(brand => 
      brand.name.toLowerCase().includes(term) ||
      (brand.comment && brand.comment.toLowerCase().includes(term))
    )
  }, [brands, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedBrands(filteredBrands?.map(brand => brand.id) || [])
    } else {
      setSelectedBrands([])
    }
  }

  const handleSelectBrand = (brandId: string) => {
    setSelectedBrands(prev => 
      prev.includes(brandId) 
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    )
  }

  const isAllSelected = selectedBrands.length === (filteredBrands?.length || 0) && (filteredBrands?.length || 0) > 0
  const isIndeterminate = selectedBrands.length > 0 && selectedBrands.length < (filteredBrands?.length || 0)

  const handleRowClick = (brandId: string) => {
    router.push(`/brands/${brandId}`)
  }

  const handleAddNewBrand = () => {
    router.push('/brands/new')
  }

  const handleDeleteClick = () => {
    if (selectedBrands.length === 0) {
      toast.warning('Válasszon ki legalább egy gyártót a törléshez!', {
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
    if (selectedBrands.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete brands one by one
      const deletePromises = selectedBrands.map(brandId => 
        fetch(`/api/brands/${brandId}`, {
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
        toast.success(`${selectedBrands.length} gyártó sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Invalidate cache and refresh data
        invalidateApiCache('/api/brands')
        await refresh()
        setSelectedBrands([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} gyártó törlése sikertelen!`, {
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
        <Typography sx={{ ml: 2 }}>Gyártók betöltése...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography color="error">Hiba történt az adatok betöltése során: {error}</Typography>
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
          Gyártók
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedBrands.length === 0}
        >
          Törlés ({selectedBrands.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewBrand}
        >
          Új gyártó hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név vagy megjegyzés szerint..."
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
              <TableCell>Megjegyzés</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(filteredBrands || []).map((brand) => (
              <TableRow 
                key={brand.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(brand.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedBrands.includes(brand.id)}
                    onChange={() => handleSelectBrand(brand.id)}
                  />
                </TableCell>
                <TableCell>{brand.name}</TableCell>
                <TableCell>{brand.comment || '-'}</TableCell>
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
          Gyártók törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedBrands.length} gyártót? 
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
