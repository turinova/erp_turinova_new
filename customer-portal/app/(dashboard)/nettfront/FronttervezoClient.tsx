'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Accordion,
  AccordionDetails,
  AccordionSummary
} from '@mui/material'
import { Star as StarIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { alpha, useTheme } from '@mui/material/styles'

import { toast } from 'react-toastify'

import FronttervezoAluSection from './FronttervezoAluSection'
import type { ButorlapLineItem } from './FronttervezoButorlapSection'
import FronttervezoFestettSection from './FronttervezoFestettSection'
import FronttervezoFoliasSection from './FronttervezoFoliasSection'
import FronttervezoGlobalQuotes from './FronttervezoGlobalQuotes'
import FronttervezoInomatSection, { type InomatLineItem } from './FronttervezoInomatSection'
import FrontTypeSegmentRow, { type FrontTypeSegmentOption } from './FrontTypeSegmentRow'
import NettfrontBrandPanel from './NettfrontBrandPanel'
import {
  clearFronttervezoSessionLines,
  FRONTTERVEZO_LINES_UPDATED,
  FRONTTERVEZO_SESSION_KEY_ALU,
  FRONTTERVEZO_SESSION_KEY_BUTORLAP,
  FRONTTERVEZO_SESSION_KEY_FESTETT,
  FRONTTERVEZO_SESSION_KEY_FOLIAS,
  FRONTTERVEZO_SESSION_KEY_INOMAT,
  type FronttervezoFrontTypeKey,
  type FronttervezoLineCounts,
  parseFronttervezoLineCounts
} from './fronttervezoSession'
import type { FronttervezoBoardMaterial } from './fronttervezoTypes'
import { computeFronttervezoButorlapQuote, type EdgeMaterialRow } from '@/lib/pricing/fronttervezoButorlapQuote'
import {
  computeFronttervezoAluQuote,
  type FronttervezoAluQuoteResult,
  type AluQuoteLineInput
} from '@/lib/pricing/fronttervezoAluQuote'
import {
  computeFronttervezoFestettQuote,
  type FronttervezoFestettQuoteResult,
  type FestettQuoteLineInput
} from '@/lib/pricing/fronttervezoFestettQuote'
import {
  computeFronttervezoFoliasQuote,
  type FoliasQuoteLineInput,
  type FronttervezoFoliasQuoteResult
} from '@/lib/pricing/fronttervezoFoliasQuote'
import {
  buildInomatCatalogFromSkus,
  computeFronttervezoInomatQuote,
  normalizeInomatSzin,
  type FronttervezoInomatQuoteResult,
  type InomatQuoteLineInput,
  type NettfrontSkuRow
} from '@/lib/pricing/fronttervezoInomatQuote'
import type { QuoteResult } from '@/lib/pricing/quoteCalculations'
import type { PanthelyConfig } from './fronttervezoTypes'

/** Cutting fee row from tenant `cutting_fees` (company-data-server) */
type FronttervezoCuttingFeeSSR = {
  id?: string | null
  fee_per_meter?: number | null
  panthelyfuras_fee_per_hole?: number | null
  duplungolas_fee_per_sqm?: number | null
  szogvagas_fee_per_panel?: number | null
  currency_id?: string | null
  vat_id?: string | null
  currencies?: { id?: string | null; name?: string | null } | null
  vat?: { id?: string | null; kulcs?: number | null } | null
  created_at?: string | null
  updated_at?: string | null
} | null

/** Edge material row from tenant DB */
type FronttervezoEdgeMaterialSSR = Record<string, unknown> | null

const EMPTY_INOMAT_LINES: InomatLineItem[] = []
const EMPTY_LINE_COUNTS: FronttervezoLineCounts = {
  butorlap: 0,
  inomat: 0,
  festett: 0,
  folias: 0,
  alu: 0
}

/** Rows from `getAllCustomers()` — same fields as Opti `Customer` */
export type FronttervezoCustomer = {
  id: string
  name: string
  email: string
  mobile: string
  discount_percent: number
  is_favorite: boolean
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

type CustomerFormState = {
  name: string
  email: string
  phone: string
  discount: string
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
}

const emptyForm = (): CustomerFormState => ({
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

/** Opti-style: subtle fill, white on focus — easy to read */
const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  let formatted = digits

  if (!digits.startsWith('36') && digits.length > 0) {
    formatted = '36' + digits
  }

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

function formatTaxNumber(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length <= 8) return digits
  if (digits.length <= 9) return `${digits.substring(0, 8)}-${digits.substring(8)}`

  if (digits.length <= 11) {
    return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9)}`
  }

  
return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9, 11)}`
}

function formatCompanyRegNumber(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.substring(0, 2)}-${digits.substring(2)}`
  if (digits.length <= 10) return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4)}`
  
return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 10)}`
}

type FronttervezoClientProps = {
  initialCustomers: FronttervezoCustomer[]

  /** Opti oldallal azonos SSR: `getAllMaterials()` */
  initialMaterials: FronttervezoBoardMaterial[]

  /** Vágási díj + pánthely — ugyanaz mint az /opti ajánlat számításnál */
  initialCuttingFee: FronttervezoCuttingFeeSSR

  /** Fix élzáró anyag (hardcode) — Opti edge_materials rekord */
  initialDefaultEdgeMaterial: FronttervezoEdgeMaterialSSR

  /** Nettfront SKU-k (Inomat színek + nettó árak) */
  initialNettfrontSkus: NettfrontSkuRow[]

  /** Portal: megrendelő mezők zárolva (tenant ügyfél) */
  lockCustomerFields?: boolean

  /** Portal: előre kiválasztott tenant ügyfél (email egyezés) */
  initialLockedCustomer?: FronttervezoCustomer | null

  /** Portal email — ha nincs tenant match, üzenethez */
  portalCustomerEmail?: string | null

  /** Szerkesztés: meglévő draft ajánlat */
  initialQuoteData?: {
    id: string
    quote_number: string
    status: string
    discount_percent: number
    customer: {
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
    } | null
    lines: Array<{
      id: string
      front_type: string
      display_name: string
      height_mm: number
      width_mm: number
      quantity: number
      panthely: PanthelyConfig | null
      megjegyzes: string | null
    }>
  } | null
}

function mapQuoteLinesToInomat(
  lines: NonNullable<FronttervezoClientProps['initialQuoteData']>['lines'],
  catalog: ReturnType<typeof buildInomatCatalogFromSkus>
): InomatLineItem[] {
  return lines
    .filter(l => l.front_type === 'inomat')
    .map(l => ({
      id: l.id,
      szin: normalizeInomatSzin(l.display_name, catalog) as InomatLineItem['szin'],
      magassagMm: l.height_mm,
      szelessegMm: l.width_mm,
      mennyiseg: l.quantity,
      panthely: l.panthely,
      megjegyzes: l.megjegyzes || undefined
    }))
}

function customerFormFromQuote(
  quote: NonNullable<FronttervezoClientProps['initialQuoteData']>
): CustomerFormState {
  const c = quote.customer

  if (!c) return emptyForm()

  return {
    name: c.name || '',
    email: c.email || '',
    phone: c.mobile || '',
    discount: String(quote.discount_percent ?? c.discount_percent ?? 0),
    billing_name: c.billing_name || '',
    billing_country: c.billing_country || 'Magyarország',
    billing_city: c.billing_city || '',
    billing_postal_code: c.billing_postal_code || '',
    billing_street: c.billing_street || '',
    billing_house_number: c.billing_house_number || '',
    billing_tax_number: c.billing_tax_number || '',
    billing_company_reg_number: c.billing_company_reg_number || ''
  }
}

function customerOptionFromQuote(
  quote: NonNullable<FronttervezoClientProps['initialQuoteData']>,
  list: FronttervezoCustomer[]
): FronttervezoCustomer | null {
  const c = quote.customer

  if (!c) return null

  const fromList = list.find(x => x.id === c.id)

  if (fromList) return fromList

  return {
    id: c.id,
    name: c.name,
    email: c.email || '',
    mobile: c.mobile || '',
    discount_percent: c.discount_percent ?? 0,
    is_favorite: false,
    billing_name: c.billing_name || '',
    billing_country: c.billing_country || 'Magyarország',
    billing_city: c.billing_city || '',
    billing_postal_code: c.billing_postal_code || '',
    billing_street: c.billing_street || '',
    billing_house_number: c.billing_house_number || '',
    billing_tax_number: c.billing_tax_number || '',
    billing_company_reg_number: c.billing_company_reg_number || '',
    created_at: '',
    updated_at: ''
  }
}

function customerFormFromCustomer(c: FronttervezoCustomer): CustomerFormState {
  return {
    name: c.name || '',
    email: c.email || '',
    phone: c.mobile || '',
    discount: String(c.discount_percent ?? 0),
    billing_name: c.billing_name || '',
    billing_country: c.billing_country || 'Magyarország',
    billing_city: c.billing_city || '',
    billing_postal_code: c.billing_postal_code || '',
    billing_street: c.billing_street || '',
    billing_house_number: c.billing_house_number || '',
    billing_tax_number: c.billing_tax_number || '',
    billing_company_reg_number: c.billing_company_reg_number || ''
  }
}

export default function FronttervezoClient({
  initialCustomers,
  initialMaterials: _initialMaterials,
  initialCuttingFee,
  initialDefaultEdgeMaterial,
  initialNettfrontSkus,
  initialQuoteData = null,
  lockCustomerFields = false,
  initialLockedCustomer = null,
  portalCustomerEmail = null
}: FronttervezoClientProps) {
  const router = useRouter()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const customers = initialCustomers ?? []
  const inomatCatalog = useMemo(
    () => buildInomatCatalogFromSkus(initialNettfrontSkus ?? []),
    [initialNettfrontSkus]
  )

  const isEditMode = Boolean(initialQuoteData?.id && initialQuoteData.status === 'draft')

  const hydratedInomatLines = useMemo(() => {
    if (!initialQuoteData?.lines?.length) return null

    return mapQuoteLinesToInomat(initialQuoteData.lines, inomatCatalog)
  }, [initialQuoteData, inomatCatalog])

  // Új ajánlat: session tételek törlése az első client renderen (mielőtt a szekciók betöltenék)
  const newSessionClearedRef = useRef(false)
  if (typeof window !== 'undefined' && !isEditMode && !newSessionClearedRef.current) {
    newSessionClearedRef.current = true
    clearFronttervezoSessionLines({ silent: true })
  }

  const [selectedCustomer, setSelectedCustomer] = useState<FronttervezoCustomer | null>(() => {
    if (initialQuoteData && initialQuoteData.status === 'draft') {
      return customerOptionFromQuote(initialQuoteData, initialCustomers ?? [])
    }
    if (lockCustomerFields && initialLockedCustomer) return initialLockedCustomer
    return null
  })
  const [customerData, setCustomerData] = useState<CustomerFormState>(() => {
    if (initialQuoteData && initialQuoteData.status === 'draft') {
      return customerFormFromQuote(initialQuoteData)
    }
    if (lockCustomerFields && initialLockedCustomer) {
      return customerFormFromCustomer(initialLockedCustomer)
    }
    return emptyForm()
  })
  const customerFieldsDisabled = lockCustomerFields || isEditMode
  const [selectedFrontType, setSelectedFrontType] = useState<FronttervezoFrontTypeKey>('inomat')

  const [lineCounts, setLineCounts] = useState<FronttervezoLineCounts>(() =>
    isEditMode ? parseFronttervezoLineCounts() : EMPTY_LINE_COUNTS
  )

  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(
    initialQuoteData?.status === 'draft' ? initialQuoteData.id : null
  )
  const quoteHydratedRef = useRef(false)

  useEffect(() => {
    if (!initialQuoteData || quoteHydratedRef.current) return
    quoteHydratedRef.current = true

    if (initialQuoteData.status !== 'draft') {
      toast.error('Csak piszkozat ajánlat szerkeszthető.')
      router.replace('/nettfront')

      return
    }

    setSavedQuoteId(initialQuoteData.id)
    setSelectedCustomer(customerOptionFromQuote(initialQuoteData, customers))
    setCustomerData(customerFormFromQuote(initialQuoteData))

    // Clear other front types so counts reflect this quote
    sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_BUTORLAP)
    sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_ALU)
    sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_FESTETT)
    sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_FOLIAS)

    toast.info(`Szerkesztés: ${initialQuoteData.quote_number}`)
  }, [initialQuoteData, customers, router])

  useEffect(() => {
    const sync = () => {
      setLineCounts(prev => {
        const next = parseFronttervezoLineCounts()

        if (
          prev.butorlap === next.butorlap &&
          prev.inomat === next.inomat &&
          prev.festett === next.festett &&
          prev.folias === next.folias &&
          prev.alu === next.alu
        ) {
          return prev
        }

        return next
      })
    }

    sync()
    window.addEventListener(FRONTTERVEZO_LINES_UPDATED, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(FRONTTERVEZO_LINES_UPDATED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleFrontTypeChange = useCallback((value: FronttervezoFrontTypeKey) => {
    setSelectedFrontType(value)
  }, [])

  const handleCustomerDataChange = useCallback((field: keyof CustomerFormState, value: string) => {
    let formatted = value

    if (field === 'phone') formatted = formatPhoneNumber(value)
    else if (field === 'billing_tax_number') formatted = formatTaxNumber(value)
    else if (field === 'billing_company_reg_number') formatted = formatCompanyRegNumber(value)
    setCustomerData(prev => ({ ...prev, [field]: formatted }))
  }, [])

  const customerDiscountPercent = useMemo(() => {
    const n = parseFloat(customerData.discount)

    return Number.isFinite(n) && n > 0 ? n : 0
  }, [customerData.discount])

  const quoteAnchorRef = useRef<HTMLDivElement | null>(null)
  const [globalQuoteLoading, setGlobalQuoteLoading] = useState(false)
  const [saveQuoteLoading, setSaveQuoteLoading] = useState(false)
  const [butorlapQuote, setButorlapQuote] = useState<QuoteResult | null>(null)
  const [butorlapLinesSnapshot, setButorlapLinesSnapshot] = useState<ButorlapLineItem[]>([])
  const [inomatQuote, setInomatQuote] = useState<FronttervezoInomatQuoteResult | null>(null)
  const [aluQuote, setAluQuote] = useState<FronttervezoAluQuoteResult | null>(null)
  const [festettQuote, setFestettQuote] = useState<FronttervezoFestettQuoteResult | null>(null)
  const [foliasQuote, setFoliasQuote] = useState<FronttervezoFoliasQuoteResult | null>(null)
  const [butorlapQuoteExpanded, setButorlapQuoteExpanded] = useState(false)
  const [inomatQuoteExpanded, setInomatQuoteExpanded] = useState(false)
  const [aluQuoteExpanded, setAluQuoteExpanded] = useState(false)
  const [festettQuoteExpanded, setFestettQuoteExpanded] = useState(false)
  const [foliasQuoteExpanded, setFoliasQuoteExpanded] = useState(false)

  const clearAllQuotes = useCallback(() => {
    setButorlapQuote(null)
    setButorlapLinesSnapshot([])
    setInomatQuote(null)
    setAluQuote(null)
    setFestettQuote(null)
    setFoliasQuote(null)
    setButorlapQuoteExpanded(false)
    setInomatQuoteExpanded(false)
    setAluQuoteExpanded(false)
    setFestettQuoteExpanded(false)
    setFoliasQuoteExpanded(false)
  }, [])

  useEffect(() => {
    window.addEventListener(FRONTTERVEZO_LINES_UPDATED, clearAllQuotes)

    return () => window.removeEventListener(FRONTTERVEZO_LINES_UPDATED, clearAllQuotes)
  }, [clearAllQuotes])

  const hasAnyQuoteLines =
    lineCounts.butorlap > 0 || lineCounts.inomat > 0 || lineCounts.festett > 0 || lineCounts.folias > 0 || lineCounts.alu > 0

  const handleGenerateAllQuotes = useCallback(async () => {
    if (typeof window === 'undefined') return

    let butorlapLines: ButorlapLineItem[] = []
    let inomatLines: InomatQuoteLineInput[] = []
    let aluLines: AluQuoteLineInput[] = []
    let festettLines: FestettQuoteLineInput[] = []
    let foliasLines: FoliasQuoteLineInput[] = []

    try {
      const rawB = sessionStorage.getItem(FRONTTERVEZO_SESSION_KEY_BUTORLAP)
      const rawI = sessionStorage.getItem(FRONTTERVEZO_SESSION_KEY_INOMAT)
      const rawA = sessionStorage.getItem(FRONTTERVEZO_SESSION_KEY_ALU)
      const rawF = sessionStorage.getItem(FRONTTERVEZO_SESSION_KEY_FESTETT)
      const rawFo = sessionStorage.getItem(FRONTTERVEZO_SESSION_KEY_FOLIAS)

      if (rawB) {
        const parsed = JSON.parse(rawB) as unknown

        if (Array.isArray(parsed)) butorlapLines = parsed as ButorlapLineItem[]
      }

      if (rawI) {
        const parsed = JSON.parse(rawI) as unknown

        if (Array.isArray(parsed)) inomatLines = parsed as InomatQuoteLineInput[]
      }

      if (rawA) {
        const parsed = JSON.parse(rawA) as unknown

        if (Array.isArray(parsed)) aluLines = parsed as AluQuoteLineInput[]
      }

      if (rawF) {
        const parsed = JSON.parse(rawF) as unknown

        if (Array.isArray(parsed)) festettLines = parsed as FestettQuoteLineInput[]
      }

      if (rawFo) {
        const parsed = JSON.parse(rawFo) as unknown

        if (Array.isArray(parsed)) foliasLines = parsed as FoliasQuoteLineInput[]
      }
    } catch {
      toast.error('A mentett tételek olvasása sikertelen.')
      
return
    }

    if (
      butorlapLines.length === 0 &&
      inomatLines.length === 0 &&
      aluLines.length === 0 &&
      festettLines.length === 0 &&
      foliasLines.length === 0
    ) {
      toast.error('Legalább egy tétel szükséges az ajánlathoz.')

      return
    }

    setGlobalQuoteLoading(true)
    setButorlapQuote(null)
    setButorlapLinesSnapshot([])
    setInomatQuote(null)
    setAluQuote(null)
    setFestettQuote(null)
    setFoliasQuote(null)
    setButorlapQuoteExpanded(false)
    setInomatQuoteExpanded(false)
    setAluQuoteExpanded(false)
    setFestettQuoteExpanded(false)
    setFoliasQuoteExpanded(false)

    try {
      const edgeMaterial = initialDefaultEdgeMaterial as unknown as EdgeMaterialRow

      if (butorlapLines.length > 0) {
        const outcome = await computeFronttervezoButorlapQuote(butorlapLines, initialCuttingFee, edgeMaterial)

        if (!outcome.ok) {
          toast.error(outcome.error)
        } else {
          setButorlapQuote(outcome.quote)
          setButorlapLinesSnapshot(butorlapLines)
          setButorlapQuoteExpanded(true)
        }
      }

      if (inomatLines.length > 0) {
        const q = computeFronttervezoInomatQuote(
          inomatLines,
          initialCuttingFee,
          customerDiscountPercent,
          inomatCatalog
        )

        if (q) {
          setInomatQuote(q)
          setInomatQuoteExpanded(true)
        }
      }

      if (aluLines.length > 0) {
        const q = computeFronttervezoAluQuote(aluLines, customerDiscountPercent)

        if (q) {
          setAluQuote(q)
          setAluQuoteExpanded(true)
        }
      }

      if (festettLines.length > 0) {
        const q = computeFronttervezoFestettQuote(festettLines, initialCuttingFee, customerDiscountPercent)

        if (q) {
          setFestettQuote(q)
          setFestettQuoteExpanded(true)
        }
      }

      if (foliasLines.length > 0) {
        const q = computeFronttervezoFoliasQuote(foliasLines, initialCuttingFee, customerDiscountPercent)

        if (q) {
          setFoliasQuote(q)
          setFoliasQuoteExpanded(true)
        }
      }
    } finally {
      setGlobalQuoteLoading(false)
      setTimeout(() => quoteAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }, [customerDiscountPercent, initialCuttingFee, initialDefaultEdgeMaterial, inomatCatalog])

  const handleSaveQuote = useCallback(async () => {
    if (typeof window === 'undefined') return

    if (!customerData.name.trim()) {
      toast.error('Kérjük, töltse ki a megrendelő nevét!')
      return
    }

    if (lockCustomerFields && !selectedCustomer) {
      toast.error('Nincs hozzárendelt vállalati ügyfél — mentés nem lehetséges.')
      return
    }

    let inomatLines: import('@/lib/pricing/fronttervezoInomatQuote').InomatQuoteLineInput[] = []

    try {
      const rawI = sessionStorage.getItem(FRONTTERVEZO_SESSION_KEY_INOMAT)
      if (rawI) {
        const parsed = JSON.parse(rawI) as unknown
        if (Array.isArray(parsed)) {
          inomatLines = parsed as import('@/lib/pricing/fronttervezoInomatQuote').InomatQuoteLineInput[]
        }
      }
    } catch {
      toast.error('A mentett tételek olvasása sikertelen.')
      return
    }

    if (inomatLines.length === 0) {
      toast.error('Legalább egy Inomat tétel szükséges a mentéshez.')
      return
    }

    setSaveQuoteLoading(true)

    try {
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

      const response = await fetch('/api/nettfront-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: savedQuoteId,
          customerData: customerPayload,
          inomatLines
        })
      })

      const data = (await response.json()) as {
        success?: boolean
        quoteId?: string
        quoteNumber?: string
        error?: string
        details?: string
      }

      if (!response.ok || !data.success || !data.quoteId) {
        toast.error(data.error || data.details || 'Mentés sikertelen')
        return
      }

      setSavedQuoteId(data.quoteId)
      clearFronttervezoSessionLines({ silent: true })
      toast.success(`Mentve: ${data.quoteNumber}`)
      router.push(`/saved/nettfront/${data.quoteId}`)
    } catch (err) {
      console.error('[Nettfront] save error:', err)
      toast.error('Mentés sikertelen')
    } finally {
      setSaveQuoteLoading(false)
    }
  }, [customerData, lockCustomerFields, router, savedQuoteId, selectedCustomer])

  const frontTypeOptions = useMemo<FrontTypeSegmentOption[]>(
    () => [
      { value: 'inomat', label: 'Inomat', description: 'Dekoratív front, több színben' },
      { value: 'festett', label: 'Festett', comingSoon: true },
      { value: 'folias', label: 'Fóliás', comingSoon: true },
      { value: 'alu', label: 'Alu', comingSoon: true }
    ],
    []
  )

  const applyCustomer = useCallback((c: FronttervezoCustomer | null) => {
    setSelectedCustomer(c)

    if (c) {
      setCustomerData({
        name: c.name,
        email: c.email,
        phone: c.mobile,
        discount: c.discount_percent.toString(),
        billing_name: c.billing_name || '',
        billing_country: c.billing_country || 'Magyarország',
        billing_city: c.billing_city || '',
        billing_postal_code: c.billing_postal_code || '',
        billing_street: c.billing_street || '',
        billing_house_number: c.billing_house_number || '',
        billing_tax_number: c.billing_tax_number || '',
        billing_company_reg_number: c.billing_company_reg_number || ''
      })
    } else {
      setCustomerData(emptyForm())
    }
  }, [])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Nettfront
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Megrendelő adatai
              </Typography>

              <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <Autocomplete
                fullWidth
                size="small"
                options={customers}
                getOptionLabel={option => (typeof option === 'string' ? option : option.name)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedCustomer}
                inputValue={customerData.name}
                onChange={(event, newValue) => {
                  if (customerFieldsDisabled) return
                  if (typeof newValue === 'string') {
                    setSelectedCustomer(null)
                    setCustomerData(prev => ({ ...prev, name: newValue }))
                  } else if (newValue) {
                    applyCustomer(newValue)
                  } else if (event) {
                    applyCustomer(null)
                  }
                }}
                onInputChange={(event, newInputValue, reason) => {
                  if (customerFieldsDisabled) return
                  // MUI programozott inputValue állításnál reset-tel törölné a nevet
                  if (reason === 'reset' || !event) return

                  setCustomerData(prev => ({ ...prev, name: newInputValue }))

                  if (newInputValue && !customers.find(c => c.name === newInputValue)) {
                    setSelectedCustomer(null)
                  }
                }}
                freeSolo={!customerFieldsDisabled}
                disabled={customerFieldsDisabled}
                disableClearable={customerFieldsDisabled}
                loadingText="Ügyfelek betöltése..."
                noOptionsText="Nincs találat"
                renderInput={params => (
                  <TextField
                    {...params}
                    label={
                      lockCustomerFields
                        ? 'Megrendelő neve'
                        : isEditMode
                          ? 'Megrendelő neve'
                          : 'Név (válasszon ügyfelet vagy írjon be új nevet)'
                    }
                    size="small"
                    sx={inputSx}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: <>{params.InputProps.endAdornment}</>
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...other } = props

                  return (
                    <Box component="li" key={key} {...other}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {option.is_favorite && (
                          <StarIcon sx={{ fontSize: 16, color: '#F59E0B', flexShrink: 0 }} />
                        )}
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {option.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.email || '—'} · {option.mobile || '—'}
                          </Typography>
                        </Box>
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
                onChange={e => handleCustomerDataChange('discount', e.target.value)}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                disabled={customerFieldsDisabled}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="E-mail"
                value={customerData.email}
                onChange={e => handleCustomerDataChange('email', e.target.value)}
                disabled={customerFieldsDisabled}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Telefon"
                placeholder="+36 30 999 2800"
                value={customerData.phone}
                onChange={e => handleCustomerDataChange('phone', e.target.value)}
                disabled={customerFieldsDisabled}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  minHeight: 32,
                  px: 0.25
                }}
              >
                {lockCustomerFields ? (
                  <Typography variant="body2" color={selectedCustomer ? 'text.secondary' : 'warning.main'}>
                    {selectedCustomer
                      ? 'Megrendelő adatok a vállalati adatbázisból — nem szerkeszthető'
                      : portalCustomerEmail
                        ? `Nincs ügyfél a vállalati adatbázisban ezzel az e-maillel: ${portalCustomerEmail}`
                        : 'Nincs hozzárendelt vállalati ügyfél'}
                  </Typography>
                ) : selectedCustomer ? (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      {isEditMode
                        ? 'Megrendelő rögzítve (szerkesztés mód)'
                        : 'Adatok automatikusan kitöltve - szerkeszthető'}
                    </Typography>
                    {!isEditMode ? (
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => applyCustomer(null)}
                      >
                        Törlés
                      </Button>
                    ) : null}
                  </>
                ) : customerData.name && !selectedCustomer ? (
                  <Typography variant="body2" color="primary">
                    Új ügyfél adatai - kérem töltse ki a mezőket
                  </Typography>
                ) : null}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Accordion
                defaultExpanded={false}
                disableGutters
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  bgcolor: isDark ? alpha(theme.palette.common.white, 0.02) : alpha(theme.palette.grey[900], 0.02),
                  '&:before': { display: 'none' }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                  sx={{
                    px: 2,
                    py: 1.25,
                    '&:hover': { bgcolor: isDark ? alpha(theme.palette.common.white, 0.04) : alpha(theme.palette.grey[900], 0.03) }
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Számlázási adatok
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, display: { xs: 'none', sm: 'inline' } }}>
                    {lockCustomerFields ? 'vállalati adatok' : 'opcionális'}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pb: 2.5, pt: 0 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Számlázási név"
                        value={customerData.billing_name}
                        onChange={e => handleCustomerDataChange('billing_name', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Ország"
                        value={customerData.billing_country}
                        onChange={e => handleCustomerDataChange('billing_country', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Város"
                        value={customerData.billing_city}
                        onChange={e => handleCustomerDataChange('billing_city', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Irányítószám"
                        value={customerData.billing_postal_code}
                        onChange={e => handleCustomerDataChange('billing_postal_code', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Utca"
                        value={customerData.billing_street}
                        onChange={e => handleCustomerDataChange('billing_street', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Házszám"
                        value={customerData.billing_house_number}
                        onChange={e => handleCustomerDataChange('billing_house_number', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Adószám"
                        placeholder="12345678-1-02"
                        value={customerData.billing_tax_number}
                        onChange={e => handleCustomerDataChange('billing_tax_number', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Cégjegyzékszám"
                        placeholder="01-09-123456"
                        value={customerData.billing_company_reg_number}
                        onChange={e => handleCustomerDataChange('billing_company_reg_number', e.target.value)}
                        disabled={customerFieldsDisabled}
                        sx={inputSx}
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

        <Grid item xs={12} md={4}>
          <NettfrontBrandPanel />
        </Grid>

        <Grid item xs={12}>
          <FrontTypeSegmentRow
            options={frontTypeOptions}
            selected={selectedFrontType}
            lineCounts={lineCounts}
            onChange={handleFrontTypeChange}
          />
        </Grid>

        {selectedFrontType === 'inomat' && (
          <Grid item xs={12}>
            <FronttervezoInomatSection
              key={isEditMode ? initialQuoteData!.id : 'fronttervezo-new'}
              initialSkus={initialNettfrontSkus}
              initialLines={isEditMode ? hydratedInomatLines ?? EMPTY_INOMAT_LINES : EMPTY_INOMAT_LINES}
            />
          </Grid>
        )}

        {selectedFrontType === 'festett' && (
          <Grid item xs={12}>
            <FronttervezoFestettSection />
          </Grid>
        )}

        {selectedFrontType === 'folias' && (
          <Grid item xs={12}>
            <FronttervezoFoliasSection />
          </Grid>
        )}

        {selectedFrontType === 'alu' && (
          <Grid item xs={12}>
            <FronttervezoAluSection />
          </Grid>
        )}

        {hasAnyQuoteLines ? (
          <Grid item xs={12}>
            <FronttervezoGlobalQuotes
              quoteAnchorRef={quoteAnchorRef}
              hasAnyLines={hasAnyQuoteLines}
              loading={globalQuoteLoading}
              onGenerate={handleGenerateAllQuotes}
              onSave={handleSaveQuote}
              saveLoading={saveQuoteLoading}
              customerDiscountPercent={customerDiscountPercent}
              butorlapQuote={butorlapQuote}
              butorlapLines={butorlapLinesSnapshot}
              butorlapExpanded={butorlapQuoteExpanded}
              onButorlapExpanded={setButorlapQuoteExpanded}
              inomatQuote={inomatQuote}
              inomatExpanded={inomatQuoteExpanded}
              onInomatExpanded={setInomatQuoteExpanded}
              aluQuote={aluQuote}
              aluExpanded={aluQuoteExpanded}
              onAluExpanded={setAluQuoteExpanded}
              festettQuote={festettQuote}
              festettExpanded={festettQuoteExpanded}
              onFestettExpanded={setFestettQuoteExpanded}
              foliasQuote={foliasQuote}
              foliasExpanded={foliasQuoteExpanded}
              onFoliasExpanded={setFoliasQuoteExpanded}
            />
          </Grid>
        ) : null}
      </Grid>
    </Box>
  )
}
