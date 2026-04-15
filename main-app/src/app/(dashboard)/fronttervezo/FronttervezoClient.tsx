'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

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
import Grid2 from '@mui/material/Grid2'

import { toast } from 'react-toastify'

import CustomInputHorizontal from '@core/components/custom-inputs/Horizontal'
import type { CustomInputHorizontalData } from '@core/components/custom-inputs/types'

import ButorlapRadioTileTitle from './ButorlapRadioTileTitle'
import FronttervezoAluSection from './FronttervezoAluSection'
import type { ButorlapLineItem } from './FronttervezoButorlapSection'
import FronttervezoButorlapSection from './FronttervezoButorlapSection'
import FronttervezoFestettSection from './FronttervezoFestettSection'
import FronttervezoFoliasSection from './FronttervezoFoliasSection'
import FronttervezoGlobalQuotes from './FronttervezoGlobalQuotes'
import FronttervezoInomatSection from './FronttervezoInomatSection'
import NettfrontRadioTileTitle from './NettfrontRadioTileTitle'
import {
  FRONTTERVEZO_LINES_UPDATED,
  FRONTTERVEZO_SESSION_KEY_ALU,
  FRONTTERVEZO_SESSION_KEY_BUTORLAP,
  FRONTTERVEZO_SESSION_KEY_FESTETT,
  FRONTTERVEZO_SESSION_KEY_FOLIAS,
  FRONTTERVEZO_SESSION_KEY_INOMAT,
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
  computeFronttervezoInomatQuote,
  type FronttervezoInomatQuoteResult,
  type InomatQuoteLineInput
} from '@/lib/pricing/fronttervezoInomatQuote'
import type { QuoteResult } from '@/lib/pricing/quoteCalculations'
import type { getCuttingFee, getEdgeMaterialById } from '@/lib/supabase-server'

type FronttervezoCuttingFeeSSR = Awaited<ReturnType<typeof getCuttingFee>>
type FronttervezoEdgeMaterialSSR = Awaited<ReturnType<typeof getEdgeMaterialById>>

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
}

