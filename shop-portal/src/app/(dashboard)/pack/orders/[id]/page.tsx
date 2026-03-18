'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Dialog
} from '@mui/material'
import { Close as CloseIcon, CheckCircle as CheckIcon, Add as AddIcon, Remove as RemoveIcon, Error as ErrorIcon } from '@mui/icons-material'
import Link from 'next/link'
import { toast } from 'react-toastify'

interface PackLine {
  order_item_id: string
  product_id: string | null
  product_name: string
  product_sku: string
  product_gtin: string
  internal_barcode: string
  product_image_url: string | null
  quantity: number
}

interface PackOrder {
  id: string
  order_number: string
  status: string
  customer_email: string | null
  shipping_firstname: string | null
  shipping_lastname: string | null
  shipping_company: string | null
  shipping_address1: string | null
  shipping_address2: string | null
  shipping_city: string | null
  shipping_postcode: string | null
  shipping_country_code: string | null
  shipping_method_name: string | null
  is_pickup: boolean
}

export default function PackOrderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [order, setOrder] = useState<PackOrder | null>(null)
  const [lines, setLines] = useState<PackLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState<Record<string, number>>({})
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const scanBufferRef = useRef('')
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPack = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${id}/pack`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Hiba a betöltéskor')
      }
      const data = await res.json()
      setOrder(data.order)
      setLines(data.lines || [])
      setScanned({})
      setImageErrors({})
    } catch (e: any) {
      setError(e.message || 'Hiba')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPack()
  }, [fetchPack])

  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0)
  const totalScanned = lines.reduce((sum, l) => sum + (scanned[l.order_item_id] ?? 0), 0)
  const allComplete = lines.length > 0 && lines.every((l) => (scanned[l.order_item_id] ?? 0) >= l.quantity)

  const normalizeBarcode = (v: string) =>
    String(v)
      .replace(/\r\n?|\n/g, '')
      .trim()
      .replace(/\s/g, '')

  const matchesLine = (line: PackLine, barcode: string) => {
    const n = normalizeBarcode(barcode)
    if (!n) return false
    if (line.product_gtin && normalizeBarcode(line.product_gtin) === n) return true
    if (line.internal_barcode && normalizeBarcode(line.internal_barcode) === n) return true
    if (line.product_sku && normalizeBarcode(line.product_sku) === n) return true
    return false
  }

  const addOne = (line: PackLine) => {
    const current = scanned[line.order_item_id] ?? 0
    if (current >= line.quantity) return
    setScanError(null)
    setScanned((prev) => ({ ...prev, [line.order_item_id]: current + 1 }))
    setScanSuccess(true)
  }

  const subtractOne = (line: PackLine) => {
    const current = scanned[line.order_item_id] ?? 0
    if (current <= 0) return
    setScanError(null)
    setScanned((prev) => ({ ...prev, [line.order_item_id]: current - 1 }))
  }

  const handleScan = useCallback(
    (barcode: string) => {
      const val = normalizeBarcode(barcode)
      if (!val) return
      setScanError(null)
      setScanSuccess(false)
      const idx = lines.findIndex((l) => matchesLine(l, val))
      if (idx === -1) {
        setScanError('Ez a termék nem tartozik ehhez a rendeléshez.')
        return
      }
      const line = lines[idx]
      const current = scanned[line.order_item_id] ?? 0
      if (current >= line.quantity) {
        setScanError('Ez a sor már kész.')
        return
      }
      setScanned((prev) => ({
        ...prev,
        [line.order_item_id]: current + 1
      }))
      setScanSuccess(true)
    },
    [lines, scanned]
  )

  // Auto-close success modal after a short delay
  useEffect(() => {
    if (!scanSuccess) return
    const t = setTimeout(() => setScanSuccess(false), 500)
    return () => clearTimeout(t)
  }, [scanSuccess])

  // Auto-close error modal after a delay so user can read it
  useEffect(() => {
    if (!scanError) return
    const t = setTimeout(() => setScanError(null), 1800)
    return () => clearTimeout(t)
  }, [scanError])

  useEffect(() => {
    if (!order || lines.length === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
      if (e.key === 'Enter') {
        e.preventDefault()
        const buf = scanBufferRef.current
        scanBufferRef.current = ''
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current)
          scanTimeoutRef.current = null
        }
        if (buf) handleScan(buf)
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBufferRef.current += e.key
        e.preventDefault()
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = setTimeout(() => {
          scanBufferRef.current = ''
          scanTimeoutRef.current = null
        }, 300)
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text')?.trim()
      if (!text) return
      e.preventDefault()
      scanBufferRef.current = ''
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      handleScan(text)
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('paste', onPaste, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('paste', onPaste, true)
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
    }
  }, [order, lines, handleScan])

  const handleComplete = async () => {
    if (!allComplete || !id) return
    setCompleting(true)
    try {
      const scannedPayload: Record<string, number> = {}
      lines.forEach((l) => {
        scannedPayload[l.order_item_id] = scanned[l.order_item_id] ?? l.quantity
      })
      const res = await fetch(`/api/orders/${id}/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanned: scannedPayload })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Hiba')
      }
      if (data.labelPdfBase64) {
        try {
          const bin = atob(data.labelPdfBase64)
          const arr = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
          const blob = new Blob([arr], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank', 'noopener,noreferrer')
          setTimeout(() => URL.revokeObjectURL(url), 60000)
        } catch (_) {
          toast.info('Címke letöltése manuálisan lehetséges a rendelésnél.')
        }
      }
      if (data.express_one_error) {
        toast.warning(data.message || data.express_one_error)
      } else {
        toast.success(data.message || 'Csomag kész.')
      }
      router.push('/pack')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Hiba')
    } finally {
      setCompleting(false)
    }
  }

  const getImageSrc = (line: PackLine) => {
    if (imageErrors[line.order_item_id]) return null
    if (line.product_image_url) return line.product_image_url
    if (line.product_id) return `/api/products/${line.product_id}/main-image`
    return null
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
        <Typography color="text.secondary" variant="h6">Betöltés…</Typography>
      </Box>
    )
  }

  if (error || !order) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6" sx={{ mb: 2 }}>{error || 'Rendelés nem található'}</Typography>
        <Button component={Link} href="/pack" variant="contained" size="large">
          Vissza a csomagolás listához
        </Button>
      </Box>
    )
  }

  const addressLine = [
    order.shipping_city,
    order.shipping_postcode,
    order.shipping_address1,
    order.shipping_address2
  ]
    .filter(Boolean)
    .join(', ')
  const recipientName = [order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') || order.shipping_company || '—'

  return (
    <>
      <Box
        className="ts-layout-content-height-fixed"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 80px)',
          minHeight: 480,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          p: 2,
          pb: 2
        }}
      >
        {/* Scan via document keydown + paste (desktop scanner = keyboard wedge) */}

        {/* Top: order + progress — fixed height */}
        <Box sx={{ flexShrink: 0, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <IconButton component={Link} href="/pack" size="large" aria-label="Vissza a listához" color="inherit">
              <CloseIcon fontSize="large" />
            </IconButton>
            <Chip
              label={order.order_number}
              color="primary"
              sx={{ fontWeight: 700, fontSize: '1.1rem', py: 1.25, px: 1.5 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {recipientName}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {order.shipping_method_name || '—'}
            </Typography>
            {order.is_pickup && (
              <Chip label="Átvevőhely" color="info" variant="outlined" />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>
            {addressLine || '—'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={totalItems ? (totalScanned / totalItems) * 100 : 0}
              sx={{ flex: 1, height: 10, borderRadius: 5 }}
              color="primary"
            />
            <Typography variant="subtitle1" fontWeight={700} sx={{ minWidth: 100, textAlign: 'right' }}>
              {totalScanned} / {totalItems} db
            </Typography>
            {allComplete && (
              <Chip icon={<CheckIcon />} label="Mind kész" color="success" size="medium" />
            )}
          </Box>
        </Box>

        {/* Table — scrollable area; flex 1 + minHeight 0 so it shrinks and scrolls */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              display: 'block'
            }}
          >
            <Table size="medium" stickyHeader sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 700, width: 72 }}>Kép</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Termék</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cikkszám</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>Várt</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 100 }}>Beolvasva</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 160 }}>Kézi −1 / +1</TableCell>
                  <TableCell padding="none" sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
            {lines.map((line) => {
              const s = scanned[line.order_item_id] ?? 0
              const done = s >= line.quantity
              const canAdd = s < line.quantity
              const canSubtract = s > 0
              const imgSrc = getImageSrc(line)
              return (
                <TableRow
                  key={line.order_item_id}
                  sx={{
                    bgcolor: done ? 'rgba(46, 125, 50, 0.22)' : 'rgba(211, 47, 47, 0.12)'
                  }}
                >
                  <TableCell sx={{ py: 1, verticalAlign: 'middle' }}>
                    {imgSrc ? (
                      <Box
                        component="img"
                        src={imgSrc}
                        alt=""
                        onError={() => setImageErrors((prev) => ({ ...prev, [line.order_item_id]: true }))}
                        sx={{
                          width: 56,
                          height: 56,
                          objectFit: 'contain',
                          borderRadius: 1,
                          bgcolor: 'grey.100',
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 1,
                          bgcolor: 'grey.200',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">Nincs kép</Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={500} sx={{ fontSize: '1rem' }}>{line.product_name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography color="text.secondary" sx={{ fontSize: '0.95rem' }}>{line.product_sku}</Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                    {line.quantity}
                  </TableCell>
                  <TableCell align="center">
                    <Typography fontWeight={700} sx={{ fontSize: '1.15rem' }} color={done ? 'success.main' : 'text.primary'}>
                      {s} / {line.quantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => subtractOne(line)}
                        disabled={!canSubtract}
                        aria-label={`Eltávolít: ${line.product_name}`}
                        sx={{ minWidth: 40 }}
                      >
                        <RemoveIcon fontSize="small" />
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => addOne(line)}
                        disabled={!canAdd}
                        aria-label={`Hozzáad: ${line.product_name}`}
                      >
                        +1
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell padding="none">{done && <CheckIcon color="success" sx={{ fontSize: 24 }} />}</TableCell>
                </TableRow>
              )
            })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Bottom: instruction + primary action — always visible, never overlapped */}
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 2, flexWrap: 'wrap', minHeight: 56 }}>
          <Typography variant="body2" color="text.secondary">
            Vonalkódolvasóval szkenneld a termékeket, vagy használd a <strong>−1</strong> / <strong>+1</strong> gombokat; piros sor = még nincs kész, zöld = kész.
          </Typography>
          <Button
            variant="contained"
            color="success"
            size="large"
            disabled={!allComplete || completing}
            onClick={handleComplete}
            startIcon={allComplete ? <CheckIcon sx={{ fontSize: 24 }} /> : undefined}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.15rem',
              fontWeight: 700
            }}
          >
            {completing ? 'Folyamatban…' : 'Csomag kész'}
          </Button>
        </Box>
      </Box>

      {/* Success modal — big, readable, no backdrop blur */}
      <Dialog
        open={scanSuccess}
        onClose={() => setScanSuccess(false)}
        slotProps={{
          backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'none' } }
        }}
        PaperProps={{
          sx: {
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            minWidth: 320,
            boxShadow: 8
          }
        }}
        autoFocus
        disableEscapeKeyDown={false}
      >
        <Box sx={{ py: 3 }}>
          <CheckIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" fontWeight={700} color="success.dark" sx={{ fontSize: '1.75rem' }}>
            Rendben!
          </Typography>
        </Box>
      </Dialog>

      {/* Error modal — big, readable, no backdrop blur */}
      <Dialog
        open={!!scanError}
        onClose={() => setScanError(null)}
        slotProps={{
          backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'none' } }
        }}
        PaperProps={{
          sx: {
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            minWidth: 360,
            maxWidth: 480,
            boxShadow: 8
          }
        }}
        autoFocus
        disableEscapeKeyDown={false}
      >
        <Box sx={{ py: 3 }}>
          <ErrorIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} color="error.dark" sx={{ fontSize: '1.35rem', lineHeight: 1.4 }}>
            {scanError}
          </Typography>
        </Box>
      </Dialog>
    </>
  )
}
