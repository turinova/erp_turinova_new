'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Grid,
  TextField,
  InputAdornment,
  Typography,
  CircularProgress
} from '@mui/material'
import { Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface MediaFile {
  id: string
  name: string  // Original filename
  fullUrl: string
  size: number
}

interface MediaLibraryModalProps {
  open: boolean
  onClose: () => void
  onSelect: (imageUrl: string, filename: string) => void
  currentImageUrl?: string | null
}

export default function MediaLibraryModal({ 
  open, 
  onClose, 
  onSelect, 
  currentImageUrl 
}: MediaLibraryModalProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null)

  // Fetch media files when modal opens
  useEffect(() => {
    if (open) {
      fetchMediaFiles()
    }
  }, [open])

  const fetchMediaFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/media')
      
      if (response.ok) {
        const data = await response.json()
        setMediaFiles(data)
      } else {
        toast.error('Nem sikerült betölteni a képeket')
      }
    } catch (error) {
      console.error('Error fetching media files:', error)
      toast.error('Hiba történt a képek betöltése során')
    } finally {
      setLoading(false)
    }
  }

  // Filter files based on search
  const filteredFiles = mediaFiles.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle image selection
  const handleImageClick = (file: MediaFile) => {
    setSelectedImage(file)
  }

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedImage) {
      onSelect(selectedImage.fullUrl, selectedImage.name)
      onClose()
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Média könyvtár - Kép kiválasztása</DialogTitle>
      <DialogContent>
        {/* Search */}
        <TextField
          fullWidth
          placeholder="Keresés fájlnév szerint..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 3, mt: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredFiles.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {searchTerm ? 'Nincs találat' : 'Nincs feltöltött kép'}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filteredFiles.map((file) => (
              <Grid item xs={6} sm={4} md={3} key={file.id}>
                <Box
                  onClick={() => handleImageClick(file)}
                  sx={{
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: selectedImage?.id === file.id ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    p: 1,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2
                    },
                    bgcolor: selectedImage?.id === file.id ? 'action.selected' : 'background.paper'
                  }}
                >
                  <Box
                    component="img"
                    src={file.fullUrl}
                    alt={file.name}
                    sx={{
                      width: '100%',
                      height: 150,
                      objectFit: 'cover',
                      borderRadius: 1,
                      mb: 1
                    }}
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(file.size)}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Mégse
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          disabled={!selectedImage}
        >
          Kiválasztás
        </Button>
      </DialogActions>
    </Dialog>
  )
}

