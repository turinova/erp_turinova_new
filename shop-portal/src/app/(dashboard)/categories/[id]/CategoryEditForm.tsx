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
  const [generating, setGenerating] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

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

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch(`/api/categories/${category.id}/sync`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      toast.success('Kategória szinkronizálása sikeres')
      router.refresh()
    } catch (error: any) {
      toast.error(`Szinkronizálás hiba: ${error.message}`)
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
    // TODO: Implement save description
    toast.info('Leírás mentése hamarosan elérhető')
  }

  const currentDescription = descriptions.find((d: any) => d.language_id?.includes('hu') || d.language_id === 'hu') || descriptions[0]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          {category.name || 'Kategória szerkesztése'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Szinkronizálás...' : 'Szinkronizálás'}
          </Button>
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            onClick={handleGenerateDescription}
            disabled={generating}
            color="primary"
          >
            {generating ? 'Generálás...' : 'AI Leírás generálása'}
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kategória URL"
                value={category.category_url || ''}
                disabled
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
                <TextField
                  fullWidth
                  label="Név"
                  value={currentDescription.name || ''}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Meta Title"
                  value={currentDescription.custom_title || ''}
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Meta Description"
                  value={currentDescription.meta_description || ''}
                  multiline
                  rows={3}
                  disabled
                />
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
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Leírás
                </Typography>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    minHeight: 200,
                    bgcolor: 'grey.50'
                  }}
                  dangerouslySetInnerHTML={{ __html: currentDescription.description || '<p>Nincs leírás</p>' }}
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
          <Button onClick={() => setGenerationDialogOpen(false)}>
            Mégse
          </Button>
          <Button
            onClick={handleSaveDescription}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Mentés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
