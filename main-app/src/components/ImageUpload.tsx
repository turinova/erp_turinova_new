'use client'

import React, { useState, useRef, useCallback } from 'react'

import { Box, Button, Typography, LinearProgress, Alert, IconButton } from '@mui/material'
import { CloudUpload, Delete, Image as ImageIcon } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface ImageUploadProps {
  currentImageUrl?: string
  onImageChange: (url: string | null) => void
  materialId: string
  disabled?: boolean
  bucketName?: string
  pathPrefix?: string
  altText?: string
  registerInMediaFiles?: boolean // If true, register uploaded file in media_files table
}

export default function ImageUpload({ 
  currentImageUrl, 
  onImageChange, 
  materialId, 
  disabled = false,
  bucketName = 'materials',
  pathPrefix = 'materials',
  altText = 'Material preview',
  registerInMediaFiles = false
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Using the shared supabase instance

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (!allowedTypes.includes(file.type)) {
      setError('Csak JPEG, PNG, WebP vagy GIF formátumú képek engedélyezettek.')
      
return
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      setError('A kép mérete nem lehet nagyobb 2MB-nál.')
      
return
    }

    setError(null)
    setUploading(true)
    setUploadProgress(0)

    try {
      // Check authentication status
      const { data: { user } } = await supabase.auth.getUser()

      console.log('Current user:', user?.id)
      
      if (!user) {
        throw new Error('Nem vagy bejelentkezve. Kérjük, jelentkezz be újra.')
      }

      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${materialId}-${Date.now()}.${fileExt}`
      const filePath = `${pathPrefix}/${fileName}`

      console.log('Uploading file:', filePath)

      // Upload the file
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      setUploadProgress(100)
      
      // Register in media_files table if requested (for accessories, etc.)
      if (registerInMediaFiles) {
        try {
          console.log('[ImageUpload] Registering file in media_files:', {
            original_filename: file.name,
            stored_filename: fileName,
            storage_path: filePath,
            full_url: publicUrl,
            size: file.size,
            mimetype: file.type,
            bucket: bucketName
          })
          
          const registerResponse = await fetch('/api/media/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              original_filename: file.name,
              stored_filename: fileName,
              storage_path: filePath,
              full_url: publicUrl,
              size: file.size,
              mimetype: file.type,
              bucket: bucketName
            })
          })

          const registerData = await registerResponse.json()
          
          if (!registerResponse.ok) {
            console.error('[ImageUpload] Failed to register file in media_files:', registerData)
            // Don't throw error - upload succeeded, registration is optional
          } else {
            console.log('[ImageUpload] File registered in media_files:', {
              original: file.name,
              registered: registerData.mediaFile?.original_filename,
              url: registerData.mediaFile?.full_url,
              alreadyExists: registerData.alreadyExists
            })
          }
        } catch (registerError) {
          console.error('[ImageUpload] Error registering file in media_files:', registerError)
          // Don't throw error - upload succeeded, registration is optional
        }
      }
      
      onImageChange(publicUrl)
      
      // Clean up old image if it exists
      if (currentImageUrl && currentImageUrl !== publicUrl) {
        const oldPath = currentImageUrl.split('/').pop()

        if (oldPath) {
          await supabase.storage
            .from(bucketName)
            .remove([`${pathPrefix}/${oldPath}`])
        }
      }

    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Hiba történt a kép feltöltése során.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [materialId, currentImageUrl, onImageChange, bucketName, pathPrefix, registerInMediaFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer.files)

    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect, disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()

    if (!disabled) {
      setDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files

    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemoveImage = async () => {
    if (currentImageUrl) {
      try {
        const fileName = currentImageUrl.split('/').pop()

        if (fileName) {
          await supabase.storage
            .from(bucketName)
            .remove([`${pathPrefix}/${fileName}`])
        }

        onImageChange(null)
      } catch (err) {
        console.error('Error removing image:', err)
        setError('Hiba történt a kép törlése során.')
      }
    }
  }

  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {currentImageUrl ? (
        <Box>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: 300,
              height: 200,
              border: '2px dashed #ccc',
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2
            }}
          >
            <img
              src={currentImageUrl}
              alt={altText}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            {!disabled && (
              <IconButton
                onClick={handleRemoveImage}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)'
                  }
                }}
                size="small"
              >
                <Delete />
              </IconButton>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Kép feltöltve
          </Typography>
        </Box>
      ) : (
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            border: `2px dashed ${dragOver ? '#1976d2' : '#ccc'}`,
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: disabled ? 'default' : 'pointer',
            backgroundColor: dragOver ? '#f5f5f5' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': disabled ? {} : {
              borderColor: '#1976d2',
              backgroundColor: '#f5f5f5'
            }
          }}
          onClick={openFileDialog}
        >
          <CloudUpload sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            Kép feltöltése
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Húzza ide a képet vagy kattintson a tallózáshoz
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Támogatott formátumok: JPEG, PNG, WebP, GIF (max. 2MB)
          </Typography>
        </Box>
      )}

      {uploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Feltöltés folyamatban...
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  )
}
