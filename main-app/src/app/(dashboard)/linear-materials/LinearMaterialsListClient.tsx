'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Chip, FormControl, InputLabel, Select, MenuItem, Grid } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon, FileDownload as ExportIcon, FileUpload as ImportIcon, Image as ImageIcon, FilterList as FilterIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface LinearMaterial {
  id: string
  brand_id: string
  name: string
  width: number
  length: number
  thickness: number
  type: string
  image_url: string | null
  price_per_m: number
  currency_id: string
  vat_id: string
  on_stock: boolean
  active: boolean
  created_at: string
  updated_at: string
  machine_code: string
  brand_name: string
  currency_code: string
  currency_name: string
  vat_name: string
  vat_percent: number
}

interface LinearMaterialsListClientProps {
  initialLinearMaterials: LinearMaterial[]
}

export default function LinearMaterialsListClient({ initialLinearMaterials }: LinearMaterialsListClientProps) {
  const router = useRouter()
  
  const [linearMaterials, setLinearMaterials] = useState<LinearMaterial[]>(initialLinearMaterials)
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
  const [filterActive, setFilterActive] = useState<string>('all')
  
  // Import states
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get unique values for filter dropdowns
  const uniqueBrands = useMemo(() => {
    const brands = new Set(linearMaterials.map(m => m.brand_name))
    return Array.from(brands).sort()
  }, [linearMaterials])

  const uniqueLengths = useMemo(() => {
    const lengths = new Set(linearMaterials.map(m => m.length))
    return Array.from(lengths).sort((a, b) => a - b)
  }, [linearMaterials])

  const uniqueWidths = useMemo(() => {
    const widths = new Set(linearMaterials.map(m => m.width))
    return Array.from(widths).sort((a, b) => a - b)
  }, [linearMaterials])

  const uniqueThicknesses = useMemo(() => {
    const thicknesses = new Set(linearMaterials.map(m => m.thickness))
    return Array.from(thicknesses).sort((a, b) => a - b)
  }, [linearMaterials])

  // Filter materials
  const filteredMaterials = useMemo(() => {
    let filtered = linearMaterials

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(term) ||
        m.brand_name.toLowerCase().includes(term) ||
        m.type.toLowerCase().includes(term)
      )
    }

    if (filterBrand) {
      filtered = filtered.filter(m => m.brand_name === filterBrand)
    }

    if (filterLength) {
      filtered = filtered.filter(m => m.length.toString() === filterLength)
    }

    if (filterWidth) {
      filtered = filtered.filter(m => m.width.toString() === filterWidth)
    }

    if (filterThickness) {
      filtered = filtered.filter(m => m.thickness.toString() === filterThickness)
    }

    if (filterActive === 'active') {
      filtered = filtered.filter(m => m.active === true)
    } else if (filterActive === 'inactive') {
      filtered = filtered.filter(m => m.active === false)
    }

    return filtered
  }, [linearMaterials, searchTerm, filterBrand, filterLength, filterWidth, filterThickness, filterActive])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedMaterials(filteredMaterials.map(m => m.id))
    } else {
      setSelectedMaterials([])
    }
  }

  const handleSelectMaterial = (id: string) => {
    setSelectedMaterials(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    )
  }

  const handleRowClick = (id: string) => {
    router.push(`/linear-materials/${id}/edit`)
  }

  const handleAddNew = () => {
    router.push('/linear-materials/new')
  }

  const handleDeleteClick = () => {
    if (selectedMaterials.length === 0) {
      toast.warning('Válasszon ki legalább egy anyagot!')
      return
    }
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    
    try {
      const deletePromises = selectedMaterials.map(id => 
        fetch(`/api/linear-materials/${id}`, { method: 'DELETE' })
      )
      await Promise.all(deletePromises)
      
      toast.success(`${selectedMaterials.length} anyag törölve!`)
      
      invalidateApiCache('/api/linear-materials')
      const response = await fetch('/api/linear-materials')
      if (response.ok) {
        const data = await response.json()
        setLinearMaterials(data)
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

  const handleExport = async () => {
    try {
      const response = await fetch('/api/linear-materials/export')
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `szalas_anyagok_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Exportálás sikeres!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Hiba történt az exportálás során!')
    }
  }

  const handleImportFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Csak Excel fájlokat lehet importálni!')
      return
    }

    setImportFile(file)
    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/linear-materials/import/preview', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorMsg = result.errors?.join('\n') || 'Hiba az előnézet betöltésekor'
        toast.error(errorMsg, { autoClose: 10000 })
        setImportFile(null)
        return
      }

      setImportPreview(result.preview)
      setImportDialogOpen(true)
    } catch (error) {
      console.error('Import preview error:', error)
      toast.error('Hiba az előnézet betöltésekor!')
      setImportFile(null)
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  const handleImportConfirm = async () => {
    if (!importFile) return
    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/linear-materials/import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.errors?.join('\n') || 'Import sikertelen!', { autoClose: 10000 })
      } else {
        let message = `Import sikeres!\n`
        if (result.created > 0) message += `${result.created} új anyag\n`
        if (result.updated > 0) message += `${result.updated} frissítés`
        
        toast.success(message)
        
        invalidateApiCache('/api/linear-materials')
        const materialsRes = await fetch('/api/linear-materials')
        if (materialsRes.ok) {
          const data = await materialsRes.json()
          setLinearMaterials(data)
        }
        
        setImportDialogOpen(false)
        setImportFile(null)
        setImportPreview(null)
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Hiba történt az importálás során!')
    } finally {
      setIsImporting(false)
    }
  }

  const isAllSelected = selectedMaterials.length === filteredMaterials.length && filteredMaterials.length > 0
  const isIndeterminate = selectedMaterials.length > 0 && selectedMaterials.length < filteredMaterials.length

  const formatPrice = (pricePerM: number, currencyCode: string, vatPercent: number) => {
    const grossPrice = pricePerM * (1 + vatPercent / 100)
    return `${grossPrice.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} ${currencyCode}/m`
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link href="/home" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary">Szálas anyagok</Typography>
      </Breadcrumbs>

      {mounted && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport}>
              Export
            </Button>
            <Button
              variant="outlined"
              component="label"
              startIcon={isImporting ? <CircularProgress size={20} /> : <ImportIcon />}
              disabled={isImporting}
            >
              Import
              <input type="file" hidden accept=".xlsx,.xls" onChange={handleImportFileSelect} />
            </Button>
          </Box>
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
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNew}>
              Új anyag hozzáadása
            </Button>
          </Box>
        </Box>
      )}

      {/* Filter Section */}
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
                <Select value={filterBrand} label="Márka" onChange={(e) => setFilterBrand(e.target.value)}>
                  <MenuItem value=""><em>Összes</em></MenuItem>
                  {uniqueBrands.map(brand => (
                    <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Hossz (mm)</InputLabel>
                <Select value={filterLength} label="Hossz (mm)" onChange={(e) => setFilterLength(e.target.value)}>
                  <MenuItem value=""><em>Összes</em></MenuItem>
                  {uniqueLengths.map(length => (
                    <MenuItem key={length} value={length.toString()}>{length}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Szélesség (mm)</InputLabel>
                <Select value={filterWidth} label="Szélesség (mm)" onChange={(e) => setFilterWidth(e.target.value)}>
                  <MenuItem value=""><em>Összes</em></MenuItem>
                  {uniqueWidths.map(width => (
                    <MenuItem key={width} value={width.toString()}>{width}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Vastagság (mm)</InputLabel>
                <Select value={filterThickness} label="Vastagság (mm)" onChange={(e) => setFilterThickness(e.target.value)}>
                  <MenuItem value=""><em>Összes</em></MenuItem>
                  {uniqueThicknesses.map(thickness => (
                    <MenuItem key={thickness} value={thickness.toString()}>{thickness}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Aktív</InputLabel>
                <Select value={filterActive} label="Aktív" onChange={(e) => setFilterActive(e.target.value)}>
                  <MenuItem value="all"><em>Összes</em></MenuItem>
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
        placeholder="Keresés név, márka vagy típus szerint..."
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

      <TableContainer component={Paper}>
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
              <TableCell align="right">Bruttó ár/m</TableCell>
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
                <TableCell>{material.length.toLocaleString()}</TableCell>
                <TableCell>{material.width.toLocaleString()}</TableCell>
                <TableCell>{material.thickness}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {formatPrice(material.price_per_m, material.currency_code, material.vat_percent)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={material.on_stock ? "success.main" : "error.main"} sx={{ fontWeight: material.on_stock ? 'bold' : 'normal' }}>
                    {material.on_stock ? 'Igen' : 'Nem'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={material.active ? "success.main" : "error.main"} sx={{ fontWeight: material.active ? 'bold' : 'normal' }}>
                    {material.active ? 'Igen' : 'Nem'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Anyagok törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {selectedMaterials.length} anyagot?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Mégse</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import előnézet</DialogTitle>
        <DialogContent>
          {importPreview && importPreview.length > 0 && (
            <>
              <Box sx={{ mb: 2, mt: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Összesen:</strong> {importPreview.length} anyag
                </Typography>
                <Typography variant="body2" color="success.main">
                  Új: {importPreview.filter((p: any) => p.action === 'Új').length}
                </Typography>
                <Typography variant="body2" color="info.main">
                  Frissítés: {importPreview.filter((p: any) => p.action === 'Frissítés').length}
                </Typography>
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Művelet</strong></TableCell>
                      <TableCell><strong>Gépkód</strong></TableCell>
                      <TableCell><strong>Név</strong></TableCell>
                      <TableCell><strong>Márka</strong></TableCell>
                      <TableCell><strong>Ár/m</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip label={row.action === 'Új' ? 'Hozzáadás' : 'Frissítés'} color={row.action === 'Új' ? 'success' : 'info'} size="small" />
                        </TableCell>
                        <TableCell>{row.machineCode}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.brand}</TableCell>
                        <TableCell>{row.pricePerM} Ft/m</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialogOpen(false); setImportFile(null); setImportPreview(null); }}>Mégse</Button>
          <Button onClick={handleImportConfirm} variant="contained" disabled={!importPreview || isImporting}>
            {isImporting ? 'Import...' : 'Import megerősítése'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

