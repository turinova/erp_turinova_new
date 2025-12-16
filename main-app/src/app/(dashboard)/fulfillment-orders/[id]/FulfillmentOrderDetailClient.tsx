'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
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
  Typography,
  Autocomplete,
  Tooltip,
  Alert
} from '@mui/material'
import TabPanel from '@mui/lab/TabPanel'
import TabContext from '@mui/lab/TabContext'
import CustomTabList from '@core/components/mui/TabList'
import NextLink from 'next/link'
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, Add as AddIcon, CheckCircle as CheckCircleIcon, Info as InfoIcon, Receipt as ReceiptIcon, PictureAsPdf as PictureAsPdfIcon, Undo as UndoIcon } from '@mui/icons-material'
import InvoiceModal from './InvoiceModal'
import { toast } from 'react-toastify'

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

interface CustomerOrderItem {
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
  units_id: string | null
  total_net: number
  total_vat: number
  total_gross: number
  status: string
  purchase_order_item_id: string | null
  partner_id: string | null
  partners?: { id: string; name: string } | null
  megjegyzes?: string | null
}

interface CustomerOrderPayment {
  id: string
  payment_type: 'cash' | 'card'
  amount: number
  status: string
  created_at: string
  deleted_at: string | null
}

interface CustomerOrder {
  id: string
  order_number: string
  worker_id: string
  worker_nickname: string
  worker_color: string
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
  sms_sent_at: string | null
}

interface Partner {
  id: string
  name: string
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

interface FulfillmentOrderDetailClientProps {
  id: string
  initialOrder: CustomerOrder
  initialItems: CustomerOrderItem[]
  initialPayments: CustomerOrderPayment[]
  initialTotalPaid: number
  initialBalance: number
  initialCustomers: Customer[]
  initialVatRates: VatRate[]
  initialCurrencies: Currency[]
  initialUnits: Unit[]
  initialWorkers: Worker[]
  initialFeeTypes: FeeType[]
  initialPartners: Partner[]
  initialTenantCompany: TenantCompany | null
}

export default function FulfillmentOrderDetailClient({
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
  initialPartners,
  initialTenantCompany
}: FulfillmentOrderDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Tabs
  const [tabValue, setTabValue] = useState('edit')
  
  // Invoice modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  
  // Invoices tab state
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false)
  const [stornoTarget, setStornoTarget] = useState<any | null>(null)

  // Order state
  const [order, setOrder] = useState<CustomerOrder>(initialOrder)
  const [items, setItems] = useState<CustomerOrderItem[]>(initialItems)
  const [payments, setPayments] = useState<CustomerOrderPayment[]>(initialPayments)

  // Product picker state (add item)
  const [addingProduct, setAddingProduct] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const productSearchAbortControllerRef = useRef<AbortController | null>(null)

  // Note editing state
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  // Search products for adding new item (immediate add)
  useEffect(() => {
    if (productSearchAbortControllerRef.current) {
      productSearchAbortControllerRef.current.abort()
    }

    const term = productSearchTerm.trim()
    if (term.length < 2) {
      setProductSearchResults([])
      setIsSearchingProducts(false)
      return
    }

    const abortController = new AbortController()
    productSearchAbortControllerRef.current = abortController
    setIsSearchingProducts(true)

    const t = setTimeout(() => {
      fetch(`/api/shoporder/search?q=${encodeURIComponent(term)}`, { signal: abortController.signal })
        .then(res => {
          if (!res.ok) return { materials: [], linearMaterials: [], accessories: [] }
          return res.json()
        })
        .then(data => {
          if (abortController.signal.aborted) return

          const allResults = [
            ...(data.materials || []),
            ...(data.linearMaterials || []),
            ...(data.accessories || [])
          ]

          const mapped = allResults.map((item: any) => {
            let product_type: 'accessory' | 'material' | 'linear_material' = 'accessory'
            let accessory_id: string | null = null
            let material_id: string | null = null
            let linear_material_id: string | null = null

            if (item.source === 'materials') {
              product_type = 'material'
              material_id = item.id
            } else if (item.source === 'linear_materials') {
              product_type = 'linear_material'
              linear_material_id = item.id
            } else {
              product_type = 'accessory'
              accessory_id = item.id
            }

            return {
              ...item,
              product_type,
              accessory_id,
              material_id,
              linear_material_id
            }
          })

          setProductSearchResults(mapped)
          setIsSearchingProducts(false)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.error('Error searching products:', err)
          setProductSearchResults([])
          setIsSearchingProducts(false)
        })
    }, 300)

    return () => {
      clearTimeout(t)
      if (productSearchAbortControllerRef.current) {
        productSearchAbortControllerRef.current.abort()
        productSearchAbortControllerRef.current = null
      }
    }
  }, [productSearchTerm])
  const initialActivePayments = initialPayments.filter(p => !p.deleted_at)
  const initialActiveTotalPaid = initialActivePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const [totalPaid, setTotalPaid] = useState(initialActiveTotalPaid)
  
