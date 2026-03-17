'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  IconButton,
  Chip
} from '@mui/material'
import { CheckCircle as CheckIcon, Error as ErrorIcon, Close as CloseIcon, ChevronLeft as PrevIcon, ChevronRight as NextIcon } from '@mui/icons-material'
import Link from 'next/link'
import { toast } from 'react-toastify'

interface PickLine {
  order_item_id: string
  order_id: string
  product_id: string | null
  order_number: string
  product_name: string
  product_sku: string
  product_gtin: string
  internal_barcode: string
  product_image_url: string | null
  quantity: number
}

export default function PickPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [lines, setLines] = useState<PickLine[]>([])
  const [batchCode, setBatchCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [imageError, setImageError] = useState(false)
  const scanBufferRef = useRef('')
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPickList = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pick-batches/${id}/pick-list`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Hiba a lista betöltésekor')
      }
      const data = await res.json()
      setLines(data.lines || [])
      setBatchCode(data.pick_batch?.code || '')
      setIndex(0)
      setPicked({})
    } catch (e: any) {
      setError(e.message || 'Hiba')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPickList()
  }, [fetchPickList])

  const totalLines = lines.length
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0)
  const totalPickedSoFar = lines.reduce((sum, l) => sum + (picked[l.order_item_id] ?? 0), 0)
  const allDone = totalItems > 0 && totalPickedSoFar >= totalItems
  const firstIncompleteIndex = lines.findIndex((l) => (picked[l.order_item_id] ?? 0) < l.quantity)
  const safeIndex = index >= 0 && index < lines.length ? index : firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0
  const currentLine = lines[safeIndex] ?? null
  const currentPicked = currentLine ? (picked[currentLine.order_item_id] ?? 0) : 0

  const normalizeBarcode = (v: string) =>
    String(v)
      .replace(/\r\n?|\n/g, '')
      .trim()
      .replace(/\s/g, '')

  const matchesLine = (line: PickLine, scanned: string) => {
    const n = normalizeBarcode(scanned)
    if (!n) return false
    if (line.product_gtin && normalizeBarcode(line.product_gtin) === n) return true
    if (line.internal_barcode && normalizeBarcode(line.internal_barcode) === n) return true
    if (line.product_sku && normalizeBarcode(line.product_sku) === n) return true
    return false
  }

  const handleScan = useCallback((scanned: string) => {
    const val = normalizeBarcode(scanned)
    if (!val) return
    setScanError(null)
    setScanSuccess(false)
    if (lines.length === 0) return
    const matchedWithRoom = lines.find(
      (l) => matchesLine(l, val) && (picked[l.order_item_id] ?? 0) < l.quantity
    )
    if (matchedWithRoom) {
      const currentPickedForLine = picked[matchedWithRoom.order_item_id] ?? 0
      const nextPicked = Math.min(currentPickedForLine + 1, matchedWithRoom.quantity)
      setPicked((prev) => ({ ...prev, [matchedWithRoom.order_item_id]: nextPicked }))
      scanBufferRef.current = ''
      setScanSuccess(true)
      setTimeout(() => setScanSuccess(false), 1500)
      setIndex((i) => {
        const nextIncomplete = lines.findIndex((l) => {
          const count = l.order_item_id === matchedWithRoom.order_item_id ? nextPicked : (picked[l.order_item_id] ?? 0)
          return count < l.quantity
        })
        return nextIncomplete >= 0 ? nextIncomplete : lines.length
      })
      return
    }
    const matchedFull = lines.find((l) => matchesLine(l, val))
    if (matchedFull) {
      setScanError('Ez a termék már kiszedve')
    } else {
      setScanError('Rossz vonalkód')
    }
    scanBufferRef.current = ''
  }, [picked, lines])

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const res = await fetch(`/api/pick-batches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Hiba')
      }
      toast.success('Begyűjtés kész')
      router.push(`/pick-batches/${id}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Hiba')
    } finally {
      setCompleting(false)
    }
  }

  // Document-level key listener for PDA barcode scanner (no input = keyboard never opens)
  useEffect(() => {
    if (!currentLine || allDone) return
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
  }, [currentLine, allDone, handleScan])

  // Reset image error when current line changes
  useEffect(() => {
    setImageError(false)
  }, [currentLine?.order_item_id])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 2, bgcolor: 'background.default' }}>
        <Typography sx={{ fontSize: '1.5rem', color: 'text.secondary' }}>Betöltés…</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, p: 3, gap: 2, bgcolor: 'background.default' }}>
        <ErrorIcon sx={{ fontSize: 64 }} color="error" />
        <Typography sx={{ fontSize: '1.35rem', textAlign: 'center' }} color="error">{error}</Typography>
        <Button component={Link} href={`/pick-batches/${id}`} variant="contained" color="primary" sx={{ fontSize: '1.1rem', py: 1.5, px: 3 }}>Vissza</Button>
      </Box>
    )
  }

  if (lines.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, p: 3, gap: 2, bgcolor: 'background.default' }}>
        <Typography sx={{ fontSize: '1.35rem' }} color="text.secondary">Nincs tétel a begyűjtésben.</Typography>
        <Button component={Link} href={`/pick-batches/${id}`} variant="contained" color="primary" sx={{ fontSize: '1.1rem', py: 1.5, px: 3 }}>Vissza</Button>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        maxWidth: 720,
        margin: '0 auto',
        bgcolor: 'background.default',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'max(env(safe-area-inset-left), 8px)',
        paddingRight: 'max(env(safe-area-inset-right), 8px)',
        overflow: 'hidden'
      }}
    >
      {/* No visible/hidden input: scan via document keydown + paste only, so PDA keyboard never opens */}

      {/* Header - compact on small viewports */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 }, py: { xs: 1, sm: 2 }, flexShrink: 0 }}>
        <IconButton component={Link} href={`/pick-batches/${id}`} size="large" aria-label="Vissza" color="inherit" sx={{ p: { xs: 0.5, sm: 1 } }}>
          <CloseIcon fontSize="medium" />
        </IconButton>
        <Chip
          label={batchCode}
          sx={{ fontSize: { xs: '0.95rem', sm: '1.1rem' }, fontWeight: 700, bgcolor: 'background.paper', color: 'text.primary' }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }} />
        <Typography sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem' }, fontWeight: 700, whiteSpace: 'nowrap' }} color="primary">
          {totalPickedSoFar} / {totalItems}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={totalItems ? (totalPickedSoFar / totalItems) * 100 : 0}
        sx={{ height: 8, borderRadius: 4, flexShrink: 0 }}
        color="primary"
      />

      {/* Current item or Done - fills remaining space, no scroll */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, py: { xs: 0.5, sm: 1 } }}>
        {allDone ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: { xs: 1.5, sm: 3 }, minHeight: 0 }}>
            <CheckIcon sx={{ fontSize: { xs: 80, sm: 120 }, flexShrink: 0 }} color="success" />
            <Typography sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem' }, fontWeight: 700, whiteSpace: 'nowrap' }} color="text.primary">Minden tétel kiszedve</Typography>
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleComplete}
              disabled={completing}
              sx={{ minHeight: 48, px: { xs: 3, sm: 4 }, fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 700, flexShrink: 0 }}
            >
              {completing ? 'Folyamatban…' : 'Begyűjtés kész'}
            </Button>
          </Box>
        ) : currentLine ? (
          (() => {
            const lineComplete = currentPicked >= currentLine.quantity
            const remaining = Math.max(0, currentLine.quantity - currentPicked)
            return (
            <>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                width: '100%',
                borderRadius: 2,
                bgcolor: lineComplete ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.06)',
                py: { xs: 0.5, sm: 1 },
                px: 1
              }}
            >
              {(() => {
                const imageSrc = currentLine.product_id
                  ? `/api/products/${currentLine.product_id}/main-image`
                  : (currentLine.product_image_url || null)
                const showImage = Boolean(imageSrc && !imageError)
                return showImage ? (
                  <Box
                    component="img"
                    src={imageSrc!}
                    alt={currentLine.product_name}
                    onError={() => setImageError(true)}
                    sx={{
                      width: '100%',
                      maxWidth: 340,
                      maxHeight: 'min(38dvh, 260px)',
                      objectFit: 'contain',
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 340,
                      height: 'min(38dvh, 180px)',
                      borderRadius: 1,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 1,
                      borderColor: 'divider',
                      flexShrink: 0
                    }}
                  >
                    <Typography sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' } }} color="text.secondary">Nincs kép</Typography>
                  </Box>
                )
              })()}
              <Typography
                sx={{
                  mt: { xs: 0.25, sm: 0.5 },
                  textAlign: 'center',
                  px: 0.5,
                  fontSize: { xs: '1rem', sm: '1.35rem' },
                  fontWeight: 700,
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
                color="text.primary"
              >
                {currentLine.product_name}
              </Typography>
              <Typography
                sx={{ mt: 0.25, fontSize: { xs: '0.85rem', sm: '1.15rem' }, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
              >
                Cikkszám: {currentLine.product_sku}
                {(currentLine.product_gtin || currentLine.internal_barcode) && (
                  <> · {currentLine.product_gtin || currentLine.internal_barcode}</>
                )}
              </Typography>
              <Chip
                label={`Rendelés: ${currentLine.order_number}`}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ mt: 0.25, fontSize: { xs: '0.8rem', sm: '1.1rem' }, fontWeight: 600 }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, mt: { xs: 0.5, sm: 0.75 } }}>
                <Chip
                  label={`${currentPicked} / ${currentLine.quantity} kiszedve`}
                  color={lineComplete ? 'success' : 'error'}
                  variant="filled"
                  sx={{ fontSize: { xs: '1.1rem', sm: '1.35rem' }, fontWeight: 700 }}
                />
                <Typography sx={{ fontSize: { xs: '0.85rem', sm: '1rem' }, fontWeight: 600 }} color={lineComplete ? 'success.dark' : 'error.dark'}>
                  {lineComplete ? 'Kész' : `Még ${remaining} kell`}
                </Typography>
              </Box>
            </Box>
          </>
            )
          })()
        ) : null}
      </Box>

      {/* Előző / Következő - always at bottom, no scroll */}
      {!allDone && currentLine && (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 0.5, sm: 2 },
            width: '100%',
            py: { xs: 0.75, sm: 1 },
            px: 0.5,
            flexWrap: 'nowrap',
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))'
          }}
        >
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => setIndex(safeIndex <= 0 ? lines.length - 1 : safeIndex - 1)}
            disabled={lines.length <= 1}
            startIcon={<PrevIcon sx={{ fontSize: { xs: 22, sm: 32 } }} />}
            aria-label="Előző tétel"
            sx={{
              minWidth: 0,
              flex: '1 1 0',
              minHeight: { xs: 44, sm: 56 },
              fontSize: { xs: '0.9rem', sm: '1.15rem' },
              fontWeight: 700,
              px: { xs: 0.75, sm: 2 }
            }}
          >
            Előző
          </Button>
          <Typography sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' }, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }} color="text.secondary">
            {safeIndex + 1} / {lines.length}
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => setIndex(safeIndex >= lines.length - 1 ? 0 : safeIndex + 1)}
            disabled={lines.length <= 1}
            endIcon={<NextIcon sx={{ fontSize: { xs: 22, sm: 32 } }} />}
            aria-label="Következő tétel"
            sx={{
              minWidth: 0,
              flex: '1 1 0',
              minHeight: { xs: 44, sm: 56 },
              fontSize: { xs: '0.9rem', sm: '1.15rem' },
              fontWeight: 700,
              px: { xs: 0.75, sm: 2 }
            }}
          >
            Következő
          </Button>
        </Box>
      )}

      {/* Scan feedback only (success/error) - no hint */}
      {!allDone && currentLine && (scanSuccess || scanError) && (
        <Box
          sx={{
            flexShrink: 0,
            py: { xs: 1, sm: 2 },
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            minHeight: 0
          }}
        >
          {scanSuccess ? (
            <Box sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2, bgcolor: 'success.main', border: 2, borderColor: 'success.dark', textAlign: 'center' }}>
              <Typography sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem' }, fontWeight: 800, letterSpacing: 2, color: '#fff', whiteSpace: 'nowrap' }}>
                Rendben!
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2, bgcolor: 'error.main', border: 2, borderColor: 'error.dark', textAlign: 'center' }}>
              <Typography sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' }, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scanError}</Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
