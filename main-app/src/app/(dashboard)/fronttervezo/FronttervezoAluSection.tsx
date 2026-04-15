'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'

import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
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
import { dispatchFronttervezoLinesUpdated, FRONTTERVEZO_SESSION_KEY_ALU } from './fronttervezoSession'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'background.paper' }
  }
} as const

const SESSION_KEY = FRONTTERVEZO_SESSION_KEY_ALU

const PROFIL_OPTIONS = ['Z1', 'Z10', 'Z12'] as const
const SZIN_OPTIONS = ['Ezüst', 'Fekete', 'Inox'] as const
const PANTOLAS_OPTIONS = ['Magassági oldalon', 'Szélességi oldalon', 'Nincs'] as const

export type AluLineItem = {
  id: string
  profil: (typeof PROFIL_OPTIONS)[number]
  szin: (typeof SZIN_OPTIONS)[number]
  pantolas: (typeof PANTOLAS_OPTIONS)[number]
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
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

export default function FronttervezoAluSection() {
  const [lines, setLines] = useState<AluLineItem[]>([])
  const [hasLoadedFromSession, setHasLoadedFromSession] = useState(false)

  const [profil, setProfil] = useState<string>(PROFIL_OPTIONS[0])
  const [szin, setSzin] = useState<string>(SZIN_OPTIONS[0])
  const [pantolas, setPantolas] = useState<string>(PANTOLAS_OPTIONS[0])
  const [magassag, setMagassag] = useState('')
  const [szelesseg, setSzelesseg] = useState('')
  const [mennyiseg, setMennyiseg] = useState('')
  const [megjegyzes, setMegjegyzes] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AluLineItem[]

        if (Array.isArray(parsed)) {
          setLines(parsed)
        }
      } catch {
        console.error('[fronttervezo] alu session parse error')
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
    setProfil(PROFIL_OPTIONS[0])
    setSzin(SZIN_OPTIONS[0])
    setPantolas(PANTOLAS_OPTIONS[0])
    setMagassag('')
    setSzelesseg('')
    setMennyiseg('')
    setMegjegyzes('')
    setEditingId(null)
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

  const addLine = () => {
    if (!validateMainForm()) return
    const m = parsePositiveInt(magassag)!
    const sz = parsePositiveInt(szelesseg)!
    const d = parsePositiveInt(mennyiseg)!

    const item: AluLineItem = {
      id: Date.now().toString(),
      profil: profil as AluLineItem['profil'],
      szin: szin as AluLineItem['szin'],
      pantolas: pantolas as AluLineItem['pantolas'],
      magassagMm: m,
      szelessegMm: sz,
      mennyiseg: d,
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

    setLines(prev =>
      prev.map(row =>
        row.id === editingId
          ? {
              ...row,
              profil: profil as AluLineItem['profil'],
              szin: szin as AluLineItem['szin'],
              pantolas: pantolas as AluLineItem['pantolas'],
              magassagMm: m,
              szelessegMm: sz,
              mennyiseg: d,
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

  const editLine = (row: AluLineItem) => {
    setEditingId(row.id)
    setProfil(row.profil)
    setSzin(row.szin)
    setPantolas(row.pantolas)
    setMagassag(String(row.magassagMm))
    setSzelesseg(String(row.szelessegMm))
    setMennyiseg(String(row.mennyiseg))
    setMegjegyzes(row.megjegyzes ?? '')

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 80)
  }

  const cancelEdit = () => {
    resetForm()
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
            ALU FRONT – részletek
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Magasság és szélesség mm-ben, egész szám. Árazás: 70&nbsp;000 Ft/m² bruttó (ideiglenesen).
          </Typography>

          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel id="fronttervezo-alu-profil">Aluprofil</InputLabel>
                <Select
                  labelId="fronttervezo-alu-profil"
                  label="Aluprofil"
                  value={profil}
                  onChange={(e: SelectChangeEvent) => setProfil(e.target.value)}
                >
                  {PROFIL_OPTIONS.map(opt => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" sx={inputSx}>
                <InputLabel id="fronttervezo-alu-szin">Szín</InputLabel>
                <Select
                  labelId="fronttervezo-alu-szin"
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
                <InputLabel id="fronttervezo-alu-pant">Pántolás iránya</InputLabel>
                <Select
                  labelId="fronttervezo-alu-pant"
                  label="Pántolás iránya"
                  value={pantolas}
                  onChange={(e: SelectChangeEvent) => setPantolas(e.target.value)}
                >
                  {PANTOLAS_OPTIONS.map(opt => (
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
                    <strong>Aluprofil</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Szín</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Pántolás</strong>
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
                    <TableCell>ALU FRONT</TableCell>
                    <TableCell>{row.profil}</TableCell>
                    <TableCell>{row.szin}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>{row.pantolas}</TableCell>
                    <TableCell>{row.magassagMm} mm</TableCell>
                    <TableCell>{row.szelessegMm} mm</TableCell>
                    <TableCell>{row.mennyiseg}</TableCell>
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
    </>
  )
}