  // Calculate initial balance from summary
  const initialSummary = useMemo(() => {
    const products = initialItems.filter(item => item.item_type === 'product')
    const fees = initialItems.filter(item => item.item_type === 'fee')
    
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

  // Debounced search term for products
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300)
  const debouncedTaxNumber = useDebounce(billingTaxNumber, 800) // Longer delay for taxpayer queries
  
  // Query taxpayer data when tax number changes
  const taxpayerAbortControllerRef = useRef<AbortController | null>(null)

  // References
  const [customers] = useState<Customer[]>(initialCustomers)
  const [vatRates] = useState<VatRate[]>(initialVatRates)
  const [currencies] = useState<Currency[]>(initialCurrencies)
  const [units] = useState<Unit[]>(initialUnits)
  const [workers] = useState<Worker[]>(initialWorkers)
  const [feeTypes] = useState<FeeType[]>(initialFeeTypes)
  const [partners] = useState<Partner[]>(initialPartners)
  const [tenantCompany] = useState<TenantCompany | null>(initialTenantCompany)

  // Worker state
  const [workerId] = useState(initialOrder.worker_id)
  const selectedWorker = workers.find(w => w.id === workerId)

  // Discount state
  const [discountPercentage, setDiscountPercentage] = useState(initialOrder.discount_percentage)
  const [discountAmount, setDiscountAmount] = useState(initialOrder.discount_amount)

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [newPaymentType, setNewPaymentType] = useState<'cash' | 'card'>('cash')
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0)

  // Taxpayer validation state
  const [taxpayerValidating, setTaxpayerValidating] = useState(false)
  const [taxpayerValidationError, setTaxpayerValidationError] = useState<string | null>(null)
  const [taxNumberFieldInteracted, setTaxNumberFieldInteracted] = useState(false)

