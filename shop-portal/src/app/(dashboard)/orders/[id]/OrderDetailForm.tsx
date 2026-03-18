'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  Autocomplete,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  InputAdornment,
  Tooltip
} from '@mui/material'

// Common countries for order addresses (ISO code -> label)
const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'HU', label: 'Magyarország' },
  { code: 'AT', label: 'Ausztria' },
  { code: 'DE', label: 'Németország' },
  { code: 'SK', label: 'Szlovákia' },
  { code: 'RO', label: 'Románia' },
  { code: 'CZ', label: 'Csehország' },
  { code: 'PL', label: 'Lengyelország' },
  { code: 'SI', label: 'Szlovénia' },
  { code: 'HR', label: 'Horvátország' },
  { code: 'IT', label: 'Olaszország' },
  { code: 'FR', label: 'Franciaország' },
  { code: 'ES', label: 'Spanyolország' },
  { code: 'NL', label: 'Hollandia' },
  { code: 'BE', label: 'Belgium' },
  { code: 'GB', label: 'Egyesült Királyság' },
  { code: 'OTHER', label: 'Egyéb' }
]
import {
  Info as InfoIcon,
  Person as PersonIcon,
  LocalShipping as LocalShippingIcon,
  ShoppingCart as ShoppingCartIcon,
  Save as SaveIcon,
  OpenInNew as OpenInNewIcon,
  Business as BusinessIcon,
  Tag as TagIcon,
  Event as EventIcon,
  Store as StoreIcon,
  MonetizationOn as MonetizationOnIcon,
  Add as AddIcon,
  Payment as PaymentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Percent as PercentIcon,
  AttachMoney as AttachMoneyIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  getAllowedNextStatus,
  isTerminalStatus,
  getFulfillabilityDisplayStyle
} from '@/lib/order-status'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Függőben',
  partial: 'Részben fizetve',
  paid: 'Fizetve',
  refunded: 'Visszatérítve'
}

const PAYMENT_STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  partial: 'warning',
  paid: 'success',
  refunded: 'error'
}

// Read-only display row: label (muted) + value (dark, larger for easy reading)
function DisplayRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
      <Typography component="dt" variant="body1" sx={{ minWidth: 110, color: 'text.secondary', fontSize: '0.95rem' }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body1" sx={{ m: 0, fontWeight: 600, color: 'text.primary', fontSize: '1.05rem' }}>
        {value}
      </Typography>
    </Box>
  )
}

// Notion/Figma-style info row: icon + label + value (scannable, not noisy)
function InfoRow({
  icon: Icon,
  label,
  value,
  iconColor = SECTION_COLORS.info.main
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  iconColor?: string
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          bgcolor: `${iconColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25
        }}
      >
        <Icon sx={{ fontSize: 18, color: iconColor }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

const SECTION_COLORS = {
  info: { main: '#2196f3', dark: '#1565c0' },
  customer: { main: '#2e7d32', dark: '#1b5e20' },
  billing: { main: '#00838f', dark: '#006064' },
  shipping: { main: '#ef6c00', dark: '#e65100' },
  payment: { main: '#1565c0', dark: '#0d47a1' },
  items: { main: '#7b1fa2', dark: '#6a1b9a' }
} as const

// Match product page: subtle input background, white when focused (easy to read)
const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0, 0, 0, 0.02)',
    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
    '&.Mui-focused': { bgcolor: 'white' }
  }
} as const

function SectionHeader({
  icon: Icon,
  title,
  colorKey,
  titleVariant = 'h6'
}: {
  icon: React.ElementType
  title: string
  colorKey: keyof typeof SECTION_COLORS
  titleVariant?: 'h5' | 'h6'
}) {
  const c = SECTION_COLORS[colorKey]
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
      <Box
        sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: c.main,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px ${c.main}40`
        }}
      >
        <Icon sx={{ color: 'white', fontSize: '24px' }} />
      </Box>
      <Typography variant={titleVariant} sx={{ fontWeight: 700, color: c.dark, fontSize: titleVariant === 'h5' ? '1.25rem' : undefined }}>
        {title}
      </Typography>
    </Box>
  )
}

/** If DB has net stored in unit_price_gross (e.g. webshop import), derive real gross from net for display/summary. */
function effectiveUnitPriceGross(raw: { unit_price_net?: number | string; unit_price_gross?: number | string; tax_rate?: number | string }): number {
  const net = parseFloat(String(raw.unit_price_net ?? 0)) || 0
  const stored = parseFloat(String(raw.unit_price_gross ?? 0)) || 0
  const taxRate = parseFloat(String(raw.tax_rate ?? 0)) || 0
  if (net <= 0) return stored
  const expectedGross = net * (1 + taxRate / 100)
  const storedLooksLikeNet = Math.abs(stored - net) < 0.01 * (net + 1) || stored <= net
  return storedLooksLikeNet ? expectedGross : stored
}

interface OrderDetailFormProps {
  order: any
  orderItems: any[]
  orderTotals: any[]
  shippingMethods: Array<{ id: string; name: string; code: string | null }>
  paymentMethods: Array<{ id: string; name: string; code: string | null }>
  connectionName: string | null
  connectionPlatform: string | null
  pickBatch?: { id: string; code: string } | null
}

