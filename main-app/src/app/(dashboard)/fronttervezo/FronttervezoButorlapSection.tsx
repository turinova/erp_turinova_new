'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
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

import FronttervezoTablasAnyagField from './FronttervezoTablasAnyagField'
import { dispatchFronttervezoLinesUpdated, FRONTTERVEZO_SESSION_KEY_BUTORLAP } from './fronttervezoSession'
import type { FronttervezoBoardMaterial, PanthelyConfig } from './fronttervezoTypes'

const SESSION_KEY = FRONTTERVEZO_SESSION_KEY_BUTORLAP

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

export type ButorlapLineItem = {
  id: string

  /** Pillanatkép a kiválasztott táblás anyagról (számításokhoz — ugyanaz a mezőkészlet, mint Opti SSR anyag) */
  material: FronttervezoBoardMaterial
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  panthely: PanthelyConfig | null
}

function cloneMaterial(m: FronttervezoBoardMaterial): FronttervezoBoardMaterial {
  return JSON.parse(JSON.stringify(m)) as FronttervezoBoardMaterial
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

type FronttervezoButorlapSectionProps = {
  initialMaterials: FronttervezoBoardMaterial[]
}

export default function FronttervezoButorlapSection({ initialMaterials }: FronttervezoButorlapSectionProps) {
  /** Opti `activeMaterials`: csak aktív, márka majd név szerint */
  const activeMaterials = useMemo(() => {
    const materials = initialMaterials ?? []

    
return materials
      .filter(m => m.active !== false)
      .sort((a, b) => {
        const brandA = a.brand_name?.trim() || 'Ismeretlen'
        const brandB = b.brand_name?.trim() || 'Ismeretlen'

        if (brandA !== brandB) return brandA.localeCompare(brandB, 'hu')
        
return a.name.localeCompare(b.name, 'hu')
      })
  }, [initialMaterials])

  const [lines, setLines] = useState<ButorlapLineItem[]>([])
  const [hasLoadedFromSession, setHasLoadedFromSession] = useState(false)

  const [selectedMaterialId, setSelectedMaterialId] = useState('')

  /** Szerkesztés: ha a sor anyaga már nincs az aktív listában, mégis megjelenítjük az Autocomplete-ben */
  const [orphanMaterialOption, setOrphanMaterialOption] = useState<FronttervezoBoardMaterial | null>(null)

  const táblásOptions = useMemo(() => {
    if (orphanMaterialOption && !activeMaterials.some(m => m.id === orphanMaterialOption.id)) {
      return [orphanMaterialOption, ...activeMaterials]
    }

    return activeMaterials
  }, [activeMaterials, orphanMaterialOption])

  const [magassag, setMagassag] = useState('')
  const [szelesseg, setSzelesseg] = useState('')
  const [mennyiseg, setMennyiseg] = useState('')

  /** Opti-szerű submit-hibák (kötelező mezők) */
  const [validationErrors, setValidationErrors] = useState({
    magassag: false,
    szelesseg: false,
    mennyiseg: false
  })

  const [editingId, setEditingId] = useState<string | null>(null)

  const [pantModalOpen, setPantModalOpen] = useState(false)
  const [pantSaved, setPantSaved] = useState(false)
  const [pantOldal, setPantOldal] = useState<'hosszu' | 'rovid'>('hosszu')
  const [pantHoleCount, setPantHoleCount] = useState('2')
  const [pantDistances, setPantDistances] = useState<string[]>(['', ''])

  const selectedMaterial = useMemo(
    () => táblásOptions.find(m => m.id === selectedMaterialId) ?? null,
    [táblásOptions, selectedMaterialId]
  )

  /** Opti: `length_mm - trim_left - trim_right` / `width_mm - trim_top - trim_bottom` */
  const maxSzalirany = selectedMaterial
    ? selectedMaterial.length_mm - selectedMaterial.trim_left_mm - selectedMaterial.trim_right_mm
    : 0

  const maxKeresztirany = selectedMaterial
    ? selectedMaterial.width_mm - selectedMaterial.trim_top_mm - selectedMaterial.trim_bottom_mm
    : 0

  const validateSzalirany = useCallback(
    (value: string) => {
      const numValue = parseFloat(value)

      if (isNaN(numValue) || numValue <= 0) return value
      if (maxSzalirany > 0 && numValue > maxSzalirany) return maxSzalirany.toString()
      
return value
    },
    [maxSzalirany]
  )

  const validateKeresztirany = useCallback(
    (value: string) => {
      const numValue = parseFloat(value)

      if (isNaN(numValue) || numValue <= 0) return value
      if (maxKeresztirany > 0 && numValue > maxKeresztirany) return maxKeresztirany.toString()
      
return value
    },
    [maxKeresztirany]
  )

  /** Anyagcsere: ha a már bent lévő méret túllépi az új maxot, vágjuk Opti szerint */
  useEffect(() => {
    if (!selectedMaterial) return
    const maxS = maxSzalirany
    const maxK = maxKeresztirany

    setMagassag(prev => {
      const n = parseFloat(prev)

      if (isNaN(n) || n <= 0) return prev
      if (maxS > 0 && n > maxS) return maxS.toString()
      
return prev
    })
    setSzelesseg(prev => {
      const n = parseFloat(prev)

      if (isNaN(n) || n <= 0) return prev
      if (maxK > 0 && n > maxK) return maxK.toString()
      
return prev
    })
  }, [selectedMaterialId, selectedMaterial, maxSzalirany, maxKeresztirany])

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ButorlapLineItem[]

        if (Array.isArray(parsed)) {
          setLines(parsed)
        }
      } catch {
        console.error('[fronttervezo] butorlap session parse error')
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

  const clearValidationError = useCallback((field: keyof typeof validationErrors) => {
    setValidationErrors(prev => (prev[field] ? { ...prev, [field]: false } : prev))
  }, [])

  const resetForm = useCallback(
    (options?: { keepSelectedMaterial?: boolean }) => {
      const keepMat = options?.keepSelectedMaterial === true

      if (!keepMat) {
        setSelectedMaterialId('')
        setOrphanMaterialOption(null)
      } else {
        /** Aktív katalógusban lévő anyagnál nincs szükség az „árva” pillanatképre — egyébként marad (inaktív anyag). */
        setOrphanMaterialOption(prev => {
          if (!selectedMaterialId) return null

          return activeMaterials.some(m => m.id === selectedMaterialId) ? null : prev
        })
      }

      setMagassag('')
      setSzelesseg('')
      setMennyiseg('')
      setValidationErrors({ magassag: false, szelesseg: false, mennyiseg: false })
      setEditingId(null)
      setPantSaved(false)
      setPantOldal('hosszu')
      setPantHoleCount('2')
      setPantDistances(['', ''])
    },
    [activeMaterials, selectedMaterialId]
  )

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

  const validateMainForm = (): boolean => {
    if (!selectedMaterialId || !selectedMaterial) {
      toast.error('Válasszon táblás anyagot.')
      
return false
    }

    const mat = táblásOptions.find(x => x.id === selectedMaterialId)

    if (!mat) {
      toast.error('Érvénytelen táblás anyag.')
      
return false
    }

    const errors = {
      magassag: !magassag.trim() || parseFloat(magassag) <= 0,
      szelesseg: !szelesseg.trim() || parseFloat(szelesseg) <= 0,
      mennyiseg: !mennyiseg.trim() || parseInt(mennyiseg, 10) <= 0
    }

    setValidationErrors(errors)

    if (Object.values(errors).some(Boolean)) {
      toast.error('Töltse ki a kötelező mezőket helyesen.')
      
return false
    }

    const m = parseFloat(magassag)
    const sz = parseFloat(szelesseg)

    if (maxSzalirany > 0 && m > maxSzalirany) {
      toast.error(`Szálirány maximum ${maxSzalirany} mm (tábla mérete mínusz szélezés).`)
      
return false
    }

    if (maxKeresztirany > 0 && sz > maxKeresztirany) {
      toast.error(`Keresztirány maximum ${maxKeresztirany} mm (tábla mérete mínusz szélezés).`)
      
return false
    }

    return true
  }

  const addLine = () => {
    if (!validateMainForm()) return
    const mat = táblásOptions.find(x => x.id === selectedMaterialId)

    if (!mat) return
    const m = parseFloat(magassag)
    const sz = parseFloat(szelesseg)
    const d = parseInt(mennyiseg, 10)
    let pant: PanthelyConfig | null = null

    if (pantSaved) {
      pant = buildPanthelyFromModal()

      if (!pant) {
        toast.error('Ellenőrizze a pánthelyfúrás adatait (pánthelyek száma és távolságok mm-ben).')
        
return
      }
    }

    const item: ButorlapLineItem = {
      id: Date.now().toString(),
      material: cloneMaterial(mat),
      magassagMm: m,
      szelessegMm: sz,
      mennyiseg: d,
      panthely: pant
    }

    setLines(prev => [...prev, item])
    toast.success('Tétel hozzáadva.')
    resetForm({ keepSelectedMaterial: true })
  }

  const saveEditedLine = () => {
    if (!editingId) return
    if (!validateMainForm()) return
    const mat = táblásOptions.find(x => x.id === selectedMaterialId)

    if (!mat) return
    const m = parseFloat(magassag)
    const sz = parseFloat(szelesseg)
    const d = parseInt(mennyiseg, 10)
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
              material: cloneMaterial(mat),
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

  const editLine = (row: ButorlapLineItem) => {
    setEditingId(row.id)

    if (!activeMaterials.some(m => m.id === row.material.id)) {
      setOrphanMaterialOption(row.material)
    } else {
      setOrphanMaterialOption(null)
    }

    setSelectedMaterialId(row.material.id)
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

  /** Opti: Enter → Hozzáadás / Mentés */
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

  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bútorlap – részletek
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Táblás anyag ugyanúgy töltődik, mint az Opti oldalon. Szálirány és keresztirány mm-ben (max a tábla mérete mínusz
            szélezés). A pánthelyfúrás opcionális.
          </Typography>

          <Grid container spacing={2} alignItems="flex-start">
            {/** md: 5+2+2+3 = 12 — táblás keskenyebb, a többi mező kitölti a sort üres rés nélkül */}
            <Grid item xs={12} sm={12} md={5}>
              <FronttervezoTablasAnyagField
                options={táblásOptions}
                valueId={selectedMaterialId}
                onChange={id => {
                  setSelectedMaterialId(id)
                  setOrphanMaterialOption(null)
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Szálirány (mm)"
                type="number"
                name="fronttervezo-butorlap-szalirany"
                value={magassag}
                onChange={e => {
                  setMagassag(validateSzalirany(e.target.value))
                  clearValidationError('magassag')
                }}
                onKeyPress={handleDimensionKeyPress}
                inputProps={{
                  min: 0,
                  max: maxSzalirany > 0 ? maxSzalirany : undefined,
                  step: 0.1
                }}
                error={validationErrors.magassag}
                helperText={
                  validationErrors.magassag
                    ? 'Hosszúság megadása kötelező és nagyobb kell legyen 0-nál'
                    : selectedMaterial
                      ? `Max: ${maxSzalirany}mm (${selectedMaterial.length_mm} - ${selectedMaterial.trim_left_mm} - ${selectedMaterial.trim_right_mm})`
                      : ''
                }
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Keresztirány (mm)"
                type="number"
                value={szelesseg}
                onChange={e => {
                  setSzelesseg(validateKeresztirany(e.target.value))
                  clearValidationError('szelesseg')
                }}
                onKeyPress={handleDimensionKeyPress}
                inputProps={{
                  min: 0,
                  max: maxKeresztirany > 0 ? maxKeresztirany : undefined,
                  step: 0.1
                }}
                error={validationErrors.szelesseg}
                helperText={
                  validationErrors.szelesseg
                    ? 'Szélesség megadása kötelező és nagyobb kell legyen 0-nál'
                    : selectedMaterial
                      ? `Max: ${maxKeresztirany}mm (${selectedMaterial.width_mm} - ${selectedMaterial.trim_top_mm} - ${selectedMaterial.trim_bottom_mm})`
                      : ''
                }
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Mennyiség"
                type="number"
                value={mennyiseg}
                onChange={e => {
                  setMennyiseg(onlyDigits(e.target.value))
                  clearValidationError('mennyiseg')
                }}
                onKeyPress={handleDimensionKeyPress}
                inputProps={{ min: 1, step: 1 }}
                error={validationErrors.mennyiseg}
                helperText={
                  validationErrors.mennyiseg
                    ? 'Darab megadása kötelező és nagyobb kell legyen 0-nál'
                    : ''
                }
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
                    <strong>Táblás anyag</strong>
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
                    <TableCell>Bútorlap</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>{row.material.name}</TableCell>
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
            <Button type="button" variant="contained" color="warning" size="large">
              Ajánlat generálás
            </Button>
          </Box>
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
