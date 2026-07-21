'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Select,
  MenuItem,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DownloadIcon from '@mui/icons-material/Download'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

const PREPARED_BY_KEY = 'muhely_ugyfel_pdf_prepared_by'
const BUYER_KEY = 'muhely_ugyfel_pdf_buyer'
const SOFT_GREEN = '#2E7D32'
const SOFT_GREEN_HOVER = '#1B5E20'
const PREVIEW_ZOOM_DEFAULT = 0.78
const PREVIEW_ZOOM_MIN = 0.4
const PREVIEW_ZOOM_MAX = 1.4
const PREVIEW_ZOOM_STEP = 0.1
const PREVIEW_PAGE_W = 794
/** Tall enough for ~2 A4 pages in the iframe. */
const PREVIEW_PAGE_H = 2300

export type ManualLineType = 'shipping' | 'assembly' | 'hardware' | 'fee' | 'other'

export type ManualLineDraft = {
  id: string
  type: ManualLineType
  title: string
  quantity: string
  unit: string
  unitPriceGross: string
}

export type BuyerDraft = {
  name: string
  phone: string
  email: string
  postalCode: string
  city: string
  street: string
  taxNumber: string
}

export type SellerProfile = {
  name: string
  email: string
  mobile: string
  billing_name: string
  billing_postal_code: string
  billing_city: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
}

export type CustomerFacingPdfPayload = {
  preparedBy: string
  /** Ajánlat érvényesség (YYYY-MM-DD). */
  validUntil: string
  /** Analytics only; preview ignores it. */
  generatedFrom?: 'saved' | 'orders'
  buyer: BuyerDraft
  pricing: {
    markupPercent: number
    lineDisplay: 'collapsed' | 'detailed'
    roundTo: 0 | 100 | 1000
  }
  manualLines: Array<{
    type: ManualLineType
    title: string
    quantity: number
    unit: string
    unitPriceGross: number
  }>
}

type Props = {
  open: boolean
  quoteNumber: string
  boardGross: number
  seller: SellerProfile
  productLabel?: string
  /** POST endpoint returning exact PDF HTML (text/html). */
  previewUrl: string
  onClose: () => void
  onGenerate: (payload: CustomerFacingPdfPayload) => Promise<void>
  busy: boolean
}

const LINE_TYPE_LABEL: Record<ManualLineType, string> = {
  shipping: 'Szállítás',
  assembly: 'Szerelés',
  hardware: 'Vasalat',
  fee: 'Díj',
  other: 'Egyéb'
}

const LINE_TEMPLATES: Array<{
  type: ManualLineType
  title: string
  unit: string
  quantity: string
}> = [
  { type: 'shipping', title: 'Szállítás', unit: 'db', quantity: '1' },
  { type: 'assembly', title: 'Szerelés', unit: 'nap', quantity: '1' },
  { type: 'hardware', title: 'Vasalat összesen', unit: 'db', quantity: '1' },
  { type: 'fee', title: 'Felár / kezelési díj', unit: 'db', quantity: '1' }
]

function emptyBuyer(): BuyerDraft {
  return {
    name: '',
    phone: '',
    email: '',
    postalCode: '',
    city: '',
    street: '',
    taxNumber: ''
  }
}

function loadBuyer(): BuyerDraft {
  if (typeof window === 'undefined') return emptyBuyer()
  try {
    const raw = sessionStorage.getItem(BUYER_KEY)
    if (!raw) return emptyBuyer()
    return { ...emptyBuyer(), ...JSON.parse(raw) }
  } catch {
    return emptyBuyer()
  }
}

function loadPreparedBy(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    return sessionStorage.getItem(PREPARED_BY_KEY) || fallback
  } catch {
    return fallback
  }
}

function newLine(partial?: Partial<ManualLineDraft>): ManualLineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'other',
    title: '',
    quantity: '1',
    unit: 'db',
    unitPriceGross: '',
    ...partial
  }
}

