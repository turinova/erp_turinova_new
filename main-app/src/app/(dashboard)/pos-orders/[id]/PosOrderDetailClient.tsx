'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Autocomplete,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import TabPanel from '@mui/lab/TabPanel'
import TabContext from '@mui/lab/TabContext'
import CustomTabList from '@core/components/mui/TabList'
import NextLink from 'next/link'
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, Add as AddIcon, Receipt as ReceiptIcon, PictureAsPdf as PictureAsPdfIcon, Undo as UndoIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import InvoiceModal from './InvoiceModal'

interface Customer {
  id: string
  name: string
  email: string | null
  mobile: string | null
  discount_percent: number
  billing_name: string | null
  billing_country: string | null
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

interface Currency {
  id: string
  name: string
}

interface Unit {
  id: string
  name: string
  shortform: string
}

interface Worker {
  id: string
  name: string
  nickname: string | null
  color: string
}

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_id: string
  currency_id: string
}

interface PosOrderItem {
  id: string
  item_type: 'product' | 'fee'
  product_type?: 'accessory' | 'material' | 'linear_material'
  accessory_id: string | null
  material_id: string | null
  linear_material_id: string | null
  feetype_id: string | null
  product_name: string
  sku: string | null
  quantity: number
  unit_price_net: number
  unit_price_gross: number
  vat_id: string
  currency_id: string
  total_net: number
  total_vat: number
  total_gross: number
  // Material dimensions (for display)
  length_mm?: number
  width_mm?: number
  thickness_mm?: number
  // Linear material dimensions (for display)
  length?: number
  width?: number
  thickness?: number
  // Unit information (for accessories)
  unit?: {
    id: string
    name: string
    shortform?: string | null
  }
}

interface PosPayment {
  id: string
  payment_type: 'cash' | 'card'
  amount: number
  status: string
  created_at: string
  deleted_at: string | null
}

interface PosOrder {
  id: string
  pos_order_number: string
  worker_id: string
  worker_nickname: string
  worker_color: string
  customer_id?: string | null
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
  status: string
  created_at: string
}

interface InvoiceRow {
  id: string
  internal_number: string
  provider_invoice_number: string | null
  invoice_type: string
  payment_due_date: string | null
  fulfillment_date: string | null
  gross_total: number | null
  payment_status: string | null
  pdf_url: string | null
  is_storno_of_invoice_id: string | null
  created_at?: string
}

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

interface PosOrderDetailClientProps {
  id: string
  initialOrder: PosOrder
  initialItems: PosOrderItem[]
  initialPayments: PosPayment[]
  initialTotalPaid: number
  initialBalance: number
  initialCustomers: Customer[]
  initialVatRates: VatRate[]
  initialCurrencies: Currency[]
  initialUnits: Unit[]
  initialWorkers: Worker[]
  initialFeeTypes: FeeType[]
  initialTenantCompany: TenantCompany | null
}

