'use client'

import React, { useState, useEffect } from 'react'
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
  DialogActions,
  Alert,
  Chip,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink
} from '@mui/material'
import { 
  Save as SaveIcon, 
  Sync as SyncIcon, 
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import HtmlEditor from '@/components/HtmlEditor'
import NextLink from 'next/link'

interface CategoryEditFormProps {
  category: any
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
      id={`category-tabpanel-${index}`}
      aria-labelledby={`category-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CategoryEditForm({ category: initialCategory }: CategoryEditFormProps) {
  const router = useRouter()
  const [tabValue, setTabValue] = useState(0)
  const [category, setCategory] = useState(initialCategory)
  const [descriptions, setDescriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  
  // URL alias state
  const [urlSlug, setUrlSlug] = useState<string>('')
  const [categoryUrl, setCategoryUrl] = useState<string | null>(null)
  const [loadingUrlAlias, setLoadingUrlAlias] = useState(false)
  const [generatingUrlSlug, setGeneratingUrlSlug] = useState(false)
  const [originalUrlSlug, setOriginalUrlSlug] = useState<string>('')
  
  // Meta generation state
  const [generatingMeta, setGeneratingMeta] = useState<{
    name: boolean
    meta_title: boolean
    meta_description: boolean
  }>({
    name: false,
    meta_title: false,
    meta_description: false
  })
  
  // Form state for descriptions
  const [formData, setFormData] = useState({
    name: '',
    meta_title: '',
    meta_description: '',
    description: ''
  })
  const [saving, setSaving] = useState(false)

  // Load category descriptions
  useEffect(() => {
    // If category already has descriptions, use them
    if (category.shoprenter_category_descriptions && Array.isArray(category.shoprenter_category_descriptions)) {
      setDescriptions(category.shoprenter_category_descriptions)
    } else {
      // Otherwise, fetch them
      loadCategoryDescriptions()
    }
  }, [category.id])

  // Load products when Termékek tab is selected
  useEffect(() => {
    if (tabValue === 2) {
      loadProducts()
    }
  }, [tabValue, category.id])

  // Load URL alias on mount
  useEffect(() => {
    const loadUrlAlias = async () => {
      try {
        setLoadingUrlAlias(true)
        const response = await fetch(`/api/categories/${category.id}/url-alias`)
        const result = await response.json()
        
        if (result.success && result.data) {
          setUrlSlug(result.data.urlSlug || '')
          setOriginalUrlSlug(result.data.urlSlug || '')
          setCategoryUrl(result.data.categoryUrl || null)
        }
      } catch (error) {
        console.error('Error loading URL alias:', error)
      } finally {
        setLoadingUrlAlias(false)
      }
    }
    
    loadUrlAlias()
  }, [category.id])

  const loadCategoryDescriptions = async () => {
    try {
      const response = await fetch(`/api/categories/${category.id}/descriptions`)
      if (response.ok) {
        const data = await response.json()
        setDescriptions(data.descriptions || [])
      }
    } catch (error) {
      console.error('Error loading descriptions:', error)
    }
  }

  const loadProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await fetch(`/api/categories/${category.id}/products`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      } else {
        toast.error('Hiba a termékek betöltésekor')
      }
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Hiba a termékek betöltésekor')
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  // Pull category from ShopRenter (fetch latest data)
  const handlePullFromShopRenter = async () => {
    try {
      setPulling(true)

      // Get connection_id from category
      const connectionId = (category as any).connection_id
      if (!connectionId) {
        toast.error('Nincs kapcsolat ID a kategóriához')
        return
      }

      // Get shoprenter_id from category
      const shoprenterId = (category as any).shoprenter_id
      if (!shoprenterId) {
        toast.error('Nincs ShopRenter ID a kategóriához')
        return
      }

      const response = await fetch(`/api/connections/${connectionId}/sync-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category_id: shoprenterId,
          force: false
        })
      })

      let result: any = null
      try {
        const responseText = await response.text()
        if (responseText) {
          result = JSON.parse(responseText)
        } else {
          console.warn('Empty response from pull endpoint')
          throw new Error('Üres válasz érkezett a szervertől')
        }
      } catch (parseError: any) {
        console.error('Failed to parse pull response:', parseError)
        throw new Error(`Nem sikerült feldolgozni a szerver válaszát: ${parseError.message}`)
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Frissítés sikertelen')
      }

      toast.success(result.message || 'Kategória sikeresen frissítve ShopRenter-ből!')
      if (result.warning) {
        toast.warning(result.warning)
      }
      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Error pulling category from ShopRenter:', error)
      toast.error(`Frissítés hiba: ${error.message || 'Ismeretlen hiba'}`)
    } finally {
      setPulling(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch(`/api/categories/${category.id}/sync`, {
        method: 'POST'
      })

      let result: any = null
      try {
        const responseText = await response.text()
        if (responseText) {
          result = JSON.parse(responseText)
        } else {
          console.warn('Empty response from sync endpoint')
          throw new Error('Üres válasz érkezett a szervertől')
        }
      } catch (parseError: any) {
        console.error('Failed to parse sync response:', parseError)
        throw new Error(`Nem sikerült feldolgozni a szerver válaszát: ${parseError.message}`)
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Szinkronizálás sikertelen')
      }

      toast.success(result.message || 'Kategória szinkronizálása sikeres')
      if (result.warning) {
        toast.warning(result.warning)
      }
      router.refresh()
    } catch (error: any) {
      console.error('Error syncing category:', error)
      toast.error(`Szinkronizálás hiba: ${error.message || 'Ismeretlen hiba'}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleGenerateDescription = async () => {
    try {
      setGenerating(true)
      const response = await fetch(`/api/categories/${category.id}/generate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: 'hu',
          useProductData: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      const data = await response.json()
      setGeneratedDescription(data.description)
      setGenerationDialogOpen(true)
      toast.success('Leírás generálása sikeres')
    } catch (error: any) {
      toast.error(`Generálás hiba: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveDescription = async () => {
    if (!generatedDescription) {
      toast.error('Nincs generált leírás a mentéshez')
      return
    }

    try {
      setGenerating(true)

      // Get current description to find language_id
      const currentDesc = descriptions.find(
        (desc: any) => desc.language_id === 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
      ) || descriptions[0]

      const response = await fetch(`/api/categories/${category.id}/descriptions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language_id: currentDesc?.language_id || 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==',
          description: generatedDescription,
          // Preserve existing name, meta_title, meta_description if they exist
          name: currentDesc?.name || null,
          custom_title: currentDesc?.custom_title || null,
          meta_description: currentDesc?.meta_description || null
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Leírás sikeresen mentve!')
        setGenerationDialogOpen(false)
        setGeneratedDescription(null)
        // Update form data with saved description
        setFormData(prev => ({ ...prev, description: generatedDescription }))
        // Reload descriptions
        router.refresh()
      } else {
        toast.error(`Mentés sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error: any) {
      console.error('Error saving description:', error)
      toast.error(`Hiba a leírás mentésekor: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveAllDescriptions = async () => {
    try {
      setSaving(true)

      // Get current description to find language_id
      const currentDesc = descriptions.find(
        (desc: any) => desc.language_id === 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
      ) || descriptions[0]

      const response = await fetch(`/api/categories/${category.id}/descriptions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language_id: currentDesc?.language_id || 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==',
          name: formData.name || currentDesc?.name || null,
          custom_title: formData.meta_title || currentDesc?.custom_title || null,
          meta_description: formData.meta_description || currentDesc?.meta_description || null,
          description: formData.description || currentDesc?.description || null
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Kategória leírások sikeresen mentve!')
        router.refresh()
      } else {
        toast.error(`Mentés sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error: any) {
      console.error('Error saving descriptions:', error)
      toast.error(`Hiba a leírások mentésekor: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateMeta = async (field: 'name' | 'meta_title' | 'meta_description' | 'all') => {
    try {
      const fieldsToGenerate = field === 'all' ? ['name', 'meta_title', 'meta_description'] : [field]
      
      // Set loading states
      if (field === 'all') {
        setGeneratingMeta({ name: true, meta_title: true, meta_description: true })
      } else {
        setGeneratingMeta(prev => ({ ...prev, [field]: true }))
      }

      const response = await fetch(`/api/categories/${category.id}/generate-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldsToGenerate })
      })

      const result = await response.json()

      if (result.success) {
        // Update form data with generated values
        const updates: any = {}
        if (result.name) updates.name = result.name
        if (result.meta_title) updates.meta_title = result.meta_title
        if (result.meta_description) updates.meta_description = result.meta_description

        setFormData(prev => ({ ...prev, ...updates }))
        
        const fieldNames = {
          name: 'Név',
          meta_title: 'Meta cím',
          meta_description: 'Meta leírás',
          all: 'Meta mezők'
        }
        
        toast.success(`${fieldNames[field]} sikeresen generálva`)
      } else {
        toast.error(result.error || 'Hiba a meta mezők generálása során')
      }
    } catch (error) {
      console.error('Error generating meta fields:', error)
      toast.error('Hiba a meta mezők generálása során')
    } finally {
      setGeneratingMeta({ name: false, meta_title: false, meta_description: false })
    }
  }

  const handleGenerateUrlSlug = async () => {
    try {
      setGeneratingUrlSlug(true)
      const response = await fetch(`/api/categories/${category.id}/url-alias/generate`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setUrlSlug(result.data.suggestedSlug)
        setCategoryUrl(result.data.previewUrl)
        toast.success('AI által generált URL slug betöltve')
      } else {
        toast.error(result.error || 'Hiba az AI generálás során')
      }
    } catch (error) {
      console.error('Error generating URL slug:', error)
      toast.error('Hiba az URL slug generálásakor')
    } finally {
      setGeneratingUrlSlug(false)
    }
  }

  const handleSaveUrlAlias = async () => {
    if (!urlSlug.trim()) {
      toast.error('URL slug megadása kötelező')
      return
    }

    try {
      setLoadingUrlAlias(true)
      const response = await fetch(`/api/categories/${category.id}/url-alias`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urlSlug: urlSlug.trim() })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setOriginalUrlSlug(urlSlug.trim())
        setCategoryUrl(result.data.categoryUrl)
        toast.success('URL slug sikeresen frissítve! A régi URL automatikusan átirányítja az újat.')
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba az URL slug mentésekor')
      }
    } catch (error) {
      console.error('Error saving URL alias:', error)
      toast.error('Hiba az URL slug mentésekor')
    } finally {
      setLoadingUrlAlias(false)
    }
  }

  const handleRestoreOriginalUrl = () => {
    setUrlSlug(originalUrlSlug)
    if (originalUrlSlug) {
      const shopName = categoryUrl?.match(/https?:\/\/([^.]+)/)?.[1] || 'turinovakft'
      setCategoryUrl(`https://${shopName}.shoprenter.hu/${originalUrlSlug}`)
    }
  }

  const currentDescription = descriptions.find((d: any) => d.language_id?.includes('hu') || d.language_id === 'hu') || descriptions[0]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {category.name || 'Kategória szerkesztése'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="info"
            startIcon={pulling ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={handlePullFromShopRenter}
            disabled={pulling || syncing}
            title="Frissítés ShopRenter-ből (lekéri a legfrissebb adatokat)"
          >
            {pulling ? 'Frissítés...' : 'Frissítés ShopRenter-ből'}
          </Button>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing || pulling}
            title="Szinkronizálás ShopRenter-be (elküldi a helyi változtatásokat)"
          >
            Szinkronizálás
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSaveAllDescriptions}
            disabled={saving}
          >
            Mentés
          </Button>
        </Box>
      </Box>

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Alapadatok" />
          <Tab label="Leírások" />
          <Tab label="Termékek" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kategória neve"
                value={category.name || ''}
                disabled
                helperText="A név a ShopRenter-ből szinkronizálva"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Státusz"
                value={category.status === 1 ? 'Aktív' : 'Inaktív'}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="ShopRenter ID"
                value={category.shoprenter_id || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  🌐 SEO URL (slug)
                </Typography>
                
                {loadingUrlAlias && !urlSlug ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2">URL betöltése...</Typography>
                  </Box>
                ) : (
                  <>
                    {categoryUrl && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Jelenlegi URL:
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {categoryUrl}
                        </Typography>
                      </Box>
                    )}
                    
                    <TextField
                      fullWidth
                      label="SEO URL (slug)"
                      value={urlSlug}
                      onChange={(e) => {
                        setUrlSlug(e.target.value)
                        // Update preview URL
                        if (e.target.value.trim()) {
                          const shopName = categoryUrl?.match(/https?:\/\/([^.]+)/)?.[1] || 'turinovakft'
                          setCategoryUrl(`https://${shopName}.shoprenter.hu/${e.target.value.trim()}`)
                        }
                      }}
                      helperText="Az URL slug (pl: konyhai-butorok)"
                      InputProps={{
                        endAdornment: (
                          <Button
                            size="small"
                            startIcon={generatingUrlSlug ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                            onClick={handleGenerateUrlSlug}
                            disabled={generatingUrlSlug}
                            sx={{ minWidth: 'auto' }}
                          >
                            {generatingUrlSlug ? '' : 'AI'}
                          </Button>
                        )
                      }}
                      sx={{ mb: 2 }}
                    />
                    
                    {urlSlug && urlSlug !== originalUrlSlug && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Új URL előnézet:
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                          {categoryUrl || `https://turinovakft.hu/${urlSlug}`}
                        </Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        startIcon={loadingUrlAlias ? <CircularProgress size={16} /> : <SaveIcon />}
                        onClick={handleSaveUrlAlias}
                        disabled={loadingUrlAlias || !urlSlug.trim() || urlSlug.trim() === originalUrlSlug}
                      >
                        {loadingUrlAlias ? 'Mentés...' : 'Mentés'}
                      </Button>
                      
                      {urlSlug !== originalUrlSlug && (
                        <Button
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          onClick={handleRestoreOriginalUrl}
                          disabled={loadingUrlAlias}
                        >
                          Eredeti visszaállítása
                        </Button>
                      )}
                    </Box>
                    
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="caption">
                        ✅ URL változtatás után automatikus 301 redirect beállítva a régi URL-ről az újra.
                      </Typography>
                    </Alert>
                  </>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kategória URL (read-only)"
                value={category.category_url || ''}
                disabled
                helperText="Ez a mező csak olvasható, a fenti slug mezőből frissül"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Szinkronizálás státusza"
                value={category.sync_status || 'pending'}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Utolsó szinkronizálás"
                value={category.last_synced_at ? new Date(category.last_synced_at).toLocaleString('hu-HU') : 'Még nem szinkronizálva'}
                disabled
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {currentDescription ? (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label="Név"
                    value={formData.name || currentDescription.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={generatingMeta.name ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                    onClick={() => handleGenerateMeta('name')}
                    disabled={generatingMeta.name}
                    sx={{ minWidth: 'auto', px: 2, whiteSpace: 'nowrap' }}
                  >
                    AI
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label="Meta Title"
                    value={formData.meta_title || currentDescription.custom_title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                    helperText={`${(formData.meta_title || currentDescription.custom_title || '').length} karakter (50-60 optimális)`}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={generatingMeta.meta_title ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                    onClick={() => handleGenerateMeta('meta_title')}
                    disabled={generatingMeta.meta_title}
                    sx={{ minWidth: 'auto', px: 2, whiteSpace: 'nowrap' }}
                  >
                    AI
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label="Meta Description"
                    value={formData.meta_description || currentDescription.meta_description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                    multiline
                    rows={3}
                    helperText={`${(formData.meta_description || currentDescription.meta_description || '').length} karakter (150-160 optimális)`}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={generatingMeta.meta_description ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                    onClick={() => handleGenerateMeta('meta_description')}
                    disabled={generatingMeta.meta_description}
                    sx={{ minWidth: 'auto', px: 2, whiteSpace: 'nowrap', mt: 0.5 }}
                  >
                    AI
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Rövid leírás"
                  value={currentDescription.short_description || ''}
                  multiline
                  rows={3}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Leírás</Typography>
                  <Button
                    variant="outlined"
                    startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                    onClick={handleGenerateDescription}
                    disabled={generating}
                  >
                    {generating ? 'Generálás...' : 'AI Leírás generálása'}
                  </Button>
                </Box>
                <HtmlEditor
                  value={formData.description || currentDescription.description || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                  placeholder="Kategória leírása..."
                />
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              Nincs elérhető leírás ehhez a kategóriához. Kattintson a "Szinkronizálás" gombra a leírások betöltéséhez.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {loadingProducts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Termékek betöltése...
              </Typography>
            </Box>
          ) : products.length === 0 ? (
            <Alert severity="info">
              Nincs termék ebben a kategóriában. A termékek akkor jelennek meg, ha:
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li>A termékek szinkronizálva lettek</li>
                <li>A kategóriák szinkronizálva lettek</li>
                <li>A termék-kategória kapcsolatok létrejöttek</li>
              </ul>
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Cikkszám</TableCell>
                    <TableCell>Név</TableCell>
                    <TableCell>Ár</TableCell>
                    <TableCell>Státusz</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell align="right">Műveletek</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product: any) => {
                    const productName = product.name || 
                                      product.shoprenter_product_descriptions?.[0]?.name || 
                                      product.sku
                    return (
                      <TableRow key={product.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                            {product.sku}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {productName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {product.price ? `${product.price.toLocaleString('hu-HU')} HUF` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={product.status === 1 ? 'Aktív' : 'Inaktív'}
                            size="small"
                            color={product.status === 1 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {product.product_url ? (
                            <MuiLink
                              href={product.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                            >
                              {product.product_url}
                            </MuiLink>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Nincs URL
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            component={NextLink}
                            href={`/products/${product.id}`}
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNewIcon />}
                          >
                            Megnyitás
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>

      {/* AI Generation Dialog */}
      <Dialog
        open={generationDialogOpen}
        onClose={() => setGenerationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Generált kategória leírás</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Az AI által generált leírás. Ellenőrizze és mentse, ha megfelelő.
          </DialogContentText>
          {generatedDescription && (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                minHeight: 300,
                maxHeight: 500,
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: generatedDescription }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setGenerationDialogOpen(false)}
            disabled={generating}
          >
            Mégse
          </Button>
          <Button
            onClick={handleSaveDescription}
            variant="contained"
            color="primary"
            disabled={!generatedDescription || generating}
            startIcon={generating ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {generating ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
