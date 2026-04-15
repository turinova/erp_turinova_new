'use client'

import React, { useCallback, useEffect, useState } from 'react'

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LocationSearchingSharpIcon from '@mui/icons-material/LocationSearchingSharp'
import { toast } from 'react-toastify'

import { formatPrice } from '@/lib/pricing/quoteCalculations'
import type { getCuttingFee } from '@/lib/supabase-server'

import { dispatchFronttervezoLinesUpdated, FRONTTERVEZO_SESSION_KEY_INOMAT } from './fronttervezoSession'
import type { PanthelyConfig } from './fronttervezoTypes'

/** Match FronttervezoClient field styling */
const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

const SESSION_KEY = FRONTTERVEZO_SESSION_KEY_INOMAT

const SZIN_OPTIONS = ['Bronz', 'Pearl', 'Gold'] as const

type CuttingFeeSSR = Awaited<ReturnType<typeof getCuttingFee>>

type FronttervezoInomatSectionProps = {
  initialCuttingFee: CuttingFeeSSR | null
  customerDiscountPercent: number
}

/**
 * INOMAT: egyszerű árazás — bruttó Ft/m² színenként.
 * TODO: később DB-ből tölteni.
 *
 * NOTE: értékek most ideiglenesen azonosak; cseréld le a végleges táblázatra.
 */
const INOMAT_GROSS_PRICE_PER_SQM_BY_COLOR: Record<(typeof SZIN_OPTIONS)[number], number> = {
  Bronz: 35403,
  Pearl: 35403,
  Gold: 35403
}

const INOMAT_VAT_RATE = 0.27

