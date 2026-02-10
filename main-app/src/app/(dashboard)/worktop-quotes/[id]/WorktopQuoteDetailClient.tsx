'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

import { 
  Box, 
  Typography, 
  Paper,
  Grid,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Card,
  CardContent
} from '@mui/material'

// Dynamic import for Barcode to avoid SSR issues
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

import { 
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ShoppingCart as OrderIcon,
  Payment as PaymentIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { CircularProgress } from '@mui/material'

import { usePermissions } from '@/contexts/PermissionContext'
import EditDiscountModal from '@/app/(dashboard)/quotes/[quote_id]/EditDiscountModal'
import CommentModal from '@/app/(dashboard)/quotes/[quote_id]/CommentModal'
import CreateOrderModal from '@/app/(dashboard)/quotes/[quote_id]/CreateOrderModal'
import AddPaymentModal from '@/app/(dashboard)/orders/[order_id]/AddPaymentModal'
import AssignProductionModal from '@/app/(dashboard)/worktop-orders/[order_id]/AssignProductionModal'
import QuoteFeesSection from '@/app/(dashboard)/quotes/[quote_id]/QuoteFeesSection'
import AddFeeModal from '@/app/(dashboard)/quotes/[quote_id]/AddFeeModal'

interface TenantCompany {
  id: string
  name: string
  country: string
  postal_code: string
  city: string
  address: string
  phone_number: string
  email: string
  website: string
  tax_number: string
  company_registration_number: string
  vat_id: string
}

interface WorktopQuoteData {
  id: string
  quote_number: string
  order_number?: string | null
  status: string
  customer_id: string
  discount_percent: number
  comment?: string | null
  payment_status?: string
  production_machine_id?: string | null
  production_date?: string | null
  barcode?: string | null
  total_net: number
  total_vat: number
  total_gross: number
  final_total_after_discount: number
  created_at: string
  updated_at: string
  customers: {
    id: string
    name: string
    email: string | null
    mobile: string | null
    discount_percent: number
    billing_name: string | null
    billing_country: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_street: string | null
    billing_house_number: string | null
    billing_tax_number: string | null
    billing_company_reg_number: string | null
  }
  payments?: Array<{
    id: string
    amount: number
    payment_method: string
    comment: string | null
    payment_date: string
    created_at: string
  }>
  fees?: Array<{
    id: string
    fee_name: string
    quantity: number
    unit_price_net: number
    vat_rate: number
    vat_amount: number
    gross_price: number
    currency_id: string
    comment: string | null
  }>
  configs: Array<{
    id: string
    config_order: number
    assembly_type: string
    linear_material_id: string
    linear_material_name: string
    dimension_a: number
    dimension_b: number
    dimension_c: number | null
    dimension_d: number | null
    rounding_r1: number | null
    rounding_r2: number | null
    rounding_r3: number | null
    rounding_r4: number | null
    cut_l1: number | null
    cut_l2: number | null
    cut_l3: number | null
    cut_l4: number | null
    cut_l5: number | null
    cut_l6: number | null
    cut_l7: number | null
    cut_l8: number | null
    cutouts: string | null
    edge_position1: boolean
    edge_position2: boolean
    edge_position3: boolean
    edge_position4: boolean
    edge_position5: boolean | null
    edge_position6: boolean | null
    linear_materials?: {
      id: string
      name: string
      length: number | null
    } | null
  }>
  pricing: Array<{
    id: string
    config_order: number
    material_id: string
    material_name: string
    anyag_koltseg_net: number
    anyag_koltseg_gross: number
    kereszt_vagas_net: number
    kereszt_vagas_gross: number
    hosszanti_vagas_net: number
    hosszanti_vagas_gross: number
    ives_vagas_net: number
    ives_vagas_gross: number
    szogvagas_net: number
    szogvagas_gross: number
    kivagas_net: number
    kivagas_gross: number
    elzaro_net: number
    elzaro_gross: number
    elzaro_details: string | null
    osszemaras_net: number
    osszemaras_gross: number
    hosszanti_vagas_details: string | null
    ives_vagas_details: string | null
    szogvagas_details: string | null
    kivagas_details: string | null
    linear_materials?: {
      id: string
      name: string
      length: number | null
    } | null
  }>
}

interface Machine {
  id: string
  machine_name: string
  comment: string | null
}

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_percent: number
  gross_price: number
}

interface WorktopQuoteDetailClientProps {
  initialQuoteData: WorktopQuoteData
  tenantCompany: TenantCompany | null
  machines: Machine[]
  feeTypes: FeeType[]
}

