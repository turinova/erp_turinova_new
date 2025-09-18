'use client'

import React, { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, CircularProgress, Chip } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Image as ImageIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useApiCache } from '@/hooks/useApiCache'
import { invalidateApiCache } from '@/hooks/useApiCache'

import { usePermissions } from '@/permissions/PermissionProvider'

interface Material {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
  image_url: string | null
  created_at: string
  updated_at: string
}

export default function MaterialsPage() {
  const router = useRouter()
  
  // Check permission for this page
  const { canAccess } = usePermissions()
  const hasAccess = canAccess('/materials')
  
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Use unified API with caching
  const { data: materials = [], isLoading, error, refresh } = useApiCache<Material[]>('/api/materials', {
    ttl: 2 * 60 * 1000, // 2 minutes cache
    staleWhileRevalidate: true
  })

  // Filter materials based on search term (client-side fallback)
  const filteredMaterials = useMemo(() => {
    if (!materials || !Array.isArray(materials)) return []
    if (!searchTerm) return materials
    
    const term = searchTerm.toLowerCase()
    return materials.filter(material => 
      material.name.toLowerCase().includes(term) ||
      material.length_mm.toString().includes(term) ||
      material.width_mm.toString().includes(term) ||
      material.thickness_mm.toString().includes(term) ||
      (material.on_stock ? 'igen' : 'nem').includes(term)
    )
  }, [materials, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedMaterials(filteredMaterials.map(material => material.id))
    } else {
      setSelectedMaterials([])
    }
  }

  const handleSelectMaterial = (materialId: string) => {
    setSelectedMaterials(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    )
  }

  const handleRowClick = (materialId: string) => {
    router.push(`/materials/${materialId}/edit`)
  }

  const isAllSelected = selectedMaterials.length === filteredMaterials.length && filteredMaterials.length > 0
  const isIndeterminate = selectedMaterials.length > 0 && selectedMaterials.length < filteredMaterials.length


  // Check access permission
  useEffect(() => {
    if (!hasAccess) {
      toast.error('Nincs jogosultsága az Anyagok oldal megtekintéséhez!', {
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
          Nincs jogosultsága az Anyagok oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Anyagok betöltése...</Typography>
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
          Táblás anyagok
        </Typography>
      </Breadcrumbs>
      
      <TextField
        fullWidth
        placeholder="Keresés név, hossz, szélesség, vastagság vagy raktár szerint..."
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
              <TableCell>Kép</TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Hossz (mm)</TableCell>
              <TableCell>Szélesség (mm)</TableCell>
              <TableCell>Vastagság (mm)</TableCell>
              <TableCell>Szálirány</TableCell>
              <TableCell>Raktári</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMaterials.map((material) => (
              <TableRow 
                key={material.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(material.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedMaterials.includes(material.id)}
                    onChange={() => handleSelectMaterial(material.id)}
                  />
                </TableCell>
                <TableCell>
                  {material.image_url ? (
                    <img
                      src={material.image_url}
                      alt={material.name}
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: 'cover',
                        borderRadius: 4
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: '#f5f5f5',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999'
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 20 }} />
                    </Box>
                  )}
                </TableCell>
                <TableCell>{material.name}</TableCell>
                <TableCell>{material.length_mm.toLocaleString()}</TableCell>
                <TableCell>{material.width_mm.toLocaleString()}</TableCell>
                <TableCell>{material.thickness_mm}</TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    color={material.grain_direction ? "success.main" : "text.secondary"}
                    sx={{ fontWeight: material.grain_direction ? 'bold' : 'normal' }}
                  >
                    {material.grain_direction ? 'Igen' : 'Nem'}
                  </Typography>
                </TableCell>
               <TableCell>
                 <Chip
                   label={material.on_stock ? 'Igen' : 'Nem'}
                   color={material.on_stock ? 'success' : 'error'}
                   variant="filled"
                   size="small"
                 />
               </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
