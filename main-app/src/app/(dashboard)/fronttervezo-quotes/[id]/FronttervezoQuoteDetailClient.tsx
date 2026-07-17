'use client'

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  FileDownload as ExportIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ShoppingCart as OrderIcon,
  Payment as PaymentIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'
import QuoteFeesSection from '../../quotes/[quote_id]/QuoteFeesSection'
import AddFeeModal from '../../quotes/[quote_id]/AddFeeModal'
import EditDiscountModal from '../../quotes/[quote_id]/EditDiscountModal'
import CommentModal from '../../quotes/[quote_id]/CommentModal'
import AddPaymentModal from '../../orders/[order_id]/AddPaymentModal'
import PaymentConfirmationModal from '../../scanner/PaymentConfirmationModal'
import SmsConfirmationModal from '../../scanner/SmsConfirmationModal'
import ArrivalDateModal from '../../fronttervezo-orders/ArrivalDateModal'
import CreateFronttervezoOrderModal from './CreateFronttervezoOrderModal'
import {
  printFronttervezoReceipt,
  requestFronttervezoUsbPrinter
} from '@/lib/print-fronttervezo-receipt'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

const API_BASE = '/api/fronttervezo-quotes/'

function sanitizeBarcodeForCODE128(barcode: string): string {
  let sanitized = barcode
  // Keep printable ASCII for CODE128
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, '')
  return sanitized || barcode
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('hu-HU')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

type FeeType = {
  id: string
  name: string
  net_price: number
  [key: string]: unknown
}

type QuoteLine = {
  id: string
  front_type: string
  display_name: string
  finish: string | null
  height_mm: number
  width_mm: number
  quantity: number
  area_sqm: number
  sell_net_per_sqm: number
  line_net: number
  line_vat: number
  line_gross: number
  panthely_holes_total: number
  panthely: { oldal?: string; mennyiseg?: number } | null
  megjegyzes: string | null
}

type SkuSummary = {
  id: string
  display_name: string
  finish: string | null
  panels_db: number
  total_sqm: number
  sell_net_per_sqm: number
  net: number
  vat: number
  gross: number
}

type ServiceRow = {
  id: string
  service_type: string
  quantity: number
  unit_price_net: number
  net: number
  vat: number
  gross: number
}

type QuoteFee = {
  id: string
  fee_name: string
  quantity: number
  unit_price_net: number
  vat_rate: number
  vat_amount: number
  gross_price: number
  currency_id: string
  comment: string
}

export type FronttervezoQuoteDetail = {
  id: string
  quote_number: string
  order_number?: string | null
  barcode?: string | null
  status: string
  payment_status?: string | null
  discount_percent: number
  comment?: string | null
  expected_arrival_date?: string | null
  actual_arrival_date?: string | null
  ready_notification_sent_at?: string | null
  created_at?: string
  lines_total_net: number
  lines_total_vat: number
  lines_total_gross: number
  services_total_net: number
  services_total_vat: number
  services_total_gross: number
  fees_total_net: number
  fees_total_vat: number
  fees_total_gross: number
  total_net: number
  total_vat: number
  total_gross: number
  final_total_after_discount: number
  updated_at: string
  payments?: Array<{
    id: string
    amount: number
    payment_method: string
    comment: string | null
    payment_date: string
  }>
  customer: {
    id: string
    name: string
    email: string
    mobile: string
    billing_name: string
    billing_country: string
    billing_city: string
    billing_postal_code: string
    billing_street: string
    billing_house_number: string
    billing_tax_number: string
    billing_company_reg_number: string
  } | null
  lines: QuoteLine[]
  sku_summary: SkuSummary[]
  services: ServiceRow[]
  fees: QuoteFee[]
  tenant_company?: {
    name?: string
    postal_code?: string
    city?: string
    address?: string
    tax_number?: string
    company_registration_number?: string
    email?: string
    phone_number?: string
  } | null
}

function formatCurrency(amount: number) {
  return (
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  )
}

function statusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Piszkozat'
    case 'ordered':
      return 'Megrendelve'
    case 'ready':
      return 'Beérkezett'
    case 'finished':
      return 'Átadva'
    case 'cancelled':
      return 'Törölve'
    default:
      return status
  }
}