export default function OrderDetailForm({
  order,
  orderItems,
  orderTotals,
  shippingMethods,
  paymentMethods,
  connectionName,
  connectionPlatform,
  pickBatch = null
}: OrderDetailFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [recheckingFulfillability, setRecheckingFulfillability] = useState(false)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<{ persons: Array<{ id: string; type: 'person'; label: string; email?: string }>; companies: Array<{ id: string; type: 'company'; label: string; email?: string }> }>({ persons: [], companies: [] })
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [customerPrefillLoading, setCustomerPrefillLoading] = useState(false)
  const [billingEditOpen, setBillingEditOpen] = useState(false)
  const [customerEditOpen, setCustomerEditOpen] = useState(false)
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false)
  const [newCustomerType, setNewCustomerType] = useState<'person' | 'company'>('person')
  const [newCustomerForm, setNewCustomerForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    name: '',
    telephone: ''
  })
  const [newCustomerSaving, setNewCustomerSaving] = useState(false)
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null)
  const [paymentEditOpen, setPaymentEditOpen] = useState(false)
  const [shippingEditOpen, setShippingEditOpen] = useState(false)

  const [vatRates, setVatRates] = useState<Array<{ id: string; name: string; kulcs: number }>>([])
  const [items, setItems] = useState<Array<{
    id?: string
    product_id?: string | null
    product_name: string
    product_sku: string
    quantity: number
    unit_price_gross: number
    tax_rate: number
    line_total_gross?: number
    discount_value: number
    discount_mode: 'percent' | 'amount'
  }>>(() => orderItems.map((it: any) => ({
    id: it.id,
    product_id: it.product_id ?? null,
    product_name: it.product_name || '',
    product_sku: it.product_sku || '',
    quantity: Number(it.quantity) || 1,
    unit_price_gross: effectiveUnitPriceGross(it),
    tax_rate: parseFloat(it.tax_rate) || 0,
    line_total_gross: parseFloat(it.line_total_gross),
    discount_value: parseFloat(it.discount_amount) || 0,
    discount_mode: 'amount' as const
  })))
  const [orderDiscountValue, setOrderDiscountValue] = useState(() => parseFloat(String((order as any).discount_amount)) || 0)
  const [orderDiscountMode, setOrderDiscountMode] = useState<'percent' | 'amount'>('amount')
  const [itemDiscountModalRow, setItemDiscountModalRow] = useState<number | null>(null)
  const [itemDiscountModalMode, setItemDiscountModalMode] = useState<'percent' | 'amount'>('percent')
  const [itemDiscountModalValue, setItemDiscountModalValue] = useState('')
  const [itemsSaving, setItemsSaving] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<Array<{
    product_id: string
    product_name: string
    product_sku: string
    gross_price?: number | null
    price?: number | null
    vat_rate?: number
  }>>([])
  const [productSearching, setProductSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<typeof productSearchResults[0] | null>(null)
  const [itemAvailability, setItemAvailability] = useState<Record<string, { quantity_available: number; quantity_on_hand: number; quantity_reserved: number; quantity_incoming: number }>>({})
  const [itemAvailabilitySkuToId, setItemAvailabilitySkuToId] = useState<Record<string, string>>({})

  useEffect(() => {
    setItems(orderItems.map((it: any) => ({
      id: it.id,
      product_id: it.product_id ?? null,
      product_name: it.product_name || '',
      product_sku: it.product_sku || '',
      quantity: Number(it.quantity) || 1,
      unit_price_gross: effectiveUnitPriceGross(it),
      tax_rate: parseFloat(it.tax_rate) || 0,
      line_total_gross: parseFloat(it.line_total_gross),
      discount_value: parseFloat(it.discount_amount) || 0,
      discount_mode: 'amount' as const
    })))
    setOrderDiscountValue(parseFloat(String((order as any).discount_amount)) || 0)
    setOrderDiscountMode('amount')
  }, [orderItems, order])

  useEffect(() => {
    let cancelled = false
    if (!order?.id || items.length === 0) {
      setItemAvailability({})
      setItemAvailabilitySkuToId({})
      return
    }
    const load = async () => {
      try {
        const ids = items.map((it) => it.product_id).filter(Boolean) as string[]
        const qs = ids.length > 0 ? `?product_ids=${ids.join(',')}` : ''
        const res = await fetch(`/api/orders/${order.id}/item-availability${qs}`)
        const data = await res.json()
        if (cancelled) return
        if (res.ok) {
          setItemAvailability(data.availability || {})
          setItemAvailabilitySkuToId(data.sku_to_product_id || {})
        }
      } catch {
        if (!cancelled) {
          setItemAvailability({})
          setItemAvailabilitySkuToId({})
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [order?.id, items.length, items.map((i) => i.product_id).filter(Boolean).join(',')])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const res = await fetch('/api/vat-rates')
      const data = await res.json()
      if (!cancelled) setVatRates(data.vatRates || [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  const fetchProductSearch = useCallback(async () => {
    if (productSearchTerm.trim().length < 2) {
      setProductSearchResults([])
      return
    }
    setProductSearching(true)
    try {
      const res = await fetch(`/api/products/search-for-po?q=${encodeURIComponent(productSearchTerm.trim())}&limit=20`)
      const data = await res.json()
      setProductSearchResults(data.products || [])
    } catch {
      setProductSearchResults([])
    } finally {
      setProductSearching(false)
    }
  }, [productSearchTerm])

  useEffect(() => {
    const t = setTimeout(fetchProductSearch, 300)
    return () => clearTimeout(t)
  }, [productSearchTerm, fetchProductSearch])

  const defaultVatRate = vatRates.find(v => v.kulcs === 26) ?? vatRates.find(v => v.kulcs === 27) ?? vatRates[0]

  const addItemFromProduct = useCallback((product: typeof productSearchResults[0]) => {
    const gross = product.gross_price ?? product.price ?? 0
    const taxRate = defaultVatRate ? defaultVatRate.kulcs : 27
    setItems(prev => [...prev, {
      product_id: product.product_id,
      product_name: product.product_name,
      product_sku: product.product_sku,
      quantity: 1,
      unit_price_gross: gross,
      tax_rate: taxRate,
      discount_value: 0,
      discount_mode: 'amount'
    }])
    setProductSearchTerm('')
    setProductSearchResults([])
    setSelectedProduct(null)
  }, [defaultVatRate])

  const updateItem = useCallback((index: number, field: 'quantity' | 'unit_price_gross' | 'tax_rate' | 'discount_value' | 'discount_mode', value: number | 'percent' | 'amount') => {
    setItems(prev => {
      const next = [...prev]
      const row = { ...next[index], [field]: value }
      next[index] = row
      return next
    })
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const saveItems = useCallback(async (optionalItems?: typeof items) => {
    const itemsToSave = optionalItems ?? items
    setItemsSaving(true)
    try {
      const payload = itemsToSave.map(it => {
        const out: Record<string, unknown> = {
          id: it.id,
          product_id: it.product_id ?? undefined,
          product_name: it.product_name,
          product_sku: it.product_sku,
          quantity: it.quantity,
          unit_price_gross: it.unit_price_gross,
          tax_rate: it.tax_rate
        }
        if (it.discount_mode === 'percent' && it.discount_value > 0) {
          out.discount_percent = it.discount_value
        } else if (it.discount_value > 0) {
          out.discount_amount = it.discount_value
        }
        return out
      })
      const body: Record<string, unknown> = { items: payload }
      if (orderDiscountMode === 'percent' && orderDiscountValue > 0) {
        body.order_discount_percent = orderDiscountValue
      } else if (orderDiscountValue > 0) {
        body.order_discount_amount = orderDiscountValue
      }
      const res = await fetch(`/api/orders/${order.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Hiba a tételek mentésekor')
        return
      }
      toast.success('Mentve.')
      setItems((data.items || []).map((it: any) => ({
        id: it.id,
        product_id: it.product_id ?? null,
        product_name: it.product_name || '',
        product_sku: it.product_sku || '',
        quantity: Number(it.quantity) || 1,
        unit_price_gross: effectiveUnitPriceGross(it),
        tax_rate: parseFloat(it.tax_rate) || 0,
        line_total_gross: parseFloat(it.line_total_gross),
        discount_value: parseFloat(it.discount_amount) || 0,
        discount_mode: 'amount' as const
      })))
      setOrderDiscountValue(parseFloat(String(data.discount_amount ?? (order as any).discount_amount)) || 0)
      setOrderDiscountMode('amount')
      router.refresh()
    } catch (e) {
      toast.error('Hiba a tételek mentésekor.')
    } finally {
      setItemsSaving(false)
    }
  }, [items, order.id, order, orderDiscountValue, orderDiscountMode, router])

  const handleOrderDiscountBlur = useCallback(() => {
    saveItems()
  }, [saveItems])

  const [form, setForm] = useState({
    customer_person_id: order.customer_person_id ?? null as string | null,
    customer_company_id: order.customer_company_id ?? null as string | null,
    customer_company_name: order.customer_company_name ?? '' as string,
    customer_firstname: order.customer_firstname ?? '',
    customer_lastname: order.customer_lastname ?? '',
    customer_email: order.customer_email ?? '',
    customer_phone: order.customer_phone ?? '',
    billing_firstname: order.billing_firstname ?? '',
    billing_lastname: order.billing_lastname ?? '',
    billing_company: order.billing_company ?? '',
    billing_address1: order.billing_address1 ?? '',
    billing_address2: order.billing_address2 ?? '',
    billing_city: order.billing_city ?? '',
    billing_postcode: order.billing_postcode ?? '',
    billing_country_code: order.billing_country_code ?? '',
    billing_tax_number: order.billing_tax_number ?? '',
    shipping_firstname: order.shipping_firstname ?? '',
    shipping_lastname: order.shipping_lastname ?? '',
    shipping_company: order.shipping_company ?? '',
    shipping_address1: order.shipping_address1 ?? '',
    shipping_address2: order.shipping_address2 ?? '',
    shipping_city: order.shipping_city ?? '',
    shipping_postcode: order.shipping_postcode ?? '',
    shipping_country_code: order.shipping_country_code ?? '',
    shipping_method_id: order.shipping_method_id ?? '',
    shipping_method_name: order.shipping_method_name ?? '',
    tracking_number: order.tracking_number ?? '',
    expected_delivery_date: order.expected_delivery_date ?? '',
    payment_method_id: order.payment_method_id ?? '',
    payment_method_name: order.payment_method_name ?? '',
    payment_method_after: order.payment_method_after ?? true,
    payment_status: order.payment_status ?? 'pending'
  })

  const formatCurrency = (amount: number | string | null, currency: string = 'HUF') => {
    if (amount == null) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency || 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toISOString().slice(0, 10)
  }

  const sourceLabel = connectionName
    ? `Webshop${connectionPlatform ? ` (${connectionPlatform})` : ''}: ${connectionName}`
    : 'Webshop'

  const isCustomerCompany = !!form.customer_company_id

  const fetchCustomerSearch = useCallback(async () => {
    if (customerSearchQuery.length < 2) {
      setCustomerSearchResults({ persons: [], companies: [] })
      return
    }
    setCustomerSearchLoading(true)
    try {
      const res = await fetch(`/api/customers/search-for-order?q=${encodeURIComponent(customerSearchQuery)}&limit=20`)
      const data = await res.json()
      setCustomerSearchResults({
        persons: (data.persons || []).map((p: any) => ({ ...p, type: 'person' as const })),
        companies: (data.companies || []).map((c: any) => ({ ...c, type: 'company' as const }))
      })
    } catch {
      setCustomerSearchResults({ persons: [], companies: [] })
    } finally {
      setCustomerSearchLoading(false)
    }
  }, [customerSearchQuery])

  useEffect(() => {
    if (!customerSearchOpen) return
    const t = setTimeout(fetchCustomerSearch, 300)
    return () => clearTimeout(t)
  }, [customerSearchOpen, customerSearchQuery, fetchCustomerSearch])

  const customerOptions = [
    ...customerSearchResults.persons.map((p) => ({ ...p, type: 'person' as const })),
    ...customerSearchResults.companies.map((c) => ({ ...c, type: 'company' as const }))
  ]

  const handleCustomerSelect = async (_: any, value: { id: string; type: 'person' | 'company'; label: string } | null) => {
    if (!value) return
    setCustomerPrefillLoading(true)
    try {
      const res = await fetch(`/api/customers/order-prefill?type=${value.type}&id=${encodeURIComponent(value.id)}`)
      if (!res.ok) throw new Error('Prefill failed')
      const data = await res.json()
      if (data.type === 'person' && data.entity) {
        setForm((f) => ({
          ...f,
          customer_person_id: data.entity.id,
          customer_company_id: null,
          customer_company_name: '',
          customer_firstname: data.entity.firstname ?? '',
          customer_lastname: data.entity.lastname ?? '',
          customer_email: data.entity.email ?? '',
          customer_phone: data.entity.telephone ?? '',
          billing_firstname: data.defaultBilling?.firstname ?? '',
          billing_lastname: data.defaultBilling?.lastname ?? '',
          billing_company: data.defaultBilling?.company ?? '',
          billing_address1: data.defaultBilling?.address1 ?? '',
          billing_address2: data.defaultBilling?.address2 ?? '',
          billing_city: data.defaultBilling?.city ?? '',
          billing_postcode: data.defaultBilling?.postcode ?? '',
          billing_country_code: data.defaultBilling?.country_code ?? '',
          billing_tax_number: '', // person: hide adószám, clear
          shipping_firstname: data.defaultShipping?.firstname ?? '',
          shipping_lastname: data.defaultShipping?.lastname ?? '',
          shipping_company: data.defaultShipping?.company ?? '',
          shipping_address1: data.defaultShipping?.address1 ?? '',
          shipping_address2: data.defaultShipping?.address2 ?? '',
          shipping_city: data.defaultShipping?.city ?? '',
          shipping_postcode: data.defaultShipping?.postcode ?? '',
          shipping_country_code: data.defaultShipping?.country_code ?? ''
        }))
      }
      if (data.type === 'company' && data.entity) {
        setForm((f) => ({
          ...f,
          customer_person_id: null,
          customer_company_id: data.entity.id,
          customer_company_name: data.entity.name ?? '',
          customer_firstname: '',
          customer_lastname: '',
          customer_email: data.entity.email ?? '',
          customer_phone: data.entity.telephone ?? '',
          billing_firstname: data.defaultBilling?.firstname ?? '',
          billing_lastname: data.defaultBilling?.lastname ?? '',
          billing_company: data.defaultBilling?.company ?? data.entity.name ?? '',
          billing_address1: data.defaultBilling?.address1 ?? '',
          billing_address2: data.defaultBilling?.address2 ?? '',
          billing_city: data.defaultBilling?.city ?? '',
          billing_postcode: data.defaultBilling?.postcode ?? '',
          billing_country_code: data.defaultBilling?.country_code ?? '',
          billing_tax_number: data.entity.tax_number ?? '',
          shipping_firstname: data.defaultShipping?.firstname ?? '',
          shipping_lastname: data.defaultShipping?.lastname ?? '',
          shipping_company: data.defaultShipping?.company ?? '',
          shipping_address1: data.defaultShipping?.address1 ?? '',
          shipping_address2: data.defaultShipping?.address2 ?? '',
          shipping_city: data.defaultShipping?.city ?? '',
          shipping_postcode: data.defaultShipping?.postcode ?? '',
          shipping_country_code: data.defaultShipping?.country_code ?? ''
        }))
      }
    } catch (e) {
      toast.error('Nem sikerült betölteni a vevő adatait')
    } finally {
      setCustomerPrefillLoading(false)
      setCustomerSearchOpen(false)
    }
  }

  const copyBillingFromShipping = () => {
    setForm((f) => ({
      ...f,
      billing_firstname: f.shipping_firstname,
      billing_lastname: f.shipping_lastname,
      billing_company: f.shipping_company,
      billing_address1: f.shipping_address1,
      billing_address2: f.shipping_address2,
      billing_city: f.shipping_city,
      billing_postcode: f.shipping_postcode,
      billing_country_code: f.shipping_country_code
    }))
    toast.success('Számlázási cím másolva a szállítási címről')
  }

  const openNewCustomerModal = () => {
    setNewCustomerError(null)
    setNewCustomerForm({ firstname: '', lastname: '', email: '', name: '', telephone: '' })
    setNewCustomerType('person')
    setNewCustomerModalOpen(true)
  }

  const handleNewCustomerSubmit = async () => {
    setNewCustomerError(null)
    if (newCustomerType === 'person') {
      if (!newCustomerForm.firstname?.trim() || !newCustomerForm.lastname?.trim()) {
        setNewCustomerError('Keresztnév és vezetéknév kötelező.')
        return
      }
    } else {
      if (!newCustomerForm.name?.trim()) {
        setNewCustomerError('A cég neve kötelező.')
        return
      }
    }
    setNewCustomerSaving(true)
    try {
      let id: string
      let type: 'person' | 'company'
      if (newCustomerType === 'person') {
        const res = await fetch('/api/customers/persons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstname: newCustomerForm.firstname.trim(),
            lastname: newCustomerForm.lastname.trim(),
            email: newCustomerForm.email?.trim() || null
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Hiba a személy létrehozásakor')
        id = data.person.id
        type = 'person'
      } else {
        const res = await fetch('/api/customers/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newCustomerForm.name.trim(),
            email: newCustomerForm.email?.trim() || null,
            telephone: newCustomerForm.telephone?.trim() || null
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Hiba a cég létrehozásakor')
        id = data.company.id
        type = 'company'
      }
      const prefillRes = await fetch(`/api/customers/order-prefill?type=${type}&id=${encodeURIComponent(id)}`)
      if (!prefillRes.ok) throw new Error('Prefill failed')
      const prefillData = await prefillRes.json()
      if (prefillData.type === 'person' && prefillData.entity) {
        setForm((f) => ({
          ...f,
          customer_person_id: prefillData.entity.id,
          customer_company_id: null,
          customer_company_name: '',
          customer_firstname: prefillData.entity.firstname ?? '',
          customer_lastname: prefillData.entity.lastname ?? '',
          customer_email: prefillData.entity.email ?? '',
          customer_phone: prefillData.entity.telephone ?? '',
          billing_firstname: prefillData.defaultBilling?.firstname ?? '',
          billing_lastname: prefillData.defaultBilling?.lastname ?? '',
          billing_company: prefillData.defaultBilling?.company ?? '',
          billing_address1: prefillData.defaultBilling?.address1 ?? '',
          billing_address2: prefillData.defaultBilling?.address2 ?? '',
          billing_city: prefillData.defaultBilling?.city ?? '',
          billing_postcode: prefillData.defaultBilling?.postcode ?? '',
          billing_country_code: prefillData.defaultBilling?.country_code ?? '',
          billing_tax_number: '',
          shipping_firstname: prefillData.defaultShipping?.firstname ?? '',
          shipping_lastname: prefillData.defaultShipping?.lastname ?? '',
          shipping_company: prefillData.defaultShipping?.company ?? '',
          shipping_address1: prefillData.defaultShipping?.address1 ?? '',
          shipping_address2: prefillData.defaultShipping?.address2 ?? '',
          shipping_city: prefillData.defaultShipping?.city ?? '',
          shipping_postcode: prefillData.defaultShipping?.postcode ?? '',
          shipping_country_code: prefillData.defaultShipping?.country_code ?? ''
        }))
      }
      if (prefillData.type === 'company' && prefillData.entity) {
        setForm((f) => ({
          ...f,
          customer_person_id: null,
          customer_company_id: prefillData.entity.id,
          customer_company_name: prefillData.entity.name ?? '',
          customer_firstname: '',
          customer_lastname: '',
          customer_email: prefillData.entity.email ?? '',
          customer_phone: prefillData.entity.telephone ?? '',
          billing_firstname: prefillData.defaultBilling?.firstname ?? '',
          billing_lastname: prefillData.defaultBilling?.lastname ?? '',
          billing_company: prefillData.defaultBilling?.company ?? prefillData.entity.name ?? '',
          billing_address1: prefillData.defaultBilling?.address1 ?? '',
          billing_address2: prefillData.defaultBilling?.address2 ?? '',
          billing_city: prefillData.defaultBilling?.city ?? '',
          billing_postcode: prefillData.defaultBilling?.postcode ?? '',
          billing_country_code: prefillData.defaultBilling?.country_code ?? '',
          billing_tax_number: prefillData.entity.tax_number ?? '',
          shipping_firstname: prefillData.defaultShipping?.firstname ?? '',
          shipping_lastname: prefillData.defaultShipping?.lastname ?? '',
          shipping_company: prefillData.defaultShipping?.company ?? '',
          shipping_address1: prefillData.defaultShipping?.address1 ?? '',
          shipping_address2: prefillData.defaultShipping?.address2 ?? '',
          shipping_city: prefillData.defaultShipping?.city ?? '',
          shipping_postcode: prefillData.defaultShipping?.postcode ?? '',
          shipping_country_code: prefillData.defaultShipping?.country_code ?? ''
        }))
      }
      setNewCustomerModalOpen(false)
      toast.success(newCustomerType === 'person' ? 'Személy létrehozva és hozzárendelve a rendeléshez.' : 'Cég létrehozva és hozzárendelve a rendeléshez.')
    } catch (e) {
      setNewCustomerError(e instanceof Error ? e.message : 'Hiba történt.')
      toast.error(e instanceof Error ? e.message : 'Hiba történt.')
    } finally {
      setNewCustomerSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_person_id: form.customer_person_id || null,
          customer_company_id: form.customer_company_id || null,
          customer_company_name: form.customer_company_name || null,
          customer_firstname: form.customer_firstname || null,
          customer_lastname: form.customer_lastname || null,
          customer_email: form.customer_email || null,
          customer_phone: form.customer_phone || null,
          billing_firstname: form.billing_firstname,
          billing_lastname: form.billing_lastname,
          billing_company: form.billing_company || null,
          billing_address1: form.billing_address1,
          billing_address2: form.billing_address2 || null,
          billing_city: form.billing_city,
          billing_postcode: form.billing_postcode,
          billing_country_code: form.billing_country_code || null,
          billing_tax_number: isCustomerCompany ? (form.billing_tax_number || null) : null,
          shipping_firstname: form.shipping_firstname,
          shipping_lastname: form.shipping_lastname,
          shipping_company: form.shipping_company || null,
          shipping_address1: form.shipping_address1,
          shipping_address2: form.shipping_address2 || null,
          shipping_city: form.shipping_city,
          shipping_postcode: form.shipping_postcode,
          shipping_country_code: form.shipping_country_code || null,
          shipping_method_id: form.shipping_method_id || null,
          tracking_number: form.tracking_number || null,
          expected_delivery_date: form.expected_delivery_date || null,
          payment_method_id: form.payment_method_id || null,
          payment_method_name: form.payment_method_name || null,
          payment_method_after: form.payment_method_after,
          payment_status: form.payment_status
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Hiba a mentés során')
      }
      toast.success('Rendelés mentve')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba a mentés során')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      {/* Sticky header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          pb: 2,
          mb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              {order.order_number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Létrehozva: {formatDate(order.order_date)}
              {connectionName != null && ` · Forrás: ${sourceLabel}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {order.status === 'new' ? (() => {
              const fulfillStyle = getFulfillabilityDisplayStyle(order.fulfillability_status)
              const FulfillIcon = fulfillStyle.label === 'Csomagolható' ? CheckCircleIcon
                : fulfillStyle.label === 'Hiány' ? ErrorIcon
                : fulfillStyle.label === 'Beszerzés alatt' ? LocalShippingIcon
                : ScheduleIcon
              return (
              <Tooltip title={`Új · ${fulfillStyle.label}`}>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    border: '1px solid',
                    padding: '4px 10px',
                    borderRadius: 1,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    ...fulfillStyle.chipStyle,
                    '&:hover': { opacity: 0.92 }
                  }}
                >
                  <FulfillIcon sx={{ fontSize: 18 }} />
                  {fulfillStyle.label}
                </Box>
              </Tooltip>
              )
            })() : (
              <>
                <Chip
                  label={ORDER_STATUS_LABELS[order.status] || order.status}
                  color={ORDER_STATUS_COLORS[order.status] || 'default'}
                  variant="outlined"
                  size="small"
                />
                {pickBatch && (
                  <Link component={NextLink} href={`/pick-batches/${pickBatch.id}`} variant="body2" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                    Begyűjtés: {pickBatch.code}
                  </Link>
                )}
              </>
            )}
            {order.status === 'new' &&
              (order.fulfillability_status === 'not_fulfillable' || order.fulfillability_status === 'partially_fulfillable') && (
              <Button
                component={NextLink}
                href={`/replenishment?order_id=${order.id}`}
                variant="outlined"
                size="small"
                startIcon={<LocalShippingIcon />}
                sx={{ height: 32 }}
              >
                Hiány pótlása
              </Button>
            )}
            {order.status === 'new' && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                sx={{ height: 32 }}
                disabled={recheckingFulfillability}
                onClick={async () => {
                  setRecheckingFulfillability(true)
                  try {
                    const res = await fetch(`/api/orders/${order.id}/recheck-fulfillability`, { method: 'POST' })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      toast.error(data.error || 'Készlet újraellenőrzés sikertelen')
                      return
                    }
                    toast.success('Készlet frissítve')
                    router.refresh()
                  } catch {
                    toast.error('Készlet újraellenőrzés sikertelen')
                  } finally {
                    setRecheckingFulfillability(false)
                  }
                }}
              >
                Készlet újraellenőrzése
              </Button>
            )}
            {!isTerminalStatus(order.status) && getAllowedNextStatus(order.status).length > 0 && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value=""
                  displayEmpty
                  onChange={async (e) => {
                    const nextStatus = e.target.value as string
                    if (!nextStatus) return
                    setStatusChanging(true)
                    try {
                      const res = await fetch(`/api/orders/${order.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: nextStatus })
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        toast.error(data.error || 'Állapotváltás sikertelen')
                        return
                      }
                      toast.success('Állapot frissítve')
                      router.refresh()
                    } finally {
                      setStatusChanging(false)
                    }
                  }}
                  disabled={statusChanging}
                  sx={{ height: 32, fontSize: '0.875rem' }}
                >
                  <MenuItem value="" disabled>Állapot váltás…</MenuItem>
                  {getAllowedNextStatus(order.status).map((s) => (
                    <MenuItem key={s} value={s}>
                      {ORDER_STATUS_LABELS[s] || s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {(order.status === 'picked' || order.status === 'packing') && (
              <Button
                component={NextLink}
                href={`/pack/orders/${order.id}`}
                variant="contained"
                color="primary"
                size="small"
              >
                Csomagolás
              </Button>
            )}
            <Chip
              label={PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
              variant="outlined"
              size="small"
              color={order.payment_status === 'paid' ? 'success' : 'default'}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Mentés...' : 'Mentés'}
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* 1. Rendelési adatok — at top */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: 'white',
            border: '2px solid',
            borderColor: SECTION_COLORS.info.main,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <SectionHeader icon={InfoIcon} title="Rendelési adatok" colorKey="info" />
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <InfoRow icon={TagIcon} label="Rendelésszám" value={order.order_number} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <InfoRow icon={EventIcon} label="Létrehozva" value={formatDate(order.order_date)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <InfoRow icon={StoreIcon} label="Forrás" value={connectionName ? sourceLabel : 'Webshop'} iconColor={SECTION_COLORS.info.dark} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <InfoRow icon={MonetizationOnIcon} label="Összesen" value={formatCurrency(order.total_gross, order.currency_code)} iconColor={SECTION_COLORS.info.main} />
            </Grid>
            {order.customer_comment && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" display="block">Megjegyzés</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{order.customer_comment}</Typography>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* 2. Vevő — customer + billing (one card) */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: 'white',
            border: '2px solid',
            borderColor: SECTION_COLORS.customer.main,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <SectionHeader icon={PersonIcon} title="Vevő" colorKey="customer" titleVariant="h5" />

          {/* Search bar on top */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Autocomplete
                open={customerSearchOpen}
                onOpen={() => setCustomerSearchOpen(true)}
                onClose={() => setCustomerSearchOpen(false)}
                inputValue={customerSearchQuery}
                onInputChange={(_, v) => setCustomerSearchQuery(v)}
                options={customerOptions}
                getOptionLabel={(opt) => opt?.label ?? ''}
                value={null}
                onChange={handleCustomerSelect}
                loading={customerSearchLoading || customerPrefillLoading}
                sx={{ flex: '1 1 280px', minWidth: 0 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Vevő vagy cég keresése"
                    placeholder="Név vagy e-mail (min. 2 karakter)"
                    sx={inputSx}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {customerSearchLoading || customerPrefillLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
                renderOption={(props, opt) => (
                  <li {...props} key={opt.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {opt.type === 'company' ? <BusinessIcon fontSize="small" color="action" /> : <PersonIcon fontSize="small" color="action" />}
                      <Box>
                        <Typography variant="body2">{opt.label}</Typography>
                        {opt.email && <Typography variant="caption" color="text.secondary">{opt.email}</Typography>}
                      </Box>
                    </Box>
                  </li>
                )}
              />
              <Button size="small" variant="outlined" startIcon={<AddIcon />} sx={{ flexShrink: 0 }} onClick={openNewCustomerModal}>
                Új vevő
              </Button>
            </Box>
          </Box>

          {/* Two columns: Vevő adatok (left) | Számlázási adatok (right) */}
          <Grid container spacing={2}>
            {/* Left: Vevő adatok */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(46, 125, 50, 0.04)',
                  border: '1px solid',
                  borderColor: 'rgba(46, 125, 50, 0.2)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.15rem', color: SECTION_COLORS.customer.dark }}>
                    Vevő adatok
                  </Typography>
                  {!customerEditOpen && (
                    <IconButton size="small" onClick={() => setCustomerEditOpen(true)} aria-label="Vevő adatok szerkesztése">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              {!customerEditOpen ? (
                <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.25 }}>
                  {form.customer_company_id ? (
                    <>
                      <DisplayRow label="Cég neve" value={form.customer_company_name || '—'} />
                      <DisplayRow label="E-mail" value={form.customer_email || '—'} />
                      <DisplayRow label="Telefon" value={form.customer_phone || '—'} />
                    </>
                  ) : (
                    <>
                      <DisplayRow label="Keresztnév" value={form.customer_firstname || '—'} />
                      <DisplayRow label="Vezetéknév" value={form.customer_lastname || '—'} />
                      <DisplayRow label="E-mail" value={form.customer_email || '—'} />
                      <DisplayRow label="Telefon" value={form.customer_phone || '—'} />
                    </>
                  )}
                  {(form.customer_person_id || form.customer_company_id) && (
                    <Box sx={{ mt: 1 }}>
                      <Link
                        component={NextLink}
                        href={form.customer_company_id ? `/customers/companies/${form.customer_company_id}` : `/customers/persons/${form.customer_person_id}`}
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
                      >
                        {form.customer_company_id ? 'Cég megtekintése' : 'Személy megtekintése'} <OpenInNewIcon fontSize="small" />
                      </Link>
                    </Box>
                  )}
                  {!form.customer_person_id && !form.customer_company_id && !form.customer_firstname && !form.customer_company_name && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Vendég rendelés — válassz vevőt fent vagy hozz létre újat.</Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  {!form.customer_company_id && (
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Keresztnév" value={form.customer_firstname} onChange={(e) => setForm((f) => ({ ...f, customer_firstname: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Vezetéknév" value={form.customer_lastname} onChange={(e) => setForm((f) => ({ ...f, customer_lastname: e.target.value }))} sx={inputSx} />
                      </Grid>
                    </Grid>
                  )}
                  {form.customer_company_id && (
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Cég neve" value={form.customer_company_name} onChange={(e) => setForm((f) => ({ ...f, customer_company_name: e.target.value }))} sx={inputSx} />
                      </Grid>
                    </Grid>
                  )}
                  <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="E-mail" type="email" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} sx={inputSx} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Telefon" value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} sx={inputSx} />
                    </Grid>
                    <Grid item xs={12}>
                      <Button size="small" variant="text" onClick={() => setCustomerEditOpen(false)}>Kész</Button>
                    </Grid>
                  </Grid>
                </Box>
              )}
              </Box>
            </Grid>

            {/* Right: Számlázási adatok */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(0, 131, 143, 0.06)',
                  border: '1px solid',
                  borderColor: 'rgba(0, 131, 143, 0.2)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.15rem', color: SECTION_COLORS.billing.dark }}>
                    Számlázási adatok
                  </Typography>
                  {!billingEditOpen && (
                    <IconButton size="small" onClick={() => setBillingEditOpen(true)} aria-label="Számlázási cím szerkesztése">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              {!billingEditOpen ? (
                <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.25 }}>
                  <DisplayRow label="Név" value={form.billing_company || [form.billing_firstname, form.billing_lastname].filter(Boolean).join(' ').trim() || '—'} />
                  <DisplayRow label="Ország" value={COUNTRY_OPTIONS.find((c) => c.code === form.billing_country_code)?.label ?? form.billing_country_code || '—'} />
                  <DisplayRow label="Irányítószám" value={form.billing_postcode || '—'} />
                  <DisplayRow label="Település" value={form.billing_city || '—'} />
                  <DisplayRow label="Utca" value={[form.billing_address1, form.billing_address2].filter(Boolean).join(', ') || '—'} />
                  <DisplayRow label="Adószám" value={form.billing_tax_number || '—'} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button size="small" variant="text" onClick={copyBillingFromShipping}>Másolás a szállítási címről</Button>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small" sx={inputSx}>
                        <InputLabel>Ország</InputLabel>
                        <Select
                          value={form.billing_country_code || ''}
                          label="Ország"
                          onChange={(e) => setForm((f) => ({ ...f, billing_country_code: e.target.value || '' }))}
                          renderValue={(v) => COUNTRY_OPTIONS.find((c) => c.code === v)?.label ?? v || ''}
                        >
                          <MenuItem value="">—</MenuItem>
                          {COUNTRY_OPTIONS.map((c) => (
                            <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                          ))}
                          {form.billing_country_code && !COUNTRY_OPTIONS.some((c) => c.code === form.billing_country_code) && (
                            <MenuItem value={form.billing_country_code}>{form.billing_country_code}</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Irányítószám" value={form.billing_postcode} onChange={(e) => setForm((f) => ({ ...f, billing_postcode: e.target.value }))} sx={inputSx} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Város" value={form.billing_city} onChange={(e) => setForm((f) => ({ ...f, billing_city: e.target.value }))} sx={inputSx} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Utca, házszám" value={form.billing_address1} onChange={(e) => setForm((f) => ({ ...f, billing_address1: e.target.value }))} sx={inputSx} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Cím 2 (opcionális)" value={form.billing_address2} onChange={(e) => setForm((f) => ({ ...f, billing_address2: e.target.value }))} sx={inputSx} placeholder="Emelet, ajtó" />
                    </Grid>
                    {isCustomerCompany && (
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Adószám" value={form.billing_tax_number} onChange={(e) => setForm((f) => ({ ...f, billing_tax_number: e.target.value }))} sx={inputSx} />
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <Button size="small" variant="text" onClick={() => setBillingEditOpen(false)}>Kész</Button>
                    </Grid>
                  </Grid>
                </Box>
              )}
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* 2. Fizetési és szállítási adatok — same vibe as Vevő: display by default, Szerkesztés toggles form */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: 'white',
            border: '2px solid',
            borderColor: SECTION_COLORS.payment.main,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <SectionHeader icon={PaymentIcon} title="Fizetési és szállítási adatok" colorKey="payment" />
          <Grid container spacing={2}>
            {/* Left: Szállítási adatok (same layout as Vevő adatok — title + Szerkesztés in header) */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(239, 108, 0, 0.04)',
                  border: '1px solid',
                  borderColor: 'rgba(239, 108, 0, 0.2)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.15rem', color: SECTION_COLORS.shipping.dark }}>
                    Szállítási adatok
                  </Typography>
                  {!shippingEditOpen && (
                    <IconButton size="small" onClick={() => setShippingEditOpen(true)} aria-label="Szállítási adatok szerkesztése">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                {!shippingEditOpen ? (
                  <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.25 }}>
                    <DisplayRow label="Szállítási mód" value={form.shipping_method_name || shippingMethods.find((m) => m.id === form.shipping_method_id)?.name || '—'} />
                    <DisplayRow label="Átvevő" value={[form.shipping_firstname, form.shipping_lastname].filter(Boolean).join(' ') || form.shipping_company || '—'} />
                    <DisplayRow label="Cím" value={[form.shipping_city, form.shipping_postcode, form.shipping_address1, form.shipping_address2].filter(Boolean).join(', ') || '—'} />
                    <DisplayRow label="Követőszám" value={form.tracking_number || '—'} />
                    <DisplayRow label="Várható kézbesítés" value={form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString('hu-HU') : '—'} />
                  </Box>
                ) : (
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControl fullWidth size="small" sx={inputSx}>
                          <InputLabel>Szállítási mód</InputLabel>
                          <Select
                            value={form.shipping_method_id}
                            label="Szállítási mód"
                            onChange={(e) => {
                              const id = e.target.value as string
                              const m = shippingMethods.find((x) => x.id === id)
                              setForm((f) => ({ ...f, shipping_method_id: id, shipping_method_name: m?.name ?? '' }))
                            }}
                          >
                            <MenuItem value="">—</MenuItem>
                            {shippingMethods.map((m) => (
                              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Átvevő – Keresztnév" value={form.shipping_firstname} onChange={(e) => setForm((f) => ({ ...f, shipping_firstname: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Átvevő – Vezetéknév" value={form.shipping_lastname} onChange={(e) => setForm((f) => ({ ...f, shipping_lastname: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Cég (opcionális)" value={form.shipping_company} onChange={(e) => setForm((f) => ({ ...f, shipping_company: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small" sx={inputSx}>
                          <InputLabel>Ország</InputLabel>
                          <Select
                            value={form.shipping_country_code || ''}
                            label="Ország"
                            onChange={(e) => setForm((f) => ({ ...f, shipping_country_code: e.target.value || '' }))}
                            renderValue={(v) => COUNTRY_OPTIONS.find((c) => c.code === v)?.label ?? v || ''}
                          >
                            <MenuItem value="">—</MenuItem>
                            {COUNTRY_OPTIONS.map((c) => (
                              <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                            ))}
                            {form.shipping_country_code && !COUNTRY_OPTIONS.some((c) => c.code === form.shipping_country_code) && (
                              <MenuItem value={form.shipping_country_code}>{form.shipping_country_code}</MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Irányítószám" value={form.shipping_postcode} onChange={(e) => setForm((f) => ({ ...f, shipping_postcode: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Város" value={form.shipping_city} onChange={(e) => setForm((f) => ({ ...f, shipping_city: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Cím" value={form.shipping_address1} onChange={(e) => setForm((f) => ({ ...f, shipping_address1: e.target.value }))} sx={inputSx} placeholder="Utca, házszám" />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Cím 2 (opcionális)" value={form.shipping_address2} onChange={(e) => setForm((f) => ({ ...f, shipping_address2: e.target.value }))} sx={inputSx} placeholder="Emelet, ajtó" />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Követőszám" value={form.tracking_number} onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Várható kézbesítés" type="date" value={formatDateOnly(form.expected_delivery_date)} onChange={(e) => setForm((f) => ({ ...f, expected_delivery_date: e.target.value || null }))} InputLabelProps={{ shrink: true }} sx={inputSx} />
                      </Grid>
                      <Grid item xs={12}>
                        <Button size="small" variant="text" onClick={() => setShippingEditOpen(false)}>Kész</Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Right: Fizetési adatok (title + Szerkesztés in header; Fizetési státusz as Chip) */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(21, 101, 192, 0.04)',
                  border: '1px solid',
                  borderColor: 'rgba(21, 101, 192, 0.2)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.15rem', color: SECTION_COLORS.payment.dark }}>
                    Fizetési adatok
                  </Typography>
                  {!paymentEditOpen && (
                    <IconButton size="small" onClick={() => setPaymentEditOpen(true)} aria-label="Fizetési adatok szerkesztése">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                {!paymentEditOpen ? (
                  <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.25 }}>
                    <DisplayRow label="Fizetési mód" value={form.payment_method_name || paymentMethods.find((m) => m.id === form.payment_method_id)?.name || '—'} />
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                      <Typography component="dt" variant="body1" sx={{ minWidth: 110, color: 'text.secondary', fontSize: '0.95rem' }}>
                        Fizetési státusz
                      </Typography>
                      <Typography component="dd" variant="body1" sx={{ m: 0, fontWeight: 600, color: 'text.primary', fontSize: '1.05rem' }}>
                        <Chip
                          size="small"
                          label={PAYMENT_STATUS_LABELS[form.payment_status] || form.payment_status}
                          color={PAYMENT_STATUS_COLORS[form.payment_status] || 'default'}
                          variant="filled"
                          sx={{ fontWeight: 600 }}
                        />
                      </Typography>
                    </Box>
                    <DisplayRow label="Összesen" value={formatCurrency(order.total_gross, order.currency_code)} />
                  </Box>
                ) : (
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControl fullWidth size="small" sx={inputSx}>
                          <InputLabel>Fizetési mód</InputLabel>
                          <Select
                            value={form.payment_method_id}
                            label="Fizetési mód"
                            onChange={(e) => {
                              const id = e.target.value as string
                              const m = paymentMethods.find((x) => x.id === id)
                              setForm((f) => ({ ...f, payment_method_id: id, payment_method_name: m?.name ?? '' }))
                            }}
                          >
                            <MenuItem value="">—</MenuItem>
                            {paymentMethods.map((m) => (
                              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <FormControl fullWidth size="small" sx={inputSx}>
                          <InputLabel>Fizetési státusz</InputLabel>
                          <Select
                            value={form.payment_status}
                            label="Fizetési státusz"
                            onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value as string }))}
                          >
                            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                              <MenuItem key={k} value={k}>{v}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <Button size="small" variant="text" onClick={() => setPaymentEditOpen(false)}>Kész</Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* 3. Tételek */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            bgcolor: 'white',
            border: '2px solid',
            borderColor: SECTION_COLORS.items.main,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <SectionHeader icon={ShoppingCartIcon} title="Tételek" colorKey="items" />
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Autocomplete
              sx={{ minWidth: 280, flexGrow: 1 }}
              options={productSearchResults}
              getOptionLabel={(option) => `${option.product_name} (${option.product_sku})`}
              loading={productSearching}
              value={selectedProduct}
              inputValue={productSearchTerm}
              onInputChange={(_, newValue) => setProductSearchTerm(newValue)}
              onChange={(_, newValue) => {
                if (newValue) {
                  addItemFromProduct(newValue)
                  setSelectedProduct(null)
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Új tétel: keresés termék név vagy SKU (min. 2 karakter)"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <>
                        {productSearching ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.product_id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.product_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        SKU: {option.product_sku} · Bruttó ár: {formatCurrency(option.gross_price ?? option.price ?? 0, order.currency_code)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
              noOptionsText={productSearchTerm.length < 2 ? 'Írjon be legalább 2 karaktert' : 'Nincs találat'}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              onClick={saveItems}
              disabled={itemsSaving || items.length === 0}
            >
              {itemsSaving ? 'Mentés…' : 'Tételek mentése'}
            </Button>
          </Box>
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Termék</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, width: 96 }}>Mennyiség</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, width: 88 }}>Elérhető</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Egységár (bruttó)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, width: 100 }}>ÁFA %</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Kedvezmény</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Összesen</TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      Nincs tétel. Keressen terméket a fenti mezőben az új tétel hozzáadásához.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const lineGross = item.quantity * item.unit_price_gross
                    const itemDiscount = item.discount_mode === 'percent'
                      ? lineGross * (item.discount_value || 0) / 100
                      : (item.discount_value || 0)
                    const lineTotal = Math.max(0, lineGross - itemDiscount)
                    return (
                      <TableRow key={item.id ?? `new-${index}`}>
                        <TableCell>{item.product_name || '-'}</TableCell>
                        <TableCell>{item.product_sku || '-'}</TableCell>
                        <TableCell align="right" sx={{ width: 96 }}>
                          <TextField
                            type="number"
                            size="small"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            inputProps={{ min: 1, style: { textAlign: 'right', width: 48 } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ width: 88 }}>
                          {(() => {
                            const pid = item.product_id ?? itemAvailabilitySkuToId[item.product_sku ?? '']
                            const av = pid ? itemAvailability[pid] : null
                            if (av == null) return <Typography variant="body2" color="text.secondary">—</Typography>
                            const needed = item.quantity
                            const available = av.quantity_available ?? 0
                            const reserved = av.quantity_reserved ?? 0
                            const color =
                              available >= needed ? 'success.main'
                              : available > 0 ? 'warning.main'
                              : 'error.main'
                            const title = `Elérhető: ${av.quantity_available} · Készleten: ${av.quantity_on_hand} · Foglalt: ${reserved} · Érkezik: ${av.quantity_incoming}`
                            return (
                              <Tooltip title={title} placement="left">
                                <Typography variant="body2" sx={{ fontWeight: 600, cursor: 'default', color }}>
                                  {av.quantity_available}
                                </Typography>
                              </Tooltip>
                            )
                          })()}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={item.unit_price_gross}
                            onChange={(e) => updateItem(index, 'unit_price_gross', Math.max(0, parseFloat(e.target.value) || 0))}
                            inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right', width: 88 } }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <FormControl size="small" sx={{ minWidth: 96, width: 96 }}>
                            <Select
                              value={vatRates.some(v => v.kulcs === item.tax_rate) ? item.tax_rate : (vatRates[0]?.kulcs ?? item.tax_rate)}
                              onChange={(e) => updateItem(index, 'tax_rate', Number(e.target.value))}
                              displayEmpty
                              renderValue={(v) => (v != null && v !== '' ? `${v}%` : '')}
                            >
                              {vatRates.map((v) => (
                                <MenuItem key={v.id} value={v.kulcs}>{v.kulcs}%</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {(item.discount_value ?? 0) > 0 ? (
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, '&:hover': { color: 'primary.main' } }}
                                onClick={() => { setItemDiscountModalRow(index); setItemDiscountModalMode(item.discount_mode); setItemDiscountModalValue(String(item.discount_value || '')); }}
                                title="Kedvezmény szerkesztése"
                              >
                                {item.discount_mode === 'percent' ? `${item.discount_value} %` : formatCurrency(item.discount_value, order.currency_code)}
                              </Typography>
                            ) : (
                              <>
                                <IconButton size="small" onClick={() => { setItemDiscountModalRow(index); setItemDiscountModalMode('percent'); setItemDiscountModalValue(''); }} aria-label="Kedvezmény %" title="Kedvezmény %">
                                  <PercentIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => { setItemDiscountModalRow(index); setItemDiscountModalMode('amount'); setItemDiscountModalValue(''); }} aria-label="Kedvezmény Ft" title="Kedvezmény Ft">
                                  <AttachMoneyIcon fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
                            {itemDiscount > 0 && (
                              <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                {formatCurrency(lineGross, order.currency_code)}
                              </Typography>
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatCurrency(lineTotal, order.currency_code)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => removeItem(index)} aria-label="Tétel törlése" color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Tétel kedvezmény modal */}
        <Dialog open={itemDiscountModalRow !== null} onClose={() => setItemDiscountModalRow(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Tétel kedvezmény</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ToggleButtonGroup
                  size="small"
                  value={itemDiscountModalMode}
                  exclusive
                  onChange={(_, v) => v && setItemDiscountModalMode(v)}
                >
                  <ToggleButton value="percent">%</ToggleButton>
                  <ToggleButton value="amount">Ft</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                autoFocus
                label={itemDiscountModalMode === 'percent' ? 'Százalék' : 'Összeg'}
                type="number"
                size="small"
                value={itemDiscountModalValue}
                onChange={(e) => setItemDiscountModalValue(e.target.value)}
                inputProps={{ min: 0, step: itemDiscountModalMode === 'percent' ? 1 : 0.01 }}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                if (itemDiscountModalRow !== null) {
                  const updated = items.map((it, i) =>
                    i === itemDiscountModalRow ? { ...it, discount_value: 0, discount_mode: 'amount' as const } : it
                  )
                  setItems(updated)
                  setItemDiscountModalRow(null)
                  saveItems(updated)
                }
              }}
              color="error"
              size="small"
            >
              Törlés
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setItemDiscountModalRow(null)} size="small">Mégse</Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                if (itemDiscountModalRow !== null) {
                  const val = Math.max(0, parseFloat(itemDiscountModalValue) || 0)
                  const updated = items.map((it, i) =>
                    i === itemDiscountModalRow ? { ...it, discount_value: val, discount_mode: itemDiscountModalMode } : it
                  )
                  setItems(updated)
                  setItemDiscountModalRow(null)
                  setItemDiscountModalValue('')
                  saveItems(updated)
                }
              }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* Összesítő kártya – 2 oszlop, teljes szélesség, kisebb magasság */}
        {(() => {
          const itemsWithLineTotals = items.map(it => {
            const lineGross = it.quantity * it.unit_price_gross
            const itemDisc = it.discount_mode === 'percent' ? lineGross * (it.discount_value || 0) / 100 : (it.discount_value || 0)
            const lineTotalGross = Math.max(0, lineGross - itemDisc)
            const lineTotalNet = it.tax_rate != null && it.tax_rate > 0 ? lineTotalGross / (1 + it.tax_rate / 100) : lineTotalGross
            return { ...it, lineGross, itemDisc, lineTotalGross, lineTotalNet }
          })
          const itemsDiscountTotal = itemsWithLineTotals.reduce((sum, it) => sum + it.itemDisc, 0)
          const grossBeforeItemDiscount = itemsWithLineTotals.reduce((sum, it) => sum + it.lineGross, 0)
          const itemsSubtotalGross = itemsWithLineTotals.reduce((sum, it) => sum + it.lineTotalGross, 0)
          const itemsSubtotalNet = itemsWithLineTotals.reduce((sum, it) => sum + it.lineTotalNet, 0)
          const itemsTax = itemsSubtotalGross - itemsSubtotalNet
          const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0)
          const effectiveOrderDiscount = orderDiscountMode === 'percent'
            ? itemsSubtotalGross * (orderDiscountValue || 0) / 100
            : (orderDiscountValue || 0)
          const discountAmount = Math.min(effectiveOrderDiscount, itemsSubtotalGross)
          const discountPercent = itemsSubtotalGross > 0 ? (discountAmount / itemsSubtotalGross) * 100 : 0
          const shippingGross = parseFloat(String((order as any).shipping_total_gross)) || 0
          const shippingNet = parseFloat(String((order as any).shipping_total_net)) || 0
          const paymentGross = parseFloat(String((order as any).payment_total_gross)) || 0
          const paymentNet = parseFloat(String((order as any).payment_total_net)) || 0
          const afterDiscountGross = Math.max(0, itemsSubtotalGross - discountAmount)
          const afterDiscountNet = itemsSubtotalGross > 0
            ? Math.max(0, itemsSubtotalNet - (discountAmount * itemsSubtotalNet / itemsSubtotalGross))
            : itemsSubtotalNet
          const orderTotalGross = Math.round((afterDiscountGross + shippingGross + paymentGross) * 100) / 100
          const orderTotalNet = Math.round((afterDiscountNet + shippingNet + paymentNet) * 100) / 100
          const orderTax = Math.round((orderTotalGross - orderTotalNet) * 100) / 100
          const summaryRowSx = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 0.5 }
          const summaryLabelSx = { color: 'text.secondary', fontSize: '0.875rem' }
          const summaryValueSx = { fontWeight: 600, fontSize: '0.875rem', textAlign: 'right' }
          const sectionSx = {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            borderTop: '1px solid',
            borderColor: 'divider',
            py: 1.5,
            px: 0
          }
          const sectionFirstSx = { ...sectionSx, borderTop: 'none', pt: 0 }
          const colSx = { display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minWidth: 0 }
          return (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mt: 2,
                bgcolor: 'white',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0, fontSize: '1rem', pb: 1.5 }}>
                Összesítő
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={colSx}>
                  <Box sx={sectionFirstSx}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', letterSpacing: 1, display: 'block', mb: 0.75 }}>
                      Tételek
                    </Typography>
                    {itemsDiscountTotal > 0 && (
                      <>
                        <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Részösszeg (tétel kedv. előtt)</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(grossBeforeItemDiscount * 100) / 100, order.currency_code)}</Typography></Box>
                        <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Tételek kedvezmény (tételenként)</Typography><Typography sx={{ ...summaryValueSx, color: 'error.main' }}>−{formatCurrency(Math.round(itemsDiscountTotal * 100) / 100, order.currency_code)}</Typography></Box>
                      </>
                    )}
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Tételek nettó</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsSubtotalNet * 100) / 100, order.currency_code)}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Tételek ÁFA</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsTax * 100) / 100, order.currency_code)}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Tételek bruttó</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsSubtotalGross * 100) / 100, order.currency_code)}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Összsúly</Typography><Typography sx={summaryValueSx}>0 kg</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Össz. térfogat</Typography><Typography sx={summaryValueSx}>0 cm³</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Tételszám</Typography><Typography sx={summaryValueSx}>{items.length}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Össz. mennyiség</Typography><Typography sx={summaryValueSx}>{totalQuantity}</Typography></Box>
                  </Box>
                  <Box sx={sectionSx}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', letterSpacing: 1, display: 'block', mb: 0.75 }}>
                      Részösszeg (kedvezmény nélkül)
                    </Typography>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Nettó összesen</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsSubtotalNet * 100) / 100, order.currency_code)}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>ÁFA összesen</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsTax * 100) / 100, order.currency_code)}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Bruttó összesen</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsSubtotalGross * 100) / 100, order.currency_code)}</Typography></Box>
                  </Box>
                </Box>
                <Box sx={colSx}>
                  <Box sx={sectionFirstSx}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', letterSpacing: 1, display: 'block', mb: 0.75 }}>
                      Rendelés kedvezmény
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, py: 0.5 }}>
                      <Typography sx={summaryLabelSx}>Kedvezmény</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          value={orderDiscountValue || ''}
                          onChange={(e) => setOrderDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                          onBlur={handleOrderDiscountBlur}
                          inputProps={{ min: 0, step: orderDiscountMode === 'percent' ? 1 : 0.01, style: { textAlign: 'right', width: 64 } }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                        <ToggleButtonGroup
                          size="small"
                          value={orderDiscountMode}
                          exclusive
                          onChange={(_, v) => v && setOrderDiscountMode(v)}
                          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.5, fontSize: '0.75rem' } }}
                        >
                          <ToggleButton value="percent">%</ToggleButton>
                          <ToggleButton value="amount">Ft</ToggleButton>
                        </ToggleButtonGroup>
                      </Box>
                    </Box>
                    {discountAmount > 0 && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Alap (tételek bruttó)</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(itemsSubtotalGross * 100) / 100, order.currency_code)}</Typography></Box>
                        <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Rendelés kedvezmény</Typography><Typography sx={{ ...summaryValueSx, color: 'error.main', fontWeight: 700 }}>−{formatCurrency(Math.round(discountAmount * 100) / 100, order.currency_code)}</Typography></Box>
                        <Box sx={{ ...summaryRowSx, pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}><Typography sx={summaryLabelSx}>Kedvezmény után (bruttó)</Typography><Typography sx={summaryValueSx}>{formatCurrency(Math.round(afterDiscountGross * 100) / 100, order.currency_code)}</Typography></Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{orderDiscountMode === 'percent' ? `${Math.round(orderDiscountValue)} %` : formatCurrency(orderDiscountValue, order.currency_code)}</Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ ...sectionSx, bgcolor: 'action.hover', borderRadius: 1, px: 1.5, mt: 0 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', letterSpacing: 1, display: 'block', mb: 0.75 }}>
                      Végső összesen
                    </Typography>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>Nettó összesen</Typography><Typography sx={summaryValueSx}>{formatCurrency(orderTotalNet, order.currency_code)}</Typography></Box>
                    <Box sx={summaryRowSx}><Typography sx={summaryLabelSx}>ÁFA összesen</Typography><Typography sx={summaryValueSx}>{formatCurrency(orderTax, order.currency_code)}</Typography></Box>
                    <Box sx={{ ...summaryRowSx, pt: 0.75, borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }}>
                      <Typography sx={{ ...summaryLabelSx, fontWeight: 700 }}>Bruttó összesen</Typography>
                      <Typography sx={{ ...summaryValueSx, fontWeight: 700, fontSize: '1rem' }}>{formatCurrency(orderTotalGross, order.currency_code)}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )
        })()}

        {/* Új vevő modal */}
        <Dialog open={newCustomerModalOpen} onClose={() => !newCustomerSaving && setNewCustomerModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Új vevő</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Típus</Typography>
                <ToggleButtonGroup
                  value={newCustomerType}
                  exclusive
                  onChange={(_, v) => v != null && setNewCustomerType(v)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="person">Személy</ToggleButton>
                  <ToggleButton value="company">Cég</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {newCustomerType === 'person' ? (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    label="Keresztnév"
                    required
                    value={newCustomerForm.firstname}
                    onChange={(e) => setNewCustomerForm((f) => ({ ...f, firstname: e.target.value }))}
                    sx={inputSx}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Vezetéknév"
                    required
                    value={newCustomerForm.lastname}
                    onChange={(e) => setNewCustomerForm((f) => ({ ...f, lastname: e.target.value }))}
                    sx={inputSx}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="E-mail"
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm((f) => ({ ...f, email: e.target.value }))}
                    sx={inputSx}
                  />
                </>
              ) : (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    label="Cég neve"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm((f) => ({ ...f, name: e.target.value }))}
                    sx={inputSx}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="E-mail"
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm((f) => ({ ...f, email: e.target.value }))}
                    sx={inputSx}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Telefon"
                    value={newCustomerForm.telephone}
                    onChange={(e) => setNewCustomerForm((f) => ({ ...f, telephone: e.target.value }))}
                    sx={inputSx}
                  />
                </>
              )}
              {newCustomerError && (
                <Typography variant="body2" color="error">{newCustomerError}</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setNewCustomerModalOpen(false)} disabled={newCustomerSaving}>
              Mégse
            </Button>
            <Button variant="contained" onClick={handleNewCustomerSubmit} disabled={newCustomerSaving}>
              {newCustomerSaving ? 'Létrehozás...' : 'Hozzáadás'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  )
}
