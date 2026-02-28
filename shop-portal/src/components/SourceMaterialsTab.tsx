'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Alert,
  LinearProgress,
  Grid
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Link as LinkIcon,
  TextFields as TextIcon,
  Description as DescriptionIcon,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Star as StarIcon,
  Label as LabelIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface SourceMaterial {
  id: string
  source_type: 'pdf' | 'url' | 'text'
  title: string | null
  file_url: string | null
  external_url: string | null
  text_content: string | null
  file_name: string | null
  processing_status: 'pending' | 'processing' | 'processed' | 'error'
  extracted_text: string | null
  processing_error: string | null
  priority: number
  weight: number
  created_at: string
  processed_at: string | null
}

interface SourceMaterialsTabProps {
  productId: string
}

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index } = props
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export default function SourceMaterialsTab({ productId }: SourceMaterialsTabProps) {
  const [sources, setSources] = useState<SourceMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addTabValue, setAddTabValue] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Form states
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const [titleValue, setTitleValue] = useState('')
  const [priorityValue, setPriorityValue] = useState(5)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchSources()
  }, [productId])

  const fetchSources = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/sources`)
      const result = await response.json()

      if (result.success) {
        setSources(result.sources || [])
      } else {
        toast.error('Hiba a forrásanyagok betöltésekor')
      }
    } catch (error) {
      console.error('Error fetching sources:', error)
      toast.error('Hiba a forrásanyagok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleAddClick = () => {
    setAddDialogOpen(true)
    setAddTabValue(0)
    setPdfFile(null)
    setUrlValue('')
    setTextValue('')
    setTitleValue('')
    setPriorityValue(5)
  }

  const handleAddClose = () => {
    setAddDialogOpen(false)
    setPdfFile(null)
    setUrlValue('')
    setTextValue('')
    setTitleValue('')
  }

  const handleAddSubmit = async () => {
    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('source_type', addTabValue === 0 ? 'pdf' : addTabValue === 1 ? 'url' : 'text')
      formData.append('title', titleValue)
      formData.append('priority', priorityValue.toString())

      if (addTabValue === 0) {
        if (!pdfFile) {
          toast.error('Válasszon ki egy PDF fájlt')
          return
        }
        formData.append('file', pdfFile)
      } else if (addTabValue === 1) {
        if (!urlValue.trim()) {
          toast.error('Adja meg az URL-t')
          return
        }
        formData.append('url', urlValue)
      } else {
        if (!textValue.trim()) {
          toast.error('Adja meg a szöveget')
          return
        }
        formData.append('text', textValue)
      }

      const response = await fetch(`/api/products/${productId}/sources`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Forrásanyag sikeresen hozzáadva')
        handleAddClose()
        fetchSources()

        // If text, process immediately
        if (addTabValue === 2 && result.sourceMaterial) {
          processSource(result.sourceMaterial.id)
        }
      } else {
        toast.error(`Hiba: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error adding source:', error)
      toast.error('Hiba a forrásanyag hozzáadásakor')
    } finally {
      setUploading(false)
    }
  }

  const processSource = async (sourceId: string) => {
    try {
      setProcessingId(sourceId)
      const response = await fetch(`/api/products/${productId}/sources/${sourceId}/process`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Forrásanyag feldolgozva: ${result.chunksCreated} darab részlet létrehozva`)
        fetchSources()
      } else {
        toast.error(`Feldolgozási hiba: ${result.error || 'Ismeretlen hiba'}`)
        fetchSources() // Refresh to show error status
      }
    } catch (error) {
      console.error('Error processing source:', error)
      toast.error('Hiba a forrásanyag feldolgozásakor')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (sourceId: string) => {
    if (!confirm('Biztosan törölni szeretné ezt a forrásanyagot?')) {
      return
    }

    try {
      setDeletingId(sourceId)
      const response = await fetch(`/api/products/${productId}/sources/${sourceId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Forrásanyag sikeresen törölve')
        fetchSources()
      } else {
        toast.error(`Törlési hiba: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error deleting source:', error)
      toast.error('Hiba a forrásanyag törlésekor')
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle color="success" fontSize="small" />
      case 'processing':
        return <CircularProgress size={16} />
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />
      default:
        return <HourglassEmpty color="disabled" fontSize="small" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processed':
        return 'Feldolgozva'
      case 'processing':
        return 'Feldolgozás alatt'
      case 'error':
        return 'Hiba'
      default:
        return 'Függőben'
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Sort sources by priority (descending) and then by created_at
  const sortedSources = [...sources].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pdf':
        return '#f44336' // Red
      case 'url':
        return '#2196f3' // Blue
      case 'text':
        return '#4caf50' // Green
      default:
        return '#757575' // Grey
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <DescriptionIcon />
      case 'url':
        return <LinkIcon />
      case 'text':
        return <TextIcon />
      default:
        return <DescriptionIcon />
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddClick}
        >
          Forrásanyag hozzáadása
        </Button>
      </Box>

      {sortedSources.length === 0 ? (
        <Alert severity="info">
          Még nincsenek forrásanyagok. Adjon hozzá PDF-t, URL-t vagy szöveget az AI generáláshoz.
        </Alert>
      ) : (
        <Box>
          {/* Header row */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 1.5,
              mb: 1,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={1}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Típus</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Cím / Leírás</Typography>
              </Grid>
              <Grid item xs={1.5}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Prioritás</Typography>
              </Grid>
              <Grid item xs={2}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Státusz</Typography>
              </Grid>
              <Grid item xs={2}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Információ</Typography>
              </Grid>
              <Grid item xs={1.5}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Műveletek</Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Data rows */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sortedSources.map((source) => {
              // Priority-based background color (subtle)
              const getPriorityBgColor = (priority: number) => {
                if (priority >= 8) return 'rgba(255, 152, 0, 0.05)' // Orange
                if (priority >= 5) return 'rgba(76, 175, 80, 0.05)' // Green
                return 'rgba(158, 158, 158, 0.03)' // Grey
              }

              return (
                <Paper 
                  key={source.id} 
                  elevation={0}
                  sx={{ 
                    p: 1.5,
                    bgcolor: getPriorityBgColor(source.priority),
                    border: '1px solid',
                    borderLeft: `4px solid ${getTypeColor(source.source_type)}`,
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': {
                      borderColor: getTypeColor(source.source_type),
                      boxShadow: 1,
                      bgcolor: getPriorityBgColor(source.priority)
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Grid container spacing={2} alignItems="center">
                    {/* Type Icon */}
                    <Grid item xs={1}>
                      <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        mx: 'auto',
                        color: getTypeColor(source.source_type)
                      }}>
                        {getTypeIcon(source.source_type)}
                      </Box>
                    </Grid>

                    {/* Title */}
                    <Grid item xs={4}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {source.title || `Forrásanyag (${source.source_type})`}
                      </Typography>
                      {source.processing_error && (
                        <Typography variant="caption" color="error" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                          {source.processing_error}
                          </Typography>
                      )}
                    </Grid>

                    {/* Priority */}
                    <Grid item xs={1.5}>
                      <Chip
                        icon={<StarIcon />}
                        label={source.priority}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          height: '24px', 
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          borderColor: source.priority >= 8 ? '#ff9800' : source.priority >= 5 ? '#4caf50' : '#9e9e9e',
                          color: source.priority >= 8 ? '#ff9800' : source.priority >= 5 ? '#4caf50' : '#9e9e9e'
                        }}
                      />
                    </Grid>

                    {/* Status */}
                    <Grid item xs={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getStatusIcon(source.processing_status)}
                        <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                              {getStatusLabel(source.processing_status)}
                            </Typography>
                      </Box>
                    </Grid>

                    {/* Info */}
                    <Grid item xs={2}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {source.source_type === 'pdf' ? 'PDF' : source.source_type === 'url' ? 'URL' : 'Szöveg'}
                        </Typography>
                            {source.processing_status === 'processed' && source.extracted_text && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {source.extracted_text.split(/\s+/).length} szó
                              </Typography>
                            )}
                          </Box>
                    </Grid>

                    {/* Actions */}
                    <Grid item xs={1.5}>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end' }}>
                          {source.processing_status === 'pending' && source.source_type !== 'text' && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => processSource(source.id)}
                              disabled={processingId === source.id}
                            sx={{ fontSize: '0.7rem', minHeight: '28px', px: 1 }}
                            >
                            {processingId === source.id ? '...' : 'Feldolgozás'}
                            </Button>
                          )}
                    <IconButton
                          size="small"
                      onClick={() => handleDelete(source.id)}
                      disabled={deletingId === source.id}
                          sx={{ 
                            color: 'text.secondary',
                            '&:hover': { bgcolor: 'error.light', color: 'error.main' }
                          }}
                    >
                          {deletingId === source.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                    </IconButton>
                </Box>
                    </Grid>
                  </Grid>
            </Paper>
              )
            })}
          </Box>
        </Box>
      )}

      {/* Add Source Dialog */}
      <Dialog open={addDialogOpen} onClose={handleAddClose} maxWidth="md" fullWidth>
        <DialogTitle>Forrásanyag hozzáadása</DialogTitle>
        <DialogContent>
          <Tabs value={addTabValue} onChange={(_, v) => setAddTabValue(v)} sx={{ mb: 2 }}>
            <Tab icon={<UploadIcon />} label="PDF feltöltés" />
            <Tab icon={<LinkIcon />} label="URL" />
            <Tab icon={<TextIcon />} label="Szöveg" />
          </Tabs>

          <TabPanel value={addTabValue} index={0}>
            <TextField
              fullWidth
              type="file"
              inputProps={{ accept: 'application/pdf' }}
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                setPdfFile(file || null)
              }}
              sx={{ mb: 2 }}
            />
            {pdfFile && (
              <Alert severity="info">
                Kiválasztott fájl: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={addTabValue} index={1}>
            <TextField
              fullWidth
              label="URL"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://example.com/product-info"
              sx={{ mb: 2 }}
            />
          </TabPanel>

          <TabPanel value={addTabValue} index={2}>
            <TextField
              fullWidth
              multiline
              rows={10}
              label="Szöveg"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Illessze be a termékhez kapcsolódó szöveget..."
              sx={{ mb: 2 }}
            />
          </TabPanel>

          <TextField
            fullWidth
            label="Cím / Leírás"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            placeholder="Opcionális: adjon meg egy címet"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            type="number"
            label="Prioritás"
            value={priorityValue}
            onChange={(e) => setPriorityValue(parseInt(e.target.value) || 5)}
            inputProps={{ min: 1, max: 10 }}
            helperText="1-10, ahol 10 a legfontosabb"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddClose} disabled={uploading}>
            Mégse
          </Button>
          <Button
            onClick={handleAddSubmit}
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {uploading ? 'Hozzáadás...' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
