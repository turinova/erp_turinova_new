'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  Autocomplete,
  Button,
  IconButton,
  Paper,
  Stack,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  Checkbox,
  FormControlLabel,
  Chip
} from '@mui/material'
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  Close as CloseIcon,
  AttachMoney as CashIcon,
  CreditCard as CardIcon,
  AccountBalance as TransferIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useDebounce } from '@/hooks/useDebounce'

interface Customer {
  id: string
  name: string
  email: string | null
  mobile: string | null
  discount_percent?: number | null
  billing_name?: string | null
  billing_country?: string | null
  billing_city?: string | null
  billing_postal_code?: string | null
  billing_street?: string | null
  billing_house_number?: string | null
  billing_tax_number?: string | null
  billing_company_reg_number?: string | null
  sms_notification?: boolean
}

interface AccessoryItem {
  id: string
  name: string
  sku: string
  quantity_on_hand: number
  gross_price: number
  net_price: number
  currency_name: string
  image_url?: string | null
}

// Helper function to round up to nearest 10
const roundUpToNearest10 = (value: number): number => {
  return Math.ceil(value / 10) * 10
}

interface CartItem {
  id: string
  accessory_id: string
  name: string
  sku: string
  quantity: number
  gross_price: number
  net_price: number
  currency_name: string
}

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_id: string
  currency_id: string
  vat_percent: number
  currency_name: string
  gross_price: number
}

interface FeeItem {
  id: string
  feetype_id: string
  name: string
  quantity: number
  price: number
  currency_name: string
}

interface DiscountItem {
  id: string
  name: string
  percentage: number
}

interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
  created_at: string
  updated_at: string
}

interface PosClientProps {
  customers: Customer[]
  workers: Worker[]
}

