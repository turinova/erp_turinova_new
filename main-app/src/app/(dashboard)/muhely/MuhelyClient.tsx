'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'

type ApiMachine = {
  id: string
  name: string
  machine_type: string
}

type ApiReading = {
  id: string
  machine_id: string
  reading_date: string
  reading_value: number
  lock_at: string
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
}

type ApiRow = {
  machine: ApiMachine
  reading: ApiReading | null
  previous: { reading_date: string; reading_value: number } | null
  locked: boolean
  delta: number | null
}

type ApiResponse = {
  date: string
  today: string
  yesterday: string
  dateLocked: boolean
  dateLockAt: string
  rows: ApiRow[]
}

function budapestDateKey(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function formatHu(n: number) {
  return n.toLocaleString('hu-HU')
}

function fmtMachineType(t: string) {
  if (t === 'edge_bander') return 'Élzáró'
  if (t === 'panel_saw') return 'Lapszabászgép'
  return t
}

function machineTypeChipColor(t: string) {
  if (t === 'edge_bander') return { color: 'info' as const, sx: {} }
  if (t === 'panel_saw') return { color: 'success' as const, sx: {} }
  return { color: 'default' as const, sx: {} }
}

export default function MuhelyClient() {
  const [selectedDate, setSelectedDate] = useState(() => budapestDateKey(new Date()))
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmRow, setConfirmRow] = useState<ApiRow | null>(null)
  const [confirmValue, setConfirmValue] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dateOptions = useMemo(() => {
    const today = budapestDateKey(new Date())

    // Yesterday derived from local calendar date parts in Budapest.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date())
    const y = Number(parts.find(p => p.type === 'year')?.value ?? '1970')
    const m = Number(parts.find(p => p.type === 'month')?.value ?? '01')
    const d = Number(parts.find(p => p.type === 'day')?.value ?? '01')
    const utc = new Date(Date.UTC(y, m - 1, d))
    utc.setUTCDate(utc.getUTCDate() - 1)
    const yesterday = utc.toISOString().slice(0, 10)

    return [
      { key: today, label: `Ma (${today})` },
      { key: yesterday, label: `Tegnap (${yesterday})` }
    ]
  }, [])

  const load = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/production/meters?date=${encodeURIComponent(date)}`, { credentials: 'include' })
      const j = (await res.json()) as any
      if (!res.ok) throw new Error(j?.error || res.statusText)
      const parsed = j as ApiResponse
      setData(parsed)

      // Prime edit inputs with existing values
      const next: Record<string, string> = {}
      for (const row of parsed.rows) {
        next[row.machine.id] = row.reading ? String(row.reading.reading_value) : ''
      }
      setEditValues(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(selectedDate)
  }, [load, selectedDate])

  const yesterdayDanger = useMemo(() => {
    if (!data) return false
    if (selectedDate !== data.yesterday) return false
    return data.dateLocked
  }, [data, selectedDate])

  const openConfirm = (row: ApiRow) => {
    setSaveError(null)
    const raw = (editValues[row.machine.id] ?? '').trim()
    const v = raw === '' ? NaN : Number(raw)
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
      setSaveError('Érvénytelen érték. Csak nem-negatív egész szám adható meg.')
      return
    }
    setConfirmRow(row)
    setConfirmValue(v)
    setConfirmOpen(true)
  }

  const doSave = async () => {
    if (!confirmRow || confirmValue === null) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/production/meters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          machineId: confirmRow.machine.id,
          readingDate: selectedDate,
          readingValue: confirmValue
        })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as any)?.error || res.statusText)

      setConfirmOpen(false)
      setConfirmRow(null)
      setConfirmValue(null)
      await load(selectedDate)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Sikertelen mentés')
    } finally {
      setSaving(false)
    }
  }

  const banner = useMemo(() => {
    if (!data) return null
    if (selectedDate === data.today) {
      return (
        <Alert severity='info'>
          Ma rögzíthetsz és módosíthatsz. A mai nap <strong>holnap 10:00-kor</strong> záródik (Europe/Budapest).
        </Alert>
      )
    }
    if (selectedDate === data.yesterday) {
      return (
        <Alert severity={yesterdayDanger ? 'warning' : 'info'}>
          Tegnapi rögzítés. A tegnapi nap <strong>ma 10:00-kor</strong> záródik (Europe/Budapest).{' '}
          {data.dateLocked ? 'Lezárva.' : 'Zárás után nem módosítható.'}
        </Alert>
      )
    }
    return null
  }, [data, selectedDate, yesterdayDanger])

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
        <FormControl size='small' sx={{ minWidth: 220 }}>
          <InputLabel id='muhely-date-label'>Nap</InputLabel>
          <Select
            labelId='muhely-date-label'
            value={selectedDate}
            label='Nap'
            onChange={e => setSelectedDate(String(e.target.value))}
          >
            {dateOptions.map(o => (
              <MenuItem key={o.key} value={o.key}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />

        <Button variant='outlined' onClick={() => load(selectedDate)} disabled={loading}>
          Frissítés
        </Button>
      </Stack>

      {banner && <Box sx={{ mb: 2 }}>{banner}</Box>}

      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!data && !error && (
        <Alert severity='info' sx={{ mb: 2 }}>
          Betöltés…
        </Alert>
      )}

      {data && (
        <Grid container spacing={2}>
          {data.rows.map(row => {
            const locked = Boolean(row.locked)
            const existing = row.reading
            const inputVal = editValues[row.machine.id] ?? ''
            const delta = row.delta
            const typeChip = machineTypeChipColor(row.machine.machine_type)

            return (
              <Grid key={row.machine.id} item xs={12} md={6}>
                <Card variant='outlined' sx={{ borderColor: locked ? 'divider' : 'primary.light' }}>
                  <CardContent>
                    <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
                      <Typography variant='h6' sx={{ flex: 1 }}>
                        {row.machine.name}
                      </Typography>
                      <Chip
                        label={fmtMachineType(row.machine.machine_type)}
                        size='small'
                        color={typeChip.color}
                        variant='filled'
                        sx={typeChip.sx}
                      />
                      {locked ? (
                        <Chip label='Lezárva' size='small' color='default' variant='filled' />
                      ) : existing ? (
                        <Chip label='Rögzítve' size='small' color='success' variant='filled' />
                      ) : (
                        <Chip label='Nincs adat' size='small' color='warning' variant='outlined' />
                      )}
                    </Stack>

                    <Divider sx={{ mb: 1.5 }} />

                    <Stack spacing={1.25} sx={{ mb: 1.5 }}>
                      <Typography variant='body2' color='text.secondary'>
                        Utolsó rögzítés:{' '}
                        {row.previous ? (
                          <strong>
                            {row.previous.reading_date} — {formatHu(row.previous.reading_value)} m
                          </strong>
                        ) : (
                          <strong>—</strong>
                        )}
                      </Typography>

                      {existing && (
                        <Typography variant='body2' color='text.secondary'>
                          Zárás időpontja: <strong>{new Date(existing.lock_at).toLocaleString('hu-HU')}</strong>
                        </Typography>
                      )}
                      {!existing && data.dateLockAt && (
                        <Typography variant='body2' color='text.secondary'>
                          Zárás időpontja: <strong>{new Date(data.dateLockAt).toLocaleString('hu-HU')}</strong>
                        </Typography>
                      )}

                      {existing && delta !== null && (
                        <Typography variant='body2'>
                          Különbség az előző rögzítéshez képest: <strong>+{formatHu(delta)} m</strong>
                        </Typography>
                      )}
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <TextField
                        fullWidth
                        label='Abszolút méter (m)'
                        value={inputVal}
                        disabled={locked || loading}
                        inputMode='numeric'
                        onChange={e => setEditValues(v => ({ ...v, [row.machine.id]: e.target.value }))}
                      />

                      <Button
                        variant='contained'
                        disabled={locked || loading}
                        onClick={() => openConfirm(row)}
                        sx={{ minWidth: 160 }}
                      >
                        {existing ? 'Módosítás' : 'Mentés'}
                      </Button>
                    </Stack>

                    {saveError && confirmRow?.machine.id === row.machine.id && (
                      <Alert severity='error' sx={{ mt: 1.5 }}>
                        {saveError}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      <Dialog open={confirmOpen} onClose={() => (saving ? null : setConfirmOpen(false))} maxWidth='sm' fullWidth>
        <DialogTitle>Mentés megerősítése</DialogTitle>
        <DialogContent>
          {confirmRow && (
            <Box sx={{ pt: 0.5 }}>
              <Typography variant='body1' sx={{ mb: 1 }}>
                Rögzíted az értéket?
              </Typography>
              <Stack spacing={1}>
                <Typography variant='body2' color='text.secondary'>
                  Gép: <strong>{confirmRow.machine.name}</strong> ({fmtMachineType(confirmRow.machine.machine_type)})
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Nap: <strong>{selectedDate}</strong>
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Abszolút méter: <strong>{confirmValue !== null ? formatHu(confirmValue) : '—'} m</strong>
                </Typography>
              </Stack>
              <Alert severity='warning' sx={{ mt: 2 }}>
                A nap zárása után (következő nap 10:00, Europe/Budapest) nem módosítható.
              </Alert>
              {saveError && (
                <Alert severity='error' sx={{ mt: 2 }}>
                  {saveError}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Mégse
          </Button>
          <Button variant='contained' onClick={doSave} disabled={saving}>
            {saving ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

