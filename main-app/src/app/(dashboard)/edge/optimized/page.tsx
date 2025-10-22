'use client'

import React, { useState, useMemo } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, Checkbox, IconButton, Tooltip } from '@mui/material'
import { Home as HomeIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'
import { useEdgeMaterials, useDeleteEdgeMaterial } from '@/hooks/useEdgeMaterials'

export default function OptimizedEdgeMaterialsPage() {
  const router = useRouter()
  
  // Helper function to calculate gross price as integer
  const calculateGrossPrice = (netPrice: number, vatRate: number) => {
    return Math.round(netPrice * (1 + vatRate / 100))
  }
  
  // Check permission for this page
  const { canAccess } = usePermissions()
  const hasAccess = canAccess('/edge')
  
  // Use optimized hooks with caching
  const { edgeMaterials, isLoading, error, refresh } = useEdgeMaterials()
  const { deleteEdgeMaterial, isDeleting } = useDeleteEdgeMaterial()
  
  const [selectedEdgeMaterials, setSelectedEdgeMaterials] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Filter edge materials based on search term
  const filteredEdgeMaterials = useMemo(() => {
    if (!searchTerm) return edgeMaterials
    
    const term = searchTerm.toLowerCase()

    
return edgeMaterials.filter(material => 
      material.type.toLowerCase().includes(term) ||
      material.decor.toLowerCase().includes(term) ||
      material.brands.name.toLowerCase().includes(term) ||
      material.vat.name.toLowerCase().includes(term) ||
      material.thickness.toString().includes(term) ||
      material.width.toString().includes(term) ||
      material.price.toString().includes(term)
    )
  }, [edgeMaterials, searchTerm])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEdgeMaterials(filteredEdgeMaterials.map(material => material.id))
    } else {
      setSelectedEdgeMaterials([])
    }
  }

  const handleSelectMaterial = (materialId: string, checked: boolean) => {
    if (checked) {
      setSelectedEdgeMaterials(prev => [...prev, materialId])
    } else {
      setSelectedEdgeMaterials(prev => prev.filter(id => id !== materialId))
    }
  }

  const handleEdit = (materialId: string) => {
    router.push(`/edge/${materialId}`)
  }

  const handleDelete = (materialId: string) => {
    setSelectedEdgeMaterials([materialId])
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedEdgeMaterials.length === 0) return

    try {
      // Delete all selected materials
      const deletePromises = selectedEdgeMaterials.map(id => deleteEdgeMaterial(id))

      await Promise.all(deletePromises)

      toast.success(`${selectedEdgeMaterials.length} élzáró sikeresen törölve!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })

      setSelectedEdgeMaterials([])
      setDeleteModalOpen(false)
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
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
  }

  // Check access permission
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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          Hiba történt az élzárók betöltése során: {error}
        </Typography>
        <Button onClick={refresh} sx={{ mt: 2 }}>
          Újrapróbálás
        </Button>
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
        <Typography color="text.primary">
          Élzárók (Optimalizált)
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Élzárók kezelése
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={refresh}
            disabled={isLoading}
          >
            Frissítés
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/edge/new')}
          >
            Új élzáró
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* Search and Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <TextField
            placeholder="Keresés élzárók között..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ minWidth: 300 }}
          />
          
          {selectedEdgeMaterials.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedEdgeMaterials.length} elem kiválasztva
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteModalOpen(true)}
                disabled={isDeleting}
              >
                Törlés
              </Button>
            </Box>
          )}
        </Box>

        {/* Materials Table */}
        <Box sx={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>
                  <Checkbox
                    checked={selectedEdgeMaterials.length === filteredEdgeMaterials.length && filteredEdgeMaterials.length > 0}
                    indeterminate={selectedEdgeMaterials.length > 0 && selectedEdgeMaterials.length < filteredEdgeMaterials.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Márka</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Típus</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Dekor</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Szélesség (mm)</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Vastagság (mm)</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Bruttó ár (Ft)</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Adónem</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Műveletek</th>
              </tr>
            </thead>
            <tbody>
              {filteredEdgeMaterials.map((material) => (
                <tr key={material.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px' }}>
                    <Checkbox
                      checked={selectedEdgeMaterials.includes(material.id)}
                      onChange={(e) => handleSelectMaterial(material.id, e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>{material.brands.name}</td>
                  <td style={{ padding: '12px' }}>{material.type}</td>
                  <td style={{ padding: '12px' }}>{material.decor}</td>
                  <td style={{ padding: '12px' }}>{material.width}</td>
                  <td style={{ padding: '12px' }}>{material.thickness}</td>
                  <td style={{ padding: '12px' }}>{calculateGrossPrice(material.price, material.vat.kulcs)} Ft</td>
                  <td style={{ padding: '12px' }}>{material.vat.name} ({material.vat.kulcs}%)</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <Tooltip title="Szerkesztés">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(material.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Törlés">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(material.id)}
                        disabled={isDeleting}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>

        {filteredEdgeMaterials.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              {searchTerm ? 'Nincs találat a keresési feltételeknek megfelelő élzáró.' : 'Nincs élzáró hozzáadva.'}
            </Typography>
            {!searchTerm && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/edge/new')}
                sx={{ mt: 2 }}
              >
                Első élzáró hozzáadása
              </Button>
            )}
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Összesen: {filteredEdgeMaterials.length} élzáró
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cache-elt verzió - gyorsabb betöltés
          </Typography>
        </Box>
      </Paper>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <Paper sx={{ p: 3, maxWidth: 400, width: '90%' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Törlés megerősítése
            </Typography>
            <Typography sx={{ mb: 3 }}>
              Biztosan törölni szeretné a kiválasztott {selectedEdgeMaterials.length} élzárót?
              Ez a művelet nem vonható vissza.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleDeleteCancel}
                disabled={isDeleting}
              >
                Mégse
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                startIcon={isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />}
              >
                {isDeleting ? 'Törlés...' : 'Törlés'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  )
}
