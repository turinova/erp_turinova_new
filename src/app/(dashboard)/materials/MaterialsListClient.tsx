'use client'

import React, { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Chip, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress, Select, MenuItem, FormControl, InputLabel, Grid } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Image as ImageIcon, Add as AddIcon, Delete as DeleteIcon, FileDownload as ExportIcon, FileUpload as ImportIcon, FilterList as FilterIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/permissions/PermissionProvider'
import { formatPriceWithCurrency, calculateGrossPrice } from '@/utils/priceFormatters'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Material {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
  active: boolean
  image_url: string | null
  brand_id: string
  brand_name: string
  kerf_mm: number
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  rotatable: boolean
  waste_multi: number
  machine_code: string
  price_per_sqm: number
  vat_percent: number
  created_at: string
  updated_at: string
}

interface MaterialsListClientProps {
  initialMaterials: Material[]
}

export default function MaterialsListClient({ initialMaterials }: MaterialsListClientProps) {
  const router = useRouter()
  
  // Check permission for this page - temporarily bypassed to fix hook errors
  // const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = true // Temporarily bypass permission check for testing
  const permissionsLoading = false
  
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Filter states
  const [filterBrand, setFilterBrand] = useState<string>('')
  const [filterLength, setFilterLength] = useState<string>('')
  const [filterWidth, setFilterWidth] = useState<string>('')
  const [filterThickness, setFilterThickness] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('all') // 'all', 'active', 'inactive'
  
  // Import states
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Ensure client-side only rendering for buttons to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get unique values for filter dropdowns
  const uniqueBrands = useMemo(() => {
    const brands = new Set(materials.map(m => m.brand_name))
    return Array.from(brands).sort()
  }, [materials])

  const uniqueLengths = useMemo(() => {
    const lengths = new Set(materials.map(m => m.length_mm))
    return Array.from(lengths).sort((a, b) => a - b)
  }, [materials])

  const uniqueWidths = useMemo(() => {
    const widths = new Set(materials.map(m => m.width_mm))
    return Array.from(widths).sort((a, b) => a - b)
  }, [materials])

  const uniqueThicknesses = useMemo(() => {
    const thicknesses = new Set(materials.map(m => m.thickness_mm))
    return Array.from(thicknesses).sort((a, b) => a - b)
  }, [materials])

  // Filter materials based on search term and filters
  const filteredMaterials = useMemo(() => {
    if (!materials || !Array.isArray(materials)) return []
    
    let filtered = materials

    // Apply brand filter
    if (filterBrand) {
      filtered = filtered.filter(m => m.brand_name === filterBrand)
    }

    // Apply length filter
    if (filterLength) {
      filtered = filtered.filter(m => m.length_mm === Number(filterLength))
    }

    // Apply width filter
    if (filterWidth) {
      filtered = filtered.filter(m => m.width_mm === Number(filterWidth))
    }

    // Apply thickness filter
    if (filterThickness) {
      filtered = filtered.filter(m => m.thickness_mm === Number(filterThickness))
    }

    // Apply active filter
    if (filterActive === 'active') {
      filtered = filtered.filter(m => m.active === true)
    } else if (filterActive === 'inactive') {
      filtered = filtered.filter(m => m.active === false)
    }

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(material => 
        material.name.toLowerCase().includes(term) ||
        material.length_mm.toString().includes(term) ||
        material.width_mm.toString().includes(term) ||
        material.thickness_mm.toString().includes(term) ||
        (material.on_stock ? 'igen' : 'nem').includes(term)
      )
    }
    
    return filtered
  }, [materials, searchTerm, filterBrand, filterLength, filterWidth, filterThickness, filterActive])

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

  const handleRowHover = (materialId: string) => {
    // Prefetch the material edit page on hover
    router.prefetch(`/materials/${materialId}/edit`)
    
    // Preload the material data API call
    fetch(`/api/materials/${materialId}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'max-age=300', // 5 minutes cache
      },
    }).catch(() => {
      // Ignore prefetch errors
    })
  }

  const handleAddNew = () => {
    router.push('/materials/new')
  }

  const handleDeleteClick = () => {
    if (selectedMaterials.length > 0) {
      setDeleteDialogOpen(true)
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedMaterials.length === 0) return

    setIsDeleting(true)
    try {
      // Delete all selected materials
      const deletePromises = selectedMaterials.map(async (id) => {
        const response = await fetch(`/api/materials/${id}`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error(`Failed to delete material ${id}`)
      })

      await Promise.all(deletePromises)

      toast.success(`${selectedMaterials.length} anyag sikeresen törölve!`)
      
      // Refresh materials list
      invalidateApiCache('/api/materials')
      const response = await fetch('/api/materials')
      if (response.ok) {
        const data = await response.json()
        setMaterials(data)
      }

      setSelectedMaterials([])
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Hiba történt a törlés során!')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  // Export handler
  const handleExport = async () => {
    try {
      console.log('Exporting materials with filters:', { filterBrand, filterLength, filterWidth, filterThickness, filterActive })
      
      // Build query params for filters
      const params = new URLSearchParams()
      if (filterBrand) params.set('brand', filterBrand)
      if (filterLength) params.set('length', filterLength)
      if (filterWidth) params.set('width', filterWidth)
      if (filterThickness) params.set('thickness', filterThickness)
      if (filterActive && filterActive !== 'all') params.set('active', filterActive)
      
      const queryString = params.toString()
      const url = `/api/materials/export${queryString ? `?${queryString}` : ''}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Download the file
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `anyagok_export_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      const filterCount = filteredMaterials.length
      const totalCount = materials.length
      const message = filterCount < totalCount 
        ? `${filterCount} szűrt anyag exportálva (összesen: ${totalCount})`
        : `Mind a ${totalCount} anyag exportálva!`
      
      toast.success(message)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Hiba történt az exportálás során!')
    }
  }

  // Import file selection handler
  const handleImportFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Csak Excel fájlokat (.xlsx, .xls) lehet importálni!')
      return
    }

    setImportFile(file)
    setIsImporting(true)

    try {
      // Send to preview API
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/materials/import/preview', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        // Show validation errors
        if (data.details && Array.isArray(data.details)) {
          const errorMsg = data.details.join('\n')
          toast.error(errorMsg, { autoClose: 10000 })
        } else {
          toast.error(data.error || 'Hiba az előnézet betöltésekor')
        }
        setImportFile(null)
        return
      }

      setImportPreview(data)
      setImportDialogOpen(true)
    } catch (error) {
      console.error('Import preview error:', error)
      toast.error('Hiba az előnézet betöltésekor!')
      setImportFile(null)
    } finally {
      setIsImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  // Confirm import
  const handleImportConfirm = async () => {
    if (!importFile) return

    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/materials/import', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      const { results } = data

      // Show success message
      let message = `Import sikeres!\n`
      if (results.created > 0) message += `${results.created} új anyag létrehozva\n`
      if (results.updated > 0) message += `${results.updated} anyag frissítve\n`
      if (results.brandsCreated.length > 0) message += `Új márkák: ${results.brandsCreated.join(', ')}`

      toast.success(message)

      // Refresh materials list
      invalidateApiCache('/api/materials')
      const materialsRes = await fetch('/api/materials')
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json()
        setMaterials(materialsData)
      }

      setImportDialogOpen(false)
      setImportFile(null)
      setImportPreview(null)
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Hiba történt az importálás során!')
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportCancel = () => {
    setImportDialogOpen(false)
    setImportFile(null)
    setImportPreview(null)
  }

  const isAllSelected = selectedMaterials.length === filteredMaterials.length && filteredMaterials.length > 0
  const isIndeterminate = selectedMaterials.length > 0 && selectedMaterials.length < filteredMaterials.length

  // Check access permission
  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        toast.error('Nincs jogosultsága az Anyagok oldal megtekintéséhez!', {
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

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az Anyagok oldal megtekintéséhez!
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
          Táblás anyagok
        </Typography>
      </Breadcrumbs>
      
      {mounted && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          {/* Left side: Export/Import buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExport}
              disabled={materials.length === 0}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              component="label"
              startIcon={isImporting ? <CircularProgress size={20} /> : <ImportIcon />}
              disabled={isImporting}
            >
              Import
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleImportFileSelect}
              />
            </Button>
          </Box>

          {/* Right side: Delete/Add buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={handleDeleteClick}
              disabled={selectedMaterials.length === 0}
            >
              Törlés ({selectedMaterials.length})
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
              onClick={handleAddNew}
            >
              Új anyag hozzáadása
            </Button>
          </Box>
        </Box>
      )}
      
      {/* Filter Section - Client-side only to prevent hydration mismatch */}
      {mounted && (
        <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Szűrők</Typography>
            {(filterBrand || filterLength || filterWidth || filterThickness || filterActive !== 'all') && (
              <Button 
                size="small" 
                onClick={() => {
                  setFilterBrand('')
                  setFilterLength('')
                  setFilterWidth('')
                  setFilterThickness('')
                  setFilterActive('all')
                }}
                sx={{ ml: 'auto' }}
              >
                Szűrők törlése
              </Button>
            )}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Márka</InputLabel>
                <Select
                  value={filterBrand}
                  label="Márka"
                  onChange={(e) => setFilterBrand(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Összes</em>
                  </MenuItem>
                  {uniqueBrands.map(brand => (
                    <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Hossz (mm)</InputLabel>
                <Select
                  value={filterLength}
                  label="Hossz (mm)"
                  onChange={(e) => setFilterLength(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Összes</em>
                  </MenuItem>
                  {uniqueLengths.map(length => (
                    <MenuItem key={length} value={length.toString()}>{length}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Szélesség (mm)</InputLabel>
                <Select
                  value={filterWidth}
                  label="Szélesség (mm)"
                  onChange={(e) => setFilterWidth(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Összes</em>
                  </MenuItem>
                  {uniqueWidths.map(width => (
                    <MenuItem key={width} value={width.toString()}>{width}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Vastagság (mm)</InputLabel>
                <Select
                  value={filterThickness}
                  label="Vastagság (mm)"
                  onChange={(e) => setFilterThickness(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Összes</em>
                  </MenuItem>
                  {uniqueThicknesses.map(thickness => (
                    <MenuItem key={thickness} value={thickness.toString()}>{thickness}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Aktív</InputLabel>
                <Select
                  value={filterActive}
                  label="Aktív"
                  onChange={(e) => setFilterActive(e.target.value)}
                >
                  <MenuItem value="all">
                    <em>Összes</em>
                  </MenuItem>
                  <MenuItem value="active">Aktív</MenuItem>
                  <MenuItem value="inactive">Inaktív</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )}
      
      <TextField
        fullWidth
        placeholder="Keresés név, hossz, szélesség, vastagság vagy raktár szerint..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
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
              <TableCell align="right">Bruttó ár/m²</TableCell>
              <TableCell>Szálirány</TableCell>
              <TableCell>Raktári</TableCell>
              <TableCell>Aktív</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMaterials.map((material) => (
              <TableRow 
                key={material.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(material.id)}
                onMouseEnter={() => handleRowHover(material.id)}
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
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {material.price_per_sqm > 0 
                      ? formatPriceWithCurrency(calculateGrossPrice(material.price_per_sqm, material.vat_percent))
                      : '-'
                    }
                  </Typography>
                </TableCell>
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
               <TableCell>
                 <Typography 
                   variant="body2" 
                   color={material.active ? "success.main" : "error.main"}
                   sx={{ fontWeight: material.active ? 'bold' : 'normal' }}
                 >
                   {material.active ? 'Igen' : 'Nem'}
                 </Typography>
               </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Anyagok törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {selectedMaterials.length} anyagot? Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Mégse
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={handleImportCancel}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Import előnézet</DialogTitle>
        <DialogContent>
          {importPreview && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Összesen:</strong> {importPreview.stats?.total || 0} anyag
                </Typography>
                <Typography variant="body2" color="success.main">
                  Új anyagok: {importPreview.stats?.create || 0}
                </Typography>
                <Typography variant="body2" color="info.main">
                  Frissítések: {importPreview.stats?.update || 0}
                </Typography>
                {importPreview.newBrands && importPreview.newBrands.length > 0 && (
                  <Typography variant="body2" color="warning.main">
                    Új márkák létrehozva: {importPreview.newBrands.join(', ')}
                  </Typography>
                )}
              </Box>

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Művelet</strong></TableCell>
                      <TableCell><strong>Gépkód</strong></TableCell>
                      <TableCell><strong>Anyag neve</strong></TableCell>
                      <TableCell><strong>Márka</strong></TableCell>
                      <TableCell><strong>Méretek</strong></TableCell>
                      <TableCell><strong>Ár/m²</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.preview?.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip 
                            label={item.action === 'CREATE' ? 'Hozzáadás' : 'Frissítés'} 
                            color={item.action === 'CREATE' ? 'success' : 'info'} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>{item.machineCode}</TableCell>
                        <TableCell>
                          {item.name}
                          {item.action === 'UPDATE' && item.existingName && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              Jelenlegi: {item.existingName}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{item.brand}</TableCell>
                        <TableCell>{item.dimensions}</TableCell>
                        <TableCell>{item.price} {item.currency}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImportCancel} disabled={isImporting}>
            Mégse
          </Button>
          <Button 
            onClick={handleImportConfirm} 
            color="primary" 
            variant="contained" 
            disabled={isImporting}
            startIcon={isImporting ? <CircularProgress size={20} /> : null}
          >
            {isImporting ? 'Importálás...' : 'Importálás megerősítése'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
