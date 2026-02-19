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
  CircularProgress
} from '@mui/material'
import { Save as SaveIcon, Sync as SyncIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import type { ProductWithDescriptions } from '@/lib/products-server'

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
    short_description: huDescription.short_description || '',
    description: huDescription.description || ''
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

  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch(`/api/products/${product.id}/descriptions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language_code: 'hu',
          ...formData
        })
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

  const handleSync = async () => {
    try {
      setSyncing(true)

      const response = await fetch(`/api/products/${product.id}/sync`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Termék sikeresen szinkronizálva!')
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
            onClick={handleSync}
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
              <TextField
                fullWidth
                label="Rövid leírás"
                value={formData.short_description}
                onChange={handleInputChange('short_description')}
                multiline
                rows={3}
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
              <TextField
                fullWidth
                label="Részletes leírás"
                value={formData.description}
                onChange={handleInputChange('description')}
                multiline
                rows={10}
                helperText="A termék részletes leírása (HTML formátum támogatott)"
              />
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  )
}
