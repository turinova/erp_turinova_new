'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Pagination,
  Tooltip,
  Autocomplete,
  Divider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import LocationSearchingSharpIcon from '@mui/icons-material/LocationSearchingSharp'
import Filter2Icon from '@mui/icons-material/Filter2'
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import type { AccordionProps } from '@mui/material/Accordion'
import { useRouter } from 'next/navigation'

// Third-party Imports
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary'
import type { AccordionDetailsProps } from '@mui/material/AccordionDetails'

// Components
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { usePermissions } from '@/contexts/PermissionContext'

// Pricing
import { calculateQuote, formatPrice, type QuoteResult } from '@/lib/pricing/quoteCalculations'

// Styled component for Accordion component
const Accordion = styled(MuiAccordion)<AccordionProps>(({ theme }) => ({
  boxShadow: 'none !important',
  border: '1px solid var(--mui-palette-divider) !important',
  borderRadius: '0 !important',
  overflow: 'hidden',
  '&:not(:last-of-type)': {
    borderBottom: '0 !important'
  },
  '&:before': {
    display: 'none'
  },
  '&.Mui-expanded': {
    margin: 'auto'
  },
  '&:first-of-type': {
    borderTopLeftRadius: 'var(--mui-shape-customBorderRadius-lg) !important',
    borderTopRightRadius: 'var(--mui-shape-customBorderRadius-lg) !important'
  },
  '&:last-of-type': {
    borderBottomLeftRadius: 'var(--mui-shape-customBorderRadius-lg) !important',
    borderBottomRightRadius: 'var(--mui-shape-customBorderRadius-lg) !important'
  }
}))

// Styled component for AccordionSummary component
const AccordionSummary = styled(MuiAccordionSummary)<AccordionSummaryProps>(({ theme }) => ({
  marginBottom: -1,
  transition: 'none',
  backgroundColor: 'var(--mui-palette-customColors-greyLightBg)',
  borderBottom: '1px solid var(--mui-palette-divider) !important'
}))

// Styled component for AccordionDetails component
const AccordionDetails = styled(MuiAccordionDetails)<AccordionDetailsProps>(({ theme }) => ({
  padding: `${theme.spacing(4)} !important`
}))

// Expand icon component using remix icons
const expandIcon = (value: string, expandedAccordions: Set<string>) => (
  <i className={expandedAccordions.has(value) ? 'ri-subtract-line' : 'ri-add-line'} />
)

// Types
interface Material {
  id: string
  name: string
  brand_name: string
  material_name: string
  width_mm: number
  length_mm: number
  thickness_mm: number
  grain_direction: boolean
  active: boolean
  on_stock: boolean
  image_url?: string
  kerf_mm: number
  trim_top_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  trim_right_mm: number
  rotatable: boolean
  waste_multi: number
  usage_limit: number
  price_per_sqm: number
  vat_percent: number
  currency: string
  created_at: string
  updated_at: string
}

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  discount_percent: number
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  created_at: string
  updated_at: string
}

interface Panel {
  id: string
  táblásAnyag: string
  hosszúság: string
  szélesség: string
  darab: string
  jelölés: string
  élzárás: string
  élzárásA: string
  élzárásB: string
  élzárásC: string
  élzárásD: string
  pánthelyfúrás_mennyiség: number  // 0, 2, 3, or 4
  pánthelyfúrás_oldal: string      // 'hosszú' or 'rövid'
  duplungolás: boolean
  szögvágás: boolean
}

interface Placement {
  id: string
  x_mm: number
  y_mm: number
  w_mm: number
  h_mm: number
  rot_deg: number
  board_id?: number
}

interface MaterialOptimizationResult {
  material_id: string
  material_name: string
    placements: Placement[]
  unplaced: Array<{ id: string; w_mm: number; h_mm: number }>
    metrics: {
      used_area_mm2: number
      board_area_mm2: number
      waste_pct: number
      placed_count: number
    unplaced_count: number
    boards_used: number
    total_cut_length_mm: number
  }
  board_cut_lengths: { [boardId: number]: number }
  debug: {
    board_width: number
    board_height: number
    usable_width: number
    usable_height: number
    bins_count: number
    panels_count: number
  }
}

interface OptimizationResult {
  materials: MaterialOptimizationResult[]
  totalMetrics: {
    total_materials: number
    total_used_area_mm2: number
    total_board_area_mm2: number
    overall_waste_pct: number
    total_placed_count: number
    total_unplaced_count: number
  }
}

interface EdgeMaterial {
  id: string
  brand_id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  vat_id: string
  favourite_priority: number | null
  created_at: string
  updated_at: string
  brands: {
    name: string
  }
  vat: {
    name: string
    kulcs: number
  }
}

// Props interface for OptiClient
interface OptiClientProps {
  initialMaterials: Material[]
  initialCustomers: Customer[]
  initialEdgeMaterials: EdgeMaterial[]
  initialCuttingFee: any // From database: { fee_per_meter, currencies, vat }
  initialQuoteData?: any // Optional: Quote data for editing mode
}

