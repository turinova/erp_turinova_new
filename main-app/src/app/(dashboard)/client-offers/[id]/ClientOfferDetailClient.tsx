'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, Add as AddIcon, PictureAsPdf as PictureAsPdfIcon } from '@mui/icons-material'
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

interface ClientOfferItem {
  id: string
  item_type: 'product' | 'material' | 'accessory' | 'linear_material' | 'fee'
  material_id: string | null
  accessory_id: string | null
  linear_material_id: string | null
  fee_type_id: string | null
  product_name: string
  sku: string | null
  unit: string | null
  quantity: number
  unit_price_net: number
  unit_price_gross: number
  vat_id: string | null
  vat_percentage: number | null
  total_net: number
  total_vat: number
  total_gross: number
  notes: string | null
  sort_order: number
}

interface ClientOffer {
  id: string
  offer_number: string
  customer_id: string | null
  worker_id: string | null
  customer_name: string
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
  subtotal_net: number
  total_vat: number
  total_gross: number
  discount_percentage: number
  discount_amount: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  notes: string | null
  created_at: string
  updated_at: string
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

interface ClientOfferDetailClientProps {
  id: string | null
  initialOffer: ClientOffer | null
  initialItems: ClientOfferItem[]
  initialCustomers: Customer[]
  initialVatRates: VatRate[]
  initialUnits: Unit[]
  initialWorkers: Worker[]
  initialFeeTypes: FeeType[]
  initialTenantCompany: TenantCompany | null
}

export default function ClientOfferDetailClient({
  id,
  initialOffer,
  initialItems,
  initialCustomers,
  initialVatRates,
  initialUnits,
  initialWorkers,
  initialFeeTypes,
  initialTenantCompany
}: ClientOfferDetailClientProps) {
  const router = useRouter()
  const isNew = id === null
  const [saving, setSaving] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Offer state
  const [offer, setOffer] = useState<ClientOffer | null>(initialOffer)
  const [items, setItems] = useState<ClientOfferItem[]>(initialItems)
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [vatRates] = useState<VatRate[]>(initialVatRates)
  const [units] = useState<Unit[]>(initialUnits)
  const [workers] = useState<Worker[]>(initialWorkers)
  const [feeTypes] = useState<FeeType[]>(initialFeeTypes)
  const [tenantCompany] = useState<TenantCompany | null>(initialTenantCompany)

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    initialOffer?.customer_id ? customers.find(c => c.id === initialOffer.customer_id) || null : null
  )
  const [customerName, setCustomerName] = useState(initialOffer?.customer_name || '')
  const [customerEmail, setCustomerEmail] = useState(initialOffer?.customer_email || '')
  const [customerMobile, setCustomerMobile] = useState(initialOffer?.customer_mobile || '')

  // Billing state
  const [billingName, setBillingName] = useState(initialOffer?.billing_name || '')
  const [billingCountry, setBillingCountry] = useState(initialOffer?.billing_country || 'Magyarország')
  const [billingCity, setBillingCity] = useState(initialOffer?.billing_city || '')
  const [billingPostalCode, setBillingPostalCode] = useState(initialOffer?.billing_postal_code || '')
  const [billingStreet, setBillingStreet] = useState(initialOffer?.billing_street || '')
  const [billingHouseNumber, setBillingHouseNumber] = useState(initialOffer?.billing_house_number || '')
  const [billingTaxNumber, setBillingTaxNumber] = useState(initialOffer?.billing_tax_number || '')
  const [billingCompanyRegNumber, setBillingCompanyRegNumber] = useState(initialOffer?.billing_company_reg_number || '')

  // Worker state
  const [workerId, setWorkerId] = useState(initialOffer?.worker_id || '')
  const selectedWorker = workers.find(w => w.id === workerId)

  // Status and notes
  const [status, setStatus] = useState<ClientOffer['status']>(initialOffer?.status || 'draft')
  const [notes, setNotes] = useState(initialOffer?.notes || '')

  // Discount state
  const [discountPercentage, setDiscountPercentage] = useState(initialOffer?.discount_percentage || 0)
  const [discountAmount, setDiscountAmount] = useState(initialOffer?.discount_amount || 0)

  // Product picker state
  const [addingProduct, setAddingProduct] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const productSearchAbortControllerRef = useRef<AbortController | null>(null)

