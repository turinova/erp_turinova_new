'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Tabs,
  Tab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import { Save as SaveIcon, Sync as SyncIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import type { ProductWithDescriptions } from '@/lib/products-server'
import HtmlEditor from '@/components/HtmlEditor'
import SourceMaterialsTab from '@/components/SourceMaterialsTab'

interface ProductEditFormProps {
  product: ProductWithDescriptions
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`product-tabpanel-${index}`}
      aria-labelledby={`product-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ProductEditForm({ product }: ProductEditFormProps) {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  
  // Helper function to decode HTML entities
  const decodeHtmlEntities = (html: string | null | undefined): string => {
    if (!html) return ''
    // Create a temporary element to decode HTML entities
    const textarea = document.createElement('textarea')
    textarea.innerHTML = html
    return textarea.value
  }

  // Find Hungarian description or create default
  const huDescription = product.descriptions.find(d => d.language_code === 'hu') || {
    id: '',
    product_id: product.id,
    language_code: 'hu',
    name: product.name || '',
    meta_title: '',
    meta_keywords: '',
    meta_description: '',
    short_description: '',
    description: '',
    shoprenter_id: null,
    created_at: '',
    updated_at: ''
  }

  const [formData, setFormData] = useState({
    name: huDescription.name,
    meta_title: huDescription.meta_title || '',
    meta_keywords: huDescription.meta_keywords || '',
    meta_description: huDescription.meta_description || '',
    // Decode HTML entities for editor fields
    short_description: decodeHtmlEntities(huDescription.short_description),
    description: decodeHtmlEntities(huDescription.description)
  })

  const [isPending, startTransition] = useTransition()

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  // Helper function to encode HTML entities (for saving back to database)
  const encodeHtmlEntities = (html: string): string => {
    if (!html) return ''
    // Encode HTML entities for storage (ShopRenter expects encoded HTML)
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Encode HTML entities before saving (ShopRenter stores HTML as entities)
      const dataToSave = {
        language_code: 'hu',
        name: formData.name,
        meta_title: formData.meta_title,
        meta_keywords: formData.meta_keywords,
        meta_description: formData.meta_description,
        short_description: encodeHtmlEntities(formData.short_description),
        description: encodeHtmlEntities(formData.description)
      }

      const response = await fetch(`/api/products/${product.id}/descriptions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Termék leírás sikeresen mentve!')
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(`Mentés sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Hiba a termék mentésekor')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncClick = () => {
    setSyncConfirmOpen(true)
  }

  const handleSyncConfirm = async () => {
    setSyncConfirmOpen(false)
    try {
      setSyncing(true)

      const response = await fetch(`/api/products/${product.id}/sync`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Termék sikeresen szinkronizálva a webshopba!')
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(`Szinkronizálás sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error syncing product:', error)
      toast.error('Hiba a termék szinkronizálásakor')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncCancel = () => {
    setSyncConfirmOpen(false)
  }

  const handleGenerateDescription = async () => {
    try {
      setGenerating(true)
      setGenerationDialogOpen(false)

      const response = await fetch(`/api/products/${product.id}/generate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          useSourceMaterials: true,
          language: 'hu'
        })
      })

      const result = await response.json()

      if (result.success) {
        // Update the description field with generated content
        setFormData(prev => ({
          ...prev,
          description: result.description
        }))
        toast.success(`Leírás sikeresen generálva! (${result.metrics.wordCount} szó, ${result.metrics.tokensUsed} token)`)
      } else {
        toast.error(`Generálási hiba: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error generating description:', error)
      toast.error('Hiba a leírás generálásakor')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Termék szerkesztése: {product.sku}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSyncClick}
            disabled={syncing}
          >
            Szinkronizálás
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Mentés
          </Button>
        </Box>
      </Box>

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Alapadatok" />
          <Tab label="SEO" />
          <Tab label="Leírás" />
          <Tab label="Forrásanyagok" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Termék neve"
                value={formData.name}
                onChange={handleInputChange('name')}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <HtmlEditor
                value={formData.short_description}
                onChange={(value) => setFormData(prev => ({ ...prev, short_description: value }))}
                label="Rövid leírás"
                placeholder="Írja be a termék rövid leírását..."
                height={300}
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Meta cím"
                value={formData.meta_title}
                onChange={handleInputChange('meta_title')}
                helperText="A keresőmotorokban megjelenő cím"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Meta kulcsszavak"
                value={formData.meta_keywords}
                onChange={handleInputChange('meta_keywords')}
                helperText="Vesszővel elválasztott kulcsszavak"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Meta leírás"
                value={formData.meta_description}
                onChange={handleInputChange('meta_description')}
                multiline
                rows={3}
                helperText="A keresőmotorokban megjelenő leírás"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Részletes leírás</Typography>
                <Button
                  variant="outlined"
                  startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                  onClick={() => setGenerationDialogOpen(true)}
                  disabled={generating}
                >
                  {generating ? 'Generálás...' : 'AI Leírás generálása'}
                </Button>
              </Box>
              <HtmlEditor
                value={formData.description}
                onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                label="Részletes leírás"
                placeholder="Írja be a termék részletes leírását..."
                height={500}
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <SourceMaterialsTab productId={product.id} />
        </TabPanel>
      </Paper>

      {/* Sync Confirmation Dialog */}
      <Dialog
        open={syncConfirmOpen}
        onClose={handleSyncCancel}
        aria-labelledby="sync-dialog-title"
        aria-describedby="sync-dialog-description"
      >
        <DialogTitle id="sync-dialog-title">
          Szinkronizálás megerősítése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="sync-dialog-description" component="div">
            <Typography variant="body1" paragraph>
              Biztosan szeretné szinkronizálni a termék adatait a webshopba? 
              A helyi módosítások felülírják a webshopban lévő adatokat.
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 2 }}>
              <strong>Szinkronizált mezők:</strong>
              <Box component="ul" sx={{ mt: 1, pl: 3 }}>
                <li>Termék neve</li>
                <li>Meta cím, kulcsszavak, leírás</li>
                <li>Rövid leírás</li>
                <li>Részletes leírás</li>
              </Box>
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSyncCancel} disabled={syncing}>
            Mégse
          </Button>
          <Button 
            onClick={handleSyncConfirm} 
            variant="contained" 
            color="primary"
            disabled={syncing}
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            {syncing ? 'Szinkronizálás...' : 'Szinkronizálás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Description Dialog */}
      <Dialog
        open={generationDialogOpen}
        onClose={() => setGenerationDialogOpen(false)}
        aria-labelledby="generate-dialog-title"
        aria-describedby="generate-dialog-description"
      >
        <DialogTitle id="generate-dialog-title">
          AI Leírás generálása
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="generate-dialog-description" component="div">
            <Typography variant="body1" paragraph component="div">
              Az AI a forrásanyagok alapján generál egy SEO-optimalizált, természetes hangvételű termékleírást.
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              A generált leírás felülírja a jelenlegi "Részletes leírás" mezőt. Mentés előtt szerkesztheti.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerationDialogOpen(false)} disabled={generating}>
            Mégse
          </Button>
          <Button
            onClick={handleGenerateDescription}
            variant="contained"
            color="primary"
            disabled={generating}
            startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
          >
            {generating ? 'Generálás...' : 'Generálás'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