  // Delete item modal state
  const [deleteItemModalOpen, setDeleteItemModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

  // Calculate summary from items
  const summary = useMemo(() => {
    const products = items.filter(item => item.item_type === 'product')
    const fees = items.filter(item => item.item_type === 'fee')
    
    const itemsNet = products.reduce((sum, item) => sum + Number(item.total_net || 0), 0)
    const itemsVat = products.reduce((sum, item) => sum + Number(item.total_vat || 0), 0)
    const itemsGross = products.reduce((sum, item) => sum + Number(item.total_gross || 0), 0)
    
    const feesNet = fees.reduce((sum, item) => sum + Number(item.total_net || 0), 0)
    const feesVat = fees.reduce((sum, item) => sum + Number(item.total_vat || 0), 0)
    const feesGross = fees.reduce((sum, item) => sum + Number(item.total_gross || 0), 0)
    
    // Totals before discount
    const totalNetBeforeDiscount = itemsNet + feesNet
    const totalVatBeforeDiscount = itemsVat + feesVat
    const totalGrossBeforeDiscount = itemsGross + feesGross
    
    // Apply discount to gross total
    const discountAmountValue = Number(discountAmount) || 0
    const totalGrossAfterDiscount = totalGrossBeforeDiscount - discountAmountValue
    
    // Calculate net and VAT after discount proportionally
    const discountRatio = totalGrossBeforeDiscount > 0 ? discountAmountValue / totalGrossBeforeDiscount : 0
    const totalNetAfterDiscount = totalNetBeforeDiscount * (1 - discountRatio)
    const totalVatAfterDiscount = totalVatBeforeDiscount * (1 - discountRatio)
    
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
  }, [items, discountAmount])

  // Handle customer selection
  const handleCustomerChange = (event: React.SyntheticEvent, newValue: string | Customer | null, reason?: string) => {
    if (typeof newValue === 'string') {
      // User typed a new customer name
      setSelectedCustomer(null)
      setCustomerName(newValue)
      return
    }
    if (newValue && typeof newValue === 'object') {
      setSelectedCustomer(newValue)
      setCustomerName(newValue.name)
      setCustomerEmail(newValue.email || '')
      setCustomerMobile(newValue.mobile || '')
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

  // Query taxpayer data when tax number changes
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
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
  const recalculateItem = (item: CustomerOrderItem, newQuantity?: number, newUnitPriceGross?: number): CustomerOrderItem => {
    const quantity = newQuantity !== undefined ? newQuantity : item.quantity
    const unitPriceGross = newUnitPriceGross !== undefined ? newUnitPriceGross : item.unit_price_gross
    
    const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
    const unitPriceNet = unitPriceGross / (1 + vatRate / 100)
    
    const totalNet = unitPriceNet * quantity
    const totalGross = unitPriceGross * quantity
    const totalVat = totalGross - totalNet
    
    return {
      ...item,
      quantity,
      unit_price_net: Math.round(unitPriceNet),
      unit_price_gross: Math.round(unitPriceGross),
      total_net: Math.round(totalNet),
      total_vat: Math.round(totalVat),
      total_gross: Math.round(totalGross)
    }
  }

  // Update item quantity (only if status is 'open')
  const handleItemQuantityChange = (itemId: string, newQuantity: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item || item.status !== 'open') {
      toast.warning('Csak nyitott státuszú tételek módosíthatók')
      return
    }
    
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? recalculateItem(item, newQuantity) : item
    ))
  }

