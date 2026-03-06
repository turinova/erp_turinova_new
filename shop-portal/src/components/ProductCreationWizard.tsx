'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Card,
  CardContent,
  Container
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Check as CheckIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface WebshopConnection {
  id: string
  name?: string
  shop_name?: string
  connection_type: string
  api_url: string
  is_active: boolean
}

// Step components
import Step1ConnectionSelection from './ProductCreationWizard/Step1ConnectionSelection'
import Step2BasicInformation from './ProductCreationWizard/Step2BasicInformation'
import Step3ProductClassAndAttributes from './ProductCreationWizard/Step3ProductClassAndAttributes'
import Step4Categories from './ProductCreationWizard/Step5Categories'
import Step5ProductRelationship from './ProductCreationWizard/Step6ProductRelationship'
import Step6Pricing from './ProductCreationWizard/Step6Pricing'
import Step7ContentSEO from './ProductCreationWizard/Step7ContentSEO'
import Step8ReviewCreate from './ProductCreationWizard/Step8ReviewCreate'

interface WizardData {
  // Step 1
  connection_id: string | null
  
  // Step 2
  sku: string
  name: string
  model_number: string
  gtin: string
  
  // Step 3 (combined: Product Class & Attributes)
  product_class_shoprenter_id: string | null
  product_attributes: any | null
  
  // Step 4
  category_ids: string[]
  
  // Step 5
  parent_product_id: string | null
  
  // Step 6
  cost: string
  multiplier: string
  vat_id: string | null
  
  // Step 7
  short_description: string
  description: string
  meta_title: string
  meta_description: string
  url_slug: string
}

const steps = [
  'Kapcsolat kiválasztása',
  'Alapadatok',
  'Termék típusa & Attribútumok',
  'Kategóriák',
  'Termék kapcsolata',
  'Árazás',
  'Tartalom & SEO',
  'Áttekintés'
]