function formatFt(n: number) {
  return (
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(n)) + ' Ft'
  )
}

function parseNum(value: string): number {
  return Number(String(value).replace(/\s/g, '').replace(',', '.')) || 0
}

function applyRounding(n: number, roundTo: 0 | 100 | 1000): number {
  const rounded = Math.round(n)
  if (!roundTo) return rounded
  return Math.round(rounded / roundTo) * roundTo
}

function defaultValidUntil(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sellerDisplayName(seller: SellerProfile): string {
  return seller.billing_name || seller.name || ''
}

function sellerAddressLine(seller: SellerProfile): string {
  return [
    seller.billing_postal_code,
    seller.billing_city,
    [seller.billing_street, seller.billing_house_number].filter(Boolean).join(' ')
  ]
    .filter(Boolean)
    .join(' ')
}

function SectionLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          bgcolor: SOFT_GREEN,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {n}
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Stack>
  )
}

export default function CustomerFacingPdfDialog({
  open,
  quoteNumber,
  boardGross,
  seller,
  productLabel = 'Lapszabászat',
  previewUrl,
  onClose,
  onGenerate,
  busy
}: Props) {
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))

  const [buyer, setBuyer] = useState<BuyerDraft>(emptyBuyer)
  const [preparedBy, setPreparedBy] = useState('')
  const [validUntil, setValidUntil] = useState(defaultValidUntil)
  const [buyerExtraOpen, setBuyerExtraOpen] = useState(false)
  const [markupPercent, setMarkupPercent] = useState(25)
  const [roundTo, setRoundTo] = useState<0 | 100 | 1000>(0)
  const [lineDisplay, setLineDisplay] = useState<'collapsed' | 'detailed'>('collapsed')
  const [lines, setLines] = useState<ManualLineDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(PREVIEW_ZOOM_DEFAULT)
  const [isPanning, setIsPanning] = useState(false)
  const previewSeq = useRef(0)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)

  useEffect(() => {
    if (!open) return
    const loaded = loadBuyer()
    setBuyer(loaded)
    setPreparedBy(loadPreparedBy(seller.name || seller.billing_name || ''))
    setValidUntil(defaultValidUntil())
    setMarkupPercent(25)
    setRoundTo(0)
    setLineDisplay('collapsed')
    setLines([])
    setError(null)
    setBuyerExtraOpen(
      Boolean(loaded.postalCode || loaded.city || loaded.street || loaded.taxNumber)
    )
    setPreviewHtml('')
    setPreviewError(null)
    setMobilePreviewOpen(false)
    setPreviewZoom(PREVIEW_ZOOM_DEFAULT)
    setIsPanning(false)
    panRef.current = null
  }, [open, seller.name, seller.billing_name])

  const boardCustomerGross = useMemo(() => {
    const marked = boardGross * (1 + markupPercent / 100)
    return applyRounding(marked, roundTo)
  }, [boardGross, markupPercent, roundTo])

  const manualTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = parseNum(line.quantity)
      const price = parseNum(line.unitPriceGross)
      if (!line.title.trim() || qty <= 0) return sum
      return sum + Math.round(qty * price)
    }, 0)
  }, [lines])

  const payableGross = boardCustomerGross + manualTotal

  const buildPayload = (): CustomerFacingPdfPayload => {
    const manualLines = lines
      .map(line => ({
        type: line.type,
        title: line.title.trim(),
        quantity: parseNum(line.quantity),
        unit: line.unit.trim() || 'db',
        unitPriceGross: parseNum(line.unitPriceGross)
      }))
      .filter(line => line.title && line.quantity > 0)
      .slice(0, 15)

    return {
      preparedBy: preparedBy.trim(),
      validUntil,
      buyer: { ...buyer, name: buyer.name.trim() },
      pricing: {
        markupPercent,
        lineDisplay,
        roundTo
      },
      manualLines
    }
  }

  // Live preview — same server HTML as the PDF
  useEffect(() => {
    if (!open || !previewUrl) return

    const seq = ++previewSeq.current
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await fetch(previewUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload())
        })
        if (seq !== previewSeq.current) return
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Előnézet hiba')
        }
        const html = await res.text()
        if (seq !== previewSeq.current) return
        setPreviewHtml(html)
      } catch (e) {
        if (seq !== previewSeq.current) return
        setPreviewError(e instanceof Error ? e.message : 'Előnézet hiba')
      } finally {
        if (seq === previewSeq.current) setPreviewLoading(false)
      }
    }, 320)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: rebuild when form fields change
  }, [
    open,
    previewUrl,
    buyer,
    preparedBy,
    validUntil,
    markupPercent,
    roundTo,
    lineDisplay,
    lines
  ])

  const updateBuyer = (key: keyof BuyerDraft, value: string) => {
    setBuyer(prev => ({ ...prev, [key]: value }))
  }

  const updateLine = (id: string, patch: Partial<ManualLineDraft>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  const addTemplate = (tpl: (typeof LINE_TEMPLATES)[number]) => {
    setLines(prev => [
      ...prev,
      newLine({
        type: tpl.type,
        title: tpl.title,
        unit: tpl.unit,
        quantity: tpl.quantity,
        unitPriceGross: ''
      })
    ])
  }

  const handleGenerate = async () => {
    if (!buyer.name.trim()) {
      setError('A vevő neve / cégneve kötelező')
      return
    }
    if (!preparedBy.trim()) {
      setError('A „Készítette” mező kötelező')
      return
    }
    if (!validUntil) {
      setError('Az érvényesség dátuma kötelező')
      return
    }
    if (!sellerDisplayName(seller).trim()) {
      setError('Hiányzik az ajánlat adó (profil) cégnév. Egészítsd ki a profilodat.')
      return
    }
    setError(null)

    const payload = buildPayload()
    try {
      sessionStorage.setItem(PREPARED_BY_KEY, payload.preparedBy)
      sessionStorage.setItem(BUYER_KEY, JSON.stringify(payload.buyer))
    } catch {
      /* ignore */
    }

    await onGenerate(payload)
  }

  const bumpZoom = (delta: number) => {
    setPreviewZoom(z =>
      Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, Math.round((z + delta) * 100) / 100))
    )
  }

  const onPreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = previewScrollRef.current
    if (!el) return
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop
    }
    setIsPanning(true)
    el.setPointerCapture(e.pointerId)
  }

  const onPreviewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    const el = previewScrollRef.current
    if (!pan || pan.pointerId !== e.pointerId || !el) return
    el.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX)
    el.scrollTop = pan.scrollTop - (e.clientY - pan.startY)
  }

  const endPreviewPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    const el = previewScrollRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    panRef.current = null
    setIsPanning(false)
    try {
      el?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const previewPane = (
    <Box
      sx={{
        height: { xs: 480, md: '100%' },
        minHeight: { md: 520 },
        bgcolor: '#E8E4DC',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1, py: 0.75, bgcolor: 'rgba(255,255,255,0.75)', borderBottom: '1px solid #ddd' }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', pl: 0.5 }}>
          Élő előnézet · húzd a mozgatáshoz
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.25}>
          {previewLoading ? <CircularProgress size={14} sx={{ color: SOFT_GREEN, mr: 0.5 }} /> : null}
          <Tooltip title="Kicsinyítés">
            <span>
              <IconButton
                size="small"
                aria-label="Kicsinyítés"
                disabled={previewZoom <= PREVIEW_ZOOM_MIN}
                onClick={() => bumpZoom(-PREVIEW_ZOOM_STEP)}
              >
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            sx={{ minWidth: 40, textAlign: 'center', fontWeight: 700, userSelect: 'none' }}
          >
            {Math.round(previewZoom * 100)}%
          </Typography>
          <Tooltip title="Nagyítás">
            <span>
              <IconButton
                size="small"
                aria-label="Nagyítás"
                disabled={previewZoom >= PREVIEW_ZOOM_MAX}
                onClick={() => bumpZoom(PREVIEW_ZOOM_STEP)}
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Alap méret">
            <IconButton
              size="small"
              aria-label="Alap méret"
              onClick={() => setPreviewZoom(PREVIEW_ZOOM_DEFAULT)}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        ref={previewScrollRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: { xs: 1, md: 1.5 },
          cursor: isPanning ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none'
        }}
        onPointerDown={onPreviewPointerDown}
        onPointerMove={onPreviewPointerMove}
        onPointerUp={endPreviewPan}
        onPointerCancel={endPreviewPan}
        onWheel={e => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            bumpZoom(e.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP)
          }
        }}
      >
        {previewError ? (
          <Typography variant="body2" color="error" sx={{ mt: 4, px: 2, textAlign: 'center' }}>
            {previewError}
          </Typography>
        ) : previewHtml ? (
          <Box
            sx={{
              width: PREVIEW_PAGE_W * previewZoom,
              height: PREVIEW_PAGE_H * previewZoom,
              position: 'relative',
              // Extra space so left/right edges are reachable when zoomed
              m: '0 auto',
              minWidth: '100%'
            }}
          >
            <Box
              sx={{
                width: PREVIEW_PAGE_W * previewZoom,
                height: PREVIEW_PAGE_H * previewZoom,
                mx: 'auto',
                position: 'relative'
              }}
            >
              <Box
                sx={{
                  width: PREVIEW_PAGE_W,
                  height: PREVIEW_PAGE_H,
                  transform: `scale(${previewZoom})`,
                  transformOrigin: 'top left',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                  bgcolor: '#fff',
                  pointerEvents: 'none'
                }}
              >
                <Box
                  component="iframe"
                  title="PDF előnézet"
                  srcDoc={previewHtml}
                  sandbox=""
                  tabIndex={-1}
                  sx={{
                    width: PREVIEW_PAGE_W,
                    height: PREVIEW_PAGE_H,
                    border: 0,
                    display: 'block',
                    bgcolor: '#fff',
                    pointerEvents: 'none'
                  }}
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 6, textAlign: 'center' }}>
            Előnézet betöltése…
          </Typography>
        )}
      </Box>
    </Box>
  )

  const editor = (
    <Stack spacing={2.75} sx={{ pr: { md: 1 } }}>
      {/* Seller chip */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Ajánlat adó (profilodból)
        </Typography>
        <Tooltip
          title={
            <Box sx={{ p: 0.5 }}>
              {sellerAddressLine(seller) ? <div>{sellerAddressLine(seller)}</div> : null}
              {seller.mobile ? <div>Tel: {seller.mobile}</div> : null}
              {seller.email ? <div>{seller.email}</div> : null}
              {seller.billing_tax_number ? <div>Adószám: {seller.billing_tax_number}</div> : null}
            </Box>
          }
        >
          <Chip
            label={sellerDisplayName(seller) || '— hiányzó cégnév —'}
            sx={{
              fontWeight: 600,
              bgcolor: 'rgba(46,125,50,0.08)',
              color: SOFT_GREEN,
              maxWidth: '100%'
            }}
          />
        </Tooltip>
      </Box>

      {/* 1 Vevő */}
      <Box>
        <SectionLabel n={1}>Vevő</SectionLabel>
        <Stack spacing={1.25}>
          <TextField
            label="Név / cégnév *"
            fullWidth
            size="small"
            value={buyer.name}
            onChange={e => updateBuyer('name', e.target.value)}
            autoFocus
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              label="Telefon"
              fullWidth
              size="small"
              value={buyer.phone}
              onChange={e => updateBuyer('phone', e.target.value)}
            />
            <TextField
              label="E-mail"
              fullWidth
              size="small"
              value={buyer.email}
              onChange={e => updateBuyer('email', e.target.value)}
            />
          </Stack>
          <Button
            size="small"
            onClick={() => setBuyerExtraOpen(v => !v)}
            endIcon={buyerExtraOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ alignSelf: 'flex-start', color: SOFT_GREEN }}
          >
            Cím és adószám
          </Button>
          <Collapse in={buyerExtraOpen}>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <TextField
                  label="Irányítószám"
                  size="small"
                  sx={{ width: { sm: 120 } }}
                  value={buyer.postalCode}
                  onChange={e => updateBuyer('postalCode', e.target.value)}
                />
                <TextField
                  label="Város"
                  fullWidth
                  size="small"
                  value={buyer.city}
                  onChange={e => updateBuyer('city', e.target.value)}
                />
              </Stack>
              <TextField
                label="Cím (utca, házszám)"
                fullWidth
                size="small"
                value={buyer.street}
                onChange={e => updateBuyer('street', e.target.value)}
              />
              <TextField
                label="Adószám"
                fullWidth
                size="small"
                value={buyer.taxNumber}
                onChange={e => updateBuyer('taxNumber', e.target.value)}
              />
            </Stack>
          </Collapse>
        </Stack>
      </Box>

      {/* 2 Árazás */}
      <Box>
        <SectionLabel n={2}>{productLabel} árazás</SectionLabel>
        <Stack
          direction="row"
          spacing={2}
          alignItems="baseline"
          sx={{
            mb: 1.5,
            p: 1.25,
            borderRadius: 1.5,
            bgcolor: 'rgba(46,125,50,0.06)'
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Portal
            </Typography>
            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
              {formatFt(boardGross)}
            </Typography>
          </Box>
          <Typography color="text.secondary">→</Typography>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Ügyfélnek
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: SOFT_GREEN, lineHeight: 1.2 }}>
              {formatFt(boardCustomerGross)}
            </Typography>
          </Box>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Árrés: {markupPercent}%
        </Typography>
        <Slider
          value={markupPercent}
          onChange={(_, v) => setMarkupPercent(v as number)}
          min={0}
          max={100}
          step={1}
          valueLabelDisplay="auto"
          sx={{
            color: SOFT_GREEN,
            mt: 0.5,
            mb: 1,
            '& .MuiSlider-thumb': { width: 16, height: 16 }
          }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          {([0, 100, 1000] as const).map(r => (
            <Chip
              key={r}
              size="small"
              label={r === 0 ? 'Nincs kerekítés' : `${r} Ft-ra`}
              onClick={() => setRoundTo(r)}
              variant={roundTo === r ? 'filled' : 'outlined'}
              sx={
                roundTo === r
                  ? { bgcolor: SOFT_GREEN, color: '#fff', '&:hover': { bgcolor: SOFT_GREEN_HOVER } }
                  : {}
              }
            />
          ))}
        </Stack>

        <RadioGroup
          row
          value={lineDisplay}
          onChange={e => setLineDisplay(e.target.value as 'collapsed' | 'detailed')}
        >
          <FormControlLabel
            value="collapsed"
            control={<Radio size="small" sx={{ color: SOFT_GREEN, '&.Mui-checked': { color: SOFT_GREEN } }} />}
            label={`Egy sor: ${productLabel}`}
          />
          <FormControlLabel
            value="detailed"
            control={<Radio size="small" sx={{ color: SOFT_GREEN, '&.Mui-checked': { color: SOFT_GREEN } }} />}
            label="Részletes"
          />
        </RadioGroup>
      </Box>

      {/* 3 Tételek */}
      <Box>
        <SectionLabel n={3}>Egyéb tételek</SectionLabel>
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.25 }}>
          {LINE_TEMPLATES.map(tpl => (
            <Chip
              key={tpl.title}
              size="small"
              label={`+ ${tpl.title}`}
              onClick={() => addTemplate(tpl)}
              variant="outlined"
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={() => setLines(prev => [...prev, newLine()])}>
            Üres sor
          </Button>
        </Stack>

        {lines.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Opcionális — pl. szállítás, szerelés, vasalat.
          </Typography>
        ) : (
          <Table size="small" sx={{ '& td, & th': { px: 0.75, py: 0.6 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Típus</TableCell>
                <TableCell>Megnevezés</TableCell>
                <TableCell width={64}>Menny.</TableCell>
                <TableCell width={56}>Egys.</TableCell>
                <TableCell width={100}>Ár (br.)</TableCell>
                <TableCell width={36} />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Select
                      size="small"
                      fullWidth
                      value={line.type}
                      onChange={e =>
                        updateLine(line.id, {
                          type: e.target.value as ManualLineType,
                          title:
                            line.title.trim() === '' ||
                            Object.values(LINE_TYPE_LABEL).includes(line.title)
                              ? LINE_TYPE_LABEL[e.target.value as ManualLineType]
                              : line.title
                        })
                      }
                    >
                      {(Object.keys(LINE_TYPE_LABEL) as ManualLineType[]).map(t => (
                        <MenuItem key={t} value={t}>
                          {LINE_TYPE_LABEL[t]}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={line.title}
                      onChange={e => updateLine(line.id, { title: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={line.quantity}
                      onChange={e => updateLine(line.id, { quantity: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={line.unit}
                      onChange={e => updateLine(line.id, { unit: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={line.unitPriceGross}
                      onChange={e => updateLine(line.id, { unitPriceGross: e.target.value })}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">Ft</InputAdornment>
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label="Törlés"
                      onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {manualTotal > 0 ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Egyéb: <strong>{formatFt(manualTotal)}</strong>
          </Typography>
        ) : null}
      </Box>

      {/* 4 Készítette + érvényesség */}
      <Box>
        <SectionLabel n={4}>Készítette és érvényesség</SectionLabel>
        <Stack spacing={1.25}>
          <TextField
            label="Készítette *"
            fullWidth
            size="small"
            value={preparedBy}
            onChange={e => setPreparedBy(e.target.value)}
          />
          <TextField
            label="Érvényesség *"
            type="date"
            fullWidth
            size="small"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Ez jelenik meg a PDF-en az érvényesség dátumaként."
          />
        </Stack>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Nem mentődik az adatbázisba. Turinova lábléc a PDF-en megmarad.
      </Typography>

      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}
    </Stack>
  )

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 'min(1180px, 96vw)' },
          maxHeight: { xs: '100%', md: '92vh' },
          m: { xs: 0, md: 2 },
          borderRadius: { xs: 0, md: 2 }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1.25, pr: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box>
            <Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>
              Ügyfélajánlat
            </Typography>
            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
              {quoteNumber}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Fizetendő bruttó
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: SOFT_GREEN, lineHeight: 1.15 }}>
              {formatFt(payableGross)}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          p: { xs: 1.5, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {!isMdUp ? (
          <Stack spacing={1.5} sx={{ overflow: 'auto', flex: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setMobilePreviewOpen(v => !v)}
              sx={{ alignSelf: 'stretch', borderColor: SOFT_GREEN, color: SOFT_GREEN }}
            >
              {mobilePreviewOpen ? 'Előnézet elrejtése' : 'Élő előnézet mutatása'}
            </Button>
            <Collapse in={mobilePreviewOpen}>{previewPane}</Collapse>
            {editor}
          </Stack>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
              gap: 2.5,
              minHeight: 0,
              flex: 1,
              overflow: 'hidden'
            }}
          >
            <Box sx={{ overflow: 'auto', pr: 0.5 }}>{editor}</Box>
            <Box sx={{ minHeight: 0, overflow: 'hidden', position: 'sticky', top: 0, alignSelf: 'stretch' }}>
              {previewPane}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>
          Mégse
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleGenerate}
          disabled={busy}
          sx={{ px: 2.5 }}
        >
          {busy ? 'PDF készül…' : 'PDF letöltés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
