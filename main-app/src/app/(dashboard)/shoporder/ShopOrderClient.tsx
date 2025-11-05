'use client'

import React, { useState, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete, Divider, Button, Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ExpandMore as ExpandMoreIcon, Clear as ClearIcon, Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

// Types
interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
  created_at: string
  updated_at: string
}

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

interface Accessory {
  id: string
  name: string
  sku: string
  net_price: number
  base_price: number
  multiplier: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  vat_percent: number
  vat_amount: number
  gross_price: number
  unit_name: string
  unit_shortform: string
  currency_name: string
  partner_name: string
  source?: string
  type?: string
}

interface Material {
  id: string
  name: string
  sku: string
  type: string
  base_price: number
  multiplier: number
  net_price: number
  gross_price: number
  partners_id: string
  units_id: string
  currency_id: string
  vat_id: string
  partner_name: string
  unit_name: string
  unit_shortform: string
  currency_name: string
  vat_percent: number
  vat_amount: number
  brand_name: string
  dimensions: string
  source?: string
}

interface LinearMaterial {
  id: string
  name: string
  sku: string
  type: string
  base_price: number
  multiplier: number
  net_price: number
  gross_price: number
  partners_id: string
  units_id: string
  currency_id: string
  vat_id: string
  partner_name: string
  unit_name: string
  unit_shortform: string
  currency_name: string
  vat_percent: number
  vat_amount: number
  brand_name: string
  dimensions: string
  source?: string
}

type SearchableItem = Accessory | Material | LinearMaterial

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

interface Partner {
  id: string
  name: string
}

interface ProductItem {
  id: string
  name: string
  sku: string
  type: string
  base_price: number
  multiplier: number
  quantity: number
  net_price: number
  gross_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  megjegyzes: string
  brand_name?: string
  dimensions?: string
  source?: string
}

interface ShopOrderClientProps {
  workers: Worker[]
  customers: Customer[]
  accessories: Accessory[]
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
}

// Phone number formatting helper
const formatPhoneNumber = (value: string) => {
  if (!value) return ''
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // If it starts with 36, keep it as is, otherwise add 36
  let formatted = digits

  if (!digits.startsWith('36') && digits.length > 0) {
    formatted = '36' + digits
  }
  
  // Format: +36 30 999 2800
  if (formatted.length >= 2) {
    const countryCode = formatted.substring(0, 2)
    const areaCode = formatted.substring(2, 4)
    const firstPart = formatted.substring(4, 7)
    const secondPart = formatted.substring(7, 11)
    
    let result = `+${countryCode}`

    if (areaCode) result += ` ${areaCode}`
    if (firstPart) result += ` ${firstPart}`
    if (secondPart) result += ` ${secondPart}`
    
    return result
  }
  
  return value
}

// Hungarian tax number (adószám) formatting helper
const formatTaxNumber = (value: string) => {
  if (!value) return ''
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // Format: xxxxxxxx-y-zz (8 digits, 1 digit, 2 digits)
  if (digits.length <= 8) {
    return digits
  } else if (digits.length <= 9) {
    return `${digits.substring(0, 8)}-${digits.substring(8)}`
  } else if (digits.length <= 11) {
    return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9)}`
  } else {
    // Limit to 11 digits total
    return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9, 11)}`
  }
}