export default function PosOrderDetailClient({
  id,
  initialOrder,
  initialItems,
  initialPayments,
  initialTotalPaid,
  initialBalance,
  initialCustomers,
  initialVatRates,
  initialCurrencies,
  initialUnits,
  initialWorkers,
  initialFeeTypes,
  initialTenantCompany
}: PosOrderDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Order state
  const [order, setOrder] = useState<PosOrder>(initialOrder)
  // Normalize items: set default product_type for backward compatibility with old records
  const normalizedInitialItems = initialItems.map(item => {
    if (item.item_type === 'product' && !item.product_type) {
      // Default to 'accessory' if product_type is null/undefined (backward compatibility)
      // Determine based on which ID is present
      if (item.accessory_id) {
        return { ...item, product_type: 'accessory' as const }
      } else if (item.material_id) {
        return { ...item, product_type: 'material' as const }
      } else if (item.linear_material_id) {
        return { ...item, product_type: 'linear_material' as const }
      } else {
        // Fallback to accessory if no ID is present (shouldn't happen, but safe default)
        return { ...item, product_type: 'accessory' as const }
      }
    }
    return item
  })
  const [items, setItems] = useState<PosOrderItem[]>(normalizedInitialItems)
  const [payments, setPayments] = useState<PosPayment[]>(initialPayments)
  // Calculate initial total paid from active payments only
  const initialActivePayments = initialPayments.filter(p => !p.deleted_at)
  const initialActiveTotalPaid = initialActivePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const [totalPaid, setTotalPaid] = useState(initialActiveTotalPaid)
  
  // Calculate initial balance from summary (will be recalculated when summary changes)
  const initialSummary = useMemo(() => {
    const products = normalizedInitialItems.filter(item => item.item_type === 'product')
    const fees = normalizedInitialItems.filter(item => item.item_type === 'fee')
    
    const itemsNet = products.reduce((sum, item) => sum + Number(item.total_net || 0), 0)
    const itemsVat = products.reduce((sum, item) => sum + Number(item.total_vat || 0), 0)
    const itemsGross = products.reduce((sum, item) => sum + Number(item.total_gross || 0), 0)
    
    const feesNet = fees.reduce((sum, item) => sum + Number(item.total_net || 0), 0)
    const feesVat = fees.reduce((sum, item) => sum + Number(item.total_vat || 0), 0)
    const feesGross = fees.reduce((sum, item) => sum + Number(item.total_gross || 0), 0)
    
    const totalNetBeforeDiscount = itemsNet + feesNet
    const totalVatBeforeDiscount = itemsVat + feesVat
    const totalGrossBeforeDiscount = itemsGross + feesGross
    
    const discountAmountValue = Number(initialOrder.discount_amount) || 0
    const totalGrossAfterDiscount = totalGrossBeforeDiscount - discountAmountValue
    
    return { totalGrossAfterDiscount }
  }, [])
  
  const [balance, setBalance] = useState(initialSummary.totalGrossAfterDiscount - initialActiveTotalPaid)
  const balanceWithTolerance = Math.max(0, balance > 1 ? balance : 0)

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerName, setCustomerName] = useState(initialOrder.customer_name || '')
  const [customerEmail, setCustomerEmail] = useState(initialOrder.customer_email || '')
  const [customerMobile, setCustomerMobile] = useState(initialOrder.customer_mobile || '')

  // Billing state
  const [billingName, setBillingName] = useState(initialOrder.billing_name || '')
  const [billingCountry, setBillingCountry] = useState(initialOrder.billing_country || 'Magyarország')
  const [billingCity, setBillingCity] = useState(initialOrder.billing_city || '')
  const [billingPostalCode, setBillingPostalCode] = useState(initialOrder.billing_postal_code || '')
  const [billingStreet, setBillingStreet] = useState(initialOrder.billing_street || '')
  const [billingHouseNumber, setBillingHouseNumber] = useState(initialOrder.billing_house_number || '')
  const [billingTaxNumber, setBillingTaxNumber] = useState(initialOrder.billing_tax_number || '')
  const [billingCompanyRegNumber, setBillingCompanyRegNumber] = useState(initialOrder.billing_company_reg_number || '')

  // References (declare first)
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [vatRates] = useState<VatRate[]>(initialVatRates)
  const [currencies] = useState<Currency[]>(initialCurrencies)
  const [units] = useState<Unit[]>(initialUnits)
  const [workers] = useState<Worker[]>(initialWorkers)
  const [feeTypes] = useState<FeeType[]>(initialFeeTypes)

  // Worker state
  const [workerId] = useState(initialOrder.worker_id)
  const selectedWorker = workers.find(w => w.id === workerId)

  // Discount state
  const [discountPercentage, setDiscountPercentage] = useState(initialOrder.discount_percentage)
  const [discountAmount, setDiscountAmount] = useState(initialOrder.discount_amount)

  // Editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [newItemType, setNewItemType] = useState<'product' | 'fee'>('product')
  const [addingProduct, setAddingProduct] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [newPaymentType, setNewPaymentType] = useState<'cash' | 'card'>('cash')

  // Taxpayer validation state
  const [taxpayerValidating, setTaxpayerValidating] = useState(false)
  const [taxpayerValidationError, setTaxpayerValidationError] = useState<string | null>(null)
  const [taxNumberFieldInteracted, setTaxNumberFieldInteracted] = useState(false)
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0)

  // Invoice modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [tenantCompany] = useState<TenantCompany | null>(initialTenantCompany)

  // Invoices tab state handlers
  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    try {
      const res = await fetch(`/api/pos-orders/${id}/invoices`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Hiba a számlák lekérdezésekor')
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : [])
    } catch (err: any) {
      console.error('Error loading invoices:', err)
      toast.error(err.message || 'Hiba a számlák lekérdezésekor')
    } finally {
      setInvoicesLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const handleOpenStornoDialog = (invoice: InvoiceRow) => {
    setStornoTarget(invoice)
    setStornoDialogOpen(true)
  }

  const handleCloseStornoDialog = () => {
    setStornoDialogOpen(false)
    setStornoTarget(null)
  }

  const handleConfirmStorno = async () => {
    if (!stornoTarget?.provider_invoice_number) {
      toast.error('Hiányzik a számlaszám a sztornóhoz')
      return
    }
    try {
      setInvoicesLoading(true)
      const res = await fetch(`/api/pos-orders/${id}/storno-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerInvoiceNumber: stornoTarget.provider_invoice_number })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Hiba a sztornó számla létrehozásakor')
      }
      toast.success(`Sztornó számla létrehozva: ${data.invoiceNumber || 'N/A'}`)
      handleCloseStornoDialog()
      await loadInvoices()
    } catch (err: any) {
      console.error('Error creating storno invoice:', err)
      toast.error(err.message || 'Hiba a sztornó számla létrehozásakor')
    } finally {
      setInvoicesLoading(false)
    }
  }

  const handleOpenInvoicePdf = (invoice: InvoiceRow) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank', 'noopener')
    } else {
      toast.info('Nincs PDF elérési út ehhez a számlához')
    }
  }

  // Tabs
  const [tabValue, setTabValue] = useState('edit')

  // Invoices tab state
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false)
  const [stornoTarget, setStornoTarget] = useState<InvoiceRow | null>(null)

  // Calculate summary from items
  // IMPORTANT: Recalculate VAT from net to match invoice calculation (szamlazz.hu validation)
  // This ensures the page total matches the invoice preview total
  const summary = useMemo(() => {
    const products = items.filter(item => item.item_type === 'product')
    const fees = items.filter(item => item.item_type === 'fee')
    
    // Recalculate totals with VAT recalculation to match invoice
    // Use stored net, but recalculate VAT from net to match invoice calculation
    let itemsNet = 0
    let itemsVat = 0
    let itemsGross = 0
    
    products.forEach(item => {
      const net = Math.round(Number(item.total_net || 0))
      const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
      // Recalculate VAT from net (matching invoice calculation)
      const vat = Math.round(net * vatRate / 100)
      const gross = net + vat
      
      itemsNet += net
      itemsVat += vat
      itemsGross += gross
    })
    
    let feesNet = 0
    let feesVat = 0
    let feesGross = 0
    
    fees.forEach(item => {
      const net = Math.round(Number(item.total_net || 0))
      const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
      // Recalculate VAT from net (matching invoice calculation)
      const vat = Math.round(net * vatRate / 100)
      const gross = net + vat
      
      feesNet += net
      feesVat += vat
      feesGross += gross
    })
    
    // Totals before discount
    const totalNetBeforeDiscount = itemsNet + feesNet
    const totalVatBeforeDiscount = itemsVat + feesVat
    const totalGrossBeforeDiscount = itemsGross + feesGross
    
    // Apply discount to gross total
    const discountAmountValue = Number(discountAmount) || 0
    const grossAfterDiscountRaw = totalGrossBeforeDiscount - discountAmountValue
    const totalGrossAfterDiscount = Math.round(grossAfterDiscountRaw)
    
    // Calculate net after discount proportionally (rounded)
    const discountRatio = totalGrossBeforeDiscount > 0 ? discountAmountValue / totalGrossBeforeDiscount : 0
    const totalNetAfterDiscount = Math.round(totalNetBeforeDiscount * (1 - discountRatio))
    // Derive VAT so that net + vat matches the rounded gross (avoids off-by-one display)
    const totalVatAfterDiscount = totalGrossAfterDiscount - totalNetAfterDiscount
    
    return {
      itemsNet,
      itemsVat,
      itemsGross,
      feesNet,
      feesVat,
      feesGross,
      totalNetBeforeDiscount,
      totalVatBeforeDiscount,
      totalGrossBeforeDiscount,
      totalNetAfterDiscount,
      totalVatAfterDiscount,
      totalGrossAfterDiscount
    }
  }, [items, discountAmount, vatRates])

  // Handle customer selection
  const handleCustomerChange = (event: React.SyntheticEvent, newValue: Customer | null) => {
    if (newValue) {
      setSelectedCustomer(newValue)
      setCustomerName(newValue.name)
      setCustomerEmail(newValue.email || '')
      setCustomerMobile(newValue.mobile || '')
      // Also prefill billing data
      setBillingName(newValue.billing_name || '')
      setBillingCountry(newValue.billing_country || 'Magyarország')
      setBillingCity(newValue.billing_city || '')
      setBillingPostalCode(newValue.billing_postal_code || '')
      setBillingStreet(newValue.billing_street || '')
      setBillingHouseNumber(newValue.billing_house_number || '')
      setBillingTaxNumber(newValue.billing_tax_number || '')
      setBillingCompanyRegNumber(newValue.billing_company_reg_number || '')
    } else {
      setSelectedCustomer(null)
      // Clear all customer and billing data
      setCustomerName('')
      setCustomerEmail('')
      setCustomerMobile('')
      setBillingName('')
      setBillingCountry('Magyarország')
      setBillingCity('')
      setBillingPostalCode('')
      setBillingStreet('')
      setBillingHouseNumber('')
      setBillingTaxNumber('')
      setBillingCompanyRegNumber('')
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    const roundedAmount = Math.round(amount)
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(roundedAmount) + ' Ft'
  }

  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Recalculate item totals when quantity or price changes
  const recalculateItem = (item: PosOrderItem, newQuantity?: number, newUnitPriceNet?: number, newUnitPriceGross?: number): PosOrderItem => {
    const quantity = newQuantity !== undefined ? newQuantity : item.quantity
    const unitPriceNet = newUnitPriceNet !== undefined ? newUnitPriceNet : item.unit_price_net
    const unitPriceGross = newUnitPriceGross !== undefined ? newUnitPriceGross : item.unit_price_gross
    
    // Round unit prices to avoid decimal precision issues
    const roundedUnitPriceNet = Math.round(unitPriceNet)
    const roundedUnitPriceGross = Math.round(unitPriceGross)
    
    // Calculate totals with proper rounding
    const totalNet = Math.round(roundedUnitPriceNet * quantity)
    const totalGross = Math.round(roundedUnitPriceGross * quantity)
    
    // Calculate VAT from net price using VAT rate to avoid rounding errors
    const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
    const totalVat = Math.round(totalNet * vatRate / 100)
    
    // Ensure totalGross = totalNet + totalVat (adjust if needed due to rounding)
    const adjustedTotalGross = totalNet + totalVat
    
    return {
      ...item,
      quantity,
      unit_price_net: roundedUnitPriceNet,
      unit_price_gross: roundedUnitPriceGross,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: adjustedTotalGross
    }
  }

  // Update item quantity
  const handleItemQuantityChange = (itemId: string, newQuantity: number) => {
    // Round to 2 decimal places
    const roundedQuantity = Math.round(newQuantity * 100) / 100
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? recalculateItem(item, roundedQuantity) : item
    ))
  }

  // Update item unit price (net)
  const handleItemPriceNetChange = (itemId: string, newPrice: number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item
      const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
      const newGross = newPrice * (1 + vatRate / 100)
      return recalculateItem(item, undefined, newPrice, newGross)
    }))
  }

  // Update item unit price (gross)
  const handleItemPriceGrossChange = (itemId: string, newPrice: number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item
      const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
      const newNet = newPrice / (1 + vatRate / 100)
      return recalculateItem(item, undefined, newNet, newPrice)
    }))
  }

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId))
  }

  // Debounced search term for products
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300)
  const debouncedTaxNumber = useDebounce(billingTaxNumber, 800) // Longer delay for taxpayer queries
  const productSearchAbortControllerRef = useRef<AbortController | null>(null)

  // Search products when search term changes
  useEffect(() => {
    if (productSearchAbortControllerRef.current) {
      productSearchAbortControllerRef.current.abort()
    }

    if (debouncedProductSearchTerm.trim().length >= 2) {
      setIsSearchingProducts(true)
      
      const abortController = new AbortController()
      productSearchAbortControllerRef.current = abortController

      fetch(`/api/pos/accessories?search=${encodeURIComponent(debouncedProductSearchTerm)}`, {
        signal: abortController.signal
      })
        .then(res => {
          if (abortController.signal.aborted) return null
          if (!res.ok) return []
          return res.json()
        })
        .then(data => {
          if (abortController.signal.aborted) return
          if (Array.isArray(data)) {
            setProductSearchResults(data)
          } else {
            setProductSearchResults([])
          }
          setIsSearchingProducts(false)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.error('Error searching products:', err)
          if (!abortController.signal.aborted) {
            setProductSearchResults([])
            setIsSearchingProducts(false)
          }
        })
    } else {
      setProductSearchResults([])
      setIsSearchingProducts(false)
    }

    return () => {
      if (productSearchAbortControllerRef.current) {
        productSearchAbortControllerRef.current.abort()
        productSearchAbortControllerRef.current = null
      }
    }
  }, [debouncedProductSearchTerm])

  // Query taxpayer data when tax number changes
  const taxpayerAbortControllerRef = useRef<AbortController | null>(null)
  
  useEffect(() => {
    // Only validate if the field has been interacted with (focused or changed)
    if (!taxNumberFieldInteracted) {
      return
    }

    // Clean up previous request
    if (taxpayerAbortControllerRef.current) {
      taxpayerAbortControllerRef.current.abort()
    }

    // Only query if tax number is valid format (Hungarian: 8 digits + hyphen + 1-2 digits)
    const cleanTaxNumber = debouncedTaxNumber.trim().replace(/\s+/g, '')
    const taxNumberPattern = /^\d{8}-\d{1,2}-\d{2}$/
    
    if (cleanTaxNumber && taxNumberPattern.test(cleanTaxNumber)) {
      setTaxpayerValidating(true)
      setTaxpayerValidationError(null)
      
      const abortController = new AbortController()
      taxpayerAbortControllerRef.current = abortController

      fetch('/api/taxpayer/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxNumber: cleanTaxNumber }),
        signal: abortController.signal
      })
        .then(res => {
          if (abortController.signal.aborted) return null
          return res.json()
        })
        .then(data => {
          if (abortController.signal.aborted) return
          
          console.log('Taxpayer query response data:', data)
          
          if (data.success && data.taxpayer) {
            // Auto-fill billing fields with taxpayer data
            const taxpayer = data.taxpayer
            console.log('Auto-filling billing fields with:', taxpayer)
            
            if (taxpayer.name) {
              setBillingName(taxpayer.name)
              console.log('Set billing name to:', taxpayer.name)
            }
            if (taxpayer.postalCode) {
              setBillingPostalCode(taxpayer.postalCode)
              console.log('Set postal code to:', taxpayer.postalCode)
            }
            if (taxpayer.city) {
              setBillingCity(taxpayer.city)
              console.log('Set city to:', taxpayer.city)
            }
            if (taxpayer.street) {
              setBillingStreet(taxpayer.street)
              console.log('Set street to:', taxpayer.street)
            }
            if (taxpayer.houseNumber) {
              setBillingHouseNumber(taxpayer.houseNumber)
              console.log('Set house number to:', taxpayer.houseNumber)
            }
            // Country is always "Magyarország" - don't prefill it
            setTaxpayerValidationError(null)
            toast.success('Adószám ellenőrizve és számlázási adatok automatikusan kitöltve')
          } else {
            console.error('Taxpayer query failed:', data.error)
            setTaxpayerValidationError(data.error || 'Az adószám nem található')
          }
          setTaxpayerValidating(false)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.error('Error querying taxpayer:', err)
          if (!abortController.signal.aborted) {
            setTaxpayerValidationError('Hiba történt az adószám ellenőrzése során')
            setTaxpayerValidating(false)
          }
        })
    } else if (cleanTaxNumber.length > 0) {
      // Invalid format
      setTaxpayerValidationError('Érvénytelen adószám formátum')
      setTaxpayerValidating(false)
    } else {
      // Empty, clear errors
      setTaxpayerValidationError(null)
      setTaxpayerValidating(false)
    }

    return () => {
      if (taxpayerAbortControllerRef.current) {
        taxpayerAbortControllerRef.current.abort()
        taxpayerAbortControllerRef.current = null
      }
    }
  }, [debouncedTaxNumber, taxNumberFieldInteracted])

  // Handle product selection
  const handleProductSelect = (selectedProduct: any) => {
    if (!selectedProduct) return

    const vatRate = vatRates.find(v => v.id === selectedProduct.vat_id) || vatRates[0]
    const vatPercent = vatRate?.kulcs || 0
    
    // For materials and linear_materials, use unit prices (per m² or per m)
    // For accessories, use whole piece prices
    let unitGrossPrice = selectedProduct.gross_price
    let unitNetPrice = selectedProduct.net_price
    
    if (selectedProduct.product_type === 'material' && selectedProduct.unit_price_per_sqm) {
      unitGrossPrice = selectedProduct.unit_price_per_sqm
      // Calculate unit net price from unit gross price
      unitNetPrice = unitGrossPrice / (1 + vatPercent / 100)
    } else if (selectedProduct.product_type === 'linear_material' && selectedProduct.unit_price_per_m) {
      unitGrossPrice = selectedProduct.unit_price_per_m
      // Calculate unit net price from unit gross price
      unitNetPrice = unitGrossPrice / (1 + vatPercent / 100)
    }
    
    // Round both net and gross prices consistently
    const roundedNetPrice = Math.round(unitNetPrice)
    const roundedGrossPrice = Math.round(unitGrossPrice)
    
    // Calculate VAT from net price to ensure consistency
    const vatAmount = Math.round(roundedNetPrice * vatPercent / 100)
    const adjustedGrossPrice = roundedNetPrice + vatAmount

    const newProduct: PosOrderItem = {
      id: `temp-${Date.now()}`,
      item_type: 'product',
      product_type: selectedProduct.product_type || 'accessory',
      accessory_id: selectedProduct.accessory_id || null,
      material_id: selectedProduct.material_id || null,
      linear_material_id: selectedProduct.linear_material_id || null,
      feetype_id: null,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku || null,
      quantity: 1,
      unit_price_net: roundedNetPrice,
      unit_price_gross: adjustedGrossPrice,
      vat_id: selectedProduct.vat_id,
      currency_id: selectedProduct.currency_id,
      total_net: roundedNetPrice,
      total_vat: vatAmount,
      total_gross: adjustedGrossPrice,
      // Material dimensions
      length_mm: selectedProduct.length_mm,
      width_mm: selectedProduct.width_mm,
      thickness_mm: selectedProduct.thickness_mm,
      // Linear material dimensions
      length: selectedProduct.length,
      width: selectedProduct.width,
      thickness: selectedProduct.thickness
    }

    setItems(prevItems => [...prevItems, newProduct])
    setAddingProduct(false)
    setProductSearchTerm('')
    setProductSearchResults([])
  }

  // Add new product item
  const handleAddProduct = () => {
    setAddingProduct(true)
  }

  // Cancel adding product
  const handleCancelAddProduct = () => {
    setAddingProduct(false)
    setProductSearchTerm('')
    setProductSearchResults([])
  }

  // Handle fee selection change
  const handleFeeNameChange = (itemId: string, feetypeId: string | null) => {
    if (!feetypeId) return
    
    const selectedFee = feeTypes.find(f => f.id === feetypeId)
    if (!selectedFee) return
    
    const vatRate = vatRates.find(v => v.id === selectedFee.vat_id) || vatRates[0]
    const vatPercent = vatRate?.kulcs || 0
    const grossPrice = selectedFee.net_price * (1 + vatPercent / 100)
    
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item
      return recalculateItem(
        {
          ...item,
          feetype_id: feetypeId,
          product_name: selectedFee.name,
          unit_price_net: selectedFee.net_price,
          unit_price_gross: grossPrice,
          vat_id: selectedFee.vat_id,
          currency_id: selectedFee.currency_id
        }
      )
    }))
  }

  // Add new fee
  const handleAddFee = () => {
    if (feeTypes.length === 0) {
      toast.warning('Nincs elérhető díjtípus')
      return
    }
    
    const defaultFee = feeTypes[0]
    const defaultVat = vatRates.find(v => v.id === defaultFee.vat_id) || vatRates[0]
    const vatPercent = defaultVat?.kulcs || 0
    const grossPrice = defaultFee.net_price * (1 + vatPercent / 100)
    
    const newFee: PosOrderItem = {
      id: `temp-${Date.now()}`,
      item_type: 'fee',
      accessory_id: null,
      feetype_id: defaultFee.id,
      product_name: defaultFee.name,
      sku: null,
      quantity: 1,
      unit_price_net: defaultFee.net_price,
      unit_price_gross: grossPrice,
      vat_id: defaultFee.vat_id,
      currency_id: defaultFee.currency_id,
      total_net: defaultFee.net_price,
      total_vat: grossPrice - defaultFee.net_price,
      total_gross: grossPrice
    }
    
    setItems(prevItems => [...prevItems, newFee])
  }

  // Soft delete payment
  const handleRemovePayment = async (paymentId: string) => {
    const paymentToRemove = payments.find(p => p.id === paymentId)
    if (!paymentToRemove || paymentToRemove.deleted_at) return

    try {
      const res = await fetch(`/api/pos-orders/${id}/payments/${paymentId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data?.error || 'Hiba a fizetés törlésekor')
      }

      // Update local state - mark as deleted but keep in list
      setPayments(prevPayments => {
        const updated = prevPayments.map(p => 
          p.id === paymentId ? { ...p, deleted_at: new Date().toISOString() } : p
        )
        // Recalculate totals (exclude soft-deleted)
        const activePayments = updated.filter(p => !p.deleted_at)
        const newTotalPaid = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        setTotalPaid(newTotalPaid)
        setBalance(summary.totalGrossAfterDiscount - newTotalPaid)
        return updated
      })
      
      toast.success('Fizetés törölve')
    } catch (error: any) {
      console.error('Error deleting payment:', error)
      toast.error(error.message || 'Hiba a fizetés törlésekor')
    }
  }

  // Open payment modal
  const handleAddPayment = () => {
    const remainingBalance = summary.totalGrossAfterDiscount - totalPaid
    if (remainingBalance <= 0) {
      toast.warning('A rendelés már teljesen kifizetve')
      return
    }
    
    setNewPaymentAmount(remainingBalance)
    setPaymentModalOpen(true)
  }

  // Confirm and save new payment
  const handleConfirmNewPayment = async () => {
    if (newPaymentAmount <= 0) {
      toast.error('A fizetési összegnek nagyobbnak kell lennie, mint 0')
      return
    }

    const newTotalPaid = totalPaid + newPaymentAmount
    if (newTotalPaid > summary.totalGrossAfterDiscount) {
      toast.error('A fizetési összeg nem lehet nagyobb, mint a tartozás')
      return
    }

    try {
      const res = await fetch(`/api/pos-orders/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_type: newPaymentType,
          amount: newPaymentAmount
        })
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data?.error || 'Hiba a fizetés hozzáadásakor')
      }

      // Add new payment to list
      const newPayment: PosPayment = {
        id: data.payment.id,
        payment_type: newPaymentType,
        amount: newPaymentAmount,
        status: 'completed',
        created_at: data.payment.created_at,
        deleted_at: null
      }
      
      setPayments(prevPayments => [...prevPayments, newPayment])
      setTotalPaid(newTotalPaid)
      setBalance(summary.totalGrossAfterDiscount - newTotalPaid)
      setPaymentModalOpen(false)
      setNewPaymentAmount(0)
      setNewPaymentType('cash')
      
      toast.success('Fizetés hozzáadva')
    } catch (error: any) {
      console.error('Error adding payment:', error)
      toast.error(error.message || 'Hiba a fizetés hozzáadásakor')
    }
  }

  // Calculate total paid from active (non-deleted) payments
  useEffect(() => {
    const activePayments = payments.filter(p => !p.deleted_at)
    const calculatedTotalPaid = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    setTotalPaid(calculatedTotalPaid)
    setBalance(summary.totalGrossAfterDiscount - calculatedTotalPaid)
  }, [payments, summary.totalGrossAfterDiscount])

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    try {
      // Create customer if name is provided and customer doesn't exist
      if (customerName && customerName.trim() && !selectedCustomer) {
        try {
          // Check if customer with same name already exists
          const existingCustomer = customers.find(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim())
          
          if (existingCustomer) {
            // Customer already exists, use it
            setSelectedCustomer(existingCustomer)
            setCustomerName(existingCustomer.name)
            setCustomerEmail(existingCustomer.email || '')
            setCustomerMobile(existingCustomer.mobile || '')
            setBillingName(existingCustomer.billing_name || '')
            setBillingCountry(existingCustomer.billing_country || 'Magyarország')
            setBillingCity(existingCustomer.billing_city || '')
            setBillingPostalCode(existingCustomer.billing_postal_code || '')
            setBillingStreet(existingCustomer.billing_street || '')
            setBillingHouseNumber(existingCustomer.billing_house_number || '')
            setBillingTaxNumber(existingCustomer.billing_tax_number || '')
            setBillingCompanyRegNumber(existingCustomer.billing_company_reg_number || '')
          } else {
            // Create new customer
            const customerRes = await fetch('/api/customers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: customerName.trim(),
                email: customerEmail || null,
                mobile: customerMobile || null,
                billing_name: billingName || null,
                billing_country: billingCountry || 'Magyarország',
                billing_city: billingCity || null,
                billing_postal_code: billingPostalCode || null,
                billing_street: billingStreet || null,
                billing_house_number: billingHouseNumber || null,
                billing_tax_number: billingTaxNumber || null,
                billing_company_reg_number: billingCompanyRegNumber || null,
                discount_percent: 0
              })
            })
            
            if (customerRes.ok) {
              const response = await customerRes.json()
              const newCustomer = response.data || response // Handle both response formats
              
              if (newCustomer && newCustomer.id) {
                // Add new customer to the customers list
                setCustomers(prev => [...prev, newCustomer])
                // Set as selected customer
                setSelectedCustomer(newCustomer)
                toast.success('Új ügyfél létrehozva')
              } else {
                console.error('Invalid customer response:', response)
                toast.warning('Ügyfél létrehozva, de nem sikerült hozzáadni a listához.')
              }
            } else {
              const errorData = await customerRes.json().catch(() => ({ error: 'Ismeretlen hiba' }))
              console.error('Failed to create customer:', errorData)
              toast.warning(`Ügyfél létrehozása sikertelen: ${errorData.error || errorData.message || 'Ismeretlen hiba'}. A rendelés mentése folytatódik.`)
            }
          }
        } catch (customerError: any) {
          console.error('Error creating customer:', customerError)
          toast.warning(`Hiba történt az ügyfél létrehozása során: ${customerError.message || 'Ismeretlen hiba'}. A rendelés mentése folytatódik.`)
        }
      }

      // Build customer_data object
      const customerData = {
        customer_id: selectedCustomer?.id || null,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_mobile: customerMobile || null,
        billing_name: billingName || null,
        billing_country: billingCountry || null,
        billing_city: billingCity || null,
        billing_postal_code: billingPostalCode || null,
        billing_street: billingStreet || null,
        billing_house_number: billingHouseNumber || null,
        billing_tax_number: billingTaxNumber || null,
        billing_company_reg_number: billingCompanyRegNumber || null
      }

      // Build discount object
      const discountData = {
        percentage: discountPercentage || 0,
        amount: discountAmount || 0
      }

      // Build items array
      // Track which items existed initially
      const initialItemIds = new Set(initialItems.map(item => item.id))
      
      // Find items that were deleted (existed in initialItems but not in current items)
      const deletedItemIds = initialItems
        .filter(initialItem => !items.find(item => item.id === initialItem.id))
        .map(item => item.id)
      
      // Build items payload
      const itemsPayload = items.map(item => {
        // Check if this is a new item (temp ID or not in initial items)
        const isNew = item.id.startsWith('temp-') || !initialItemIds.has(item.id)
        
        return {
          id: isNew ? null : item.id, // null for new items
          item_type: item.item_type,
          product_type: item.product_type || 'accessory',
          accessory_id: item.accessory_id || null,
          material_id: item.material_id || null,
          linear_material_id: item.linear_material_id || null,
          feetype_id: item.feetype_id || null,
          product_name: item.product_name,
          sku: item.sku || null,
          quantity: item.quantity,
          unit_price_net: item.unit_price_net,
          unit_price_gross: item.unit_price_gross,
          vat_id: item.vat_id,
          currency_id: item.currency_id,
          deleted: false
        }
      })
      
      // Add deleted items to payload
      deletedItemIds.forEach(deletedId => {
        const deletedItem = initialItems.find(item => item.id === deletedId)
        if (deletedItem) {
          itemsPayload.push({
            id: deletedItem.id,
            item_type: deletedItem.item_type,
            product_type: deletedItem.product_type || 'accessory',
            accessory_id: deletedItem.accessory_id || null,
            material_id: deletedItem.material_id || null,
            linear_material_id: deletedItem.linear_material_id || null,
            feetype_id: deletedItem.feetype_id || null,
            product_name: deletedItem.product_name,
            sku: deletedItem.sku || null,
            quantity: deletedItem.quantity,
            unit_price_net: deletedItem.unit_price_net,
            unit_price_gross: deletedItem.unit_price_gross,
            vat_id: deletedItem.vat_id,
            currency_id: deletedItem.currency_id,
            deleted: true
          })
        }
      })

      // Call API
      const res = await fetch(`/api/pos-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_data: customerData,
          discount: discountData,
          items: itemsPayload
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Hiba a mentés során')
      }

      // Update order state immediately without page reload
      // This allows invoice button to validate immediately after save
      if (data.order) {
        setOrder(prevOrder => ({
          ...prevOrder,
          ...data.order,
          billing_name: billingName || null,
          billing_country: billingCountry || null,
          billing_city: billingCity || null,
          billing_postal_code: billingPostalCode || null,
          billing_street: billingStreet || null,
          billing_house_number: billingHouseNumber || null,
          billing_tax_number: billingTaxNumber || null,
          billing_company_reg_number: billingCompanyRegNumber || null,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_mobile: customerMobile || null,
          discount_percentage: discountPercentage || 0,
          discount_amount: discountAmount || 0
        }))
      } else {
        // Fallback: update order state with current form values
        setOrder(prevOrder => ({
          ...prevOrder,
          billing_name: billingName || null,
          billing_country: billingCountry || null,
          billing_city: billingCity || null,
          billing_postal_code: billingPostalCode || null,
          billing_street: billingStreet || null,
          billing_house_number: billingHouseNumber || null,
          billing_tax_number: billingTaxNumber || null,
          billing_company_reg_number: billingCompanyRegNumber || null,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_mobile: customerMobile || null,
          discount_percentage: discountPercentage || 0,
          discount_amount: discountAmount || 0
        }))
      }

      toast.success('Mentés sikeres')
    } catch (error: any) {
      console.error('Error saving POS order:', error)
      toast.error(error.message || 'Hiba a mentés során')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TabContext value={tabValue}>
      <Box sx={{ p: 3 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={NextLink} href="/home" underline="hover" color="inherit">
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Kezdőlap
          </Link>
          <Link component={NextLink} href="/pos-orders" underline="hover" color="inherit">
            Értékesítés
          </Link>
          <Link component={NextLink} href="/pos-orders" underline="hover" color="inherit">
            Rendelések
          </Link>
          <Typography color="text.primary">{order.pos_order_number}</Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 3 }}>
          <CustomTabList pill="true" onChange={(_e, val) => setTabValue(val)} aria-label="pos order tabs">
            <Tab label="Szerkesztés" value="edit" />
            <Tab label="Számlák" value="invoices" />
          </CustomTabList>
        </Box>

        <TabPanel value="edit" sx={{ p: 0, pt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          POS rendelés: {order.pos_order_number}
        </Typography>
        <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ReceiptIcon />}
                onClick={() => setInvoiceModalOpen(true)}
                disabled={
                  !billingName ||
                  !billingCity ||
                  !billingPostalCode ||
                  !billingStreet ||
                  balance > 1
                }
              >
                Számlázás
              </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </Stack>
      </Box>

      <Stack spacing={3}>
        {/* Two column layout: 60-40 */}
        <Grid container spacing={3}>
          {/* Left column: 60% - Alap adatok */}
          <Grid item xs={12} md={7}>
            <Stack spacing={3}>
              {/* Alap adatok - Customer */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Alap adatok - Ügyfél
                  </Typography>
                  <Grid container spacing={2}>
                    {/* First row: Just customer name (full width) */}
                    <Grid item xs={12}>
                      <Autocomplete
                        fullWidth
                        size="small"
                        options={customers}
                        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                        value={selectedCustomer}
                        inputValue={customerName}
                        onInputChange={(event, newValue) => {
                          setCustomerName(newValue)
                          // If user clears the input, clear all customer and billing data
                          if (!newValue || newValue.trim() === '') {
                            setSelectedCustomer(null)
                            setCustomerEmail('')
                            setCustomerMobile('')
                            setBillingName('')
                            setBillingCountry('Magyarország')
                            setBillingCity('')
                            setBillingPostalCode('')
                            setBillingStreet('')
                            setBillingHouseNumber('')
                            setBillingTaxNumber('')
                            setBillingCompanyRegNumber('')
                          }
                        }}
                        onChange={handleCustomerChange}
                        freeSolo
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Ügyfél neve"
                            size="small"
                          />
                        )}
                      />
                    </Grid>
                    {/* Second row: Email and Mobile side by side */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="E-mail"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Telefonszám"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value)}
                        size="small"
                      />
                    </Grid>
                  </Grid>
          </CardContent>
        </Card>

              {/* Alap adatok - Billing */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Alap adatok - Számlázási adatok
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Számlázási név"
                        value={billingName}
                        onChange={(e) => setBillingName(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Ország"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Irányítószám"
                        value={billingPostalCode}
                        onChange={(e) => setBillingPostalCode(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Város"
                        value={billingCity}
                        onChange={(e) => setBillingCity(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Utca"
                        value={billingStreet}
                        onChange={(e) => setBillingStreet(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Házszám"
                        value={billingHouseNumber}
                        onChange={(e) => setBillingHouseNumber(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Adószám"
                        value={billingTaxNumber}
                        onChange={(e) => {
                          setTaxNumberFieldInteracted(true)
                          setBillingTaxNumber(e.target.value)
                        }}
                        onFocus={() => setTaxNumberFieldInteracted(true)}
                        size="small"
                        error={!!taxpayerValidationError}
                        helperText={
                          taxpayerValidating 
                            ? 'Ellenőrzés...' 
                            : taxpayerValidationError || 'Adószám megadása után automatikusan ellenőrizve és kitöltve lesznek a számlázási adatok'
                        }
                        InputProps={{
                          endAdornment: taxpayerValidating ? (
                            <InputAdornment position="end">
                              <CircularProgress size={20} />
                            </InputAdornment>
                          ) : null
                        }}
                        placeholder="12345678-1-23"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Cégjegyzékszám"
                        value={billingCompanyRegNumber}
                        onChange={(e) => setBillingCompanyRegNumber(e.target.value)}
                        size="small"
                      />
                    </Grid>
                  </Grid>
          </CardContent>
        </Card>
            </Stack>
          </Grid>

          {/* Right column: 40% - Rendelési adatok and Tranzakciók */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              {/* Rendelési adatok */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Rendelési adatok
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Rendelés szám:</strong>
                      </Typography>
                      <Typography variant="body1">
                        {order.pos_order_number}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Létrehozva:</strong>
                      </Typography>
                      <Typography variant="body2">
                        {formatDateTime(order.created_at)}
                      </Typography>
                    </Grid>
                    {selectedWorker && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Dolgozó:</strong>
                        </Typography>
                        <Chip
                          label={selectedWorker.nickname || selectedWorker.name}
                          sx={{
                            backgroundColor: selectedWorker.color || '#1976d2',
                            color: 'white',
                            fontWeight: 500
                          }}
                        />
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              {/* Tranzakciók */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tranzakciók
                  </Typography>
                  {payments.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell padding="none" size="small">Fizetési mód</TableCell>
                            <TableCell align="right" padding="none" size="small" sx={{ pr: 2 }}>Összeg</TableCell>
                            <TableCell padding="none" size="small" sx={{ pl: 2 }}>Dátum</TableCell>
                            <TableCell width={50} padding="none" size="small"></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {payments.map(payment => {
                            const isDeleted = !!payment.deleted_at
                            return (
                              <TableRow key={payment.id}>
                                <TableCell padding="none" size="small">
                                  <Chip
                                    label={payment.payment_type === 'cash' ? 'Készpénz' : 'Bankkártya'}
                                    size="small"
                                    color={payment.payment_type === 'cash' ? 'success' : 'primary'}
                                    sx={{
                                      textDecoration: isDeleted ? 'line-through' : 'none',
                                      opacity: isDeleted ? 0.6 : 1
                                    }}
                                  />
                                </TableCell>
                                <TableCell 
                                  align="right" 
                                  padding="none" 
                                  size="small"
                                  sx={{
                                    textDecoration: isDeleted ? 'line-through' : 'none',
                                    opacity: isDeleted ? 0.6 : 1,
                                    pr: 2
                                  }}
                                >
                                  {formatCurrency(Math.round(payment.amount))}
                                </TableCell>
                                <TableCell 
                                  padding="none" 
                                  size="small"
                                  sx={{
                                    textDecoration: isDeleted ? 'line-through' : 'none',
                                    opacity: isDeleted ? 0.6 : 1,
                                    pl: 2
                                  }}
                                >
                                  {formatDateTime(payment.created_at)}
                                </TableCell>
                                <TableCell padding="none" size="small">
                                  {!isDeleted && (
                                    <IconButton 
                                      size="small" 
                                      color="error"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemovePayment(payment.id)
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Nincs fizetés
                    </Typography>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      startIcon={<AddIcon />}
                      variant="outlined"
                      size="small"
                      fullWidth
                      onClick={handleAddPayment}
                      disabled={balance <= 0 || summary.totalGrossAfterDiscount <= totalPaid}
                    >
                      Fizetés hozzáadása
                    </Button>
                  </Box>
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Fizetve:</strong>
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(totalPaid)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Egyenleg:</strong>
                        </Typography>
                        <Typography variant="body2" color={balance > 0 ? 'error.main' : 'success.main'}>
                          {formatCurrency(balance)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {/* Full width cards */}
        {/* Tételek */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tételek
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Név</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">Mennyiség</TableCell>
                    <TableCell align="center">Egység</TableCell>
                    <TableCell align="right">Nettó egységár</TableCell>
                    <TableCell align="right">Bruttó egységár</TableCell>
                    <TableCell align="right">ÁFA</TableCell>
                    <TableCell align="right">Bruttó részösszeg</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.filter(item => item.item_type === 'product').map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2">{item.product_name}</Typography>
                        {item.product_type === 'accessory' && item.sku && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            SKU: {item.sku}
                          </Typography>
                        )}
                        {item.product_type === 'material' && 
                         item.length_mm != null && 
                         item.width_mm != null && 
                         item.thickness_mm != null && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {item.length_mm}×{item.width_mm}×{item.thickness_mm} mm
                          </Typography>
                        )}
                        {item.product_type === 'linear_material' && 
                         item.length != null && 
                         item.width != null && 
                         item.thickness != null && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {item.length}×{item.width}×{item.thickness} mm
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{item.product_type === 'accessory' ? (item.sku || '-') : '-'}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={item.quantity}
                          size="small"
                          sx={{ width: 80 }}
                          inputProps={{ step: 0.01, min: 0.01 }}
                          onChange={(e) => {
                            const newQty = parseFloat(e.target.value) || 0
                            handleItemQuantityChange(item.id, newQty)
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {item.product_type === 'material' ? 'm²' :
                         item.product_type === 'linear_material' ? 'm' :
                         item.unit?.shortform || item.unit?.name || '-'}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(item.unit_price_net)}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={Math.round(item.unit_price_gross)}
                          size="small"
                          sx={{ width: 100 }}
                          inputProps={{ step: 1 }}
                          onChange={(e) => {
                            const newPrice = Math.round(parseFloat(e.target.value) || 0)
                            handleItemPriceGrossChange(item.id, newPrice)
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(item.total_vat)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.total_gross)}</TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveItem(item.id)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {addingProduct && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Autocomplete
                          fullWidth
                          size="small"
                          options={productSearchResults}
                          getOptionLabel={(option) => option.name || ''}
                          filterOptions={(options) => options} // Disable client-side filtering - API already filters by name and SKU
                          loading={isSearchingProducts}
                          inputValue={productSearchTerm}
                          onInputChange={(event, newValue) => {
                            setProductSearchTerm(newValue)
                          }}
                          onChange={(event, newValue) => {
                            if (newValue) {
                              handleProductSelect(newValue)
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Keresés termék neve vagy SKU szerint..."
                              size="small"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {isSearchingProducts ? <CircularProgress size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                )
                              }}
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props
                            const getTypeLabel = () => {
                              switch (option.product_type) {
                                case 'accessory':
                                  return 'Kellék'
                                case 'material':
                                  return 'Bútorlap'
                                case 'linear_material':
                                  return 'Szálas termék'
                                default:
                                  return ''
                              }
                            }
                            const getTypeColor = () => {
                              switch (option.product_type) {
                                case 'accessory':
                                  return 'primary'
                                case 'material':
                                  return 'secondary'
                                case 'linear_material':
                                  return 'success'
                                default:
                                  return 'default'
                              }
                            }
                            const getDimensions = () => {
                              if (option.product_type === 'material') {
                                return `${option.length_mm}×${option.width_mm}×${option.thickness_mm} mm`
                              } else if (option.product_type === 'linear_material') {
                                return `${option.length}×${option.width}×${option.thickness} mm`
                              }
                              return null
                            }
                            return (
                              <Box component="li" key={key} {...otherProps}>
                                <Box sx={{ flex: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="body2">{option.name}</Typography>
                                    <Chip
                                      label={getTypeLabel()}
                                      size="small"
                                      color={getTypeColor() as any}
                                    />
                                  </Box>
                                  {option.product_type === 'material' && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {option.length_mm}×{option.width_mm}×{option.thickness_mm} mm
                                    </Typography>
                                  )}
                                  {option.product_type === 'linear_material' && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {option.length}×{option.width}×{option.thickness} mm
                                    </Typography>
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    {option.product_type === 'accessory' && option.sku && `SKU: ${option.sku} | `}
                                    Készlet: {option.quantity_on_hand} | {formatCurrency(option.gross_price)}
                                  </Typography>
                                </Box>
                              </Box>
                            )
                          }}
                          noOptionsText="Nincs találat"
                          open={productSearchTerm.trim().length >= 2}
                        />
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button size="small" onClick={handleCancelAddProduct}>
                            Mégse
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              sx={{ mt: 2 }}
              onClick={handleAddProduct}
              disabled={addingProduct}
            >
              Tétel hozzáadása
            </Button>
          </CardContent>
        </Card>

        {/* Díjak */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Díjak
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Név</TableCell>
                    <TableCell align="right">Nettó egységár</TableCell>
                    <TableCell align="right">Bruttó egységár</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.filter(item => item.item_type === 'fee').map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Autocomplete
                          size="small"
                          options={feeTypes}
                          getOptionLabel={(option) => option.name}
                          value={feeTypes.find(f => f.id === item.feetype_id) || null}
                          onChange={(event, newValue) => {
                            if (newValue) {
                              handleFeeNameChange(item.id, newValue.id)
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              size="small"
                              sx={{ width: 200 }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={item.unit_price_net}
                          disabled
                          size="small"
                          sx={{ 
                            width: 100,
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
                              color: 'rgba(0, 0, 0, 0.87)',
                              backgroundColor: 'transparent'
                            },
                            '& .MuiInputBase-root.Mui-disabled': {
                              backgroundColor: 'transparent'
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={Math.round(item.unit_price_gross)}
                          size="small"
                          sx={{ width: 100 }}
                          inputProps={{ step: 1 }}
                          onChange={(e) => {
                            const newPrice = Math.round(parseFloat(e.target.value) || 0)
                            handleItemPriceGrossChange(item.id, newPrice)
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveItem(item.id)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              sx={{ mt: 2 }}
              onClick={handleAddFee}
            >
              Díj hozzáadása
            </Button>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Összesítés
            </Typography>
            <Grid container spacing={2}>
              {/* Before discount section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Kedvezmény nélkül:
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nettó összesen kedvezmény nélkül
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary.totalNetBeforeDiscount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    ÁFA összesen kedvezmény nélkül
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary.totalVatBeforeDiscount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Bruttó összesen kedvezmény nélkül
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary.totalGrossBeforeDiscount)}
                  </Typography>
                </Box>
              </Grid>

              {/* Discount section */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Kedvezmény:
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Kedvezmény %"
                  type="number"
                  value={discountPercentage}
                  onChange={(e) => {
                    const percent = parseFloat(e.target.value) || 0
                    setDiscountPercentage(percent)
                    // Recalculate discount amount
                    const newAmount = (summary.totalGrossBeforeDiscount * percent) / 100
                    setDiscountAmount(newAmount)
                  }}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Kedvezmény összeg"
                  value={formatCurrency(discountAmount)}
                  disabled
                  size="small"
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
                      color: 'rgba(0, 0, 0, 0.87)',
                      backgroundColor: 'transparent'
                    },
                    '& .MuiInputBase-root.Mui-disabled': {
                      backgroundColor: 'transparent'
                    }
                  }}
                />
              </Grid>

              {/* After discount section */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Kedvezmény után:
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: 1, borderColor: 'grey.300' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Nettó összesen
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(summary.totalNetAfterDiscount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: 1, borderColor: 'grey.300' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    ÁFA összesen
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(summary.totalVatAfterDiscount)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, bgcolor: 'primary.lighter', borderRadius: 1, border: 1, borderColor: 'primary.main' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Bruttó összesen
                  </Typography>
                  <Typography variant="h5" color="primary.main" fontWeight="bold">
                    {formatCurrency(summary.totalGrossAfterDiscount)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

      </Stack>

        </TabPanel>

        <TabPanel value="invoices" sx={{ p: 0, pt: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Számlák</Typography>
          </Stack>

          {invoicesLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : invoices.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Nincs számla ehhez a rendeléshez.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Számla azonosító</TableCell>
                    <TableCell>Számla ID</TableCell>
                    <TableCell>Számla típusa</TableCell>
                    <TableCell>Fizetési határidő</TableCell>
                    <TableCell>Teljesítési dátum</TableCell>
                    <TableCell>Bruttó összeg</TableCell>
                    <TableCell>Fizetési állapot</TableCell>
                    <TableCell align="right">Műveletek</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.internal_number}</TableCell>
                      <TableCell>{inv.provider_invoice_number || '-'}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>
                        {inv.invoice_type ? (
                          <Chip
                            label={
                              inv.invoice_type === 'szamla'
                                ? 'Számla'
                                : inv.invoice_type === 'sztorno'
                                ? 'Sztornó'
                                : inv.invoice_type
                            }
                            size="small"
                            color={inv.invoice_type === 'sztorno' ? 'error' : 'primary'}
                            variant="outlined"
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{inv.payment_due_date || '-'}</TableCell>
                      <TableCell>{inv.fulfillment_date || '-'}</TableCell>
                      <TableCell>{inv.gross_total != null ? formatCurrency(Number(inv.gross_total)) : '-'}</TableCell>
                      <TableCell>
                        {inv.payment_status ? (
                          <Chip
                            label={
                              inv.payment_status === 'nem_lesz_fizetve'
                                ? 'Nem lesz fizetve'
                                : inv.payment_status === 'fizetve'
                                ? 'Fizetve'
                                : inv.payment_status === 'fizetesre_var'
                                ? 'Fizetésre vár'
                                : inv.payment_status
                            }
                            size="small"
                            color={
                              inv.payment_status === 'fizetve'
                                ? 'success'
                                : inv.payment_status === 'fizetesre_var'
                                ? 'warning'
                                : 'default'
                            }
                            variant="outlined"
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Sztornó számla">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={inv.invoice_type === 'sztorno'}
                                onClick={() => handleOpenStornoDialog(inv)}
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
                                onClick={() => handleOpenInvoicePdf(inv)}
                                disabled={!inv.pdf_url}
                              >
                                <PictureAsPdfIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Fizetés hozzáadása</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl component="fieldset">
              <Typography variant="body2" gutterBottom>
                Fizetési mód
              </Typography>
              <RadioGroup
                value={newPaymentType}
                onChange={(e) => setNewPaymentType(e.target.value as 'cash' | 'card')}
                row
              >
                <FormControlLabel value="cash" control={<Radio />} label="Készpénz" />
                <FormControlLabel value="card" control={<Radio />} label="Bankkártya" />
              </RadioGroup>
            </FormControl>
            <TextField
              fullWidth
              label="Összeg"
              type="number"
              value={newPaymentAmount}
              onChange={(e) => {
                const amount = parseFloat(e.target.value) || 0
                setNewPaymentAmount(amount)
              }}
              helperText={`Tartozás: ${formatCurrency(summary.totalGrossAfterDiscount - totalPaid)}`}
              inputProps={{ step: 1, min: 0, max: summary.totalGrossAfterDiscount - totalPaid }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentModalOpen(false)}>Mégse</Button>
          <Button 
            onClick={handleConfirmNewPayment} 
            variant="contained"
            disabled={newPaymentAmount <= 0 || newPaymentAmount > (summary.totalGrossAfterDiscount - totalPaid)}
          >
            Hozzáadás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice Modal */}
      <InvoiceModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        order={order}
        items={items}
        tenantCompany={tenantCompany}
        vatRates={vatRates}
      />
      
      {/* Sztornó megerősítés */}
      <Dialog open={stornoDialogOpen} onClose={handleCloseStornoDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Sztornó számla</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan létrehozod a sztornó számlát a következő számlához?
          </Typography>
          <Typography sx={{ mt: 1 }} fontWeight="bold">
            {stornoTarget?.provider_invoice_number || '-'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStornoDialog}>Mégse</Button>
          <Button color="error" variant="contained" onClick={handleConfirmStorno}>
            Sztornó létrehozása
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </TabContext>
  )
}

