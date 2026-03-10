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
  InputLabel,
  Tooltip,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  InputAdornment,
  Radio,
  RadioGroup,
  FormControlLabel
} from '@mui/material'
import { Save as SaveIcon, Sync as SyncIcon, AutoAwesome as AutoAwesomeIcon, Link as LinkIcon, Refresh as RefreshIcon, FamilyRestroom as FamilyRestroomIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, Category as CategoryIcon, OpenInNew as OpenInNewIcon, Info as InfoIcon, Label as LabelIcon, Receipt as ReceiptIcon, AttachMoney as AttachMoneyIcon, Description as DescriptionIcon, Analytics as AnalyticsIcon, Calculate as CalculateIcon, PhotoLibrary as PhotoLibraryIcon, TextFields as ShortTextIcon, Settings as SettingsIcon, LocalOffer as LocalOfferIcon, Title as TitleIcon, Search as SearchIcon, Article as ArticleIcon, Assessment as AssessmentIcon, Store as StoreIcon, Add as AddIcon, Close as CloseIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import type { ProductWithDescriptions } from '@/lib/products-server'
import HtmlEditor from '@/components/HtmlEditor'
import SourceMaterialsTab from '@/components/SourceMaterialsTab'
import SearchConsoleTab from '@/components/SearchConsoleTab'
import ProductImagesTab from '@/components/ProductImagesTab'
import ProductQualityScore from '@/components/ProductQualityScore'
import { FeatureGate } from '@/components/FeatureGate'
import CustomerGroupPricingCard from '@/components/CustomerGroupPricingCard'
import AIPricingRecommendationsCard from '@/components/AIPricingRecommendationsCard'
import PromotionsCard from '@/components/PromotionsCard'
import ProductSuppliersCard from '@/components/products/ProductSuppliersCard'
import { useSubscription } from '@/lib/subscription-context'

interface ProductEditFormProps {
  product: ProductWithDescriptions | null // null for new products
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
  isLoaded?: boolean // New prop to control lazy loading
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, isLoaded = true, ...other } = props

  // If tab is not loaded yet, show loading state
  if (!isLoaded && value === index) {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`product-tabpanel-${index}`}
        aria-labelledby={`product-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <CircularProgress />
          </Box>
        )}
      </div>
    )
  }

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`product-tabpanel-${index}`}
      aria-labelledby={`product-tab-${index}`}
      {...other}
    >
      {value === index && isLoaded && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ProductEditForm({ product }: ProductEditFormProps) {
  const router = useRouter()
  const { hasFeature: hasFeatureAccess, canUseAI } = useSubscription()
  const isNewProduct = product === null
  
  // Connection selection state (for new products)
  const [connections, setConnections] = useState<Array<{ id: string; name: string; shop_name?: string; api_url: string; is_active: boolean }>>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  
  const [tabValue, setTabValue] = useState(0)
  // Track which tabs have been loaded (for lazy loading)
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set([0])) // Tab 0 (Alapadatok) loads immediately
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false)
  const [pulling, setPulling] = useState(false) // For pulling from ShopRenter
  
  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const initialFormStateRef = useRef<{
    formData: typeof formData
    productData: typeof productData
    productTags: string
    urlSlug: string
    attributes: any[]
    categories: any[]
    productClass: typeof productClass
  } | null>(null)
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
  const [generatingTags, setGeneratingTags] = useState(false)
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
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<any[]>([])
  const [loadingAvailableCategories, setLoadingAvailableCategories] = useState(false)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null)

  // Product Class state
  const [productClass, setProductClass] = useState<{ id: string; name: string } | null>(null)
  const [availableProductClasses, setAvailableProductClasses] = useState<Array<{ id: string; name: string }>>([])
  const [loadingProductClass, setLoadingProductClass] = useState(false)
  const [updatingProductClass, setUpdatingProductClass] = useState(false)
  const [loadingAvailableProductClasses, setLoadingAvailableProductClasses] = useState(false)
  const [productClassEditModalOpen, setProductClassEditModalOpen] = useState(false)
  const [selectedProductClassId, setSelectedProductClassId] = useState<string>('')
  const [productClassConfirmOpen, setProductClassConfirmOpen] = useState(false)
  const [productClassToUpdate, setProductClassToUpdate] = useState<{ 
    id: string
    name: string
    willClearAttributes?: boolean
    attributeCount?: number
  } | null>(null)

  // Attributes state
  const [attributes, setAttributes] = useState<any[]>([])
  const [editAttributeModalOpen, setEditAttributeModalOpen] = useState(false)
  const [deleteAttributeModalOpen, setDeleteAttributeModalOpen] = useState(false)
  const [attributeToEdit, setAttributeToEdit] = useState<any | null>(null)
  const [attributeToDelete, setAttributeToDelete] = useState<{ name: string; displayName: string } | null>(null)
  const [editingAttributeValue, setEditingAttributeValue] = useState<any>(null)
  const [addAttributeModalOpen, setAddAttributeModalOpen] = useState(false)
  const [availableAttributes, setAvailableAttributes] = useState<any[]>([])
  const [loadingAvailableAttributes, setLoadingAvailableAttributes] = useState(false)
  const [selectedAttributeToAdd, setSelectedAttributeToAdd] = useState<string>('')
  const [newAttributeValue, setNewAttributeValue] = useState<any>(null)
  // List attribute values for edit modal
  const [listAttributeValues, setListAttributeValues] = useState<Array<{ id: string; value: string; displayValue: string }>>([])
  const [loadingListAttributeValues, setLoadingListAttributeValues] = useState(false)
  // List attribute values for add modal
  const [newListAttributeValues, setNewListAttributeValues] = useState<Array<{ id: string; value: string; displayValue: string }>>([])
  const [loadingNewListAttributeValues, setLoadingNewListAttributeValues] = useState(false)

  // Parent product editing state
  const [parentProductModalOpen, setParentProductModalOpen] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [loadingAvailableProducts, setLoadingAvailableProducts] = useState(false)
  const [parentProductSearchTerm, setParentProductSearchTerm] = useState('')
  const [selectedParentProductId, setSelectedParentProductId] = useState<string | null>(null)
  const [selectedParentProductData, setSelectedParentProductData] = useState<any | null>(null)
  const [updatingParentProduct, setUpdatingParentProduct] = useState(false)

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
  const huDescription = product ? (product.descriptions.find(d => d.language_code === 'hu') || {
    id: '',
    product_id: product?.id || '',
    language_code: 'hu',
    name: product?.name || '',
    meta_title: '',
    meta_keywords: '',
    meta_description: '',
    short_description: '',
    description: '',
    parameters: null,
    measurement_unit: 'db', // Default to 'db'
    generation_instructions: null,
    shoprenter_id: null,
    created_at: '',
    updated_at: ''
  }) : {
    id: '',
    product_id: '',
    language_code: 'hu',
    name: '',
    meta_title: '',
    meta_keywords: '',
    meta_description: '',
    short_description: '',
    description: '',
    parameters: null,
    measurement_unit: 'db', // Default to 'db'
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
    parameters: (huDescription as any).parameters || '', // Add parameters field
    measurement_unit: (huDescription as any).measurement_unit || 'db' // Add measurement_unit field
  })

  // Product tags state (language-specific, comma-separated)
  const [productTags, setProductTags] = useState<string>('')
  const [loadingProductTags, setLoadingProductTags] = useState(false)
  const [tagsReloadKey, setTagsReloadKey] = useState(0) // Key to force reload of tags

  // Product basic data (separate from description)
  const [productData, setProductData] = useState({
    sku: product?.sku || '',
    model_number: product?.model_number || '',
    gtin: product?.gtin || '',  // Vonalkód (Barcode/GTIN)
    internal_barcode: (product as any)?.internal_barcode || '',  // Internal barcode
    manufacturer_id: (product as any)?.manufacturer_id || null, // ShopRenter manufacturer ID
    erp_manufacturer_id: (product as any)?.erp_manufacturer_id || null, // ERP manufacturer ID
    unit_id: (product as any)?.unit_id || null, // ERP unit ID (source of truth)
    // Dimensions
    width: (product as any)?.width || '',
    height: (product as any)?.height || '',
    length: (product as any)?.length || '',
    weight: (product as any)?.weight || '',
    erp_weight_unit_id: (product as any)?.erp_weight_unit_id || null, // ERP weight unit ID
    // Pricing fields (Árazás)
    price: product?.price ?? '',
    cost: product?.cost ?? '',
    multiplier: product?.multiplier ?? 1.0,
    multiplier_lock: product?.multiplier_lock ?? false,
    vat_id: (product as any)?.vat_id || null,
    gross_price: (product as any)?.gross_price || null
  })
  
  // Manufacturers state (ERP manufacturers, not ShopRenter)
  const [manufacturers, setManufacturers] = useState<Array<{ id: string; name: string; description: string | null; website: string | null }>>([])
  const [loadingManufacturers, setLoadingManufacturers] = useState(false)
  
  // Units state
  const [units, setUnits] = useState<Array<{ id: string; name: string; shortform: string }>>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  // Weight units state
  const [weightUnits, setWeightUnits] = useState<Array<{ id: string; name: string; shortform: string; shoprenter_weight_class_id?: string | null }>>([])
  const [loadingWeightUnits, setLoadingWeightUnits] = useState(false)

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

  // SKU validation state
  const [skuValidationError, setSkuValidationError] = useState<string | null>(null)
  const [isValidatingSku, setIsValidatingSku] = useState(false)
  const skuValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
      
      // Calculate gross price immediately
      const vat = vatRates.find(v => v.id === prev.vat_id)
      const newGrossPrice = vat && netPrice > 0 
        ? Math.round(netPrice * (1 + vat.kulcs / 100))
        : null
      
      if (newGrossPrice !== null) {
        setGrossPrice(newGrossPrice)
      }
      
      return {
        ...prev,
        price: value,
        multiplier: cost > 0 ? Math.round(newMultiplier * 1000) / 1000 : prev.multiplier
      }
    })
  }

  // Handle VAT change (recalculate gross)
  const handleVatChange = (vatId: string) => {
    setProductData(prev => {
      const vat = vatRates.find(v => v.id === vatId)
      const currentPrice = parseFloat(prev.price.toString() || '0')
      // Recalculate gross price immediately when VAT changes
      const newGrossPrice = vat && currentPrice > 0 
        ? Math.round(currentPrice * (1 + vat.kulcs / 100))
        : null
      
      if (newGrossPrice !== null) {
        setGrossPrice(newGrossPrice)
      } else {
        setGrossPrice(null)
      }
      
      return { ...prev, vat_id: vatId }
    })
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
      
      // Recalculate gross price if net price and VAT exist
      const vat = vatRates.find(v => v.id === prev.vat_id)
      const newGrossPrice = vat && currentPrice > 0 
        ? Math.round(currentPrice * (1 + vat.kulcs / 100))
        : null
      
      if (newGrossPrice !== null) {
        setGrossPrice(newGrossPrice)
      }
      
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
      
      // Calculate gross price immediately
      const vat = vatRates.find(v => v.id === prev.vat_id)
      const newGrossPrice = vat && newNetPrice > 0 
        ? Math.round(newNetPrice * (1 + vat.kulcs / 100))
        : null
      
      if (newGrossPrice !== null) {
        setGrossPrice(newGrossPrice)
      }
      
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
      if (!product?.id) {
        return { hasMapping: false, shoprenterTaxClassName: null, warning: 'Termék ID hiányzik' }
      }
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
    // Mark tab as loaded when first opened (for lazy loading)
    setLoadedTabs(prev => new Set([...prev, newValue]))
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

      // Validation for new products
      if (isNewProduct) {
        // Required fields: connection_id, sku, name, cost
        if (!selectedConnectionId) {
          toast.error('Kapcsolat kiválasztása kötelező')
          setSaving(false)
          return
        }
        if (!productData.sku || !productData.sku.trim()) {
          toast.error('SKU kötelező mező')
          setSaving(false)
          return
        }
        if (skuValidationError) {
          toast.error('A SKU már létezik, válasszon másikat')
          setSaving(false)
          return
        }
        if (isValidatingSku) {
          toast.error('Kérjük várjon, amíg a SKU ellenőrzése befejeződik')
          setSaving(false)
          return
        }
        if (!formData.name || !formData.name.trim()) {
          toast.error('Termék neve kötelező mező')
          setSaving(false)
          return
        }
        const cost = parseFloat(productData.cost.toString() || '0')
        if (!cost || cost <= 0) {
          toast.error('Beszerzési ár kötelező mező és nagyobbnak kell lennie, mint 0')
          setSaving(false)
          return
        }
      }

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

      // Create new product
      if (isNewProduct) {
        const productToCreate = {
          connection_id: selectedConnectionId,
          sku: productData.sku.trim(),
          name: formData.name.trim(),
          model_number: productData.model_number.trim() || null,
          gtin: productData.gtin.trim() || null,
          internal_barcode: productData.internal_barcode.trim() || null,
          manufacturer_id: productData.manufacturer_id || null, // ShopRenter manufacturer ID
          erp_manufacturer_id: productData.erp_manufacturer_id || null, // ERP manufacturer ID
          width: productData.width ? parseFloat(String(productData.width)) : null,
          height: productData.height ? parseFloat(String(productData.height)) : null,
          length: productData.length ? parseFloat(String(productData.length)) : null,
          weight: productData.weight ? parseFloat(String(productData.weight)) : null,
          erp_weight_unit_id: productData.erp_weight_unit_id || null,
          cost: cost.toString(),
          multiplier: multiplier.toString(),
          vat_id: productData.vat_id || null,
          category_ids: selectedCategoryIds.length > 0 ? selectedCategoryIds : [],
          product_class_shoprenter_id: productClass?.id || null,
          product_attributes: attributes.length > 0 ? attributes : null,
          parent_product_id: selectedParentProductId || null,
          short_description: formData.short_description || null,
          description: formData.description || null,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          url_slug: urlSlug.trim() || null
        }

        const createResponse = await fetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(productToCreate)
        })

        const createResult = await createResponse.json()
        if (!createResult.success) {
          toast.error(`Termék létrehozása sikertelen: ${createResult.error || 'Ismeretlen hiba'}`)
          setSaving(false)
          return
        }

        toast.success('Termék sikeresen létrehozva!')
        // Redirect to product edit page
        router.push(`/products/${createResult.product.id}`)
        return
      }

      // Get unit shortform from unit_id for ShopRenter sync
      const selectedUnit = units.find(u => u.id === productData.unit_id)
      const unitShortform = selectedUnit?.shortform || 'db'

      // Update existing product
      // Save product basic data (sku, model_number, gtin, pricing)
      const productDataToSave = {
        model_number: productData.model_number.trim() || null,
        gtin: productData.gtin.trim() || null,  // Vonalkód
        internal_barcode: productData.internal_barcode.trim() || null,  // Internal barcode
        manufacturer_id: productData.manufacturer_id || null, // ShopRenter manufacturer ID
        erp_manufacturer_id: productData.erp_manufacturer_id || null, // ERP manufacturer ID
        unit_id: productData.unit_id || null, // ERP unit ID (source of truth)
        // Dimensions
        width: productData.width ? parseFloat(String(productData.width)) : null,
        height: productData.height ? parseFloat(String(productData.height)) : null,
        length: productData.length ? parseFloat(String(productData.length)) : null,
        weight: productData.weight ? parseFloat(String(productData.weight)) : null,
        erp_weight_unit_id: productData.erp_weight_unit_id || null,
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
      // measurement_unit is derived from unit_id for ShopRenter sync compatibility
      const dataToSave = {
        language_code: 'hu',
        name: formData.name,
        meta_title: formData.meta_title,
        meta_keywords: formData.meta_keywords,
        meta_description: formData.meta_description,
        short_description: encodeHtmlEntities(formData.short_description),
        description: encodeHtmlEntities(formData.description),
        parameters: formData.parameters || null, // Add parameters field
        measurement_unit: unitShortform, // Derived from unit_id for ShopRenter sync
        generation_instructions: formData.generation_instructions.trim() || null
      }

      const response = await fetch(`/api/products/${product!.id}/descriptions`, {
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
        if (product?.id) {
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
        }

        // Save URL alias if it has changed
        if (product?.id && urlSlug.trim() && urlSlug.trim() !== originalUrlSlug) {
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
        
        // Update initial state after successful save
        if (initialFormStateRef.current) {
          initialFormStateRef.current = {
            formData: JSON.parse(JSON.stringify(formData)),
            productData: JSON.parse(JSON.stringify(productData)),
            productTags: productTags,
            urlSlug: urlSlug,
            attributes: JSON.parse(JSON.stringify(attributes)),
            categories: JSON.parse(JSON.stringify(categories)),
            productClass: productClass ? { ...productClass } : null
          }
        }
        // Update initial state after successful save
        if (initialFormStateRef.current) {
          initialFormStateRef.current = {
            formData: JSON.parse(JSON.stringify(formData)),
            productData: JSON.parse(JSON.stringify(productData)),
            productTags: productTags,
            urlSlug: urlSlug,
            attributes: JSON.parse(JSON.stringify(attributes)),
            categories: JSON.parse(JSON.stringify(categories)),
            productClass: productClass ? { ...productClass } : null
          }
        }
        setHasUnsavedChanges(false)
        
        // Refresh the page to get updated product data (including updated_at and last_synced_to_shoprenter_at)
        // This ensures the sync button status is updated correctly
        setTimeout(() => {
          window.location.reload()
        }, 500)
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
    if (!product?.id) return
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
        // Full page refresh to display updated data
        setTimeout(() => {
          window.location.reload()
        }, 1000) // Small delay to show success toast
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
    if (!product?.id) return
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
        // Full page refresh to display updated data
        setTimeout(() => {
          window.location.reload()
        }, 1000) // Small delay to show success toast
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
    if (!product?.id) return
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
  }, [product?.id])

  // Load parent/child relationships
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

  // Load manufacturers (ERP manufacturers, global)
  const loadManufacturers = async () => {
    try {
      setLoadingManufacturers(true)
      const response = await fetch('/api/manufacturers')
      if (response.ok) {
        const result = await response.json()
        if (result.manufacturers) {
          setManufacturers(result.manufacturers)
        }
      }
    } catch (error) {
      console.error('Error loading manufacturers:', error)
    } finally {
      setLoadingManufacturers(false)
    }
  }

  // Load units
  const loadUnits = async () => {
    try {
      setLoadingUnits(true)
      const response = await fetch('/api/units')
      const result = await response.json()
      if (result.units) {
        setUnits(result.units)
      }
    } catch (error) {
      console.error('Error loading units:', error)
    } finally {
      setLoadingUnits(false)
    }
  }

  // Load weight units
  const loadWeightUnits = async () => {
    try {
      setLoadingWeightUnits(true)
      const response = await fetch('/api/weight-units')
      if (response.ok) {
        const result = await response.json()
        if (result.weightUnits) {
          setWeightUnits(result.weightUnits)
        }
      }
    } catch (error) {
      console.error('Error loading weight units:', error)
    } finally {
      setLoadingWeightUnits(false)
    }
  }

  // Function to check if form has unsaved changes
  // Normalize value for comparison (handles string/number conversion)
  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined || value === '') return null
    // Try to convert to number if it's a numeric string
    if (typeof value === 'string' && value.trim() !== '') {
      const num = Number(value)
      if (!isNaN(num) && isFinite(num)) {
        return num
      }
    }
    return value
  }

  // Deep equality helper for objects
  const deepEqual = (obj1: any, obj2: any): boolean => {
    // Normalize and compare primitive values
    const norm1 = normalizeValue(obj1)
    const norm2 = normalizeValue(obj2)
    
    if (norm1 === norm2) return true
    if (norm1 == null || norm2 == null) return norm1 === norm2
    if (typeof norm1 !== 'object' || typeof norm2 !== 'object') {
      // For primitives, compare normalized values
      return norm1 === norm2
    }
    
    const keys1 = Object.keys(norm1).sort()
    const keys2 = Object.keys(norm2).sort()
    
    if (keys1.length !== keys2.length) return false
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false
      if (!deepEqual(norm1[key], norm2[key])) return false
    }
    
    return true
  }

  // Deep equality helper for arrays
  const arraysEqual = (arr1: any[], arr2: any[]): boolean => {
    if (arr1.length !== arr2.length) return false
    // Sort arrays by a stable key (id if available) before comparing
    const sorted1 = [...arr1].sort((a, b) => {
      const keyA = a.id || JSON.stringify(a)
      const keyB = b.id || JSON.stringify(b)
      return keyA > keyB ? 1 : keyA < keyB ? -1 : 0
    })
    const sorted2 = [...arr2].sort((a, b) => {
      const keyA = a.id || JSON.stringify(a)
      const keyB = b.id || JSON.stringify(b)
      return keyA > keyB ? 1 : keyA < keyB ? -1 : 0
    })
    
    return sorted1.every((item, index) => deepEqual(item, sorted2[index]))
  }

  const checkForUnsavedChanges = () => {
    if (!initialFormStateRef.current) return false
    
    const initial = initialFormStateRef.current
    
    // Compare formData using deep equality
    const formDataChanged = !deepEqual(formData, initial.formData)
    
    // Compare productData using deep equality
    const productDataChanged = !deepEqual(productData, initial.productData)
    
    // Compare productTags (simple string comparison)
    const tagsChanged = productTags !== initial.productTags
    
    // Compare urlSlug (simple string comparison)
    const urlSlugChanged = urlSlug !== initial.urlSlug
    
    // Compare attributes using array deep equality
    const attributesChanged = !arraysEqual(attributes, initial.attributes)
    
    // Compare categories (compare by id only, sorted)
    const categoriesChanged = !arraysEqual(
      categories.map(c => ({ id: c.id })),
      initial.categories.map(c => ({ id: c.id }))
    )
    
    // Compare productClass (compare by id only)
    const productClassChanged = (productClass?.id || null) !== (initial.productClass?.id || null)
    
    return formDataChanged || productDataChanged || tagsChanged || urlSlugChanged || attributesChanged || categoriesChanged || productClassChanged
  }

  // Check if product needs to be synced to ShopRenter
  // This only checks saved database state, not unsaved form changes
  const needsSync = (): boolean => {
    if (!product || isNewProduct) return false
    
    // Check if product was updated after last sync (only saved changes matter)
    const lastSyncedTo = (product as any)?.last_synced_to_shoprenter_at
    const updatedAt = product.updated_at
    
    // If never synced, needs sync
    if (!lastSyncedTo) {
      return true
    }
    
    // If ERP was updated after last sync, needs sync
    if (updatedAt && lastSyncedTo) {
      try {
        const updatedAtDate = new Date(updatedAt)
        const lastSyncedDate = new Date(lastSyncedTo)
        
        // Add a small buffer (1 second) to handle timestamp precision issues
        // If updated_at is more than 1 second newer than last_synced_to, it needs sync
        const timeDiff = updatedAtDate.getTime() - lastSyncedDate.getTime()
        const needsSyncResult = timeDiff > 1000 // More than 1 second difference
        
        return needsSyncResult
      } catch (error) {
        // If date parsing fails, assume needs sync
        console.error('Error parsing dates for sync check:', error)
        return true
      }
    }
    
    return false
  }

  // Handle navigation with unsaved changes check
  const handleNavigation = (url: string, e?: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      e?.preventDefault()
      setPendingNavigation(url)
      setShowUnsavedDialog(true)
      return false
    }
    return true
  }

  // Intercept link clicks within the component
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href]') as HTMLAnchorElement
      
      if (link && link.href) {
        const url = new URL(link.href)
        // Only intercept internal navigation (same origin)
        if (url.origin === window.location.origin) {
          const pathname = url.pathname
          // Don't intercept if navigating to the same page
          if (pathname !== window.location.pathname) {
            e.preventDefault()
            setPendingNavigation(pathname)
            setShowUnsavedDialog(true)
          }
        }
      }
    }

    document.addEventListener('click', handleLinkClick, true)
    return () => document.removeEventListener('click', handleLinkClick, true)
  }, [hasUnsavedChanges])

  // Initialize initial form state ref (after formData and productData are set)
  const initializationDoneRef = useRef(false)
  const initializationTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Initialize only once when component mounts and all async data is loaded
  useEffect(() => {
    // Only initialize once
    if (initializationDoneRef.current) return
    
    // For existing products, wait until async data has finished loading
    // For new products, we can initialize immediately
    const shouldWait = !isNewProduct && (
      !product?.id || 
      !formData.name || 
      loadingCategories || 
      loadingProductClass
    )
    
    if (shouldWait) {
      // Data not ready yet, wait a bit more
      return
    }
    
    // Clear any pending timer
    if (initializationTimerRef.current) {
      clearTimeout(initializationTimerRef.current)
    }
    
    // Wait a bit to ensure all state is properly initialized
    initializationTimerRef.current = setTimeout(() => {
      if (!initialFormStateRef.current && !initializationDoneRef.current) {
        initialFormStateRef.current = {
          formData: JSON.parse(JSON.stringify(formData)),
          productData: JSON.parse(JSON.stringify(productData)),
          productTags: productTags,
          urlSlug: urlSlug,
          attributes: JSON.parse(JSON.stringify(attributes)),
          categories: JSON.parse(JSON.stringify(categories)),
          productClass: productClass ? { ...productClass } : null
        }
        initializationDoneRef.current = true
        // Explicitly set to false after initialization to prevent false positives
        setHasUnsavedChanges(false)
      }
    }, 200) // Short delay to ensure state is stable
    
    return () => {
      if (initializationTimerRef.current) {
        clearTimeout(initializationTimerRef.current)
      }
    }
  }, [isNewProduct, product?.id, formData.name, loadingCategories, loadingProductClass]) // Wait for async data to load

  // Detect unsaved changes (only after initialization is complete)
  useEffect(() => {
    // Don't check until initial state is properly set
    if (!initializationDoneRef.current || !initialFormStateRef.current) {
      // Explicitly set to false during initialization to prevent false positives
      setHasUnsavedChanges(false)
      // Clean up title during initialization
      document.title = document.title.replace(/^•\s*/, '')
      return
    }
    
    // Only check for changes after initialization is complete
    const hasChanges = checkForUnsavedChanges()
    setHasUnsavedChanges(hasChanges)
    
    // Update page title
    if (hasChanges) {
      const originalTitle = document.title
      if (!originalTitle.includes('•')) {
        document.title = `• ${originalTitle}`
      }
    } else {
      document.title = document.title.replace(/^•\s*/, '')
    }
  }, [formData, productData, productTags, urlSlug, attributes, categories, productClass])

  // Browser-level protection (beforeunload)
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Required for Chrome
      return '' // Required for Safari
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Load manufacturers on mount (global, not connection-specific)
  useEffect(() => {
    loadManufacturers()
  }, [])
  
  // Load units on mount
  useEffect(() => {
    loadUnits()
    loadWeightUnits()
  }, [])

  // Load connections (for both new and existing products - needed for connection name display)
  // This is critical, load immediately
  useEffect(() => {
    const loadConnections = async () => {
      setLoadingConnections(true)
      try {
        const response = await fetch('/api/connections')
        if (response.ok) {
          const data = await response.json()
          const connectionsList = Array.isArray(data) ? data : (data.connections || [])
          const shoprenterConnections = connectionsList.filter(
            (conn: any) => conn.connection_type === 'shoprenter' && conn.is_active
          )
          setConnections(shoprenterConnections)
          // Auto-select first connection if only one (for new products)
          if (isNewProduct && shoprenterConnections.length === 1) {
            setSelectedConnectionId(shoprenterConnections[0].id)
          }
        }
      } catch (error) {
        console.error('Error loading connections:', error)
        toast.error('Hiba a kapcsolatok betöltésekor')
      } finally {
        setLoadingConnections(false)
      }
    }
    loadConnections()
  }, [isNewProduct])

  // Defer non-critical data loading by 200ms to prioritize critical data
  useEffect(() => {
    if (!product?.id) return
    
    // Defer non-critical API calls to improve initial load time
    const timer = setTimeout(() => {
      loadVariants()
      
      // Load quality score (non-critical, can wait)
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
    }, 200) // Defer by 200ms
    
    return () => clearTimeout(timer)
  }, [product?.id])

  // Load product tags on mount
  useEffect(() => {
    if (!product?.id) return
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
    
    if (product?.id) {
      loadProductTags()
    }
  }, [product?.id, tagsReloadKey]) // Reload when tagsReloadKey changes

  // Load categories
    const loadCategories = async () => {
      if (!product?.id) {
        setCategories([])
        return
      }
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
    
  useEffect(() => {
    if (product?.id) {
      loadCategories()
    }
  }, [product?.id])

  // Load Product Class
  const loadProductClass = async () => {
    if (!product?.id) {
      setProductClass(null)
      return
    }
    try {
      setLoadingProductClass(true)
      const response = await fetch(`/api/products/${product.id}/product-class`)
      const result = await response.json()
      
      if (result.success) {
        setProductClass(result.productClass)
      }
    } catch (error) {
      console.error('Error loading product class:', error)
    } finally {
      setLoadingProductClass(false)
    }
  }

  // Load available Product Classes
  const loadAvailableProductClasses = async () => {
    try {
      setLoadingAvailableProductClasses(true)
      // Try multiple ways to get connection_id
      const connectionId = isNewProduct 
        ? selectedConnectionId
        : ((product as any)?.connection_id || 
           (product as any)?.webshop_connections?.id ||
           (product as any)?.webshop_connection_id)
      
      if (!connectionId) {
        if (isNewProduct) {
          setAvailableProductClasses([])
          return
        }
        console.error('No connection_id found in product:', product)
        toast.error('A termékhez nincs kapcsolat rendelve')
        return
      }

      console.log('[PRODUCT-CLASS] Loading Product Classes for connection:', connectionId)
      const response = await fetch(`/api/connections/${connectionId}/product-classes`)
      const result = await response.json()
      
      console.log('[PRODUCT-CLASS] API response:', result)
      
      if (result.success && result.productClasses) {
        console.log('[PRODUCT-CLASS] Loaded Product Classes:', result.productClasses.length)
        setAvailableProductClasses(result.productClasses)
      } else {
        console.error('[PRODUCT-CLASS] API error:', result.error)
        toast.error(result.error || 'Hiba a termék típusok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading available product classes:', error)
      toast.error('Hiba a termék típusok betöltésekor')
    } finally {
      setLoadingAvailableProductClasses(false)
    }
  }

  // Handle open Product Class edit modal
  const handleOpenProductClassEditModal = async () => {
    setSelectedProductClassId(productClass?.id || '')
    setProductClassEditModalOpen(true)
    // Load available product classes when opening modal (for new products, this ensures they're loaded)
    await loadAvailableProductClasses()
  }

  // Handle close Product Class edit modal
  const handleCloseProductClassEditModal = () => {
    setProductClassEditModalOpen(false)
    setSelectedProductClassId('')
  }

  // Handle confirm Product Class change
  const handleConfirmProductClassChange = () => {
    const newProductClassName = availableProductClasses.find(pc => pc.id === selectedProductClassId)?.name || 'Ismeretlen'
    const attributeCount = attributes.length
    const willClearAttributes = attributeCount > 0 && productClass?.id !== selectedProductClassId
    
    setProductClassToUpdate({ 
      id: selectedProductClassId, 
      name: newProductClassName,
      willClearAttributes: willClearAttributes,
      attributeCount: attributeCount
    })
    setProductClassConfirmOpen(true)
    setProductClassEditModalOpen(false)
  }

  // Update Product Class
  const handleProductClassChange = async () => {
    if (!productClassToUpdate) return
    if (productClassToUpdate.id === productClass?.id) {
      setProductClassConfirmOpen(false)
      setProductClassToUpdate(null)
      return // No change
    }

    // For new products, just update local state
    if (isNewProduct) {
      const newProductClass = availableProductClasses.find(pc => pc.id === productClassToUpdate.id)
      if (newProductClass) {
        setProductClass({ id: productClassToUpdate.id, name: productClassToUpdate.name })
        // Clear attributes when product class changes
        setAttributes([])
        setProductClassConfirmOpen(false)
        setProductClassToUpdate(null)
        toast.success('Termék típusa frissítve')
      }
      return
    }

    // Check for unsaved changes (pending sync)
    if (product.sync_status === 'pending') {
      const confirmed = window.confirm(
        'A terméknek vannak nem szinkronizált változásai. A termék típus megváltoztatása előtt ajánlott szinkronizálni. Folytatja?'
      )
      if (!confirmed) {
        setProductClassConfirmOpen(false)
        setProductClassToUpdate(null)
        return
      }
    }

    // Check for variants
    if (variantData?.isParent && variantData.childCount > 0) {
      const confirmed = window.confirm(
        `Ez a termék ${variantData.childCount} variánst tartalmaz. A termék típus megváltoztatása csak ezt a terméket érinti, a variánsok termék típusa nem változik meg. Folytatja?`
      )
      if (!confirmed) {
        setProductClassConfirmOpen(false)
        setProductClassToUpdate(null)
        return
      }
    }

    try {
      setUpdatingProductClass(true)
      const response = await fetch(`/api/products/${product.id}/product-class`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productClassId: productClassToUpdate.id })
      })

      const result = await response.json()

      if (result.success) {
        setProductClass(result.productClass)
        // Clear attributes immediately in UI
        setAttributes([])
        // Close all modals
        setAddAttributeModalOpen(false)
        setEditAttributeModalOpen(false)
        setDeleteAttributeModalOpen(false)
        setProductClassConfirmOpen(false)
        // Clear selections
        setSelectedAttributeToAdd('')
        setNewAttributeValue(null)
        setNewListAttributeValues([])
        setProductClassToUpdate(null)
        toast.success(result.message || 'Termék típusa frissítve')
        // Reload product to get updated attributes
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba a termék típus frissítésekor')
      }
    } catch (error) {
      console.error('Error updating product class:', error)
      toast.error('Hiba a termék típus frissítésekor')
    } finally {
      setUpdatingProductClass(false)
      setProductClassConfirmOpen(false)
      setProductClassToUpdate(null)
    }
  }

  // Load attributes from product
  useEffect(() => {
    if (product?.product_attributes && Array.isArray(product.product_attributes)) {
      setAttributes(product.product_attributes)
    } else if (isNewProduct) {
      setAttributes([])
    }
  }, [product?.product_attributes, isNewProduct])

  // Load available attributes when add modal opens
  const loadAvailableAttributes = async () => {
    if (isNewProduct) {
      // For new products, use the new endpoint
      if (!selectedConnectionId || !productClass?.id) {
        setAvailableAttributes([])
        return
      }
      try {
        setLoadingAvailableAttributes(true)
        const response = await fetch(`/api/products/new/attributes/available?connectionId=${selectedConnectionId}&productClassId=${productClass.id}`)
        const result = await response.json()
        if (result.success) {
          setAvailableAttributes(result.attributes || [])
        } else {
          toast.error(result.error || 'Hiba az attribútumok betöltésekor')
          setAvailableAttributes([])
        }
      } catch (error) {
        console.error('Error loading available attributes:', error)
        toast.error('Hiba az attribútumok betöltésekor')
        setAvailableAttributes([])
      } finally {
        setLoadingAvailableAttributes(false)
      }
      return
    }
    
    if (!product?.id) {
      setAvailableAttributes([])
      return
    }
    
    try {
      setLoadingAvailableAttributes(true)
      const response = await fetch(`/api/products/${product.id}/attributes/available`)
      const result = await response.json()
      
      if (result.success) {
        setAvailableAttributes(result.attributes || [])
      } else {
        toast.error(result.error || 'Hiba az elérhető attribútumok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading available attributes:', error)
      toast.error('Hiba az elérhető attribútumok betöltésekor')
    } finally {
      setLoadingAvailableAttributes(false)
    }
  }

  // Handle open add attribute modal
  const handleOpenAddAttributeModal = () => {
    setAddAttributeModalOpen(true)
    loadAvailableAttributes()
  }

  // Handle close add attribute modal
  const handleCloseAddAttributeModal = () => {
    setAddAttributeModalOpen(false)
    setSelectedAttributeToAdd('')
    setNewAttributeValue(null)
    setNewListAttributeValues([])
  }

  // Handle open edit attribute modal
  const handleOpenEditAttributeModal = async (attribute: any) => {
    setAttributeToEdit(attribute)
    
    // Extract current value ID if it's an object
    let currentValueId: string | null = null
    if (Array.isArray(attribute.value) && attribute.value[0]?.id) {
      currentValueId = attribute.value[0].id
      setEditingAttributeValue(currentValueId)
    } else if (typeof attribute.value === 'string') {
      currentValueId = attribute.value
      setEditingAttributeValue(currentValueId)
    } else {
      setEditingAttributeValue(attribute.value)
    }
    
    setEditAttributeModalOpen(true)
    
    // If it's a LIST attribute, fetch all available values
    if (attribute.type === 'LIST') {
      setLoadingListAttributeValues(true)
      try {
        const response = await fetch(`/api/products/${product.id}/attributes/${encodeURIComponent(attribute.name)}/values`)
        const result = await response.json()
        
        if (result.success) {
          setListAttributeValues(result.values || [])
        } else {
          toast.error(result.error || 'Hiba az elérhető értékek betöltésekor')
          setListAttributeValues([])
        }
      } catch (error) {
        console.error('Error loading list attribute values:', error)
        toast.error('Hiba az elérhető értékek betöltésekor')
        setListAttributeValues([])
      } finally {
        setLoadingListAttributeValues(false)
      }
    } else {
      setListAttributeValues([])
    }
  }

  // Handle close edit attribute modal
  const handleCloseEditAttributeModal = () => {
    setEditAttributeModalOpen(false)
    setAttributeToEdit(null)
    setEditingAttributeValue(null)
    setListAttributeValues([])
  }

  // Handle save attribute edit
  const handleSaveAttributeEdit = async () => {
    if (!attributeToEdit) return

    try {
      // For LIST attributes, we need to format the value correctly
      // The ShopRenter API expects an array containing the listAttributeValueDescription object
      // This format matches what we get from productAttributeExtend during sync
      let valueToSave = editingAttributeValue
      
      if (attributeToEdit.type === 'LIST' && editingAttributeValue) {
        // Find the full value object from listAttributeValues
        // The editingAttributeValue is the listAttributeValueDescription ID
        const selectedValue = listAttributeValues.find(v => {
          // Match by the listAttributeValueDescription ID (v.id) or by valueId
          return v.id === editingAttributeValue || v.valueId === editingAttributeValue
        })
        
        if (selectedValue) {
          // Format as array with listAttributeValueDescription object (matching ShopRenter format)
          // IMPORTANT: Also store the listAttributeValue ID (valueId) so we can sync it directly
          // This matches the format we see in productAttributeExtend during sync
          valueToSave = [{
            id: selectedValue.id, // listAttributeValueDescription ID
            href: selectedValue.href || '',
            value: selectedValue.displayValue || selectedValue.value,
            language: selectedValue.language || {
              id: 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==',
              href: ''
            },
            // Store the listAttributeValue ID for direct syncing (avoids extra API calls)
            listAttributeValueId: selectedValue.valueId || null
          }]
          console.log(`[ATTRIBUTE-EDIT] Saving LIST attribute "${attributeToEdit.name}" with value:`, valueToSave)
        } else {
          // Fallback: if we can't find the full object, use the ID as string
          // This should not happen, but handle gracefully
          console.warn(`[ATTRIBUTE-EDIT] Could not find full value object for ID: ${editingAttributeValue}`)
          valueToSave = editingAttributeValue
        }
      }

      // For new products, just update local state
      if (isNewProduct) {
        const attrIndex = attributes.findIndex((attr: any) => 
          (attr.id || attr.attribute_shoprenter_id) === (attributeToEdit.id || attributeToEdit.attribute_shoprenter_id)
        )
        if (attrIndex !== -1) {
          const updated = [...attributes]
          updated[attrIndex] = {
            ...updated[attrIndex],
            value: valueToSave,
            ...(attributeToEdit.type === 'LIST' && {
              listAttributeValueId: editingAttributeValue,
              listAttributeValueDisplay: listAttributeValues.find(v => v.id === editingAttributeValue)?.displayValue || editingAttributeValue
            })
          }
          setAttributes(updated)
          toast.success('Attribútum frissítve')
          handleCloseEditAttributeModal()
        }
        return
      }

      if (!product?.id) {
        toast.error('Termék ID hiányzik')
        return
      }

      const response = await fetch(`/api/products/${product.id}/attributes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attributeName: attributeToEdit.name,
          value: valueToSave
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Attribútum frissítve')
        handleCloseEditAttributeModal()
        // Reload product to get updated attributes
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba az attribútum frissítésekor')
      }
    } catch (error) {
      console.error('Error updating attribute:', error)
      toast.error('Hiba az attribútum frissítésekor')
    }
  }

  // Handle delete attribute - open modal
  const handleDeleteAttribute = (attribute: any) => {
    const displayName = attribute.display_name || attribute.name || 'Ismeretlen'
    setAttributeToDelete({ name: attribute.name, displayName })
    setDeleteAttributeModalOpen(true)
  }

  // Confirm delete attribute
  const handleConfirmDeleteAttribute = async () => {
    if (!attributeToDelete) return

    // For new products, just update local state
    if (isNewProduct) {
      setAttributes(prev => prev.filter((attr: any) => 
        (attr.name || attr.display_name) !== attributeToDelete.name &&
        (attr.name || attr.display_name) !== attributeToDelete.displayName
      ))
      setDeleteAttributeModalOpen(false)
      setAttributeToDelete(null)
      toast.success('Attribútum eltávolítva')
      return
    }

    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }

    try {
      const response = await fetch(`/api/products/${product.id}/attributes?attributeName=${encodeURIComponent(attributeToDelete.name)}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Attribútum eltávolítva')
        setDeleteAttributeModalOpen(false)
        setAttributeToDelete(null)
        // Reload product to get updated attributes
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba az attribútum eltávolításakor')
      }
    } catch (error) {
      console.error('Error deleting attribute:', error)
      toast.error('Hiba az attribútum eltávolításakor')
    }
  }

  // Fetch list attribute values when a LIST attribute is selected in add modal
  useEffect(() => {
    if (selectedAttributeToAdd && addAttributeModalOpen && availableAttributes.length > 0) {
      const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeToAdd)
      if (selectedAttr && selectedAttr.type === 'LIST') {
        // Always use attribute ID (attribute_shoprenter_id) which is the listAttribute ID
        // The ID is what we need to fetch listAttributeValues
        if (selectedAttr.id) {
          setLoadingNewListAttributeValues(true)
          
          if (isNewProduct) {
            // For new products, use the connection-based endpoint
            if (!selectedConnectionId) {
              setNewListAttributeValues([])
              setLoadingNewListAttributeValues(false)
              return
            }
            fetch(`/api/connections/${selectedConnectionId}/list-attribute-values?attributeId=${encodeURIComponent(selectedAttr.id)}`)
              .then(res => res.json())
              .then(result => {
                if (result.success) {
                  setNewListAttributeValues(result.values || [])
                } else {
                  toast.error(result.error || 'Hiba az elérhető értékek betöltésekor')
                  setNewListAttributeValues([])
                }
              })
              .catch(error => {
                console.error('Error loading list attribute values:', error)
                toast.error('Hiba az elérhető értékek betöltésekor')
                setNewListAttributeValues([])
              })
              .finally(() => {
                setLoadingNewListAttributeValues(false)
              })
          } else if (product?.id) {
            fetch(`/api/products/${product.id}/attributes/${encodeURIComponent(selectedAttr.id)}/values`)
              .then(res => res.json())
              .then(result => {
                if (result.success) {
                  setNewListAttributeValues(result.values || [])
                } else {
                  toast.error(result.error || 'Hiba az elérhető értékek betöltésekor')
                  setNewListAttributeValues([])
                }
              })
              .catch(error => {
                console.error('Error loading list attribute values:', error)
                toast.error('Hiba az elérhető értékek betöltésekor')
                setNewListAttributeValues([])
              })
              .finally(() => {
                setLoadingNewListAttributeValues(false)
              })
          } else {
            setNewListAttributeValues([])
            setLoadingNewListAttributeValues(false)
          }
        } else {
          setNewListAttributeValues([])
          setLoadingNewListAttributeValues(false)
        }
      } else {
        setNewListAttributeValues([])
        setLoadingNewListAttributeValues(false)
      }
    } else {
      setNewListAttributeValues([])
    }
  }, [selectedAttributeToAdd, addAttributeModalOpen, availableAttributes, product?.id, isNewProduct, selectedConnectionId])

  // Handle add attribute
  const handleAddAttribute = async () => {
    if (!selectedAttributeToAdd || newAttributeValue === null) {
      toast.warning('Válasszon attribútumot és adjon meg értéket')
      return
    }

    const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeToAdd)
    if (!selectedAttr) {
      toast.error('Érvénytelen attribútum kiválasztás')
      return
    }

    try {
      // For LIST attributes, we need to format the value correctly
      // The ShopRenter API expects an array containing the listAttributeValueDescription object
      let valueToSave = newAttributeValue
      
      if (selectedAttr.type === 'LIST' && newAttributeValue) {
        // Find the full value object from newListAttributeValues
        const selectedValue = newListAttributeValues.find(v => {
          return v.id === newAttributeValue || v.valueId === newAttributeValue
        })
        
        if (selectedValue) {
          // Format as array with listAttributeValueDescription object (matching ShopRenter format)
          valueToSave = [{
            id: selectedValue.id, // listAttributeValueDescription ID
            href: selectedValue.href || '',
            value: selectedValue.displayValue || selectedValue.value,
            language: selectedValue.language || {
              id: 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==',
              href: ''
            }
          }]
          console.log(`[ATTRIBUTE-ADD] Adding LIST attribute "${selectedAttr.name}" with value:`, valueToSave)
        } else {
          console.warn(`[ATTRIBUTE-ADD] Could not find full value object for ID: ${newAttributeValue}`)
          // Fallback: use the ID as string (should not happen)
          valueToSave = newAttributeValue
        }
      }

      // For new products, just update local state
      if (isNewProduct) {
        const newAttr = {
          id: selectedAttr.id,
          attribute_shoprenter_id: selectedAttr.id,
          name: selectedAttr.name,
          display_name: selectedAttr.name,
          type: selectedAttr.type,
          value: valueToSave,
          ...(selectedAttr.type === 'LIST' && {
            listAttributeValueId: newAttributeValue,
            listAttributeValueDisplay: newListAttributeValues.find(v => v.id === newAttributeValue)?.displayValue || newAttributeValue
          })
        }
        setAttributes(prev => [...prev, newAttr])
        setSelectedAttributeToAdd('')
        setNewAttributeValue(null)
        setNewListAttributeValues([])
        toast.success('Attribútum hozzáadva')
        return
      }

      if (!product?.id) {
        toast.error('Termék ID hiányzik')
        return
      }

      const response = await fetch(`/api/products/${product.id}/attributes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attributeId: selectedAttr.id,
          attributeType: selectedAttr.type,
          value: valueToSave
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Attribútum hozzáadva')
        // Reload available attributes to remove the newly added one from the list
        await loadAvailableAttributes()
        // Clear selection so user can add another attribute if needed
        setSelectedAttributeToAdd('')
        setNewAttributeValue(null)
        setNewListAttributeValues([])
        // Reload product to get updated attributes
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba az attribútum hozzáadásakor')
      }
    } catch (error) {
      console.error('Error adding attribute:', error)
      toast.error('Hiba az attribútum hozzáadásakor')
    }
  }

  useEffect(() => {
    if (product?.id) {
      loadProductClass()
      loadAvailableProductClasses()
    } else if (isNewProduct) {
      setProductClass(null)
    }
  }, [product?.id, isNewProduct])

  // Load available product classes when connection is selected for new products
  useEffect(() => {
    if (isNewProduct && selectedConnectionId) {
      loadAvailableProductClasses()
    }
  }, [isNewProduct, selectedConnectionId])

  // Load available products for parent selection
  const loadAvailableProducts = async (searchTerm: string = '') => {
    try {
      setLoadingAvailableProducts(true)
      const connectionId = isNewProduct 
        ? selectedConnectionId
        : ((product as any)?.connection_id)
      if (!connectionId) {
        if (isNewProduct) {
          toast.error('Válasszon kapcsolatot')
        } else {
          toast.error('A termékhez nincs kapcsolat rendelve')
        }
        return
      }
      // Build URL with search parameter
      const searchParam = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : ''
      const excludeParam = product?.id ? `&excludeProductId=${product.id}` : ''
      const response = await fetch(`/api/connections/${connectionId}/products?${excludeParam}${searchParam}`)
      const result = await response.json()
      
      if (result.products) {
        setAvailableProducts(result.products)
      } else {
        setAvailableProducts([])
      }
    } catch (error) {
      console.error('Error loading available products:', error)
      toast.error('Hiba a termékek betöltésekor')
      setAvailableProducts([])
    } finally {
      setLoadingAvailableProducts(false)
    }
  }

  // Handle open parent product modal
  const handleOpenParentProductModal = async () => {
    // For new products, keep current selection; for existing products, load from variantData
    if (!isNewProduct && variantData?.isChild && variantData?.parent) {
      setSelectedParentProductId(variantData.parent.id)
    }
    setParentProductModalOpen(true)
    setParentProductSearchTerm('') // Reset search when opening
    await loadAvailableProducts('') // Load all products initially
  }
  
  // Debounced search for parent products
  useEffect(() => {
    if (!parentProductModalOpen) return
    
    const timeoutId = setTimeout(() => {
      loadAvailableProducts(parentProductSearchTerm)
    }, 300) // 300ms debounce
    
    return () => clearTimeout(timeoutId)
  }, [parentProductSearchTerm, parentProductModalOpen])

  // Handle close parent product modal
  const handleCloseParentProductModal = () => {
    setParentProductModalOpen(false)
    // Don't clear selectedParentProductId here - it should persist after save
    setParentProductSearchTerm('')
  }

  // Handle save parent product
  const handleSaveParentProduct = async () => {
    // For new products, just update local state (selectedParentProductId is already set by the modal)
    if (isNewProduct) {
      handleCloseParentProductModal()
      toast.success(selectedParentProductId ? 'Szülő termék kiválasztva' : 'Szülő termék eltávolítva')
      return
    }

    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }

    try {
      setUpdatingParentProduct(true)
      const response = await fetch(`/api/products/${product.id}/parent-product`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parentProductId: selectedParentProductId || null
        })
      })
      
      const result = await response.json()
      if (result.success) {
        toast.success(selectedParentProductId ? 'Szülő termék frissítve' : 'Szülő termék eltávolítva')
        handleCloseParentProductModal()
        // Reload variant data to refresh parent/child relationships
        if (loadVariants) {
          await loadVariants()
        }
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba a szülő termék frissítésekor')
      }
    } catch (error) {
      console.error('Error saving parent product:', error)
      toast.error('Hiba a szülő termék frissítésekor')
    } finally {
      setUpdatingParentProduct(false)
    }
  }

  // Handle remove parent product
  const handleRemoveParentProduct = async () => {
    // For new products, just update local state
    if (isNewProduct) {
      setSelectedParentProductId(null)
      setSelectedParentProductData(null)
      toast.success('Szülő termék eltávolítva')
      return
    }

    if (!variantData?.parent || !product?.id) return
    
    try {
      setUpdatingParentProduct(true)
      const response = await fetch(`/api/products/${product.id}/parent-product`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentProductId: null })
      })
      
      const result = await response.json()
      if (result.success) {
        toast.success('Szülő termék eltávolítva')
        // Reload variant data
        if (loadVariants) {
          await loadVariants()
        }
        router.refresh()
      } else {
        toast.error(result.error || 'Hiba a szülő termék eltávolításakor')
      }
    } catch (error) {
      console.error('Error removing parent product:', error)
      toast.error('Hiba a szülő termék eltávolításakor')
    } finally {
      setUpdatingParentProduct(false)
    }
  }

  // Load available categories when modal opens
  const loadAvailableCategories = async () => {
    try {
      setLoadingAvailableCategories(true)
      const connectionId = isNewProduct 
        ? selectedConnectionId
        : ((product as any)?.connection_id)
      if (!connectionId) {
        if (isNewProduct) {
          toast.error('Válasszon kapcsolatot')
        } else {
          toast.error('A termékhez nincs kapcsolat rendelve')
        }
        return
      }
      const response = await fetch(`/api/connections/${connectionId}/categories`)
      const result = await response.json()
      
      if (result.categories) {
        setAvailableCategories(result.categories)
      }
    } catch (error) {
      console.error('Error loading available categories:', error)
      toast.error('Hiba a kategóriák betöltésekor')
    } finally {
      setLoadingAvailableCategories(false)
    }
  }

  // Handle delete category - open modal
  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    setCategoryToDelete({ id: categoryId, name: categoryName })
    setDeleteCategoryModalOpen(true)
  }

  // Confirm delete category
  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return

    // For new products, just update local state
    if (isNewProduct) {
      setCategories(prev => prev.filter((cat: any) => cat.id !== categoryToDelete.id))
      setDeleteCategoryModalOpen(false)
      setCategoryToDelete(null)
      toast.success('Kategória eltávolítva')
      return
    }

    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }

    try {
      setDeletingCategoryId(categoryToDelete.id)
      setDeleteCategoryModalOpen(false)
      
      const response = await fetch(`/api/products/${product.id}/categories?categoryId=${categoryToDelete.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Kategória eltávolítva')
        // Reload categories
        await loadCategories()
      } else {
        toast.error(result.error || 'Hiba a kategória eltávolításakor')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Hiba a kategória eltávolításakor')
    } finally {
      setDeletingCategoryId(null)
      setCategoryToDelete(null)
    }
  }

  // Handle open add category modal
  const handleOpenAddCategoryModal = () => {
    setAddCategoryModalOpen(true)
    setSelectedCategoryIds([])
    setCategorySearchTerm('')
    loadAvailableCategories()
  }

  // Handle close add category modal
  const handleCloseAddCategoryModal = () => {
    setAddCategoryModalOpen(false)
    setSelectedCategoryIds([])
    setCategorySearchTerm('')
  }

  // Handle toggle category selection
  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId)
      } else {
        return [...prev, categoryId]
      }
    })
  }

  // Handle add categories
  const handleAddCategories = async () => {
    if (selectedCategoryIds.length === 0) {
      toast.warning('Válasszon ki legalább egy kategóriát')
      return
    }

    // For new products, just update local state
    if (isNewProduct) {
      // Fetch category details to add to local state
      const categoriesToAdd = availableCategories.filter(cat => selectedCategoryIds.includes(cat.id))
      setCategories(prev => {
        const existingIds = new Set(prev.map((c: any) => c.id))
        const newCategories = categoriesToAdd.filter(cat => !existingIds.has(cat.id))
        return [...prev, ...newCategories]
      })
      handleCloseAddCategoryModal()
      toast.success(`${categoriesToAdd.length} kategória hozzáadva`)
      return
    }

    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }

    try {
      const response = await fetch(`/api/products/${product.id}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ categoryIds: selectedCategoryIds })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || `${result.added} kategória hozzáadva`)
        handleCloseAddCategoryModal()
        // Reload categories
        await loadCategories()
      } else {
        toast.error(result.error || 'Hiba a kategóriák hozzáadásakor')
      }
    } catch (error) {
      console.error('Error adding categories:', error)
      toast.error('Hiba a kategóriák hozzáadásakor')
    }
  }

  // Filter available categories based on search and exclude already assigned
  const filteredAvailableCategories = availableCategories.filter((cat: any) => {
    const displayName = cat.displayName || cat.shoprenter_category_descriptions?.[0]?.name || cat.name || ''
    const matchesSearch = displayName.toLowerCase().includes(categorySearchTerm.toLowerCase()) ||
                         cat.path?.toLowerCase().includes(categorySearchTerm.toLowerCase())
    const notAlreadyAssigned = !categories.some(assignedCat => assignedCat.id === cat.id)
    return matchesSearch && notAlreadyAssigned
  })

  // Calculate quality score
  const handleCalculateQualityScore = async () => {
    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }
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
    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }
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

      if (response.status === 402) {
        // Insufficient credits
        const credits = result.credits || {}
        toast.error(
          `Nincs elég credit! Szükséges: ${credits.required || '?'}, Elérhető: ${credits.available || 0} / ${credits.limit || '?'}`,
          { autoClose: 6000 }
        )
        return
      }

      if (result.success) {
        // Update form data with generated values
        const updates: any = {}
        if (result.meta_title) updates.meta_title = result.meta_title
        if (result.meta_keywords) updates.meta_keywords = result.meta_keywords
        if (result.meta_description) updates.meta_description = result.meta_description

        setFormData(prev => ({ ...prev, ...updates }))
        
        // Trigger credit usage refresh in navbar
        window.dispatchEvent(new Event('creditUsageUpdated'))
        
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
    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }
    try {
      setGeneratingUrlSlug(true)
      const response = await fetch(`/api/products/${product.id}/url-alias/generate`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (response.status === 402) {
        // Insufficient credits
        const credits = result.credits || {}
        toast.error(
          `Nincs elég credit! Szükséges: ${credits.required || '?'}, Elérhető: ${credits.available || 0} / ${credits.limit || '?'}`,
          { autoClose: 6000 }
        )
        return
      }
      
      if (result.success && result.data) {
        setUrlSlug(result.data.suggestedSlug)
        setProductUrl(result.data.previewUrl)
        
        // Trigger credit usage refresh in navbar
        window.dispatchEvent(new Event('creditUsageUpdated'))
        
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

  const handleGenerateTags = async () => {
    if (!product?.id) {
      toast.error('Termék ID hiányzik')
      return
    }
    try {
      setGeneratingTags(true)
      const response = await fetch(`/api/products/${product.id}/tags/generate`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (response.status === 402) {
        // Insufficient credits
        const credits = result.credits || {}
        toast.error(
          `Nincs elég credit! Szükséges: ${credits.required || '?'}, Elérhető: ${credits.available || 0} / ${credits.limit || '?'}`,
          { autoClose: 6000 }
        )
        return
      }
      
      if (result.success && result.tags) {
        setProductTags(result.tags)
        
        // Trigger credit usage refresh in navbar
        window.dispatchEvent(new Event('creditUsageUpdated'))
        
        toast.success('AI által generált címkék betöltve')
      } else {
        toast.error(result.error || 'Hiba a címkék generálása során')
      }
    } catch (error) {
      console.error('Error generating tags:', error)
      toast.error('Hiba a címkék generálásakor')
    } finally {
      setGeneratingTags(false)
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

      if (!product?.id) return
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

      if (response.status === 402) {
        // Insufficient credits
        const credits = result.credits || {}
        toast.error(
          `Nincs elég credit! Szükséges: ${credits.required || '?'}, Elérhető: ${credits.available || 0} / ${credits.limit || '?'}`,
          { autoClose: 6000 }
        )
        return
      }

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
        
        // Trigger credit usage refresh in navbar
        window.dispatchEvent(new Event('creditUsageUpdated'))
        
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
      {/* Connection Selection for New Products */}
      {isNewProduct && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid', borderColor: '#2196f3', borderRadius: 2, bgcolor: '#f5f9ff' }}>
          <FormControl fullWidth>
            <InputLabel>Kapcsolat *</InputLabel>
            <Select
              value={selectedConnectionId}
              onChange={(e) => setSelectedConnectionId(e.target.value)}
              label="Kapcsolat *"
              disabled={loadingConnections}
              sx={{
                bgcolor: 'white',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }}
            >
              {loadingConnections ? (
                <MenuItem value="" disabled>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    Betöltés...
                  </Box>
                </MenuItem>
              ) : connections.length === 0 ? (
                <MenuItem value="" disabled>
                  Nincs elérhető kapcsolat
                </MenuItem>
              ) : (
                connections.map((connection) => (
                  <MenuItem key={connection.id} value={connection.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StoreIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {connection.name || connection.shop_name || 'Névtelen kapcsolat'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {connection.api_url}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          {!selectedConnectionId && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Válassza ki a webshop kapcsolatot, amelyhez a terméket hozzá szeretné adni.
            </Alert>
          )}
        </Paper>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        {/* Removed persistent chip - modal will show on navigation attempt only */}
        <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
          {!isNewProduct && (
            <>
              {(() => {
                const connectionId = (product as any)?.connection_id
                const connection = connections.find(c => c.id === connectionId)
                const connectionName = connection?.name || connection?.shop_name || 'webshop'
                
                return (
                  <>
                    <Button
                      variant="outlined"
                      color="info"
                      startIcon={pulling ? <CircularProgress size={20} /> : <RefreshIcon />}
                      onClick={handlePullFromShopRenter}
                      disabled={pulling || syncing}
                      title={`Frissítés ${connectionName}-ből (lekéri a legfrissebb adatokat, pl. attribútum megjelenítési neveket)`}
                    >
                      {pulling ? 'Frissítés...' : `Frissítés ${connectionName}-ből`}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
                      onClick={handleSyncClick}
                      disabled={syncing || pulling}
                      title={`Szinkronizálás ${connectionName}-be (elküldi a helyi változtatásokat)`}
                      color={needsSync() ? 'warning' : 'primary'}
                    >
                      {syncing ? 'Szinkronizálás...' : needsSync() ? 'Szinkronizálás (változások)' : 'Szinkronizálás'}
                    </Button>
                  </>
                )
              })()}
            </>
          )}
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || (isNewProduct && !selectedConnectionId)}
          >
            {isNewProduct ? 'Létrehozás' : 'Mentés'}
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
          <Tab 
            icon={<StoreIcon />} 
            iconPosition="start"
            label="Beszállítók" 
          />
        </Tabs>

        <TabPanel value={tabValue} index={0} isLoaded={loadedTabs.has(0)}>
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
                  {/* First Row: Termék neve, Cikkszám, Gyártó */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Termék neve *"
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
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Cikkszám (SKU) *"
                      value={productData.sku}
                      onChange={(e) => setProductData(prev => ({ ...prev, sku: e.target.value }))}
                      disabled={!isNewProduct}
                      required
                      error={!!skuValidationError}
                      helperText={
                        isValidatingSku 
                          ? "Ellenőrzés..." 
                          : skuValidationError 
                            ? skuValidationError 
                            : isNewProduct 
                              ? "A cikkszám egyedi kell legyen" 
                              : "A cikkszám nem módosítható"
                      }
                      InputProps={{
                        endAdornment: isValidatingSku ? (
                          <InputAdornment position="end">
                            <CircularProgress size={20} />
                          </InputAdornment>
                        ) : null
                      }}
                      sx={{
                        '& .MuiInputBase-input.Mui-disabled': {
                          WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          fontWeight: 500
                        },
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isNewProduct ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: isNewProduct ? 'rgba(0, 0, 0, 0.04)' : undefined
                          },
                          '&.Mui-focused': {
                            bgcolor: isNewProduct ? 'white' : undefined
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Gyártó / Márka</InputLabel>
                      <Select
                        value={productData.erp_manufacturer_id || ''}
                        onChange={(e) => {
                          const manufacturerId = e.target.value as string
                          setProductData(prev => ({
                            ...prev,
                            erp_manufacturer_id: manufacturerId || null
                          }))
                        }}
                        label="Gyártó / Márka"
                        disabled={loadingManufacturers}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                              width: 'auto'
                            }
                          }
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
                      >
                        <MenuItem value="">
                          <em>Nincs gyártó</em>
                        </MenuItem>
                        {manufacturers.map((manufacturer) => (
                          <MenuItem key={manufacturer.id} value={manufacturer.id}>
                            {manufacturer.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Second Row: Vonalkód, Internal vonalkód */}
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
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Belső vonalkód"
                      value={productData.internal_barcode}
                      onChange={(e) => setProductData(prev => ({ ...prev, internal_barcode: e.target.value }))}
                      helperText="Belső ERP generált vonalkód"
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
                  {/* Third Row: Gyártói cikkszám */}
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
                    <FormControl fullWidth>
                      <InputLabel id="measurement-unit-label">Mértékegység</InputLabel>
                      <Select
                        labelId="measurement-unit-label"
                        id="measurement-unit-select"
                        value={productData.unit_id || ''}
                        label="Mértékegység"
                        onChange={(e) => setProductData(prev => ({ ...prev, unit_id: e.target.value || null }))}
                        disabled={loadingUnits}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                              width: 'auto'
                            }
                          }
                        }}
                        sx={{
                          bgcolor: 'white'
                        }}
                      >
                        {units.map((unit) => (
                          <MenuItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.shortform})
                          </MenuItem>
                        ))}
                        {units.length === 0 && !loadingUnits && (
                          <MenuItem disabled value="">
                            Nincs elérhető mértékegység
                          </MenuItem>
                        )}
                        {loadingUnits && (
                          <MenuItem disabled value="">
                            Betöltés...
                          </MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* 4th Row: Dimensions and Weight */}
                  <Grid item xs={12} md={2.4}>
                    <TextField
                      fullWidth
                      label="Hosszúság (cm)"
                      type="number"
                      value={productData.length}
                      onChange={(e) => setProductData(prev => ({ ...prev, length: e.target.value }))}
                      InputProps={{
                        endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>cm</Typography>
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
                  <Grid item xs={12} md={2.4}>
                    <TextField
                      fullWidth
                      label="Szélesség (cm)"
                      type="number"
                      value={productData.width}
                      onChange={(e) => setProductData(prev => ({ ...prev, width: e.target.value }))}
                      InputProps={{
                        endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>cm</Typography>
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
                  <Grid item xs={12} md={2.4}>
                    <TextField
                      fullWidth
                      label="Magasság (cm)"
                      type="number"
                      value={productData.height}
                      onChange={(e) => setProductData(prev => ({ ...prev, height: e.target.value }))}
                      InputProps={{
                        endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>cm</Typography>
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
                  <Grid item xs={12} md={2.4}>
                    <TextField
                      fullWidth
                      label="Súly"
                      type="number"
                      value={productData.weight}
                      onChange={(e) => setProductData(prev => ({ ...prev, weight: e.target.value }))}
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
                  <Grid item xs={12} md={2.4}>
                    <FormControl fullWidth>
                      <InputLabel id="weight-unit-label">Súlymérték</InputLabel>
                      <Select
                        labelId="weight-unit-label"
                        id="weight-unit-select"
                        value={productData.erp_weight_unit_id || ''}
                        label="Súlymérték"
                        onChange={(e) => {
                          const selectedWeightUnitId = e.target.value || null
                          setProductData(prev => ({ ...prev, erp_weight_unit_id: selectedWeightUnitId }))
                          
                          // Validate if weight unit exists in ShopRenter
                          if (selectedWeightUnitId) {
                            const selectedWeightUnit = weightUnits.find(wu => wu.id === selectedWeightUnitId)
                            if (selectedWeightUnit && !selectedWeightUnit.shoprenter_weight_class_id) {
                              toast.warning(
                                `A "${selectedWeightUnit.name}" (${selectedWeightUnit.shortform}) súlymérték nem található ShopRenter-ben. ` +
                                `A súlymértékeket nem lehet automatikusan létrehozni ShopRenter-ben. ` +
                                `Kérjük, hozza létre manuálisan a ShopRenter admin felületen, vagy válasszon egy másik súlymértéket.`,
                                { autoClose: 8000 }
                              )
                            }
                          }
                        }}
                        disabled={loadingWeightUnits}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                              width: 'auto'
                            }
                          }
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
                      >
                        <MenuItem value="">
                          <em>Nincs súlymérték</em>
                        </MenuItem>
                        {weightUnits.map((weightUnit) => (
                          <MenuItem key={weightUnit.id} value={weightUnit.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Typography>
                                {weightUnit.name} ({weightUnit.shortform})
                              </Typography>
                              {!weightUnit.shoprenter_weight_class_id && (
                                <Chip 
                                  label="Nincs ShopRenter-ben" 
                                  size="small" 
                                  color="warning" 
                                  sx={{ ml: 'auto', fontSize: '0.7rem', height: '20px' }}
                                />
                              )}
                            </Box>
                          </MenuItem>
                        ))}
                        {weightUnits.length === 0 && !loadingWeightUnits && (
                          <MenuItem disabled value="">
                            Nincs elérhető súlymérték
                          </MenuItem>
                        )}
                        {loadingWeightUnits && (
                          <MenuItem disabled value="">
                            Betöltés...
                          </MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            {/* Product Class Section - Blue Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                  border: '2px solid',
                  borderColor: '#2196f3',
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
                    background: 'radial-gradient(circle, rgba(33, 150, 243, 0.1) 0%, transparent 70%)',
                    borderRadius: '50%',
                    transform: 'translate(30px, -30px)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <LocalOfferIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
                    Termék típusa
                  </Typography>
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 1, 
                  mt: 1.5, 
                  mb: 2,
                  p: 1.5,
                  bgcolor: 'rgba(33, 150, 243, 0.08)',
                  borderRadius: 1,
                  borderLeft: '3px solid #2196f3'
                }}>
                  <InfoIcon sx={{ color: '#1565c0', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: '#1565c0', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                    A termék típus csak a Webshop felületen szerkeszthető. Az ERP-ből csak a hozzárendelés módosítható.
                  </Typography>
                </Box>
                
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  {loadingProductClass ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} />
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Betöltés...
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Box sx={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: 1.5,
                        mb: 2
                      }}>
                        {productClass ? (
                          <Chip
                            label={productClass.name}
                            size="medium"
                            icon={updatingProductClass ? <CircularProgress size={16} /> : undefined}
                            onDelete={updatingProductClass ? undefined : handleOpenProductClassEditModal}
                            deleteIcon={updatingProductClass ? undefined : <EditIcon fontSize="small" />}
                            disabled={updatingProductClass}
                            sx={{ 
                              height: '36px',
                              fontSize: '0.875rem',
                              bgcolor: 'white',
                              border: '1px solid',
                              borderColor: '#2196f3',
                              color: '#1565c0',
                              fontWeight: 500,
                              '&:hover': { 
                                bgcolor: '#e3f2fd',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 8px rgba(33, 150, 243, 0.2)',
                                transition: 'all 0.2s ease',
                                '& .MuiChip-deleteIcon': {
                                  opacity: 1
                                }
                              },
                              '& .MuiChip-deleteIcon': {
                                color: '#1565c0',
                                fontSize: '16px',
                                opacity: 0.7,
                                '&:hover': {
                                  color: '#0d47a1',
                                  bgcolor: '#e3f2fd',
                                  borderRadius: '50%'
                                },
                                transition: 'all 0.2s ease'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          />
                        ) : (
                          <Button
                            startIcon={<AddIcon />}
                            variant="outlined"
                            size="small"
                            onClick={handleOpenProductClassEditModal}
                            sx={{
                              height: '36px',
                              borderColor: '#2196f3',
                              color: '#1565c0',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              '&:hover': {
                                borderColor: '#1976d2',
                                bgcolor: '#e3f2fd'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          >
                            Termék típus hozzáadása
                          </Button>
                        )}
                      </Box>
                      {productClass && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          A termék típusa meghatározza, hogy mely attribútumok érhetők el a termékhez.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Product Attributes Section - Green Theme */}
            {productClass && (
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
                      label={attributes.length} 
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
                    alignItems: 'flex-start', 
                    gap: 1, 
                    mt: 1.5, 
                    mb: 2,
                    p: 1.5,
                    bgcolor: 'rgba(76, 175, 80, 0.08)',
                    borderRadius: 1,
                    borderLeft: '3px solid #4caf50'
                  }}>
                    <InfoIcon sx={{ color: '#2e7d32', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#2e7d32', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      Az attribútum értékek csak a Webshop felületen szerkeszthetők. Az ERP-ből csak a hozzárendelés módosítható.
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1.5,
                    position: 'relative',
                    zIndex: 1
                  }}>
                  {attributes.map((attr: any, index: number) => {
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
                        // For TEXT attributes from ShopRenter, find the first non-null value
                        // Priority: Hungarian (language_id ending in 1) > any other language > first available
                        const hungarianValue = val.find((v: any) => 
                          v && typeof v === 'object' && 
                          (v.language?.id === 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' || 
                           v.language?.id?.endsWith('bGFuZ3VhZ2VfaWQ9MQ==')) &&
                          v.value && v.value !== null && v.value.trim() !== ''
                        )
                        
                        if (hungarianValue && hungarianValue.value) {
                          return hungarianValue.value
                        }
                        
                        // Fallback: find first non-null value
                        const firstValidValue = val.find((v: any) => 
                          v && typeof v === 'object' && 
                          v.value && v.value !== null && v.value.trim() !== '' &&
                          v.value !== 'null' && v.value !== 'undefined'
                        )
                        
                        if (firstValidValue && firstValidValue.value) {
                          return firstValidValue.value
                        }
                        
                        // Last resort: extract all values and join
                        const extracted = val
                          .map((v: any) => {
                            if (v && typeof v === 'object' && v.value) {
                              return v.value
                            }
                            return extractAttributeValue(v)
                          })
                          .filter((v: any) => v !== null && v !== undefined && v !== 'null' && v !== 'undefined' && v !== '')
                        return extracted.length > 0 ? extracted.join(', ') : null
                      }

                      // Handle objects - try multiple strategies
                      // Strategy 1: Direct value property (for TEXT attributes from ShopRenter)
                      if (val.value !== undefined && val.value !== null && val.value !== '') {
                        // Skip if value looks like a UUID/base64 ID
                        if (typeof val.value === 'string' && !val.value.match(/^[A-Za-z0-9+/=]{20,}$/)) {
                          return val.value
                        }
                        const extracted = extractAttributeValue(val.value)
                        if (extracted !== null && !extracted.match(/^[A-Za-z0-9+/=]{20,}$/)) {
                          return extracted
                        }
                      }
                      
                      // Strategy 2: Language-specific (Hungarian first)
                      if (val.hu && typeof val.hu === 'string' && val.hu.trim() !== '') {
                        return val.hu
                      }
                      if (val.name && typeof val.name === 'string' && val.name.trim() !== '') {
                        return val.name
                      }
                      if (val.description && typeof val.description === 'string' && val.description.trim() !== '') {
                        return val.description
                      }

                      // Strategy 3: Find first string value in object (excluding ID-like fields)
                      for (const [key, v] of Object.entries(val)) {
                        // Skip ID fields and href fields
                        if (key === 'id' || key === 'href' || key === 'language' || key === 'listAttributeValueId') {
                          continue
                        }
                        if (typeof v === 'string' && v.trim() !== '' && !v.match(/^[A-Za-z0-9+/=]{20,}$/)) {
                          return v
                        }
                        if (typeof v === 'number') {
                          return String(v)
                        }
                      }

                      // Strategy 4: If object has a single property, use it (but not if it's an ID)
                      const keys = Object.keys(val).filter(k => k !== 'id' && k !== 'href' && k !== 'language')
                      if (keys.length === 1) {
                        const extracted = extractAttributeValue(val[keys[0]])
                        if (extracted !== null && !extracted.match(/^[A-Za-z0-9+/=]{20,}$/)) {
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
                        onDelete={() => handleDeleteAttribute(attr)}
                        deleteIcon={<CloseIcon fontSize="small" />}
                        onClick={() => handleOpenEditAttributeModal(attr)}
                        sx={{ 
                          fontSize: '0.875rem',
                          height: '36px',
                          bgcolor: 'white',
                          border: '1px solid',
                          borderColor: '#4caf50',
                          color: '#2e7d32',
                          fontWeight: 500,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#e8f5e9',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 8px rgba(76, 175, 80, 0.2)',
                            transition: 'all 0.2s ease',
                            '& .MuiChip-deleteIcon': {
                              opacity: 1
                            }
                          },
                          '& .MuiChip-deleteIcon': {
                            color: '#2e7d32',
                            fontSize: '16px',
                            opacity: 0.7,
                            '&:hover': {
                              color: '#1b5e20',
                              bgcolor: '#e8f5e9',
                              borderRadius: '50%'
                            },
                            transition: 'all 0.2s ease'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      />
                    )
                  })}
                  {attributes.length === 0 && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', width: '100%' }}>
                      Nincs hozzárendelt attribútum
                    </Typography>
                  )}
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    size="small"
                    onClick={handleOpenAddAttributeModal}
                    disabled={!productClass}
                    sx={{
                      height: '36px',
                      borderColor: '#4caf50',
                      color: '#2e7d32',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      '&:hover': {
                        borderColor: '#388e3c',
                        bgcolor: '#e8f5e9'
                      },
                      '&.Mui-disabled': {
                        borderColor: '#a5d6a7',
                        color: '#81c784'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Attribútum hozzáadása
                  </Button>
                  </Box>
                  {!productClass && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: 1, 
                      mt: 2,
                      p: 1.5,
                      bgcolor: 'rgba(33, 150, 243, 0.08)',
                      borderRadius: 1,
                      borderLeft: '3px solid #2196f3',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      <InfoIcon sx={{ color: '#1565c0', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: '#1565c0', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                        A termék típus hozzárendelése szükséges az attribútumok hozzáadásához.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            )}

            {/* Product Relationships Section - Purple/Pink Theme */}
            {((isNewProduct || (!loadingVariants && variantData))) && (
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
                  {((isNewProduct && selectedParentProductId) || (variantData?.isChild && variantData?.parent)) && (() => {
                    // For new products, use stored parent product data
                    const parentProduct = isNewProduct && selectedParentProductId
                      ? (selectedParentProductData || availableProducts.find(p => p.id === selectedParentProductId))
                      : variantData?.parent
                    
                    if (!parentProduct) return null
                    
                    return (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1.5, 
                      mb: (variantData?.isParent) ? 2 : 0,
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
                        label={parentProduct.sku} 
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
                        component={isNewProduct ? 'div' : NextLink}
                        href={isNewProduct ? undefined : `/products/${parentProduct.id}`}
                        onClick={isNewProduct ? undefined : undefined}
                        size="small"
                        variant="contained"
                        disabled={isNewProduct}
                        sx={{ 
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
                      <Button
                        startIcon={<EditIcon />}
                        size="small"
                        variant="outlined"
                        onClick={handleOpenParentProductModal}
                        disabled={updatingParentProduct}
                        sx={{ 
                          fontSize: '0.75rem', 
                          minWidth: 'auto', 
                          px: 1.5,
                          borderColor: '#9c27b0',
                          color: '#7b1fa2',
                          '&:hover': {
                            borderColor: '#7b1fa2',
                            bgcolor: '#f3e5f5'
                          }
                        }}
                      >
                        Módosítás
                      </Button>
                      <Button
                        startIcon={<CloseIcon />}
                        size="small"
                        variant="outlined"
                        onClick={handleRemoveParentProduct}
                        disabled={updatingParentProduct}
                        sx={{ 
                          fontSize: '0.75rem', 
                          minWidth: 'auto', 
                          px: 1.5,
                          borderColor: '#d32f2f',
                          color: '#d32f2f',
                          '&:hover': {
                            borderColor: '#c62828',
                            bgcolor: '#ffebee'
                          }
                        }}
                      >
                        Eltávolítás
                      </Button>
                    </Box>
                    )
                  })()}
                  
                  {/* Add Parent Button - Show if product has no parent and no children */}
                  {((isNewProduct && !selectedParentProductId) || (!isNewProduct && !variantData || (!variantData?.isChild && !variantData?.isParent))) && (
                    <Box sx={{ 
                      p: 2,
                      bgcolor: 'white',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: '#ce93d8',
                      boxShadow: '0 2px 8px rgba(156, 39, 176, 0.1)'
                    }}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 1, 
                        mb: 2,
                        p: 1.5,
                        bgcolor: 'rgba(156, 39, 176, 0.08)',
                        borderRadius: 1,
                        borderLeft: '3px solid #9c27b0'
                      }}>
                        <InfoIcon sx={{ color: '#7b1fa2', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: '#7b1fa2', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                          Ez a terméknek nincs szülő terméke, és nincs gyermek terméke sem.
                        </Typography>
                      </Box>
                      <Button
                        startIcon={<AddIcon />}
                        variant="outlined"
                        size="small"
                        onClick={handleOpenParentProductModal}
                        sx={{
                          borderColor: '#9c27b0',
                          color: '#7b1fa2',
                          '&:hover': {
                            borderColor: '#7b1fa2',
                            bgcolor: '#f3e5f5'
                          }
                        }}
                      >
                        Szülő termék hozzáadása
                      </Button>
                    </Box>
                  )}
                  
                  {/* Child Products Info - Compact Table */}
                  {variantData?.isParent && variantData?.children.length > 0 && (
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
                            {variantData?.children?.map((child: any) => {
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
            {!loadingCategories && (
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
                    alignItems: 'flex-start', 
                    gap: 1, 
                    mt: 1.5, 
                    mb: 2,
                    p: 1.5,
                    bgcolor: 'rgba(255, 152, 0, 0.08)',
                    borderRadius: 1,
                    borderLeft: '3px solid #ff9800'
                  }}>
                    <InfoIcon sx={{ color: '#e65100', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#e65100', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      A kategóriák csak a Webshop felületen szerkeszthetők. Az ERP-ből csak a hozzárendelés módosítható.
                    </Typography>
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
                      const isDeleting = deletingCategoryId === category.id
                      
                      return (
                        <Chip
                          key={category.id}
                          label={catName}
                          size="small"
                          onDelete={isDeleting ? undefined : () => handleDeleteCategory(category.id, catName)}
                          deleteIcon={isDeleting ? <CircularProgress size={16} /> : <CloseIcon fontSize="small" />}
                          disabled={isDeleting}
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
                              transition: 'all 0.2s ease',
                              '& .MuiChip-deleteIcon': {
                                opacity: 1
                              }
                            },
                            '& .MuiChip-deleteIcon': {
                              color: '#e65100',
                              fontSize: '16px',
                              opacity: 0.7,
                              '&:hover': {
                                color: '#bf360c',
                                bgcolor: '#fff3e0',
                                borderRadius: '50%'
                              },
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
                    <Button
                      startIcon={<AddIcon />}
                      variant="outlined"
                      size="small"
                      onClick={handleOpenAddCategoryModal}
                      sx={{
                        height: '32px',
                        borderColor: '#ff9800',
                        color: '#e65100',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        '&:hover': {
                          borderColor: '#f57c00',
                          bgcolor: '#fff3e0'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Kategória hozzáadása
                    </Button>
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
            {loadingCategories && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1} isLoaded={loadedTabs.has(1)}>
          <Grid container spacing={3}>
            {/* Base Pricing Information - Red Theme */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#e74c3c',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#e74c3c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
                  }}>
                    <ReceiptIcon sx={{ color: 'white', fontSize: '24px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#c0392b' }}>
                    Alapadatok
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Beszerzési ár (Nettó)"
                      type="number"
                      value={productData.cost && (typeof productData.cost === 'number' ? productData.cost > 0 : parseFloat(String(productData.cost)) > 0) ? productData.cost : ''}
                      onChange={(e) => handleCostChange(e.target.value)}
                      helperText="A termék beszerzési ára"
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
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Eladási ár (Nettó)"
                      type="number"
                      value={productData.price || ''}
                      onChange={(e) => handleNetPriceChange(e.target.value)}
                      helperText="Alapértelmezett eladási ár (nettó)"
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
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Eladási ár (Bruttó)"
                      type="number"
                      value={grossPrice || ''}
                      onChange={(e) => handleGrossPriceChange(parseFloat(e.target.value) || 0)}
                      helperText="Bruttó ár (ÁFÁ-val együtt)"
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
                  {(() => {
                    const cost = productData.cost !== null && productData.cost !== undefined && productData.cost !== '' 
                      ? (typeof productData.cost === 'number' ? productData.cost : parseFloat(String(productData.cost)))
                      : null;
                    const price = productData.price !== null && productData.price !== undefined && productData.price !== ''
                      ? (typeof productData.price === 'number' ? productData.price : parseFloat(String(productData.price)))
                      : null;
                    
                    if (cost && price && cost > 0 && price > 0 && !isNaN(cost) && !isNaN(price)) {
                      const margin = price - cost;
                      const marginPercent = ((margin / cost) * 100).toFixed(1);
                      return (
                        <Grid item xs={12}>
                          <Alert severity="success" icon={<InfoIcon />}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              Árrés: {margin.toLocaleString('hu-HU')} Ft ({marginPercent}%) | Bruttó: {grossPrice ? grossPrice.toLocaleString('hu-HU') : 'N/A'} Ft
                            </Typography>
                          </Alert>
                        </Grid>
                      );
                    }
                    return null;
                  })()}
                </Grid>
              </Paper>
            </Grid>

            {/* Customer Group Pricing - Red Theme */}
            {!isNewProduct && product?.id && loadedTabs.has(1) && (
              <Grid item xs={12}>
                <CustomerGroupPricingCard productId={product.id} isVisible={tabValue === 1} />
              </Grid>
            )}

            {/* Promotions Section */}
            {!isNewProduct && product?.id && loadedTabs.has(1) && (
              <Grid item xs={12}>
                <PromotionsCard productId={product.id} isVisible={tabValue === 1} />
              </Grid>
            )}

            {/* AI Pricing Recommendations */}
            {!isNewProduct && product?.id && loadedTabs.has(1) && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: '#9C27B0',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#9C27B0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
                    }}>
                      <AutoAwesomeIcon sx={{ color: 'white', fontSize: '24px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#7B1FA2' }}>
                      AI Árazási Ajánlások
                    </Typography>
                  </Box>
                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <AIPricingRecommendationsCard
                      productId={product.id}
                      productPrice={productData.price ? parseFloat(String(productData.price)) : null}
                      productCost={productData.cost ? parseFloat(String(productData.cost)) : null}
                      productName={formData.name}
                      modelNumber={productData.model_number}
                      isVisible={tabValue === 1}
                      onPriceUpdate={(newPrice) => {
                        handleNetPriceChange(String(newPrice))
                        setHasUnsavedChanges(true)
                      }}
                    />
                  </Box>
                </Paper>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2} isLoaded={loadedTabs.has(2)}>
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
                  <FeatureGate feature="ai_generation" showUpgrade={false} compact={true}>
                    <Tooltip title="AI generálás (5 credits)">
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
                    </Tooltip>
                  </FeatureGate>
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
                      InputProps={{
                        endAdornment: (
                          <FeatureGate feature="ai_generation" showUpgrade={false} compact={true}>
                            <Tooltip title="AI generálás (1 credit)">
                              <Button
                                size="small"
                                startIcon={generatingTags ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                                onClick={handleGenerateTags}
                                disabled={generatingTags}
                                sx={{ minWidth: 'auto', ml: 1 }}
                              >
                                {generatingTags ? '' : 'AI'}
                              </Button>
                            </Tooltip>
                          </FeatureGate>
                        )
                      }}
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
                            <FeatureGate feature="ai_generation" showUpgrade={false} compact={true}>
                              <Tooltip title="AI generálás (1 credit)">
                                <Button
                                  size="small"
                                  startIcon={generatingUrlSlug ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                                  onClick={handleGenerateUrlSlug}
                                  disabled={generatingUrlSlug}
                                  sx={{ minWidth: 'auto' }}
                                >
                                  {generatingUrlSlug ? '' : 'AI'}
                                </Button>
                              </Tooltip>
                            </FeatureGate>
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
                        <FeatureGate feature="ai_generation" showUpgrade={false} compact={true}>
                          <Tooltip title="AI generálás (1 credit)">
                            <Button
                              size="small"
                              startIcon={generatingMeta.title ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                              onClick={() => handleGenerateMeta('title')}
                              disabled={generatingMeta.title || generatingMeta.keywords || generatingMeta.description}
                              sx={{ minWidth: 'auto', ml: 1 }}
                            >
                              {generatingMeta.title ? '' : 'AI'}
                            </Button>
                          </Tooltip>
                        </FeatureGate>
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
                        <FeatureGate feature="ai_generation" showUpgrade={false} compact={true}>
                          <Tooltip title="AI generálás (1 credit)">
                            <Button
                              size="small"
                              startIcon={generatingMeta.keywords ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                              onClick={() => handleGenerateMeta('keywords')}
                              disabled={generatingMeta.title || generatingMeta.keywords || generatingMeta.description}
                              sx={{ minWidth: 'auto', ml: 1 }}
                            >
                              {generatingMeta.keywords ? '' : 'AI'}
                            </Button>
                          </Tooltip>
                        </FeatureGate>
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
                        <FeatureGate feature="ai_generation" showUpgrade={false} compact={true}>
                          <Tooltip title="AI generálás (1 credit)">
                            <Button
                              size="small"
                              startIcon={generatingMeta.description ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                              onClick={() => handleGenerateMeta('description')}
                              disabled={generatingMeta.title || generatingMeta.keywords || generatingMeta.description}
                              sx={{ minWidth: 'auto', ml: 1, alignSelf: 'flex-start', mt: 1 }}
                            >
                              {generatingMeta.description ? '' : 'AI'}
                            </Button>
                          </Tooltip>
                        </FeatureGate>
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
                {product?.id ? (
                  <ProductImagesTab productId={product.id} hideBulkActions={true} />
                ) : (
                  <Alert severity="info">
                    A termékképek hozzáadása a termék létrehozása után lehetséges.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3} isLoaded={loadedTabs.has(3)}>
          <FeatureGate feature="ai_generation">
            {product?.id ? (
              <SourceMaterialsTab productId={product.id} />
            ) : (
              <Alert severity="info">
                Az AI források hozzáadása a termék létrehozása után lehetséges.
              </Alert>
            )}
          </FeatureGate>
        </TabPanel>

        <TabPanel value={tabValue} index={4} isLoaded={loadedTabs.has(4)}>
          <FeatureGate feature="analytics">
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
                  {product?.id ? (
                    <SearchConsoleTab productId={product.id} productUrl={product?.product_url} />
                  ) : (
                    <Alert severity="info">
                      Az elemzési adatok a termék létrehozása után érhetők el.
                    </Alert>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Competitor Prices moved to Árazás tab */}
          </Grid>
          </FeatureGate>
        </TabPanel>

        <TabPanel value={tabValue} index={5} isLoaded={loadedTabs.has(5)}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {product?.id ? (
                <ProductSuppliersCard productId={product.id} />
              ) : (
                <Alert severity="info">
                  A beszállítók hozzáadása a termék létrehozása után lehetséges.
                </Alert>
              )}
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
          <Tooltip title="AI generálás (5 credits)">
            <Button
              onClick={handleGenerateDescription}
              variant="contained"
              color="primary"
              disabled={generating}
              startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            >
              {generating ? 'Generálás...' : 'Generálás'}
            </Button>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog
        open={addCategoryModalOpen}
        onClose={handleCloseAddCategoryModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#ff9800'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#fff3e0', 
          borderBottom: '1px solid',
          borderColor: '#ffb74d',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <CategoryIcon sx={{ color: '#ff9800' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#e65100', fontSize: '1.25rem' }}>
            Kategória hozzáadása
    </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            placeholder="Keresés kategóriák között..."
            value={categorySearchTerm}
            onChange={(e) => setCategorySearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#ff9800' }} />
                </InputAdornment>
              ),
            }}
          />
          
          {loadingAvailableCategories ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#ff9800' }} />
            </Box>
          ) : filteredAvailableCategories.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: '#fff3e0', border: '1px solid', borderColor: '#ffb74d' }}>
              {categorySearchTerm 
                ? 'Nincs találat a keresésre.' 
                : 'Nincs elérhető kategória, vagy minden kategória már hozzá van rendelve.'}
            </Alert>
          ) : (
            <Box sx={{ 
              maxHeight: '400px', 
              overflowY: 'auto',
              border: '1px solid',
              borderColor: '#ffb74d',
              borderRadius: 1,
              bgcolor: '#fffbf5'
            }}>
              <List dense>
                {filteredAvailableCategories.map((category: any) => {
                  const displayName = category.displayName || category.shoprenter_category_descriptions?.[0]?.name || category.name || 'Kategória'
                  const isSelected = selectedCategoryIds.includes(category.id)
                  const indent = category.level || 0
                  
                  return (
                    <ListItem
                      key={category.id}
                      disablePadding
                      sx={{
                        pl: `${1 + indent * 2}rem`,
                        '&:hover': {
                          bgcolor: '#fff3e0'
                        }
                      }}
                    >
                      <ListItemButton
                        onClick={() => handleToggleCategory(category.id)}
                        sx={{
                          py: 0.5,
                          borderRadius: 1
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          sx={{
                            color: '#ff9800',
                            '&.Mui-checked': {
                              color: '#e65100'
                            }
                          }}
                        />
                        <ListItemText
                          primary={displayName}
                          secondary={category.path && category.path !== displayName ? category.path : undefined}
                          primaryTypographyProps={{
                            sx: {
                              fontSize: '0.875rem',
                              fontWeight: isSelected ? 600 : 400,
                              color: isSelected ? '#e65100' : 'text.primary'
                            }
                          }}
                          secondaryTypographyProps={{
                            sx: {
                              fontSize: '0.75rem',
                              color: 'text.secondary'
                            }
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          )}
          
          {selectedCategoryIds.length > 0 && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid', borderColor: '#ffb74d' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#e65100' }}>
                Kiválasztva: {selectedCategoryIds.length} kategória
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          bgcolor: '#fffbf5', 
          borderTop: '1px solid',
          borderColor: '#ffb74d',
          px: 2,
          py: 1.5
        }}>
          <Button 
            onClick={handleCloseAddCategoryModal}
            sx={{ 
              color: '#e65100',
              '&:hover': {
                bgcolor: '#fff3e0'
              }
            }}
          >
            Mégse
          </Button>
          <Button
            onClick={handleAddCategories}
            variant="contained"
            disabled={selectedCategoryIds.length === 0}
            sx={{
              bgcolor: '#ff9800',
              color: 'white',
              '&:hover': {
                bgcolor: '#f57c00'
              },
              '&.Mui-disabled': {
                bgcolor: '#ffcc80',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
            startIcon={<AddIcon />}
          >
            Hozzáadás ({selectedCategoryIds.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Category Confirmation Modal */}
      <Dialog
        open={deleteCategoryModalOpen}
        onClose={() => {
          setDeleteCategoryModalOpen(false)
          setCategoryToDelete(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#ff9800'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#fff3e0', 
          borderBottom: '1px solid',
          borderColor: '#ffb74d',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <CategoryIcon sx={{ color: '#ff9800' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#e65100', fontSize: '1.25rem' }}>
            Kategória eltávolítása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: '#fff3e0', border: '1px solid', borderColor: '#ffb74d' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#e65100' }}>
              Biztosan eltávolítja ezt a kategóriát?
            </Typography>
          </Alert>
          {categoryToDelete && (
            <Box sx={{ p: 2, bgcolor: '#fffbf5', borderRadius: 1, border: '1px solid', borderColor: '#ffb74d' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#e65100', mb: 1 }}>
                {categoryToDelete.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                A kategória eltávolítása után a termék szinkronizálásakor ez a kategória nem lesz a termékhez rendelve a webshopban.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          bgcolor: '#fffbf5', 
          borderTop: '1px solid',
          borderColor: '#ffb74d',
          px: 2,
          py: 1.5
        }}>
          <Button 
            onClick={() => {
              setDeleteCategoryModalOpen(false)
              setCategoryToDelete(null)
            }}
            sx={{ 
              color: '#e65100',
              '&:hover': {
                bgcolor: '#fff3e0'
              }
            }}
          >
            Mégse
          </Button>
          <Button
            onClick={handleConfirmDeleteCategory}
            variant="contained"
            disabled={deletingCategoryId !== null}
            sx={{
              bgcolor: '#ff9800',
              color: 'white',
              '&:hover': {
                bgcolor: '#f57c00'
              },
              '&.Mui-disabled': {
                bgcolor: '#ffcc80',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
            startIcon={deletingCategoryId ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deletingCategoryId ? 'Eltávolítás...' : 'Eltávolítás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Product Class Edit Modal */}
      <Dialog
        open={productClassEditModalOpen}
        onClose={handleCloseProductClassEditModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#2196f3'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#e3f2fd', 
          borderBottom: '1px solid',
          borderColor: '#90caf9',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LocalOfferIcon sx={{ color: '#2196f3' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1.25rem' }}>
            Termék típus szerkesztése
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="edit-product-class-label">Termék típusa</InputLabel>
            <Select
              labelId="edit-product-class-label"
              value={selectedProductClassId}
              label="Termék típusa"
              onChange={(e) => setSelectedProductClassId(e.target.value)}
              disabled={loadingAvailableProductClasses}
            >
              <MenuItem value="">
                <em>Nincs hozzárendelt termék típus</em>
              </MenuItem>
              {loadingAvailableProductClasses ? (
                <MenuItem value="" disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Betöltés...
                </MenuItem>
              ) : availableProductClasses.length === 0 ? (
                <MenuItem value="" disabled>
                  Nincs elérhető termék típus
                </MenuItem>
              ) : (
                availableProductClasses.map((pc) => (
                  <MenuItem key={pc.id} value={pc.id}>
                    {pc.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseProductClassEditModal}>
            Mégse
          </Button>
          <Button
            onClick={handleConfirmProductClassChange}
            variant="contained"
            disabled={selectedProductClassId === productClass?.id}
            sx={{
              bgcolor: '#2196f3',
              color: 'white',
              '&:hover': {
                bgcolor: '#1976d2'
              }
            }}
          >
            Mentés
          </Button>
        </DialogActions>
      </Dialog>

      {/* Product Class Change Confirmation Modal */}
      <Dialog
        open={productClassConfirmOpen}
        onClose={() => {
          setProductClassConfirmOpen(false)
          setProductClassToUpdate(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#2196f3'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#e3f2fd', 
          borderBottom: '1px solid',
          borderColor: '#90caf9',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LocalOfferIcon sx={{ color: '#2196f3' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1.25rem' }}>
            Termék típus megváltoztatása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: '#e3f2fd', border: '1px solid', borderColor: '#90caf9' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1565c0' }}>
              Biztosan meg szeretné változtatni a termék típusát?
            </Typography>
          </Alert>
          {productClassToUpdate && (
            <Box sx={{ p: 2, bgcolor: '#f5f9ff', borderRadius: 1, border: '1px solid', borderColor: '#90caf9' }}>
              <Typography variant="body2" sx={{ mb: 1, color: '#1565c0' }}>
                <strong>Jelenlegi:</strong> {productClass?.name || 'Nincs'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#1565c0' }}>
                <strong>Új:</strong> {productClassToUpdate.name}
              </Typography>
              {productClassToUpdate.willClearAttributes && productClassToUpdate.attributeCount && productClassToUpdate.attributeCount > 0 && (
                <Alert 
                  severity="warning" 
                  sx={{ 
                    mt: 2, 
                    bgcolor: '#fff3cd', 
                    border: '1px solid', 
                    borderColor: '#ffc107',
                    '& .MuiAlert-icon': {
                      color: '#856404'
                    }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#856404', mb: 0.5 }}>
                    Figyelem: Attribútumok törlése
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#856404' }}>
                    A termék típus megváltoztatása során az összes jelenlegi attribútum ({productClassToUpdate.attributeCount} db) törlődni fog, mivel az új termék típus más attribútumokat tartalmaz. Az attribútumokat később újra hozzáadhatja az új termék típushoz tartozó attribútumok közül.
                  </Typography>
                </Alert>
              )}
              {!productClassToUpdate.willClearAttributes && (
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  A termék típus megváltoztatása befolyásolhatja a meglévő attribútumokat.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setProductClassConfirmOpen(false)
            setProductClassToUpdate(null)
          }}>
            Mégse
          </Button>
          <Button
            onClick={handleProductClassChange}
            variant="contained"
            disabled={updatingProductClass}
            sx={{
              bgcolor: '#2196f3',
              color: 'white',
              '&:hover': {
                bgcolor: '#1976d2'
              }
            }}
            startIcon={updatingProductClass ? <CircularProgress size={20} /> : undefined}
          >
            {updatingProductClass ? 'Frissítés...' : 'Megerősítés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Attribute Modal */}
      <Dialog
        open={editAttributeModalOpen}
        onClose={handleCloseEditAttributeModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#4caf50'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#e8f5e9', 
          borderBottom: '1px solid',
          borderColor: '#a5d6a7',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LabelIcon sx={{ color: '#4caf50' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1.25rem' }}>
            Attribútum szerkesztése
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {attributeToEdit && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                <strong>{attributeToEdit.display_name || attributeToEdit.name}</strong>
              </Typography>
              {attributeToEdit.type === 'LIST' ? (
                <FormControl fullWidth>
                  <InputLabel>Érték</InputLabel>
                  <Select
                    value={editingAttributeValue || ''}
                    label="Érték"
                    onChange={(e) => setEditingAttributeValue(e.target.value)}
                    disabled={loadingListAttributeValues}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                          width: 'auto'
                        }
                      }
                    }}
                  >
                    {loadingListAttributeValues ? (
                      <MenuItem value="" disabled>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} />
                          Betöltés...
                        </Box>
                      </MenuItem>
                    ) : listAttributeValues.length > 0 ? (
                      listAttributeValues.map((val) => (
                        <MenuItem key={val.id} value={val.id || val.valueId}>
                          {val.displayValue}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        Nincs elérhető érték
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              ) : attributeToEdit.type === 'INTEGER' || attributeToEdit.type === 'FLOAT' ? (
                <TextField
                  fullWidth
                  type="number"
                  label="Érték"
                  value={editingAttributeValue || ''}
                  onChange={(e) => setEditingAttributeValue(attributeToEdit.type === 'FLOAT' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
                />
              ) : (
                <TextField
                  fullWidth
                  label="Érték"
                  value={editingAttributeValue || ''}
                  onChange={(e) => setEditingAttributeValue(e.target.value)}
                  multiline
                  rows={3}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditAttributeModal}>
            Mégse
          </Button>
          <Button
            onClick={handleSaveAttributeEdit}
            variant="contained"
            sx={{
              bgcolor: '#4caf50',
              color: 'white',
              '&:hover': {
                bgcolor: '#388e3c'
              }
            }}
          >
            Mentés
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Attribute Confirmation Modal */}
      <Dialog
        open={deleteAttributeModalOpen}
        onClose={() => {
          setDeleteAttributeModalOpen(false)
          setAttributeToDelete(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#4caf50'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#e8f5e9', 
          borderBottom: '1px solid',
          borderColor: '#a5d6a7',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LabelIcon sx={{ color: '#4caf50' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1.25rem' }}>
            Attribútum eltávolítása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: '#e8f5e9', border: '1px solid', borderColor: '#a5d6a7' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32' }}>
              Biztosan eltávolítja ezt az attribútumot?
            </Typography>
          </Alert>
          {attributeToDelete && (
            <Box sx={{ p: 2, bgcolor: '#f1f8f4', borderRadius: 1, border: '1px solid', borderColor: '#a5d6a7' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#2e7d32', mb: 1 }}>
                {attributeToDelete.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Az attribútum eltávolítása után a termék szinkronizálásakor ez az attribútum nem lesz a termékhez rendelve a webshopban.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteAttributeModalOpen(false)
            setAttributeToDelete(null)
          }}>
            Mégse
          </Button>
          <Button
            onClick={handleConfirmDeleteAttribute}
            variant="contained"
            sx={{
              bgcolor: '#4caf50',
              color: 'white',
              '&:hover': {
                bgcolor: '#388e3c'
              }
            }}
            startIcon={<DeleteIcon />}
          >
            Eltávolítás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Attribute Modal */}
      <Dialog
        open={addAttributeModalOpen}
        onClose={handleCloseAddAttributeModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#4caf50'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#e8f5e9', 
          borderBottom: '1px solid',
          borderColor: '#a5d6a7',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LabelIcon sx={{ color: '#4caf50' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1.25rem' }}>
            Attribútum hozzáadása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {loadingAvailableAttributes ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : availableAttributes.length === 0 ? (
            <Alert severity="info">
              Nincs elérhető attribútum a termék típushoz.
            </Alert>
          ) : (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Attribútum</InputLabel>
                <Select
                  value={selectedAttributeToAdd}
                  label="Attribútum"
                  onChange={(e) => {
                    setSelectedAttributeToAdd(e.target.value)
                    setNewAttributeValue(null)
                  }}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                        width: 'auto'
                      }
                    }
                  }}
                >
                  {availableAttributes.map((attr) => (
                    <MenuItem key={attr.id} value={attr.id}>
                      {attr.name} ({attr.type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedAttributeToAdd && (() => {
                const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeToAdd)
                if (!selectedAttr) return null
                
                if (selectedAttr.type === 'LIST') {
                  return (
                    <FormControl fullWidth>
                      <InputLabel>Érték</InputLabel>
                      <Select
                        value={newAttributeValue || ''}
                        label="Érték"
                        onChange={(e) => setNewAttributeValue(e.target.value)}
                        disabled={loadingNewListAttributeValues}
                        MenuProps={{
                          PaperProps: {
                            style: {
                              maxHeight: 300,
                              width: 'auto'
                            }
                          }
                        }}
                      >
                        {loadingNewListAttributeValues ? (
                          <MenuItem value="" disabled>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={16} />
                              Betöltés...
                            </Box>
                          </MenuItem>
                        ) : newListAttributeValues.length > 0 ? (
                          [
                            <MenuItem key="placeholder" value="">Válasszon értéket</MenuItem>,
                            ...newListAttributeValues.map((val) => (
                              <MenuItem key={val.id || val.valueId} value={val.id || val.valueId}>
                                {val.displayValue}
                              </MenuItem>
                            ))
                          ]
                        ) : (
                          <MenuItem value="" disabled>
                            Nincs elérhető érték
                          </MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  )
                } else if (selectedAttr.type === 'INTEGER' || selectedAttr.type === 'FLOAT') {
                  return (
                    <TextField
                      fullWidth
                      type="number"
                      label="Érték"
                      value={newAttributeValue || ''}
                      onChange={(e) => setNewAttributeValue(selectedAttr.type === 'FLOAT' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
                    />
                  )
                } else {
                  return (
                    <TextField
                      fullWidth
                      label="Érték"
                      value={newAttributeValue || ''}
                      onChange={(e) => setNewAttributeValue(e.target.value)}
                      multiline
                      rows={3}
                    />
                  )
                }
              })()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddAttributeModal}>
            Mégse
          </Button>
          <Button
            onClick={handleAddAttribute}
            variant="contained"
            disabled={!selectedAttributeToAdd || newAttributeValue === null}
            sx={{
              bgcolor: '#4caf50',
              color: 'white',
              '&:hover': {
                bgcolor: '#388e3c'
              },
              '&.Mui-disabled': {
                bgcolor: '#a5d6a7',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
            startIcon={<AddIcon />}
          >
            Hozzáadás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Parent Product Selection Modal */}
      <Dialog
        open={parentProductModalOpen}
        onClose={handleCloseParentProductModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#9c27b0'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#f3e5f5', 
          borderBottom: '1px solid',
          borderColor: '#ce93d8',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <FamilyRestroomIcon sx={{ color: '#9c27b0' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#7b1fa2', fontSize: '1.25rem' }}>
            {variantData?.isChild ? 'Szülő termék módosítása' : 'Szülő termék hozzáadása'}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            placeholder="Keresés termékek között (név, SKU)..."
            value={parentProductSearchTerm}
            onChange={(e) => setParentProductSearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9c27b0' }} />
                </InputAdornment>
              ),
            }}
          />
          
          {loadingAvailableProducts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#9c27b0' }} />
            </Box>
          ) : (
            <>
              {availableProducts.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: '#f3e5f5', border: '1px solid', borderColor: '#ce93d8' }}>
                  {parentProductSearchTerm 
                    ? 'Nincs találat a keresésre.' 
                    : 'Nincs elérhető termék. (Csak olyan termékek jelennek meg, amelyeknek nincs szülő terméke.)'}
                </Alert>
              ) : (
                <Box sx={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: '#ce93d8',
                  borderRadius: 1,
                  bgcolor: '#fafafa'
                }}>
                  <RadioGroup
                    value={selectedParentProductId || ''}
                    onChange={(e) => {
                      const productId = e.target.value || null
                      setSelectedParentProductId(productId)
                      // Also store the product data
                      const product = availableProducts.find(p => p.id === productId)
                      if (product) {
                        setSelectedParentProductData(product)
                      } else {
                        setSelectedParentProductData(null)
                      }
                    }}
                  >
                    <List dense>
                      {availableProducts.map((prod: any) => {
                          const isSelected = selectedParentProductId === prod.id
                          
                          return (
                            <ListItem
                              key={prod.id}
                              disablePadding
                              sx={{
                                '&:hover': {
                                  bgcolor: '#f3e5f5'
                                }
                              }}
                            >
                              <ListItemButton
                                onClick={() => {
                                  setSelectedParentProductId(prod.id)
                                  setSelectedParentProductData(prod) // Store the full product data
                                }}
                                sx={{
                                  py: 0.5,
                                  borderRadius: 1
                                }}
                              >
                                <FormControlLabel
                                  value={prod.id}
                                  control={
                                    <Radio
                                      sx={{
                                        color: '#9c27b0',
                                        '&.Mui-checked': {
                                          color: '#7b1fa2'
                                        }
                                      }}
                                    />
                                  }
                                  label={
                                    <ListItemText
                                      primary={prod.name}
                                      secondary={`SKU: ${prod.sku}`}
                                      primaryTypographyProps={{
                                        sx: {
                                          fontSize: '0.875rem',
                                          fontWeight: isSelected ? 600 : 400,
                                          color: isSelected ? '#7b1fa2' : 'text.primary'
                                        }
                                      }}
                                      secondaryTypographyProps={{
                                        sx: {
                                          fontSize: '0.75rem',
                                          color: 'text.secondary'
                                        }
                                      }}
                                    />
                                  }
                                  sx={{ m: 0, width: '100%' }}
                                />
                              </ListItemButton>
                            </ListItem>
                          )
                        })}
                      </List>
                    </RadioGroup>
                  </Box>
              )}
            </>
          )}
          
          {selectedParentProductId && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid', borderColor: '#ce93d8' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#7b1fa2' }}>
                Kiválasztva: {availableProducts.find((p: any) => p.id === selectedParentProductId)?.name || 'Ismeretlen'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          bgcolor: '#fafafa', 
          borderTop: '1px solid',
          borderColor: '#ce93d8',
          px: 2,
          py: 1.5
        }}>
          <Button 
            onClick={handleCloseParentProductModal}
            sx={{ 
              color: '#7b1fa2',
              '&:hover': {
                bgcolor: '#f3e5f5'
              }
            }}
          >
            Mégse
          </Button>
          {variantData?.isChild && (
            <Button
              onClick={async () => {
                setSelectedParentProductId(null)
                await handleSaveParentProduct()
              }}
              variant="outlined"
              color="error"
              disabled={updatingParentProduct}
              sx={{ mr: 'auto' }}
            >
              {updatingParentProduct ? <CircularProgress size={16} /> : 'Szülő termék eltávolítása'}
            </Button>
          )}
          <Button
            onClick={handleSaveParentProduct}
            variant="contained"
            disabled={!selectedParentProductId || updatingParentProduct}
            sx={{
              bgcolor: '#9c27b0',
              color: 'white',
              '&:hover': {
                bgcolor: '#7b1fa2'
              },
              '&.Mui-disabled': {
                bgcolor: '#ce93d8',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
            startIcon={updatingParentProduct ? <CircularProgress size={16} /> : undefined}
          >
            {updatingParentProduct ? 'Mentés...' : variantData?.isChild ? 'Módosítás' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={showUnsavedDialog}
        onClose={() => {
          setShowUnsavedDialog(false)
          setPendingNavigation(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'error.main',
          color: 'error.contrastText',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2,
          px: 3,
          fontWeight: 600,
          fontSize: '1.25rem'
        }}>
          <InfoIcon sx={{ fontSize: 24 }} />
          Mentetlen változások
        </DialogTitle>
        <DialogContent sx={{ py: 3, px: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500, color: 'text.primary', fontSize: '1rem' }}>
            Biztosan kilépsz erről az oldalról?
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            Vannak elmentetlen változások. Biztosan kilépsz az oldalról anélkül, hogy elmentenéd őket?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, px: 3, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => {
              setShowUnsavedDialog(false)
              setPendingNavigation(null)
            }}
            variant="outlined"
            sx={{
              minWidth: 100,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Maradok
          </Button>
          <Button 
            onClick={() => {
              // Discard changes and navigate
              setHasUnsavedChanges(false)
              setShowUnsavedDialog(false)
              if (pendingNavigation) {
                router.push(pendingNavigation)
              }
              setPendingNavigation(null)
            }}
            variant="contained"
            color="error"
            sx={{
              minWidth: 100,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Kilépés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