// Hungarian company registration number (cégjegyzékszám) formatting helper
const formatCompanyRegNumber = (value: string) => {
  if (!value) return ''
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // Format: xx-yy-zzzzzz (2 digits, 2 digits, 6 digits)
  if (digits.length <= 2) {
    return digits
  } else if (digits.length <= 4) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`
  } else if (digits.length <= 10) {
    return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4)}`
  } else {
    // Limit to 10 digits total
    return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 10)}`
  }
}

export default function ShopOrderClient({
  workers,
  customers,
  accessories,
  vatRates,
  currencies,
  units,
  partners
}: ShopOrderClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const shopOrderId = searchParams.get('shop_order_id')
  
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    mobile: '',
    discount: '0',
    billing_name: '',
    billing_country: 'Magyarország',
    billing_city: '',
    billing_postal_code: '',
    billing_street: '',
    billing_house_number: '',
    billing_tax_number: '',
    billing_company_reg_number: ''
  })
  
  // Product state
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null)
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [accessoryData, setAccessoryData] = useState({
    name: '',
    sku: '',
    type: '',
    base_price: '',
    multiplier: 1.38,
    net_price: 0,
    gross_price: 0,
    vat_id: '',
    currency_id: '',
    units_id: '',
    partners_id: '',
    quantity: 1 as number | '',
    megjegyzes: '',
    brand_name: '',
    dimensions: ''
  })
  const [productsTable, setProductsTable] = useState<ProductItem[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedOrderNumber, setSavedOrderNumber] = useState<string | null>(null)

  // Get default values
  const defaultVat = vatRates.find(v => v.kulcs === 27) || vatRates[0]
  const defaultCurrency = currencies.find(c => c.name === 'HUF') || currencies[0]
  const defaultUnit = units.find(u => u.shortform === 'db') || units[0]
  const szalUnit = units.find(u => u.name === 'Szál') || defaultUnit

  // Initialize accessory data with defaults
  React.useEffect(() => {
    if (defaultVat && defaultCurrency && defaultUnit) {
      setAccessoryData(prev => ({
        ...prev,
        vat_id: defaultVat.id,
        currency_id: defaultCurrency.id,
        units_id: defaultUnit.id
      }))
    }
  }, [defaultVat, defaultCurrency, defaultUnit])

  // Load data from session storage on component mount
  React.useEffect(() => {
    const loadSessionData = () => {
      try {
        const sessionData = sessionStorage.getItem('shopOrderData')
        if (sessionData) {
          const data = JSON.parse(sessionData)
          
          // Check if data is not expired (5 minutes = 300000ms)
          if (data.timestamp && (Date.now() - data.timestamp) < 300000) {
            if (data.selectedWorker) {
              setSelectedWorker(data.selectedWorker)
            }
            if (data.customerData) {
              setCustomerData(data.customerData)
            }
            if (data.selectedCustomer) {
              setSelectedCustomer(data.selectedCustomer)
            }
            if (data.productsTable) {
              setProductsTable(data.productsTable)
            }
            if (data.accessoryData) {
              setAccessoryData(data.accessoryData)
            }
            if (data.selectedAccessory) {
              setSelectedAccessory(data.selectedAccessory)
            }
            if (data.editingProductId) {
              setEditingProductId(data.editingProductId)
            }
          } else {
            // Clear expired data
            sessionStorage.removeItem('shopOrderData')
          }
        }
      } catch (error) {
        console.error('Error loading session data:', error)
      }
    }

    loadSessionData()
  }, [])

  // Save data to session storage whenever state changes
  React.useEffect(() => {
    const saveSessionData = () => {
      try {
        const dataToSave = {
          timestamp: Date.now(),
          selectedWorker,
          customerData,
          selectedCustomer,
          productsTable,
          accessoryData,
          selectedAccessory,
          editingProductId
        }
        sessionStorage.setItem('shopOrderData', JSON.stringify(dataToSave))
      } catch (error) {
        console.error('Error saving session data:', error)
      }
    }

    // Debounce saving to avoid too frequent updates
    const timeoutId = setTimeout(saveSessionData, 500)
    return () => clearTimeout(timeoutId)
  }, [selectedWorker, customerData, selectedCustomer, productsTable, accessoryData, selectedAccessory, editingProductId])

  // Calculate prices
  const calculatePrices = () => {
    const basePrice = parseFloat(accessoryData.base_price) || 0
    const multiplier = parseFloat(accessoryData.multiplier.toString()) || 1.38
    
    // Use the current VAT ID or fallback to default VAT
    const currentVatId = accessoryData.vat_id || defaultVat?.id
    const vatRate = vatRates.find(v => v.id === currentVatId)?.kulcs || 27

    const netPrice = Math.round(basePrice * multiplier)
    const grossPrice = Math.round(netPrice * (1 + vatRate / 100))

    setAccessoryData(prev => ({
      ...prev,
      net_price: netPrice,
      gross_price: grossPrice
    }))
  }

  // Recalculate prices when relevant accessory data changes
  useEffect(() => {
    calculatePrices()
  }, [accessoryData.base_price, accessoryData.multiplier, accessoryData.vat_id, accessoryData.currency_id, defaultVat])

  // Search functionality with debouncing
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/shoporder/search?q=${encodeURIComponent(searchTerm)}`)
        if (response.ok) {
          const data = await response.json()
          // Use accessories from API response (which includes newly created ones)
          const allResults = [...data.materials, ...data.linearMaterials, ...data.accessories]
          setSearchResults(allResults)
        } else {
          console.error('Search failed:', response.statusText)
          setSearchResults([])
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(searchTimeout)
  }, [searchTerm, accessories])

  // Load shop order data when shopOrderId is present
  useEffect(() => {
    if (shopOrderId) {
      const loadShopOrder = async () => {
        try {
          const response = await fetch(`/api/shoporder/${shopOrderId}`)
          if (response.ok) {
            const orderData = await response.json()
            
            // Set worker
            const worker = workers.find(w => w.id === orderData.worker_id)
            if (worker) {
              setSelectedWorker(worker)
            }
            
            // Set customer data
            setSelectedCustomer(null) // Clear selected customer since we're editing
            setCustomerData({
              name: orderData.customer_name,
              email: orderData.customer_email || '',
              mobile: orderData.customer_mobile || '',
              discount: orderData.customer_discount.toString(),
              billing_name: orderData.billing_name || '',
              billing_country: orderData.billing_country || 'Magyarország',
              billing_city: orderData.billing_city || '',
              billing_postal_code: orderData.billing_postal_code || '',
              billing_street: orderData.billing_street || '',
              billing_house_number: orderData.billing_house_number || '',
              billing_tax_number: orderData.billing_tax_number || '',
              billing_company_reg_number: orderData.billing_company_reg_number || ''
            })
            
            // Set products table
            const products = orderData.items.map((item: any) => {
              // Determine source based on type
              let source = 'accessories' // Default
              if (item.type === 'Bútorlap') {
                source = 'materials'
              } else if (item.type && item.type !== 'Termék') {
                // Linear materials have various types (Él, Hátsólap, etc.)
                source = 'linear_materials'
              }
              
              return {
                id: item.id,
                name: item.product_name,
                sku: item.sku,
                type: item.type,
                base_price: item.base_price,
                multiplier: item.multiplier,
                quantity: item.quantity,
                net_price: Math.round(item.base_price * item.multiplier),
                gross_price: Math.round(item.base_price * item.multiplier * (1 + (item.vat?.kulcs || 0) / 100)),
                vat_id: item.vat.id,
                currency_id: item.currencies.id,
                units_id: item.units.id,
                partners_id: item.partners?.id || '',
                megjegyzes: item.megjegyzes || '',
                brand_name: '',
                dimensions: '',
                source: source
              }
            })
            setProductsTable(products)
            
            // Clear the product search form
            setSearchTerm('')
            setSelectedAccessory(null)
            setAccessoryData({
              name: '',
              sku: '',
              type: '',
              base_price: '',
              multiplier: 1.38,
              net_price: 0,
              gross_price: 0,
              vat_id: '',
              currency_id: '',
              units_id: '',
              partners_id: '',
              quantity: 1,
              megjegyzes: '',
              brand_name: '',
              dimensions: ''
            })
          } else {
            const errorText = await response.text()
            console.error('API Error:', response.status, errorText)
            toast.error('Hiba történt a beszerzés betöltése során')
          }
        } catch (error) {
          console.error('Error loading shop order:', error)
          toast.error('Hiba történt a beszerzés betöltése során')
        }
      }
      
      loadShopOrder()
    }
  }, [shopOrderId, workers])

  // Handle worker selection
  const handleWorkerChange = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId)
    setSelectedWorker(worker || null)
  }

  // Handle customer selection or new input
  const handleCustomerChange = (event: React.SyntheticEvent, newValue: string | Customer | null) => {
    if (typeof newValue === 'string') {
      // User typed a new customer name
      setSelectedCustomer(null)
      setCustomerData({
        name: newValue,
        email: '',
        mobile: '',
        discount: '0',
        billing_name: '',
        billing_country: 'Magyarország',
        billing_city: '',
        billing_postal_code: '',
        billing_street: '',
        billing_house_number: '',
        billing_tax_number: '',
        billing_company_reg_number: ''
      })
    } else if (newValue) {
      // User selected an existing customer - set data directly
      setSelectedCustomer(newValue)
      setCustomerData({
        name: newValue.name,
        email: newValue.email || '',
        mobile: newValue.mobile || '',
        discount: newValue.discount_percent.toString(),
        billing_name: newValue.billing_name || '',
        billing_country: newValue.billing_country || 'Magyarország',
        billing_city: newValue.billing_city || '',
        billing_postal_code: newValue.billing_postal_code || '',
        billing_street: newValue.billing_street || '',
        billing_house_number: newValue.billing_house_number || '',
        billing_tax_number: newValue.billing_tax_number || '',
        billing_company_reg_number: newValue.billing_company_reg_number || ''
      })
    } else {
      // User cleared selection
      setSelectedCustomer(null)
      setCustomerData({
        name: '',
        email: '',
        mobile: '',
        discount: '0',
        billing_name: '',
        billing_country: 'Magyarország',
        billing_city: '',
        billing_postal_code: '',
        billing_street: '',
        billing_house_number: '',
        billing_tax_number: '',
        billing_company_reg_number: ''
      })
    }
  }

  // Handle accessory selection or new input
  const handleAccessoryChange = (event: React.SyntheticEvent, newValue: string | SearchableItem | null) => {
    if (typeof newValue === 'string') {
      // User typed a new product name
      setSearchTerm(newValue)
      setSelectedAccessory(null)
      setAccessoryData(prev => ({
        ...prev,
        name: newValue,
        // Don't clear SKU - user might have typed it separately
        type: 'Termék',
        base_price: '',
        multiplier: 1.38,
        quantity: 1,
        vat_id: defaultVat?.id || '',
        currency_id: defaultCurrency?.id || '',
        units_id: defaultUnit?.id || '',
        partners_id: '',
        megjegyzes: '',
        brand_name: '',
        dimensions: ''
      }))
    } else if (newValue) {
      // User selected an existing product (accessory, material, or linear material)
      setSearchTerm('')
      setSelectedAccessory(newValue as Accessory)
      
      // Determine the type based on source
      let itemType = 'Termék' // Default for accessories
      if ('source' in newValue) {
        if (newValue.source === 'materials') {
          itemType = 'Bútorlap'
        } else if (newValue.source === 'linear_materials') {
          itemType = newValue.type || 'Lineáris anyag'
        } else {
          itemType = 'Termék' // For accessories
        }
      } else {
        // Fallback for accessories without source field
        itemType = 'Termék'
      }
      
      // Determine default unit based on source
      const defaultUnitsId = newValue.source === 'linear_materials' 
        ? szalUnit.id  // Linear materials default to "Szál"
        : newValue.units_id  // Others use their original unit
      
      setAccessoryData(prev => ({
        ...prev,
        name: newValue.name,
        sku: newValue.sku,
        type: itemType,
        base_price: newValue.base_price.toString(),
        multiplier: newValue.multiplier,
        quantity: 1,
        vat_id: newValue.vat_id,
        currency_id: newValue.currency_id,
        units_id: defaultUnitsId,
        partners_id: newValue.partners_id,
        megjegyzes: '',
        brand_name: (newValue as Material | LinearMaterial).brand_name || '',
        dimensions: (newValue as Material | LinearMaterial).dimensions || ''
      }))
    } else {
      // User cleared selection
      setSearchTerm('')
      setSelectedAccessory(null)
      setAccessoryData(prev => ({
        ...prev,
        name: '',
        sku: '',
        type: '',
        base_price: '',
        multiplier: 1.38,
        quantity: 1,
        vat_id: defaultVat?.id || '',
        currency_id: defaultCurrency?.id || '',
        units_id: defaultUnit?.id || '',
        partners_id: '',
        megjegyzes: '',
        brand_name: '',
        dimensions: ''
      }))
    }
  }

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('customer_')) {
      const customerField = field.replace('customer_', '')
      
      // Apply formatting based on field type
      let formattedValue = value
      if (customerField === 'mobile') {
        formattedValue = formatPhoneNumber(value)
      } else if (customerField === 'billing_tax_number') {
        formattedValue = formatTaxNumber(value)
      } else if (customerField === 'billing_company_reg_number') {
        formattedValue = formatCompanyRegNumber(value)
      }
      
      setCustomerData(prev => ({ ...prev, [customerField]: formattedValue }))
    } else if (field.startsWith('accessory_')) {
      const accessoryField = field.replace('accessory_', '')
      setAccessoryData(prev => ({ ...prev, [accessoryField]: value }))

      // Recalculate prices when base_price or multiplier changes
      if (accessoryField === 'base_price' || accessoryField === 'multiplier' || accessoryField === 'vat_id') {
        setTimeout(() => {
          // Use the updated state values
          setAccessoryData(prev => {
            const basePrice = parseFloat(field === 'accessory_base_price' ? value : prev.base_price) || 0
            const multiplier = parseFloat(field === 'accessory_multiplier' ? value : prev.multiplier.toString()) || 1.38
            const currentVatId = field === 'accessory_vat_id' ? value : prev.vat_id || defaultVat?.id
            const vatRate = vatRates.find(v => v.id === currentVatId)?.kulcs || 27

            const netPrice = Math.round(basePrice * multiplier)
            const grossPrice = Math.round(netPrice * (1 + vatRate / 100))

            return {
              ...prev,
              net_price: netPrice,
              gross_price: grossPrice
            }
          })
        }, 100)
      }
    }
  }


  // Handle save action
  const handleSave = async () => {
    // Validate required fields
    if (!selectedWorker) {
      toast.error('Kérjük válasszon dolgozót!')
      return
    }
    
    if (!customerData.name || !customerData.name.trim()) {
      toast.error('Kérjük adja meg a megrendelő nevét!')
      return
    }
    
    if (productsTable.length === 0) {
      toast.error('Kérjük adjon hozzá legalább egy terméket!')
      return
    }

    setIsSaving(true)
    
    try {
      console.log('[SHOP ORDER SAVE] shopOrderId from URL:', shopOrderId)
      console.log('[SHOP ORDER SAVE] Is update?', !!shopOrderId)
      
      const response = await fetch('/api/shoporder/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_order_id: shopOrderId || null,
          worker_id: selectedWorker.id,
          customer_name: customerData.name,
          customer_email: customerData.email || null,
          customer_mobile: customerData.mobile || null,
          customer_discount: customerData.discount || 0,
          billing_name: customerData.billing_name || null,
          billing_country: customerData.billing_country || null,
          billing_city: customerData.billing_city || null,
          billing_postal_code: customerData.billing_postal_code || null,
          billing_street: customerData.billing_street || null,
          billing_house_number: customerData.billing_house_number || null,
          billing_tax_number: customerData.billing_tax_number || null,
          billing_company_reg_number: customerData.billing_company_reg_number || null,
          products: productsTable
        })
      })

      const result = await response.json()

      if (response.ok) {
        if (shopOrderId) {
          // Updating existing shop order - just show success message and stay on page
          toast.success(`Rendelés sikeresen frissítve! Rendelésszám: ${result.order_number}`)
          // Optionally refresh the page or reload the shop order data
          router.push(`/shoporder?shop_order_id=${result.order_id}`)
        } else {
          // New shop order - redirect to customer orders
          toast.success(`Rendelés sikeresen mentve! Rendelésszám: ${result.order_number}`)
          setSavedOrderNumber(result.order_number)
          
          // Clear form data
          setSelectedWorker(null)
          setSelectedCustomer(null)
          setCustomerData({
            name: '',
            email: '',
            mobile: '',
            billing_name: '',
            billing_country: '',
            billing_city: '',
            billing_postal_code: '',
            billing_street: '',
            billing_house_number: '',
            billing_tax_number: '',
            billing_company_reg_number: '',
            discount: '0'
          })
          setProductsTable([])
          setAccessoryData({
            name: '',
            sku: '',
            type: '',
            base_price: '',
            multiplier: 1.38,
            net_price: 0,
            gross_price: 0,
            vat_id: '',
            currency_id: '',
            units_id: '',
            partners_id: '',
            quantity: 1 as number | '',
            megjegyzes: '',
            brand_name: '',
            dimensions: ''
          })
          setSelectedAccessory(null)
          setSearchTerm('')
          setEditingProductId(null)
          
          // Clear all session storage related to shop orders
          sessionStorage.removeItem('shopOrderData')
          sessionStorage.removeItem(`shopOrderEditData-${shopOrderId}`)
          
          // Redirect to customer order detail page
          router.push(`/customer-orders/${result.order_id}`)
        }
      } else {
        toast.error(result.error || 'Hiba a mentés során')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Hálózati hiba a mentés során')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle order action (same as save but with status 'ordered')
  const handleOrder = async () => {
    // Validate required fields
    if (!selectedWorker) {
      toast.error('Kérjük válasszon dolgozót!')
      return
    }
    
    if (!customerData.name || !customerData.name.trim()) {
      toast.error('Kérjük adja meg a megrendelő nevét!')
      return
    }
    
    if (productsTable.length === 0) {
      toast.error('Kérjük adjon hozzá legalább egy terméket!')
      return
    }

    setIsSaving(true)
    
    try {
      const response = await fetch('/api/shoporder/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_order_id: shopOrderId || null,
          worker_id: selectedWorker.id,
          customer_name: customerData.name,
          customer_email: customerData.email || null,
          customer_mobile: customerData.mobile || null,
          customer_discount: customerData.discount || 0,
          billing_name: customerData.billing_name || null,
          billing_country: customerData.billing_country || null,
          billing_city: customerData.billing_city || null,
          billing_postal_code: customerData.billing_postal_code || null,
          billing_street: customerData.billing_street || null,
          billing_house_number: customerData.billing_house_number || null,
          billing_tax_number: customerData.billing_tax_number || null,
          billing_company_reg_number: customerData.billing_company_reg_number || null,
          products: productsTable,
          itemStatus: 'ordered' // Set items to ordered status
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`Rendelés sikeresen leadva! Rendelésszám: ${result.order_number}`)
        setSavedOrderNumber(result.order_number)
        
        // Clear form data
        setSelectedWorker(null)
        setSelectedCustomer(null)
        setCustomerData({
          name: '',
          email: '',
          mobile: '',
          billing_name: '',
          billing_country: '',
          billing_city: '',
          billing_postal_code: '',
          billing_street: '',
          billing_house_number: '',
          billing_tax_number: '',
          billing_company_reg_number: '',
          discount: '0'
        })
        setProductsTable([])
        setAccessoryData({
          name: '',
          sku: '',
          type: '',
          base_price: '',
          multiplier: 1.38,
          net_price: 0,
          gross_price: 0,
          vat_id: '',
          currency_id: '',
          units_id: '',
          partners_id: '',
          quantity: 1 as number | '',
          megjegyzes: '',
          brand_name: '',
          dimensions: ''
        })
        setSelectedAccessory(null)
        setSearchTerm('')
        setEditingProductId(null)
        
        // Clear all session storage related to shop orders
        sessionStorage.removeItem('shopOrderData')
        sessionStorage.removeItem(`shopOrderEditData-${shopOrderId}`)
        
        // Redirect to customer order detail page
        router.push(`/customer-orders/${result.order_id}`)
      } else {
        toast.error(result.error || 'Hiba a rendelés leadása során')
      }
    } catch (error) {
      console.error('Order error:', error)
      toast.error('Hálózati hiba a rendelés leadása során')
    } finally {
      setIsSaving(false)
    }
  }

  // Clear customer data
  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerData({
      name: '',
      email: '',
      phone: '',
      discount: '0',
      billing_name: '',
      billing_country: 'Magyarország',
      billing_city: '',
      billing_postal_code: '',
      billing_street: '',
      billing_house_number: '',
      billing_tax_number: '',
      billing_company_reg_number: ''
    })
  }

  // Clear all session data
  const clearSessionData = () => {
    try {
      sessionStorage.removeItem('shopOrderData')
    } catch (error) {
      console.error('Error clearing session data:', error)
    }
  }

  // Check if customer data is filled
  const isCustomerDataFilled = () => {
    return customerData.name || customerData.email || customerData.mobile ||
           customerData.billing_name || customerData.billing_city ||
           customerData.billing_postal_code || customerData.billing_street ||
           customerData.billing_house_number || customerData.billing_tax_number ||
           customerData.billing_company_reg_number || customerData.discount !== '0'
  }

  // Handle adding product to table
  const handleAddProduct = () => {
    const basePrice = parseFloat(accessoryData.base_price?.toString() || '0')
    
    if (!accessoryData.name || !accessoryData.name.trim() || 
        !accessoryData.sku || !accessoryData.sku.trim() ||
        !accessoryData.partners_id ||
        basePrice <= 0 ||
        !accessoryData.quantity || accessoryData.quantity === '') {
      toast.error('Kérjük töltse ki az összes kötelező mezőt! Beszerzési ár nagyobb kell legyen 0-nál.')
      return
    }

    const multiplier = parseFloat(accessoryData.multiplier.toString()) || 1.38
    const quantity = parseFloat(accessoryData.quantity.toString()) || 1
    const vatRate = vatRates.find(v => v.id === accessoryData.vat_id)?.kulcs || 27

    const netPrice = Math.round(basePrice * multiplier)
    const grossPrice = Math.round(netPrice * (1 + vatRate / 100))

    const newProduct: ProductItem = {
      id: editingProductId || Date.now().toString(),
      name: accessoryData.name,
      sku: accessoryData.sku || '',
      type: accessoryData.type || 'Termék',
      base_price: basePrice,
      multiplier: multiplier,
      quantity: quantity,
      net_price: netPrice,
      gross_price: grossPrice,
      vat_id: accessoryData.vat_id,
      currency_id: accessoryData.currency_id,
      units_id: accessoryData.units_id,
      partners_id: accessoryData.partners_id,
      megjegyzes: accessoryData.megjegyzes,
      brand_name: accessoryData.brand_name,
      dimensions: accessoryData.dimensions,
      source: selectedAccessory?.source || 'accessories'
    }

    if (editingProductId) {
      // Update existing product
      setProductsTable(prev => prev.map(p => p.id === editingProductId ? newProduct : p))
      setEditingProductId(null)
      toast.success('Termék sikeresen frissítve!')
    } else {
      // Add new product
      setProductsTable(prev => [...prev, newProduct])
      toast.success('Termék sikeresen hozzáadva!')
    }

    // Clear form
    setSelectedAccessory(null)
    setSearchTerm('')
    setAccessoryData({
      name: '',
      sku: '',
      type: '',
      base_price: '',
      multiplier: 1.38,
      net_price: 0,
      gross_price: 0,
      vat_id: defaultVat?.id || '',
      currency_id: defaultCurrency?.id || '',
      units_id: defaultUnit?.id || '',
      partners_id: '',
      quantity: 1,
      megjegyzes: '',
      brand_name: '',
      dimensions: ''
    })
  }

  // Handle clicking on table row to edit
  const handleEditProduct = (product: ProductItem) => {
    setEditingProductId(product.id)
    setSelectedAccessory(null)
    setSearchTerm('')
    setAccessoryData({
      name: product.name,
      sku: product.sku,
      type: product.type,
      base_price: product.base_price.toString(),
      multiplier: product.multiplier,
      net_price: product.net_price,
      gross_price: product.gross_price,
      vat_id: product.vat_id,
      currency_id: product.currency_id,
      units_id: product.units_id,
      partners_id: product.partners_id,
      quantity: product.quantity,
      megjegyzes: product.megjegyzes,
      brand_name: product.brand_name || '',
      dimensions: product.dimensions || ''
    })
    
    // Scroll to the top of the page
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)
  }

  // Handle deleting a product from the table
  const handleDeleteProduct = (productId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent row click event
    setProductsTable(prev => prev.filter(p => p.id !== productId))
    toast.success('Termék sikeresen törölve!')
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Rendelést felvétel
        </Typography>
      </Breadcrumbs>

      {/* Main Card for Worker and Customer */}
      <Card
        sx={{
          backgroundColor: selectedWorker?.color ? `${selectedWorker.color}10` : 'background.paper',
          border: selectedWorker?.color ? `2px solid ${selectedWorker.color}` : '1px solid #e0e0e0',
          transition: 'all 0.3s ease'
        }}
      >
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Rendelést felvétel
          </Typography>

          {/* First Row: Worker Selection and Customer Information */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Section 1: Worker Selection */}
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom>
                1. Dolgozó kiválasztása
              </Typography>
              <Autocomplete
                size="small"
                options={workers}
                getOptionLabel={(option) => option.nickname || option.name}
                value={selectedWorker}
                onChange={(event, newValue) => {
                  if (newValue) {
                    handleWorkerChange(newValue.id)
                  } else {
                    setSelectedWorker(null)
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Dolgozó"
                    required
                    placeholder="Keresés dolgozó között..."
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                ListboxProps={{
                  style: {
                    maxHeight: 300,
                  }
                }}
              />
            </Grid>

            {/* Section 2: Customer Information */}
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  2. Megrendelő adatai
                </Typography>
                {isCustomerDataFilled() && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={handleClearCustomer}
                    color="error"
                  >
                    Törlés
                  </Button>
                )}
              </Box>

              <Grid container spacing={2}>
                {/* Customer Selection */}
                <Grid item xs={12} sm={8}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={customers}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                    value={selectedCustomer}
                    inputValue={customerData.name}
                    onChange={handleCustomerChange}
                    onInputChange={(event, newInputValue) => {
                      // Update customer name when user types
                      setCustomerData(prev => ({
                        ...prev,
                        name: newInputValue
                      }))
                    }}
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

                {/* Discount */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Kedvezmény (%)"
                    value={customerData.discount}
                    onChange={(e) => handleInputChange('customer_discount', e.target.value)}
                    type="number"
                  />
                </Grid>

                {/* Contact Information */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Email"
                    value={customerData.email || ''}
                    onChange={(e) => handleInputChange('customer_email', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Telefon"
                    placeholder="+36 30 999 2800"
                    value={customerData.mobile || ''}
                    onChange={(e) => handleInputChange('customer_mobile', e.target.value)}
                  />
                </Grid>

                {/* Billing Information Accordion */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded={false}>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls="billing-content"
                      id="billing-header"
                    >
                      <Typography variant="subtitle1">Számlázási adatok</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Számlázási név"
                            value={customerData.billing_name || ''}
                            onChange={(e) => handleInputChange('customer_billing_name', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Ország"
                            value={customerData.billing_country || ''}
                            onChange={(e) => handleInputChange('customer_billing_country', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Város"
                            value={customerData.billing_city || ''}
                            onChange={(e) => handleInputChange('customer_billing_city', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Irányítószám"
                            value={customerData.billing_postal_code || ''}
                            onChange={(e) => handleInputChange('customer_billing_postal_code', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Utca"
                            value={customerData.billing_street || ''}
                            onChange={(e) => handleInputChange('customer_billing_street', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Házszám"
                            value={customerData.billing_house_number || ''}
                            onChange={(e) => handleInputChange('customer_billing_house_number', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Adószám"
                            placeholder="12345678-1-02"
                            value={customerData.billing_tax_number || ''}
                            onChange={(e) => handleInputChange('customer_billing_tax_number', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Cégjegyzékszám"
                            placeholder="01-09-123456"
                            value={customerData.billing_company_reg_number || ''}
                            onChange={(e) => handleInputChange('customer_billing_company_reg_number', e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section 3: Product Addition - Separate Card */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom data-testid="product-form">
            3. Termék hozzáadása
          </Typography>

          <Grid container spacing={2}>
            {/* Row 1: Termék neve, SKU, Partner */}
            <Grid item xs={12} sm={4}>
              <Autocomplete
                fullWidth
                size="small"
                options={searchResults}
                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.name} (${option.sku})`}
                value={selectedAccessory}
                onChange={handleAccessoryChange}
                inputValue={searchTerm || accessoryData.name}
                onInputChange={(event, newInputValue) => {
                  setSearchTerm(newInputValue)
                  // Update the accessory name when user types, but don't clear SKU
                  setAccessoryData(prev => ({
                    ...prev,
                    name: newInputValue,
                    type: 'Termék'
                  }))
                }}
                freeSolo
                loading={isSearching}
                filterOptions={(options, { inputValue }) => {
                  // Don't filter here since we're using server-side search
                  return options
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Termék neve vagy SKU *"
                    size="small"
                    required
                    error={!accessoryData.name && editingProductId === null}
                    helperText={!accessoryData.name && editingProductId === null ? "Kötelező mező" : ""}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props
                  return (
                    <li key={key} {...otherProps}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          SKU: {option.sku} | Típus: {option.type}
                        </Typography>
                        {(option as Material | LinearMaterial).brand_name && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Márka: {(option as Material | LinearMaterial).brand_name}
                          </Typography>
                        )}
                        {(option as Material | LinearMaterial).dimensions && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Méret: {(option as Material | LinearMaterial).dimensions}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="SKU / Cikkszám *"
                value={accessoryData.sku || ''}
                onChange={(e) => handleInputChange('accessory_sku', e.target.value)}
                required
                error={!accessoryData.sku}
                helperText={!accessoryData.sku ? "Kötelező mező" : ""}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Autocomplete
                size="small"
                options={partners}
                getOptionLabel={(option) => option.name}
                value={partners.find(p => p.id === accessoryData.partners_id) || null}
                onChange={(event, newValue) => {
                  handleInputChange('accessory_partners_id', newValue?.id || '')
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Partner *"
                    placeholder="Keresés partnerek között..."
                    required
                    error={!accessoryData.partners_id && editingProductId === null}
                    helperText={!accessoryData.partners_id && editingProductId === null ? "Kötelező mező" : ""}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                ListboxProps={{
                  style: {
                    maxHeight: 300,
                  }
                }}
              />
            </Grid>

            {/* Row 2: Beszerzési ár, Árrés szorzó, Mennyiség, Mértékegység, ÁFA, Pénznem */}
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                label="Beszerzési ár *"
                value={accessoryData.base_price || ''}
                onChange={(e) => handleInputChange('accessory_base_price', e.target.value)}
                type="number"
                required
                inputProps={{ min: 1, step: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                label="Árrés szorzó"
                value={accessoryData.multiplier}
                onChange={(e) => handleInputChange('accessory_multiplier', e.target.value)}
                type="number"
                inputProps={{ min: 1.0, max: 5.0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                label="Mennyiség"
                value={accessoryData.quantity || ''}
                onChange={(e) => handleInputChange('accessory_quantity', e.target.value)}
                type="number"
                inputProps={{ step: 0.01, min: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Mértékegység</InputLabel>
                <Select
                  value={accessoryData.units_id || ''}
                  onChange={(e) => handleInputChange('accessory_units_id', e.target.value)}
                  label="Mértékegység"
                >
                  {units.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.shortform})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>ÁFA</InputLabel>
                <Select
                  value={accessoryData.vat_id || ''}
                  onChange={(e) => handleInputChange('accessory_vat_id', e.target.value)}
                  label="ÁFA"
                >
                  {vatRates.map((vat) => (
                    <MenuItem key={vat.id} value={vat.id}>
                      {vat.name} ({vat.kulcs}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Pénznem</InputLabel>
                <Select
                  value={accessoryData.currency_id || ''}
                  onChange={(e) => handleInputChange('accessory_currency_id', e.target.value)}
                  label="Pénznem"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.id} value={currency.id}>
                      {currency.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Row 3: Megjegyzés */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Megjegyzés"
                value={accessoryData.megjegyzes || ''}
                onChange={(e) => handleInputChange('accessory_megjegyzes', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>

          {/* Add Product Button */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddProduct}
              color="primary"
            >
              {editingProductId ? 'Frissítés' : 'Hozzáadás'}
            </Button>
          </Box>

          {/* Price Preview */}
          <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Ár előnézet
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Beszerzési ár:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {accessoryData.base_price ? `${parseFloat(accessoryData.base_price).toLocaleString('hu-HU')} Ft` : '0 Ft'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Szorzó:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {accessoryData.multiplier}x
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Bruttó ár (db):
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {accessoryData.gross_price.toLocaleString('hu-HU')} Ft
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Mennyiség:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {accessoryData.quantity || 1} db
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Összesen (mennyiség × bruttó ár):
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {((accessoryData.gross_price || 0) * (accessoryData.quantity || 1)).toLocaleString('hu-HU')} Ft
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Kedvezmény ({customerData.discount}%):
                </Typography>
                <Typography variant="body1" fontWeight="bold" color="error">
                  -{Math.round(((accessoryData.gross_price || 0) * (accessoryData.quantity || 1)) * (parseFloat(customerData.discount) || 0) / 100).toLocaleString('hu-HU')} Ft
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Végső összeg:
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {Math.round(((accessoryData.gross_price || 0) * (accessoryData.quantity || 1)) * (1 - (parseFloat(customerData.discount) || 0) / 100)).toLocaleString('hu-HU')} Ft
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Products Table */}
          {productsTable.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hozzáadott termékek
              </Typography>
              <TableContainer component={Paper} data-testid="products-table">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Termék neve</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Típus</TableCell>
                      <TableCell align="right">Nettó egységár</TableCell>
                      <TableCell align="right">Bruttó egységár</TableCell>
                      <TableCell align="right">Mennyiség</TableCell>
                      <TableCell align="right">Nettó összesen</TableCell>
                      <TableCell align="right">Bruttó összesen</TableCell>
                      <TableCell align="center">Megjegyzés</TableCell>
                      <TableCell align="center">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productsTable.map((product) => (
                      <TableRow
                        key={product.id}
                        hover
                        onClick={() => handleEditProduct(product)}
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' } }}
                      >
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.type}</TableCell>
                        <TableCell align="right">{product.net_price.toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="right">{product.gross_price.toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="right">
                          {product.quantity} {units.find(u => u.id === product.units_id)?.shortform || 'db'}
                        </TableCell>
                        <TableCell align="right">{(product.net_price * product.quantity).toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="right">{(product.gross_price * product.quantity).toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="center">
                          {product.megjegyzes ? (
                            <Tooltip title={product.megjegyzes} arrow placement="top">
                              <IconButton
                                size="small"
                                color="info"
                                sx={{ '&:hover': { backgroundColor: 'info.light', color: 'white' } }}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDeleteProduct(product.id, e)}
                            sx={{ '&:hover': { backgroundColor: 'error.light', color: 'white' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Summary Table */}
          {productsTable.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Összesítés
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Összesen</strong></TableCell>
                      <TableCell align="right"><strong>Nettó összesen</strong></TableCell>
                      <TableCell align="right"><strong>Bruttó összesen</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Termékek összesen</strong></TableCell>
                      <TableCell align="right">
                        <strong>
                          {productsTable.reduce((sum, product) => sum + (product.net_price * product.quantity), 0).toLocaleString('hu-HU')} Ft
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {productsTable.reduce((sum, product) => sum + (product.gross_price * product.quantity), 0).toLocaleString('hu-HU')} Ft
                        </strong>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Kedvezmény ({customerData.discount}%)</strong></TableCell>
                      <TableCell align="right">
                        <strong style={{ color: 'red' }}>
                          -{Math.round(productsTable.reduce((sum, product) => sum + (product.net_price * product.quantity), 0) * (parseFloat(customerData.discount) || 0) / 100).toLocaleString('hu-HU')} Ft
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong style={{ color: 'red' }}>
                          -{Math.round(productsTable.reduce((sum, product) => sum + (product.gross_price * product.quantity), 0) * (parseFloat(customerData.discount) || 0) / 100).toLocaleString('hu-HU')} Ft
                        </strong>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell><strong>Végső összeg</strong></TableCell>
                      <TableCell align="right">
                        <strong>
                          {Math.round(productsTable.reduce((sum, product) => sum + (product.net_price * product.quantity), 0) * (1 - (parseFloat(customerData.discount) || 0) / 100)).toLocaleString('hu-HU')} Ft
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {Math.round(productsTable.reduce((sum, product) => sum + (product.gross_price * product.quantity), 0) * (1 - (parseFloat(customerData.discount) || 0) / 100)).toLocaleString('hu-HU')} Ft
                        </strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          size="large"
          onClick={handleOrder}
          disabled={isSaving}
          sx={{ 
            minWidth: 150,
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          {isSaving ? 'Rendelés...' : 'Megrendelés'}
        </Button>
        <Button
          variant="contained"
          size="large"
          color="primary"
          onClick={handleSave}
          disabled={isSaving}
          sx={{ 
            minWidth: 150,
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6,
              transform: 'translateY(-2px)'
            },
            transition: 'all 0.2s ease-in-out'
          }}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
      </Box>
    </Box>
  )
}