export type InomatLineItem = {
  id: string
  szin: string
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  panthely: PanthelyConfig | null
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function parsePositiveInt(raw: string): number | null {
  const s = onlyDigits(raw)

  if (s === '') return null
  const n = parseInt(s, 10)

  if (!Number.isFinite(n) || n <= 0) return null
  
return n
}

function oldalLabel(oldal: 'hosszu' | 'rovid'): string {
  return oldal === 'hosszu' ? 'Hosszú oldal' : 'Rövid oldal'
}

function pantTooltipText(p: PanthelyConfig): string {
  const tav = p.tavolsagokAlulMm.map((mm, i) => `${i + 1}. pánthely: ${mm} mm`).join('; ')

  
return `${oldalLabel(p.oldal)}, ${p.mennyiseg} db. Alulról: ${tav}`
}

export default function FronttervezoInomatSection({
  initialCuttingFee,
  customerDiscountPercent
}: FronttervezoInomatSectionProps) {
  const [lines, setLines] = useState<InomatLineItem[]>([])
  const [hasLoadedFromSession, setHasLoadedFromSession] = useState(false)

  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)

  const [quoteData, setQuoteData] = useState<null | {
    rows: Array<{
      szin: (typeof SZIN_OPTIONS)[number]
      panelsDb: number
      sqm: number
      grossPerSqm: number
      net: number
      vat: number
      gross: number
    }>
    panthely: { panelsDb: number; holesDb: number; net: number; vat: number; gross: number }
    totals: { net: number; vat: number; gross: number; discountPercent: number; discountGross: number; finalGross: number }
  }>(null)

  const quoteAnchorRef = React.useRef<HTMLDivElement | null>(null)

  const [szin, setSzin] = useState<string>(SZIN_OPTIONS[0])
  const [magassag, setMagassag] = useState('')
  const [szelesseg, setSzelesseg] = useState('')
  const [mennyiseg, setMennyiseg] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  const [pantModalOpen, setPantModalOpen] = useState(false)
  const [pantSaved, setPantSaved] = useState(false)
  const [pantOldal, setPantOldal] = useState<'hosszu' | 'rovid'>('hosszu')
  const [pantHoleCount, setPantHoleCount] = useState('2')
  const [pantDistances, setPantDistances] = useState<string[]>(['', ''])

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as InomatLineItem[]

        if (Array.isArray(parsed)) {
          setLines(parsed)
        }
      } catch {
        console.error('[fronttervezo] session parse error')
      }
    }

    setHasLoadedFromSession(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedFromSession) return

    if (lines.length > 0) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(lines))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }

    dispatchFronttervezoLinesUpdated()
  }, [lines, hasLoadedFromSession])

  // Opti-szerű: tételek változásakor az ajánlat érvénytelen.
  useEffect(() => {
    if (!quoteData) return

    setQuoteData(null)
    setQuoteOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  const resetForm = useCallback(() => {
    setSzin(SZIN_OPTIONS[0])
    setMagassag('')
    setSzelesseg('')
    setMennyiseg('')
    setEditingId(null)
    setPantSaved(false)
    setPantOldal('hosszu')
    setPantHoleCount('2')
    setPantDistances(['', ''])
  }, [])

  const validateMainForm = (): boolean => {
    const m = parsePositiveInt(magassag)
    const sz = parsePositiveInt(szelesseg)
    const d = parsePositiveInt(mennyiseg)

    if (!szin) {
      toast.error('Válasszon színt.')
      
return false
    }

    if (m === null || sz === null || d === null) {
      toast.error('A magasság, szélesség és mennyiség kötelező pozitív egész szám (mm / db).')
      
return false
    }

    
return true
  }

  const buildPanthelyFromModal = (): PanthelyConfig | null => {
    if (!pantSaved) return null
    const n = parsePositiveInt(pantHoleCount)

    if (n === null) return null
    const tav: number[] = []

    for (let i = 0; i < n; i++) {
      const mm = parsePositiveInt(pantDistances[i] ?? '')

      if (mm === null) return null
      tav.push(mm)
    }

    
return { oldal: pantOldal, mennyiseg: n, tavolsagokAlulMm: tav }
  }

  const addLine = () => {
    if (!validateMainForm()) return
    const m = parsePositiveInt(magassag)!
    const sz = parsePositiveInt(szelesseg)!
    const d = parsePositiveInt(mennyiseg)!
    let pant: PanthelyConfig | null = null

    if (pantSaved) {
      pant = buildPanthelyFromModal()

      if (!pant) {
        toast.error('Ellenőrizze a pánthelyfúrás adatait (pánthelyek száma és távolságok mm-ben).')
        
return
      }
    }

    const item: InomatLineItem = {
      id: Date.now().toString(),
      szin,
      magassagMm: m,
      szelessegMm: sz,
      mennyiseg: d,
      panthely: pant
    }

    setLines(prev => [...prev, item])
    toast.success('Tétel hozzáadva.')
    resetForm()
  }

  const saveEditedLine = () => {
    if (!editingId) return
    if (!validateMainForm()) return
    const m = parsePositiveInt(magassag)!
    const sz = parsePositiveInt(szelesseg)!
    const d = parsePositiveInt(mennyiseg)!
    let pant: PanthelyConfig | null = null

    if (pantSaved) {
      pant = buildPanthelyFromModal()

      if (!pant) {
        toast.error('Ellenőrizze a pánthelyfúrás adatait (pánthelyek száma és távolságok mm-ben).')
        
return
      }
    }

    setLines(prev =>
      prev.map(row =>
        row.id === editingId
          ? {
              ...row,
              szin,
              magassagMm: m,
              szelessegMm: sz,
              mennyiseg: d,
              panthely: pant
            }
          : row
      )
    )
    toast.success('Tétel módosítva.')
    resetForm()
  }

  const deleteLine = (id: string) => {
    setLines(prev => prev.filter(p => p.id !== id))

    if (editingId === id) {
      resetForm()
    }

    toast.error('Tétel törölve.')
  }

  const editLine = (row: InomatLineItem) => {
    setEditingId(row.id)
    setSzin(row.szin)
    setMagassag(String(row.magassagMm))
    setSzelesseg(String(row.szelessegMm))
    setMennyiseg(String(row.mennyiseg))

    if (row.panthely) {
      setPantSaved(true)
      setPantOldal(row.panthely.oldal)
      setPantHoleCount(String(row.panthely.mennyiseg))
      setPantDistances(row.panthely.tavolsagokAlulMm.map(String))
    } else {
      setPantSaved(false)
      setPantOldal('hosszu')
      setPantHoleCount('2')
      setPantDistances(['', ''])
    }

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 80)
  }

  const cancelEdit = () => {
    resetForm()
  }

  const handlePantModalOpen = () => {
    const n = parseInt(pantHoleCount || '0', 10)

    if (Number.isFinite(n) && n > 0) {
      setPantDistances(prev => {
        const next = [...prev]

        while (next.length < n) next.push('')
        
return next.slice(0, n)
      })
    }

    setPantModalOpen(true)
  }

  const handlePantModalClose = () => {
    setPantModalOpen(false)
  }

  const handlePantHoleCountChange = (v: string) => {
    const digits = onlyDigits(v)

    setPantHoleCount(digits === '' ? '' : digits)
    const n = parseInt(digits || '0', 10)

    if (!Number.isFinite(n) || n <= 0) {
      setPantDistances([])
      
return
    }

    setPantDistances(prev => {
      const next = [...prev]

      while (next.length < n) next.push('')
      
return next.slice(0, n)
    })
  }

  const handlePantSave = () => {
    const n = parsePositiveInt(pantHoleCount)

    if (n === null) {
      toast.error('Adja meg a pánthelyfúrások számát (pozitív egész).')
      
return
    }

    for (let i = 0; i < n; i++) {
      if (parsePositiveInt(pantDistances[i] ?? '') === null) {
        toast.error(`Minden pánthelyhez adja meg az alulról mért távolságot (mm), ${i + 1}. pánthely.`)
        
return
      }
    }

    setPantSaved(true)
    setPantModalOpen(false)
  }

  const handlePantDelete = () => {
    setPantSaved(false)
    setPantHoleCount('2')
    setPantDistances(['', ''])
    setPantOldal('hosszu')
    setPantModalOpen(false)
  }

  const handleGenerateQuote = useCallback(async () => {
    if (lines.length === 0) {
      toast.error('Legalább egy tétel szükséges az ajánlathoz.')
      
return
    }

    setQuoteLoading(true)

    const byColor = new Map<(typeof SZIN_OPTIONS)[number], InomatLineItem[]>()

    for (const l of lines) {
      const c = l.szin as (typeof SZIN_OPTIONS)[number]

      if (!byColor.has(c)) byColor.set(c, [])
      byColor.get(c)!.push(l)
    }

    const rows = Array.from(byColor.entries()).map(([c, items]) => {
      const panelsDb = items.reduce((sum, r) => sum + r.mennyiseg, 0)
      const areaMm2 = items.reduce((sum, r) => sum + r.magassagMm * r.szelessegMm * r.mennyiseg, 0)
      const sqm = areaMm2 / 1_000_000
      const grossPerSqm = INOMAT_GROSS_PRICE_PER_SQM_BY_COLOR[c]
      const gross = sqm * grossPerSqm
      const net = gross / (1 + INOMAT_VAT_RATE)
      const vat = gross - net

      return { szin: c, panelsDb, sqm, grossPerSqm, net, vat, gross }
    })

    const totalPanelsDb = lines.reduce((sum, r) => sum + r.mennyiseg, 0)
    const totalHolesDb = lines.reduce((sum, r) => sum + (r.panthely ? r.panthely.mennyiseg * r.mennyiseg : 0), 0)
    const pantUnitNet = initialCuttingFee?.panthelyfuras_fee_per_hole ?? 50
    const pantNet = totalHolesDb * pantUnitNet
    const pantVat = pantNet * INOMAT_VAT_RATE
    const pantGross = pantNet + pantVat

    const totalsNet = rows.reduce((sum, r) => sum + r.net, 0) + pantNet
    const totalsVat = rows.reduce((sum, r) => sum + r.vat, 0) + pantVat
    const totalsGross = rows.reduce((sum, r) => sum + r.gross, 0) + pantGross

    const discountPercent = customerDiscountPercent || 0
    const discountGross = (totalsGross * discountPercent) / 100
    const finalGross = totalsGross - discountGross

    setQuoteData({
      rows,
      panthely: { panelsDb: totalPanelsDb, holesDb: totalHolesDb, net: pantNet, vat: pantVat, gross: pantGross },
      totals: {
        net: totalsNet,
        vat: totalsVat,
        gross: totalsGross,
        discountPercent,
        discountGross,
        finalGross
      }
    })

    setQuoteLoading(false)
    setQuoteOpen(false)
    setTimeout(() => quoteAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [lines, initialCuttingFee, customerDiscountPercent])

  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            INOMAT FRONT – részletek
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Magasság és szélesség mm-ben, egész szám. A pánthelyfúrás opcionális.
          </Typography>

          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel id="fronttervezo-inomat-szin">Szín</InputLabel>
                <Select
                  labelId="fronttervezo-inomat-szin"
                  label="Szín"
                  value={szin}
                  onChange={(e: SelectChangeEvent) => setSzin(e.target.value)}
                >
                  {SZIN_OPTIONS.map(opt => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Magasság (mm)"
                value={magassag}
                onChange={e => setMagassag(onlyDigits(e.target.value))}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Szélesség (mm)"
                value={szelesseg}
                onChange={e => setSzelesseg(onlyDigits(e.target.value))}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Mennyiség"
                value={mennyiseg}
                onChange={e => setMennyiseg(onlyDigits(e.target.value))}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                size="small"
                color={pantSaved ? 'success' : 'primary'}
                onClick={handlePantModalOpen}
              >
                Pánthelyfúrás
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
                {editingId && (
                  <Button variant="outlined" color="secondary" size="large" onClick={cancelEdit}>
                    Mégse
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={editingId ? saveEditedLine : addLine}
                >
                  {editingId ? 'Mentés' : 'Hozzáadás'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Hozzáadott tételek
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Front típus</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Szín</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Magasság</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Szélesség</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Mennyiség</strong>
                  </TableCell>
                  <TableCell align="center">
                    <strong>Pánt</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Műveletek</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map(row => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => editLine(row)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>INOMAT FRONT</TableCell>
                    <TableCell>{row.szin}</TableCell>
                    <TableCell>{row.magassagMm} mm</TableCell>
                    <TableCell>{row.szelessegMm} mm</TableCell>
                    <TableCell>{row.mennyiseg}</TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      {row.panthely ? (
                        <Tooltip title={pantTooltipText(row.panthely)}>
                          <Box
                            component="span"
                            sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <LocationSearchingSharpIcon color="primary" fontSize="small" />
                          </Box>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={() => deleteLine(row.id)}
                        sx={{ minWidth: 'auto', px: 1, py: 0.5, fontSize: 12 }}
                      >
                        Törlés
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              type="button"
              variant="contained"
              color="warning"
              size="large"
              disabled={quoteLoading || lines.length === 0}
              onClick={handleGenerateQuote}
              startIcon={quoteLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {quoteLoading ? 'Számítás…' : 'Ajánlat generálás'}
            </Button>
          </Box>
        </Box>
      )}

      {quoteData ? (
        <Box ref={quoteAnchorRef} sx={{ mt: 3 }}>
          <Accordion expanded={quoteOpen} onChange={(_e, exp) => setQuoteOpen(exp)}>
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
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mr: 1.5 }}>
                    VÉGÖSSZEG
                  </Typography>
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                          Nettó
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(quoteData.totals.net, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'info.100', color: 'info.dark', px: 2 }}
                  />
                  <Typography variant="h6" sx={{ mx: 0.25 }}>
                    +
                  </Typography>
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                          ÁFA
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(quoteData.totals.vat, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'warning.100', color: 'warning.dark', px: 2 }}
                  />
                  <Typography variant="h6" sx={{ mx: 0.25 }}>
                    =
                  </Typography>
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          Bruttó
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(quoteData.totals.gross, 'HUF')}
                        </Typography>
                      </Box>
                    }
                    sx={{ height: 'auto', bgcolor: 'grey.300', color: 'text.primary', px: 2 }}
                  />
                  {quoteData.totals.discountPercent > 0 ? (
                    <>
                      <Typography variant="h6" sx={{ mx: 0.25 }}>
                        -
                      </Typography>
                      <Chip
                        label={
                          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                              Kedvezmény ({quoteData.totals.discountPercent}%)
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {formatPrice(quoteData.totals.discountGross, 'HUF')}
                            </Typography>
                          </Box>
                        }
                        sx={{ height: 'auto', bgcolor: 'error.100', color: 'error.dark', px: 2 }}
                      />
                      <Typography variant="h6" sx={{ mx: 0.25 }}>
                        =
                      </Typography>
                      <Chip
                        label={
                          <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                              Végösszeg
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {formatPrice(quoteData.totals.finalGross, 'HUF')}
                            </Typography>
                          </Box>
                        }
                        sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2 }}
                      />
                    </>
                  ) : (
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Végösszeg
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {formatPrice(quoteData.totals.gross, 'HUF')}
                          </Typography>
                        </Box>
                      }
                      sx={{ height: 'auto', bgcolor: 'success.main', color: 'white', px: 2, ml: 1 }}
                    />
                  )}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Szín</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        Mennyiség
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        m²
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        Nettó
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ÁFA
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        Bruttó
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.rows.map(r => (
                      <TableRow key={r.szin}>
                        <TableCell sx={{ fontWeight: 700 }}>{r.szin}</TableCell>
                        <TableCell align="right">{r.panelsDb} db</TableCell>
                        <TableCell align="right">{r.sqm.toFixed(2)}</TableCell>
                        <TableCell align="right">{formatPrice(r.net, 'HUF')}</TableCell>
                        <TableCell align="right">{formatPrice(r.vat, 'HUF')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatPrice(r.gross, 'HUF')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {quoteData.panthely.holesDb > 0 ? (
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Pánthelyfúrás</TableCell>
                        <TableCell align="right">{quoteData.panthely.panelsDb} db</TableCell>
                        <TableCell align="right">—</TableCell>
                        <TableCell align="right">{formatPrice(quoteData.panthely.net, 'HUF')}</TableCell>
                        <TableCell align="right">{formatPrice(quoteData.panthely.vat, 'HUF')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatPrice(quoteData.panthely.gross, 'HUF')}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </Box>
      ) : null}

      <Dialog open={pantModalOpen} onClose={handlePantModalClose} maxWidth="sm" fullWidth>
        <DialogTitle>Pánthelyfúrás beállítások</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Pánthelyfúrások száma (db)"
              value={pantHoleCount}
              onChange={e => handlePantHoleCountChange(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Minden pánthelyhez külön adja meg az alulról mért távolságot (mm)."
            />

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Oldal
            </Typography>
            <RadioGroup value={pantOldal} onChange={e => setPantOldal(e.target.value as 'hosszu' | 'rovid')}>
              <FormControlLabel value="hosszu" control={<Radio />} label="Hosszú oldal" />
              <FormControlLabel value="rovid" control={<Radio />} label="Rövid oldal" />
            </RadioGroup>

            {(() => {
              const holeN = parseInt(pantHoleCount || '0', 10)

              if (!Number.isFinite(holeN) || holeN <= 0) {
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Adja meg a pánthelyek számát (legalább 1), majd töltse ki a távolságokat.
                  </Typography>
                )
              }

              
return Array.from({ length: holeN }).map((_, i) => (
                <TextField
                  key={i}
                  fullWidth
                  size="small"
                  sx={{ mt: 2 }}
                  label={`${i + 1}. pánthely – távolság alulról (mm)`}
                  value={pantDistances[i] ?? ''}
                  onChange={e => {
                    const v = onlyDigits(e.target.value)

                    setPantDistances(prev => {
                      const next = [...prev]

                      next[i] = v
                      
return next
                    })
                  }}
                />
              ))
            })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePantModalClose} color="primary">
            Mégse
          </Button>
          <Button onClick={handlePantDelete} color="error">
            Törlés
          </Button>
          <Button onClick={handlePantSave} variant="contained" color="primary">
            Mentés
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
