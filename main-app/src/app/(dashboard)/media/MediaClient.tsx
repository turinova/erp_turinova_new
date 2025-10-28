'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Checkbox, 
  TextField, 
  InputAdornment, 
  Breadcrumbs, 
  Link, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  CircularProgress,
  LinearProgress,
  IconButton
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon, 
  Image as ImageIcon, 
  Delete as DeleteIcon, 
  CloudUpload as UploadIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface MediaFile {
  id: string
  name: string  // Original filename
  storedName: string  // Stored filename
  path: string
  fullUrl: string
  size: number
  created_at: string
  updated_at: string
}

interface MediaClientProps {
  initialMediaFiles: MediaFile[]
}

export default function MediaClient({ initialMediaFiles }: MediaClientProps) {
  const router = useRouter()
  
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(initialMediaFiles)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false) // Start with false since we have SSR data
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Image modal
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null)
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Ensure client-side only rendering for buttons to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchMediaFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/media')
      
      if (!response.ok) {
        throw new Error('Failed to fetch media files')
      }
      
      const data = await response.json()
      setMediaFiles(data)
    } catch (error) {
      console.error('Error fetching media files:', error)
      toast.error('Hiba történt a képek betöltése során!')
    } finally {
      setLoading(false)
    }
  }

  // Filter media files based on search term
  const filteredFiles = useMemo(() => {
    if (!mediaFiles || !Array.isArray(mediaFiles)) return []
    if (!searchTerm) return mediaFiles
    
    const term = searchTerm.toLowerCase()
    return mediaFiles.filter(file => 
      file.name.toLowerCase().includes(term) ||
      file.path.toLowerCase().includes(term)
    )
  }, [mediaFiles, searchTerm])

  // Handle select all
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedFiles(filteredFiles.map(file => file.id))  // Changed from file.path to file.id
    } else {
      setSelectedFiles([])
    }
  }

  // Handle individual select
  const handleSelectFile = (fileId: string) => {  // Changed from filePath to fileId
    setSelectedFiles(prev => 
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }

  // Handle delete click
  const handleDeleteClick = () => {
    if (selectedFiles.length === 0) return
    setDeleteDialogOpen(true)
  }

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true)
      
      const response = await fetch('/api/media', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds: selectedFiles }),  // Changed from filePaths to fileIds
      })
      
      if (response.ok) {
        toast.success(`${selectedFiles.length} fájl sikeresen törölve!`)
        setSelectedFiles([])
        setDeleteDialogOpen(false)
        await fetchMediaFiles() // Refresh the list
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a törlés során')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Hiba történt a törlés során!')
    } finally {
      setIsDeleting(false)
    }
  }
  
  // Handle filename copy
  const handleCopyFilename = (filename: string) => {
    navigator.clipboard.writeText(filename)
    toast.success('Fájlnév vágólapra másolva!')
  }

  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  // Handle upload
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      setIsUploading(true)
      setUploadProgress(0)

      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })

      // Simulate progress (real progress would require chunked upload)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.ok) {
        const result = await response.json()
        
        if (result.failed > 0) {
          toast.error(`${result.uploaded} feltöltve, ${result.failed} sikertelen`)
          console.error('Upload errors:', result.errors)
        } else {
          toast.success(`${result.uploaded} fájl sikeresen feltöltve!`)
        }
        
        await fetchMediaFiles() // Refresh the list
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a feltöltés során')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Hiba történt a feltöltés során!')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      // Reset file input
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    const kb = bytes / 1024
    return `${kb.toFixed(2)} KB`
  }

  // Handle image click
  const handleImageClick = (file: MediaFile) => {
    setSelectedImage(file)
    setImageModalOpen(true)
  }

  const isAllSelected = selectedFiles.length === filteredFiles.length && filteredFiles.length > 0
  const isIndeterminate = selectedFiles.length > 0 && selectedFiles.length < filteredFiles.length

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link 
          underline="hover" 
          sx={{ cursor: 'pointer' }} 
          color="inherit" 
          onClick={() => router.push('/home')}
        >
          Kezdőlap
        </Link>
        <Typography color="text.primary">
          Törzsadatok
        </Typography>
        <Typography color="text.primary">
          Media
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Media
      </Typography>

      {mounted && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          {/* Left side: Delete button */}
          <Box>
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={handleDeleteClick}
              disabled={selectedFiles.length === 0}
            >
              Törlés ({selectedFiles.length})
            </Button>
          </Box>

          {/* Right side: Upload button */}
          <Box>
            <Button
              variant="contained"
              component="label"
              startIcon={isUploading ? <CircularProgress size={20} /> : <UploadIcon />}
              disabled={isUploading}
            >
              Képek feltöltése
              <input
                type="file"
                hidden
                multiple
                accept=".webp,.png,image/webp,image/png"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </Button>
          </Box>
        </Box>
      )}

      {/* Upload progress */}
      {isUploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Feltöltés folyamatban... {uploadProgress}%
          </Typography>
        </Box>
      )}

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Keresés fájlnév szerint..."
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

      {/* Media files table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={filteredFiles.length === 0}
                />
              </TableCell>
              <TableCell>Kép</TableCell>
              <TableCell>Fájlnév</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Méret</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {searchTerm ? 'Nincs találat' : 'Nincsenek feltöltött képek'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map((file) => (
                <TableRow key={file.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedFiles.includes(file.id)}
                      onChange={() => handleSelectFile(file.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box
                      component="img"
                      src={file.fullUrl}
                      alt={file.name}
                      sx={{
                        width: 50,
                        height: 50,
                        objectFit: 'cover',
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          opacity: 0.8
                        }
                      }}
                      onClick={() => handleImageClick(file)}
                    />
                  </TableCell>
                  <TableCell>{file.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: 'monospace', 
                          fontSize: '0.85rem',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {file.fullUrl}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => handleCopyFilename(file.name)}
                        sx={{ ml: 'auto' }}
                        title="Fájlnév másolása"
                      >
                        <i className="ri-file-copy-line" style={{ fontSize: '1.1rem' }} />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Összesen: {filteredFiles.length} fájl
        {searchTerm && ` (szűrve ${mediaFiles.length} közül)`}
      </Typography>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Képek törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a kiválasztott {selectedFiles.length} képet? Ez a művelet nem vonható vissza.
          </Typography>
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

      {/* Full Size Image Modal */}
      <Dialog 
        open={imageModalOpen} 
        onClose={() => setImageModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {selectedImage?.name}
          <IconButton onClick={() => setImageModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage.fullUrl}
              alt={selectedImage.name}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          )}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Fájlnév:</strong> {selectedImage?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>URL:</strong> {selectedImage?.path}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Méret:</strong> {selectedImage && formatFileSize(selectedImage.size)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageModalOpen(false)}>Bezár</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

