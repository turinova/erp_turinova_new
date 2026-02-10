'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Autocomplete,
  MenuItem,
  Radio,
  FormControlLabel,
  Checkbox,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import type { AccordionProps } from '@mui/material/Accordion'
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary'
import type { AccordionDetailsProps } from '@mui/material/AccordionDetails'
import { toast } from 'react-toastify'
import { formatPrice } from '@/lib/pricing/quoteCalculations'
import { calculateVat, calculateGross, roundToWholeNumber } from '@/lib/pricing/hungarianRounding'

// Styled components copied from Opti for identical look & feel
const Accordion = styled(MuiAccordion)<AccordionProps>(() => ({
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

const AccordionSummary = styled(MuiAccordionSummary)<AccordionSummaryProps>(() => ({
  marginBottom: -1,
  transition: 'none',
  backgroundColor: 'var(--mui-palette-customColors-greyLightBg)',
  borderBottom: '1px solid var(--mui-palette-divider) !important'
}))

const AccordionDetails = styled(MuiAccordionDetails)<AccordionDetailsProps>(({ theme }) => ({
  padding: `${theme.spacing(4)} !important`
}))

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

interface LinearMaterial {
  id: string
  name: string
  width: number
  length: number
  thickness: number
  type: string | null
  price_per_m?: number
  on_stock?: boolean
  vat_percent?: number
  currency_name?: string
}

interface WorktopConfigFees {
  id: string
  kereszt_vagas_fee: number
  hosszanti_vagas_fee_per_meter: number
  ives_vagas_fee: number
  szogvagas_fee: number
  kivagas_fee: number
  elzaro_fee_per_meter: number
  osszemaras_fee: number
  kereszt_vagas_fee_gross?: number | null
  hosszanti_vagas_fee_per_meter_gross?: number | null
  ives_vagas_fee_gross?: number | null
  szogvagas_fee_gross?: number | null
  kivagas_fee_gross?: number | null
  elzaro_fee_per_meter_gross?: number | null
  osszemaras_fee_gross?: number | null
  currency_id: string
  vat_id: string
  currencies: {
    id: string
    name: string
  } | null
  vat: {
    id: string
    kulcs: number
  } | null
  created_at: string | null
  updated_at: string | null
}

interface WorktopConfigClientProps {
  initialCustomers: Customer[]
  initialLinearMaterials: LinearMaterial[]
  initialWorktopConfigFees: WorktopConfigFees | null
  initialQuoteData?: any | null // Optional: Quote data for editing mode
}

// Cutout interface
interface Cutout {
  id: string
  width: string
  height: string
  distanceFromLeft: string
  distanceFromBottom: string
  worktopType?: 'main' | 'perpendicular' // For Összemarás Balos: which worktop the cutout is on
}

// Saved worktop configuration interface
interface SavedWorktopConfig {
  id: string
  assemblyType: string | null
  selectedLinearMaterialId: string | null
  edgeBanding: 'LAM' | 'ABS' | 'Nincs élzáró'
  edgeColorChoice: 'Színazonos' | 'Egyéb szín'
  edgeColorText: string
  noPostformingEdge: boolean
  edgePosition1: boolean
  edgePosition2: boolean
  edgePosition3: boolean
  edgePosition4: boolean
  edgePosition5?: boolean
  edgePosition6?: boolean
  dimensionA: string
  dimensionB: string
  dimensionC: string
  dimensionD: string
  dimensionE?: string
  dimensionF?: string
  roundingR1: string
  roundingR2: string
  roundingR3: string
  roundingR4: string
  cutL1: string
  cutL2: string
  cutL3: string
  cutL4: string
  cutL5: string
  cutL6: string
  cutL7: string
  cutL8: string
  cutouts: Cutout[]
}

export default function WorktopConfigClient({ initialCustomers, initialLinearMaterials, initialWorktopConfigFees, initialQuoteData }: WorktopConfigClientProps) {
  const router = useRouter()
  
  // Fetch-only: we only use initialCustomers from DB, no saves yet
  const customers = initialCustomers || []
  const linearMaterials = initialLinearMaterials || []
  
  // Worktop config fees with fallback to hardcoded defaults if not in DB
  const worktopConfigFees = useMemo(() => {
    if (initialWorktopConfigFees) {
      return initialWorktopConfigFees
    }
    // Fallback to hardcoded defaults if DB doesn't have fees yet
    return {
      id: '',
      kereszt_vagas_fee: 2100,
      hosszanti_vagas_fee_per_meter: 1500,
      ives_vagas_fee: 13000,
      szogvagas_fee: 3000,
      kivagas_fee: 10000,
      elzaro_fee_per_meter: 1800,
      osszemaras_fee: 26000,
      currency_id: '',
      vat_id: '',
      currencies: { id: '', name: 'HUF' },
      vat: { id: '', kulcs: 27 },
      created_at: null,
      updated_at: null
    }
  }, [initialWorktopConfigFees])

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

  // Worktop config state (fetch-only, no save yet)
  const assemblyTypes = [
    'Levágás',
    'Összemarás Balos',
    'Összemarás jobbos',
    'Összemarás U alak (Nem működik még)'
  ]
  // Filter out "Összemarás U alak" option (can be restored by removing the filter)
  const visibleAssemblyTypes = assemblyTypes.filter(type => type !== 'Összemarás U alak (Nem működik még)')
  const [assemblyType, setAssemblyType] = useState<string | null>(null)
  const [selectedLinearMaterialId, setSelectedLinearMaterialId] = useState<string | null>(null)
  const [edgeBanding, setEdgeBanding] = useState<'LAM' | 'ABS' | 'Nincs élzáró'>('Nincs élzáró')
  const [edgeColorChoice, setEdgeColorChoice] = useState<'Színazonos' | 'Egyéb szín'>('Színazonos')
  const [edgeColorText, setEdgeColorText] = useState<string>('')
  const [noPostformingEdge, setNoPostformingEdge] = useState<boolean>(false)
  const [edgePosition1, setEdgePosition1] = useState<boolean>(false)
  const [edgePosition2, setEdgePosition2] = useState<boolean>(false)
  const [edgePosition3, setEdgePosition3] = useState<boolean>(false)
  const [edgePosition4, setEdgePosition4] = useState<boolean>(false)
  const [edgePosition5, setEdgePosition5] = useState<boolean>(false)
  const [edgePosition6, setEdgePosition6] = useState<boolean>(false)
  const [dimensionA, setDimensionA] = useState<string>('')
  const [dimensionB, setDimensionB] = useState<string>('')
  const [dimensionC, setDimensionC] = useState<string>('')
  const [dimensionD, setDimensionD] = useState<string>('')
  const [dimensionE, setDimensionE] = useState<string>('')
  const [dimensionF, setDimensionF] = useState<string>('')
  const [roundingR1, setRoundingR1] = useState<string>('')
  const [roundingR2, setRoundingR2] = useState<string>('')
  const [roundingR3, setRoundingR3] = useState<string>('')
  const [roundingR4, setRoundingR4] = useState<string>('')
  const [cutL1, setCutL1] = useState<string>('')
  const [cutL2, setCutL2] = useState<string>('')
  const [cutL3, setCutL3] = useState<string>('')
  const [cutL4, setCutL4] = useState<string>('')
  const [cutL5, setCutL5] = useState<string>('')
  const [cutL6, setCutL6] = useState<string>('')
  const [cutL7, setCutL7] = useState<string>('')
  const [cutL8, setCutL8] = useState<string>('')
  
  // Cutouts state (max 3)
  const [cutouts, setCutouts] = useState<Cutout[]>([])

  // Saved configurations state
  const [savedConfigs, setSavedConfigs] = useState<SavedWorktopConfig[]>([])
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  
  // Quote result state
  const [quoteResult, setQuoteResult] = useState<{
    materials: Array<{
      material_id: string
      material_name: string
      currency: string
      on_stock: boolean
      anyag_koltseg_net: number
      anyag_koltseg_vat: number
      anyag_koltseg_gross: number
      anyag_koltseg_details: string
      kereszt_vagas_net: number
      kereszt_vagas_vat: number
      kereszt_vagas_gross: number
      kereszt_vagas_details: string
      hosszanti_vagas_net: number
      hosszanti_vagas_vat: number
      hosszanti_vagas_gross: number
      hosszanti_vagas_details: string
      ives_vagas_net: number
      ives_vagas_vat: number
      ives_vagas_gross: number
      ives_vagas_details: string
      szogvagas_net: number
      szogvagas_vat: number
      szogvagas_gross: number
      szogvagas_details: string
      kivagas_net: number
      kivagas_vat: number
      kivagas_gross: number
      kivagas_details: string
      elzaro_net: number
      elzaro_vat: number
      elzaro_gross: number
      elzaro_details: string
      osszemaras_net: number
      osszemaras_vat: number
      osszemaras_gross: number
      osszemaras_details: string
      total_net: number
      total_vat: number
      total_gross: number
    }>
    grand_total_net: number
    grand_total_vat: number
    grand_total_gross: number
    currency: string
  } | null>(null)

  // Quote editing state
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(initialQuoteData?.id || null)
  const [isSavingQuote, setIsSavingQuote] = useState(false)

  const linearMaterialOptions = useMemo(() => {
    return linearMaterials.map(lm => ({
      id: lm.id,
      label: `${lm.name} ${lm.width}*${lm.length}*${lm.thickness} ${lm.type ?? ''}`.trim()
    }))
  }, [linearMaterials])

  // Load saved configurations from session storage on mount
  useEffect(() => {
    const savedConfigsStr = sessionStorage.getItem('worktop-configs')
    if (savedConfigsStr) {
      try {
        setSavedConfigs(JSON.parse(savedConfigsStr))
      } catch (error) {
        console.error('Error loading worktop configs from session storage:', error)
      }
    }
  }, [])

  // Save configurations to session storage whenever savedConfigs changes
  useEffect(() => {
    if (savedConfigs.length > 0) {
      sessionStorage.setItem('worktop-configs', JSON.stringify(savedConfigs))
    } else {
      sessionStorage.removeItem('worktop-configs')
    }
  }, [savedConfigs])

  // Load quote data when editing
  useEffect(() => {
    if (initialQuoteData) {
      // Load customer data
      const customer = customers.find(c => c.id === initialQuoteData.customer_id)
      if (customer) {
        setSelectedCustomer(customer)
        setCustomerData({
          name: customer.name,
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

      // Load configs
      const loadedConfigs: SavedWorktopConfig[] = initialQuoteData.configs.map((config: any) => {
        const cutouts = config.cutouts ? JSON.parse(config.cutouts) : []
        return {
          id: config.id,
          assemblyType: config.assembly_type,
          selectedLinearMaterialId: config.linear_material_id,
          edgeBanding: config.edge_banding as 'LAM' | 'ABS' | 'Nincs élzáró',
          edgeColorChoice: config.edge_color_choice as 'Színazonos' | 'Egyéb szín',
          edgeColorText: config.edge_color_text || '',
          noPostformingEdge: config.no_postforming_edge,
          edgePosition1: config.edge_position1,
          edgePosition2: config.edge_position2,
          edgePosition3: config.edge_position3,
          edgePosition4: config.edge_position4,
          edgePosition5: config.edge_position5 || false,
          edgePosition6: config.edge_position6 || false,
          dimensionA: config.dimension_a.toString(),
          dimensionB: config.dimension_b.toString(),
          dimensionC: config.dimension_c?.toString() || '',
          dimensionD: config.dimension_d?.toString() || '',
          dimensionE: config.dimension_e?.toString() || '',
          dimensionF: config.dimension_f?.toString() || '',
          roundingR1: config.rounding_r1?.toString() || '',
          roundingR2: config.rounding_r2?.toString() || '',
          roundingR3: config.rounding_r3?.toString() || '',
          roundingR4: config.rounding_r4?.toString() || '',
          cutL1: config.cut_l1?.toString() || '',
          cutL2: config.cut_l2?.toString() || '',
          cutL3: config.cut_l3?.toString() || '',
          cutL4: config.cut_l4?.toString() || '',
          cutL5: config.cut_l5?.toString() || '',
          cutL6: config.cut_l6?.toString() || '',
          cutL7: config.cut_l7?.toString() || '',
          cutL8: config.cut_l8?.toString() || '',
          cutouts: cutouts
        }
      })
      setSavedConfigs(loadedConfigs)

      // Recalculate quote from loaded data
      // This will be done when user clicks "Ajánlat generálás" or we can auto-calculate
      // For now, we'll let the user regenerate the quote
    }
  }, [initialQuoteData, customers])

  // Helper function to validate rounding values against B (for Levágás only)
  const validateRoundingValues = (r1: string, r2: string, r3: string, r4: string, b: string, showErrors: boolean = false): boolean => {
    if (assemblyType !== 'Levágás' || !b) return true
    
    const bValue = parseFloat(b) || 0
    if (bValue <= 0) return true // B not set yet, skip validation
    
    const r1Value = parseFloat(r1) || 0
    const r2Value = parseFloat(r2) || 0
    const r3Value = parseFloat(r3) || 0
    const r4Value = parseFloat(r4) || 0
    
    // R1 <= B
    if (r1Value > bValue) {
      if (showErrors) toast.error(`Az R1 érték (${r1Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R2 <= B
    if (r2Value > bValue) {
      if (showErrors) toast.error(`Az R2 érték (${r2Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R3 <= B
    if (r3Value > bValue) {
      if (showErrors) toast.error(`Az R3 érték (${r3Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R4 <= B
    if (r4Value > bValue) {
      if (showErrors) toast.error(`Az R4 érték (${r4Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R1 + R3 <= B
    if (r1Value > 0 && r3Value > 0 && (r1Value + r3Value) > bValue) {
      if (showErrors) toast.error(`Az R1 + R3 összege (${r1Value + r3Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R2 + R4 <= B
    if (r2Value > 0 && r4Value > 0 && (r2Value + r4Value) > bValue) {
      if (showErrors) toast.error(`Az R2 + R4 összege (${r2Value + r4Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    return true
  }

  // Helper function to validate rounding values for Összemarás Balos
  const validateBalosRoundingValues = (r1: string, r2: string, r3: string, r4: string, b: string, d: string, showErrors: boolean = false): boolean => {
    if (assemblyType !== 'Összemarás Balos' || !b || !d) return true
    
    const bValue = parseFloat(b) || 0
    const dValue = parseFloat(d) || 0
    if (bValue <= 0 || dValue <= 0) return true // B or D not set yet, skip validation
    
    const r1Value = parseFloat(r1) || 0
    const r2Value = parseFloat(r2) || 0
    const r3Value = parseFloat(r3) || 0
    const r4Value = parseFloat(r4) || 0
    
    // R1 <= D
    if (r1Value > dValue) {
      if (showErrors) toast.error(`Az R1 érték (${r1Value}mm) nem lehet nagyobb, mint a D méret (${dValue}mm)!`)
      return false
    }
    
    // R3 <= D
    if (r3Value > dValue) {
      if (showErrors) toast.error(`Az R3 érték (${r3Value}mm) nem lehet nagyobb, mint a D méret (${dValue}mm)!`)
      return false
    }
    
    // R2 <= B
    if (r2Value > bValue) {
      if (showErrors) toast.error(`Az R2 érték (${r2Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R4 <= B
    if (r4Value > bValue) {
      if (showErrors) toast.error(`Az R4 érték (${r4Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    // R3 + R1 <= D
    if (r1Value > 0 && r3Value > 0 && (r1Value + r3Value) > dValue) {
      if (showErrors) toast.error(`Az R3 + R1 összege (${r1Value + r3Value}mm) nem lehet nagyobb, mint a D méret (${dValue}mm)!`)
      return false
    }
    
    // R2 + R4 <= B
    if (r2Value > 0 && r4Value > 0 && (r2Value + r4Value) > bValue) {
      if (showErrors) toast.error(`Az R2 + R4 összege (${r2Value + r4Value}mm) nem lehet nagyobb, mint a B méret (${bValue}mm)!`)
      return false
    }
    
    return true
  }

  // Check if required fields are filled (without showing errors)
  const areRequiredFieldsFilled = (): boolean => {
    if (!assemblyType) return false
    if (!selectedLinearMaterialId) return false
    // edgeBanding can be 'Nincs élzáró' - it's acceptable
    if (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') {
      if (!dimensionA || parseFloat(dimensionA) <= 0) return false
      if (!dimensionB || parseFloat(dimensionB) <= 0) return false
      
      // Additional validation for Levágás type
      if (assemblyType === 'Levágás' && selectedLinearMaterialId) {
        const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
        if (selectedMaterial) {
          const materialLength = selectedMaterial.length || 0
          const materialWidth = selectedMaterial.width || 0
          const aValue = parseFloat(dimensionA) || 0
          const bValue = parseFloat(dimensionB) || 0
          
          // A must be less than material length
          if (aValue >= materialLength) return false
          
          // B must be less than or equal to material width
          // If noPostformingEdge is checked, B must be less than material width - 10
          if (noPostformingEdge) {
            const maxB = materialWidth - 10
            if (bValue >= maxB) return false
          } else {
            // B can be equal to material width
            if (bValue > materialWidth) return false
          }
          
          // Validate rounding values against B
          if (!validateRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, false)) {
            return false
          }
        }
      }
      if (assemblyType === 'Hossztoldás') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
      }
      if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
        if (!dimensionD || parseFloat(dimensionD) <= 0) return false
        
        // Additional validation for Összemarás Balos type
        if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
          if (selectedMaterial) {
            const materialLength = selectedMaterial.length || 0
            const materialWidth = selectedMaterial.width || 0
            const aValue = parseFloat(dimensionA) || 0
            const bValue = parseFloat(dimensionB) || 0
            const cValue = parseFloat(dimensionC) || 0
            const dValue = parseFloat(dimensionD) || 0
            
            // A <= material length
            if (aValue > materialLength) return false
            
            // B <= material width (if noPostformingEdge checked, B <= width - 10)
            if (noPostformingEdge) {
              const maxB = materialWidth - 10
              if (bValue > maxB) return false
            } else {
              if (bValue > materialWidth) return false
            }
            
            // (C - D) <= material length - 50 (Marás ráhagyás okán)
            const maxCD = materialLength - 50
            if ((cValue - dValue) > maxCD) return false
            
            // D <= material width (if noPostformingEdge checked, D <= width - 10)
            if (noPostformingEdge) {
              const maxD = materialWidth - 10
              if (dValue > maxD) return false
            } else {
              if (dValue > materialWidth) return false
            }
            
            // Validate rounding values against B and D
            if (!validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, dimensionD, false)) {
              return false
            }
          }
        }
        
        // Additional validation for Összemarás jobbos type
        if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
          if (selectedMaterial) {
            const materialLength = selectedMaterial.length || 0
            const materialWidth = selectedMaterial.width || 0
            const aValue = parseFloat(dimensionA) || 0
            const bValue = parseFloat(dimensionB) || 0
            const cValue = parseFloat(dimensionC) || 0
            const dValue = parseFloat(dimensionD) || 0
            
            // (A - D) <= material length - 50 (Marás ráhagyás okán)
            const maxAD = materialLength - 50
            if ((aValue - dValue) > maxAD) return false
            
            // B <= material width (if noPostformingEdge checked, B <= width - 10)
            if (noPostformingEdge) {
              const maxB = materialWidth - 10
              if (bValue > maxB) return false
            } else {
              if (bValue > materialWidth) return false
            }
            
            // C <= material length
            if (cValue > materialLength) return false
            
            // D <= material width (if noPostformingEdge checked, D <= width - 10)
            if (noPostformingEdge) {
              const maxD = materialWidth - 10
              if (dValue > maxD) return false
            } else {
              if (dValue > materialWidth) return false
            }
            
            // Validate rounding values against B and D
            if (!validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, dimensionD, false)) {
              return false
            }
          }
        }
      }
      if (assemblyType === 'Összemarás U alak (Nem működik még)') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
        if (!dimensionD || parseFloat(dimensionD) <= 0) return false
        if (!dimensionE || parseFloat(dimensionE) <= 0) return false
        if (!dimensionF || parseFloat(dimensionF) <= 0) return false
      }
    }
    return true
  }

  // Validation function for required fields (with toast errors)
  const validateRequiredFields = (): boolean => {
    if (!assemblyType) {
      toast.error('Kérjük válassza ki az összeállítás típusát!')
      return false
    }
    if (!selectedLinearMaterialId) {
      toast.error('Kérjük válassza ki a munkalap típusát!')
      return false
    }
    // edgeBanding can be 'Nincs élzáró' - it's acceptable
    if (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') {
      if (!dimensionA || parseFloat(dimensionA) <= 0) {
        toast.error('Kérjük adja meg az A méretet!')
        return false
      }
      if (!dimensionB || parseFloat(dimensionB) <= 0) {
        toast.error('Kérjük adja meg a B méretet!')
        return false
      }
      
      // Additional validation for Levágás type
      if (assemblyType === 'Levágás' && selectedLinearMaterialId) {
        const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
        if (selectedMaterial) {
          const materialLength = selectedMaterial.length || 0
          const materialWidth = selectedMaterial.width || 0
          const aValue = parseFloat(dimensionA) || 0
          const bValue = parseFloat(dimensionB) || 0
          
          // A must be less than material length
          if (aValue >= materialLength) {
            toast.error(`Az A méret (${aValue}mm) kisebb kell legyen, mint a munkalap hossza (${materialLength}mm)!`)
            return false
          }
          
          // B must be less than or equal to material width
          // If noPostformingEdge is checked, B must be less than material width - 10
          if (noPostformingEdge) {
            const maxB = materialWidth - 10
            if (bValue >= maxB) {
              toast.error(`A B méret (${bValue}mm) kisebb kell legyen, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
              return false
            }
          } else {
            // B can be equal to material width
            if (bValue > materialWidth) {
              toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
              return false
            }
          }
          
          // Validate rounding values against B
          if (!validateRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, true)) {
            return false
          }
        }
      }
      if (assemblyType === 'Hossztoldás') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) {
          toast.error('Kérjük adja meg a C méretet!')
          return false
        }
      }
      if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) {
          toast.error('Kérjük adja meg a C méretet!')
          return false
        }
        if (!dimensionD || parseFloat(dimensionD) <= 0) {
          toast.error('Kérjük adja meg a D méretet!')
          return false
        }
        
        // Additional validation for Összemarás Balos type
        if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
          if (selectedMaterial) {
            const materialLength = selectedMaterial.length || 0
            const materialWidth = selectedMaterial.width || 0
            const aValue = parseFloat(dimensionA) || 0
            const bValue = parseFloat(dimensionB) || 0
            const cValue = parseFloat(dimensionC) || 0
            const dValue = parseFloat(dimensionD) || 0
            
            // A <= material length
            if (aValue > materialLength) {
              toast.error(`Az A méret (${aValue}mm) nem lehet nagyobb, mint a munkalap hossza (${materialLength}mm)!`)
              return false
            }
            
            // B <= material width (if noPostformingEdge checked, B <= width - 10)
            if (noPostformingEdge) {
              const maxB = materialWidth - 10
              if (bValue > maxB) {
                toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                return false
              }
            } else {
              if (bValue > materialWidth) {
                toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                return false
              }
            }
            
            // (C - D) <= material length - 50 (Marás ráhagyás okán)
            const maxCD = materialLength - 50
            if ((cValue - dValue) > maxCD) {
              toast.error(`A (C - D) érték (${cValue - dValue}mm) nem lehet nagyobb, mint a munkalap hossza mínusz 50mm (${maxCD}mm) marás ráhagyás okán!`)
              return false
            }
            
            // D <= material width (if noPostformingEdge checked, D <= width - 10)
            if (noPostformingEdge) {
              const maxD = materialWidth - 10
              if (dValue > maxD) {
                toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxD}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                return false
              }
            } else {
              if (dValue > materialWidth) {
                toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                return false
              }
            }
            
            // Validate rounding values against B and D
            if (!validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, dimensionD, true)) {
              return false
            }
          }
        }
        
        // Additional validation for Összemarás jobbos type
        if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
          if (selectedMaterial) {
            const materialLength = selectedMaterial.length || 0
            const materialWidth = selectedMaterial.width || 0
            const aValue = parseFloat(dimensionA) || 0
            const bValue = parseFloat(dimensionB) || 0
            const cValue = parseFloat(dimensionC) || 0
            const dValue = parseFloat(dimensionD) || 0
            
            // (A - D) <= material length - 50 (Marás ráhagyás okán)
            const maxAD = materialLength - 50
            if ((aValue - dValue) > maxAD) {
              toast.error(`Az (A - D) érték (${aValue - dValue}mm) nem lehet nagyobb, mint a munkalap hossza mínusz 50mm (${maxAD}mm) marás ráhagyás okán!`)
              return false
            }
            
            // B <= material width (if noPostformingEdge checked, B <= width - 10)
            if (noPostformingEdge) {
              const maxB = materialWidth - 10
              if (bValue > maxB) {
                toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                return false
              }
            } else {
              if (bValue > materialWidth) {
                toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                return false
              }
            }
            
            // C <= material length
            if (cValue > materialLength) {
              toast.error(`A C méret (${cValue}mm) nem lehet nagyobb, mint a munkalap hossza (${materialLength}mm)!`)
              return false
            }
            
            // D <= material width (if noPostformingEdge checked, D <= width - 10)
            if (noPostformingEdge) {
              const maxD = materialWidth - 10
              if (dValue > maxD) {
                toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxD}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                return false
              }
            } else {
              if (dValue > materialWidth) {
                toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                return false
              }
            }
            
            // Validate rounding values against B and D
            if (!validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, dimensionD, true)) {
              return false
            }
          }
        }
      }
      if (assemblyType === 'Összemarás U alak (Nem működik még)') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) {
          toast.error('Kérjük adja meg a C méretet!')
          return false
        }
        if (!dimensionD || parseFloat(dimensionD) <= 0) {
          toast.error('Kérjük adja meg a D méretet!')
          return false
        }
        if (!dimensionE || parseFloat(dimensionE) <= 0) {
          toast.error('Kérjük adja meg az E méretet!')
          return false
        }
        if (!dimensionF || parseFloat(dimensionF) <= 0) {
          toast.error('Kérjük adja meg az F méretet!')
          return false
        }
      }
    }
    return true
  }

  // Save configuration
  const saveConfiguration = () => {
    if (!validateRequiredFields()) {
      return
    }

    const config: SavedWorktopConfig = {
      id: editingConfigId || `config-${Date.now()}-${Math.random()}`,
      assemblyType,
      selectedLinearMaterialId,
      edgeBanding,
      edgeColorChoice,
      edgeColorText,
      noPostformingEdge,
      edgePosition1,
      edgePosition2,
      edgePosition3,
      edgePosition4,
      edgePosition5,
      edgePosition6,
      dimensionA,
      dimensionB,
      dimensionC,
      dimensionD,
      dimensionE,
      dimensionF,
      roundingR1,
      roundingR2,
      roundingR3,
      roundingR4,
      cutL1,
      cutL2,
      cutL3,
      cutL4,
      cutL5,
      cutL6,
      cutL7,
      cutL8,
      cutouts: [...cutouts]
    }

    if (editingConfigId) {
      // Update existing configuration
      setSavedConfigs(prev => prev.map(c => c.id === editingConfigId ? config : c))
      toast.success('Konfiguráció sikeresen frissítve!')
    } else {
      // Add new configuration
      setSavedConfigs(prev => [...prev, config])
      toast.success('Konfiguráció sikeresen mentve!')
    }

    // Clear quote result when config is modified (like opti page)
    setQuoteResult(null)

    // Clear edit mode and form to hide visualization
    setEditingConfigId(null)
    clearWorktopConfigForm()
  }

  // Load configuration for editing
  const loadConfiguration = (config: SavedWorktopConfig) => {
    setEditingConfigId(config.id)
    setAssemblyType(config.assemblyType)
    setSelectedLinearMaterialId(config.selectedLinearMaterialId)
    setEdgeBanding(config.edgeBanding)
    setEdgeColorChoice(config.edgeColorChoice)
    setEdgeColorText(config.edgeColorText)
    setNoPostformingEdge(config.noPostformingEdge)
    setEdgePosition1(config.edgePosition1)
    setEdgePosition2(config.edgePosition2)
    setEdgePosition3(config.edgePosition3)
    setEdgePosition4(config.edgePosition4)
    setEdgePosition5(config.edgePosition5 || false)
    setEdgePosition6(config.edgePosition6 || false)
    setDimensionA(config.dimensionA)
    setDimensionB(config.dimensionB)
    setDimensionC(config.dimensionC || '')
    setDimensionD(config.dimensionD || '')
    setDimensionE(config.dimensionE || '')
    setDimensionF(config.dimensionF || '')
    setRoundingR1(config.roundingR1)
    setRoundingR2(config.roundingR2)
    setRoundingR3(config.roundingR3 || '')
    setRoundingR4(config.roundingR4 || '')
    setCutL1(config.cutL1)
    setCutL2(config.cutL2)
    setCutL3(config.cutL3)
    setCutL4(config.cutL4)
    setCutL5(config.cutL5 || '')
    setCutL6(config.cutL6 || '')
    setCutL7(config.cutL7 || '')
    setCutL8(config.cutL8 || '')
    setCutouts([...config.cutouts])

    // Scroll to top
    setTimeout(() => {
      window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      })
    }, 100)
  }

  // Delete configuration
  const deleteConfiguration = (configId: string) => {
    setSavedConfigs(prev => prev.filter(c => c.id !== configId))
    if (editingConfigId === configId) {
      setEditingConfigId(null)
    }
    // Clear quote result when config is deleted (like opti page)
    setQuoteResult(null)
    toast.success('Konfiguráció sikeresen törölve!')
  }

  // Calculate quote for Levágás, Összemarás Balos, and Összemarás jobbos types
  // Save Quote function
  const saveQuote = async () => {
    if (!quoteResult) {
      toast.error('Futtassa le az árajánlat generálást mentés előtt!')
      return
    }

    if (!customerData.name.trim()) {
      toast.error('Kérjük, töltse ki a megrendelő nevét!')
      return
    }

    if (savedConfigs.length === 0) {
      toast.error('Nincs mentett konfiguráció!')
      return
    }

    setIsSavingQuote(true)

    try {
      // Prepare customer data
      const customerPayload = {
        id: selectedCustomer?.id || null,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        discount: customerData.discount,
        billing_name: customerData.billing_name,
        billing_country: customerData.billing_country,
        billing_city: customerData.billing_city,
        billing_postal_code: customerData.billing_postal_code,
        billing_street: customerData.billing_street,
        billing_house_number: customerData.billing_house_number,
        billing_tax_number: customerData.billing_tax_number,
        billing_company_reg_number: customerData.billing_company_reg_number
      }

      // Prepare quote calculations
      const quoteCalculationsPayload = {
        grand_total_net: quoteResult.grand_total_net,
        grand_total_vat: quoteResult.grand_total_vat,
        grand_total_gross: quoteResult.grand_total_gross,
        materials: quoteResult.materials
      }

      // Call API to save worktop quote
      const response = await fetch('/api/worktop-quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: editingQuoteId, // null for new quote, UUID for editing
          customerData: customerPayload,
          savedConfigs: savedConfigs,
          quoteCalculations: quoteCalculationsPayload
        })
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          const text = await response.text()
          console.error('=== CLIENT: FAILED TO PARSE ERROR JSON ===')
          console.error('Response text:', text)
          console.error('Response status:', response.status)
          throw new Error(`Failed to save worktop quote (Status: ${response.status})`)
        }
        
        console.error('=== CLIENT: ERROR RESPONSE FROM API ===')
        console.error('Full error data:', JSON.stringify(errorData, null, 2))
        console.error('Error:', errorData.error)
        console.error('Details:', errorData.details)
        console.error('Code:', errorData.code)
        console.error('Hint:', errorData.hint)
        console.error('Full error (if present):', errorData.fullError)
        console.error('Response status:', response.status)
        console.error('Response status text:', response.statusText)
        console.error('=== END CLIENT ERROR ===')
        
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}${errorData.hint ? ` (${errorData.hint})` : ''}${errorData.code ? ` [Code: ${errorData.code}]` : ''}`
          : errorData.error || 'Failed to save worktop quote'
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      // Different message for edit vs create
      if (editingQuoteId) {
        toast.success(`Munkalap ajánlat sikeresen frissítve: ${result.quoteNumber}`)
        // Redirect back to detail page after successful update
        setTimeout(() => {
          router.push(`/worktop-quotes/${editingQuoteId}`)
        }, 1500)
      } else {
        toast.success(`Munkalap ajánlat sikeresen mentve: ${result.quoteNumber}`)
        // Redirect to detail page
        setTimeout(() => {
          router.push(`/worktop-quotes/${result.quoteId}`)
        }, 1500)
      }
      
    } catch (err) {
      console.error('=== CLIENT: CATCH BLOCK ERROR ===')
      console.error('Error type:', typeof err)
      console.error('Error:', err)
      console.error('Error message:', err instanceof Error ? err.message : String(err))
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack')
      console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
      console.error('=== END CATCH BLOCK ERROR ===')
      
      const errorMessage = err instanceof Error ? err.message : 'Ismeretlen hiba'
      toast.error(`Hiba az árajánlat mentése során: ${errorMessage}`)
      
      // Also log to alert for visibility
      if (err instanceof Error && err.message.includes('Code:')) {
        alert(`Detailed Error:\n${err.message}\n\nCheck browser console for full details.`)
      }
    } finally {
      setIsSavingQuote(false)
    }
  }

  const calculateQuote = () => {
    // Filter Levágás, Összemarás Balos, and Összemarás jobbos type configs
    const relevantConfigs = savedConfigs.filter(config => 
      config.assemblyType === 'Levágás' || 
      config.assemblyType === 'Összemarás Balos' || 
      config.assemblyType === 'Összemarás jobbos'
    )
    
    if (relevantConfigs.length === 0) {
      toast.error('Nincs mentett "Levágás", "Összemarás Balos" vagy "Összemarás jobbos" típusú konfiguráció!')
      return
    }
    
    const materials: Array<{
      material_id: string
      material_name: string
      currency: string
      on_stock: boolean
      anyag_koltseg_net: number
      anyag_koltseg_vat: number
      anyag_koltseg_gross: number
      anyag_koltseg_details: string
      kereszt_vagas_net: number
      kereszt_vagas_vat: number
      kereszt_vagas_gross: number
      kereszt_vagas_details: string
      hosszanti_vagas_net: number
      hosszanti_vagas_vat: number
      hosszanti_vagas_gross: number
      hosszanti_vagas_details: string
      ives_vagas_net: number
      ives_vagas_vat: number
      ives_vagas_gross: number
      ives_vagas_details: string
      szogvagas_net: number
      szogvagas_vat: number
      szogvagas_gross: number
      szogvagas_details: string
      kivagas_net: number
      kivagas_vat: number
      kivagas_gross: number
      kivagas_details: string
      elzaro_net: number
      elzaro_vat: number
      elzaro_gross: number
      elzaro_details: string
      osszemaras_net: number
      osszemaras_vat: number
      osszemaras_gross: number
      osszemaras_details: string
      total_net: number
      total_vat: number
      total_gross: number
    }> = []
    let grandTotalNet = 0
    let grandTotalVat = 0
    let grandTotalGross = 0
    let currency = 'HUF'

    // Process each config separately (don't group by material)
    relevantConfigs.forEach((config, configIdx) => {
      if (!config.selectedLinearMaterialId) return
      
      const material = linearMaterials.find(m => m.id === config.selectedLinearMaterialId)
      if (!material) return

      const vatPercent = material.vat_percent || 0
      const vatMultiplier = 1 + (vatPercent / 100)
      currency = material.currency_name || 'HUF'

      let anyagKoltsegNet = 0
      let keresztVagasNet = 0
      let hosszantiVagasNet = 0
      let hosszantiVagasGross = 0 // Accumulate gross directly to avoid rounding errors
      let ivesVagasNet = 0
      let szogvagasNet = 0
      let kivagasNet = 0
      let elzaroNet = 0
      let osszemarasNet = 0
      let totalElzaroMeters = 0

      // Details for calculations
      const anyagKoltsegDetails: string[] = []
      const keresztVagasDetails: string[] = []
      const hosszantiVagasDetails: string[] = []
      const ivesVagasDetails: string[] = []
      const szogvagasDetails: string[] = []
      const kivagasDetails: string[] = []
        const aValue = parseFloat(config.dimensionA) || 0
        const bValue = parseFloat(config.dimensionB) || 0
        const cValue = parseFloat(config.dimensionC) || 0
        const dValue = parseFloat(config.dimensionD) || 0
        const aMeters = aValue / 1000
        const bMeters = bValue / 1000
        const cMeters = cValue / 1000
        const dMeters = dValue / 1000

        const isBalos = config.assemblyType === 'Összemarás Balos'
        const isJobbos = config.assemblyType === 'Összemarás jobbos'
        const isOsszemaras = isBalos || isJobbos

        // Anyag költség
        if (isBalos) {
          // Összemarás Balos calculation
          if (material.on_stock) {
            // A × price_per_m + (C-D) × price_per_m
            const costA = aMeters * (material.price_per_m || 0)
            const costCD = (cMeters - dMeters) * (material.price_per_m || 0)
            const cost = costA + costCD
            anyagKoltsegNet += cost
            anyagKoltsegDetails.push(`${aMeters.toFixed(2)}m × ${formatPrice(material.price_per_m || 0, currency)}/m + ${(cMeters - dMeters).toFixed(2)}m × ${formatPrice(material.price_per_m || 0, currency)}/m = ${formatPrice(cost, currency)}`)
          } else {
            // roundup((A+C-D)/linear_material_length) × price_per_m × linear_material_length
            const totalLength = aValue + cValue - dValue
            const materialLengthMeters = material.length / 1000
            const boardsNeeded = Math.ceil(totalLength / material.length)
            const cost = boardsNeeded * (material.price_per_m || 0) * materialLengthMeters
            anyagKoltsegNet += cost
            anyagKoltsegDetails.push(`${boardsNeeded} tábla × ${formatPrice(material.price_per_m || 0, currency)}/m × ${materialLengthMeters.toFixed(2)}m = ${formatPrice(cost, currency)}`)
          }
        } else if (isJobbos) {
          // Összemarás jobbos calculation
          if (material.on_stock) {
            // (A-D) × price_per_m + C × price_per_m
            const costAD = (aMeters - dMeters) * (material.price_per_m || 0)
            const costC = cMeters * (material.price_per_m || 0)
            const cost = costAD + costC
            anyagKoltsegNet += cost
            anyagKoltsegDetails.push(`${(aMeters - dMeters).toFixed(2)}m × ${formatPrice(material.price_per_m || 0, currency)}/m + ${cMeters.toFixed(2)}m × ${formatPrice(material.price_per_m || 0, currency)}/m = ${formatPrice(cost, currency)}`)
          } else {
            // roundup((A+C-D)/linear_material_length) × price_per_m × linear_material_length
            const totalLength = aValue + cValue - dValue
            const materialLengthMeters = material.length / 1000
            const boardsNeeded = Math.ceil(totalLength / material.length)
            const cost = boardsNeeded * (material.price_per_m || 0) * materialLengthMeters
            anyagKoltsegNet += cost
            anyagKoltsegDetails.push(`${boardsNeeded} tábla × ${formatPrice(material.price_per_m || 0, currency)}/m × ${materialLengthMeters.toFixed(2)}m = ${formatPrice(cost, currency)}`)
          }
        } else {
          // Levágás calculation
          if (material.on_stock) {
            const cost = aMeters * (material.price_per_m || 0)
            anyagKoltsegNet += cost
            anyagKoltsegDetails.push(`${aMeters.toFixed(2)}m × ${formatPrice(material.price_per_m || 0, currency)}/m = ${formatPrice(cost, currency)}`)
          } else {
            const cost = (material.price_per_m || 0) * (material.length / 1000)
            anyagKoltsegNet += cost
            anyagKoltsegDetails.push(`${formatPrice(material.price_per_m || 0, currency)}/m × ${(material.length / 1000).toFixed(2)}m = ${formatPrice(cost, currency)}`)
          }
        }

        // Kereszt vágás (only for Levágás, not for Balos or jobbos)
        if (!isOsszemaras) {
          // Use gross price from database, calculate net
          const keresztVagasFeeGross = worktopConfigFees.kereszt_vagas_fee_gross ?? worktopConfigFees.kereszt_vagas_fee * (1 + vatPercent / 100)
          const keresztVagasFee = Math.round(keresztVagasFeeGross / (1 + vatPercent / 100))
          keresztVagasNet += keresztVagasFee
          keresztVagasDetails.push(`${formatPrice(keresztVagasFeeGross, currency)}`)
        }

        // Hosszanti vágás
        // Use gross price from database, calculate net
        const hosszantiVagasFeePerMeterGross = worktopConfigFees.hosszanti_vagas_fee_per_meter_gross ?? worktopConfigFees.hosszanti_vagas_fee_per_meter * (1 + vatPercent / 100)
        const hosszantiVagasFeePerMeter = Math.round(hosszantiVagasFeePerMeterGross / (1 + vatPercent / 100))
        if (isOsszemaras) {
          // For Balos: if D < width: (C-D) × fee_per_meter, if A < width: A × fee_per_meter
          if (dValue < material.width) {
            const cdMeters = (cValue - dValue) / 1000
            const cost = cdMeters * hosszantiVagasFeePerMeter
            const costGross = cdMeters * hosszantiVagasFeePerMeterGross
            hosszantiVagasNet += cost
            hosszantiVagasGross += costGross // Accumulate gross directly
            hosszantiVagasDetails.push(`${cdMeters.toFixed(2)}m × ${formatPrice(hosszantiVagasFeePerMeterGross, currency)}/m = ${formatPrice(costGross, currency)}`)
          }
          if (aValue < material.width) {
            const cost = aMeters * hosszantiVagasFeePerMeter
            const costGross = aMeters * hosszantiVagasFeePerMeterGross
            hosszantiVagasNet += cost
            hosszantiVagasGross += costGross // Accumulate gross directly
            hosszantiVagasDetails.push(`${aMeters.toFixed(2)}m × ${formatPrice(hosszantiVagasFeePerMeterGross, currency)}/m = ${formatPrice(costGross, currency)}`)
          }
        } else {
          // For Levágás: if B < width: A × fee_per_meter
          if (bValue < material.width) {
            const cost = aMeters * hosszantiVagasFeePerMeter
            const costGross = aMeters * hosszantiVagasFeePerMeterGross
            hosszantiVagasNet += cost
            hosszantiVagasGross += costGross // Accumulate gross directly
            hosszantiVagasDetails.push(`${aMeters.toFixed(2)}m × ${formatPrice(hosszantiVagasFeePerMeterGross, currency)}/m = ${formatPrice(costGross, currency)}`)
          }
        }

        // Íves vágás (each R1, R2, R3, R4 that has value)
        // Use gross price from database, calculate net
        const ivesVagasFeeGross = worktopConfigFees.ives_vagas_fee_gross ?? worktopConfigFees.ives_vagas_fee * (1 + vatPercent / 100)
        const ivesVagasFee = Math.round(ivesVagasFeeGross / (1 + vatPercent / 100))
        const r1Value = parseFloat(config.roundingR1) || 0
        const r2Value = parseFloat(config.roundingR2) || 0
        const r3Value = parseFloat(config.roundingR3) || 0
        const r4Value = parseFloat(config.roundingR4) || 0
        const roundingValues: string[] = []
        if (r1Value > 0) {
          ivesVagasNet += ivesVagasFee
          roundingValues.push('R1')
        }
        if (r2Value > 0) {
          ivesVagasNet += ivesVagasFee
          roundingValues.push('R2')
        }
        if (r3Value > 0) {
          ivesVagasNet += ivesVagasFee
          roundingValues.push('R3')
        }
        if (r4Value > 0) {
          ivesVagasNet += ivesVagasFee
          roundingValues.push('R4')
        }
        if (roundingValues.length > 0) {
          const totalIvesVagas = roundingValues.length * ivesVagasFee
          const totalIvesVagasGross = roundingValues.length * ivesVagasFeeGross
          ivesVagasDetails.push(`${roundingValues.join(', ')}: ${roundingValues.length} × ${formatPrice(ivesVagasFeeGross, currency)} = ${formatPrice(totalIvesVagasGross, currency)}`)
        }

        // Szögvágás (each group L1-L2, L3-L4, L5-L6, L7-L8)
        // Use gross price from database, calculate net
        const szogvagasFeeGross = worktopConfigFees.szogvagas_fee_gross ?? worktopConfigFees.szogvagas_fee * (1 + vatPercent / 100)
        const szogvagasFee = Math.round(szogvagasFeeGross / (1 + vatPercent / 100))
        const l1Value = parseFloat(config.cutL1) || 0
        const l2Value = parseFloat(config.cutL2) || 0
        const l3Value = parseFloat(config.cutL3) || 0
        const l4Value = parseFloat(config.cutL4) || 0
        const l5Value = parseFloat(config.cutL5) || 0
        const l6Value = parseFloat(config.cutL6) || 0
        const l7Value = parseFloat(config.cutL7) || 0
        const l8Value = parseFloat(config.cutL8) || 0
        const angleGroups: string[] = []
        if (l1Value > 0 && l2Value > 0) {
          szogvagasNet += szogvagasFee
          angleGroups.push('L1-L2')
        }
        if (l3Value > 0 && l4Value > 0) {
          szogvagasNet += szogvagasFee
          angleGroups.push('L3-L4')
        }
        if (l5Value > 0 && l6Value > 0) {
          szogvagasNet += szogvagasFee
          angleGroups.push('L5-L6')
        }
        if (l7Value > 0 && l8Value > 0) {
          szogvagasNet += szogvagasFee
          angleGroups.push('L7-L8')
        }
        if (angleGroups.length > 0) {
          const totalSzogvagas = angleGroups.length * szogvagasFee
          const totalSzogvagasGross = angleGroups.length * szogvagasFeeGross
          szogvagasDetails.push(`${angleGroups.join(', ')}: ${angleGroups.length} × ${formatPrice(szogvagasFeeGross, currency)} = ${formatPrice(totalSzogvagasGross, currency)}`)
        }

        // Kivágás (each cutout)
        // Use gross price from database, calculate net
        const kivagasFeeGross = worktopConfigFees.kivagas_fee_gross ?? worktopConfigFees.kivagas_fee * (1 + vatPercent / 100)
        const kivagasFee = Math.round(kivagasFeeGross / (1 + vatPercent / 100))
        const cutoutCount = config.cutouts.length
        if (cutoutCount > 0) {
          const cost = cutoutCount * kivagasFee
          const costGross = cutoutCount * kivagasFeeGross
          kivagasNet += cost
          kivagasDetails.push(`${cutoutCount} × ${formatPrice(kivagasFeeGross, currency)} = ${formatPrice(costGross, currency)}`)
        }

        // Élzáró
        if (isOsszemaras) {
          // For Balos and jobbos:
          // 1. oldal: C
          // 2. oldal: A
          // 3. oldal: B
          // 4. oldal: A-D
          // 5. oldal: C-B
          // 6. oldal: D
          if (config.edgePosition1) totalElzaroMeters += cMeters // 1. oldal: C
          if (config.edgePosition2) totalElzaroMeters += aMeters // 2. oldal: A
          if (config.edgePosition3) totalElzaroMeters += bMeters // 3. oldal: B
          if (config.edgePosition4) totalElzaroMeters += (aMeters - dMeters) // 4. oldal: A-D
          if (config.edgePosition5) totalElzaroMeters += (cMeters - bMeters) // 5. oldal: C-B
          if (config.edgePosition6) totalElzaroMeters += dMeters // 6. oldal: D
        } else {
          // For Levágás: only 1-4 oldal
          if (config.edgePosition1) totalElzaroMeters += bMeters
          if (config.edgePosition2) totalElzaroMeters += aMeters
          if (config.edgePosition3) totalElzaroMeters += bMeters
          if (config.edgePosition4) totalElzaroMeters += aMeters
        }
      
        // Calculate élzáró total for this config
        // Use gross price from database, calculate net
        const elzaroFeePerMeterGross = worktopConfigFees.elzaro_fee_per_meter_gross ?? worktopConfigFees.elzaro_fee_per_meter * (1 + vatPercent / 100)
        const elzaroFeePerMeter = Math.round(elzaroFeePerMeterGross / (1 + vatPercent / 100))
        let elzaroNetGross = 0
        if (totalElzaroMeters > 0) {
          elzaroNet = totalElzaroMeters * elzaroFeePerMeter
          elzaroNetGross = totalElzaroMeters * elzaroFeePerMeterGross
        }

        // Calculate Összemarás fee for Balos and jobbos
        let osszemarasFeeGross = 0
        if (isOsszemaras) {
          // Use gross price from database, calculate net
          osszemarasFeeGross = worktopConfigFees.osszemaras_fee_gross ?? worktopConfigFees.osszemaras_fee * (1 + vatPercent / 100)
          osszemarasNet = Math.round(osszemarasFeeGross / (1 + vatPercent / 100))
        }

        // Round all net amounts first (Hungarian rounding)
        const roundedAnyagKoltsegNet = roundToWholeNumber(anyagKoltsegNet)
        const roundedKeresztVagasNet = roundToWholeNumber(keresztVagasNet)
        const roundedHosszantiVagasNet = roundToWholeNumber(hosszantiVagasNet)
        const roundedIvesVagasNet = roundToWholeNumber(ivesVagasNet)
        const roundedSzogvagasNet = roundToWholeNumber(szogvagasNet)
        const roundedKivagasNet = roundToWholeNumber(kivagasNet)
        const roundedElzaroNet = roundToWholeNumber(elzaroNet)
        const roundedOsszemarasNet = roundToWholeNumber(osszemarasNet)

        // Calculate VAT and gross for each category using Hungarian rounding
        // For fees with fixed gross prices, use them directly to avoid rounding errors
        const vatRate = vatPercent / 100
        const anyagKoltsegVat = calculateVat(roundedAnyagKoltsegNet, vatRate)
        const anyagKoltsegGross = calculateGross(roundedAnyagKoltsegNet, anyagKoltsegVat)

        // Kereszt vágás: use gross price directly from database
        const keresztVagasGross = roundedKeresztVagasNet > 0 
          ? roundToWholeNumber(worktopConfigFees.kereszt_vagas_fee_gross ?? roundedKeresztVagasNet * (1 + vatRate))
          : 0
        const keresztVagasVat = roundToWholeNumber(keresztVagasGross - roundedKeresztVagasNet)

        // Hosszanti vágás: use accumulated gross directly to avoid rounding errors
        const roundedHosszantiVagasGross = roundToWholeNumber(hosszantiVagasGross)
        const hosszantiVagasVat = roundToWholeNumber(roundedHosszantiVagasGross - roundedHosszantiVagasNet)

        // Íves vágás: calculate gross from gross fee
        const ivesVagasGross = roundedIvesVagasNet > 0
          ? roundToWholeNumber((roundedIvesVagasNet / ivesVagasFee) * ivesVagasFeeGross)
          : 0
        const ivesVagasVat = roundToWholeNumber(ivesVagasGross - roundedIvesVagasNet)

        // Szögvágás: calculate gross from gross fee
        const szogvagasGross = roundedSzogvagasNet > 0
          ? roundToWholeNumber((roundedSzogvagasNet / szogvagasFee) * szogvagasFeeGross)
          : 0
        const szogvagasVat = roundToWholeNumber(szogvagasGross - roundedSzogvagasNet)

        // Kivágás: calculate gross from gross fee
        const kivagasGross = roundedKivagasNet > 0
          ? roundToWholeNumber((roundedKivagasNet / kivagasFee) * kivagasFeeGross)
          : 0
        const kivagasVat = roundToWholeNumber(kivagasGross - roundedKivagasNet)

        // Élzáró: use calculated gross from gross per meter
        const elzaroGross = roundedElzaroNet > 0
          ? roundToWholeNumber(elzaroNetGross)
          : 0
        const elzaroVat = roundToWholeNumber(elzaroGross - roundedElzaroNet)

        // Összemarás: use gross price directly from database (preserves exact 26000)
        const osszemarasGross = roundedOsszemarasNet > 0
          ? roundToWholeNumber(osszemarasFeeGross)
          : 0
        const osszemarasVat = roundToWholeNumber(osszemarasGross - roundedOsszemarasNet)

        // Calculate totals (sum of rounded values)
        const totalNet = roundedAnyagKoltsegNet + roundedKeresztVagasNet + roundedHosszantiVagasNet + roundedIvesVagasNet + roundedSzogvagasNet + roundedKivagasNet + roundedElzaroNet + roundedOsszemarasNet
        const totalVat = anyagKoltsegVat + keresztVagasVat + hosszantiVagasVat + ivesVagasVat + szogvagasVat + kivagasVat + elzaroVat + osszemarasVat
        const totalGross = roundToWholeNumber(totalNet + totalVat)

        grandTotalNet += totalNet
        grandTotalVat += totalVat
        grandTotalGross += totalGross

        // Create a unique name for this config (material name + config number)
        const configNumber = configIdx + 1
        const materialName = `${material.name} (${config.assemblyType || 'N/A'}, #${configNumber})`

        materials.push({
          material_id: config.selectedLinearMaterialId,
          material_name: materialName,
          currency,
          on_stock: material.on_stock || false,
          anyag_koltseg_net: roundedAnyagKoltsegNet,
          anyag_koltseg_vat: anyagKoltsegVat,
          anyag_koltseg_gross: anyagKoltsegGross,
          anyag_koltseg_details: anyagKoltsegDetails.join('; '),
          kereszt_vagas_net: roundedKeresztVagasNet,
          kereszt_vagas_vat: keresztVagasVat,
          kereszt_vagas_gross: keresztVagasGross,
          kereszt_vagas_details: keresztVagasDetails.length > 0 ? `${keresztVagasDetails.length} × ${formatPrice(worktopConfigFees.kereszt_vagas_fee_gross ?? worktopConfigFees.kereszt_vagas_fee * (1 + vatPercent / 100), currency)} = ${formatPrice(keresztVagasGross, currency)}` : '',
          hosszanti_vagas_net: roundedHosszantiVagasNet,
          hosszanti_vagas_vat: hosszantiVagasVat,
          hosszanti_vagas_gross: roundedHosszantiVagasGross,
          hosszanti_vagas_details: hosszantiVagasDetails.join('; '),
          ives_vagas_net: roundedIvesVagasNet,
          ives_vagas_vat: ivesVagasVat,
          ives_vagas_gross: ivesVagasGross,
          ives_vagas_details: ivesVagasDetails.join('; '),
          szogvagas_net: roundedSzogvagasNet,
          szogvagas_vat: szogvagasVat,
          szogvagas_gross: szogvagasGross,
          szogvagas_details: szogvagasDetails.join('; '),
          kivagas_net: roundedKivagasNet,
          kivagas_vat: kivagasVat,
          kivagas_gross: kivagasGross,
          kivagas_details: kivagasDetails.join('; '),
          elzaro_net: roundedElzaroNet,
          elzaro_vat: elzaroVat,
          elzaro_gross: elzaroGross,
          elzaro_details: totalElzaroMeters > 0 ? `${totalElzaroMeters.toFixed(2)}m × ${formatPrice(elzaroFeePerMeterGross, currency)} = ${formatPrice(elzaroNetGross, currency)}` : '',
          osszemaras_net: roundedOsszemarasNet,
          osszemaras_vat: osszemarasVat,
          osszemaras_gross: osszemarasGross,
          osszemaras_details: roundedOsszemarasNet > 0 ? `1 × ${formatPrice(osszemarasFeeGross, currency)} = ${formatPrice(osszemarasGross, currency)}` : '',
          total_net: totalNet,
          total_vat: totalVat,
          total_gross: totalGross
        })
      })

    setQuoteResult({
      materials,
      grand_total_net: grandTotalNet,
      grand_total_vat: grandTotalVat,
      grand_total_gross: grandTotalGross,
      currency
    })

    toast.success('Ajánlat sikeresen generálva!')
  }

  // Clear worktop configuration form
  const clearWorktopConfigForm = () => {
    setAssemblyType(null)
    setSelectedLinearMaterialId(null)
    setEdgeBanding('Nincs élzáró')
    setEdgeColorChoice('Színazonos')
    setEdgeColorText('')
    setNoPostformingEdge(false)
    setEdgePosition1(false)
    setEdgePosition2(false)
    setEdgePosition3(false)
    setEdgePosition4(false)
    setEdgePosition5(false)
    setEdgePosition6(false)
    setDimensionA('')
    setDimensionB('')
    setDimensionC('')
    setDimensionD('')
    setDimensionE('')
    setDimensionF('')
    setRoundingR1('')
    setRoundingR2('')
    setRoundingR3('')
    setRoundingR4('')
    setCutL1('')
    setCutL2('')
    setCutL3('')
    setCutL4('')
    setCutL5('')
    setCutL6('')
    setCutL7('')
    setCutL8('')
    setCutouts([])
  }

  // Get material name for display
  const getMaterialName = (materialId: string | null): string => {
    if (!materialId) return '-'
    const material = linearMaterials.find(m => m.id === materialId)
    if (!material) return '-'
    return `${material.name} ${material.width}*${material.length}*${material.thickness} ${material.type ?? ''}`.trim()
  }

  const handleCustomerDataChange = (field: keyof typeof customerData, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }))
  }

  const handleCustomerSelect = (customer: Customer | null) => {
    if (!customer) {
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
      return
    }

    setSelectedCustomer(customer)
    setCustomerData({
      name: customer.name,
      email: customer.email,
      phone: customer.mobile,
      discount: customer.discount_percent?.toString?.() ?? '',
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

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Munkalép készítés
      </Typography>

      <Grid container spacing={3}>
        {/* Customer Information Card (full width row) */}
        <Grid item xs={12}>
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
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                    value={selectedCustomer}
                    inputValue={customerData.name}
                    onChange={(event, newValue) => {
                      if (typeof newValue === 'string') {
                        setSelectedCustomer(null)
                        setCustomerData(prev => ({
                          ...prev,
                          name: newValue
                        }))
                      } else if (newValue) {
                        handleCustomerSelect(newValue)
                      } else if (event) {
                        handleCustomerSelect(null)
                      }
                    }}
                    onInputChange={(event, newInputValue) => {
                      setCustomerData(prev => ({
                        ...prev,
                        name: newInputValue
                      }))

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
                      const { key, ...otherProps } = props
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
                      )
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
                  <Accordion defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                        Számlázási adatok
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Számlázási név"
                            value={customerData.billing_name}
                            onChange={(e) => handleCustomerDataChange('billing_name', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Ország"
                            value={customerData.billing_country}
                            onChange={(e) => handleCustomerDataChange('billing_country', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Irányítószám"
                            value={customerData.billing_postal_code}
                            onChange={(e) => handleCustomerDataChange('billing_postal_code', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Város"
                            value={customerData.billing_city}
                            onChange={(e) => handleCustomerDataChange('billing_city', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Utca"
                            value={customerData.billing_street}
                            onChange={(e) => handleCustomerDataChange('billing_street', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Házszám"
                            value={customerData.billing_house_number}
                            onChange={(e) => handleCustomerDataChange('billing_house_number', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Adószám"
                            value={customerData.billing_tax_number}
                            onChange={(e) => handleCustomerDataChange('billing_tax_number', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Cégjegyzékszám"
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
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          {/* Worktop config card (full width) */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Munkapult konfiguráció
                </Typography>

                <Grid container spacing={2}>
                  {/* Row 1: Assembly type & Worktop type */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Összeállítás típusa"
                      value={assemblyType || ''}
                      onChange={(e) => setAssemblyType(e.target.value || null)}
                    SelectProps={{
                      native: false,
                      MenuProps: {
                        PaperProps: {
                          style: {
                            maxHeight: 320
                          }
                        }
                      }
                    }}
                    >
                      {visibleAssemblyTypes.map(type => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={linearMaterialOptions}
                      getOptionLabel={(opt) => opt.label}
                      value={linearMaterialOptions.find(o => o.id === selectedLinearMaterialId) || null}
                      onChange={(_, newValue) => {
                        setSelectedLinearMaterialId(newValue?.id || null)
                        if (newValue) {
                          // Prefill dimension B with width when selecting a worktop
                          const lm = linearMaterials.find(l => l.id === newValue.id)
                          if (lm?.width !== undefined && lm?.width !== null) {
                            const widthStr = lm.width.toString()
                            setDimensionB(widthStr)
                          }
                          // Prefill dimension C for Hossztoldás: C = A - material.length
                          if (assemblyType === 'Hossztoldás' && lm?.length !== undefined && lm?.length !== null) {
                            const aValue = parseFloat(dimensionA) || 0
                            if (aValue > 0) {
                              const cValue = Math.max(0, aValue - lm.length)
                              setDimensionC(cValue.toString())
                            }
                          }
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Munkalap típusa"
                          size="small"
                          placeholder="Válasszon munkalapot"
                        />
                      )}
                    />
                  </Grid>

                  {/* Row 2: Edge banding and color choice */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Élzáró anyaga:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {(['LAM', 'ABS', 'Nincs élzáró'] as const).map(val => (
                        <FormControlLabel
                          key={val}
                          control={
                            <Radio
                              checked={edgeBanding === val}
                              onChange={() => {
                                setEdgeBanding(val)
                                // Clear all edge position checkboxes when "Nincs élzáró" is selected
                                if (val === 'Nincs élzáró') {
                                  setEdgePosition1(false)
                                  setEdgePosition2(false)
                                  setEdgePosition3(false)
                                  setEdgePosition4(false)
                                  setEdgePosition5(false)
                                  setEdgePosition6(false)
                                }
                              }}
                            />
                          }
                          label={val}
                        />
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Élzáró színe
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      {(['Színazonos', 'Egyéb szín'] as const).map(val => (
                        <FormControlLabel
                          key={val}
                          control={
                            <Radio
                              checked={edgeColorChoice === val}
                              onChange={() => setEdgeColorChoice(val)}
                              disabled={edgeBanding === 'Nincs élzáró'}
                            />
                          }
                          label={val}
                        />
                      ))}
                      {edgeColorChoice === 'Egyéb szín' && edgeBanding !== 'Nincs élzáró' && (
                        <TextField
                          size="small"
                          label="Egyéb szín megnevezése"
                          value={edgeColorText}
                          onChange={(e) => setEdgeColorText(e.target.value)}
                          sx={{ minWidth: 240 }}
                        />
                      )}
                    </Box>
                  </Grid>

                  {/* Row 3: Postforming and Edge Position */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Postforming:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={noPostformingEdge}
                            onChange={(e) => {
                              setNoPostformingEdge(e.target.checked)
                              // If checked, automatically select ABS for élzáró anyaga
                              if (e.target.checked) {
                                setEdgeBanding('ABS')
                              }
                              // For Levágás: clear 4. oldal élzáró pozíció when unchecked (postforming allowed)
                              if (!e.target.checked && assemblyType === 'Levágás') {
                                setEdgePosition4(false)
                              }
                              // For Összemarás: clear 4. oldal and 5. oldal when unchecked (postforming allowed)
                              if (!e.target.checked && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')) {
                                setEdgePosition4(false)
                                setEdgePosition5(false)
                              }
                              // Re-validate B and D for Összemarás Balos when noPostformingEdge changes
                              if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
                                const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                if (selectedMaterial) {
                                  const materialWidth = selectedMaterial.width || 0
                                  const bValue = parseFloat(dimensionB) || 0
                                  const dValue = parseFloat(dimensionD) || 0
                                  
                                  if (e.target.checked) {
                                    const maxB = materialWidth - 10
                                    const maxD = materialWidth - 10
                                    if (bValue > 0 && bValue > maxB) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                    if (dValue > 0 && dValue > maxD) {
                                      toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxD}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                  }
                                }
                              }
                              
                              // Re-validate B and D for Összemarás jobbos when noPostformingEdge changes
                              if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
                                const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                if (selectedMaterial) {
                                  const materialWidth = selectedMaterial.width || 0
                                  const bValue = parseFloat(dimensionB) || 0
                                  const dValue = parseFloat(dimensionD) || 0
                                  
                                  if (e.target.checked) {
                                    const maxB = materialWidth - 10
                                    const maxD = materialWidth - 10
                                    if (bValue > 0 && bValue > maxB) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                    if (dValue > 0 && dValue > maxD) {
                                      toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxD}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        }
                        label="Ne maradjon postfroming él"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Élzáró pozíció
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition1}
                              onChange={(e) => {
                                // If checking and edgeBanding is 'Nincs élzáró', reset to 'ABS'
                                if (e.target.checked && edgeBanding === 'Nincs élzáró') {
                                  setEdgeBanding('ABS')
                                }
                                setEdgePosition1(e.target.checked)
                              }}
                            />
                          }
                          label="1. oldal"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition2}
                              onChange={(e) => {
                                // If checking and edgeBanding is 'Nincs élzáró', reset to 'ABS'
                                if (e.target.checked && edgeBanding === 'Nincs élzáró') {
                                  setEdgeBanding('ABS')
                                }
                                setEdgePosition2(e.target.checked)
                              }}
                            />
                          }
                          label="2. oldal"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition3}
                              onChange={(e) => {
                                // If checking and edgeBanding is 'Nincs élzáró', reset to 'ABS'
                                if (e.target.checked && edgeBanding === 'Nincs élzáró') {
                                  setEdgeBanding('ABS')
                                }
                                setEdgePosition3(e.target.checked)
                              }}
                            />
                          }
                          label="3. oldal"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition4}
                              onChange={(e) => {
                                // If checking and edgeBanding is 'Nincs élzáró', reset to 'ABS'
                                if (e.target.checked && edgeBanding === 'Nincs élzáró') {
                                  setEdgeBanding('ABS')
                                }
                                setEdgePosition4(e.target.checked)
                              }}
                              disabled={!noPostformingEdge}
                            />
                          }
                          label="4. oldal"
                        />
                      </Grid>
                      {/* 5. oldal and 6. oldal - only for Összemarás Balos and Összemarás jobbos */}
                      {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && (
                        <>
                          <Grid item xs={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={edgePosition5}
                                  onChange={(e) => {
                                    // If checking and edgeBanding is 'Nincs élzáró', reset to 'ABS'
                                    if (e.target.checked && edgeBanding === 'Nincs élzáró') {
                                      setEdgeBanding('ABS')
                                    }
                                    setEdgePosition5(e.target.checked)
                                  }}
                                  disabled={!noPostformingEdge}
                                />
                              }
                              label="5. oldal"
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={edgePosition6}
                                  onChange={(e) => {
                                    // If checking and edgeBanding is 'Nincs élzáró', reset to 'ABS'
                                    if (e.target.checked && edgeBanding === 'Nincs élzáró') {
                                      setEdgeBanding('ABS')
                                    }
                                    setEdgePosition6(e.target.checked)
                                  }}
                                />
                              }
                              label="6. oldal"
                            />
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Grid>
                </Grid>

                {/* Conditional fields per összeállítás típus */}
                {(assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Méretek ({assemblyType})
                        </Typography>
                      </Grid>
                      {/* Helper variable to disable all inputs when no material is selected */}
                      {(() => {
                        const isDisabled = !selectedLinearMaterialId
                        return (
                          <>
                      {/* First row: A, B, C, D - full width */}
                      <Grid item xs={12} sm={assemblyType === 'Levágás' ? 6 : 3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="A (mm)"
                          type="number"
                          value={dimensionA}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newValue = e.target.value
                            setDimensionA(newValue)
                            
                            // Validation for Levágás: A must be less than material length
                            if (assemblyType === 'Levágás' && selectedLinearMaterialId) {
                              const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (selectedMaterial) {
                                const materialLength = selectedMaterial.length || 0
                                const aValue = parseFloat(newValue) || 0
                                if (aValue > 0 && aValue >= materialLength) {
                                  toast.error(`Az A méret (${aValue}mm) kisebb kell legyen, mint a munkalap hossza (${materialLength}mm)!`)
                                }
                              }
                            }
                            
                            // Validation for Összemarás Balos: A <= material length
                            if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
                              const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (selectedMaterial) {
                                const materialLength = selectedMaterial.length || 0
                                const aValue = parseFloat(newValue) || 0
                                if (aValue > 0 && aValue > materialLength) {
                                  toast.error(`Az A méret (${aValue}mm) nem lehet nagyobb, mint a munkalap hossza (${materialLength}mm)!`)
                                }
                              }
                            }
                            
                            // Validation for Összemarás jobbos: (A - D) <= material length - 50
                            if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
                              const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (selectedMaterial) {
                                const materialLength = selectedMaterial.length || 0
                                const aValue = parseFloat(newValue) || 0
                                const dValue = parseFloat(dimensionD) || 0
                                const maxAD = materialLength - 50
                                if (aValue > 0 && dValue > 0 && (aValue - dValue) > maxAD) {
                                  toast.error(`Az (A - D) érték (${aValue - dValue}mm) nem lehet nagyobb, mint a munkalap hossza mínusz 50mm (${maxAD}mm) marás ráhagyás okán!`)
                                }
                              }
                            }
                            
                            // Prefill C for Hossztoldás: C = A - material.length
                            if (assemblyType === 'Hossztoldás' && selectedLinearMaterialId) {
                              const lm = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (lm?.length !== undefined && lm?.length !== null) {
                                const aValue = parseFloat(newValue) || 0
                                if (aValue > 0) {
                                  const cValue = Math.max(0, aValue - lm.length)
                                  setDimensionC(cValue.toString())
                                } else {
                                  setDimensionC('')
                                }
                              }
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={assemblyType === 'Levágás' ? 6 : 3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="B (mm)"
                          type="number"
                          value={dimensionB}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newValue = e.target.value
                            setDimensionB(newValue)
                            
                            // Validation for Levágás: B must be less than or equal to material width
                            // If noPostformingEdge is checked, B must be less than material width - 10
                            if (assemblyType === 'Levágás' && selectedLinearMaterialId) {
                              const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (selectedMaterial) {
                                const materialWidth = selectedMaterial.width || 0
                                const bValue = parseFloat(newValue) || 0
                                
                                if (bValue > 0) {
                                  if (noPostformingEdge) {
                                    const maxB = materialWidth - 10
                                    if (bValue >= maxB) {
                                      toast.error(`A B méret (${bValue}mm) kisebb kell legyen, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                  } else {
                                    // B can be equal to material width
                                    if (bValue > materialWidth) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                                    }
                                  }
                                }
                              }
                            }
                            
                            // Validation for Összemarás Balos: B <= material width (if noPostformingEdge checked, B <= width - 10)
                            if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
                              const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (selectedMaterial) {
                                const materialWidth = selectedMaterial.width || 0
                                const bValue = parseFloat(newValue) || 0
                                
                                if (bValue > 0) {
                                  if (noPostformingEdge) {
                                    const maxB = materialWidth - 10
                                    if (bValue > maxB) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                  } else {
                                    if (bValue > materialWidth) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                                    }
                                  }
                                }
                              }
                            }
                            
                            // Validation for Összemarás jobbos: B <= material width (if noPostformingEdge checked, B <= width - 10)
                            if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
                              const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (selectedMaterial) {
                                const materialWidth = selectedMaterial.width || 0
                                const bValue = parseFloat(newValue) || 0
                                
                                if (bValue > 0) {
                                  if (noPostformingEdge) {
                                    const maxB = materialWidth - 10
                                    if (bValue > maxB) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxB}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                    }
                                  } else {
                                    if (bValue > materialWidth) {
                                      toast.error(`A B méret (${bValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                                    }
                                  }
                                }
                              }
                            }
                            
                            // Re-validate rounding values when B changes (for Levágás only)
                            if (assemblyType === 'Levágás') {
                              validateRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, newValue, true)
                            }
                            
                            // Re-validate rounding values when B changes (for Összemarás Balos)
                            if (assemblyType === 'Összemarás Balos') {
                              validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, newValue, dimensionD, true)
                            }
                            
                            // Re-validate rounding values when B changes (for Összemarás jobbos)
                            if (assemblyType === 'Összemarás jobbos') {
                              validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, newValue, dimensionD, true)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      {assemblyType !== 'Levágás' && (
                        <>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              size="small"
                              label="C (mm)"
                              type="number"
                              value={dimensionC}
                              disabled={isDisabled}
                              onChange={(e) => {
                                const newValue = e.target.value
                                setDimensionC(newValue)
                                
                                // Validation for Összemarás Balos: (C - D) <= material length - 50 (Marás ráhagyás okán)
                                if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
                                  const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                  if (selectedMaterial) {
                                    const materialLength = selectedMaterial.length || 0
                                    const maxCD = materialLength - 50
                                    const cValue = parseFloat(newValue) || 0
                                    const dValue = parseFloat(dimensionD) || 0
                                    if (cValue > 0 && dValue > 0 && (cValue - dValue) > maxCD) {
                                      toast.error(`A (C - D) érték (${cValue - dValue}mm) nem lehet nagyobb, mint a munkalap hossza mínusz 50mm (${maxCD}mm) marás ráhagyás okán!`)
                                    }
                                  }
                                }
                                
                                // Validation for Összemarás jobbos: C <= material length
                                if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
                                  const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                  if (selectedMaterial) {
                                    const materialLength = selectedMaterial.length || 0
                                    const cValue = parseFloat(newValue) || 0
                                    if (cValue > 0 && cValue > materialLength) {
                                      toast.error(`A C méret (${cValue}mm) nem lehet nagyobb, mint a munkalap hossza (${materialLength}mm)!`)
                                    }
                                  }
                                }
                              }}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              size="small"
                              label="D (mm)"
                              type="number"
                              value={dimensionD}
                              disabled={isDisabled}
                              onChange={(e) => {
                                const newValue = e.target.value
                                setDimensionD(newValue)
                                
                                // Validation for Összemarás Balos: D <= material width (if noPostformingEdge checked, D <= width - 10)
                                if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
                                  const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                  if (selectedMaterial) {
                                    const materialWidth = selectedMaterial.width || 0
                                    const dValue = parseFloat(newValue) || 0
                                    
                                    if (dValue > 0) {
                                      if (noPostformingEdge) {
                                        const maxD = materialWidth - 10
                                        if (dValue > maxD) {
                                          toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxD}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                        }
                                      } else {
                                        if (dValue > materialWidth) {
                                          toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                                        }
                                      }
                                    }
                                  }
                                }
                                
                                // Validation for Összemarás jobbos: D <= material width (if noPostformingEdge checked, D <= width - 10)
                                if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
                                  const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                  if (selectedMaterial) {
                                    const materialWidth = selectedMaterial.width || 0
                                    const dValue = parseFloat(newValue) || 0
                                    
                                    if (dValue > 0) {
                                      if (noPostformingEdge) {
                                        const maxD = materialWidth - 10
                                        if (dValue > maxD) {
                                          toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége mínusz 10mm (${maxD}mm), mert a "Ne maradjon postforming él" be van jelölve!`)
                                        }
                                      } else {
                                        if (dValue > materialWidth) {
                                          toast.error(`A D méret (${dValue}mm) nem lehet nagyobb, mint a munkalap szélessége (${materialWidth}mm)!`)
                                        }
                                      }
                                    }
                                  }
                                }
                                
                                // Re-validate (C - D) for Összemarás Balos when D changes
                                if (assemblyType === 'Összemarás Balos' && selectedLinearMaterialId) {
                                  const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                  if (selectedMaterial) {
                                    const materialLength = selectedMaterial.length || 0
                                    const maxCD = materialLength - 50
                                    const cValue = parseFloat(dimensionC) || 0
                                    const dValue = parseFloat(newValue) || 0
                                    if (cValue > 0 && dValue > 0 && (cValue - dValue) > maxCD) {
                                      toast.error(`A (C - D) érték (${cValue - dValue}mm) nem lehet nagyobb, mint a munkalap hossza mínusz 50mm (${maxCD}mm) marás ráhagyás okán!`)
                                    }
                                  }
                                }
                                
                                // Re-validate (A - D) for Összemarás jobbos when D changes
                                if (assemblyType === 'Összemarás jobbos' && selectedLinearMaterialId) {
                                  const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                                  if (selectedMaterial) {
                                    const materialLength = selectedMaterial.length || 0
                                    const maxAD = materialLength - 50
                                    const aValue = parseFloat(dimensionA) || 0
                                    const dValue = parseFloat(newValue) || 0
                                    if (aValue > 0 && dValue > 0 && (aValue - dValue) > maxAD) {
                                      toast.error(`Az (A - D) érték (${aValue - dValue}mm) nem lehet nagyobb, mint a munkalap hossza mínusz 50mm (${maxAD}mm) marás ráhagyás okán!`)
                                    }
                                  }
                                }
                                
                                // Re-validate rounding values when D changes (for Összemarás Balos)
                                if (assemblyType === 'Összemarás Balos') {
                                  validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, newValue, true)
                                }
                                
                                // Re-validate rounding values when D changes (for Összemarás jobbos)
                                if (assemblyType === 'Összemarás jobbos') {
                                  validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, roundingR4, dimensionB, newValue, true)
                                }
                              }}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                        </>
                      )}
                      {/* E and F for Összemarás U alak - add after D if needed */}
                      {assemblyType === 'Összemarás U alak (Nem működik még)' && (
                        <>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              size="small"
                              label="E (mm)"
                              type="number"
                              value={dimensionE}
                              disabled={isDisabled}
                              onChange={(e) => setDimensionE(e.target.value)}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              size="small"
                              label="F (mm)"
                              type="number"
                              value={dimensionF}
                              disabled={isDisabled}
                              onChange={(e) => setDimensionF(e.target.value)}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                        </>
                      )}
                      
                      {/* Megmunkálások Section */}
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Megmunkálások
                        </Typography>
                      </Grid>
                      
                      {/* Second row: R1, R2, R3, R4 - full width (each 3 columns) */}
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lekerekítés bal oldalon (R1)"
                          type="number"
                          value={roundingR1}
                          onChange={(e) => {
                            const newValue = e.target.value
                            setRoundingR1(newValue)
                            // Clear L1 and L2 when R1 has a value
                            if (parseFloat(newValue) > 0) {
                              setCutL1('')
                              setCutL2('')
                            }
                            // Validate R1 <= B and R1+R3 <= B (for Levágás only)
                            if (assemblyType === 'Levágás') {
                              validateRoundingValues(newValue, roundingR2, roundingR3, roundingR4, dimensionB, true)
                            }
                            // Validate R1 <= D and R3+R1 <= D (for Összemarás Balos)
                            if (assemblyType === 'Összemarás Balos') {
                              validateBalosRoundingValues(newValue, roundingR2, roundingR3, roundingR4, dimensionB, dimensionD, true)
                            }
                            // Validate R1 <= D and R3+R1 <= D (for Összemarás jobbos)
                            if (assemblyType === 'Összemarás jobbos') {
                              validateBalosRoundingValues(newValue, roundingR2, roundingR3, roundingR4, dimensionB, dimensionD, true)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(cutL1) > 0) || !!(parseFloat(cutL2) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lekerekítés jobb oldalon (R2)"
                          type="number"
                          value={roundingR2}
                          onChange={(e) => {
                            const newValue = e.target.value
                            setRoundingR2(newValue)
                            // Clear L3 and L4 when R2 has a value
                            if (parseFloat(newValue) > 0) {
                              setCutL3('')
                              setCutL4('')
                            }
                            // Validate R2 <= B and R2+R4 <= B (for Levágás only)
                            if (assemblyType === 'Levágás') {
                              validateRoundingValues(roundingR1, newValue, roundingR3, roundingR4, dimensionB, true)
                            }
                            // Validate R2 <= B and R2+R4 <= B (for Összemarás Balos)
                            if (assemblyType === 'Összemarás Balos') {
                              validateBalosRoundingValues(roundingR1, newValue, roundingR3, roundingR4, dimensionB, dimensionD, true)
                            }
                            // Validate R2 <= B and R2+R4 <= B (for Összemarás jobbos)
                            if (assemblyType === 'Összemarás jobbos') {
                              validateBalosRoundingValues(roundingR1, newValue, roundingR3, roundingR4, dimensionB, dimensionD, true)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(cutL3) > 0) || !!(parseFloat(cutL4) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lekerekítés bal felső (R3)"
                          type="number"
                          value={roundingR3}
                          onChange={(e) => {
                            const newValue = e.target.value
                            setRoundingR3(newValue)
                            // Clear L5 and L6 when R3 has a value
                            if (parseFloat(newValue) > 0) {
                              setCutL5('')
                              setCutL6('')
                            }
                            // Validate R3 <= B and R1+R3 <= B (for Levágás only)
                            if (assemblyType === 'Levágás') {
                              validateRoundingValues(roundingR1, roundingR2, newValue, roundingR4, dimensionB, true)
                            }
                            // Validate R3 <= D and R3+R1 <= D (for Összemarás Balos)
                            if (assemblyType === 'Összemarás Balos') {
                              validateBalosRoundingValues(roundingR1, roundingR2, newValue, roundingR4, dimensionB, dimensionD, true)
                            }
                            // Validate R3 <= D and R3+R1 <= D (for Összemarás jobbos)
                            if (assemblyType === 'Összemarás jobbos') {
                              validateBalosRoundingValues(roundingR1, roundingR2, newValue, roundingR4, dimensionB, dimensionD, true)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !(assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') || !!(parseFloat(cutL5) > 0) || !!(parseFloat(cutL6) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lekerekítés jobb felső (R4)"
                          type="number"
                          value={roundingR4}
                          onChange={(e) => {
                            const newValue = e.target.value
                            setRoundingR4(newValue)
                            // Clear L7 and L8 when R4 has a value
                            if (parseFloat(newValue) > 0) {
                              setCutL7('')
                              setCutL8('')
                            }
                            // Validate R4 <= B and R2+R4 <= B (for Levágás only)
                            if (assemblyType === 'Levágás') {
                              validateRoundingValues(roundingR1, roundingR2, roundingR3, newValue, dimensionB, true)
                            }
                            // Validate R4 <= B and R2+R4 <= B (for Összemarás Balos)
                            if (assemblyType === 'Összemarás Balos') {
                              validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, newValue, dimensionB, dimensionD, true)
                            }
                            // Validate R4 <= B and R2+R4 <= B (for Összemarás jobbos)
                            if (assemblyType === 'Összemarás jobbos') {
                              validateBalosRoundingValues(roundingR1, roundingR2, roundingR3, newValue, dimensionB, dimensionD, true)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !(assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') || !!(parseFloat(cutL7) > 0) || !!(parseFloat(cutL8) > 0)}
                        />
                      </Grid>
                      {/* Third row: Letörések L1-L8 - all in one row (each 1.5 columns) */}
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L1)"
                          type="number"
                          value={cutL1}
                          onChange={(e) => {
                            setCutL1(e.target.value)
                            // Clear R1 when L1 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR1('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR1) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L2)"
                          type="number"
                          value={cutL2}
                          onChange={(e) => {
                            setCutL2(e.target.value)
                            // Clear R1 when L2 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR1('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR1) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L3)"
                          type="number"
                          value={cutL3}
                          onChange={(e) => {
                            setCutL3(e.target.value)
                            // Clear R2 when L3 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR2('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR2) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L4)"
                          type="number"
                          value={cutL4}
                          onChange={(e) => {
                            setCutL4(e.target.value)
                            // Clear R2 when L4 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR2('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR2) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L5)"
                          type="number"
                          value={cutL5}
                          onChange={(e) => {
                            setCutL5(e.target.value)
                            // Clear R3 when L5 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR3('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR3) > 0) || !(assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L6)"
                          type="number"
                          value={cutL6}
                          onChange={(e) => {
                            setCutL6(e.target.value)
                            // Clear R3 when L6 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR3('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR3) > 0) || !(assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L7)"
                          type="number"
                          value={cutL7}
                          onChange={(e) => {
                            setCutL7(e.target.value)
                            // Clear R4 when L7 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR4('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR4) > 0) || !(assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L8)"
                          type="number"
                          value={cutL8}
                          onChange={(e) => {
                            setCutL8(e.target.value)
                            // Clear R4 when L8 has a value
                            if (parseFloat(e.target.value) > 0) {
                              setRoundingR4('')
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={isDisabled || !!(parseFloat(roundingR4) > 0) || !(assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')}
                        />
                      </Grid>
                      
                      {/* Kivágások Section */}
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Kivágások
                        </Typography>
                        {cutouts.map((cutout, index) => {
                          const aValue = parseFloat(dimensionA) || 0
                          const bValue = parseFloat(dimensionB) || 0
                          const cValue = parseFloat(dimensionC) || 0
                          const dValue = parseFloat(dimensionD) || 0
                          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                          const materialWidth = selectedMaterial?.length || 1
                          const keptWidth = (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && aValue > 0 ? Math.min(aValue, materialWidth) : materialWidth
                          
                          const cutoutWidth = parseFloat(cutout.width) || 0
                          const cutoutHeight = parseFloat(cutout.height) || 0
                          const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                          const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                          
                          // For perpendicular worktop: width/height are swapped after rotation, and dimensions are different
                          let widthError, heightError, positionError
                          if (isPerpendicular) {
                            const rotatedCutoutWidth = cutoutHeight // After rotation, original height becomes width
                            const rotatedCutoutHeight = cutoutWidth // After rotation, original width becomes height
                            widthError = rotatedCutoutWidth >= dValue // D is the width of perpendicular rectangle
                            heightError = rotatedCutoutHeight >= cValue // C is the height of perpendicular rectangle
                            positionError = parseFloat(cutout.distanceFromBottom) + rotatedCutoutWidth > dValue
                          } else {
                            widthError = cutoutWidth >= keptWidth
                            heightError = cutoutHeight >= bValue
                            positionError = distanceFromLeft + cutoutWidth > keptWidth
                          }
                          
                          return (
                            <Box key={cutout.id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  Kivágás {index + 1}
                                </Typography>
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={() => setCutouts(prev => prev.filter(c => c.id !== cutout.id))}
                                  disabled={isDisabled}
                                >
                                  Törlés
                                </Button>
                              </Box>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Szélesség (mm)"
                                    type="number"
                                    value={cutout.width}
                                    disabled={isDisabled}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, width: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                    error={widthError}
                                    helperText={widthError ? (isPerpendicular ? `Szélesség (forgás után) kisebb kell legyen, mint ${dValue}mm` : `Szélesség kisebb kell legyen, mint ${keptWidth}mm`) : ''}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Magasság (mm)"
                                    type="number"
                                    value={cutout.height}
                                    disabled={isDisabled}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, height: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                    error={heightError}
                                    helperText={heightError ? (isPerpendicular ? `Magasság (forgás után) kisebb kell legyen, mint ${cValue}mm` : `Magasság kisebb kell legyen, mint ${bValue}mm`) : ''}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Távolság balról (mm)"
                                    type="number"
                                    value={cutout.distanceFromLeft}
                                    disabled={isDisabled}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, distanceFromLeft: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                    error={positionError}
                                    helperText={positionError ? (isPerpendicular ? `Pozíció + szélesség nem lehet nagyobb, mint ${dValue}mm` : `Pozíció + szélesség nem lehet nagyobb, mint ${keptWidth}mm`) : ''}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Távolság alulról (mm)"
                                    type="number"
                                    value={cutout.distanceFromBottom}
                                    disabled={isDisabled}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, distanceFromBottom: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                  />
                                </Grid>
                                {/* Worktop selection for Összemarás Balos and jobbos */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && (
                                  <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                      select
                                      fullWidth
                                      size="small"
                                      label="Munkalap"
                                      value={cutout.worktopType || 'main'}
                                      disabled={isDisabled}
                                      onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, worktopType: e.target.value as 'main' | 'perpendicular' } : c))}
                                    >
                                      <MenuItem value="main">Fő munkalap</MenuItem>
                                      <MenuItem value="perpendicular">Perpendikuláris munkalap</MenuItem>
                                    </TextField>
                                  </Grid>
                                )}
                              </Grid>
                            </Box>
                          )
                        })}
                        {cutouts.length < 3 && (
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={isDisabled}
                            onClick={() => {
                              setCutouts(prev => [...prev, {
                                id: `cutout-${Date.now()}-${Math.random()}`,
                                width: '',
                                height: '',
                                distanceFromLeft: '',
                                distanceFromBottom: '',
                                worktopType: (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 'main' : undefined
                              }])
                            }}
                            sx={{ mt: 1 }}
                          >
                            Kivágás hozzáadása
                          </Button>
                        )}
                      </Grid>
                          </>
                        )
                      })()}
                    </Grid>
                  </>
                )}

                {/* Save Button */}
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={saveConfiguration}
                    disabled={!areRequiredFieldsFilled()}
                  >
                    {editingConfigId ? 'Mentés' : 'Mentés'}
                  </Button>
                  {editingConfigId && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        setEditingConfigId(null)
                        clearWorktopConfigForm()
                      }}
                      sx={{ ml: 2 }}
                    >
                      Mégse
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Worktop Visualization Card - Only show when both assembly type and material are selected */}
      {assemblyType && selectedLinearMaterialId && (
      <Box sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
                <CardContent sx={{ px: '5px', py: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Munkapult vizualizáció
                </Typography>
                
                <Box
                  sx={{
                    px: 0,
                    py: 3,
                    pb: 4,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    fontFamily: 'monospace',
                    maxWidth: 1400,
                    width: '100%',
                    margin: '0 auto',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Box sx={{ position: 'relative', margin: '0 auto', width: '100%', overflow: 'visible', paddingBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0, flex: '1 1 auto' }}>
                    {selectedLinearMaterialId ? (
                      (() => {
                        const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                        if (!selectedMaterial) {
                          return (
                            <Box
                              sx={{
                                width: '100%',
                                aspectRatio: '1 / 1',
                                border: '1px dashed #ccc',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 200
                              }}
                            >
                              <Typography variant="body2" color="text.secondary">
                                Válasszon munkalapot a vizualizáció megjelenítéséhez
                              </Typography>
                            </Box>
                          )
                        }

                        // Rotate visualization by 90 degrees: display width = material length, height = material width
                        const materialWidth = selectedMaterial.length || 1   // displayed width (rotated)
                        const materialLength = selectedMaterial.width || 1   // displayed height (rotated)
                        
                        // For Hossztoldás: A = full extended length, C = join position
                        // For Levágás: A = cut position
                        // For Összemarás Balos: A = width, B = height (no cutting)
                        const aValue = parseFloat(dimensionA) || 0
                        const bValue = parseFloat(dimensionB) || materialLength // Parse B early for Összemarás Balos
                        const cValue = parseFloat(dimensionC) || 0
                        
                        // Determine actual worktop dimensions based on assembly type
                        let worktopWidth: number
                        let worktopLength: number
                        
                        if (assemblyType === 'Hossztoldás') {
                          // Hossztoldás: A = full extended length, base visualization uses material dimensions
                          // B creates vertical cut from material width (like Levágás)
                          worktopWidth = aValue > 0 ? aValue : materialWidth
                          worktopLength = materialLength  // Use material width as base (same as Levágás)
                        } else if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') {
                          // Összemarás Balos/jobbos/Összemarás: Simple A x B rectangle, no cutting logic
                          worktopWidth = aValue > 0 ? aValue : materialWidth
                          worktopLength = bValue > 0 ? bValue : materialLength
                        } else {
                          // Levágás: use material dimensions, A is cut position
                          worktopWidth = materialWidth
                          worktopLength = materialLength
                        }

                        // Cut position based on A (mm) along displayed width (for Levágás)
                        const cutPosition = assemblyType === 'Levágás' ? aValue : 0
                        const cutPercent = worktopWidth > 0 ? (cutPosition / worktopWidth) * 100 : 0
                        const showCut = assemblyType === 'Levágás' && cutPosition > 0 && cutPosition < worktopWidth
                        
                        // Join position for Hossztoldás only (C value - measured from right edge)
                        // C is measured from right, so join position from left = worktopWidth - cValue
                        // Összemarás balos: no join line, C is just the height of the perpendicular rectangle
                        const joinPosition = assemblyType === 'Hossztoldás' && cValue > 0 ? worktopWidth - cValue : 0
                        const joinPercent = worktopWidth > 0 ? (joinPosition / worktopWidth) * 100 : 0
                        const showJoin = assemblyType === 'Hossztoldás' && cValue > 0 && joinPosition > 0 && joinPosition < worktopWidth
                        
                        // Vertical cut based on B (mm) along displayed height (for Levágás and Hossztoldás only)
                        // Összemarás balos: no cutting, B is just the height of the main rectangle
                        const verticalCutHeight = worktopLength - bValue
                        const verticalCutPercent = worktopLength > 0 ? (verticalCutHeight / worktopLength) * 100 : 0
                        const showVerticalCut = (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') && bValue > 0 && bValue < worktopLength
                        
                        // Perpendicular rectangles for Összemarás types
                        // Simple visualization: no cutting logic
                        // Main worktop: A x B rectangle
                        // Left perpendicular rectangle (Balos/Összemarás): C x D rectangle, perpendicular to main worktop
                        // Right perpendicular rectangle (Összemarás only): E x F rectangle, perpendicular to main worktop
                        const dValue = parseFloat(dimensionD) || 0
                        const eValue = parseFloat(dimensionE) || 0
                        const fValue = parseFloat(dimensionF) || 0
                        const leftPerpendicularRectHeight = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && cValue > 0 ? cValue : 0 // Height = C
                        const leftPerpendicularRectWidth = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && dValue > 0 ? dValue : 0 // Width = D
                        const rightPerpendicularRectHeight = assemblyType === 'Összemarás U alak (Nem működik még)' && eValue > 0 ? eValue : 0 // Height = E
                        const rightPerpendicularRectWidth = assemblyType === 'Összemarás U alak (Nem működik még)' && fValue > 0 ? fValue : 0 // Width = F
                        const showLeftPerpendicularRect = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && cValue > 0 && dValue > 0 && leftPerpendicularRectHeight > 0 && leftPerpendicularRectWidth > 0
                        const showRightPerpendicularRect = assemblyType === 'Összemarás U alak (Nem működik még)' && eValue > 0 && fValue > 0 && rightPerpendicularRectHeight > 0 && rightPerpendicularRectWidth > 0
                        // For backward compatibility, keep showPerpendicularRect for left rectangle
                        const showPerpendicularRect = showLeftPerpendicularRect
                        const isJobbos = assemblyType === 'Összemarás jobbos'
                        const isOsszemaras = assemblyType === 'Összemarás U alak (Nem működik még)'

                        // Calculate rounding: R1/R2 values are in mm
                        // R1 = 100mm means: cut 100mm from bottom-left corner along bottom edge (right), 
                        // cut 100mm up along left edge, connect with 100mm radius arc
                        // For Összemarás balos: R1 applies to perpendicular rectangle's bottom-right corner
                        const r1ValueRaw = parseFloat(roundingR1) || 0
                        const r2ValueRaw = parseFloat(roundingR2) || 0
                        // Effective width for rounding on kept part (left of cut)
                        const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, materialWidth)) : worktopWidth
                        // Effective height for rounding on kept part (bottom of vertical cut)
                        const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, materialLength)) : worktopLength
                        // Use shorter edge until value of B (height), while respecting half of kept width
                        // For Összemarás: R2 applies to right rectangle, not main worktop
                        const r1Value = Math.min(r1ValueRaw, keptWidth / 2, keptHeight)
                        const r2Value = (assemblyType === 'Összemarás U alak (Nem működik még)') ? 0 : Math.min(r2ValueRaw, keptWidth / 2, keptHeight)
                        
                        // For left perpendicular rectangle: R1 applies to its bottom-right corner
                        const leftPerpendicularRectR1 = showLeftPerpendicularRect 
                          ? Math.min(r1ValueRaw, leftPerpendicularRectWidth / 2, leftPerpendicularRectHeight) 
                          : 0
                        // For right perpendicular rectangle: R2 applies to its bottom-left corner
                        const rightPerpendicularRectR2 = showRightPerpendicularRect 
                          ? Math.min(r2ValueRaw, rightPerpendicularRectWidth / 2, rightPerpendicularRectHeight) 
                          : 0
                        
                        // Calculate chamfer values: L1/L2 for bottom-left (or left perpendicular rectangle's bottom-right for Összemarás Balos), L3/L4 for right perpendicular rectangle's bottom-left (Összemarás)
                        const l1Value = parseFloat(cutL1) || 0
                        const l2Value = parseFloat(cutL2) || 0
                        const l3Value = parseFloat(cutL3) || 0
                        const l4Value = parseFloat(cutL4) || 0
                        // For Összemarás Balos/jobbos: L1-L2 applies to left perpendicular rectangle's bottom-right, not main worktop's bottom-left
                        // For Összemarás: L1-L2 applies to left perpendicular rectangle's bottom-right, L3-L4 applies to right perpendicular rectangle's bottom-left
                        const hasL1L2 = l1Value > 0 && l2Value > 0 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos' && assemblyType !== 'Összemarás U alak (Nem működik még)'
                        const hasL3L4 = l3Value > 0 && l4Value > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)'
                        
                        // Calculate top corner rounding: R3 (top-left), R4 (top-right) - only for Levágás, Összemarás Balos, Összemarás jobbos
                        const r3ValueRaw = (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? (parseFloat(roundingR3) || 0) : 0
                        const r4ValueRaw = (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? (parseFloat(roundingR4) || 0) : 0
                        // Top-left rounding: limited by half of worktop width and half of worktop length
                        const r3Value = Math.min(r3ValueRaw, worktopWidth / 2, worktopLength / 2)
                        // Top-right rounding: limited by half of worktop width and half of worktop length
                        const r4Value = Math.min(r4ValueRaw, worktopWidth / 2, worktopLength / 2)
                        
                        // Calculate top corner chamfers: L5/L6 (top-left), L7/L8 (top-right) - only for Levágás, Összemarás Balos, Összemarás jobbos
                        const l5Value = (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? (parseFloat(cutL5) || 0) : 0
                        const l6Value = (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? (parseFloat(cutL6) || 0) : 0
                        const l7Value = (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? (parseFloat(cutL7) || 0) : 0
                        const l8Value = (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? (parseFloat(cutL8) || 0) : 0
                        const hasL5L6 = l5Value > 0 && l6Value > 0 && (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                        const hasL7L8 = l7Value > 0 && l8Value > 0 && (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                        // For left perpendicular rectangle: L1-L2 applies to its bottom-right corner
                        const hasLeftPerpendicularL1L2 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && l1Value > 0 && l2Value > 0
                        // For right perpendicular rectangle: L3-L4 applies to its bottom-left corner
                        const hasRightPerpendicularL3L4 = assemblyType === 'Összemarás U alak (Nem működik még)' && showRightPerpendicularRect && l3Value > 0 && l4Value > 0
                        // For backward compatibility
                        const hasPerpendicularL1L2 = hasLeftPerpendicularL1L2
                        const keptRightEdge = showCut ? cutPosition : worktopWidth

                        // Calculate expanded viewBox to accommodate labels while maintaining aspect ratio
                        // Labels need space: increased padding for left/right to show dimension labels
                        // For Összemarás balos, also need space for perpendicular rectangle (extends down by C-B, right by D)
                        // Also need space for A dimension label on top and C dimension label on left
                        // Need extra space for cutout dimension labels on right side (perpendicular worktop)
                        const maxCutoutIndex = cutouts.length > 0 ? cutouts.length - 1 : 0
                        const rightPaddingForCutouts = maxCutoutIndex * 120 + 200 // Space for perpendicular cutout dimension labels
                        const labelPaddingLeft = (showLeftPerpendicularRect || showRightPerpendicularRect) ? 550 : 400 // Extra space for C/E dimension labels and cutout labels (increased for better spacing from card edge)
                        const labelPaddingRight = Math.max(400, rightPaddingForCutouts) // Extra space for B/F dimension labels and perpendicular cutout labels
                        const labelPaddingTop = (assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') ? 300 : 100 // Extra space for A dimension label
                        const labelPaddingBottom = 150
                        
                        // Total dimensions depend on assembly type
                        let totalWorktopHeight: number
                        let totalWorktopWidth: number
                        
                        if (isJobbos && showLeftPerpendicularRect) {
                          // Összemarás jobbos: perpendicular rectangle at top-left, main worktop attached to its top-right
                          // Total width = leftPerpendicularRectWidth + worktopWidth = D + A
                          // Total height = max(leftPerpendicularRectHeight, worktopLength) = max(C, B)
                          totalWorktopWidth = leftPerpendicularRectWidth + worktopWidth
                          totalWorktopHeight = Math.max(leftPerpendicularRectHeight, worktopLength)
                        } else if (isOsszemaras && showLeftPerpendicularRect && showRightPerpendicularRect) {
                          // Összemarás: U-shape with left and right perpendicular rectangles
                          // Total width = leftPerpendicularRectWidth + worktopWidth + rightPerpendicularRectWidth = D + A + F
                          // Total height = max(worktopLength + leftPerpendicularRectHeight, worktopLength + rightPerpendicularRectHeight) = max(B + C, B + E)
                          totalWorktopWidth = leftPerpendicularRectWidth + worktopWidth + rightPerpendicularRectWidth
                          totalWorktopHeight = Math.max(worktopLength + leftPerpendicularRectHeight, worktopLength + rightPerpendicularRectHeight)
                        } else if (showLeftPerpendicularRect) {
                          // Összemarás Balos: left perpendicular rectangle at bottom-left
                          totalWorktopHeight = worktopLength + leftPerpendicularRectHeight
                          totalWorktopWidth = Math.max(worktopWidth, leftPerpendicularRectWidth)
                        } else if (assemblyType === 'Levágás' && showCut) {
                          // For Levágás: total width is the kept portion (cut position), not full material width
                          totalWorktopHeight = worktopLength
                          totalWorktopWidth = cutPosition
                        } else {
                          totalWorktopHeight = worktopLength
                          totalWorktopWidth = worktopWidth
                        }
                        
                        const expandedWidth = totalWorktopWidth + labelPaddingLeft + labelPaddingRight
                        const expandedHeight = totalWorktopHeight + labelPaddingTop + labelPaddingBottom
                        
                        // Calculate the aspect ratio of the expanded viewBox
                        const expandedAspectRatio = expandedWidth / expandedHeight
                        // For Összemarás balos/jobbos, use total dimensions
                        const worktopAspectRatio = totalWorktopWidth / totalWorktopHeight
                        
                        // Adjust viewBox to maintain worktop aspect ratio
                        let finalViewBoxWidth = expandedWidth
                        let finalViewBoxHeight = expandedHeight
                        
                        // If expanded viewBox is wider than worktop aspect ratio, adjust height
                        if (expandedAspectRatio > worktopAspectRatio) {
                          finalViewBoxHeight = expandedWidth / worktopAspectRatio
                        } else {
                          // If expanded viewBox is taller than worktop aspect ratio, adjust width
                          finalViewBoxWidth = expandedHeight * worktopAspectRatio
                        }
                        
                        // Calculate viewBox offset
                        // For Összemarás: left rectangle starts at X=0, so viewBox should start at -labelPaddingLeft to show it
                        // For other types: center the worktop in the expanded viewBox
                        let viewBoxX: number
                        if (isOsszemaras && showLeftPerpendicularRect) {
                          // For Összemarás: left rectangle is at X=0, so viewBox should start at -labelPaddingLeft
                          viewBoxX = -labelPaddingLeft
                        } else {
                          // Center the worktop in the expanded viewBox
                          viewBoxX = -(finalViewBoxWidth - totalWorktopWidth) / 2
                        }
                        const viewBoxY = -(finalViewBoxHeight - totalWorktopHeight) / 2

                        return (
                          <>
                            {/* Material rectangle (rotated 90 degrees) with rounded corners and cut overlay */}
                          <Box
                            sx={{
                              width: '100%',
                                maxWidth: '100%',
                                aspectRatio: `${finalViewBoxWidth} / ${finalViewBoxHeight}`,
                                position: 'relative',
                                overflow: 'visible',
                                fontFamily: 'monospace',
                                marginBottom: cutouts.some(c => parseFloat(c.distanceFromLeft) > 0 || parseFloat(c.distanceFromBottom) > 0) ? 12 : 3,
                                margin: '0 auto'
                              }}
                            >
                              {/* SVG for rectangle with rounded corners (R1 bottom-left, R2 bottom-right at cut) */}
                              <Box
                                component="svg"
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  zIndex: 1,
                                  overflow: 'visible'
                                }}
                                viewBox={`${viewBoxX} ${viewBoxY} ${finalViewBoxWidth} ${finalViewBoxHeight}`}
                                preserveAspectRatio="xMidYMid meet"
                              >
                                {/* Main rectangle with rounded corners */}
                                <path
                                  d={(() => {
                                    // Effective width for rounding (kept part only)
                                    const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                    
                                    // Effective height for rounding (kept part only - bottom of vertical cut)
                                    const effectiveHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                    
                                    // Clamp radii to half of effective width and up to effective height
                                    // For Összemarás Balos/jobbos: R1 is used for perpendicular rectangle, not main worktop
                                    const r1 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 0 : Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
                                    const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
                                    
                                    // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                    // For Összemarás: main worktop stays at (0, 0), left rectangle extends LEFT from it
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    
                                    // Start position: if vertical cut, start from top of kept portion (bottom of cut)
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Use the already-calculated R3, R4, L5-L6, L7-L8 values from the outer scope
                                    
                                    // Build path: start from top-left of kept portion (offset for jobbos)
                                    // If R3 or L5-L6, start after the rounding/chamfer on the top edge
                                    // For Összemarás Balos/jobbos: R3 and L5-L6 apply to perpendicular rectangle, not main worktop
                                    let path = ''
                                    if (hasL5L6 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
                                      path = `M ${mainWorktopOffsetX + l5Value} ${startY}`
                                    } else if (r3Value > 0 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
                                      path = `M ${mainWorktopOffsetX + r3Value} ${startY}`
                                    } else {
                                      path = `M ${mainWorktopOffsetX} ${startY}`
                                    }
                                    
                                    // Top edge: to top-right (or cut position if horizontal cutting)
                                    // Stop before R4 or L7-L8 if present
                                    const topRightX = showCut ? (mainWorktopOffsetX + cutPosition) : (mainWorktopOffsetX + worktopWidth)
                                    if (hasL7L8) {
                                      path += ` L ${topRightX - l7Value} ${startY}`
                                    } else if (r4Value > 0) {
                                      path += ` L ${topRightX - r4Value} ${startY}`
                                    } else {
                                      path += ` L ${topRightX} ${startY}`
                                    }
                                    
                                    // Top-right corner: R4 rounding or L7-L8 chamfer
                                    if (hasL7L8) {
                                      // L7-L8 chamfer: diagonal line from (topRightX - l7Value, startY) to (topRightX, startY + l8Value)
                                      path += ` L ${topRightX} ${startY + l8Value}`
                                    } else if (r4Value > 0) {
                                      // R4 rounding: arc from top edge to right edge
                                      path += ` Q ${topRightX} ${startY} ${topRightX} ${startY + r4Value}`
                                    }
                                    
                                    // Right edge: if horizontal cutting, stop at cut position; otherwise go to bottom-right
                                    // After L7-L8 or R4, we're at (topRightX, startY + l8Value) or (topRightX, startY + r4Value)
                                    // Continue down the right edge from there
                                    const bottomY = worktopLength // Always go to full bottom
                                    if (showCut) {
                                      // At cut position, go down the right edge
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (cutPosition, worktopLength - l4Value), then diagonal to (cutPosition - l3Value, worktopLength)
                                        path += ` L ${topRightX} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + cutPosition - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${topRightX} ${bottomY - r2}`
                                        // R2 rounding at cut line (bottom-right of kept part)
                                        if (r2 > 0) {
                                          path += ` Q ${topRightX} ${bottomY} ${mainWorktopOffsetX + cutPosition - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${topRightX} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      // No horizontal cut: go to bottom-right
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (worktopWidth, worktopLength - l4Value), then diagonal to (worktopWidth - l3Value, worktopLength)
                                        path += ` L ${topRightX} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + worktopWidth - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${topRightX} ${bottomY - r2}`
                                        // R2 rounding at full width
                                        if (r2 > 0) {
                                          path += ` Q ${topRightX} ${bottomY} ${mainWorktopOffsetX + worktopWidth - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${topRightX} ${bottomY}`
                                        }
                                      }
                                    }
                                    
                                    // Bottom edge: to bottom-left
                                    if (hasL1L2) {
                                      // L1/L2 chamfer: go to (l1Value, materialLength) then diagonal to (0, materialLength - l2Value)
                                      path += ` L ${mainWorktopOffsetX + l1Value} ${bottomY}`
                                      path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX + r1} ${bottomY}`
                                      // R1 rounding (bottom-left)
                                      if (r1 > 0) {
                                        path += ` Q ${mainWorktopOffsetX} ${bottomY} ${mainWorktopOffsetX} ${bottomY - r1}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX} ${bottomY}`
                                      }
                                    }
                                    
                                    // Left edge: back to top (or to start of kept portion if vertical cut)
                                    // End before R3 or L5-L6 if present
                                    // For Összemarás Balos/jobbos: R3 and L5-L6 apply to perpendicular rectangle, not main worktop
                                    if (hasL5L6 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
                                      // Left edge goes up to (mainWorktopOffsetX, startY + l6Value)
                                      path += ` L ${mainWorktopOffsetX} ${startY + l6Value}`
                                      // Draw diagonal chamfer line from (mainWorktopOffsetX, startY + l6Value) to (mainWorktopOffsetX + l5Value, startY)
                                      path += ` L ${mainWorktopOffsetX + l5Value} ${startY}`
                                    } else if (r3Value > 0 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
                                      path += ` L ${mainWorktopOffsetX} ${startY + r3Value}`
                                      // Draw arc from left edge to top edge
                                      path += ` Q ${mainWorktopOffsetX} ${startY} ${mainWorktopOffsetX + r3Value} ${startY}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX} ${startY}`
                                    }
                                    
                                    // Close path
                                    path += ` Z`
                                    
                                    return path
                                  })()}
                                  fill="#f0f8ff"
                                  stroke="#000"
                                  strokeWidth="3"
                                />
                                
                                {/* Join line for Hossztoldás (dashed vertical line at position C) - only on remaining part */}
                                {showJoin && (() => {
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  return (
                                    <line
                                      x1={joinPosition}
                                      y1={startY}
                                      x2={joinPosition}
                                      y2={bottomY}
                                      stroke="#333"
                                      strokeWidth="3"
                                      strokeDasharray="10,5"
                                      strokeOpacity={0.9}
                                    />
                                  )
                                })()}

                                {/* Left perpendicular rectangle for Összemarás balos (at bottom-left) and jobbos (at top-left) - Simple C x D rectangle with R1 rounding or L1-L2 chamfer at bottom-right corner */}
                                {showLeftPerpendicularRect && (() => {
                                  // For Balos: at bottom-left (0, worktopLength), extends to the right
                                  //   Top-left corner connects to main worktop bottom-left
                                  // For Összemarás: top-LEFT corner connects to main worktop's bottom-LEFT corner
                                  //   Main worktop bottom-left is at (leftPerpendicularRectWidth, worktopLength)
                                  //   So left rectangle's top-LEFT should be at (leftPerpendicularRectWidth, worktopLength)
                                  //   Rectangle extends LEFT from this point
                                  // For jobbos: at top-left (0, 0)
                                  let rectX: number
                                  let rectY: number
                                  
                                  if (isJobbos) {
                                    rectX = 0
                                    rectY = 0
                                  } else {
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength), extends to the right
                                    // EXACTLY the same as Összemarás Balos
                                    rectX = 0
                                    rectY = worktopLength
                                  }
                                  
                                  const rectWidth = leftPerpendicularRectWidth
                                  const rectHeight = leftPerpendicularRectHeight
                                  const r1 = leftPerpendicularRectR1
                                  
                                  // For Összemarás Balos and jobbos: R3 and L5-L6 apply to bottom-left corner of perpendicular rectangle
                                  const hasLeftPerpendicularR3 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && r3ValueRaw > 0
                                  const hasLeftPerpendicularL5L6 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && hasL5L6
                                  const leftPerpendicularRectR3 = hasLeftPerpendicularR3 
                                    ? Math.min(r3ValueRaw, rectWidth / 2, rectHeight / 2) 
                                    : 0
                                  
                                  // Build path with R1 rounding or L1-L2 chamfer at bottom-right, and R3 or L5-L6 at bottom-left (for Balos and jobbos)
                                  // For all types (Balos, jobbos, Összemarás): standard drawing extending to the right
                                  const bottomRightX = rectX + rectWidth
                                  const bottomRightY = rectY + rectHeight
                                  const bottomLeftX = rectX
                                  const bottomLeftY = bottomRightY
                                  
                                  // Build path with R1 rounding or L1-L2 chamfer at bottom-right, and R3 or L5-L6 at bottom-left (for Balos and jobbos)
                                  // For all types (Balos, jobbos, Összemarás): standard drawing extending to the right
                                  let path = ''
                                  
                                  // Start at top-left
                                  path = `M ${rectX} ${rectY}`
                                  
                                  // Top edge: to top-right
                                  path += ` L ${bottomRightX} ${rectY}`
                                  
                                  // Right edge: down to bottom-right corner (with L1-L2 chamfer or R1 rounding)
                                  if (hasLeftPerpendicularL1L2) {
                                    path += ` L ${bottomRightX} ${bottomRightY - l2Value}`
                                    path += ` L ${bottomRightX - l1Value} ${bottomRightY}`
                                  } else {
                                    path += ` L ${bottomRightX} ${bottomRightY - r1}`
                                    if (r1 > 0) {
                                      path += ` Q ${bottomRightX} ${bottomRightY} ${bottomRightX - r1} ${bottomRightY}`
                                    } else {
                                      path += ` L ${bottomRightX} ${bottomRightY}`
                                    }
                                  }
                                  
                                  // Bottom edge: to bottom-left (stopping before R3 or L5-L6 if present)
                                  if (hasLeftPerpendicularL5L6) {
                                    // Stop before L5-L6 chamfer
                                    path += ` L ${bottomLeftX + l5Value} ${bottomLeftY}`
                                  } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                    // Stop before R3 rounding
                                    path += ` L ${bottomLeftX + leftPerpendicularRectR3} ${bottomLeftY}`
                                  } else {
                                    path += ` L ${bottomLeftX} ${bottomLeftY}` // Bottom edge to bottom-left
                                  }
                                  
                                  // Bottom-left corner: R3 rounding or L5-L6 chamfer (for Összemarás Balos and jobbos)
                                  if (hasLeftPerpendicularL5L6) {
                                    // L5-L6 chamfer: diagonal line from (bottomLeftX + l5Value, bottomLeftY) to (bottomLeftX, bottomLeftY - l6Value)
                                    path += ` L ${bottomLeftX} ${bottomLeftY - l6Value}`
                                  } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                    // R3 rounding: arc from bottom edge to left edge
                                    path += ` Q ${bottomLeftX} ${bottomLeftY} ${bottomLeftX} ${bottomLeftY - leftPerpendicularRectR3}`
                                  }
                                  
                                  // Left edge: back to top-left (ending before R3 or L5-L6 if present)
                                  if (hasLeftPerpendicularL5L6) {
                                    // Left edge ends at (bottomLeftX, bottomLeftY - l6Value) where chamfer starts
                                    // Already at this point from the chamfer, so go to top-left
                                    path += ` L ${rectX} ${rectY}`
                                  } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                    // Left edge ends at (bottomLeftX, bottomLeftY - leftPerpendicularRectR3) where rounding starts
                                    // Already at this point from the arc, so go to top-left
                                    path += ` L ${rectX} ${rectY}`
                                  } else {
                                    path += ` L ${rectX} ${rectY}` // Left edge back to top-left
                                  }
                                  
                                  path += ` Z` // Close path
                                  
                                  return (
                                    <path
                                      d={path}
                                      fill="#f0f8ff"
                                      stroke="#000"
                                      strokeWidth="3"
                                    />
                                  )
                                })()}

                                {/* Right perpendicular rectangle for Összemarás (at bottom-right) - Simple E x F rectangle with R2 rounding or L3-L4 chamfer at bottom-left corner */}
                                {showRightPerpendicularRect && (() => {
                                  // For Összemarás: top-RIGHT corner connects to main worktop's bottom-RIGHT corner
                                  // Main worktop bottom-right is at (worktopWidth, worktopLength) - no offset
                                  // So right rectangle top-RIGHT should be at (worktopWidth, worktopLength)
                                  // Rectangle extends RIGHT from this point
                                  const topRightX = worktopWidth // Top-right corner (connection point)
                                  const rectY = worktopLength
                                  const rectWidth = rightPerpendicularRectWidth
                                  const rectHeight = rightPerpendicularRectHeight
                                  const r2 = rightPerpendicularRectR2
                                  
                                  // Rectangle extends RIGHT from the connection point
                                  // Top-right corner: (topRightX, rectY) = (mainWorktopOffsetX + worktopWidth, worktopLength)
                                  // Top-left corner: (topRightX - rectWidth, rectY) = (mainWorktopOffsetX + worktopWidth - rectWidth, worktopLength)
                                  // Bottom-left corner: (topRightX - rectWidth, rectY + rectHeight)
                                  // Bottom-right corner: (topRightX, rectY + rectHeight)
                                  // R2 rounding is at bottom-RIGHT corner (the connection point side)
                                  const topLeftX = topRightX - rectWidth
                                  const bottomLeftX = topLeftX
                                  const bottomLeftY = rectY + rectHeight
                                  const bottomRightX = topRightX
                                  const bottomRightY = bottomLeftY
                                  
                                  // Build path with R2 rounding or L3-L4 chamfer at bottom-RIGHT corner
                                  let path = `M ${topRightX} ${rectY}` // Start at top-right (connection point)
                                  path += ` L ${topLeftX} ${rectY}` // Top edge going left
                                  path += ` L ${bottomLeftX} ${bottomLeftY}` // Left edge going down
                                  path += ` L ${bottomRightX} ${bottomRightY}` // Bottom edge going right
                                  
                                  // Bottom-right corner: with L3-L4 chamfer or R2 rounding
                                  if (hasRightPerpendicularL3L4) {
                                    // L3-L4 chamfer at bottom-right corner: go left to (bottomRightX - l3Value, bottomRightY), then diagonal to (bottomRightX, bottomRightY - l4Value)
                                    path = `M ${topRightX} ${rectY}` // Start at top-right (connection point)
                                    path += ` L ${topLeftX} ${rectY}` // Top edge going left
                                    path += ` L ${bottomLeftX} ${bottomLeftY}` // Left edge going down
                                    path += ` L ${bottomRightX - l3Value} ${bottomRightY}` // Bottom edge to where chamfer starts
                                    path += ` L ${bottomRightX} ${bottomRightY - l4Value}` // Diagonal chamfer
                                    path += ` L ${topRightX} ${rectY}` // Right edge back to top-right
                                  } else {
                                    // R2 rounding at bottom-right corner
                                    if (r2 > 0) {
                                      path = `M ${topRightX} ${rectY}` // Start at top-right (connection point)
                                      path += ` L ${topLeftX} ${rectY}` // Top edge going left
                                      path += ` L ${bottomLeftX} ${bottomLeftY}` // Left edge going down
                                      path += ` L ${bottomRightX - r2} ${bottomRightY}` // Bottom edge to where rounding starts
                                      path += ` Q ${bottomRightX} ${bottomRightY} ${bottomRightX} ${bottomRightY - r2}` // R2 rounding arc
                                      path += ` L ${topRightX} ${rectY}` // Right edge back to top-right
                                    } else {
                                      path += ` L ${topRightX} ${rectY}` // Right edge back to top-right
                                    }
                                  }
                                  
                                  path += ` Z` // Close path
                                  
                                  return (
                                    <path
                                      d={path}
                                      fill="#f0f8ff"
                                      stroke="#000"
                                      strokeWidth="3"
                                    />
                                  )
                                })()}

                                {/* Edge highlighting based on Élzáró pozíció checkboxes - uses EXACT same path as worktop border */}
                                {(() => {
                                  // Use the EXACT same path calculation as the worktop border
                                  const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const effectiveHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                  const r1 = Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
                                  const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  const rightEdge = showCut ? cutPosition : worktopWidth
                                  
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  
                                  // For Összemarás Balos and jobbos: R3 and L5-L6 apply to perpendicular rectangle, not main worktop
                                  const hasLeftPerpendicularR3 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && r3ValueRaw > 0
                                  const hasLeftPerpendicularL5L6 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && hasL5L6
                                  const leftPerpendicularRectR3 = hasLeftPerpendicularR3 && showLeftPerpendicularRect
                                    ? Math.min(r3ValueRaw, leftPerpendicularRectWidth / 2, leftPerpendicularRectHeight / 2)
                                    : 0
                                  
                                  // Build the EXACT same path as the worktop border
                                  const buildWorktopBorderPath = () => {
                                    // Top-left corner: R3 rounding or L5-L6 chamfer
                                    const topLeftX = mainWorktopOffsetX
                                    const topLeftY = startY
                                    
                                    // Start path: if there's top-left rounding/chamfer, start after it on the top edge
                                    let path = ''
                                    if (hasL5L6) {
                                      // Top-left chamfer: start at (topLeftX + l5Value, topLeftY) on top edge
                                      path = `M ${topLeftX + l5Value} ${topLeftY}`
                                    } else if (r3Value > 0) {
                                      // Top-left rounding: start at (topLeftX + r3Value, topLeftY) on top edge
                                      path = `M ${topLeftX + r3Value} ${topLeftY}`
                                    } else {
                                      path = `M ${topLeftX} ${topLeftY}`
                                    }
                                    
                                    // Top edge: from top-left to top-right
                                    const topRightX = showCut ? (mainWorktopOffsetX + cutPosition) : (mainWorktopOffsetX + worktopWidth)
                                    const topRightY = startY
                                    
                                    // Continue top edge to top-right corner (stopping before rounding/chamfer)
                                    if (hasL7L8) {
                                      // Stop before top-right chamfer
                                      path += ` L ${topRightX - l7Value} ${topRightY}`
                                    } else if (r4Value > 0) {
                                      // Stop before top-right rounding
                                      path += ` L ${topRightX - r4Value} ${topRightY}`
                                    } else {
                                      path += ` L ${topRightX} ${topRightY}`
                                    }
                                    
                                    // Top-right corner: R4 rounding or L7-L8 chamfer
                                    if (hasL7L8) {
                                      // Top-right chamfer: draw chamfer lines
                                      path += ` L ${topRightX} ${topRightY + l8Value}`
                                    } else if (r4Value > 0) {
                                      // Top-right rounding: draw arc from top edge to right edge
                                      // Control point at corner (topRightX, topRightY), end at (topRightX, topRightY + r4Value) on right edge
                                      path += ` Q ${topRightX} ${topRightY} ${topRightX} ${topRightY + r4Value}`
                                    }
                                    
                                    // Right edge
                                    // For Összemarás: no R2 or L3-L4 on main worktop (they apply to right rectangle)
                                    if (showCut) {
                                      if (hasL3L4) {
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + cutPosition - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
                                        if (r2 > 0) {
                                          path += ` Q ${mainWorktopOffsetX + cutPosition} ${bottomY} ${mainWorktopOffsetX + cutPosition - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      if (hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + worktopWidth - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
                                        if (r2 > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
                                          path += ` Q ${mainWorktopOffsetX + worktopWidth} ${bottomY} ${mainWorktopOffsetX + worktopWidth - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY}`
                                        }
                                      }
                                    }
                                    
                                    // Bottom edge
                                    if (hasL1L2) {
                                      path += ` L ${l1Value} ${bottomY}`
                                      path += ` L 0 ${bottomY - l2Value}`
                                    } else {
                                      path += ` L ${r1} ${bottomY}`
                                      if (r1 > 0) {
                                        path += ` Q 0 ${bottomY} 0 ${bottomY - r1}`
                                      } else {
                                        path += ` L 0 ${bottomY}`
                                      }
                                    }
                                    
                                    // Left edge: from bottom-left to top-left (ending before top-left rounding/chamfer)
                                    if (hasL5L6) {
                                      // Left edge ends at (mainWorktopOffsetX, topLeftY + l6Value) where chamfer starts
                                      path += ` L ${mainWorktopOffsetX} ${topLeftY + l6Value}`
                                      // Draw chamfer lines to connect to top edge
                                      path += ` L ${mainWorktopOffsetX} ${topLeftY}`
                                      path += ` L ${mainWorktopOffsetX + l5Value} ${topLeftY}`
                                    } else if (r3Value > 0) {
                                      // Left edge ends at (mainWorktopOffsetX, topLeftY + r3Value) where rounding starts
                                      path += ` L ${mainWorktopOffsetX} ${topLeftY + r3Value}`
                                      // Draw arc from left edge to top edge
                                      // Control point at corner (topLeftX, topLeftY), end at (topLeftX + r3Value, topLeftY) on top edge
                                      path += ` Q ${topLeftX} ${topLeftY} ${topLeftX + r3Value} ${topLeftY}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX} ${topLeftY}`
                                    }
                                    path += ` Z`
                                    return path
                                  }
                                  
                                  // Edge styling
                                  const edgeColor = '#ff6b6b'
                                  const edgeThickness = 15
                                  const dashArray = "8,4"
                                  const edgeOpacity = 0.7
                                  
                                  // Build individual edge paths
                                  const buildLeftEdgePath = () => {
                                    // For Összemarás jobbos: 1. oldal is the C×D rectangle's left edge
                                    if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                      // Perpendicular rectangle's left edge: from (0, 0) to (0, leftPerpendicularRectHeight)
                                      // For jobbos: R3 and L5-L6 apply to bottom-left corner of perpendicular rectangle
                                      const rectX = 0
                                      const rectY = 0
                                      const rectHeight = leftPerpendicularRectHeight
                                      const bottomY = rectY + rectHeight
                                      
                                      // Start from top of perpendicular rectangle
                                      let path = `M ${rectX} ${rectY}`
                                      
                                      // Continue down the left edge, stopping before R3 or L5-L6 if present
                                      if (hasLeftPerpendicularL5L6) {
                                        // Go down to where L5-L6 chamfer begins on left edge
                                        path += ` L ${rectX} ${bottomY - l6Value}`
                                        // Include the chamfer diagonal line
                                        path += ` L ${rectX + l5Value} ${bottomY}`
                                      } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                        // Go down to where R3 arc begins on left edge
                                        path += ` L ${rectX} ${bottomY - leftPerpendicularRectR3}`
                                        // Include the R3 arc - this draws the rounded corner
                                        // Control point at corner (rectX, bottomY), end at (rectX + leftPerpendicularRectR3, bottomY) on bottom edge
                                        path += ` Q ${rectX} ${bottomY} ${rectX + leftPerpendicularRectR3} ${bottomY}`
                                      } else {
                                        // Go all the way to bottom if no rounding/chamfer
                                        path += ` L ${rectX} ${bottomY}`
                                      }
                                      
                                      return path
                                    }
                                    
                                    // For Összemarás Balos: extend the left edge down the perpendicular rectangle's left edge
                                    if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
                                      // Left edge goes from top to bottom, ending where bottom corner starts
                                      const topLeftX = mainWorktopOffsetX
                                      const topLeftY = startY
                                      
                                      // For Balos: L5-L6 applies to perpendicular rectangle's bottom-left, NOT main worktop's top-left
                                      // So start from top of main worktop
                                      let path = `M ${topLeftX} ${topLeftY}`
                                      
                                      // Continue down the main worktop's left edge
                                      if (hasL1L2) {
                                        // Left edge ends at (mainWorktopOffsetX, bottomY - l2Value) where chamfer starts
                                        path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                      } else {
                                        // Left edge ends at (mainWorktopOffsetX, bottomY - r1) where rounding starts
                                        path += ` L ${mainWorktopOffsetX} ${bottomY - r1}`
                                      }
                                      
                                      // Perpendicular rectangle's left edge: from (0, worktopLength) to (0, worktopLength + leftPerpendicularRectHeight)
                                      // Continue from main worktop's bottom-left corner down the perpendicular rectangle's left edge
                                      const perpendicularRectTopY = worktopLength
                                      const perpendicularRectBottomY = worktopLength + leftPerpendicularRectHeight
                                      path += ` L ${mainWorktopOffsetX} ${perpendicularRectTopY}` // Connect to perpendicular rectangle top
                                      
                                      // For Balos: L5-L6 is on perpendicular rectangle's bottom-left corner
                                      // Include the R3 arc or L5-L6 chamfer in the highlight
                                      if (hasLeftPerpendicularL5L6) {
                                        // Go down to where L5-L6 chamfer begins on left edge
                                        path += ` L ${mainWorktopOffsetX} ${perpendicularRectBottomY - l6Value}`
                                        // Include the chamfer diagonal line
                                        path += ` L ${mainWorktopOffsetX + l5Value} ${perpendicularRectBottomY}`
                                      } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                        // Go down to where R3 arc begins on left edge
                                        path += ` L ${mainWorktopOffsetX} ${perpendicularRectBottomY - leftPerpendicularRectR3}`
                                        // Include the R3 arc - this draws the rounded corner
                                        // Control point at corner (mainWorktopOffsetX, perpendicularRectBottomY), end at (mainWorktopOffsetX + leftPerpendicularRectR3, perpendicularRectBottomY) on bottom edge
                                        path += ` Q ${mainWorktopOffsetX} ${perpendicularRectBottomY} ${mainWorktopOffsetX + leftPerpendicularRectR3} ${perpendicularRectBottomY}`
                                      } else {
                                        // Go all the way to bottom
                                        path += ` L ${mainWorktopOffsetX} ${perpendicularRectBottomY}`
                                      }
                                      
                                      return path
                                    }
                                    
                                    // Default: Left edge goes from top to bottom, ending where bottom corner starts
                                    const topLeftX = mainWorktopOffsetX
                                    const topLeftY = startY
                                    
                                    let path = ''
                                    
                                    // Start at top-left corner, include rounding/chamfer if present
                                    if (hasL5L6) {
                                      // Start at left edge where chamfer begins (L6 position)
                                      // Left edge highlight starts here and goes down, not from the top
                                      path = `M ${topLeftX} ${topLeftY + l6Value}`
                                    } else if (r3Value > 0) {
                                      // Start at left edge where R3 arc begins
                                      path = `M ${topLeftX} ${topLeftY + r3Value}`
                                    } else {
                                      // Start at top-left corner
                                      path = `M ${topLeftX} ${topLeftY}`
                                    }
                                    
                                    // Continue down the left edge
                                    if (hasL1L2) {
                                      // Left edge ends at (mainWorktopOffsetX, bottomY - l2Value) where chamfer starts
                                      path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                    } else {
                                      // Left edge ends at (mainWorktopOffsetX, bottomY - r1) where rounding starts
                                      path += ` L ${mainWorktopOffsetX} ${bottomY - r1}`
                                    }
                                    
                                    return path
                                  }
                                  
                                  const buildTopEdgePath = () => {
                                    // For Összemarás jobbos: 2. oldal includes both perpendicular rectangle's top edge AND main worktop's top edge
                                    if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                      // Combined top edge: from (0, 0) to (leftPerpendicularRectWidth + worktopWidth, 0)
                                      const rectX = 0
                                      const rectY = 0
                                      const rectWidth = leftPerpendicularRectWidth
                                      
                                      // Start from perpendicular rectangle's left edge
                                      let path = `M ${rectX} ${rectY}`
                                      
                                      // Continue to perpendicular rectangle's right edge
                                      path += ` L ${rectX + rectWidth} ${rectY}`
                                      
                                      // Continue to main worktop's top edge (accounting for rounding/chamfer)
                                      const mainWorktopTopLeftX = rectWidth
                                      const mainWorktopTopRightX = rectWidth + (showCut ? cutPosition : worktopWidth)
                                      
                                      // Continue to top-right corner (stopping before rounding/chamfer)
                                      if (hasL7L8) {
                                        // Stop before top-right chamfer
                                        path += ` L ${mainWorktopTopRightX - l7Value} ${rectY}`
                                        // Include the chamfer
                                        path += ` L ${mainWorktopTopRightX} ${rectY + l8Value}`
                                      } else if (r4Value > 0) {
                                        // Stop before top-right rounding
                                        path += ` L ${mainWorktopTopRightX - r4Value} ${rectY}`
                                        // Include the R4 arc
                                        path += ` Q ${mainWorktopTopRightX} ${rectY} ${mainWorktopTopRightX} ${rectY + r4Value}`
                                      } else {
                                        path += ` L ${mainWorktopTopRightX} ${rectY}`
                                      }
                                      
                                      return path
                                    }
                                    
                                    // Default: Top edge of main worktop
                                    const topLeftX = mainWorktopOffsetX
                                    const topLeftY = startY
                                    const topRightX = showCut ? (mainWorktopOffsetX + cutPosition) : (mainWorktopOffsetX + worktopWidth)
                                    const topRightY = startY
                                    
                                    let path = ''
                                    
                                    // Start at top-left, include R3 rounding/chamfer if present
                                    // For highlighting, we want to show the full top edge including rounded corners
                                    // For Összemarás Balos/jobbos: L5-L6 and R3 apply to perpendicular rectangle, NOT main worktop
                                    // For Levágás: R3 and R4 apply to main worktop's top corners - MUST be included in the highlight
                                    if (hasL5L6 && !hasLeftPerpendicularL5L6) {
                                      // Start at left edge where chamfer begins, draw chamfer diagonal to top edge
                                      // Then continue along top edge (the path continues in next section)
                                      path = `M ${topLeftX} ${topLeftY + l6Value}`
                                      // Draw chamfer diagonal to top edge
                                      path += ` L ${topLeftX + l5Value} ${topLeftY}`
                                      // Path now continues along top edge in the next section (no backtracking)
                                    } else if (r3Value > 0 && !hasLeftPerpendicularR3) {
                                      // For Levágás: Start at left edge where R3 arc begins (BELOW the corner), include R3 arc to top edge
                                      // This ensures the rounded corner is fully visible in the highlight
                                      // Control point at corner (topLeftX, topLeftY), end at (topLeftX + r3Value, topLeftY) on top edge
                                      path = `M ${topLeftX} ${topLeftY + r3Value}`
                                      path += ` Q ${topLeftX} ${topLeftY} ${topLeftX + r3Value} ${topLeftY}`
                                    } else {
                                      // Start at top-left corner (for Balos/jobbos, L5-L6/R3 are on perpendicular rectangle, so start at corner)
                                      path = `M ${topLeftX} ${topLeftY}`
                                    }
                                    
                                    // Continue along top edge to top-right corner (stopping before rounding/chamfer)
                                    // For Levágás: Always include R4 rounding if present - MUST be visible in the highlight
                                    if (hasL7L8) {
                                      // Continue to where top-right chamfer begins on top edge
                                      path += ` L ${topRightX - l7Value} ${topRightY}`
                                      // Draw diagonal chamfer line from top edge to right edge
                                      // Chamfer is a diagonal cut from (topRightX - l7Value, topRightY) to (topRightX, topRightY + l8Value)
                                      path += ` L ${topRightX} ${topRightY + l8Value}`
                                    } else if (r4Value > 0) {
                                      // For Levágás: Include the full R4 rounding arc - extend down the right edge to show the complete rounded corner
                                      // Stop before top-right rounding on the top edge
                                      path += ` L ${topRightX - r4Value} ${topRightY}`
                                      // Include the R4 arc - this draws the rounded corner
                                      // Control point at corner (topRightX, topRightY), end at (topRightX, topRightY + r4Value) on right edge
                                      // This ensures the rounded corner is fully visible in the highlight
                                      path += ` Q ${topRightX} ${topRightY} ${topRightX} ${topRightY + r4Value}`
                                    } else {
                                      path += ` L ${topRightX} ${topRightY}`
                                    }
                                    
                                    return path
                                  }
                                  
                                  const buildRightEdgePath = () => {
                                    // Right edge goes from top to bottom, ending where bottom corner starts
                                    const topRightX = mainWorktopOffsetX + rightEdge
                                    const topRightY = startY
                                    
                                    // Start after top-right rounding/chamfer
                                    let startYPos = topRightY
                                    if (hasL7L8) {
                                      startYPos = topRightY + l8Value
                                    } else if (r4Value > 0) {
                                      startYPos = topRightY + r4Value
                                    }
                                    
                                    let path = `M ${topRightX} ${startYPos}`
                                    if (showCut) {
                                      if (hasL3L4) {
                                        // Right edge ends at (cutPosition, bottomY - l4Value) where bottom chamfer starts
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
                                      } else {
                                        // Right edge ends at (cutPosition, bottomY - r2) where bottom rounding starts
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        // Right edge ends at (worktopWidth, bottomY - l4Value) where bottom chamfer starts
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
                                      } else {
                                        // Right edge ends at (worktopWidth, bottomY - r2) where bottom rounding starts
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
                                      }
                                    }
                                    return path
                                  }
                                  
                                  const buildBottomEdgePath = () => {
                                    // Bottom edge includes both left corner (R1 or L1/L2) and right corner (R2 or L3/L4)
                                    // For Összemarás Balos: bottom edge stops at x=D (leftPerpendicularRectWidth) where perpendicular worktop starts
                                    // For Összemarás jobbos: bottom edge is the main worktop's bottom edge (R3 is on perpendicular rectangle, not main worktop)
                                    let path = ''
                                    let bottomEdgeStartX: number
                                    let bottomEdgeEndX: number
                                    
                                    if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
                                      // For Összemarás Balos: bottom edge starts at x=D (where perpendicular worktop starts), not at x=0
                                      bottomEdgeStartX = leftPerpendicularRectWidth
                                      bottomEdgeEndX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                    } else {
                                      // For other types: bottom edge starts from left corner
                                      bottomEdgeStartX = mainWorktopOffsetX
                                      bottomEdgeEndX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                    }
                                    
                                    // For Összemarás jobbos: R3 is on perpendicular rectangle's bottom-left, NOT on main worktop's bottom-left
                                    // So the main worktop's bottom edge should NOT include R3 rounding
                                    if (hasL1L2 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
                                      // Start from left edge at bottom (mainWorktopOffsetX, bottomY - l2Value), then chamfer to (mainWorktopOffsetX + l1Value, bottomY)
                                      path = `M ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                      path += ` L ${mainWorktopOffsetX + l1Value} ${bottomY}`
                                    } else if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
                                      // For Összemarás Balos: start at x=D (where perpendicular worktop starts)
                                      path = `M ${bottomEdgeStartX} ${bottomY}`
                                    } else if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                      // For Összemarás jobbos: main worktop's bottom edge starts at its left edge (leftPerpendicularRectWidth)
                                      // R3 is on perpendicular rectangle, not main worktop, so start directly at the left edge
                                      path = `M ${bottomEdgeStartX} ${bottomY}`
                                    } else {
                                      // Start from left edge at bottom (mainWorktopOffsetX, bottomY - r1), then rounding to (mainWorktopOffsetX + r1, bottomY)
                                      // Only if R1 applies to main worktop (not for jobbos where R3 is on perpendicular rectangle)
                                      path = `M ${mainWorktopOffsetX} ${bottomY - r1}`
                                      if (r1 > 0) {
                                        path += ` Q ${mainWorktopOffsetX} ${bottomY} ${mainWorktopOffsetX + r1} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX} ${bottomY}`
                                      }
                                    }
                                    
                                    // Continue to right corner and include it
                                    if (showCut) {
                                      if (hasL3L4) {
                                        // Go to where right chamfer starts, then include the chamfer
                                        path += ` L ${bottomEdgeEndX - l3Value} ${bottomY}`
                                        path += ` L ${bottomEdgeEndX} ${bottomY - l4Value}`
                                      } else {
                                        // Go to where right rounding starts, then include the rounding
                                        if (r2 > 0) {
                                          path += ` L ${bottomEdgeEndX - r2} ${bottomY}`
                                          path += ` Q ${bottomEdgeEndX} ${bottomY} ${bottomEdgeEndX} ${bottomY - r2}`
                                        } else {
                                          path += ` L ${bottomEdgeEndX} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        // Go to where right chamfer starts, then include the chamfer
                                        path += ` L ${bottomEdgeEndX - l3Value} ${bottomY}`
                                        path += ` L ${bottomEdgeEndX} ${bottomY - l4Value}`
                                      } else {
                                        // Go to where right rounding starts, then include the rounding
                                        if (r2 > 0) {
                                          path += ` L ${bottomEdgeEndX - r2} ${bottomY}`
                                          path += ` Q ${bottomEdgeEndX} ${bottomY} ${bottomEdgeEndX} ${bottomY - r2}`
                                        } else {
                                          path += ` L ${bottomEdgeEndX} ${bottomY}`
                                        }
                                      }
                                    }
                                    return path
                                  }
                                  
                                  // Build paths for perpendicular rectangle edges (5. oldal and 6. oldal) for Összemarás Balos and Összemarás jobbos
                                  const buildPerpendicularRightEdgePath = () => {
                                    if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                      // For jobbos: 5. oldal is the C×D rectangle's right edge minus the B value from the top
                                      // Right edge: from (D, B) to (D, C)
                                      const rectX = 0
                                      const rectY = 0
                                      const rectWidth = leftPerpendicularRectWidth
                                      const rectHeight = leftPerpendicularRectHeight
                                      const rightEdgeX = rectX + rectWidth
                                      const bValue = parseFloat(dimensionB) || 0
                                      const startY = rectY + bValue
                                      const endY = rectY + rectHeight
                                      
                                      // Account for R1 rounding at bottom-right corner
                                      const r1 = leftPerpendicularRectR1
                                      
                                      let path = `M ${rightEdgeX} ${startY}`
                                      
                                      if (hasLeftPerpendicularL1L2) {
                                        // L1-L2 chamfer: go down to (rightEdgeX, endY - l2Value), then diagonal to (rightEdgeX - l1Value, endY)
                                        path += ` L ${rightEdgeX} ${endY - l2Value}`
                                        path += ` L ${rightEdgeX - l1Value} ${endY}`
                                      } else {
                                        // R1 rounding: go down to (rightEdgeX, endY - r1), then rounding to (rightEdgeX - r1, endY)
                                        path += ` L ${rightEdgeX} ${endY - r1}`
                                        if (r1 > 0) {
                                          path += ` Q ${rightEdgeX} ${endY} ${rightEdgeX - r1} ${endY}`
                                        } else {
                                          path += ` L ${rightEdgeX} ${endY}`
                                        }
                                      }
                                      
                                      return path
                                    }
                                    
                                    // For Összemarás Balos: Right edge of perpendicular rectangle (C×D): from (leftPerpendicularRectWidth, worktopLength) to (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    // This is the C dimension edge
                                    const rectX = 0
                                    const rectY = worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    const rightEdgeX = rectX + rectWidth
                                    const topY = rectY
                                    const bottomY = rectY + rectHeight
                                    
                                    // Account for R1 rounding at bottom-right corner
                                    const r1 = leftPerpendicularRectR1
                                    let path = `M ${rightEdgeX} ${topY}`
                                    
                                    if (hasLeftPerpendicularL1L2) {
                                      // L1-L2 chamfer: go down to (rightEdgeX, bottomY - l2Value), then diagonal to (rightEdgeX - l1Value, bottomY)
                                      path += ` L ${rightEdgeX} ${bottomY - l2Value}`
                                      path += ` L ${rightEdgeX - l1Value} ${bottomY}`
                                    } else {
                                      // R1 rounding: go down to (rightEdgeX, bottomY - r1), then rounding to (rightEdgeX - r1, bottomY)
                                      path += ` L ${rightEdgeX} ${bottomY - r1}`
                                      if (r1 > 0) {
                                        path += ` Q ${rightEdgeX} ${bottomY} ${rightEdgeX - r1} ${bottomY}`
                                      } else {
                                        path += ` L ${rightEdgeX} ${bottomY}`
                                      }
                                    }
                                    
                                    return path
                                  }
                                  
                                  const buildPerpendicularBottomEdgePath = () => {
                                    if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                      // For jobbos: 6. oldal is the C×D rectangle's bottom D edge
                                      // Bottom edge: from (0, C) to (D, C)
                                      const rectX = 0
                                      const rectY = 0
                                      const rectWidth = leftPerpendicularRectWidth
                                      const rectHeight = leftPerpendicularRectHeight
                                      const bottomY = rectY + rectHeight
                                      const rightEdgeX = rectX + rectWidth
                                      
                                      // Account for R1 rounding at bottom-right corner
                                      const r1 = leftPerpendicularRectR1
                                      
                                      // For Összemarás jobbos: R3 and L5-L6 apply to bottom-left corner of perpendicular rectangle
                                      // Start from where R3 or L5-L6 begins (not from the very left edge)
                                      let path = ''
                                      if (hasLeftPerpendicularL5L6) {
                                        // Start at where L5-L6 chamfer begins on bottom edge
                                        path = `M ${rectX + l5Value} ${bottomY}`
                                      } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                        // Start at where R3 rounding begins on bottom edge (this is the beginning of the R3 arch)
                                        path = `M ${rectX + leftPerpendicularRectR3} ${bottomY}`
                                      } else {
                                        // Start from left edge if no rounding/chamfer
                                        path = `M ${rectX} ${bottomY}`
                                      }
                                      
                                      // Continue to right edge, accounting for R1 rounding or L1-L2 chamfer at bottom-right corner
                                      if (hasLeftPerpendicularL1L2) {
                                        // L1-L2 chamfer: go to (rightEdgeX - l1Value, bottomY), then diagonal to (rightEdgeX, bottomY - l2Value)
                                        path += ` L ${rightEdgeX - l1Value} ${bottomY}`
                                        path += ` L ${rightEdgeX} ${bottomY - l2Value}`
                                      } else {
                                        // R1 rounding: go to (rightEdgeX - r1, bottomY), then rounding to (rightEdgeX, bottomY - r1)
                                        path += ` L ${rightEdgeX - r1} ${bottomY}`
                                        if (r1 > 0) {
                                          path += ` Q ${rightEdgeX} ${bottomY} ${rightEdgeX} ${bottomY - r1}`
                                        } else {
                                          path += ` L ${rightEdgeX} ${bottomY}`
                                        }
                                      }
                                      
                                      return path
                                    }
                                    
                                    // For Összemarás Balos: Bottom edge of perpendicular rectangle (C×D): from (0, worktopLength + leftPerpendicularRectHeight) to (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    // This is the D dimension edge
                                    const rectX = 0
                                    const rectY = worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    const bottomY = rectY + rectHeight
                                    const rightEdgeX = rectX + rectWidth
                                    
                                    // Account for R1 rounding at bottom-right corner
                                    const r1 = leftPerpendicularRectR1
                                    
                                    // For Összemarás Balos: R3 and L5-L6 apply to bottom-left corner of perpendicular rectangle
                                    // Start from where R3 or L5-L6 begins (not from the very left edge)
                                    let path = ''
                                    if (hasLeftPerpendicularL5L6) {
                                      // Start at where L5-L6 chamfer begins on bottom edge
                                      path = `M ${rectX + l5Value} ${bottomY}`
                                    } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
                                      // Start at where R3 rounding begins on bottom edge (this is the beginning of the R3 arch)
                                      path = `M ${rectX + leftPerpendicularRectR3} ${bottomY}`
                                    } else {
                                      // Start from left edge if no rounding/chamfer
                                      path = `M ${rectX} ${bottomY}`
                                    }
                                    
                                    // Continue to right edge, accounting for R1 rounding or L1-L2 chamfer at bottom-right corner
                                    if (hasLeftPerpendicularL1L2) {
                                      // L1-L2 chamfer: go to (rightEdgeX - l1Value, bottomY), then diagonal to (rightEdgeX, bottomY - l2Value)
                                      path += ` L ${rightEdgeX - l1Value} ${bottomY}`
                                      path += ` L ${rightEdgeX} ${bottomY - l2Value}`
                                    } else {
                                      // R1 rounding: go to (rightEdgeX - r1, bottomY), then rounding to (rightEdgeX, bottomY - r1)
                                      path += ` L ${rightEdgeX - r1} ${bottomY}`
                                      if (r1 > 0) {
                                        path += ` Q ${rightEdgeX} ${bottomY} ${rightEdgeX} ${bottomY - r1}`
                                      } else {
                                        path += ` L ${rightEdgeX} ${bottomY}`
                                      }
                                    }
                                    
                                    return path
                                  }
                                  
                                  return (
                                    <>
                                      {/* 1. oldal - Left edge */}
                                      {edgePosition1 && (
                                        <path
                                          d={buildLeftEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 2. oldal - Top edge */}
                                      {edgePosition2 && (
                                        <path
                                          d={buildTopEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 3. oldal - Right edge */}
                                      {edgePosition3 && (
                                        <path
                                          d={buildRightEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 4. oldal - Bottom edge */}
                                      {edgePosition4 && (
                                        <path
                                          d={buildBottomEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 5. oldal - Perpendicular rectangle right edge (C dimension) - for Összemarás Balos and Összemarás jobbos */}
                                      {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && edgePosition5 && (
                                        <path
                                          d={buildPerpendicularRightEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 6. oldal - Perpendicular rectangle bottom edge (D dimension) - for Összemarás Balos and Összemarás jobbos */}
                                      {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && edgePosition6 && (
                                        <path
                                          d={buildPerpendicularBottomEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                    </>
                                  )
                                })()}
                                
                                {/* Cutouts - red outlined rectangles with crossed out pattern */}
                                {cutouts.map((cutout, index) => {
                                  const cutoutWidth = parseFloat(cutout.width) || 0
                                  const cutoutHeight = parseFloat(cutout.height) || 0
                                  const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                                  const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
                                  const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                                  
                                  // Only show if valid and on kept side
                                  if (cutoutWidth <= 0 || cutoutHeight <= 0) return null
                                  
                                  if (isPerpendicular && showLeftPerpendicularRect) {
                                    // Cutout on perpendicular rectangle - rotated 90 degrees clockwise
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength)
                                    // For jobbos: at top-left (0, 0)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    
                                    // For perpendicular rectangle: 
                                    // distanceFromBottom (távolság alulról) = distance from RIGHT edge of perpendicular worktop
                                    // distanceFromLeft (távolság balról) = distance from BOTTOM edge of perpendicular worktop
                                    
                                    // After 90° clockwise rotation:
                                    // - Original width becomes visual height
                                    // - Original height becomes visual width
                                    // - Visual right edge = original bottom edge
                                    // - Visual bottom edge = original left edge
                                    
                                    // The visual dimensions after 90° clockwise rotation:
                                    // Original width becomes visual height, original height becomes visual width
                                    const visualWidth = cutoutHeight // After rotation, this is the visual width
                                    const visualHeight = cutoutWidth // After rotation, this is the visual height
                                    
                                    // Where the visual edges should be positioned:
                                    const visualRightEdgeX = rectX + rectWidth - distanceFromBottom
                                    const visualBottomEdgeY = rectY + rectHeight - distanceFromLeft
                                    const visualLeftEdgeX = visualRightEdgeX - visualWidth
                                    const visualTopEdgeY = visualBottomEdgeY - visualHeight
                                    
                                    // After 90° clockwise rotation around center (cx, cy):
                                    // The transformation is: (x', y') = (cy - y + cx, x - cx + cy)
                                    // Working backwards: if visual point is (vx, vy), original point is:
                                    // x = vy - cy + cx, y = cy - vx + cx
                                    
                                    // For the visual bottom-left corner (visualLeftEdgeX, visualBottomEdgeY):
                                    // This corresponds to the original top-left corner
                                    // So: original x = visualBottomEdgeY - centerY + centerX
                                    //     original y = centerY - visualLeftEdgeX + centerX
                                    
                                    // But we don't know center yet. Let's use a different approach:
                                    // The center after rotation is at the midpoint of the visual rectangle
                                    const visualCenterX = (visualLeftEdgeX + visualRightEdgeX) / 2
                                    const visualCenterY = (visualTopEdgeY + visualBottomEdgeY) / 2
                                    
                                    // The center doesn't move during rotation, so:
                                    const centerX = visualCenterX
                                    const centerY = visualCenterY
                                    
                                    // Now calculate original position:
                                    // Original rectangle dimensions (before rotation):
                                    const originalWidth = cutoutWidth   // Original width
                                    const originalHeight = cutoutHeight // Original height
                                    
                                    // Original center is at (centerX, centerY), so:
                                    const x = centerX - originalWidth / 2
                                    const y = centerY - originalHeight / 2
                                    
                                    // Check if cutout fits within perpendicular rectangle (using visual dimensions)
                                    if (distanceFromBottom + visualWidth > rectWidth) return null
                                    if (distanceFromLeft + visualHeight > rectHeight) return null
                                    
                                    return (
                                      <g key={cutout.id} transform={`rotate(90 ${centerX} ${centerY})`}>
                                        {/* Red outlined rectangle - use swapped dimensions, rotation will make it correct */}
                                        <rect
                                          x={x}
                                          y={y}
                                          width={originalWidth}
                                          height={originalHeight}
                                          fill="rgba(255, 107, 107, 0.1)"
                                          stroke="#ff6b6b"
                                          strokeWidth="2"
                                        />
                                        {/* Diagonal cross lines */}
                                        <line
                                          x1={x}
                                          y1={y}
                                          x2={x + originalWidth}
                                          y2={y + originalHeight}
                                          stroke="#ff6b6b"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={x + originalWidth}
                                          y1={y}
                                          x2={x}
                                          y2={y + originalHeight}
                                          stroke="#ff6b6b"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension label - centered in cutout, rotated -90 degrees to flip it back to readable orientation */}
                                        <text
                                          x={centerX}
                                          y={centerY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${centerX} ${centerY})`}
                                          style={{
                                            fontSize: '60px',
                                            fontWeight: 600,
                                            fill: '#333',
                                            pointerEvents: 'none',
                                            fontFamily: 'monospace'
                                          }}
                                        >
                                          <tspan x={centerX} dy="-0.3em">Kivágás {index + 1}</tspan>
                                          <tspan x={centerX} dy="1.2em">{cutoutWidth}×{cutoutHeight}</tspan>
                                        </text>
                                      </g>
                                    )
                                  } else {
                                    // Cutout on main worktop (normal placement)
                                    // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                    // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth (to make room for left rectangle)
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                               (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                    const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Check if cutout fits within kept portion horizontally
                                  if (distanceFromLeft + cutoutWidth > keptWidth) return null
                                  
                                    // Check if cutout fits within kept portion vertically (distanceFromBottom should be within keptHeight)
                                    if (distanceFromBottom + cutoutHeight > keptHeight) return null
                                    
                                    // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
                                    const x = mainWorktopOffsetX + distanceFromLeft
                                    const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
                                  
                                  // Don't render if outside bounds
                                    if (x < mainWorktopOffsetX || y < startY || x + cutoutWidth > mainWorktopOffsetX + keptWidth || y + cutoutHeight > worktopLength) return null
                                    
                                    // Calculate exact center coordinates of the cutout rectangle
                                    const centerX = x + cutoutWidth / 2
                                    const centerY = y + cutoutHeight / 2
                                  
                                  return (
                                    <g key={cutout.id}>
                                      {/* Red outlined rectangle */}
                                      <rect
                                        x={x}
                                        y={y}
                                        width={cutoutWidth}
                                        height={cutoutHeight}
                                        fill="rgba(255, 107, 107, 0.1)"
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                      />
                                      {/* Diagonal cross lines */}
                                      <line
                                        x1={x}
                                        y1={y}
                                        x2={x + cutoutWidth}
                                        y2={y + cutoutHeight}
                                        stroke="#ff6b6b"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={x + cutoutWidth}
                                        y1={y}
                                        x2={x}
                                        y2={y + cutoutHeight}
                                        stroke="#ff6b6b"
                                        strokeWidth="1.5"
                                      />
                                        {/* Dimension label - centered in cutout */}
                                        <text
                                          x={centerX}
                                          y={centerY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '60px',
                                            fontWeight: 600,
                                            fill: '#333',
                                            pointerEvents: 'none',
                                            fontFamily: 'monospace'
                                          }}
                                        >
                                          <tspan x={centerX} dy="-0.3em">Kivágás {index + 1}</tspan>
                                          <tspan x={centerX} dy="1.2em">{cutoutWidth}×{cutoutHeight}</tspan>
                                        </text>
                                    </g>
                                  )
                                  }
                                })}
                              
                                {/* Cutout position dimension labels - ISO standard dimensioning */}
                                {cutouts.map((cutout, index) => {
                                const cutoutWidth = parseFloat(cutout.width) || 0
                                const cutoutHeight = parseFloat(cutout.height) || 0
                                const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                                const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
                                  const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                                
                                  // Only show if valid
                                if (cutoutWidth <= 0 || cutoutHeight <= 0) return null
                                
                                  if (isPerpendicular && showLeftPerpendicularRect) {
                                    // Cutout dimension labels for perpendicular rectangle
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength)
                                    // For jobbos: at top-left (0, 0)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    
                                    // The visual dimensions after 90° clockwise rotation:
                                    const visualWidth = cutoutHeight // Original height becomes visual width
                                    const visualHeight = cutoutWidth // Original width becomes visual height
                                    
                                    // Where the visual edges are positioned (after rotation):
                                    const visualRightEdgeX = rectX + rectWidth - distanceFromBottom
                                    const visualBottomEdgeY = rectY + rectHeight - distanceFromLeft
                                    const visualLeftEdgeX = visualRightEdgeX - visualWidth
                                    const visualTopEdgeY = visualBottomEdgeY - visualHeight
                                    
                                    // Check if cutout fits
                                    if (distanceFromBottom + visualWidth > rectWidth) return null
                                    if (distanceFromLeft + visualHeight > rectHeight) return null
                                    
                                    // Stack dimension labels in separate rows/columns to avoid overlap
                                    // Horizontal dimension (távolság alulról = distance from RIGHT edge of perpendicular worktop)
                                    // For Balos: show below perpendicular rectangle
                                    // For jobbos: show above perpendicular rectangle
                                    const horizontalRowSpacing = 120
                                    const horizontalBaseOffset = 100
                                    let horizontalDimensionLineY: number
                                    let horizontalLabelY: number
                                    if (isJobbos) {
                                      // For jobbos: show above the perpendicular rectangle (negative Y)
                                      horizontalDimensionLineY = rectY - horizontalBaseOffset - (index * horizontalRowSpacing)
                                      horizontalLabelY = horizontalDimensionLineY - 60
                                    } else {
                                      // For Balos: show below the perpendicular rectangle
                                      horizontalDimensionLineY = rectY + rectHeight + horizontalBaseOffset + (index * horizontalRowSpacing)
                                      horizontalLabelY = horizontalDimensionLineY + 60
                                    }
                                    
                                    // Vertical dimension (távolság balról = distance from BOTTOM edge of perpendicular worktop)
                                    // Show on RIGHT side for both
                                    const verticalColumnSpacing = 120
                                    const verticalBaseOffset = 100
                                    const verticalDimensionLineX = rectX + rectWidth + verticalBaseOffset + (index * verticalColumnSpacing)
                                    const verticalLabelX = verticalDimensionLineX + 50
                                
                                return (
                                      <g key={`cutout-dims-${cutout.id}`}>
                                        {/* Horizontal dimension - távolság alulról (distance from RIGHT edge of perpendicular worktop) */}
                                        <g>
                                          {isJobbos ? (
                                            <>
                                              {/* For jobbos: show above the perpendicular rectangle */}
                                              {/* Extension line from perpendicular worktop's right edge */}
                                              <line
                                                x1={rectX + rectWidth}
                                                y1={rectY}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Extension line from cutout's visual right edge */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={rectY}
                                                x2={visualRightEdgeX}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Dimension line (horizontal, above) */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={horizontalDimensionLineY}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                            </>
                                          ) : (
                                            <>
                                              {/* For Balos: show below the perpendicular rectangle */}
                                              {/* Extension line from perpendicular worktop's right edge */}
                                              <line
                                                x1={rectX + rectWidth}
                                                y1={rectY + rectHeight}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Extension line from cutout's visual right edge */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={rectY + rectHeight}
                                                x2={visualRightEdgeX}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Dimension line (horizontal, below) */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={horizontalDimensionLineY}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                            </>
                                          )}
                                          {/* Label */}
                                          <text
                                            x={(visualRightEdgeX + rectX + rectWidth) / 2}
                                            y={horizontalLabelY}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            style={{
                                              fontSize: '80px',
                                              fontWeight: 500,
                                              fill: '#666',
                                        pointerEvents: 'none'
                                      }}
                                          >
                                            {distanceFromBottom}mm
                                          </text>
                                        </g>
                                        
                                        {/* Vertical dimension - távolság balról (distance from BOTTOM edge of perpendicular worktop) - show on RIGHT side */}
                                        <g>
                                          {/* Extension line from cutout's visual bottom edge */}
                                          <line
                                            x1={rectX + rectWidth}
                                            y1={visualBottomEdgeY}
                                            x2={verticalDimensionLineX}
                                            y2={visualBottomEdgeY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Extension line from perpendicular worktop's bottom edge */}
                                          <line
                                            x1={rectX + rectWidth}
                                            y1={rectY + rectHeight}
                                            x2={verticalDimensionLineX}
                                            y2={rectY + rectHeight}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Dimension line (vertical, on right) */}
                                          <line
                                            x1={verticalDimensionLineX}
                                            y1={visualBottomEdgeY}
                                            x2={verticalDimensionLineX}
                                            y2={rectY + rectHeight}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Label */}
                                          <text
                                            x={verticalLabelX}
                                            y={(visualBottomEdgeY + rectY + rectHeight) / 2}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            transform={`rotate(-90 ${verticalLabelX} ${(visualBottomEdgeY + rectY + rectHeight) / 2})`}
                                            style={{
                                              fontSize: '80px',
                                              fontWeight: 500,
                                              fill: '#666',
                                              pointerEvents: 'none'
                                            }}
                                          >
                                            {distanceFromLeft}mm
                                          </text>
                                        </g>
                                      </g>
                                    )
                                  } else {
                                    // Cutout dimension labels for main worktop
                                    // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                    // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth (to make room for left rectangle)
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                               (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                    const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Check if cutout fits within kept portion
                                    if (distanceFromLeft + cutoutWidth > keptWidth) return null
                                    if (distanceFromBottom + cutoutHeight > keptHeight) return null
                                    
                                    // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
                                    const x = mainWorktopOffsetX + distanceFromLeft
                                    const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
                                    
                                    // Don't render if outside bounds
                                    if (x < mainWorktopOffsetX || y < startY || x + cutoutWidth > mainWorktopOffsetX + keptWidth || y + cutoutHeight > worktopLength) return null
                                    
                                    // Stack dimension labels in separate rows/columns to avoid overlap
                                    // Horizontal dimension (distance from left edge) - stack vertically
                                    const horizontalRowSpacing = 120 // Space between rows
                                    const horizontalBaseOffset = 100 // Base distance from bottom
                                    const horizontalDimensionLineY = worktopLength + horizontalBaseOffset + (index * horizontalRowSpacing)
                                    const horizontalLabelY = horizontalDimensionLineY + 60
                                    
                                    // Vertical dimension (distance from bottom) - stack horizontally
                                    const verticalColumnSpacing = 120 // Space between columns
                                    const verticalBaseOffset = 100 // Base distance from left edge
                                    const verticalDimensionLineX = -(verticalBaseOffset + (index * verticalColumnSpacing))
                                    const verticalLabelX = verticalDimensionLineX - 50
                                    
                                    return (
                                      <g key={`cutout-dims-${cutout.id}`}>
                                        {/* Horizontal dimension - distance from left edge */}
                                        <g>
                                          {/* Extension lines */}
                                          <line
                                            x1={0}
                                            y1={worktopLength}
                                            x2={0}
                                            y2={horizontalDimensionLineY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          <line
                                            x1={x}
                                            y1={worktopLength}
                                            x2={x}
                                            y2={horizontalDimensionLineY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Dimension line */}
                                          <line
                                            x1={0}
                                            y1={horizontalDimensionLineY}
                                            x2={x}
                                            y2={horizontalDimensionLineY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Label */}
                                          <text
                                            x={x / 2}
                                            y={horizontalLabelY}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            style={{
                                              fontSize: '80px',
                                              fontWeight: 500,
                                              fill: '#666',
                                              pointerEvents: 'none'
                                            }}
                                          >
                                            {distanceFromLeft}mm
                                          </text>
                                        </g>
                                        
                                        {/* Vertical dimension - distance from bottom */}
                                        <g>
                                          {/* Extension lines */}
                                          <line
                                            x1={0}
                                            y1={y + cutoutHeight}
                                            x2={verticalDimensionLineX}
                                            y2={y + cutoutHeight}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          <line
                                            x1={0}
                                            y1={worktopLength}
                                            x2={verticalDimensionLineX}
                                            y2={worktopLength}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Dimension line */}
                                          <line
                                            x1={verticalDimensionLineX}
                                            y1={y + cutoutHeight}
                                            x2={verticalDimensionLineX}
                                            y2={worktopLength}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Label */}
                                          <text
                                            x={verticalLabelX}
                                            y={(y + cutoutHeight + worktopLength) / 2}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            transform={`rotate(-90 ${verticalLabelX} ${(y + cutoutHeight + worktopLength) / 2})`}
                                            style={{
                                              fontSize: '80px',
                                              fontWeight: 500,
                                              fill: '#666',
                                              pointerEvents: 'none'
                                            }}
                                          >
                                            {distanceFromBottom}mm
                                          </text>
                                        </g>
                                      </g>
                                    )
                                  }
                                })}
                                
                                {/* L1-L2 chamfer dimension labels (bottom-left corner) - ISO standard dimensioning */}
                                {hasL1L2 && (() => {
                                  const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const bottomY = worktopLength
                                  
                                  // L1 dimension: horizontal distance from left edge
                                  const l1DimensionLineY = bottomY + 100
                                  const l1LabelY = l1DimensionLineY + 60
                                  
                                  // L2 dimension: vertical distance from bottom edge
                                  const l2DimensionLineX = -(100 + cutouts.length * 120)
                                  const l2LabelX = l2DimensionLineX - 50
                                  
                                  return (
                                    <g key="l1-l2-dims">
                                      {/* L1 dimension - horizontal distance from left edge */}
                                      <g>
                                        {/* Extension lines */}
                                          <line
                                          x1={0}
                                          y1={bottomY}
                                            x2={0}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                          <line
                                          x1={l1Value}
                                          y1={bottomY}
                                          x2={l1Value}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                          />
                                          {/* Dimension line */}
                                          <line
                                          x1={0}
                                          y1={l1DimensionLineY}
                                          x2={l1Value}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                        {/* Label */}
                                        <text
                                          x={l1Value / 2}
                                          y={l1LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L1: {l1Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L2 dimension - vertical distance from bottom edge */}
                                      <g>
                                        {/* Extension lines */}
                                          <line
                                          x1={0}
                                          y1={bottomY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomY - l2Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                          />
                                          <line
                                          x1={0}
                                          y1={bottomY}
                                          x2={l2DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l2DimensionLineX}
                                          y1={bottomY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l2LabelX}
                                          y={bottomY - l2Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l2LabelX} ${bottomY - l2Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L2: {l2Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* L3-L4 chamfer dimension labels (bottom-right corner) - ISO standard dimensioning */}
                                {/* For Összemarás: L3-L4 applies to right rectangle, not main worktop */}
                                {hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)' && (() => {
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  const bottomY = worktopLength
                                  
                                  // L3 dimension: horizontal distance from right edge (going left)
                                  const l3DimensionLineY = bottomY + 100
                                  const l3LabelY = l3DimensionLineY + 60
                                  
                                  // L4 dimension: vertical distance from bottom edge
                                  // For Összemarás Balos/jobbos: position below B dimension label on right side, but offset to the left to avoid overlap
                                  let l4DimensionLineX, l4LabelX
                                  if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && bValue > 0) {
                                    // Position L4 to the left of B dimension to avoid overlap
                                    const maxCutoutOffset = cutouts.length > 0 
                                      ? 100 + ((cutouts.length - 1) * 120) + 50 + 40
                                      : 0
                                    const baseOffset = edgePosition3 ? 350 : 220
                                    const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                    // Offset L4 120mm to the left of B dimension line
                                    l4DimensionLineX = rightEdge + extensionLineOffset - 120
                                    l4LabelX = l4DimensionLineX + 50
                                  } else {
                                    // Original position for other assembly types
                                    l4DimensionLineX = rightEdge + 100 + (cutouts.length * 120)
                                    l4LabelX = l4DimensionLineX + 50
                                  }
                                  
                                  return (
                                    <g key="l3-l4-dims">
                                      {/* L3 dimension - horizontal distance from right edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={rightEdge}
                                          y1={bottomY}
                                          x2={rightEdge}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={rightEdge - l3Value}
                                          y1={bottomY}
                                          x2={rightEdge - l3Value}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={rightEdge - l3Value}
                                          y1={l3DimensionLineY}
                                          x2={rightEdge}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={rightEdge - l3Value / 2}
                                          y={l3LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L3: {l3Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L4 dimension - vertical distance from bottom edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={rightEdge}
                                          y1={bottomY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomY - l4Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={rightEdge}
                                          y1={bottomY}
                                          x2={l4DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l4DimensionLineX}
                                          y1={bottomY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label - for Összemarás Balos/jobbos, position below B label */}
                                        {(() => {
                                          // Calculate B label position for Összemarás Balos/jobbos
                                          let labelY = bottomY - l4Value / 2
                                          if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && bValue > 0) {
                                            const startY = showVerticalCut ? verticalCutHeight : 0
                                            const bLabelY = (startY + bottomY) / 2
                                            // Position L4 label below B label (120mm spacing)
                                            labelY = bLabelY + 120
                                          }
                                          return (
                                            <text
                                              x={l4LabelX}
                                              y={labelY}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              transform={`rotate(-90 ${l4LabelX} ${labelY})`}
                                              style={{
                                                fontSize: '80px',
                                                fontWeight: 500,
                                                fill: '#666',
                                                pointerEvents: 'none'
                                              }}
                                            >
                                              L4: {l4Value}mm
                                            </text>
                                          )
                                        })()}
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* L5-L6 chamfer dimension labels - For Összemarás Balos/jobbos: bottom-left corner of left perpendicular rectangle, otherwise: top-left corner of main worktop */}
                                {hasL5L6 && (() => {
                                  if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect) {
                                    // L5-L6 labels for left perpendicular rectangle's bottom-left corner
                                    // For Balos: at (0, worktopLength), bottom-left at (0, worktopLength + rectHeight)
                                    // For jobbos: at (0, 0), bottom-left at (0, rectHeight)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectHeight = leftPerpendicularRectHeight
                                    const bottomLeftX = rectX
                                    const bottomLeftY = rectY + rectHeight
                                    
                                    // L5 dimension: horizontal distance from left edge (along bottom edge)
                                    const l5DimensionLineY = bottomLeftY + 100
                                    const l5LabelY = l5DimensionLineY + 60
                                    
                                    // L6 dimension: vertical distance from bottom edge (along left edge)
                                    const l6DimensionLineX = -(100 + cutouts.length * 120)
                                    const l6LabelX = l6DimensionLineX - 50
                                    
                                    return (
                                      <g key="l5-l6-dims-perpendicular">
                                        {/* L5 dimension - horizontal distance from left edge */}
                                        <g>
                                          {/* Extension lines */}
                                          <line
                                            x1={bottomLeftX}
                                            y1={bottomLeftY}
                                            x2={bottomLeftX}
                                            y2={l5DimensionLineY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          <line
                                            x1={bottomLeftX + l5Value}
                                            y1={bottomLeftY}
                                            x2={bottomLeftX + l5Value}
                                            y2={l5DimensionLineY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Dimension line */}
                                          <line
                                            x1={bottomLeftX}
                                            y1={l5DimensionLineY}
                                            x2={bottomLeftX + l5Value}
                                            y2={l5DimensionLineY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Label */}
                                          <text
                                            x={bottomLeftX + l5Value / 2}
                                            y={l5LabelY}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            style={{
                                              fontSize: '80px',
                                              fontWeight: 500,
                                              fill: '#666',
                                              pointerEvents: 'none'
                                            }}
                                          >
                                            L5: {l5Value}mm
                                          </text>
                                        </g>
                                        
                                        {/* L6 dimension - vertical distance from bottom edge */}
                                        <g>
                                          {/* Extension lines */}
                                          <line
                                            x1={bottomLeftX}
                                            y1={bottomLeftY}
                                            x2={l6DimensionLineX}
                                            y2={bottomLeftY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          <line
                                            x1={bottomLeftX}
                                            y1={bottomLeftY - l6Value}
                                            x2={l6DimensionLineX}
                                            y2={bottomLeftY - l6Value}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Dimension line */}
                                          <line
                                            x1={l6DimensionLineX}
                                            y1={bottomLeftY - l6Value}
                                            x2={l6DimensionLineX}
                                            y2={bottomLeftY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Label */}
                                          <text
                                            x={l6LabelX}
                                            y={bottomLeftY - l6Value / 2}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            transform={`rotate(-90 ${l6LabelX} ${bottomLeftY - l6Value / 2})`}
                                            style={{
                                              fontSize: '80px',
                                              fontWeight: 500,
                                              fill: '#666',
                                              pointerEvents: 'none'
                                            }}
                                          >
                                            L6: {l6Value}mm
                                          </text>
                                        </g>
                                      </g>
                                    )
                                  } else {
                                    // L5-L6 labels for main worktop's top-left corner (Levágás, jobbos)
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                               (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    const topLeftX = mainWorktopOffsetX
                                    const topLeftY = startY
                                    
                                    // L5 dimension: horizontal distance from left edge
                                    const l5DimensionLineY = topLeftY - 100
                                    const l5LabelY = l5DimensionLineY - 60
                                    
                                    // L6 dimension: vertical distance from top edge
                                    const l6DimensionLineX = -(100 + cutouts.length * 120)
                                    const l6LabelX = l6DimensionLineX - 50
                                    
                                    return (
                                      <g key="l5-l6-dims">
                                      {/* L5 dimension - horizontal distance from left edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={topLeftX}
                                          y1={topLeftY}
                                          x2={topLeftX}
                                          y2={l5DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={topLeftX + l5Value}
                                          y1={topLeftY}
                                          x2={topLeftX + l5Value}
                                          y2={l5DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={topLeftX}
                                          y1={l5DimensionLineY}
                                          x2={topLeftX + l5Value}
                                          y2={l5DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={topLeftX + l5Value / 2}
                                          y={l5LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L5: {l5Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L6 dimension - vertical distance from top edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={topLeftX}
                                          y1={topLeftY}
                                          x2={l6DimensionLineX}
                                          y2={topLeftY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={topLeftX}
                                          y1={topLeftY + l6Value}
                                          x2={l6DimensionLineX}
                                          y2={topLeftY + l6Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l6DimensionLineX}
                                          y1={topLeftY}
                                          x2={l6DimensionLineX}
                                          y2={topLeftY + l6Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l6LabelX}
                                          y={topLeftY + l6Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l6LabelX} ${topLeftY + l6Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L6: {l6Value}mm
                                        </text>
                                      </g>
                                    </g>
                                    )
                                  }
                                })()}
                                
                                {/* L7-L8 chamfer dimension labels (top-right corner) - ISO standard dimensioning - only for Levágás, Összemarás Balos, Összemarás jobbos */}
                                {hasL7L8 && (() => {
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const topRightX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  const topRightY = startY
                                  
                                  // L7 dimension: horizontal distance from right edge (going left)
                                  const l7DimensionLineY = topRightY - 100
                                  const l7LabelY = l7DimensionLineY - 60
                                  
                                  // L8 dimension: vertical distance from top edge
                                  // Position L8 to the left of B label (B should be the rightmost)
                                  let l8DimensionLineX, l8LabelX
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 50 + 40
                                    : 0
                                  const baseOffset = edgePosition2 ? 350 : 220
                                  // L8 should be positioned before B, so use standard offset without extra spacing
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  l8DimensionLineX = topRightX + extensionLineOffset
                                  l8LabelX = l8DimensionLineX + 50
                                  
                                  return (
                                    <g key="l7-l8-dims">
                                      {/* L7 dimension - horizontal distance from right edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={topRightX}
                                          y1={topRightY}
                                          x2={topRightX}
                                          y2={l7DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={topRightX - l7Value}
                                          y1={topRightY}
                                          x2={topRightX - l7Value}
                                          y2={l7DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={topRightX - l7Value}
                                          y1={l7DimensionLineY}
                                          x2={topRightX}
                                          y2={l7DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={topRightX - l7Value / 2}
                                          y={l7LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L7: {l7Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L8 dimension - vertical distance from top edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={topRightX}
                                          y1={topRightY}
                                          x2={l8DimensionLineX}
                                          y2={topRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={topRightX}
                                          y1={topRightY + l8Value}
                                          x2={l8DimensionLineX}
                                          y2={topRightY + l8Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l8DimensionLineX}
                                          y1={topRightY}
                                          x2={l8DimensionLineX}
                                          y2={topRightY + l8Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l8LabelX}
                                          y={topRightY + l8Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l8LabelX} ${topRightY + l8Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L8: {l8Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* L1-L2 chamfer dimension labels for left perpendicular rectangle (bottom-right corner for Balos, bottom-left corner for Összemarás) - ISO standard dimensioning */}
                                {hasLeftPerpendicularL1L2 && (() => {
                                  let rectX: number
                                  let rectY: number
                                  let bottomRightX: number
                                  let bottomRightY: number
                                  
                                  if (isJobbos) {
                                    // For jobbos: at top-left (0, 0)
                                    rectX = 0
                                    rectY = 0
                                    bottomRightX = leftPerpendicularRectWidth
                                    bottomRightY = leftPerpendicularRectHeight
                                  } else {
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength), extends to the right
                                    // Bottom-right corner (where R1/L1-L2 are): (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    rectX = 0
                                    rectY = worktopLength
                                    bottomRightX = leftPerpendicularRectWidth
                                    bottomRightY = rectY + leftPerpendicularRectHeight
                                  }
                                  
                                  const rectWidth = leftPerpendicularRectWidth
                                  const rectHeight = leftPerpendicularRectHeight
                                  
                                  // L1 dimension: horizontal distance from right edge of perpendicular rectangle (going left)
                                  const l1DimensionLineY = bottomRightY + 100
                                  const l1LabelY = l1DimensionLineY + 60
                                  
                                  // L2 dimension: vertical distance from bottom edge of perpendicular rectangle
                                  const l2DimensionLineX = bottomRightX + 100 + (cutouts.length * 120)
                                  const l2LabelX = l2DimensionLineX + 50
                                  
                                  return (
                                    <g key="perpendicular-l1-l2-dims">
                                      {/* L1 dimension - horizontal distance from right edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={bottomRightX}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX - l1Value}
                                          y1={bottomRightY}
                                          x2={bottomRightX - l1Value}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={bottomRightX - l1Value}
                                          y1={l1DimensionLineY}
                                          x2={bottomRightX}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={bottomRightX - l1Value / 2}
                                          y={l1LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L1: {l1Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L2 dimension - vertical distance from bottom edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomRightY - l2Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={l2DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l2DimensionLineX}
                                          y1={bottomRightY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l2LabelX}
                                          y={bottomRightY - l2Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l2LabelX} ${bottomRightY - l2Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L2: {l2Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* Edge position labels outside worktop with ISO dimension style extension lines */}
                                {(() => {
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  
                                  // Center of worktop edges (accounting for offset)
                                  const centerX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth) / 2
                                  const centerY = (startY + bottomY) / 2
                                  
                                  // Extension line offset (distance from edge to label) - proportional to maintain aspect ratio
                                  // Use a percentage of the smaller dimension to keep labels visible and maintain aspect ratio
                                  const worktopWidthForCalc = showCut ? cutPosition : worktopWidth
                                  const minDimension = Math.min(worktopWidthForCalc, bottomY - startY)
                                  const extensionOffset = minDimension * 0.15 // 15% of smaller dimension
                                  
                                  // Extension line length (how far the line extends from edge) - proportional
                                  const extensionLineLength = minDimension * 0.08 // 8% of smaller dimension
                                  
                                  // Calculate edge center points (accounting for main worktop offset for jobbos)
                                  // 1. oldal - Left edge center
                                  let leftEdgeX: number
                                  let leftEdgeY: number
                                  if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                    // For Összemarás jobbos: 1. oldal is the perpendicular rectangle's left edge
                                    // Perpendicular rectangle left edge: from (0, 0) to (0, leftPerpendicularRectHeight)
                                    leftEdgeX = 0
                                    leftEdgeY = leftPerpendicularRectHeight / 2
                                  } else if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
                                    // For Összemarás Balos: left edge includes both main worktop and perpendicular rectangle
                                    // Combined left edge: from (0, startY) to (0, worktopLength + leftPerpendicularRectHeight)
                                    leftEdgeX = 0
                                    const combinedTopY = startY
                                    const combinedBottomY = worktopLength + leftPerpendicularRectHeight
                                    leftEdgeY = (combinedTopY + combinedBottomY) / 2
                                  } else {
                                    // For other types: left edge center is just the main worktop center
                                    leftEdgeX = mainWorktopOffsetX
                                    leftEdgeY = centerY
                                  }
                                  
                                  // 2. oldal - Top edge center
                                  let topEdgeX: number
                                  let topEdgeY: number
                                  if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
                                    // For Összemarás jobbos: 2. oldal includes both perpendicular rectangle's top edge AND main worktop's top edge
                                    // Combined top edge: from (0, 0) to (leftPerpendicularRectWidth + worktopWidth, 0)
                                    const combinedLeftX = 0
                                    const combinedRightX = leftPerpendicularRectWidth + (showCut ? cutPosition : worktopWidth)
                                    topEdgeX = (combinedLeftX + combinedRightX) / 2
                                    topEdgeY = 0
                                  } else {
                                    // For other types: top edge center is just the main worktop center
                                    topEdgeX = centerX
                                    topEdgeY = startY
                                  }
                                  
                                  // 3. oldal - Right edge center: (rightEdge, centerY)
                                  const rightEdgeX = rightEdge
                                  const rightEdgeY = centerY
                                  
                                  // 4. oldal - Bottom edge center: (centerX, bottomY)
                                  const bottomEdgeX = centerX
                                  const bottomEdgeY = bottomY
                                  
                                  // Label positions - outside worktop
                                  // 1. oldal - Left: to the left of worktop
                                  const leftLabelX = leftEdgeX - extensionOffset
                                  const leftLabelY = leftEdgeY
                                  
                                  // 2. oldal - Top: above worktop
                                  const topLabelX = topEdgeX
                                  const topLabelY = topEdgeY - extensionOffset
                                  
                                  // 3. oldal - Right: to the right of worktop
                                  const rightLabelX = rightEdgeX + extensionOffset
                                  const rightLabelY = rightEdgeY
                                  
                                  // 4. oldal - Bottom: below worktop
                                  const bottomLabelX = bottomEdgeX
                                  const bottomLabelY = bottomEdgeY + extensionOffset
                                  
                                  return (
                                    <>
                                      {/* 1. oldal - Left edge label */}
                                      {edgePosition1 && (
                                        <text
                                          x={leftLabelX}
                                          y={leftLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${leftLabelX} ${leftLabelY})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          1. oldal
                                        </text>
                                      )}
                                      
                                      {/* 2. oldal - Top edge label */}
                                      {edgePosition2 && (
                                        <text
                                          x={topLabelX}
                                          y={topLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          2. oldal
                                        </text>
                                      )}
                                      
                                      {/* 3. oldal - Right edge label */}
                                      {edgePosition3 && (
                                        <text
                                          x={rightLabelX}
                                          y={rightLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(90 ${rightLabelX} ${rightLabelY})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          3. oldal
                                        </text>
                                      )}
                                      
                                      {/* 4. oldal - Bottom edge label */}
                                      {edgePosition4 && (
                                        <text
                                          x={bottomLabelX}
                                          y={bottomLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                        fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          4. oldal
                                        </text>
                                      )}
                                      
                                      {/* 5. oldal - Perpendicular rectangle right edge label (C dimension) - for Összemarás Balos and Összemarás jobbos */}
                                      {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && edgePosition5 && (() => {
                                        if (assemblyType === 'Összemarás jobbos') {
                                          // For jobbos: 5. oldal is the C×D rectangle's right edge minus B from top
                                          // Right edge: from (D, B) to (D, C)
                                          const perpendicularRectRightX = leftPerpendicularRectWidth
                                          const bValue = parseFloat(dimensionB) || 0
                                          const perpendicularRectTopY = bValue
                                          const perpendicularRectBottomY = leftPerpendicularRectHeight
                                          const perpendicularRectCenterY = (perpendicularRectTopY + perpendicularRectBottomY) / 2
                                          
                                          // Label to the right of perpendicular rectangle's right edge
                                          const labelX = perpendicularRectRightX + extensionOffset
                                          const labelY = perpendicularRectCenterY
                                          
                                          return (
                                            <text
                                              x={labelX}
                                              y={labelY}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              transform={`rotate(-90 ${labelX} ${labelY})`}
                                              style={{
                                                fontSize: '80px',
                                                fontWeight: 600,
                                                fill: '#000000',
                                                pointerEvents: 'none'
                                              }}
                                            >
                                              5. oldal
                                            </text>
                                          )
                                        } else {
                                          // For Balos: Perpendicular rectangle right edge: from (leftPerpendicularRectWidth, worktopLength) to (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                          const perpendicularRectRightX = leftPerpendicularRectWidth
                                          const perpendicularRectTopY = worktopLength
                                          const perpendicularRectBottomY = worktopLength + leftPerpendicularRectHeight
                                          const perpendicularRectCenterY = (perpendicularRectTopY + perpendicularRectBottomY) / 2
                                          
                                          // Label to the right of perpendicular rectangle's right edge
                                          const labelX = perpendicularRectRightX + extensionOffset
                                          const labelY = perpendicularRectCenterY
                                          
                                          return (
                                            <text
                                              x={labelX}
                                              y={labelY}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              transform={`rotate(-90 ${labelX} ${labelY})`}
                                              style={{
                                                fontSize: '80px',
                                                fontWeight: 600,
                                                fill: '#000000',
                                                pointerEvents: 'none'
                                              }}
                                            >
                                              5. oldal
                                            </text>
                                          )
                                        }
                                      })()}
                                      
                                      {/* 6. oldal - Perpendicular rectangle bottom edge label (D dimension) - for Összemarás Balos and Összemarás jobbos */}
                                      {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && edgePosition6 && (() => {
                                        if (assemblyType === 'Összemarás jobbos') {
                                          // For jobbos: 6. oldal is the C×D rectangle's bottom D edge
                                          // Bottom edge: from (0, C) to (D, C)
                                          const perpendicularRectBottomY = leftPerpendicularRectHeight
                                          const perpendicularRectCenterX = leftPerpendicularRectWidth / 2
                                          
                                          // Label below perpendicular rectangle's bottom edge
                                          const labelX = perpendicularRectCenterX
                                          const labelY = perpendicularRectBottomY + extensionOffset
                                          
                                          return (
                                            <text
                                              x={labelX}
                                              y={labelY}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              style={{
                                                fontSize: '80px',
                                                fontWeight: 600,
                                                fill: '#000000',
                                                pointerEvents: 'none'
                                              }}
                                            >
                                              6. oldal
                                            </text>
                                          )
                                        } else {
                                          // For Balos: Perpendicular rectangle bottom edge: from (0, worktopLength + leftPerpendicularRectHeight) to (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                          const perpendicularRectBottomY = worktopLength + leftPerpendicularRectHeight
                                          const perpendicularRectCenterX = leftPerpendicularRectWidth / 2
                                          
                                          // Label below perpendicular rectangle's bottom edge
                                          const labelX = perpendicularRectCenterX
                                          const labelY = perpendicularRectBottomY + extensionOffset
                                          
                                          return (
                                            <text
                                              x={labelX}
                                              y={labelY}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              style={{
                                                fontSize: '80px',
                                                fontWeight: 600,
                                                fill: '#000000',
                                                pointerEvents: 'none'
                                              }}
                                            >
                                              6. oldal
                                            </text>
                                          )
                                        }
                                      })()}
                                    </>
                                  )
                                })()}
                                
                                {/* A dimension - ISO standard dimensioning for Levágás */}
                                {showCut && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position below oldal label if 4. oldal is active, otherwise closer
                                  // Always position after all cutout dimension labels
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineY = worktopLength + extensionLineOffset
                                  const labelY = dimensionLineY + 60 // Label below dimension line
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left edge and cut position */}
                                      <line
                                        x1={0}
                                        y1={worktopLength}
                                        x2={0}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={cutPosition}
                                        y1={worktopLength}
                                        x2={cutPosition}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={0}
                                        y1={dimensionLineY}
                                        x2={cutPosition}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={cutPosition / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                    fontWeight: 500,
                                          fill: '#ff6b6b',
                                          pointerEvents: 'none'
                                  }}
                                >
                                  A: {cutPosition}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* A dimension - ISO standard dimensioning for Hossztoldás and Összemarás types - ABOVE worktop */}
                                {(assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && aValue > 0 && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position ABOVE worktop (top edge)
                                  // Account for 2. oldal label if active (at 160mm from top)
                                  const baseOffset = edgePosition2 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const dimensionLineY = startY - extensionLineOffset
                                  const labelY = dimensionLineY - 60 // Label above dimension line
                                  
                                  let aDimensionStartX: number
                                  let aDimensionEndX: number
                                  
                                  if (isJobbos && showLeftPerpendicularRect) {
                                    // For jobbos: A dimension spans from top-left of perpendicular rectangle (0) to top-right of main worktop (leftPerpendicularRectWidth + worktopWidth = D + A)
                                    aDimensionStartX = 0 // Top-left of perpendicular rectangle
                                    aDimensionEndX = leftPerpendicularRectWidth + worktopWidth // Top-right of main worktop (D + A)
                                  } else if (isOsszemaras && showLeftPerpendicularRect && showRightPerpendicularRect) {
                                    // For Összemarás: A dimension spans just the main worktop (from 0 to A)
                                    aDimensionStartX = 0 // Left edge of main worktop
                                    aDimensionEndX = worktopWidth // Right edge of main worktop (A)
                                  } else {
                                    // For Hossztoldás and Balos: A dimension spans from left edge to right edge of main worktop
                                    aDimensionStartX = 0
                                    aDimensionEndX = worktopWidth
                                  }
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left edge and right edge */}
                                      <line
                                        x1={aDimensionStartX}
                                        y1={startY}
                                        x2={aDimensionStartX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={aDimensionEndX}
                                        y1={startY}
                                        x2={aDimensionEndX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={aDimensionStartX}
                                        y1={dimensionLineY}
                                        x2={aDimensionEndX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label above dimension line */}
                                      <text
                                        x={(aDimensionStartX + aDimensionEndX) / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        A: {aValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}
                                
                                {/* C dimension - ISO standard dimensioning for Összemarás types */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && cValue > 0 && (() => {
                                  // For Balos and Összemarás: C dimension goes from top-left of main worktop (0, startY) to bottom-left of perpendicular rectangle (0, worktopLength + leftPerpendicularRectHeight)
                                  // For jobbos: C dimension goes from top-left of perpendicular rectangle (0, 0) to bottom-left of perpendicular rectangle (0, leftPerpendicularRectHeight)
                                  // Both are VERTICAL dimensions on the LEFT side
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  
                                  let topY: number
                                  let bottomY: number
                                  let dimensionLineX: number
                                  let labelX: number
                                  
                                  let extensionLineX: number // X position of the extension lines
                                  
                                  if (isJobbos) {
                                    // For jobbos: vertical dimension from top to bottom of perpendicular rectangle
                                    topY = 0 // Top of perpendicular rectangle
                                    bottomY = leftPerpendicularRectHeight // Bottom of perpendicular rectangle
                                    extensionLineX = 0 // Left edge of perpendicular rectangle
                                  } else {
                                    // For Balos and Összemarás: vertical dimension from top-left of main worktop to bottom-left of perpendicular rectangle
                                    // Both use the same positioning: left edge at x=0
                                    topY = startY
                                    bottomY = worktopLength + leftPerpendicularRectHeight
                                    extensionLineX = 0 // Left edge
                                  }
                                  
                                  // Both use the same positioning logic: vertical dimension on the left side
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40
                                    : 0
                                  const baseOffset = edgePosition1 ? 320 : 200
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  dimensionLineX = extensionLineX - extensionLineOffset
                                  labelX = dimensionLineX - 60
                                  
                                  return (
                                    <g>
                                      {/* Vertical dimension from connection point */}
                                      <line
                                        x1={extensionLineX}
                                        y1={topY}
                                        x2={dimensionLineX}
                                        y2={topY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={extensionLineX}
                                        y1={bottomY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={dimensionLineX}
                                        y1={topY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <text
                                        x={labelX}
                                        y={(topY + bottomY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                        transform={`rotate(-90 ${labelX} ${(topY + bottomY) / 2})`}
                                      >
                                        C: {cValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* B dimension - ISO standard dimensioning for Összemarás types (vertical - main worktop height) - on right side */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && bValue > 0 && (() => {
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  // For jobbos/Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const rightEdge = mainWorktopOffsetX + worktopWidth
                                  
                                  // Calculate maximum offset needed for cutout dimension labels
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 50 + 40
                                    : 0
                                  
                                  // Position B as the rightmost dimension label (after L7-L8 if present)
                                  // Calculate L7-L8 position to ensure B is positioned after it
                                  // L8 uses: topRightX + Math.max(edgePosition2 ? 350 : 220, maxCutoutOffset)
                                  // L8 label is at: l8DimensionLineX + 50
                                  // L8 label is rotated -90 degrees, so it extends horizontally
                                  // Label text "L8: {l8Value}mm" can be up to 200mm wide when rotated (for large values)
                                  const l7L8BaseOffset = edgePosition2 ? 350 : 220
                                  const l7L8DimensionLineOffset = Math.max(l7L8BaseOffset, maxCutoutOffset)
                                  const l7L8LabelEndPosition = hasL7L8 
                                    ? l7L8DimensionLineOffset + 50 + 200 // L8 label end position (labelX + max rotated text width)
                                    : 0
                                  
                                  // Account for 3. oldal label if active
                                  const baseOffset = edgePosition3 ? 350 : 220
                                  
                                  // B should be the rightmost, so position it after L7-L8 (if present) with spacing
                                  // Add 300mm spacing after L8 label end to ensure no overlap
                                  const spacingAfterL8 = hasL7L8 ? 300 : 0
                                  let extensionLineOffset = Math.max(baseOffset, maxCutoutOffset, l7L8LabelEndPosition + spacingAfterL8)
                                  let dimensionLineX = rightEdge + extensionLineOffset
                                  let labelX = dimensionLineX + 50 // Label to the right of dimension line
                                  
                                  // Ensure B label stays within card (check against viewBox right boundary)
                                  // The viewBox right boundary is approximately: totalWorktopWidth + labelPaddingRight
                                  // We'll use a conservative limit to ensure it stays visible
                                  const maxRightPosition = rightEdge + labelPaddingRight - 100 // Leave 100mm margin from card edge
                                  if (labelX > maxRightPosition) {
                                    // Adjust to stay within card
                                    dimensionLineX = maxRightPosition - 50
                                    labelX = maxRightPosition
                                  }
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from top and bottom of main worktop */}
                                      <line
                                        x1={rightEdge}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={startY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={rightEdge}
                                        y1={bottomY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (vertical) */}
                                      <line
                                        x1={dimensionLineX}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label to the right of dimension line */}
                                      <text
                                        x={labelX}
                                        y={(startY + bottomY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                    fontWeight: 500,
                                          fill: '#1976d2',
                                    pointerEvents: 'none'
                                  }}
                                        transform={`rotate(-90 ${labelX} ${(startY + bottomY) / 2})`}
                                      >
                                        B: {bValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* D dimension - ISO standard dimensioning for Összemarás types (horizontal - left perpendicular rectangle width) */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && dValue > 0 && (() => {
                                  // For Balos and Összemarás: at bottom-left (0, worktopLength), extends to the right
                                  //   Left edge at x=0, right edge at x=leftPerpendicularRectWidth
                                  // For jobbos: at top-left (0, 0)
                                  const rectX = 0
                                  const rectY = isJobbos ? 0 : worktopLength
                                  const rectWidth = leftPerpendicularRectWidth
                                  const rectHeight = leftPerpendicularRectHeight
                                  const bottomRightX = rectWidth
                                  const bottomRightY = rectY + rectHeight
                                  
                                  // Calculate maximum offset needed for cutout dimension labels
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40
                                    : 0
                                  
                                  // Position below perpendicular rectangle, account for 4. oldal label if active
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineY = bottomRightY + extensionLineOffset
                                  const labelY = dimensionLineY + 60
                                
                                return (
                                    <g>
                                      {/* Extension lines - from left and right edges of perpendicular rectangle */}
                                      <line
                                        x1={rectX}
                                        y1={bottomRightY}
                                        x2={rectX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={bottomRightX}
                                        y1={bottomRightY}
                                        x2={bottomRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (horizontal) */}
                                      <line
                                        x1={rectX}
                                        y1={dimensionLineY}
                                        x2={bottomRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={bottomRightX / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                    pointerEvents: 'none'
                                  }}
                                >
                                        D: {dValue}mm
                                      </text>
                                    </g>
                                )
                              })()}

                                {/* E dimension - ISO standard dimensioning for Összemarás (vertical - right rectangle height) - on left side */}
                                {isOsszemaras && showRightPerpendicularRect && eValue > 0 && (() => {
                                  // Main worktop is at (0, 0), no offset
                                  const topRightX = worktopWidth // Top-right corner (connection point)
                                  const topLeftX = topRightX - rightPerpendicularRectWidth
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  
                                  // Position to the left of the right rectangle
                                  const extensionLineOffset = 100
                                  const dimensionLineX = topLeftX - extensionLineOffset
                                  const labelX = dimensionLineX - 50
                                
                                return (
                                    <g>
                                      {/* Extension lines - from top and bottom of right rectangle */}
                                      <line
                                        x1={topLeftX}
                                        y1={rectY}
                                        x2={dimensionLineX}
                                        y2={rectY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={topLeftX}
                                        y1={rectY + rectHeight}
                                        x2={dimensionLineX}
                                        y2={rectY + rectHeight}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (vertical) */}
                                      <line
                                        x1={dimensionLineX}
                                        y1={rectY}
                                        x2={dimensionLineX}
                                        y2={rectY + rectHeight}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label */}
                                      <text
                                        x={labelX}
                                        y={rectY + rectHeight / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        transform={`rotate(-90 ${labelX} ${rectY + rectHeight / 2})`}
                                        style={{
                                          fontSize: '80px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        E: {eValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* F dimension - ISO standard dimensioning for Összemarás (horizontal - right rectangle width) - below right rectangle */}
                                {isOsszemaras && showRightPerpendicularRect && fValue > 0 && (() => {
                                  // Account for main worktop offset
                                  const mainWorktopOffsetX = showLeftPerpendicularRect ? leftPerpendicularRectWidth : 0
                                  const topRightX = mainWorktopOffsetX + worktopWidth // Top-right corner (connection point)
                                  const topLeftX = topRightX - rightPerpendicularRectWidth
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  
                                  // Position below the right rectangle
                                  const extensionLineOffset = 100
                                  const dimensionLineY = rectY + rectHeight + extensionLineOffset
                                  const labelY = dimensionLineY + 60
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left and right of right rectangle */}
                                      <line
                                        x1={topLeftX}
                                        y1={rectY + rectHeight}
                                        x2={topLeftX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={topRightX}
                                        y1={rectY + rectHeight}
                                        x2={topRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (horizontal) */}
                                      <line
                                        x1={topLeftX}
                                        y1={dimensionLineY}
                                        x2={topRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label */}
                                      <text
                                        x={(topLeftX + topRightX) / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '80px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        F: {fValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* R2 label for right perpendicular rectangle (bottom-RIGHT corner) - Összemarás only */}
                                {isOsszemaras && showRightPerpendicularRect && rightPerpendicularRectR2 > 0 && (() => {
                                  // Account for main worktop offset
                                  const mainWorktopOffsetX = showLeftPerpendicularRect ? leftPerpendicularRectWidth : 0
                                  const topRightX = mainWorktopOffsetX + worktopWidth // Top-right corner (connection point)
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  const r2 = rightPerpendicularRectR2
                                  const bottomRightX = topRightX
                                  const bottomRightY = rectY + rectHeight
                                  
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (bottomRightX - r2, bottomRightY - r2)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = bottomRightX - r2 * 0.6
                                  const labelY = bottomRightY - r2 * 0.6
                                  
                                  return (
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="start"
                                      dominantBaseline="middle"
                                      style={{
                                        fontSize: '60px',
                                    fontWeight: 600,
                                        fill: '#1976d2',
                                    pointerEvents: 'none'
                                  }}
                                >
                                    R2
                                    </text>
                                )
                              })()}

                                {/* L3-L4 chamfer dimension labels for right perpendicular rectangle (bottom-RIGHT corner) - ISO standard dimensioning - Összemarás only */}
                                {hasRightPerpendicularL3L4 && (() => {
                                  // Account for main worktop offset
                                  const mainWorktopOffsetX = showLeftPerpendicularRect ? leftPerpendicularRectWidth : 0
                                  const topRightX = mainWorktopOffsetX + worktopWidth // Top-right corner (connection point)
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  const bottomRightX = topRightX
                                  const bottomRightY = rectY + rectHeight
                                  
                                  // L3 dimension: horizontal distance from right edge (going left)
                                  const l3DimensionLineY = bottomRightY + 100
                                  const l3LabelY = l3DimensionLineY + 60
                                  
                                  // L4 dimension: vertical distance from bottom edge (going up)
                                  const l4DimensionLineX = bottomRightX + 100
                                  const l4LabelX = l4DimensionLineX + 50
                                
                                return (
                                    <g>
                                      {/* L3 dimension - horizontal */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={bottomRightX}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX - l3Value}
                                          y1={bottomRightY}
                                          x2={bottomRightX - l3Value}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={bottomRightX - l3Value}
                                          y1={l3DimensionLineY}
                                          x2={bottomRightX}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={bottomRightX - l3Value / 2}
                                          y={l3LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L3: {l3Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L4 dimension - vertical */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={l4DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomRightY - l4Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l4DimensionLineX}
                                          y1={bottomRightY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l4LabelX}
                                          y={bottomRightY - l4Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l4LabelX} ${bottomRightY - l4Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L4: {l4Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}

                                {/* C dimension - ISO standard dimensioning for Hossztoldás - above A, below cutout labels */}
                                {assemblyType === 'Hossztoldás' && showJoin && cValue > 0 && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position A dimension (furthest from worktop)
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const aExtensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const aDimensionLineY = worktopLength + aExtensionLineOffset
                                  
                                  // Position C dimension above A (1 row above A dimension line), but below cutout labels
                                  const rowSpacing = 120 // Space between rows
                                  const cDimensionLineY = aDimensionLineY - rowSpacing
                                  
                                  // Make sure C is above cutout labels (cutout dimension lines start at worktopLength + 100)
                                  const minCDimensionLineY = worktopLength + 100 + 40 // Above cutout dimension lines
                                  const finalCDimensionLineY = Math.max(cDimensionLineY, minCDimensionLineY)
                                  const finalCLabelY = finalCDimensionLineY + 60
                                
                                return (
                                    <g>
                                      {/* Extension lines - from join position and right edge */}
                                      <line
                                        x1={joinPosition}
                                        y1={worktopLength}
                                        x2={joinPosition}
                                        y2={finalCDimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={worktopWidth}
                                        y1={worktopLength}
                                        x2={worktopWidth}
                                        y2={finalCDimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={joinPosition}
                                        y1={finalCDimensionLineY}
                                        x2={worktopWidth}
                                        y2={finalCDimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={(joinPosition + worktopWidth) / 2}
                                        y={finalCLabelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                      pointerEvents: 'none'
                                    }}
                                  >
                                        C: {cValue}mm
                                      </text>
                                    </g>
                                )
                              })()}
                                
                                {/* B dimension - ISO standard dimensioning (vertical) - measures kept part from cut line to bottom */}
                                {showVerticalCut && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 50 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 50 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position to the left of oldal label if 1. oldal is active, otherwise closer
                                  // Always position after all cutout dimension labels
                                  const baseOffset = edgePosition1 ? 350 : 220
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineX = -extensionLineOffset
                                  const startY = verticalCutHeight // Start from cut line (top of kept part)
                                  const bottomY = worktopLength // End at bottom
                                  const labelX = dimensionLineX - 50 // Label to the left of dimension line
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from cut line and bottom of kept part */}
                                      <line
                                        x1={0}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={startY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={0}
                                        y1={bottomY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={dimensionLineX}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label to the left of dimension line - centered and rotated */}
                                      <text
                                        x={labelX}
                                        y={(startY + bottomY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        transform={`rotate(-90 ${labelX} ${(startY + bottomY) / 2})`}
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#ff6b6b',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        B: {bValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}
                                
                                {/* Pattern definitions for cut overlays */}
                                <defs>
                                  <pattern
                                    id="diagonalHatch"
                                    patternUnits="userSpaceOnUse"
                                    width="80"
                                    height="80"
                                  >
                                    <path
                                      d="M 0,80 L 80,0"
                                      stroke="rgba(100, 150, 200, 0.35)"
                                      strokeWidth="1.5"
                                    />
                                  </pattern>
                                </defs>
                                
                                {/* Horizontal cut part (right side) - drawn in SVG to match exact dimensions */}
                                {showCut && assemblyType !== 'Levágás' && (() => {
                                  const gapSize = 25 // Gap between cut line and cut-down part (mm)
                                  const cutDownX = cutPosition + gapSize
                                  const cutDownWidth = worktopWidth - cutPosition - gapSize
                                  return (
                                    <g>
                                      {/* Cut-down rectangle with diagonal pattern */}
                                      <rect
                                        x={cutDownX}
                                        y={0}
                                        width={cutDownWidth}
                                        height={worktopLength}
                                        fill="rgba(150, 180, 220, 0.2)"
                                        stroke="rgba(100, 150, 200, 0.5)"
                                        strokeWidth="1"
                                        strokeDasharray="5,5"
                                      />
                                      <rect
                                        x={cutDownX}
                                        y={0}
                                        width={cutDownWidth}
                                        height={worktopLength}
                                        fill="url(#diagonalHatch)"
                                      />
                                      {/* Red cut line */}
                                      <line
                                        x1={cutPosition}
                                        y1={0}
                                        x2={cutPosition}
                                        y2={worktopLength}
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                      />
                                    </g>
                                  )
                                })()}
                                
                                {/* Vertical cut part (top side) - drawn in SVG to match exact dimensions */}
                                {showVerticalCut && assemblyType !== 'Levágás' && (() => {
                                  const gapSize = 25 // Gap between cut line and cut-down part (mm)
                                  const cutDownY = 0
                                  const cutDownHeight = verticalCutHeight - gapSize
                                  return (
                                    <g>
                                      {/* Cut-down rectangle with diagonal pattern */}
                                      <rect
                                        x={0}
                                        y={cutDownY}
                                        width={worktopWidth}
                                        height={cutDownHeight}
                                        fill="rgba(150, 180, 220, 0.2)"
                                        stroke="rgba(100, 150, 200, 0.5)"
                                        strokeWidth="1"
                                        strokeDasharray="5,5"
                                      />
                                      <rect
                                        x={0}
                                        y={cutDownY}
                                        width={worktopWidth}
                                        height={cutDownHeight}
                                        fill="url(#diagonalHatch)"
                                      />
                                      {/* Red cut line */}
                                      <line
                                        x1={0}
                                        y1={verticalCutHeight}
                                        x2={worktopWidth}
                                        y2={verticalCutHeight}
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                      />
                                    </g>
                                  )
                                })()}
                                
                                {/* R1 label - For Összemarás Balos/jobbos/Összemarás: bottom-right corner of left perpendicular rectangle, otherwise: bottom-left corner of main worktop */}
                                {r1ValueRaw > 0 && (() => {
                                  if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && leftPerpendicularRectR1 > 0) {
                                    // R1 label for left perpendicular rectangle
                                    // For Balos: bottom-right corner at (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    // For Összemarás: bottom-LEFT corner (connection point) at (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    // For jobbos: at top-left (0, 0), bottom-right at (leftPerpendicularRectWidth, leftPerpendicularRectHeight)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    const r1 = leftPerpendicularRectR1
                                    
                                    // For all types: R1 is at bottom-right corner
                                    const bottomRightX = rectWidth
                                    const bottomRightY = rectY + rectHeight
                                    
                                    // Position label inside the corner, offset from the arc center
                                    // Arc center is at (bottomRightX - r1, bottomRightY - r1)
                                    // Place label at about 60% of the radius from the corner
                                    const labelX = bottomRightX - r1 * 0.6
                                    const labelY = bottomRightY - r1 * 0.6
                                    return (
                                      <text
                                        x={labelX}
                                        y={labelY}
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '60px',
                                      fontWeight: 600,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        R1
                                      </text>
                                    )
                                  } else if (assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos' && assemblyType !== 'Összemarás U alak (Nem működik még)' && r1Value > 0) {
                                    // R1 label for main worktop's bottom-left corner (only if not Összemarás Balos)
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    const bottomY = worktopLength
                                    // Position label inside the corner, offset from the arc center
                                    // Arc center is at (r1Value, bottomY - r1Value)
                                    // Place label at about 60% of the radius from the corner
                                    const labelX = r1Value * 0.6
                                    const labelY = bottomY - r1Value * 0.6
                                    // Only show if label is within the kept portion
                                    if (labelY < startY) return null
                                    return (
                                      <text
                                        x={labelX}
                                        y={labelY}
                                        textAnchor="start"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '60px',
                                          fontWeight: 600,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        R1
                                      </text>
                                    )
                                  }
                                  return null
                                })()}
                                
                                {/* R2 label (bottom-right corner of kept part) - positioned inside worktop close to corner */}
                                {/* For Összemarás: R2 applies to right rectangle, not main worktop */}
                                {r2Value > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)' && (() => {
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (rightEdge - r2Value, bottomY - r2Value)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = rightEdge - r2Value * 0.6
                                  const labelY = bottomY - r2Value * 0.6
                                  // Only show if label is within the kept portion
                                  if (labelY < startY || labelX > rightEdge || labelX < mainWorktopOffsetX) return null
                                  return (
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="end"
                                      dominantBaseline="middle"
                                      style={{
                                        fontSize: '60px',
                                fontWeight: 600,
                                        fill: '#1976d2',
                                      pointerEvents: 'none'
                                    }}
                                  >
                                    R2
                                    </text>
                                )
                              })()}
                                
                                {/* R3 label - For Összemarás Balos/jobbos: bottom-left corner of left perpendicular rectangle, otherwise: top-left corner of main worktop */}
                                {r3ValueRaw > 0 && (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && (() => {
                                  if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect) {
                                    // R3 label for left perpendicular rectangle's bottom-left corner
                                    // For Balos: at (0, worktopLength), bottom-left at (0, worktopLength + rectHeight)
                                    // For jobbos: at (0, 0), bottom-left at (0, rectHeight)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    const bottomLeftX = rectX
                                    const bottomLeftY = rectY + rectHeight
                                    const r3 = Math.min(r3ValueRaw, rectWidth / 2, rectHeight / 2)
                                    
                                    // Position label inside the corner, offset from the arc center
                                    // Arc center is at (bottomLeftX + r3, bottomLeftY - r3)
                                    // Place label at about 60% of the radius from the corner
                                    const labelX = bottomLeftX + r3 * 0.6
                                    const labelY = bottomLeftY - r3 * 0.6
                                    return (
                                      <text
                                        x={labelX}
                                        y={labelY}
                                        textAnchor="start"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '60px',
                                fontWeight: 600,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        R3
                                      </text>
                                    )
                                  } else {
                                    // R3 label for main worktop's top-left corner (Levágás, jobbos)
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                               (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    const topLeftX = mainWorktopOffsetX
                                    const topLeftY = startY
                                    // Position label inside the corner, offset from the arc center
                                    // Arc center is at (topLeftX + r3Value, topLeftY + r3Value)
                                    // Place label at about 60% of the radius from the corner
                                    const labelX = topLeftX + r3Value * 0.6
                                    const labelY = topLeftY + r3Value * 0.6
                                    return (
                                      <text
                                        x={labelX}
                                        y={labelY}
                                        textAnchor="start"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '60px',
                                          fontWeight: 600,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        R3
                                      </text>
                                    )
                                  }
                                })()}
                                
                                {/* R4 label (top-right corner) - only for Levágás, Összemarás Balos, Összemarás jobbos */}
                                {r4ValueRaw > 0 && (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && (() => {
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const topRightX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  const topRightY = startY
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (topRightX - r4Value, topRightY + r4Value)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = topRightX - r4Value * 0.6
                                  const labelY = topRightY + r4Value * 0.6
                                  return (
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="end"
                                      dominantBaseline="middle"
                                      style={{
                                        fontSize: '60px',
                                fontWeight: 600,
                                        fill: '#1976d2',
                                        pointerEvents: 'none'
                                      }}
                                    >
                                      R4
                                    </text>
                                  )
                                })()}
                                
                                {/* Front edge arrow indicator - only for Levágás */}
                                {assemblyType === 'Levágás' && (() => {
                                  const mainWorktopOffsetX = 0 // For Levágás, no offset
                                  
                                  // Calculate center of kept portion (remaining part after cut)
                                  const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                  
                                  // Center horizontally in kept portion
                                  const centerX = mainWorktopOffsetX + keptWidth / 2
                                  
                                  // Center vertically in worktop
                                  const centerY = keptHeight / 2
                                  const bottomY = keptHeight
                                  
                                  // Arrow dimensions - make it big
                                  const arrowLength = Math.min(150, (bottomY - centerY) * 0.8) // Length of arrow tail, but don't exceed available space
                                  const arrowHeadWidth = 60 // Width of arrowhead
                                  const arrowHeadHeight = 50 // Height of arrowhead
                                  const strokeWidth = 10 // Thickness of arrow tail
                                  
                                  // Arrow tail: vertical line from center pointing down toward bottom edge
                                  const tailStartY = centerY
                                  const tailEndY = Math.min(bottomY - arrowHeadHeight, centerY + arrowLength)
                                  
                                  // Arrowhead points
                                  const arrowTipY = tailEndY + arrowHeadHeight
                                  const arrowLeftX = centerX - arrowHeadWidth / 2
                                  const arrowRightX = centerX + arrowHeadWidth / 2
                                  
                                  return (
                                    <g>
                                      {/* Arrow tail - thick vertical line */}
                                      <line
                                        x1={centerX}
                                        y1={tailStartY}
                                        x2={centerX}
                                        y2={tailEndY}
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                      />
                                      
                                      {/* Arrowhead - large triangle pointing down */}
                                      <path
                                        d={`M ${centerX} ${arrowTipY} L ${arrowLeftX} ${tailEndY} L ${arrowRightX} ${tailEndY} Z`}
                                        fill="#1976d2"
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth / 2}
                                      />
                                    </g>
                                  )
                                })()}
                                
                                {/* Front edge arrow indicators for Összemarás Balos */}
                                {(assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) && (() => {
                                  // Arrow dimensions - make it big
                                  const arrowHeadWidth = 60 // Width of arrowhead
                                  const arrowHeadHeight = 50 // Height of arrowhead
                                  const strokeWidth = 10 // Thickness of arrow tail
                                  
                                  // Main worktop (A×B) arrow: center pointing downward
                                  const mainCenterX = aValue / 2
                                  const mainCenterY = bValue / 2
                                  const mainBottomY = bValue
                                  const mainArrowLength = Math.min(150, (mainBottomY - mainCenterY) * 0.8)
                                  const mainTailEndY = Math.min(mainBottomY - arrowHeadHeight, mainCenterY + mainArrowLength)
                                  const mainArrowTipY = mainTailEndY + arrowHeadHeight
                                  const mainArrowLeftX = mainCenterX - arrowHeadWidth / 2
                                  const mainArrowRightX = mainCenterX + arrowHeadWidth / 2
                                  
                                  // Perpendicular rectangle (C×D) arrow: center pointing right
                                  const perpRectX = 0
                                  const perpRectY = worktopLength // bValue
                                  const perpCenterX = perpRectX + dValue / 2
                                  const perpCenterY = perpRectY + cValue / 2
                                  const perpRightX = perpRectX + dValue
                                  const perpArrowLength = Math.min(150, (perpRightX - perpCenterX) * 0.8)
                                  const perpTailEndX = Math.min(perpRightX - arrowHeadHeight, perpCenterX + perpArrowLength)
                                  const perpArrowTipX = perpTailEndX + arrowHeadHeight
                                  const perpArrowTopY = perpCenterY - arrowHeadWidth / 2
                                  const perpArrowBottomY = perpCenterY + arrowHeadWidth / 2
                                  
                                  return (
                                    <g>
                                      {/* Main worktop (A×B) arrow - pointing down */}
                                      <line
                                        x1={mainCenterX}
                                        y1={mainCenterY}
                                        x2={mainCenterX}
                                        y2={mainTailEndY}
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                      />
                                      <path
                                        d={`M ${mainCenterX} ${mainArrowTipY} L ${mainArrowLeftX} ${mainTailEndY} L ${mainArrowRightX} ${mainTailEndY} Z`}
                                        fill="#1976d2"
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth / 2}
                                      />
                                      
                                      {/* Perpendicular rectangle (C×D) arrow - pointing right */}
                                      <line
                                        x1={perpCenterX}
                                        y1={perpCenterY}
                                        x2={perpTailEndX}
                                        y2={perpCenterY}
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                      />
                                      <path
                                        d={`M ${perpArrowTipX} ${perpCenterY} L ${perpTailEndX} ${perpArrowTopY} L ${perpTailEndX} ${perpArrowBottomY} Z`}
                                        fill="#1976d2"
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth / 2}
                                      />
                                    </g>
                                  )
                                })()}
                                
                                {/* Front edge arrow indicators for Összemarás jobbos */}
                                {(assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) && (() => {
                                  // Arrow dimensions - make it big
                                  const arrowHeadWidth = 60 // Width of arrowhead
                                  const arrowHeadHeight = 50 // Height of arrowhead
                                  const strokeWidth = 10 // Thickness of arrow tail
                                  
                                  // Main worktop (A×B) arrow: center pointing downward
                                  const mainWorktopOffsetX = leftPerpendicularRectWidth // dValue
                                  const mainCenterX = mainWorktopOffsetX + aValue / 2
                                  const mainCenterY = bValue / 2
                                  const mainBottomY = bValue
                                  const mainArrowLength = Math.min(150, (mainBottomY - mainCenterY) * 0.8)
                                  const mainTailEndY = Math.min(mainBottomY - arrowHeadHeight, mainCenterY + mainArrowLength)
                                  const mainArrowTipY = mainTailEndY + arrowHeadHeight
                                  const mainArrowLeftX = mainCenterX - arrowHeadWidth / 2
                                  const mainArrowRightX = mainCenterX + arrowHeadWidth / 2
                                  
                                  // Perpendicular rectangle (C×D) arrow: center pointing right
                                  const perpRectX = 0
                                  const perpRectY = 0
                                  const perpCenterX = perpRectX + dValue / 2
                                  const perpCenterY = perpRectY + cValue / 2
                                  const perpRightX = perpRectX + dValue
                                  const perpArrowLength = Math.min(150, (perpRightX - perpCenterX) * 0.8)
                                  const perpTailEndX = Math.min(perpRightX - arrowHeadHeight, perpCenterX + perpArrowLength)
                                  const perpArrowTipX = perpTailEndX + arrowHeadHeight
                                  const perpArrowTopY = perpCenterY - arrowHeadWidth / 2
                                  const perpArrowBottomY = perpCenterY + arrowHeadWidth / 2
                                  
                                  return (
                                    <g>
                                      {/* Main worktop (A×B) arrow - pointing down */}
                                      <line
                                        x1={mainCenterX}
                                        y1={mainCenterY}
                                        x2={mainCenterX}
                                        y2={mainTailEndY}
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                      />
                                      <path
                                        d={`M ${mainCenterX} ${mainArrowTipY} L ${mainArrowLeftX} ${mainTailEndY} L ${mainArrowRightX} ${mainTailEndY} Z`}
                                        fill="#1976d2"
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth / 2}
                                      />
                                      
                                      {/* Perpendicular rectangle (C×D) arrow - pointing right */}
                                      <line
                                        x1={perpCenterX}
                                        y1={perpCenterY}
                                        x2={perpTailEndX}
                                        y2={perpCenterY}
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                      />
                                      <path
                                        d={`M ${perpArrowTipX} ${perpCenterY} L ${perpTailEndX} ${perpArrowTopY} L ${perpTailEndX} ${perpArrowBottomY} Z`}
                                        fill="#1976d2"
                                        stroke="#1976d2"
                                        strokeWidth={strokeWidth / 2}
                                      />
                                    </g>
                                  )
                                })()}
                          </Box>
                              
                              



                            </Box>
                          </>
                        )
                      })()
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          border: '1px dashed #ccc',
                          backgroundColor: '#fafafa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 200
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Válasszon munkalapot a vizualizáció megjelenítéséhez
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
      )}

      {/* Saved Configurations Table */}
      {savedConfigs.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Mentett konfigurációk
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Munkalap típusa</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Összeállítás típusa</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Műveletek</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {savedConfigs.map((config) => (
                  <TableRow
                    key={config.id}
                    onClick={() => loadConfiguration(config)}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: editingConfigId === config.id ? 'action.selected' : 'inherit',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <TableCell>{getMaterialName(config.selectedLinearMaterialId)}</TableCell>
                    <TableCell>{config.assemblyType || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConfiguration(config.id)
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="warning"
              onClick={calculateQuote}
            >
              Ajánlat generálás
            </Button>
            {quoteResult && (
              <Button
                variant="contained"
                color="primary"
                onClick={saveQuote}
                disabled={isSavingQuote}
              >
                {isSavingQuote ? 'Mentés...' : 'Ajánlat mentés'}
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* Árajánlat (Quote) Accordion */}
      {quoteResult && (
        <Box sx={{ mt: 4 }}>
          <Accordion defaultExpanded={true}>
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
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>Végösszeg</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{formatPrice(quoteResult.grand_total_gross, quoteResult.currency)}</Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                  />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
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
                  
                  {/* Costs Table */}
                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>Költség típusa</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Nettó</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>ÁFA</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bruttó</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            Anyag költség
                            {material.anyag_koltseg_details && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {material.anyag_koltseg_details}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{formatPrice(material.anyag_koltseg_net, material.currency)}</TableCell>
                          <TableCell align="right">{formatPrice(material.anyag_koltseg_vat, material.currency)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.anyag_koltseg_gross, material.currency)}</TableCell>
                        </TableRow>
                        {material.kereszt_vagas_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Kereszt vágás
                              {material.kereszt_vagas_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.kereszt_vagas_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.kereszt_vagas_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.kereszt_vagas_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.kereszt_vagas_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        {material.hosszanti_vagas_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Hosszanti vágás
                              {material.hosszanti_vagas_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.hosszanti_vagas_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.hosszanti_vagas_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.hosszanti_vagas_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.hosszanti_vagas_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        {material.ives_vagas_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Íves vágás
                              {material.ives_vagas_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.ives_vagas_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.ives_vagas_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.ives_vagas_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.ives_vagas_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        {material.szogvagas_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Szögvágás
                              {material.szogvagas_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.szogvagas_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.szogvagas_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.szogvagas_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.szogvagas_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        {material.kivagas_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Kivágás
                              {material.kivagas_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.kivagas_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.kivagas_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.kivagas_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.kivagas_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        {material.elzaro_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Élzáró
                              {material.elzaro_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.elzaro_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.elzaro_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.elzaro_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.elzaro_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        {material.osszemaras_net > 0 && (
                          <TableRow>
                            <TableCell>
                              Összemarás
                              {material.osszemaras_details && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {material.osszemaras_details}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatPrice(material.osszemaras_net, material.currency)}</TableCell>
                            <TableCell align="right">{formatPrice(material.osszemaras_vat, material.currency)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatPrice(material.osszemaras_gross, material.currency)}</TableCell>
                          </TableRow>
                        )}
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell colSpan={1} sx={{ fontWeight: 'bold' }}>{material.material_name} összesen:</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_net, material.currency)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_vat, material.currency)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPrice(material.total_gross, material.currency)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

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
        </Box>
      )}
    </Box>
  )
}

