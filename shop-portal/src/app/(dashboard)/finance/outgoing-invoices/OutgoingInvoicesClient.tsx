'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Stack,
  alpha,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import {
  Search as SearchIcon,
  ReceiptLong as ReceiptIcon,
  ShoppingBagOutlined as OrderIcon,
  FilterList as FilterIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Undo as UndoIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import { useDebounce } from '@/hooks/useDebounce'
import {
  INVOICE_TYPE_LABELS,
  INVOICE_PAYMENT_STATUS_LABELS,
  invoiceTypeLabel,
  invoicePaymentStatusLabel
} from '@/lib/invoice-labels'
import type { OutgoingInvoiceRow } from './page'
import { DIJBEKERO_DELETE_BLOCKED_MESSAGE } from '@/lib/invoice-dijbekero-delete-guard'

const LIMIT_OPTIONS = [25, 50, 100] as const

function buildListHref(opts: {
  page: number
  limit: number
  type: string
  status: string
  search: string
  from: string
  to: string
}) {
  const p = new URLSearchParams()
  const q = opts.search.trim()
  if (q) p.set('search', q)
  if (opts.type && opts.type !== 'all') p.set('type', opts.type)
  if (opts.status && opts.status !== 'all') p.set('status', opts.status)
  if (opts.from) p.set('from', opts.from)
  if (opts.to) p.set('to', opts.to)
  p.set('limit', String(opts.limit))
  if (opts.page > 1) p.set('page', String(opts.page))
  return `/finance/outgoing-invoices?${p.toString()}`
}

/** Same as OrderDetailForm — sztornó / díjbekérő törlés only when linked to an order. */
function canStornoOrDelete(row: OutgoingInvoiceRow): boolean {
  if (row.invoice_type === 'sztorno') return false
  if (!row.related_order_id || !row.provider_invoice_number?.trim()) return false
  return row.invoice_type === 'dijbekero' || row.invoice_type === 'szamla' || row.invoice_type === 'elolegszamla'
}

function formatHuf(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0
  }).format(amount)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium' }).format(d)
  } catch {
    return '—'
  }
}

function typeChipColor(t: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' {
  switch (t) {
    case 'szamla':
      return 'success'
    case 'dijbekero':
      return 'warning'
    case 'elolegszamla':
      return 'info'
    case 'sztorno':
      return 'error'
    default:
      return 'default'
  }
}

function statusChipColor(s: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (s) {
    case 'fizetve':
      return 'success'
    case 'pending':
      return 'warning'
    case 'nem_lesz_fizetve':
      return 'info'
    default:
      return 'default'
  }
}

export type OutgoingInvoicesClientProps = {
  rows: OutgoingInvoiceRow[]
  connectionNames: Record<string, string>
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialType: string
  initialStatus: string
  initialSearch: string
  initialFrom: string
  initialTo: string
  pageGrossSum: number
}

