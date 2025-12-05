'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, IconButton, Checkbox, FormControlLabel, FormGroup, Autocomplete, Divider, RadioGroup, Radio, FormControl, FormLabel
} from '@mui/material'
import dynamic from 'next/dynamic'

// Dynamic import for Barcode to avoid SSR issues
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, AddCircle as AddCircleIcon, RemoveCircle as RemoveCircleIcon, Check as CheckIcon, Print as PrintIcon } from '@mui/icons-material'
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
  quantity_received: number
  target_quantity: number
  net_price: number
  net_total: number
  gross_total: number
  vat_id: string
  currency_id: string
  units_id: string
  note?: string
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
  const [priceMultiplier, setPriceMultiplier] = useState<number>(1.75)
  const [labelFields, setLabelFields] = useState({
    showName: true,
    showSku: true,
    showBarcode: true,
    showPrice: true
  })
  const [printAmount, setPrintAmount] = useState<number>(1)
  const [isPrinting, setIsPrinting] = useState(false)
  const [priceRounding, setPriceRounding] = useState<'none' | '10' | '100'>('none')
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
      const netTotal = qty * item.net_price
      const vatPercent = vatRates.get(item.vat_id) || 0
      const vatAmount = Math.round(netTotal * (vatPercent / 100))
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
      const netTotal = item.quantity_received * price
      const vatPercent = vatRates.get(item.vat_id) || 0
      const vatAmount = Math.round(netTotal * (vatPercent / 100))
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

  // Handle barcode input change (debounced for scanner)
  const handleBarcodeInputChange = (value: string) => {
    // Don't process barcode input when modal is open
    if (receiveConfirmOpen) {
      return
    }
    
    setBarcodeInput(value)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Set new timeout - trigger scan when input stops changing for 100ms
    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = value.trim()
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

    const trimmedBarcode = barcode.trim()

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
      // Fetch accessory by barcode
      const response = await fetch(`/api/pos/accessories/by-barcode?barcode=${encodeURIComponent(trimmedBarcode)}`)
      
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
          const lineNet = newItem.quantity_received * netPrice
          const lineVat = Math.round(lineNet * (vatPercent / 100))
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
      const net_total = data.item.quantity_received * data.item.net_price
      const vat_amount = Math.round(net_total * (vatPercent / 100))
      const gross_total = net_total + vat_amount

      // Create the new item with calculated totals
      const newItem: ShipmentItem = {
        id: data.item.id,
        purchase_order_item_id: data.item.purchase_order_item_id,
        product_name: data.item.product_name,
        sku: data.item.sku,
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
  const handleOpenPrintLabel = (item: ShipmentItem) => {
    setItemToPrint(item)
    setPriceMultiplier(1.75)
    setPrintAmount(item.quantity_received || 1)
    // If no barcode, don't select it by default
    const hasBarcode = !!item.barcode
    setLabelFields({
      showName: true,
      showSku: true,
      showBarcode: hasBarcode,
      showPrice: true
    })
    setPrintLabelOpen(true)
  }

  // Handle print label - Browser print with canvas rendering
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
      printContainer.style.width = '33mm'
      printContainer.style.height = `${25 * printAmount}mm`
      document.body.appendChild(printContainer)

      // Add print styles
      const style = document.createElement('style')
      style.id = 'label-print-styles'
      style.textContent = `
        @media print {
          @page {
            size: 33mm 25mm;
            margin: 0;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 33mm !important;
            height: auto !important;
          }
          
          body > *:not(#label-print-container) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          
          #label-print-container {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 33mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: block !important;
          }
          
          #label-print-container > .label-print-item {
            width: 33mm !important;
            height: 25mm !important;
            min-height: 25mm !important;
            max-height: 25mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: none !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            background: white !important;
            overflow: hidden !important;
            font-family: Arial, sans-serif !important;
          }
          
          #label-print-container > .label-print-item:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
        
        .label-print-item {
          width: 33mm;
          height: 25mm;
          border: 1px solid #ccc;
          margin: 2mm;
          padding: 2mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: white;
          overflow: hidden;
          font-family: Arial, sans-serif;
        }
      `
      document.head.appendChild(style)

      // Render labels
      for (let i = 0; i < printAmount; i++) {
        const labelDiv = document.createElement('div')
        labelDiv.className = 'label-print-item'
        
        // Top section - Name, SKU, Price
        const topSection = document.createElement('div')
        topSection.style.width = '100%'
        topSection.style.textAlign = 'center'
        topSection.style.flex = '1'
        topSection.style.display = 'flex'
        topSection.style.flexDirection = 'column'
        topSection.style.justifyContent = 'center'
        topSection.style.alignItems = 'center'
        topSection.style.gap = '1mm'
        
        // Product Name
        if (labelFields.showName && itemToPrint.product_name) {
          const nameEl = document.createElement('div')
          nameEl.style.fontSize = '3.5mm'
          nameEl.style.fontWeight = 'bold'
          nameEl.style.color = '#000000'
          nameEl.style.lineHeight = '1.2'
          nameEl.style.wordWrap = 'break-word'
          nameEl.style.maxWidth = '100%'
          nameEl.style.overflow = 'hidden'
          nameEl.textContent = itemToPrint.product_name
          topSection.appendChild(nameEl)
        }
        
        // SKU
        if (labelFields.showSku && itemToPrint.sku) {
          const skuEl = document.createElement('div')
          skuEl.style.fontSize = '4.5mm'
          skuEl.style.color = '#000000'
          skuEl.style.lineHeight = '1.2'
          skuEl.textContent = itemToPrint.sku
          topSection.appendChild(skuEl)
        }
        
        // Price
        if (labelFields.showPrice) {
          const priceEl = document.createElement('div')
          priceEl.style.fontSize = '9mm'
          priceEl.style.fontWeight = 'bold'
          priceEl.style.color = '#000000'
          priceEl.style.lineHeight = '1.2'
          priceEl.textContent = `${new Intl.NumberFormat('hu-HU').format(calculatedSellingPrice)} Ft`
          topSection.appendChild(priceEl)
        }
        
        labelDiv.appendChild(topSection)
        
        // Barcode section
        if (labelFields.showBarcode && itemToPrint.barcode) {
          const barcodeSection = document.createElement('div')
          barcodeSection.style.width = '100%'
          barcodeSection.style.display = 'flex'
          barcodeSection.style.justifyContent = 'center'
          barcodeSection.style.alignItems = 'flex-end'
          barcodeSection.style.flexShrink = '0'
          barcodeSection.style.marginTop = 'auto'
          barcodeSection.style.paddingBottom = '1mm'
          
          // Create barcode using react-barcode (we'll render it to canvas)
          const barcodeWrapper = document.createElement('div')
          barcodeWrapper.style.width = '100%'
          barcodeWrapper.style.maxWidth = '100%'
          barcodeWrapper.id = `barcode-${i}`
          barcodeSection.appendChild(barcodeWrapper)
          labelDiv.appendChild(barcodeSection)
        }
        
        printContainer.appendChild(labelDiv)
      }

      // Wait a bit for DOM to update, then render barcodes
      setTimeout(async () => {
        // Render barcodes using bwip-js
        if (labelFields.showBarcode && itemToPrint.barcode) {
          try {
            // Dynamically import bwip-js only in browser
            const bwipjs = await import('bwip-js')
            const barcodeWrappers = printContainer.querySelectorAll('[id^="barcode-"]')
            for (const wrapper of Array.from(barcodeWrappers)) {
              try {
                const canvas = document.createElement('canvas')
                // Render CODE128 barcode
                await bwipjs.default.toCanvas(canvas, {
                  bcid: 'code128',        // Barcode type
                  text: itemToPrint.barcode || '',  // Text to encode
                  scale: 2,                // Scaling factor
                  height: 10,              // Bar height (in mm)
                  includetext: false,      // Don't show text below barcode
                  textxalign: 'center',
                })
                canvas.style.width = '100%'
                canvas.style.height = 'auto'
                canvas.style.maxWidth = '100%'
                wrapper.appendChild(canvas)
              } catch (error) {
                console.error('Error rendering barcode:', error)
                // Fallback: show barcode text
                const fallback = document.createElement('div')
                fallback.style.fontSize = '2mm'
                fallback.style.color = '#000000'
                fallback.textContent = itemToPrint.barcode || ''
                wrapper.appendChild(fallback)
              }
            }
          } catch (importError) {
            console.error('Error importing bwip-js:', importError)
            // Fallback: show barcode text
            const barcodeWrappers = printContainer.querySelectorAll('[id^="barcode-"]')
            barcodeWrappers.forEach((wrapper) => {
              const fallback = document.createElement('div')
              fallback.style.fontSize = '2mm'
              fallback.style.color = '#000000'
              fallback.textContent = itemToPrint.barcode || ''
              wrapper.appendChild(fallback)
            })
          }
        }

        // Small delay to ensure barcodes are rendered
        setTimeout(() => {
          // Verify we have the correct number of labels
          const labels = printContainer.querySelectorAll('.label-print-item')
          console.log(`Created ${labels.length} labels, expected ${printAmount}`)
          
          if (labels.length !== printAmount) {
            console.error(`Label count mismatch: ${labels.length} vs ${printAmount}`)
          }

          // Trigger print dialog
          window.print()

          // Clean up after a delay (give time for print dialog to open)
          // Use a longer timeout to ensure print dialog has time to process
          setTimeout(() => {
            const container = document.getElementById('label-print-container')
            if (container && container.parentNode) {
              container.parentNode.removeChild(container)
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
      }, 100)
    } catch (error: any) {
      console.error('Error printing label:', error)
      toast.error(error.message || 'Hiba a nyomtatás során')
      setIsPrinting(false)
      
      // Clean up on error
      const printContainer = document.getElementById('label-print-container')
      if (printContainer) {
        document.body.removeChild(printContainer)
      }
      const styleEl = document.getElementById('label-print-styles')
      if (styleEl) {
        document.head.removeChild(styleEl)
      }
    }
  }

  // Calculate selling price with rounding
  const calculatedSellingPrice = useMemo(() => {
    if (!itemToPrint) return 0
    const basePrice = itemToPrint.net_price * priceMultiplier
    
    if (priceRounding === '10') {
      return Math.round(basePrice / 10) * 10
    } else if (priceRounding === '100') {
      return Math.round(basePrice / 100) * 100
    }
    
    return Math.round(basePrice)
  }, [itemToPrint, priceMultiplier, priceRounding])

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
                    <TableCell align="right">Nettó összesen</TableCell>
                    <TableCell align="right">Bruttó összesen</TableCell>
                    <TableCell>Művelet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
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
                      <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(item.net_total)} Ft</TableCell>
                      <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(item.gross_total)} Ft</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {header.status === 'received' && (
                            <IconButton 
                              size="small" 
                              onClick={() => handleOpenPrintLabel(item)}
                              color="primary"
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
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
                      <TableCell colSpan={8}>
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
              {/* Row 1 - Controls */}
              <Grid item xs={12}>
                <Grid container spacing={2} alignItems="flex-start">
                  {/* Section 1: Megjelenítendő mezők */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: 'background.paper'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Megjelenítendő mezők
                      </Typography>
                      <FormGroup sx={{ gap: 0.5 }}>
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
                    </Box>
                  </Grid>

                  {/* Section 2: Ár szorzó + Eladási ár */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: 'background.paper'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Ár beállítások
                      </Typography>
                      <Stack spacing={2}>
                        <TextField
                          label="Ár szorzó"
                          type="number"
                          value={priceMultiplier}
                          onChange={(e) => setPriceMultiplier(Number(e.target.value) || 1.75)}
                          inputProps={{ min: 0.01, step: 0.01 }}
                          fullWidth
                          size="small"
                          helperText="Alapértelmezett: 1.75"
                        />
                        <TextField
                          label="Eladási ár"
                          value={new Intl.NumberFormat('hu-HU').format(calculatedSellingPrice) + ' Ft'}
                          fullWidth
                          disabled
                          size="small"
                        />
                      </Stack>
                    </Box>
                  </Grid>

                  {/* Section 3: Ár kerekítés */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: 'background.paper'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        Ár kerekítés
                      </Typography>
                      <FormControl component="fieldset" size="small" fullWidth>
                        <RadioGroup
                          value={priceRounding}
                          onChange={(e) => setPriceRounding(e.target.value as 'none' | '10' | '100')}
                          row
                          sx={{ mt: 0 }}
                        >
                          <FormControlLabel value="none" control={<Radio size="small" />} label="Nincs" sx={{ mr: 1 }} />
                          <FormControlLabel value="10" control={<Radio size="small" />} label="10-re" sx={{ mr: 1 }} />
                          <FormControlLabel value="100" control={<Radio size="small" />} label="100-ra" />
                        </RadioGroup>
                      </FormControl>
                    </Box>
                  </Grid>

                  {/* Section 4: Nyomtatandó mennyiség */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: 'background.paper'
                      }}
                    >
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
                      />
                    </Box>
                  </Grid>
                </Grid>
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
                  <Box
                    sx={{
                      // Show at 2x scale for visibility, maintaining exact aspect ratio
                      width: '248px', // 33mm * 2 = 66mm at 96 DPI ≈ 248px
                      height: '188px', // 25mm * 2 = 50mm at 96 DPI ≈ 188px
                      border: '2px solid #ccc',
                      p: 1,
                      backgroundColor: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      position: 'relative'
                    }}
                  >
                  {/* Top section - Name, SKU, Price (centered vertically above barcode) */}
                  <Box sx={{ 
                    width: '100%', 
                    textAlign: 'center',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center', // Center all content vertically
                    alignItems: 'center',
                    minHeight: 0,
                    overflow: 'hidden',
                    py: 0.5
                  }}>
                    {/* Group all text elements together and center them */}
                    <Box sx={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 0.5
                    }}>
                      {labelFields.showName && (
                        <Typography
                          component="div"
                          sx={{
                            fontSize: '18px', // 30% bigger (14px * 1.3 = 18.2px)
                            fontWeight: 'bold',
                            color: '#000000', // Black color
                            lineHeight: 1.2,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            hyphens: 'auto',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textAlign: 'center',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {itemToPrint.product_name}
                        </Typography>
                      )}
                      {labelFields.showSku && (
                        <Typography
                          sx={{
                            fontSize: '24px', // Double size (12px * 2)
                            color: '#000000', // Black color
                            display: 'block',
                            lineHeight: 1.2
                          }}
                        >
                          {itemToPrint.sku}
                        </Typography>
                      )}
                      {labelFields.showPrice && (
                        <Typography
                          sx={{
                            fontSize: '48px', // Double size
                            fontWeight: 'bold',
                            color: '#000000', // Black color
                            display: 'block',
                            lineHeight: 1.2
                          }}
                        >
                          {new Intl.NumberFormat('hu-HU').format(calculatedSellingPrice)} Ft
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Bottom section - Barcode (full width) */}
                  {labelFields.showBarcode && itemToPrint.barcode && (
                    <Box sx={{ 
                      width: '100%', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'flex-end',
                      flexShrink: 0,
                      mt: 'auto',
                      pb: 0.5,
                      px: 0.5,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ width: '100%', maxWidth: '100%' }}>
                        <Barcode
                          value={itemToPrint.barcode}
                          format="CODE128"
                          width={3.0} // Wider for full width
                          height={36} // Scaled 2x
                          fontSize={12} // Scaled 2x
                          displayValue={false}
                          margin={0}
                        />
                      </Box>
                    </Box>
                  )}
                  </Box>
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
    </Box>
  )
}

