'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'

import {
  Box,
  Button,
  Card,
  CardContent,
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
import LocationSearchingSharpIcon from '@mui/icons-material/LocationSearchingSharp'
import { toast } from 'react-toastify'

import FronttervezoMegjegyzesTableCell from './FronttervezoMegjegyzesTableCell'
import { dispatchFronttervezoLinesUpdated, FRONTTERVEZO_SESSION_KEY_FESTETT } from './fronttervezoSession'
import type { PanthelyConfig } from './fronttervezoTypes'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

const SESSION_KEY = FRONTTERVEZO_SESSION_KEY_FESTETT

const MARAS_MINTA_OPTIONS = ['A1/P', 'A10/Sz'] as const
const SZIN_OPTIONS = ['Nett 67', 'Nett 68', 'Nett 69'] as const
const FENYSEG_OPTIONS = ['Nincs', 'Matt'] as const

export type FestettLineItem = {
  id: string
  marasMinta: (typeof MARAS_MINTA_OPTIONS)[number]
  szin: (typeof SZIN_OPTIONS)[number]
  fenyseg: (typeof FENYSEG_OPTIONS)[number]
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

function oldalLabel(oldal: 'hosszu' | 'rovid'): string {
  return oldal === 'hosszu' ? 'Hosszú oldal' : 'Rövid oldal'
}

function pantTooltipText(p: PanthelyConfig): string {
  const tav = p.tavolsagokAlulMm.map((mm, i) => `${i + 1}. pánthely: ${mm} mm`).join('; ')

  return `${oldalLabel(p.oldal)}, ${p.mennyiseg} db. Alulról: ${tav}`
}

export default function FronttervezoFestettSection() {
  const [lines, setLines] = useState<FestettLineItem[]>([])
  const [hasLoadedFromSession, setHasLoadedFromSession] = useState(false)

  const [marasMinta, setMarasMinta] = useState<string>(MARAS_MINTA_OPTIONS[0])
  const [szin, setSzin] = useState<string>(SZIN_OPTIONS[0])
  const [fenyseg, setFenyseg] = useState<string>(FENYSEG_OPTIONS[0])
  const [magassag, setMagassag] = useState('')
  const [szelesseg, setSzelesseg] = useState('')
  const [mennyiseg, setMennyiseg] = useState('')
  const [megjegyzes, setMegjegyzes] = useState('')

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
        const parsed = JSON.parse(raw) as FestettLineItem[]

        if (Array.isArray(parsed)) {
          setLines(parsed)
        }
      } catch {
        console.error('[fronttervezo] festett session parse error')
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

  const resetForm = useCallback(() => {
    setMarasMinta(MARAS_MINTA_OPTIONS[0])
    setSzin(SZIN_OPTIONS[0])
    setFenyseg(FENYSEG_OPTIONS[0])
    setMagassag('')
    setSzelesseg('')
    setMennyiseg('')
    setMegjegyzes('')
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

    const item: FestettLineItem = {
      id: Date.now().toString(),
      marasMinta: marasMinta as FestettLineItem['marasMinta'],
      szin: szin as FestettLineItem['szin'],
      fenyseg: fenyseg as FestettLineItem['fenyseg'],
      magassagMm: m,
      szelessegMm: sz,
      mennyiseg: d,
      panthely: pant,
      megjegyzes: megjegyzes.trim() ? megjegyzes : undefined
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
              marasMinta: marasMinta as FestettLineItem['marasMinta'],
              szin: szin as FestettLineItem['szin'],
              fenyseg: fenyseg as FestettLineItem['fenyseg'],
              magassagMm: m,
              szelessegMm: sz,
              mennyiseg: d,
              panthely: pant,
              megjegyzes: megjegyzes.trim() ? megjegyzes : undefined
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

  const editLine = (row: FestettLineItem) => {
    setEditingId(row.id)
    setMarasMinta(row.marasMinta)
    setSzin(row.szin)
    setFenyseg(row.fenyseg)
    setMagassag(String(row.magassagMm))
    setSzelesseg(String(row.szelessegMm))
    setMennyiseg(String(row.mennyiseg))
    setMegjegyzes(row.megjegyzes ?? '')

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

  const handleDimensionKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()

      if (editingId) {
        saveEditedLine()
      } else {
        addLine()
      }
    }
  }

  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            FESTETT FRONT – részletek
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Magasság és szélesség mm-ben, egész szám. Árazás: 75&nbsp;000 Ft/m² bruttó (ideiglenesen). A pánthelyfúrás opcionális.
          </Typography>

          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel id="fronttervezo-festett-minta">Marás minta</InputLabel>
                <Select
                  labelId="fronttervezo-festett-minta"
                  label="Marás minta"
                  value={marasMinta}
                  onChange={(e: SelectChangeEvent) => setMarasMinta(e.target.value)}
                >
                  {MARAS_MINTA_OPTIONS.map(opt => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel id="fronttervezo-festett-szin">Szín</InputLabel>
                <Select
                  labelId="fronttervezo-festett-szin"
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
            <Grid item xs={12} sm={12} md={4}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel id="fronttervezo-festett-feny">Fényesség</InputLabel>
                <Select
                  labelId="fronttervezo-festett-feny"
                  label="Fényesség"
                  value={fenyseg}
                  onChange={(e: SelectChangeEvent) => setFenyseg(e.target.value)}
                >
                  {FENYSEG_OPTIONS.map(opt => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Magasság (mm)"
                value={magassag}
                onChange={e => setMagassag(onlyDigits(e.target.value))}
                onKeyDown={handleDimensionKeyPress}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Szélesség (mm)"
                value={szelesseg}
                onChange={e => setSzelesseg(onlyDigits(e.target.value))}
                onKeyDown={handleDimensionKeyPress}
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
                onKeyDown={handleDimensionKeyPress}
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
                <Button variant="contained" color="primary" size="large" onClick={editingId ? saveEditedLine : addLine}>
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
                    <strong>Marás minta</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Szín</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Fényesség</strong>
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
                  <TableCell align="center">
                    <strong>Megj.</strong>
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
                    <TableCell>FESTETT FRONT</TableCell>
                    <TableCell>{row.marasMinta}</TableCell>
                    <TableCell>{row.szin}</TableCell>
                    <TableCell>{row.fenyseg}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

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
