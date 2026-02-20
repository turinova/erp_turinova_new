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
  DialogActions,
  Alert,
  Chip
} from '@mui/material'
import { Save as SaveIcon, Sync as SyncIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import type { ProductWithDescriptions } from '@/lib/products-server'
import HtmlEditor from '@/components/HtmlEditor'
import SourceMaterialsTab from '@/components/SourceMaterialsTab'
import SearchConsoleTab from '@/components/SearchConsoleTab'

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
  const [generatedProductType, setGeneratedProductType] = useState<string | null>(null)
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([])
  const [searchQueriesUsed, setSearchQueriesUsed] = useState<Array<{ query: string; impressions: number; clicks: number }> | null>(null)
  
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
    generation_instructions: null,
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
    description: decodeHtmlEntities(huDescription.description),
    generation_instructions: huDescription.generation_instructions || ''
  })

  // Product basic data (separate from description)
  const [productData, setProductData] = useState({
    sku: product.sku || '',
    model_number: product.model_number || '',
    gtin: product.gtin || '',  // Vonalkód (Barcode/GTIN)
    // Pricing fields (Árazás)
    price: product.price ?? '',
    cost: product.cost ?? '',
    multiplier: product.multiplier ?? 1.0,
    multiplier_lock: product.multiplier_lock ?? false
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

      // Save product basic data (sku, model_number, gtin, pricing)
      const productDataToSave = {
        model_number: productData.model_number.trim() || null,
        gtin: productData.gtin.trim() || null,  // Vonalkód
        // Pricing fields
        price: productData.price !== '' ? parseFloat(String(productData.price)) : null,
        cost: productData.cost !== '' ? parseFloat(String(productData.cost)) : null,
        multiplier: productData.multiplier !== '' ? parseFloat(String(productData.multiplier)) : 1.0,
        multiplier_lock: productData.multiplier_lock
      }

      const productResponse = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productDataToSave)
      })

      const productResult = await productResponse.json()
      if (!productResult.success) {
        toast.error(`Termék mentés sikertelen: ${productResult.error || 'Ismeretlen hiba'}`)
        return
      }

      // Encode HTML entities before saving (ShopRenter stores HTML as entities)
      const dataToSave = {
        language_code: 'hu',
        name: formData.name,
        meta_title: formData.meta_title,
        meta_keywords: formData.meta_keywords,
        meta_description: formData.meta_description,
        short_description: encodeHtmlEntities(formData.short_description),
        description: encodeHtmlEntities(formData.description),
        generation_instructions: formData.generation_instructions.trim() || null
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
        toast.success('Termék sikeresen mentve!')
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
          language: 'hu',
          generationInstructions: formData.generation_instructions.trim() || undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        // Update the description field with generated content
        setFormData(prev => ({
          ...prev,
          description: result.description
        }))
        
        // Store search queries used for optimization
        if (result.searchQueriesUsed && result.searchQueriesUsed.length > 0) {
          setSearchQueriesUsed(result.searchQueriesUsed)
        } else {
          setSearchQueriesUsed(null)
        }
        
        // Update product type and warnings
        setGeneratedProductType(result.productType || null)
        setGenerationWarnings(result.validationWarnings || [])
        
        // Show success message with product type info
        let successMessage = `Leírás sikeresen generálva! (${result.metrics.wordCount} szó, ${result.metrics.tokensUsed} token`
        if (result.productType) {
          successMessage += `, típus: ${result.productType}`
        }
        if (result.metrics.searchQueriesUsed > 0) {
          successMessage += `, ${result.metrics.searchQueriesUsed} keresési lekérdezés optimalizálva`
        }
        successMessage += ')'
        toast.success(successMessage)
        
        // Show validation warnings if any
        if (result.validationWarnings && result.validationWarnings.length > 0) {
          console.warn('Validation warnings:', result.validationWarnings)
          // Show warning toast for each validation issue
          result.validationWarnings.forEach((warning: string) => {
            toast.warning(`Figyelem: ${warning}`, { autoClose: 5000 })
          })
        }
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
          <Tab label="Árazás" />
          <Tab label="SEO" />
          <Tab label="Leírás" />
          <Tab label="Forrásanyagok" />
          <Tab label="Search Console" />
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cikkszám (SKU)"
                value={productData.sku}
                disabled
                helperText="A cikkszám nem módosítható"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Gyártói cikkszám"
                value={productData.model_number}
                onChange={(e) => setProductData(prev => ({ ...prev, model_number: e.target.value }))}
                helperText="A gyártó saját termékazonosítója"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Vonalkód (GTIN/EAN)"
                value={productData.gtin}
                onChange={(e) => setProductData(prev => ({ ...prev, gtin: e.target.value }))}
                helperText="A termék vonalkódja (EAN, UPC, stb.)"
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
              <Typography variant="h6" sx={{ mb: 2 }}>Árazási adatok</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nettó ár (Ft)"
                type="number"
                value={productData.price}
                onChange={(e) => setProductData(prev => ({ ...prev, price: e.target.value }))}
                helperText="A termék nettó ára"
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Beszerzési ár (Ft)"
                type="number"
                value={productData.cost}
                onChange={(e) => setProductData(prev => ({ ...prev, cost: e.target.value }))}
                helperText="A termék beszerzési ára (csak admin számára látható)"
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Árazási szorzó"
                type="number"
                value={productData.multiplier}
                onChange={(e) => setProductData(prev => ({ ...prev, multiplier: e.target.value }))}
                helperText="Az ár szorzója (alapértelmezett: 1.0)"
                inputProps={{ step: '0.0001', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pt: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={productData.multiplier_lock}
                    onChange={(e) => setProductData(prev => ({ ...prev, multiplier_lock: e.target.checked }))}
                    style={{ marginRight: '8px', width: '18px', height: '18px' }}
                  />
                  <Typography>Szorzó zárolása</Typography>
                </label>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>SEO beállítások</Typography>
            </Grid>
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

        <TabPanel value={tabValue} index={3}>
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
              <TextField
                fullWidth
                label="AI Generálási utasítások (opcionális)"
                value={formData.generation_instructions}
                onChange={handleInputChange('generation_instructions')}
                multiline
                rows={3}
                helperText="Pl.: 'A forrásanyagok 450mm fiókra vonatkoznak, de a leírás 300-550mm közötti méreteket fedjen le'"
                sx={{ mb: 3 }}
              />
              {searchQueriesUsed && searchQueriesUsed.length > 0 && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                    Optimalizált keresési lekérdezések ({searchQueriesUsed.length} db):
                  </Typography>
                  <Box component="div" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {searchQueriesUsed.map((q, index) => (
                      <Chip
                        key={index}
                        label={`"${q.query}" (${q.impressions} megjelenés, ${q.clicks} kattintás)`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    Ezek a lekérdezések bekerültek a generált leírásba a keresési rangsor javítása érdekében.
                  </Typography>
                </Alert>
              )}
              {generatedProductType && (
                <Alert severity={generationWarnings.length > 0 ? 'warning' : 'info'} sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    Detektált terméktípus: <strong>{generatedProductType.replace('_', ' ')}</strong>
                  </Typography>
                  {generationWarnings.length > 0 && (
                    <Box component="div" sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold">Figyelmeztetések:</Typography>
                      <Box component="ul" sx={{ pl: 2, mt: 0.5 }}>
                        {generationWarnings.map((warning, index) => (
                          <li key={index}>
                            <Typography variant="body2">{warning}</Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Alert>
              )}
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

        <TabPanel value={tabValue} index={4}>
          <SourceMaterialsTab productId={product.id} />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <SearchConsoleTab productId={product.id} productUrl={product.product_url} />
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
                <li>Gyártói cikkszám, Vonalkód (GTIN)</li>
                <li>Árazás (nettó ár, beszerzési ár, szorzó)</li>
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
              Az AI a forrásanyagok és a Search Console adatok alapján generál egy SEO-optimalizált, természetes hangvételű termékleírást.
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 2 }}>
              <strong>A generálás a következőket veszi figyelembe:</strong>
              <Box component="ul" sx={{ mt: 1, pl: 3 }}>
                <li>Forrásanyagok (PDF, URL, szöveg)</li>
                <li>Termék neve, SKU</li>
                <li>Search Console keresési lekérdezések (ha szinkronizálva van)</li>
                <li>AI Generálási utasítások (ha meg van adva)</li>
                <li>SEO és AI detektálás elkerülési stratégiák</li>
                <li>Magyar nyelvű, természetes hangvétel</li>
              </Box>
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Search Console optimalizáció:</strong> Ha a termékhez Search Console adatok vannak szinkronizálva,
                az AI automatikusan optimalizálja a leírást a legfontosabb keresési lekérdezésekhez.
                Ez javítja a keresési rangsort és a kattintási arányt (CTR).
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 2 }}>
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
