'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Pagination
} from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface PickBatch {
  id: string
  code: string
  name: string | null
  status: string
  created_by_user: { id: string; email: string; full_name: string | null } | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  order_count: number
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Piszkozat',
  in_progress: 'Folyamatban',
  completed: 'Kész',
  cancelled: 'Megszakítva'
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error'> = {
  draft: 'default',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'error'
}

export default function PickBatchesTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [batches, setBatches] = useState<PickBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'active')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [creating, setCreating] = useState(false)

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await fetch(`/api/pick-batches?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setBatches(data.pick_batches || [])
      setTotalPages(data.pagination?.totalPages ?? 1)
      setTotal(data.pagination?.total ?? 0)
    } catch (e) {
      console.error(e)
      toast.error('Hiba a begyűjtések lekérdezésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [statusFilter, page])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    else params.delete('status')
    if (page > 1) params.set('page', String(page))
    else params.delete('page')
    const q = params.toString()
    router.push(q ? `/pick-batches?${q}` : '/pick-batches', { scroll: false })
  }, [statusFilter, page])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/pick-batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Hiba')
      }
      const data = await res.json()
      toast.success('Begyűjtés létrehozva')
      router.push(`/pick-batches/${data.pick_batch.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Hiba a létrehozáskor')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            value={statusFilter}
            label="Státusz"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <MenuItem value="all">Összes</MenuItem>
            <MenuItem value="active">Aktív (piszkozat + folyamatban)</MenuItem>
            <MenuItem value="draft">Piszkozat</MenuItem>
            <MenuItem value="in_progress">Folyamatban</MenuItem>
            <MenuItem value="completed">Kész</MenuItem>
            <MenuItem value="cancelled">Megszakítva</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} disabled={creating}>
          {creating ? 'Létrehozás…' : 'Új begyűjtés'}
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kód</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell align="right">Rendelések</TableCell>
              <TableCell>Létrehozva</TableCell>
              <TableCell>Befejezve</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  Nincs begyűjtés.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow
                  key={b.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/pick-batches/${b.id}`)}
                >
                  <TableCell>
                    <Box component={NextLink} href={`/pick-batches/${b.id}`} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none' }}>
                      {b.code}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={STATUS_LABELS[b.status] || b.status} color={STATUS_COLORS[b.status] || 'default'} />
                  </TableCell>
                  <TableCell align="right">{b.order_count}</TableCell>
                  <TableCell>{formatDate(b.created_at)}</TableCell>
                  <TableCell>{formatDate(b.completed_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button size="small" component={NextLink} href={`/pick-batches/${b.id}`}>
                      Megnyitás
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Box>
      )}
    </Box>
  )
}