  // Taxpayer validation state
  const [taxpayerValidating, setTaxpayerValidating] = useState(false)
  const [taxpayerValidationError, setTaxpayerValidationError] = useState<string | null>(null)
  const [taxNumberFieldInteracted, setTaxNumberFieldInteracted] = useState(false)

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

  // Calculate summary from items
  const summary = useMemo(() => {
    const products = items.filter(item => ['product', 'material', 'accessory', 'linear_material'].includes(item.item_type))
    const fees = items.filter(item => item.item_type === 'fee')
    
    let itemsNet = 0
    let itemsVat = 0
    let itemsGross = 0
    
    // Use stored totals from items (already calculated with Számlázz.hu rounding)
    // Számlázz.hu pattern: net (rounded), VAT (rounded from net), gross (net + VAT)
    products.forEach(item => {
      const net = Math.round(Number(item.total_net || 0))
      const vat = Math.round(Number(item.total_vat || 0))
      const gross = Math.round(Number(item.total_gross || 0))
      
      itemsNet += net
      itemsVat += vat
      itemsGross += gross
    })
    
    let feesNet = 0
    let feesVat = 0
    let feesGross = 0
    
    // Use stored totals from fees (already calculated with Számlázz.hu rounding)
    fees.forEach(item => {
      const net = Math.round(Number(item.total_net || 0))
      const vat = Math.round(Number(item.total_vat || 0))
      const gross = Math.round(Number(item.total_gross || 0))
      
      feesNet += net
      feesVat += vat
      feesGross += gross
    })
    
    const totalNetBeforeDiscount = itemsNet + feesNet
    const totalVatBeforeDiscount = itemsVat + feesVat
    const totalGrossBeforeDiscount = itemsGross + feesGross
    
    const discountAmountValue = Number(discountAmount) || 0
    const grossAfterDiscountRaw = totalGrossBeforeDiscount - discountAmountValue
    const totalGrossAfterDiscount = Math.round(grossAfterDiscountRaw)
    
    const discountRatio = totalGrossBeforeDiscount > 0 ? discountAmountValue / totalGrossBeforeDiscount : 0
    const totalNetAfterDiscount = Math.round(totalNetBeforeDiscount * (1 - discountRatio))
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
  const handleCustomerChange = (event: any, newValue: Customer | string | null) => {
    if (typeof newValue === 'string') {
      // Free text - user is typing a new customer name
      setSelectedCustomer(null)
      setCustomerName(newValue)
    } else if (newValue && 'id' in newValue) {
      // Selected existing customer
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
      // Cleared
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

  // Debounced search term for products
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300)
  const debouncedTaxNumber = useDebounce(billingTaxNumber, 800)

  // Search products when search term changes
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
          if (!abortController.signal.aborted) {
            setProductSearchResults([])
            setIsSearchingProducts(false)
          }
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

  // Query taxpayer data when tax number changes
  const taxpayerAbortControllerRef = useRef<AbortController | null>(null)
  
  useEffect(() => {
    if (!taxNumberFieldInteracted) {
      return
    }

    if (taxpayerAbortControllerRef.current) {
      taxpayerAbortControllerRef.current.abort()
    }

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
            // Handle house number - check if it's in the street field (e.g., "STREET 10")
            let houseNumber = taxpayer.houseNumber
            if (!houseNumber && taxpayer.street) {
              // Try to extract house number from street (format: "STREET 10" or "STREET 10/A")
              const streetMatch = taxpayer.street.match(/\s+(\d+[A-Za-z]?\/?[A-Za-z]?)$/)
              if (streetMatch && streetMatch[1]) {
                houseNumber = streetMatch[1]
                // Remove house number from street
                const streetWithoutNumber = taxpayer.street.replace(/\s+\d+[A-Za-z]?\/?[A-Za-z]?$/, '').trim()
                setBillingStreet(streetWithoutNumber)
                console.log('Extracted house number from street:', houseNumber, 'Updated street to:', streetWithoutNumber)
              }
            }
            if (houseNumber) {
              setBillingHouseNumber(houseNumber)
              console.log('Set house number to:', houseNumber)
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
            setTaxpayerValidationError(err.message || 'Hiba az adószám ellenőrzése során')
            setTaxpayerValidating(false)
          }
        })
    } else if (cleanTaxNumber.length > 0) {
      setTaxpayerValidationError('Érvénytelen adószám formátum')
      setTaxpayerValidating(false)
    } else {
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

  // Recalculate item totals
  const recalculateItem = (item: ClientOfferItem, newQuantity?: number, newNetPrice?: number, newGrossPrice?: number): ClientOfferItem => {
    const quantity = newQuantity !== undefined ? newQuantity : item.quantity
    const vatRate = vatRates.find(v => v.id === item.vat_id)?.kulcs || 0
    
    let unitPriceNet = item.unit_price_net
    let unitPriceGross = item.unit_price_gross
    
    if (newGrossPrice !== undefined) {
      // GROSS-based rounding (when user edits gross price) - matches Számlázz.hu pattern
      // Round gross to integer first
      unitPriceGross = Math.round(newGrossPrice)
      // Calculate VAT from gross: VAT = gross / (100 + VAT_rate) × VAT_rate
      const unitVatPrecise = unitPriceGross / (100 + vatRate) * vatRate
      const unitVat = Math.round(unitVatPrecise) // Round VAT to integer
      // Calculate net: net = gross - VAT (both integers, result is integer)
      unitPriceNet = unitPriceGross - unitVat
    } else if (newNetPrice !== undefined) {
      // NET-based rounding (normal items) - matches Számlázz.hu pattern
      // Round net to integer first
      unitPriceNet = Math.round(newNetPrice)
      // Calculate VAT from net: VAT = round(net × VAT_rate / 100)
      const unitVat = Math.round(unitPriceNet * vatRate / 100)
      // Calculate gross: gross = net + VAT (sum of integers)
      unitPriceGross = unitPriceNet + unitVat
    }
    
    // Calculate totals following Számlázz.hu pattern:
    // nettoErtek = round(quantity × unit_price_net)
    const totalNet = Math.round(quantity * unitPriceNet)
    // afaErtek = round(nettoErtek × vatRate / 100)
    const totalVat = Math.round(totalNet * vatRate / 100)
    // bruttoErtek = nettoErtek + afaErtek (sum of integers)
    const totalGross = totalNet + totalVat
    
    return {
      ...item,
      quantity,
      unit_price_net: unitPriceNet,
      unit_price_gross: unitPriceGross,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross
    }
  }

  // Handle product selection
  const handleProductSelect = (selectedProduct: any) => {
    if (!selectedProduct) return

    const vatPercent = selectedProduct.vat_percent || 0
    const vatMultiplier = 1 + vatPercent / 100
    
    let unitNetPrice = 0
    let unitGrossPrice = 0
    
    // For materials: use per m² pricing (net_price is price_per_sqm)
    if (selectedProduct.product_type === 'material') {
      const netPricePerSqm = selectedProduct.net_price || 0 // This is price_per_sqm (base_price * multiplier per m²)
      unitNetPrice = Math.round(netPricePerSqm)
      unitGrossPrice = Math.round(netPricePerSqm * vatMultiplier)
    }
    // For linear materials: use per meter pricing (net_price is price_per_m)
    else if (selectedProduct.product_type === 'linear_material') {
      const netPricePerM = selectedProduct.net_price || 0 // This is price_per_m (base_price * multiplier per m)
      unitNetPrice = Math.round(netPricePerM)
      unitGrossPrice = Math.round(netPricePerM * vatMultiplier)
    }
    // For accessories: use base_price * multiplier * (1 + vat)
    else {
      const base = selectedProduct.base_price || 0
      const mult = selectedProduct.multiplier || 1.38
      unitNetPrice = Math.round(base * mult)
      unitGrossPrice = Math.round(unitNetPrice * vatMultiplier)
    }

    const quantity = 1
    const totalNet = Math.round(unitNetPrice * quantity)
    const totalVat = Math.round(totalNet * vatPercent / 100)
    const totalGross = totalNet + totalVat

    // Determine item_type based on product_type
    let itemType: ClientOfferItem['item_type'] = 'product'
    if (selectedProduct.product_type === 'material') {
      itemType = 'material'
    } else if (selectedProduct.product_type === 'accessory') {
      itemType = 'accessory'
    } else if (selectedProduct.product_type === 'linear_material') {
      itemType = 'linear_material'
    }

    const newProduct: ClientOfferItem = {
      id: `temp-${Date.now()}`,
      item_type: itemType,
      material_id: selectedProduct.material_id || null,
      accessory_id: selectedProduct.accessory_id || null,
      linear_material_id: selectedProduct.linear_material_id || null,
      fee_type_id: null,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku || null,
      unit: selectedProduct.unit_shortform || selectedProduct.unit_name || null,
      quantity: quantity,
      unit_price_net: unitNetPrice,
      unit_price_gross: unitGrossPrice,
      vat_id: selectedProduct.vat_id,
      vat_percentage: vatPercent,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      notes: null,
      sort_order: items.length
    }

    setItems(prevItems => [...prevItems, newProduct])
    setAddingProduct(false)
    setProductSearchTerm('')
    setProductSearchResults([])
  }

  // Handle item quantity change
  const handleItemQuantityChange = (itemId: string, newQuantity: number) => {
    if (offer?.status === 'accepted') {
      toast.warning('Az elfogadott ajánlat nem módosítható')
      return
    }
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item
      return recalculateItem(item, newQuantity)
    }))
  }

