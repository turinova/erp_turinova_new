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

// Helper function to round up to nearest 10
const roundUpToNearest10 = (value: number): number => {
  return Math.ceil(value / 10) * 10
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

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [fees, setFees] = useState<{ id: string; name: string; amount: number }[]>([])
  const [discount, setDiscount] = useState<{ percent: number; amount: number } | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [highlightedCartItemId, setHighlightedCartItemId] = useState<string | null>(null)
  const [isEditingField, setIsEditingField] = useState(false)

  // Barcode scanning refs
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef<boolean>(false)
  const lastScannedBarcodeRef = useRef<{ barcode: string; timestamp: number } | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scanAbortControllerRef = useRef<AbortController | null>(null)

  // Simple cache for barcode scans (last 50 items, 5 minutes TTL)
  const barcodeCacheRef = useRef<Map<string, { data: ProductItem; timestamp: number }>>(new Map())
  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  const CACHE_MAX_SIZE = 50

  // Auto-focus barcode input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

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
    if (isEditingField) {
      return
    }
    
    setTimeout(() => {
      if (isEditingField) return
      
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
        barcodeInputRef.current.select()
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

  // Calculate total in real-time
  const total = useMemo(() => {
    const itemsTotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.gross_price), 0)
    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0)
    const discountAmount = discount ? discount.amount : 0
    return itemsTotal + feesTotal - discountAmount
  }, [cartItems, fees, discount])

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
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
        disabled={isEditingField}
        className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
        autoFocus={false}
        tabIndex={isEditingField ? -1 : 0}
        autoComplete="off"
      />

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Product Search */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <input
            type="text"
            placeholder="Keresés..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsEditingField(true)}
            onBlur={() => {
              setTimeout(() => setIsEditingField(false), 100)
            }}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Cart Items */}
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Kosár</h2>
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>A kosár üres</p>
            </div>
          ) : (
            <div className="space-y-3">
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
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Section */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
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
              className="w-12 h-12 rounded-full border-2 border-blue-600 text-blue-600 flex items-center justify-center active:bg-blue-50 active:scale-95 transition-all"
              aria-label="Díj hozzáadása"
            >
              <AddCircleIcon />
            </button>

            {/* Discount Button */}
            <button
              className="w-12 h-12 rounded-full border-2 border-orange-600 text-orange-600 flex items-center justify-center active:bg-orange-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={discount !== null}
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
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:bg-blue-700 active:scale-98 transition-all"
          >
            Fizetés
          </button>
        </div>
      </div>
    </div>
  )
}
