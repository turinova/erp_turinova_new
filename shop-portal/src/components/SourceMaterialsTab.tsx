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
  LinearProgress
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
  HourglassEmpty
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Forrásanyagok</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddClick}
        >
          Forrásanyag hozzáadása
        </Button>
      </Box>

      {sources.length === 0 ? (
        <Alert severity="info">
          Még nincsenek forrásanyagok. Adjon hozzá PDF-t, URL-t vagy szöveget az AI generáláshoz.
        </Alert>
      ) : (
        <List>
          {sources.map((source) => (
            <Paper key={source.id} sx={{ mb: 2 }}>
              <ListItem>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  {source.source_type === 'pdf' && <DescriptionIcon />}
                  {source.source_type === 'url' && <LinkIcon />}
                  {source.source_type === 'text' && <TextIcon />}
                  
                  <Box sx={{ flex: 1 }}>
                    <ListItemText
                      primary={source.title || `Forrásanyag (${source.source_type})`}
                      secondaryTypographyProps={{ component: 'div' }}
                      secondary={
                        <Box component="div">
                          <Typography variant="caption" display="block">
                            Típus: {source.source_type === 'pdf' ? 'PDF' : source.source_type === 'url' ? 'URL' : 'Szöveg'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                            {getStatusIcon(source.processing_status)}
                            <Typography variant="caption">
                              {getStatusLabel(source.processing_status)}
                            </Typography>
                            {source.processing_status === 'processed' && source.extracted_text && (
                              <Typography variant="caption" color="text.secondary">
                                • {source.extracted_text.split(/\s+/).length} szó
                              </Typography>
                            )}
                          </Box>
                          {source.processing_error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              {source.processing_error}
                            </Alert>
                          )}
                          {source.processing_status === 'pending' && source.source_type !== 'text' && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => processSource(source.id)}
                              disabled={processingId === source.id}
                              sx={{ mt: 1 }}
                            >
                              {processingId === source.id ? 'Feldolgozás...' : 'Feldolgozás indítása'}
                            </Button>
                          )}
                        </Box>
                      }
                    />
                  </Box>
                  
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleDelete(source.id)}
                      disabled={deletingId === source.id}
                    >
                      {deletingId === source.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                    </IconButton>
                  </ListItemSecondaryAction>
                </Box>
              </ListItem>
            </Paper>
          ))}
        </List>
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
