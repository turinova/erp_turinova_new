'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  TextField, 
  InputAdornment, 
  CircularProgress,
  Chip,
  Checkbox,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import { 
  Search as SearchIcon, 
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HelpOutline as HelpOutlineIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  FamilyRestroom as FamilyRestroomIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Assessment as AssessmentIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  FileDownload as FileDownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon
} from '@mui/icons-material'
import { Avatar, IconButton } from '@mui/material'
import { toast } from 'react-toastify'
import type { ShopRenterProduct } from '@/lib/products-server'
import ProductQualityScore from '@/components/ProductQualityScore'

interface IndexingStatus {
  product_id: string
  is_indexed: boolean
  last_checked: string | null
  coverage_state: string | null
}

interface ProductsTableProps {
  initialProducts: ShopRenterProduct[]
  initialQualityScores?: Record<string, any>
  initialIndexingStatuses?: Record<string, IndexingStatus>
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialSearch: string
}

export default function ProductsTable({ 
  initialProducts,
  initialQualityScores = {},
  initialIndexingStatuses = {},
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialSearch
}: ProductsTableProps) {
  const router = useRouter()
  const [products, setProducts] = useState<ShopRenterProduct[]>(initialProducts)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  
  // Selection state (for bulk operations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Indexing status state - initialize with server-side data
  const [indexingStatuses, setIndexingStatuses] = useState<Map<string, IndexingStatus>>(
    new Map(Object.entries(initialIndexingStatuses))
  )
  const [isLoadingIndexStatus, setIsLoadingIndexStatus] = useState(false)

  // Track which products are parents (have children)
  const [parentProductIds, setParentProductIds] = useState<Set<string>>(new Set())

  // Product images state - map of product_id to main image URL
  const [productImages, setProductImages] = useState<Map<string, string>>(new Map())

  // Image modal state
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [selectedImageAlt, setSelectedImageAlt] = useState<string>('')

  // Search Console sync state
  const [isSyncingSearchConsole, setIsSyncingSearchConsole] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  // URL alias optimization state
  const [isOptimizingUrls, setIsOptimizingUrls] = useState(false)
  const [urlOptimizationProgress, setUrlOptimizationProgress] = useState({ current: 0, total: 0 })
  const [urlOptimizationResults, setUrlOptimizationResults] = useState<Array<{
    productId: string
    success: boolean
    suggestedSlug?: string
    currentSlug?: string | null
  }> | null>(null)
  const [urlOptimizationDialogOpen, setUrlOptimizationDialogOpen] = useState(false)

  // Image alt text bulk operations state
  const [isGeneratingImageAltText, setIsGeneratingImageAltText] = useState(false)
  const [isSyncingImageAltText, setIsSyncingImageAltText] = useState(false)
  const [imageAltTextProgress, setImageAltTextProgress] = useState({ current: 0, total: 0 })
  const [imageAltTextDialogOpen, setImageAltTextDialogOpen] = useState(false)
  const [imageAltTextDialogType, setImageAltTextDialogType] = useState<'generate' | 'sync'>('generate')

  // Bulk sync from ShopRenter state
  const [isSyncingFromShopRenter, setIsSyncingFromShopRenter] = useState(false)
  const [shopRenterSyncProgress, setShopRenterSyncProgress] = useState({ current: 0, total: 0 })

  // Bulk sync to ShopRenter state
  const [isSyncingToShopRenter, setIsSyncingToShopRenter] = useState(false)
  const [shopRenterSyncToProgress, setShopRenterSyncToProgress] = useState({ current: 0, total: 0 })

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<{ id: string; sku: string; name: string; hasChildren: boolean; childCount: number } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Export state - default all fields checked
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFields, setExportFields] = useState<Set<string>>(new Set([
    'sku',
    'model_number',
    'gtin',
    'name',
    'cost',
    'multiplier',
    'price',
    'gross_price',
    'status'
  ]))
  const [isExporting, setIsExporting] = useState(false)

  // Refs for polling intervals
  const syncFromShopRenterIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const syncToShopRenterIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (syncFromShopRenterIntervalRef.current) {
        clearInterval(syncFromShopRenterIntervalRef.current)
      }
      if (syncToShopRenterIntervalRef.current) {
        clearInterval(syncToShopRenterIntervalRef.current)
      }
    }
  }, [])

  // Quality score state - initialize with server-side data
  const [qualityScores, setQualityScores] = useState<Map<string, any>>(
    new Map(Object.entries(initialQualityScores))
  )
  const [isCalculatingQualityScores, setIsCalculatingQualityScores] = useState(false)
  const [qualityScoreProgress, setQualityScoreProgress] = useState({ current: 0, total: 0 })
  const [qualityScoreDialogOpen, setQualityScoreDialogOpen] = useState(false)


  // Pagination state
  const [page, setPage] = useState(currentPage)
  const [currentPageSize, setCurrentPageSize] = useState(limit)
  const [isLoading, setIsLoading] = useState(false)

  // Server-side search with pagination
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ShopRenterProduct[]>([])
  const [searchTotalCount, setSearchTotalCount] = useState(0)
  const [searchTotalPages, setSearchTotalPages] = useState(0)
  const [hasSearched, setHasSearched] = useState(false) // Track if a search has been performed

  // Search function - called only on Enter key press
  const performSearch = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
      setHasSearched(false) // Reset flag when clearing
      return
    }

    setIsSearching(true)
    setHasSearched(true) // Mark that a search has been performed
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(term)}&page=1&limit=${currentPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.products)
        setSearchTotalCount(data.totalCount)
        setSearchTotalPages(data.totalPages)
      } else {
        console.error('Search failed:', response.statusText)
        setSearchResults([])
        setSearchTotalCount(0)
        setSearchTotalPages(0)
      }
    } catch (error) {
      console.error('Error searching products:', error)
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
    } finally {
      setIsSearching(false)
    }
  }, [currentPageSize])

  // Search is now only triggered on Enter key press (see handleSearchKeyPress)
  // Removed automatic search on input change

  // Fetch quality scores for displayed products (batch API)
  const fetchQualityScores = async (productIds: string[]) => {
    if (productIds.length === 0) return
    
    try {
      // Use batch API instead of individual calls
      const response = await fetch('/api/products/quality-scores-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        const scoresMap = new Map<string, any>(qualityScores)
        
        // Update map with batch results
        for (const score of data.scores || []) {
          scoresMap.set(score.product_id, score)
        }
        
        setQualityScores(scoresMap)
      } else {
        console.error('Failed to fetch quality scores batch')
      }
    } catch (error) {
      console.error('Error fetching quality scores:', error)
    }
  }

  // Fetch indexing statuses for displayed products
  const fetchIndexingStatuses = async (productIds: string[]) => {
    if (productIds.length === 0) return
    
    setIsLoadingIndexStatus(true)
    try {
      const response = await fetch('/api/search-console/indexing-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        const newStatuses = new Map<string, IndexingStatus>(indexingStatuses)
        for (const status of data.statuses || []) {
          newStatuses.set(status.product_id, status)
        }
        setIndexingStatuses(newStatuses)
      }
    } catch (error) {
      console.error('Error fetching indexing statuses:', error)
    } finally {
      setIsLoadingIndexStatus(false)
    }
  }

  // Fetch main images for displayed products
  const fetchProductImages = async (productIds: string[]) => {
    if (productIds.length === 0) return
    
    try {
      // Fetch main images in batch
      const response = await fetch('/api/products/main-images-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        const imagesMap = new Map<string, string>(productImages)
        for (const item of data.images || []) {
          if (item.product_id && item.image_url) {
            imagesMap.set(item.product_id, item.image_url)
          }
        }
        setProductImages(imagesMap)
      }
    } catch (error) {
      console.error('Error fetching product images:', error)
    }
  }

  // Handle Search Console refresh for selected products
  const handleSearchConsoleRefresh = async () => {
    if (selectedIds.size === 0) return
    
    setIsSyncingSearchConsole(true)
    setSyncError(null)
    setSyncSuccess(null)
    setSyncProgress({ current: 0, total: selectedIds.size })

    try {
      // Process in batches of 10
      const productIdsArray = Array.from(selectedIds)
      const batchSize = 10
      let processedCount = 0

      for (let i = 0; i < productIdsArray.length; i += batchSize) {
        const batch = productIdsArray.slice(i, i + batchSize)
        
        const response = await fetch('/api/search-console/batch-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: batch, days: 30 })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to sync Search Console data')
        }

        const data = await response.json()
        processedCount += batch.length
        setSyncProgress({ current: processedCount, total: selectedIds.size })

        // Update indexing statuses from results
        const newStatuses = new Map<string, IndexingStatus>(indexingStatuses)
        for (const result of data.results || []) {
          if (result.success && result.isIndexed !== undefined) {
            const existing = newStatuses.get(result.productId)
            newStatuses.set(result.productId, {
              product_id: result.productId,
              is_indexed: result.isIndexed,
              last_checked: new Date().toISOString(),
              coverage_state: existing?.coverage_state || null
            })
          }
        }
        setIndexingStatuses(newStatuses)

        // Add delay between batches to avoid rate limiting
        if (i + batchSize < productIdsArray.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      setSyncSuccess(`${selectedIds.size} termék Search Console adatai frissítve`)
      // Refresh indexing statuses after sync
      await fetchIndexingStatuses(productIdsArray)
    } catch (error) {
      console.error('Error syncing Search Console:', error)
      setSyncError(error instanceof Error ? error.message : 'Hiba történt a szinkronizálás során')
    } finally {
      setIsSyncingSearchConsole(false)
      setSyncProgress({ current: 0, total: 0 })
    }
  }

  const handleBulkSyncFromShopRenter = async () => {
    if (selectedIds.size === 0) return
    
    setIsSyncingFromShopRenter(true)
    setShopRenterSyncProgress({ current: 0, total: selectedIds.size })
    setSyncError(null)
    setSyncSuccess(null)

    try {
      const productIdsArray = Array.from(selectedIds)
      
      // Start sync and get progress key
      const response = await fetch('/api/products/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: productIdsArray })
      })

      const result = await response.json()

      if (!result.success || !result.progressKey) {
        setSyncError(result.error || 'Hiba a szinkronizálás indításakor')
        setIsSyncingFromShopRenter(false)
        return
      }

      const progressKey = result.progressKey
      setShopRenterSyncProgress({ current: 0, total: result.total || selectedIds.size })

      // Clear any existing interval
      if (syncFromShopRenterIntervalRef.current) {
        clearInterval(syncFromShopRenterIntervalRef.current)
      }

      // Poll for progress
      syncFromShopRenterIntervalRef.current = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/products/bulk-sync-progress?key=${encodeURIComponent(progressKey)}`)
          if (progressResponse.ok) {
            const progressData = await progressResponse.json()
            if (progressData.success && progressData.progress) {
              const { current, total, synced, errors, status } = progressData.progress
              setShopRenterSyncProgress({ current, total })

              // Check if completed
              if (status === 'completed' || status === 'error' || status === 'stopped') {
                if (syncFromShopRenterIntervalRef.current) {
                  clearInterval(syncFromShopRenterIntervalRef.current)
                  syncFromShopRenterIntervalRef.current = null
                }
                setIsSyncingFromShopRenter(false)
                
                if (status === 'completed') {
                  setSyncSuccess(`${synced} termék szinkronizálva ShopRenter-ből (${errors} hiba)`)
                  // Refresh the page to show updated data
                  setTimeout(() => {
                    window.location.reload()
                  }, 2000)
                } else if (status === 'error') {
                  setSyncError(`Hiba történt: ${errors} termék sikertelen`)
                }
              }
            }
          }
        } catch (pollError) {
          console.error('Error polling progress:', pollError)
        }
      }, 1000) // Poll every second
    } catch (error) {
      console.error('Error syncing products from ShopRenter:', error)
      setSyncError('Hiba a termékek szinkronizálásakor')
      setIsSyncingFromShopRenter(false)
    }
  }

  const handleBulkSyncToShopRenter = async () => {
    if (selectedIds.size === 0) return
    
    setIsSyncingToShopRenter(true)
    setShopRenterSyncToProgress({ current: 0, total: selectedIds.size })
    setSyncError(null)
    setSyncSuccess(null)

    try {
      const productIdsArray = Array.from(selectedIds)
      
      // Start sync and get progress key
      const response = await fetch('/api/products/bulk-sync-to-shoprenter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: productIdsArray })
      })

      const result = await response.json()

      if (!result.success || !result.progressKey) {
        setSyncError(result.error || 'Hiba a szinkronizálás indításakor')
        setIsSyncingToShopRenter(false)
        return
      }

      const progressKey = result.progressKey
      setShopRenterSyncToProgress({ current: 0, total: result.total || selectedIds.size })

      // Clear any existing interval
      if (syncToShopRenterIntervalRef.current) {
        clearInterval(syncToShopRenterIntervalRef.current)
      }

      // Poll for progress
      syncToShopRenterIntervalRef.current = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/products/bulk-sync-progress?key=${encodeURIComponent(progressKey)}`)
          if (progressResponse.ok) {
            const progressData = await progressResponse.json()
            if (progressData.success && progressData.progress) {
              const { current, total, synced, errors, status } = progressData.progress
              setShopRenterSyncToProgress({ current, total })

              // Check if completed
              if (status === 'completed' || status === 'error' || status === 'stopped') {
                if (syncToShopRenterIntervalRef.current) {
                  clearInterval(syncToShopRenterIntervalRef.current)
                  syncToShopRenterIntervalRef.current = null
                }
                setIsSyncingToShopRenter(false)
                
                if (status === 'completed') {
                  setSyncSuccess(`${synced} termék szinkronizálva ShopRenter-be (${errors} hiba)`)
                } else if (status === 'error') {
                  setSyncError(`Hiba történt: ${errors} termék sikertelen`)
                }
              }
            }
          }
        } catch (pollError) {
          console.error('Error polling progress:', pollError)
        }
      }, 1000) // Poll every second
    } catch (error) {
      console.error('Error syncing products to ShopRenter:', error)
      setSyncError('Hiba a termékek szinkronizálásakor')
      setIsSyncingToShopRenter(false)
    }
  }

  const handleConfirmImageAltText = async () => {
    setImageAltTextDialogOpen(false)
    if (selectedIds.size === 0) return

    const productIdsArray = Array.from(selectedIds)
    
    if (imageAltTextDialogType === 'generate') {
      setIsGeneratingImageAltText(true)
      setImageAltTextProgress({ current: 0, total: productIdsArray.length })
      setSyncError(null)
      setSyncSuccess(null)

      try {
        const response = await fetch('/api/products/bulk-generate-image-alt-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: productIdsArray, onlyMissing: true })
        })

        const result = await response.json()

        if (result.success) {
          setSyncSuccess(`${result.results.success} kép alt szövege generálva (${result.results.failed} hiba)`)
          setImageAltTextProgress({ current: result.results.total, total: productIdsArray.length })
        } else {
          setSyncError(result.error || 'Hiba az alt szövegek generálásakor')
        }
      } catch (error) {
        console.error('Error generating image alt text:', error)
        setSyncError('Hiba az alt szövegek generálásakor')
      } finally {
        setIsGeneratingImageAltText(false)
      }
    } else if (imageAltTextDialogType === 'sync') {
      setIsSyncingImageAltText(true)
      setImageAltTextProgress({ current: 0, total: productIdsArray.length })
      setSyncError(null)
      setSyncSuccess(null)

      try {
        const response = await fetch('/api/products/bulk-sync-image-alt-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: productIdsArray })
        })

        const result = await response.json()

        if (result.success) {
          setSyncSuccess(`${result.results.success} kép alt szövege szinkronizálva (${result.results.failed} hiba)`)
          setImageAltTextProgress({ current: result.results.total, total: productIdsArray.length })
        } else {
          setSyncError(result.error || 'Hiba az alt szövegek szinkronizálásakor')
        }
      } catch (error) {
        console.error('Error syncing image alt text:', error)
        setSyncError('Hiba az alt szövegek szinkronizálásakor')
      } finally {
        setIsSyncingImageAltText(false)
      }
    }
  }


  const handleConfirmUrlOptimization = async () => {
    setUrlOptimizationDialogOpen(false) // Close confirmation dialog
    if (selectedIds.size === 0) return
    
    setIsOptimizingUrls(true)
    setUrlOptimizationResults(null) // Clear any previous results
    setUrlOptimizationProgress({ current: 0, total: selectedIds.size })
    setSyncError(null) // Clear any previous errors
    setSyncSuccess(null) // Clear any previous success messages

    try {
      const productIdsArray = Array.from(selectedIds)
      
      // Generate slugs
      const response = await fetch('/api/products/bulk-url-alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: productIdsArray })
      })

      const result = await response.json()

      if (result.success && result.results) {
        setUrlOptimizationResults(result.results)
        setUrlOptimizationProgress({ current: result.results.length, total: selectedIds.size })
        setIsOptimizingUrls(false) // Stop spinner so results dialog can open
        // Results dialog will open automatically when urlOptimizationResults !== null && !isOptimizingUrls
      } else {
        setSyncError(result.error || 'Hiba az URL optimalizálás során')
        setIsOptimizingUrls(false)
        setUrlOptimizationResults(null) // Ensure results are null on error
      }
    } catch (error) {
      console.error('Error optimizing URLs:', error)
      setSyncError(error instanceof Error ? error.message : 'Hiba történt az URL optimalizálás során')
      setIsOptimizingUrls(false)
      setUrlOptimizationResults(null) // Ensure results are null on error
    }
  }

  const handleApplyUrlOptimizations = async () => {
    if (!urlOptimizationResults) return

    setIsOptimizingUrls(true)
    setSyncError(null)
    setSyncSuccess(null)
    const successful = urlOptimizationResults.filter(r => r.success)
    let appliedCount = 0
    let failedCount = 0
    const failedProducts: Array<{ productId: string; error: string }> = []

    // Process in parallel batches of 5 to avoid overwhelming the API
    const BATCH_SIZE = 5
    for (let i = 0; i < successful.length; i += BATCH_SIZE) {
      const batch = successful.slice(i, i + BATCH_SIZE)
      
      const batchPromises = batch.map(async (result) => {
        try {
          const response = await fetch(`/api/products/${result.productId}/url-alias`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urlSlug: result.suggestedSlug })
          })

          if (response.ok) {
            appliedCount++
            return { success: true, productId: result.productId }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }))
            failedCount++
            failedProducts.push({ 
              productId: result.productId, 
              error: errorData.error || `HTTP ${response.status}` 
            })
            return { success: false, productId: result.productId, error: errorData.error }
          }
        } catch (error) {
          console.error(`Error applying URL for product ${result.productId}:`, error)
          failedCount++
          failedProducts.push({ 
            productId: result.productId, 
            error: error instanceof Error ? error.message : 'Hálózati hiba' 
          })
          return { success: false, productId: result.productId, error: 'Hálózati hiba' }
        }
      })

      await Promise.all(batchPromises)
      setUrlOptimizationProgress({ current: Math.min(i + BATCH_SIZE, successful.length), total: successful.length })
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < successful.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Update results with application status
    const updatedResults = urlOptimizationResults.map(result => {
      if (result.success) {
        const failed = failedProducts.find(f => f.productId === result.productId)
        return {
          ...result,
          applied: !failed,
          applyError: failed?.error
        }
      }
      return result
    })
    setUrlOptimizationResults(updatedResults as any)

    if (failedCount > 0) {
      setSyncError(`${appliedCount} termék sikeres, ${failedCount} sikertelen. Részletek az eredmények táblázatban.`)
    } else {
      setSyncSuccess(`${appliedCount} termék URL-je sikeresen frissítve`)
    }
    
    setIsOptimizingUrls(false)
    // Don't close results dialog - let user see the updated status
    // Refresh after a delay to update the product list without closing dialog
    setTimeout(() => {
      router.refresh()
    }, 2000)
  }

  // Handle bulk quality score calculation
  const handleBulkCalculateQualityScores = async () => {
    if (selectedIds.size === 0) return
    
    setQualityScoreDialogOpen(true)
    setIsCalculatingQualityScores(true)
    setQualityScoreProgress({ current: 0, total: selectedIds.size })
    
    try {
      const productIdsArray = Array.from(selectedIds)
      
      // Process in batches of 10
      const batchSize = 10
      let processedCount = 0
      
      for (let i = 0; i < productIdsArray.length; i += batchSize) {
        const batch = productIdsArray.slice(i, i + batchSize)
        
        const response = await fetch('/api/products/bulk-calculate-quality-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: batch })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to calculate quality scores')
        }
        
        const data = await response.json()
        processedCount += data.success || 0
        setQualityScoreProgress({ current: processedCount, total: selectedIds.size })
        
        // Update quality scores in state
        const newScores = new Map<string, any>(qualityScores)
        for (const productId of batch) {
          // Fetch updated score
          try {
            const scoreResponse = await fetch(`/api/products/${productId}/quality-score`)
            if (scoreResponse.ok) {
              const scoreData = await scoreResponse.json()
              if (scoreData.success && scoreData.score) {
                newScores.set(productId, scoreData.score)
              }
            }
          } catch (error) {
            console.error(`Error fetching updated score for ${productId}:`, error)
          }
        }
        setQualityScores(newScores)
        
        // Small delay between batches
        if (i + batchSize < productIdsArray.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      toast.success(`${processedCount} termék minőségi pontszáma sikeresen kiszámolva`)
    } catch (error) {
      console.error('Error calculating quality scores:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a minőségi pontszámok számítása során')
    } finally {
      setIsCalculatingQualityScores(false)
      setQualityScoreDialogOpen(false)
    }
  }

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    // Clear search results immediately when input is cleared
    if (!value || value.trim().length === 0) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
      setHasSearched(false) // Reset flag when clearing
    }
  }

  // Handle search input key press (Enter to search)
  const handleSearchKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const trimmedTerm = searchTerm.trim()
      // Only search if term is at least 2 characters (matching API requirement)
      if (trimmedTerm.length >= 2) {
        performSearch(trimmedTerm)
      } else if (trimmedTerm.length === 0) {
        // Clear search results when input is empty and Enter is pressed
        setSearchResults([])
        setSearchTotalCount(0)
        setSearchTotalPages(0)
        setHasSearched(false) // Reset flag when clearing
      }
    }
  }

  // Handle page change - fetch from API route
  const handlePageChange = async (_event: React.ChangeEvent<unknown>, newPage: number) => {
    setIsLoading(true)
    setPage(newPage)
    
    try {
      const response = await fetch(`/api/products/paginated?page=${newPage}&limit=${currentPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
      } else {
        console.error('Failed to fetch products')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle limit change - fetch from API route
  const handleLimitChange = async (event: any) => {
    const newPageSize = Number(event.target.value)
    setIsLoading(true)
    setCurrentPageSize(newPageSize)
    setPage(1) // Reset to first page when changing page size
    
    try {
      const response = await fetch(`/api/products/paginated?page=1&limit=${newPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
        setPage(1)
      } else {
        console.error('Failed to fetch products')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Use search results only if a search has been performed, otherwise use regular products
  const displayProducts = hasSearched ? searchResults : products
  const displayTotalCount = hasSearched ? searchTotalCount : totalCount
  const displayTotalPages = hasSearched ? searchTotalPages : totalPages
  const displayCurrentPage = hasSearched ? 1 : page

  // Fetch quality scores when products change
  useEffect(() => {
    if (displayProducts.length > 0) {
      const productIds = displayProducts.map(p => p.id)
      fetchQualityScores(productIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProducts.length, displayProducts.map(p => p.id).join(',')])

  // Identify parent products (products that have children)
  useEffect(() => {
    const parentIds = new Set<string>()
    displayProducts.forEach(product => {
      // Check if any other product has this product as parent
      const hasChildren = displayProducts.some(p => p.parent_product_id === product.id)
      if (hasChildren) {
        parentIds.add(product.id)
      }
    })
    setParentProductIds(parentIds)
  }, [displayProducts])

  // Fetch indexing status when products change
  useEffect(() => {
    const productIds = displayProducts.map(p => p.id)
    if (productIds.length > 0) {
      fetchIndexingStatuses(productIds)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProducts.map(p => p.id).join(',')])

  // Fetch main images when products change
  useEffect(() => {
    const productIds = displayProducts.map(p => p.id)
    if (productIds.length > 0) {
      fetchProductImages(productIds)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProducts.map(p => p.id).join(',')])

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(displayProducts.map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedIds(newSelected)
  }

  const isAllSelected = displayProducts.length > 0 && selectedIds.size === displayProducts.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < displayProducts.length

  // Get status chip
  const getStatusChip = (product: ShopRenterProduct) => {
    if (product.status === 1) {
      return (
        <Chip 
          label="Aktív" 
          size="small" 
          color="success"
          icon={<CheckCircleIcon />}
        />
      )
    }
    return (
      <Chip 
        label="Inaktív" 
        size="small" 
        color="error"
        icon={<CancelIcon />}
      />
    )
  }

  // Get sync status chip
  const getSyncStatusChip = (product: ShopRenterProduct) => {
    if (product.sync_status === 'synced') {
      return (
        <Chip 
          label="Szinkronizálva" 
          size="small" 
          color="success"
        />
      )
    }
    if (product.sync_status === 'error') {
      return (
        <Chip 
          label="Hiba" 
          size="small" 
          color="error"
        />
      )
    }
    return (
      <Chip 
        label="Függőben" 
        size="small" 
        color="warning"
      />
    )
  }

  // Get variant indicator chip
  const getVariantChip = (product: ShopRenterProduct) => {
    // Priority 1: Show "Szülő" for parent products (has children)
    // A product that has children is a parent, even if it also has parent_product_id set incorrectly
    if (parentProductIds.has(product.id)) {
      return (
        <Tooltip title="Ez egy szülő termék - van változatai">
          <Chip 
            icon={<ArrowDownwardIcon />}
            label="Szülő" 
            size="small" 
            color="primary"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: '20px' }}
          />
        </Tooltip>
      )
    }
    
    // Priority 2: Show "Változat" only for child products (has parent_product_id but no children)
    // Only show if it's not also a parent
    if (product.parent_product_id && !parentProductIds.has(product.id)) {
      return (
        <Tooltip title="Ez egy változat termék - van szülő terméke">
          <Chip 
            icon={<ArrowUpwardIcon />}
            label="Változat" 
            size="small" 
            color="info"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: '20px' }}
          />
        </Tooltip>
      )
    }
    
    // Regular product - no chip
    return null
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('hu-HU', { 
      style: 'currency', 
      currency: 'HUF',
      maximumFractionDigits: 0
    }).format(price)
  }

  // Get indexing status icon
  const getIndexingStatusIcon = (productId: string) => {
    const status = indexingStatuses.get(productId)
    
    if (!status) {
      return (
        <Tooltip title="Nincs adat - kattints a Search Console frissítésre">
          <HelpOutlineIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Tooltip>
      )
    }

    if (status.is_indexed) {
      return (
        <Tooltip title={`Indexelve\n${status.last_checked ? `Ellenőrizve: ${new Date(status.last_checked).toLocaleDateString('hu-HU')}` : ''}`}>
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
        </Tooltip>
      )
    }

    return (
      <Tooltip title={`Nincs indexelve\n${status.coverage_state || ''}\n${status.last_checked ? `Ellenőrizve: ${new Date(status.last_checked).toLocaleDateString('hu-HU')}` : ''}`}>
        <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} />
      </Tooltip>
    )
  }

  // Handle product click - navigate to edit page
  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  // Handle bulk delete button click - open confirmation dialog
  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return

    // Get selected products
    const selectedProducts = displayProducts.filter(p => selectedIds.has(p.id))
    
    // Check which products have children
    let totalChildCount = 0
    const productsWithChildren = selectedProducts.filter(p => {
      const hasChildren = parentProductIds.has(p.id)
      if (hasChildren) {
        const childCount = displayProducts.filter(child => child.parent_product_id === p.id).length
        totalChildCount += childCount
        return true
      }
      return false
    })

    setProductToDelete({
      id: '', // Not used for bulk delete
      sku: `${selectedProducts.length} termék`,
      name: `${selectedProducts.length} termék`,
      hasChildren: productsWithChildren.length > 0,
      childCount: totalChildCount
    })
    setDeleteDialogOpen(true)
  }

  // Handle delete confirmation (bulk delete)
  const handleConfirmDelete = async () => {
    if (selectedIds.size === 0) return

    setIsDeleting(true)
    try {
      const selectedProductIds = Array.from(selectedIds)
      let successCount = 0
      let errorCount = 0
      let totalDisabledChildren = 0

      // Delete each product sequentially
      for (const productId of selectedProductIds) {
        try {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
          })

          const data = await response.json()

          if (!response.ok) {
            console.error(`Failed to delete product ${productId}:`, data.error)
            errorCount++
            continue
          }

          successCount++
          
          // Count disabled children
          if (data.disabledChildren && data.disabledChildren.length > 0) {
            totalDisabledChildren += data.disabledChildren.length
          }

          // Remove product from local state
          setProducts(prev => prev.filter(p => p.id !== productId))
          setSearchResults(prev => prev.filter(p => p.id !== productId))
        } catch (error) {
          console.error(`Error deleting product ${productId}:`, error)
          errorCount++
        }
      }

      // Clear selection
      setSelectedIds(new Set())

      // Show result message
      if (successCount > 0) {
        const message = totalDisabledChildren > 0
          ? `${successCount} termék törölve. ${totalDisabledChildren} variáns is letiltva.`
          : `${successCount} termék törölve.`
        toast.success(message)
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} termék törlése sikertelen`)
      }

      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (error) {
      console.error('Error in bulk delete:', error)
      toast.error('Hiba a termékek törlésekor')
    } finally {
      setIsDeleting(false)
    }
  }


  // Handle image click - open modal (stops propagation to prevent row click)
  const handleImageClick = (e: React.MouseEvent, imageUrl: string, productName: string) => {
    e.stopPropagation() // Prevent row click navigation
    setSelectedImageUrl(imageUrl)
    setSelectedImageAlt(productName)
    setImageModalOpen(true)
  }

  // Handle export button click - reset to all fields checked by default
  const handleExportClick = () => {
    // Reset to all fields checked by default
    setExportFields(new Set([
      'sku',
      'model_number',
      'gtin',
      'name',
      'cost',
      'multiplier',
      'price',
      'gross_price',
      'status'
    ]))
    setExportDialogOpen(true)
  }

  // Handle export field toggle
  const handleExportFieldToggle = (field: string) => {
    // SKU cannot be deselected
    if (field === 'sku') return
    
    const newFields = new Set(exportFields)
    if (newFields.has(field)) {
      newFields.delete(field)
    } else {
      newFields.add(field)
    }
    setExportFields(newFields)
  }

  // Handle export confirmation
  const handleExportConfirm = async () => {
    if (exportFields.size === 0) {
      toast.error('Válasszon ki legalább egy mezőt az exportáláshoz')
      return
    }

    setIsExporting(true)
    setExportDialogOpen(false)

    try {
      // Determine which products to export
      const productIdsToExport = selectedIds.size > 0 ? Array.from(selectedIds) : null

      const response = await fetch('/api/products/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: productIdsToExport,
          fields: Array.from(exportFields)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'termekek_export.xlsx'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      const productCount = productIdsToExport ? productIdsToExport.length : displayTotalCount
      toast.success(`${productCount} termék exportálva (${exportFields.size} mező)`)
    } catch (error) {
      console.error('Error exporting products:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt az exportálás során')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Box>
      {/* Action buttons - above search bar */}
      <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Button
          variant="contained"
          size="medium"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => router.push('/products/new')}
          sx={{
            fontWeight: 600,
            px: 3,
            boxShadow: 2,
            textTransform: 'uppercase',
            '&:hover': {
              boxShadow: 4
            }
          }}
        >
          + ÚJ TERMÉK
        </Button>
        <Button
          variant="outlined"
          size="medium"
          color="primary"
          startIcon={isExporting ? <CircularProgress size={18} color="inherit" /> : <FileDownloadIcon />}
          onClick={handleExportClick}
          disabled={isExporting}
          sx={{
            fontWeight: 600,
            px: 3
          }}
        >
          {isExporting 
            ? 'Exportálás...' 
            : selectedIds.size > 0 
              ? `Excel exportálás (${selectedIds.size} termék)`
              : 'Excel exportálás'}
        </Button>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        size="small"
        placeholder="Keresés név, SKU, gyártói cikkszám vagy GTIN alapján..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        onKeyPress={handleSearchKeyPress}
        disabled={isSearching || isLoading}
        sx={{ mb: 1.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {isSearching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
            </InputAdornment>
          ),
        }}
      />

      {/* Selected count indicator and actions */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
            {selectedIds.size} termék kiválasztva
          </Typography>
          <Button
            variant="contained"
            size="medium"
            color="error"
            startIcon={isDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
            onClick={handleBulkDeleteClick}
            disabled={isDeleting}
            sx={{
              fontWeight: 600,
              px: 3,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            {isDeleting ? 'Törlés...' : `Törlés (${selectedIds.size})`}
          </Button>
          <Button
            variant="contained"
            size="medium"
            color="primary"
            startIcon={isSyncingFromShopRenter ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
            onClick={handleBulkSyncFromShopRenter}
            disabled={isSyncingFromShopRenter || isSyncingToShopRenter || selectedIds.size === 0}
            sx={{
              fontWeight: 600,
              px: 3,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            {isSyncingFromShopRenter 
              ? `ShopRenter-ből: ${shopRenterSyncProgress.current}/${shopRenterSyncProgress.total}` 
              : `ShopRenter-ből szinkronizálás (${selectedIds.size})`}
          </Button>
          <Button
            variant="contained"
            size="medium"
            color="success"
            startIcon={isSyncingToShopRenter ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
            onClick={handleBulkSyncToShopRenter}
            disabled={isSyncingFromShopRenter || isSyncingToShopRenter || selectedIds.size === 0}
            sx={{
              fontWeight: 600,
              px: 3,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            {isSyncingToShopRenter 
              ? `ShopRenter-be: ${shopRenterSyncToProgress.current}/${shopRenterSyncToProgress.total}` 
              : `ShopRenter-be szinkronizálás (${selectedIds.size})`}
          </Button>
        </Box>
      )}

      {/* Image alt text progress bar */}
      {(isGeneratingImageAltText || isSyncingImageAltText) && (
        <LinearProgress 
          variant="determinate" 
          value={imageAltTextProgress.total > 0 ? (imageAltTextProgress.current / imageAltTextProgress.total) * 100 : 0}
          sx={{ mb: 2 }}
        />
      )}

      {/* ShopRenter sync progress bars */}
      {isSyncingFromShopRenter && (
        <LinearProgress 
          variant="determinate" 
          value={shopRenterSyncProgress.total > 0 ? (shopRenterSyncProgress.current / shopRenterSyncProgress.total) * 100 : 0}
          sx={{ mb: 2 }}
        />
      )}
      {isSyncingToShopRenter && (
        <LinearProgress 
          variant="determinate" 
          value={shopRenterSyncToProgress.total > 0 ? (shopRenterSyncToProgress.current / shopRenterSyncToProgress.total) * 100 : 0}
          sx={{ mb: 2 }}
        />
      )}

      {/* Success/Error alerts */}
      {syncSuccess && (
        <Alert severity="success" onClose={() => setSyncSuccess(null)} sx={{ mb: 2 }}>
          {syncSuccess}
        </Alert>
      )}
      {syncError && (
        <Alert severity="error" onClose={() => setSyncError(null)} sx={{ mb: 2 }}>
          {syncError}
        </Alert>
      )}

      {/* Products Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          mt: 2,
          '& .MuiTable-root': {
            '& .MuiTableCell-root': {
              borderColor: 'divider',
              py: 1
            }
          }
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 40 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={displayProducts.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1, width: 60 }} align="center">
                Kép
              </TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1 }}>Gyártói cikkszám</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1 }} align="right">Nettó ár</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1 }} align="center" width={100}>
                <Tooltip title="Termék kapcsolatok">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    Kapcsolat
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {isLoading || isSearching ? 'Betöltés...' : (hasSearched ? 'Nincs találat' : 'Nincsenek termékek')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayProducts.map((product) => {
                const mainImageUrl = productImages.get(product.id)
                return (
                  <TableRow
                    key={product.id}
                    hover
                    selected={selectedIds.has(product.id)}
                    sx={{ 
                      cursor: 'pointer',
                      '& td': { py: 1, fontSize: '0.875rem' }
                    }}
                    onClick={() => handleProductClick(product.id)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40 }}>
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onChange={(e) => handleSelectOne(product.id, e)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()} sx={{ width: 60 }}>
                      {mainImageUrl ? (
                        <Box
                          component="img"
                          src={mainImageUrl}
                          alt={product.name || product.sku}
                          loading="lazy"
                          onClick={(e) => handleImageClick(e, mainImageUrl, product.name || product.sku)}
                          sx={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 1,
                            bgcolor: 'grey.200',
                            display: 'block',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, opacity 0.2s',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              opacity: 0.9
                            }
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                            if (placeholder) placeholder.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      {!mainImageUrl && (
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            bgcolor: 'grey.200',
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <ImageIcon sx={{ color: 'grey.400', fontSize: 20 }} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                        {product.sku}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        {product.model_number || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {product.name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                        {formatPrice(product.price)}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(product)}</TableCell>
                    <TableCell align="center">
                      {getVariantChip(product)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Termék törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" component="div" sx={{ mb: 2 }}>
              Biztosan törölni szeretné a kiválasztott {selectedIds.size} terméket?
            </Typography>
            {productToDelete?.hasChildren && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600} component="div">
                  Figyelem: A kiválasztott termékek közül {productToDelete.childCount} variáns is törlésre kerül.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }} component="div">
                  A törlés során az összes variáns is törlésre kerül és letiltásra kerül ShopRenter-ben.
                </Typography>
              </Alert>
            )}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2" component="div">
                A termékek törlése után letiltásra kerülnek ShopRenter-ben (status = 0), de a művelet visszavonható.
              </Typography>
            </Alert>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
            color="inherit"
          >
            Mégse
          </Button>
          <Button
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            color="error"
            variant="contained"
            startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pagination Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {hasSearched 
              ? `Keresési eredmény: ${displayTotalCount} termék` 
              : `Összesen ${displayTotalCount} termék`
            }
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Oldal mérete</InputLabel>
            <Select
              value={currentPageSize}
              onChange={handleLimitChange}
              label="Oldal mérete"
              disabled={isLoading || isSearching}
            >
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={200}>200</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        {displayTotalPages > 1 && (
          <Pagination
            count={displayTotalPages}
            page={displayCurrentPage}
            onChange={handlePageChange}
            color="primary"
            disabled={isLoading || isSearching}
            showFirstButton
            showLastButton
          />
        )}
      </Box>

      {/* URL Optimization Confirmation Dialog */}
      <Dialog
        open={urlOptimizationDialogOpen}
        onClose={() => setUrlOptimizationDialogOpen(false)}
      >
        <DialogTitle>SEO URL Optimalizálás</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedIds.size} termék URL-je lesz AI által optimalizálva.
            Ez több percig is eltarthat.
            <br /><br />
            Folytatod?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUrlOptimizationDialogOpen(false)}>
            Mégse
          </Button>
          <Button onClick={handleConfirmUrlOptimization} variant="contained" autoFocus>
            Optimalizálás indítása
          </Button>
        </DialogActions>
      </Dialog>

      {/* URL Optimization Results Dialog */}
      <Dialog
        open={urlOptimizationResults !== null && !isOptimizingUrls && !urlOptimizationDialogOpen}
        onClose={() => {
          setUrlOptimizationResults(null)
          setUrlOptimizationDialogOpen(false) // Ensure confirmation dialog stays closed
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>SEO URL Optimalizálás - Eredmények</DialogTitle>
        <DialogContent>
          {urlOptimizationResults && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {urlOptimizationResults.filter(r => r.success).length} termékhez generáltunk új URL slug-ot.
                  Áttekintheted a változtatásokat, majd alkalmazhatod őket.
                </Typography>
              </Alert>
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Termék</TableCell>
                      <TableCell>Jelenlegi URL</TableCell>
                      <TableCell>Új URL</TableCell>
                      <TableCell>Státusz</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {urlOptimizationResults.filter(r => r.success).map((result) => {
                      const product = products.find(p => p.id === result.productId)
                      // Use currentSlug from result if available, otherwise fall back to product data
                      const currentSlug = result.currentSlug !== undefined ? result.currentSlug : (product?.url_slug || null)
                      // Display: model_number (gyártói cikkszám) from product, otherwise SKU, otherwise product ID
                      const displayName = product?.model_number || product?.sku || result.productId
                      return (
                        <TableRow key={result.productId}>
                          <TableCell>{displayName}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {currentSlug || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'primary.main' }}>
                              {result.suggestedSlug}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {(result as any).applied === undefined ? (
                              <Chip label="Kész" color="success" size="small" />
                            ) : (result as any).applied ? (
                              <Chip label="Alkalmazva" color="success" size="small" icon={<CheckCircleIcon />} />
                            ) : (
                              <Tooltip title={(result as any).applyError || 'Ismeretlen hiba'}>
                                <Chip label="Sikertelen" color="error" size="small" icon={<CancelIcon />} />
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUrlOptimizationResults(null)}>
            Bezárás
          </Button>
          <Button onClick={handleApplyUrlOptimizations} variant="contained" autoFocus>
            Alkalmazás ({urlOptimizationResults?.filter(r => r.success).length || 0} termék)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Alt Text Dialog */}
      <Dialog
        open={imageAltTextDialogOpen}
        onClose={() => setImageAltTextDialogOpen(false)}
      >
        <DialogTitle>
          {imageAltTextDialogType === 'generate' ? 'Kép Alt Szöveg Generálás' : 'Kép Alt Szöveg Szinkronizálás'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {imageAltTextDialogType === 'generate' 
              ? `${selectedIds.size} termék képeihez generálja az alt szövegeket? Ez több percig is eltarthat.`
              : `${selectedIds.size} termék képeinek alt szövegét szinkronizálja a ShopRenter-be?`
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageAltTextDialogOpen(false)}>
            Mégse
          </Button>
          <Button onClick={handleConfirmImageAltText} variant="contained" autoFocus>
            {imageAltTextDialogType === 'generate' ? 'Generálás' : 'Szinkronizálás'}
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
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            boxShadow: 'none',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '70vh',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <IconButton
            onClick={() => setImageModalOpen(false)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              },
              zIndex: 1
            }}
          >
            <CloseIcon />
          </IconButton>
          {selectedImageUrl && (
            <Box
              component="img"
              src={selectedImageUrl}
              alt={selectedImageAlt}
              loading="eager"
              sx={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: 1
              }}
              onError={(e) => {
                console.error('Error loading full image:', selectedImageUrl)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog 
        open={exportDialogOpen} 
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Excel exportálás
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Válassza ki, mely mezőket szeretne exportálni. {selectedIds.size > 0 
              ? `${selectedIds.size} kiválasztott termék` 
              : 'Összes termék'} lesz exportálva.
          </DialogContentText>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* SKU - always required, disabled */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={true}
                disabled
                size="small"
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }}>
                  SKU
                </Typography>
                <Chip label="Kötelező" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
            </Box>

            {/* Other fields */}
            {[
              { field: 'model_number', label: 'Gyártói cikkszám' },
              { field: 'gtin', label: 'Vonalkód' },
              { field: 'name', label: 'Termék neve' },
              { field: 'cost', label: 'Beszerzési ár' },
              { field: 'multiplier', label: 'Árazási szorzó' },
              { field: 'price', label: 'Nettó ár' },
              { field: 'gross_price', label: 'Bruttó ár' },
              { field: 'status', label: 'Aktív' }
            ].map(({ field, label }) => (
              <Box key={field} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  checked={exportFields.has(field)}
                  onChange={() => handleExportFieldToggle(field)}
                  size="small"
                />
                <Typography variant="body2">
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            Mégse
          </Button>
          <Button 
            onClick={handleExportConfirm} 
            variant="contained" 
            disabled={exportFields.size === 0}
            startIcon={<FileDownloadIcon />}
          >
            Exportálás
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}
