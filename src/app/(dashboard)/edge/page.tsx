'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { useDatabasePermission } from '@/hooks/useDatabasePermission'

interface EdgeMaterial {
  id: string
  brand_id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  vat_id: string
  created_at: string
  updated_at: string
  brands: {
    name: string
  }
  vat: {
    name: string
    kulcs: number
  }
}

export default function EdgeMaterialsPage() {
  const router = useRouter()
  
  // Check permission for this page
  const hasAccess = useDatabasePermission('/edge')
  
  const [edgeMaterials, setEdgeMaterials] = useState<EdgeMaterial[]>([])
  const [selectedEdgeMaterials, setSelectedEdgeMaterials] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch edge materials from API
  useEffect(() => {
    const fetchEdgeMaterials = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/edge-materials')
        if (response.ok) {
          const data = await response.json()
          setEdgeMaterials(data)
        } else {
          console.error('Failed to fetch edge materials')
          toast.error('Hiba történt az élzárók betöltése során!', {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          })
        }
      } catch (error) {
        console.error('Failed to fetch edge materials:', error)
        toast.error('Hiba történt az élzárók betöltése során!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchEdgeMaterials()
  }, [])

  // Filter edge materials based on search term
  const filteredEdgeMaterials = useMemo(() => {
    if (!searchTerm) return edgeMaterials
    
    const term = searchTerm.toLowerCase()
    return edgeMaterials.filter(material => 
      material.type.toLowerCase().includes(term) ||
      material.decor.toLowerCase().includes(term) ||
      material.brands.name.toLowerCase().includes(term) ||
      material.thickness.toString().includes(term) ||
      material.width.toString().includes(term) ||
      material.price.toString().includes(term)
    )
  }, [edgeMaterials, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedEdgeMaterials(filteredEdgeMaterials.map(material => material.id))
    } else {
      setSelectedEdgeMaterials([])
    }
  }

  const handleSelectEdgeMaterial = (materialId: string) => {
    setSelectedEdgeMaterials(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    )
  }

  const isAllSelected = selectedEdgeMaterials.length === filteredEdgeMaterials.length && filteredEdgeMaterials.length > 0
  const isIndeterminate = selectedEdgeMaterials.length > 0 && selectedEdgeMaterials.length < filteredEdgeMaterials.length

  const handleRowClick = (materialId: string) => {
    router.push(`/edge/${materialId}`)
  }

  const handleAddNewEdgeMaterial = () => {
    router.push('/edge/new')
  }

  const handleDeleteClick = () => {
    if (selectedEdgeMaterials.length === 0) {
      toast.warning('Válasszon ki legalább egy élzárót a törléshez!', {
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
    if (selectedEdgeMaterials.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete edge materials one by one
      const deletePromises = selectedEdgeMaterials.map(materialId => 
        fetch(`/api/edge-materials/${materialId}`, {
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
        toast.success(`${selectedEdgeMaterials.length} élzáró sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Remove deleted edge materials from local state
        setEdgeMaterials(prev => prev.filter(material => !selectedEdgeMaterials.includes(material.id)))
        setSelectedEdgeMaterials([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} élzáró törlése sikertelen!`, {
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
    if (!hasAccess) {
      toast.error('Nincs jogosultsága az Élzárók oldal megtekintéséhez!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      router.push('/users')
    }
  }, [hasAccess, router])

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az Élzárók oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Élzárók betöltése...</Typography>
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
          Élzárók
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedEdgeMaterials.length === 0}
        >
          Törlés ({selectedEdgeMaterials.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewEdgeMaterial}
        >
          Új élzáró hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés típus, dekor, márka, méret vagy ár szerint..."
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
              <TableCell>Ár</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEdgeMaterials.map((material) => (
              <TableRow 
                key={material.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(material.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedEdgeMaterials.includes(material.id)}
                    onChange={() => handleSelectEdgeMaterial(material.id)}
                  />
                </TableCell>
                <TableCell>{material.type}-{material.width}/{material.thickness}-{material.decor}</TableCell>
                <TableCell>{material.price.toLocaleString('hu-HU')} Ft</TableCell>
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
          Élzárók törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedEdgeMaterials.length} élzárót? 
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