export default function PosClient({ customers, workers }: PosClientProps) {
  const { hasAccess, loading } = usePagePermission('/pos')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<AccessoryItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [fees, setFees] = useState<FeeItem[]>([])
  const [discount, setDiscount] = useState<DiscountItem | null>(null)
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [highlightedCartItemId, setHighlightedCartItemId] = useState<string | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  // Load cart from session storage on mount
  useEffect(() => {
    try {
      const savedCartItems = sessionStorage.getItem('pos_cart_items')
      const savedFees = sessionStorage.getItem('pos_fees')
      const savedDiscount = sessionStorage.getItem('pos_discount')
      const savedWorkerId = sessionStorage.getItem('pos_selected_worker_id')
      if (savedCartItems) {
        setCartItems(JSON.parse(savedCartItems))
      }
      if (savedFees) {
        setFees(JSON.parse(savedFees))
      }
      if (savedDiscount) {
        setDiscount(JSON.parse(savedDiscount))
      }
      if (savedWorkerId) {
        const worker = workers.find(w => w.id === savedWorkerId)
        if (worker) {
          setSelectedWorker(worker)
        }
      }
    } catch (error) {
      console.error('Error loading cart from session storage:', error)
    }
  }, [workers])

  // Save cart to session storage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('pos_cart_items', JSON.stringify(cartItems))
    } catch (error) {
      console.error('Error saving cart to session storage:', error)
    }
  }, [cartItems])

  // Save fees to session storage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem('pos_fees', JSON.stringify(fees))
    } catch (error) {
      console.error('Error saving fees to session storage:', error)
    }
  }, [fees])

  // Save discount to session storage whenever it changes
  useEffect(() => {
    try {
      if (discount) {
        sessionStorage.setItem('pos_discount', JSON.stringify(discount))
      } else {
        sessionStorage.removeItem('pos_discount')
      }
    } catch (error) {
      console.error('Error saving discount to session storage:', error)
    }
  }, [discount])

  // Save selected worker to session storage whenever it changes
  useEffect(() => {
    try {
      if (selectedWorker) {
        sessionStorage.setItem('pos_selected_worker_id', selectedWorker.id)
      } else {
        sessionStorage.removeItem('pos_selected_worker_id')
      }
    } catch (error) {
      console.error('Error saving worker to session storage:', error)
    }
  }, [selectedWorker])
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef<boolean>(false)
  const lastScannedBarcodeRef = useRef<{ barcode: string; timestamp: number } | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scanAbortControllerRef = useRef<AbortController | null>(null)
  const searchAbortControllerRef = useRef<AbortController | null>(null)
  const [isEditingField, setIsEditingField] = useState(false)
  
  // Simple cache for barcode scans (last 50 items, 5 minutes TTL)
  const barcodeCacheRef = useRef<Map<string, { data: AccessoryItem; timestamp: number }>>(new Map())
  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  const CACHE_MAX_SIZE = 50

  const debouncedSearchTerm = useDebounce(searchTerm, 150)

  // Auto-focus barcode input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Refocus after cart or fees changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanningRef.current) {
        refocusBarcodeInput()
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [cartItems, fees, discount])

  // Auto-add discount when customer is selected
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.discount_percent && selectedCustomer.discount_percent > 0 && !discount) {
      const newDiscount: DiscountItem = {
        id: Date.now().toString(),
        name: 'Kedvezmény',
        percentage: selectedCustomer.discount_percent
      }
      setDiscount(newDiscount)
    }
  }, [selectedCustomer, discount])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  // Search accessories (optimized with request cancellation)
  useEffect(() => {
    // Cancel previous search request
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort()
    }

    if (debouncedSearchTerm.trim().length >= 2) {
      setIsSearching(true)
      
      // Create new AbortController for this request
      const abortController = new AbortController()
      searchAbortControllerRef.current = abortController

      fetch(`/api/pos/accessories?search=${encodeURIComponent(debouncedSearchTerm)}`, {
        signal: abortController.signal
      })
        .then(res => {
          if (abortController.signal.aborted) {
            return null
          }
          if (!res.ok) {
            // If response is not ok, return empty array
            return []
          }
          return res.json()
        })
        .then(data => {
          if (abortController.signal.aborted) {
            return
          }
          // Ensure data is always an array
          if (Array.isArray(data)) {
            setSearchResults(data)
          } else {
            // If it's an error object or something else, set empty array
            setSearchResults([])
          }
          setIsSearching(false)
        })
        .catch(err => {
          // Ignore abort errors
          if (err.name === 'AbortError') {
            console.log('Search request aborted')
            return
          }
          console.error('Error searching accessories:', err)
          if (!abortController.signal.aborted) {
            setSearchResults([]) // Set empty array on error
            setIsSearching(false)
          }
        })
    } else {
      setSearchResults([])
      setIsSearching(false)
    }

    // Cleanup function
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort()
        searchAbortControllerRef.current = null
      }
    }
  }, [debouncedSearchTerm])

  // Handle barcode input change (debounced for scanner - optimized to 100ms)
  const handleBarcodeInputChange = (value: string) => {
    // Don't process if user is editing a field
    if (isEditingField) {
      setBarcodeInput('')
      return
    }

    setBarcodeInput(value)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Set new timeout - trigger scan when input stops changing for 100ms (optimized from 300ms)
    // Barcode scanners typically send characters very quickly, so we wait a bit
    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = value.trim()
      if (trimmedValue.length > 0 && !isScanningRef.current && !isEditingField) {
        handleBarcodeScan(trimmedValue)
      }
    }, 100)
  }

  // Refocus barcode input helper (optimized - no requestAnimationFrame)
  const refocusBarcodeInput = () => {
    if (isEditingField) return // Don't refocus if user is editing a field
    setTimeout(() => {
      if (barcodeInputRef.current && !isEditingField) {
        barcodeInputRef.current.focus()
        barcodeInputRef.current.select() // Select all text for easy clearing
      }
    }, 10) // Minimal delay
  }

  // Handle barcode scan (optimized with cache and request cancellation)
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode || !barcode.trim() || isEditingField) {
      refocusBarcodeInput()
      return
    }

    const trimmedBarcode = barcode.trim()

    // Check cache first
    const cached = barcodeCacheRef.current.get(trimmedBarcode)
    const now = Date.now()
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Cache hit - use cached data
      const addedItemId = handleAddToCart(cached.data)
      if (addedItemId) {
        setHighlightedCartItemId(addedItemId)
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedCartItemId(null)
        }, 1000)
      }
      setBarcodeInput('')
      isScanningRef.current = false
      refocusBarcodeInput()
      return
    }

    // Prevent duplicate scans (same barcode within 200ms) - only for rapid-fire scans
    // This prevents accidental double-scans from the same barcode scanner input
    if (
      lastScannedBarcodeRef.current &&
      lastScannedBarcodeRef.current.barcode === trimmedBarcode &&
      now - lastScannedBarcodeRef.current.timestamp < 200
    ) {
      console.log('Duplicate scan ignored (too fast):', trimmedBarcode)
      setBarcodeInput('')
      refocusBarcodeInput()
      return
    }

    // Prevent multiple scans while one is in progress
    if (isScanningRef.current) {
      console.log('Scan already in progress, skipping')
      refocusBarcodeInput()
      return
    }

    // Cancel previous request if any
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort()
    }

    // Clear any pending timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Mark as scanning
    isScanningRef.current = true
    lastScannedBarcodeRef.current = { barcode: trimmedBarcode, timestamp: now }

    // Create new AbortController for this request
    const abortController = new AbortController()
    scanAbortControllerRef.current = abortController

    try {
      const response = await fetch(`/api/pos/accessories/by-barcode?barcode=${encodeURIComponent(trimmedBarcode)}`, {
        signal: abortController.signal
      })

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Vonalkód nem található')
        } else {
          toast.error('Hiba történt a keresés során')
        }
        // Clear last scanned barcode on error to allow retry
        lastScannedBarcodeRef.current = null
        setBarcodeInput('')
        isScanningRef.current = false
        refocusBarcodeInput()
        return
      }

      const accessory: AccessoryItem = await response.json()

      // Add to cache
      if (barcodeCacheRef.current.size >= CACHE_MAX_SIZE) {
        // Remove oldest entry
        const firstKey = barcodeCacheRef.current.keys().next().value
        barcodeCacheRef.current.delete(firstKey)
      }
      barcodeCacheRef.current.set(trimmedBarcode, { data: accessory, timestamp: now })

      // Add to cart and get the item ID that was added/updated
      const addedItemId = handleAddToCart(accessory)
      
      // Highlight the cart item
      if (addedItemId) {
        setHighlightedCartItemId(addedItemId)
        
        // Clear previous highlight timeout
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }
        
        // Remove highlight after 1 second
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedCartItemId(null)
        }, 1000)
      }
      
      // Clear input for next scan
      setBarcodeInput('')

    } catch (error) {
      console.error('Error scanning barcode:', error)
      toast.error('Hiba történt')
      // Clear last scanned barcode on error to allow retry
      lastScannedBarcodeRef.current = null
      setBarcodeInput('')
    } finally {
      // Always reset scanning flag
      isScanningRef.current = false
      // Refocus after a short delay to allow UI to update
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
        }
      }, 150)
    }
  }

  // Add item to cart - returns the item ID that was added/updated
  const handleAddToCart = (accessory: AccessoryItem): string | null => {
    const existingItem = cartItems.find(item => item.accessory_id === accessory.id)
    const roundedPrice = roundUpToNearest10(accessory.gross_price)
    
    if (existingItem) {
      // Increment quantity
      setCartItems(prev =>
        prev.map(item =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + 1, gross_price: roundedPrice }
            : item
        )
      )
      return existingItem.id
    } else {
      // Add new item
      const newItem: CartItem = {
        id: Date.now().toString(),
        accessory_id: accessory.id,
        name: accessory.name,
        sku: accessory.sku,
        quantity: 1,
        gross_price: roundedPrice,
        net_price: accessory.net_price,
        currency_name: accessory.currency_name
      }
      setCartItems(prev => [...prev, newItem])
      return newItem.id
    }
  }

  // Remove item from cart
  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId))
    // Clear last scanned barcode to allow re-scanning the same item
    lastScannedBarcodeRef.current = null
    // Clear barcode input and refocus for next scan
    setBarcodeInput('')
    refocusBarcodeInput()
  }

  // Update quantity
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(itemId)
      return
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    )
  }

  // Calculate részösszeg for each item
  const getItemSubtotal = (item: CartItem) => {
    return item.gross_price * item.quantity
  }

  // Fetch fee types
  useEffect(() => {
    const fetchFeeTypes = async () => {
      try {
        const response = await fetch('/api/feetypes')
        if (response.ok) {
          const data = await response.json()
          setFeeTypes(data)
        }
      } catch (error) {
        console.error('Error fetching fee types:', error)
      }
    }
    fetchFeeTypes()
  }, [])

  // Add fee
  const handleAddFee = () => {
    if (feeTypes.length === 0) {
      toast.warning('Nincsenek elérhető díjtípusok')
      return
    }
    const firstFeeType = feeTypes[0]
    const roundedPrice = roundUpToNearest10(firstFeeType.gross_price)
    const newFee: FeeItem = {
      id: Date.now().toString(),
      feetype_id: firstFeeType.id,
      name: firstFeeType.name,
      quantity: 1,
      price: roundedPrice,
      currency_name: firstFeeType.currency_name
    }
    setFees(prev => [...prev, newFee])
  }

  // Remove fee
  const handleRemoveFee = (feeId: string) => {
    setFees(prev => prev.filter(fee => fee.id !== feeId))
  }

  // Update fee price
  const handleFeePriceChange = (feeId: string, newPrice: number) => {
    setFees(prev =>
      prev.map(fee =>
        fee.id === feeId
          ? { ...fee, price: newPrice >= 0 ? newPrice : 0 }
          : fee
      )
    )
  }


  // Update fee type selection
  const handleFeeTypeChange = (feeId: string, feeTypeId: string) => {
    const selectedFeeType = feeTypes.find(ft => ft.id === feeTypeId)
    if (selectedFeeType) {
      const roundedPrice = roundUpToNearest10(selectedFeeType.gross_price)
      setFees(prev =>
        prev.map(fee =>
          fee.id === feeId
            ? {
                ...fee,
                feetype_id: selectedFeeType.id,
                name: selectedFeeType.name,
                price: roundedPrice,
                currency_name: selectedFeeType.currency_name
              }
            : fee
        )
      )
    }
  }

  // Calculate fee subtotal
  const getFeeSubtotal = (fee: FeeItem) => {
    return fee.price * fee.quantity
  }

  // Calculate total
  const total = useMemo(() => {
    const cartTotal = cartItems.reduce((sum, item) => sum + getItemSubtotal(item), 0)
    const feesTotal = fees.reduce((sum, fee) => sum + getFeeSubtotal(fee), 0)
    const subtotal = cartTotal + feesTotal
    const discountAmount = discount ? (subtotal * discount.percentage) / 100 : 0
    return subtotal - discountAmount
  }, [cartItems, fees, discount])

  // Add discount manually
  const handleAddDiscount = () => {
    if (discount) {
      toast.warning('Kedvezmény már hozzáadva')
      return
    }
    const newDiscount: DiscountItem = {
      id: Date.now().toString(),
      name: 'Kedvezmény',
      percentage: 0
    }
    setDiscount(newDiscount)
  }

  // Remove discount
  const handleRemoveDiscount = () => {
    setDiscount(null)
  }

  // Update discount percentage
  const handleDiscountPercentageChange = (newPercentage: number) => {
    if (!discount) return
    setDiscount({
      ...discount,
      percentage: newPercentage >= 0 && newPercentage <= 100 ? newPercentage : discount.percentage
    })
  }

  // Handle payment button click
  const handlePaymentClick = () => {
    setEditingCustomer(selectedCustomer)
    setPaymentModalOpen(true)
  }

  // Handle customer selection in modal
  const handleModalCustomerChange = (customer: Customer | null) => {
    setEditingCustomer(customer)
  }

  // Handle worker selection
  const handleWorkerChange = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId)
    setSelectedWorker(worker || null)
  }

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Betöltés...</Typography>
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Nincs jogosultsága az oldal megtekintéséhez.</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        height: 'calc(100vh - 64px - 48px)', // Account for navbar (64px) + layout padding top/bottom (24px * 2 = 48px)
        display: 'flex',
        flexDirection: 'column',
        p: 0,
        m: -3, // Negative margin to counteract parent padding (24px = 3 * 8px theme spacing)
        overflow: 'hidden'
      }}
    >
      <Card
        sx={{
          height: '100%',
          m: 0,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 }, minHeight: 0, overflow: 'hidden' }}>
          {/* Hidden barcode input for scanner */}
          <TextField
            inputRef={barcodeInputRef}
            value={barcodeInput}
            onChange={(e) => handleBarcodeInputChange(e.target.value)}
            onKeyDown={(e) => {
              // Barcode scanners often send Enter at the end
              // Trigger scan immediately on Enter
              if (e.key === 'Enter') {
                e.preventDefault()
                // Clear any pending timeout
                if (scanTimeoutRef.current) {
                  clearTimeout(scanTimeoutRef.current)
                  scanTimeoutRef.current = null
                }
                // Trigger scan immediately
                const trimmedValue = barcodeInput.trim()
                if (trimmedValue.length > 0 && !isScanningRef.current) {
                  handleBarcodeScan(trimmedValue)
                }
              }
            }}
            sx={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
              opacity: 0,
              pointerEvents: 'auto',
              zIndex: -1 // Keep it behind everything but still focusable
            }}
            autoFocus
            tabIndex={0}
            onBlur={(e) => {
              // Clear barcode input when user focuses elsewhere to prevent accidental scanning
              setBarcodeInput('')
              
              // Refocus if it loses focus, but only if:
              // 1. Not currently scanning
              // 2. The new focus target is not an input/button (user interaction)
              // 3. The new focus target is not the search field
              setTimeout(() => {
                const activeElement = document.activeElement
                const relatedTarget = e.relatedTarget as HTMLElement
                
                // Check if focus is going to any input, textarea, or button
                const isInputOrButton = 
                  activeElement?.tagName === 'INPUT' || 
                  activeElement?.tagName === 'BUTTON' ||
                  activeElement?.tagName === 'TEXTAREA' ||
                  relatedTarget?.tagName === 'INPUT' ||
                  relatedTarget?.tagName === 'BUTTON' ||
                  relatedTarget?.tagName === 'TEXTAREA' ||
                  activeElement?.closest('button') ||
                  activeElement?.closest('input') ||
                  activeElement?.closest('textarea') ||
                  relatedTarget?.closest('button') ||
                  relatedTarget?.closest('input') ||
                  relatedTarget?.closest('textarea')
                
                if (!isScanningRef.current && 
                    !isEditingField &&
                    !isInputOrButton &&
                    activeElement?.id !== 'search-field' &&
                    relatedTarget?.id !== 'search-field') {
                  barcodeInputRef.current?.focus()
                }
              }, 100)
            }}
          />

          <Grid container spacing={2} sx={{ height: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Left Side - Search and Results */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              <Typography variant="h6" sx={{ mb: 1, flexShrink: 0 }}>
                Termék keresés
              </Typography>
              
              {/* Search Bar */}
              <TextField
                id="search-field"
                fullWidth
                size="small"
                placeholder="Keresés név vagy SKU alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2, flexShrink: 0 }}
              />

              {/* Search Results - Table */}
              <TableContainer
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  minHeight: 0
                }}
              >
                {isSearching ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography>Keresés...</Typography>
                  </Box>
                ) : searchResults.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {searchTerm.trim().length >= 2 ? 'Nincs találat' : 'Kezdjen el gépelni a kereséshez...'}
                    </Typography>
                  </Box>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }} width={80}>Kép</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Termék neve</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Készlet</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Ár</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {searchResults.map((accessory) => {
                        const roundedPrice = roundUpToNearest10(accessory.gross_price)
                        return (
                          <TableRow
                            key={accessory.id}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: (theme) => theme.palette.action.hover
                              }
                            }}
                            onClick={() => handleAddToCart(accessory)}
                          >
                            <TableCell>
                              <Box
                                sx={{
                                  width: 60,
                                  height: 60,
                                  bgcolor: 'grey.200',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  position: 'relative'
                                }}
                              >
                                {/* Placeholder icon - always present */}
                                <ImageIcon 
                                  sx={{ 
                                    fontSize: 30, 
                                    color: 'grey.400',
                                    position: 'absolute',
                                    zIndex: 0
                                  }} 
                                />
                                {/* Product image - overlays icon if available */}
                                {accessory.image_url && (
                                  <img
                                    src={accessory.image_url}
                                    alt={accessory.name}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      position: 'relative',
                                      zIndex: 1
                                    }}
                                    onError={(e) => {
                                      // Hide image on error, icon will show through
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {accessory.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {accessory.sku}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {accessory.quantity_on_hand} db
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="subtitle2" color="primary" fontWeight="bold">
                                {roundedPrice.toLocaleString('hu-HU')} {accessory.currency_name}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>
            </Grid>

            {/* Right Side - Customer and Cart */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              <Typography variant="h6" sx={{ mb: 1, flexShrink: 0 }}>
                Vásárlás
              </Typography>

              {/* Customer Dropdown */}
              <Autocomplete
                fullWidth
                size="small"
                options={customers}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={selectedCustomer}
                onChange={(event, newValue) => {
                  setSelectedCustomer(newValue)
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ügyfél neve"
                    placeholder="Válasszon ügyfelet..."
                  />
                )}
                sx={{ mb: 2, flexShrink: 0 }}
              />

              {/* Cart Items and Fees - Table */}
              <TableContainer
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  mb: 2,
                  border: selectedWorker?.color ? `2px solid ${selectedWorker.color}` : '1px solid',
                  borderColor: selectedWorker?.color ? selectedWorker.color : 'divider',
                  borderRadius: 1,
                  minHeight: 0,
                  backgroundColor: selectedWorker?.color ? `${selectedWorker.color}10` : 'background.paper',
                  transition: 'all 0.3s ease'
                }}
              >
                {cartItems.length === 0 && fees.length === 0 && !discount ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      A kosár üres
                    </Typography>
                  </Box>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Termék</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Mennyiség</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Bruttó Részösszeg</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center" width={60}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Cart Items */}
                      {cartItems.map((item) => (
                        <TableRow
                          key={item.id}
                          sx={{
                            transition: 'border-color 0.3s ease-in-out',
                            ...(highlightedCartItemId === item.id && {
                              border: '2px solid',
                              borderColor: (theme) => theme.palette.success.main,
                              '& td': {
                                borderColor: (theme) => theme.palette.success.main
                              }
                            })
                          }}
                        >
                          {/* Column 1: Name and SKU */}
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku}
                            </Typography>
                          </TableCell>

                          {/* Column 2: Mennyiség */}
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              value={item.quantity}
                              onChange={(e) =>
                                handleQuantityChange(item.id, parseInt(e.target.value) || 0)
                              }
                              inputProps={{
                                min: 1,
                                style: { textAlign: 'center', width: '60px' }
                              }}
                              sx={{
                                width: '80px',
                                ...(highlightedCartItemId === item.id && {
                                  '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                    borderColor: (theme) => theme.palette.success.main,
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    transition: 'background-color 0.2s ease',
                                    '&:hover': {
                                      backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                    },
                                    '&.Mui-focused': {
                                      backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                    }
                                  }
                                })
                              }}
                            />
                          </TableCell>

                          {/* Column 3: Bruttó Részösszeg */}
                          <TableCell align="right">
                            <Typography variant="subtitle2" fontWeight="bold" color="primary">
                              {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                            </Typography>
                          </TableCell>

                          {/* Column 4: Delete */}
                          <TableCell align="center">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleRemoveFromCart(item.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Fees Header Row */}
                      {fees.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ fontWeight: 'bold', bgcolor: 'action.hover', py: 1 }}>
                            Díjak
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Fees */}
                      {fees.map((fee) => (
                        <TableRow key={fee.id}>
                          {/* Column 1: Fee Name */}
                          <TableCell>
                            <Autocomplete
                              size="small"
                              options={feeTypes}
                              getOptionLabel={(option) => option.name}
                              value={feeTypes.find(ft => ft.id === fee.feetype_id) || null}
                              onChange={(event, newValue) => {
                                if (newValue) {
                                  handleFeeTypeChange(fee.id, newValue.id)
                                }
                              }}
                              renderInput={(params) => (
                                <TextField {...params} />
                              )}
                              sx={{ minWidth: 200 }}
                            />
                          </TableCell>

                          {/* Column 2: Mennyiség - Empty for fees */}
                          <TableCell align="center"></TableCell>

                          {/* Column 3: Bruttó Részösszeg */}
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                              <TextField
                                type="number"
                                size="small"
                                value={fee.price}
                                onChange={(e) =>
                                  handleFeePriceChange(fee.id, parseFloat(e.target.value) || 0)
                                }
                                onFocus={() => {
                                  // Set editing flag to prevent barcode input interference
                                  setIsEditingField(true)
                                  // Clear barcode input and any pending scans when editing fee price
                                  setBarcodeInput('')
                                  if (scanTimeoutRef.current) {
                                    clearTimeout(scanTimeoutRef.current)
                                    scanTimeoutRef.current = null
                                  }
                                }}
                                onBlur={() => {
                                  // Clear editing flag after a short delay
                                  setTimeout(() => {
                                    setIsEditingField(false)
                                    refocusBarcodeInput()
                                  }, 200)
                                }}
                                onKeyDown={(e) => {
                                  // Stop event propagation to prevent barcode input from receiving it
                                  e.stopPropagation()
                                }}
                                inputProps={{
                                  min: 0,
                                  step: 1,
                                  style: { textAlign: 'right', width: '80px' }
                                }}
                                sx={{ width: '100px' }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {fee.currency_name}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Column 4: Delete */}
                          <TableCell align="center">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleRemoveFee(fee.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Discount Header Row */}
                      {discount && (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ fontWeight: 'bold', bgcolor: 'action.hover', py: 1 }}>
                            Kedvezmény
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Discount Row */}
                      {discount && (
                        <TableRow>
                          {/* Column 1: Discount Name */}
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {discount.name}
                            </Typography>
                          </TableCell>

                          {/* Column 2: Mennyiség - Percentage */}
                          <TableCell align="center">
                            <TextField
                              type="number"
                              size="small"
                              value={discount.percentage}
                              onChange={(e) =>
                                handleDiscountPercentageChange(parseFloat(e.target.value) || 0)
                              }
                              onFocus={() => {
                                // Set editing flag to prevent barcode input interference
                                setIsEditingField(true)
                                // Clear barcode input and any pending scans when editing discount
                                setBarcodeInput('')
                                if (scanTimeoutRef.current) {
                                  clearTimeout(scanTimeoutRef.current)
                                  scanTimeoutRef.current = null
                                }
                              }}
                              onBlur={() => {
                                // Clear editing flag after a short delay
                                setTimeout(() => {
                                  setIsEditingField(false)
                                  refocusBarcodeInput()
                                }, 200)
                              }}
                              onKeyDown={(e) => {
                                // Stop event propagation to prevent barcode input from receiving it
                                e.stopPropagation()
                              }}
                              inputProps={{
                                min: 0,
                                max: 100,
                                step: 0.1,
                                style: { textAlign: 'center' }
                              }}
                              sx={{ width: '120px' }}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">%</InputAdornment>
                              }}
                            />
                          </TableCell>

                          {/* Column 3: Bruttó Részösszeg - Discount Amount */}
                          <TableCell align="right">
                            <Typography variant="body2" color="error" fontWeight="bold">
                              -{((cartItems.reduce((sum, item) => sum + getItemSubtotal(item), 0) + fees.reduce((sum, fee) => sum + getFeeSubtotal(fee), 0)) * discount.percentage / 100).toLocaleString('hu-HU')} HUF
                            </Typography>
                          </TableCell>

                          {/* Column 4: Delete */}
                          <TableCell align="center">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={handleRemoveDiscount}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>

              {/* Total and Fizetés Button - Always Visible */}
              <Box sx={{ flexShrink: 0 }}>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Összesen:</Typography>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {total.toLocaleString('hu-HU')} HUF
                  </Typography>
                </Box>
                {/* Fee and Discount Icons */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center' }}>
                  <IconButton
                    color="primary"
                    onClick={handleAddFee}
                    sx={{
                      border: '2px solid',
                      borderColor: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        borderColor: 'primary.dark'
                      }
                    }}
                  >
                    <AddCircleIcon />
                  </IconButton>
                  <IconButton
                    color="secondary"
                    onClick={handleAddDiscount}
                    disabled={discount !== null}
                    sx={{
                      border: '2px solid',
                      borderColor: discount !== null ? 'action.disabled' : 'secondary.main',
                      '&:hover': {
                        backgroundColor: discount !== null ? 'action.hover' : 'secondary.light',
                        borderColor: discount !== null ? 'action.disabled' : 'secondary.dark'
                      }
                    }}
                  >
                    <RemoveCircleIcon />
                  </IconButton>
                </Box>
                {/* Worker Switcher and Fizetés Button */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    sx={{ 
                      py: 3, 
                      fontSize: '1.1rem', 
                      fontWeight: 'bold', 
                      width: '65%',
                      height: '48px' // Explicit height to match worker input
                    }}
                    disabled={cartItems.length === 0}
                    onClick={handlePaymentClick}
                  >
                    Fizetés
                  </Button>
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
                      // Refocus barcode input after worker selection
                      setTimeout(() => {
                        refocusBarcodeInput()
                      }, 100)
                    }}
                    onBlur={() => {
                      // Refocus barcode input when worker field loses focus
                      setTimeout(() => {
                        if (!isEditingField) {
                          refocusBarcodeInput()
                        }
                      }, 100)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Dolgozó"
                        placeholder="Keresés dolgozó között..."
                        onFocus={() => {
                          // Set editing flag when worker field is focused
                          setIsEditingField(true)
                        }}
                        onBlur={() => {
                          // Clear editing flag after a delay
                          setTimeout(() => {
                            setIsEditingField(false)
                            refocusBarcodeInput()
                          }, 200)
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            height: '48px', // Match button height (py: 3 = 24px top + 24px bottom, but button has fontSize which adds extra, so 48px total)
                            backgroundColor: selectedWorker?.color ? `${selectedWorker.color}10` : 'background.paper',
                            borderColor: selectedWorker?.color ? selectedWorker.color : undefined,
                            '& fieldset': {
                              borderColor: selectedWorker?.color ? selectedWorker.color : undefined,
                              borderWidth: selectedWorker?.color ? '2px' : undefined,
                            },
                            '&:hover fieldset': {
                              borderColor: selectedWorker?.color ? selectedWorker.color : undefined,
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: selectedWorker?.color ? selectedWorker.color : undefined,
                              borderWidth: selectedWorker?.color ? '2px' : undefined,
                            },
                            transition: 'all 0.3s ease'
                          }
                        }}
                      />
                    )}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    sx={{ width: '35%' }}
                    ListboxProps={{
                      style: {
                        maxHeight: 300,
                      }
                    }}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh'
          }
        }}
      >
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '80vh', overflow: 'hidden' }}>
          <Grid container spacing={3} sx={{ flex: 1, minHeight: 0, alignItems: 'stretch', height: '100%' }}>
            {/* Left Side - Order Summary */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              {/* Fixed Table Header */}
              <TableContainer sx={{ flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Termék</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Mennyiség</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ár</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Részösszeg</TableCell>
                    </TableRow>
                  </TableHead>
                </Table>
              </TableContainer>

              {/* Scrollable Table Body */}
              <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      {cartItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="right">
                            {item.gross_price.toLocaleString('hu-HU')} {item.currency_name}
                          </TableCell>
                          <TableCell align="right">
                            {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Díjak Section */}
                {fees.length > 0 && (
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Díj neve</TableCell>
                          <TableCell align="right">Ár</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fees.map((fee) => (
                          <TableRow key={fee.id}>
                            <TableCell>{fee.name}</TableCell>
                            <TableCell align="right">
                              {fee.price.toLocaleString('hu-HU')} {fee.currency_name}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {/* Kedvezmény Section */}
                {discount && (
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Kedvezmény</TableCell>
                          <TableCell align="center">Mennyiség</TableCell>
                          <TableCell align="right">Összeg</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>{discount.name}</TableCell>
                          <TableCell align="center">{discount.percentage}%</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                            -{((cartItems.reduce((sum, item) => sum + getItemSubtotal(item), 0) + fees.reduce((sum, fee) => sum + getFeeSubtotal(fee), 0)) * discount.percentage / 100).toLocaleString('hu-HU')} HUF
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              {/* Összesen - Fixed at bottom */}
              <Box sx={{ flexShrink: 0 }}>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Összesen:</Typography>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {total.toLocaleString('hu-HU')} HUF
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Right Side - Customer Data */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              {/* Customer Selector - Always visible, shows as chip if selected */}
              <Box sx={{ mb: 2, flexShrink: 0 }}>
                {editingCustomer ? (
                  <Chip
                    label={editingCustomer.name}
                    onDelete={() => handleModalCustomerChange(null)}
                    deleteIcon={<CloseIcon />}
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '0.95rem', py: 2.5 }}
                  />
                ) : (
                  <Autocomplete
                    size="small"
                    options={customers}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                    value={null}
                    onChange={(event, newValue) => {
                      handleModalCustomerChange(newValue)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Ügyfél kiválasztása"
                        placeholder="Válasszon ügyfelet..."
                      />
                    )}
                  />
                )}
              </Box>

              {/* Customer Fields if customer selected */}
              {editingCustomer && (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, mb: 2 }}>
                  {/* Scrollable customer fields */}
                  <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Név"
                          size="small"
                          value={editingCustomer.name || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Mobil"
                          size="small"
                          value={editingCustomer.mobile || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, mobile: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                          Számlázási adatok
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Számlázási név"
                          size="small"
                          value={editingCustomer.billing_name || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_name: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Ország"
                          size="small"
                          value={editingCustomer.billing_country || 'Magyarország'}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_country: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Város"
                          size="small"
                          value={editingCustomer.billing_city || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_city: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Irányítószám"
                          size="small"
                          value={editingCustomer.billing_postal_code || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_postal_code: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Utca"
                          size="small"
                          value={editingCustomer.billing_street || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_street: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Házszám"
                          size="small"
                          value={editingCustomer.billing_house_number || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_house_number: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Adószám"
                          size="small"
                          value={editingCustomer.billing_tax_number || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_tax_number: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Cégjegyzékszám"
                          size="small"
                          value={editingCustomer.billing_company_reg_number || ''}
                          onChange={(e) => setEditingCustomer({ ...editingCustomer, billing_company_reg_number: e.target.value })}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              )}

              {/* Payment Buttons - Always visible at bottom */}
              <Box sx={{ display: 'flex', gap: 2, flexShrink: 0, mt: 'auto' }}>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  fullWidth
                  startIcon={<CashIcon />}
                  sx={{ py: 1.5 }}
                >
                  Készpénz
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  startIcon={<CardIcon />}
                  sx={{ py: 1.5 }}
                >
                  Bankkártya
                </Button>
                <Button
                  variant="contained"
                  color="info"
                  size="large"
                  fullWidth
                  startIcon={<TransferIcon />}
                  sx={{ py: 1.5 }}
                >
                  Utalás
                </Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

