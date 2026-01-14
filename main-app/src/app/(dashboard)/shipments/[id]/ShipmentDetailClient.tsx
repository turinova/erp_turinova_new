'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
  Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, IconButton, Checkbox, FormControlLabel, FormGroup, Autocomplete, Divider, RadioGroup, Radio, FormControl, FormLabel, Tooltip, Alert, InputAdornment, MenuItem, Select
} from '@mui/material'
import dynamic from 'next/dynamic'

// Dynamic import for Barcode to avoid SSR issues
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, AddCircle as AddCircleIcon, RemoveCircle as RemoveCircleIcon, Check as CheckIcon, Print as PrintIcon, Add as AddIcon, PriceChange as PriceCheckIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'
import { useDebounce } from '@/hooks/useDebounce'

interface ShipmentDetailClientProps {
  id: string
  initialHeader?: ShipmentHeader | null
  initialItems?: ShipmentItem[]
  initialVatRates?: Map<string, number>
}

interface ShipmentItem {
  id: string
  purchase_order_item_id: string
  product_name: string
  sku: string
  barcode: string | null
  accessory_id: string | null
  material_id: string | null
  linear_material_id: string | null
  product_type: string | null
  quantity_received: number
  target_quantity: number
  net_price: number
  net_total: number
  gross_total: number
  vat_id: string
  currency_id: string
  units_id: string
  note?: string
  base_price?: number | null
  multiplier?: number | null
  material_length_mm?: number | null
  material_width_mm?: number | null
  linear_material_length?: number | null
}

interface ShipmentHeader {
  id: string
  purchase_order_id: string
  po_number: string
  po_created_at: string
  partner_id: string
  partner_name: string
  warehouse_id: string
  warehouse_name: string
  shipment_date: string
  status: string
  note?: string
  created_at: string
  stock_movement_numbers?: string[]
  receipt_workers?: Array<{
    id: string
    name: string
    nickname: string | null
    color: string
    received_at: string
  }>
}

