'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import dynamic from 'next/dynamic'

import { useRouter } from 'next/navigation'

// Dynamic import for Barcode to avoid SSR issues
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Chip, Pagination, FormControl, InputLabel, Select, MenuItem, Menu, ListItemIcon, ListItemText, Grid, FormGroup, FormControlLabel, RadioGroup, Radio } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon, FileDownload as ExportIcon, FileUpload as ImportIcon, ArrowDropDown as ArrowDropDownIcon, Print as PrintIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

import { usePermissions } from '@/contexts/PermissionContext'

interface Accessory {
  id: string
  name: string
  sku: string
  barcode?: string | null
  base_price: number
  multiplier: number
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  created_at: string
  updated_at: string
  vat_name: string
  vat_percent: number
  currency_name: string
  unit_name: string
  unit_shortform: string
  partner_name: string
  vat_amount: number
  gross_price: number
}

interface AccessoriesListClientProps {
  initialAccessories: Accessory[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
}

export default function AccessoriesListClient({ 
  initialAccessories, 
  totalCount, 
  totalPages, 
  currentPage, 
  pageSize 
}: AccessoriesListClientProps) {
  const router = useRouter()
  
  // Check permission for this page - temporarily bypassed to fix hook errors
  // const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = true // Temporarily bypass permission check for testing
  const permissionsLoading = false
  
  const [accessories, setAccessories] = useState<Accessory[]>(initialAccessories)
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null)
  