export default function ProductCreationWizard() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [connections, setConnections] = useState<WebshopConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wizardData, setWizardData] = useState<WizardData>({
    connection_id: null,
    sku: '',
    name: '',
    model_number: '',
    gtin: '',
    product_class_shoprenter_id: null,
    product_attributes: null,
    category_ids: [],
    parent_product_id: null,
    cost: '',
    multiplier: '1.0',
    vat_id: null,
    short_description: '',
    description: '',
    meta_title: '',
    meta_description: '',
    url_slug: ''
  })

  // Load connections on mount
  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    setLoadingConnections(true)
    try {
      const response = await fetch('/api/connections')
      if (response.ok) {
        const data = await response.json()
        // API returns array directly or wrapped in connections property
        const connectionsList = Array.isArray(data) ? data : (data.connections || [])
        // Filter only active ShopRenter connections
        const shoprenterConnections = connectionsList.filter(
          (conn: WebshopConnection) => 
            conn.connection_type === 'shoprenter' && conn.is_active
        )
        setConnections(shoprenterConnections)
      } else {
        toast.error('Hiba a kapcsolatok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading connections:', error)
      toast.error('Hiba a kapcsolatok betöltésekor')
    } finally {
      setLoadingConnections(false)
    }
  }

  const handleNext = () => {
    // Validate current step before proceeding
    if (!validateStep(activeStep)) {
      return
    }
    setActiveStep((prev) => prev + 1)
    setError(null)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
    setError(null)
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Connection
        if (!wizardData.connection_id) {
          setError('Kérjük, válasszon kapcsolatot')
          return false
        }
        return true
      
      case 1: // Basic info
        if (!wizardData.sku.trim()) {
          setError('A SKU kötelező')
          return false
        }
        if (!wizardData.name.trim()) {
          setError('A termék neve kötelező')
          return false
        }
        return true
      
      case 2: // Product Class & Attributes - optional but recommended
        // Product class is optional, but attributes require it
        return true
      
      case 3: // Categories
        if (wizardData.category_ids.length === 0) {
          setError('Legalább egy kategória kötelező')
          return false
        }
        return true
      
      case 5: // Pricing
        if (!wizardData.cost || parseFloat(wizardData.cost) <= 0) {
          setError('A beszerzési ár kötelező és nagyobb kell legyen, mint 0')
          return false
        }
        if (!wizardData.vat_id) {
          setError('Az ÁFA kötelező')
          return false
        }
        return true
      
      default:
        return true
    }
  }

  const handleCreate = async () => {
    if (!validateStep(activeStep)) {
      return
    }

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connection_id: wizardData.connection_id,
          sku: wizardData.sku,
          name: wizardData.name,
          model_number: wizardData.model_number || null,
          gtin: wizardData.gtin || null,
          product_class_shoprenter_id: wizardData.product_class_shoprenter_id || null,
          product_attributes: wizardData.product_attributes,
          category_ids: wizardData.category_ids,
          parent_product_id: wizardData.parent_product_id || null,
          cost: wizardData.cost,
          multiplier: wizardData.multiplier || '1.0',
          vat_id: wizardData.vat_id,
          short_description: wizardData.short_description || null,
          description: wizardData.description || null,
          meta_title: wizardData.meta_title || null,
          meta_description: wizardData.meta_description || null,
          url_slug: wizardData.url_slug || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Hiba a termék létrehozásakor')
      }

      toast.success(data.message || 'Termék sikeresen létrehozva!')
      
      // Navigate back to products page
      router.push('/products')
      router.refresh()
    } catch (error) {
      console.error('Error creating product:', error)
      setError(error instanceof Error ? error.message : 'Hiba a termék létrehozásakor')
      toast.error(error instanceof Error ? error.message : 'Hiba a termék létrehozásakor')
    } finally {
      setCreating(false)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Step1ConnectionSelection
            connections={connections}
            loading={loadingConnections}
            selectedConnectionId={wizardData.connection_id}
            onSelect={(connectionId) => 
              setWizardData(prev => ({ ...prev, connection_id: connectionId }))
            }
          />
        )
      case 1:
        return (
          <Step2BasicInformation
            data={wizardData}
            connectionId={wizardData.connection_id}
            onChange={(field, value) => 
              setWizardData(prev => ({ ...prev, [field]: value }))
            }
          />
        )
      case 2:
        return (
          <Step3ProductClassAndAttributes
            connectionId={wizardData.connection_id}
            selectedProductClassId={wizardData.product_class_shoprenter_id}
            attributes={Array.isArray(wizardData.product_attributes) ? wizardData.product_attributes : (wizardData.product_attributes ? [wizardData.product_attributes] : null)}
            onProductClassSelect={(productClassId) => {
              setWizardData(prev => {
                // Clear attributes if product class changes
                const newData = { ...prev, product_class_shoprenter_id: productClassId }
                if (prev.product_class_shoprenter_id !== productClassId) {
                  newData.product_attributes = null
                }
                return newData
              })
            }}
            onAttributesChange={(attributes) => 
              setWizardData(prev => ({ ...prev, product_attributes: attributes && attributes.length > 0 ? attributes : null }))
            }
          />
        )
      case 3:
        return (
          <Step4Categories
            connectionId={wizardData.connection_id}
            selectedCategoryIds={wizardData.category_ids}
            onSelect={(categoryIds) => 
              setWizardData(prev => ({ ...prev, category_ids: categoryIds }))
            }
          />
        )
      case 4:
        return (
          <Step5ProductRelationship
            connectionId={wizardData.connection_id}
            selectedParentId={wizardData.parent_product_id}
            onSelect={(parentId) => 
              setWizardData(prev => ({ ...prev, parent_product_id: parentId }))
            }
          />
        )
      case 5:
        return (
          <Step6Pricing
            data={wizardData}
            onChange={(field, value) => 
              setWizardData(prev => ({ ...prev, [field]: value }))
            }
          />
        )
      case 6:
        return (
          <Step7ContentSEO
            data={wizardData}
            onChange={(field, value) => 
              setWizardData(prev => ({ ...prev, [field]: value }))
            }
          />
        )
      case 7:
        return (
          <Step8ReviewCreate
            data={wizardData}
            connections={connections}
          />
        )
      default:
        return null
    }
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Új termék létrehozása
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Töltse ki az alábbi lépéseket a termék létrehozásához
        </Typography>
      </Box>

      {/* Stepper with Materialize styling */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2
        }}
      >
        <Stepper 
          activeStep={activeStep} 
          alternativeLabel
          sx={{
            '& .MuiStepLabel-root .Mui-completed': {
              color: 'primary.main'
            },
            '& .MuiStepLabel-label.Mui-completed.MuiStepLabel-alternativeLabel': {
              color: 'text.secondary'
            },
            '& .MuiStepLabel-root .Mui-active': {
              color: 'primary.main'
            },
            '& .MuiStepLabel-label.Mui-active.MuiStepLabel-alternativeLabel': {
              color: 'primary.main',
              fontWeight: 600
            }
          }}
        >
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel
                StepIconComponent={({ active, completed }) => (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: completed
                        ? 'primary.main'
                        : active
                        ? 'primary.main'
                        : 'grey.300',
                      color: completed || active ? 'white' : 'text.secondary',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  >
                    {completed ? (
                      <CheckIcon sx={{ fontSize: 24 }} />
                    ) : (
                      index + 1
                    )}
                  </Box>
                )}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Card
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          mb: 4
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ minHeight: '400px' }}>
            {renderStepContent()}
          </Box>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 2,
          pb: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Button
          onClick={() => router.push('/products')}
          startIcon={<ArrowBackIcon />}
          disabled={creating}
        >
          Mégse
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {activeStep > 0 && (
            <Button
              onClick={handleBack}
              disabled={creating}
              variant="outlined"
            >
              Vissza
            </Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={creating}
            >
              Tovább
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              variant="contained"
              disabled={creating}
              startIcon={creating ? <CircularProgress size={20} /> : <CheckIcon />}
            >
              {creating ? 'Létrehozás...' : 'Létrehozás'}
            </Button>
          )}
        </Box>
      </Box>
    </Container>
  )
}