export default function ShipmentDetailClient({ 
  id, 
  initialHeader = null, 
  initialItems = [], 
  initialVatRates = new Map() 
}: ShipmentDetailClientProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [printLabelOpen, setPrintLabelOpen] = useState(false)
  const [itemToPrint, setItemToPrint] = useState<ShipmentItem | null>(null)
  const [editableSellingPrice, setEditableSellingPrice] = useState<number | null>(null)
  const [selectedUnitShortform, setSelectedUnitShortform] = useState<string>('')
  const [units, setUnits] = useState<Array<{ id: string; name: string; shortform: string }>>([])
  const [labelFields, setLabelFields] = useState({
    showName: true,
    showSku: true,
    showBarcode: true,
    showPrice: true
  })
  const [printAmount, setPrintAmount] = useState<number>(1)
  const [isPrinting, setIsPrinting] = useState(false)
  const [editableProductName, setEditableProductName] = useState<string>('')
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false)
  const [itemForBarcode, setItemForBarcode] = useState<ShipmentItem | null>(null)
  const [barcodeInputValue, setBarcodeInputValue] = useState('')
  const [savingBarcode, setSavingBarcode] = useState(false)
  const [updateBasePriceModalOpen, setUpdateBasePriceModalOpen] = useState(false)
  const [itemForBasePriceUpdate, setItemForBasePriceUpdate] = useState<ShipmentItem | null>(null)
  const [updatingBasePrice, setUpdatingBasePrice] = useState(false)
  const [currentProductData, setCurrentProductData] = useState<{ base_price: number; multiplier: number; material_length_mm?: number; material_width_mm?: number; linear_material_length?: number } | null>(null)
  const [confirmUpdateBasePriceOpen, setConfirmUpdateBasePriceOpen] = useState(false)
  const [newSellingPrice, setNewSellingPrice] = useState<number | null>(null)
  const [calculatedNewBasePrice, setCalculatedNewBasePrice] = useState<number | null>(null)
  const [calculatedNewMultiplier, setCalculatedNewMultiplier] = useState<number | null>(null)
  const [header, setHeader] = useState<ShipmentHeader | null>(initialHeader)
  const [items, setItems] = useState<ShipmentItem[]>(initialItems)
  const [vatRates, setVatRates] = useState<Map<string, number>>(initialVatRates)
  const [workers, setWorkers] = useState<Array<{ id: string; name: string; nickname: string | null; color: string }>>([])
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([])
  
  // Barcode scanning state
  const [barcodeInput, setBarcodeInput] = useState('')
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef(false)

  // Product search state (for manual adding)
  const [addingProduct, setAddingProduct] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  // Debug: Log items data when it changes
  useEffect(() => {
    if (items.length > 0 && header?.status === 'received') {
      const materialsItems = items.filter(item => item.product_type === 'material' || item.product_type === 'linear_material')
      if (materialsItems.length > 0) {
        console.log('[ShipmentDetail] Materials/Linear Materials items:', materialsItems.map(item => ({
          product_type: item.product_type,
          product_name: item.product_name,
          material_id: item.material_id,
          linear_material_id: item.linear_material_id,
          base_price: item.base_price,
          material_length_mm: item.material_length_mm,
          material_width_mm: item.material_width_mm,
          linear_material_length: item.linear_material_length,
          net_price: item.net_price
        })))
      }
    }
  }, [items, header?.status])

  // Only fetch if we don't have initial data
  useEffect(() => {
    if (!initialHeader || initialItems.length === 0) {
      fetchData()
    }
    if (initialVatRates.size === 0) {
      fetchVatRates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fetch workers on component mount so they're ready when modal opens
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/workers')
        if (response.ok) {
          const workersData = await response.json()
          setWorkers(workersData || [])
        }
      } catch (error) {
        console.error('Error fetching workers:', error)
        // Don't show error toast here - it's not critical for page load
      }
    }
    fetchWorkers()
  }, []) // Only run once on mount

  // Focus barcode input on mount and when status is draft (but not when modal is open)
  useEffect(() => {
    if (header?.status === 'draft' && barcodeInputRef.current && !receiveConfirmOpen && !addingProduct && !deleteConfirmOpen) {
      // Small delay to ensure page is fully rendered
      // Only focus if modal is NOT open AND not adding product to prevent conflicts
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus({ preventScroll: true })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [header?.status, receiveConfirmOpen, addingProduct, deleteConfirmOpen])

  // Blur barcode input when modals open to prevent conflicts on iPad/mobile
  useEffect(() => {
    if ((receiveConfirmOpen || deleteConfirmOpen) && barcodeInputRef.current) {
      // Immediately blur and disable the barcode input when modal opens
      barcodeInputRef.current.blur()
      // Clear any pending scans
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      isScanningRef.current = false
      setBarcodeInput('')
    }
  }, [receiveConfirmOpen, deleteConfirmOpen])

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

  const fetchVatRates = async () => {
    try {
      const res = await fetch('/api/vat')
      const data = await res.json()
      if (res.ok && data.vat) {
        const vatMap = new Map<string, number>()
        data.vat.forEach((v: any) => {
          vatMap.set(v.id, v.kulcs || 0)
        })
        setVatRates(vatMap)
      }
    } catch (e) {
      console.error('Error fetching VAT rates:', e)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shipments/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a szállítmány betöltésekor')
      setHeader(data.header)
      setItems(data.items || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a szállítmány betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!header) return
    setSaving(true)
    try {
      const updates = items.map(it => ({
        id: it.id,
        quantity_received: it.quantity_received,
        net_price: it.net_price,
        note: it.note || null
      }))
      const res = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a mentéskor')
      toast.success('Mentve')
      fetchData()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a mentés során')
    } finally {
      setSaving(false)
    }
  }

  // Play warning sound for errors
  const playWarningSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800 // Hz
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      // Silently fail if audio not supported
      console.log('Audio not supported:', error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    setItemToDelete(itemId)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    setDeleteConfirmOpen(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id: itemToDelete, deleted: true }]
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a tétel törlésekor')
      toast.success('Tétel törölve')
      // Remove item from state instead of reloading
      setItems(prev => prev.filter(item => item.id !== itemToDelete))
    } catch (e) {
      console.error(e)
      toast.error('Hiba a tétel törlésekor')
    } finally {
      setSaving(false)
      setItemToDelete(null)
      // Refocus barcode input after delete dialog closes
      setTimeout(() => {
        refocusBarcodeInput()
      }, 100)
    }
  }

  const handleReceiveShipment = async () => {
    if (!header) return
    
    // Validate that at least one item has quantity_received > 0
    const hasReceivedQty = items.some(it => it.quantity_received > 0)
    if (!hasReceivedQty) {
      toast.error('Legalább egy tételnél meg kell adni a szállított mennyiséget')
      return
    }

    // Workers are already fetched on component mount, just open the modal
    setSelectedWorkerIds([])
    setReceiveConfirmOpen(true)
  }

  const handleConfirmReceiveShipment = async () => {
    if (!header) return
    
    // Validate that at least one worker is selected
    if (selectedWorkerIds.length === 0) {
      toast.error('Legalább egy dolgozót ki kell választani')
      return
    }

    setReceiveConfirmOpen(false)
    setReceiving(true)
    try {
      // First, save all item changes (quantities and prices)
      const updates = items.map(it => ({
        id: it.id,
        quantity_received: it.quantity_received,
        net_price: it.net_price,
        note: it.note || null
      }))
      const saveRes = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      if (!saveRes.ok) {
        const saveData = await saveRes.json()
        throw new Error(saveData?.error || 'Hiba a mentéskor')
      }

      // Then, receive the shipment with worker IDs
      const res = await fetch(`/api/shipments/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_ids: selectedWorkerIds })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a bevételezéskor')
      
      const poStatusText = data.po_status === 'received' ? 'Teljesen beérkezett' : 'Részben beérkezett'
      toast.success(`Szállítmány sikeresen bevételezve. PO státusz: ${poStatusText}`)
      // Reload data to show updated status
      await fetchData()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a szállítmány bevételezésekor')
    } finally {
      setReceiving(false)
    }
  }

  const updateItemQuantity = (index: number, value: number | '') => {
    setItems(prev => {
      const copy = [...prev]
      const item = copy[index]
      const qty = value === '' ? 0 : value
      // Szamlazz.hu requirement: Round net total to integer first
      const netTotal = Math.round(qty * item.net_price)
      const vatPercent = vatRates.get(item.vat_id) || 0
      // Round VAT from rounded net total
      const vatAmount = Math.round(netTotal * (vatPercent / 100))
      // Gross = Net (integer) + VAT (integer) = integer
      const grossTotal = netTotal + vatAmount
      copy[index] = {
        ...item,
        quantity_received: qty,
        net_total: netTotal,
        gross_total: grossTotal
      }
      return copy
    })
  }

  const updateItemNetPrice = (index: number, value: number | '') => {
    setItems(prev => {
      const copy = [...prev]
      const item = copy[index]
      const price = value === '' ? 0 : value
      // Szamlazz.hu requirement: Round net total to integer first
      const netTotal = Math.round(item.quantity_received * price)
      const vatPercent = vatRates.get(item.vat_id) || 0
      // Round VAT from rounded net total
      const vatAmount = Math.round(netTotal * (vatPercent / 100))
      // Gross = Net (integer) + VAT (integer) = integer
      const grossTotal = netTotal + vatAmount
      copy[index] = {
        ...item,
        net_price: price,
        net_total: netTotal,
        gross_total: grossTotal
      }
      return copy
    })
  }

  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Scanners often send US keyboard codes but browser interprets as Hungarian layout
  const normalizeBarcode = (input: string): string => {
    // Map incorrect characters to correct ones
    const charMap: Record<string, string> = {
      'ü': '-',  // Scanner sends - but browser interprets as ü
      'ö': '0',  // Scanner sends 0 but browser interprets as ö
      'Y': 'Z',  // Hungarian keyboard: scanner sends Z but OS shows Y
      // Add more mappings as needed if other characters are affected
    }
    
    return input
      .split('')
      .map(char => charMap[char] || char)
      .join('')
  }

  // Handle barcode input change (debounced for scanner)
  const handleBarcodeInputChange = (value: string) => {
    // Don't process barcode input when modal is open
    if (receiveConfirmOpen) {
      return
    }
    
    // Normalize the input to fix keyboard layout issues
    const normalizedValue = normalizeBarcode(value)
    setBarcodeInput(normalizedValue)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Set new timeout - trigger scan when input stops changing for 100ms
    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = normalizedValue.trim()
      if (trimmedValue.length > 0 && !isScanningRef.current && header?.status === 'draft' && !receiveConfirmOpen) {
        handleBarcodeScan(trimmedValue)
      }
    }, 100)
  }

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    // Don't process scans when modal is open
    if (receiveConfirmOpen || !barcode || !barcode.trim() || header?.status !== 'draft') {
      refocusBarcodeInput()
      return
    }

    // Normalize barcode again (in case it wasn't normalized in input handler)
    const normalizedBarcode = normalizeBarcode(barcode.trim())

    // Prevent multiple scans while one is in progress
    if (isScanningRef.current) {
      refocusBarcodeInput()
      return
    }

    // Clear any pending timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Mark as scanning
    isScanningRef.current = true

    try {
      // Fetch accessory by barcode (using normalized barcode)
      const response = await fetch(`/api/pos/accessories/by-barcode?barcode=${encodeURIComponent(normalizedBarcode)}`)
      
      if (!response.ok) {
        const data = await response.json()
        playWarningSound()
        if (response.status === 404) {
          toast.error('Vonalkód nem található a rendszerben')
        } else {
          toast.error('Hiba a vonalkód keresésekor')
        }
        setBarcodeInput('')
        refocusBarcodeInput()
        return
      }

      const accessoryData = await response.json()
      const sku = accessoryData.sku

      // Find matching items by SKU
      const matchingItems = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.sku === sku)

      if (matchingItems.length === 0) {
        // Item not in shipment - check if we should add it
        if (!header?.partner_id) {
          playWarningSound()
          toast.error('PO partner információ nem található')
          setBarcodeInput('')
          refocusBarcodeInput()
          return
        }

        // Check if accessory's partner matches PO's partner
        if (accessoryData.partners_id !== header.partner_id) {
          playWarningSound()
          toast.error(`Ez a termék másik beszállítóhoz tartozik (${sku})`)
          setBarcodeInput('')
          refocusBarcodeInput()
          return
        }

        // Validate required fields
        if (!accessoryData.units_id || !accessoryData.vat_id || !accessoryData.currency_id) {
          playWarningSound()
          toast.error('A terméknek hiányzik az egység, ÁFA vagy pénznem beállítása')
          setBarcodeInput('')
          refocusBarcodeInput()
          return
        }

        // Add new item to shipment
        try {
          const addRes = await fetch(`/api/shipments/${id}/items`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              updates: [{
                action: 'add',
                accessory_id: accessoryData.accessory_id,
                quantity_received: 1,
                net_price: accessoryData.base_price || 0,
                vat_id: accessoryData.vat_id,
                currency_id: accessoryData.currency_id,
                units_id: accessoryData.units_id,
                note: `Vonalkóddal hozzáadva: ${sku}`
              }]
            })
          })
          const addData = await addRes.json()
          if (!addRes.ok) throw new Error(addData?.error || 'Hiba a tétel hozzáadásakor')
          
          // Calculate totals for the new item
          const newItem = addData.item
          const netPrice = newItem.net_price
          const vatPercent = vatRates.get(newItem.vat_id) || 0
          // Szamlazz.hu requirement: Round net total to integer first
          const lineNet = Math.round(newItem.quantity_received * netPrice)
          // Round VAT from rounded net total
          const lineVat = Math.round(lineNet * (vatPercent / 100))
          // Gross = Net (integer) + VAT (integer) = integer
          const lineGross = lineNet + lineVat
          
          // Add item to state with calculated totals
          const itemWithTotals: ShipmentItem = {
            ...newItem,
            net_total: lineNet,
            gross_total: lineGross
          }
          
          setItems(prev => [...prev, itemWithTotals])
          toast.success(`Termék hozzáadva: ${accessoryData.name} (${sku})`)
          setBarcodeInput('')
          refocusBarcodeInput()
          return
        } catch (error) {
          console.error('Error adding item to shipment:', error)
          playWarningSound()
          toast.error('Hiba a termék hozzáadásakor')
          setBarcodeInput('')
          refocusBarcodeInput()
          return
        }
      }

      // Find first matching item (allow exceeding target_quantity)
      const itemToUpdate = matchingItems[0]

      if (!itemToUpdate) {
        // This shouldn't happen since we already checked matchingItems.length === 0
        playWarningSound()
        toast.error(`A termék (SKU: ${sku}) nem található ebben a szállítmányban`)
        setBarcodeInput('')
        refocusBarcodeInput()
        return
      }

      // Update quantity_received by 1
      const newQuantity = itemToUpdate.item.quantity_received + 1
      updateItemQuantity(itemToUpdate.index, newQuantity)

      // Highlight the quantity field
      setHighlightedItemId(itemToUpdate.item.id)
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedItemId(null)
      }, 1000)

      setBarcodeInput('')
    } catch (error) {
      console.error('Error scanning barcode:', error)
      playWarningSound()
      toast.error('Hiba a vonalkód feldolgozásakor')
      setBarcodeInput('')
    } finally {
      isScanningRef.current = false
      refocusBarcodeInput()
    }
  }

  // Refocus barcode input
  const refocusBarcodeInput = () => {
    if (header?.status === 'draft' && !addingProduct && !deleteConfirmOpen && barcodeInputRef.current) {
      setTimeout(() => {
        barcodeInputRef.current?.focus({ preventScroll: true })
        barcodeInputRef.current?.select()
      }, 10)
    }
  }

  // Debounced search term for products
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300)
  const productSearchAbortControllerRef = useRef<AbortController | null>(null)

  // Search products when search term changes
  useEffect(() => {
    if (productSearchAbortControllerRef.current) {
      productSearchAbortControllerRef.current.abort()
    }

    if (debouncedProductSearchTerm.trim().length >= 2 && header?.partner_id) {
      setIsSearchingProducts(true)
      
      const abortController = new AbortController()
      productSearchAbortControllerRef.current = abortController

      fetch(`/api/shipments/accessories?search=${encodeURIComponent(debouncedProductSearchTerm)}&partner_id=${header.partner_id}`, {
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
  }, [debouncedProductSearchTerm, header?.partner_id])

  // Handle product selection from search
  const handleProductSelect = async (selectedProduct: any) => {
    if (!selectedProduct || !header) return

    // Check if item already exists
    const existingItem = items.find(item => item.sku === selectedProduct.sku)
    if (existingItem) {
      toast.error('Ez a termék már szerepel a listában')
      setAddingProduct(false)
      setProductSearchTerm('')
      setProductSearchResults([])
      return
    }

    // Create a new shipment item using PATCH with action: 'add'
    try {
      const response = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            action: 'add',
            accessory_id: selectedProduct.id,
            quantity_received: 1,
            net_price: selectedProduct.net_price,
            vat_id: selectedProduct.vat_id,
            currency_id: selectedProduct.currency_id,
            units_id: selectedProduct.units_id,
            note: 'Kézzel hozzáadva'
          }]
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a tétel hozzáadásakor')
      }

      const data = await response.json()

      // Calculate totals for the new item
      const vatPercent = vatRates.get(data.item.vat_id) || 0
      // Szamlazz.hu requirement: Round net total to integer first
      const net_total = Math.round(data.item.quantity_received * data.item.net_price)
      // Round VAT from rounded net total
      const vat_amount = Math.round(net_total * (vatPercent / 100))
      // Gross = Net (integer) + VAT (integer) = integer
      const gross_total = net_total + vat_amount

      // Create the new item with calculated totals
      const newItem: ShipmentItem = {
        id: data.item.id,
        purchase_order_item_id: data.item.purchase_order_item_id,
        product_name: data.item.product_name,
        sku: data.item.sku,
        barcode: data.item.barcode || null,
        accessory_id: data.item.accessory_id || null,
        material_id: (data.item as any).material_id || null,
        linear_material_id: (data.item as any).linear_material_id || null,
        product_type: data.item.product_type || null,
        quantity_received: data.item.quantity_received,
        target_quantity: data.item.target_quantity,
        net_price: data.item.net_price,
        net_total: net_total,
        gross_total: gross_total,
        vat_id: data.item.vat_id,
        currency_id: data.item.currency_id,
        units_id: data.item.units_id,
        note: data.item.note
      }

      // Add to items state directly (no page reload!)
      setItems(prevItems => [...prevItems, newItem])

      toast.success('Tétel hozzáadva')

      setAddingProduct(false)
      setProductSearchTerm('')
      setProductSearchResults([])
      
      // Refocus barcode input after adding item
      setTimeout(() => {
        refocusBarcodeInput()
      }, 100)
    } catch (error: any) {
      console.error('Error adding item:', error)
      toast.error(error.message || 'Hiba a tétel hozzáadásakor')
    }
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
    // Refocus barcode input after canceling
    setTimeout(() => {
      refocusBarcodeInput()
    }, 100)
  }

  // Handle print label modal open
  const handleOpenPrintLabel = async (item: ShipmentItem) => {
    setItemToPrint(item)
    setEditableProductName(item.product_name)
    setEditableSellingPrice(null)
    setPrintAmount(item.quantity_received || 1)
    // If no barcode, don't select it by default
    const hasBarcode = !!item.barcode
    setLabelFields({
      showName: true,
      showSku: true,
      showBarcode: hasBarcode,
      showPrice: true
    })
    
    // Fetch units when modal opens
    try {
      const unitsResponse = await fetch('/api/units')
      if (unitsResponse.ok) {
        const unitsData = await unitsResponse.json()
        setUnits(unitsData || [])
        // Set default unit from item's units_id
        if (item.units_id && unitsData) {
          const unit = unitsData.find((u: { id: string }) => u.id === item.units_id)
          if (unit) {
            setSelectedUnitShortform(unit.shortform || 'db')
          } else {
            setSelectedUnitShortform('db')
          }
        } else {
          setSelectedUnitShortform('db')
        }
      }
    } catch (error) {
      console.error('Error fetching units:', error)
      setSelectedUnitShortform('db')
    }
    
    setPrintLabelOpen(true)
  }

  // Generate EAN-13 barcode (13 digits)
  const generateEAN13 = (): string => {
    // EAN-13 format: 12 digits + 1 check digit
    // Generate 12 random digits (first digit should be 0-9, rest can be 0-9)
    let code = ''
    for (let i = 0; i < 12; i++) {
      code += Math.floor(Math.random() * 10).toString()
    }
    
    // Calculate check digit
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i])
      // Odd positions (1-indexed) are multiplied by 1, even by 3
      if ((i + 1) % 2 === 1) {
        sum += digit
      } else {
        sum += digit * 3
      }
    }
    const checkDigit = (10 - (sum % 10)) % 10
    return code + checkDigit.toString()
  }

  const handleOpenBarcodeModal = (item: ShipmentItem) => {
    if (!item.accessory_id || item.product_type !== 'accessory') {
      toast.error('Csak kiegészítőknek lehet vonalkódot hozzáadni')
      return
    }
    setItemForBarcode(item)
    setBarcodeInputValue(item.barcode || '')
    setBarcodeModalOpen(true)
  }

  const handleGenerateBarcode = () => {
    const newBarcode = generateEAN13()
    setBarcodeInputValue(newBarcode)
  }

  const handleSaveBarcode = async () => {
    if (!itemForBarcode || !itemForBarcode.accessory_id) {
      toast.error('Nincs kiválasztott kiegészítő')
      return
    }

    if (!barcodeInputValue.trim()) {
      toast.error('A vonalkód nem lehet üres')
      return
    }

    setSavingBarcode(true)
    try {
      // Normalize barcode before saving (fix keyboard layout issues)
      const normalizedBarcode = normalizeBarcode(barcodeInputValue.trim())
      const response = await fetch(`/api/accessories/${itemForBarcode.accessory_id}/barcode`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: normalizedBarcode
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Hiba a vonalkód mentésekor')
      }

      toast.success('Vonalkód sikeresen mentve')
      setBarcodeModalOpen(false)
      setItemForBarcode(null)
      setBarcodeInputValue('')
      
      // Refresh items
      await refreshItems()
    } catch (error: any) {
      console.error('Error saving barcode:', error)
      toast.error(error.message || 'Hiba a vonalkód mentésekor')
    } finally {
      setSavingBarcode(false)
    }
  }

  const refreshItems = async () => {
    try {
      const response = await fetch(`/api/shipments/${id}`)
      if (!response.ok) {
        throw new Error('Hiba a tételek frissítésekor')
      }
      const data = await response.json()
      if (data.items) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('Error refreshing items:', error)
    }
  }

  const handleOpenUpdateBasePriceModal = async (item: ShipmentItem) => {
    // Only allow for items with FK (not free-typed)
    if (!item.accessory_id && !item.material_id && !item.linear_material_id) {
      toast.error('Csak adatbázisból származó tételeknél frissíthető a base_price')
      return
    }

    if (!item.product_type) {
      toast.error('Terméktípus hiányzik')
      return
    }

    setItemForBasePriceUpdate(item)

    // Fetch current product data (base_price and multiplier)
    try {
      let tableName: string
      let productId: string
      
      if (item.product_type === 'accessory' && item.accessory_id) {
        tableName = 'accessories'
        productId = item.accessory_id
      } else if (item.product_type === 'material' && item.material_id) {
        tableName = 'materials'
        productId = item.material_id
      } else if (item.product_type === 'linear_material' && item.linear_material_id) {
        tableName = 'linear-materials' // API route uses hyphen, not underscore
        productId = item.linear_material_id
      } else {
        toast.error('Termék ID hiányzik')
        return
      }

      const response = await fetch(`/api/${tableName}/${productId}`)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[UpdateBasePrice] API error (${response.status}):`, errorText)
        throw new Error(`Hiba a termék adatok lekérdezésekor: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error(`[UpdateBasePrice] Non-JSON response:`, text.substring(0, 200))
        throw new Error('A szerver nem JSON választ adott vissza')
      }

      const productData = await response.json()
      
      // Store product data with dimensions
      const productDataWithDims = {
        base_price: productData.base_price || 0,
        multiplier: productData.multiplier || 1.38,
        material_length_mm: productData.length_mm || item.material_length_mm || null,
        material_width_mm: productData.width_mm || item.material_width_mm || null,
        linear_material_length: productData.length || item.linear_material_length || null
      }
      setCurrentProductData(productDataWithDims)

      // Calculate effective base_price for initial calculation
      let effectiveBasePrice = productData.base_price || 0
      if (item.product_type === 'material' && productDataWithDims.material_length_mm && productDataWithDims.material_width_mm) {
        effectiveBasePrice = productData.base_price * (productDataWithDims.material_length_mm * productDataWithDims.material_width_mm / 1000000)
      } else if (item.product_type === 'linear_material' && productDataWithDims.linear_material_length) {
        effectiveBasePrice = productData.base_price * (productDataWithDims.linear_material_length / 1000)
      }

      // Set base_price from PO net_price (this stays fixed)
      let initialBasePrice: number
      if (item.product_type === 'material' && productDataWithDims.material_length_mm && productDataWithDims.material_width_mm) {
        const areaM2 = (productDataWithDims.material_length_mm * productDataWithDims.material_width_mm) / 1000000
        initialBasePrice = Math.round(item.net_price / areaM2)
      } else if (item.product_type === 'linear_material' && productDataWithDims.linear_material_length) {
        const lengthM = productDataWithDims.linear_material_length / 1000
        initialBasePrice = Math.round(item.net_price / lengthM)
      } else {
        initialBasePrice = item.net_price
      }
      setCalculatedNewBasePrice(initialBasePrice)
      
      // Calculate initial new selling price from PO net_price and current multiplier
      const vatPercent = vatRates.get(item.vat_id) || 0
      let effectiveNetPrice = item.net_price
      if (item.product_type === 'material' && productDataWithDims.material_length_mm && productDataWithDims.material_width_mm) {
        // Already per board, use as-is
        effectiveNetPrice = item.net_price
      } else if (item.product_type === 'linear_material' && productDataWithDims.linear_material_length) {
        // Already per length, use as-is
        effectiveNetPrice = item.net_price
      }
      const initialNewSellingPrice = Math.ceil(
        (effectiveNetPrice * (productData.multiplier || 1.38) * (1 + vatPercent / 100)) / 10
      ) * 10
      setNewSellingPrice(initialNewSellingPrice)
      
      // Calculate initial multiplier from initial selling price
      const netSellingPrice = initialNewSellingPrice / (1 + vatPercent / 100)
      if (item.product_type === 'material' && productDataWithDims.material_length_mm && productDataWithDims.material_width_mm) {
        const areaM2 = (productDataWithDims.material_length_mm * productDataWithDims.material_width_mm) / 1000000
        const grossPerM2 = initialNewSellingPrice / areaM2
        const netPerM2 = grossPerM2 / (1 + vatPercent / 100)
        const initialMultiplier = netPerM2 / initialBasePrice
        setCalculatedNewMultiplier(parseFloat(initialMultiplier.toFixed(2)))
      } else if (item.product_type === 'linear_material' && productDataWithDims.linear_material_length) {
        const lengthM = productDataWithDims.linear_material_length / 1000
        const grossPerM = initialNewSellingPrice / lengthM
        const netPerM = grossPerM / (1 + vatPercent / 100)
        const initialMultiplier = netPerM / initialBasePrice
        setCalculatedNewMultiplier(parseFloat(initialMultiplier.toFixed(2)))
      } else {
        const initialMultiplier = netSellingPrice / initialBasePrice
        setCalculatedNewMultiplier(parseFloat(initialMultiplier.toFixed(2)))
      }

      setUpdateBasePriceModalOpen(true)
    } catch (error: any) {
      console.error('Error fetching product data:', error)
      toast.error(error.message || 'Hiba a termék adatok lekérdezésekor')
    }
  }

  const handleConfirmUpdateBasePrice = () => {
    setConfirmUpdateBasePriceOpen(true)
  }

  // Calculate new multiplier when newSellingPrice changes (base_price stays fixed)
  useEffect(() => {
    if (newSellingPrice !== null && calculatedNewBasePrice !== null && currentProductData && itemForBasePriceUpdate) {
      const vatPercent = vatRates.get(itemForBasePriceUpdate.vat_id) || 0
      
      // Calculate net selling price from gross
      const netSellingPrice = newSellingPrice / (1 + vatPercent / 100)
      
      // For materials and linear_materials, we need to convert to per-unit prices
      if (itemForBasePriceUpdate.product_type === 'material' && currentProductData.material_length_mm && currentProductData.material_width_mm) {
        // Convert gross selling price to per m²
        const areaM2 = (currentProductData.material_length_mm * currentProductData.material_width_mm) / 1000000
        const grossPerM2 = newSellingPrice / areaM2
        const netPerM2 = grossPerM2 / (1 + vatPercent / 100)
        // base_price is per m², so multiplier = net_per_m2 / base_price_per_m2
        const newMultiplier = netPerM2 / calculatedNewBasePrice
        setCalculatedNewMultiplier(parseFloat(newMultiplier.toFixed(2)))
      } else if (itemForBasePriceUpdate.product_type === 'linear_material' && currentProductData.linear_material_length) {
        // Convert gross selling price to per m
        const lengthM = currentProductData.linear_material_length / 1000
        const grossPerM = newSellingPrice / lengthM
        const netPerM = grossPerM / (1 + vatPercent / 100)
        // base_price is per m, so multiplier = net_per_m / base_price_per_m
        const newMultiplier = netPerM / calculatedNewBasePrice
        setCalculatedNewMultiplier(parseFloat(newMultiplier.toFixed(2)))
      } else {
        // For accessories: multiplier = net_selling_price / base_price
        const newMultiplier = netSellingPrice / calculatedNewBasePrice
        setCalculatedNewMultiplier(parseFloat(newMultiplier.toFixed(2)))
      }
    }
  }, [newSellingPrice, calculatedNewBasePrice, currentProductData, itemForBasePriceUpdate, vatRates])

  const handleUpdateBasePrice = async () => {
    if (!itemForBasePriceUpdate || !currentProductData || calculatedNewBasePrice === null || calculatedNewMultiplier === null) {
      return
    }

    setConfirmUpdateBasePriceOpen(false)
    setUpdatingBasePrice(true)
    try {
      const response = await fetch('/api/products/update-base-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_type: itemForBasePriceUpdate.product_type,
          product_id: itemForBasePriceUpdate.accessory_id || itemForBasePriceUpdate.material_id || itemForBasePriceUpdate.linear_material_id,
          new_base_price: calculatedNewBasePrice, // Fixed purchase net price
          new_multiplier: calculatedNewMultiplier, // Calculated from new selling price
          shipment_id: id // Pass shipment ID for price history tracking
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Hiba a base_price frissítésekor')
      }

      toast.success('Base_price sikeresen frissítve')
      setUpdateBasePriceModalOpen(false)
      setItemForBasePriceUpdate(null)
      setCurrentProductData(null)
      setNewSellingPrice(null)
      setCalculatedNewBasePrice(null)
      setCalculatedNewMultiplier(null)
      
      // Refresh items to get updated base_price
      await refreshItems()
    } catch (error: any) {
      console.error('Error updating base_price:', error)
      toast.error(error.message || 'Hiba a base_price frissítésekor')
    } finally {
      setUpdatingBasePrice(false)
    }
  }

  // Label component for printing - EXACTLY 33mm x 25mm with fixed-height vertical sections
  // Using native divs and CSS Grid to eliminate all spacing
  const PrintLabel = ({ item, fields, price, productName, unitShortform }: { item: ShipmentItem, fields: typeof labelFields, price: number, productName: string, unitShortform: string }) => {
    // Label dimensions: 33mm x 25mm
    // Fixed-height vertical sections using CSS Grid (matching accessories page):
    // - Top padding: 1.5mm (to prevent overflow at top of sticker)
    // - Termék név: 6.3mm
    // - SKU: 3.8mm
    // - Price: 6.5mm
    // - Barcode: 6.9mm (adjusted to keep total at 25mm)
    // Total: 1.5mm + 6.3mm + 3.8mm + 6.5mm + 6.9mm = 25mm (when all fields visible)
    
    const text = productName || item.product_name || 'N/A'
    const nameFontSize = text.length > 25 ? '2.5mm' : '3.5mm'
    
    // Calculate price text length and adjust font size accordingly
    const priceText = `${new Intl.NumberFormat('hu-HU').format(price)} Ft / ${unitShortform || 'db'}`
    const priceTextLength = priceText.length
    // Scale font size based on text length: 6mm for short, down to 4mm for very long
    let priceFontSize = '6mm'
    if (priceTextLength > 20) {
      priceFontSize = '4mm'
    } else if (priceTextLength > 15) {
      priceFontSize = '4.5mm'
    } else if (priceTextLength > 12) {
      priceFontSize = '5mm'
    } else if (priceTextLength > 10) {
      priceFontSize = '5.5mm'
    }
    
    // Build grid template rows based on visible fields
    const gridRows: string[] = []
    if (fields.showName) gridRows.push('6.3mm')
    if (fields.showSku && item.sku) gridRows.push('3.8mm')
    if (fields.showPrice) gridRows.push('6.5mm')
    if (fields.showBarcode && item.barcode) gridRows.push('6.9mm') // Adjusted to keep total at 25mm
    
    return (
      <div
        style={{
          width: '33mm',
          height: '25mm',
          // border: '1px solid #000', // Removed - interferes with barcode scanning
          padding: '1.5mm 0 0 0', // Top padding to prevent overflow at top of sticker
          margin: 0,
          backgroundColor: 'white',
          display: 'grid',
          gridTemplateRows: gridRows.join(' '),
          gridTemplateColumns: '100%',
          gap: 0,
          rowGap: 0,
          columnGap: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Section 1: Termék név - 6.3mm */}
        {fields.showName && (
          <div
            style={{
              width: '100%',
              height: '100%',
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              boxSizing: 'border-box',
              lineHeight: 1.1
            }}
          >
            <div
              style={{
                fontSize: nameFontSize,
                fontWeight: 'bold',
                color: '#000000',
                lineHeight: 1.1,
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
                textAlign: 'center',
                margin: 0,
                padding: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'normal',
                overflow: 'hidden'
              }}
            >
              {text}
            </div>
          </div>
        )}

        {/* Section 2: SKU - 3.8mm */}
        {fields.showSku && item.sku && (
          <div
            style={{
              width: '100%',
              height: '100%',
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                fontSize: '3.0mm',
                color: '#000000',
                lineHeight: 1,
                margin: 0,
                padding: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              }}
            >
              {item.sku}
            </div>
          </div>
        )}

        {/* Section 3: Price - 6.5mm - Flush to bottom (on top of barcode) */}
        {fields.showPrice && (
          <div
            style={{
              width: '100%',
              height: '100%',
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                fontSize: priceFontSize,
                fontWeight: 'bold',
                color: '#000000',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                margin: 0,
                padding: '0 1mm',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                boxSizing: 'border-box'
              }}
            >
              {priceText}
            </div>
          </div>
        )}

        {/* Section 4: Barcode - 6.9mm (adjusted to keep total at 25mm) - Flush to bottom */}
        {fields.showBarcode && item.barcode && (
          <div
            style={{
              width: '100%',
              height: '100%',
              alignSelf: 'stretch',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              boxSizing: 'border-box'
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 0,
                margin: 0,
                overflow: 'hidden'
              }}
            >
              <Barcode
                value={item.barcode}
                format="CODE128"
                width={2.5}
                height={50}
                fontSize={10}
                displayValue={false}
                margin={0}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Handle print label - Using React components (Option A)
  const handlePrintLabel = async () => {
    if (!itemToPrint) return

    // Validate at least one field is selected
    if (!labelFields.showName && !labelFields.showSku && !labelFields.showBarcode && !labelFields.showPrice) {
      toast.error('Válasszon ki legalább egy mezőt a címkéhez!')
      return
    }

    setIsPrinting(true)
    try {
      // Clean up any existing print containers
      const existingContainer = document.getElementById('label-print-container')
      if (existingContainer) {
        const root = (existingContainer as any)._reactRootContainer
        if (root) {
          root.unmount()
        }
        document.body.removeChild(existingContainer)
      }
      const existingStyle = document.getElementById('label-print-styles')
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }

      // Create a hidden print container
      const printContainer = document.createElement('div')
      printContainer.id = 'label-print-container'
      printContainer.style.position = 'absolute'
      printContainer.style.left = '-9999px'
      printContainer.style.top = '-9999px'
      document.body.appendChild(printContainer)

      // Add print styles - AGGRESSIVE VERSION with direct targeting
      const style = document.createElement('style')
      style.id = 'label-print-styles'
      style.textContent = `
        /* Screen styles - hide container */
        #label-print-container {
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          visibility: hidden !important;
        }
        
        @media print {
          @page {
            size: 33mm 25mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Override ALL browser defaults */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          
          /* Force html and body to zero spacing */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 33mm !important;
            height: auto !important;
            background: white !important;
            overflow: visible !important;
          }
          
          /* Hide everything except our container */
          body > *:not(#label-print-container) {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Show our container */
          #label-print-container {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 33mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 9999 !important;
          }
          
          /* Label items - main grid container */
          #label-print-container > div {
            width: 33mm !important;
            height: 25mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            /* Preserve inline padding for vertical alignment */
            padding-top: 1.5mm !important; /* Explicitly preserve top padding */
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            display: grid !important;
            grid-auto-rows: 0 !important;
            grid-auto-flow: row !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
          }
          
          #label-print-container > div:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          
          /* NUCLEAR OPTION: Remove ALL spacing from EVERY element */
          #label-print-container *,
          #label-print-container *::before,
          #label-print-container *::after {
            margin: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            margin-block: 0 !important;
            margin-block-start: 0 !important;
            margin-block-end: 0 !important;
            margin-inline: 0 !important;
            margin-inline-start: 0 !important;
            margin-inline-end: 0 !important;
            padding: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            border-spacing: 0 !important;
            border-collapse: collapse !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Ensure text is visible and black - preserve inline styles */
          #label-print-container div {
            color: #000000 !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Remove pseudo-elements completely */
          #label-print-container *::before,
          #label-print-container *::after {
            content: none !important;
            display: none !important;
            height: 0 !important;
            width: 0 !important;
          }
          
          /* ALL divs - force no spacing but preserve visibility */
          #label-print-container div {
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            box-sizing: border-box !important;
            visibility: visible !important;
            opacity: 1 !important;
            color: #000000 !important;
          }
          
          /* Preserve top padding on main container (override NUCLEAR OPTION for main container only) */
          #label-print-container > div {
            padding-top: 1.5mm !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            overflow: hidden !important;
          }
          
          /* Text containers should show content */
          #label-print-container > div > div > div {
            overflow: visible !important;
          }
          
          /* Main grid container - enforce grid with no gaps, preserve top padding */
          #label-print-container > div {
            display: grid !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            grid-gap: 0 !important;
            grid-auto-rows: 0 !important;
            min-height: 0 !important;
            padding-top: 1.5mm !important; /* Ensure top padding is preserved */
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
          }
          
          /* Grid children (sections) - these are ALSO flex containers */
          #label-print-container > div > div {
            display: flex !important;
            align-self: stretch !important;
            min-height: 0 !important;
            max-height: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            row-gap: 0 !important;
            column-gap: 0 !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
          }
          
          /* Nested flex containers (text wrappers inside sections) */
          #label-print-container > div > div > div {
            display: flex !important;
            gap: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            line-height: 1 !important;
            border: none !important;
            outline: none !important;
          }
          
          /* Barcode section - LAST grid row - force to bottom */
          #label-print-container > div > div:last-child {
            align-self: stretch !important;
            display: flex !important;
            align-items: flex-end !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          
          /* Barcode wrapper div */
          #label-print-container > div > div:last-child > div {
            display: flex !important;
            align-items: flex-end !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          
          /* SVG barcode - force to fill container height with no spacing */
          #label-print-container svg {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            vertical-align: bottom !important;
            align-self: flex-end !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: visible !important;
            object-fit: fill !important;
          }
          
          /* All SVG children */
          #label-print-container svg * {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            vertical-align: bottom !important;
          }
          
          /* Don't override grid-template-rows - let inline styles from PrintLabel work */
          /* Just ensure no auto-sizing */
          #label-print-container > div {
            grid-auto-rows: 0 !important;
            /* grid-template-rows is set inline by PrintLabel component - don't override */
          }
          
          /* Ensure grid rows don't grow or shrink - exact heights */
          #label-print-container > div > div {
            min-height: 0 !important;
            max-height: 100% !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            flex-basis: auto !important;
          }
          
          /* Text content - ensure visibility and proper spacing */
          /* DO NOT override font-size - let inline styles from component work */
          #label-print-container > div > div > div {
            line-height: 1 !important;
            letter-spacing: 0 !important;
            word-spacing: 0 !important;
            color: #000000 !important;
            visibility: visible !important;
            opacity: 1 !important;
            display: flex !important;
            /* font-size comes from inline styles - don't override */
          }
          
          /* Ensure all text content is visible */
          #label-print-container > div > div > div,
          #label-print-container > div > div > div * {
            color: #000000 !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Force text rendering and ensure content is visible */
          #label-print-container {
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }
          
          /* Make sure flex containers show their content */
          /* Note: Do NOT override white-space here - let inline styles from PrintLabel component work */
          /* Price section uses whiteSpace: 'nowrap' with dynamic font scaling, which should not be overridden */
          #label-print-container > div > div {
            min-width: 0 !important;
            min-height: 0 !important;
          }
        }
      `
      document.head.appendChild(style)

      // Debug: Log what we're about to render
      const finalPrice = editableSellingPrice !== null ? editableSellingPrice : (currentSellingPrice || 0)
      const finalUnit = selectedUnitShortform || 'db'
      
      console.log('Rendering print labels:', {
        printAmount,
        showName: labelFields.showName,
        showSku: labelFields.showSku,
        showPrice: labelFields.showPrice,
        showBarcode: labelFields.showBarcode,
        productName: itemToPrint?.product_name,
        sku: itemToPrint?.sku,
        price: finalPrice,
        unit: finalUnit,
        barcode: itemToPrint?.barcode
      })

      // Render labels using React components - matches modal preview exactly
      const root = createRoot(printContainer)
      root.render(
        <>
          {Array.from({ length: printAmount }).map((_, i) => (
            <PrintLabel
              key={i}
              item={itemToPrint}
              fields={labelFields}
              price={editableSellingPrice !== null ? editableSellingPrice : (currentSellingPrice || 0)}
              productName={editableProductName}
              unitShortform={selectedUnitShortform || 'db'}
            />
          ))}
        </>
      )
      
      // Store root for cleanup
      ;(printContainer as any)._reactRootContainer = root

      // Wait for React to render, then print
      setTimeout(() => {
        // Verify container has content
        const container = document.getElementById('label-print-container')
        if (!container || container.children.length === 0) {
          console.error('Print container is empty!')
          toast.error('Nyomtatási hiba: üres konténer!')
          setIsPrinting(false)
          return
        }
        
        // Debug: Check what's actually in the DOM
        const firstLabel = container.children[0] as HTMLElement
        const allText = firstLabel?.textContent || ''
        const typographyElements = firstLabel?.querySelectorAll('p, [class*="Typography"], span') || []
        
        const finalPrice = editableSellingPrice !== null ? editableSellingPrice : (currentSellingPrice || 0)
        console.log('Print labels rendered:', {
          labelCount: container.children.length,
          showName: labelFields.showName,
          showPrice: labelFields.showPrice,
          productName: itemToPrint?.product_name,
          price: finalPrice,
          unit: selectedUnitShortform || 'db',
          firstLabelText: allText,
          typographyCount: typographyElements.length,
          firstLabelHTML: firstLabel?.innerHTML.substring(0, 500)
        })
        
        // Trigger print dialog
        window.print()

        // Clean up after a delay (give time for print dialog to open)
        setTimeout(() => {
          const container = document.getElementById('label-print-container')
          if (container) {
            // Unmount React root
            const root = (container as any)._reactRootContainer
            if (root) {
              root.unmount()
              delete (container as any)._reactRootContainer
            }
            // Remove container
            if (container.parentNode) {
              container.parentNode.removeChild(container)
            }
          }
          const styleEl = document.getElementById('label-print-styles')
          if (styleEl && styleEl.parentNode) {
            styleEl.parentNode.removeChild(styleEl)
          }
          setIsPrinting(false)
          setPrintLabelOpen(false)
          toast.success(`${printAmount} címke nyomtatása elindítva`)
        }, 2000)
      }, 300)
    } catch (error: any) {
      console.error('Error printing label:', error)
      toast.error(error.message || 'Hiba a nyomtatás során')
      setIsPrinting(false)
      
      // Clean up on error
      const printContainer = document.getElementById('label-print-container')
      if (printContainer) {
        // Unmount React root
        const root = (printContainer as any)._reactRootContainer
        if (root) {
          root.unmount()
          delete (printContainer as any)._reactRootContainer
        }
        if (printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer)
        }
      }
      const styleEl = document.getElementById('label-print-styles')
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl)
      }
    }
  }

  // Calculate current selling price: base_price * multiplier * (1 + vat_percent/100) rounded UP to nearest 10
  const currentSellingPrice = useMemo(() => {
    if (!itemToPrint || !itemToPrint.base_price || !itemToPrint.multiplier) {
      return null
    }
    
    const basePrice = itemToPrint.base_price || 0
    const multiplier = parseFloat(String(itemToPrint.multiplier)) || 1
    const vatPercent = vatRates.get(itemToPrint.vat_id) || 0
    
    // Calculate: base_price * multiplier * (1 + vat_percent/100)
    const priceWithVat = basePrice * multiplier * (1 + vatPercent / 100)
    
    // Always round UP to nearest 10 (keep this behavior as requested)
    return Math.ceil(priceWithVat / 10) * 10
  }, [itemToPrint, vatRates])

  const totals = items.reduce((acc, it) => {
    acc.net += it.net_total
    acc.gross += it.gross_total
    return acc
  }, { net: 0, gross: 0 })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!header) {
    return <Box sx={{ p: 3 }}>Szállítmány nem található</Box>
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Hidden barcode input for scanner */}
      {header?.status === 'draft' && !receiveConfirmOpen && !deleteConfirmOpen && (
        <TextField
          inputRef={barcodeInputRef}
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
              // Normalize barcode before scanning (fix keyboard layout issues)
              const normalizedValue = normalizeBarcode(barcodeInput.trim())
              if (normalizedValue.length > 0 && !isScanningRef.current) {
                handleBarcodeScan(normalizedValue)
              }
            }
          }}
          sx={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1
          }}
          autoFocus
          tabIndex={0}
          onBlur={(e) => {
            // Don't refocus if adding product, deleting, or clicking on interactive elements
            if (addingProduct || deleteConfirmOpen) return
            
            const target = e.relatedTarget as HTMLElement
            if (!target) {
              // No related target (clicked outside) - refocus after a delay
              setTimeout(() => {
                if (header?.status === 'draft' && !receiveConfirmOpen && !addingProduct && !deleteConfirmOpen && barcodeInputRef.current) {
                  barcodeInputRef.current.focus({ preventScroll: true })
                }
              }, 100)
              return
            }
            
            // If clicking on input/textarea/select/button, don't refocus
            if (target.closest('input, textarea, select, button')) {
              return
            }
            
            // Otherwise, refocus
            refocusBarcodeInput()
          }}
        />
      )}

      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} underline="hover" color="inherit" href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link component={NextLink} underline="hover" color="inherit" href="/shipments">
          Szállítmányok
        </Link>
        <Typography color="text.primary">Szállítmány</Typography>
      </Breadcrumbs>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Alap adatok</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Beszállító"
                value={header.partner_name}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Raktár"
                value={header.warehouse_name}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="PO létrehozva"
                value={header.po_created_at ? new Date(header.po_created_at).toLocaleDateString('hu-HU') : ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Kiszállítva dátuma"
                value={header.created_at ? new Date(header.created_at).toLocaleDateString('hu-HU') : ''}
                disabled
              />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">PO szám:</Typography>
                <Link component={NextLink} href={`/purchase-order/${header.purchase_order_id}`} underline="hover" sx={{ fontWeight: 500 }}>
                  {header.po_number}
                </Link>
              </Box>
            </Grid>
            {header.stock_movement_numbers && header.stock_movement_numbers.length > 0 && (
              <Grid item xs={12} md={9}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">Készletmozgás számok:</Typography>
                  {header.stock_movement_numbers.map((smNumber, idx) => (
                    <Chip
                      key={idx}
                      label={smNumber}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ))}
                </Box>
              </Grid>
            )}
            {header.receipt_workers && header.receipt_workers.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">Bevételezte:</Typography>
                  {header.receipt_workers.map((worker) => (
                    <Chip
                      key={worker.id}
                      label={worker.nickname || worker.name}
                      size="small"
                      sx={{
                        backgroundColor: worker.color || '#1976d2',
                        color: 'white',
                        fontWeight: 500
                      }}
                    />
                  ))}
                  {header.receipt_workers[0]?.received_at && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      - {new Date(header.receipt_workers[0].received_at).toLocaleString('hu-HU', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Tételek</Typography>
          <Stack spacing={2}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Termék neve</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">Szállított mennyiség</TableCell>
                    <TableCell align="right">Cél mennyiség</TableCell>
                    <TableCell align="right">Nettó egységár</TableCell>
                    {header.status === 'received' && (
                      <TableCell align="right">Ár változás</TableCell>
                    )}
                    <TableCell align="right">Nettó összesen</TableCell>
                    <TableCell align="right">Bruttó összesen</TableCell>
                    <TableCell align="center">Vonalkód</TableCell>
                    <TableCell>Művelet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={header.status === 'received' ? 10 : 9} align="center">
                        Nincs tétel
                      </TableCell>
                    </TableRow>
                  ) : items.map((item, idx) => {
                    // Determine row background color based on quantity comparison
                    const getRowBackgroundColor = () => {
                      if (item.quantity_received < item.target_quantity) {
                        return 'rgba(244, 67, 54, 0.05)' // Very light red
                      } else if (item.quantity_received === item.target_quantity) {
                        return 'rgba(76, 175, 80, 0.05)' // Very light green
                      } else {
                        return 'rgba(255, 152, 0, 0.05)' // Very light orange
                      }
                    }

                    return (
                      <TableRow 
                        key={item.id}
                        sx={{
                          backgroundColor: getRowBackgroundColor(),
                          '&:hover': {
                            backgroundColor: (theme) => {
                              const baseColor = getRowBackgroundColor()
                              // Slightly darken on hover while maintaining the base color
                              if (item.quantity_received < item.target_quantity) {
                                return 'rgba(244, 67, 54, 0.1)'
                              } else if (item.quantity_received === item.target_quantity) {
                                return 'rgba(76, 175, 80, 0.1)'
                              } else {
                                return 'rgba(255, 152, 0, 0.1)'
                              }
                            }
                          }
                        }}
                      >
                        <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          {header.status === 'draft' && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                const newQuantity = Math.max(0, item.quantity_received - 1)
                                updateItemQuantity(idx, newQuantity)
                                // Refocus barcode input after button click
                                if (header?.status === 'draft' && !receiveConfirmOpen) {
                                  setTimeout(() => {
                                    refocusBarcodeInput()
                                  }, 100)
                                }
                              }}
                              disabled={item.quantity_received <= 0}
                              sx={{ 
                                width: 32, 
                                height: 32,
                                '&:disabled': {
                                  opacity: 0.3
                                }
                              }}
                            >
                              <RemoveCircleIcon fontSize="small" />
                            </IconButton>
                          )}
                          <TextField
                            type="number"
                            size="small"
                            value={item.quantity_received === 0 ? '' : item.quantity_received}
                            onChange={(e) => {
                              const val = e.target.value
                              updateItemQuantity(idx, val === '' ? '' : Number(val) || 0)
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') {
                                updateItemQuantity(idx, 0)
                              }
                              // Refocus barcode input after editing (with delay to avoid conflicts)
                              if (header?.status === 'draft' && !receiveConfirmOpen) {
                                setTimeout(() => {
                                  refocusBarcodeInput()
                                }, 150)
                              }
                            }}
                            onFocus={() => {
                              // Clear highlight when user manually edits
                              if (highlightedItemId === item.id) {
                                setHighlightedItemId(null)
                              }
                            }}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ 
                              width: 100,
                              ...(item.quantity_received > item.target_quantity && {
                                '& .MuiOutlinedInput-root': {
                                  borderColor: 'error.main',
                                  '&:hover': {
                                    borderColor: 'error.main',
                                  },
                                  '&.Mui-focused': {
                                    borderColor: 'error.main',
                                  }
                                }
                              }),
                              ...(highlightedItemId === item.id && {
                                '& .MuiOutlinedInput-root': {
                                  borderColor: 'success.main',
                                  borderWidth: 2,
                                  borderStyle: 'solid',
                                  animation: 'glow 1s ease-out',
                                  '@keyframes glow': {
                                    '0%': {
                                      boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)',
                                    },
                                    '50%': {
                                      boxShadow: '0 0 10px 5px rgba(76, 175, 80, 0.5)',
                                    },
                                    '100%': {
                                      boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)',
                                    }
                                  }
                                }
                              })
                            }}
                            placeholder="0"
                            disabled={header.status === 'received' || header.status === 'cancelled'}
                            error={item.quantity_received > item.target_quantity}
                            helperText={item.quantity_received > item.target_quantity ? 'Több mint a cél mennyiség' : ''}
                          />
                          {header.status === 'draft' && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                const newQuantity = item.quantity_received + 1
                                updateItemQuantity(idx, newQuantity)
                                // Refocus barcode input after button click
                                if (header?.status === 'draft' && !receiveConfirmOpen) {
                                  setTimeout(() => {
                                    refocusBarcodeInput()
                                  }, 100)
                                }
                              }}
                              sx={{ 
                                width: 32, 
                                height: 32
                              }}
                            >
                              <AddCircleIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{item.target_quantity}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={item.net_price === 0 ? '' : item.net_price}
                          onChange={(e) => {
                            const val = e.target.value
                            updateItemNetPrice(idx, val === '' ? '' : Number(val) || 0)
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') {
                              updateItemNetPrice(idx, 0)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          sx={{ width: 120 }}
                          placeholder="0"
                          disabled={header.status === 'received' || header.status === 'cancelled'}
                        />
                      </TableCell>
                      {header.status === 'received' && (
                        <TableCell align="right">
                          {(() => {
                            // Check if we have base_price
                            if (!item.base_price || item.base_price <= 0) {
                              return '-'
                            }
                            
                            // Calculate effective base_price based on product type
                            let effectiveBasePrice = item.base_price
                            
                            if (item.product_type === 'material') {
                              if (item.material_length_mm && item.material_width_mm) {
                                // Materials: base_price is per m², net_price is for whole board
                                effectiveBasePrice = item.base_price * (item.material_length_mm * item.material_width_mm / 1000000)
                              } else {
                                // Missing dimensions, can't calculate
                                return '-'
                              }
                            } else if (item.product_type === 'linear_material') {
                              if (item.linear_material_length) {
                                // Linear materials: base_price is per m, net_price is for whole length
                                effectiveBasePrice = item.base_price * (item.linear_material_length / 1000)
                              } else {
                                // Missing length, can't calculate
                                return '-'
                              }
                            }
                            // For accessories, base_price is already the effective price
                            
                            if (effectiveBasePrice <= 0) {
                              return '-'
                            }
                            
                            const percentage = ((item.net_price - effectiveBasePrice) / effectiveBasePrice) * 100
                            const formattedPercentage = percentage > 0 
                              ? `+${percentage.toFixed(1)}%` 
                              : percentage < 0 
                                ? `${percentage.toFixed(1)}%` 
                                : '0%'
                            return (
                              <Typography
                                variant="body2"
                                sx={{
                                  color: percentage > 0 ? 'error.main' : percentage < 0 ? 'success.main' : 'text.secondary',
                                  fontWeight: 'bold'
                                }}
                              >
                                {formattedPercentage}
                              </Typography>
                            )
                          })()}
                        </TableCell>
                      )}
                      <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(item.net_total)} Ft</TableCell>
                      <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(item.gross_total)} Ft</TableCell>
                      <TableCell align="center">
                        {item.product_type === 'accessory' && item.accessory_id ? (
                          item.barcode ? (
                            <Tooltip title={item.barcode} arrow>
                              <CheckIcon color="success" />
                            </Tooltip>
                          ) : (
                            <IconButton
                              size="small"
                              onClick={() => handleOpenBarcodeModal(item)}
                              color="primary"
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          )
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {header.status === 'received' && (
                            <>
                              <IconButton 
                                size="small" 
                                onClick={() => handleOpenPrintLabel(item)}
                                color="primary"
                              >
                                <PrintIcon fontSize="small" />
                              </IconButton>
                              {(() => {
                                // Show button if item has FK (accessory_id, material_id, or linear_material_id)
                                const hasFK = !!(item.accessory_id || item.material_id || item.linear_material_id)
                                
                                if (!hasFK) return null
                                
                                return (
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleOpenUpdateBasePriceModal(item)}
                                    color="primary"
                                    title="Nettó beszerzési ár frissítése"
                                  >
                                    <PriceCheckIcon fontSize="small" />
                                  </IconButton>
                                )
                              })()}
                            </>
                          )}
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={header.status === 'received' || header.status === 'cancelled'}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
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
                          getOptionLabel={(option) => `${option.name} (${option.sku})`}
                          filterOptions={(options) => options} // Disable client-side filtering - API already filters
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
                            return (
                              <Box component="li" key={key} {...otherProps}>
                                <Box sx={{ flex: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="body2">{option.name}</Typography>
                                    <Chip label="Kellék" size="small" color="primary" />
                                  </Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    SKU: {option.sku} | Nettó: {new Intl.NumberFormat('hu-HU').format(option.net_price)} Ft
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
                  {items.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="right"><strong>Összesen:</strong></TableCell>
                      <TableCell align="right"><strong>{new Intl.NumberFormat('hu-HU').format(totals.net)} Ft</strong></TableCell>
                      <TableCell align="right"><strong>{new Intl.NumberFormat('hu-HU').format(totals.gross)} Ft</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {header.status === 'draft' && (
              <Button
                variant="outlined"
                onClick={handleAddProduct}
                disabled={addingProduct}
                sx={{ alignSelf: 'flex-start' }}
              >
                Tétel hozzáadása
              </Button>
            )}
          </Stack>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          {header.status === 'draft' && (
            <>
              <Button
                variant="outlined"
                startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving || receiving}
              >
                Mentés
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={receiving ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={handleReceiveShipment}
                disabled={saving || receiving}
              >
                Szállítmány bevételezése
              </Button>
            </>
          )}
          {header.status === 'received' && (
            <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ Szállítmány bevételezve
            </Typography>
          )}
          {header.status === 'cancelled' && (
            <Typography variant="body2" color="error.main">
              Szállítmány törölve
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Receive Shipment Confirmation Dialog */}
      <Dialog
        open={receiveConfirmOpen}
        onClose={() => setReceiveConfirmOpen(false)}
        aria-labelledby="receive-dialog-title"
        aria-describedby="receive-dialog-description"
        maxWidth="sm"
        fullWidth
        disablePortal={false}
        PaperProps={{
          sx: {
            touchAction: 'manipulation'
          }
        }}
      >
        <DialogTitle id="receive-dialog-title">
          Szállítmány bevételezése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="receive-dialog-description" sx={{ mb: 3 }}>
            Biztosan be szeretnéd vételezni ezt a szállítmányt? Ez létrehozza a készletmozgásokat és frissíti a beszerzési rendelés státuszát.
          </DialogContentText>
          
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
            Válassz dolgozó(kat) aki(k) bevételezik:
          </Typography>
          
          {workers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Dolgozók betöltése...
            </Typography>
          ) : (
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {workers.map((worker) => {
                const isSelected = selectedWorkerIds.includes(worker.id)
                return (
                  <Grid item xs={3} key={worker.id}>
                    <Button
                      fullWidth
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (isSelected) {
                          setSelectedWorkerIds(prev => prev.filter(id => id !== worker.id))
                        } else {
                          setSelectedWorkerIds(prev => [...prev, worker.id])
                        }
                      }}
                      sx={{
                        touchAction: 'manipulation',
                        minHeight: '48px',
                        backgroundColor: isSelected ? (worker.color || '#1976d2') : 'transparent',
                        borderColor: worker.color || '#1976d2',
                        color: isSelected ? '#fff' : (worker.color || '#1976d2'),
                        '&:hover': {
                          backgroundColor: isSelected ? (worker.color || '#1976d2') : 'rgba(0, 0, 0, 0.04)',
                          borderColor: worker.color || '#1976d2',
                        },
                        fontSize: '0.875rem',
                        textTransform: 'none',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {worker.nickname || worker.name}
                    </Button>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ touchAction: 'manipulation' }}>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setReceiveConfirmOpen(false)
            }}
            disabled={receiving}
            sx={{ touchAction: 'manipulation' }}
          >
            Mégse
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleConfirmReceiveShipment()
            }}
            variant="contained"
            color="primary"
            disabled={receiving || selectedWorkerIds.length === 0}
            sx={{ touchAction: 'manipulation' }}
            startIcon={receiving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {receiving ? 'Bevételezés...' : 'Bevételezés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Tétel törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretnéd ezt a tételt?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={saving}
          >
            Mégse
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} /> : <DeleteIcon />}
          >
            {saving ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Label Modal */}
      <Dialog
        open={printLabelOpen}
        onClose={() => setPrintLabelOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="print-label-dialog-title"
      >
        <DialogTitle id="print-label-dialog-title">
          Címke nyomtatása
        </DialogTitle>
        <DialogContent>
          {itemToPrint && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Single Card with all sections */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 3,
                    backgroundColor: 'background.paper'
                  }}
                >
                  {/* Row 1: Termék neve + Megjelenítendő mezők (horizontally) */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    {/* Termék neve */}
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Termék neve
                      </Typography>
                      <TextField
                        label="Termék neve (szerkeszthető)"
                        value={editableProductName}
                        onChange={(e) => setEditableProductName(e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>

                    {/* Megjelenítendő mezők */}
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Megjelenítendő mezők
                      </Typography>
                      <FormGroup row sx={{ gap: 2 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={labelFields.showName}
                              onChange={(e) => setLabelFields({ ...labelFields, showName: e.target.checked })}
                              size="small"
                            />
                          }
                          label="Termék neve"
                          sx={{ m: 0 }}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={labelFields.showSku}
                              onChange={(e) => setLabelFields({ ...labelFields, showSku: e.target.checked })}
                              size="small"
                            />
                          }
                          label="SKU"
                          sx={{ m: 0 }}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={labelFields.showBarcode}
                              onChange={(e) => setLabelFields({ ...labelFields, showBarcode: e.target.checked })}
                              disabled={!itemToPrint.barcode}
                              size="small"
                            />
                          }
                          label="Vonalkód"
                          sx={{ m: 0 }}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={labelFields.showPrice}
                              onChange={(e) => setLabelFields({ ...labelFields, showPrice: e.target.checked })}
                              size="small"
                            />
                          }
                          label="Ár"
                          sx={{ m: 0 }}
                        />
                      </FormGroup>
                    </Grid>
                  </Grid>

                  {/* Divider */}
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 3 }} />

                  {/* Row 2: Jelenlegi eladási ár */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Jelenlegi eladási ár
                      </Typography>
                      {currentSellingPrice !== null ? (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 2,
                          flexWrap: 'wrap',
                          width: '100%'
                        }}>
                          <TextField
                            type="number"
                            value={editableSellingPrice !== null ? editableSellingPrice : currentSellingPrice}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0
                              setEditableSellingPrice(value >= 0 ? value : 0)
                            }}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">Ft</InputAdornment>,
                              sx: {
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                '& input': {
                                  textAlign: 'right',
                                  color: 'error.main',
                                  fontWeight: 'bold'
                                }
                              }
                            }}
                            sx={{
                              width: '200px',
                              flexShrink: 0,
                              '& .MuiOutlinedInput-root': {
                                fontSize: '1.5rem',
                                fontWeight: 'bold'
                              }
                            }}
                          />
                          <Typography variant="h6" sx={{ color: 'text.secondary', flexShrink: 0 }}>/</Typography>
                          <FormControl sx={{ minWidth: 120, flexShrink: 0 }}>
                            <Select
                              value={selectedUnitShortform}
                              onChange={(e) => setSelectedUnitShortform(e.target.value)}
                              displayEmpty
                              sx={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold'
                              }}
                            >
                              {units.map((unit) => (
                                <MenuItem key={unit.id} value={unit.shortform}>
                                  {unit.shortform}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Box
                            sx={{
                              flex: '1 1 auto',
                              minWidth: 0,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              position: 'relative',
                              maxWidth: '100%'
                            }}
                          >
                            <Typography 
                              variant="h4" 
                              sx={{ 
                                color: 'error.main', 
                                fontWeight: 'bold',
                                fontSize: '2rem',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                                width: '100%',
                                transform: 'scale(1)',
                                transformOrigin: 'left center',
                                '@media (max-width: 1400px)': {
                                  fontSize: '1.75rem'
                                },
                                '@media (max-width: 1200px)': {
                                  fontSize: '1.5rem'
                                },
                                '@media (max-width: 1000px)': {
                                  fontSize: '1.25rem'
                                },
                                '@media (max-width: 800px)': {
                                  fontSize: '1rem'
                                },
                                '@media (max-width: 600px)': {
                                  fontSize: '0.875rem'
                                }
                              }}
                            >
                              = {new Intl.NumberFormat('hu-HU').format(editableSellingPrice !== null ? editableSellingPrice : currentSellingPrice)} Ft / {selectedUnitShortform || 'db'}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontStyle: 'italic'
                          }}
                        >
                          Ár számítható
                        </Typography>
                      )}
                    </Grid>
                  </Grid>

                  {/* Divider */}
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 3 }} />

                  {/* Row 3: Nyomtatás */}
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Nyomtatás
                      </Typography>
                      <TextField
                        label="Nyomtatandó mennyiség"
                        type="number"
                        value={printAmount}
                        onChange={(e) => setPrintAmount(Math.max(1, Number(e.target.value) || 1))}
                        inputProps={{ min: 1 }}
                        fullWidth
                        size="small"
                        helperText={`Alapértelmezett: ${itemToPrint.quantity_received}`}
                        sx={{ maxWidth: '300px' }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Row 2 - Preview */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ textAlign: 'center' }}>
                  Előnézet (33mm × 25mm - 2x nagyított):
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      // Show at 2x scale for visibility, maintaining exact aspect ratio
                      // 33mm x 25mm at 96 DPI = 124.8px x 94.5px
                      // 2x scale = 249.6px x 189px ≈ 250px x 189px
                      width: '250px',
                      height: '189px',
                      border: '2px solid #ccc',
                      padding: 0,
                      margin: 0,
                      backgroundColor: 'white',
                      display: 'grid',
                      gridTemplateRows: (() => {
                        const rows: string[] = []
                        if (labelFields.showName) rows.push('47.63px')  // 6.3mm * 7.56
                        if (labelFields.showSku && itemToPrint.sku) rows.push('28.73px')  // 3.8mm * 7.56
                        if (labelFields.showPrice) rows.push('49.14px')  // 6.5mm * 7.56
                        if (labelFields.showBarcode && itemToPrint.barcode) rows.push('52.16px')  // 6.9mm * 7.56
                        return rows.join(' ')
                      })(),
                      gridTemplateColumns: '100%',
                      gap: 0,
                      rowGap: 0,
                      columnGap: 0,
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      position: 'relative'
                    }}
                  >
                    {/* Section 1: Termék név */}
                    {labelFields.showName && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          alignSelf: 'stretch',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: 0,
                          margin: 0,
                          boxSizing: 'border-box',
                          lineHeight: 1.1
                        }}
                      >
                        <div
                          style={{
                            fontSize: (() => {
                              const text = editableProductName || itemToPrint.product_name || ''
                              if (text.length > 25) {
                                return '18.9px'
                              }
                              return '26.46px'
                            })(),
                            fontWeight: 'bold',
                            color: '#000000',
                            lineHeight: 1.1,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            maxWidth: '100%',
                            textAlign: 'center',
                            margin: 0,
                            padding: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'normal',
                            overflow: 'hidden'
                          }}
                        >
                          {editableProductName || itemToPrint.product_name}
                        </div>
                      </div>
                    )}

                    {/* Section 2: SKU */}
                    {labelFields.showSku && itemToPrint.sku && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          alignSelf: 'stretch',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: 0,
                          margin: 0,
                          boxSizing: 'border-box'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '22.68px',  // 3.0mm * 7.56 (preview scale factor)
                            color: '#000000',
                            lineHeight: 1,
                            margin: 0,
                            padding: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden'
                          }}
                        >
                          {itemToPrint.sku}
                        </div>
                      </div>
                    )}

                    {/* Section 3: Price */}
                    {labelFields.showPrice && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          alignSelf: 'stretch',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: 0,
                          margin: 0,
                          boxSizing: 'border-box'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '45.36px',
                            fontWeight: 'bold',
                            color: '#000000',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            margin: 0,
                            padding: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }}
                        >
                          {new Intl.NumberFormat('hu-HU').format(editableSellingPrice !== null ? editableSellingPrice : (currentSellingPrice || 0))} Ft / {selectedUnitShortform || 'db'}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Barcode */}
                    {labelFields.showBarcode && itemToPrint.barcode && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          alignSelf: 'stretch',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'flex-end',
                          overflow: 'hidden',
                          padding: 0,
                          margin: 0,
                          boxSizing: 'border-box'
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            padding: 0,
                            margin: 0,
                            overflow: 'hidden'
                          }}
                        >
                          <Barcode
                            value={itemToPrint.barcode}
                            format="CODE128"
                            width={2.5}
                            height={32}
                            fontSize={10}
                            displayValue={false}
                            margin={0}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintLabelOpen(false)} disabled={isPrinting}>
            Mégse
          </Button>
          <Button
            onClick={handlePrintLabel}
            variant="contained"
            color="primary"
            disabled={isPrinting || (!labelFields.showName && !labelFields.showSku && !labelFields.showBarcode && !labelFields.showPrice)}
            startIcon={isPrinting ? <CircularProgress size={18} /> : <PrintIcon />}
          >
            {isPrinting ? 'Nyomtatás...' : 'Nyomtatás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Barcode Modal */}
      <Dialog
        open={barcodeModalOpen}
        onClose={() => {
          setBarcodeModalOpen(false)
          setItemForBarcode(null)
          setBarcodeInputValue('')
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Vonalkód hozzáadása</DialogTitle>
        <DialogContent>
          {itemForBarcode && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Termék: {itemForBarcode.product_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                SKU: {itemForBarcode.sku}
              </Typography>
              <TextField
                label="Vonalkód"
                value={barcodeInputValue}
                onChange={(e) => setBarcodeInputValue(normalizeBarcode(e.target.value))}
                fullWidth
                sx={{ mb: 2 }}
                inputProps={{ maxLength: 64 }}
                helperText="Bármilyen vonalkód formátum (max 64 karakter)"
              />
              <Button
                variant="outlined"
                onClick={handleGenerateBarcode}
                fullWidth
                sx={{ mb: 2 }}
              >
                EAN-13 vonalkód generálása
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBarcodeModalOpen(false)
              setItemForBarcode(null)
              setBarcodeInputValue('')
            }}
            disabled={savingBarcode}
          >
            Mégse
          </Button>
          <Button
            onClick={handleSaveBarcode}
            variant="contained"
            color="primary"
            disabled={savingBarcode || !barcodeInputValue.trim()}
            startIcon={savingBarcode ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {savingBarcode ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Base Price Modal */}
      <Dialog
        open={updateBasePriceModalOpen}
        onClose={() => {
          setUpdateBasePriceModalOpen(false)
          setItemForBasePriceUpdate(null)
          setCurrentProductData(null)
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Nettó beszerzési ár frissítése</DialogTitle>
        <DialogContent>
          {itemForBasePriceUpdate && currentProductData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                Termék: {itemForBasePriceUpdate.product_name}
              </Typography>
              
              <Grid container spacing={3}>
                {/* Current Price Section */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Jelenlegi Ár
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Beszerzési nettó ár:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {(() => {
                            // Calculate effective base_price for display
                            let effectiveBasePrice = currentProductData.base_price
                            if (itemForBasePriceUpdate.product_type === 'material' && currentProductData.material_length_mm && currentProductData.material_width_mm) {
                              effectiveBasePrice = currentProductData.base_price * (currentProductData.material_length_mm * currentProductData.material_width_mm / 1000000)
                            } else if (itemForBasePriceUpdate.product_type === 'linear_material' && currentProductData.linear_material_length) {
                              effectiveBasePrice = currentProductData.base_price * (currentProductData.linear_material_length / 1000)
                            }
                            return new Intl.NumberFormat('hu-HU').format(effectiveBasePrice)
                          })()} Ft
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Árrés(Nettó):
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {currentProductData.multiplier.toFixed(2)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          ÁFA ({vatRates.get(itemForBasePriceUpdate.vat_id) || 0}%):
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {new Intl.NumberFormat('hu-HU').format(
                            (() => {
                              let effectiveBasePrice = currentProductData.base_price
                              if (itemForBasePriceUpdate.product_type === 'material' && currentProductData.material_length_mm && currentProductData.material_width_mm) {
                                effectiveBasePrice = currentProductData.base_price * (currentProductData.material_length_mm * currentProductData.material_width_mm / 1000000)
                              } else if (itemForBasePriceUpdate.product_type === 'linear_material' && currentProductData.linear_material_length) {
                                effectiveBasePrice = currentProductData.base_price * (currentProductData.linear_material_length / 1000)
                              }
                              return effectiveBasePrice * currentProductData.multiplier * (vatRates.get(itemForBasePriceUpdate.vat_id) || 0) / 100
                            })()
                          )} Ft
                        </Typography>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Jelenlegi Eladási Ár:
                        </Typography>
                        <Typography variant="h6" color="error.main" fontWeight="bold">
                          {new Intl.NumberFormat('hu-HU').format(
                            Math.ceil(
                              (() => {
                                let effectiveBasePrice = currentProductData.base_price
                                if (itemForBasePriceUpdate.product_type === 'material' && currentProductData.material_length_mm && currentProductData.material_width_mm) {
                                  effectiveBasePrice = currentProductData.base_price * (currentProductData.material_length_mm * currentProductData.material_width_mm / 1000000)
                                } else if (itemForBasePriceUpdate.product_type === 'linear_material' && currentProductData.linear_material_length) {
                                  effectiveBasePrice = currentProductData.base_price * (currentProductData.linear_material_length / 1000)
                                }
                                return (effectiveBasePrice * currentProductData.multiplier * (1 + (vatRates.get(itemForBasePriceUpdate.vat_id) || 0) / 100)) / 10
                              })()
                            ) * 10
                          )} Ft
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                {/* New Price Section */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, border: '1px solid', borderColor: 'primary.main', bgcolor: 'primary.lighter' }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Új Ár (PO nettó egységár alapján)
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Beszerzési nettó ár (PO nettó egységár):
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="primary.main">
                          {new Intl.NumberFormat('hu-HU').format(
                            (() => {
                              // Calculate effective base_price for display
                              let effectiveBasePrice = calculatedNewBasePrice || itemForBasePriceUpdate.net_price
                              if (itemForBasePriceUpdate.product_type === 'material' && currentProductData.material_length_mm && currentProductData.material_width_mm && calculatedNewBasePrice) {
                                // calculatedNewBasePrice is per m², convert to whole board
                                const areaM2 = (currentProductData.material_length_mm * currentProductData.material_width_mm) / 1000000
                                effectiveBasePrice = calculatedNewBasePrice * areaM2
                              } else if (itemForBasePriceUpdate.product_type === 'linear_material' && currentProductData.linear_material_length && calculatedNewBasePrice) {
                                // calculatedNewBasePrice is per m, convert to whole length
                                const lengthM = currentProductData.linear_material_length / 1000
                                effectiveBasePrice = calculatedNewBasePrice * lengthM
                              }
                              return effectiveBasePrice
                            })()
                          )} Ft
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Árrés(Nettó):
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="primary.main">
                          {calculatedNewMultiplier !== null ? calculatedNewMultiplier.toFixed(2) : currentProductData.multiplier.toFixed(2)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          ÁFA ({vatRates.get(itemForBasePriceUpdate.vat_id) || 0}%):
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {new Intl.NumberFormat('hu-HU').format(
                            (() => {
                              let effectiveBasePrice = calculatedNewBasePrice || itemForBasePriceUpdate.net_price
                              if (itemForBasePriceUpdate.product_type === 'material' && currentProductData.material_length_mm && currentProductData.material_width_mm && calculatedNewBasePrice) {
                                const areaM2 = (currentProductData.material_length_mm * currentProductData.material_width_mm) / 1000000
                                effectiveBasePrice = calculatedNewBasePrice * areaM2
                              } else if (itemForBasePriceUpdate.product_type === 'linear_material' && currentProductData.linear_material_length && calculatedNewBasePrice) {
                                const lengthM = currentProductData.linear_material_length / 1000
                                effectiveBasePrice = calculatedNewBasePrice * lengthM
                              }
                              const multiplierToUse = calculatedNewMultiplier !== null ? calculatedNewMultiplier : currentProductData.multiplier
                              return effectiveBasePrice * multiplierToUse * (vatRates.get(itemForBasePriceUpdate.vat_id) || 0) / 100
                            })()
                          )} Ft
                        </Typography>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Új Eladási Ár:
                        </Typography>
                        <TextField
                          type="number"
                          size="small"
                          value={newSellingPrice || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value)
                            setNewSellingPrice(val)
                          }}
                          inputProps={{ min: 0, step: 10 }}
                          sx={{ mt: 1 }}
                          fullWidth
                          helperText="Az ár automatikusan 10-re kerekítve lesz"
                        />
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>

              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  A nettó beszerzési ár frissítése megváltoztatja a termék jelenlegi eladási árát. Ez a művelet nem vonható vissza.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUpdateBasePriceModalOpen(false)
              setItemForBasePriceUpdate(null)
              setCurrentProductData(null)
              setNewSellingPrice(null)
              setCalculatedNewBasePrice(null)
              setCalculatedNewMultiplier(null)
            }}
            disabled={updatingBasePrice}
          >
            Mégse
          </Button>
          <Button
            onClick={handleConfirmUpdateBasePrice}
            variant="contained"
            color="primary"
            disabled={updatingBasePrice || newSellingPrice === null || newSellingPrice <= 0 || calculatedNewBasePrice === null || calculatedNewMultiplier === null}
            startIcon={<PriceCheckIcon />}
          >
            Nettó beszerzési ár frissítése
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Update Base Price Dialog */}
      <Dialog
        open={confirmUpdateBasePriceOpen}
        onClose={() => setConfirmUpdateBasePriceOpen(false)}
      >
        <DialogTitle>Nettó beszerzési ár frissítés megerősítése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan frissíteni szeretnéd a nettó beszerzési árat? Ez megváltoztatja a termék jelenlegi eladási árát. Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUpdateBasePriceOpen(false)} disabled={updatingBasePrice}>
            Mégse
          </Button>
          <Button
            onClick={handleUpdateBasePrice}
            variant="contained"
            color="primary"
            disabled={updatingBasePrice}
            startIcon={updatingBasePrice ? <CircularProgress size={18} /> : <PriceCheckIcon />}
          >
            {updatingBasePrice ? 'Frissítés...' : 'Megerősítés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

