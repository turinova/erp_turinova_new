'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import { toast } from 'react-toastify'

import FronttervezoMegjegyzesTableCell from './FronttervezoMegjegyzesTableCell'
import InomatFinishBadge from './InomatFinishBadge'
import InomatSzinChipPicker from './InomatSzinChipPicker'
import PanthelyMiniPreview from './PanthelyMiniPreview'
import PanthelyVisualModal from './PanthelyVisualModal'
import { dispatchFronttervezoLinesUpdated, FRONTTERVEZO_SESSION_KEY_INOMAT } from './fronttervezoSession'
import type { PanthelyConfig } from './fronttervezoTypes'
import {
  buildInomatCatalogFromSkus,
  estimateInomatLinePanelGross,
  grossPerSqmForInomatSzin,
  normalizeInomatSzin,
  type InomatColorDef,
  type InomatSzin,
  type NettfrontSkuRow
} from '@/lib/pricing/fronttervezoInomatQuote'
import { formatPrice } from '@/lib/pricing/quoteCalculations'

/** Match FronttervezoClient field styling */
const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

const SESSION_KEY = FRONTTERVEZO_SESSION_KEY_INOMAT

/** Inomat érvényes mérettartomány (mm) */
const INOMAT_DIM_MIN_MM = 120
const INOMAT_HEIGHT_MAX_MM = 2780
const INOMAT_WIDTH_MAX_MM = 1280

