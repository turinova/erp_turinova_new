'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  PictureAsPdf as PdfIcon,
  ShoppingCart as OrderIcon,
  RequestQuote as RequestQuoteIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import {
  NettfrontStatusHistoryCard,
  type CompanyQuoteStatusMeta
} from '@/components/portal-list/NettfrontStatusHistoryCard'

import CommentModal from '../../[quote_id]/CommentModal'
import CustomerFacingPdfDialog, {
  type CustomerFacingPdfPayload,
  type SellerProfile
} from '@/components/muhely-ajanlat/CustomerFacingPdfDialog'

type PaymentMethod = {
  id: string
  name: string
  comment?: string | null
}

type CompanyInfo = {
  name?: string
  postal_code?: string
  city?: string
  address?: string
  tax_number?: string
  company_registration_number?: string
  email?: string
  phone_number?: string
} | null

type NettfrontLine = {
  id: string
  display_name: string
  finish: string | null
  height_mm: number
  width_mm: number
  quantity: number
  area_sqm: number
  sell_net_per_sqm?: number
  line_net: number
  line_vat: number
  line_gross: number
  panthely_holes_total: number
  panthely?: { oldal?: string; mennyiseg?: number } | null
  megjegyzes: string | null
}

type QuoteData = {
  id: string
  quote_number: string
  status: string
  comment: string | null
  discount_percent: number
  lines_total_net: number
  lines_total_vat: number
  lines_total_gross: number
  services_total_net: number
  services_total_vat: number
  services_total_gross: number
  total_net: number
  total_vat: number
  total_gross: number
  final_total_after_discount: number
  created_at: string
  updated_at: string
  submitted_at?: string | null
  submitted_to_company_quote_id?: string | null
  customer_snapshot: Record<string, string | number | null> | null
  portal_customers?: {
    name?: string
    email?: string
    mobile?: string
    billing_name?: string
    billing_country?: string
    billing_city?: string
    billing_postal_code?: string
    billing_street?: string
    billing_house_number?: string
    billing_tax_number?: string
    billing_company_reg_number?: string
  } | null
  companies?: { name?: string } | null
  lines: NettfrontLine[]
}

function formatCurrency(amount: number) {
  return (
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount)) + ' Ft'
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function finishLabel(finish: string | null) {
  if (finish === 'hg') return 'Fényes'
  if (finish === 'matt') return 'Matt'
  return '—'
}

function str(v: unknown) {
  if (v == null) return ''
  return String(v)
}

