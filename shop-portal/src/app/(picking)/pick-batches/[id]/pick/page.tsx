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
import { CheckCircle as CheckIcon, Error as ErrorIcon, Close as CloseIcon, QrCodeScanner as ScanIcon } from '@mui/icons-material'
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
  const [scanValue, setScanValue] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [imageError, setImageError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const currentLine = lines[index] ?? null
  const currentPicked = currentLine ? (picked[currentLine.order_item_id] ?? 0) : 0
  const totalLines = lines.length
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0)
  const totalPickedSoFar = lines.slice(0, index).reduce((sum, l) => sum + (picked[l.order_item_id] ?? l.quantity), 0) + currentPicked
  const allDone = totalItems > 0 && totalPickedSoFar >= totalItems

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

  const handleScan = useCallback(() => {
    const val = normalizeBarcode(scanValue)
    if (!val) return
    setScanError(null)
    if (!currentLine) return
    if (!matchesLine(currentLine, val)) {
      const expected = [currentLine.product_gtin, currentLine.internal_barcode, currentLine.product_sku].filter(Boolean).join(' / ')
      setScanError(`Nem egyezik. Várt: ${currentLine.product_name} (${expected || '—'})`)
      setScanValue('')
      inputRef.current?.focus()
      return
    }
    const currentPickedForLine = picked[currentLine.order_item_id] ?? 0
    const nextPicked = Math.min(currentPickedForLine + 1, currentLine.quantity)
    setPicked((prev) => ({ ...prev, [currentLine.order_item_id]: nextPicked }))
    setScanValue('')
    inputRef.current?.focus()
    if (nextPicked >= currentLine.quantity) {
      if (index + 1 >= lines.length) {
        setIndex(index + 1)
      } else {
        setIndex((i) => i + 1)
      }
    }
  }, [scanValue, currentLine, picked, index, lines.length])

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

  useEffect(() => {
    inputRef.current?.focus()
  }, [index])

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
        maxWidth: 720,
        margin: '0 auto',
        bgcolor: 'background.default',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'max(env(safe-area-inset-left), 12px)',
        paddingRight: 'max(env(safe-area-inset-right), 12px)',
        overflow: 'hidden'
      }}
    >
      {/* Hidden input so barcode scanner (keyboard wedge) works without visible field */}
      {!allDone && currentLine && (
        <input
          ref={inputRef}
          type="text"
          value={scanValue}
          onChange={(e) => { setScanValue(e.target.value); setScanError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan() } }}
          autoComplete="off"
          autoFocus
          aria-label="Vonalkód szkennelése"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            overflow: 'hidden'
          }}
        />
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2, flexShrink: 0 }}>
        <IconButton component={Link} href={`/pick-batches/${id}`} size="large" aria-label="Vissza" color="inherit">
          <CloseIcon fontSize="medium" />
        </IconButton>
        <Chip
          label={batchCode}
          sx={{ fontSize: '1.1rem', fontWeight: 700, bgcolor: 'background.paper', color: 'text.primary' }}
        />
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 700 }} color="primary">
          {totalPickedSoFar} / {totalItems}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={totalItems ? (totalPickedSoFar / totalItems) * 100 : 0}
        sx={{ height: 10, borderRadius: 5, flexShrink: 0 }}
        color="primary"
      />

      {/* Current item or Done */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, py: 2 }}>
        {allDone ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 3 }}>
            <CheckIcon sx={{ fontSize: 120 }} color="success" />
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700 }} color="text.primary">Minden tétel kiszedve</Typography>
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleComplete}
              disabled={completing}
              sx={{ minHeight: 56, px: 4, fontSize: '1.25rem', fontWeight: 700 }}
            >
              {completing ? 'Folyamatban…' : 'Begyűjtés kész'}
            </Button>
          </Box>
        ) : currentLine ? (
          <>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                minHeight: 0,
                overflow: 'auto'
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
                      maxHeight: 300,
                      objectFit: 'contain',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      boxShadow: 1
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 340,
                      height: 220,
                      borderRadius: 2,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    <Typography sx={{ fontSize: '1.25rem' }} color="text.secondary">Nincs kép</Typography>
                  </Box>
                )
              })()}
              <Typography sx={{ mt: 2, textAlign: 'center', px: 1, fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.3 }} color="text.primary">
                {currentLine.product_name}
              </Typography>
              <Typography sx={{ mt: 1, fontSize: '1.15rem' }} color="text.secondary">
                Cikkszám: {currentLine.product_sku}
                {(currentLine.product_gtin || currentLine.internal_barcode) && (
                  <> · Vonalkód: {currentLine.product_gtin || currentLine.internal_barcode}</>
                )}
              </Typography>
              <Chip
                label={`Rendelés: ${currentLine.order_number}`}
                color="primary"
                variant="outlined"
                sx={{ mt: 1.5, fontSize: '1.1rem', fontWeight: 600 }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 2.5 }}>
                <Chip
                  label={`Kiszedendő: ${currentLine.quantity}`}
                  sx={{ fontSize: '1.2rem', fontWeight: 700 }}
                  variant="outlined"
                />
                <Chip
                  label={`Kiszedve: ${currentPicked}`}
                  color="success"
                  sx={{ fontSize: '1.2rem', fontWeight: 700 }}
                />
              </Box>
            </Box>
          </>
        ) : null}
      </Box>

      {/* Scan hint + error - no visible input, scanning goes to hidden input */}
      {!allDone && currentLine && (
        <Box
          sx={{
            flexShrink: 0,
            py: 2,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
          }}
        >
          {scanError ? (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'error.light', border: 2, borderColor: 'error.main' }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 600 }} color="error">{scanError}</Typography>
            </Box>
          ) : (
            <Box
              onClick={() => inputRef.current?.focus()}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1.5, cursor: 'pointer' }}
            >
              <ScanIcon sx={{ fontSize: 28 }} color="primary" />
              <Typography sx={{ fontSize: '1.15rem' }} color="text.secondary">Szkenneld a vonalkódot</Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