export default function WorktopQuoteDetailClient({ initialQuoteData, tenantCompany, machines, feeTypes }: WorktopQuoteDetailClientProps) {
  const router = useRouter()
  const { canAccess } = usePermissions()
  const hasAccess = canAccess('/worktop-quotes')
  
  const [quoteData, setQuoteData] = useState<WorktopQuoteData>(initialQuoteData)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false)
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false)
  const [assignProductionModalOpen, setAssignProductionModalOpen] = useState(false)
  const [addFeeModalOpen, setAddFeeModalOpen] = useState(false)
  
  // Determine if this is an order view (has order_number)
  const isOrderView = Boolean(quoteData.order_number)

  // Format currency with thousands separator
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Helper function to sanitize barcode for CODE128
  // Removes/replaces special characters (accented letters, non-ASCII)
  const sanitizeBarcodeForCODE128 = (barcode: string): string => {
    // Replace common Hungarian accented characters
    const replacements: Record<string, string> = {
      'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ö': 'o', 'ő': 'o', 'ú': 'u', 'ü': 'u', 'ű': 'u',
      'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ö': 'O', 'Ő': 'O', 'Ú': 'U', 'Ü': 'U', 'Ű': 'U'
    }
    
    let sanitized = barcode
    Object.entries(replacements).forEach(([from, to]) => {
      sanitized = sanitized.replace(new RegExp(from, 'g'), to)
    })
    
    // Remove any remaining non-ASCII characters (keep only 0-127)
    return sanitized.replace(/[^\x00-\x7F]/g, '')
  }

  // Calculate total meters for each material+assembly_type combination (grouped by material_id AND assembly_type)
  const materialsGrouped = useMemo(() => {
    const materialMap = new Map<string, {
      material_id: string
      material_name: string
      assembly_type: string
      totalMeters: number
      totalNet: number
      totalGross: number
      boards_used?: number
      boards_shared?: boolean
      configs_count?: number
    }>()

    // First, calculate board sharing info by grouping all configs by material_id only
    const materialBoardInfo = new Map<string, {
      totalLengthNeeded: number
      configs: Array<{ config: typeof quoteData.configs[0], pricing: typeof quoteData.pricing[0], length: number, pieces: number[] }>
    }>()

    quoteData.configs.forEach(config => {
      const pricing = quoteData.pricing.find(p => p.config_order === config.config_order)
      // Use config.linear_material_id as primary, fallback to pricing.material_id
      const materialId = config.linear_material_id || pricing?.material_id
      if (!materialId) return

      if (!materialBoardInfo.has(materialId)) {
        materialBoardInfo.set(materialId, {
          totalLengthNeeded: 0,
          configs: []
        })
      }

      const group = materialBoardInfo.get(materialId)!
      
      let configLength = 0
      let pieces: number[] = [] // For Balos/Jobbos, we need separate pieces
      
      if (config.assembly_type === 'Levágás') {
        configLength = config.dimension_a || 0
        pieces = [configLength]
      } else if (config.assembly_type === 'Összemarás Balos') {
        // Balos: two separate pieces - A and (C-D)
        const piece1 = config.dimension_a || 0
        const piece2 = (config.dimension_c || 0) - (config.dimension_d || 0)
        pieces = [piece1, piece2]
        configLength = piece1 + piece2
      } else if (config.assembly_type === 'Összemarás jobbos') {
        // Jobbos: two separate pieces - (A-D) and C
        const piece1 = (config.dimension_a || 0) - (config.dimension_d || 0)
        const piece2 = config.dimension_c || 0
        pieces = [piece1, piece2]
        configLength = piece1 + piece2
      }

      group.totalLengthNeeded += configLength
      if (pricing) {
        group.configs.push({ config, pricing, length: configLength, pieces })
      }
    })

    // Get material lengths from configs or pricing (prefer configs as they have the direct relation)
    const materialLengths = new Map<string, number>()
    
    // First, try to get from configs (more reliable)
    quoteData.configs.forEach(config => {
      if (config.linear_material_id) {
        const length = config.linear_materials?.length
        if (length && length > 0) {
          materialLengths.set(config.linear_material_id, length)
        }
      }
    })
    
    // Also get from pricing and map to both material_id and config's linear_material_id
    quoteData.pricing.forEach(p => {
      const config = quoteData.configs.find(c => c.config_order === p.config_order)
      const materialId = config?.linear_material_id || p.material_id
      
      if (materialId && !materialLengths.has(materialId)) {
        // Try to get from pricing's linear_materials relation
        const length = p.linear_materials?.length
        if (length && length > 0) {
          materialLengths.set(materialId, length)
        } else if (config?.linear_materials?.length && config.linear_materials.length > 0) {
          // Fallback to config's linear_materials
          materialLengths.set(materialId, config.linear_materials.length)
        } else {
          // Last resort: use 3000mm as default (should rarely happen)
          materialLengths.set(materialId, 3000)
        }
      }
      
      // Also store for pricing.material_id if different
      if (p.material_id && p.material_id !== materialId && !materialLengths.has(p.material_id)) {
        const length = p.linear_materials?.length || materialLengths.get(materialId)
        if (length && length > 0) {
          materialLengths.set(p.material_id, length)
        }
      }
    })

    // Calculate boards needed for each material using bin packing (once per material)
    // For Balos/Jobbos, we need to pack pieces separately
    const materialBoardsNeeded = new Map<string, number>()
    materialBoardInfo.forEach((boardGroup, materialId) => {
      const materialLength = materialLengths.get(materialId) || 3000
      
      // Use bin packing algorithm to calculate actual boards needed
      // Create a list of all pieces to pack (each piece from each config)
      const piecesToPack: Array<{ pieceLength: number }> = []
      
      for (const { pieces } of boardGroup.configs) {
        // For each piece in this config, add it to the packing list
        pieces.forEach(pieceLength => {
          piecesToPack.push({ pieceLength })
        })
      }
      
      // Sort pieces by length (largest first) for better packing
      piecesToPack.sort((a, b) => b.pieceLength - a.pieceLength)
      
      const boards: number[] = [] // Each board tracks remaining length
      
      for (const { pieceLength } of piecesToPack) {
        // Try to find a board with enough remaining space
        let placed = false
        for (let i = 0; i < boards.length; i++) {
          if (boards[i] >= pieceLength) {
            // Place on existing board
            boards[i] -= pieceLength
            placed = true
            break
          }
        }
        
        // If no board has enough space, start a new board
        if (!placed) {
          boards.push(materialLength - pieceLength)
        }
      }
      
      const boardsNeeded = boards.length || 1
      materialBoardsNeeded.set(materialId, boardsNeeded)
    })

    // Group pricing by material_id AND assembly_type (from config)
    quoteData.pricing.forEach(pricing => {
      const config = quoteData.configs.find(c => c.config_order === pricing.config_order)
      if (!config) return

      // Create unique key: material_id + assembly_type
      const key = `${pricing.material_id}_${config.assembly_type}`
      const existing = materialMap.get(key)
      
      if (existing) {
        existing.totalNet += pricing.anyag_koltseg_net
        existing.totalGross += pricing.anyag_koltseg_gross
      } else {
        // Get board info for this material - use config.linear_material_id as primary
        const materialId = config.linear_material_id || pricing.material_id || ''
        const boardGroup = materialBoardInfo.get(materialId)
        const boardsNeeded = materialBoardsNeeded.get(materialId) || 1
        const boardsShared = boardGroup ? boardGroup.configs.length > 1 : false

        materialMap.set(key, {
          material_id: pricing.material_id,
          material_name: pricing.material_name,
          assembly_type: config.assembly_type,
          totalMeters: 0,
          totalNet: pricing.anyag_koltseg_net,
          totalGross: pricing.anyag_koltseg_gross,
          boards_used: boardsNeeded,
          boards_shared: boardsShared,
          configs_count: boardGroup?.configs.length || 1
        })
      }
    })

    // Calculate meters from configs
    quoteData.configs.forEach(config => {
      const pricing = quoteData.pricing.find(p => p.config_order === config.config_order)
      if (!pricing) return

      let meters = 0
      if (config.assembly_type === 'Levágás') {
        meters = config.dimension_a / 1000 // A in meters
      } else if (config.assembly_type === 'Összemarás Balos') {
        meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
      } else if (config.assembly_type === 'Összemarás jobbos') {
        meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
      }

      // Find the material entry using material_id + assembly_type key
      const key = `${pricing.material_id}_${config.assembly_type}`
      const material = materialMap.get(key)
      if (material) {
        material.totalMeters += meters
      }
    })

    return Array.from(materialMap.values())
  }, [quoteData])

  // Calculate individual service totals (sum of all service fees by type)
  const servicesBreakdown = useMemo(() => {
    const acc = {
      osszemaras: { quantity: 0, net: 0, gross: 0 },
      kereszt_vagas: { quantity: 0, net: 0, gross: 0 },
      hosszanti_vagas: { quantity: 0, net: 0, gross: 0 },
      ives_vagas: { quantity: 0, net: 0, gross: 0 },
      szogvagas: { quantity: 0, net: 0, gross: 0 },
      kivagas: { quantity: 0, net: 0, gross: 0 },
      elzaro: { quantity: 0, net: 0, gross: 0 }
    }

    // Process each pricing entry
    quoteData.pricing.forEach(p => {
      // Összemarás: count configs with Balos or jobbos type
      if (p.osszemaras_gross > 0) {
        acc.osszemaras.quantity += 1
        acc.osszemaras.net += (p.osszemaras_net || 0)
        acc.osszemaras.gross += (p.osszemaras_gross || 0)
      }
      
      // Kereszt vágás: parse count from details string (e.g., "4 × 2100 Ft = 8400 Ft")
      if (p.kereszt_vagas_gross > 0) {
        // Try to extract count from details string
        const details = p.kereszt_vagas_details || ''
        const countMatch = details.match(/^(\d+)\s*×/)
        const count = countMatch ? parseInt(countMatch[1], 10) : 1
        
        acc.kereszt_vagas.quantity += count
        acc.kereszt_vagas.net += (p.kereszt_vagas_net || 0)
        acc.kereszt_vagas.gross += (p.kereszt_vagas_gross || 0)
      }
      
      // Hosszanti vágás: sum meters from details
      if (p.hosszanti_vagas_gross > 0) {
        // Extract meters from details string (e.g., "2.50m × 1500 = 3 750 HUF")
        const details = p.hosszanti_vagas_details || ''
        const meterMatches = details.match(/(\d+\.?\d*)m/g)
        if (meterMatches) {
          meterMatches.forEach(match => {
            const meters = parseFloat(match.replace('m', ''))
            acc.hosszanti_vagas.quantity += meters
          })
        } else {
          // Fallback: calculate from config
          const config = quoteData.configs.find(c => c.config_order === p.config_order)
          if (config) {
            let meters = 0
            if (config.assembly_type === 'Levágás') {
              meters = config.dimension_a / 1000
            } else if (config.assembly_type === 'Összemarás Balos') {
              meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
            } else if (config.assembly_type === 'Összemarás jobbos') {
              meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
            }
            acc.hosszanti_vagas.quantity += meters
          }
        }
        acc.hosszanti_vagas.net += (p.hosszanti_vagas_net || 0)
        acc.hosszanti_vagas.gross += (p.hosszanti_vagas_gross || 0)
      }
      
      // Íves vágás: count rounding values (R1, R2, R3, R4) from config
      if (p.ives_vagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        if (config) {
          let roundingCount = 0
          if (config.rounding_r1 && config.rounding_r1 > 0) roundingCount++
          if (config.rounding_r2 && config.rounding_r2 > 0) roundingCount++
          if (config.rounding_r3 && config.rounding_r3 > 0) roundingCount++
          if (config.rounding_r4 && config.rounding_r4 > 0) roundingCount++
          acc.ives_vagas.quantity += roundingCount
        } else {
          // Fallback: count from details
          const details = p.ives_vagas_details || ''
          const roundingCount = (details.match(/R\d+/g) || []).length || 1
          acc.ives_vagas.quantity += roundingCount
        }
        acc.ives_vagas.net += (p.ives_vagas_net || 0)
        acc.ives_vagas.gross += (p.ives_vagas_gross || 0)
      }
      
      // Szögvágás: count groups (L1-L2, L3-L4, L5-L6, L7-L8) from config
      if (p.szogvagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        if (config) {
          let groupCount = 0
          if (config.cut_l1 && config.cut_l1 > 0 && config.cut_l2 && config.cut_l2 > 0) groupCount++
          if (config.cut_l3 && config.cut_l3 > 0 && config.cut_l4 && config.cut_l4 > 0) groupCount++
          if (config.cut_l5 && config.cut_l5 > 0 && config.cut_l6 && config.cut_l6 > 0) groupCount++
          if (config.cut_l7 && config.cut_l7 > 0 && config.cut_l8 && config.cut_l8 > 0) groupCount++
          acc.szogvagas.quantity += groupCount
        } else {
          // Fallback: count from details
          const details = p.szogvagas_details || ''
          const groupCount = (details.match(/L\d+-L\d+/g) || []).length || 1
          acc.szogvagas.quantity += groupCount
        }
        acc.szogvagas.net += (p.szogvagas_net || 0)
        acc.szogvagas.gross += (p.szogvagas_gross || 0)
      }
      
      // Kivágás: count cutouts from config
      if (p.kivagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        if (config && config.cutouts) {
          try {
            const cutouts = JSON.parse(config.cutouts)
            acc.kivagas.quantity += Array.isArray(cutouts) ? cutouts.length : 1
          } catch {
            acc.kivagas.quantity += 1
          }
        } else {
          acc.kivagas.quantity += 1
        }
        acc.kivagas.net += (p.kivagas_net || 0)
        acc.kivagas.gross += (p.kivagas_gross || 0)
      }
      
      // Élzáró: sum meters from details
      if (p.elzaro_gross > 0) {
        // Extract meters from details string (e.g., "5.00m × 1 800 HUF = 27 000 HUF")
        const details = p.elzaro_details || ''
        const meterMatches = details.match(/(\d+\.?\d*)m/g)
        if (meterMatches) {
          meterMatches.forEach(match => {
            const meters = parseFloat(match.replace('m', ''))
            acc.elzaro.quantity += meters
          })
        } else {
          // Fallback: calculate from config edges
          const config = quoteData.configs.find(c => c.config_order === p.config_order)
          if (config) {
            let meters = 0
            if (config.assembly_type === 'Levágás') {
              if (config.edge_position1) meters += config.dimension_b / 1000
              if (config.edge_position2) meters += config.dimension_a / 1000
              if (config.edge_position3) meters += config.dimension_b / 1000
              if (config.edge_position4) meters += config.dimension_a / 1000
            } else if (config.assembly_type === 'Összemarás Balos') {
              if (config.edge_position1) meters += config.dimension_c / 1000
              if (config.edge_position2) meters += config.dimension_a / 1000
              if (config.edge_position3) meters += config.dimension_b / 1000
              if (config.edge_position4) meters += (config.dimension_a - (config.dimension_d || 0)) / 1000
              if (config.edge_position5) meters += (config.dimension_c - (config.dimension_b || 0)) / 1000
              if (config.edge_position6) meters += (config.dimension_d || 0) / 1000
            } else if (config.assembly_type === 'Összemarás jobbos') {
              if (config.edge_position1) meters += config.dimension_c / 1000
              if (config.edge_position2) meters += config.dimension_a / 1000
              if (config.edge_position3) meters += config.dimension_b / 1000
              if (config.edge_position4) meters += (config.dimension_a - (config.dimension_d || 0)) / 1000
              if (config.edge_position5) meters += (config.dimension_c - (config.dimension_b || 0)) / 1000
              if (config.edge_position6) meters += (config.dimension_d || 0) / 1000
            }
            acc.elzaro.quantity += meters
          }
        }
        acc.elzaro.net += (p.elzaro_net || 0)
        acc.elzaro.gross += (p.elzaro_gross || 0)
      }
    })

    return acc
  }, [quoteData])

  // Calculate total services for summary
  const servicesTotals = useMemo(() => {
    return {
      net: servicesBreakdown.osszemaras.net +
           servicesBreakdown.kereszt_vagas.net +
           servicesBreakdown.hosszanti_vagas.net +
           servicesBreakdown.ives_vagas.net +
           servicesBreakdown.szogvagas.net +
           servicesBreakdown.kivagas.net +
           servicesBreakdown.elzaro.net,
      gross: servicesBreakdown.osszemaras.gross +
              servicesBreakdown.kereszt_vagas.gross +
              servicesBreakdown.hosszanti_vagas.gross +
              servicesBreakdown.ives_vagas.gross +
              servicesBreakdown.szogvagas.gross +
              servicesBreakdown.kivagas.gross +
              servicesBreakdown.elzaro.gross
    }
  }, [servicesBreakdown])

  // Calculate materials total
  const materialsTotal = useMemo(() => {
    return materialsGrouped.reduce((sum, m) => sum + m.totalGross, 0)
  }, [materialsGrouped])

  const handleEdit = () => {
    router.push(`/worktop-config?id=${quoteData.id}`)
  }

  // Handle refresh quote data
  const refreshQuoteData = async () => {
    try {
      const response = await fetch(`/api/worktop-quotes/${quoteData.id}`)
      if (response.ok) {
        const updatedQuote = await response.json()
        setQuoteData(updatedQuote)
      }
    } catch (error) {
      console.error('Error refreshing worktop quote:', error)
    }
  }

  // Handle edit discount
  const handleEditDiscount = () => {
    setDiscountModalOpen(true)
  }

  const handleDiscountUpdated = () => {
    refreshQuoteData()
  }

  // Handle edit comment
  const handleEditComment = () => {
    setCommentModalOpen(true)
  }

  // Handle create order
  const handleCreateOrder = () => {
    setCreateOrderModalOpen(true)
  }

  // Handle order creation success
  const handleOrderCreated = (quoteId: string, orderNumber: string) => {
    // Redirect to worktop order detail page (same ID, different URL)
    router.push(`/worktop-orders/${quoteId}`)
  }

  // Handle payment added success
  const handlePaymentAdded = async () => {
    await refreshQuoteData()
  }

  // Handle production assigned success
  const handleProductionAssigned = async () => {
    await refreshQuoteData()
  }

  // Handle add fee
  const handleAddFee = () => {
    setAddFeeModalOpen(true)
  }

  // Handle fee added
  const handleFeeAdded = () => {
    refreshQuoteData()
  }

  const handleSaveComment = async (comment: string) => {
    try {
      console.log('[CLIENT] Saving comment for worktop quote:', quoteData.id)
      console.log('[CLIENT] Comment value:', comment)
      console.log('[CLIENT] API URL:', `/api/worktop-quotes/${quoteData.id}/comment`)
      
      const response = await fetch(`/api/worktop-quotes/${quoteData.id}/comment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: comment || null }),
      })

      console.log('[CLIENT] Response status:', response.status)
      console.log('[CLIENT] Response ok:', response.ok)

      if (!response.ok) {
        const error = await response.json()
        console.error('[CLIENT] API error response:', error)
        throw new Error(error.error || 'Failed to save comment')
      }

      const result = await response.json()
      console.log('[CLIENT] Comment saved successfully:', result)

      toast.success('Megjegyzés sikeresen mentve!', {
        position: "top-right",
        autoClose: 3000,
      })

      refreshQuoteData()
    } catch (error) {
      console.error('[CLIENT] Error saving comment:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a megjegyzés mentésekor')
      throw error
    }
  }

  // Handle PDF generation via server-side Puppeteer
  const handleGeneratePdf = async () => {
    if (!quoteData || !quoteData.id) {
      toast.error('A munkalap ajánlat szükséges a PDF generálásához')
      return
    }

    setIsGeneratingPdf(true)
    try {
      // Call server-side PDF generation API
      const response = await fetch(`/api/worktop-quotes/${quoteData.id}/pdf`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }))
        throw new Error(errorData.error || 'Hiba történt a PDF generálása során')
      }

      // Get PDF blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Munkalap-Arajanlat-${quoteData.quote_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF sikeresen generálva és letöltve')
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      toast.error('Hiba történt a PDF generálása során: ' + (error.message || 'Ismeretlen hiba'))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'error'
      case 'ordered':
        return 'success'
      case 'in_production':
        return 'warning'
      case 'ready':
        return 'info'
      case 'finished':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'info'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Piszkozat'
      case 'ordered':
        return 'Megrendelve'
      case 'in_production':
        return 'Gyártásban'
      case 'ready':
        return 'Leadva'
      case 'finished':
        return 'Átadva'
      case 'cancelled':
        return 'Törölve'
      default:
        return status
    }
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a munkalap ajánlat megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  // Handle back navigation
  const handleBack = () => {
    if (isOrderView) {
      router.push('/worktop-orders')
    } else {
      router.push('/worktop-quotes')
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }} className="no-print">
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isOrderView ? `Megrendelés: ${quoteData.order_number || quoteData.quote_number}` : `Árajánlat: ${quoteData.quote_number}`}
        </Typography>
        <Chip 
          label={getStatusLabel(quoteData.status)} 
          color={getStatusColor(quoteData.status)}
          sx={{ ml: 2 }}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Quote Details */}
        <Grid item xs={12} md={9}>
          {/* First Card - All Quote Information */}
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
            {/* Company Info and Barcode */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={quoteData.barcode ? 7 : 12}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: 2,
                  height: '100%'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {tenantCompany ? (
                      <>
                        <strong>{tenantCompany.name}</strong><br />
                        {tenantCompany.postal_code} {tenantCompany.city}, {tenantCompany.address}<br />
                        {tenantCompany.tax_number && `Adószám: ${tenantCompany.tax_number}`}<br />
                        {tenantCompany.company_registration_number && `Cégjegyzékszám: ${tenantCompany.company_registration_number}`}<br />
                        {tenantCompany.email && `Email: ${tenantCompany.email}`}<br />
                        {tenantCompany.phone_number && `Tel: ${tenantCompany.phone_number}`}
                      </>
                    ) : (
                      <>
                        Turinova Kft.<br />
                        Budapest, Hungary<br />
                        Adószám: 12345678-1-41
                      </>
                    )}
                  </Typography>
                </Box>
              </Grid>
              
              {/* Barcode Display - Only for orders with barcode */}
              {quoteData.barcode && (
                <Grid item xs={12} md={5}>
                  <Box sx={{ 
                    p: 2, 
                    backgroundColor: '#ffffff', 
                    borderRadius: 2,
                    border: '2px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%'
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      Vonalkód
                    </Typography>
                    <Barcode 
                      value={quoteData.barcode} 
                      format="EAN13"
                      width={2}
                      height={60}
                      displayValue={false}
                      fontSize={14}
                      margin={5}
                    />
                    <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', letterSpacing: 2 }}>
                      {quoteData.barcode}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>

            {/* Customer & Billing Info */}
            <Grid container spacing={4} sx={{ mb: 4 }}>
              {/* Customer Info */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1,
                  backgroundColor: '#fcfcfc',
                  height: '100%'
                }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Ügyfél adatok
                  </Typography>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong>{quoteData.customers.name}</strong><br />
                    {quoteData.customers.email && (
                      <>
                        {quoteData.customers.email}<br />
                      </>
                    )}
                    {quoteData.customers.mobile && quoteData.customers.mobile}
                  </Typography>
                </Box>
              </Grid>

              {/* Billing Details */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1,
                  backgroundColor: '#fcfcfc',
                  height: '100%'
                }}>
                  {quoteData.customers.billing_name ? (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                        Számlázási adatok
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        <strong>{quoteData.customers.billing_name}</strong><br />
                        {quoteData.customers.billing_postal_code} {quoteData.customers.billing_city}<br />
                        {quoteData.customers.billing_street} {quoteData.customers.billing_house_number}<br />
                        {quoteData.customers.billing_country}
                        {quoteData.customers.billing_tax_number && (
                          <>
                            <br />Adószám: {quoteData.customers.billing_tax_number}
                          </>
                        )}
                        {quoteData.customers.billing_company_reg_number && (
                          <>
                            <br />Cégjegyzékszám: {quoteData.customers.billing_company_reg_number}
                          </>
                        )}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                        Számlázási adatok
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Nincs számlázási adat megadva
                      </Typography>
                    </>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Quote Summary */}
            <Divider sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, textAlign: 'center' }}>
              Árajánlat összesítése
            </Typography>
            
            {/* Materials Breakdown */}
            <Box sx={{ 
              mb: 4, 
              p: 2, 
              border: '1px solid #e0e0e0', 
              borderRadius: 1,
              backgroundColor: '#fcfcfc'
            }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Anyag</strong></TableCell>
                      <TableCell align="right"><strong>Mennyiség</strong></TableCell>
                      <TableCell align="right"><strong>Nettó ár</strong></TableCell>
                      <TableCell align="right"><strong>Bruttó ár</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {materialsGrouped.length > 0 ? (
                      materialsGrouped.map((material, index) => (
                        <TableRow key={`${material.material_id}_${material.assembly_type}_${index}`}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {material.material_name}
                              </Typography>
                              {material.boards_shared && material.boards_used && (
                                <Typography variant="caption" sx={{ 
                                  display: 'block', 
                                  color: 'info.main',
                                  fontSize: '0.7rem',
                                  mt: 0.5
                                }}>
                                  📦 {material.boards_used} tábla megosztva {material.configs_count} konfiguráció között
                                </Typography>
                              )}
                              {!material.boards_shared && material.boards_used && (
                                <Typography variant="caption" sx={{ 
                                  display: 'block', 
                                  color: 'text.secondary',
                                  fontSize: '0.7rem',
                                  mt: 0.5
                                }}>
                                  📦 {material.boards_used} tábla
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {material.totalMeters.toFixed(2)} m
                          </TableCell>
                          <TableCell align="right">{formatCurrency(Math.round(material.totalNet))}</TableCell>
                          <TableCell align="right">{formatCurrency(Math.round(material.totalGross))}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs anyag adat elérhető.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Services Breakdown */}
            <Box sx={{ 
              mb: 2, 
              p: 2, 
              border: '1px solid #e0e0e0', 
              borderRadius: 1,
              backgroundColor: '#fcfcfc'
            }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Szolgáltatás</strong></TableCell>
                      <TableCell align="right"><strong>Mennyiség</strong></TableCell>
                      <TableCell align="right"><strong>Nettó ár</strong></TableCell>
                      <TableCell align="right"><strong>Bruttó ár</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {servicesBreakdown.osszemaras.gross > 0 && (
                      <TableRow>
                        <TableCell>Összemarás</TableCell>
                        <TableCell align="right">{servicesBreakdown.osszemaras.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.osszemaras.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.osszemaras.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.kereszt_vagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Kereszt vágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.kereszt_vagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kereszt_vagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kereszt_vagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.hosszanti_vagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Hosszanti vágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.hosszanti_vagas.quantity.toFixed(2)} m</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.hosszanti_vagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.hosszanti_vagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.ives_vagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Íves vágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.ives_vagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.ives_vagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.ives_vagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.szogvagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Szögvágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.szogvagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.szogvagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.szogvagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.kivagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Kivágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.kivagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kivagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kivagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.elzaro.gross > 0 && (
                      <TableRow>
                        <TableCell>Élzáró</TableCell>
                        <TableCell align="right">{servicesBreakdown.elzaro.quantity.toFixed(2)} m</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.elzaro.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.elzaro.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesTotals.gross === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs szolgáltatási adat elérhető.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Totals */}
            <Box sx={{ 
              mb: 2, 
              p: 2, 
              border: '1px solid #e0e0e0', 
              borderRadius: 1,
              backgroundColor: '#fcfcfc'
            }}>
              {(() => {
                const materialsGross = materialsTotal
                const servicesGross = servicesTotals.gross
                const feesGross = (quoteData.fees || []).reduce((sum, f) => sum + (Number(f.gross_price) || 0), 0)
                
                // Only positive values get discount
                const feesPositive = Math.max(0, feesGross)
                const feesNegative = Math.min(0, feesGross)
                
                const subtotal = materialsGross + servicesGross + feesPositive
                const discountAmount = subtotal * (quoteData.discount_percent / 100)
                const finalTotal = subtotal - discountAmount + feesNegative
                
                return (
                  <>
                    {/* Item Breakdown with Frame */}
                    <Box sx={{ 
                      p: 2, 
                      mb: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1,
                      backgroundColor: '#fafafa'
                    }}>
                      {/* Materials */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="600">
                          Lapszabászat:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(Math.round(materialsGross))}
                        </Typography>
                      </Box>

                      {/* Services */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: feesGross !== 0 ? 1 : 0 }}>
                        <Typography variant="body1" fontWeight="600">
                          Szolgáltatások:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(Math.round(servicesGross))}
                        </Typography>
                      </Box>

                      {/* Fees */}
                      {feesGross !== 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0 }}>
                          <Typography variant="body1" fontWeight="600">
                            Díjak:
                          </Typography>
                          <Typography variant="body1" fontWeight="600">
                            {formatCurrency(Math.round(feesGross))}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Subtotal, Discount, Final Total Frame */}
                    <Box sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1,
                      backgroundColor: '#fcfcfc'
                    }}>
                      {/* Subtotal */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="700">
                          Részösszeg:
                        </Typography>
                        <Typography variant="body1" fontWeight="700">
                          {formatCurrency(Math.round(subtotal))}
                        </Typography>
                      </Box>

                      {/* Discount */}
                      {quoteData.discount_percent > 0 && (
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          mb: 2,
                          p: 1,
                          backgroundColor: '#f5f5f5',
                          borderRadius: 1,
                          border: '1px solid #d0d0d0'
                        }}>
                          <Typography variant="body1" fontWeight="700">
                            Kedvezmény ({quoteData.discount_percent}%):
                          </Typography>
                          <Typography variant="body1" fontWeight="700">
                            -{formatCurrency(Math.round(discountAmount))}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 2 }} />

                      {/* Final total - highlighted */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 1.5,
                        backgroundColor: '#e8e8e8',
                        borderRadius: 1,
                        border: '1px solid #c0c0c0'
                      }}>
                        <Typography variant="h6" fontWeight="700">
                          Végösszeg:
                        </Typography>
                        <Typography variant="h6" fontWeight="700">
                          {formatCurrency(Math.round(finalTotal))}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )
              })()}
            </Box>
          </Paper>

          {/* Comment Display - Separate card under summary */}
          {quoteData.comment && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Megjegyzés
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  <Typography variant="body2">
                    {quoteData.comment}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          )}

          {/* Fees Section */}
          <QuoteFeesSection
            quoteId={quoteData.id}
            fees={quoteData.fees || []}
            onFeesChange={handleFeeAdded}
            onAddFeeClick={handleAddFee}
            apiPath="/api/worktop-quotes/"
          />
        </Grid>

        {/* Right Column - Actions */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Munki szerkesztés */}
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                  fullWidth
                >
                  Munki szerkesztés
                </Button>

                {/* Kedvezmény */}
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<EditIcon />}
                  onClick={handleEditDiscount}
                  fullWidth
                  disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}
                >
                  Kedvezmény ({quoteData.discount_percent}%) {isOrderView && ['ready', 'finished'].includes(quoteData.status) && '🔒'}
                </Button>

                {/* Megjegyzés */}
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={handleEditComment}
                  fullWidth
                  disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}
                >
                  Megjegyzés {isOrderView && ['ready', 'finished'].includes(quoteData.status) && '🔒'}
                </Button>

                <Divider />

                {/* PDF generálás */}
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={isGeneratingPdf ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  fullWidth
                >
                  {isGeneratingPdf ? 'PDF generálása...' : 'PDF generálás'}
                </Button>

                <Divider />

                {/* Show different buttons based on view type and status */}
                {!isOrderView && quoteData.status === 'draft' && (
                  <Button
                    variant="outlined"
                    startIcon={<OrderIcon />}
                    onClick={handleCreateOrder}
                    fullWidth
                  >
                    Megrendelés
                  </Button>
                )}

                {isOrderView && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<EditIcon />}
                    onClick={() => setAssignProductionModalOpen(true)}
                    fullWidth
                    disabled={['ready', 'finished'].includes(quoteData.status)}
                  >
                    Gyártásba adás {['ready', 'finished'].includes(quoteData.status) && '🔒'}
                  </Button>
                )}

                {isOrderView && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<PaymentIcon />}
                    onClick={() => setAddPaymentModalOpen(true)}
                    fullWidth
                    disabled={['ready', 'finished'].includes(quoteData.status)}
                  >
                    Fizetés hozzáadás {['ready', 'finished'].includes(quoteData.status) && '🔒'}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Order/Quote Info - Only show for orders */}
          {isOrderView && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Megrendelés információk
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {quoteData.order_number && (
                    <Typography variant="body2">
                      <strong>Megrendelés szám:</strong> {quoteData.order_number}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Létrehozva:</strong> {new Date(quoteData.created_at).toLocaleDateString('hu-HU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Frissítve:</strong> {new Date(quoteData.updated_at).toLocaleDateString('hu-HU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Kedvezmény:</strong> {quoteData.discount_percent}%
                  </Typography>
                  {quoteData.payment_status && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        <strong>Fizetési állapot:</strong>
                      </Typography>
                      <Chip 
                        label={quoteData.payment_status === 'not_paid' ? 'Nincs fizetve' : quoteData.payment_status === 'partial' ? 'Részben fizetve' : 'Kifizetve'} 
                        color={quoteData.payment_status === 'not_paid' ? 'error' : quoteData.payment_status === 'partial' ? 'warning' : 'success'}
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Edit Discount Modal */}
      <EditDiscountModal
        open={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        quoteId={quoteData.id}
        currentDiscountPercent={quoteData.discount_percent}
        onSuccess={handleDiscountUpdated}
        apiPath="/api/worktop-quotes/"
      />

      {/* Comment Modal */}
      <CommentModal
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleSaveComment}
        initialComment={quoteData.comment || null}
        quoteNumber={quoteData.quote_number}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        open={createOrderModalOpen}
        onClose={() => setCreateOrderModalOpen(false)}
        quoteId={quoteData.id}
        quoteNumber={quoteData.quote_number}
        finalTotal={quoteData.final_total_after_discount}
        onSuccess={handleOrderCreated}
        apiPath="/api/worktop-orders"
      />

      {/* Add Payment Modal */}
      {isOrderView && (
        <AddPaymentModal
          open={addPaymentModalOpen}
          onClose={() => setAddPaymentModalOpen(false)}
          quoteId={quoteData.id}
          orderNumber={quoteData.order_number || quoteData.quote_number}
          finalTotal={Math.round(quoteData.final_total_after_discount)}
          totalPaid={quoteData.payments?.reduce((sum, p) => sum + Math.round(Number(p.amount)), 0) || 0}
          onSuccess={handlePaymentAdded}
          apiPath={`/api/worktop-quotes/${quoteData.id}/payments`}
        />
      )}

      {/* Assign Production Modal */}
      {isOrderView && (
        <AssignProductionModal
          open={assignProductionModalOpen}
          onClose={() => setAssignProductionModalOpen(false)}
          worktopQuoteId={quoteData.id}
          orderNumber={quoteData.order_number || quoteData.quote_number}
          existingAssignment={{
            production_date: quoteData.production_date,
            barcode: quoteData.barcode
          }}
          onSuccess={handleProductionAssigned}
        />
      )}

      {/* Add Fee Modal */}
      <AddFeeModal
        open={addFeeModalOpen}
        onClose={() => setAddFeeModalOpen(false)}
        quoteId={quoteData.id}
        onSuccess={handleFeeAdded}
        feeTypes={feeTypes}
        apiPath="/api/worktop-quotes/"
      />
    </Box>
  )
}
