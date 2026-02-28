'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import {
  AutoAwesome as AutoAwesomeIcon,
  Sync as SyncIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import ProductImageCard from './ProductImageCard'

interface ProductImage {
  id: string
  image_path: string
  image_url: string | null
  is_main_image: boolean
  sort_order: number
  alt_text: string | null
  alt_text_status: 'pending' | 'generated' | 'manual' | 'synced' | 'error'
  alt_text_generated_at: string | null
  alt_text_synced_at: string | null
}

interface ProductImagesTabProps {
  productId: string
  hideBulkActions?: boolean // New prop to hide bulk action buttons
}

export default function ProductImagesTab({ productId, hideBulkActions = false }: ProductImagesTabProps) {
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [generateAllDialogOpen, setGenerateAllDialogOpen] = useState(false)
  const [syncAllDialogOpen, setSyncAllDialogOpen] = useState(false)

  const fetchImages = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/images`)
      const data = await response.json()

      if (data.success) {
        setImages(data.images || [])
      } else {
        toast.error('Hiba a képek betöltésekor')
      }
    } catch (error) {
      console.error('Error fetching images:', error)
      toast.error('Hiba a képek betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [productId])

  const handleGenerateAltText = async (imageId: string) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/images/${imageId}/generate-alt-text`,
        { method: 'POST' }
      )
      const data = await response.json()

      if (data.success) {
        toast.success('Alt szöveg sikeresen generálva')
        await fetchImages()
      } else {
        toast.error(data.error || 'Hiba az alt szöveg generálásakor')
      }
    } catch (error) {
      console.error('Error generating alt text:', error)
      toast.error('Hiba az alt szöveg generálásakor')
    }
  }

  const handleSyncAltText = async (imageId: string) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/images/${imageId}/sync-alt-text`,
        { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Sync alt text error response:', response.status, errorText)
        let errorMessage = 'Hiba az alt szöveg szinkronizálásakor'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorText}`
        }
        toast.error(errorMessage)
        return
      }

      const data = await response.json()

      if (data.success) {
        toast.success('Alt szöveg sikeresen szinkronizálva')
        await fetchImages()
      } else {
        toast.error(data.error || 'Hiba az alt szöveg szinkronizálásakor')
      }
    } catch (error) {
      console.error('Error syncing alt text:', error)
      toast.error(`Hiba az alt szöveg szinkronizálásakor: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
    }
  }

  const handleUpdateAltText = async (imageId: string, altText: string) => {
    try {
      // Update in database via API
      const response = await fetch(`/api/products/${productId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, altText })
      })

      if (response.ok) {
        toast.success('Alt szöveg frissítve')
        await fetchImages()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Hiba az alt szöveg frissítésekor')
      }
    } catch (error) {
      console.error('Error updating alt text:', error)
      toast.error('Hiba az alt szöveg frissítésekor')
    }
  }

  const handleGenerateAll = async () => {
    setGenerateAllDialogOpen(false)
    setGeneratingAll(true)
    try {
      const imagesToGenerate = images.filter(
        img => !img.alt_text || img.alt_text_status === 'pending'
      )

      for (const image of imagesToGenerate) {
        await handleGenerateAltText(image.id)
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      toast.success(`${imagesToGenerate.length} kép alt szövege generálva`)
      await fetchImages()
    } catch (error) {
      console.error('Error generating all alt text:', error)
      toast.error('Hiba az alt szövegek generálásakor')
    } finally {
      setGeneratingAll(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncAllDialogOpen(false)
    setSyncingAll(true)
    try {
      const imagesToSync = images.filter(
        img => img.alt_text && img.alt_text_status !== 'synced'
      )

      for (const image of imagesToSync) {
        await handleSyncAltText(image.id)
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      toast.success(`${imagesToSync.length} kép alt szövege szinkronizálva`)
      await fetchImages()
    } catch (error) {
      console.error('Error syncing all alt text:', error)
      toast.error('Hiba az alt szövegek szinkronizálásakor')
    } finally {
      setSyncingAll(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (images.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Nincsenek képek ehhez a termékhez. A képek automatikusan szinkronizálódnak a termék szinkronizálásakor.
        </Alert>
      </Box>
    )
  }

  const pendingCount = images.filter(img => !img.alt_text || img.alt_text_status === 'pending').length
  const unsyncedCount = images.filter(img => img.alt_text && img.alt_text_status !== 'synced').length

  return (
    <Box>
      {!hideBulkActions && (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Termékképek ({images.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={generatingAll ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            onClick={() => setGenerateAllDialogOpen(true)}
            disabled={generatingAll || syncingAll || pendingCount === 0}
          >
            Összes generálása ({pendingCount})
          </Button>
          <Button
            variant="outlined"
            color="success"
            startIcon={syncingAll ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={() => setSyncAllDialogOpen(true)}
            disabled={generatingAll || syncingAll || unsyncedCount === 0}
          >
            Összes szinkronizálása ({unsyncedCount})
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchImages}
            disabled={generatingAll || syncingAll}
          >
            Frissítés
          </Button>
        </Box>
      </Box>
      )}

      <Grid container spacing={1.5}>
        {images.map((image) => (
          <Grid item xs={6} sm={4} md={3} key={image.id}>
            <ProductImageCard
              image={image}
              productId={productId}
              onGenerateAltText={handleGenerateAltText}
              onSyncAltText={handleSyncAltText}
              onUpdateAltText={handleUpdateAltText}
            />
          </Grid>
        ))}
      </Grid>

      {/* Generate All Dialog */}
      <Dialog open={generateAllDialogOpen} onClose={() => setGenerateAllDialogOpen(false)}>
        <DialogTitle>Összes alt szöveg generálása</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Generálja az alt szöveget minden képhez, amelyhez még nincs? ({pendingCount} kép)
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateAllDialogOpen(false)}>Mégse</Button>
          <Button onClick={handleGenerateAll} variant="contained" autoFocus>
            Generálás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync All Dialog */}
      <Dialog open={syncAllDialogOpen} onClose={() => setSyncAllDialogOpen(false)}>
        <DialogTitle>Összes alt szöveg szinkronizálása</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Szinkronizálja az alt szövegeket a ShopRenter-be? ({unsyncedCount} kép)
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncAllDialogOpen(false)}>Mégse</Button>
          <Button onClick={handleSyncAll} variant="contained" color="success" autoFocus>
            Szinkronizálás
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