export default function NettfrontQuoteDetailClient({
  initialQuoteData,
  companyInfo,
  companyPaymentMethods,
  companyQuoteMeta = null
}: {
  initialQuoteData: QuoteData
  companyInfo: CompanyInfo
  companyPaymentMethods: PaymentMethod[]
  companyQuoteMeta?: CompanyQuoteStatusMeta
}) {
  const router = useRouter()
  const [quoteData, setQuoteData] = useState(initialQuoteData)
  const [commentOpen, setCommentOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [customerPdfDialogOpen, setCustomerPdfDialogOpen] = useState(false)
  const [isGeneratingCustomerPdf, setIsGeneratingCustomerPdf] = useState(false)

  const snap = quoteData.customer_snapshot || {}
  const portalCust = quoteData.portal_customers
  const isDraft = quoteData.status === 'draft'

  const customerName = str(snap.name || portalCust?.name)
  const customerEmail = str(snap.email || portalCust?.email)
  const customerMobile = str(snap.mobile || portalCust?.mobile)
  const billingName = str(snap.billing_name || portalCust?.billing_name)
  const billingPostal = str(snap.billing_postal_code || portalCust?.billing_postal_code)
  const billingCity = str(snap.billing_city || portalCust?.billing_city)
  const billingStreet = str(snap.billing_street || portalCust?.billing_street)
  const billingHouse = str(snap.billing_house_number || portalCust?.billing_house_number)
  const billingCountry = str(snap.billing_country || portalCust?.billing_country || 'Magyarország')
  const billingTax = str(snap.billing_tax_number || portalCust?.billing_tax_number)
  const billingReg = str(snap.billing_company_reg_number || portalCust?.billing_company_reg_number)

  const skuSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        display_name: string
        finish: string | null
        panels_db: number
        total_sqm: number
        net: number
        gross: number
      }
    >()

    for (const line of quoteData.lines || []) {
      const key = `${line.display_name}|${line.finish || ''}`
      const prev = map.get(key)
      if (!prev) {
        map.set(key, {
          key,
          display_name: line.display_name,
          finish: line.finish,
          panels_db: Number(line.quantity) || 0,
          total_sqm: Number(line.area_sqm) || 0,
          net: Number(line.line_net) || 0,
          gross: Number(line.line_gross) || 0
        })
      } else {
        prev.panels_db += Number(line.quantity) || 0
        prev.total_sqm += Number(line.area_sqm) || 0
        prev.net += Number(line.line_net) || 0
        prev.gross += Number(line.line_gross) || 0
      }
    }

    return Array.from(map.values())
  }, [quoteData.lines])

  const totalHoles = useMemo(
    () => (quoteData.lines || []).reduce((s, l) => s + (Number(l.panthely_holes_total) || 0), 0),
    [quoteData.lines]
  )

  const handleSaveComment = async (comment: string) => {
    const res = await fetch(`/api/nettfront-quotes/${quoteData.id}/comment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Megjegyzés mentése sikertelen')
    setQuoteData(prev => ({ ...prev, comment: data.comment }))
    toast.success('Megjegyzés mentve')
  }

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true)
    try {
      const res = await fetch(`/api/nettfront-quotes/${quoteData.id}/pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'PDF hiba')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Nettfront-${quoteData.quote_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF generálás sikertelen')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const sellerProfile: SellerProfile = {
    name: str(portalCust?.name),
    email: str(portalCust?.email),
    mobile: str(portalCust?.mobile),
    billing_name: str(portalCust?.billing_name || portalCust?.name),
    billing_postal_code: str(portalCust?.billing_postal_code),
    billing_city: str(portalCust?.billing_city),
    billing_street: str(portalCust?.billing_street),
    billing_house_number: str(portalCust?.billing_house_number),
    billing_tax_number: str(portalCust?.billing_tax_number)
  }

  const handleCustomerFacingPdf = async (payload: CustomerFacingPdfPayload) => {
    setIsGeneratingCustomerPdf(true)
    try {
      const response = await fetch(`/api/nettfront-quotes/${quoteData.id}/customer-facing-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, generatedFrom: 'saved' })
      })

      if (!response.ok) {
        let errorMessage = 'Failed to generate PDF'
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

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ugyfelajanlat-${quoteData.quote_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Ügyfélajánlat PDF kész')
      setCustomerPdfDialogOpen(false)
    } catch (error) {
      console.error('[Customer Portal] Nettfront customer-facing PDF error:', error)
      toast.error(
        `Hiba az ügyfélajánlat PDF során: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsGeneratingCustomerPdf(false)
    }
  }

  const handleSubmitConfirm = async () => {
    if (!selectedPaymentMethodId) {
      toast.error('Válasszon fizetési módot')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/nettfront-quotes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quoteData.id,
          paymentMethodId: selectedPaymentMethodId
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || 'Megrendelés sikertelen')
      setQuoteData(prev => ({ ...prev, status: 'submitted' }))
      setSubmitOpen(false)
      toast.success(`Elküldve (${data.companyQuoteNumber || data.portalQuoteNumber})`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Megrendelés sikertelen')
    } finally {
      setIsSubmitting(false)
    }
  }

  const infoBoxSx = {
    p: 2,
    border: '1px solid #e0e0e0',
    borderRadius: 1,
    backgroundColor: '#fcfcfc',
    height: '100%'
  } as const

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <IconButton onClick={() => router.push('/saved')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          Árajánlat: {quoteData.quote_number}
        </Typography>
        <Chip label="NETTFRONT" size="small" color="success" variant="outlined" />
        <Chip
          label={isDraft ? 'Piszkozat' : 'Elküldve'}
          color={isDraft ? 'warning' : 'success'}
        />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
            {/* Company */}
            <Box sx={{ p: 3, backgroundColor: '#f5f5f5', borderRadius: 2, mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {companyInfo ? (
                  <>
                    <strong>{companyInfo.name}</strong>
                    <br />
                    {companyInfo.postal_code} {companyInfo.city}
                    {companyInfo.address ? `, ${companyInfo.address}` : ''}
                    <br />
                    {companyInfo.tax_number ? (
                      <>
                        Adószám: {companyInfo.tax_number}
                        <br />
                      </>
                    ) : null}
                    {companyInfo.company_registration_number ? (
                      <>
                        Cégjegyzékszám: {companyInfo.company_registration_number}
                        <br />
                      </>
                    ) : null}
                    {companyInfo.email ? (
                      <>
                        Email: {companyInfo.email}
                        <br />
                      </>
                    ) : null}
                    {companyInfo.phone_number ? <>Tel: {companyInfo.phone_number}</> : null}
                  </>
                ) : (
                  <>
                    <strong>{quoteData.companies?.name || 'Vállalat'}</strong>
                    <br />
                    Vállalat információ betöltése...
                  </>
                )}
              </Typography>
            </Box>

            {/* Customer + Billing */}
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <Box sx={infoBoxSx}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ color: 'primary.main', fontWeight: 600 }}
                  >
                    Ügyfél adatok
                  </Typography>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong>{customerName || '—'}</strong>
                    <br />
                    {customerEmail}
                    <br />
                    {customerMobile}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={infoBoxSx}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ color: 'primary.main', fontWeight: 600 }}
                  >
                    Számlázási adatok
                  </Typography>
                  {billingName ? (
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      <strong>{billingName}</strong>
                      <br />
                      {billingPostal} {billingCity}
                      <br />
                      {billingStreet} {billingHouse}
                      <br />
                      {billingCountry}
                      {billingTax ? (
                        <>
                          <br />
                          Adószám: {billingTax}
                        </>
                      ) : null}
                      {billingReg ? (
                        <>
                          <br />
                          Cégjegyzékszám: {billingReg}
                        </>
                      ) : null}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Nincs számlázási adat megadva
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

            {/* SKU / szín összesítő */}
            <Box sx={{ ...infoBoxSx, mb: 3, height: 'auto' }}>
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
                    {skuSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs tétel adat.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      skuSummary.map(row => (
                        <TableRow key={row.key}>
                          <TableCell>{row.display_name}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={finishLabel(row.finish)}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {`${row.total_sqm.toFixed(2)} m² / ${row.panels_db} db`}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(row.net)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.gross)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Services */}
            <Box sx={{ ...infoBoxSx, mb: 2, height: 'auto' }}>
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
                    {Number(quoteData.services_total_gross) > 0 && totalHoles > 0 ? (
                      <TableRow>
                        <TableCell>Pánthelyfúrás</TableCell>
                        <TableCell align="right">{totalHoles} db</TableCell>
                        <TableCell align="right">
                          {formatCurrency(Number(quoteData.services_total_net))}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(Number(quoteData.services_total_gross))}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs szolgáltatási adat elérhető.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Totals — main-app Fronttervező style */}
            <Box>
              {(() => {
                const frontGross =
                  (Number(quoteData.lines_total_gross) || 0) +
                  (Number(quoteData.services_total_gross) || 0)
                const feesGross = 0
                const feesPositive = Math.max(0, feesGross)
                const feesNegative = Math.min(0, feesGross)
                const subtotal = frontGross + feesPositive
                const discountAmt = subtotal * (Number(quoteData.discount_percent) / 100)
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

                      {Number(quoteData.discount_percent) > 0 ? (
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
                      ) : null}

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
                    {(quoteData.lines || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs tétel
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (quoteData.lines || []).map(line => (
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
          <Box
            sx={{
              position: 'sticky',
              top: 20,
              maxHeight: 'calc(100vh - 40px)',
              overflow: 'auto'
            }}
          >
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>

              <Tooltip title={!isDraft ? 'Elküldött árajánlat nem szerkeszthető' : ''} arrow>
                <span style={{ width: '100%', display: 'block' }}>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => router.push(`/nettfront?quote_id=${quoteData.id}`)}
                    disabled={!isDraft}
                    fullWidth
                    sx={{ mb: 1 }}
                  >
                    Nettfront szerkesztés {!isDraft && '🔒'}
                  </Button>
                </span>
              </Tooltip>

              <Tooltip
                title={!isDraft ? 'A megjegyzés csak piszkozat státuszban szerkeszthető' : ''}
                arrow
              >
                <span style={{ width: '100%', display: 'block' }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<EditIcon />}
                    onClick={() => setCommentOpen(true)}
                    disabled={!isDraft}
                    fullWidth
                    sx={{ mb: 1 }}
                  >
                    Megjegyzés {!isDraft && '🔒'}
                  </Button>
                </span>
              </Tooltip>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                fullWidth
                sx={{ mb: 1 }}
              >
                {isGeneratingPdf ? 'Letöltés…' : 'Kapott árajánlat'}
              </Button>

              <Button
                variant="contained"
                color="success"
                startIcon={<RequestQuoteIcon />}
                onClick={() => setCustomerPdfDialogOpen(true)}
                disabled={isGeneratingCustomerPdf}
                fullWidth
                sx={{ mb: 1 }}
              >
                {isGeneratingCustomerPdf ? 'Ajánlat készül…' : 'Ajánlat az ügyfelemnek'}
              </Button>

              <Button
                variant="contained"
                color="primary"
                startIcon={<OrderIcon />}
                onClick={() => setSubmitOpen(true)}
                disabled={!isDraft || isSubmitting}
                fullWidth
                sx={{ mb: 2 }}
              >
                {isDraft ? 'Megrendelés' : 'Elküldve'}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Létrehozva:</strong> {formatDate(quoteData.created_at)}
              </Typography>
              <Typography variant="body2">
                <strong>Frissítve:</strong> {formatDate(quoteData.updated_at)}
              </Typography>
              {Number(quoteData.discount_percent) > 0 ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Kedvezmény:</strong> {quoteData.discount_percent}%
                </Typography>
              ) : null}
            </Paper>

            <NettfrontStatusHistoryCard
              portalQuoteNumber={quoteData.quote_number}
              submittedAt={quoteData.submitted_at || null}
              isDraft={isDraft}
              companyMeta={companyQuoteMeta}
            />
          </Box>
        </Grid>
      </Grid>

      <CommentModal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        onSave={handleSaveComment}
        initialComment={quoteData.comment}
        quoteNumber={quoteData.quote_number}
      />

      <Dialog
        open={submitOpen}
        onClose={() => !isSubmitting && setSubmitOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Árajánlat elküldése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan el szeretné küldeni ezt a Nettfront árajánlatot a cégnek?
            <br />
            <br />
            Az árajánlat száma: <strong>{quoteData.quote_number}</strong>
            <br />
            Végösszeg:{' '}
            <strong>{formatCurrency(Number(quoteData.final_total_after_discount))}</strong>
            <br />
            <br />
            Az elküldés után az árajánlat nem szerkeszthető, és a cég munkatársai feldolgozzák.
          </DialogContentText>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Fizetési mód kiválasztása *
          </Typography>

          {companyPaymentMethods.length === 0 ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              A cég nem rendelkezik aktív fizetési móddal. Kérjük, vegye fel a kapcsolatot a
              céggel!
            </Alert>
          ) : (
            <RadioGroup
              value={selectedPaymentMethodId}
              onChange={e => setSelectedPaymentMethodId(e.target.value)}
            >
              {companyPaymentMethods.map(pm => (
                <Box key={pm.id}>
                  <FormControlLabel value={pm.id} control={<Radio />} label={pm.name} />
                  {pm.comment && selectedPaymentMethodId === pm.id ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', ml: 4, mb: 1 }}
                    >
                      {pm.comment}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </RadioGroup>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitOpen(false)} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitConfirm}
            disabled={
              isSubmitting || !selectedPaymentMethodId || companyPaymentMethods.length === 0
            }
          >
            {isSubmitting ? 'Küldés...' : 'Megrendelés'}
          </Button>
        </DialogActions>
      </Dialog>

      <CustomerFacingPdfDialog
        open={customerPdfDialogOpen}
        quoteNumber={quoteData.quote_number}
        boardGross={Number(quoteData.final_total_after_discount) || 0}
        seller={sellerProfile}
        productLabel="Front"
        previewUrl={`/api/nettfront-quotes/${quoteData.id}/customer-facing-pdf/preview`}
        onClose={() => setCustomerPdfDialogOpen(false)}
        onGenerate={handleCustomerFacingPdf}
        busy={isGeneratingCustomerPdf}
      />
    </Box>
  )
}