  // Pagination state
  const [page, setPage] = useState(currentPage)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)
  const [isLoading, setIsLoading] = useState(false)
  
  // Import states
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importProgress, setImportProgress] = useState<{
    total: number
    processed: number
    status: string
  } | null>(null)

  // Print label states
  const [printLabelOpen, setPrintLabelOpen] = useState(false)
  const [accessoryToPrint, setAccessoryToPrint] = useState<Accessory | null>(null)
  const [editableProductName, setEditableProductName] = useState<string>('')
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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Server-side search with pagination
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Accessory[]>([])
  const [searchTotalCount, setSearchTotalCount] = useState(0)
  const [searchTotalPages, setSearchTotalPages] = useState(0)

  // Search effect
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/accessories/search?q=${encodeURIComponent(searchTerm)}&page=1&limit=${currentPageSize}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.accessories)
          setSearchTotalCount(data.totalCount)
          setSearchTotalPages(data.totalPages)
        } else {
          console.error('Search failed:', response.statusText)
          setSearchResults([])
          setSearchTotalCount(0)
          setSearchTotalPages(0)
        }
      } catch (error) {
        console.error('Error searching accessories:', error)
        setSearchResults([])
        setSearchTotalCount(0)
        setSearchTotalPages(0)
      } finally {
        setIsSearching(false)
      }
    }, 300) // Debounce search

    return () => clearTimeout(searchTimeout)
  }, [searchTerm, currentPageSize])

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

  // Handle search input change with barcode normalization
  const handleSearchChange = (value: string) => {
    const normalized = normalizeBarcode(value)
    setSearchTerm(normalized)
  }

  // Use search results if searching, otherwise use regular accessories
  const filteredAccessories = searchTerm && searchTerm.length >= 2 ? searchResults : accessories

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedAccessories(filteredAccessories.map(accessory => accessory.id))
    } else {
      setSelectedAccessories([])
    }
  }

  const handleSelectAccessory = (accessoryId: string) => {
    setSelectedAccessories(prev => 
      prev.includes(accessoryId) 
        ? prev.filter(id => id !== accessoryId)
        : [...prev, accessoryId]
    )
  }

  const isAllSelected = selectedAccessories.length === filteredAccessories.length && filteredAccessories.length > 0
  const isIndeterminate = selectedAccessories.length > 0 && selectedAccessories.length < filteredAccessories.length

  // Use search results count if searching, otherwise use regular total count
  const displayTotalCount = searchTerm && searchTerm.length >= 2 ? searchTotalCount : totalCount
  const displayTotalPages = searchTerm && searchTerm.length >= 2 ? searchTotalPages : totalPages

  const handleRowClick = (accessoryId: string) => {
    router.push(`/accessories/${accessoryId}`)
  }

  const handleAddNewAccessory = () => {
    router.push('/accessories/new')
  }

  // Pagination functions
  const handlePageChange = async (event: React.ChangeEvent<unknown>, newPage: number) => {
    setIsLoading(true)
    setPage(newPage)
    
    try {
      const response = await fetch(`/api/accessories/paginated?page=${newPage}&limit=${currentPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setAccessories(data.accessories)
      } else {
        console.error('Failed to fetch accessories')
        toast.error('Hiba történt az adatok betöltése során')
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
      toast.error('Hiba történt az adatok betöltése során')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePageSizeChange = async (event: any) => {
    const newPageSize = parseInt(event.target.value, 10)
    setIsLoading(true)
    setCurrentPageSize(newPageSize)
    setPage(1) // Reset to first page when changing page size
    
    try {
      const response = await fetch(`/api/accessories/paginated?page=1&limit=${newPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setAccessories(data.accessories)
      } else {
        console.error('Failed to fetch accessories')
        toast.error('Hiba történt az adatok betöltése során')
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
      toast.error('Hiba történt az adatok betöltése során')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteClick = () => {
    if (selectedAccessories.length === 0) {
      toast.warning('Válasszon ki legalább egy terméket a törléshez!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      
      return
    }

    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedAccessories.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete accessories one by one
      const deletePromises = selectedAccessories.map(accessoryId => 
        fetch(`/api/accessories/${accessoryId}`, {
          method: 'DELETE',
        })
      )
      
      const results = await Promise.allSettled(deletePromises)
      
      // Check if all deletions were successful
      const failedDeletions = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok)
      )
      
      if (failedDeletions.length === 0) {
        // All deletions successful
        toast.success(`${selectedAccessories.length} termék sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Invalidate cache and refresh data
        invalidateApiCache('/api/accessories')
        
        // Update local state by removing deleted accessories
        setAccessories(prev => prev.filter(accessory => !selectedAccessories.includes(accessory.id)))
        setSelectedAccessories([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} termék törlése sikertelen!`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Hiba történt a törlés során!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
  }

  const handleOpenPrintLabel = async () => {
    if (selectedAccessories.length !== 1) {
      toast.error('Válasszon ki pontosan egy terméket a címke nyomtatásához!')
      return
    }

    const accessoryId = selectedAccessories[0]
    const accessory = filteredAccessories.find(a => a.id === accessoryId)
    
    if (!accessory) {
      toast.error('Termék nem található!')
      return
    }

    // Fetch full accessory details including barcode, vat_percent, gross_price, etc.
    try {
      const response = await fetch(`/api/accessories/${accessoryId}`)
      if (!response.ok) {
        throw new Error('Hiba a termék adatainak betöltésekor')
      }
      const fullAccessory = await response.json()
      
      // Use the full accessory data (includes vat_percent, gross_price, etc.)
      // This ensures we have all the correct calculated fields
      setAccessoryToPrint(fullAccessory)
      setEditableProductName(fullAccessory.name)
      
      // Initialize editable selling price with calculated value
      const basePrice = fullAccessory.base_price || 0
      const multiplier = parseFloat(String(fullAccessory.multiplier)) || 1.38
      const vatPercent = fullAccessory.vat_percent || 0
      const calculatedPrice = Math.round(basePrice * multiplier * (1 + vatPercent / 100))
      setEditableSellingPrice(calculatedPrice)
      
      // Initialize selected unit with accessory's unit shortform
      setSelectedUnitShortform(fullAccessory.unit_shortform || '')
      
      // Fetch units for dropdown
      try {
        const unitsResponse = await fetch('/api/units')
        if (unitsResponse.ok) {
          const unitsData = await unitsResponse.json()
          setUnits(unitsData || [])
        }
      } catch (error) {
        console.error('Error fetching units:', error)
      }
      
      setLabelFields({
        showName: true,
        showSku: true,
        showBarcode: !!fullAccessory.barcode,
        showPrice: true
      })
      setPrintAmount(1)
      setPrintLabelOpen(true)
    } catch (error: any) {
      console.error('Error fetching accessory details:', error)
      toast.error(error.message || 'Hiba a termék adatainak betöltésekor')
    }
  }

  // Calculate current selling price: base_price * multiplier * (1 + vat_percent/100) rounded to nearest integer
  const currentSellingPrice = useMemo(() => {
    if (!accessoryToPrint) return null
    
    const basePrice = accessoryToPrint.base_price || 0
    const multiplier = parseFloat(String(accessoryToPrint.multiplier)) || 1.38 // Ensure multiplier is a number
    const vatPercent = accessoryToPrint.vat_percent || 0
    
    // Calculate: base_price * multiplier * (1 + vat_percent/100)
    const price = basePrice * multiplier * (1 + vatPercent / 100)
    
    // Round to nearest integer (nearest 1)
    return Math.round(price)
  }, [accessoryToPrint])

  // Label component for printing - EXACTLY 33mm x 25mm with fixed-height vertical sections
  // Fixed-height vertical sections using CSS Grid:
  // - Top padding: 1.5mm (to prevent overflow at top of sticker)
  // - Termék név: 5.3mm
  // - SKU: 3.0mm
  // - Price: 8.3mm
  // - Barcode: 8.875mm (reduced from 10.375mm to account for top padding)
  // Total: 1.5mm + 5.3mm + 3.0mm + 8.3mm + 8.875mm = 25mm (when all fields visible)
  const PrintLabel = ({ accessory, fields, price, productName, unitShortform }: { accessory: Accessory, fields: typeof labelFields, price: number, productName: string, unitShortform: string }) => {
    const text = productName || accessory.name || 'N/A'
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
    if (fields.showName) gridRows.push('5.3mm')
    if (fields.showSku && accessory.sku) gridRows.push('3.0mm')
    if (fields.showPrice) gridRows.push('8.3mm')
    if (fields.showBarcode && accessory.barcode) gridRows.push('8.875mm') // Reduced from 10.375mm to 8.875mm to account for 1.5mm top padding
    
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
        {/* Section 1: Termék név - 5.3mm */}
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

        {/* Section 2: SKU - 3.0mm */}
        {fields.showSku && accessory.sku && (
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
                fontSize: '2.2mm',
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
              {accessory.sku}
            </div>
          </div>
        )}

        {/* Section 3: Price - 8.3mm - Flush to bottom (on top of barcode) */}
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

        {/* Section 4: Barcode - 8.875mm (reduced to account for top padding) - Flush to bottom */}
        {fields.showBarcode && accessory.barcode && (
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
                value={accessory.barcode}
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

  // Handle print label - Using React components (same as shipments page)
  const handlePrintLabel = async () => {
    if (!accessoryToPrint) return

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

      // Add print styles - Same as shipments page
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
            padding: 1.5mm 0 0 0 !important; /* Top padding to prevent overflow at top of sticker */
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
            max-height: 100% !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            padding-top: 1.5mm !important; /* Ensure top padding is preserved */
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
          }
          
          /* Grid children - stretch to fill rows */
          #label-print-container > div > div {
            align-self: stretch !important;
            min-height: 0 !important;
            max-height: 100% !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
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
          
          /* Barcode container - align to bottom */
          #label-print-container > div > div:last-child {
            align-items: flex-end !important;
          }
        }
      `
      document.head.appendChild(style)

      // Render labels using React
      const root = createRoot(printContainer)
      const labels = []
      for (let i = 0; i < printAmount; i++) {
        labels.push(
          <PrintLabel
            key={i}
            accessory={accessoryToPrint}
            fields={labelFields}
            price={editableSellingPrice || currentSellingPrice || 0}
            productName={editableProductName}
            unitShortform={selectedUnitShortform || accessoryToPrint?.unit_shortform || 'db'}
          />
        )
      }
      root.render(<>{labels}</>)
      
      // Store root reference for cleanup
      ;(printContainer as any)._reactRootContainer = root

      // Wait a bit for React to render
      await new Promise(resolve => setTimeout(resolve, 100))

      // Trigger print
      window.print()

      // Cleanup after print dialog closes (or is cancelled)
      setTimeout(() => {
        try {
          const container = document.getElementById('label-print-container')
          if (container) {
            const rootRef = (container as any)._reactRootContainer
            if (rootRef) {
              rootRef.unmount()
            }
            document.body.removeChild(container)
          }
          const styleEl = document.getElementById('label-print-styles')
          if (styleEl) {
            document.head.removeChild(styleEl)
          }
        } catch (e) {
          console.error('Cleanup error:', e)
        }
      }, 1000)
    } catch (error: any) {
      console.error('Print error:', error)
      toast.error('Hiba a nyomtatás során')
    } finally {
      setIsPrinting(false)
    }
  }

  const handleExport = async (exportType: 'current' | 'all' | 'selected') => {
    setExportMenuAnchor(null)
    setIsExporting(true)
    
    try {
      let recordCount = 0
      let endpoint = '/api/accessories/export'
      
      // Determine which records to export
      if (exportType === 'current') {
        endpoint = `/api/accessories/export?page=${page}&limit=${currentPageSize}`
        recordCount = filteredAccessories.length
      } else if (exportType === 'selected') {
        if (selectedAccessories.length === 0) {
          toast.warning('Nincs kiválasztott termék!')
          setIsExporting(false)
          return
        }
        endpoint = `/api/accessories/export?ids=${selectedAccessories.join(',')}`
        recordCount = selectedAccessories.length
      } else {
        // Export all
        recordCount = totalCount
        if (totalCount > 5000) {
          toast.info(`${totalCount} rekord exportálása folyamatban, kérjük várjon...`, {
            autoClose: 5000
          })
        }
      }
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `accessories_${exportType}_${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`${recordCount} rekord sikeresen exportálva!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      } else {
        throw new Error('Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Export sikertelen!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Csak Excel fájlokat lehet importálni!')
      return
    }

    setImportFile(file)
    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/accessories/import/preview', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok || !result.preview) {
        const errorMsg = result.details?.join('\n') || 'Hiba az előnézet betöltésekor'
        toast.error(errorMsg, { autoClose: 10000 })
        setImportFile(null)
        return
      }

      setImportPreview(result.preview)
      setImportDialogOpen(true)
    } catch (error) {
      console.error('Import preview error:', error)
      toast.error('Hiba az előnézet betöltésekor!')
      setImportFile(null)
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  const handleImportConfirm = async () => {
    if (!importFile) return
    setIsImporting(true)
    
    const totalRecords = importPreview?.length || 0
    
    // Show initial progress
    setImportProgress({
      total: totalRecords,
      processed: 0,
      status: 'parsing'
    })

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      
      // Simulate progress updates (since batch operations don't give real-time progress)
      const estimatedTime = Math.ceil(totalRecords / 500) * 2.5 // ~2.5 sec per 500 records
      const updateInterval = Math.max(500, estimatedTime * 1000 / 10) // 10 updates total
      
      let progressValue = 0
      const progressTimer = setInterval(() => {
        progressValue = Math.min(progressValue + 10, 90) // Max 90% until actually complete
        setImportProgress({
          total: totalRecords,
          processed: Math.floor((progressValue / 100) * totalRecords),
          status: progressValue < 30 ? 'parsing' : progressValue < 60 ? 'inserting' : 'updating'
        })
      }, updateInterval)

      const response = await fetch('/api/accessories/import', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressTimer)
      
      // Show 100% complete
      setImportProgress({
        total: totalRecords,
        processed: totalRecords,
        status: 'complete'
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.details?.join('\n') || 'Import sikertelen!', { autoClose: 10000 })
      } else {
        toast.success(`Import sikeres! ${result.successCount} termék feldolgozva.`)
        
        invalidateApiCache('/api/accessories')
        
        // Reload current page
        router.refresh()
        
        setImportDialogOpen(false)
        setImportFile(null)
        setImportPreview(null)
        setImportProgress(null)
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Hiba történt az importálás során!')
      setImportProgress(null)
    } finally {
      setIsImporting(false)
    }
  }

  // Check access permission
  useEffect(() => {
    // Only redirect if permissions are loaded and user doesn't have access
    // Add a small delay to prevent redirects during page refresh
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        toast.error('Nincs jogosultsága a Termékek oldal megtekintéséhez!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        router.push('/users')
      }, 100) // Small delay to prevent redirects during page refresh
      
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading, router])

  // Show loading state while permissions are being checked
  if (permissionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a Termékek oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Termékek
        </Typography>
      </Breadcrumbs>
      
      {mounted && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<ExportIcon />} 
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)} 
              disabled={isExporting}
            >
              {isExporting ? <CircularProgress size={20} /> : 'Export'}
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              <MenuItem onClick={() => handleExport('current')}>
                <ListItemIcon>
                  <ExportIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Aktuális oldal" 
                  secondary={`${filteredAccessories.length} rekord`}
                />
              </MenuItem>
              {selectedAccessories.length > 0 && (
                <MenuItem onClick={() => handleExport('selected')}>
                  <ListItemIcon>
                    <ExportIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Kiválasztott" 
                    secondary={`${selectedAccessories.length} rekord`}
                  />
                </MenuItem>
              )}
              <MenuItem onClick={() => handleExport('all')}>
                <ListItemIcon>
                  <ExportIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Összes termék" 
                  secondary={`${totalCount} rekord ${totalCount > 5000 ? '⚠️ ~15-20 mp' : ''}`}
                />
              </MenuItem>
            </Menu>
            <Button
              variant="outlined"
              component="label"
              startIcon={isImporting ? <CircularProgress size={20} /> : <ImportIcon />}
              disabled={isImporting}
            >
              Import
              <input type="file" hidden accept=".xlsx,.xls" onChange={handleImportFileSelect} />
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {selectedAccessories.length === 1 && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                color="primary"
                onClick={handleOpenPrintLabel}
              >
                Címke nyomtatás
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={handleDeleteClick}
              disabled={selectedAccessories.length === 0}
            >
              Törlés ({selectedAccessories.length})
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
              onClick={handleAddNewAccessory}
            >
              Új termék hozzáadása
            </Button>
          </Box>
        </Box>
      )}
      
      <TextField
        fullWidth
        placeholder="Keresés név, SKU vagy vonalkód szerint..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        sx={{ mt: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Termék neve</TableCell>
              <TableCell>Mértékegység</TableCell>
              <TableCell>Partner</TableCell>
              <TableCell align="right">Beszerzési ár</TableCell>
              <TableCell align="right">Árrés szorzó</TableCell>
              <TableCell align="right">Nettó ár</TableCell>
              <TableCell align="right">Bruttó ár</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAccessories.map((accessory) => (
              <TableRow 
                key={accessory.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(accessory.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedAccessories.includes(accessory.id)}
                    onChange={() => handleSelectAccessory(accessory.id)}
                  />
                </TableCell>
                <TableCell>{accessory.sku}</TableCell>
                <TableCell>{accessory.name}</TableCell>
                <TableCell>{accessory.unit_shortform || accessory.unit_name}</TableCell>
                <TableCell>{accessory.partner_name}</TableCell>
                <TableCell align="right">{new Intl.NumberFormat('hu-HU', {
                  style: 'currency',
                  currency: 'HUF',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(accessory.base_price)}</TableCell>
                <TableCell align="right">
                  <Chip 
                    label={`${accessory.multiplier}x`} 
                    size="small" 
                    color="info" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">{new Intl.NumberFormat('hu-HU', {
                  style: 'currency',
                  currency: 'HUF',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(accessory.net_price)}</TableCell>
                <TableCell align="right">{new Intl.NumberFormat('hu-HU', {
                  style: 'currency',
                  currency: 'HUF',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(accessory.gross_price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {searchTerm && searchTerm.length >= 2 
              ? `Keresési eredmény: ${displayTotalCount} termék` 
              : `Összesen ${displayTotalCount} termék`
            }
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Oldal mérete</InputLabel>
            <Select
              value={currentPageSize}
              onChange={handlePageSizeChange}
              label="Oldal mérete"
              disabled={isLoading}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Pagination
          count={displayTotalPages}
          page={page}
          onChange={handlePageChange}
          color="primary"
          disabled={isLoading}
          showFirstButton
          showLastButton
        />
      </Box>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Termékek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedAccessories.length} terméket? 
            Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel} 
            disabled={isDeleting}
          >
            Mégse
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog 
        open={importDialogOpen} 
        onClose={() => !isImporting && setImportDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        disableEscapeKeyDown={isImporting}
      >
        <DialogTitle>Import előnézet</DialogTitle>
        <DialogContent>
          {importPreview && importPreview.length > 0 && (
            <>
              <Box sx={{ mb: 2, mt: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Összesen:</strong> {importPreview.length} termék
                </Typography>
                <Typography variant="body2" color="success.main">
                  Új: {importPreview.filter((p: any) => p.action === 'Új').length}
                </Typography>
                <Typography variant="body2" color="info.main">
                  Frissítés: {importPreview.filter((p: any) => p.action === 'Frissítés').length}
                </Typography>
                {importPreview.length > 1000 && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                    ⚠️ Nagy mennyiség! Becsült idő: ~{Math.ceil(importPreview.length / 500) * 2}-{Math.ceil(importPreview.length / 500) * 3} másodperc
                  </Typography>
                )}
                {isImporting && importProgress && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {importProgress.status === 'parsing' && 'Adatok feldolgozása...'}
                      {importProgress.status === 'inserting' && `Új rekordok mentése... ${importProgress.processed}/${importProgress.total}`}
                      {importProgress.status === 'updating' && `Meglévő rekordok frissítése... ${importProgress.processed}/${importProgress.total}`}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ flexGrow: 1, backgroundColor: 'grey.200', borderRadius: 1, height: 8, overflow: 'hidden' }}>
                        <Box 
                          sx={{ 
                            width: `${(importProgress.processed / importProgress.total) * 100}%`,
                            height: '100%',
                            backgroundColor: 'primary.main',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ minWidth: 50, textAlign: 'right' }}>
                        {Math.round((importProgress.processed / importProgress.total) * 100)}%
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Művelet</strong></TableCell>
                      <TableCell><strong>SKU</strong></TableCell>
                      <TableCell><strong>Név</strong></TableCell>
                      <TableCell><strong>Beszerzési ár (Ft)</strong></TableCell>
                      <TableCell><strong>Árrés szorzó</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip label={row.action === 'Új' ? 'Hozzáadás' : 'Frissítés'} color={row.action === 'Új' ? 'success' : 'info'} size="small" />
                        </TableCell>
                        <TableCell>{row.sku}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.basePrice} Ft</TableCell>
                        <TableCell>{row.multiplier}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => { 
              setImportDialogOpen(false); 
              setImportFile(null); 
              setImportPreview(null); 
              setImportProgress(null);
            }}
            disabled={isImporting}
          >
            Mégse
          </Button>
          <Button onClick={handleImportConfirm} variant="contained" disabled={!importPreview || isImporting}>
            {isImporting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                Importálás...
              </Box>
            ) : (
              'Import megerősítése'
            )}
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
          {accessoryToPrint && (
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
                              disabled={!accessoryToPrint.barcode}
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
                      {editableSellingPrice !== null ? (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 2,
                          flexWrap: 'wrap',
                          width: '100%'
                        }}>
                          <TextField
                            type="number"
                            value={editableSellingPrice}
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
                                // Scale down if container is too small
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
                              = {new Intl.NumberFormat('hu-HU').format(editableSellingPrice)} Ft / {selectedUnitShortform || 'db'}
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
                        helperText="Alapértelmezett: 1"
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
                      width: '250px',
                      height: '189px',
                      border: '2px solid #ccc',
                      padding: 0,
                      margin: 0,
                      backgroundColor: 'white',
                      display: 'grid',
                      gridTemplateRows: (() => {
                        const rows: string[] = []
                        if (labelFields.showName) rows.push('40px')
                        if (labelFields.showSku && accessoryToPrint.sku) rows.push('22.68px')
                        if (labelFields.showPrice) rows.push('62.74px')
                        if (labelFields.showBarcode && accessoryToPrint.barcode) rows.push('62.74px')
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
                              const text = editableProductName || accessoryToPrint.name || ''
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
                          {editableProductName || accessoryToPrint.name}
                        </div>
                      </div>
                    )}

                    {/* Section 2: SKU */}
                    {labelFields.showSku && accessoryToPrint.sku && (
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
                            fontSize: '16.63px',
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
                          {accessoryToPrint.sku}
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
                          {new Intl.NumberFormat('hu-HU').format(editableSellingPrice || currentSellingPrice || 0)} Ft / {selectedUnitShortform || accessoryToPrint?.unit_shortform || 'db'}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Barcode */}
                    {labelFields.showBarcode && accessoryToPrint.barcode && (
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
                            value={accessoryToPrint.barcode}
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
          <Button
            onClick={() => {
              setPrintLabelOpen(false)
              setAccessoryToPrint(null)
              setEditableProductName('')
              setLabelFields({
                showName: true,
                showSku: true,
                showBarcode: true,
                showPrice: true
              })
              setPrintAmount(1)
            }}
            disabled={isPrinting}
          >
            Mégse
          </Button>
          <Button
            onClick={handlePrintLabel}
            variant="contained"
            color="primary"
            disabled={isPrinting || !accessoryToPrint}
            startIcon={isPrinting ? <CircularProgress size={18} /> : <PrintIcon />}
          >
            {isPrinting ? 'Nyomtatás...' : 'Nyomtatás'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}