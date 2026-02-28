'use client'

import React, { useState, useTransition, useEffect, useRef } from 'react'
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
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import { Save as SaveIcon, Sync as SyncIcon, AutoAwesome as AutoAwesomeIcon, Link as LinkIcon, Refresh as RefreshIcon, FamilyRestroom as FamilyRestroomIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, Category as CategoryIcon, OpenInNew as OpenInNewIcon, Info as InfoIcon, Label as LabelIcon, Receipt as ReceiptIcon, AttachMoney as AttachMoneyIcon, Description as DescriptionIcon, Analytics as AnalyticsIcon, Calculate as CalculateIcon, PhotoLibrary as PhotoLibraryIcon, TextFields as ShortTextIcon, Settings as SettingsIcon, LocalOffer as LocalOfferIcon, Title as TitleIcon, Search as SearchIcon, Article as ArticleIcon, Assessment as AssessmentIcon, Store as StoreIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import type { ProductWithDescriptions } from '@/lib/products-server'
import HtmlEditor from '@/components/HtmlEditor'
import SourceMaterialsTab from '@/components/SourceMaterialsTab'
import SearchConsoleTab from '@/components/SearchConsoleTab'
import CompetitorPricesTab from '@/components/CompetitorPricesTab'
import ProductImagesTab from '@/components/ProductImagesTab'
import ProductQualityScore from '@/components/ProductQualityScore'

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
  const [pulling, setPulling] = useState(false) // For pulling from ShopRenter
  const [generating, setGenerating] = useState(false)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)
  const [generatedProductType, setGeneratedProductType] = useState<string | null>(null)
  const [generationWarnings, setGenerationWarnings] = useState<string[]>([])
  const [searchQueriesUsed, setSearchQueriesUsed] = useState<Array<{ query: string; impressions: number; clicks: number }> | null>(null)
  
  // URL alias state
  const [urlSlug, setUrlSlug] = useState<string>('')
  const [productUrl, setProductUrl] = useState<string | null>(null)
  const [loadingUrlAlias, setLoadingUrlAlias] = useState(false)
  const [generatingUrlSlug, setGeneratingUrlSlug] = useState(false)
  const [originalUrlSlug, setOriginalUrlSlug] = useState<string>('')
  
  // Parent/Child relationships state
  const [variantData, setVariantData] = useState<{
    isParent: boolean
    isChild: boolean
    parent: any | null
    children: any[]
    childCount: number
  } | null>(null)
  const [loadingVariants, setLoadingVariants] = useState(false)

  // Quality score state
  const [qualityScore, setQualityScore] = useState<any>(null)
  const [loadingQualityScore, setLoadingQualityScore] = useState(false)
  const [calculatingQualityScore, setCalculatingQualityScore] = useState(false)

  // Categories state
  const [categories, setCategories] = useState<any[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  // Meta generation state
  const [generatingMeta, setGeneratingMeta] = useState<{
    title: boolean
    keywords: boolean
    description: boolean
  }>({
    title: false,
    keywords: false,
    description: false
  })
  
  // Helper function to decode HTML entities (client-side only)
  const decodeHtmlEntities = (html: string | null | undefined): string => {
    if (!html) return ''
    // Only use document if we're on the client side
    if (typeof document === 'undefined') {
      // Server-side: use a simple regex replacement for common entities
      return html
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
    }
    // Client-side: use DOM API
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
    parameters: null, // Add parameters field
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
    generation_instructions: huDescription.generation_instructions || '',
    parameters: (huDescription as any).parameters || '' // Add parameters field
  })

  // Product tags state (language-specific, comma-separated)
  const [productTags, setProductTags] = useState<string>('')
  const [loadingProductTags, setLoadingProductTags] = useState(false)
  const [tagsReloadKey, setTagsReloadKey] = useState(0) // Key to force reload of tags

  // Product basic data (separate from description)
  const [productData, setProductData] = useState({
    sku: product.sku || '',
    model_number: product.model_number || '',
    gtin: product.gtin || '',  // Vonalkód (Barcode/GTIN)
    // Pricing fields (Árazás)
    price: product.price ?? '',
    cost: product.cost ?? '',
    multiplier: product.multiplier ?? 1.0,
    multiplier_lock: product.multiplier_lock ?? false,
    vat_id: (product as any).vat_id || null,
    gross_price: (product as any).gross_price || null
  })

  // VAT rates state
  const [vatRates, setVatRates] = useState<Array<{ id: string; name: string; kulcs: number }>>([])
  const [isEditingGross, setIsEditingGross] = useState(false)
  const [grossPrice, setGrossPrice] = useState<number | null>(null)
  
  // VAT mapping status
  const [vatMappingStatus, setVatMappingStatus] = useState<{
    hasMapping: boolean
    shoprenterTaxClassName: string | null
    warning: string | null
  } | null>(null)
  const [checkingVatMapping, setCheckingVatMapping] = useState(false)
  
  // Cost & Multiplier editing state
  const [isEditingCost, setIsEditingCost] = useState(false)
  const [isEditingMultiplier, setIsEditingMultiplier] = useState(false)
  
  // Ref to prevent infinite loops in auto-calculation
  const isCalculatingRef = useRef(false)

  // Fetch VAT rates on mount
  useEffect(() => {
    const fetchVatRates = async () => {
      try {
        const response = await fetch('/api/vat-rates')
        if (response.ok) {
          const data = await response.json()
          setVatRates(data.vatRates || [])
        }
      } catch (error) {
        console.error('Error fetching VAT rates:', error)
      }
    }
    fetchVatRates()
  }, [])

  // Calculate gross price from net when net or VAT changes
  useEffect(() => {
    if (!isEditingGross && productData.price && productData.vat_id) {
      const vat = vatRates.find(v => v.id === productData.vat_id)
      if (vat) {
        const net = parseFloat(productData.price.toString()) || 0
        const gross = Math.round(net * (1 + vat.kulcs / 100))
        setGrossPrice(gross)
      } else {
        setGrossPrice(null)
      }
    }
  }, [productData.price, productData.vat_id, vatRates, isEditingGross])

  // Initialize gross price from product data
  useEffect(() => {
    if (productData.gross_price) {
      setGrossPrice(parseFloat(productData.gross_price.toString()))
    } else if (productData.price && productData.vat_id) {
      const vat = vatRates.find(v => v.id === productData.vat_id)
      if (vat) {
        const net = parseFloat(productData.price.toString()) || 0
        const gross = Math.round(net * (1 + vat.kulcs / 100))
        setGrossPrice(gross)
      }
    }
  }, []) // Only on mount

  // Handle gross price change (calculate net and multiplier)
  const handleGrossPriceChange = (value: number) => {
    setIsEditingGross(true)
    setIsEditingCost(false)
    setIsEditingMultiplier(false)
    setGrossPrice(value)

    const vat = vatRates.find(v => v.id === productData.vat_id)
    if (vat && value > 0) {
      // Hungarian rounding: round gross first
      const roundedGross = Math.round(value)
      const vatAmount = Math.round(roundedGross / (100 + vat.kulcs) * vat.kulcs)
      const net = roundedGross - vatAmount

      setProductData(prev => {
        const cost = parseFloat(prev.cost.toString() || '0')
        const newMultiplier = cost > 0 ? net / cost : prev.multiplier
        
        return {
          ...prev,
          price: net,
          multiplier: cost > 0 ? Math.round(newMultiplier * 1000) / 1000 : prev.multiplier
        }
      })
    } else if (value === 0) {
      setProductData(prev => ({
        ...prev,
        price: 0,
        multiplier: 0
      }))
    }
  }

  // Handle net price change (calculate gross and multiplier)
  const handleNetPriceChange = (value: string) => {
    setIsEditingGross(false)
    setIsEditingCost(false)
    setIsEditingMultiplier(false)
    
    const netPrice = parseFloat(value) || 0
    setProductData(prev => {
      const cost = parseFloat(prev.cost.toString() || '0')
      const newMultiplier = cost > 0 ? netPrice / cost : prev.multiplier
      
      return {
        ...prev,
        price: value,
        multiplier: cost > 0 ? Math.round(newMultiplier * 1000) / 1000 : prev.multiplier
      }
    })
  }

  // Handle VAT change (recalculate gross)
  const handleVatChange = (vatId: string) => {
    setProductData(prev => ({ ...prev, vat_id: vatId }))
    setIsEditingGross(false)
    // Reset VAT mapping status when VAT changes
    setVatMappingStatus(null)
  }

  // Handle cost change (calculate multiplier from current net price, keep net price fixed)
  const handleCostChange = (value: string) => {
    setIsEditingCost(true)
    setIsEditingMultiplier(false)
    setIsEditingGross(false)
    
    const cost = parseFloat(value) || 0
    setProductData(prev => {
      const currentPrice = parseFloat(prev.price.toString() || '0')
      // Keep net price fixed, calculate multiplier: net price / cost
      const newMultiplier = cost > 0 && currentPrice > 0 ? currentPrice / cost : prev.multiplier
      
      return {
        ...prev,
        cost: value,
        multiplier: cost > 0 && currentPrice > 0 ? Math.round(newMultiplier * 1000) / 1000 : prev.multiplier
      }
    })
  }

  // Handle multiplier change (calculate net price and gross price)
  const handleMultiplierChange = (value: string) => {
    setIsEditingMultiplier(true)
    setIsEditingCost(false)
    setIsEditingGross(false)
    
    const multiplier = parseFloat(value) || 0
    setProductData(prev => {
      const cost = parseFloat(prev.cost.toString() || '0')
      const newNetPrice = cost > 0 ? cost * multiplier : prev.price
      
      return {
        ...prev,
        multiplier: multiplier,
        price: typeof newNetPrice === 'number' ? newNetPrice : parseFloat(newNetPrice.toString() || '0')
      }
    })
  }

  // Auto-calculate gross price when net price or VAT changes (after user edits)
  useEffect(() => {
    if (!isEditingGross && productData.price && productData.vat_id) {
      const vat = vatRates.find(v => v.id === productData.vat_id)
      if (vat) {
        const net = parseFloat(productData.price.toString()) || 0
        const gross = Math.round(net * (1 + vat.kulcs / 100))
        setGrossPrice(gross)
      } else {
        setGrossPrice(null)
      }
    }
  }, [productData.price, productData.vat_id, vatRates, isEditingGross])

  // Check VAT mapping before sync
  const checkVatMapping = async (): Promise<{
    hasMapping: boolean
    shoprenterTaxClassName: string | null
    warning: string | null
  }> => {
    if (!productData.vat_id) {
      return { hasMapping: true, shoprenterTaxClassName: null, warning: null }
    }

    try {
      setCheckingVatMapping(true)
      
      // Get connection ID from product
      const response = await fetch(`/api/products/${product.id}`)
      if (!response.ok) {
        return { hasMapping: false, shoprenterTaxClassName: null, warning: 'Nem található termék' }
      }
      
      const productDataResponse = await response.json()
      const connectionId = productDataResponse.product?.connection_id || (product as any).connection_id
      
      if (!connectionId) {
        return { hasMapping: false, shoprenterTaxClassName: null, warning: 'Nem található kapcsolat' }
      }

      // Check mapping
      const mappingResponse = await fetch(`/api/connections/${connectionId}/tax-class-mappings`)
      if (mappingResponse.ok) {
        const data = await mappingResponse.json()
        const mapping = data.mappings?.find((m: any) => m.vat_id === productData.vat_id)
        
        if (mapping) {
          return {
            hasMapping: true,
            shoprenterTaxClassName: mapping.shoprenter_tax_class_name || 'Ismeretlen',
            warning: null
          }
        } else {
          // Get VAT rate name
          const vatRate = vatRates.find(v => v.id === productData.vat_id)
          return {
            hasMapping: false,
            shoprenterTaxClassName: null,
            warning: `Nincs ÁFA leképezés beállítva az "${vatRate?.name || 'Ismeretlen'}" ÁFA kulcshoz.`
          }
        }
      }
    } catch (error) {
      console.error('Error checking VAT mapping:', error)
      return { hasMapping: false, shoprenterTaxClassName: null, warning: 'Hiba a leképezés ellenőrzésekor' }
    } finally {
      setCheckingVatMapping(false)
    }
    
    return { hasMapping: false, shoprenterTaxClassName: null, warning: null }
  }

  // Check VAT mapping when VAT changes
  useEffect(() => {
    if (productData.vat_id && vatRates.length > 0) {
      const checkMapping = async () => {
        const status = await checkVatMapping()
        setVatMappingStatus(status)
      }
      checkMapping()
    } else {
      setVatMappingStatus(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productData.vat_id, vatRates])

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

      // Validation
      const cost = parseFloat(productData.cost.toString() || '0')
      const price = parseFloat(productData.price.toString() || '0')
      const multiplier = parseFloat(productData.multiplier.toString() || '1')

      // Validate cost vs price
      if (cost > 0 && price > 0 && cost > price) {
        toast.warning('Figyelem: A beszerzési ár nagyobb, mint a nettó ár. Ez szándékos?')
        // Don't block save, just warn
      }

      // Validate multiplier
      if (multiplier < 0 || multiplier > 100) {
        toast.error('Az árazási szorzó 0 és 100 közé kell essen')
        setSaving(false)
        return
      }

      // Calculate gross price if not set
      let finalGrossPrice = grossPrice
      if (!finalGrossPrice && productData.price && productData.vat_id) {
        const vat = vatRates.find(v => v.id === productData.vat_id)
        if (vat) {
          const net = parseFloat(productData.price.toString()) || 0
          finalGrossPrice = Math.round(net * (1 + vat.kulcs / 100))
        }
      }

      // Save product basic data (sku, model_number, gtin, pricing)
      const productDataToSave = {
        model_number: productData.model_number.trim() || null,
        gtin: productData.gtin.trim() || null,  // Vonalkód
        // Pricing fields
        price: productData.price !== '' ? parseFloat(String(productData.price)) : null,
        cost: productData.cost !== '' ? parseFloat(String(productData.cost)) : null,
        multiplier: typeof productData.multiplier === 'number' ? productData.multiplier : (productData.multiplier !== '' ? parseFloat(String(productData.multiplier)) : 1.0),
        multiplier_lock: productData.multiplier_lock,
        // VAT fields
        vat_id: productData.vat_id || null,
        gross_price: finalGrossPrice || null
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
        parameters: formData.parameters || null, // Add parameters field
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
        // Save or delete product tags (always sync, even if empty to delete)
        console.log(`[SAVE] Saving product tags: "${productTags}" (trimmed: "${productTags.trim()}")`)
        try {
          const tagsResponse = await fetch(`/api/products/${product.id}/tags`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              language_code: 'hu',
              tags: productTags.trim() // Empty string will trigger deletion
            })
          })
          
          const tagsResult = await tagsResponse.json()
          console.log(`[SAVE] Tags API response:`, tagsResult)
          
          if (!tagsResult.success) {
            console.warn('[SAVE] Failed to save product tags:', tagsResult.error)
            // Don't fail the entire save if tags fail
          } else {
            console.log(`[SAVE] Tags saved/deleted successfully`)
            // If tags were deleted, clear the state immediately
            if (productTags.trim().length === 0) {
              console.log(`[SAVE] Tags were empty, clearing state immediately`)
              setProductTags('')
            }
            // Force reload of tags after successful save to reflect deletion
            // Use setTimeout to ensure it happens after router.refresh()
            setTimeout(() => {
              console.log(`[SAVE] Reloading tags after save`)
              setTagsReloadKey(prev => prev + 1)
            }, 100)
          }
        } catch (tagsError) {
          console.warn('[SAVE] Error saving product tags:', tagsError)
          // Don't fail the entire save if tags fail
        }

        // Save URL alias if it has changed
        if (urlSlug.trim() && urlSlug.trim() !== originalUrlSlug) {
          try {
            console.log(`[SAVE] Saving URL alias: "${urlSlug.trim()}"`)
            const urlResponse = await fetch(`/api/products/${product.id}/url-alias`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ urlSlug: urlSlug.trim() })
            })
            
            const urlResult = await urlResponse.json()
            
            if (urlResult.success) {
              setOriginalUrlSlug(urlSlug.trim())
              setProductUrl(urlResult.data.productUrl)
              console.log(`[SAVE] URL alias saved successfully`)
            } else {
              console.warn('[SAVE] Failed to save URL alias:', urlResult.error)
              // Don't fail the entire save if URL alias fails
            }
          } catch (urlError) {
            console.warn('[SAVE] Error saving URL alias:', urlError)
            // Don't fail the entire save if URL alias fails
          }
        }

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

  const handleSyncClick = async () => {
    // Check VAT mapping first
    const mappingStatus = await checkVatMapping()
    setVatMappingStatus(mappingStatus)
    
    // Show dialog with VAT info
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

  // Pull product from ShopRenter (fetch latest data including display names)
  const handlePullFromShopRenter = async () => {
    try {
      setPulling(true)

      // Get connection_id from product
      const connectionId = (product as any).connection_id
      if (!connectionId) {
        toast.error('Nincs kapcsolat ID a termékhez')
        return
      }

      // Get shoprenter_id from product
      const shoprenterId = (product as any).shoprenter_id
      if (!shoprenterId) {
        toast.error('Nincs ShopRenter ID a termékhez')
        return
      }

      const response = await fetch(`/api/connections/${connectionId}/sync-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: shoprenterId,
          force: false
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Termék sikeresen frissítve ShopRenter-ből!')
        // Refresh the page to show updated data
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(`Frissítés sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error pulling product from ShopRenter:', error)
      toast.error('Hiba a termék frissítésekor')
    } finally {
      setPulling(false)
    }
  }

  // Load URL alias on mount
  useEffect(() => {
    const loadUrlAlias = async () => {
      try {
        setLoadingUrlAlias(true)
        const response = await fetch(`/api/products/${product.id}/url-alias`)
        const result = await response.json()
        
        if (result.success && result.data) {
          setUrlSlug(result.data.urlSlug || '')
          setOriginalUrlSlug(result.data.urlSlug || '')
          setProductUrl(result.data.productUrl || null)
        }
      } catch (error) {
        console.error('Error loading URL alias:', error)
      } finally {
        setLoadingUrlAlias(false)
      }
    }
    
    loadUrlAlias()
  }, [product.id])

  // Load parent/child relationships on mount
  useEffect(() => {
    const loadVariants = async () => {
      try {
        setLoadingVariants(true)
        const response = await fetch(`/api/products/${product.id}/variants`)
        const result = await response.json()
        
        if (result.success) {
          setVariantData({
            isParent: result.isParent,
            isChild: result.isChild,
            parent: result.parent,
            children: result.children || [],
            childCount: result.childCount || 0
          })
        }
      } catch (error) {
        console.error('Error loading variants:', error)
      } finally {
        setLoadingVariants(false)
      }
    }
    
    loadVariants()
  }, [product.id])

  // Load quality score on mount
  useEffect(() => {
    const loadQualityScore = async () => {
      try {
        setLoadingQualityScore(true)
        const response = await fetch(`/api/products/${product.id}/quality-score`)
        const result = await response.json()
        
        if (result.success && result.score) {
          setQualityScore(result.score)
        }
      } catch (error) {
        console.error('Error loading quality score:', error)
      } finally {
        setLoadingQualityScore(false)
      }
    }
    
    loadQualityScore()
  }, [product.id])

  // Load product tags on mount
  useEffect(() => {
    const loadProductTags = async () => {
      try {
        setLoadingProductTags(true)
        console.log(`[LOAD TAGS] Loading tags for product ${product.id}, reloadKey: ${tagsReloadKey}`)
        const response = await fetch(`/api/products/${product.id}/tags?language_code=hu`)
        const result = await response.json()
        
        console.log(`[LOAD TAGS] API response:`, result)
        
        if (result.success) {
          if (result.tags && result.tags.tags) {
            console.log(`[LOAD TAGS] Setting tags to: "${result.tags.tags}"`)
            setProductTags(result.tags.tags)
          } else {
            // No tags found or tags were deleted - clear the state
            console.log(`[LOAD TAGS] No tags found, clearing state`)
            setProductTags('')
          }
        } else {
          // Error or no tags - clear the state
          console.log(`[LOAD TAGS] Error or no tags, clearing state`)
          setProductTags('')
        }
      } catch (error) {
        console.error('[LOAD TAGS] Error loading product tags:', error)
        setProductTags('') // Clear on error
      } finally {
        setLoadingProductTags(false)
      }
    }
    
    loadProductTags()
  }, [product.id, tagsReloadKey]) // Reload when tagsReloadKey changes

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await fetch(`/api/products/${product.id}/categories`)
        const result = await response.json()
        
        if (result.categories) {
          setCategories(result.categories)
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      } finally {
        setLoadingCategories(false)
      }
    }
    
    loadCategories()
  }, [product.id])

  // Calculate quality score
  const handleCalculateQualityScore = async () => {
    try {
      setCalculatingQualityScore(true)
      const response = await fetch(`/api/products/${product.id}/quality-score`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success && result.score) {
        setQualityScore(result.score)
        toast.success('Minőségi pontszám sikeresen kiszámolva')
      } else {
        toast.error(result.error || 'Hiba a minőségi pontszám számítása során')
      }
    } catch (error) {
      console.error('Error calculating quality score:', error)
      toast.error('Hiba a minőségi pontszám számítása során')
    } finally {
      setCalculatingQualityScore(false)
    }
  }

  // Generate meta fields
  const handleGenerateMeta = async (field: 'title' | 'keywords' | 'description' | 'all') => {
    try {
      const fieldsToGenerate = field === 'all' ? ['title', 'keywords', 'description'] : [field]
      
      // Set loading states
      if (field === 'all') {
        setGeneratingMeta({ title: true, keywords: true, description: true })
      } else {
        setGeneratingMeta(prev => ({ ...prev, [field]: true }))
      }

      const response = await fetch(`/api/products/${product.id}/generate-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldsToGenerate })
      })

      const result = await response.json()

      if (result.success) {
        // Update form data with generated values
        const updates: any = {}
        if (result.meta_title) updates.meta_title = result.meta_title
        if (result.meta_keywords) updates.meta_keywords = result.meta_keywords
        if (result.meta_description) updates.meta_description = result.meta_description

        setFormData(prev => ({ ...prev, ...updates }))
        
        const fieldNames = {
          title: 'Meta cím',
          keywords: 'Meta kulcsszavak',
          description: 'Meta leírás',
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
      setGeneratingMeta({ title: false, keywords: false, description: false })
    }
  }

  const handleGenerateUrlSlug = async () => {
    try {
      setGeneratingUrlSlug(true)
      const response = await fetch(`/api/products/${product.id}/url-alias/generate`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setUrlSlug(result.data.suggestedSlug)
        setProductUrl(result.data.previewUrl)
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
      const response = await fetch(`/api/products/${product.id}/url-alias`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urlSlug: urlSlug.trim() })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setOriginalUrlSlug(urlSlug.trim())
        setProductUrl(result.data.productUrl)
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
      const shopName = productUrl?.match(/https?:\/\/([^.]+)/)?.[1] || 'turinovakft'
      setProductUrl(`https://${shopName}.shoprenter.hu/${originalUrlSlug}`)
    }
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="info"
            startIcon={pulling ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={handlePullFromShopRenter}
            disabled={pulling || syncing}
            title="Frissítés ShopRenter-ből (lekéri a legfrissebb adatokat, pl. attribútum megjelenítési neveket)"
          >
            {pulling ? 'Frissítés...' : 'Frissítés ShopRenter-ből'}
          </Button>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSyncClick}
            disabled={syncing || pulling}
            title="Szinkronizálás ShopRenter-be (elküldi a helyi változtatásokat)"
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
          <Tab 
            icon={<InfoIcon />} 
            iconPosition="start"
            label="Alapadatok" 
          />
          <Tab 
            icon={<AttachMoneyIcon />} 
            iconPosition="start"
            label="Árazás" 
          />
          <Tab 
            icon={<DescriptionIcon />} 
            iconPosition="start"
            label="Tartalom & SEO" 
          />
          <Tab 
            icon={<AutoAwesomeIcon />} 
            iconPosition="start"
            label="AI Forrás" 
          />
          <Tab 
            icon={<AnalyticsIcon />} 
            iconPosition="start"
            label="Elemzés" 
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Basic Information Section - White Background with Blue Border */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#2196f3',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <InfoIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
                    Alapinformációk
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      label="Termék neve"
                      value={formData.name}
                      onChange={handleInputChange('name')}
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Cikkszám (SKU)"
                      value={productData.sku}
                      disabled
                      helperText="A cikkszám nem módosítható"
                      sx={{
                        '& .MuiInputBase-input.Mui-disabled': {
                          WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          fontWeight: 500
                        },
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Gyártói cikkszám"
                      value={productData.model_number}
                      onChange={(e) => setProductData(prev => ({ ...prev, model_number: e.target.value }))}
                      helperText="A gyártó saját termékazonosítója"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Vonalkód (GTIN/EAN)"
                      value={productData.gtin}
                      onChange={(e) => setProductData(prev => ({ ...prev, gtin: e.target.value }))}
                      helperText="A termék vonalkódja (EAN, UPC, stb.)"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            {/* Product Attributes Section - Green Theme */}
            {product.product_attributes && product.product_attributes.length > 0 && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                    border: '2px solid',
                    borderColor: '#4caf50',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(76, 175, 80, 0.1) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30px, -30px)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#4caf50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                    }}>
                      <LabelIcon sx={{ color: 'white', fontSize: '24px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                      Attribútumok
                    </Typography>
                    <Chip 
                      label={product.product_attributes.length} 
                      size="small" 
                      sx={{ 
                        bgcolor: '#4caf50',
                        color: 'white',
                        fontWeight: 600,
                        height: '24px'
                      }} 
                    />
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1.5,
                    position: 'relative',
                    zIndex: 1
                  }}>
                  {product.product_attributes.map((attr: any, index: number) => {
                    // Use display_name (from AttributeDescription) as primary, fallback to name
                    const displayName = attr.display_name || attr.name || 'Ismeretlen'
                    
                    // Helper function to extract value from object/array/primitive
                    const extractAttributeValue = (val: any): string | null => {
                      if (val === null || val === undefined) {
                        return null
                      }

                      // Handle primitives
                      if (typeof val !== 'object') {
                        return String(val)
                      }

                      // Handle arrays
                      if (Array.isArray(val)) {
                        const extracted = val
                          .map(v => extractAttributeValue(v))
                          .filter(v => v !== null && v !== undefined && v !== 'null' && v !== 'undefined')
                        return extracted.length > 0 ? extracted.join(', ') : null
                      }

                      // Handle objects - try multiple strategies
                      // Strategy 1: Language-specific (Hungarian first)
                      if (val.hu && typeof val.hu === 'string') {
                        return val.hu
                      }
                      if (val.name && typeof val.name === 'string') {
                        return val.name
                      }
                      if (val.description && typeof val.description === 'string') {
                        return val.description
                      }
                      if (val.value !== undefined && val.value !== null) {
                        const extracted = extractAttributeValue(val.value)
                        if (extracted !== null) {
                          return extracted
                        }
                      }

                      // Strategy 2: Find first string value in object
                      for (const [key, v] of Object.entries(val)) {
                        if (typeof v === 'string' && v.trim() !== '') {
                          return v
                        }
                        if (typeof v === 'number') {
                          return String(v)
                        }
                      }

                      // Strategy 3: If object has a single property, use it
                      const keys = Object.keys(val)
                      if (keys.length === 1) {
                        const extracted = extractAttributeValue(val[keys[0]])
                        if (extracted !== null) {
                          return extracted
                        }
                      }

                      return null
                    }

                    // Format value based on type
                    let displayValue: string = ''
                    const extractedValue = extractAttributeValue(attr.value)
                    
                    if (extractedValue === null || extractedValue === undefined || extractedValue.trim() === '') {
                      displayValue = 'Nincs érték'
                    } else {
                      displayValue = extractedValue
                    }
                    
                    return (
                      <Chip
                        key={index}
                        label={`${displayName}: ${displayValue}`}
                        size="small"
                        sx={{ 
                          fontSize: '0.875rem',
                          height: '36px',
                          bgcolor: 'white',
                          border: '1px solid',
                          borderColor: '#4caf50',
                          color: '#2e7d32',
                          fontWeight: 500,
                          '&:hover': {
                            bgcolor: '#e8f5e9',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 8px rgba(76, 175, 80, 0.2)',
                            transition: 'all 0.2s ease'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      />
                    )
                  })}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* Product Relationships Section - Purple/Pink Theme */}
            {!loadingVariants && variantData && (variantData.isParent || variantData.isChild) && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                    border: '2px solid',
                    borderColor: '#9c27b0',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(156, 39, 176, 0.1) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30px, -30px)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#9c27b0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
                    }}>
                      <FamilyRestroomIcon sx={{ color: 'white', fontSize: '24px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
                      Termék kapcsolatok
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    position: 'relative',
                    zIndex: 1
                  }}>
                  
                  {/* Parent Product Info - Compact */}
                  {variantData.isChild && variantData.parent && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1.5, 
                      mb: variantData.isParent ? 2 : 0,
                      p: 2,
                      bgcolor: 'white',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: '#ce93d8',
                      boxShadow: '0 2px 8px rgba(156, 39, 176, 0.1)',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(156, 39, 176, 0.2)',
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease'
                      },
                      transition: 'all 0.2s ease'
                    }}>
                      <Box sx={{ 
                        p: 0.5, 
                        borderRadius: '50%', 
                        bgcolor: '#9c27b0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <ArrowUpwardIcon sx={{ color: 'white', fontSize: '18px' }} />
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#7b1fa2' }}>Szülő:</Typography>
                      <Chip 
                        label={variantData.parent.sku} 
                        size="small" 
                        sx={{ 
                          height: '24px', 
                          fontSize: '0.75rem',
                          bgcolor: '#f3e5f5',
                          color: '#7b1fa2',
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: '#ce93d8'
                        }}
                      />
                      <Button
                        component={NextLink}
                        href={`/products/${variantData.parent.id}`}
                        size="small"
                        variant="contained"
                        sx={{ 
                          ml: 'auto', 
                          fontSize: '0.75rem', 
                          minWidth: 'auto', 
                          px: 2,
                          bgcolor: '#9c27b0',
                          '&:hover': {
                            bgcolor: '#7b1fa2'
                          }
                        }}
                      >
                        Megnyitás →
                      </Button>
                    </Box>
                  )}
                  
                  {/* Child Products Info - Compact Table */}
                  {variantData.isParent && variantData.children.length > 0 && (
                    <Box>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5, 
                        mb: 2,
                        p: 1.5,
                        bgcolor: 'white',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: '#ce93d8'
                      }}>
                        <Box sx={{ 
                          p: 0.5, 
                          borderRadius: '50%', 
                          bgcolor: '#9c27b0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <ArrowDownwardIcon sx={{ color: 'white', fontSize: '18px' }} />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
                          Változatok
                        </Typography>
                        <Chip 
                          label={variantData.childCount} 
                          size="small" 
                          sx={{ 
                            bgcolor: '#9c27b0',
                            color: 'white',
                            fontWeight: 600,
                            height: '22px'
                          }} 
                        />
                      </Box>
                      <Box sx={{ 
                        maxHeight: '300px',
                        overflowY: 'auto',
                        border: '2px solid',
                        borderColor: '#ce93d8',
                        borderRadius: 1.5,
                        bgcolor: 'white',
                        boxShadow: '0 2px 8px rgba(156, 39, 176, 0.1)'
                      }}>
                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                          <Box component="thead" sx={{ 
                            bgcolor: '#f3e5f5', 
                            position: 'sticky', 
                            top: 0, 
                            zIndex: 1,
                            borderBottom: '2px solid',
                            borderColor: '#ce93d8'
                          }}>
                            <Box component="tr">
                              <Box component="th" sx={{ p: 1, textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                                SKU
                              </Box>
                              <Box component="th" sx={{ p: 1, textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                                Termék neve
                              </Box>
                              <Box component="th" sx={{ p: 1, textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                                Gyártói cikkszám
                              </Box>
                              <Box component="th" sx={{ p: 1, textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                                Attribútumok
                              </Box>
                              <Box component="th" sx={{ p: 1, textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                                Ár
                              </Box>
                              <Box component="th" sx={{ p: 1, textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider', width: '80px' }}>
                                Művelet
                              </Box>
                            </Box>
                          </Box>
                          <Box component="tbody">
                            {variantData.children.map((child: any) => {
                              // Extract key attributes for compact display
                              const keyAttributes = child.product_attributes && Array.isArray(child.product_attributes)
                                ? child.product_attributes
                                    .filter((attr: any) => ['meret', 'size', 'szin', 'color', 'teherbiras', 'teherbiras_kg'].includes(attr.name?.toLowerCase()))
                                    .map((attr: any) => {
                                      if (attr.type === 'LIST' && Array.isArray(attr.value)) {
                                        const values = attr.value.map((v: any) => 
                                          typeof v === 'object' && v.value ? v.value : String(v)
                                        ).join(', ')
                                        return values
                                      }
                                      return attr.value
                                    })
                                    .filter(Boolean)
                                    .join(' • ')
                                : null

                              return (
                                <Box 
                                  component="tr" 
                                  key={child.id}
                                  sx={{ 
                                    '&:hover': { bgcolor: 'action.hover' },
                                    borderBottom: '1px solid',
                                    borderColor: 'divider'
                                  }}
                                >
                                  <Box component="td" sx={{ p: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                      <Chip 
                                        label={child.sku} 
                                        size="small" 
                                        sx={{ height: '24px', fontSize: '0.8125rem', fontWeight: 500 }}
                                        color={child.status === 1 ? 'secondary' : 'default'}
                                        variant="outlined"
                                      />
                                      {child.status !== 1 && (
                                        <Chip 
                                          label="Inaktív" 
                                          size="small" 
                                          sx={{ height: '20px', fontSize: '0.75rem' }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                  <Box component="td" sx={{ p: 1 }}>
                                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>
                                      {child.descriptions?.[0]?.name || child.name || '-'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1 }}>
                                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>
                                      {child.model_number || '-'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1 }}>
                                    {keyAttributes ? (
                                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>
                                        {keyAttributes}
                                      </Typography>
                                    ) : (
                                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.disabled' }}>
                                        -
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box component="td" sx={{ p: 1, textAlign: 'right' }}>
                                    {child.price ? (
                                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                                        {parseFloat(child.price).toLocaleString('hu-HU')} Ft
                                      </Typography>
                                    ) : (
                                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
                                        -
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box component="td" sx={{ p: 0.75, textAlign: 'right' }}>
                                    <Button
                                      component={NextLink}
                                      href={`/products/${child.id}`}
                                      size="small"
                                      variant="text"
                                      sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                                    >
                                      →
                                    </Button>
                                  </Box>
                                </Box>
                              )
                            })}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* Categories Section - Orange Theme */}
            {!loadingCategories && categories.length > 0 && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                    border: '2px solid',
                    borderColor: '#ff9800',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(255, 152, 0, 0.1) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30px, -30px)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#ff9800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                    }}>
                      <CategoryIcon sx={{ color: 'white', fontSize: '24px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
                      Kategóriák
                    </Typography>
                    <Chip 
                      label={categories.length} 
                      size="small" 
                      sx={{ 
                        bgcolor: '#ff9800',
                        color: 'white',
                        fontWeight: 600,
                        height: '24px'
                      }} 
                    />
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1.5,
                    position: 'relative',
                    zIndex: 1
                  }}>
                    {categories.map((category: any) => {
                      const catName = category.shoprenter_category_descriptions?.[0]?.name || category.name || 'Kategória'
                      const catUrl = category.category_url
                      
                      return (
                        <Chip
                          key={category.id}
                          label={catName}
                          size="small"
                          sx={{ 
                            height: '32px',
                            fontSize: '0.875rem',
                            bgcolor: 'white',
                            border: '1px solid',
                            borderColor: '#ff9800',
                            color: '#e65100',
                            fontWeight: 500,
                            '&:hover': { 
                              bgcolor: '#fff3e0',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 8px rgba(255, 152, 0, 0.2)',
                              transition: 'all 0.2s ease'
                            },
                            transition: 'all 0.2s ease'
                          }}
                          icon={catUrl ? <OpenInNewIcon fontSize="small" sx={{ color: '#ff9800' }} /> : undefined}
                          onClick={catUrl ? () => window.open(catUrl, '_blank') : undefined}
                          component={catUrl ? 'a' : 'div'}
                          href={catUrl || undefined}
                          target={catUrl ? '_blank' : undefined}
                          rel={catUrl ? 'noopener noreferrer' : undefined}
                          clickable={!!catUrl}
                        />
                      )
                    })}
                  </Box>
                  
                  {categories.some((cat: any) => !cat.category_url) && (
                    <Alert 
                      severity="info" 
                      sx={{ 
                        mt: 2, 
                        fontSize: '0.875rem',
                        bgcolor: 'white',
                        border: '1px solid',
                        borderColor: '#ffb74d',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      Néhány kategóriának nincs URL-je. Az AI generálás csak azokhoz a kategóriákhoz ad hivatkozást, amelyeknek van URL-je.
                    </Alert>
                  )}
                </Paper>
              </Grid>
            )}
            {!loadingCategories && categories.length === 0 && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                  Ez a termék nincs kategóriákhoz rendelve. A termék szinkronizálása után a kategóriák automatikusan megjelennek itt.
                  Az AI generálás csak akkor ad hivatkozásokat, ha a termékhez kategóriák vannak rendelve.
                </Alert>
              </Grid>
            )}
            {loadingCategories && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {/* Price Section - Green Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#4caf50',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                  }}>
                    <AttachMoneyIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                    Ár beállítása
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Bruttó ár (Ft)"
                      type="number"
                      value={grossPrice || ''}
                      onChange={(e) => handleGrossPriceChange(parseFloat(e.target.value) || 0)}
                      helperText="Amit a vásárló fizet (ÁFÁ-val együtt) - Szerkeszthető"
                      inputProps={{ step: '1', min: '0' }}
                      InputProps={{
                        readOnly: false
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nettó ár (Ft)"
                      type="number"
                      value={productData.price || ''}
                      onChange={(e) => handleNetPriceChange(e.target.value)}
                      helperText="Amit Ön kap (ÁFA nélkül) - Szerkeszthető"
                      inputProps={{ step: '0.01', min: '0' }}
                      InputProps={{
                        readOnly: isEditingGross
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>ÁFA kulcs</InputLabel>
                      <Select
                        value={productData.vat_id || ''}
                        onChange={(e) => handleVatChange(e.target.value)}
                        label="ÁFA kulcs"
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'white'
                          }
                        }}
                      >
                        {vatRates.map(vat => (
                          <MenuItem key={vat.id} value={vat.id}>
                            {vat.name} ({vat.kulcs}%)
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="ÁFA összege (Ft)"
                      type="number"
                      value={grossPrice && productData.price ? Math.round(grossPrice - parseFloat(productData.price.toString() || '0')) : 0}
                      InputProps={{
                        readOnly: true
                      }}
                      helperText="Automatikusan számolva"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)'
                        }
                      }}
                    />
                  </Grid>
                  {productData.vat_id && productData.price && grossPrice && (
                    <Grid item xs={12}>
                      <Alert severity="info" icon={<InfoIcon />}>
                        <Typography variant="body2">
                          <strong>{parseFloat(productData.price.toString() || '0').toLocaleString('hu-HU')} Ft</strong> nettó +{' '}
                          <strong>
                            {vatRates.find(v => v.id === productData.vat_id)?.kulcs || 0}%
                          </strong> ÁFA ={' '}
                          <strong>{grossPrice.toLocaleString('hu-HU')} Ft</strong> bruttó
                        </Typography>
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>

            {/* Cost and Multiplier Section - Orange Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#ff9800',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#ff9800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                  }}>
                    <CalculateIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
                    Beszerzési ár és szorzó
                  </Typography>
                </Box>
                <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    <strong>Fontos:</strong> A beszerzési ár és a szorzó csak <strong>információs célú</strong> az ERP-ben. 
                    A ShopRenter-be csak a <strong>nettó ár</strong> szinkronizálódik (ami már tartalmazza a szorzót). 
                    A ShopRenter-ben a szorzó <strong>1.0-ra</strong> lesz állítva, hogy elkerüljük a kétszeres számolást.
                  </Typography>
                </Alert>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Beszerzési ár (Ft)"
                      type="number"
                      value={productData.cost && (typeof productData.cost === 'number' ? productData.cost > 0 : parseFloat(String(productData.cost)) > 0) ? productData.cost : ''}
                      onChange={(e) => handleCostChange(e.target.value)}
                      helperText="A termék beszerzési ára (csak admin számára látható). Ha megváltoztatja, a szorzó automatikusan újraszámolódik."
                      inputProps={{ step: '0.01', min: '0' }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Árazási szorzó"
                      type="number"
                      value={productData.multiplier}
                      onChange={(e) => handleMultiplierChange(e.target.value)}
                      helperText="Az ár szorzója (alapértelmezett: 1.0). Ha megváltoztatja, a beszerzési ár automatikusan újraszámolódik."
                      inputProps={{ step: '0.0001', min: '0' }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  {productData.cost && 
                   productData.price && 
                   (typeof productData.cost === 'number' ? productData.cost > 0 : parseFloat(String(productData.cost)) > 0) &&
                   (typeof productData.price === 'number' ? productData.price > 0 : parseFloat(String(productData.price)) > 0) && (
                    <Grid item xs={12}>
                      <Alert severity="info" icon={<InfoIcon />}>
                        <Typography variant="body2">
                          <strong>Számítás:</strong> Nettó ár ({(() => {
                            const price = typeof productData.price === 'number' ? productData.price : parseFloat(String(productData.price));
                            return price.toLocaleString('hu-HU');
                          })()} Ft) ÷ Beszerzési ár ({(() => {
                            const cost = typeof productData.cost === 'number' ? productData.cost : parseFloat(String(productData.cost));
                            return cost.toLocaleString('hu-HU');
                          })()} Ft) = Szorzó ({parseFloat(productData.multiplier.toString() || '1').toFixed(3)})
                        </Typography>
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            {/* Short Description Section - Green Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#4caf50',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                  }}>
                    <ShortTextIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                    Rövid leírás
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <HtmlEditor
                    value={formData.short_description}
                    onChange={(value) => setFormData(prev => ({ ...prev, short_description: value }))}
                    label="Rövid leírás"
                    placeholder="Írja be a termék rövid leírását..."
                    height={300}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Description Section - Purple Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#9c27b0',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#9c27b0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
                  }}>
                    <DescriptionIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
                    Részletes leírás
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={generating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                    onClick={() => setGenerationDialogOpen(true)}
                    disabled={generating}
                    sx={{ ml: 'auto' }}
                  >
                    {generating ? 'Generálás...' : 'AI'}
                  </Button>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
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
                </Box>
              </Paper>
            </Grid>

            {/* Parameters Section - Orange Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#ff9800',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#ff9800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                  }}>
                    <SettingsIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
                    Paraméterek
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <TextField
                    fullWidth
                    label="Paraméterek"
                    value={formData.parameters}
                    onChange={handleInputChange('parameters')}
                    multiline
                    rows={4}
                    helperText="Termék paraméterek (pl: Szín: zöld, Méret: XL). Ez a mező a termék oldalon jelenik meg."
                    placeholder="Pl.: Szín: zöld, Méret: XL, Anyag: pamut"
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Product Tags Section - Pink Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#e91e63',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#e91e63',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(233, 30, 99, 0.3)'
                  }}>
                    <LocalOfferIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#c2185b' }}>
                    Termék címkék
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  {loadingProductTags ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} />
                      <Typography variant="body2">Címkék betöltése...</Typography>
                    </Box>
                  ) : (
                    <TextField
                      fullWidth
                      label="Címkék"
                      value={productTags}
                      onChange={(e) => setProductTags(e.target.value)}
                      helperText="Vesszővel elválasztott címkék (pl: konyha, bútor, modern). Ezek a címkék segítenek a termék kategorizálásában és keresésében."
                      placeholder="Pl.: konyha, bútor, modern, fehér"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(255, 255, 255, 0.9)',
                          '&:hover': {
                            bgcolor: 'white'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* SEO URL Section - Blue Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#2196f3',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <LinkIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
                    SEO URL (slug)
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  {loadingUrlAlias && !urlSlug ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} />
                      <Typography variant="body2">URL betöltése...</Typography>
                    </Box>
                  ) : (
                    <>
                      {productUrl && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Jelenlegi URL:
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                            {productUrl}
                          </Typography>
                        </Box>
                      )}
                      
                      <TextField
                        fullWidth
                        label="SEO URL (slug)"
                        value={urlSlug}
                        onChange={(e) => {
                          setUrlSlug(e.target.value)
                          if (e.target.value.trim()) {
                            const shopName = productUrl?.match(/https?:\/\/([^.]+)/)?.[1] || 'turinovakft'
                            setProductUrl(`https://${shopName}.shoprenter.hu/${e.target.value.trim()}`)
                          }
                        }}
                        helperText="Az URL slug (pl: blum-clip-top-blumotion-pant-110-fok)"
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
                        sx={{ mb: 2,
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                      
                      {urlSlug && urlSlug !== originalUrlSlug && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Új URL előnézet:
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                            {productUrl || `https://turinovakft.hu/${urlSlug}`}
                          </Typography>
                        </Box>
                      )}
                      
                      {urlSlug !== originalUrlSlug && (
                        <Box sx={{ mb: 2 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<RefreshIcon />}
                            onClick={handleRestoreOriginalUrl}
                          >
                            Eredeti visszaállítása
                          </Button>
                        </Box>
                      )}
                      
                      <Alert severity="info">
                        <Typography variant="caption">
                          ✅ Az URL slug a felső "Mentés" gombbal mentődik. URL változtatás után automatikus 301 redirect beállítva a régi URL-ről az újra.
                        </Typography>
                      </Alert>
                    </>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Meta Title Section - Yellow Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#ffc107',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#ffc107',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
                  }}>
                    <TitleIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f57c00' }}>
                    Meta cím
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <TextField
                    fullWidth
                    label="Meta cím"
                    value={formData.meta_title}
                    onChange={handleInputChange('meta_title')}
                    helperText={`A keresőmotorokban megjelenő cím (50-60 karakter optimális, max 70) - Jelenleg: ${formData.meta_title.length} karakter`}
                    InputProps={{
                      endAdornment: (
                        <Button
                          size="small"
                          startIcon={generatingMeta.title ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                          onClick={() => handleGenerateMeta('title')}
                          disabled={generatingMeta.title || generatingMeta.keywords || generatingMeta.description}
                          sx={{ minWidth: 'auto', ml: 1 }}
                        >
                          {generatingMeta.title ? '' : 'AI'}
                        </Button>
                      )
                    }}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Meta Keywords Section - Green Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#4caf50',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                  }}>
                    <SearchIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                    Meta kulcsszavak
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <TextField
                    fullWidth
                    label="Meta kulcsszavak"
                    value={formData.meta_keywords}
                    onChange={handleInputChange('meta_keywords')}
                    helperText="Vesszővel elválasztott kulcsszavak (5-10 kulcsszó optimális)"
                    InputProps={{
                      endAdornment: (
                        <Button
                          size="small"
                          startIcon={generatingMeta.keywords ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                          onClick={() => handleGenerateMeta('keywords')}
                          disabled={generatingMeta.title || generatingMeta.keywords || generatingMeta.description}
                          sx={{ minWidth: 'auto', ml: 1 }}
                        >
                          {generatingMeta.keywords ? '' : 'AI'}
                        </Button>
                      )
                    }}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Meta Description Section - Purple Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#9c27b0',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#9c27b0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
                  }}>
                    <ArticleIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
                    Meta leírás
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="caption">
                      💡 <strong>ShopRenter dinamikus címkék:</strong> Használhatod a [PRODUCT], [CATEGORY], [PRICE], [SKU], [SERIAL] címkéket, amelyeket a ShopRenter automatikusan lecserél a tényleges értékekre. Az AI generálás automatikusan tartalmazza ezeket a címkéket.
                    </Typography>
                  </Alert>
                  <TextField
                    fullWidth
                    label="Meta leírás"
                    value={formData.meta_description}
                    onChange={handleInputChange('meta_description')}
                    multiline
                    rows={3}
                    helperText={`A keresőmotorokban megjelenő leírás (150-160 karakter optimális, max 160) - Jelenleg: ${formData.meta_description.length} karakter. Használhatod a [PRODUCT], [CATEGORY], [PRICE], [SKU], [SERIAL] címkéket.`}
                    InputProps={{
                      endAdornment: (
                        <Button
                          size="small"
                          startIcon={generatingMeta.description ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                          onClick={() => handleGenerateMeta('description')}
                          disabled={generatingMeta.title || generatingMeta.keywords || generatingMeta.description}
                          sx={{ minWidth: 'auto', ml: 1, alignSelf: 'flex-start', mt: 1 }}
                        >
                          {generatingMeta.description ? '' : 'AI'}
                        </Button>
                      )
                    }}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Images Section - Blue Theme - Compact */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#2196f3',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 0.75, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <PhotoLibraryIcon sx={{ color: 'white', fontSize: '20px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1rem' }}>
                    Termékképek
                  </Typography>
                </Box>
                <ProductImagesTab productId={product.id} hideBulkActions={true} />
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <SourceMaterialsTab productId={product.id} />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            {/* Quality Score Section - Blue Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#2196f3',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <AssessmentIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
                    Minőségi pontszám
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={calculatingQualityScore ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                    onClick={handleCalculateQualityScore}
                    disabled={calculatingQualityScore || loadingQualityScore}
                    sx={{ ml: 'auto' }}
                  >
                    {calculatingQualityScore ? 'Számítás...' : 'Számítás'}
                  </Button>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
                    A pontszám segít azonosítani, hogy milyen területeken lehet javítani a termék SEO és adatminőségén
                  </Typography>
                  {loadingQualityScore ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ProductQualityScore 
                      score={qualityScore} 
                      size="medium"
                      showBreakdown
                    />
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Search Console Section - Green Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#4caf50',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                  }}>
                    <SearchIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                    Search Console
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <SearchConsoleTab productId={product.id} productUrl={product.product_url} />
                </Box>
              </Paper>
            </Grid>

            {/* Competitor Prices Section - Orange Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#ff9800',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#ff9800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                  }}>
                    <StoreIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
                    Versenytárs árak
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <CompetitorPricesTab 
                    productId={product.id} 
                    productPrice={product.price}
                    productName={formData.name}
                    modelNumber={productData.model_number}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Sync Confirmation Dialog with VAT Check */}
      <Dialog
        open={syncConfirmOpen}
        onClose={handleSyncCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Szinkronizálás megerősítése
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body1" sx={{ mb: 2 }}>
              Biztosan szeretné szinkronizálni a termék adatait a webshopba?
            </Typography>

            {/* VAT Status Section */}
            {productData.vat_id && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  ÁFA beállítások:
                </Typography>
                
                {checkingVatMapping ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2">ÁFA leképezés ellenőrzése...</Typography>
                  </Box>
                ) : vatMappingStatus ? (
                  <>
                    {/* ERP VAT Rate */}
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        <strong>ERP ÁFA kulcs:</strong>{' '}
                        {vatRates.find(v => v.id === productData.vat_id)?.name || 'Ismeretlen'} 
                        ({vatRates.find(v => v.id === productData.vat_id)?.kulcs || 0}%)
                      </Typography>
                    </Box>

                    {/* ShopRenter TaxClass Status */}
                    {vatMappingStatus.hasMapping ? (
                      <Alert severity="success" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>ShopRenter adóosztály:</strong> {vatMappingStatus.shoprenterTaxClassName}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.85rem' }}>
                          ✓ A leképezés be van állítva. A termék a megfelelő ÁFA kulcsot fogja használni a ShopRenter-ben.
                        </Typography>
                      </Alert>
                    ) : (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          ⚠️ Nincs ÁFA leképezés beállítva!
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {vatMappingStatus.warning || 'Az ÁFA kulcs nincs leképezve a ShopRenter adóosztályokhoz.'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 1 }}>
                          <strong>Mi fog történni:</strong> A ShopRenter az <strong>alapértelmezett adóosztályt</strong> fogja használni, 
                          ami lehet, hogy <strong>nem egyezik meg</strong> az ERP-ben beállított ÁFA kulccsal.
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ReceiptIcon />}
                          onClick={() => {
                            setSyncConfirmOpen(false)
                            router.push(`/connections`)
                          }}
                          sx={{ mt: 1 }}
                        >
                          ÁFA leképezés beállítása
                        </Button>
                      </Alert>
                    )}
                  </>
                ) : null}
              </Box>
            )}

            {/* Sync Fields List */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Szinkronizált mezők:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li>Termék neve, leírás, SEO adatok</li>
              <li>Nettó ár: <strong>{productData.price ? parseFloat(productData.price.toString()).toLocaleString('hu-HU') : '0'} Ft</strong> (már tartalmazza a szorzót)</li>
              {productData.cost && (
                <li>Beszerzési ár: <strong>{parseFloat(productData.cost.toString()).toLocaleString('hu-HU')} Ft</strong> (csak információs, nem szinkronizálódik)</li>
              )}
              <li>Árazási szorzó: <strong>{productData.multiplier}</strong> (csak információs, ShopRenter-ben 1.0 lesz)</li>
              <li>ShopRenter számítás: <strong>Nettó ár × 1.0 × ÁFA</strong> (a szorzó már benne van a nettó árban)</li>
              {productData.vat_id && vatMappingStatus?.hasMapping && (
                <li>ÁFA kulcs: <strong>{vatRates.find(v => v.id === productData.vat_id)?.name}</strong> → ShopRenter: <strong>{vatMappingStatus.shoprenterTaxClassName}</strong></li>
              )}
              {productData.vat_id && vatMappingStatus && !vatMappingStatus.hasMapping && (
                <li>ÁFA kulcs: <strong>{vatRates.find(v => v.id === productData.vat_id)?.name}</strong> ⚠️ <strong>(nincs leképezés)</strong></li>
              )}
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleSyncCancel} disabled={syncing || checkingVatMapping}>
            Mégse
          </Button>
          <Button
            onClick={handleSyncConfirm}
            variant="contained"
            disabled={syncing || checkingVatMapping}
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            color={vatMappingStatus && !vatMappingStatus.hasMapping ? 'warning' : 'primary'}
          >
            {syncing ? 'Szinkronizálás...' : vatMappingStatus && !vatMappingStatus.hasMapping ? 'Szinkronizálás figyelmeztetéssel' : 'Szinkronizálás'}
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
