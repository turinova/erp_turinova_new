'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { toast } from 'react-toastify'

// Simple SVG icons (matching MUI AddCircle and RemoveCircle)
const AddCircleIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
  </svg>
)

const RemoveCircleIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
  </svg>
)


// Plus icon for increment
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

// Minus icon for decrement
const MinusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
)

// Trash icon for delete
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// Helper function to round up to nearest 10
const roundUpToNearest10 = (value: number): number => {
  return Math.ceil(value / 10) * 10
}

// Helper function to convert hex color to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

interface ProductItem {
  id: string
  product_type: 'accessory' | 'material' | 'linear_material'
  name: string
  sku?: string
  quantity_on_hand: number
  gross_price: number
  net_price: number
  currency_name: string
  vat_id: string
  currency_id: string
  image_url?: string | null
  accessory_id?: string
  material_id?: string
  linear_material_id?: string
  // Material dimensions
  length_mm?: number
  width_mm?: number
  thickness_mm?: number
  // Linear material dimensions
  length?: number
  width?: number
  thickness?: number
}

interface CartItem {
  id: string
  product_type: 'accessory' | 'material' | 'linear_material'
  accessory_id?: string
  material_id?: string
  linear_material_id?: string
  name: string
  sku?: string
  quantity: number
  gross_price: number
  net_price: number
  currency_name: string
  vat_id: string
  currency_id: string
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
  feetype_id: string | null
  name: string
  amount: number
  currency_name: string
  vat_id: string
  currency_id: string
}

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