  // Handle item price change (gross)
  const handleItemPriceGrossChange = (itemId: string, newPrice: number) => {
    if (offer?.status === 'accepted') {
      toast.warning('Az elfogadott ajánlat nem módosítható')
      return
    }
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item
      return recalculateItem(item, undefined, undefined, newPrice)
    }))
  }

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    if (offer?.status === 'accepted') {
      toast.warning('Az elfogadott ajánlat nem módosítható')
      return
    }
    setItems(prevItems => prevItems.filter(item => item.id !== itemId))
  }

  // Add fee
  const handleAddFee = () => {
    if (feeTypes.length === 0) {
      toast.warning('Nincs elérhető díjtípus')
      return
    }
    
    const defaultFee = feeTypes[0]
    const defaultVat = vatRates.find(v => v.id === defaultFee.vat_id) || vatRates[0]
    const vatPercent = defaultVat?.kulcs || 0
    const grossPrice = defaultFee.net_price * (1 + vatPercent / 100)
    
    const newFee: ClientOfferItem = {
      id: `temp-${Date.now()}`,
      item_type: 'fee',
      material_id: null,
      accessory_id: null,
      linear_material_id: null,
      fee_type_id: defaultFee.id,
      product_name: defaultFee.name,
      sku: null,
      unit: null,
      quantity: 1,
      unit_price_net: defaultFee.net_price,
      unit_price_gross: grossPrice,
      vat_id: defaultFee.vat_id,
      vat_percentage: vatPercent,
      total_net: defaultFee.net_price,
      total_vat: grossPrice - defaultFee.net_price,
      total_gross: grossPrice,
      notes: null,
      sort_order: items.length
    }
    
    setItems(prevItems => [...prevItems, newFee])
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
          fee_type_id: feetypeId,
          product_name: selectedFee.name,
          unit_price_net: selectedFee.net_price,
          unit_price_gross: grossPrice,
          vat_id: selectedFee.vat_id,
          vat_percentage: vatPercent
        }
      )
    }))
  }

  // Handle PDF generation via server-side Puppeteer
  const handleGeneratePdf = async () => {
    if (!offer || !id) {
      toast.error('Az ajánlat szükséges a PDF generálásához')
      return
    }

    setIsGeneratingPdf(true)
    try {
      // Call server-side PDF generation API
      const response = await fetch(`/api/client-offers/${id}/pdf`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }))
        throw new Error(errorData.error || 'Hiba történt a PDF generálása során')
      }

      // Get PDF blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Ajanlat-${offer.offer_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF sikeresen generálva és letöltve')
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      toast.error('Hiba történt a PDF generálása során: ' + (error.message || 'Ismeretlen hiba'))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Handle save
  const handleSave = async () => {
    if (!customerName || !customerName.trim()) {
      toast.error('Ügyfél neve kötelező')
      return
    }

    if (!workerId) {
      toast.error('Dolgozó kiválasztása kötelező')
      return
    }

    setSaving(true)
    try {
      // Create customer if name is provided and customer doesn't exist
      let finalCustomerId = selectedCustomer?.id || null
      
      if (customerName && customerName.trim() && !selectedCustomer) {
        try {
          const existingCustomer = customers.find(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim())
          
          if (existingCustomer) {
            setSelectedCustomer(existingCustomer)
            finalCustomerId = existingCustomer.id
          } else {
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
              const newCustomer = response.data || response
              
              if (newCustomer && newCustomer.id) {
                setCustomers(prev => [...prev, newCustomer])
                setSelectedCustomer(newCustomer)
                finalCustomerId = newCustomer.id
                toast.success('Új ügyfél létrehozva')
              }
            }
          }
        } catch (customerError: any) {
          console.error('Error creating customer:', customerError)
          toast.warning(`Hiba történt az ügyfél létrehozása során: ${customerError.message || 'Ismeretlen hiba'}. Az ajánlat mentése folytatódik.`)
        }
      }

      // Build items payload
      const itemsPayload = items.map((item, index) => ({
        item_type: item.item_type,
        material_id: item.material_id || null,
        accessory_id: item.accessory_id || null,
        linear_material_id: item.linear_material_id || null,
        fee_type_id: item.fee_type_id || null,
        product_name: item.product_name,
        sku: item.sku || null,
        unit: item.unit || null,
        quantity: item.quantity,
        unit_price_net: item.unit_price_net,
        unit_price_gross: item.unit_price_gross,
        vat_id: item.vat_id || null,
        vat_percentage: item.vat_percentage || null,
        total_net: item.total_net,
        total_vat: item.total_vat,
        total_gross: item.total_gross,
        notes: item.notes || null
      }))

      if (isNew) {
        // Create new offer
        const res = await fetch('/api/client-offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: finalCustomerId,
            worker_id: workerId || null,
            customer_name: customerName.trim(),
            customer_email: customerEmail || null,
            customer_mobile: customerMobile || null,
            billing_name: billingName || null,
            billing_country: billingCountry || 'Magyarország',
            billing_city: billingCity || null,
            billing_postal_code: billingPostalCode || null,
            billing_street: billingStreet || null,
            billing_house_number: billingHouseNumber || null,
            billing_tax_number: billingTaxNumber || null,
            billing_company_reg_number: billingCompanyRegNumber || null,
            subtotal_net: summary.totalNetAfterDiscount,
            total_vat: summary.totalVatAfterDiscount,
            total_gross: summary.totalGrossAfterDiscount,
            discount_percentage: discountPercentage || 0,
            discount_amount: discountAmount || 0,
            status: status,
            notes: notes || null,
            items: itemsPayload
          })
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'Hiba az ajánlat létrehozásakor')
        }

        toast.success('Ajánlat létrehozva')
        router.push(`/client-offers/${data.offer_id}`)
      } else {
        // Update existing offer
        const res = await fetch(`/api/client-offers/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: finalCustomerId,
            worker_id: workerId || null,
            customer_name: customerName.trim(),
            customer_email: customerEmail || null,
            customer_mobile: customerMobile || null,
            billing_name: billingName || null,
            billing_country: billingCountry || 'Magyarország',
            billing_city: billingCity || null,
            billing_postal_code: billingPostalCode || null,
            billing_street: billingStreet || null,
            billing_house_number: billingHouseNumber || null,
            billing_tax_number: billingTaxNumber || null,
            billing_company_reg_number: billingCompanyRegNumber || null,
            subtotal_net: summary.totalNetAfterDiscount,
            total_vat: summary.totalVatAfterDiscount,
            total_gross: summary.totalGrossAfterDiscount,
            discount_percentage: discountPercentage || 0,
            discount_amount: discountAmount || 0,
            status: status,
            notes: notes || null
          })
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'Hiba az ajánlat frissítésekor')
        }

        // Update items separately
        const initialItemIds = new Set(initialItems.map(item => item.id))
        const deletedItemIds = initialItems
          .filter(initialItem => !items.find(item => item.id === initialItem.id))
          .map(item => item.id)

        // Delete removed items
        for (const deletedId of deletedItemIds) {
          if (!deletedId.startsWith('temp-')) {
            await fetch(`/api/client-offers/${id}/items?item_id=${deletedId}`, {
              method: 'DELETE'
            })
          }
        }

        // Add/update items
        for (const item of items) {
          if (item.id.startsWith('temp-')) {
            // New item
            await fetch(`/api/client-offers/${id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          } else if (!initialItemIds.has(item.id)) {
            // New item (not temp but not in initial)
            await fetch(`/api/client-offers/${id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            })
          } else {
            // Update existing item (only quantity and price can be edited)
            await fetch(`/api/client-offers/${id}/items`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                item_id: item.id,
                quantity: item.quantity,
                unit_price_gross: item.unit_price_gross
              })
            })
          }
        }

        toast.success('Mentés sikeres')
        router.refresh()
      }
    } catch (error: any) {
      console.error('Error saving client offer:', error)
      toast.error(error.message || 'Hiba a mentés során')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={NextLink} href="/home" underline="hover" color="inherit">
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Link component={NextLink} href="/client-offers" underline="hover" color="inherit">
          Ügyfél ajánlatok
        </Link>
        <Typography color="text.primary">
          {isNew ? 'Új ajánlat' : (offer?.offer_number || 'Ajánlat')}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isNew ? 'Új ajánlat' : `Ajánlat: ${offer?.offer_number || ''}`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {!isNew && offer && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={isGeneratingPdf ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
              onClick={handleGeneratePdf}
              disabled={!tenantCompany || isGeneratingPdf}
            >
              {isGeneratingPdf ? 'PDF generálása...' : 'PDF generálás'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </Box>
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
                            label="Ügyfél neve *"
                            size="small"
                            required
                          />
                        )}
                      />
                    </Grid>
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

          {/* Right column: 40% - Rendelési adatok */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              {/* Rendelési adatok */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ajánlat adatok
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    {!isNew && offer && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Ajánlat szám:</strong>
                        </Typography>
                        <Typography variant="body1">
                          {offer.offer_number}
                        </Typography>
                      </Grid>
                    )}
                    {!isNew && offer && (
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Létrehozva:</strong>
                        </Typography>
                        <Typography variant="body2">
                          {formatDateTime(offer.created_at)}
                        </Typography>
                      </Grid>
                    )}
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
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth size="small">
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Státusz:</strong>
                        </Typography>
                        <Select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as ClientOffer['status'])}
                          disabled={offer?.status === 'accepted'}
                        >
                          <MenuItem value="draft">Vázlat</MenuItem>
                          <MenuItem value="sent">Elküldve</MenuItem>
                          <MenuItem value="accepted">Elfogadva</MenuItem>
                          <MenuItem value="rejected">Elutasítva</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth size="small" required>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Dolgozó: *</strong>
                        </Typography>
                        <Select
                          value={workerId}
                          onChange={(e) => setWorkerId(e.target.value)}
                          error={!workerId}
                          required
                        >
                          <MenuItem value="">Válasszon dolgozót</MenuItem>
                          {workers.map(worker => (
                            <MenuItem key={worker.id} value={worker.id}>
                              {worker.nickname || worker.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
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
                  {items.filter(item => ['product', 'material', 'accessory', 'linear_material'].includes(item.item_type)).map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2">{item.product_name}</Typography>
                        {item.sku && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            SKU: {item.sku}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{item.sku || '-'}</TableCell>
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
                          disabled={offer?.status === 'accepted'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {item.item_type === 'material' ? 'm²' :
                         item.item_type === 'linear_material' ? 'm' :
                         item.unit || '-'}
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
                          disabled={offer?.status === 'accepted'}
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
                          disabled={offer?.status === 'accepted'}
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
                          filterOptions={(options) => options}
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
                              if (option.product_type === 'material' && option.dimensions) {
                                return option.dimensions
                              } else if (option.product_type === 'linear_material' && option.dimensions) {
                                return option.dimensions
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
                                  {getDimensions() && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {getDimensions()}
                                    </Typography>
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    {option.product_type === 'accessory' && option.sku && `SKU: ${option.sku} | `}
                                    {formatCurrency(option.gross_price || 0)}
                                  </Typography>
                                </Box>
                              </Box>
                            )
                          }}
                          noOptionsText="Nincs találat"
                          open={productSearchTerm.trim().length >= 2}
                        />
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button size="small" onClick={() => {
                            setAddingProduct(false)
                            setProductSearchTerm('')
                            setProductSearchResults([])
                          }}>
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
              onClick={() => setAddingProduct(true)}
              disabled={addingProduct || offer?.status === 'accepted'}
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
                          value={feeTypes.find(f => f.id === item.fee_type_id) || null}
                          onChange={(event, newValue) => {
                            if (newValue) {
                              handleFeeNameChange(item.id, newValue.id)
                            }
                          }}
                          disabled={offer?.status === 'accepted'}
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
                          disabled={offer?.status === 'accepted'}
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
                          disabled={offer?.status === 'accepted'}
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
              disabled={offer?.status === 'accepted'}
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
                    const newAmount = (summary.totalGrossBeforeDiscount * percent) / 100
                    setDiscountAmount(newAmount)
                  }}
                  size="small"
                  disabled={offer?.status === 'accepted'}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Kedvezmény összeg"
                  value={formatCurrency(discountAmount)}
                  disabled
                  size="small"
                />
              </Grid>

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

        {/* Notes */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Megjegyzések
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Megjegyzések..."
              disabled={offer?.status === 'accepted'}
            />
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}

