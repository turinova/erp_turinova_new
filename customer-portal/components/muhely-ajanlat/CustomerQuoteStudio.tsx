'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DownloadIcon from '@mui/icons-material/Download'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { toast } from 'react-toastify'

import CustomerQuoteSourcePicker from './CustomerQuoteSourcePicker'
import {
  BUYER_KEY,
  LINE_TEMPLATES,
  LINE_TYPE_LABEL,
  MAX_PORTAL_SOURCES,
  NOTES_MAX_CHARS,
  PAYMENT_CUSTOM_MAX_CHARS,
  PAYMENT_SCHEDULE_OPTIONS,
  PDF_PALETTE_OPTIONS,
  PREPARED_BY_KEY,
  PREVIEW_PAGE_H,
  PREVIEW_PAGE_W,
  PREVIEW_ZOOM_DEFAULT,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_STEP,
  SOFT_GREEN,
  SOFT_GREEN_HOVER,
  applyRounding,
  buildStudioSourcesUrl,
  defaultValidUntil,
  emptyBuyer,
  formatFt,
  loadAccentHex,
  loadBuyer,
  loadCustomerNotes,
  loadLogoDataUrl,
  loadPaletteId,
  loadPaymentCustomText,
  loadPaymentSchedule,
  loadPreparedBy,
  loadShowVatNote,
  newLine,
  normalizeAccentHex,
  parseNum,
  paymentSchedulePdfText,
  readLogoFileAsDataUrl,
  saveAccentHex,
  saveCustomerNotes,
  saveLogoDataUrl,
  savePaletteId,
  savePaymentCustomText,
  savePaymentSchedule,
  saveShowVatNote,
  sellerAddressLine,
  sellerDisplayName,
  sourceKey,
  type BuyerDraft,
  type CustomerFacingPdfPayload,
  type ManualLineDraft,
  type ManualLineType,
  type PaymentScheduleId,
  type PdfPaletteId,
  type QuoteSourceInfo,
  type RecentSavedQuote,
  type SellerProfile
} from './customerFacingPdfShared'
import {
  buyerFromPayload,
  manualLinesFromPayload,
  paletteFromPayload,
  paymentScheduleFromPayload,
  type CustomerQuoteStoredPayload
} from '@/lib/portal-customer-quotes'

type SourcePricing = {
  markupPercent: number
  roundTo: 0 | 100 | 1000
  lineDisplay: 'collapsed' | 'detailed'
}