export default function POSPage() {
  // Force PIN entry every time app icon is tapped
  useEffect(() => {
    let hasClearedToken = false
    
    const forceLogout = async () => {
      if (hasClearedToken) return
      hasClearedToken = true
      
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
        // Redirect to login
        window.location.href = '/login'
      } catch (error) {
        console.error('Error forcing logout:', error)
        // Still redirect to login even if API call fails
        window.location.href = '/login'
      }
    }
    
    // Method 1: Check if page was loaded directly (not from cache)
    const handlePageShow = (e: PageTransitionEvent) => {
      // If page was NOT restored from cache, it's a fresh app launch
      if (!e.persisted) {
        forceLogout()
      }
    }
    
    // Method 2: Check navigation type
    if (typeof window !== 'undefined' && window.performance) {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (nav && (nav.type === 'navigate' || nav.type === 'reload')) {
        // Fresh page load - force logout
        forceLogout()
      }
    }
    
    // Method 3: Listen for pageshow event (handles PWA restores)
    window.addEventListener('pageshow', handlePageShow)
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [fees, setFees] = useState<FeeItem[]>([])
  const [discount, setDiscount] = useState<{ percent: number; amount: number } | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [highlightedCartItemId, setHighlightedCartItemId] = useState<string | null>(null)
  const [isEditingField, setIsEditingField] = useState(false)
  const [workerColor, setWorkerColor] = useState<string>('#1976d2') // Default blue
  const [feeModalOpen, setFeeModalOpen] = useState(false)
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [selectedFeeType, setSelectedFeeType] = useState<FeeType | null>(null)
  const [feeAmount, setFeeAmount] = useState<number>(0)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  // Barcode scanning refs
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef<boolean>(false)
  const lastScannedBarcodeRef = useRef<{ barcode: string; timestamp: number } | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scanAbortControllerRef = useRef<AbortController | null>(null)
  const searchAbortControllerRef = useRef<AbortController | null>(null)

  // Simple cache for barcode scans (last 50 items, 5 minutes TTL)
  const barcodeCacheRef = useRef<Map<string, { data: ProductItem; timestamp: number }>>(new Map())
  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  const CACHE_MAX_SIZE = 50

  // Fetch worker color on mount
  useEffect(() => {
    const fetchWorkerColor = async () => {
      try {
        const response = await fetch('/api/worker/color')
        if (response.ok) {
          const data = await response.json()
          if (data.color) {
            setWorkerColor(data.color)
          }
        }
      } catch (error) {
        console.error('Error fetching worker color:', error)
      }
    }
    fetchWorkerColor()
  }, [])

  // Fetch fee types on mount
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

  // Fetch customers when search term changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearchTerm.trim().length >= 2 || customerSearchTerm.trim().length === 0) {
        setIsLoadingCustomers(true)
        const searchParam = customerSearchTerm.trim().length >= 2 ? `?q=${encodeURIComponent(customerSearchTerm.trim())}` : ''
        fetch(`/api/customers${searchParam}`)
          .then(res => res.json())
          .then(data => {
            setCustomers(data || [])
            setIsLoadingCustomers(false)
          })
          .catch(err => {
            console.error('Error fetching customers:', err)
            setCustomers([])
            setIsLoadingCustomers(false)
          })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [customerSearchTerm])

  // Auto-add discount when customer is selected
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.discount_percent && selectedCustomer.discount_percent > 0 && !discount) {
      setDiscount({
        percent: selectedCustomer.discount_percent,
        amount: 0 // Will be calculated
      })
    }
  }, [selectedCustomer, discount])

  // Auto-focus barcode input on mount and after page becomes visible
  useEffect(() => {
    let focusAttempts = 0
    const maxAttempts = 15

    const focusInput = () => {
      // Check if page is ready and input exists
      if (
        barcodeInputRef.current && 
        !isEditingField && 
        document.hasFocus() &&
        document.readyState === 'complete'
      ) {
        try {
          // Ensure input is not disabled
          if (barcodeInputRef.current.disabled) {
            return false
          }
          
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
          
          // Verify it's actually focused
          if (document.activeElement === barcodeInputRef.current) {
            focusAttempts = 0 // Reset on success
            return true
          }
        } catch (e) {
          console.error('Focus error:', e)
        }
      }
      return false
    }

    // Initial focus after a short delay - retry if needed
    const attemptFocus = () => {
      if (focusAttempts < maxAttempts) {
        if (!focusInput()) {
          focusAttempts++
          setTimeout(attemptFocus, 150)
        }
      }
    }

    // Also focus when page becomes visible (handles redirect from login)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        focusAttempts = 0 // Reset attempts
        setTimeout(() => {
          attemptFocus()
        }, 200)
      }
    }
    
    // Focus on window focus (handles tab switching back)
    const handleWindowFocus = () => {
      focusAttempts = 0 // Reset attempts
      setTimeout(() => {
        attemptFocus()
      }, 100)
    }

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    // Wait for page to be fully loaded
    let timer1: NodeJS.Timeout | null = null
    let timer2: NodeJS.Timeout | null = null
    let loadHandler: (() => void) | null = null
    
    if (document.readyState === 'complete') {
      timer1 = setTimeout(attemptFocus, 300)
    } else {
      loadHandler = () => {
        timer1 = setTimeout(attemptFocus, 300)
      }
      window.addEventListener('load', loadHandler)
    }
    
    timer2 = setTimeout(attemptFocus, 500) // Fallback

    return () => {
      if (timer1) clearTimeout(timer1)
      if (timer2) clearTimeout(timer2)
      if (loadHandler) window.removeEventListener('load', loadHandler)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [isEditingField])

  // Refocus after cart changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanningRef.current) {
        refocusBarcodeInput()
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [cartItems, fees, discount])

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

  // Refocus barcode input when editing ends
  useEffect(() => {
    if (!isEditingField && barcodeInputRef.current) {
      const timer = setTimeout(() => {
        if (!isEditingField && barcodeInputRef.current) {
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isEditingField])

  // Refocus barcode input helper
  const refocusBarcodeInput = () => {
    if (isEditingField || !document.hasFocus()) {
      return
    }
    
    setTimeout(() => {
      if (isEditingField || !document.hasFocus()) return
      
      if (barcodeInputRef.current) {
        // Check if input is actually focused, if not, focus it
        if (document.activeElement !== barcodeInputRef.current) {
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
        }
      }
    }, 50)
  }

  // Handle barcode input change (debounced for scanner - 100ms)
  const handleBarcodeInputChange = (value: string) => {
    setBarcodeInput(value)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Set new timeout - trigger scan when input stops changing for 100ms
    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = value.trim()
      if (trimmedValue.length > 0 && !isScanningRef.current && !isEditingField) {
        handleBarcodeScan(trimmedValue)
      }
    }, 100)
  }

  // Handle barcode scan
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

    // Prevent duplicate scans (same barcode within 200ms)
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
        lastScannedBarcodeRef.current = null
        setBarcodeInput('')
        isScanningRef.current = false
        refocusBarcodeInput()
        return
      }

      const product: ProductItem = await response.json()

      // Barcode scanning only works for accessories
      if (product.product_type !== 'accessory') {
        toast.error('Vonalkód csak kellékekhez használható')
        lastScannedBarcodeRef.current = null
        setBarcodeInput('')
        isScanningRef.current = false
        refocusBarcodeInput()
        return
      }

      // Add to cache
      if (barcodeCacheRef.current.size >= CACHE_MAX_SIZE) {
        const firstKey = barcodeCacheRef.current.keys().next().value
        if (firstKey) {
          barcodeCacheRef.current.delete(firstKey)
        }
      }
      barcodeCacheRef.current.set(trimmedBarcode, { data: product, timestamp: now })

      // Add to cart and get the item ID that was added/updated
      const addedItemId = handleAddToCart(product)
      
      // Highlight the cart item
      if (addedItemId) {
        setHighlightedCartItemId(addedItemId)
        
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current)
        }
        
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedCartItemId(null)
        }, 1000)
      }
      
      // Clear input for next scan
      setBarcodeInput('')

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      console.error('Error scanning barcode:', error)
      toast.error('Hiba történt')
      lastScannedBarcodeRef.current = null
      setBarcodeInput('')
    } finally {
      isScanningRef.current = false
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
        }
      }, 150)
    }
  }

  // Add item to cart - returns the item ID that was added/updated
  const handleAddToCart = (product: ProductItem): string | null => {
    // Find existing item based on product type and ID
    let existingItem: CartItem | undefined
    if (product.product_type === 'accessory' && product.accessory_id) {
      existingItem = cartItems.find(item => item.product_type === 'accessory' && item.accessory_id === product.accessory_id)
    } else if (product.product_type === 'material' && product.material_id) {
      existingItem = cartItems.find(item => item.product_type === 'material' && item.material_id === product.material_id)
    } else if (product.product_type === 'linear_material' && product.linear_material_id) {
      existingItem = cartItems.find(item => item.product_type === 'linear_material' && item.linear_material_id === product.linear_material_id)
    }

    const roundedPrice = roundUpToNearest10(product.gross_price)
    
    if (existingItem) {
      // Increment quantity
      setCartItems(prev =>
        prev.map(item =>
          item.id === existingItem!.id
            ? { ...item, quantity: item.quantity + 1, gross_price: roundedPrice }
            : item
        )
      )
      return existingItem.id
    } else {
      // Add new item
      const newItem: CartItem = {
        id: Date.now().toString(),
        product_type: product.product_type,
        accessory_id: product.accessory_id,
        material_id: product.material_id,
        linear_material_id: product.linear_material_id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        gross_price: roundedPrice,
        net_price: product.net_price,
        currency_name: product.currency_name,
        vat_id: product.vat_id,
        currency_id: product.currency_id
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

  // Search products (with debouncing and request cancellation)
  useEffect(() => {
    // Cancel previous search request
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort()
    }

    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        setIsSearching(true)
        
        // Create new AbortController for this request
        const abortController = new AbortController()
        searchAbortControllerRef.current = abortController

        fetch(`/api/pos/accessories?search=${encodeURIComponent(searchTerm.trim())}`, {
          signal: abortController.signal
        })
          .then(res => {
            if (abortController.signal.aborted) {
              return null
            }
            if (!res.ok) {
              return []
            }
            return res.json()
          })
          .then(data => {
            if (abortController.signal.aborted) {
              return
            }
            if (Array.isArray(data)) {
              setSearchResults(data)
            } else {
              setSearchResults([])
            }
            setIsSearching(false)
          })
          .catch(err => {
            if (err.name === 'AbortError') {
              return
            }
            console.error('Error searching products:', err)
            if (!abortController.signal.aborted) {
              setSearchResults([])
              setIsSearching(false)
            }
          })
      } else {
        setSearchResults([])
        setIsSearching(false)
      }
    }, 150)

    return () => {
      clearTimeout(timer)
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort()
        searchAbortControllerRef.current = null
      }
    }
  }, [searchTerm])

  // Handle fee modal open (for adding new fee)
  const handleOpenFeeModal = () => {
    if (feeTypes.length === 0) {
      toast.warning('Nincsenek elérhető díjtípusok')
      return
    }
    setEditingFeeId(null)
    setSelectedFeeType(feeTypes[0])
    setFeeAmount(roundUpToNearest10(feeTypes[0].gross_price))
    setFeeModalOpen(true)
    setIsEditingField(true)
  }

  // Handle fee modal open (for editing existing fee)
  const handleEditFee = (fee: FeeItem) => {
    const feeType = feeTypes.find(ft => ft.id === fee.feetype_id)
    if (!feeType) {
      toast.error('Díjtípus nem található')
      return
    }
    setEditingFeeId(fee.id)
    setSelectedFeeType(feeType)
    setFeeAmount(fee.amount)
    setFeeModalOpen(true)
    setIsEditingField(true)
  }

  // Handle fee modal close
  const handleCloseFeeModal = () => {
    setFeeModalOpen(false)
    setEditingFeeId(null)
    setSelectedFeeType(null)
    setFeeAmount(0)
    setIsEditingField(false)
  }

  // Handle fee type selection change
  const handleFeeTypeChange = (feeTypeId: string) => {
    const feeType = feeTypes.find(ft => ft.id === feeTypeId)
    if (feeType) {
      setSelectedFeeType(feeType)
      setFeeAmount(roundUpToNearest10(feeType.gross_price))
    }
  }

  // Handle save fee (both add and edit)
  const handleSaveFee = () => {
    if (!selectedFeeType) {
      toast.error('Válasszon díjtípust')
      return
    }
    if (feeAmount === 0) {
      toast.error('Adja meg a díj összegét')
      return
    }
    
    if (editingFeeId) {
      // Edit existing fee
      setFees(prev =>
        prev.map(fee =>
          fee.id === editingFeeId
            ? {
                ...fee,
                feetype_id: selectedFeeType.id,
                name: selectedFeeType.name,
                amount: feeAmount,
                currency_name: selectedFeeType.currency_name,
                vat_id: selectedFeeType.vat_id,
                currency_id: selectedFeeType.currency_id
              }
            : fee
        )
      )
    } else {
      // Add new fee
      const newFee: FeeItem = {
        id: Date.now().toString(),
        feetype_id: selectedFeeType.id,
        name: selectedFeeType.name,
        amount: feeAmount,
        currency_name: selectedFeeType.currency_name,
        vat_id: selectedFeeType.vat_id,
        currency_id: selectedFeeType.currency_id
      }
      setFees(prev => [...prev, newFee])
    }
    
    handleCloseFeeModal()
  }

  // Handle delete fee
  const handleDeleteFee = (feeId: string) => {
    setFees(prev => prev.filter(fee => fee.id !== feeId))
    toast.success('Díj törölve')
  }

  // Handle discount modal open
  const handleOpenDiscountModal = () => {
    if (discount) {
      // If discount already exists, open modal with current value for editing
      setDiscountPercent(discount.percent)
    } else {
      setDiscountPercent(0)
    }
    setDiscountModalOpen(true)
    setIsEditingField(true)
  }

  // Handle discount modal close
  const handleCloseDiscountModal = () => {
    setDiscountModalOpen(false)
    setDiscountPercent(0)
    setIsEditingField(false)
  }

  // Handle save discount
  const handleSaveDiscount = () => {
    if (discountPercent <= 0 || discountPercent > 100) {
      toast.error('Adjon meg egy érvényes kedvezmény százalékot (1-100%)')
      return
    }

    // Store only the percentage, amount will be calculated dynamically
    setDiscount({
      percent: discountPercent,
      amount: 0 // Will be calculated in useMemo
    })
    
    handleCloseDiscountModal()
  }

  // Calculate discount amount preview (for modal display)
  const discountAmountPreview = useMemo(() => {
    const itemsTotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.gross_price), 0)
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)
    const subtotal = itemsTotal + feesTotal
    return (subtotal * discountPercent) / 100
  }, [cartItems, fees, discountPercent])

  // Handle delete discount
  const handleDeleteDiscount = () => {
    setDiscount(null)
  }

  // Handle predefined discount percentage
  const handlePredefinedDiscount = (percent: number) => {
    setDiscountPercent(percent)
  }

  // Calculate discount amount (recalculated when items/fees change)
  const discountAmount = useMemo(() => {
    if (!discount) return 0
    const itemsTotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.gross_price), 0)
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)
    const subtotal = itemsTotal + feesTotal
    return (subtotal * discount.percent) / 100
  }, [cartItems, fees, discount])

  // Calculate total in real-time
  const total = useMemo(() => {
    const itemsTotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.gross_price), 0)
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)
    const subtotal = itemsTotal + feesTotal
    return subtotal - discountAmount
  }, [cartItems, fees, discountAmount])

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Hidden barcode input for scanner */}
      <input
        ref={barcodeInputRef}
        type="text"
        value={barcodeInput}
        onChange={(e) => handleBarcodeInputChange(e.target.value)}
        onKeyDown={(e) => {
          // Barcode scanners often send Enter at the end
          if (e.key === 'Enter') {
            e.preventDefault()
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current)
              scanTimeoutRef.current = null
            }
            const trimmedValue = barcodeInput.trim()
            if (trimmedValue.length > 0 && !isScanningRef.current) {
              handleBarcodeScan(trimmedValue)
            }
          }
        }}
        onBlur={() => {
          // Immediately refocus if we're not editing a field
          if (!isEditingField && document.hasFocus()) {
            setTimeout(() => {
              if (barcodeInputRef.current && !isEditingField) {
                barcodeInputRef.current.focus()
              }
            }, 10)
          }
        }}
        disabled={isEditingField}
        className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
        autoFocus={false}
        tabIndex={isEditingField ? -1 : 0}
        autoComplete="off"
      />

      {/* Fixed Top Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        {/* Customer Selection */}
        <div className="p-4 space-y-3">
          {/* Customer Dropdown - Only show if no customer selected */}
          {!selectedCustomer && (
            <div className="relative">
              <input
                type="text"
                placeholder="Ügyfél keresése..."
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value)
                  setIsEditingField(true)
                }}
                onFocus={() => setIsEditingField(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setIsEditingField(false)
                    // Clear search if no customer selected
                    if (!selectedCustomer) {
                      setCustomerSearchTerm('')
                    }
                  }, 200)
                }}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              {/* Customer Dropdown Results */}
              {customerSearchTerm.trim().length >= 2 && (
                <div className="absolute z-20 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {isLoadingCustomers ? (
                    <div className="p-4 text-center text-gray-500">Keresés...</div>
                  ) : customers.length > 0 ? (
                    customers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setCustomerSearchTerm(customer.name)
                          setIsEditingField(false)
                        }}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 active:bg-blue-100"
                      >
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        {customer.email && (
                          <p className="text-xs text-gray-500">{customer.email}</p>
                        )}
                        {customer.mobile && (
                          <p className="text-xs text-gray-500">{customer.mobile}</p>
                        )}
                        {customer.discount_percent && customer.discount_percent > 0 && (
                          <p className="text-xs text-orange-600 font-semibold mt-1">
                            Kedvezmény: {customer.discount_percent}%
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">Nincs találat</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected Customer Display */}
          {selectedCustomer && (
            <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{selectedCustomer.name}</p>
                  {selectedCustomer.email && (
                    <p className="text-xs text-gray-500">{selectedCustomer.email}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null)
                    setCustomerSearchTerm('')
                  }}
                  className="w-8 h-8 rounded-full border-2 border-red-300 text-red-600 flex items-center justify-center active:bg-red-50 active:scale-95 transition-all"
                  aria-label="Ügyfél eltávolítása"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Product Search */}
          <input
            type="text"
            placeholder="Keresés név vagy SKU alapján..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsEditingField(true)}
            onBlur={() => {
              setTimeout(() => setIsEditingField(false), 100)
            }}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Search Results - Fixed section */}
        {searchTerm.trim().length >= 2 && (
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
            {isSearching ? (
              <div className="text-center text-gray-500 py-4">
                <p>Keresés...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                <p>Nincs találat</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((product) => {
                  const roundedPrice = roundUpToNearest10(product.gross_price)
                  const getTypeLabel = () => {
                    switch (product.product_type) {
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
                  const getDimensions = () => {
                    if (product.product_type === 'material') {
                      return `${product.length_mm}×${product.width_mm}×${product.thickness_mm} mm`
                    } else if (product.product_type === 'linear_material') {
                      return `${product.length}×${product.width}×${product.thickness} mm`
                    }
                    return null
                  }
                  return (
                    <div
                      key={`${product.product_type}_${product.id}`}
                      onClick={() => {
                        const addedItemId = handleAddToCart(product)
                        if (addedItemId) {
                          setHighlightedCartItemId(addedItemId)
                          if (highlightTimeoutRef.current) {
                            clearTimeout(highlightTimeoutRef.current)
                          }
                          highlightTimeoutRef.current = setTimeout(() => {
                            setHighlightedCartItemId(null)
                          }, 1000)
                        }
                        setSearchTerm('') // Clear search after adding
                      }}
                      className="bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all active:scale-98"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 flex-shrink-0">
                              {getTypeLabel()}
                            </span>
                          </div>
                          {product.product_type === 'accessory' && product.sku && (
                            <p className="text-xs text-gray-500 truncate">SKU: {product.sku}</p>
                          )}
                          {getDimensions() && (
                            <p className="text-xs text-gray-500 truncate">{getDimensions()}</p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">
                            Készlet: {product.quantity_on_hand} db
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900 text-lg">
                            {roundedPrice.toLocaleString('hu-HU')} {product.currency_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Cart Items Section */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Kosár</h2>
            {cartItems.length === 0 && fees.length === 0 && !discount ? (
              <div className="text-center text-gray-500 py-8">
                <p>A kosár üres</p>
              </div>
            ) : (
              <div className="space-y-3">
              {/* Cart Items */}
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white p-4 rounded-lg border-2 transition-all duration-300 ${
                    highlightedCartItemId === item.id
                      ? 'border-green-500 bg-green-50 shadow-md'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Top Row: Product Name and SKU */}
                  <div className="mb-3">
                    <p className="font-semibold text-gray-900 text-base break-words">{item.name}</p>
                    {item.sku && (
                      <p className="text-xs text-gray-500 mt-1 break-words">SKU: {item.sku}</p>
                    )}
                  </div>

                  {/* Bottom Row: Controls and Pricing */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Unit Price */}
                    <div className="flex-shrink-0">
                      <p className="text-sm text-gray-600">
                        {item.gross_price.toLocaleString('hu-HU')} Ft / db
                      </p>
                    </div>

                    {/* Center: Quantity Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuantityChange(item.id, item.quantity - 1)
                        }}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 text-gray-700 flex items-center justify-center active:bg-gray-100 active:scale-95 transition-all touch-manipulation"
                        aria-label="Mennyiség csökkentése"
                      >
                        <MinusIcon />
                      </button>
                      <div className={`w-12 text-center font-semibold text-lg ${
                        highlightedCartItemId === item.id ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {item.quantity}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuantityChange(item.id, item.quantity + 1)
                        }}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 text-gray-700 flex items-center justify-center active:bg-gray-100 active:scale-95 transition-all touch-manipulation"
                        aria-label="Mennyiség növelése"
                      >
                        <PlusIcon />
                      </button>
                    </div>

                    {/* Right: Subtotal */}
                    <div className="flex-shrink-0">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 text-lg whitespace-nowrap">
                          {(item.quantity * item.gross_price).toLocaleString('hu-HU')} Ft
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Fees Section */}
              {fees.length > 0 && (
                <>
                  <div className="pt-2 pb-1">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase">Díjak</h3>
                  </div>
                  {fees.map((fee) => (
                    <div
                      key={fee.id}
                      onClick={() => handleEditFee(fee)}
                      className="bg-white p-3 rounded-lg border-2 border-blue-200 bg-blue-50 cursor-pointer hover:border-blue-400 hover:bg-blue-100 active:scale-98 transition-all"
                    >
                      {/* Single Row: Title, Delete, Amount */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Fee Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-base truncate">{fee.name}</p>
                        </div>

                        {/* Center: Delete button */}
                        <div className="flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteFee(fee.id)
                            }}
                            className="w-10 h-10 rounded-lg border-2 border-red-300 text-red-600 flex items-center justify-center active:bg-red-50 active:scale-95 transition-all touch-manipulation"
                            aria-label="Díj törlése"
                          >
                            <TrashIcon />
                          </button>
                        </div>

                        {/* Right: Amount */}
                        <div className="flex-shrink-0">
                          <p className="font-semibold text-gray-900 text-lg whitespace-nowrap">
                            {fee.amount.toLocaleString('hu-HU')} {fee.currency_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Discount Section */}
              {discount && (
                <>
                  <div className="pt-2 pb-1">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase">Kedvezmény</h3>
                  </div>
                  <div
                    onClick={handleOpenDiscountModal}
                    className="bg-white p-3 rounded-lg border-2 border-orange-200 bg-orange-50 cursor-pointer hover:border-orange-400 hover:bg-orange-100 active:scale-98 transition-all"
                  >
                    {/* Single Row: Title, Delete, Amount */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Discount Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-base truncate">Kedvezmény ({discount.percent}%)</p>
                      </div>

                      {/* Center: Delete button */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteDiscount()
                          }}
                          className="w-10 h-10 rounded-lg border-2 border-red-300 text-red-600 flex items-center justify-center active:bg-red-50 active:scale-95 transition-all touch-manipulation"
                          aria-label="Kedvezmény törlése"
                        >
                          <TrashIcon />
                        </button>
                      </div>

                      {/* Right: Amount */}
                      <div className="flex-shrink-0">
                        <p className="font-semibold text-gray-900 text-lg whitespace-nowrap">
                          -{discountAmount.toLocaleString('hu-HU')} Ft
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              </div>
            )}
          </div>
        </div>

      {/* Fixed Bottom Section */}
      <div className="bg-white border-t border-gray-200 shadow-lg flex-shrink-0">
        {/* Row 1: Összesen, Fee, Discount */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {/* Összesen */}
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">Összesen</p>
            <p className="text-2xl font-bold text-gray-900">
              {total.toLocaleString('hu-HU')} Ft
            </p>
          </div>

          {/* Fee and Discount Icons */}
          <div className="flex gap-3">
            {/* Fee Button */}
            <button
              onClick={handleOpenFeeModal}
              className="w-12 h-12 rounded-full border-2 border-blue-600 text-blue-600 flex items-center justify-center active:bg-blue-50 active:scale-95 transition-all"
              aria-label="Díj hozzáadása"
            >
              <AddCircleIcon />
            </button>

            {/* Discount Button */}
            <button
              onClick={handleOpenDiscountModal}
              className="w-12 h-12 rounded-full border-2 border-orange-600 text-orange-600 flex items-center justify-center active:bg-orange-50 active:scale-95 transition-all"
              aria-label="Kedvezmény hozzáadása"
            >
              <RemoveCircleIcon />
            </button>
          </div>
        </div>

        {/* Row 2: Fizetés Button */}
        <div className="p-4">
          <button
            disabled={cartItems.length === 0}
            className="w-full text-white py-4 rounded-lg font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            style={{
              backgroundColor: cartItems.length === 0 ? undefined : workerColor,
              opacity: cartItems.length === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (cartItems.length > 0) {
                // Darken color on hover
                const rgb = hexToRgb(workerColor)
                if (rgb) {
                  e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, rgb.r - 20)}, ${Math.max(0, rgb.g - 20)}, ${Math.max(0, rgb.b - 20)})`
                }
              }
            }}
            onMouseLeave={(e) => {
              if (cartItems.length > 0) {
                e.currentTarget.style.backgroundColor = workerColor
              }
            }}
            onMouseDown={(e) => {
              if (cartItems.length > 0) {
                // Even darker on active/press
                const rgb = hexToRgb(workerColor)
                if (rgb) {
                  e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`
                  e.currentTarget.style.transform = 'scale(0.98)'
                }
              }
            }}
            onMouseUp={(e) => {
              if (cartItems.length > 0) {
                e.currentTarget.style.backgroundColor = workerColor
                e.currentTarget.style.transform = 'scale(1)'
              }
            }}
          >
            Fizetés
          </button>
        </div>
      </div>

      {/* Fee Modal */}
      {feeModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseFeeModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingFeeId ? 'Díj szerkesztése' : 'Díj hozzáadása'}
            </h2>
            
            {/* Fee Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Díj típus
              </label>
              <select
                value={selectedFeeType?.id || ''}
                onChange={(e) => handleFeeTypeChange(e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {feeTypes.map((feeType) => (
                  <option key={feeType.id} value={feeType.id}>
                    {feeType.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fee Amount */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Összeg (Bruttó)
              </label>
              <input
                type="number"
                value={feeAmount}
                onChange={(e) => {
                  const val = e.target.value
                  const numValue = val === '' ? 0 : parseFloat(val) || 0
                  setFeeAmount(numValue)
                }}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="0"
              />
              {selectedFeeType && (
                <p className="text-xs text-gray-500 mt-1">
                  Alapértelmezett: {roundUpToNearest10(selectedFeeType.gross_price).toLocaleString('hu-HU')} {selectedFeeType.currency_name}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCloseFeeModal}
                className="flex-1 px-4 py-3 text-lg font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 active:scale-95 transition-all"
              >
                Mégse
              </button>
              <button
                onClick={handleSaveFee}
                className="flex-1 px-4 py-3 text-lg font-semibold text-white rounded-lg active:scale-95 transition-all"
                style={{ backgroundColor: workerColor }}
                onMouseEnter={(e) => {
                  const rgb = hexToRgb(workerColor)
                  if (rgb) {
                    e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, rgb.r - 20)}, ${Math.max(0, rgb.g - 20)}, ${Math.max(0, rgb.b - 20)})`
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = workerColor
                }}
              >
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {discountModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseDiscountModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Kedvezmény {discount ? 'szerkesztése' : 'hozzáadása'}
            </h2>
            
            {/* Predefined Percentage Buttons */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gyors választás
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => handlePredefinedDiscount(percent)}
                    className={`px-4 py-3 text-lg font-semibold rounded-lg border-2 transition-all active:scale-95 ${
                      discountPercent === percent
                        ? 'border-orange-600 bg-orange-100 text-orange-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Discount Percentage */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kedvezmény százalék
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={discountPercent}
                onChange={(e) => {
                  const val = e.target.value
                  const numValue = val === '' ? 0 : parseFloat(val) || 0
                  setDiscountPercent(Math.min(100, Math.max(0, numValue)))
                }}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                placeholder="0"
              />
              {discountPercent > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Kedvezmény összege: {discountAmountPreview.toLocaleString('hu-HU')} Ft
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCloseDiscountModal}
                className="flex-1 px-4 py-3 text-lg font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 active:scale-95 transition-all"
              >
                Mégse
              </button>
              <button
                onClick={handleSaveDiscount}
                disabled={discountPercent <= 0 || discountPercent > 100}
                className="flex-1 px-4 py-3 text-lg font-semibold text-white rounded-lg active:scale-95 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: (discountPercent > 0 && discountPercent <= 100) ? workerColor : undefined
                }}
                onMouseEnter={(e) => {
                  if (discountPercent > 0 && discountPercent <= 100) {
                    const rgb = hexToRgb(workerColor)
                    if (rgb) {
                      e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, rgb.r - 20)}, ${Math.max(0, rgb.g - 20)}, ${Math.max(0, rgb.b - 20)})`
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (discountPercent > 0 && discountPercent <= 100) {
                    e.currentTarget.style.backgroundColor = workerColor
                  }
                }}
              >
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