export default function FronttervezoClient({
  initialCustomers,
  initialMaterials,
  initialCuttingFee,
  initialDefaultEdgeMaterial
}: FronttervezoClientProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const customers = initialCustomers ?? []
  const [selectedCustomer, setSelectedCustomer] = useState<FronttervezoCustomer | null>(null)
  const [customerData, setCustomerData] = useState<CustomerFormState>(emptyForm)
  const [selectedFrontType, setSelectedFrontType] = useState<string>('butorlap')

  const [lineCounts, setLineCounts] = useState<FronttervezoLineCounts>(() => ({
    butorlap: 0,
    inomat: 0,
    festett: 0,
    folias: 0,
    alu: 0
  }))

  useEffect(() => {
    const sync = () => setLineCounts(parseFronttervezoLineCounts())

    sync()
    window.addEventListener(FRONTTERVEZO_LINES_UPDATED, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(FRONTTERVEZO_LINES_UPDATED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const handleFrontTypeChange = useCallback((prop: string | ChangeEvent<HTMLInputElement>) => {
    if (typeof prop === 'string') {
      setSelectedFrontType(prop)
    } else {
      setSelectedFrontType((prop.target as HTMLInputElement).value)
    }
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
        }
      }

      if (inomatLines.length > 0) {
        const q = computeFronttervezoInomatQuote(inomatLines, initialCuttingFee, customerDiscountPercent)

        if (q) setInomatQuote(q)
      }

      if (aluLines.length > 0) {
        const q = computeFronttervezoAluQuote(aluLines, customerDiscountPercent)

        if (q) setAluQuote(q)
      }

      if (festettLines.length > 0) {
        const q = computeFronttervezoFestettQuote(festettLines, initialCuttingFee, customerDiscountPercent)

        if (q) setFestettQuote(q)
      }

      if (foliasLines.length > 0) {
        const q = computeFronttervezoFoliasQuote(foliasLines, initialCuttingFee, customerDiscountPercent)

        if (q) setFoliasQuote(q)
      }
    } finally {
      setGlobalQuoteLoading(false)
      setTimeout(() => quoteAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }, [customerDiscountPercent, initialCuttingFee, initialDefaultEdgeMaterial])

  const nettfrontTiles = useMemo(
    () =>
      [
        {
          value: 'inomat' as const,
          meta: 'Inomat',
          heading: 'INOMAT FRONT',
          badgeAriaLabelPrefix: 'Inomat'
        },
        {
          value: 'festett' as const,
          meta: 'Festett',
          heading: 'FESTETT FRONT',
          badgeAriaLabelPrefix: 'Festett'
        },
        {
          value: 'folias' as const,
          meta: 'Fóliás',
          heading: 'FÓLIÁS FRONT',
          badgeAriaLabelPrefix: 'Fóliás'
        },
        {
          value: 'alu' as const,
          meta: 'Alu',
          heading: 'ALU FRONT',
          badgeAriaLabelPrefix: 'Alu'
        }
      ] as const,
    []
  )

  const butorlapFrontData: CustomInputHorizontalData = useMemo(
    () => ({
      meta: 'Lap',
      title: <ButorlapRadioTileTitle lineCount={lineCounts.butorlap} />,
      value: 'butorlap',
      content: 'Hagyományos bútorlapból készülő front.'
    }),
    [lineCounts.butorlap]
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
        Fronttervező
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
                value={selectedCustomer}
                inputValue={customerData.name}
                onChange={(event, newValue) => {
                  if (typeof newValue === 'string') {
                    setSelectedCustomer(null)
                    setCustomerData(prev => ({ ...prev, name: newValue }))
                  } else if (newValue) {
                    applyCustomer(newValue)
                  } else if (event) {
                    applyCustomer(null)
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setCustomerData(prev => ({ ...prev, name: newInputValue }))

                  if (newInputValue && !customers.find(c => c.name === newInputValue)) {
                    setSelectedCustomer(null)
                  }
                }}
                freeSolo
                loadingText="Ügyfelek betöltése..."
                noOptionsText="Nincs találat"
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Név (válasszon ügyfelet vagy írjon be új nevet)"
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
                {selectedCustomer ? (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Adatok automatikusan kitöltve - szerkeszthető
                    </Typography>
                    <Button size="small" variant="outlined" color="secondary" onClick={() => applyCustomer(null)}>
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
                    opcionális
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

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Front típus
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Válasszon egy lehetőséget. A Nettfront márkához tartozó négy típus egy csoportban jelenik meg.
              </Typography>

              <Grid2 container spacing={2} alignItems="stretch">
                <Grid2 size={{ xs: 12, lg: 10 }}>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 2,
                      p: 2,
                      height: '100%',
                      bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06),
                      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.15)}`
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flexWrap: 'wrap',
                        mb: 2
                      }}
                    >
                      <Box
                        component="img"
                        src="/brands/nettfront-logo.svg"
                        alt="Nettfront"
                        sx={{
                          height: 28,
                          width: 'auto',
                          maxWidth: { xs: 200, sm: 220 },
                          display: 'block',
                          ...(isDark && { filter: 'invert(1)', opacity: 0.92 })
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: 'primary.main'
                        }}
                      >
                        Nettfront frontok
                      </Typography>
                    </Box>

                    <Grid2 container spacing={2}>
                      {nettfrontTiles.map(item => {
                        const count = lineCounts[item.value]

                        const tileData: CustomInputHorizontalData = {
                          value: item.value,
                          meta: item.meta,
                          title: (
                            <NettfrontRadioTileTitle
                              heading={item.heading}
                              frontValue={item.value}
                              lineCount={count}
                              badgeAriaLabelPrefix={item.badgeAriaLabelPrefix}
                            />
                          )
                        }

                        
return (
                          <CustomInputHorizontal
                            key={item.value}
                            type="radio"
                            name="fronttervezo-front-type"
                            selected={selectedFrontType}
                            handleChange={handleFrontTypeChange}
                            color="primary"
                            data={tileData}
                            gridProps={{ size: { xs: 6, sm: 6, md: 3 } }}
                          />
                        )
                      })}
                    </Grid2>
                  </Box>
                </Grid2>

                <CustomInputHorizontal
                  type="radio"
                  name="fronttervezo-front-type"
                  selected={selectedFrontType}
                  handleChange={handleFrontTypeChange}
                  color="primary"
                  data={butorlapFrontData}
                  gridProps={{ size: { xs: 12, lg: 2 } }}
                />
              </Grid2>
            </CardContent>
          </Card>
        </Grid>

        {selectedFrontType === 'butorlap' && (
          <Grid item xs={12}>
            <FronttervezoButorlapSection initialMaterials={initialMaterials} />
          </Grid>
        )}

        {selectedFrontType === 'inomat' && (
          <Grid item xs={12}>
            <FronttervezoInomatSection />
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