type Props = {
  seller: SellerProfile
  sources: QuoteSourceInfo[]
  recentQuotes: RecentSavedQuote[]
  loadWarnings?: string[]
  savedQuoteId?: string | null
  savedQuoteNumber?: string | null
  savedPayload?: CustomerQuoteStoredPayload | null
  initialSourcePricing?: Record<string, SourcePricing>
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

export default function CustomerQuoteStudio({
  seller,
  sources,
  recentQuotes,
  loadWarnings = [],
  savedQuoteId = null,
  savedQuoteNumber = null,
  savedPayload = null,
  initialSourcePricing
}: Props) {
  const router = useRouter()
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))

  const sourcesSig = sources.map(s => sourceKey(s)).join('|')
  /** Egységes rövid ügyfél-PDF (1…N forrás). */
  const previewUrl = '/api/ugyfel-ajanlat/pdf/preview'
  const pdfUrl = '/api/ugyfel-ajanlat/pdf'
  const quoteLabel = savedQuoteNumber
    ? savedQuoteNumber
    : sources.length > 0
      ? sources.map(s => s.quoteNumber).join(' + ')
      : 'Új ajánlat'

  const [customerQuoteId, setCustomerQuoteId] = useState<string | null>(savedQuoteId)
  const [buyer, setBuyer] = useState<BuyerDraft>(emptyBuyer)
  const [preparedBy, setPreparedBy] = useState('')
  const [validUntil, setValidUntil] = useState(defaultValidUntil)
  const [projectTitle, setProjectTitle] = useState('')
  const [leadTimeNote, setLeadTimeNote] = useState('')
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleId>('50-50')
  const [paymentCustomText, setPaymentCustomText] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [paletteId, setPaletteId] = useState<PdfPaletteId>('mono')
  const [accentHex, setAccentHex] = useState('#212121')
  const [accentHexDraft, setAccentHexDraft] = useState('#212121')
  const [showVatNote, setShowVatNote] = useState(true)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [buyerExtraOpen, setBuyerExtraOpen] = useState(false)
  const [sourcePricing, setSourcePricing] = useState<Record<string, SourcePricing>>(
    () => initialSourcePricing || {}
  )
  const [lines, setLines] = useState<ManualLineDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [replaceKey, setReplaceKey] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
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

  // First mount: prefs + mentett ajánlat payload
  useEffect(() => {
    const profileLogo = String(seller.workshop_logo_data_url || '').trim()
    const logo =
      (profileLogo.startsWith('data:image/') ? profileLogo : '') || loadLogoDataUrl()
    setLogoDataUrl(logo)
    if (profileLogo.startsWith('data:image/')) saveLogoDataUrl(profileLogo)

    if (savedPayload) {
      const loadedBuyer = buyerFromPayload(savedPayload) || emptyBuyer()
      setBuyer(loadedBuyer)
      setPreparedBy(
        String(savedPayload.preparedBy || '').trim() ||
          loadPreparedBy(seller.name || seller.billing_name || '')
      )
      setValidUntil(
        /^\d{4}-\d{2}-\d{2}$/.test(String(savedPayload.validUntil || ''))
          ? String(savedPayload.validUntil)
          : defaultValidUntil()
      )
      setProjectTitle(String(savedPayload.projectTitle || ''))
      setLeadTimeNote(String(savedPayload.leadTimeNote || ''))
      const schedule = paymentScheduleFromPayload(savedPayload)
      setPaymentSchedule(schedule)
      setPaymentCustomText(
        String(savedPayload.paymentCustomText || '').trim() ||
          paymentSchedulePdfText(schedule)
      )
      setCustomerNotes(String(savedPayload.customerNotes || '').slice(0, NOTES_MAX_CHARS))
      const pal = paletteFromPayload(savedPayload)
      setPaletteId(pal)
      const hex = normalizeAccentHex(String(savedPayload.accentHex || '')) || loadAccentHex()
      setAccentHex(hex)
      setAccentHexDraft(hex)
      setShowVatNote(
        savedPayload.showVatNote === undefined ? true : Boolean(savedPayload.showVatNote)
      )
      setLines(
        manualLinesFromPayload(savedPayload).map(l =>
          newLine({
            type: l.type,
            title: l.title,
            quantity: l.quantity,
            unit: l.unit,
            unitPriceGross: l.unitPriceGross
          })
        )
      )
      if (initialSourcePricing) setSourcePricing(initialSourcePricing)
      setBuyerExtraOpen(
        Boolean(
          loadedBuyer.postalCode ||
            loadedBuyer.city ||
            loadedBuyer.street ||
            loadedBuyer.taxNumber
        )
      )
      setCustomerQuoteId(savedQuoteId || savedPayload.customerQuoteId || null)
    } else {
      const loaded = loadBuyer()
      setBuyer(loaded)
      setPreparedBy(loadPreparedBy(seller.name || seller.billing_name || ''))
      setValidUntil(defaultValidUntil())
      const schedule = loadPaymentSchedule()
      setPaymentSchedule(schedule)
      const customPay = loadPaymentCustomText()
      setPaymentCustomText(customPay || paymentSchedulePdfText(schedule))
      setCustomerNotes(loadCustomerNotes())
      const loadedAccent = loadAccentHex()
      setPaletteId(loadPaletteId())
      setAccentHex(loadedAccent)
      setAccentHexDraft(loadedAccent)
      setShowVatNote(loadShowVatNote())
      setBuyerExtraOpen(
        Boolean(loaded.postalCode || loaded.city || loaded.street || loaded.taxNumber)
      )
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.name, seller.billing_name, seller.workshop_logo_data_url, savedQuoteId])

  // Source list change: only init missing pricing keys; soft-update lead time if empty
  useEffect(() => {
    setSourcePricing(prev => {
      const next = { ...prev }
      for (const s of sources) {
        const k = sourceKey(s)
        if (!next[k]) next[k] = { markupPercent: 25, roundTo: 0, lineDisplay: 'collapsed' }
      }
      return next
    })
    setLeadTimeNote(prev => {
      if (prev.trim()) return prev
      const hasNf = sources.some(s => s.type === 'nettfront')
      const hasLap = sources.some(s => s.type === 'lapszabaszat')
      if (hasNf && hasLap) return 'Korpusz + frontok: egyeztetés szerint'
      if (hasNf) return '2–4 hét (frontok)'
      return ''
    })
  }, [sourcesSig, sources])

  const boardCustomerGross = useMemo(() => {
    return sources.reduce((sum, s) => {
      const p = sourcePricing[sourceKey(s)] || {
        markupPercent: 25,
        roundTo: 0 as const,
        lineDisplay: 'collapsed' as const
      }
      return sum + applyRounding(s.boardGross * (1 + p.markupPercent / 100), p.roundTo)
    }, 0)
  }, [sources, sourcePricing])

  const manualTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = parseNum(line.quantity)
      const price = parseNum(line.unitPriceGross)
      if (!line.title.trim() || qty <= 0) return sum
      return sum + Math.round(qty * price)
    }, 0)
  }, [lines])

  const payableGross = boardCustomerGross + manualTotal

  const validUntilPast = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return false
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return validUntil < `${y}-${m}-${d}`
  }, [validUntil])

  const highMarkup = useMemo(() => {
    return sources.some(s => {
      const p = sourcePricing[sourceKey(s)]
      return (p?.markupPercent ?? 25) > 60
    })
  }, [sources, sourcePricing])

  const checklistMissing = useMemo(() => {
    const miss: string[] = []
    if (!buyer.name.trim()) miss.push('vevő neve')
    if (!preparedBy.trim()) miss.push('készítette')
    if (!validUntil) miss.push('érvényesség')
    if (!sellerDisplayName(seller).trim()) miss.push('profil cégnév')
    const hasLines = lines.some(l => l.title.trim() && parseNum(l.quantity) > 0)
    if (sources.length === 0 && !hasLines) miss.push('forrás vagy tétel')
    return miss
  }, [buyer.name, preparedBy, validUntil, seller, sources.length, lines])

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
      generatedFrom: 'studio',
      customerQuoteId: customerQuoteId || undefined,
      projectTitle: projectTitle.trim() || undefined,
      paymentSchedule,
      paymentCustomText: paymentCustomText.trim() || undefined,
      leadTimeNote: leadTimeNote.trim() || undefined,
      customerNotes: customerNotes.trim() || undefined,
      paletteId,
      accentHex,
      showVatNote,
      workshopLogoDataUrl: logoDataUrl || undefined,
      buyer: { ...buyer, name: buyer.name.trim() },
      pricing: {
        markupPercent: 0,
        lineDisplay: 'collapsed',
        roundTo: 0
      },
      portalSources:
        sources.length > 0
          ? sources.map(s => {
              const p = sourcePricing[sourceKey(s)] || {
                markupPercent: 25,
                roundTo: 0 as const,
                lineDisplay: 'collapsed' as const
              }
              return {
                type: s.type,
                id: s.id,
                markupPercent: p.markupPercent,
                roundTo: p.roundTo,
                lineDisplay: p.lineDisplay
              }
            })
          : undefined,
      manualLines
    }
  }

  useEffect(() => {
    if (!hydrated) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    previewUrl,
    buyer,
    preparedBy,
    validUntil,
    projectTitle,
    paymentSchedule,
    paymentCustomText,
    leadTimeNote,
    customerNotes,
    paletteId,
    accentHex,
    showVatNote,
    logoDataUrl,
    sourcePricing,
    lines,
    sourcesSig
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

  const persistPrefs = (payload: CustomerFacingPdfPayload) => {
    try {
      sessionStorage.setItem(PREPARED_BY_KEY, payload.preparedBy)
      sessionStorage.setItem(BUYER_KEY, JSON.stringify(payload.buyer))
      saveLogoDataUrl(logoDataUrl)
      savePaymentSchedule(paymentSchedule)
      savePaymentCustomText(paymentCustomText)
      savePaletteId(paletteId)
      saveAccentHex(accentHex)
      saveShowVatNote(showVatNote)
      saveCustomerNotes(customerNotes)
    } catch {
      /* ignore */
    }
  }

  const applySavedId = (newId: string | null) => {
    if (!newId) return
    setCustomerQuoteId(newId)
    const nextUrl = buildStudioSourcesUrl(
      sources.map(s => ({ type: s.type, id: s.id })),
      { customerQuoteId: newId }
    )
    router.replace(nextUrl)
  }

  const handleSave = async () => {
    if (checklistMissing.length > 0) {
      setError(`Hiányzik: ${checklistMissing.join(', ')}`)
      return
    }
    setError(null)
    const payload = buildPayload()
    persistPrefs(payload)
    setSaveBusy(true)
    try {
      const response = await fetch('/api/ugyfel-ajanlat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        let errorMessage = 'Mentés sikertelen'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          /* ignore */
        }
        throw new Error(errorMessage)
      }
      const data = (await response.json()) as { id?: string; quoteNumber?: string }
      applySavedId(data.id || null)
      toast.success(
        data.quoteNumber ? `Mentve (${data.quoteNumber})` : 'Ügyfélajánlat mentve'
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mentés hiba')
    } finally {
      setSaveBusy(false)
    }
  }

  const handleGenerate = async () => {
    if (checklistMissing.length > 0) {
      setError(`Hiányzik: ${checklistMissing.join(', ')}`)
      return
    }
    if (validUntilPast) {
      const ok = window.confirm(
        'Az érvényesség dátuma már elmúlt. Mégis legenerálod az ajánlatot?'
      )
      if (!ok) return
    }
    if (highMarkup) {
      const ok = window.confirm(
        'Az árrés legalább egy forrásnál 60% felett van. Biztosan így küldöd az ügyfélnek?'
      )
      if (!ok) return
    }
    setError(null)

    const payload = buildPayload()
    persistPrefs(payload)

    setBusy(true)
    try {
      const response = await fetch(pdfUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        let errorMessage = 'PDF generálás sikertelen'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const text = await response.text()
          errorMessage = text || errorMessage
        }
        throw new Error(errorMessage)
      }
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('A válasz nem PDF formátumú')
      }
      const blob = await response.blob()
      if (blob.size === 0) throw new Error('A generált PDF üres')

      const newId = response.headers.get('X-Customer-Quote-Id')
      const saveWarn = response.headers.get('X-Save-Warning')
      applySavedId(newId)
      if (saveWarn) {
        try {
          toast.warning(`PDF kész, de mentés hiba: ${decodeURIComponent(saveWarn)}`)
        } catch {
          toast.warning('PDF kész, de a mentés nem sikerült (futtasd a migrationt).')
        }
      } else if (newId) {
        toast.success('Ügyfélajánlat PDF kész — mentve a listádba')
      } else {
        toast.success('Ügyfélajánlat PDF kész')
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const buyerSlug = (buyer.name.trim() || 'ugyfel')
        .replace(/[^\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ\-]+/gi, '-')
        .replace(/-+/g, '-')
        .slice(0, 40)
      const now = new Date()
      const dateSlug = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      a.download = `Ajanlat-${buyerSlug}-${dateSlug}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF hiba')
    } finally {
      setBusy(false)
    }
  }

  const clearBuyer = () => {
    const empty = emptyBuyer()
    setBuyer(empty)
    setBuyerExtraOpen(false)
    try {
      sessionStorage.removeItem(BUYER_KEY)
    } catch {
      /* ignore */
    }
    toast.info('Ügyfél mezők törölve')
  }

  const openAddPicker = () => {
    if (sources.length >= MAX_PORTAL_SOURCES) {
      toast.warning(`Legfeljebb ${MAX_PORTAL_SOURCES} forrás adható hozzá`)
      return
    }
    setReplaceKey(null)
    setPickerOpen(true)
  }

  const openReplacePicker = (key: string) => {
    setReplaceKey(key)
    setPickerOpen(true)
  }

  const persistProfileLogo = async (dataUrl: string | null) => {
    try {
      await fetch('/api/customer-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshop_logo_data_url: dataUrl })
      })
    } catch {
      /* localStorage still holds the logo for this device */
    }
  }

  const handleLogoPick = async (file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await readLogoFileAsDataUrl(file)
      setLogoDataUrl(dataUrl)
      saveLogoDataUrl(dataUrl)
      await persistProfileLogo(dataUrl)
      toast.success('Logo mentve a profilba')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Logo feltöltés sikertelen')
    }
  }

  const clearLogo = () => {
    setLogoDataUrl('')
    saveLogoDataUrl('')
    void persistProfileLogo(null)
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
        minHeight: { md: 0 },
        bgcolor: '#E8E4DC',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider'
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
          Így látja az ügyfél · húzd a mozgatáshoz
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
    <Stack spacing={2.75} sx={{ pr: { md: 1 }, pl: { md: 0.75 }, pb: 4 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          A te céged (profilodból)
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
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
          {logoDataUrl ? (
            <Box
              component="img"
              src={logoDataUrl}
              alt="Logo"
              sx={{
                height: 40,
                maxWidth: 120,
                objectFit: 'contain',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: '#fff',
                p: 0.5
              }}
            />
          ) : null}
          <Button component="label" size="small" variant="outlined">
            {logoDataUrl ? 'Logo csere' : 'Logo feltöltés'}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={e => handleLogoPick(e.target.files?.[0] || null)}
            />
          </Button>
          {logoDataUrl ? (
            <Button size="small" color="inherit" onClick={clearLogo}>
              Logo törlése
            </Button>
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          A logo az ajánlat tetején jelenik meg, és a profilodban mentődik (Beállítások → Céglogo).
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.75 }}>
          Ajánlat színe
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {PDF_PALETTE_OPTIONS.map(opt => {
            const selected = paletteId === opt.id && accentHex.toUpperCase() === opt.swatch.toUpperCase()
            return (
              <Tooltip key={opt.id} title={opt.label}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => {
                    setPaletteId(opt.id)
                    setAccentHex(opt.swatch)
                    setAccentHexDraft(opt.swatch)
                    savePaletteId(opt.id)
                    saveAccentHex(opt.swatch)
                  }}
                  aria-label={opt.label}
                  aria-pressed={selected}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    border: '2px solid',
                    borderColor: selected ? SOFT_GREEN : 'divider',
                    bgcolor: opt.swatch,
                    cursor: 'pointer',
                    p: 0,
                    boxShadow: selected ? `0 0 0 2px ${SOFT_GREEN}33` : 'none',
                    outline: 'none'
                  }}
                />
              </Tooltip>
            )
          })}
          <Box
            component="input"
            type="color"
            value={normalizeAccentHex(accentHex) || '#212121'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const hex = normalizeAccentHex(e.target.value) || '#212121'
              setPaletteId('custom')
              setAccentHex(hex)
              setAccentHexDraft(hex)
              savePaletteId('custom')
              saveAccentHex(hex)
            }}
            aria-label="Egyedi szín"
            title="Egyedi szín"
            sx={{
              width: 40,
              height: 36,
              border: '2px solid',
              borderColor: paletteId === 'custom' ? SOFT_GREEN : 'divider',
              borderRadius: 1,
              p: 0.25,
              bgcolor: '#fff',
              cursor: 'pointer'
            }}
          />
          <TextField
            size="small"
            label="Hex"
            value={accentHexDraft}
            onChange={e => {
              const v = e.target.value
              setAccentHexDraft(v)
              const normalized = normalizeAccentHex(v)
              if (normalized) {
                setPaletteId('custom')
                setAccentHex(normalized)
                savePaletteId('custom')
                saveAccentHex(normalized)
              }
            }}
            onBlur={() => {
              const normalized = normalizeAccentHex(accentHexDraft)
              if (normalized) {
                setAccentHexDraft(normalized)
                setAccentHex(normalized)
                setPaletteId('custom')
                savePaletteId('custom')
                saveAccentHex(normalized)
              } else {
                setAccentHexDraft(accentHex)
              }
            }}
            sx={{ width: 118 }}
            inputProps={{ maxLength: 7, spellCheck: false }}
          />
        </Stack>
      </Box>

      <Box>
        <SectionLabel n={1}>Ajánlat adatai</SectionLabel>
        {checklistMissing.length > 0 ? (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            Mentéshez / PDF-hez még kell: {checklistMissing.join(', ')}
          </Typography>
        ) : (
          <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
            Készen áll mentésre vagy PDF letöltésre.
          </Typography>
        )}
        <Stack spacing={1.25}>
          <TextField
            label="Projekt neve (pl. Konyha – Kovács)"
            fullWidth
            size="small"
            value={projectTitle}
            onChange={e => setProjectTitle(e.target.value)}
          />
          <TextField
            label="Készítette *"
            fullWidth
            size="small"
            value={preparedBy}
            onChange={e => setPreparedBy(e.target.value)}
          />
          <TextField
            label="Meddig érvényes *"
            type="date"
            fullWidth
            size="small"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={validUntilPast}
            helperText={validUntilPast ? 'Ez a dátum már elmúlt — az ügyfélnek zavaró lehet.' : undefined}
          />
          <TextField
            label="Várható idő (ügyfélnek)"
            fullWidth
            size="small"
            placeholder="pl. 2–4 hét"
            value={leadTimeNote}
            onChange={e => setLeadTimeNote(e.target.value)}
          />
        </Stack>
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <SectionLabel n={2}>Ügyfél</SectionLabel>
          <Button size="small" color="inherit" onClick={clearBuyer}>
            Új ügyfél
          </Button>
        </Stack>
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

      <Box>
        <SectionLabel n={3}>Portál források (max. {MAX_PORTAL_SOURCES})</SectionLabel>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
          Bármennyi lapszabászat és Nettfront. Tipikus: korpusz + frontok. Árrés forrásonként.
        </Typography>
        {loadWarnings.length > 0 ? (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            {loadWarnings.join(' ')}
          </Typography>
        ) : null}
        {highMarkup ? (
          <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 1 }}>
            Figyelem: legalább egy forrásnál az árrés 60% felett van.
          </Typography>
        ) : null}

        {sources.length === 0 ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center'
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Nincs forrás — csak saját tételekkel dolgozol, vagy hozz be portál ajánlatot.
            </Typography>
            <Button
              variant="outlined"
              color="success"
              onClick={openAddPicker}
              disabled={recentQuotes.length === 0}
            >
              Forrás hozzáadása
            </Button>
            {recentQuotes.length === 0 ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Nincs mentett vagy megrendelt ajánlat a portálon.
              </Typography>
            ) : null}
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {sources.map(s => {
              const key = sourceKey(s)
              const pricingRaw = sourcePricing[key] || {
                markupPercent: 25,
                roundTo: 0 as const,
                lineDisplay: 'collapsed' as const
              }
              const pricing = {
                ...pricingRaw,
                lineDisplay:
                  pricingRaw.lineDisplay === 'detailed' ? ('detailed' as const) : ('collapsed' as const)
              }
              const marked = applyRounding(
                s.boardGross * (1 + pricing.markupPercent / 100),
                pricing.roundTo
              )
              const showStrike = pricing.markupPercent > 0
              return (
                <Box
                  key={key}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'success.light',
                    bgcolor: 'rgba(46,125,50,0.06)'
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    gap={1}
                  >
                    <Box>
                      <Chip size="small" label={s.productLabel} color="success" sx={{ mb: 0.75 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {s.quoteNumber}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="baseline" sx={{ mt: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Beszerzés (portál)
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              textDecoration: showStrike ? 'line-through' : 'none',
                              color: 'text.secondary'
                            }}
                          >
                            {formatFt(s.boardGross)}
                          </Typography>
                        </Box>
                        <Typography color="text.secondary">→</Typography>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Ügyfélnek
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 700, color: SOFT_GREEN, lineHeight: 1.2 }}
                          >
                            {formatFt(marked)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Stack spacing={0.5}>
                      <Button size="small" onClick={() => openReplacePicker(key)}>
                        Csere
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() =>
                          router.push(
                            buildStudioSourcesUrl(
                              sources.filter(x => sourceKey(x) !== key).map(x => ({
                                type: x.type,
                                id: x.id
                              })),
                              { customerQuoteId }
                            )
                          )
                        }
                      >
                        Eltávolítás
                      </Button>
                    </Stack>
                  </Stack>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1.5 }}
                  >
                    Megjelenés a PDF-en
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1, mt: 0.5 }}>
                    <Chip
                      size="small"
                      label="Összesen"
                      onClick={() =>
                        setSourcePricing(prev => ({
                          ...prev,
                          [key]: { ...pricing, lineDisplay: 'collapsed' }
                        }))
                      }
                      variant={pricing.lineDisplay === 'collapsed' ? 'filled' : 'outlined'}
                      sx={
                        pricing.lineDisplay === 'collapsed'
                          ? {
                              bgcolor: SOFT_GREEN,
                              color: '#fff',
                              '&:hover': { bgcolor: SOFT_GREEN_HOVER }
                            }
                          : {}
                      }
                    />
                    <Chip
                      size="small"
                      label="Részletes"
                      onClick={() =>
                        setSourcePricing(prev => ({
                          ...prev,
                          [key]: { ...pricing, lineDisplay: 'detailed' }
                        }))
                      }
                      variant={pricing.lineDisplay === 'detailed' ? 'filled' : 'outlined'}
                      sx={
                        pricing.lineDisplay === 'detailed'
                          ? {
                              bgcolor: SOFT_GREEN,
                              color: '#fff',
                              '&:hover': { bgcolor: SOFT_GREEN_HOVER }
                            }
                          : {}
                      }
                    />
                  </Stack>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    Árrésed: {pricing.markupPercent}%
                  </Typography>
                  <Slider
                    value={pricing.markupPercent}
                    onChange={(_, v) => {
                      const next = v as number
                      setSourcePricing(prev => ({
                        ...prev,
                        [key]: { ...pricing, markupPercent: next }
                      }))
                    }}
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
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    {([0, 100, 1000] as const).map(r => (
                      <Chip
                        key={r}
                        size="small"
                        label={r === 0 ? 'Nincs kerekítés' : `${r} Ft-ra`}
                        onClick={() => {
                          setSourcePricing(prev => ({
                            ...prev,
                            [key]: { ...pricing, roundTo: r }
                          }))
                        }}
                        variant={pricing.roundTo === r ? 'filled' : 'outlined'}
                        sx={
                          pricing.roundTo === r
                            ? {
                                bgcolor: SOFT_GREEN,
                                color: '#fff',
                                '&:hover': { bgcolor: SOFT_GREEN_HOVER }
                              }
                            : {}
                        }
                      />
                    ))}
                  </Stack>
                </Box>
              )
            })}

            <Typography variant="caption" color="text.secondary">
              Forrásonként: Összesen = 1 sor; Részletes = bontott tételek a PDF-en.
            </Typography>

            <Button
              variant="outlined"
              color="success"
              onClick={openAddPicker}
              disabled={recentQuotes.length === 0 || sources.length >= MAX_PORTAL_SOURCES}
            >
              Forrás hozzáadása
              {sources.length >= MAX_PORTAL_SOURCES ? ` (max. ${MAX_PORTAL_SOURCES})` : ''}
            </Button>
          </Stack>
        )}
      </Box>

      <Box>
        <SectionLabel n={4}>Plusz tételek</SectionLabel>
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
            Nincs plusz tétel.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {lines.map(line => (
              <Box
                key={line.id}
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                      size="small"
                      label="Megnevezés"
                      fullWidth
                      value={line.title}
                      onChange={e => updateLine(line.id, { title: e.target.value })}
                    />
                    <IconButton
                      size="small"
                      aria-label="Törlés"
                      onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))}
                      sx={{ mt: 0.5 }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr 1fr',
                        sm: 'minmax(120px, 1.2fr) minmax(72px, 0.7fr) minmax(64px, 0.6fr) minmax(120px, 1fr)'
                      },
                      gap: 1
                    }}
                  >
                    <Select
                      size="small"
                      fullWidth
                      value={line.type}
                      onChange={e =>
                        updateLine(line.id, { type: e.target.value as ManualLineType })
                      }
                      displayEmpty
                      inputProps={{ 'aria-label': 'Típus' }}
                    >
                      {(Object.keys(LINE_TYPE_LABEL) as ManualLineType[]).map(t => (
                        <MenuItem key={t} value={t}>
                          {LINE_TYPE_LABEL[t]}
                        </MenuItem>
                      ))}
                    </Select>
                    <TextField
                      size="small"
                      label="Menny."
                      value={line.quantity}
                      onChange={e => updateLine(line.id, { quantity: e.target.value })}
                    />
                    <TextField
                      size="small"
                      label="Egység"
                      value={line.unit}
                      onChange={e => updateLine(line.id, { unit: e.target.value })}
                    />
                    <TextField
                      size="small"
                      label="Bruttó eá."
                      value={line.unitPriceGross}
                      onChange={e => updateLine(line.id, { unitPriceGross: e.target.value })}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">Ft</InputAdornment>
                      }}
                    />
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
        {manualTotal > 0 ? (
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
            Plusz tételek: {formatFt(manualTotal)}
          </Typography>
        ) : null}
      </Box>

      <Box>
        <SectionLabel n={5}>Fizetés</SectionLabel>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Ez megjelenik az ajánlaton. Nem számla — csak tájékoztatás az ügyfélnek.
        </Typography>
        <RadioGroup
          value={paymentSchedule}
          sx={{ pl: 0.5, gap: 0.5 }}
          onChange={e => {
            const id = e.target.value as PaymentScheduleId
            setPaymentSchedule(id)
            savePaymentSchedule(id)
            const preset = paymentSchedulePdfText(id)
            setPaymentCustomText(preset)
            savePaymentCustomText(preset)
          }}
        >
          {PAYMENT_SCHEDULE_OPTIONS.map(opt => (
            <FormControlLabel
              key={opt.id}
              value={opt.id}
              sx={{
                alignItems: 'flex-start',
                ml: 0,
                mr: 0,
                py: 0.25,
                '& .MuiRadio-root': { pt: 0.35, ml: 0 }
              }}
              control={
                <Radio
                  size="small"
                  sx={{ color: SOFT_GREEN, '&.Mui-checked': { color: SOFT_GREEN } }}
                />
              }
              label={
                <Box sx={{ pl: 0.5, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {opt.label}
                  </Typography>
                  {opt.pdfText ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', whiteSpace: 'normal' }}
                    >
                      {opt.pdfText}
                    </Typography>
                  ) : null}
                </Box>
              }
            />
          ))}
        </RadioGroup>
        <TextField
          label="Fizetési szöveg (szerkeszthető)"
          fullWidth
          size="small"
          multiline
          minRows={2}
          value={paymentCustomText}
          onChange={e =>
            setPaymentCustomText(e.target.value.slice(0, PAYMENT_CUSTOM_MAX_CHARS))
          }
          onBlur={() => savePaymentCustomText(paymentCustomText)}
          helperText={`${paymentCustomText.length}/${PAYMENT_CUSTOM_MAX_CHARS} — ha kitöltöd, ez megy a PDF-re`}
          sx={{ mt: 1.5 }}
        />
        <FormControlLabel
          sx={{ mt: 1, alignItems: 'flex-start' }}
          control={
            <Checkbox
              size="small"
              checked={showVatNote}
              onChange={e => {
                setShowVatNote(e.target.checked)
                saveShowVatNote(e.target.checked)
              }}
              sx={{ color: SOFT_GREEN, '&.Mui-checked': { color: SOFT_GREEN }, pt: 0.25 }}
            />
          }
          label={
            <Typography variant="body2">
              ÁFA tájékoztató sor (bruttó árak, 27% ÁFA)
            </Typography>
          }
        />
      </Box>

      <Box>
        <SectionLabel n={6}>Megjegyzés</SectionLabel>
        <TextField
          label="Megjegyzés az ügyfélnek"
          fullWidth
          size="small"
          multiline
          minRows={3}
          placeholder="pl. Anyagcsere esetén az ár változhat."
          value={customerNotes}
          onChange={e => setCustomerNotes(e.target.value.slice(0, NOTES_MAX_CHARS))}
          onBlur={() => saveCustomerNotes(customerNotes)}
          helperText={`${customerNotes.length}/${NOTES_MAX_CHARS}`}
        />
      </Box>

      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}
    </Stack>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minHeight: { md: 'calc(100vh - 140px)' }
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          bgcolor: 'background.paper',
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            component={Link}
            href="/ugyfel-ajanlat"
            startIcon={<ArrowBackIcon />}
            size="small"
            color="inherit"
          >
            Lista
          </Button>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Ügyfélajánlat
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">
                {quoteLabel}
              </Typography>
              {sources.length === 0 ? (
                <Chip size="small" variant="outlined" label="Üres" />
              ) : (
                sources.map(s => (
                  <Chip key={sourceKey(s)} size="small" color="success" label={s.productLabel} />
                ))
              )}
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Box sx={{ textAlign: 'right', mr: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Fizetendő bruttó
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: SOFT_GREEN, lineHeight: 1.15 }}>
              {formatFt(payableGross)}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="success"
            startIcon={
              saveBusy ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />
            }
            onClick={handleSave}
            disabled={busy || saveBusy}
            sx={{ fontWeight: 700 }}
          >
            Mentés
          </Button>
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
            onClick={handleGenerate}
            disabled={busy || saveBusy}
            sx={{
              bgcolor: SOFT_GREEN,
              '&:hover': { bgcolor: SOFT_GREEN_HOVER },
              fontWeight: 700,
              px: 2.5
            }}
          >
            PDF letöltés
          </Button>
        </Stack>
      </Stack>

      {!isMdUp ? (
        <Stack spacing={1.5}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setMobilePreviewOpen(v => !v)}
            sx={{ alignSelf: 'stretch', borderColor: SOFT_GREEN, color: SOFT_GREEN }}
          >
            {mobilePreviewOpen ? 'Előnézet elrejtése' : 'Nézd meg az ajánlatot'}
          </Button>
          <Collapse in={mobilePreviewOpen}>{previewPane}</Collapse>
          {editor}
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
            gap: 2.5,
            flex: 1,
            minHeight: 0,
            alignItems: 'stretch'
          }}
        >
          <Box sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)', pl: 0.5, pr: 0.5 }}>
            {editor}
          </Box>
          <Box
            sx={{
              position: 'sticky',
              top: 72,
              alignSelf: 'start',
              height: 'calc(100vh - 200px)',
              minHeight: 520
            }}
          >
            {previewPane}
          </Box>
        </Box>
      )}

      <CustomerQuoteSourcePicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          setReplaceKey(null)
        }}
        quotes={recentQuotes}
        currentSources={sources.map(s => ({ type: s.type, id: s.id }))}
        replaceKey={replaceKey}
        customerQuoteId={customerQuoteId}
      />
    </Box>
  )
}