function statusColor(
  status: string
): 'default' | 'error' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'draft':
      return 'error'
    case 'ordered':
      return 'success'
    case 'ready':
      return 'info'
    case 'finished':
      return 'success'
    case 'cancelled':
      return 'error'
    default:
      return 'default'
  }
}

function serviceLabel(type: string) {
  if (type === 'panthelyfuras') return 'Pánthelyfúrás'
  return type
}

type Props = {
  initialQuoteData: FronttervezoQuoteDetail
  feeTypes: FeeType[]
  isOrderView?: boolean
}

export default function FronttervezoQuoteDetailClient({
  initialQuoteData,
  feeTypes,
  isOrderView = false
}: Props) {
  const router = useRouter()
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const permissionPath = isOrderView ? '/fronttervezo-orders' : '/fronttervezo-quotes'
  const hasAccess = canAccess(permissionPath)

  const [quoteData, setQuoteData] = useState(initialQuoteData)
  const [addFeeModalOpen, setAddFeeModalOpen] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false)
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false)
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false)
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsEligibleOrders, setSmsEligibleOrders] = useState<
    Array<{
      id: string
      order_number: string
      customer_name: string
      customer_mobile: string
    }>
  >([])
  const [pendingArrivalDate, setPendingArrivalDate] = useState<string | null>(null)
  const [pendingUsbDevice, setPendingUsbDevice] = useState<USBDevice | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const isLocked = ['ready', 'finished', 'cancelled'].includes(quoteData.status)
  const listPath = isOrderView ? '/fronttervezo-orders' : '/fronttervezo-quotes'
  const totalPaid =
    quoteData.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0
  const remainingBalance = Math.round(
    (quoteData.final_total_after_discount || 0) - totalPaid
  )

  const refreshQuote = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}${quoteData.id}`)
      if (!res.ok) throw new Error('refresh failed')
      const data = await res.json()
      setQuoteData(data)
    } catch {
      toast.error('Az ajánlat frissítése sikertelen')
    }
  }, [quoteData.id])

  useEffect(() => {
    setQuoteData(initialQuoteData)
  }, [initialQuoteData])

  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      toast.error(
        isOrderView
          ? 'Nincs jogosultsága a Front megrendelések megtekintéséhez!'
          : 'Nincs jogosultsága a Front ajánlatok megtekintéséhez!'
      )
      router.push('/home')
    }
  }, [hasAccess, permissionsLoading, router, isOrderView])

  const handleSaveComment = async (comment: string) => {
    const res = await fetch(`${API_BASE}${quoteData.id}/comment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment || null })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Mentés sikertelen')
    }
    toast.success('Megjegyzés mentve')
    await refreshQuote()
  }

  const sanitizeFilenamePart = (name: string) =>
    name
      .trim()
      .replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ.]+/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80)

  const handleGeneratePdf = async () => {
    if (!quoteData?.id) {
      toast.error('Az árajánlat szükséges a PDF generálásához')
      return
    }

    setIsGeneratingPdf(true)
    try {
      const response = await fetch(`${API_BASE}${quoteData.id}/pdf`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }))
        throw new Error(errorData.error || 'Hiba történt a PDF generálása során')
      }

      const blob = await response.blob()
      const customerName =
        quoteData.customer?.billing_name || quoteData.customer?.name || quoteData.quote_number
      const filename = `NETT-FQ-${sanitizeFilenamePart(customerName)}.pdf`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF sikeresen generálva és letöltve')
    } catch (error: unknown) {
      console.error('Error generating PDF:', error)
      toast.error(
        'Hiba történt a PDF generálása során: ' +
          (error instanceof Error ? error.message : 'Ismeretlen hiba')
      )
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    if (!quoteData?.id) {
      toast.error('Az árajánlat szükséges az Excel exportáláshoz')
      return
    }

    try {
      toast.info('Excel generálása...', { autoClose: 2000 })

      const response = await fetch(`${API_BASE}${quoteData.id}/export-excel`)
      const data = (await response.json()) as {
        success?: boolean
        files?: Array<{ filename: string; contentBase64: string }>
        error?: string
      }

      if (!response.ok || !data.success || !data.files?.length) {
        throw new Error(data.error || 'Excel generálás sikertelen')
      }

      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i]
        const binary = atob(file.contentBase64)
        const bytes = new Uint8Array(binary.length)
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)

        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        // Böngésző több letöltés engedélyezése
        if (i < data.files.length - 1) {
          await new Promise(r => setTimeout(r, 250))
        }
      }

      toast.success(
        data.files.length === 1
          ? 'Excel sikeresen letöltve'
          : `${data.files.length} Excel fájl letöltve (színönként)`
      )
    } catch (error: unknown) {
      console.error('Error exporting Excel:', error)
      toast.error(
        'Hiba az Excel export során: ' +
          (error instanceof Error ? error.message : 'Ismeretlen hiba')
      )
    }
  }

  const handleOrderCreated = (orderId: string) => {
    router.push(`/fronttervezo-orders/${orderId}`)
  }

  const updateStatus = async (
    newStatus: 'ready' | 'finished' | 'cancelled',
    options?: {
      actual_arrival_date?: string
      create_payments?: boolean
      sms_order_ids?: string[]
    }
  ): Promise<boolean> => {
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/fronttervezo-orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: [quoteData.id],
          new_status: newStatus,
          actual_arrival_date: options?.actual_arrival_date,
          create_payments: options?.create_payments || false,
          sms_order_ids: options?.sms_order_ids || []
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Státusz frissítés sikertelen')
      }
      const label =
        newStatus === 'ready'
          ? 'Beérkezett'
          : newStatus === 'finished'
            ? 'Átadva'
            : 'Törölve'
      toast.success(`Státusz: ${label}`)
      if (data.sms_notifications?.sent > 0) {
        toast.success(`${data.sms_notifications.sent} SMS elküldve`)
      }
      await refreshQuote()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Státusz frissítés sikertelen')
      return false
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const printThisOrder = async (usbDevice: USBDevice | null) => {
    try {
      await printFronttervezoReceipt({
        orderId: quoteData.id,
        orderNumber: quoteData.order_number || quoteData.quote_number,
        customerName: quoteData.customer?.name || '—',
        preferredUsbDevice: usbDevice
      })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Hiba történt a nyomtatás során'
      if (errorMessage.includes('not supported')) {
        toast.warning(
          'A böngésző nem támogatja a közvetlen USB nyomtatást. Kérjük, használja a Chrome vagy Edge böngészőt.'
        )
      } else if (
        errorMessage.includes('cancelled') ||
        errorMessage.includes('Nincs nyomtató')
      ) {
        toast.info(
          'Nyomtatás megszakítva vagy nincs nyomtató kiválasztva. A böngésző nyomtatási párbeszédablaka megnyílik.'
        )
      } else {
        toast.error(errorMessage)
      }
    }
  }

  const handleArrivalConfirm = async (arrivalDate: string) => {
    setPendingArrivalDate(arrivalDate)
    try {
      const response = await fetch('/api/fronttervezo-orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: [quoteData.id] })
      })
      if (!response.ok) throw new Error('SMS jogosultság ellenőrzés sikertelen')
      const result = await response.json()
      const eligible = result.sms_eligible_orders || []
      if (eligible.length > 0) {
        setSmsEligibleOrders(eligible)
        setSmsModalOpen(true)
      } else {
        await updateStatus('ready', {
          actual_arrival_date: arrivalDate,
          sms_order_ids: []
        })
        setPendingArrivalDate(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SMS ellenőrzés sikertelen')
      setPendingArrivalDate(null)
      throw err
    }
  }

  const handleSmsConfirmation = async (selectedSmsOrderIds: string[]) => {
    setSmsModalOpen(false)
    if (!pendingArrivalDate) return
    await updateStatus('ready', {
      actual_arrival_date: pendingArrivalDate,
      sms_order_ids: selectedSmsOrderIds
    })
    setPendingArrivalDate(null)
  }

  const handleMarkFinished = async () => {
    const usbDevice = await requestFronttervezoUsbPrinter()

    if (quoteData.payment_status !== 'paid' && remainingBalance > 0) {
      setPendingUsbDevice(usbDevice)
      setPaymentConfirmOpen(true)
      return
    }

    const ok = await updateStatus('finished', { create_payments: false })
    if (ok) await printThisOrder(usbDevice)
  }

  const handlePaymentConfirm = async (createPayments: boolean) => {
    setPaymentConfirmOpen(false)
    const usbDevice = pendingUsbDevice
    setPendingUsbDevice(null)
    const ok = await updateStatus('finished', { create_payments: createPayments })
    if (ok) await printThisOrder(usbDevice)
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Nincs jogosultság</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => router.push(listPath)} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isOrderView
            ? `Megrendelés: ${quoteData.order_number || quoteData.quote_number}`
            : `Árajánlat: ${quoteData.quote_number}`}
        </Typography>
        <Chip
          label={statusLabel(quoteData.status)}
          color={statusColor(quoteData.status)}
          sx={{ ml: 2 }}
        />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={quoteData.barcode ? 7 : 12}>
                <Box
                  sx={{
                    p: 3,
                    backgroundColor: '#f5f5f5',
                    borderRadius: 2,
                    height: '100%'
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {quoteData.tenant_company ? (
                      <>
                        <strong>{quoteData.tenant_company.name}</strong>
                        <br />
                        {quoteData.tenant_company.postal_code} {quoteData.tenant_company.city},{' '}
                        {quoteData.tenant_company.address}
                        <br />
                        {quoteData.tenant_company.tax_number &&
                          `Adószám: ${quoteData.tenant_company.tax_number}`}
                        <br />
                        {quoteData.tenant_company.email &&
                          `Email: ${quoteData.tenant_company.email}`}
                      </>
                    ) : (
                      <>Nettfront / Fronttervező</>
                    )}
                  </Typography>
                </Box>
              </Grid>

              {quoteData.barcode && (
                <Grid item xs={12} md={5}>
                  <Box
                    sx={{
                      p: 2,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      border: '2px solid #e0e0e0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      Vonalkód
                    </Typography>
                    <Barcode
                      value={sanitizeBarcodeForCODE128(quoteData.barcode)}
                      format="CODE128"
                      width={2}
                      height={60}
                      displayValue={false}
                      fontSize={14}
                      margin={5}
                    />
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, fontFamily: 'monospace', letterSpacing: 2 }}
                    >
                      {quoteData.barcode}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>

            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor: '#fcfcfc',
                    height: '100%'
                  }}
                >
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Ügyfél adatok
                  </Typography>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong>{quoteData.customer?.name || '—'}</strong>
                    <br />
                    {quoteData.customer?.email}
                    <br />
                    {quoteData.customer?.mobile}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor: '#fcfcfc',
                    height: '100%'
                  }}
                >
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Számlázási adatok
                  </Typography>
                  {quoteData.customer?.billing_name ? (
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      <strong>{quoteData.customer.billing_name}</strong>
                      <br />
                      {quoteData.customer.billing_postal_code} {quoteData.customer.billing_city}
                      <br />
                      {quoteData.customer.billing_street}{' '}
                      {quoteData.customer.billing_house_number}
                      <br />
                      {quoteData.customer.billing_country}
                      {quoteData.customer.billing_tax_number && (
                        <>
                          <br />
                          Adószám: {quoteData.customer.billing_tax_number}
                        </>
                      )}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Nincs megadva
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />
            <Typography
              variant="h6"
              gutterBottom
              sx={{ color: 'primary.main', fontWeight: 600, textAlign: 'center' }}
            >
              Árajánlat összesítése
            </Typography>

            {/* Front / SKU breakdown — Opti anyag tábla stílus */}
            <Box
              sx={{
                mb: 4,
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: '#fcfcfc'
              }}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Szín</strong>
                      </TableCell>
                      <TableCell align="center">
                        <strong>Felület</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Mennyiség</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Nettó ár</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Bruttó ár</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.sku_summary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs szín összesítő adat.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      quoteData.sku_summary.map(row => (
                        <TableRow key={row.id}>
                          <TableCell>{row.display_name}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={
                                row.finish === 'hg'
                                  ? 'Fényes'
                                  : row.finish === 'matt'
                                    ? 'Matt'
                                    : '—'
                              }
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {`${Number(row.total_sqm).toFixed(2)} m² / ${row.panels_db} db`}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(Math.round(Number(row.net)))}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(Math.round(Number(row.gross)))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Services — Opti szolgáltatás tábla stílus */}
            <Box
              sx={{
                mb: 2,
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: '#fcfcfc'
              }}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Szolgáltatás</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Mennyiség</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Nettó ár</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Bruttó ár</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.services.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs szolgáltatási adat elérhető.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      quoteData.services.map(svc => (
                        <TableRow key={svc.id}>
                          <TableCell>{serviceLabel(svc.service_type)}</TableCell>
                          <TableCell align="right">
                            {svc.service_type === 'panthelyfuras'
                              ? `${svc.quantity} db`
                              : svc.quantity}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(Math.round(Number(svc.net)))}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(Math.round(Number(svc.gross)))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Totals — Opti összesítő logika + design */}
            <Box>
              {(() => {
                const frontGross =
                  (Number(quoteData.lines_total_gross) || 0) +
                  (Number(quoteData.services_total_gross) || 0)
                const feesGross = Number(quoteData.fees_total_gross) || 0
                const feesPositive = Math.max(0, feesGross)
                const feesNegative = Math.min(0, feesGross)
                const subtotal = frontGross + feesPositive
                const discountAmt = subtotal * (quoteData.discount_percent / 100)
                const finalTotal = subtotal - discountAmt + feesNegative

                return (
                  <>
                    <Box
                      sx={{
                        p: 2,
                        mb: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        backgroundColor: '#fafafa'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="600">
                          Front / Nettfront:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(frontGross)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0 }}>
                        <Typography variant="body1" fontWeight="600">
                          Díjak:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(feesGross)}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        backgroundColor: '#fcfcfc'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="700">
                          Részösszeg:
                        </Typography>
                        <Typography variant="body1" fontWeight="700">
                          {formatCurrency(subtotal)}
                        </Typography>
                      </Box>

                      {quoteData.discount_percent > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 2,
                            p: 1,
                            backgroundColor: '#f5f5f5',
                            borderRadius: 1,
                            border: '1px solid #d0d0d0'
                          }}
                        >
                          <Typography variant="body1" fontWeight="700">
                            Kedvezmény ({quoteData.discount_percent}%):
                          </Typography>
                          <Typography variant="body1" fontWeight="700">
                            -{formatCurrency(discountAmt)}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 2 }} />

                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1.5,
                          backgroundColor: '#e8e8e8',
                          borderRadius: 1,
                          border: '1px solid #c0c0c0'
                        }}
                      >
                        <Typography variant="h6" fontWeight="700">
                          Végösszeg:
                        </Typography>
                        <Typography variant="h6" fontWeight="700">
                          {formatCurrency(finalTotal)}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )
              })()}
            </Box>
          </Paper>

          <QuoteFeesSection
            quoteId={quoteData.id}
            fees={quoteData.fees}
            onFeesChange={refreshQuote}
            onAddFeeClick={() => setAddFeeModalOpen(true)}
            apiPath={API_BASE}
          />

          {quoteData.comment ? (
            <Card sx={{ mt: 3, mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Megjegyzés
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {quoteData.comment}
                </Typography>
              </CardContent>
            </Card>
          ) : null}

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Front tételek
              </Typography>
              <TableContainer sx={{ border: '1px solid rgba(224, 224, 224, 1)' }}>
                <Table
                  size="small"
                  sx={{
                    '& .MuiTableCell-root': {
                      borderRight: '1px solid rgba(224, 224, 224, 1)',
                      padding: '6px 8px',
                      fontSize: '0.875rem',
                      '&:last-child': { borderRight: 'none' }
                    },
                    '& .MuiTableHead-root .MuiTableCell-root': {
                      padding: '8px',
                      fontSize: '0.875rem'
                    }
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Szín</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Mag. (mm)</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Szél. (mm)</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Db</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>m²</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Pánthely</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Bruttó</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Megjegyzés</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs tétel
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      quoteData.lines.map(line => (
                        <TableRow key={line.id}>
                          <TableCell>{line.display_name}</TableCell>
                          <TableCell align="right">{line.height_mm}</TableCell>
                          <TableCell align="right">{line.width_mm}</TableCell>
                          <TableCell align="right">{line.quantity}</TableCell>
                          <TableCell align="right">
                            {Number(line.area_sqm).toFixed(2)}
                          </TableCell>
                          <TableCell align="right">
                            {line.panthely_holes_total > 0
                              ? `${line.panthely_holes_total} db`
                              : '—'}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(Number(line.line_gross))}
                          </TableCell>
                          <TableCell>{line.megjegyzes || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => router.push(`/fronttervezo?quote_id=${quoteData.id}`)}
                  fullWidth
                  disabled={isOrderView || isLocked || quoteData.status !== 'draft'}
                >
                  Fronttervező szerkesztés
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<EditIcon />}
                  onClick={() => setDiscountModalOpen(true)}
                  fullWidth
                  disabled={isLocked}
                >
                  Kedvezmény ({quoteData.discount_percent}%)
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setCommentModalOpen(true)}
                  fullWidth
                  disabled={isLocked}
                >
                  Megjegyzés
                </Button>

                <Divider />

                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<ExportIcon />}
                  onClick={handleExportExcel}
                  fullWidth
                >
                  Export Excel
                </Button>

                <Button
                  variant="outlined"
                  color="info"
                  startIcon={
                    isGeneratingPdf ? <CircularProgress size={16} /> : <PictureAsPdfIcon />
                  }
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  fullWidth
                >
                  {isGeneratingPdf ? 'PDF generálása...' : 'PDF generálás'}
                </Button>

                {!isOrderView && quoteData.status === 'draft' && (
                  <>
                    <Divider />
                    <Button
                      variant="outlined"
                      startIcon={<OrderIcon />}
                      onClick={() => setCreateOrderModalOpen(true)}
                      fullWidth
                    >
                      Megrendelés
                    </Button>
                  </>
                )}

                {isOrderView && (
                  <>
                    <Divider />
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<PaymentIcon />}
                      onClick={() => setAddPaymentModalOpen(true)}
                      fullWidth
                      disabled={quoteData.status === 'cancelled'}
                    >
                      Fizetés hozzáadás
                    </Button>
                    {quoteData.status === 'ordered' && (
                      <Button
                        variant="contained"
                        color="info"
                        startIcon={
                          isUpdatingStatus ? <CircularProgress size={16} /> : <CheckIcon />
                        }
                        onClick={() => setArrivalModalOpen(true)}
                        fullWidth
                        disabled={isUpdatingStatus}
                      >
                        Beérkezett
                      </Button>
                    )}
                    {quoteData.status === 'ready' && (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={
                          isUpdatingStatus ? <CircularProgress size={16} /> : <DoneAllIcon />
                        }
                        onClick={handleMarkFinished}
                        fullWidth
                        disabled={isUpdatingStatus}
                      >
                        Átadva
                      </Button>
                    )}
                  </>
                )}
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isOrderView ? 'Megrendelés információk' : 'Árajánlat információk'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Árajánlat szám:</strong> {quoteData.quote_number}
                </Typography>
                {isOrderView && quoteData.order_number && (
                  <Typography variant="body2">
                    <strong>Megrendelés szám:</strong> {quoteData.order_number}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Státusz:</strong> {statusLabel(quoteData.status)}
                </Typography>
                {isOrderView && quoteData.payment_status && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Fizetési állapot:</strong>
                    </Typography>
                    <Chip
                      label={
                        quoteData.payment_status === 'not_paid'
                          ? 'Nincs fizetve'
                          : quoteData.payment_status === 'partial'
                            ? 'Részben fizetve'
                            : 'Kifizetve'
                      }
                      color={
                        quoteData.payment_status === 'not_paid'
                          ? 'error'
                          : quoteData.payment_status === 'partial'
                            ? 'warning'
                            : 'success'
                      }
                      size="small"
                    />
                  </Box>
                )}
                {isOrderView && (
                  <Typography variant="body2">
                    <strong>Várható szállítás:</strong>{' '}
                    {formatDateOnly(quoteData.expected_arrival_date)}
                  </Typography>
                )}
                {isOrderView && quoteData.actual_arrival_date && (
                  <Typography variant="body2">
                    <strong>Tényleges beérkezés:</strong>{' '}
                    {formatDateOnly(quoteData.actual_arrival_date)}
                  </Typography>
                )}
                {isOrderView && quoteData.ready_notification_sent_at && (
                  <Typography variant="body2">
                    <strong>Beérkezés SMS:</strong>{' '}
                    {formatDateTime(quoteData.ready_notification_sent_at)}
                  </Typography>
                )}
                {isOrderView && quoteData.barcode && (
                  <Typography variant="body2">
                    <strong>Vonalkód:</strong> {quoteData.barcode}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Kedvezmény:</strong> {quoteData.discount_percent}%
                </Typography>
                <Typography variant="body2">
                  <strong>Végösszeg:</strong>{' '}
                  {formatCurrency(quoteData.final_total_after_discount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {isOrderView && quoteData.payments && quoteData.payments.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Fizetési előzmények
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Dátum</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Összeg</strong>
                      </TableCell>
                      <TableCell align="center" width={50}>
                        <strong>Info</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.payments.map(payment => {
                      const paymentMethodLabel =
                        payment.payment_method === 'cash'
                          ? 'Készpénz'
                          : payment.payment_method === 'transfer'
                            ? 'Utalás'
                            : payment.payment_method === 'card'
                              ? 'Bankkártya'
                              : payment.payment_method

                      const tooltipText = `Fizetési mód: ${paymentMethodLabel}${
                        payment.comment ? '\nMegjegyzés: ' + payment.comment : ''
                      }`

                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDateTime(payment.payment_date)}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={tooltipText} arrow>
                              <IconButton size="small">
                                <i className="ri-information-line" style={{ fontSize: '18px' }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow>
                      <TableCell>
                        <strong>Összesen:</strong>
                      </TableCell>
                      <TableCell align="right" colSpan={2}>
                        <strong>{formatCurrency(totalPaid)}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <AddFeeModal
        open={addFeeModalOpen}
        onClose={() => setAddFeeModalOpen(false)}
        quoteId={quoteData.id}
        onSuccess={refreshQuote}
        feeTypes={feeTypes as never[]}
        apiPath={API_BASE}
      />
      <EditDiscountModal
        open={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        quoteId={quoteData.id}
        currentDiscountPercent={quoteData.discount_percent}
        onSuccess={refreshQuote}
        apiPath={API_BASE}
      />
      <CommentModal
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleSaveComment}
        initialComment={quoteData.comment || null}
        quoteNumber={quoteData.quote_number}
      />
      <CreateFronttervezoOrderModal
        open={createOrderModalOpen}
        onClose={() => setCreateOrderModalOpen(false)}
        quoteId={quoteData.id}
        quoteNumber={quoteData.quote_number}
        finalTotal={quoteData.final_total_after_discount || 0}
        onSuccess={handleOrderCreated}
      />
      {isOrderView && (
        <AddPaymentModal
          open={addPaymentModalOpen}
          onClose={() => setAddPaymentModalOpen(false)}
          quoteId={quoteData.id}
          orderNumber={quoteData.order_number || quoteData.quote_number}
          finalTotal={quoteData.final_total_after_discount || 0}
          totalPaid={totalPaid}
          onSuccess={refreshQuote}
          apiPath={`/api/fronttervezo-quotes/${quoteData.id}/payments`}
        />
      )}
      {isOrderView && (
        <ArrivalDateModal
          open={arrivalModalOpen}
          onClose={() => setArrivalModalOpen(false)}
          onConfirm={handleArrivalConfirm}
        />
      )}
      {isOrderView && (
        <SmsConfirmationModal
          open={smsModalOpen}
          onClose={() => {
            setSmsModalOpen(false)
            setPendingArrivalDate(null)
          }}
          onConfirm={handleSmsConfirmation}
          orders={smsEligibleOrders}
          isProcessing={isUpdatingStatus}
          description="A következő ügyfelek SMS értesítést kapnak a front rendelés beérkezéséről. Töröld a pipát, ha nem szeretnéd elküldeni az SMS-t."
        />
      )}
      {isOrderView && (
        <PaymentConfirmationModal
          open={paymentConfirmOpen}
          orders={[
            {
              id: quoteData.id,
              order_number: quoteData.order_number || quoteData.quote_number,
              customer_name: quoteData.customer?.name || '—',
              remaining_balance: Math.max(0, remainingBalance)
            }
          ]}
          onConfirm={handlePaymentConfirm}
          onClose={() => {
            setPaymentConfirmOpen(false)
            setPendingUsbDevice(null)
          }}
        />
      )}
    </Box>
  )
}