export default function OutgoingInvoicesClient({
  rows,
  connectionNames,
  dijbekeroDeletionBlockedByOrderId = {},
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialType,
  initialStatus,
  initialSearch,
  initialFrom,
  initialTo,
  pageGrossSum
}: OutgoingInvoicesClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [typeFilter, setTypeFilter] = useState(initialType || 'all')
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all')
  const [limitFilter, setLimitFilter] = useState(limit)
  const [fromDate, setFromDate] = useState(initialFrom)
  const [toDate, setToDate] = useState(initialTo)
  const debouncedSearch = useDebounce(searchTerm, 500)

  const filterBaselineRef = useRef<{ s: string; t: string; st: string; l: number; f: string; to: string } | null>(
    null
  )

  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false)
  const [stornoTarget, setStornoTarget] = useState<OutgoingInvoiceRow | null>(null)
  const [stornoSubmitting, setStornoSubmitting] = useState(false)

  const handleOpenStornoDialog = useCallback(
    (inv: OutgoingInvoiceRow) => {
      if (!inv.related_order_id) {
        toast.info('Sztornóhoz szükség van a kapcsolódó rendelésre.')
        return
      }
      if (
        inv.invoice_type === 'dijbekero' &&
        dijbekeroDeletionBlockedByOrderId[inv.related_order_id]
      ) {
        toast.error(DIJBEKERO_DELETE_BLOCKED_MESSAGE)
        return
      }
      setStornoTarget(inv)
      setStornoDialogOpen(true)
    },
    [dijbekeroDeletionBlockedByOrderId]
  )

  const handleCloseStornoDialog = useCallback(() => {
    if (stornoSubmitting) return
    setStornoDialogOpen(false)
    setStornoTarget(null)
  }, [stornoSubmitting])

  const handleConfirmStorno = useCallback(async () => {
    if (!stornoTarget?.provider_invoice_number || !stornoTarget.related_order_id) {
      toast.error('Hiányzik a számlaszám vagy a rendelés a művelethez')
      return
    }
    setStornoSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${stornoTarget.related_order_id}/storno-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerInvoiceNumber: stornoTarget.provider_invoice_number })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Hiba a művelet során')
      }
      if (data.deleted) {
        toast.success(data.message || 'Díjbekérő sikeresen törölve')
      } else {
        toast.success(`Sztornó számla létrehozva: ${data.invoiceNumber || '—'}`)
      }
      setStornoDialogOpen(false)
      setStornoTarget(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba a művelet során')
    } finally {
      setStornoSubmitting(false)
    }
  }, [stornoTarget, router])

  /** Same logic as OrderDetailForm `handleOpenInvoicePdf` — POST query when order exists, else GET invoice PDF proxy. */
  const handleOpenInvoicePdf = useCallback(async (inv: OutgoingInvoiceRow) => {
    if (inv.pdf_url) {
      window.open(inv.pdf_url, '_blank', 'noopener')
      return
    }
    if (!inv.provider_invoice_number) {
      toast.info('Nincs számlaszám a PDF lekéréshez')
      return
    }
    if (inv.related_order_id && inv.related_order_type === 'order') {
      setPdfLoadingId(inv.id)
      try {
        const res = await fetch(`/api/orders/${inv.related_order_id}/query-invoice-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceNumber: inv.provider_invoice_number })
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'PDF lekérési hiba')
        }
        if (data.pdf) {
          const binary = atob(data.pdf)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          const blob = new Blob([bytes], { type: data.mimeType || 'application/pdf' })
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank', 'noopener')
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'PDF hiba')
      } finally {
        setPdfLoadingId(null)
      }
      return
    }
    window.open(`/api/invoices/${inv.id}/szamlazz-pdf`, '_blank', 'noopener')
  }, [])

  useEffect(() => {
    setSearchTerm(initialSearch)
  }, [initialSearch])
  useEffect(() => {
    setTypeFilter(initialType || 'all')
  }, [initialType])
  useEffect(() => {
    setStatusFilter(initialStatus || 'all')
  }, [initialStatus])
  useEffect(() => {
    setLimitFilter(limit)
  }, [limit])
  useEffect(() => {
    setFromDate(initialFrom)
  }, [initialFrom])
  useEffect(() => {
    setToDate(initialTo)
  }, [initialTo])

  useEffect(() => {
    const key = {
      s: debouncedSearch,
      t: typeFilter,
      st: statusFilter,
      l: limitFilter,
      f: fromDate,
      to: toDate
    }
    if (filterBaselineRef.current === null) {
      filterBaselineRef.current = key
      return
    }
    const prev = filterBaselineRef.current
    if (
      prev.s === key.s &&
      prev.t === key.t &&
      prev.st === key.st &&
      prev.l === key.l &&
      prev.f === key.f &&
      prev.to === key.to
    )
      return
    filterBaselineRef.current = key
    router.push(
      buildListHref({
        page: 1,
        limit: key.l,
        type: key.t,
        status: key.st,
        search: key.s,
        from: key.f,
        to: key.to
      })
    )
  }, [debouncedSearch, typeFilter, statusFilter, limitFilter, fromDate, toDate, router])

  const handlePageChange = useCallback(
    (_: React.ChangeEvent<unknown>, page: number) => {
      router.push(
        buildListHref({
          page,
          limit: limitFilter,
          type: typeFilter,
          status: statusFilter,
          search: debouncedSearch,
          from: fromDate,
          to: toDate
        })
      )
    },
    [router, limitFilter, typeFilter, statusFilter, debouncedSearch, fromDate, toDate]
  )

  const hasActiveFilters = useMemo(() => {
    return (
      (typeFilter && typeFilter !== 'all') ||
      (statusFilter && statusFilter !== 'all') ||
      !!searchTerm.trim() ||
      !!fromDate ||
      !!toDate ||
      limitFilter !== 25
    )
  }, [typeFilter, statusFilter, searchTerm, fromDate, toDate, limitFilter])

  const handleClearFilters = () => {
    setSearchTerm('')
    setTypeFilter('all')
    setStatusFilter('all')
    setLimitFilter(25)
    setFromDate('')
    setToDate('')
    filterBaselineRef.current = { s: '', t: 'all', st: 'all', l: 25, f: '', to: '' }
    router.push(buildListHref({ page: 1, limit: 25, type: 'all', status: 'all', search: '', from: '', to: '' }))
  }

  const typeEntries = Object.entries(INVOICE_TYPE_LABELS)
  const statusEntries = Object.entries(INVOICE_PAYMENT_STATUS_LABELS)

  return (
    <Box>
      {/* Hero — calm “Notion + commerce” header */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.grey[100], 0.9)} 48%, ${theme.palette.background.paper} 100%)`
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
          <Box sx={{ maxWidth: 720 }}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: '0.12em', fontWeight: 700, color: 'primary.main', display: 'block', mb: 0.5 }}
            >
              Pénzügy
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 1 }}>
              Kimenő számlák
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              Minden kimenő bizonylat egy helyen — díjbekérő, számla és sztornó. Szűrhet típus, fizetési állapot és időszak
              szerint; egy kattintással megnyithatja a PDF-et vagy a kapcsolódó rendelést.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ pt: { xs: 0, md: 0.5 } }}>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.25,
                minWidth: 140,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                Találatok
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {totalCount.toLocaleString('hu-HU')}
              </Typography>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.25,
                minWidth: 160,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
                Bruttó (ezen az oldalon)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {formatHuf(pageGrossSum)}
              </Typography>
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      {/* Filters — dense toolbar like Shopify admin */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.grey[50], 0.85)
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <FilterIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            SZŰRŐK
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
            gap: 2,
            alignItems: 'center'
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Típus</InputLabel>
            <Select value={typeFilter} label="Típus" onChange={(e) => setTypeFilter(e.target.value)}>
              <MenuItem value="all">Összes típus</MenuItem>
              {typeEntries.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Fizetés</InputLabel>
            <Select value={statusFilter} label="Fizetés" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">Összes állapot</MenuItem>
              {statusEntries.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Kezdő dátum"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            size="small"
            label="Záró dátum"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Lista</InputLabel>
            <Select value={limitFilter} label="Lista" onChange={(e) => setLimitFilter(Number(e.target.value))}>
              {LIMIT_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n} / oldal
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Keresés: belső szám, vevő, rendelés, szolgáltatói szám…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          {hasActiveFilters && (
            <Button size="small" onClick={handleClearFilters} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Szűrők törlése
            </Button>
          )}
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'auto',
          maxHeight: { md: 'calc(100vh - 320px)' }
        }}
      >
        <Table size="small" stickyHeader sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Bizonylat
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Típus
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Vevő
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Rendelés
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Bruttó
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Fizetés
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Esedékesség
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Kapcsolat
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', bgcolor: 'grey.50' }}>
                Műveletek
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ py: 8, textAlign: 'center', border: 'none' }}>
                  <ReceiptIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {hasActiveFilters ? 'Nincs a szűrésnek megfelelő számla' : 'Még nincs kimenő számla'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto' }}>
                    {hasActiveFilters
                      ? 'Próbáljon más dátumot vagy törölje a szűrőket. Ha frissen állította be a Számlázz kapcsolatot, az első bizonylatok a puffer feldolgozásakor vagy a rendelésről indulnak.'
                      : 'A Számlázz.hu felől érkező díjbekérők és számlák itt jelennek meg. Feldolgozzon egy puffer rendelést, vagy állítson ki bizonylatot egy rendelésről.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const gross =
                  typeof row.gross_total === 'string' ? parseFloat(row.gross_total) : Number(row.gross_total)
                const orderHref =
                  row.related_order_type === 'order' && row.related_order_id
                    ? `/orders/${row.related_order_id}`
                    : null
                const connName = row.connection_id ? connectionNames[row.connection_id] : null

                return (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      '&:nth-of-type(even)': { bgcolor: (t) => alpha(t.palette.grey[50], 0.5) },
                      '&:last-child td': { borderBottom: 0 }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {row.internal_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.provider_invoice_number || row.provider || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={invoiceTypeLabel(row.invoice_type)}
                        color={typeChipColor(row.invoice_type)}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.customer_name || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      {orderHref ? (
                        <Button
                          component={NextLink}
                          href={orderHref}
                          size="small"
                          startIcon={<OrderIcon sx={{ fontSize: 16 }} />}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          {row.related_order_number || 'Rendelés'}
                        </Button>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {row.related_order_number || '—'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {formatHuf(Number.isFinite(gross) ? gross : null)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={invoicePaymentStatusLabel(row.payment_status)}
                        color={statusChipColor(row.payment_status)}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(row.payment_due_date)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kiállítva: {formatDate(row.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{connName || '—'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip
                          title={
                            row.invoice_type === 'dijbekero' &&
                            row.related_order_id &&
                            dijbekeroDeletionBlockedByOrderId[row.related_order_id]
                              ? DIJBEKERO_DELETE_BLOCKED_MESSAGE
                              : 'Sztornó / díjbekérő törlése'
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={
                                row.invoice_type === 'sztorno' ||
                                !canStornoOrDelete(row) ||
                                (row.invoice_type === 'dijbekero' &&
                                  !!row.related_order_id &&
                                  !!dijbekeroDeletionBlockedByOrderId[row.related_order_id])
                              }
                              onClick={() => handleOpenStornoDialog(row)}
                              aria-label="Sztornó"
                            >
                              <UndoIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="PDF megnyitás">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenInvoicePdf(row)}
                              disabled={
                                pdfLoadingId === row.id ||
                                (!row.pdf_url && !row.provider_invoice_number)
                              }
                              aria-label="PDF"
                            >
                              {pdfLoadingId === row.id ? (
                                <CircularProgress size={18} />
                              ) : (
                                <PictureAsPdfIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
          <Typography variant="body2" color="text.secondary">
            {totalCount.toLocaleString('hu-HU')} bizonylat összesen
          </Typography>
        </Box>
      )}

      {totalPages <= 1 && totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {totalCount.toLocaleString('hu-HU')} bizonylat
        </Typography>
      )}

      <Dialog open={stornoDialogOpen} onClose={handleCloseStornoDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {stornoTarget?.invoice_type === 'dijbekero' ? 'Díjbekérő törlése' : 'Sztornó számla'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {stornoTarget?.invoice_type === 'dijbekero'
              ? 'Biztosan törölni szeretné ezt a díjbekérőt?'
              : 'Biztosan létrehozza a sztornó számlát a következő számlához?'}
          </Typography>
          <Typography sx={{ mt: 1 }} fontWeight="bold">
            {stornoTarget?.provider_invoice_number ?? '—'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStornoDialog} disabled={stornoSubmitting}>
            Mégse
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmStorno} disabled={stornoSubmitting}>
            {stornoSubmitting
              ? 'Folyamatban…'
              : stornoTarget?.invoice_type === 'dijbekero'
                ? 'Törlés'
                : 'Sztornó létrehozása'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
