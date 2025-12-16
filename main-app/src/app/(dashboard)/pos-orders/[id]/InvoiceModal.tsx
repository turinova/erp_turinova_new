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

interface CustomerOrderItem {
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

interface CustomerOrder {
  id: string
  order_number: string
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
  order: CustomerOrder
  items: CustomerOrderItem[]
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
  const [invoiceType, setInvoiceType] = useState('normal') // normal | advance | proforma
  const [paymentMethod, setPaymentMethod] = useState('cash') // cash, bank_transfer, card
  const [advanceAmount, setAdvanceAmount] = useState<number>(0)
  const [proformaAmount, setProformaAmount] = useState<number>(0) // For partial proforma invoices
  const [advanceAmountError, setAdvanceAmountError] = useState<string | null>(null)
  const [proformaAmountError, setProformaAmountError] = useState<string | null>(null)
  // Initialize dates as empty to prevent hydration mismatch - will be set in useEffect
  const [dueDate, setDueDate] = useState<string>('')
  const [fulfillmentDate, setFulfillmentDate] = useState<string>('')
  const [comment, setComment] = useState('')
  const [language, setLanguage] = useState('hu')
  const [sendEmail, setSendEmail] = useState(!!order.customer_email)
  
  // Preview state - template proforma approach
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [templateInvoiceNumber, setTemplateInvoiceNumber] = useState<string | null>(null) // Single template invoice number
  const [existingProformaInvoiceNumber, setExistingProformaInvoiceNumber] = useState<string | null>(null) // Existing proforma invoice number for title
  const [existingAdvanceInvoiceNumber, setExistingAdvanceInvoiceNumber] = useState<string | null>(null) // Existing advance invoice number for title
  const [pdfLoaded, setPdfLoaded] = useState(false) // Track when PDF embed has actually loaded
  const templateInvoiceNumberRef = useRef<string | null>(null) // Ref to track template invoice number for cleanup
  const [hasExistingFinalInvoice, setHasExistingFinalInvoice] = useState(false) // Track if there's an existing végszámla

