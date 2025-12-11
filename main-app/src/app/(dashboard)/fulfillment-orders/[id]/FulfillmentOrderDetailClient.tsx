'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Select,
  Stack,
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
import NextLink from 'next/link'
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, Add as AddIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material'
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
  initialFeeTypes
}: FulfillmentOrderDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Order state
  const [order, setOrder] = useState<CustomerOrder>(initialOrder)
  const [items, setItems] = useState<CustomerOrderItem[]>(initialItems)
  const [payments, setPayments] = useState<CustomerOrderPayment[]>(initialPayments)

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
      fetch(`/api/pos/accessories?search=${encodeURIComponent(term)}`, { signal: abortController.signal })
        .then(res => {
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

  // Product picker state (add item)
  const [addingProduct, setAddingProduct] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const productSearchAbortControllerRef = useRef<AbortController | null>(null)
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

  // References
  const [customers] = useState<Customer[]>(initialCustomers)
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

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [newPaymentType, setNewPaymentType] = useState<'cash' | 'card'>('cash')
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0)

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
  const handleCustomerChange = (event: React.SyntheticEvent, newValue: Customer | null) => {
    if (newValue) {
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

      let unitGross = selectedProduct.gross_price || 0
      if (selectedProduct.product_type === 'material' && selectedProduct.unit_price_per_sqm) {
        unitGross = selectedProduct.unit_price_per_sqm
      } else if (selectedProduct.product_type === 'linear_material' && selectedProduct.unit_price_per_m) {
        unitGross = selectedProduct.unit_price_per_m
      }

      const roundedUnitGross = Math.round(unitGross)
      const unitNet = Math.round(roundedUnitGross / vatMultiplier)
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

  return (
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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Ügyfél rendelés: {order.order_number}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Mentés...' : 'Mentés'}
        </Button>
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
                        onChange={(e) => setBillingTaxNumber(e.target.value)}
                        size="small"
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
        </Grid>

        {/* Full width cards */}
        {/* Tételek */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Tételek
              </Typography>
              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                size="small"
                onClick={handleAddProductClick}
                disabled={order.status !== 'open' || addingProduct}
              >
                Tételek hozzáadása
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Név</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Státusz</TableCell>
                    <TableCell align="right">Mennyiség</TableCell>
                    <TableCell align="right">Nettó egységár</TableCell>
                    <TableCell align="right">Bruttó egységár</TableCell>
                    <TableCell align="right">ÁFA</TableCell>
                    <TableCell align="right">Bruttó részösszeg</TableCell>
                    <TableCell>Művelet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.filter(item => item.item_type === 'product').map(item => {
                    const canEdit = item.status === 'open'
                    const statusInfo = getStatusInfo(item.status)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2">{item.product_name}</Typography>
                          {item.product_type === 'accessory' && item.sku && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              SKU: {item.sku}
                            </Typography>
                          )}
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
                    )
                  })}
                  {addingProduct && (
                    <TableRow>
                      <TableCell colSpan={9}>
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
                            const { key, ...other } = props as any
                            const typeLabel = option.product_type === 'material'
                              ? 'Bútorlap'
                              : option.product_type === 'linear_material'
                                ? 'Szálas termék'
                                : 'Kellék'
                            const typeColor = option.product_type === 'material'
                              ? 'secondary'
                              : option.product_type === 'linear_material'
                                ? 'success'
                                : 'primary'
                            return (
                              <Box component="li" key={key} {...other}>
                                <Box sx={{ flex: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="body2">{option.name}</Typography>
                                    <Chip label={typeLabel} size="small" color={typeColor as any} />
                                  </Box>
                                  {option.sku && option.product_type === 'accessory' && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      SKU: {option.sku}
                                    </Typography>
                                  )}
                                  {option.product_type === 'material' && option.length_mm && option.width_mm && option.thickness_mm && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {option.length_mm}×{option.width_mm}×{option.thickness_mm} mm
                                    </Typography>
                                  )}
                                  {option.product_type === 'linear_material' && option.length && option.width && option.thickness && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {option.length}×{option.width}×{option.thickness} mm
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            )
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {items.filter(item => item.item_type === 'fee').map(item => (
                    <TableRow key={item.id}>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
    </Box>
  )
}

