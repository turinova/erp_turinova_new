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
  DialogActions,
  Checkbox,
  FormControlLabel,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Close as CloseIcon,
  AttachMoney as CashIcon,
  CreditCard as CardIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon
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
  // Accessory fields
  accessory_id?: string
  unit_name?: string
  unit_shortform?: string
  // Material fields
  material_id?: string
  length_mm?: number
  width_mm?: number
  thickness_mm?: number
  base_price?: number
  multiplier?: number
  vat_percent?: number
  unit_price_per_sqm?: number
  // Linear material fields
  linear_material_id?: string
  length?: number
  width?: number
  thickness?: number
  unit_price_per_m?: number
}

// Helper function to round to nearest 5
const roundPrice = (value: number): number => {
  return Math.round(value / 5) * 5
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
  // Per-item discount fields
  discount_percentage?: number
  discount_amount?: number
  // Material dimensions (for display)
  length_mm?: number
  width_mm?: number
  thickness_mm?: number
  // Linear material dimensions (for display)
  length?: number
  width?: number
  thickness?: number
  // Unit information (for accessories)
  unit_name?: string
  unit_shortform?: string
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
  quantity: number
  price: number
  currency_name: string
  vat_id: string
  currency_id: string
  unit_price_net: number
  unit_price_gross: number
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
  const [searchResults, setSearchResults] = useState<ProductItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})
  const [fees, setFees] = useState<FeeItem[]>([])
  const [discount, setDiscount] = useState<DiscountItem | null>(null)
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [highlightedCartItemId, setHighlightedCartItemId] = useState<string | null>(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingPaymentType, setPendingPaymentType] = useState<'cash' | 'card' | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string>('')
  // State for expanded cart item accordions
  const [expandedCartItems, setExpandedCartItems] = useState<Set<string>>(new Set())
  // State for discount input mode per item (percentage or amount)
  const [itemDiscountMode, setItemDiscountMode] = useState<Record<string, 'percentage' | 'amount'>>({})

  // Helper function to fetch accessory data by ID
  const fetchAccessoryData = async (accessoryId: string): Promise<{ vat_id: string; currency_id: string } | null> => {
    try {
      const response = await fetch(`/api/accessories/${accessoryId}`)
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      return {
        vat_id: data.vat_id || '',
        currency_id: data.currency_id || ''
      }
    } catch (error) {
      console.error('Error fetching accessory data:', error)
      return null
    }
  }

  // Validate and fix cart items - add missing vat_id and currency_id
  const validateAndFixCartItems = async (items: CartItem[]): Promise<CartItem[]> => {
    const fixedItems: CartItem[] = []
    const itemsToFix: { item: CartItem; index: number }[] = []

    // Check which items need fixing (only accessories can be fixed via API)
    items.forEach((item, index) => {
      if (!item.vat_id || !item.currency_id) {
        // Only try to fix accessories (materials/linear_materials should always have these from search)
        if (item.product_type === 'accessory' && item.accessory_id) {
          itemsToFix.push({ item, index })
        } else {
          // Materials/linear_materials without vat_id/currency_id should be removed
          // (they should always have these from search results)
        }
      } else {
        fixedItems.push(item)
      }
    })

    // If no items need fixing, return as-is
    if (itemsToFix.length === 0) {
      return items
    }

    // Fetch missing data for accessories that need it
    const fixPromises = itemsToFix.map(async ({ item }) => {
      if (item.product_type === 'accessory' && item.accessory_id) {
        const accessoryData = await fetchAccessoryData(item.accessory_id)
        if (accessoryData && accessoryData.vat_id && accessoryData.currency_id) {
          return {
            ...item,
            vat_id: accessoryData.vat_id,
            currency_id: accessoryData.currency_id
          }
        }
      }
      // If we can't fetch the data, return null to remove the item
      return null
    })

    const fixedResults = await Promise.all(fixPromises)
    
    // Add fixed items to the array
    fixedResults.forEach((fixedItem) => {
      if (fixedItem) {
        fixedItems.push(fixedItem)
      }
    })

    // If some items were removed, show a warning
    if (fixedResults.some(item => item === null)) {
      toast.warning('Néhány termék eltávolítva a kosárból, mert nem található az adatbázisban.')
    }

    return fixedItems
  }

  // Load cart from session storage on mount (NON-BLOCKING for performance)
  useEffect(() => {
    const loadCartFromStorage = async () => {
      try {
        const savedCartItems = sessionStorage.getItem('pos_cart_items')
        const savedFees = sessionStorage.getItem('pos_fees')
        const savedDiscount = sessionStorage.getItem('pos_discount')
        const savedWorkerId = sessionStorage.getItem('pos_selected_worker_id')
        
        // Load cart items immediately (non-blocking) for instant page load
        if (savedCartItems) {
          const parsedItems: CartItem[] = JSON.parse(savedCartItems)
          // Set cart items immediately so page is interactive
          setCartItems(parsedItems)
          
          // Validate and fix items in the background (non-blocking)
          // This ensures page loads fast while validation happens async
          validateAndFixCartItems(parsedItems).then((validatedItems) => {
            // Only update if items changed (to avoid unnecessary re-renders)
            if (JSON.stringify(validatedItems) !== JSON.stringify(parsedItems)) {
              setCartItems(validatedItems)
            }
          }).catch((error) => {
            console.error('Error validating cart items:', error)
            // Cart items are already loaded, so page remains functional
          })
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
    }

    loadCartFromStorage()
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
  const barcodeCacheRef = useRef<Map<string, { data: ProductItem; timestamp: number }>>(new Map())
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

  // Refocus barcode input when editing ends
  useEffect(() => {
    if (!isEditingField && barcodeInputRef.current) {
      // Small delay to ensure the blur from the fee field is complete
      const timer = setTimeout(() => {
        const activeElement = document.activeElement
        const isCriticalField = 
          activeElement?.id === 'fee-price-input' ||
          activeElement?.id === 'discount-percentage-input' ||
          activeElement?.closest('[id="fee-price-input"]') ||
          activeElement?.closest('[id="discount-percentage-input"]')
        
        // Only refocus if not in a critical field and not scanning
        if (!isCriticalField && !isScanningRef.current && barcodeInputRef.current) {
          barcodeInputRef.current.focus()
          barcodeInputRef.current.select()
        }
      }, 150)
      
      return () => clearTimeout(timer)
    }
  }, [isEditingField])

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

  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Some scanners send US key codes but the OS layout maps '-' -> 'ü', '0' -> 'ö'
  const normalizeBarcode = (input: string): string => {
    const charMap: Record<string, string> = {
      'ü': '-',
      'ö': '0'
    }
    return input
      .split('')
      .map(char => charMap[char] || char)
      .join('')
  }

  // Handle barcode input change (debounced for scanner - optimized to 100ms)
  const handleBarcodeInputChange = (value: string) => {
    // Check if we're in a critical editing field FIRST (before any processing)
    const activeElement = document.activeElement
    const isCriticalField = 
      activeElement?.id === 'fee-price-input' ||
      activeElement?.id === 'discount-percentage-input' ||
      activeElement?.id === 'item-gross-price-input' ||
      activeElement?.id === 'item-discount-input' ||
      activeElement?.closest('[id="fee-price-input"]') ||
      activeElement?.closest('[id="discount-percentage-input"]') ||
      activeElement?.closest('[id="item-gross-price-input"]') ||
      activeElement?.closest('[id="item-discount-input"]') ||
      activeElement?.closest('[data-accordion-field="true"]')
    
    // If in critical field, ignore barcode input completely
    if (isCriticalField) {
      setBarcodeInput('')
      return
    }

    // Don't process if user is editing a critical field (fee price, discount)
    // But allow barcode scanning even when search field has focus
    if (isEditingField) {
      // Only block if we're actually in a critical editing field
      if (isCriticalField) {
        setBarcodeInput('')
        return
      }
      // Otherwise, allow barcode scanning to continue
    }

    const normalizedValue = normalizeBarcode(value)
    setBarcodeInput(normalizedValue)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Set new timeout - trigger scan when input stops changing for 100ms (optimized from 300ms)
    // Barcode scanners typically send characters very quickly, so we wait a bit
    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = normalizedValue.trim()
      // Double-check active element before scanning
      const currentActiveElement = document.activeElement
      const stillInCriticalField = 
        currentActiveElement?.id === 'fee-price-input' ||
        currentActiveElement?.id === 'discount-percentage-input' ||
        currentActiveElement?.id === 'item-gross-price-input' ||
        currentActiveElement?.id === 'item-discount-input' ||
        currentActiveElement?.closest('[id="fee-price-input"]') ||
        currentActiveElement?.closest('[id="discount-percentage-input"]') ||
        currentActiveElement?.closest('[id="item-gross-price-input"]') ||
        currentActiveElement?.closest('[id="item-discount-input"]') ||
        currentActiveElement?.closest('[data-accordion-field="true"]')
      
      if (trimmedValue.length > 0 && !isScanningRef.current && !isEditingField && !stillInCriticalField) {
        handleBarcodeScan(trimmedValue)
      }
    }, 100)
  }

  // Refocus barcode input helper (optimized - no requestAnimationFrame)
  const refocusBarcodeInput = () => {
    // Don't refocus if we're editing a critical field
    if (isEditingField) {
      return
    }
    
    // Check if we're in a critical editing field
    const activeElement = document.activeElement
    const isCriticalField = 
      activeElement?.id === 'fee-price-input' ||
      activeElement?.id === 'discount-percentage-input' ||
      activeElement?.closest('[id="fee-price-input"]') ||
      activeElement?.closest('[id="discount-percentage-input"]')
    
    if (isCriticalField) {
      return // Don't refocus if user is editing a critical field
    }
    
    // Use a slightly longer delay to ensure state is updated
    setTimeout(() => {
      // Double-check state before refocusing
      if (isEditingField) return
      
      const currentActiveElement = document.activeElement
      const stillInCriticalField = 
        currentActiveElement?.id === 'fee-price-input' ||
        currentActiveElement?.id === 'discount-percentage-input' ||
        currentActiveElement?.id === 'item-gross-price-input' ||
        currentActiveElement?.id === 'item-discount-input' ||
        currentActiveElement?.closest('[id="fee-price-input"]') ||
        currentActiveElement?.closest('[id="discount-percentage-input"]') ||
        currentActiveElement?.closest('[id="item-gross-price-input"]') ||
        currentActiveElement?.closest('[id="item-discount-input"]') ||
        currentActiveElement?.closest('[data-accordion-field="true"]')
      
      if (stillInCriticalField) return
      
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
        barcodeInputRef.current.select() // Select all text for easy clearing
      }
    }, 50) // Slightly longer delay to ensure state updates
  }

  // Handle barcode scan (optimized with cache and request cancellation)
  const handleBarcodeScan = async (barcode: string) => {
    // Check if we're in a critical editing field
    const activeElement = document.activeElement
    const isCriticalField = 
      activeElement?.id === 'fee-price-input' ||
      activeElement?.id === 'discount-percentage-input' ||
      activeElement?.id === 'item-gross-price-input' ||
      activeElement?.id === 'item-discount-input' ||
      activeElement?.closest('[id="fee-price-input"]') ||
      activeElement?.closest('[id="discount-percentage-input"]') ||
      activeElement?.closest('[id="item-gross-price-input"]') ||
      activeElement?.closest('[id="item-discount-input"]') ||
      activeElement?.closest('[data-accordion-field="true"]')
    
    if (!barcode || !barcode.trim() || (isEditingField && isCriticalField)) {
      refocusBarcodeInput()
      return
    }

    const normalizedBarcode = normalizeBarcode(barcode.trim())

    // Check cache first
    const cached = barcodeCacheRef.current.get(normalizedBarcode)
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
      lastScannedBarcodeRef.current.barcode === normalizedBarcode &&
      now - lastScannedBarcodeRef.current.timestamp < 200
    ) {
      console.log('Duplicate scan ignored (too fast):', normalizedBarcode)
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
    lastScannedBarcodeRef.current = { barcode: normalizedBarcode, timestamp: now }

    // Create new AbortController for this request
    const abortController = new AbortController()
    scanAbortControllerRef.current = abortController

    try {
      const response = await fetch(`/api/pos/accessories/by-barcode?barcode=${encodeURIComponent(normalizedBarcode)}`, {
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
        // Remove oldest entry
        const firstKey = barcodeCacheRef.current.keys().next().value
        if (firstKey) {
          barcodeCacheRef.current.delete(firstKey)
        }
      }
      barcodeCacheRef.current.set(normalizedBarcode, { data: product, timestamp: now })

      // Add to cart and get the item ID that was added/updated
      const addedItemId = handleAddToCart(product)
      
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

    // Use unit price for materials and linear_materials, whole piece price for accessories
    let priceToUse = product.gross_price
    let netPriceToUse = product.net_price
    
    if (product.product_type === 'material' && product.unit_price_per_sqm) {
      priceToUse = product.unit_price_per_sqm
      // Calculate unit net price from unit gross price using VAT rate
      const vatPercent = product.vat_percent || 0
      netPriceToUse = priceToUse / (1 + vatPercent / 100)
    } else if (product.product_type === 'linear_material' && product.unit_price_per_m) {
      priceToUse = product.unit_price_per_m
      // Calculate unit net price from unit gross price using VAT rate
      const vatPercent = product.vat_percent || 0
      netPriceToUse = priceToUse / (1 + vatPercent / 100)
    }
    const roundedPrice = Math.round(priceToUse / 5) * 5
    const roundedNetPrice = Math.round(netPriceToUse)
    
    if (existingItem) {
      // Increment quantity by 1.00
      setCartItems(prev =>
        prev.map(item =>
          item.id === existingItem!.id
            ? { ...item, quantity: item.quantity + 1.00, gross_price: roundedPrice, net_price: roundedNetPrice }
            : item
        )
      )
      return existingItem.id
    } else {
      // Add new item with quantity 1.00
      const newItem: CartItem = {
        id: Date.now().toString(),
        product_type: product.product_type,
        accessory_id: product.accessory_id,
        material_id: product.material_id,
        linear_material_id: product.linear_material_id,
        name: product.name,
        sku: product.sku,
        quantity: 1.00,
        gross_price: roundedPrice,
        net_price: roundedNetPrice,  // Use calculated unit net price for materials/linear_materials
        currency_name: product.currency_name,
        vat_id: product.vat_id,
        currency_id: product.currency_id,
        // Material dimensions
        length_mm: product.length_mm,
        width_mm: product.width_mm,
        thickness_mm: product.thickness_mm,
        // Linear material dimensions
        length: product.length,
        width: product.width,
        thickness: product.thickness,
        // Unit information (for accessories)
        unit_name: product.unit_name,
        unit_shortform: product.unit_shortform
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
  const handleQuantityChange = (itemId: string, newQuantity: number | string, skipRemove: boolean = false) => {
    // Allow empty/invalid values while user is typing (don't remove item)
    if (newQuantity === '' || newQuantity === null || newQuantity === undefined) {
      return
    }
    const numValue = typeof newQuantity === 'string' ? parseFloat(newQuantity) : newQuantity
    if (isNaN(numValue)) {
      return
    }
    // Only remove if explicitly set to 0 or negative, and not skipping removal (for typing)
    if (numValue <= 0 && !skipRemove) {
      handleRemoveFromCart(itemId)
      return
    }
    // If skipping removal (while typing) and value is 0 or negative, don't update quantity
    // This allows typing "0" without updating the quantity, so user can type "0.5"
    if (numValue <= 0 && skipRemove) {
      return
    }
    // Round to 2 decimal places
    const roundedQuantity = Math.round(numValue * 100) / 100
    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: roundedQuantity } : item
      )
    )
  }

  // Multiply quantity by a factor (supports decimals)
  const handleQuantityMultiply = (itemId: string, multiplier: number) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item
        const newQuantity = item.quantity * multiplier
        const roundedQuantity = Math.round(newQuantity * 100) / 100
        return { ...item, quantity: roundedQuantity }
      })
    )
    // Clear the quantity input state for this item to show the new value
    setQuantityInputs(prev => {
      const newState = { ...prev }
      delete newState[itemId]
      return newState
    })
  }

  // Toggle accordion for cart item
  const handleToggleAccordion = (itemId: string) => {
    setExpandedCartItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Update item discount percentage
  const handleItemDiscountPercentageChange = (itemId: string, percentage: number) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              discount_percentage: percentage >= 0 && percentage <= 100 ? percentage : 0,
              discount_amount: 0 // Clear amount when using percentage
            }
          : item
      )
    )
    // Set discount mode to percentage
    setItemDiscountMode(prev => ({ ...prev, [itemId]: 'percentage' }))
  }

  // Update item discount amount
  const handleItemDiscountAmountChange = (itemId: string, amount: number) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              discount_amount: amount >= 0 ? amount : 0,
              discount_percentage: 0 // Clear percentage when using amount
            }
          : item
      )
    )
    // Set discount mode to amount
    setItemDiscountMode(prev => ({ ...prev, [itemId]: 'amount' }))
  }

  // Update item gross price and recalculate net price and VAT
  const handleItemGrossPriceChange = (itemId: string, newGrossPrice: number) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.id === itemId) {
          // Get VAT rate from the item's vat_id (we'll need to fetch it or store it)
          // For now, calculate from existing net and gross
          const vatRate = item.gross_price > 0 
            ? ((item.gross_price - item.net_price) / item.net_price) * 100 
            : 0
          
          // Calculate new net price from gross price
          const newNetPrice = newGrossPrice / (1 + vatRate / 100)
          
          return {
            ...item,
            gross_price: newGrossPrice >= 0 ? newGrossPrice : 0,
            net_price: newNetPrice >= 0 ? newNetPrice : 0
          }
        }
        return item
      })
    )
  }

  // Get VAT rate for an item (calculate from net and gross)
  const getItemVatRate = (item: CartItem): number => {
    if (item.net_price > 0) {
      return ((item.gross_price - item.net_price) / item.net_price) * 100
    }
    return 0
  }

  // Calculate részösszeg for each item, rounded to nearest 5
  // Accounts for per-item discounts
  const getItemSubtotal = (item: CartItem) => {
    // Calculate base subtotal before discount
    const baseSubtotal = item.gross_price * item.quantity
    
    // Apply per-item discount
    let discountAmount = 0
    if (item.discount_percentage && item.discount_percentage > 0) {
      discountAmount = (baseSubtotal * item.discount_percentage) / 100
    } else if (item.discount_amount && item.discount_amount > 0) {
      discountAmount = item.discount_amount * item.quantity // Discount amount is per unit
    }
    
    const subtotalAfterDiscount = baseSubtotal - discountAmount
    return Math.round(subtotalAfterDiscount / 5) * 5
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
    const roundedPrice = roundPrice(firstFeeType.gross_price)
    const newFee: FeeItem = {
      id: Date.now().toString(),
      feetype_id: firstFeeType.id,
      name: firstFeeType.name,
      quantity: 1,
      price: roundedPrice,
      currency_name: firstFeeType.currency_name,
      vat_id: firstFeeType.vat_id,
      currency_id: firstFeeType.currency_id,
      unit_price_net: firstFeeType.net_price,
      unit_price_gross: roundedPrice
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
          ? { ...fee, price: newPrice, unit_price_gross: newPrice } // Allow negative values
          : fee
      )
    )
  }


  // Update fee type selection
  const handleFeeTypeChange = (feeId: string, feeTypeId: string) => {
    const selectedFeeType = feeTypes.find(ft => ft.id === feeTypeId)
    if (selectedFeeType) {
      const roundedPrice = roundPrice(selectedFeeType.gross_price)
      setFees(prev =>
        prev.map(fee =>
          fee.id === feeId
            ? {
                ...fee,
                feetype_id: selectedFeeType.id,
                name: selectedFeeType.name,
                price: roundedPrice,
                currency_name: selectedFeeType.currency_name,
                vat_id: selectedFeeType.vat_id,
                currency_id: selectedFeeType.currency_id,
                unit_price_net: selectedFeeType.net_price,
                unit_price_gross: roundedPrice
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

  // Handle payment button click - opens payment modal (original behavior)
  const handlePaymentClick = () => {
    if (cartItems.length === 0) {
      toast.warning('A kosár üres')
      return
    }
    if (!selectedWorker) {
      toast.warning('Válasszon dolgozót')
      return
    }
    setEditingCustomer(selectedCustomer)
    setPaymentModalOpen(true)
  }

  // Handle payment type selection in payment modal - opens confirmation
  const handlePaymentTypeClick = (paymentType: 'cash' | 'card') => {
    setPendingPaymentType(paymentType)
    setPaymentModalOpen(false)
    setConfirmModalOpen(true)
  }

  // Handle confirm payment - creates POS order
  const handleConfirmPayment = async () => {
    if (!pendingPaymentType || !selectedWorker || cartItems.length === 0) {
      toast.error('Hiányzó adatok a fizetéshez')
      return
    }

    setIsProcessingPayment(true)

    try {
      // Validate all cart items have required fields before proceeding
      let validCartItems = cartItems
      const invalidItems = cartItems.filter(item => {
        if (!item.vat_id || !item.currency_id) return true
        // Check for appropriate ID based on product type
        if (item.product_type === 'accessory' && !item.accessory_id) return true
        if (item.product_type === 'material' && !item.material_id) return true
        if (item.product_type === 'linear_material' && !item.linear_material_id) return true
        return false
      })
      if (invalidItems.length > 0) {
        // Try to fix invalid items (only accessories can be fixed)
        const fixedItems = await validateAndFixCartItems(cartItems)
        const stillInvalid = fixedItems.filter(item => {
          if (!item.vat_id || !item.currency_id) return true
          // Check for appropriate ID based on product type
          if (item.product_type === 'accessory' && !item.accessory_id) return true
          if (item.product_type === 'material' && !item.material_id) return true
          if (item.product_type === 'linear_material' && !item.linear_material_id) return true
          return false
        })
        
        if (stillInvalid.length > 0) {
          toast.error('Néhány termék hiányos adatokkal rendelkezik. Kérjük, távolítsa el őket a kosárból és adja hozzá újra.')
          setIsProcessingPayment(false)
          return
        }
        
        // Update cart with fixed items
        setCartItems(fixedItems)
        
        // If cart is now empty after fixing, stop
        if (fixedItems.length === 0) {
          toast.error('A kosár üres lett az érvénytelen termékek eltávolítása után.')
          setIsProcessingPayment(false)
          return
        }
        
        // Use fixed items for the rest of the function
        validCartItems = fixedItems
      }

      // Calculate discount amount
      const cartTotal = validCartItems.reduce((sum, item) => sum + getItemSubtotal(item), 0)
      const feesTotal = fees.reduce((sum, fee) => sum + getFeeSubtotal(fee), 0)
      const subtotalBeforeDiscount = cartTotal + feesTotal
      const discountAmount = discount ? (subtotalBeforeDiscount * discount.percentage) / 100 : 0

      // Build items payload (use validated cart items)
      const itemsPayload = validCartItems.map(item => ({
        product_type: item.product_type,
        accessory_id: item.accessory_id || null,
        material_id: item.material_id || null,
        linear_material_id: item.linear_material_id || null,
        name: item.name,
        sku: item.sku || null,
        quantity: item.quantity,
        unit_price_net: item.net_price,
        unit_price_gross: item.gross_price,
        vat_id: item.vat_id,
        currency_id: item.currency_id,
        discount_percentage: item.discount_percentage || 0,
        discount_amount: item.discount_amount || 0
      }))

      // Validate fees have required fields
      const invalidFees = fees.filter(fee => !fee.vat_id || !fee.currency_id)
      if (invalidFees.length > 0) {
        toast.error('Néhány díj hiányos adatokkal rendelkezik. Kérjük, távolítsa el őket és adja hozzá újra.')
        setIsProcessingPayment(false)
        return
      }

      // Build fees payload
      const feesPayload = fees.map(fee => ({
        feetype_id: fee.feetype_id || null,
        name: fee.name,
        quantity: fee.quantity,
        unit_price_net: fee.unit_price_net,
        unit_price_gross: fee.unit_price_gross,
        vat_id: fee.vat_id,
        currency_id: fee.currency_id
      }))

      // Build customer payload (use editingCustomer if set, otherwise selectedCustomer)
      const customer = editingCustomer || selectedCustomer
      const customerPayload = customer ? {
        name: customer.name || null,
        email: customer.email || null,
        mobile: customer.mobile || null,
        billing_name: customer.billing_name || null,
        billing_country: customer.billing_country || null,
        billing_city: customer.billing_city || null,
        billing_postal_code: customer.billing_postal_code || null,
        billing_street: customer.billing_street || null,
        billing_house_number: customer.billing_house_number || null,
        billing_tax_number: customer.billing_tax_number || null,
        billing_company_reg_number: customer.billing_company_reg_number || null
      } : {}

      // Build request payload
      const payload = {
        worker_id: selectedWorker.id,
        payment_type: pendingPaymentType,
        customer: customerPayload,
        discount: {
          percentage: discount?.percentage || 0,
          amount: discountAmount
        },
        items: itemsPayload,
        fees: feesPayload
      }

      // Call API
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Hiba történt a rendelés létrehozásakor')
      }

      // Success - clear everything
      toast.success(`Rendelés sikeresen létrehozva: ${data.pos_order?.pos_order_number || ''}`)
      
      // Clear cart, fees, discount, worker
      setCartItems([])
      setFees([])
      setDiscount(null)
      setSelectedWorker(null)
      setSelectedCustomer(null)
      setEditingCustomer(null)
      
      // Clear session storage
      sessionStorage.removeItem('pos_cart_items')
      sessionStorage.removeItem('pos_fees')
      sessionStorage.removeItem('pos_discount')
      sessionStorage.removeItem('pos_selected_worker_id')
      
      // Close modals
      setConfirmModalOpen(false)
      setPaymentModalOpen(false)
      setPendingPaymentType(null)
    } catch (error: any) {
      console.error('Error creating POS order:', error)
      toast.error(error.message || 'Hiba történt a rendelés létrehozásakor')
    } finally {
      setIsProcessingPayment(false)
    }
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
            onChange={(e) => {
              // Immediately check if we're in a critical field before processing
              const activeElement = document.activeElement
              const isCriticalField = 
                activeElement?.id === 'fee-price-input' ||
                activeElement?.id === 'discount-percentage-input' ||
                activeElement?.id === 'item-gross-price-input' ||
                activeElement?.id === 'item-discount-input' ||
                activeElement?.closest('[id="fee-price-input"]') ||
                activeElement?.closest('[id="discount-percentage-input"]') ||
                activeElement?.closest('[id="item-gross-price-input"]') ||
                activeElement?.closest('[id="item-discount-input"]') ||
                activeElement?.closest('[data-accordion-field="true"]')
              
              // If in critical field, ignore the input completely
              if (isCriticalField || isEditingField) {
                setBarcodeInput('')
                return
              }
              
              handleBarcodeInputChange(e.target.value)
            }}
            onKeyDown={(e) => {
              // Check if we're in a critical field
              const activeElement = document.activeElement
              const isCriticalField = 
                activeElement?.id === 'fee-price-input' ||
                activeElement?.id === 'discount-percentage-input' ||
                activeElement?.id === 'item-gross-price-input' ||
                activeElement?.id === 'item-discount-input' ||
                activeElement?.closest('[id="fee-price-input"]') ||
                activeElement?.closest('[id="discount-percentage-input"]') ||
                activeElement?.closest('[id="item-gross-price-input"]') ||
                activeElement?.closest('[id="item-discount-input"]') ||
                activeElement?.closest('[data-accordion-field="true"]')
              
              // If in critical field, ignore all key events
              if (isCriticalField || isEditingField) {
                e.preventDefault()
                e.stopPropagation()
                setBarcodeInput('')
                return
              }
              
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
                const normalizedValue = normalizeBarcode(barcodeInput.trim())
                if (normalizedValue.length > 0 && !isScanningRef.current) {
                  handleBarcodeScan(normalizedValue)
                }
              }
            }}
            disabled={isEditingField}
            sx={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
              opacity: 0,
              pointerEvents: isEditingField ? 'none' : 'auto',
              zIndex: -1 // Keep it behind everything but still focusable
            }}
            autoFocus={false}
            tabIndex={isEditingField ? -1 : 0}
            onBlur={(e) => {
              // Don't clear barcode input on blur - keep it ready for scanning
              
              // Refocus if it loses focus, but only if:
              // 1. Not currently scanning
              // 2. Not editing a critical field
              // 3. The new focus target is not any input field (let those fields handle their own blur)
              setTimeout(() => {
                const activeElement = document.activeElement
                const relatedTarget = e.relatedTarget as HTMLElement
                
                // Check if focus is going to a critical input (fee price, discount)
                const isCriticalInput = 
                  activeElement?.id === 'fee-price-input' ||
                  activeElement?.id === 'discount-percentage-input' ||
                  activeElement?.closest('[id="fee-price-input"]') ||
                  activeElement?.closest('[id="discount-percentage-input"]')
                
                // Check if focus is going to any input/button/textarea
                // This includes search field, customer field, and all other inputs
                const isGoingToInput = 
                  activeElement?.tagName === 'INPUT' || 
                  activeElement?.tagName === 'BUTTON' ||
                  activeElement?.tagName === 'TEXTAREA' ||
                  relatedTarget?.tagName === 'INPUT' ||
                  relatedTarget?.tagName === 'BUTTON' ||
                  relatedTarget?.tagName === 'TEXTAREA' ||
                  activeElement?.closest('button') ||
                  activeElement?.closest('input') ||
                  activeElement?.closest('textarea') ||
                  activeElement?.closest('[role="combobox"]') || // Autocomplete fields
                  relatedTarget?.closest('button') ||
                  relatedTarget?.closest('input') ||
                  relatedTarget?.closest('textarea') ||
                  relatedTarget?.closest('[role="combobox"]') // Autocomplete fields
                
                // Refocus barcode input only if:
                // - Not scanning
                // - Not editing a critical field (check both state and active element)
                // - Not going to any input field (let those fields handle their own blur to refocus barcode)
                if (!isScanningRef.current && 
                    !isEditingField &&
                    !isCriticalInput &&
                    !isGoingToInput &&
                    barcodeInputRef.current) {
                  barcodeInputRef.current.focus()
                }
              }, 150) // Slightly longer delay to ensure isEditingField is cleared
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
                onBlur={(e) => {
                  // When search field loses focus, refocus barcode input after a delay
                  // But only if focus is not going to another input field
                  setTimeout(() => {
                    const activeElement = document.activeElement
                    const relatedTarget = e.relatedTarget as HTMLElement
                    
                    // Check if focus is going to another input/button
                    const isGoingToInput = 
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
                    
                    // Only refocus barcode input if not going to another input and not editing critical field
                    if (!isScanningRef.current && 
                        !isEditingField &&
                        !isGoingToInput &&
                        barcodeInputRef.current) {
                      barcodeInputRef.current.focus()
                    }
                  }, 100)
                }}
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
                        <TableCell sx={{ fontWeight: 'bold' }}>Típus / Méretek</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Készlet</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Ár</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {searchResults.map((product) => {
                        const roundedPrice = roundPrice(product.gross_price)
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
                        const getTypeColor = () => {
                          switch (product.product_type) {
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
                          if (product.product_type === 'material') {
                            return `${product.length_mm}×${product.width_mm}×${product.thickness_mm} mm`
                          } else if (product.product_type === 'linear_material') {
                            return `${product.length}×${product.width}×${product.thickness} mm`
                          }
                          return null
                        }
                        return (
                          <TableRow
                            key={`${product.product_type}_${product.id}`}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: (theme) => theme.palette.action.hover
                              }
                            }}
                            onClick={() => handleAddToCart(product)}
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
                                  position: 'relative',
                                  cursor: product.image_url ? 'pointer' : 'default',
                                  '&:hover': product.image_url ? {
                                    opacity: 0.8,
                                    transform: 'scale(1.05)',
                                    transition: 'all 0.2s ease'
                                  } : {}
                                }}
                                onClick={(e) => {
                                  if (product.image_url) {
                                    e.stopPropagation() // Prevent row click
                                    setSelectedImageUrl(product.image_url)
                                    setSelectedImageName(product.name)
                                    setImageModalOpen(true)
                                  }
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
                                {product.image_url && (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
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
                                {product.name}
                              </Typography>
                              {product.product_type === 'accessory' && product.sku && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  SKU: {product.sku}
                                </Typography>
                              )}
                              {product.product_type === 'material' && 
                               product.length_mm != null && 
                               product.width_mm != null && 
                               product.thickness_mm != null && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {product.length_mm}×{product.width_mm}×{product.thickness_mm} mm
                                </Typography>
                              )}
                              {product.product_type === 'linear_material' && 
                               product.length != null && 
                               product.width != null && 
                               product.thickness != null && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {product.length}×{product.width}×{product.thickness} mm
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={getTypeLabel()}
                                size="small"
                                color={getTypeColor() as any}
                              />
                            </TableCell>
                              <TableCell align="right">
                                <Typography 
                                  variant="body2"
                                  sx={{
                                    color: product.quantity_on_hand < 0 ? 'error.main' : 'text.primary',
                                    fontWeight: product.quantity_on_hand < 0 ? 'bold' : 'normal'
                                  }}
                                >
                                  {product.quantity_on_hand} {
                                    product.product_type === 'material' ? 'm²' :
                                    product.product_type === 'linear_material' ? 'm' :
                                    'db'
                                  }
                                </Typography>
                              </TableCell>
                            <TableCell align="right">
                              <Typography variant="subtitle2" color="primary" fontWeight="bold">
                                {(() => {
                                  let displayPrice = roundedPrice
                                  if (product.product_type === 'material' && product.unit_price_per_sqm) {
                                    displayPrice = Math.round(product.unit_price_per_sqm)
                                  } else if (product.product_type === 'linear_material' && product.unit_price_per_m) {
                                    displayPrice = Math.round(product.unit_price_per_m)
                                  }
                                  return displayPrice.toLocaleString('hu-HU')
                                })()} {product.currency_name}
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
                onBlur={() => {
                  // When customer field loses focus, refocus barcode input after a delay
                  setTimeout(() => {
                    const activeElement = document.activeElement
                    
                    // Check if focus is going to another input/button
                    const isGoingToInput = 
                      activeElement?.tagName === 'INPUT' || 
                      activeElement?.tagName === 'BUTTON' ||
                      activeElement?.tagName === 'TEXTAREA' ||
                      activeElement?.closest('button') ||
                      activeElement?.closest('input') ||
                      activeElement?.closest('textarea')
                    
                    // Only refocus barcode input if not going to another input and not editing critical field
                    if (!isScanningRef.current && 
                        !isEditingField &&
                        !isGoingToInput &&
                        barcodeInputRef.current) {
                      barcodeInputRef.current.focus()
                    }
                  }, 100)
                }}
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
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Egység</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Bruttó Részösszeg</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center" width={60}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Cart Items */}
                      {cartItems.map((item) => (
                        <React.Fragment key={item.id}>
                        <TableRow
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
                          {/* Column 1: Name, Type, and Details */}
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            {item.product_type === 'accessory' && item.sku && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                SKU: {item.sku}
                              </Typography>
                            )}
                            {item.product_type === 'material' && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {item.length_mm}×{item.width_mm}×{item.thickness_mm} mm
                              </Typography>
                            )}
                            {item.product_type === 'linear_material' && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {item.length}×{item.width}×{item.thickness} mm
                              </Typography>
                            )}
                          </TableCell>

                          {/* Column 2: Mennyiség */}
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1.00)}
                                disabled={item.quantity <= 0.01}
                                sx={{ 
                                  width: 32, 
                                  height: 32,
                                  '&:disabled': {
                                    opacity: 0.3
                                  }
                                }}
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                              <TextField
                                type="number"
                                size="small"
                                value={quantityInputs[item.id] !== undefined ? quantityInputs[item.id] : item.quantity.toString()}
                                onChange={(e) => {
                                  const inputValue = e.target.value
                                  // Update local input state to allow empty values and "0"
                                  setQuantityInputs(prev => ({ ...prev, [item.id]: inputValue }))
                                  // Pass the raw input value to handleQuantityChange with skipRemove=true
                                  // This allows typing "0" without removing the item
                                  handleQuantityChange(item.id, inputValue, true)
                                }}
                                onBlur={(e) => {
                                  // On blur, validate and apply the final value
                                  const inputValue = e.target.value
                                  const numValue = parseFloat(inputValue)
                                  
                                  if (inputValue === '' || isNaN(numValue)) {
                                    // If empty or invalid, restore to current quantity
                                    const currentItem = cartItems.find(i => i.id === item.id)
                                    if (currentItem && currentItem.quantity > 0) {
                                      // Keep current value
                                      setQuantityInputs(prev => {
                                        const newState = { ...prev }
                                        delete newState[item.id]
                                        return newState
                                      })
                                    } else {
                                      // Set to minimum
                                      handleQuantityChange(item.id, 0.01, false)
                                      setQuantityInputs(prev => {
                                        const newState = { ...prev }
                                        delete newState[item.id]
                                        return newState
                                      })
                                    }
                                  } else if (numValue <= 0) {
                                    // If 0 or negative on blur, remove the item
                                    handleRemoveFromCart(item.id)
                                    setQuantityInputs(prev => {
                                      const newState = { ...prev }
                                      delete newState[item.id]
                                      return newState
                                    })
                                  } else {
                                    // Valid value, update and clear local state
                                    handleQuantityChange(item.id, numValue, false)
                                    setQuantityInputs(prev => {
                                      const newState = { ...prev }
                                      delete newState[item.id]
                                      return newState
                                    })
                                  }
                                }}
                                inputProps={{
                                  min: 0.01,
                                  step: 0.01,
                                  style: { textAlign: 'center', width: '50px', padding: '4px' }
                                }}
                                sx={{
                                  width: '70px',
                                  '& .MuiOutlinedInput-root': {
                                    '& input': {
                                      padding: '6px 8px'
                                    }
                                  },
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
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1.00)}
                                sx={{ width: 32, height: 32 }}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            {/* Multiplier Buttons - Always visible below quantity controls */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleQuantityMultiply(item.id, 10)}
                                sx={{
                                  minWidth: 'auto',
                                  px: 1,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  borderColor: '#60a5fa',
                                  color: '#1e40af',
                                  backgroundColor: '#dbeafe',
                                  '&:hover': {
                                    borderColor: '#3b82f6',
                                    backgroundColor: '#bfdbfe'
                                  }
                                }}
                              >
                                ×10
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleQuantityMultiply(item.id, 100)}
                                sx={{
                                  minWidth: 'auto',
                                  px: 1,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  borderColor: '#60a5fa',
                                  color: '#1e40af',
                                  backgroundColor: '#dbeafe',
                                  '&:hover': {
                                    borderColor: '#3b82f6',
                                    backgroundColor: '#bfdbfe'
                                  }
                                }}
                              >
                                ×100
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleQuantityMultiply(item.id, 1000)}
                                sx={{
                                  minWidth: 'auto',
                                  px: 1,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  borderColor: '#60a5fa',
                                  color: '#1e40af',
                                  backgroundColor: '#dbeafe',
                                  '&:hover': {
                                    borderColor: '#3b82f6',
                                    backgroundColor: '#bfdbfe'
                                  }
                                }}
                              >
                                ×1000
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleQuantityChange(item.id, 1)}
                                sx={{
                                  minWidth: 'auto',
                                  px: 1,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  borderColor: '#f87171',
                                  color: '#991b1b',
                                  backgroundColor: '#fee2e2',
                                  '&:hover': {
                                    borderColor: '#ef4444',
                                    backgroundColor: '#fecaca'
                                  }
                                }}
                              >
                                1
                              </Button>
                            </Box>
                          </TableCell>

                          {/* Column 3: Egység */}
                          <TableCell align="center">
                            {item.product_type === 'material' ? 'm²' :
                             item.product_type === 'linear_material' ? 'm' :
                             item.unit_shortform || item.unit_name || '-'}
                          </TableCell>

                          {/* Column 4: Bruttó Részösszeg */}
                          <TableCell align="right">
                            {((item.discount_percentage && item.discount_percentage > 0) || 
                              (item.discount_amount && item.discount_amount > 0)) ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                {/* Original price (crossed out) */}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    textDecoration: 'line-through',
                                    color: 'text.secondary',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {(() => {
                                    const originalSubtotal = item.gross_price * item.quantity
                                    return `${Math.round(originalSubtotal / 5) * 5} ${item.currency_name}`
                                  })()}
                                </Typography>
                                {/* Discounted price */}
                                <Typography variant="subtitle2" fontWeight="bold" color="primary">
                                  {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="subtitle2" fontWeight="bold" color="primary">
                                {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                              </Typography>
                            )}
                          </TableCell>

                          {/* Column 5: Expand/Collapse and Delete */}
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleAccordion(item.id)
                                }}
                                sx={{ 
                                  color: expandedCartItems.has(item.id) ? 'primary.main' : 'text.secondary',
                                  transition: 'transform 0.2s',
                                  transform: expandedCartItems.has(item.id) ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}
                              >
                                {expandedCartItems.has(item.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => handleRemoveFromCart(item.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                        {/* Accordion row for discount fields */}
                        {expandedCartItems.has(item.id) && (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ py: 2, bgcolor: 'action.hover' }}>
                              <Box sx={{ px: 2 }}>
                                <Grid container spacing={2}>
                                  {/* First Row: Nettó egységár, Bruttó egységár */}
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      label="Nettó egységár"
                                      value={item.net_price.toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      disabled
                                      fullWidth
                                      size="small"
                                      InputProps={{
                                        endAdornment: <InputAdornment position="end">{item.currency_name}</InputAdornment>
                                      }}
                                    />
                                  </Grid>
                                  
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      id={`item-gross-price-input-${item.id}`}
                                      data-accordion-field="true"
                                      label="Bruttó egységár"
                                      type="number"
                                      value={item.gross_price}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value)
                                        if (!isNaN(value)) {
                                          handleItemGrossPriceChange(item.id, value)
                                        }
                                      }}
                                      onFocus={() => setIsEditingField(true)}
                                      onBlur={() => {
                                        setTimeout(() => {
                                          setIsEditingField(false)
                                          refocusBarcodeInput()
                                        }, 100)
                                      }}
                                      fullWidth
                                      size="small"
                                      InputProps={{
                                        endAdornment: <InputAdornment position="end">{item.currency_name}</InputAdornment>,
                                        inputProps: { min: 0, step: 1 }
                                      }}
                                    />
                                  </Grid>
                                  
                                  {/* Second Row: Kedvezmény input first, then switcher */}
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      id={`item-discount-input-${item.id}`}
                                      data-accordion-field="true"
                                      label="Kedvezmény"
                                      type="number"
                                      value={
                                        itemDiscountMode[item.id] === 'amount'
                                          ? (item.discount_amount && item.discount_amount > 0 ? item.discount_amount : '')
                                          : (item.discount_percentage && item.discount_percentage > 0 ? item.discount_percentage : '')
                                      }
                                      onChange={(e) => {
                                        const inputValue = e.target.value
                                        // Allow empty string
                                        if (inputValue === '') {
                                          if (itemDiscountMode[item.id] === 'amount') {
                                            handleItemDiscountAmountChange(item.id, 0)
                                          } else {
                                            handleItemDiscountPercentageChange(item.id, 0)
                                          }
                                          return
                                        }
                                        const value = parseFloat(inputValue)
                                        if (!isNaN(value)) {
                                          if (itemDiscountMode[item.id] === 'amount') {
                                            handleItemDiscountAmountChange(item.id, value)
                                          } else {
                                            handleItemDiscountPercentageChange(item.id, value)
                                          }
                                        }
                                      }}
                                      onFocus={() => setIsEditingField(true)}
                                      onBlur={() => {
                                        setTimeout(() => {
                                          setIsEditingField(false)
                                          refocusBarcodeInput()
                                        }, 100)
                                      }}
                                      fullWidth
                                      size="small"
                                      InputProps={{
                                        endAdornment: (
                                          <InputAdornment position="end">
                                            {itemDiscountMode[item.id] === 'amount' ? item.currency_name : '%'}
                                          </InputAdornment>
                                        ),
                                        inputProps: { 
                                          min: 0, 
                                          step: itemDiscountMode[item.id] === 'amount' ? 1 : 0.01,
                                          max: itemDiscountMode[item.id] === 'percentage' ? 100 : undefined
                                        }
                                      }}
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pt: 0.5 }}>
                                      <ToggleButtonGroup
                                        value={itemDiscountMode[item.id] || 'percentage'}
                                        exclusive
                                        onChange={(e, newMode) => {
                                          if (newMode !== null) {
                                            setItemDiscountMode(prev => ({ ...prev, [item.id]: newMode }))
                                            // Clear discount when switching modes
                                            if (newMode === 'percentage') {
                                              handleItemDiscountPercentageChange(item.id, 0)
                                            } else {
                                              handleItemDiscountAmountChange(item.id, 0)
                                            }
                                          }
                                        }}
                                        size="small"
                                        fullWidth
                                      >
                                        <ToggleButton value="percentage" sx={{ flex: 1 }}>
                                          %
                                        </ToggleButton>
                                        <ToggleButton value="amount" sx={{ flex: 1 }}>
                                          Összeg
                                        </ToggleButton>
                                      </ToggleButtonGroup>
                                    </Box>
                                  </Grid>
                                </Grid>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
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
                                id="fee-price-input"
                                type="number"
                                size="small"
                                value={fee.price}
                                onChange={(e) => {
                                  const val = e.target.value
                                  // Allow empty string, negative numbers, and valid numbers
                                  const numValue = val === '' ? 0 : parseFloat(val) || 0
                                  handleFeePriceChange(fee.id, numValue)
                                }}
                                onFocus={() => {
                                  // Set editing flag IMMEDIATELY (synchronously)
                                  setIsEditingField(true)
                                  // Clear barcode input and any pending scans when editing fee price
                                  setBarcodeInput('')
                                  if (scanTimeoutRef.current) {
                                    clearTimeout(scanTimeoutRef.current)
                                    scanTimeoutRef.current = null
                                  }
                                  // Also clear any scanning state
                                  isScanningRef.current = false
                                  // Blur the barcode input to prevent it from receiving events
                                  if (barcodeInputRef.current) {
                                    barcodeInputRef.current.blur()
                                  }
                                }}
                                onBlur={(e) => {
                                  // Check if focus is going to another input field
                                  const relatedTarget = e.relatedTarget as HTMLElement
                                  const isGoingToAnotherInput = 
                                    relatedTarget?.tagName === 'INPUT' ||
                                    relatedTarget?.tagName === 'TEXTAREA' ||
                                    relatedTarget?.closest('input') ||
                                    relatedTarget?.closest('textarea') ||
                                    relatedTarget?.closest('[role="combobox"]')
                                  
                                  // Clear editing flag immediately if not going to another input
                                  if (!isGoingToAnotherInput) {
                                    setIsEditingField(false)
                                    // Refocus barcode input after a short delay to ensure the blur is complete
                                    setTimeout(() => {
                                      refocusBarcodeInput()
                                    }, 100)
                                  } else {
                                    // If going to another input, clear the flag but don't refocus yet
                                    // The other input's onBlur will handle refocusing
                                    setTimeout(() => {
                                      setIsEditingField(false)
                                    }, 50)
                                  }
                                }}
                                onKeyDown={(e) => {
                                  // Stop event propagation AND prevent default for non-allowed keys
                                  e.stopPropagation()
                                  // Allow number keys, minus, decimal point, backspace, delete, arrow keys, tab
                                  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '.', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter']
                                  if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                                    e.preventDefault()
                                  }
                                }}
                                inputProps={{
                                  // Remove min: 0 to allow negative values
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
                      // Clear editing flag and refocus barcode input after worker selection
                      setIsEditingField(false)
                      setTimeout(() => {
                        refocusBarcodeInput()
                      }, 200)
                    }}
                    onBlur={() => {
                      // Clear editing flag and refocus barcode input when worker field loses focus
                      setTimeout(() => {
                        setIsEditingField(false)
                        refocusBarcodeInput()
                      }, 200)
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
                        onBlur={(e) => {
                          // Don't handle blur here, let the Autocomplete onBlur handle it
                          // This prevents double handling
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
        <DialogContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '80vh', overflow: 'hidden' }}>
          <Grid container spacing={3} sx={{ flex: 1, minHeight: 0, alignItems: 'stretch', height: '100%' }}>
            {/* Left Side - Order Summary */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              {/* Scrollable Table with Sticky Header */}
              <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Termék</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Mennyiség</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Egység</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Egységár</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Részösszeg</TableCell>
                      </TableRow>
                    </TableHead>
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
                          <TableCell align="center">
                            {item.quantity.toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            {item.product_type === 'material' ? 'm²' :
                             item.product_type === 'linear_material' ? 'm' :
                             item.unit_shortform || item.unit_name || '-'}
                          </TableCell>
                          <TableCell align="right">
                            {item.gross_price.toLocaleString('hu-HU')} {item.currency_name}
                          </TableCell>
                          <TableCell align="right">
                            {((item.discount_percentage && item.discount_percentage > 0) || 
                              (item.discount_amount && item.discount_amount > 0)) ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    textDecoration: 'line-through',
                                    color: 'text.secondary',
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  {(() => {
                                    const originalSubtotal = item.gross_price * item.quantity
                                    return `${Math.round(originalSubtotal / 5) * 5} ${item.currency_name}`
                                  })()}
                                </Typography>
                                <Typography variant="body2" fontWeight="bold" color="primary">
                                  {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2">
                                {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                              </Typography>
                            )}
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
                    sx={{ py: 2.5, fontSize: '1.1rem', fontWeight: 'bold' }}
                    onClick={() => handlePaymentTypeClick('cash')}
                    disabled={isProcessingPayment}
                  >
                    Készpénz
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    startIcon={<CardIcon />}
                    sx={{ py: 2.5, fontSize: '1.1rem', fontWeight: 'bold' }}
                    onClick={() => handlePaymentTypeClick('card')}
                    disabled={isProcessingPayment}
                  >
                    Bankkártya
                  </Button>
                </Box>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog
        open={confirmModalOpen}
        onClose={() => {
          if (!isProcessingPayment) {
            setConfirmModalOpen(false)
            setPendingPaymentType(null)
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Rendelés megerősítése</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 3, fontWeight: 'bold' }}>
              Biztosan folytatod?
            </Typography>

            {/* Order Summary Table */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Termék</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Mennyiség</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Egység</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Egységár</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Részösszeg</TableCell>
                  </TableRow>
                </TableHead>
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
                      <TableCell align="center">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        {item.product_type === 'material' ? 'm²' :
                         item.product_type === 'linear_material' ? 'm' :
                         item.unit_shortform || item.unit_name || '-'}
                      </TableCell>
                      <TableCell align="right">
                        {item.gross_price.toLocaleString('hu-HU')} {item.currency_name}
                      </TableCell>
                      <TableCell align="right">
                        {((item.discount_percentage && item.discount_percentage > 0) || 
                          (item.discount_amount && item.discount_amount > 0)) ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                textDecoration: 'line-through',
                                color: 'text.secondary',
                                fontSize: '0.7rem'
                              }}
                            >
                              {(() => {
                                const originalSubtotal = item.gross_price * item.quantity
                                return `${Math.round(originalSubtotal / 5) * 5} ${item.currency_name}`
                              })()}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold" color="primary">
                              {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2">
                            {getItemSubtotal(item).toLocaleString('hu-HU')} {item.currency_name}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Fees Section */}
            {fees.length > 0 && (
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Díjak</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Összeg</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell>{fee.name}</TableCell>
                        <TableCell align="right">
                          {getFeeSubtotal(fee).toLocaleString('hu-HU')} {fee.currency_name}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Discount Section */}
            {discount && (
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Kedvezmény</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>Százalék</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Összeg</TableCell>
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

            {/* Total */}
            <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="h6" align="right" sx={{ fontWeight: 'bold' }}>
                Összesen: {total.toLocaleString('hu-HU')} HUF
              </Typography>
              <Typography variant="body2" align="right" color="text.secondary">
                Fizetési mód: {pendingPaymentType === 'cash' ? 'Készpénz' : 'Bankkártya'}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setConfirmModalOpen(false)
              setPendingPaymentType(null)
            }}
            disabled={isProcessingPayment}
          >
            Mégse
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmPayment}
            disabled={isProcessingPayment}
          >
            {isProcessingPayment ? 'Feldolgozás...' : 'Megerősítés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Modal */}
      <Dialog
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box component="span">{selectedImageName}</Box>
          <IconButton
            onClick={() => setImageModalOpen(false)}
            size="small"
            sx={{ ml: 2 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2,
            overflow: 'auto',
            flex: 1
          }}
        >
          {selectedImageUrl && (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <img
                src={selectedImageUrl}
                alt={selectedImageName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 8
                }}
                onError={(e) => {
                  console.error('Error loading image:', selectedImageUrl)
                  e.currentTarget.style.display = 'none'
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}

