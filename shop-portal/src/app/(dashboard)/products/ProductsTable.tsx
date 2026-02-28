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
  Assessment as AssessmentIcon
} from '@mui/icons-material'
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

  // Search function - can be called manually or via debounce
  const performSearch = useCallback(async (term: string) => {
    if (!term || term.length < 3) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
      return
    }

    setIsSearching(true)
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

  // Search effect - fetch from API route with optimized debounce
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 3) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSearchTotalPages(0)
      return
    }

    // Optimized debounce delay (500ms) - faster response, minimum 3 characters
    const searchTimeout = setTimeout(() => {
      performSearch(searchTerm)
    }, 500)

    return () => clearTimeout(searchTimeout)
  }, [searchTerm, performSearch])

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
  }

  // Handle search input key press (Enter to search immediately)
  const handleSearchKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      // Clear any pending debounced search
      // The performSearch will be called immediately
      if (searchTerm && searchTerm.length >= 2) {
        performSearch(searchTerm)
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

  // Use search results if searching, otherwise use regular products
  const displayProducts = searchTerm && searchTerm.length >= 2 ? searchResults : products
  const displayTotalCount = searchTerm && searchTerm.length >= 2 ? searchTotalCount : totalCount
  const displayTotalPages = searchTerm && searchTerm.length >= 2 ? searchTotalPages : totalPages
  const displayCurrentPage = searchTerm && searchTerm.length >= 2 ? 1 : page

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

  return (
    <Box>
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Keresés név, SKU, gyártói cikkszám vagy GTIN alapján... (minimum 3 karakter)"
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        onKeyPress={handleSearchKeyPress}
        disabled={isSearching || isLoading}
        sx={{ mt: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {isSearching ? <CircularProgress size={20} /> : <SearchIcon />}
            </InputAdornment>
          ),
        }}
      />

      {/* Selected count indicator and actions */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="primary">
            {selectedIds.size} termék kiválasztva
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={isSyncingSearchConsole ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={handleSearchConsoleRefresh}
            disabled={isSyncingSearchConsole || selectedIds.size === 0}
          >
            {isSyncingSearchConsole 
              ? `Search Console frissítése (${syncProgress.current}/${syncProgress.total})...` 
              : 'Search Console frissítése'}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="warning"
            startIcon={isCalculatingQualityScores ? <CircularProgress size={16} color="inherit" /> : <AssessmentIcon />}
            onClick={handleBulkCalculateQualityScores}
            disabled={isCalculatingQualityScores || selectedIds.size === 0}
          >
            {isCalculatingQualityScores 
              ? `Minőségi pontszám számítás (${qualityScoreProgress.current}/${qualityScoreProgress.total})...` 
              : 'Minőségi pontszám számítás'}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="primary"
            startIcon={isSyncingFromShopRenter ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={handleBulkSyncFromShopRenter}
            disabled={isSyncingFromShopRenter || isSyncingToShopRenter || selectedIds.size === 0}
          >
            {isSyncingFromShopRenter 
              ? `ShopRenter-ből: ${shopRenterSyncProgress.current}/${shopRenterSyncProgress.total}` 
              : `ShopRenter-ből szinkronizálás (${selectedIds.size})`}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="success"
            startIcon={isSyncingToShopRenter ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={handleBulkSyncToShopRenter}
            disabled={isSyncingFromShopRenter || isSyncingToShopRenter || selectedIds.size === 0}
          >
            {isSyncingToShopRenter 
              ? `ShopRenter-be: ${shopRenterSyncToProgress.current}/${shopRenterSyncToProgress.total}` 
              : `ShopRenter-be szinkronizálás (${selectedIds.size})`}
          </Button>
        </Box>
      )}

      {/* Sync progress bar */}
      {isSyncingSearchConsole && (
        <LinearProgress 
          variant="determinate" 
          value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}
          sx={{ mb: 2 }}
        />
      )}

      {/* Image alt text progress bar */}
      {(isGeneratingImageAltText || isSyncingImageAltText) && (
        <LinearProgress 
          variant="determinate" 
          value={imageAltTextProgress.total > 0 ? (imageAltTextProgress.current / imageAltTextProgress.total) * 100 : 0}
          sx={{ mb: 2 }}
        />
      )}

      {/* Quality score progress bar */}
      {isCalculatingQualityScores && (
        <LinearProgress 
          variant="determinate" 
          value={qualityScoreProgress.total > 0 ? (qualityScoreProgress.current / qualityScoreProgress.total) * 100 : 0}
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
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 50 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={displayProducts.length === 0}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Gyártói cikkszám</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Nettó ár</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center" width={100}>
                <Tooltip title="Termék kapcsolatok">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    Kapcsolat
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">
                <Tooltip title="Google Indexelés - A keresési eredményekben megjelenik-e">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    Indexelve
                    {isLoadingIndexStatus && <CircularProgress size={12} />}
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center" width={120}>
                <Tooltip title="Minőségi pontszám - SEO és adatminőség értékelése">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    Minőség
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {isLoading || isSearching ? 'Betöltés...' : (searchTerm && searchTerm.length >= 3 ? 'Nincs találat' : 'Nincsenek termékek')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayProducts.map((product) => (
                <TableRow
                  key={product.id}
                  hover
                  selected={selectedIds.has(product.id)}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleProductClick(product.id)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onChange={(e) => handleSelectOne(product.id, e)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {product.sku}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {product.model_number || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {product.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {formatPrice(product.price)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(product)}</TableCell>
                  <TableCell align="center">
                    {getVariantChip(product)}
                  </TableCell>
                  <TableCell align="center">
                    {getIndexingStatusIcon(product.id)}
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <ProductQualityScore 
                      score={qualityScores.get(product.id) || null} 
                      size="small"
                      compact
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
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
    </Box>
  )
}