  // Update item unit price gross (only if status is 'open')
  const handleItemPriceGrossChange = (itemId: string, newPrice: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item || item.status !== 'open') {
      toast.warning('Csak nyitott státuszú tételek módosíthatók')
      return
    }
    
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item
      return recalculateItem(item, undefined, newPrice)
    }))
  }

  // Update item partner (only if status is 'open')
  const handlePartnerChange = async (itemId: string, newPartnerId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || item.status !== 'open') {
      toast.warning('Csak nyitott státuszú tételek módosíthatók')
      return
    }

    try {
      const res = await fetch(`/api/customer-order-items/${itemId}/partner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: newPartnerId || null })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Hiba a beszállító frissítésekor')
      }

      // Update local state
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId 
          ? { ...item, partner_id: newPartnerId || null, partners: newPartnerId ? partners.find(p => p.id === newPartnerId) || null : null }
          : item
      ))

      toast.success('Beszállító frissítve')
    } catch (err: any) {
      console.error('Error updating partner:', err)
      toast.error(err?.message || 'Hiba a beszállító frissítésekor')
    }
  }

  // Handle note icon click - open editor
  const handleNoteIconClick = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (item) {
      setEditingNoteItemId(itemId)
      setNoteDrafts(prev => ({
        ...prev,
        [itemId]: item.megjegyzes || ''
      }))
    }
  }

  // Handle note save
  const handleNoteSave = async (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || item.status !== 'open') {
      toast.warning('Csak nyitott státuszú tételek módosíthatók')
      setEditingNoteItemId(null)
      return
    }

    const noteText = noteDrafts[itemId] || ''

    try {
      const res = await fetch(`/api/customer-order-items/${itemId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ megjegyzes: noteText.trim() || null })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Hiba a megjegyzés frissítésekor')
      }

      // Update local state
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId 
          ? { ...item, megjegyzes: noteText.trim() || null }
          : item
      ))

      setEditingNoteItemId(null)
      toast.success('Megjegyzés frissítve')
    } catch (err: any) {
      console.error('Error updating note:', err)
      toast.error(err?.message || 'Hiba a megjegyzés frissítésekor')
    }
  }

  // Handle note cancel
  const handleNoteCancel = (itemId: string) => {
    setEditingNoteItemId(null)
    setNoteDrafts(prev => {
      const newDrafts = { ...prev }
      delete newDrafts[itemId]
      return newDrafts
    })
  }

  // Start adding product
  const handleAddProductClick = () => {
    setAddingProduct(true)
    setProductSearchTerm('')
    setProductSearchResults([])
  }

  // Handle product select from autocomplete (immediate add)
  const handleProductSelect = async (selectedProduct: any) => {
    if (!selectedProduct) return
    if (order.status !== 'open') {
      toast.warning('Csak nyitott rendeléshez adható tétel.')
      return
    }

    try {
      const vatPercent = selectedProduct.vat_percent || 0
      const vatMultiplier = 1 + vatPercent / 100
      const base = selectedProduct.base_price || 0
      const mult = selectedProduct.multiplier || 1.38

      // Whole-item pricing (matches shoporder behavior)
      const unitNet = Math.round(base * mult)
      const roundedUnitGross = Math.round(unitNet * vatMultiplier)
      const quantity = 1
      const totalGross = Math.round(roundedUnitGross * quantity)
      const totalNet = Math.round(unitNet * quantity)
      const totalVat = totalGross - totalNet

      const payload = {
        product_type: selectedProduct.product_type || 'accessory',
        accessory_id: selectedProduct.accessory_id || null,
        material_id: selectedProduct.material_id || null,
        linear_material_id: selectedProduct.linear_material_id || null,
        product_name: selectedProduct.name,
        sku: selectedProduct.sku || null,
        quantity,
        unit_price_gross: roundedUnitGross,
        vat_id: selectedProduct.vat_id,
        currency_id: selectedProduct.currency_id,
        units_id: selectedProduct.units_id || null,
        partner_id: selectedProduct.partners_id || selectedProduct.partner_id || null,
        // Client-side preview values (server will recalc)
        unit_price_net: unitNet,
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross
      }

      const res = await fetch(`/api/customer-orders/${order.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Hiba a tétel hozzáadásakor')
      }

      const data = await res.json()
      if (data?.item) {
        setItems(prev => [...prev, data.item])
        toast.success('Tétel hozzáadva')
      }
    } catch (err: any) {
      console.error('Error adding item:', err)
      toast.error(err?.message || 'Hiba a tétel hozzáadásakor')
    } finally {
      setAddingProduct(false)
      setProductSearchTerm('')
      setProductSearchResults([])
    }
  }

  // Soft delete item (allowed in any status, with proper stock movement reversal)
  const handleDeleteItemClick = (itemId: string) => {
    setItemToDelete(itemId)
    setDeleteItemModalOpen(true)
  }

  const handleDeleteItemConfirm = async () => {
    if (!itemToDelete) return
    
    setDeleteItemModalOpen(false)
    const itemId = itemToDelete
    setItemToDelete(null)

    try {
      const res = await fetch('/api/customer-order-items/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: [itemId] })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Hiba a törlés során')
      }

      // Remove item from local state
      setItems(prevItems => prevItems.filter(i => i.id !== itemId))
      
      toast.success('Tétel törölve')
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting item:', error)
      toast.error(error.message || 'Hiba történt a törlés során')
    }
  }

  // Soft delete payment
  const handleRemovePayment = async (paymentId: string) => {
    const paymentToRemove = payments.find(p => p.id === paymentId)
    if (!paymentToRemove || paymentToRemove.deleted_at) return

    try {
      const res = await fetch(`/api/customer-orders/${id}/payments/${paymentId}`, {
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
      const res = await fetch(`/api/customer-orders/${id}/payments`, {
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
      const newPayment: CustomerOrderPayment = {
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
      // Build customer_data object
      const customerData = {
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

      // Build items array - only include items that were modified (status='open')
      const itemsPayload = items.map(item => {
        return {
          id: item.id,
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

      // Call API
      const res = await fetch(`/api/customer-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_data: customerData,
          discount: discountData,
          items: itemsPayload,
          summary: {
            totalNetAfterDiscount: summary.totalNetAfterDiscount,
            totalVatAfterDiscount: summary.totalVatAfterDiscount,
            totalGrossAfterDiscount: summary.totalGrossAfterDiscount
          },
          vat_rates: vatRates
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Hiba a mentés során')
      }

      toast.success('Mentés sikeres')
      
      // Update order state with saved data (same as POS orders)
      setOrder(prevOrder => ({
        ...prevOrder,
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
        billing_company_reg_number: billingCompanyRegNumber || null,
        discount_percentage: discountPercentage || 0,
        discount_amount: discountAmount || 0
      }))
      
      // Refresh page data
      router.refresh()
    } catch (error: any) {
      console.error('Error saving customer order:', error)
      toast.error(error.message || 'Hiba a mentés során')
    } finally {
      setSaving(false)
    }
  }

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Nyitott', color: 'warning' as const }
      case 'in_po':
        return { label: 'Beszerzés alatt', color: 'info' as const }
      case 'ordered':
        return { label: 'Rendelve', color: 'info' as const }
      case 'arrived':
        return { label: 'Megérkezett', color: 'success' as const }
      case 'finished':
        return { label: 'Befejezve', color: 'success' as const }
      case 'handed_over':
        return { label: 'Átadva', color: 'primary' as const }
      case 'cancelled':
        return { label: 'Törölve', color: 'error' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Invoices tab handlers
  const loadInvoices = async () => {
    setInvoicesLoading(true)
    try {
      const res = await fetch(`/api/customer-orders/${id}/invoices`)
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
  }

  useEffect(() => {
    if (tabValue === 'invoices') {
      loadInvoices()
    }
  }, [tabValue, id])

  // Reload invoices when invoice modal closes
  useEffect(() => {
    if (!invoiceModalOpen && tabValue === 'invoices') {
      loadInvoices()
    }
  }, [invoiceModalOpen, tabValue])

  const handleOpenStornoDialog = (invoice: any) => {
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
      const res = await fetch(`/api/customer-orders/${id}/storno-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerInvoiceNumber: stornoTarget.provider_invoice_number })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Hiba a művelet során')
      }
      toast.success(stornoTarget.invoice_type === 'dijbekero' ? 'Díjbekérő sikeresen törölve' : 'Sztornó számla sikeresen létrehozva')
      handleCloseStornoDialog()
      await loadInvoices()
    } catch (err: any) {
      console.error('Error creating storno invoice:', err)
      toast.error(err.message || 'Hiba a művelet során')
    } finally {
      setInvoicesLoading(false)
    }
  }

  const handleOpenInvoicePdf = (invoice: any) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank', 'noopener')
    } else {
      toast.info('Nincs PDF elérési út ehhez a számlához')
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
          <Link component={NextLink} href="/fulfillment-orders" underline="hover" color="inherit">
            Értékesítés
          </Link>
          <Link component={NextLink} href="/fulfillment-orders" underline="hover" color="inherit">
            Ügyfél rendelések
          </Link>
          <Typography color="text.primary">{order.order_number}</Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 3 }}>
          <CustomTabList pill="true" onChange={(_e, val) => setTabValue(val)} aria-label="fulfillment order tabs">
            <Tab label="Szerkesztés" value="edit" />
            <Tab label="Számlák" value="invoices" />
          </CustomTabList>
        </Box>

        <TabPanel value="edit" sx={{ p: 0, pt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">
              Ügyfél rendelés: {order.order_number}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ReceiptIcon />}
                onClick={() => setInvoiceModalOpen(true)}
                disabled={
                  !order.customer_name ||
                  !order.billing_name ||
                  !order.billing_country ||
                  !order.billing_postal_code ||
                  !order.billing_city ||
                  !order.billing_street ||
                  !order.billing_house_number
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
        <Grid container spacing={3} alignItems="flex-start">
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
                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        fullWidth
                        size="small"
                        options={customers}
                        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                        value={selectedCustomer}
                        inputValue={customerName}
                        onInputChange={(event, newValue) => {
                          setCustomerName(newValue)
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
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Telefon"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value)}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Számlázási adatok */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Számlázási adatok
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
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Ország"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
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
                        label="Irányítószám"
                        value={billingPostalCode}
                        onChange={(e) => setBillingPostalCode(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Utca"
                        value={billingStreet}
                        onChange={(e) => setBillingStreet(e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
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
                        {order.order_number}
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
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Státusz:</strong>
                      </Typography>
                      <Chip
                        label={getStatusInfo(order.status).label}
                        color={getStatusInfo(order.status).color}
                        size="small"
                      />
                    </Grid>
                    {order.sms_sent_at && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>SMS értesítés:</strong>
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                          <Typography variant="body2">
                            {formatDateTime(order.sms_sent_at)}
                          </Typography>
                        </Box>
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
                                  {formatCurrency(payment.amount)}
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

          {/* Full width cards */}
          {/* Tételek */}
          <Grid item xs={12}>
            <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tételek
            </Typography>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1200 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Beszállító</TableCell>
                    <TableCell>Név</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Státusz</TableCell>
                    <TableCell align="right">Mennyiség</TableCell>
                    <TableCell align="right">Nettó egységár</TableCell>
                    <TableCell align="right">Bruttó egységár</TableCell>
                    <TableCell align="right">ÁFA</TableCell>
                    <TableCell align="right">Bruttó részösszeg</TableCell>
                    <TableCell>Megjegyzés</TableCell>
                    <TableCell>Művelet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.filter(item => item.item_type === 'product').map(item => {
                    const canEdit = item.status === 'open'
                    const statusInfo = getStatusInfo(item.status)
                    const currentPartner = partners.find(p => p.id === item.partner_id)
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow>
                        <TableCell>
                          <Select
                            value={item.partner_id || ''}
                            onChange={(e) => handlePartnerChange(item.id, e.target.value)}
                            disabled={!canEdit}
                            size="small"
                            displayEmpty
                            sx={{ minWidth: 150 }}
                            MenuProps={{
                              PaperProps: {
                                style: {
                                  maxHeight: 300,
                                  width: 250,
                                },
                              },
                            }}
                          >
                            <MenuItem value="">
                              <em>-</em>
                            </MenuItem>
                            {partners.map((partner) => (
                              <MenuItem key={partner.id} value={partner.id}>
                                {partner.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {item.product_name?.replace(/\s*\([^)]*\)\s*$/, '') || item.product_name}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.product_type === 'accessory' ? (item.sku || '-') : '-'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={statusInfo.label} 
                            size="small"
                            color={statusInfo.color}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={item.quantity}
                            size="small"
                            sx={{ width: 80 }}
                            disabled={!canEdit}
                            onChange={(e) => {
                              const newQty = parseFloat(e.target.value) || 0
                              handleItemQuantityChange(item.id, newQty)
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(item.unit_price_net)}</TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={Math.round(item.unit_price_gross)}
                            size="small"
                            sx={{ width: 100 }}
                            inputProps={{ step: 1 }}
                            disabled={!canEdit}
                            onChange={(e) => {
                              const newPrice = Math.round(parseFloat(e.target.value) || 0)
                              handleItemPriceGrossChange(item.id, newPrice)
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(item.total_vat)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.total_gross)}</TableCell>
                        <TableCell>
                          <Tooltip title={item.megjegyzes || 'Kattintson a megjegyzés hozzáadásához'} arrow placement="top">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNoteIconClick(item.id)
                              }}
                              sx={{ p: 0.5 }}
                            >
                              <InfoIcon fontSize="small" color="primary" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Tétel törlése">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteItemClick(item.id)
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                      {editingNoteItemId === item.id && (
                        <TableRow>
                          <TableCell colSpan={11} sx={{ py: 2, bgcolor: 'grey.50' }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                              <TextField
                                fullWidth
                                multiline
                                rows={3}
                                size="small"
                                label="Megjegyzés"
                                value={noteDrafts[item.id] || ''}
                                onChange={(e) => setNoteDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Adja meg a megjegyzést..."
                              />
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleNoteSave(item.id)}
                                sx={{ mt: 0.5 }}
                              >
                                Mentés
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleNoteCancel(item.id)}
                                sx={{ mt: 0.5 }}
                              >
                                Mégse
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    )
                  })}
                  {addingProduct && (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <Autocomplete
                          fullWidth
                          size="small"
                          options={productSearchResults}
                          getOptionLabel={(option) => option.name || ''}
                          filterOptions={(options) => options} // server-side filtering
                          loading={isSearchingProducts}
                          inputValue={productSearchTerm}
                          onInputChange={(_, newValue) => setProductSearchTerm(newValue)}
                          onChange={(_, newValue) => {
                            if (newValue) {
                              handleProductSelect(newValue)
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Keresés termék név vagy SKU szerint..."
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
                            const typeLabel = option.product_type === 'material'
                              ? 'Bútorlap'
                              : option.product_type === 'linear_material'
                                ? 'Szálas termék'
                                : 'Kellék'
                            const dimensions = option.dimensions
                              || (option.product_type === 'material' && option.length_mm && option.width_mm && option.thickness_mm
                                ? `${option.length_mm}×${option.width_mm}×${option.thickness_mm} mm`
                                : undefined)
                              || (option.product_type === 'linear_material' && option.length && option.width && option.thickness
                                ? `${option.length}×${option.width}×${option.thickness} mm`
                                : undefined)
                            return (
                              <Box component="li" key={key} {...otherProps}>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {option.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {`SKU: ${option.sku || '-'} | Típus: ${typeLabel}`}
                                  </Typography>
                                  {option.brand_name && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      Márka: {option.brand_name}
                                    </Typography>
                                  )}
                                  {dimensions && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      Méret: {dimensions}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            )
                          }}
                          noOptionsText="Nincs találat"
                          open={productSearchTerm.trim().length >= 2}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {items.filter(item => item.item_type === 'fee').map(item => (
                    <TableRow key={item.id}>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.product_name}</Typography>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right">{formatCurrency(item.unit_price_net)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.unit_price_gross)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.total_vat)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.total_gross)}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
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
              onClick={handleAddProductClick}
              disabled={order.status !== 'open' || addingProduct}
            >
              Tétel hozzáadása
            </Button>
          </CardContent>
            </Card>
          </Grid>

          {/* Summary */}
          <Grid item xs={12}>
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
          </Grid>
        </Grid>

      </Stack>

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

      {/* Delete Item Confirmation Modal */}
      <Dialog
        open={deleteItemModalOpen}
        onClose={() => {
          setDeleteItemModalOpen(false)
          setItemToDelete(null)
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Tétel törlése</DialogTitle>
        <DialogContent>
          {(() => {
            const item = itemToDelete ? items.find(i => i.id === itemToDelete) : null
            if (!item) return null

            return (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Ez a művelet visszavonhatatlan!
                </Alert>
                <Typography variant="body1" gutterBottom>
                  Biztosan törölni szeretnéd ezt a tételt?
                </Typography>
                {(item.status === 'handed_over' || item.status === 'arrived') && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {item.status === 'handed_over' && (
                        <>A tétel <strong>átadva</strong> státuszú - a készlet visszakerül a raktárba.</>
                      )}
                      {item.status === 'arrived' && (
                        <>A tétel <strong>megérkezett</strong> státuszú - a foglalás törlődik.</>
                      )}
                    </Typography>
                  </Box>
                )}
              </>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => {
              setDeleteItemModalOpen(false)
              setItemToDelete(null)
            }}
            variant="outlined"
            size="large"
          >
            Mégse
          </Button>
          <Button
            onClick={handleDeleteItemConfirm}
            variant="contained"
            color="error"
            size="large"
            startIcon={<DeleteIcon />}
          >
            Törlés
          </Button>
        </DialogActions>
      </Dialog>
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
                  {invoices.map((inv: any) => {
                    const isDeleted = !!inv.deleted_at
                    return (
                      <TableRow 
                        key={inv.id}
                        sx={{
                          opacity: isDeleted ? 0.6 : 1,
                          textDecoration: isDeleted ? 'line-through' : 'none'
                        }}
                      >
                        <TableCell>{inv.internal_number}</TableCell>
                        <TableCell>{inv.provider_invoice_number || '-'}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {inv.invoice_type ? (
                              <Chip
                                label={
                                  inv.invoice_type === 'szamla'
                                    ? 'Számla'
                                    : inv.invoice_type === 'elolegszamla'
                                    ? 'Előleg számla'
                                    : inv.invoice_type === 'dijbekero'
                                    ? 'Díjbekérő'
                                    : inv.invoice_type === 'sztorno'
                                    ? 'Sztornó'
                                    : inv.invoice_type
                                }
                                size="small"
                                color={
                                  inv.invoice_type === 'sztorno' 
                                    ? 'error' 
                                    : inv.invoice_type === 'elolegszamla' 
                                    ? 'warning' 
                                    : inv.invoice_type === 'dijbekero'
                                    ? 'info'
                                    : 'primary'
                                }
                                variant="outlined"
                              />
                            ) : (
                              '-'
                            )}
                            {isDeleted && (
                              <Chip
                                label="Törölve"
                                size="small"
                                color="error"
                                variant="filled"
                              />
                            )}
                          </Stack>
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
                                  disabled={inv.invoice_type === 'sztorno' || isDeleted}
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
                                  disabled={!inv.pdf_url || isDeleted}
                                >
                                  <PictureAsPdfIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

      {/* Invoice Modal */}
      <InvoiceModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        order={order}
        items={items}
        tenantCompany={tenantCompany}
        vatRates={vatRates}
      />
      
      {/* Sztornó megerősítés / Díjbekérő törlés */}
      <Dialog open={stornoDialogOpen} onClose={handleCloseStornoDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {stornoTarget?.invoice_type === 'dijbekero' ? 'Díjbekérő törlése' : 'Sztornó számla'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {stornoTarget?.invoice_type === 'dijbekero' 
              ? 'Biztosan törölni szeretnéd ezt a díjbekérőt?'
              : 'Biztosan létrehozod a sztornó számlát a következő számlához?'}
          </Typography>
          <Typography sx={{ mt: 1 }} fontWeight="bold">
            {stornoTarget?.provider_invoice_number || '-'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStornoDialog}>Mégse</Button>
          <Button color="error" variant="contained" onClick={handleConfirmStorno}>
            {stornoTarget?.invoice_type === 'dijbekero' ? 'Törlés' : 'Sztornó létrehozása'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </TabContext>
  )
}