export type InomatLineItem = {
  id: string
  szin: InomatSzin
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  panthely: PanthelyConfig | null
  megjegyzes?: string
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

function isInomatHeightInRange(mm: number): boolean {
  return mm >= INOMAT_DIM_MIN_MM && mm <= INOMAT_HEIGHT_MAX_MM
}

function isInomatWidthInRange(mm: number): boolean {
  return mm >= INOMAT_DIM_MIN_MM && mm <= INOMAT_WIDTH_MAX_MM
}

function normalizeLine(row: InomatLineItem, catalog: InomatColorDef[]): InomatLineItem {
  return { ...row, szin: normalizeInomatSzin(row.szin, catalog) as InomatSzin }
}

export default function FronttervezoInomatSection({
  initialSkus = [],
  initialLines
}: {
  initialSkus?: NettfrontSkuRow[]
  /** Ha meg van adva (szerkesztés mód), ezzel indul a lista session helyett */
  initialLines?: InomatLineItem[] | null
}) {
  const catalog = useMemo(
    () => buildInomatCatalogFromSkus(initialSkus),
    [initialSkus]
  )
  const defaultSzin = (catalog[0]?.label ?? 'Bronze') as InomatSzin

  const formCardRef = useRef<HTMLDivElement | null>(null)
  const magassagInputRef = useRef<HTMLInputElement | null>(null)
  const [lines, setLines] = useState<InomatLineItem[]>([])
  const [hasLoadedFromSession, setHasLoadedFromSession] = useState(false)

  const [szin, setSzin] = useState<InomatSzin>(defaultSzin)
  const [magassag, setMagassag] = useState('')
  const [szelesseg, setSzelesseg] = useState('')
  const [mennyiseg, setMennyiseg] = useState('')
  const [megjegyzes, setMegjegyzes] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  const [pantModalOpen, setPantModalOpen] = useState(false)
  const [panthelyDraft, setPanthelyDraft] = useState<PanthelyConfig | null>(null)
  const [magassagError, setMagassagError] = useState<string | null>(null)
  const [szelessegError, setSzelessegError] = useState<string | null>(null)

  const draftUnitPrice = grossPerSqmForInomatSzin(szin, catalog)

  useEffect(() => {
    // null = sessionből olvas; tömb (akár üres) = szerkesztés / friss oldal
    if (initialLines != null) {
      setLines(prev => {
        const next = initialLines.map(row => normalizeLine(row, catalog))
        if (
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              p.id === next[i]?.id &&
              p.szin === next[i]?.szin &&
              p.magassagMm === next[i]?.magassagMm &&
              p.szelessegMm === next[i]?.szelessegMm &&
              p.mennyiseg === next[i]?.mennyiseg
          )
        ) {
          return prev
        }

        return next
      })
      setHasLoadedFromSession(true)

      return
    }

    const raw = sessionStorage.getItem(SESSION_KEY)

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as InomatLineItem[]

        if (Array.isArray(parsed)) {
          setLines(parsed.map(row => normalizeLine(row, catalog)))
        }
      } catch {
        console.error('[fronttervezo] session parse error')
      }
    }

    setHasLoadedFromSession(true)
  }, [catalog, initialLines])

  useEffect(() => {
    if (!hasLoadedFromSession) return

    if (lines.length > 0) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(lines.map(row => normalizeLine(row, catalog))))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }

    dispatchFronttervezoLinesUpdated()
  }, [lines, hasLoadedFromSession, catalog])

  const resetForm = useCallback(() => {
    // Szín marad — ismételt hozzáadáshoz
    setMagassag('')
    setSzelesseg('')
    setMennyiseg('')
    setMegjegyzes('')
    setEditingId(null)
    setPanthelyDraft(null)
    setMagassagError(null)
    setSzelessegError(null)
  }, [])

  const focusMagassagField = useCallback(() => {
    requestAnimationFrame(() => {
      magassagInputRef.current?.focus()
      magassagInputRef.current?.select()
    })
  }, [])

  const validateHeightField = (raw: string): string | null => {
    if (raw === '') return null
    const n = parsePositiveInt(raw)

    if (n === null) return 'Pozitív egész szám kell (mm).'
    if (!isInomatHeightInRange(n)) {
      return `${INOMAT_DIM_MIN_MM}–${INOMAT_HEIGHT_MAX_MM} mm között lehet.`
    }

    return null
  }

  const validateWidthField = (raw: string): string | null => {
    if (raw === '') return null
    const n = parsePositiveInt(raw)

    if (n === null) return 'Pozitív egész szám kell (mm).'
    if (!isInomatWidthInRange(n)) {
      return `${INOMAT_DIM_MIN_MM}–${INOMAT_WIDTH_MAX_MM} mm között lehet.`
    }

    return null
  }

  const validateMainForm = (): boolean => {
    const heightMm = parsePositiveInt(magassag)
    const widthMm = parsePositiveInt(szelesseg)
    const qty = parsePositiveInt(mennyiseg)

    if (!szin) {
      toast.error('Válasszon színt.')

      return false
    }

    const hErr = validateHeightField(magassag) || (heightMm === null ? 'Kötelező mező.' : null)
    const wErr = validateWidthField(szelesseg) || (widthMm === null ? 'Kötelező mező.' : null)

    setMagassagError(hErr)
    setSzelessegError(wErr)

    if (hErr || wErr) {
      return false
    }

    if (qty === null) {
      toast.error('A mennyiség kötelező pozitív egész szám (db).')

      return false
    }

    return true
  }

  const submitLine = () => {
    if (editingId) saveEditedLine()
    else addLine()
  }

  const handleDimKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    submitLine()
  }

  const addLine = () => {
    if (!validateMainForm()) return

    // Explicit names — so szélesség never gets mixed up with szín
    const selectedSzin = normalizeInomatSzin(szin, catalog) as InomatSzin
    const heightMm = parsePositiveInt(magassag)!
    const widthMm = parsePositiveInt(szelesseg)!
    const qty = parsePositiveInt(mennyiseg)!

    const item: InomatLineItem = {
      id: `${Date.now()}-${selectedSzin}`,
      szin: selectedSzin,
      magassagMm: heightMm,
      szelessegMm: widthMm,
      mennyiseg: qty,
      panthely: panthelyDraft,
      megjegyzes: megjegyzes.trim() ? megjegyzes : undefined
    }

    setLines(prev => [...prev, item])
    toast.success(`Tétel hozzáadva (${selectedSzin}).`)
    resetForm()
    focusMagassagField()
  }

  const saveEditedLine = () => {
    if (!editingId) return
    if (!validateMainForm()) return

    const selectedSzin = normalizeInomatSzin(szin, catalog) as InomatSzin
    const heightMm = parsePositiveInt(magassag)!
    const widthMm = parsePositiveInt(szelesseg)!
    const qty = parsePositiveInt(mennyiseg)!

    setLines(prev =>
      prev.map(row =>
        row.id === editingId
          ? {
              ...row,
              szin: selectedSzin,
              magassagMm: heightMm,
              szelessegMm: widthMm,
              mennyiseg: qty,
              panthely: panthelyDraft,
              megjegyzes: megjegyzes.trim() ? megjegyzes : undefined
            }
          : row
      )
    )
    toast.success(`Tétel módosítva (${selectedSzin}).`)
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
    setSzin(normalizeInomatSzin(row.szin, catalog) as InomatSzin)
    setMagassag(String(row.magassagMm))
    setSzelesseg(String(row.szelessegMm))
    setMennyiseg(String(row.mennyiseg))
    setMegjegyzes(row.megjegyzes ?? '')
    setPanthelyDraft(row.panthely)

    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const cancelEdit = () => {
    resetForm()
  }

  const heightMm = parsePositiveInt(magassag) ?? 0
  const widthMm = parsePositiveInt(szelesseg) ?? 0

  return (
    <>
      <Card ref={formCardRef} sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            INOMAT FRONT – részletek
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Magasság: {INOMAT_DIM_MIN_MM}–{INOMAT_HEIGHT_MAX_MM} mm, szélesség:{' '}
            {INOMAT_DIM_MIN_MM}–{INOMAT_WIDTH_MAX_MM} mm. Enter a méret/db mezőkben: hozzáadás. A
            pánthelyfúrás opcionális.
          </Typography>

          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12}>
              <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '0.9rem' }}>Szín</Typography>
              <InomatSzinChipPicker
                value={szin}
                onChange={label => setSzin(label as InomatSzin)}
                catalog={catalog}
              />
              <Typography
                variant="body2"
                sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.75, fontWeight: 600 }}
              >
                Kiválasztva: <strong>{szin}</strong>
                <InomatFinishBadge szin={szin} catalog={catalog} />
                <Box component="span" sx={{ opacity: 0.85 }}>
                  · {formatPrice(draftUnitPrice, 'HUF')}/m²
                </Box>
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                inputRef={magassagInputRef}
                fullWidth
                size="small"
                label="Magasság (mm)"
                value={magassag}
                onChange={e => {
                  const v = onlyDigits(e.target.value)

                  setMagassag(v)
                  if (magassagError) setMagassagError(validateHeightField(v))
                }}
                onBlur={() => setMagassagError(validateHeightField(magassag))}
                onKeyDown={handleDimKeyDown}
                error={!!magassagError}
                helperText={magassagError ?? `${INOMAT_DIM_MIN_MM}–${INOMAT_HEIGHT_MAX_MM} mm`}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Szélesség (mm)"
                value={szelesseg}
                onChange={e => {
                  const v = onlyDigits(e.target.value)

                  setSzelesseg(v)
                  if (szelessegError) setSzelessegError(validateWidthField(v))
                }}
                onBlur={() => setSzelessegError(validateWidthField(szelesseg))}
                onKeyDown={handleDimKeyDown}
                error={!!szelessegError}
                helperText={szelessegError ?? `${INOMAT_DIM_MIN_MM}–${INOMAT_WIDTH_MAX_MM} mm`}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Mennyiség"
                value={mennyiseg}
                onChange={e => setMennyiseg(onlyDigits(e.target.value))}
                onKeyDown={handleDimKeyDown}
                helperText="Enter = hozzáadás"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Megjegyzés"
                placeholder="Opcionális"
                value={megjegyzes}
                onChange={e => setMegjegyzes(e.target.value)}
                multiline
                minRows={2}
                maxRows={6}
                inputProps={{ maxLength: 2000 }}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                size="medium"
                color={panthelyDraft ? 'success' : 'primary'}
                onClick={() => setPantModalOpen(true)}
                sx={{ fontWeight: 700 }}
              >
                {panthelyDraft
                  ? `Pánthelyfúrás (${panthelyDraft.mennyiseg} db) — módosítás`
                  : 'Pánthelyfúrás'}
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
                  onClick={submitLine}
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
                    <strong>Szín</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Felület</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Méret</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Db</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>m²</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Ft/m²</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Bruttó</strong>
                  </TableCell>
                  <TableCell align="center">
                    <strong>Pánt</strong>
                  </TableCell>
                  <TableCell align="center">
                    <strong>Megj.</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Műveletek</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map(row => {
                  const est = estimateInomatLinePanelGross(row, catalog)

                  return (
                    <TableRow key={row.id} hover onClick={() => editLine(row)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.szin}</TableCell>
                      <TableCell>
                        <InomatFinishBadge szin={row.szin} catalog={catalog} />
                      </TableCell>
                      <TableCell>
                        {row.magassagMm} × {row.szelessegMm} mm
                      </TableCell>
                      <TableCell>{row.mennyiseg}</TableCell>
                      <TableCell align="right">{est.sqm.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatPrice(est.grossPerSqm, 'HUF')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {formatPrice(est.gross, 'HUF')}
                      </TableCell>
                      <TableCell align="center" onClick={e => e.stopPropagation()}>
                        {row.panthely ? (
                          <PanthelyMiniPreview
                            heightMm={row.magassagMm}
                            widthMm={row.szelessegMm}
                            panthely={row.panthely}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ opacity: 0.7 }}>
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <FronttervezoMegjegyzesTableCell megjegyzes={row.megjegyzes} />
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
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="body2" sx={{ display: 'block', mt: 1, opacity: 0.8, fontWeight: 500 }}>
            A sorár a front m² × színár. A pánthely és a végösszeg az „Ajánlat generálás”-ban jelenik meg.
          </Typography>
        </Box>
      )}

      <PanthelyVisualModal
        open={pantModalOpen}
        onClose={() => setPantModalOpen(false)}
        onSave={config => setPanthelyDraft(config)}
        heightMm={heightMm}
        widthMm={widthMm}
        initial={panthelyDraft}
      />
    </>
  )
}
