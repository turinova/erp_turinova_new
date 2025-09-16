'use client'

import React, { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  CircularProgress, 
  Alert,
  Breadcrumbs,
  Link,
  FormControlLabel,
  Switch,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-toastify'
import { useDatabasePermission } from '@/hooks/useDatabasePermission'
import ImageUpload from '@/components/ImageUpload'

interface Material {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
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
  created_at: string
  updated_at: string
}

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

export default function EditMaterialPage() {
  const router = useRouter()
  const params = useParams()
  const materialId = params.id as string
  
  // Check permission for this page
  const hasAccess = useDatabasePermission('/materials')
  
  const [material, setMaterial] = useState<Material | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    length_mm: 0,
    width_mm: 0,
    thickness_mm: 0,
    grain_direction: false,
    on_stock: true,
    image_url: '',
    brand_id: '',
    kerf_mm: 3,
    trim_top_mm: 0,
    trim_right_mm: 0,
    trim_bottom_mm: 0,
    trim_left_mm: 0,
    rotatable: true,
    waste_multi: 1.0,
    machine_code: ''
  })

  // Fetch brands data
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch('/api/brands/optimized')
        const data = await response.json()
        
        if (response.ok) {
          setBrands(data)
        } else {
          console.error('Failed to fetch brands:', data.error)
        }
      } catch (err) {
        console.error('Error fetching brands:', err)
      }
    }

    fetchBrands()
  }, [])

  // Fetch material data
  useEffect(() => {
    const fetchMaterial = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/materials/${materialId}`)
        if (response.ok) {
          const data = await response.json()
          setMaterial(data)
          setFormData({
            name: data.name || '',
            length_mm: data.length_mm || 0,
            width_mm: data.width_mm || 0,
            thickness_mm: data.thickness_mm || 0,
            grain_direction: data.grain_direction || false,
            on_stock: data.on_stock !== undefined ? data.on_stock : true,
            image_url: data.image_url || '',
            brand_id: data.brand_id || '',
            kerf_mm: data.kerf_mm || 3,
            trim_top_mm: data.trim_top_mm || 0,
            trim_right_mm: data.trim_right_mm || 0,
            trim_bottom_mm: data.trim_bottom_mm || 0,
            trim_left_mm: data.trim_left_mm || 0,
            rotatable: data.rotatable !== undefined ? data.rotatable : true,
            waste_multi: data.waste_multi || 1.0,
            machine_code: data.machine_code || ''
          })
        } else {
          setError('Anyag betöltése sikertelen')
        }
      } catch (err) {
        setError('Hiba történt az anyag betöltése során')
        console.error('Error fetching material:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (materialId) {
      fetchMaterial()
    }
  }, [materialId])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Anyag sikeresen frissítve!')
        router.push('/materials')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a mentés során')
      }
    } catch (err) {
      toast.error('Hiba történt a mentés során')
      console.error('Error saving material:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/materials')
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Nincs jogosultsága az oldal megtekintéséhez.</Alert>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={handleCancel} sx={{ mt: 2 }}>
          Vissza az anyagokhoz
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/home')}
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Főoldal
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/materials')}
          sx={{ textDecoration: 'none' }}
        >
          Anyagok
        </Link>
        <Typography color="text.primary">
          {material?.name || 'Anyag szerkesztése'}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          Vissza
        </Button>
        <Typography variant="h4" component="h1">
          Anyag szerkesztése: {material?.name || 'Ismeretlen'}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Alapadatok" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Márka</InputLabel>
                    <Select
                      value={formData.brand_id}
                      label="Márka"
                      onChange={(e) => handleInputChange('brand_id', e.target.value)}
                    >
                      {brands.map((brand) => (
                        <MenuItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Anyag neve"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Hossz (mm)"
                    type="number"
                    value={formData.length_mm}
                    onChange={(e) => handleInputChange('length_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Szélesség (mm)"
                    type="number"
                    value={formData.width_mm}
                    onChange={(e) => handleInputChange('width_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Vastagság (mm)"
                    type="number"
                    value={formData.thickness_mm}
                    onChange={(e) => handleInputChange('thickness_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Image Upload */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Képfeltöltés" />
            <CardContent>
              <ImageUpload
                currentImageUrl={formData.image_url || undefined}
                onImageChange={(url) => handleInputChange('image_url', url || '')}
                materialId={materialId}
                disabled={isSaving}
              />
            </CardContent>
          </Card>
        </Grid>


        {/* Optimization Settings */}
        <Grid item xs={12}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ mt: 3, mb: 2 }}>
            Optimalizálási beállítások
          </Typography>
          <Card>
            <CardHeader title={<Typography variant="h5" component="h3">Szélezési beállítások</Typography>} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Felső trim (mm)"
                    type="number"
                    value={formData.trim_top_mm}
                    onChange={(e) => handleInputChange('trim_top_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Jobb trim (mm)"
                    type="number"
                    value={formData.trim_right_mm}
                    onChange={(e) => handleInputChange('trim_right_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Alsó trim (mm)"
                    type="number"
                    value={formData.trim_bottom_mm}
                    onChange={(e) => handleInputChange('trim_bottom_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Bal trim (mm)"
                    type="number"
                    value={formData.trim_left_mm}
                    onChange={(e) => handleInputChange('trim_left_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
              </Grid>
            </CardContent>
            
            {/* Egyéb beállítások section */}
            <Box sx={{ px: 3, pb: 3 }}>
              <Typography variant="h5" component="h3" gutterBottom sx={{ mt: 3, mb: 2 }}>
                Egyéb beállítások
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Penge vastagság (mm)"
                    type="number"
                    value={formData.kerf_mm}
                    onChange={(e) => handleInputChange('kerf_mm', parseInt(e.target.value) || 3)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Hulladék szorzó"
                    type="number"
                    step="0.1"
                    value={formData.waste_multi}
                    onChange={(e) => handleInputChange('waste_multi', parseFloat(e.target.value) || 1.0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.grain_direction}
                        onChange={(e) => handleInputChange('grain_direction', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Szálirányos"
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.rotatable}
                        onChange={(e) => handleInputChange('rotatable', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Forgatható"
                  />
                </Grid>
              </Grid>
            </Box>
          </Card>
        </Grid>

        {/* Pricing Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Árazási beállítások" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.on_stock}
                        onChange={(e) => handleInputChange('on_stock', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Raktári"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Export Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Export beállítások" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Gép kódja"
                    value={formData.machine_code || ''}
                    onChange={(e) => handleInputChange('machine_code', e.target.value)}
                    placeholder="pl. MDF001"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Gép típusa"
                    value="Korpus"
                    InputProps={{ readOnly: true }}
                    helperText="Jelenleg csak Korpus típus támogatott"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Mégse
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={20} /> : null}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
      </Box>
    </Box>
  )
}