  // Initialize dates only on client side to prevent hydration mismatch
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setDueDate(prev => prev || today)
    setFulfillmentDate(prev => prev || today)
  }, []) // Only run once on mount

  // Check for existing végszámla when modal opens
  useEffect(() => {
    if (open) {
      // Check for existing végszámla (final invoice) that references an advance invoice
      fetch(`/api/pos-orders/${order.id}/invoices`)
        .then(res => res.json())
        .then(data => {
          const invoices = data.invoices || []
          
          // Check if there's an advance invoice
          const hasAdvanceInvoice = invoices.some((inv: any) => inv.invoice_type === 'elolegszamla')
          
          // Check if there's a végszámla (normal invoice) that's not stornoed
          const hasFinalInvoice = invoices.some((inv: any) => 
            inv.invoice_type === 'szamla' && 
            !inv.is_storno_of_invoice_id && // Not a storno itself
            hasAdvanceInvoice // And there's an advance invoice
          )
          
          // Check if the final invoice has been stornoed
          const finalInvoiceStornoed = invoices.some((inv: any) => 
            inv.invoice_type === 'sztorno' && 
            invoices.some((orig: any) => 
              orig.invoice_type === 'szamla' && 
              orig.id === inv.is_storno_of_invoice_id &&
              hasAdvanceInvoice
            )
          )
          
          // Set flag if there's a final invoice that hasn't been stornoed
          setHasExistingFinalInvoice(hasFinalInvoice && !finalInvoiceStornoed)
          
          if (hasFinalInvoice && !finalInvoiceStornoed) {
            const errorMessage = 'Már létezik végszámla ehhez a rendeléshez. Kérjük, először sztornózza a végszámlát, ha új számlát szeretne létrehozni.'
            setError(errorMessage)
            setPreviewError(errorMessage) // Also set preview error so it shows in preview area
          } else {
            // Clear preview error if no final invoice exists
            if (hasExistingFinalInvoice) {
              setPreviewError(null)
            }
          }
        })
        .catch(err => {
          console.error('Error checking for existing final invoice:', err)
        })
    } else {
      // Reset when modal closes
      setHasExistingFinalInvoice(false)
    }
  }, [open, order.id])

  // Clear existing invoice numbers when modal opens or invoice type changes
  useEffect(() => {
    if (open) {
      setExistingProformaInvoiceNumber(null)
      setExistingAdvanceInvoiceNumber(null)
      setTemplateInvoiceNumber(null)
      // Reset amounts when switching invoice types
      if (invoiceType !== 'advance') {
        setAdvanceAmount(0)
        setAdvanceAmountError(null)
      }
      if (invoiceType !== 'proforma') {
        setProformaAmount(0)
        setProformaAmountError(null)
      }
    }
  }, [open, invoiceType])

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
  // Note: Tax number (adószám) is not required - individual customers may not have one
  const createTemplateProforma = useCallback(async (): Promise<string | null> => {
    if (!order.billing_name || !order.billing_city || !order.billing_postal_code || !order.billing_street) {
      setPreviewError('A számlázási adatok hiányoznak (név, város, irányítószám, utca)')
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
          language,
          advanceAmount: invoiceType === 'advance' ? advanceAmount : undefined,
          proformaAmount: invoiceType === 'proforma' ? (proformaAmount > 0 ? proformaAmount : undefined) : undefined
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Hiba a template proforma számla létrehozása során')
      }

      // Store existing proforma and advance invoice numbers if returned
      if (data.proformaInvoiceNumber) {
        console.log('Template proforma: Received proforma invoice number:', data.proformaInvoiceNumber)
        setExistingProformaInvoiceNumber(data.proformaInvoiceNumber)
      } else {
        console.log('Template proforma: No proforma invoice number returned')
        setExistingProformaInvoiceNumber(null)
      }
      
      if (data.advanceInvoiceNumber) {
        console.log('Template proforma: Received advance invoice number:', data.advanceInvoiceNumber)
        setExistingAdvanceInvoiceNumber(data.advanceInvoiceNumber)
      } else {
        setExistingAdvanceInvoiceNumber(null)
      }

      // If PDF is returned directly (elonezetpdf), handle it immediately
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
        const blob = new Blob([bytes], { type: data.mimeType || 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPreviewPdfUrl(url)
        setPreviewLoading(false)
        return null // No invoice number needed when PDF is returned directly
      }

      return data.invoiceNumber || null
    } catch (err: any) {
      console.error('Error creating template proforma:', err)
      setPreviewError(err.message || 'Nem sikerült létrehozni a template proforma számlát')
      return null
    }
  }, [order.id, order.billing_name, order.billing_city, order.billing_postal_code, order.billing_street, invoiceType, paymentMethod, dueDate, fulfillmentDate, comment, language, advanceAmount, proformaAmount])

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
        // Check if error is about invoice not existing (error 335) - this is acceptable
        const errorMessage = data.error || ''
        if (errorMessage.includes('335') || errorMessage.includes('Nincs ilyen díjbekérő')) {
          // Invoice already deleted or doesn't exist - this is fine, goal achieved
          console.log(`Template proforma invoice ${invoiceNumber} already deleted or doesn't exist - treating as success`)
        } else {
          // Other errors - log but don't throw (non-critical)
          console.warn(`Failed to delete template proforma invoice ${invoiceNumber}:`, data.error)
        }
      } else {
        console.log(`Template proforma invoice ${invoiceNumber} deleted successfully`)
      }
    } catch (err) {
      // Network or other errors - log but don't throw (non-critical for template cleanup)
      console.warn(`Error deleting template proforma invoice ${invoiceNumber}:`, err)
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

  // Clear preview state when modal opens (but preserve error if hasExistingFinalInvoice)
  useEffect(() => {
    if (open) {
      setTemplateInvoiceNumber(null)
      setPreviewPdfUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.split('#')[0])
        }
        return null
      })
      // Don't clear preview error if there's an existing final invoice - it will be set by the check
      if (!hasExistingFinalInvoice) {
      setPreviewError(null)
      }
      setPdfLoaded(false)
    }
  }, [open, hasExistingFinalInvoice])

  // Update ref when templateInvoiceNumber changes
  useEffect(() => {
    templateInvoiceNumberRef.current = templateInvoiceNumber
  }, [templateInvoiceNumber])

  // Regenerate preview when settings change (with debounce)
  useEffect(() => {
    if (!open || !order.billing_name || !order.billing_city || !order.billing_postal_code || !order.billing_street) {
      return
    }

    // Don't generate preview if there's an existing final invoice
    if (hasExistingFinalInvoice) {
      setPreviewPdfUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.split('#')[0])
        }
        return null
      })
      setPreviewLoading(false)
      setPreviewError('Már létezik végszámla ehhez a rendeléshez. Kérjük, először sztornózza a végszámlát, ha új számlát szeretne létrehozni.')
      return
    }

    let cancelled = false

    const regeneratePreview = async () => {
      // Clear existing preview (no need to delete since elonezetpdf doesn't create invoices)
        setTemplateInvoiceNumber(null)
        setPreviewPdfUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev.split('#')[0])
          }
          return null
        })
        setPdfLoaded(false)

      setPreviewLoading(true)
      setPreviewError(null)

      try {
        // Create template proforma with elonezetpdf - PDF returned directly
        await createTemplateProforma()
        // PDF is handled in createTemplateProforma callback
      } catch (err: any) {
        if (cancelled) return
        console.error('Error regenerating preview:', err)
        setPreviewError(err.message || 'Nem sikerült újra létrehozni az előnézetet')
          setPreviewLoading(false)
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
  }, [open, paymentMethod, dueDate, fulfillmentDate, comment, language, invoiceType, advanceAmount, proformaAmount, order.billing_name, order.billing_city, order.billing_postal_code, order.billing_street, createTemplateProforma, queryInvoicePdf, deleteTemplateProforma, hasExistingFinalInvoice])

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
    
    if (invoiceType === 'advance' && (!advanceAmount || advanceAmount <= 0)) {
      setError('Előleg számla esetén az előleg összegének megadása kötelező')
      return
    }

    // Validate advance amount doesn't exceed total
    if (invoiceType === 'advance' && advanceAmount > 0) {
      const totalGross = Number(order.total_gross) || 0
      if (advanceAmount > totalGross) {
        setError(`Az előleg összege nem lehet nagyobb, mint a rendelés teljes összege (${totalGross.toLocaleString('hu-HU')} Ft)`)
        return
      }
    }

    if (invoiceType === 'proforma' && proformaAmount < 0) {
      setError('A díjbekérő összege nem lehet negatív')
      return
    }

    // Validate proforma amount doesn't exceed total
    if (invoiceType === 'proforma' && proformaAmount > 0) {
      const totalGross = Number(order.total_gross) || 0
      if (proformaAmount > totalGross) {
        setError(`A díjbekérő összege nem lehet nagyobb, mint a rendelés teljes összege (${totalGross.toLocaleString('hu-HU')} Ft)`)
        return
      }
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
          sendEmail,
          advanceAmount: invoiceType === 'advance' ? advanceAmount : undefined,
          proformaAmount: invoiceType === 'proforma' ? (proformaAmount > 0 ? proformaAmount : undefined) : undefined
        })
      })

      // Check if response exists and is ok before trying to parse JSON
      if (!response) {
        throw new Error('Nem sikerült kapcsolódni a szerverhez. Kérjük, próbálja újra.')
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        // If JSON parsing fails, try to get text response
        const textResponse = await response.text()
        console.error('Failed to parse JSON response:', textResponse)
        throw new Error(`Szerver hiba: ${response.status} ${response.statusText}`)
      }

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
      // Handle network errors specifically
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Hálózati hiba történt. Kérjük, ellenőrizze az internetkapcsolatot és próbálja újra.')
      } else {
      setError(err.message || 'Ismeretlen hiba történt')
      }
      toast.error('Hiba a számla létrehozása során!')
    } finally {
      setLoading(false)
    }
  }

  // Get unit name for display
  const getUnitName = (item: CustomerOrderItem) => {
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
          <Typography variant="h6">Számlázás - {order.order_number}</Typography>
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

              <FormControl fullWidth size="small">
                <InputLabel>Számla típusa</InputLabel>
                <Select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                  label="Számla típusa"
                >
                  <MenuItem value="normal">Normál számla</MenuItem>
                  <MenuItem value="advance">Előleg számla</MenuItem>
                  <MenuItem value="proforma">Díjbekérő</MenuItem>
                </Select>
              </FormControl>

              {invoiceType === 'advance' && (
                <TextField
                  fullWidth
                  label="Előleg összege (Ft)"
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    setAdvanceAmount(value)
                    const totalGross = Number(order.total_gross) || 0
                    if (value > totalGross) {
                      setAdvanceAmountError(`Az előleg összege nem lehet nagyobb, mint a rendelés teljes összege (${totalGross.toLocaleString('hu-HU')} Ft)`)
                    } else {
                      setAdvanceAmountError(null)
                    }
                  }}
                  size="small"
                  inputProps={{ min: 0, step: 1 }}
                  error={!!advanceAmountError}
                  helperText={advanceAmountError || "Adja meg az előleg összegét bruttó értékben"}
                />
              )}

              {invoiceType === 'proforma' && (
                <TextField
                  fullWidth
                  label="Díjbekérő összege (Ft)"
                  type="number"
                  value={proformaAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    setProformaAmount(value)
                    const totalGross = Number(order.total_gross) || 0
                    if (value > totalGross) {
                      setProformaAmountError(`A díjbekérő összege nem lehet nagyobb, mint a rendelés teljes összege (${totalGross.toLocaleString('hu-HU')} Ft)`)
                    } else {
                      setProformaAmountError(null)
                    }
                  }}
                  size="small"
                  inputProps={{ min: 0, step: 1 }}
                  error={!!proformaAmountError}
                  helperText={proformaAmountError || "Hagyja üresen a teljes összeghez, vagy adja meg a részösszeget bruttó értékben"}
                />
              )}

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
                value={dueDate || ''}
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
                value={fulfillmentDate || ''}
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
                  {(() => {
                    console.log('Preview title render:', { existingProformaInvoiceNumber, existingAdvanceInvoiceNumber, invoiceType, templateInvoiceNumber })
                    // Show relationships in preview title
                    if (existingAdvanceInvoiceNumber && invoiceType === 'normal') {
                      return `ELŐNÉZET (VÉGSZÁMLA A ${existingAdvanceInvoiceNumber} ELŐLEGSZÁMLA ALAPJÁN)`
                    } else if (existingProformaInvoiceNumber && invoiceType === 'advance') {
                      return `ELŐNÉZET (ELŐLEGSZÁMLA A ${existingProformaInvoiceNumber} DÍJBEKÉRŐ ALAPJÁN)`
                    } else if (existingProformaInvoiceNumber && invoiceType === 'normal' && !existingAdvanceInvoiceNumber) {
                      return `ELŐNÉZET (SZÁMLA A ${existingProformaInvoiceNumber} DÍJBEKÉRŐ ALAPJÁN)`
                    } else if (invoiceType === 'proforma') {
                      return 'ELŐNÉZET (DÍJBEKÉRŐ)'
                    } else if (invoiceType === 'advance') {
                      return 'ELŐNÉZET (ELŐLEGSZÁMLA)'
                    }
                    return 'Előnézet'
                  })()}
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
                  <Box sx={{ 
                    p: 3, 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    zIndex: 2,
                    bgcolor: 'background.paper'
                  }}>
                    <Alert severity="error" sx={{ maxWidth: '80%' }}>
                      {previewError}
                    </Alert>
                  </Box>
                )}

                {previewPdfUrl && !previewError ? (
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
          disabled={loading || !!advanceAmountError || !!proformaAmountError || hasExistingFinalInvoice}
          startIcon={loading ? <CircularProgress size={20} /> : <ReceiptIcon />}
        >
          {loading ? 'Számla létrehozása...' : 'Számla létrehozása'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
