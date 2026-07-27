'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DownloadIcon from '@mui/icons-material/Download'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import { toast } from 'react-toastify'

import { formatFt } from './customerFacingPdfShared'
import type { PortalCustomerQuoteListItem } from '@/lib/portal-customer-quotes'
import { sourcesSummaryLabel } from '@/lib/portal-customer-quotes'

type Props = {
  quotes: PortalCustomerQuoteListItem[]
  loadError?: string | null
}

function formatHuDate(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}.${m}.${day}.`
  } catch {
    return '—'
  }
}

export default function CustomerQuoteHub({ quotes: initialQuotes, loadError }: Props) {
  const router = useRouter()
  const [quotes, setQuotes] = useState(initialQuotes)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  React.useEffect(() => {
    setQuotes(initialQuotes)
  }, [initialQuotes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return quotes
    return quotes.filter(item => {
      const hay = [
        item.quote_number,
        item.buyer_name,
        item.project_title || '',
        item.sources_summary
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [quotes, query])

  const downloadSnapshotPdf = async (id: string, quoteNumber: string) => {
    setBusyId(id)
    try {
      const response = await fetch('/api/ugyfel-ajanlat/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerQuoteId: id, useSnapshot: true })
      })
      if (!response.ok) {
        let errorMessage = 'PDF letöltés sikertelen'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          /* ignore */
        }
        throw new Error(errorMessage)
      }
      const blob = await response.blob()
      if (blob.size === 0) throw new Error('A generált PDF üres')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ugyfelajanlat-${quoteNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('PDF kész (mentett pillanatkép)')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF hiba')
    } finally {
      setBusyId(null)
    }
  }

  const deleteQuote = async (q: PortalCustomerQuoteListItem) => {
    const ok = window.confirm(
      `Biztosan törlöd az ajánlatot?\n${q.quote_number} — ${q.buyer_name || '—'}`
    )
    if (!ok) return
    setDeletingId(q.id)
    try {
      const response = await fetch(`/api/ugyfel-ajanlat/${q.id}`, { method: 'DELETE' })
      if (!response.ok) {
        let errorMessage = 'Törlés sikertelen'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          /* ignore */
        }
        throw new Error(errorMessage)
      }
      setQuotes(prev => prev.filter(item => item.id !== q.id))
      toast.success('Ajánlat törölve')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Törlés hiba')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <RequestQuoteIcon color="success" />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Ügyfélajánlat
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
            Saját ügyfélajánlataid — árréssel, PDF-fel. A forrást (Lapszabászat / Nettfront) a
            szerkesztőben adod hozzá.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/ugyfel-ajanlat/uj"
          variant="contained"
          color="success"
          size="large"
          startIcon={<AddIcon />}
          sx={{ fontWeight: 700, alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          Új ügyfélajánlat
        </Button>
      </Stack>

      {loadError ? (
        <Alert severity="warning">{loadError}</Alert>
      ) : null}

      {quotes.length === 0 && !loadError ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Még nincs ügyfélajánlatod
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Mentés vagy PDF letöltés a szerkesztőben ide menti. Forrást Mentésekből /
              Megrendelésekből a szerkesztőben adhatsz hozzá.
            </Typography>
            <Button
              component={Link}
              href="/ugyfel-ajanlat/uj"
              variant="contained"
              color="success"
              startIcon={<AddIcon />}
            >
              Új ügyfélajánlat
            </Button>
          </CardContent>
        </Card>
      ) : quotes.length > 0 ? (
        <Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Mentett ajánlatok ({filtered.length}
              {query.trim() ? ` / ${quotes.length}` : ''})
            </Typography>
            <TextField
              size="small"
              placeholder="Keresés: szám, vevő, projekt…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              sx={{ minWidth: { sm: 280 } }}
            />
          </Stack>

          {filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nincs találat. Próbálj más keresést.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Szám</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Vevő</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Projekt</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Forrás</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Bruttó
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Frissítve</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Műveletek
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(q => (
                    <TableRow key={q.id} hover>
                      <TableCell>
                        <Chip size="small" color="success" label={q.quote_number} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {q.buyer_name || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {q.project_title || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={sourcesSummaryLabel(q.sources_summary)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatFt(q.payable_gross)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                          {formatHuDate(q.updated_at)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Megnyitás">
                            <IconButton
                              component={Link}
                              href={`/ugyfel-ajanlat/uj?cid=${q.id}`}
                              size="small"
                              color="success"
                              aria-label="Megnyitás"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="PDF">
                            <span>
                              <IconButton
                                size="small"
                                color="success"
                                aria-label="PDF"
                                disabled={busyId === q.id || deletingId === q.id}
                                onClick={() => downloadSnapshotPdf(q.id, q.quote_number)}
                              >
                                {busyId === q.id ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <DownloadIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Törlés">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label="Törlés"
                                disabled={deletingId === q.id || busyId === q.id}
                                onClick={() => deleteQuote(q)}
                              >
                                {deletingId === q.id ? (
                                  <CircularProgress size={16} color="inherit" />
                                ) : (
                                  <DeleteOutlineIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      ) : null}
    </Box>
  )
}