export default function OptiClient({ 
  initialMaterials, 
  initialCustomers, 
  initialEdgeMaterials,
  initialCuttingFee,
  initialQuoteData
}: OptiClientProps) {
  const router = useRouter()
  
  // Check permission for this page
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = canAccess('/opti')
  
  // Use SSR data instead of API calls
  const materials = initialMaterials || []
  const customers = initialCustomers || []
  const rawEdgeMaterials = initialEdgeMaterials || []

  // Filter only active materials for optimization
  const activeMaterials = useMemo(() => {
    return materials
      .filter(m => m.active !== false)
      .sort((a, b) => {
        // Sort by brand first, then by name
        const brandA = (a.brand_name?.trim() || 'Ismeretlen')
        const brandB = (b.brand_name?.trim() || 'Ismeretlen')
        
        if (brandA !== brandB) {
          return brandA.localeCompare(brandB, 'hu')
        }
        
        return a.name.localeCompare(b.name, 'hu')
      })
  }, [materials])

  // Sort edge materials by favourite_priority (favourites first, then alphabetically)
  const edgeMaterials = useMemo(() => {
    return [...rawEdgeMaterials].sort((a, b) => {
      const aPriority = a.favourite_priority ?? 999999
      const bPriority = b.favourite_priority ?? 999999
      
      // If priorities are different, sort by priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // If same priority (or both non-favourite), sort alphabetically by decor
      return a.decor.localeCompare(b.decor, 'hu')
    })
  }, [rawEdgeMaterials])

  // OPTIMIZATION: Create material lookup map for O(1) access
  const materialLookup = useMemo(() => {
    const map = new Map()
    materials.forEach(m => {
      const key = `${m.name}|${m.width_mm}|${m.length_mm}`
      map.set(key, m)
    })
    console.log(`[PERF] Material lookup map created with ${map.size} entries`)
    return map
  }, [materials])

  // Custom render for edge material options with favourites highlighted
  const renderEdgeMaterialOption = (props: any, option: EdgeMaterial, index: number) => {
    const isFavourite = option.favourite_priority !== null && option.favourite_priority !== undefined
    
    // Check if this is the last favourite (for separator)
    const isLastFavourite = isFavourite && 
      (index === edgeMaterials.length - 1 || 
       !edgeMaterials[index + 1]?.favourite_priority)
    
    // Extract key from props to avoid spreading it
    const { key, ...otherProps } = props
    
    return (
      <React.Fragment key={key}>
        <Box
          component="li"
          {...otherProps}
          sx={{
            ...otherProps.sx,
            backgroundColor: isFavourite ? 'rgba(255, 193, 7, 0.15)' : 'transparent',
            '&:hover': {
              backgroundColor: isFavourite ? 'rgba(255, 193, 7, 0.25)' : 'rgba(0, 0, 0, 0.04)',
            },
            borderLeft: isFavourite ? '4px solid #ffc107' : 'none',
            paddingLeft: isFavourite ? '12px' : '16px',
          }}
        >
          {formatEdgeMaterialName(option)}
        </Box>
        {isLastFavourite && (
          <Box 
            component="li" 
            sx={{ 
              borderBottom: '2px solid #ffc107',
              height: 0,
              padding: 0,
              margin: 0,
              pointerEvents: 'none',
              listStyle: 'none'
            }}
          />
        )}
      </React.Fragment>
    )
  }

  // State
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderPolicy, setOrderPolicy] = useState<'LSF' | 'LAF' | 'DH'>('LAF')
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(new Set())
  const [currentBoardPerMaterial, setCurrentBoardPerMaterial] = useState<Map<string, number>>(new Map())
  const [selectedTáblásAnyag, setSelectedTáblásAnyag] = useState<string>('')
  const [selectedA, setSelectedA] = useState<string>('')
  const [selectedB, setSelectedB] = useState<string>('')
  const [selectedC, setSelectedC] = useState<string>('')
  const [selectedD, setSelectedD] = useState<string>('')
  
  // State for showing optimization data card
  const [showOptimizationData, setShowOptimizationData] = useState(false)
  const [showQuote, setShowQuote] = useState(false)
  
  // Customer data state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    discount: '',
    billing_name: '',
    billing_country: 'Magyarország',
    billing_city: '',
    billing_postal_code: '',
    billing_street: '',
    billing_house_number: '',
    billing_tax_number: '',
    billing_company_reg_number: ''
  })
  
  // Quote saving state
  const [isSavingQuote, setIsSavingQuote] = useState(false)
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)
  
  // Quote editing state
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  
  // Panel form state for the separate table
  const [panelForm, setPanelForm] = useState({
    hosszúság: '',
    szélesség: '',
    darab: '',
    jelölés: ''
  })

  // Validation states for required fields
  const [validationErrors, setValidationErrors] = useState({
    hosszúság: false,
    szélesség: false,
    darab: false,
    táblásAnyag: false
  })

  // Customer validation state
  const [customerValidationError, setCustomerValidationError] = useState<string | null>(null)

  // Validate customer name uniqueness
  const validateCustomerName = async (name: string) => {
    if (!name.trim()) {
      setCustomerValidationError(null)
      return true
    }

    // If editing existing customer and name hasn't changed, no validation needed
    if (selectedCustomer && selectedCustomer.name === name.trim()) {
      setCustomerValidationError(null)
      return true
    }

    try {
      const response = await fetch(`/api/customers/check-name?name=${encodeURIComponent(name.trim())}`)
      const result = await response.json()
      
      if (result.exists) {
        setCustomerValidationError('Ez az ügyfél név már létezik')
        return false
      } else {
        setCustomerValidationError(null)
        return true
      }
    } catch (error) {
      console.error('Error validating customer name:', error)
      setCustomerValidationError('Hiba a név ellenőrzése során')
      return false
    }
  }

  // Validation function
  const validateForm = () => {
    const errors = {
      hosszúság: !panelForm.hosszúság || parseFloat(panelForm.hosszúság) <= 0,
      szélesség: !panelForm.szélesség || parseFloat(panelForm.szélesség) <= 0,
      darab: !panelForm.darab || parseInt(panelForm.darab) <= 0,
      táblásAnyag: !selectedTáblásAnyag
    }
    
    setValidationErrors(errors)
    return !Object.values(errors).some(error => error)
  }

  // Clear validation errors when user starts typing
  const clearValidationError = (field: keyof typeof validationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: false }))
    }
  }

  // Format edge material display name
  const formatEdgeMaterialName = (material: EdgeMaterial) => {
    return `${material.type}-${material.width}/${material.thickness}-${material.decor}`
  }

  const getEdgeMaterialNameById = (id: string) => {
    const material = edgeMaterials.find(m => m.id === id)
    return material ? formatEdgeMaterialName(material) : id
  }
  
  // Separate panels table state
  const [addedPanels, setAddedPanels] = useState<Panel[]>([])
  
  // Track if we've loaded from session to prevent premature clearing
  const [hasLoadedFromSession, setHasLoadedFromSession] = useState(false)

  // Load panels from session storage on component mount
  useEffect(() => {
    const savedPanels = sessionStorage.getItem('opti-panels')
    if (savedPanels) {
      try {
        setAddedPanels(JSON.parse(savedPanels))
      } catch (error) {
        console.error('Error loading panels from session storage:', error)
      }
    }
    
    // Load customer data from session storage
    const savedCustomerData = sessionStorage.getItem('opti-customer-data')
    if (savedCustomerData) {
      try {
        const parsedData = JSON.parse(savedCustomerData)
        setCustomerData(parsedData.customerData)
        // Note: selectedCustomer is not restored - user must reselect from dropdown
      } catch (error) {
        console.error('Error loading customer data from session storage:', error)
      }
    }
    
    // Mark that we've loaded from session
    setHasLoadedFromSession(true)
  }, [])

  // Save panels to session storage whenever addedPanels changes
  useEffect(() => {
    if (addedPanels.length > 0) {
      sessionStorage.setItem('opti-panels', JSON.stringify(addedPanels))
    } else {
      sessionStorage.removeItem('opti-panels')
    }
  }, [addedPanels])

  // Save customer data to session storage whenever it changes
  useEffect(() => {
    // Don't save during initial mount - wait for session load to complete
    if (!hasLoadedFromSession) return
    
    // Only save if customer has a name (not empty state)
    if (customerData.name && customerData.name.trim()) {
      sessionStorage.setItem('opti-customer-data', JSON.stringify({ customerData }))
    } else {
      sessionStorage.removeItem('opti-customer-data')
    }
  }, [customerData, hasLoadedFromSession])

  // Load quote data for editing (if initialQuoteData is provided)
  useEffect(() => {
    if (initialQuoteData && materials.length > 0 && edgeMaterials.length > 0) {
      console.log('Loading quote for editing:', initialQuoteData.quote_number)
      
      setIsEditMode(true)
      setEditingQuoteId(initialQuoteData.id)
      // Don't set savedQuoteNumber here - only after successful save
      
      // Populate customer data
      if (initialQuoteData.customer) {
        const customer = initialQuoteData.customer
        
        // Find and set customer in dropdown
        const customerInList = customers.find(c => c.id === customer.id)
        if (customerInList) {
          setSelectedCustomer(customerInList)
        }
        
        setCustomerData({
          name: customer.name || '',
          email: customer.email || '',
          phone: customer.mobile || '',
          discount: customer.discount_percent?.toString() || '0',
          billing_name: customer.billing_name || '',
          billing_country: customer.billing_country || 'Magyarország',
          billing_city: customer.billing_city || '',
          billing_postal_code: customer.billing_postal_code || '',
          billing_street: customer.billing_street || '',
          billing_house_number: customer.billing_house_number || '',
          billing_tax_number: customer.billing_tax_number || '',
          billing_company_reg_number: customer.billing_company_reg_number || ''
        })
      }
      
      // Populate panels
      if (initialQuoteData.panels && initialQuoteData.panels.length > 0) {
        const loadedPanels: Panel[] = initialQuoteData.panels.map((panel: any, index: number) => {
          // Use material name only (no dimensions)
          const material = materials.find(m => m.id === panel.material_id)
          const táblásAnyag = material ? material.name : 'Unknown Material'
          
          return {
            id: `panel-${Date.now()}-${index}`,
            táblásAnyag: táblásAnyag,
            hosszúság: panel.width_mm.toString(),
            szélesség: panel.height_mm.toString(),
            darab: panel.quantity.toString(),
            jelölés: panel.label || '',
            élzárás: '', // Not used
            élzárásA: panel.edge_material_a_id || '',
            élzárásB: panel.edge_material_b_id || '',
            élzárásC: panel.edge_material_c_id || '',
            élzárásD: panel.edge_material_d_id || '',
            pánthelyfúrás_mennyiség: panel.panthelyfuras_quantity || 0,
            pánthelyfúrás_oldal: panel.panthelyfuras_oldal || '',
            duplungolás: panel.duplungolas || false,
            szögvágás: panel.szogvagas || false
          }
        })
        
        setAddedPanels(loadedPanels)
        console.log(`Loaded ${loadedPanels.length} panels from quote`)
      }
    }
  }, [initialQuoteData, materials, edgeMaterials, customers])

  // Calculate quote from optimization results
  const quoteResult = useMemo<QuoteResult | null>(() => {
    if (!optimizationResult || !optimizationResult.materials || optimizationResult.materials.length === 0) {
      return null
    }

    console.log('[QUOTE] Starting quote calculation for', optimizationResult.materials.length, 'materials')

    // Convert materials to MaterialInfo format
    const materialInfos = optimizationResult.materials.map(result => {
      const material = materials.find(m => m.id === result.material_id)
      if (!material) return null

      return {
        id: material.id,
        name: material.name,
        width_mm: material.width_mm,
        length_mm: material.length_mm,
        on_stock: material.on_stock,
        usage_limit: material.usage_limit,
        price_per_sqm: material.price_per_sqm,
        vat_rate: material.vat_percent / 100, // Convert from percentage to decimal
        waste_multi: material.waste_multi,
        currency: material.currency
      }
    }).filter(Boolean) as any[]

    // Extract panel edges grouped by material
    const panelEdgesByMaterial = new Map<string, any[]>()
    
    addedPanels.forEach(panel => {
      // Find material by name only (no dimensions in táblásAnyag anymore)
      const materialName = panel.táblásAnyag.trim()
      const material = materials.find(m => m.name === materialName)
      if (!material) return

      const length = parseInt(panel.hosszúság)
      const width = parseInt(panel.szélesség)
      const quantity = parseInt(panel.darab)

      // Initialize array for this material if needed
      if (!panelEdgesByMaterial.has(material.id)) {
        panelEdgesByMaterial.set(material.id, [])
      }
      const materialEdges = panelEdgesByMaterial.get(material.id)!

      console.log('[QUOTE] Panel edges for', material.name, ':', panel.élzárásA, panel.élzárásB, panel.élzárásC, panel.élzárásD)

      // Top edge (A)
      if (panel.élzárásA && panel.élzárásA !== '') {
        materialEdges.push({
          edge_material_name: panel.élzárásA,
          length_mm: length,
          quantity: quantity
        })
      }
      // Right edge (B)
      if (panel.élzárásB && panel.élzárásB !== '') {
        materialEdges.push({
          edge_material_name: panel.élzárásB,
          length_mm: width,
          quantity: quantity
        })
      }
      // Bottom edge (C)
      if (panel.élzárásC && panel.élzárásC !== '') {
        materialEdges.push({
          edge_material_name: panel.élzárásC,
          length_mm: length,
          quantity: quantity
        })
      }
      // Left edge (D)
      if (panel.élzárásD && panel.élzárásD !== '') {
        materialEdges.push({
          edge_material_name: panel.élzárásD,
          length_mm: width,
          quantity: quantity
        })
      }
    })

    console.log('[QUOTE] Edges grouped by material:', Array.from(panelEdgesByMaterial.entries()).map(([id, edges]) => ({ material_id: id, edge_count: edges.length })))

    // Convert edge materials to EdgeMaterialInfo map (use ID as key)
    const edgeMaterialInfoMap = new Map()
    edgeMaterials.forEach(em => {
      const displayName = `${em.type}-${em.width}/${em.thickness}-${em.decor}`
      edgeMaterialInfoMap.set(em.id, { // Use ID as key
        name: displayName, // But use formatted name for display
        price_per_m: em.price || 0,
        vat_rate: (em.vat?.kulcs || 0) / 100, // Convert from percentage to decimal
        overhang_mm: em.ráhagyás || 0,
        currency: 'HUF' // Assuming HUF for now
      })
    })

    console.log('[QUOTE] Edge material map keys (IDs):', Array.from(edgeMaterialInfoMap.keys()))

    // Group panels by material ID for services calculation
    const panelsByMaterial = new Map<string, any[]>()
    addedPanels.forEach(panel => {
      // Find material by name only (no dimensions in táblásAnyag anymore)
      const materialName = panel.táblásAnyag.trim()
      const material = materials.find(m => m.name === materialName)
      if (!material) return

      if (!panelsByMaterial.has(material.id)) {
        panelsByMaterial.set(material.id, [])
      }
      
      panelsByMaterial.get(material.id)!.push({
        width_mm: parseInt(panel.szélesség),
        height_mm: parseInt(panel.hosszúság),
        quantity: parseInt(panel.darab),
        panthelyfuras_quantity: panel.pánthelyfúrás_mennyiség || 0,
        panthelyfuras_side: panel.pánthelyfúrás_oldal || 'hosszú',
        duplungolas: panel.duplungolás || false,
        szogvagas: panel.szögvágás || false
      })
    })

    console.log('[QUOTE] Panels grouped by material:', Array.from(panelsByMaterial.entries()).map(([id, panels]) => ({ material_id: id, panel_count: panels.length })))

    // Convert cutting fee to CuttingFeeInfo format
    const cuttingFeeInfo = initialCuttingFee ? {
      fee_per_meter: initialCuttingFee.fee_per_meter || 0,
      panthelyfuras_fee_per_hole: initialCuttingFee.panthelyfuras_fee_per_hole || 50,
      duplungolas_fee_per_sqm: initialCuttingFee.duplungolas_fee_per_sqm || 200,
      szogvagas_fee_per_panel: initialCuttingFee.szogvagas_fee_per_panel || 100,
      vat_rate: (initialCuttingFee.vat?.kulcs || 0) / 100, // Convert from percentage to decimal
      currency: initialCuttingFee.currencies?.name || 'HUF'
    } : null

    console.log('[QUOTE] Cutting fee info:', cuttingFeeInfo)

    try {
      const result = calculateQuote(
        optimizationResult.materials,
        materialInfos,
        panelEdgesByMaterial,
        edgeMaterialInfoMap,
        cuttingFeeInfo,
        panelsByMaterial
      )
      console.log('[QUOTE] Quote calculated successfully:', result)
      return result
    } catch (error) {
      console.error('[QUOTE] Error calculating quote:', error)
      return null
    }
  }, [optimizationResult, materials, addedPanels, edgeMaterials, initialCuttingFee])
  
  // Edit state
  const [editingPanel, setEditingPanel] = useState<string | null>(null)
  const [duplungolas, setDuplungolas] = useState(false)
  
  // Handle duplungolás toggle
  const handleDuplungolasChange = (checked: boolean) => {
    setDuplungolas(checked)
    
    if (checked && panelForm.darab && parseInt(panelForm.darab) > 0) {
      // Double the darab value
      const currentDarab = parseInt(panelForm.darab)
      const doubledDarab = currentDarab * 2
      setPanelForm({...panelForm, darab: doubledDarab.toString()})
      
      // Show warning toast message
      toast.warning('Darabszám megduplázodott duplungálás okán')
    }
  }
  const [szögvágás, setSzögvágás] = useState(false)
  
  // Pánthelyfúrás modal state
  const [panthelyfurasModalOpen, setPanthelyfurasModalOpen] = useState(false)
  const [panthelyfurasMennyiseg, setPanthelyfurasMennyiseg] = useState('2')
  const [panthelyfurasOldal, setPanthelyfurasOldal] = useState('hosszu')
  const [panthelyfurasSaved, setPanthelyfurasSaved] = useState(false)
  
  // Pánthelyfúrás modal handlers
  const handlePanthelyfurasOpen = () => {
    setPanthelyfurasModalOpen(true)
  }
  
  const handlePanthelyfurasClose = () => {
    setPanthelyfurasModalOpen(false)
  }
  
  const handlePanthelyfurasSave = () => {
    // Here you can add logic to save the pánthelyfúrás data
    setPanthelyfurasSaved(true)
    setPanthelyfurasModalOpen(false)
  }
  
  const handlePanthelyfurasDelete = () => {
    // Here you can add logic to delete the pánthelyfúrás data
    setPanthelyfurasSaved(false)
    setPanthelyfurasModalOpen(false)
  }

  // Add panel to separate table
  const addPanelToTable = () => {
    // Validation
    if (!validateForm()) {
      toast.error('Kérjük, töltse ki az összes kötelező mezőt!')
      return
    }

    // Get material name
    const material = materials.find(m => m.id === selectedTáblásAnyag)
    const materialName = material ? material.name : 'Ismeretlen anyag'

    // Create élzárás string from Hosszú felső, Széles jobb, Hosszú alsó, Széles bal selections
    const élzárás = [selectedA, selectedB, selectedC, selectedD]
      .filter(val => val && val !== '')
      .join(', ')

    // Add new panel to table
    const newPanel: Panel = {
      id: Date.now().toString(),
      táblásAnyag: materialName,
      hosszúság: panelForm.hosszúság,
      szélesség: panelForm.szélesség,
      darab: panelForm.darab,
      jelölés: panelForm.jelölés || '-',
      élzárás: élzárás || '-',
      élzárásA: selectedA || '',
      élzárásB: selectedB || '',
      élzárásC: selectedC || '',
      élzárásD: selectedD || '',
      pánthelyfúrás_mennyiség: panthelyfurasSaved ? parseInt(panthelyfurasMennyiseg) : 0,
      pánthelyfúrás_oldal: panthelyfurasSaved ? panthelyfurasOldal : 'hosszú',
      duplungolás: duplungolas,
      szögvágás: szögvágás
    }

    setAddedPanels(prev => [...prev, newPanel])
    
    // Clear optimization results when new panels are added
    setOptimizationResult(null)

    // Show success toast
    toast.success('Panel sikeresen hozzáadva!')

    // Clear form but keep the same material selected for next entry
    setPanelForm({
      hosszúság: '',
      szélesség: '',
      darab: '',
      jelölés: ''
    })
    setSelectedA('')
    setSelectedB('')
    setSelectedC('')
    setSelectedD('')
    setDuplungolas(false)
    setSzögvágás(false)
    setPanthelyfurasSaved(false)
    setPanthelyfurasMennyiseg('2')
    setPanthelyfurasOldal('hosszu')
    // Keep selectedTáblásAnyag unchanged for next entry
  }

  // Delete panel from table
  const deletePanelFromTable = (id: string) => {
    setAddedPanels(prev => prev.filter(panel => panel.id !== id))
    
    // Clear optimization results when panels are removed
    setOptimizationResult(null)
    
    // Show error toast
    toast.error('Panel sikeresen törölve!')
  }

  // Edit panel - load record into form
  const editPanel = (panel: any) => {
    setEditingPanel(panel.id)
    
    // Find the material ID from the panel's táblásAnyag string (now just material name)
    const material = materials.find(m => m.name === panel.táblásAnyag)
    
    if (material) {
      setSelectedTáblásAnyag(material.id)
    }
    
    // Load form data
    setPanelForm({
      hosszúság: panel.hosszúság,
      szélesség: panel.szélesség,
      darab: panel.darab,
      jelölés: panel.jelölés
    })
    
    // Load individual edge finishing selections
    setSelectedA(panel.élzárásA || '')
    setSelectedB(panel.élzárásB || '')
    setSelectedC(panel.élzárásC || '')
    setSelectedD(panel.élzárásD || '')
    
    // Load additional services
    setDuplungolas(panel.duplungolás || false)
    setSzögvágás(panel.szögvágás || false)
    if (panel.pánthelyfúrás_mennyiség && panel.pánthelyfúrás_mennyiség > 0) {
      setPanthelyfurasSaved(true)
      setPanthelyfurasMennyiseg(panel.pánthelyfúrás_mennyiség.toString())
      setPanthelyfurasOldal(panel.pánthelyfúrás_oldal || 'hosszú')
    } else {
      setPanthelyfurasSaved(false)
      setPanthelyfurasMennyiseg('2')
      setPanthelyfurasOldal('hosszú')
    }
    
    // Scroll to the top of the page
    setTimeout(() => {
      window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      })
    }, 100)
  }

  // Save edited panel
  const savePanel = () => {
    if (!editingPanel || !selectedTáblásAnyag || !panelForm.hosszúság || !panelForm.szélesség || !panelForm.darab) {
      alert('Kérjük töltse ki az összes kötelező mezőt!')
      return
    }

    // Get material name (no dimensions)
    const material = materials.find(m => m.id === selectedTáblásAnyag)
    const materialName = material ? material.name : 'Ismeretlen anyag'

    // Create élzárás string from Hosszú felső, Széles jobb, Hosszú alsó, Széles bal selections
    const élzárás = [selectedA, selectedB, selectedC, selectedD]
      .filter(val => val && val !== '')
      .join(', ')

    // Update panel in table
    setAddedPanels(prev => prev.map(panel => 
      panel.id === editingPanel 
        ? {
            ...panel,
            táblásAnyag: materialName,
            hosszúság: panelForm.hosszúság,
            szélesség: panelForm.szélesség,
            darab: panelForm.darab,
            jelölés: panelForm.jelölés || '-',
            élzárás: élzárás || '-',
            élzárásA: selectedA || '',
            élzárásB: selectedB || '',
            élzárásC: selectedC || '',
            élzárásD: selectedD || '',
            pánthelyfúrás_mennyiség: panthelyfurasSaved ? parseInt(panthelyfurasMennyiseg) : 0,
            pánthelyfúrás_oldal: panthelyfurasSaved ? panthelyfurasOldal : 'hosszú',
            duplungolás: duplungolas,
            szögvágás: szögvágás
          }
        : panel
    ))
    
    // Clear optimization results when panels are modified
    setOptimizationResult(null)

    // Show success toast
    toast.success('Panel sikeresen módosítva!')

    // Clear form and exit edit mode
    setEditingPanel(null)
    setPanelForm({
      hosszúság: '',
      szélesség: '',
      darab: '',
      jelölés: ''
    })
    setSelectedTáblásAnyag('')
    setSelectedA('')
    setSelectedB('')
    setSelectedC('')
    setSelectedD('')
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingPanel(null)
    setPanelForm({
      hosszúság: '',
      szélesség: '',
      darab: '',
      jelölés: ''
    })
    // Keep the material selected when canceling edit
    setSelectedA('')
    setSelectedB('')
    setSelectedC('')
    setSelectedD('')
    setDuplungolas(false)
    setSzögvágás(false)
    setPanthelyfurasSaved(false)
    setPanthelyfurasMennyiseg('2')
    setPanthelyfurasOldal('hosszú')
  }

  // Hungarian phone number formatting helper
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // If it starts with 36, keep it as is, otherwise add 36
    let formatted = digits

    if (!digits.startsWith('36') && digits.length > 0) {
      formatted = '36' + digits
    }
    
    // Format: +36 30 999 2800
    if (formatted.length >= 2) {
      const countryCode = formatted.substring(0, 2)
      const areaCode = formatted.substring(2, 4)
      const firstPart = formatted.substring(4, 7)
      const secondPart = formatted.substring(7, 11)
      
      let result = `+${countryCode}`

      if (areaCode) result += ` ${areaCode}`
      if (firstPart) result += ` ${firstPart}`
      if (secondPart) result += ` ${secondPart}`
      
      return result
    }
    
    return value
  }

  // Hungarian tax number (adószám) formatting helper
  const formatTaxNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 8) {
      return digits
    } else if (digits.length <= 9) {
      return `${digits.substring(0, 8)}-${digits.substring(8)}`
    } else if (digits.length <= 11) {
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9)}`
    } else {
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9, 11)}`
    }
  }

  // Hungarian company registration number (cégjegyzékszám) formatting helper
  const formatCompanyRegNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) {
      return digits
    } else if (digits.length <= 4) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`
    } else if (digits.length <= 10) {
      return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4)}`
    } else {
      return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 10)}`
    }
  }

  // Get selected material and calculate max dimensions
  const selectedMaterial = materials.find(m => m.id === selectedTáblásAnyag)
  const maxSzalirany = selectedMaterial ? selectedMaterial.length_mm - selectedMaterial.trim_left_mm - selectedMaterial.trim_right_mm : 0
  const maxKeresztirany = selectedMaterial ? selectedMaterial.width_mm - selectedMaterial.trim_top_mm - selectedMaterial.trim_bottom_mm : 0

  // Dimension validation helpers
  const validateSzalirany = (value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue <= 0) return value
    if (numValue > maxSzalirany) return maxSzalirany.toString()
    return value
  }

  const validateKeresztirany = (value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue <= 0) return value
    if (numValue > maxKeresztirany) return maxKeresztirany.toString()
    return value
  }

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer)
    // Clear any validation errors when selecting a customer
    setCustomerValidationError(null)
    
    if (customer) {
      const newCustomerData = {
        name: customer.name,
        email: customer.email,
        phone: customer.mobile,
        discount: customer.discount_percent.toString(),
        billing_name: customer.billing_name || '',
        billing_country: customer.billing_country || 'Magyarország',
        billing_city: customer.billing_city || '',
        billing_postal_code: customer.billing_postal_code || '',
        billing_street: customer.billing_street || '',
        billing_house_number: customer.billing_house_number || '',
        billing_tax_number: customer.billing_tax_number || '',
        billing_company_reg_number: customer.billing_company_reg_number || ''
      }
      setCustomerData(newCustomerData)
    } else {
      setCustomerData({
        name: '',
        email: '',
        phone: '',
        discount: '',
        billing_name: '',
        billing_country: 'Magyarország',
        billing_city: '',
        billing_postal_code: '',
        billing_street: '',
        billing_house_number: '',
        billing_tax_number: '',
        billing_company_reg_number: ''
      })
    }
  }

  // Handle customer data input changes
  const handleCustomerDataChange = (field: string, value: string) => {
    let formattedValue = value
    
    // Apply formatting based on field type
    if (field === 'phone') {
      formattedValue = formatPhoneNumber(value)
    } else if (field === 'billing_tax_number') {
      formattedValue = formatTaxNumber(value)
    } else if (field === 'billing_company_reg_number') {
      formattedValue = formatCompanyRegNumber(value)
    }
    
    setCustomerData(prev => {
      const newData = {
        ...prev,
        [field]: formattedValue
      }
      return newData
    })

    // Validate customer name if it's the name field
    if (field === 'name') {
      // Debounce validation to avoid too many API calls
      setTimeout(() => {
        validateCustomerName(formattedValue)
      }, 500)
    }
  }

  // Handle Enter key press
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (editingPanel) {
        savePanel()
      } else {
        addPanelToTable()
      }
      // Focus on hosszúság input after action
      setTimeout(() => {
        const hosszúságInput = document.querySelector('input[name="hosszúság"]') as HTMLInputElement
        if (hosszúságInput) {
          hosszúságInput.focus()
        }
      }, 100)
    }
  }

  // API errors handled via SSR, no client-side error handling needed

  // Initialize board indices when optimization result changes
  useEffect(() => {
    if (optimizationResult && optimizationResult.materials.length > 0) {
      // Initialize board indices for each material
      const newBoardIndices = new Map<string, number>()
      optimizationResult.materials.forEach(material => {
        newBoardIndices.set(material.material_id, 0) // Start with first board
      })
      setCurrentBoardPerMaterial(newBoardIndices)
    }
  }, [optimizationResult])




  // Optimize panel preview calculation
  const panelPreviewStyle = useMemo(() => {
    if (!panelForm.hosszúság || !panelForm.szélesség) {
      return { width: '100px', height: '100px' }
    }
    
    const width = parseFloat(panelForm.hosszúság) || 0
    const height = parseFloat(panelForm.szélesség) || 0
    if (width === 0 || height === 0) return { width: '100px', height: '100px' }
    
    const aspectRatio = width / height
    const maxHeight = 170
    const maxWidth = 300
    
    if (aspectRatio > 1) {
      // Landscape
      const calculatedWidth = Math.min(maxWidth, maxHeight * aspectRatio)
      const calculatedHeight = calculatedWidth / aspectRatio
      return { width: `${calculatedWidth}px`, height: `${calculatedHeight}px` }
    } else {
      // Portrait
      const calculatedHeight = Math.min(maxHeight, maxWidth / aspectRatio)
      const calculatedWidth = calculatedHeight * aspectRatio
      return { width: `${calculatedWidth}px`, height: `${calculatedHeight}px` }
    }
  }, [panelForm.hosszúság, panelForm.szélesség])

  // Optimize grain direction calculation
  const grainDirectionLines = useMemo(() => {
    const selectedMaterial = materials.find(m => m.id === selectedTáblásAnyag)
    if (!selectedMaterial?.grain_direction) return null
    
    const lines = []
    for (let i = 0; i < 8; i++) {
      lines.push(
        <Box
          key={`grain-${i}`}
          sx={{
            position: 'absolute',
            top: `${(i + 1) * 12.5}%`,
            left: '5%',
            right: '5%',
            height: '1px',
            backgroundColor: '#999',
            opacity: 0.6
          }}
        />
      )
    }
    return lines
  }, [materials, selectedTáblásAnyag])

  // addedPanels already have the correct Panel structure

  // Optimize with multiple materials using addedPanels
  const optimize = async () => {
    
    if (!customerData.name.trim()) {
      setError('Kérjük, töltse ki a megrendelő nevét!')
      toast.error('Kérjük, töltse ki a megrendelő nevét!')
      return
    }
    
    if (addedPanels.length === 0) {
      setError('Please add at least one panel to optimize')
      return
    }

    console.time('[OPTI] Total Optimization Time')
    setIsOptimizing(true)
    setError(null)
    
    // Reset saved state when re-optimizing (user made changes)
    setSavedQuoteNumber(null)

    try {
      // Group addedPanels by material
      console.time('[OPTI] Panel Grouping')
      const panelsByMaterial = new Map<string, { material: Material; panels: any[] }>()
      
      addedPanels.forEach(addedPanel => {
        // Find material by name only (no dimensions in táblásAnyag anymore)
        const materialName = addedPanel.táblásAnyag.trim()
        const material = materials.find(m => m.name === materialName)
        
        if (!material) {
          console.warn('Material not found in materials array:', materialName)
          return
        }
        
        const materialId = material.id
        if (!panelsByMaterial.has(materialId)) {
          panelsByMaterial.set(materialId, {
            material: material,
            panels: []
          })
        }
        
        // Convert addedPanel to panel format
        const panel = {
          id: addedPanel.id,
          material: material,
          length: parseInt(addedPanel.hosszúság),
          width: parseInt(addedPanel.szélesség),
          quantity: parseInt(addedPanel.darab),
          marking: addedPanel.jelölés,
          edgeTop: addedPanel.élzárás.includes('A') ? 'A' : 'None',
          edgeRight: addedPanel.élzárás.includes('B') ? 'B' : 'None',
          edgeBottom: addedPanel.élzárás.includes('C') ? 'C' : 'None',
          edgeLeft: addedPanel.élzárás.includes('D') ? 'D' : 'None'
        }
        
        panelsByMaterial.get(materialId)!.panels.push(panel)
      })
      console.timeEnd('[OPTI] Panel Grouping')

      console.time('[OPTI] Request Preparation')
      const materialsForOptimization = Array.from(panelsByMaterial.values()).map(({ material, panels: materialPanels }) => {
        // Prepare all parts for this material
        const allParts = materialPanels.flatMap(panel => 
        Array.from({ length: panel.quantity }, (_, i) => ({
          id: `${panel.id}-${i + 1}`,
          w_mm: panel.width,
          h_mm: panel.length,
          qty: 1,
            allow_rot_90: panel.material.rotatable, // Use rotatable field from database
          grain_locked: panel.material.grain_direction
        }))
      )
      
        return {
          id: material.id,
          name: material.name,
          parts: allParts,
               board: {
            w_mm: material.width_mm,
            h_mm: material.length_mm,
            trim_top_mm: material.trim_top_mm || 0,
            trim_right_mm: material.trim_right_mm || 0,
            trim_bottom_mm: material.trim_bottom_mm || 0,
            trim_left_mm: material.trim_left_mm || 0
          },
               params: {
            kerf_mm: material.kerf_mm || 3,
                 seed: 123456,
                 order_policy: orderPolicy
               }
             }
      })
      console.timeEnd('[OPTI] Request Preparation')

      // Call multi-material optimization service
      const request = { materials: materialsForOptimization }
      console.log(`[OPTI] Calling optimization API with ${materialsForOptimization.length} materials`)
        
      console.time('[OPTI] API Call (Guillotine Algorithm)')
      const response = await fetch('/api/optimize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        })

        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Optimization failed: ${response.statusText}`)
        }

      const results = await response.json()
      console.timeEnd('[OPTI] API Call (Guillotine Algorithm)')

      console.time('[OPTI] Results Processing')
      // Calculate total metrics
      const totalUsedArea = results.reduce((sum: number, result: any) => sum + result.metrics.used_area_mm2, 0)
      const totalBoardArea = results.reduce((sum: number, result: any) => sum + result.metrics.board_area_mm2, 0)
      const totalPlaced = results.reduce((sum: number, result: any) => sum + result.metrics.placed_count, 0)
      const totalUnplaced = results.reduce((sum: number, result: any) => sum + result.metrics.unplaced_count, 0)


      const finalResult: OptimizationResult = {
        materials: results,
        totalMetrics: {
          total_materials: results.length,
          total_used_area_mm2: totalUsedArea,
          total_board_area_mm2: totalBoardArea,
          overall_waste_pct: totalBoardArea > 0 ? ((totalBoardArea - totalUsedArea) / totalBoardArea) * 100 : 0,
          total_placed_count: totalPlaced,
          total_unplaced_count: totalUnplaced
        }
      }

      setOptimizationResult(finalResult)
      console.timeEnd('[OPTI] Results Processing')
      console.timeEnd('[OPTI] Total Optimization Time')
      console.log(`[OPTI] ✅ Optimization complete: ${results.length} materials, ${totalPlaced} panels placed, ${totalUnplaced} unplaced`)
    } catch (err) {
      console.timeEnd('[OPTI] Total Optimization Time')
      console.error('\n=== OPTIMIZATION ERROR ===')
      console.error('Error details:', err)
      console.error('Error message:', err instanceof Error ? err.message : 'Unknown error')
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      setError(`Optimization failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsOptimizing(false)
    }
  }

  // Save Quote function
  const saveQuote = async () => {
    if (!optimizationResult || !quoteResult) {
      toast.error('Futtassa le az optimalizálást mentés előtt!')
      return
    }

    if (!customerData.name.trim()) {
      toast.error('Kérjük, töltse ki a megrendelő nevét!')
      return
    }

    // Validate customer name before saving
    if (customerValidationError) {
      toast.error('Kérem javítsa ki az ügyfél név hibáját a mentés előtt!')
      return
    }

    setIsSavingQuote(true)

    try {
      // Prepare panels data for saving
      const panelsToSave = addedPanels.map(panel => {
        // Find material by name only (no dimensions in táblásAnyag anymore)
        const materialName = panel.táblásAnyag.trim()
        const material = materials.find(m => m.name === materialName)
        
        return {
          material_id: material?.id || '',
          width_mm: parseInt(panel.hosszúság),
          height_mm: parseInt(panel.szélesség),
          quantity: parseInt(panel.darab),
          label: panel.jelölés || null,
          edge_material_a_id: panel.élzárásA || null,
          edge_material_b_id: panel.élzárásB || null,
          edge_material_c_id: panel.élzárásC || null,
          edge_material_d_id: panel.élzárásD || null,
          panthelyfuras_quantity: panel.pánthelyfúrás_mennyiség || 0,
          panthelyfuras_oldal: panel.pánthelyfúrás_oldal || null,
          duplungolas: panel.duplungolás || false,
          szogvagas: panel.szögvágás || false
        }
      })

      // Prepare customer data
      const customerPayload = {
        id: selectedCustomer?.id || null,
        name: customerData.name,
        email: customerData.email,
        mobile: customerData.phone,
        discount_percent: customerData.discount,
        billing_name: customerData.billing_name,
        billing_country: customerData.billing_country,
        billing_city: customerData.billing_city,
        billing_postal_code: customerData.billing_postal_code,
        billing_street: customerData.billing_street,
        billing_house_number: customerData.billing_house_number,
        billing_tax_number: customerData.billing_tax_number,
        billing_company_reg_number: customerData.billing_company_reg_number
      }

      // Prepare quote calculations with all necessary data
      const quoteCalculationsPayload = {
        total_net: quoteResult.grand_total_net,
        total_vat: quoteResult.grand_total_vat,
        total_gross: quoteResult.grand_total_gross,
        materials: quoteResult.materials.map(materialPricing => {
          const material = materials.find(m => m.id === materialPricing.material_id)
          
          // Calculate boards used and average usage percentage
          const boardsUsed = materialPricing.boards.length
          const averageUsage = boardsUsed > 0 
            ? materialPricing.boards.reduce((sum, b) => sum + b.usage_percentage, 0) / boardsUsed 
            : 0
          
          // Calculate charged_sqm (sum of panel area pricing only, exclude full board areas)
          const chargedSqm = materialPricing.boards
            .filter(b => b.pricing_method === 'panel_area')
            .reduce((sum, b) => sum + b.charged_area_m2, 0)
          
          // Calculate boards sold (only boards sold as full board pricing)
          const boardsSold = materialPricing.boards.filter(b => b.pricing_method === 'full_board').length
          
          // Determine pricing method based on board usage
          const hasFullBoardPricing = materialPricing.boards.some(b => b.pricing_method === 'full_board')
          const pricingMethod = hasFullBoardPricing ? 'full_board' : 'panel_area'
          
          return {
            material_id: materialPricing.material_id,
            material_name: materialPricing.material_name,
            board_width_mm: material?.width_mm || 0,
            board_length_mm: material?.length_mm || 0,
            thickness_mm: material?.thickness_mm || 0,
            grain_direction: material?.grain_direction || false,
            on_stock: materialPricing.on_stock,
            boards_used: boardsSold,
            usage_percentage: averageUsage,
            pricing_method: pricingMethod,
            charged_sqm: chargedSqm,
            price_per_sqm: material?.price_per_sqm || 0,
            vat_rate: (material?.vat_percent || 0) / 100,
            currency: material?.currency || 'HUF',
            usage_limit: material?.usage_limit || 0.65,
            waste_multi: material?.waste_multi || 1.2,
            material_cost: {
              net: materialPricing.total_material_net,
              vat: materialPricing.total_material_vat,
              gross: materialPricing.total_material_gross
            },
            edge_materials_cost: {
              net: materialPricing.total_edge_net,
              vat: materialPricing.total_edge_vat,
              gross: materialPricing.total_edge_gross
            },
            cutting_cost: {
              length_m: materialPricing.cutting_cost?.total_cutting_length_m || 0,
              net: materialPricing.total_cutting_net,
              vat: materialPricing.total_cutting_vat,
              gross: materialPricing.total_cutting_gross
            },
            edge_materials: materialPricing.edge_materials.map(edge => {
              // Find edge material ID by formatted name
              const edgeMaterial = edgeMaterials.find(em => {
                const displayName = `${em.type}-${em.width}/${em.thickness}-${em.decor}`
                return displayName === edge.edge_material_name
              })
              
              return {
                edge_material_id: edgeMaterial?.id || '',
                name: edge.edge_material_name,
                total_length_m: edge.length_with_overhang_m,
                price_per_m: edge.price_per_m,
                net: edge.net_price,
                vat: edge.vat_amount,
                gross: edge.gross_price
              }
            }),
            additional_services: materialPricing.additional_services,
            total_services_net: materialPricing.total_services_net,
            total_services_vat: materialPricing.total_services_vat,
            total_services_gross: materialPricing.total_services_gross,
            total: {
              net: materialPricing.total_net,
              vat: materialPricing.total_vat,
              gross: materialPricing.total_gross
            }
          }
        })
      }

      // Call API to save quote
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: editingQuoteId, // null for new quote, UUID for editing
          customerData: customerPayload,
          panels: panelsToSave,
          optimizationResults: optimizationResult,
          quoteCalculations: quoteCalculationsPayload
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save quote')
      }

      const result = await response.json()
      
      setSavedQuoteNumber(result.quoteNumber)
      
      // Different message for edit vs create
      if (isEditMode) {
        // Check if this is an order (has order_number) or a quote
        const isOrder = result.orderNumber || initialQuoteData?.order_number
        const redirectPath = isOrder ? `/orders/${editingQuoteId}` : `/quotes/${editingQuoteId}`
        
        toast.success(`${isOrder ? 'Megrendelés' : 'Árajánlat'} sikeresen frissítve: ${isOrder ? result.orderNumber : result.quoteNumber}`)
        // Redirect back to appropriate detail page after successful update
        setTimeout(() => {
          router.push(redirectPath)
        }, 1500) // Small delay to show the success message
      } else {
        toast.success(`Árajánlat sikeresen mentve: ${result.quoteNumber}`)
      }
      
      // Clear cache after save
      sessionStorage.removeItem('opti-panels')
      sessionStorage.removeItem('opti-customer-data')
      
      // Refresh the page to clear any cached data
      router.refresh()
      
    } catch (err) {
      console.error('Error saving quote:', err)
      const errorMessage = isEditMode ? 'frissítése' : 'mentése'
      toast.error(`Hiba az árajánlat ${errorMessage} során: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSavingQuote(false)
    }
  }

  // Check access permission - only redirect if permissions are loaded and user doesn't have access
  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
      toast.error('Nincs jogosultsága az Opti oldal megtekintéséhez!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      window.location.href = '/users'
      }, 100) // Small delay to prevent redirects during page refresh
      
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading])

  // Show loading state while permissions are being checked
  if (permissionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az Opti oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  // Data is now provided via SSR props, no loading states needed

  // Data is provided via SSR, no error states needed

  return (
    <ErrorBoundary>
      <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Ajánlat készítés
      </Typography>

      <Grid container spacing={3}>
        {/* Dynamic Rectangle Visualization Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Panel Előnézet
              </Typography>
              <Box
                sx={{
                  height: 200,
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {panelForm.hosszúság && panelForm.szélesség ? (
                  <Box
                    sx={{
                      position: 'relative',
                      backgroundColor: '#e0e0e0',
                      border: '2px solid #666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      maxWidth: '90%',
                      maxHeight: '90%',
                      width: panelPreviewStyle.width,
                      height: panelPreviewStyle.height
                    }}
                  >
                    {/* Grain direction lines - horizontal lines if material has grain direction */}
                    {grainDirectionLines}
                    {/* Edge labels with Hungarian names and material-based colors */}
                    {(() => {
                      // Color mapping based on edge material ID - generate distinct colors for each material
                      const getEdgeMaterialColor = (edgeMaterialId: string) => {
                        if (!edgeMaterialId) return '#666'
                        
                        // Define a set of distinct colors
                        const colors = [
                          '#1976d2', // Blue
                          '#388e3c', // Green
                          '#f57c00', // Orange
                          '#d32f2f', // Red
                          '#7b1fa2', // Purple
                          '#0097a7', // Cyan
                          '#c2185b', // Pink
                          '#5d4037', // Brown
                          '#455a64', // Blue Grey
                          '#f9a825', // Yellow
                        ]
                        
                        // Use a simple hash of the UUID to pick a color
                        const hash = edgeMaterialId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                        return colors[hash % colors.length]
                      }
                      
                      return (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -20,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getEdgeMaterialColor(selectedA)
                            }}
                          >
                            Hosszú felső
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: -20,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getEdgeMaterialColor(selectedC)
                            }}
                          >
                            Hosszú alsó
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: -20,
                              top: '50%',
                              transform: 'translateY(-50%) rotate(-90deg)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getEdgeMaterialColor(selectedD)
                            }}
                          >
                            Széles bal
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              right: -20,
                              top: '50%',
                              transform: 'translateY(-50%) rotate(90deg)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getEdgeMaterialColor(selectedB)
                            }}
                          >
                            Széles jobb
                          </Box>
                        </>
                      )
                    })()}
                    
                    {/* Special borders for selected edges with material-based colors */}
                    {(() => {
                      // Color mapping based on edge material ID - generate distinct colors for each material
                      const getEdgeMaterialColor = (edgeMaterialId: string) => {
                        if (!edgeMaterialId) return '#666'
                        
                        // Define a set of distinct colors
                        const colors = [
                          '#1976d2', // Blue
                          '#388e3c', // Green
                          '#f57c00', // Orange
                          '#d32f2f', // Red
                          '#7b1fa2', // Purple
                          '#0097a7', // Cyan
                          '#c2185b', // Pink
                          '#5d4037', // Brown
                          '#455a64', // Blue Grey
                          '#f9a825', // Yellow
                        ]
                        
                        // Use a simple hash of the UUID to pick a color
                        const hash = edgeMaterialId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                        return colors[hash % colors.length]
                      }
                      
                      return (
                        <>
                          {selectedA && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -3,
                                left: -3,
                                right: -3,
                                height: 3,
                                backgroundColor: getEdgeMaterialColor(selectedA),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                          {selectedC && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: -3,
                                left: -3,
                                right: -3,
                                height: 3,
                                backgroundColor: getEdgeMaterialColor(selectedC),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                          {selectedD && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -3,
                                left: -3,
                                bottom: -3,
                                width: 3,
                                backgroundColor: getEdgeMaterialColor(selectedD),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                          {selectedB && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -3,
                                right: -3,
                                bottom: -3,
                                width: 3,
                                backgroundColor: getEdgeMaterialColor(selectedB),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                        </>
                      )
                    })()}
                    
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      backgroundColor: '#e0e0e0',
                      border: '2px solid #666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#666' }}>
                      X × Y
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '10px', color: '#999' }}>
                      mm
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Customer Information Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Megrendelő adatai
              </Typography>
              
              <Grid container spacing={2}>
               {/* Customer Selection and Discount in same row */}
               <Grid item xs={12} sm={8}>
                 <Autocomplete
                   fullWidth
                   size="small"
                   options={customers}
                   getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                   value={selectedCustomer}
                   inputValue={customerData.name}
                   onChange={(event, newValue) => {
                     if (typeof newValue === 'string') {
                       // User typed a new customer name and pressed Enter
                       setSelectedCustomer(null)
                       setCustomerData(prev => ({
                         ...prev,
                         name: newValue
                       }))
                     } else if (newValue) {
                       // User selected an existing customer - set data directly
                       setSelectedCustomer(newValue)
                       setCustomerData({
                         name: newValue.name,
                         email: newValue.email,
                         phone: newValue.mobile,
                         discount: newValue.discount_percent.toString(),
                         billing_name: newValue.billing_name || '',
                         billing_country: newValue.billing_country || 'Magyarország',
                         billing_city: newValue.billing_city || '',
                         billing_postal_code: newValue.billing_postal_code || '',
                         billing_street: newValue.billing_street || '',
                         billing_house_number: newValue.billing_house_number || '',
                         billing_tax_number: newValue.billing_tax_number || '',
                         billing_company_reg_number: newValue.billing_company_reg_number || ''
                       })
                     } else if (event) {
                       // User explicitly cleared selection (clicked X button)
                       setSelectedCustomer(null)
                       setCustomerData({
                         name: '',
                         email: '',
                         phone: '',
                         discount: '',
                         billing_name: '',
                         billing_country: 'Magyarország',
                         billing_city: '',
                         billing_postal_code: '',
                         billing_street: '',
                         billing_house_number: '',
                         billing_tax_number: '',
                         billing_company_reg_number: ''
                       })
                     }
                   }}
                   onInputChange={(event, newInputValue) => {
                     // Always update the name when user types
                     setCustomerData(prev => ({
                       ...prev,
                       name: newInputValue
                     }))
                     
                     // Clear selectedCustomer if typing a new name
                     if (newInputValue && !customers.find(c => c.name === newInputValue)) {
                       setSelectedCustomer(null)
                     }
                   }}
                   freeSolo
                   disabled={false}
                   loading={false}
                   loadingText="Ügyfelek betöltése..."
                   noOptionsText="Nincs találat"
                   renderInput={(params) => (
                     <TextField
                       {...params}
                       label="Név (válasszon ügyfelet vagy írjon be új nevet) *"
                       size="small"
                       required
                       error={(!customerData.name.trim() && addedPanels.length > 0) || !!customerValidationError}
                       helperText={
                         customerValidationError || 
                         (!customerData.name.trim() && addedPanels.length > 0 ? 'A megrendelő neve kötelező az optimalizáláshoz' : '')
                       }
                       InputProps={{
                         ...params.InputProps,
                         endAdornment: (
                           <>
                             {null}
                             {params.InputProps.endAdornment}
                           </>
                         ),
                       }}
                     />
                   )}
                   renderOption={(props, option) => {
                     const { key, ...otherProps } = props;
                     return (
                       <Box component="li" key={key} {...otherProps}>
                         <Box>
                           <Typography variant="body2" fontWeight="medium">
                             {option.name}
                           </Typography>
                           <Typography variant="caption" color="text.secondary">
                             {option.email} • {option.mobile}
                           </Typography>
                         </Box>
                       </Box>
                     );
                   }}
                 />
               </Grid>
               <Grid item xs={12} sm={4}>
                 <TextField
                   fullWidth
                   size="small"
                   label="Kedvezmény (%)"
                   type="number"
                   value={customerData.discount}
                   onChange={(e) => handleCustomerDataChange('discount', e.target.value)}
                   inputProps={{ min: 0, max: 100, step: 0.01 }}
                 />
               </Grid>

               {/* Customer Data Fields */}
               <Grid item xs={12} sm={6}>
                 <TextField
                   fullWidth
                   size="small"
                   label="E-mail"
                   value={customerData.email}
                   onChange={(e) => handleCustomerDataChange('email', e.target.value)}
                 />
               </Grid>
               <Grid item xs={12} sm={6}>
                 <TextField
                   fullWidth
                   size="small"
                   label="Telefon"
                   placeholder="+36 30 999 2800"
                   value={customerData.phone}
                   onChange={(e) => handleCustomerDataChange('phone', e.target.value)}
                 />
               </Grid>

               {/* Status and Clear Button */}
               <Grid item xs={12}>
                 <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pt: 1, gap: 2 }}>
                   {selectedCustomer ? (
                     <>
                <Typography variant="body2" color="text.secondary">
                         Adatok automatikusan kitöltve - szerkeszthető
                </Typography>
                       <Button
                         size="small"
                         variant="outlined"
                         color="secondary"
                         onClick={() => handleCustomerSelect(null)}
                       >
                         Törlés
                       </Button>
                     </>
                   ) : customerData.name && !selectedCustomer ? (
                     <Typography variant="body2" color="primary">
                       Új ügyfél adatai - kérem töltse ki a mezőket
                     </Typography>
                   ) : null}
              </Box>
               </Grid>

                {/* Szálázási adatok Collapsible Section */}
                <Grid item xs={12}>
         <Accordion
           defaultExpanded={false}
         >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                        Számlázási adatok
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        {/* Billing Name */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Szálázási név"
                            value={customerData.billing_name}
                            onChange={(e) => handleCustomerDataChange('billing_name', e.target.value)}
                          />
                        </Grid>

                        {/* Country */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Ország"
                            value={customerData.billing_country}
                            onChange={(e) => handleCustomerDataChange('billing_country', e.target.value)}
                          />
                        </Grid>

                        {/* City */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Város"
                            value={customerData.billing_city}
                            onChange={(e) => handleCustomerDataChange('billing_city', e.target.value)}
                          />
                        </Grid>

                        {/* Postal Code */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Irányítószám"
                            value={customerData.billing_postal_code}
                            onChange={(e) => handleCustomerDataChange('billing_postal_code', e.target.value)}
                          />
                        </Grid>

                        {/* Street */}
                        <Grid item xs={12} sm={8}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Utca"
                            value={customerData.billing_street}
                            onChange={(e) => handleCustomerDataChange('billing_street', e.target.value)}
                          />
                        </Grid>

                        {/* House Number */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Házszám"
                            value={customerData.billing_house_number}
                            onChange={(e) => handleCustomerDataChange('billing_house_number', e.target.value)}
                          />
                        </Grid>

                        {/* Tax Number */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Adószám"
                            placeholder="12345678-1-02"
                            value={customerData.billing_tax_number}
                            onChange={(e) => handleCustomerDataChange('billing_tax_number', e.target.value)}
                          />
                        </Grid>

                        {/* Company Registration Number */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Cégjegyzékszám"
                            placeholder="01-09-123456"
                            value={customerData.billing_company_reg_number}
                            onChange={(e) => handleCustomerDataChange('billing_company_reg_number', e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel Adatok Card */}
        <Grid item xs={12}>
          <Card id="panel-adatok-section">
            <CardContent>
              {/* Táblás anyag Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                  Táblás anyag
                </Typography>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid item xs={12} sm={6} md={4}>
               <Autocomplete
                 fullWidth
                 size="small"
                 options={activeMaterials}
                 groupBy={(option) => (option.brand_name?.trim() || 'Ismeretlen')}
                 getOptionLabel={(option) => option.name}
                 value={activeMaterials.find(m => m.id === selectedTáblásAnyag) || null}
                 onChange={(event, newValue) => {
                   setSelectedTáblásAnyag(newValue ? newValue.id : '')
                   clearValidationError('táblásAnyag')
                 }}
                 disabled={false}
                 loading={false}
                 loadingText="Anyagok betöltése..."
                 noOptionsText="Nincs találat"
                 renderInput={(params) => (
                   <TextField
                     {...params}
                     label="Táblás anyag választás:"
                     size="small"
                     error={validationErrors.táblásAnyag}
                     helperText={validationErrors.táblásAnyag ? 'Táblás anyag kiválasztása kötelező' : ''}
                     InputProps={{
                       ...params.InputProps,
                       endAdornment: (
                         <>
                           {null}
                           {params.InputProps.endAdornment}
                         </>
                       ),
                     }}
                   />
                 )}
                 renderGroup={(params) => (
                   <Box key={params.key}>
                     <Box
                       sx={{
                         position: 'sticky',
                         top: 0,
                         padding: '6px 16px',
                         backgroundColor: 'grey.100',
                         color: 'text.primary',
                         fontWeight: 600,
                         fontSize: '0.813rem',
                         zIndex: 10,
                         borderBottom: '1px solid',
                         borderColor: 'divider'
                       }}
                     >
                       {params.group}
                     </Box>
                     {params.children}
                   </Box>
                 )}
                 renderOption={(props, option) => {
                   const { key, ...otherProps } = props;
                   return (
                     <Box 
                       component="li" 
                       key={key} 
                       {...otherProps}
                       sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                     >
                       <span>{option.name}</span>
                       <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                         {option.thickness_mm} mm
                       </Typography>
                     </Box>
                   );
                 }}
                 ListboxProps={{
                   style: {
                     maxHeight: '320px',
                     overflow: 'auto'
                   }
                 }}
               />
        </Grid>

                  {/* Selected Material Details */}
                  {selectedTáblásAnyag && (() => {
                    const selectedMaterial = materials.find(m => m.id === selectedTáblásAnyag)
                    if (!selectedMaterial) return null
                    
                    // Color mapping based on material type
                    const getMaterialColor = (materialName: string) => {
                      const name = materialName.toLowerCase()
                      if (name.includes('mdf')) return '#8B4513' // Brown
                      if (name.includes('plywood')) return '#DEB887' // Burlywood
                      if (name.includes('chipboard')) return '#D2691E' // Chocolate
                      if (name.includes('osb')) return '#A0522D' // Sienna
                      if (name.includes('hardboard')) return '#F5DEB3' // Wheat
                      return '#696969' // Dim gray (default)
                    }
                    
                    return (
                      <Grid item xs={12} sm={6} md={8}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          {/* Material Image */}
                          <Box
                            sx={{
                              width: 60,
                              height: 60,
                              background: selectedMaterial.image_url 
                                ? `url(${selectedMaterial.image_url})`
                                : `linear-gradient(45deg, ${getMaterialColor(selectedMaterial.name)} 25%, transparent 25%), 
                                   linear-gradient(-45deg, ${getMaterialColor(selectedMaterial.name)} 25%, transparent 25%), 
                                   linear-gradient(45deg, transparent 75%, ${getMaterialColor(selectedMaterial.name)} 75%), 
                                   linear-gradient(-45deg, transparent 75%, ${getMaterialColor(selectedMaterial.name)} 75%)`,
                              backgroundSize: selectedMaterial.image_url ? 'cover' : '20px 20px',
                              backgroundPosition: selectedMaterial.image_url ? 'center' : '0 0, 0 10px, 10px -10px, -10px 0px',
                              border: '2px solid #e0e0e0',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mr: 1,
                              overflow: 'hidden',
                              position: 'relative'
                            }}
                            title={`${selectedMaterial.name} képe`}
                          >
                            {selectedMaterial.image_url ? (
                              <img
                                src={selectedMaterial.image_url}
                                alt={selectedMaterial.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: `linear-gradient(135deg, ${getMaterialColor(selectedMaterial.name)} 0%, ${getMaterialColor(selectedMaterial.name)}dd 100%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: 'white', 
                                    textAlign: 'center', 
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                  }}
                                >
                                  {selectedMaterial.name.split(' ')[0]}
              </Typography>
                              </Box>
                            )}
                          </Box>
                          
                          <Chip
                            label={`${selectedMaterial.length_mm} × ${selectedMaterial.width_mm}mm`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={`${selectedMaterial.thickness_mm}mm vastag`}
                            color="secondary"
                            variant="outlined"
                            size="small"
                          />
                          {selectedMaterial.grain_direction && (
                            <Chip
                              label="Szálirány"
                              color="warning"
                              variant="outlined"
                              size="small"
                            />
                          )}
                          <Chip
                            label={`Penge vastagság: ${selectedMaterial.kerf_mm}mm`}
                            color="info"
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={`Szélezés: HF${selectedMaterial.trim_top_mm} RB${selectedMaterial.trim_bottom_mm} HA${selectedMaterial.trim_left_mm} RJ${selectedMaterial.trim_right_mm}mm`}
                            color="secondary"
                            variant="outlined"
                            size="small"
                          />
                        </Box>
                      </Grid>
                    )
                  })()}
                </Grid>
              </Box>
              
              {/* Méretek Section */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                  Méretek
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Szálirány (mm)"
                    type="number"
                    required
                    name="hosszúság"
                    value={panelForm.hosszúság}
                    onChange={(e) => {
                      const validatedValue = validateSzalirany(e.target.value)
                      setPanelForm({...panelForm, hosszúság: validatedValue})
                      clearValidationError('hosszúság')
                    }}
                    onKeyPress={handleKeyPress}
                    inputProps={{ 
                      min: 0, 
                      max: maxSzalirany,
                      step: 0.1 
                    }}
                    error={validationErrors.hosszúság}
                    helperText={
                      validationErrors.hosszúság 
                        ? 'Hosszúság megadása kötelező és nagyobb kell legyen 0-nál' 
                        : selectedMaterial 
                          ? `Max: ${maxSzalirany}mm (${selectedMaterial.length_mm} - ${selectedMaterial.trim_left_mm} - ${selectedMaterial.trim_right_mm})`
                          : ''
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Keresztirány (mm)"
                    type="number"
                    required
                    value={panelForm.szélesség}
                    onChange={(e) => {
                      const validatedValue = validateKeresztirany(e.target.value)
                      setPanelForm({...panelForm, szélesség: validatedValue})
                      clearValidationError('szélesség')
                    }}
                    onKeyPress={handleKeyPress}
                    inputProps={{ 
                      min: 0, 
                      max: maxKeresztirany,
                      step: 0.1 
                    }}
                    error={validationErrors.szélesség}
                    helperText={
                      validationErrors.szélesség 
                        ? 'Szélesség megadása kötelező és nagyobb kell legyen 0-nál' 
                        : selectedMaterial 
                          ? `Max: ${maxKeresztirany}mm (${selectedMaterial.width_mm} - ${selectedMaterial.trim_top_mm} - ${selectedMaterial.trim_bottom_mm})`
                          : ''
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Darab"
                    type="number"
                    required
                    value={panelForm.darab}
                    onChange={(e) => {
                      setPanelForm({...panelForm, darab: e.target.value})
                      clearValidationError('darab')
                    }}
                    onKeyPress={handleKeyPress}
                    inputProps={{ min: 1, step: 1 }}
                    error={validationErrors.darab}
                    helperText={validationErrors.darab ? 'Darab megadása kötelező és nagyobb kell legyen 0-nál' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Jelölés"
                    value={panelForm.jelölés}
                    onChange={(e) => setPanelForm({...panelForm, jelölés: e.target.value})}
                    onKeyPress={handleKeyPress}
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                
                {/* Élzárás Section */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                    Élzárás
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={edgeMaterials}
                    getOptionLabel={(option) => formatEdgeMaterialName(option)}
                    getOptionKey={(option) => option.id}
                    value={edgeMaterials.find(material => material.id === selectedA) || null}
                    onChange={(event, newValue) => {
                      setSelectedA(newValue ? newValue.id : '')
                    }}
                    disabled={false}
                    renderOption={(props, option) => {
                      const index = edgeMaterials.findIndex(em => em.id === option.id)
                      return renderEdgeMaterialOption(props, option, index)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Hosszú felső"
                      onKeyPress={handleKeyPress}
                      />
                    )}
                    ListboxProps={{
                      style: {
                        maxHeight: '200px', // Limit to ~3-4 items
                        overflow: 'auto'
                      }
                    }}
                    noOptionsText="Nincs találat"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={edgeMaterials}
                    getOptionLabel={(option) => formatEdgeMaterialName(option)}
                    getOptionKey={(option) => option.id}
                    value={edgeMaterials.find(material => material.id === selectedC) || null}
                    onChange={(event, newValue) => {
                      setSelectedC(newValue ? newValue.id : '')
                    }}
                    disabled={false}
                    renderOption={(props, option) => {
                      const index = edgeMaterials.findIndex(em => em.id === option.id)
                      return renderEdgeMaterialOption(props, option, index)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Hosszú alsó"
                      onKeyPress={handleKeyPress}
                      />
                    )}
                    ListboxProps={{
                      style: {
                        maxHeight: '200px', // Limit to ~3-4 items
                        overflow: 'auto'
                      }
                    }}
                    noOptionsText="Nincs találat"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={edgeMaterials}
                    getOptionLabel={(option) => formatEdgeMaterialName(option)}
                    getOptionKey={(option) => option.id}
                    value={edgeMaterials.find(material => material.id === selectedD) || null}
                    onChange={(event, newValue) => {
                      setSelectedD(newValue ? newValue.id : '')
                    }}
                    disabled={false}
                    renderOption={(props, option) => {
                      const index = edgeMaterials.findIndex(em => em.id === option.id)
                      return renderEdgeMaterialOption(props, option, index)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Széles bal"
                      onKeyPress={handleKeyPress}
                      />
                    )}
                    ListboxProps={{
                      style: {
                        maxHeight: '200px', // Limit to ~3-4 items
                        overflow: 'auto'
                      }
                    }}
                    noOptionsText="Nincs találat"
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={edgeMaterials}
                    getOptionLabel={(option) => formatEdgeMaterialName(option)}
                    getOptionKey={(option) => option.id}
                    value={edgeMaterials.find(material => material.id === selectedB) || null}
                    onChange={(event, newValue) => {
                      setSelectedB(newValue ? newValue.id : '')
                    }}
                    disabled={false}
                    renderOption={(props, option) => {
                      const index = edgeMaterials.findIndex(em => em.id === option.id)
                      return renderEdgeMaterialOption(props, option, index)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Széles jobb"
                      onKeyPress={handleKeyPress}
                      />
                    )}
                    ListboxProps={{
                      style: {
                        maxHeight: '200px', // Limit to ~3-4 items
                        overflow: 'auto'
                      }
                    }}
                    noOptionsText="Nincs találat"
                  />
                </Grid>
              </Grid>
              
              {/* Megmunkálás Section */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                  Megmunkálás
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    size="small"
                    color={panthelyfurasSaved ? "success" : "primary"}
                    onClick={handlePanthelyfurasOpen}
                  >
                    Pánthelyfúrás
                  </Button>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={duplungolas}
                        onChange={(e) => handleDuplungolasChange(e.target.checked)}
                        color="primary"
                        disabled={!panelForm.darab || parseInt(panelForm.darab) <= 0}
                      />
                    }
                    label="Duplungolás"
                    sx={{ ml: 2 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={szögvágás}
                        onChange={(e) => setSzögvágás(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Szögvágás"
                    sx={{ ml: 2 }}
                  />
                </Box>
              </Grid>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                {editingPanel && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="large"
                    onClick={cancelEdit}
                  >
                    Mégse
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={editingPanel ? savePanel : addPanelToTable}
                  disabled={!selectedTáblásAnyag}
                >
                  {editingPanel ? 'Mentés' : 'Hozzáadás'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Added Panels Table */}
        {addedPanels.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Hozzáadott Panelek
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Táblás anyag</strong></TableCell>
                    <TableCell><strong>Szálirány</strong></TableCell>
                    <TableCell><strong>Keresztirány</strong></TableCell>
                    <TableCell><strong>Darab</strong></TableCell>
                    <TableCell><strong>Jelölés</strong></TableCell>
                    <TableCell align="center"><strong>Hosszú felső</strong></TableCell>
                    <TableCell align="center"><strong>Hosszú alsó</strong></TableCell>
                    <TableCell align="center"><strong>Széles bal</strong></TableCell>
                    <TableCell align="center"><strong>Széles jobb</strong></TableCell>
                    <TableCell align="center"><strong>Szolgáltatások</strong></TableCell>
                    <TableCell><strong>Műveletek</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {addedPanels.map((panel) => (
                      <TableRow 
                        key={panel.id}
                        onClick={() => editPanel(panel)}
                        sx={{ 
                          cursor: 'pointer',
                          backgroundColor: (() => {
                            // Get all unique materials and assign colors
                            const uniqueMaterials = [...new Set(addedPanels.map(p => p.táblásAnyag))]
                            const materialIndex = uniqueMaterials.indexOf(panel.táblásAnyag)
                            const colors = [
                              'rgba(0, 123, 108, 0.05)',    // Green
                              'rgba(25, 118, 210, 0.05)',   // Blue  
                              'rgba(156, 39, 176, 0.05)',   // Purple
                              'rgba(255, 152, 0, 0.05)',    // Orange
                              'rgba(244, 67, 54, 0.05)',    // Red
                              'rgba(76, 175, 80, 0.05)',    // Light Green
                              'rgba(63, 81, 181, 0.05)',    // Indigo
                              'rgba(255, 193, 7, 0.05)'     // Yellow
                            ]
                            return colors[materialIndex % colors.length]
                          })(),
                          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                        }}
                      >
                      <TableCell>{panel.táblásAnyag}</TableCell>
                      <TableCell>{panel.hosszúság} mm</TableCell>
                      <TableCell>{panel.szélesség} mm</TableCell>
                      <TableCell>{panel.darab}</TableCell>
                      <TableCell>{panel.jelölés}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={panel.élzárásA ? getEdgeMaterialNameById(panel.élzárásA) : 'Nincs'} 
                          size="small" 
                          color={panel.élzárásA ? 'primary' : 'default'}
                          variant={panel.élzárásA ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={panel.élzárásC ? getEdgeMaterialNameById(panel.élzárásC) : 'Nincs'} 
                          size="small" 
                          color={panel.élzárásC ? 'primary' : 'default'}
                          variant={panel.élzárásC ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={panel.élzárásD ? getEdgeMaterialNameById(panel.élzárásD) : 'Nincs'} 
                          size="small" 
                          color={panel.élzárásD ? 'primary' : 'default'}
                          variant={panel.élzárásD ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={panel.élzárásB ? getEdgeMaterialNameById(panel.élzárásB) : 'Nincs'} 
                          size="small" 
                          color={panel.élzárásB ? 'primary' : 'default'}
                          variant={panel.élzárásB ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
                          {panel.pánthelyfúrás_mennyiség > 0 && (
                            <Chip 
                              icon={<LocationSearchingSharpIcon sx={{ fontSize: 16 }} />}
                              label={`${panel.pánthelyfúrás_mennyiség}db`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                          {panel.duplungolás && (
                            <Tooltip title="Duplungolás">
                              <Filter2Icon sx={{ fontSize: 20, color: 'info.main' }} />
                            </Tooltip>
                          )}
                          {panel.szögvágás && (
                            <Tooltip title="Szögvágás">
                              <i className="ri-scissors-cut-line" style={{ fontSize: 20, color: 'var(--mui-palette-warning-main)' }} />
                            </Tooltip>
                          )}
                          {!panel.pánthelyfúrás_mennyiség && !panel.duplungolás && !panel.szögvágás && (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => deletePanelFromTable(panel.id)}
                          sx={{ 
                            minWidth: 'auto', 
                            px: 1, 
                            py: 0.5,
                            minHeight: 'auto',
                            fontSize: '12px'
                          }}
                        >
                          Törlés
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Optimalizálás and Save Quote Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3, mb: 2 }}>
              <Tooltip 
                title={
                  !customerData.name.trim() 
                    ? 'Kérjük, töltse ki a megrendelő nevét!' 
                    : addedPanels.length === 0 
                      ? 'Adjon hozzá legalább egy panelt!' 
                      : ''
                }
                arrow
              >
                <span>
              <Button
                variant="contained"
                color={optimizationResult && !isOptimizing ? "success" : "warning"}
                size="large"
                onClick={optimize}
                    disabled={addedPanels.length === 0 || isOptimizing || !customerData.name.trim()}
                sx={{ 
                  minWidth: 200,
                  py: 1.5,
                  px: 4
                }}
              >
                {isOptimizing ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Optimalizálás...
                  </>
                ) : (
                  'Optimalizálás'
                )}
              </Button>
                </span>
              </Tooltip>
              
              {/* Save Quote Button - Only show after optimization */}
              {optimizationResult && quoteResult && (
                <Tooltip 
                  title={!customerData.name.trim() ? 'Kérjük, töltse ki a megrendelő nevét!' : ''}
                  arrow
                >
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      onClick={saveQuote}
                      disabled={isSavingQuote || !customerData.name.trim()}
                      sx={{ 
                        minWidth: 200,
                        py: 1.5,
                        px: 4
                      }}
                    >
                      {isSavingQuote ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          {isEditMode ? 'Frissítés...' : 'Mentés...'}
                        </>
                      ) : savedQuoteNumber && isEditMode ? (
                        `Frissítve: ${savedQuoteNumber}`
                      ) : savedQuoteNumber ? (
                        `Mentve: ${savedQuoteNumber}`
                      ) : isEditMode ? (
                        'Árajánlat frissítése'
                      ) : (
                        'Árajánlat mentése'
                      )}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Box>
            
            {/* Error Display */}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
        </Grid>
        )}





        {/* Multi-Material Visualization */}
        {optimizationResult && (
          <Grid item xs={12}>
            {optimizationResult.materials.map((materialResult) => {
              const isExpanded = expandedAccordions.has(materialResult.material_id)
              const material = materials.find(m => m.id === materialResult.material_id)
              const currentBoardIndex = currentBoardPerMaterial.get(materialResult.material_id) || 0
              
              // Group placements by board_id
              const placementsByBoard = new Map<number, Placement[]>()
              materialResult.placements.forEach(placement => {
                const boardId = placement.board_id || 1
                if (!placementsByBoard.has(boardId)) {
                  placementsByBoard.set(boardId, [])
                }
                placementsByBoard.get(boardId)!.push(placement)
              })
              
              const boardIds = Array.from(placementsByBoard.keys()).sort((a, b) => a - b)
              const currentBoardId = boardIds[currentBoardIndex] || 1
              const currentBoardPlacements = placementsByBoard.get(currentBoardId) || []
              
              return (
                <Accordion 
                  key={materialResult.material_id}
                  expanded={isExpanded}
                  onChange={(event, expanded) => {
                    const newExpanded = new Set(expandedAccordions)
                    if (expanded) {
                      newExpanded.add(materialResult.material_id)
                    } else {
                      newExpanded.delete(materialResult.material_id)
                    }
                    setExpandedAccordions(newExpanded)
                  }}
                >
                  <AccordionSummary
                    expandIcon={expandIcon(materialResult.material_id, expandedAccordions)}
                    aria-controls={`material-${materialResult.material_id}-content`}
                    id={`material-${materialResult.material_id}-header`}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography variant="h6" component="div">
                        {materialResult.material_name}
                          </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={`${material?.length_mm}×${material?.width_mm}mm`} 
                          size="small" 
                          color="info" 
                          variant="outlined"
                        />
                        <Chip 
                          label={material?.grain_direction ? "Szálirányos" : "Nem szálirányos"} 
                          size="small" 
                          color={material?.grain_direction ? "warning" : "default"} 
                          variant="outlined"
                        />
                        {materialResult.metrics.unplaced_count > 0 && (
                          <Chip 
                            label={`${materialResult.metrics.unplaced_count} unplaced`} 
                            size="small" 
                              color="error"
                            variant="outlined"
                          />
                        )}
                        <Chip 
                          label={`${materialResult.metrics.boards_used} tábla`} 
                              size="small"
                          color="primary" 
                          variant="outlined"
                        />
                                  <Chip
                          label={`Összes vágási hossz: ${(materialResult.metrics.total_cut_length_mm / 1000).toFixed(1)}m`}
                              size="small"
                              variant="filled"
                              color="secondary"
                          sx={{ fontWeight: 'bold' }}
                            />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {/* Board Display for this material */}
                    {currentBoardPlacements.length > 0 && (
                          <Box
                            sx={{
                          p: 3,
                              backgroundColor: '#ffffff',
                              position: 'relative',
                          fontFamily: 'monospace',
                          maxWidth: 800,
                          margin: '0 auto'
                        }}
                      >
                        
                        {/* Board visualization container */}
                        <Box sx={{ position: 'relative', margin: '0 auto', maxWidth: 700 }}>
                            
                             {/* Board visualization container - Blueprint style with proper aspect ratio */}
                             <Box
                               sx={{
                                 width: '100%',
                              aspectRatio: `${materialResult.debug?.board_width || material?.width_mm || 1} / ${materialResult.debug?.board_height || material?.length_mm || 1}`,
                              border: '1px solid #000',
                                 backgroundColor: '#f0f8ff', // Light blue blueprint background
                                 position: 'relative',
                                 overflow: 'hidden',
                              fontFamily: 'monospace'
                            }}
                          >
                          
                          {/* Trim margins visualization - show individual trim lines only if trim > 0 */}
                          {/* Top trim area with cross lines */}
                          {(material?.trim_top_mm ?? 0) > 0 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                left: '0%',
                                top: '0%',
                                width: '100%',
                                height: `${((material?.trim_top_mm || 0) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                backgroundColor: 'rgba(158, 158, 158, 0.1)',
                                border: '1px dashed rgba(158, 158, 158, 0.3)',
                                zIndex: 2,
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158, 158, 158, 0.2) 2px, rgba(158, 158, 158, 0.2) 4px)',
                                }
                              }}
                            />
                          )}
                          
                          {/* Bottom trim area with cross lines */}
                          {(material?.trim_bottom_mm ?? 0) > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: '0%',
                                top: `${((materialResult.debug?.board_height || material?.length_mm || 1) - (material?.trim_bottom_mm || 0)) / (materialResult.debug?.board_height || material?.length_mm || 1) * 100}%`,
                                width: '100%',
                                height: `${((material?.trim_bottom_mm || 0) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                backgroundColor: 'rgba(158, 158, 158, 0.1)',
                                border: '1px dashed rgba(158, 158, 158, 0.3)',
                                zIndex: 2,
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158, 158, 158, 0.2) 2px, rgba(158, 158, 158, 0.2) 4px)',
                                }
                              }}
                            />
                          )}
                          
                          {/* Left trim area with cross lines */}
                          {(material?.trim_left_mm ?? 0) > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: '0%',
                                top: '0%',
                                width: `${((material?.trim_left_mm || 0) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                height: '100%',
                                backgroundColor: 'rgba(158, 158, 158, 0.1)',
                                border: '1px dashed rgba(158, 158, 158, 0.3)',
                                zIndex: 2,
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158, 158, 158, 0.2) 2px, rgba(158, 158, 158, 0.2) 4px)',
                                }
                              }}
                            />
                          )}
                          
                          {/* Right trim area with cross lines */}
                          {(material?.trim_right_mm ?? 0) > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${((materialResult.debug?.board_width || material?.width_mm || 1) - (material?.trim_right_mm || 0)) / (materialResult.debug?.board_width || material?.width_mm || 1) * 100}%`,
                                top: '0%',
                                width: `${((material?.trim_right_mm || 0) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                height: '100%',
                                backgroundColor: 'rgba(158, 158, 158, 0.1)',
                                border: '1px dashed rgba(158, 158, 158, 0.3)',
                                zIndex: 2,
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158, 158, 158, 0.2) 2px, rgba(158, 158, 158, 0.2) 4px)',
                                }
                                }}
                              />
                          )}
                              
                              {/* Placed panels - Blueprint style */}
                          {currentBoardPlacements.map((placement, index) => {
                            // Notion-inspired color palette for different panel sizes
                            const getPanelColor = (w: number, h: number) => {
                              const area = w * h;
                              if (area >= 1000000) return '#f1f3f4'; // Light grey for large panels
                              if (area >= 500000) return '#e8f0fe'; // Light blue for medium-large panels
                              if (area >= 250000) return '#e6f4ea'; // Light green for medium panels
                              if (area >= 100000) return '#fef7e0'; // Light yellow for small-medium panels
                              return '#fce7f3'; // Light pink for small panels
                            };
                                
                                return (
                                  <Box
                                    key={placement.id}
                                    sx={{
                                      position: 'absolute',
                                  // Horizontal stacking: x->left, y->top, w->width, h->height
                                  left: `${(placement.x_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: getPanelColor(placement.w_mm, placement.h_mm),
                                  border: '1px solid #000',
                                      display: 'flex',
                                      alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {/* Grain direction lines - horizontal lines if material has grain direction */}
                                {material?.grain_direction && (
                                  <>
                                    {Array.from({ length: 8 }, (_, i) => (
                                      <Box
                                        key={`grain-${placement.id}-${i}`}
                                        sx={{
                                          position: 'absolute',
                                          top: `${(i + 1) * 12.5}%`,
                                          left: '5%',
                                          right: '5%',
                                          height: '1px',
                                          backgroundColor: '#999',
                                          opacity: 0.6
                                        }}
                                      />
                                    ))}
                                  </>
                                )}
                                {/* Width label on top edge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                      fontSize: '10px',
                                    fontFamily: [
                                      'Inter',
                                      'sans-serif',
                                      '-apple-system',
                                      'BlinkMacSystemFont',
                                      '"Segoe UI"',
                                      'Roboto',
                                      '"Helvetica Neue"',
                                      'Arial',
                                      'sans-serif'
                                    ].join(','),
                                    fontWeight: 400,
                                    color: '#000'
                                  }}
                                >
                                  {placement.w_mm}
                                      </Box>
                                
                                {/* Height label on left edge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: 0,
                                    transform: 'translateY(-50%)',
                                    fontSize: '10px',
                                    fontFamily: [
                                      'Inter',
                                      'sans-serif',
                                      '-apple-system',
                                      'BlinkMacSystemFont',
                                      '"Segoe UI"',
                                      'Roboto',
                                      '"Helvetica Neue"',
                                      'Arial',
                                      'sans-serif'
                                    ].join(','),
                                    fontWeight: 400,
                                    color: '#000',
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed'
                                  }}
                                >
                                  {placement.h_mm}
                                    </Box>
                                  </Box>
                                )
                              })}
                              
                          {/* Kerf visualization - red outline around every panel (cutting pattern) */}
                          {currentBoardPlacements.map((placement, index) => {
                            const kerfSize = material?.kerf_mm || 3;
                            const kerfLines = [];
                            
                            // Every panel needs to be cut out, so show kerf around the entire perimeter
                            // Top edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-top-${index}`}
                                sx={{
                                  position: 'absolute',
                                  // Use swapped board dimensions from optimization results
                                  left: `${(placement.x_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${((placement.y_mm - kerfSize/2) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(kerfSize / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            // Bottom edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-bottom-${index}`}
                                sx={{
                                  position: 'absolute',
                                  // Use swapped board dimensions from optimization results
                                  left: `${(placement.x_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${((placement.y_mm + placement.h_mm - kerfSize/2) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(kerfSize / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            // Left edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-left-${index}`}
                                sx={{
                                  position: 'absolute',
                                  // Use swapped board dimensions from optimization results
                                  left: `${((placement.x_mm - kerfSize/2) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(kerfSize / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            // Right edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-right-${index}`}
                                sx={{
                                  position: 'absolute',
                                  // Use swapped board dimensions from optimization results
                                  left: `${((placement.x_mm + placement.w_mm - kerfSize/2) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(kerfSize / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            return kerfLines;
                          }).flat()}
                          
                          
                              </Box>
                            </Box>
                          </Box>
                    )}
                    
                    {/* Board Pagination Controls */}
                    {boardIds.length > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination
                          count={boardIds.length}
                          page={currentBoardIndex + 1}
                          onChange={(event, page) => {
                            const newBoardIndices = new Map(currentBoardPerMaterial)
                            newBoardIndices.set(materialResult.material_id, page - 1)
                            setCurrentBoardPerMaterial(newBoardIndices)
                          }}
                          color="primary"
                          size="large"
                        />
                        </Box>
                    )}
                    
                    {/* Show message if no panels placed */}
                    {materialResult.placements.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">
                          No panels could be placed on this material
                        </Typography>
                    </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              )
            })}
          </Grid>
        )}

        {/* Optimization Data Card */}
        {optimizationResult && showOptimizationData && (
          <Grid item xs={12} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Optimalizálási adatok
                </Typography>
                
                {optimizationResult.materials.map((materialResult) => {
                  const material = materials.find(m => m.id === materialResult.material_id)
                  
                  // Calculate edge lengths for this material
                  const materialPanels = addedPanels.filter(panel => {
                    // Find material by name only (no dimensions in táblásAnyag anymore)
                    const materialName = panel.táblásAnyag.trim()
                    return material && material.name === materialName
                  })
                  
                  // Calculate edge material total lengths
                  const edgeLengths: { [key: string]: number } = {}
                  materialPanels.forEach(panel => {
                    const length = parseInt(panel.hosszúság)
                    const width = parseInt(panel.szélesség)
                    const quantity = parseInt(panel.darab)
                    
                    // Top edge (A)
                    if (panel.élzárásA && panel.élzárásA !== '') {
                      edgeLengths[panel.élzárásA] = (edgeLengths[panel.élzárásA] || 0) + (length * quantity)
                    }
                    // Right edge (B)
                    if (panel.élzárásB && panel.élzárásB !== '') {
                      edgeLengths[panel.élzárásB] = (edgeLengths[panel.élzárásB] || 0) + (width * quantity)
                    }
                    // Bottom edge (C)
                    if (panel.élzárásC && panel.élzárásC !== '') {
                      edgeLengths[panel.élzárásC] = (edgeLengths[panel.élzárásC] || 0) + (length * quantity)
                    }
                    // Left edge (D)
                    if (panel.élzárásD && panel.élzárásD !== '') {
                      edgeLengths[panel.élzárásD] = (edgeLengths[panel.élzárásD] || 0) + (width * quantity)
                    }
                  })
                  
                  return (
                    <Box key={materialResult.material_id} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {materialResult.material_name}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Márka:</strong> {material?.brand_name || 'N/A'}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Vastagság:</strong> {material?.thickness_mm}mm
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Szálirány:</strong> {material?.grain_direction ? 'Igen' : 'Nem'}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Penge vastagság:</strong> {material?.kerf_mm}mm
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Szélezés:</strong> HF{material?.trim_top_mm} RB{material?.trim_bottom_mm} HA{material?.trim_left_mm} RJ{material?.trim_right_mm}mm
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Hulladékszorzó:</strong> {material?.waste_multi}x
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Felhasznált táblák száma:</strong> {materialResult.metrics.boards_used}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Táblák kihasználtsága:</strong>
                      </Typography>
                      
                      {/* Individual board usage percentages */}
                      <Box sx={{ ml: 2, mb: 1 }}>
                        {(() => {
                          // Group placements by board_id (same logic as in accordion)
                          const placementsByBoard = new Map<number, Placement[]>()
                          materialResult.placements.forEach(placement => {
                            const boardId = placement.board_id || 1
                            if (!placementsByBoard.has(boardId)) {
                              placementsByBoard.set(boardId, [])
                            }
                            placementsByBoard.get(boardId)!.push(placement)
                          })
                          
                          const boardIds = Array.from(placementsByBoard.keys()).sort((a, b) => a - b)
                          
                          return boardIds.map((boardId) => {
                            const boardPlacements = placementsByBoard.get(boardId) || []
                            const boardUsedArea = boardPlacements.reduce((sum, placement) => sum + (placement.w_mm * placement.h_mm), 0)
                            const boardArea = (materialResult.debug?.board_width || material?.width_mm || 1) * (materialResult.debug?.board_height || material?.length_mm || 1)
                            const boardUsage = (boardUsedArea / boardArea) * 100
                            
                            return (
                              <Typography key={boardId} variant="body2" sx={{ mb: 0.5 }}>
                                • Tábla {boardId}: {boardUsage.toFixed(1)}%
                              </Typography>
                            )
                          })
                        })()}
                      </Box>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Összes vágási hossz:</strong> {(materialResult.metrics.total_cut_length_mm / 1000).toFixed(2)}m
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Élzáró anyagok:</strong>
                      </Typography>
                      
                      {Object.keys(edgeLengths).length > 0 ? (
                        <Box sx={{ ml: 2 }}>
                          {Object.entries(edgeLengths).map(([edgeType, length]) => (
                            <Typography key={edgeType} variant="body2" sx={{ mb: 0.5 }}>
                              • {edgeType}: {(length / 1000).toFixed(2)}m
                            </Typography>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                          Nincs élzáró anyag
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </CardContent>
            </Card>
      </Grid>
        )}

        {/* Árajánlat (Quote) Accordion */}
        {optimizationResult && quoteResult && (() => {
          const discountPercent = parseFloat(customerData.discount) || 0
          const discountAmount = (quoteResult.grand_total_gross * discountPercent) / 100
          const finalTotal = quoteResult.grand_total_gross - discountAmount
          
          return (
          <Grid item xs={12} sx={{ mt: 3 }}>
            <Accordion defaultExpanded={false}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  bgcolor: 'grey.50',
                  borderBottom: '2px solid',
                  borderColor: 'success.main',
                  '&:hover': { bgcolor: 'grey.100' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Árajánlat
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 2 }}>
                      VÉGÖSSZEG
                    </Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>Nettó</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{formatPrice(quoteResult.grand_total_net, quoteResult.currency)}</Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.5 }}>+</Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>ÁFA</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{formatPrice(quoteResult.grand_total_vat, quoteResult.currency)}</Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                    />
                    <Typography variant="h6" sx={{ mx: 0.5 }}>=</Typography>
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>Bruttó</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{formatPrice(quoteResult.grand_total_gross, quoteResult.currency)}</Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                    />
                    {discountPercent > 0 && (
                      <>
                        <Typography variant="h6" sx={{ mx: 0.5 }}>-</Typography>
                        <Chip
                          label={
                            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>Kedvezmény ({discountPercent}%)</Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{formatPrice(discountAmount, quoteResult.currency)}</Typography>
                            </Box>
                          }
                          sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                        />
                        <Typography variant="h6" sx={{ mx: 0.5 }}>=</Typography>
                        <Chip
                          label={
                            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>Végösszeg</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{formatPrice(finalTotal, quoteResult.currency)}</Typography>
                            </Box>
                          }
                          sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                        />
                      </>
                    )}
                    {discountPercent === 0 && (
                      <Chip
                        label={
                          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>Végösszeg</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{formatPrice(quoteResult.grand_total_gross, quoteResult.currency)}</Typography>
                          </Box>
                        }
                        sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                      />
                    )}
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {/* Material Costs */}
                {quoteResult.materials.map((material, idx) => (
                  <Box key={idx} sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {material.material_name}
                      </Typography>
                      <Chip 
                        label={material.on_stock ? 'Raktári' : 'Nem raktári'} 
                        color={material.on_stock ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                    
                    {/* Lapanyag Table */}
                    <TableContainer component={Paper} sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>Tábla</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Kihasználtság</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Nettó</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>ÁFA</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bruttó</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {material.boards.map((board, boardIdx) => {
                            // Get the actual material to access usage_limit
                            const actualMaterial = materials.find(m => m.id === material.material_id)
                            const isOverLimit = actualMaterial && (board.usage_percentage / 100) >= actualMaterial.usage_limit
                            
                            return (
                              <TableRow key={boardIdx}>
                                <TableCell>
                                  {material.on_stock ? `Tábla ${board.board_id}` : `${board.board_id} tábla`}
                                  {board.pricing_method === 'panel_area' && material.on_stock && actualMaterial && (
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      {board.area_m2.toFixed(2)}m² × {actualMaterial.waste_multi.toFixed(2)} = {(board.area_m2 * actualMaterial.waste_multi).toFixed(2)}m² (panel × hulladékszorzó)
                                    </Typography>
                                  )}
                                  {board.pricing_method === 'full_board' && (
                                    <Typography variant="caption" display="block" color="warning.main">
                                      {board.charged_area_m2.toFixed(3)}m² (teljes tábla árazva)
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography 
                                    component="span" 
                                    sx={{ 
                                      fontWeight: isOverLimit ? 'bold' : 'normal',
                                      color: isOverLimit ? 'error.main' : 'inherit'
                                    }}
                                  >
                                    {board.usage_percentage.toFixed(1)}%
                                  </Typography>
                                  {!material.on_stock && (
                                    <Typography variant="caption" display="block" color="text.secondary">
                                      (tényleges kihasználtság)
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right">{formatPrice(board.net_price, material.currency)}</TableCell>
                                <TableCell align="right">{formatPrice(board.vat_amount, material.currency)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(board.gross_price, material.currency)}</TableCell>
                              </TableRow>
                            )
                          })}
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Lapanyag összesen:</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_material_net, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_material_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_material_gross, material.currency)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Edge Materials Table */}
                    {material.edge_materials.length > 0 && (
                      <TableContainer component={Paper} sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>Élzáró anyag</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Hossz</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ár/m</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Nettó</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>ÁFA</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bruttó</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {material.edge_materials.map((edge, edgeIdx) => (
                              <TableRow key={edgeIdx}>
                                <TableCell>
                                  {edge.edge_material_name}
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    {edge.length_m.toFixed(2)}m + {((edge.length_with_overhang_m - edge.length_m) * 1000).toFixed(0)}mm ráhagyás
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">{edge.length_with_overhang_m.toFixed(2)}m</TableCell>
                                <TableCell align="right">{formatPrice(edge.price_per_m, edge.currency)}</TableCell>
                                <TableCell align="right">{formatPrice(edge.net_price, edge.currency)}</TableCell>
                                <TableCell align="right">{formatPrice(edge.vat_amount, edge.currency)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(edge.gross_price, edge.currency)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                              <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Élzáró összesen:</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_edge_net, material.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_edge_vat, material.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_edge_gross, material.currency)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Cutting Cost */}
                    {material.cutting_cost && (
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Vágási költség</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Ár/m</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Nettó</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>ÁFA</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Bruttó</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>
                                {material.cutting_cost.total_cutting_length_m.toFixed(1)}m
                              </TableCell>
                              <TableCell align="right">
                                {formatPrice(material.cutting_cost.fee_per_meter, material.cutting_cost.currency)}/m
                              </TableCell>
                              <TableCell align="right">{formatPrice(material.cutting_cost.net_price, material.cutting_cost.currency)}</TableCell>
                              <TableCell align="right">{formatPrice(material.cutting_cost.vat_amount, material.cutting_cost.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.cutting_cost.gross_price, material.cutting_cost.currency)}</TableCell>
                            </TableRow>
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>
                                Vágási költség összesen:
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.cutting_cost.net_price, material.cutting_cost.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.cutting_cost.vat_amount, material.cutting_cost.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.cutting_cost.gross_price, material.cutting_cost.currency)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Additional Services */}
                    {material.additional_services && (
                      material.additional_services.panthelyfuras || 
                      material.additional_services.duplungolas || 
                      material.additional_services.szogvagas
                    ) && (
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Kiegészítő szolgáltatások</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Ár</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Nettó</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>ÁFA</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>Bruttó</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {material.additional_services.panthelyfuras && (
                              <TableRow>
                                <TableCell>
                                  Pánthelyfúrás: {material.additional_services.panthelyfuras.quantity} {material.additional_services.panthelyfuras.unit}
                                </TableCell>
                                <TableCell align="right">
                                  {formatPrice(material.additional_services.panthelyfuras.unit_price, material.additional_services.panthelyfuras.currency)}/{material.additional_services.panthelyfuras.unit}
                                </TableCell>
                                <TableCell align="right">{formatPrice(material.additional_services.panthelyfuras.net_price, material.additional_services.panthelyfuras.currency)}</TableCell>
                                <TableCell align="right">{formatPrice(material.additional_services.panthelyfuras.vat_amount, material.additional_services.panthelyfuras.currency)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.additional_services.panthelyfuras.gross_price, material.additional_services.panthelyfuras.currency)}</TableCell>
                              </TableRow>
                            )}
                            {material.additional_services.duplungolas && (
                              <TableRow>
                                <TableCell>
                                  Duplungolás: {material.additional_services.duplungolas.quantity.toFixed(2)} {material.additional_services.duplungolas.unit}
                                </TableCell>
                                <TableCell align="right">
                                  {formatPrice(material.additional_services.duplungolas.unit_price, material.additional_services.duplungolas.currency)}/{material.additional_services.duplungolas.unit}
                                </TableCell>
                                <TableCell align="right">{formatPrice(material.additional_services.duplungolas.net_price, material.additional_services.duplungolas.currency)}</TableCell>
                                <TableCell align="right">{formatPrice(material.additional_services.duplungolas.vat_amount, material.additional_services.duplungolas.currency)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.additional_services.duplungolas.gross_price, material.additional_services.duplungolas.currency)}</TableCell>
                              </TableRow>
                            )}
                            {material.additional_services.szogvagas && (
                              <TableRow>
                                <TableCell>
                                  Szögvágás: {material.additional_services.szogvagas.quantity} {material.additional_services.szogvagas.unit}
                                </TableCell>
                                <TableCell align="right">
                                  {formatPrice(material.additional_services.szogvagas.unit_price, material.additional_services.szogvagas.currency)}/{material.additional_services.szogvagas.unit}
                                </TableCell>
                                <TableCell align="right">{formatPrice(material.additional_services.szogvagas.net_price, material.additional_services.szogvagas.currency)}</TableCell>
                                <TableCell align="right">{formatPrice(material.additional_services.szogvagas.vat_amount, material.additional_services.szogvagas.currency)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.additional_services.szogvagas.gross_price, material.additional_services.szogvagas.currency)}</TableCell>
                              </TableRow>
                            )}
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>
                                Kiegészítő szolgáltatások összesen:
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_services_net, material.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_services_vat, material.currency)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_services_gross, material.currency)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    {/* Material Total */}
                    <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {material.material_name} összesen:
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sx={{ textAlign: 'right' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatPrice(material.total_gross, material.currency)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            (Nettó: {formatPrice(material.total_net, material.currency)} + ÁFA: {formatPrice(material.total_vat, material.currency)})
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          </Grid>
          )
        })()}
      </Grid>

      
      {/* Pánthelyfúrás Modal */}
      <Dialog open={panthelyfurasModalOpen} onClose={handlePanthelyfurasClose} maxWidth="sm" fullWidth>
        <DialogTitle>Pánthelyfúrás beállítások</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Mennyiség"
              value={panthelyfurasMennyiseg}
              onChange={(e) => setPanthelyfurasMennyiseg(e.target.value)}
              type="number"
              sx={{ mb: 3 }}
            />
            
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
              Oldal:
            </Typography>
            <RadioGroup
              value={panthelyfurasOldal}
              onChange={(e) => setPanthelyfurasOldal(e.target.value)}
            >
              <FormControlLabel value="hosszu" control={<Radio />} label="Hosszú oldal" />
              <FormControlLabel value="rovid" control={<Radio />} label="Rövid oldal" />
            </RadioGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePanthelyfurasClose} color="primary">
            Mégse
          </Button>
          <Button onClick={handlePanthelyfurasDelete} color="error">
            Törlés
          </Button>
          <Button onClick={handlePanthelyfurasSave} variant="contained" color="primary">
            Mentés
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </ErrorBoundary>
  )
}
