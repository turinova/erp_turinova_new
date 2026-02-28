'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  Button,
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton
} from '@mui/material'
import {
  AutoAwesome as AutoAwesomeIcon,
  Sync as SyncIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material'

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

interface ProductImageCardProps {
  image: ProductImage
  productId: string
  onGenerateAltText: (imageId: string) => Promise<void>
  onSyncAltText: (imageId: string) => Promise<void>
  onUpdateAltText: (imageId: string, altText: string) => Promise<void>
}

export default function ProductImageCard({
  image,
  productId,
  onGenerateAltText,
  onSyncAltText,
  onUpdateAltText
}: ProductImageCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [altText, setAltText] = useState(image.alt_text || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'success'
      case 'generated':
        return 'info'
      case 'manual':
        return 'warning'
      case 'error':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'synced':
        return 'Szinkronizálva'
      case 'generated':
        return 'Generálva'
      case 'manual':
        return 'Manuális'
      case 'error':
        return 'Hiba'
      default:
        return 'Függőben'
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      await onGenerateAltText(image.id)
      // Refresh will be handled by parent
    } catch (error) {
      console.error('Error generating alt text:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await onSyncAltText(image.id)
      // Refresh will be handled by parent
    } catch (error) {
      console.error('Error syncing alt text:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSave = async () => {
    setIsUpdating(true)
    try {
      await onUpdateAltText(image.id, altText)
      setIsEditing(false)
      // Refresh will be handled by parent
    } catch (error) {
      console.error('Error updating alt text:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancel = () => {
    setAltText(image.alt_text || '')
    setIsEditing(false)
  }

  const imageUrl = image.image_url || (image.image_path ? `https://via.placeholder.com/300x300?text=${encodeURIComponent(image.image_path)}` : null)

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'relative' }}>
        {image.is_main_image && (
          <Chip
            label="Fő"
            size="small"
            color="primary"
            sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1, height: '20px', fontSize: '0.65rem' }}
          />
        )}
        <CardMedia
          component="img"
          height="120"
          image={imageUrl || ''}
          alt={image.alt_text || image.image_path}
          sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" gutterBottom sx={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {image.image_path?.split('/').pop() || image.image_path}
        </Typography>

        <Box sx={{ mt: 1, mb: 1 }}>
          {isEditing ? (
            <Box>
              <TextField
                fullWidth
                multiline
                rows={2}
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Alt szöveg..."
                size="small"
                disabled={isUpdating}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
              />
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={isUpdating ? <CircularProgress size={12} /> : <CheckIcon />}
                  onClick={handleSave}
                  disabled={isUpdating}
                  sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                >
                  Ment
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={handleCancel}
                  disabled={isUpdating}
                  sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                >
                  Mégse
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Chip
                  label={getStatusLabel(image.alt_text_status)}
                  size="small"
                  color={getStatusColor(image.alt_text_status) as any}
                  sx={{ height: '20px', fontSize: '0.65rem' }}
                />
                <Tooltip title="Szerkesztés">
                  <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ width: '24px', height: '24px' }}>
                    <EditIcon sx={{ fontSize: '14px' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography
                variant="body2"
                color={image.alt_text ? 'text.primary' : 'text.secondary'}
                sx={{
                  minHeight: '40px',
                  fontSize: '0.75rem',
                  fontStyle: image.alt_text ? 'normal' : 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {image.alt_text || 'Nincs alt szöveg'}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 'auto' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={isGenerating ? <CircularProgress size={12} /> : <AutoAwesomeIcon />}
            onClick={handleGenerate}
            disabled={isGenerating || isSyncing || isEditing}
            fullWidth
            sx={{ fontSize: '0.7rem', minHeight: '28px' }}
          >
            AI
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={isSyncing ? <CircularProgress size={12} /> : <SyncIcon />}
            onClick={handleSync}
            disabled={isSyncing || isGenerating || isEditing || !image.alt_text || image.alt_text_status === 'synced'}
            fullWidth
            sx={{ fontSize: '0.7rem', minHeight: '28px' }}
          >
            Sync
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}
