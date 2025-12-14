'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
  Box,
  CircularProgress,
  Alert
} from '@mui/material'
import { Receipt as ReceiptIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface TenantCompany {
  id: string
  name: string
  country: string | null
  postal_code: string | null
  city: string | null
  address: string | null
  phone_number: string | null
  email: string | null
  website: string | null
  tax_number: string | null
  company_registration_number: string | null
  vat_id: string | null
}

interface PosOrderItem {
  id: string
  item_type: 'product' | 'fee'
  product_type?: 'accessory' | 'material' | 'linear_material'
  product_name: string
  sku: string | null
  quantity: number
  unit_price_net: number
  unit_price_gross: number
  vat_id: string
  total_net: number
  total_vat: number
  total_gross: number
  unit?: {
    id: string
    name: string
    shortform?: string | null
  }
}

interface PosOrder {
  id: string
  pos_order_number: string
  customer_name: string | null
  customer_email: string | null
  customer_mobile: string | null
  billing_name: string | null
  billing_country: string | null
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  discount_percentage: number
  discount_amount: number
  subtotal_net: number
  total_vat: number
  total_gross: number
  created_at: string
}

interface InvoiceModalProps {
  open: boolean
  onClose: () => void
  order: PosOrder
  items: PosOrderItem[]
  tenantCompany: TenantCompany | null
  vatRates: Array<{ id: string; name: string; kulcs: number }>
}

export default function InvoiceModal({
  open,
  onClose,
  order,
  items,
  tenantCompany,
  vatRates
}: InvoiceModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Invoice settings
  const [invoiceType] = useState('normal') // Always normal invoice
  const [paymentMethod, setPaymentMethod] = useState('cash') // cash, bank_transfer, card
  const [dueDate, setDueDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] // Default today
  })
  const [fulfillmentDate, setFulfillmentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] // Default today
  })
  const [comment, setComment] = useState('')
  const [language, setLanguage] = useState('hu')
  const [sendEmail, setSendEmail] = useState(!!order.customer_email)
  
  // Preview state - template proforma approach
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [templateInvoiceNumber, setTemplateInvoiceNumber] = useState<string | null>(null) // Single template invoice number
  const [pdfLoaded, setPdfLoaded] = useState(false) // Track when PDF embed has actually loaded
  const templateInvoiceNumberRef = useRef<string | null>(null) // Ref to track template invoice number for cleanup

  // Get VAT rates map
  const vatRatesMap = useMemo(() => {
    const map = new Map<string, number>()
    vatRates.forEach(vat => {
      map.set(vat.id, vat.kulcs)
    })
    return map
  }, [vatRates])

  // Calculate totals
  const totals = useMemo(() => {
    const net = order.subtotal_net - order.discount_amount
    const vat = order.total_vat
    const gross = order.total_gross - order.discount_amount
    return { net, vat, gross }
  }, [order])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' Ft'
  }

  // Create template proforma invoice (once per modal session)
  const createTemplateProforma = useCallback(async (): Promise<string | null> => {
    if (!order.billing_name || !order.billing_city || !order.billing_postal_code || !order.billing_street) {
      setPreviewError('A számlázási adatok hiányoznak')
      return null
    }

    try {
      const response = await fetch(`/api/pos-orders/${order.id}/create-template-proforma`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceType,
          paymentMethod,
          dueDate,
          fulfillmentDate,
          comment,
          language
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Hiba a template proforma számla létrehozása során')
      }

      return data.invoiceNumber || null
    } catch (err: any) {
      console.error('Error creating template proforma:', err)
      setPreviewError(err.message || 'Nem sikerült létrehozni a template proforma számlát')
      return null
    }
  }, [order.id, order.billing_name, order.billing_city, order.billing_postal_code, order.billing_street, invoiceType, paymentMethod, dueDate, fulfillmentDate, comment, language])

  // Query PDF of existing invoice
  const queryInvoicePdf = useCallback(async (invoiceNumber: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/pos-orders/${order.id}/query-invoice-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceNumber })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Hiba az előnézet PDF lekérdezése során')
      }

      if (data.pdf) {
        // Reset PDF loaded state when setting new URL
        setPdfLoaded(false)
        
        // Cleanup old blob URL
        setPreviewPdfUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev.split('#')[0])
          }
          return null
        })
        
        // Create blob URL from base64
        const binaryString = atob(data.pdf)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const blobUrl = URL.createObjectURL(blob)
        setPreviewPdfUrl(blobUrl + '#toolbar=0&navpanes=0&scrollbar=0')
        return data.pdf
      }
      return null
    } catch (err: any) {
      console.error('Error querying invoice PDF:', err)
      setPreviewError(err.message || 'Nem sikerült lekérdezni az előnézet PDF-et')
      return null
    }
  }, [order.id])

  // Fetch preview PDF (create template if needed, then query its PDF)
  const fetchPreviewPdf = async () => {
    setPreviewLoading(true)
    setPreviewError(null)

    try {
      // Step 1: Create template proforma if not exists
      let invoiceNumber = templateInvoiceNumber
      if (!invoiceNumber) {
        invoiceNumber = await createTemplateProforma()
        if (!invoiceNumber) {
          return
        }
        setTemplateInvoiceNumber(invoiceNumber)
      }

      // Step 2: Query PDF of the template invoice
      await queryInvoicePdf(invoiceNumber)
    } catch (err: any) {
      console.error('Error fetching preview:', err)
      setPreviewError(err.message || 'Nem sikerült betölteni az előnézetet')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Delete template proforma invoice
  const deleteTemplateProforma = useCallback(async (invoiceNumber: string | null) => {
    if (!invoiceNumber) return

    try {
      const response = await fetch(`/api/pos-orders/${order.id}/delete-preview-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceNumber })
      })
      
      const data = await response.json()
      if (!response.ok || !data.success) {
        console.error(`Failed to delete template proforma invoice ${invoiceNumber}:`, data.error)
      } else {
        console.log(`Template proforma invoice ${invoiceNumber} deleted successfully`)
      }
    } catch (err) {
      console.error(`Error deleting template proforma invoice ${invoiceNumber}:`, err)
    }
  }, [order.id])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl.split('#')[0])
      }
    }
  }, [previewPdfUrl])

  // Delete template proforma invoice when modal closes without creating final invoice
  useEffect(() => {
    if (!open && templateInvoiceNumber) {
      // Cleanup template invoice when modal closes (async, don't block)
      deleteTemplateProforma(templateInvoiceNumber)
      setPreviewPdfUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.split('#')[0])
        }
        return null
      })
      setTemplateInvoiceNumber(null)
    }
  }, [open, templateInvoiceNumber, deleteTemplateProforma])

  // Clear preview state when modal opens
  useEffect(() => {
    if (open) {
      setTemplateInvoiceNumber(null)
      setPreviewPdfUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.split('#')[0])
        }
        return null
      })
      setPreviewError(null)
      setPdfLoaded(false)
    }
  }, [open])

  // Update ref when templateInvoiceNumber changes
  useEffect(() => {
    templateInvoiceNumberRef.current = templateInvoiceNumber
  }, [templateInvoiceNumber])

  // Regenerate preview when settings change (with debounce)
  useEffect(() => {
    if (!open || !order.billing_name || !order.billing_city || !order.billing_postal_code || !order.billing_street) {
      return
    }

    let cancelled = false

    const regeneratePreview = async () => {
      // Delete existing template proforma first
      const currentTemplateNumber = templateInvoiceNumberRef.current
      if (currentTemplateNumber) {
        await deleteTemplateProforma(currentTemplateNumber)
        setTemplateInvoiceNumber(null)
        setPreviewPdfUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev.split('#')[0])
          }
          return null
        })
        setPdfLoaded(false)
      }

      setPreviewLoading(true)
      setPreviewError(null)

      try {
        // Create new template proforma with updated settings
        const invoiceNumber = await createTemplateProforma()
        if (cancelled || !invoiceNumber) return

        setTemplateInvoiceNumber(invoiceNumber)

        // Query PDF of the new template invoice
        await queryInvoicePdf(invoiceNumber)
      } catch (err: any) {
        if (cancelled) return
        console.error('Error regenerating preview:', err)
        setPreviewError(err.message || 'Nem sikerült újra létrehozni az előnézetet')
      } finally {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      }
    }

    // Debounce the regeneration to avoid too many API calls
    const timeoutId = setTimeout(() => {
      regeneratePreview()
    }, 500) // 500ms delay

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [open, paymentMethod, dueDate, fulfillmentDate, comment, language, order.billing_name, order.billing_city, order.billing_postal_code, order.billing_street, createTemplateProforma, queryInvoicePdf, deleteTemplateProforma])

  // Timeout fallback to clear loading state if PDF embed doesn't fire onLoad
  useEffect(() => {
    if (previewPdfUrl && !pdfLoaded && !previewError) {
      const timeout = setTimeout(() => {
        // If PDF hasn't loaded after 5 seconds, assume it's loaded or clear loading
        setPdfLoaded(true)
        setPreviewLoading(false)
      }, 5000)

      return () => clearTimeout(timeout)
    }
  }, [previewPdfUrl, pdfLoaded, previewError])

  const handleCreateInvoice = async () => {
    // Validation
    if (!order.billing_name) {
      setError('A számlázási név kötelező!')
      return
    }

    if (!order.billing_city || !order.billing_postal_code || !order.billing_street) {
      setError('A számlázási cím (város, irányítószám, utca) kötelező!')
      return
    }

    setError(null)
    setLoading(true)

    // Delete template proforma invoice before creating final invoice
    if (templateInvoiceNumber) {
      await deleteTemplateProforma(templateInvoiceNumber)
      setTemplateInvoiceNumber(null)
    }

    try {
      const response = await fetch(`/api/pos-orders/${order.id}/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceType,
          paymentMethod,
          dueDate,
          fulfillmentDate,
          comment,
          language,
          sendEmail
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errorMsg = data.error || 'Hiba történt a számla létrehozása során'
        // Include details if available for debugging
        if (data.details) {
          console.error('Szamlazz.hu error details:', data.details)
        }
        throw new Error(errorMsg)
      }

      toast.success(`Számla sikeresen létrehozva: ${data.invoiceNumber || 'N/A'}`)
      // Clear preview state
      setTemplateInvoiceNumber(null)
      setPreviewPdfUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.split('#')[0])
        }
        return null
      })
      onClose()
    } catch (err: any) {
      console.error('Error creating invoice:', err)
      setError(err.message || 'Ismeretlen hiba történt')
      toast.error('Hiba a számla létrehozása során!')
    } finally {
      setLoading(false)
    }
  }

  // Get unit name for display
  const getUnitName = (item: PosOrderItem) => {
    if (item.unit?.shortform) return item.unit.shortform
    if (item.product_type === 'material') return 'm²'
    if (item.product_type === 'linear_material') return 'm'
    return item.unit?.name || 'db'
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptIcon />
          <Typography variant="h6">Számlázás - {order.pos_order_number}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={3} sx={{ mt: 0 }}>
          {/* Left side: Settings (40%) */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                Beállítások
              </Typography>

              <FormControl fullWidth size="small" disabled>
                <InputLabel>Számla típusa</InputLabel>
                <Select
                  value={invoiceType}
                  label="Számla típusa"
                >
                  <MenuItem value="normal">Normál számla</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Fizetési mód</InputLabel>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  label="Fizetési mód"
                >
                  <MenuItem value="cash">Készpénz</MenuItem>
                  <MenuItem value="bank_transfer">Átutalás</MenuItem>
                  <MenuItem value="card">Bankkártya</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Fizetési határidő"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                size="small"
                InputLabelProps={{
                  shrink: true,
                }}
              />

              <TextField
                fullWidth
                label="Teljesítési dátum"
                type="date"
                value={fulfillmentDate}
                onChange={(e) => setFulfillmentDate(e.target.value)}
                size="small"
                InputLabelProps={{
                  shrink: true,
                }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Nyelv</InputLabel>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  label="Nyelv"
                >
                  <MenuItem value="hu">Magyar</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Megjegyzés"
                multiline
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                size="small"
                placeholder="Opcionális megjegyzés a számlára..."
              />

              {order.customer_email && (
                <FormControl fullWidth size="small">
                  <InputLabel>E-mail küldés</InputLabel>
                  <Select
                    value={sendEmail ? 'yes' : 'no'}
                    onChange={(e) => setSendEmail(e.target.value === 'yes')}
                    label="E-mail küldés"
                  >
                    <MenuItem value="yes">Igen</MenuItem>
                    <MenuItem value="no">Nem</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Grid>

          {/* Right side: Preview (60%) */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 0, height: 'calc(90vh - 140px)', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Typography variant="h6">
                  {templateInvoiceNumber 
                    ? `ELŐNÉZET (SZÁMLA A ${templateInvoiceNumber} DÍJBEKÉRŐ ALAPJÁN)`
                    : 'Előnézet'
                  }
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                {(previewLoading || (previewPdfUrl && !pdfLoaded)) && (
                  <Box sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    zIndex: 1
                  }}>
                    <Stack spacing={2} alignItems="center">
                      <CircularProgress />
                      <Typography variant="body2" color="text.secondary">
                        Előnézet betöltése...
                      </Typography>
                    </Stack>
                  </Box>
                )}

                {previewError && (
                  <Box sx={{ p: 3 }}>
                    <Alert severity="warning" onClose={() => setPreviewError(null)}>
                      {previewError}
                    </Alert>
                  </Box>
                )}

                {previewPdfUrl ? (
                  <embed
                    src={previewPdfUrl}
                    type="application/pdf"
                    onLoad={() => {
                      setPdfLoaded(true)
                      setPreviewLoading(false)
                    }}
                    onError={() => {
                      setPreviewError('Hiba történt a PDF betöltése során')
                      setPreviewLoading(false)
                      setPdfLoaded(false)
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      opacity: pdfLoaded ? 1 : 0,
                      transition: 'opacity 0.3s ease-in-out'
                    }}
                    title="Invoice Preview"
                  />
                ) : !previewLoading && !previewError ? (
                  <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body2">
                      Az előnézet automatikusan betöltődik a beállítások módosítása után...
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Figyelem: Az előnézet létrehoz egy preview számlát a számlázz.hu rendszerében, de csak egyszer generálódik ugyanazokkal a beállításokkal.
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Mégse
        </Button>
        <Button
          onClick={handleCreateInvoice}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <ReceiptIcon />}
        >
          {loading ? 'Számla létrehozása...' : 'Számla létrehozása'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
