'use client'

import React, { useState, useTransition, useEffect, useRef } from 'react'
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
  Checkbox, 
  TextField, 
  InputAdornment, 
  Button, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Grid,
  Chip,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  AlertTitle,
  Menu,
  Divider
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Receipt as ReceiptIcon,
  History as HistoryIcon,
  Store as StoreIcon,
  Cloud as CloudIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Category as CategoryIcon,
  LocalOffer as LocalOfferIcon,
  MoreVert as MoreVertIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Payment as PaymentIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material'
import { LinearProgress } from '@mui/material'
import { toast } from 'react-toastify'
import { createConnectionAction, updateConnectionAction, deleteConnectionsAction } from './actions'
import type { WebshopConnection } from '@/lib/connections-server'

interface ConnectionsTableProps {
  initialConnections: WebshopConnection[]
}

export default function ConnectionsTable({ initialConnections }: ConnectionsTableProps) {
  const router = useRouter()
  const [connections] = useState<WebshopConnection[]>(initialConnections)
  const [selectedConnections, setSelectedConnections] = useState<string[]>([])
  const [newConnectionDialogOpen, setNewConnectionDialogOpen] = useState(false)
  const [editConnectionDialogOpen, setEditConnectionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncDialogConnection, setSyncDialogConnection] = useState<WebshopConnection | null>(null)
  const [vatMappingDialogOpen, setVatMappingDialogOpen] = useState(false)
  const [vatMappingConnection, setVatMappingConnection] = useState<WebshopConnection | null>(null)
  const [vatRates, setVatRates] = useState<Array<{ id: string; name: string; kulcs: number }>>([])
  const [shoprenterTaxClasses, setShoprenterTaxClasses] = useState<Array<{ id: string; name: string }>>([])
  const [mappings, setMappings] = useState<Array<{ vat_id: string; shoprenter_tax_class_id: string; shoprenter_tax_class_name: string | null }>>([])
  const [loadingVatMapping, setLoadingVatMapping] = useState(false)
  const [savingMapping, setSavingMapping] = useState(false)
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)
  const [syncPanelExpanded, setSyncPanelExpanded] = useState(true)
  const [fullSyncConnectionId, setFullSyncConnectionId] = useState<string | null>(null)
  const [fullSyncStep, setFullSyncStep] = useState<'idle' | 'categories' | 'product_classes' | 'products'>('idle')
  const [syncHistoryDialogOpen, setSyncHistoryDialogOpen] = useState(false)
  const [syncHistoryConnection, setSyncHistoryConnection] = useState<WebshopConnection | null>(null)
  const [settingUpWebhooks, setSettingUpWebhooks] = useState(false)
  const [syncLogs, setSyncLogs] = useState<Array<{
    id: string
    sync_type: string
    sync_direction: string
    user_email: string | null
    total_products: number
    synced_count: number
    error_count: number
    skipped_count: number
    started_at: string
    completed_at: string | null
    duration_seconds: number | null
    status: string
    error_message: string | null
    metadata: any
  }>>([])
  const [loadingSyncLogs, setLoadingSyncLogs] = useState(false)
  const [syncLogsTotal, setSyncLogsTotal] = useState(0)
  const [syncStatuses, setSyncStatuses] = useState<Map<string, any>>(new Map())
  const [loadingSyncStatuses, setLoadingSyncStatuses] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentSyncingConnectionRef = useRef<WebshopConnection | null>(null)
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false)
  const [migrationConnection, setMigrationConnection] = useState<WebshopConnection | null>(null)
  const [orphanedConnections, setOrphanedConnections] = useState<Array<{
    id: string
    name: string
    deletedAt: string
    productCount: number
  }>>([])
  const [checkingOrphaned, setCheckingOrphaned] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuConnectionId, setMenuConnectionId] = useState<string | null>(null)
  const [paymentMappingDialogOpen, setPaymentMappingDialogOpen] = useState(false)
  const [paymentMappingConnection, setPaymentMappingConnection] = useState<WebshopConnection | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string; code: string | null }>>([])
  const [paymentMappings, setPaymentMappings] = useState<Array<{ payment_method_id: string; platform_payment_code: string; platform_payment_name: string | null }>>([])
  const [loadingPaymentMapping, setLoadingPaymentMapping] = useState(false)
  const [savingPaymentMapping, setSavingPaymentMapping] = useState(false)
  const [shippingMappingDialogOpen, setShippingMappingDialogOpen] = useState(false)
  const [shippingMappingConnection, setShippingMappingConnection] = useState<WebshopConnection | null>(null)
  const [shippingMethods, setShippingMethods] = useState<Array<{ id: string; name: string; code: string | null; extension: string | null }>>([])
  const [shippingMappings, setShippingMappings] = useState<Array<{ shipping_method_id: string; platform_shipping_code: string; platform_shipping_name: string | null }>>([])
  const [loadingShippingMapping, setLoadingShippingMapping] = useState(false)
  const [savingShippingMapping, setSavingShippingMapping] = useState(false)
  const [newPaymentCode, setNewPaymentCode] = useState('')
  const [newPaymentMethodId, setNewPaymentMethodId] = useState('')
  const [shoprenterPaymentModes, setShoprenterPaymentModes] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [selectedShoprenterPaymentCode, setSelectedShoprenterPaymentCode] = useState('')
  const [newShippingCode, setNewShippingCode] = useState('')
  const [newShippingMethodId, setNewShippingMethodId] = useState('')
  const [shoprenterShippingModes, setShoprenterShippingModes] = useState<Array<{ id: string; extension: string; name: string }>>([])
  const [selectedShoprenterShippingExtension, setSelectedShoprenterShippingExtension] = useState('')

  // Load sync logs for a connection
  const loadSyncLogs = async (connectionId: string) => {
    setLoadingSyncLogs(true)
    try {
      const response = await fetch(`/api/connections/${connectionId}/sync-logs?limit=20&offset=0`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSyncLogs(data.logs || [])
          setSyncLogsTotal(data.total || 0)
        }
      }
    } catch (error) {
      console.error('Error loading sync logs:', error)
      toast.error('Hiba történt a szinkronizálási előzmények betöltése során')
    } finally {
      setLoadingSyncLogs(false)
    }
  }

  // Load sync status for all connections
  const loadSyncStatuses = async () => {
    setLoadingSyncStatuses(true)
    try {
      const statusMap = new Map()
      for (const connection of connections) {
        if (connection.connection_type === 'shoprenter') {
          try {
            const response = await fetch(`/api/connections/${connection.id}/sync-status`)
            if (response.ok) {
              const data = await response.json()
              if (data.success) {
                statusMap.set(connection.id, data)
              }
            }
          } catch (error) {
            console.error(`Error loading sync status for connection ${connection.id}:`, error)
          }
        }
      }
      setSyncStatuses(statusMap)
    } catch (error) {
      console.error('Error loading sync statuses:', error)
    } finally {
      setLoadingSyncStatuses(false)
    }
  }

  // Load sync statuses on mount and when connections change
  useEffect(() => {
    loadSyncStatuses()
    // Refresh every 30 seconds
    const interval = setInterval(loadSyncStatuses, 30000)
    return () => clearInterval(interval)
  }, [connections])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (categoryPollIntervalRef.current) {
        clearInterval(categoryPollIntervalRef.current)
        categoryPollIntervalRef.current = null
      }
    }
  }, [])

  // Helper function to start polling for a connection
  const startPollingForConnection = (connection: WebshopConnection) => {
    // Clear any existing polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    // Helper function to stop polling and cleanup
    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      // Don't clear syncingConnectionId or syncProgress - let panel stay visible
    }

    // Track if we've already shown success/error message
    const completionShownRef = { current: false }

    // Start polling for progress
    pollIntervalRef.current = setInterval(async () => {
      // Check if interval was cleared (shouldn't happen, but safety check)
      if (!pollIntervalRef.current) {
        return
      }

      try {
        const progressResponse = await fetch(`/api/connections/${connection.id}/sync-progress`)
        if (progressResponse.ok) {
          const progressData = await progressResponse.json()
          if (progressData.success && progressData.progress) {
            // Update progress with exact counts from server
            setSyncProgress(prev => ({
              current: progressData.progress.current || prev?.current || 0,
              total: progressData.progress.total || prev?.total || 0,
              synced: progressData.progress.synced || prev?.synced || 0,
              batchesProcessed: 0, // Not tracked in progress API
              totalBatches: progressData.progress.totalBatches || prev?.totalBatches || 0,
              currentBatch: progressData.progress.currentBatch || prev?.currentBatch,
              batchProgress: progressData.progress.batchProgress || prev?.batchProgress,
              status: progressData.progress.status || prev?.status || 'syncing',
              elapsed: progressData.progress.elapsed || prev?.elapsed || 0
            }))

            // If stopped, stop polling (only once)
            if (progressData.progress.status === 'stopped' && !completionShownRef.current) {
              completionShownRef.current = true
              // Clear interval FIRST before doing anything else
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              // Update progress with stopped status
              setSyncProgress(prev => prev ? { ...prev, status: 'stopped' } : null)
              return // Exit immediately to prevent further execution
            } else if (progressData.progress.status === 'completed' && !completionShownRef.current) {
              completionShownRef.current = true
              // Clear interval FIRST before doing anything else
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              // Update progress with completed status
              setSyncProgress(prev => prev ? { ...prev, status: 'completed' } : null)
              toast.success(`${progressData.progress.synced} termék sikeresen szinkronizálva!${progressData.progress.errors > 0 ? ` (${progressData.progress.errors} hiba)` : ''}`, {
                autoClose: 10000, // Show for 10 seconds
              })
              startTransition(() => {
                router.refresh()
              })
              return // Exit immediately to prevent further execution
            } else if (progressData.progress.status === 'error' && !completionShownRef.current) {
              // Sync encountered an error
              completionShownRef.current = true
              // Clear interval FIRST before doing anything else
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              // Update progress with error status
              setSyncProgress(prev => prev ? { ...prev, status: 'error' } : null)
              toast.error(`Szinkronizálás hibával leállt: ${progressData.progress.synced}/${progressData.progress.total} termék szinkronizálva. ${progressData.progress.errors} hiba.`)
              startTransition(() => {
                router.refresh()
              })
              return // Exit immediately to prevent further execution
            }
          }
        } else if (progressResponse.status === 404) {
          // Progress not found - could mean:
          // 1. Sync hasn't started yet (initial state)
          // 2. Sync completed and progress was cleared (after 30 seconds)
          // Only treat as completed if we had progress before and synced count matches total
          if (syncProgress && syncProgress.synced > 0 && syncProgress.synced >= syncProgress.total) {
            // Sync was completed and progress was cleared
            if (!completionShownRef.current) {
              completionShownRef.current = true
              // Clear interval FIRST before doing anything else
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              // Update progress with completed status
              setSyncProgress(prev => prev ? { ...prev, status: 'completed' } : null)
              toast.success('Szinkronizálás befejezve!')
              startTransition(() => {
                router.refresh()
              })
            }
            return // Exit immediately
          }
          // Otherwise, just wait - sync might be initializing
          // Don't update status, keep polling
          return
        }
      } catch (pollError) {
        console.error('Error polling progress:', pollError)
        // On repeated errors, stop polling after 5 consecutive failures
        // (This is handled by the timeout below)
      }
    }, 1000) // Poll every second

    // Cleanup polling after 10 minutes (safety timeout)
    setTimeout(() => {
      if (pollIntervalRef.current) {
        stopPolling()
        toast.warning('Szinkronizálás timeout - a folyamat leállt')
      }
    }, 10 * 60 * 1000)
  }

  // Check for active syncs on mount and restore state (only for actively running syncs)
  useEffect(() => {
    const checkActiveSyncs = async () => {
      for (const connection of connections) {
        try {
          const response = await fetch(`/api/connections/${connection.id}/sync-progress`)
          if (response.ok) {
            const data = await response.json()
            // Only restore state for actively running syncs, not stopped/completed/error
            if (data.success && data.progress && data.progress.status === 'syncing') {
              // Found an active sync, restore state
              setSyncingConnectionId(connection.id)
              currentSyncingConnectionRef.current = connection
              setSyncProgress({
                current: data.progress.current || 0,
                total: data.progress.total || 0,
                synced: data.progress.synced || 0,
                batchesProcessed: 0,
                totalBatches: 0,
                status: data.progress.status,
                elapsed: data.progress.elapsed || 0
              })
              setSyncPanelExpanded(true)
              // Restart polling
                startPollingForConnection(connection)
              break
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    checkActiveSyncs()
  }, []) // Only on mount

  // Function to stop sync (accessible from dialog)
  const handleStopSync = async () => {
    if (!currentSyncingConnectionRef.current) {
      return
    }

    try {
      // First, fetch the latest progress to get the most accurate count
      const progressResponse = await fetch(`/api/connections/${currentSyncingConnectionRef.current.id}/sync-progress`)
      if (progressResponse.ok) {
        const progressData = await progressResponse.json()
        if (progressData.success && progressData.progress) {
          // Update UI with latest progress before stopping
          setSyncProgress(prev => ({
            ...prev,
            ...progressData.progress,
            status: 'stopped'
          }))
        }
      }

      // Then stop the sync
      const stopResponse = await fetch(`/api/connections/${currentSyncingConnectionRef.current.id}/sync-progress/stop`, {
        method: 'POST'
      })
      
      if (stopResponse.ok) {
        // Stop polling immediately
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        
        // Ensure status is set to stopped
        setSyncProgress(prev => prev ? { ...prev, status: 'stopped' } : null)
        
        toast.info('Szinkronizálás leállítva')
      } else {
        toast.error('Hiba a szinkronizálás leállításakor')
      }
    } catch (error) {
      console.error('Error stopping sync:', error)
      toast.error('Hiba a szinkronizálás leállításakor')
    }
  }
  const [syncProgress, setSyncProgress] = useState<{
    current: number
    total: number
    synced: number
    batchesProcessed: number
    totalBatches: number
    currentBatch?: number
    batchProgress?: number
    status?: string
    elapsed?: number
  } | null>(null)
  
  const [syncingCategoriesConnectionId, setSyncingCategoriesConnectionId] = useState<string | null>(null)
  const [categorySyncProgress, setCategorySyncProgress] = useState<{
    current: number
    total: number
    synced: number
    status?: string
    errors?: number
  } | null>(null)
  const categoryPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [syncingProductClassesConnectionId, setSyncingProductClassesConnectionId] = useState<string | null>(null)
  const [syncingCustomersConnectionId, setSyncingCustomersConnectionId] = useState<string | null>(null)
  const [customerSyncProgress, setCustomerSyncProgress] = useState<{
    current: number
    total: number
    synced: number
    status: string
    errors?: number
  } | null>(null)
  const customerPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [backfillingManufacturers, setBackfillingManufacturers] = useState(false)
  
  const [newConnection, setNewConnection] = useState({
    name: '',
    connection_type: 'shoprenter' as 'shoprenter' | 'szamlazz',
    api_url: '',
    username: '',
    password: '',
    agent_key: '', // For szamlazz.hu
    is_active: true,
    search_console_property_url: '',
    search_console_client_email: '',
    search_console_private_key: '',
    search_console_enabled: false
  })
  
  const [editingConnection, setEditingConnection] = useState<WebshopConnection | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    connection_type: 'shoprenter' as 'shoprenter' | 'szamlazz',
    api_url: '',
    username: '',
    password: '',
    agent_key: '', // For szamlazz.hu
    is_active: true,
    search_console_property_url: '',
    search_console_client_email: '',
    search_console_private_key: '',
    search_console_enabled: false
  })
  
  const [creatingConnection, setCreatingConnection] = useState(false)
  const [updatingConnection, setUpdatingConnection] = useState(false)
  const [deletingConnections, setDeletingConnections] = useState(false)

  const [isPending, startTransition] = useTransition()

  // No filtering needed - max 5-6 connections per tenant
  const filteredConnections = connections

  // Selection handlers
  const handleSelectConnection = (connectionId: string) => {
    setSelectedConnections(prev => 
      prev.includes(connectionId) 
        ? prev.filter(id => id !== connectionId)
        : [...prev, connectionId]
    )
  }

  // Extract shop name from API URL (for ShopRenter)
  const extractShopName = (apiUrl: string): string | null => {
    try {
      const cleanUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      // Match both api.myshoprenter.hu and api2.myshoprenter.hu
      const match = cleanUrl.match(/^([^.]+)\.api(2)?\.myshoprenter\.hu/)
      return match && match[1] ? match[1] : null
    } catch {
      return null
    }
  }

  // Test connection
  const handleTestConnection = async (connection: WebshopConnection) => {
    setTestingConnectionId(connection.id)
    
    try {
      // For ShopRenter, extract shop name from API URL
      let shopName: string | null = null
      if (connection.connection_type === 'shoprenter') {
        shopName = extractShopName(connection.api_url)
        if (!shopName) {
          toast.error(`Nem lehet kinyerni a shop nevet az API URL-ből: ${connection.api_url}. Használjon formátumot: http://shopname.api.myshoprenter.hu`)
          setTestingConnectionId(null)
          return
        }
      }

      // Build request body based on connection type
      const requestBody: any = {
        connection_id: connection.id,
        connection_type: connection.connection_type
      }

      if (connection.connection_type === 'shoprenter') {
        requestBody.api_url = connection.api_url
        requestBody.username = connection.username // Client ID
        requestBody.password = connection.password // Client Secret
        requestBody.shop_name = shopName
      } else if (connection.connection_type === 'szamlazz') {
        requestBody.agent_key = connection.password // For szamlazz, agent_key is stored in password field
      }

      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Kapcsolat sikeresen tesztelve!')
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(`Kapcsolat tesztelése sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      toast.error('Hiba a kapcsolat tesztelésekor')
    } finally {
      setTestingConnectionId(null)
    }
  }

  // Create new connection
  const handleCreateConnection = async () => {
    // Validate based on connection type
    if (!newConnection.name) {
      toast.error('A kapcsolat neve kötelező')
      return
    }
    
    if (newConnection.connection_type === 'shoprenter') {
      if (!newConnection.api_url || !newConnection.username || !newConnection.password) {
        toast.error('ShopRenter kapcsolathoz az API URL, Client ID és Client Secret kötelező')
        return
      }
    } else if (newConnection.connection_type === 'szamlazz') {
      if (!newConnection.agent_key) {
        toast.error('Szamlazz.hu kapcsolathoz az Agent Key kötelező')
        return
      }
    }

    try {
      setCreatingConnection(true)
      
      const result = await createConnectionAction(newConnection)

      if (result.success) {
        if (result.restored) {
          toast.success('Kapcsolat sikeresen visszaállítva! A korábbi termékek és kategóriák megmaradtak.')
        } else {
          toast.success('Kapcsolat sikeresen létrehozva!')
        }
        setNewConnectionDialogOpen(false)
        setNewConnection({
          name: '',
          connection_type: 'shoprenter',
          api_url: '',
          username: '',
          password: '',
          agent_key: '',
          is_active: true,
          search_console_property_url: '',
          search_console_client_email: '',
          search_console_private_key: '',
          search_console_enabled: false
        })
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(result.error || 'Hiba a kapcsolat létrehozásakor')
      }
    } catch (error) {
      console.error('Error creating connection:', error)
      toast.error('Hiba a kapcsolat létrehozásakor')
    } finally {
      setCreatingConnection(false)
    }
  }


  // Open edit dialog
  const handleOpenEditDialog = (connection: WebshopConnection) => {
    setEditingConnection(connection)
    setEditFormData({
      name: connection.name,
      connection_type: connection.connection_type as 'shoprenter' | 'szamlazz',
      api_url: connection.api_url || '',
      username: connection.username || '',
      password: '', // Don't pre-fill password for security
      agent_key: connection.connection_type === 'szamlazz' ? connection.password || '' : '', // For szamlazz.hu, agent_key is stored in password field
      is_active: connection.is_active,
      search_console_property_url: connection.search_console_property_url || '',
      search_console_client_email: connection.search_console_client_email || '',
      search_console_private_key: '', // Don't pre-fill private key for security
      search_console_enabled: connection.search_console_enabled || false
    })
    setEditConnectionDialogOpen(true)
  }

  // Update connection
  const handleUpdateConnection = async () => {
    if (!editingConnection) return
    
    if (!editFormData.name) {
      toast.error('A kapcsolat neve kötelező')
      return
    }
    
    if (editFormData.connection_type === 'shoprenter') {
      if (!editFormData.api_url || !editFormData.username) {
        toast.error('ShopRenter kapcsolathoz az API URL és Client ID kötelező')
        return
      }
    } else if (editFormData.connection_type === 'szamlazz') {
      if (!editFormData.agent_key) {
        toast.error('Szamlazz.hu kapcsolathoz az Agent Key kötelező')
        return
      }
    }

    try {
      setUpdatingConnection(true)
      
      const result = await updateConnectionAction(editingConnection.id, editFormData)

      if (result.success) {
        toast.success('Kapcsolat sikeresen frissítve!')
        setEditConnectionDialogOpen(false)
        setEditingConnection(null)
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(result.error || 'Hiba a kapcsolat frissítésekor')
      }
    } catch (error) {
      console.error('Error updating connection:', error)
      toast.error('Hiba a kapcsolat frissítésekor')
    } finally {
      setUpdatingConnection(false)
    }
  }

  // Delete selected connections
  const handleDeleteConnections = async () => {
    if (selectedConnections.length === 0) {
      toast.error('Nincs kiválasztott kapcsolat')
      return
    }

    try {
      setDeletingConnections(true)
      
      const result = await deleteConnectionsAction(selectedConnections)

      if (result.success) {
        toast.success(`${result.count} kapcsolat sikeresen törölve!`)
        setSelectedConnections([])
        setDeleteDialogOpen(false)
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(result.error || 'Hiba a kapcsolatok törlésekor')
      }
    } catch (error) {
      console.error('Error deleting connections:', error)
      toast.error('Hiba a kapcsolatok törlésekor')
    } finally {
      setDeletingConnections(false)
    }
  }

  // Check for orphaned products from deleted connections
  const checkOrphanedProducts = async (connection: WebshopConnection) => {
    setCheckingOrphaned(true)
    try {
      const response = await fetch(`/api/connections/${connection.id}/orphaned-products`)
      if (response.ok) {
        const data = await response.json()
        if (data.hasOrphanedProducts && data.orphanedConnections.length > 0) {
          setOrphanedConnections(data.orphanedConnections)
          setMigrationConnection(connection)
          setMigrationDialogOpen(true)
        } else {
          toast.info('Nem találhatók árva termékek ezen a kapcsolaton')
        }
      } else {
        toast.error('Hiba az árva termékek ellenőrzésekor')
      }
    } catch (error) {
      console.error('Error checking orphaned products:', error)
      toast.error('Hiba az árva termékek ellenőrzésekor')
    } finally {
      setCheckingOrphaned(false)
    }
  }

  // Migrate products from deleted connection
  const handleMigrateProducts = async (fromConnectionId: string) => {
    if (!migrationConnection) return

    setMigrating(true)
    try {
      const response = await fetch(`/api/connections/${migrationConnection.id}/migrate-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fromConnectionId })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success(
            `${data.migrated} termék sikeresen migrálva!` +
            (data.categoriesMigrated > 0 ? ` ${data.categoriesMigrated} kategória migrálva.` : '') +
            (data.taxMappingsMigrated > 0 ? ` ${data.taxMappingsMigrated} ÁFA leképezés migrálva.` : '')
          )
          // Remove migrated connection from list
          setOrphanedConnections(prev => prev.filter(conn => conn.id !== fromConnectionId))
          // Close dialog if no more orphaned connections
          if (orphanedConnections.length === 1) {
            setMigrationDialogOpen(false)
            setMigrationConnection(null)
            setOrphanedConnections([])
          }
          // Refresh connections
          startTransition(() => {
            router.refresh()
          })
        } else {
          toast.error(data.error || 'Hiba a termékek migrálásakor')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Hiba a termékek migrálásakor')
      }
    } catch (error) {
      console.error('Error migrating products:', error)
      toast.error('Hiba a termékek migrálásakor')
    } finally {
      setMigrating(false)
    }
  }

  // Get status indicator
  const getStatusIndicator = (connection: WebshopConnection) => {
    if (!connection.last_test_status) {
      return (
        <Chip 
          icon={<WarningIcon sx={{ fontSize: '18px !important' }} />}
          label="Nincs tesztelve" 
          size="medium" 
          sx={{ 
            bgcolor: 'grey.100', 
            color: 'grey.700',
            fontWeight: 600,
            height: '32px',
            '& .MuiChip-icon': {
              color: 'grey.600'
            }
          }}
        />
      )
    }
    
    if (connection.last_test_status === 'success') {
      return (
        <Chip 
          icon={<CheckCircleIcon sx={{ fontSize: '18px !important' }} />}
          label="Csatlakozva" 
          size="medium" 
          color="success"
          sx={{ 
            fontWeight: 600,
            height: '32px',
            bgcolor: '#4caf50',
            color: 'white',
            '& .MuiChip-icon': {
              color: 'white'
            }
          }}
        />
      )
    } else {
      return (
        <Chip 
          icon={<CancelIcon sx={{ fontSize: '18px !important' }} />}
          label="Sikertelen" 
          size="medium" 
          color="error"
          sx={{ 
            fontWeight: 600,
            height: '32px',
            bgcolor: '#f44336',
            color: 'white',
            '& .MuiChip-icon': {
              color: 'white'
            }
          }}
        />
      )
    }
  }

  // Format connection type
  const formatConnectionType = (type: string) => {
    const types: Record<string, string> = {
      shoprenter: 'ShopRenter',
      szamlazz: 'Szamlazz.hu'
    }
    return types[type] || type
  }

  // Handle VAT mapping button click
  const handleVatMappingClick = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('ÁFA leképezés csak ShopRenter kapcsolatokhoz érhető el')
      return
    }

    setVatMappingConnection(connection)
    setLoadingVatMapping(true)
    setVatMappingDialogOpen(true)

    try {
      const response = await fetch(`/api/connections/${connection.id}/tax-class-mappings`)
      if (response.ok) {
        const data = await response.json()
        setVatRates(data.vatRates || [])
        setShoprenterTaxClasses(data.shoprenterTaxClasses || [])
        setMappings(data.mappings || [])
      } else {
        toast.error('Hiba az ÁFA leképezések betöltésekor')
      }
    } catch (error) {
      console.error('Error loading VAT mappings:', error)
      toast.error('Hiba az ÁFA leképezések betöltésekor')
    } finally {
      setLoadingVatMapping(false)
    }
  }

  // Handle save VAT mapping
  const handleSaveVatMapping = async (vatId: string, taxClassId: string) => {
    if (!vatMappingConnection) return

    setSavingMapping(true)
    try {
      const taxClass = shoprenterTaxClasses.find(tc => tc.id === taxClassId)
      const response = await fetch(`/api/connections/${vatMappingConnection.id}/tax-class-mappings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vat_id: vatId,
          shoprenter_tax_class_id: taxClassId,
          shoprenter_tax_class_name: taxClass?.name || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        // Update mappings
        setMappings(prev => {
          const existing = prev.find(m => m.vat_id === vatId)
          if (existing) {
            return prev.map(m => m.vat_id === vatId ? { ...m, shoprenter_tax_class_id: taxClassId, shoprenter_tax_class_name: taxClass?.name || null } : m)
          } else {
            return [...prev, { vat_id: vatId, shoprenter_tax_class_id: taxClassId, shoprenter_tax_class_name: taxClass?.name || null }]
          }
        })
        toast.success('ÁFA leképezés sikeresen mentve')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }
    } catch (error) {
      console.error('Error saving VAT mapping:', error)
      toast.error(`Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
    } finally {
      setSavingMapping(false)
    }
  }

  // Handle delete VAT mapping
  const handleDeleteVatMapping = async (vatId: string) => {
    if (!vatMappingConnection) return

    setSavingMapping(true)
    try {
      const response = await fetch(`/api/connections/${vatMappingConnection.id}/tax-class-mappings?vat_id=${vatId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMappings(prev => prev.filter(m => m.vat_id !== vatId))
        toast.success('ÁFA leképezés sikeresen törölve')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }
    } catch (error) {
      console.error('Error deleting VAT mapping:', error)
      toast.error(`Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
    } finally {
      setSavingMapping(false)
    }
  }

  const handlePaymentMappingClick = async (connection: WebshopConnection) => {
    setPaymentMappingConnection(connection)
    setLoadingPaymentMapping(true)
    setPaymentMappingDialogOpen(true)
    setNewPaymentCode('')
    setNewPaymentMethodId('')
    setSelectedShoprenterPaymentCode('')
    setShoprenterPaymentModes([])
    try {
      const response = await fetch(`/api/connections/${connection.id}/payment-method-mappings`)
      if (response.ok) {
        const data = await response.json()
        setPaymentMethods(data.paymentMethods || [])
        setPaymentMappings(data.mappings || [])
        setShoprenterPaymentModes(data.shoprenterPaymentModes || [])
      } else {
        toast.error('Hiba a fizetési mód leképezések betöltésekor')
      }
    } catch (error) {
      console.error('Error loading payment mappings:', error)
      toast.error('Hiba a fizetési mód leképezések betöltésekor')
    } finally {
      setLoadingPaymentMapping(false)
    }
  }

  const handleSavePaymentMapping = async (paymentMethodId: string, platformPaymentCode: string, platformPaymentName?: string | null) => {
    if (!paymentMappingConnection) return
    setSavingPaymentMapping(true)
    try {
      const response = await fetch(`/api/connections/${paymentMappingConnection.id}/payment-method-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
          platform_payment_code: platformPaymentCode.trim(),
          platform_payment_name: platformPaymentName?.trim() || null
        })
      })
      if (response.ok) {
        const data = await response.json()
        setPaymentMappings(prev => {
          const rest = prev.filter(m => m.platform_payment_code !== platformPaymentCode.trim())
          return [...rest, { payment_method_id: paymentMethodId, platform_payment_code: platformPaymentCode.trim(), platform_payment_name: platformPaymentName?.trim() || null }]
        })
        setNewPaymentCode('')
        setNewPaymentMethodId('')
        setSelectedShoprenterPaymentCode('')
        toast.success('Fizetési mód leképezés mentve')
      } else {
        const err = await response.json()
        throw new Error(err.error || 'Hiba a mentés során')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ismeretlen hiba')
    } finally {
      setSavingPaymentMapping(false)
    }
  }

  const handleDeletePaymentMapping = async (platformPaymentCode: string) => {
    if (!paymentMappingConnection) return
    setSavingPaymentMapping(true)
    try {
      const response = await fetch(`/api/connections/${paymentMappingConnection.id}/payment-method-mappings?platform_payment_code=${encodeURIComponent(platformPaymentCode)}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setPaymentMappings(prev => prev.filter(m => m.platform_payment_code !== platformPaymentCode))
        toast.success('Fizetési mód leképezés törölve')
      } else {
        const err = await response.json()
        throw new Error(err.error || 'Hiba a törlés során')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ismeretlen hiba')
    } finally {
      setSavingPaymentMapping(false)
    }
  }

  const handleShippingMappingClick = async (connection: WebshopConnection) => {
    setShippingMappingConnection(connection)
    setLoadingShippingMapping(true)
    setShippingMappingDialogOpen(true)
    setNewShippingCode('')
    setNewShippingMethodId('')
    setSelectedShoprenterShippingExtension('')
    setShoprenterShippingModes([])
    try {
      const response = await fetch(`/api/connections/${connection.id}/shipping-method-mappings`)
      if (response.ok) {
        const data = await response.json()
        setShippingMethods(data.shippingMethods || [])
        setShippingMappings(data.mappings || [])
        setShoprenterShippingModes(data.shoprenterShippingModes || [])
      } else {
        toast.error('Hiba a szállítási mód leképezések betöltésekor')
      }
    } catch (error) {
      console.error('Error loading shipping mappings:', error)
      toast.error('Hiba a szállítási mód leképezések betöltésekor')
    } finally {
      setLoadingShippingMapping(false)
    }
  }

  const handleSaveShippingMapping = async (shippingMethodId: string, platformShippingCode: string, platformShippingName?: string | null) => {
    if (!shippingMappingConnection) return
    setSavingShippingMapping(true)
    try {
      const response = await fetch(`/api/connections/${shippingMappingConnection.id}/shipping-method-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_method_id: shippingMethodId,
          platform_shipping_code: platformShippingCode.trim(),
          platform_shipping_name: platformShippingName?.trim() || null
        })
      })
      if (response.ok) {
        setShippingMappings(prev => {
          const rest = prev.filter(m => m.platform_shipping_code !== platformShippingCode.trim())
          return [...rest, { shipping_method_id: shippingMethodId, platform_shipping_code: platformShippingCode.trim(), platform_shipping_name: platformShippingName?.trim() || null }]
        })
        setNewShippingCode('')
        setNewShippingMethodId('')
        setSelectedShoprenterShippingExtension('')
        toast.success('Szállítási mód leképezés mentve')
      } else {
        const err = await response.json()
        throw new Error(err.error || 'Hiba a mentés során')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ismeretlen hiba')
    } finally {
      setSavingShippingMapping(false)
    }
  }

  const handleDeleteShippingMapping = async (platformShippingCode: string) => {
    if (!shippingMappingConnection) return
    setSavingShippingMapping(true)
    try {
      const response = await fetch(`/api/connections/${shippingMappingConnection.id}/shipping-method-mappings?platform_shipping_code=${encodeURIComponent(platformShippingCode)}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setShippingMappings(prev => prev.filter(m => m.platform_shipping_code !== platformShippingCode))
        toast.success('Szállítási mód leképezés törölve')
      } else {
        const err = await response.json()
        throw new Error(err.error || 'Hiba a törlés során')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ismeretlen hiba')
    } finally {
      setSavingShippingMapping(false)
    }
  }

  // Handle sync products button click - show dialog first
  const handleSyncProductsClick = async (connection: WebshopConnection) => {
    // If sync is already in progress for this connection, reopen the modal
    if (syncingConnectionId === connection.id && syncProgress) {
      // Sync is already running, just reopen the modal
      setSyncingConnectionId(connection.id)
      currentSyncingConnectionRef.current = connection
      
      // Fetch latest progress to ensure we have current data
      try {
        const progressResponse = await fetch(`/api/connections/${connection.id}/sync-progress`)
        if (progressResponse.ok) {
          const progressData = await progressResponse.json()
          if (progressData.success && progressData.progress) {
            setSyncProgress({
              current: progressData.progress.current || 0,
              total: progressData.progress.total || 0,
              synced: progressData.progress.synced || 0,
              batchesProcessed: 0,
              totalBatches: 0,
              status: progressData.progress.status,
              elapsed: progressData.progress.elapsed || 0
            })
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error)
      }
      return
    }
    
    setSyncDialogConnection(connection)
    setSyncDialogOpen(true)
  }

  const handleRecoverySync = async (connection: WebshopConnection) => {
    toast.info('Helyreállítási szinkron indul: változások szinkronja (ajánlott).')
    await handleSyncProducts(connection, false)
  }

  const waitForCategorySyncCompletion = async (connectionId: string): Promise<void> => {
    const startedAt = Date.now()
    const timeoutMs = 10 * 60 * 1000
    while (Date.now() - startedAt < timeoutMs) {
      const res = await fetch(`/api/connections/${connectionId}/sync-categories`)
      if (res.ok) {
        const data = await res.json()
        const status = data?.progress?.status
        if (status === 'completed') return
        if (status === 'error' || status === 'stopped') {
          throw new Error('Kategória szinkronizálás nem fejeződött be sikeresen.')
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    throw new Error('Kategória szinkronizálás időtúllépés (10 perc).')
  }

  const handleGuidedFullSync = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz érhető el a teljes frissítés.')
      return
    }
    if (fullSyncConnectionId || syncingConnectionId || syncingCategoriesConnectionId || syncingProductClassesConnectionId) {
      toast.warning('Már fut egy szinkronizálás. Várja meg a befejezést.')
      return
    }

    try {
      setFullSyncConnectionId(connection.id)
      toast.info('Teljes frissítés indul: Kategóriák -> Termék típusok -> Termékek.')

      setFullSyncStep('categories')
      const catStart = await fetch(`/api/connections/${connection.id}/sync-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!catStart.ok) {
        const err = await catStart.json().catch(() => null)
        throw new Error(err?.error || 'Kategória szinkronizálás indítása sikertelen')
      }
      await waitForCategorySyncCompletion(connection.id)
      toast.success('1/3 Kategóriák szinkronizálva')

      setFullSyncStep('product_classes')
      const classRes = await fetch(`/api/connections/${connection.id}/sync-product-classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const classData = await classRes.json().catch(() => null)
      if (!classRes.ok || !classData?.success) {
        throw new Error(classData?.error || 'Termék típusok szinkronizálása sikertelen')
      }
      toast.success('2/3 Termék típusok szinkronizálva')

      setFullSyncStep('products')
      toast.info('3/3 Teljes termék szinkron indul...')
      await handleSyncProducts(connection, true)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ismeretlen hiba'
      toast.error(`Teljes frissítés megszakadt: ${msg}`)
    } finally {
      setFullSyncStep('idle')
      setFullSyncConnectionId(null)
    }
  }

  const handleSyncCategoriesClick = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz szinkronizálható kategóriák')
      return
    }

    try {
      setSyncingCategoriesConnectionId(connection.id)
      setCategorySyncProgress({ current: 0, total: 0, synced: 0, status: 'starting' })
      
      // Start sync
      const response = await fetch(`/api/connections/${connection.id}/sync-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Kategória szinkronizálás sikertelen')
      }

      // Wait a moment for sync to initialize
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Start polling for category sync progress
      const startCategoryPolling = () => {
        if (categoryPollIntervalRef.current) {
          clearInterval(categoryPollIntervalRef.current)
        }

        categoryPollIntervalRef.current = setInterval(async () => {
          try {
            const progressResponse = await fetch(`/api/connections/${connection.id}/sync-categories`)
            if (progressResponse.ok) {
              const data = await progressResponse.json()
              if (data.progress) {
                setCategorySyncProgress({
                  current: data.progress.current || 0,
                  total: data.progress.total || 0,
                  synced: data.progress.synced || 0,
                  status: data.progress.status || 'syncing',
                  errors: data.progress.errors || 0
                })

                // Stop polling if completed, stopped, or error
                if (data.progress.status === 'completed' || 
                    data.progress.status === 'stopped' || 
                    data.progress.status === 'error') {
                  if (categoryPollIntervalRef.current) {
                    clearInterval(categoryPollIntervalRef.current)
                    categoryPollIntervalRef.current = null
                  }
                  
                  if (data.progress.status === 'completed') {
                    toast.success(`Kategóriák szinkronizálása befejeződött: ${data.progress.synced} kategória`)
                  } else if (data.progress.status === 'error') {
                    toast.error('Kategória szinkronizálás hiba történt')
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching category sync progress:', error)
          }
        }, 2000) // Poll every 2 seconds
      }

      startCategoryPolling()

      // Safety timeout
      setTimeout(() => {
        if (categoryPollIntervalRef.current) {
          clearInterval(categoryPollIntervalRef.current)
          categoryPollIntervalRef.current = null
        }
      }, 10 * 60 * 1000) // 10 minutes

    } catch (error) {
      console.error('Error syncing categories:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
      
      // Provide actionable error messages
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        toast.error(
          'A webshop API túl sok kérést kapott. Kérjük, várjon 2-3 percet, majd próbálja újra.',
          { autoClose: 8000 }
        )
      } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        toast.error(
          'Hitelesítési hiba. Kérjük, ellenőrizze a kapcsolat beállításait (felhasználónév, jelszó) és próbálja újra.',
          { autoClose: 8000 }
        )
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        toast.error(
          'Hozzáférés megtagadva. Kérjük, ellenőrizze, hogy az API kulcs rendelkezik-e a szükséges jogosultságokkal.',
          { autoClose: 8000 }
        )
      } else {
        toast.error(
          `Hiba a kategóriák szinkronizálásakor: ${errorMessage}\n\nKérjük, ellenőrizze a kapcsolat beállításait és próbálja újra.`,
          { autoClose: 8000 }
        )
      }
      
      setSyncingCategoriesConnectionId(null)
      setCategorySyncProgress(null)
    }
  }

  // Handle sync customers
  const handleSyncCustomersClick = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz szinkronizálható vevők')
      return
    }

    try {
      setSyncingCustomersConnectionId(connection.id)
      setCustomerSyncProgress({ current: 0, total: 0, synced: 0, status: 'starting' })
      
      // Start sync
      const response = await fetch(`/api/connections/${connection.id}/sync-customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: false })
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Vevők szinkronizálása sikertelen')
      }

      // Wait a moment for sync to initialize
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Start polling for customer sync progress
      const startCustomerPolling = () => {
        if (customerPollIntervalRef.current) {
          clearInterval(customerPollIntervalRef.current)
        }

        customerPollIntervalRef.current = setInterval(async () => {
          try {
            // Check sync progress from sync-progress-store
            const progressResponse = await fetch(`/api/syncs/active`)
            if (progressResponse.ok) {
              const data = await progressResponse.json()
              const progress = data.progress?.[`customers-${connection.id}`]
              
              if (progress) {
                setCustomerSyncProgress({
                  current: progress.synced || 0,
                  total: progress.total || 0,
                  synced: progress.synced || 0,
                  status: progress.status || 'syncing',
                  errors: progress.errors || 0
                })

                // Stop polling if completed, stopped, or error
                if (progress.status === 'completed' || 
                    progress.status === 'stopped' || 
                    progress.status === 'error') {
                  if (customerPollIntervalRef.current) {
                    clearInterval(customerPollIntervalRef.current)
                    customerPollIntervalRef.current = null
                  }
                  
                  if (progress.status === 'completed') {
                    toast.success(`Vevők szinkronizálása befejeződött: ${progress.synced} vevő`)
                    router.refresh()
                  } else if (progress.status === 'error') {
                    toast.error('Vevők szinkronizálás hiba történt')
                  }
                  
                  setSyncingCustomersConnectionId(null)
                  setCustomerSyncProgress(null)
                }
              } else {
                // No progress found, might be completed
                const result = await response.json().catch(() => null)
                if (result && result.success) {
                  if (customerPollIntervalRef.current) {
                    clearInterval(customerPollIntervalRef.current)
                    customerPollIntervalRef.current = null
                  }
                  toast.success(`Vevők szinkronizálása befejeződött: ${result.synced} vevő`)
                  setSyncingCustomersConnectionId(null)
                  setCustomerSyncProgress(null)
                  router.refresh()
                }
              }
            }
          } catch (error) {
            console.error('Error fetching customer sync progress:', error)
          }
        }, 2000) // Poll every 2 seconds
      }

      startCustomerPolling()

      // Safety timeout
      setTimeout(() => {
        if (customerPollIntervalRef.current) {
          clearInterval(customerPollIntervalRef.current)
          customerPollIntervalRef.current = null
        }
      }, 10 * 60 * 1000) // 10 minutes

    } catch (error) {
      console.error('Error syncing customers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
      
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        toast.error(
          'A webshop API túl sok kérést kapott. Kérjük, várjon 2-3 percet, majd próbálja újra.',
          { autoClose: 8000 }
        )
      } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        toast.error(
          'Hitelesítési hiba. Kérjük, ellenőrizze a kapcsolat beállításait.',
          { autoClose: 8000 }
        )
      } else {
        toast.error(
          `Hiba a vevők szinkronizálásakor: ${errorMessage}`,
          { autoClose: 8000 }
        )
      }
      
      setSyncingCustomersConnectionId(null)
      setCustomerSyncProgress(null)
    }
  }

  // Handle sync Product Classes
  const handleSyncProductClassesClick = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz szinkronizálható termék típusok')
      return
    }

    try {
      setSyncingProductClassesConnectionId(connection.id)
      
      // Start sync
      const response = await fetch(`/api/connections/${connection.id}/sync-product-classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Termék típusok szinkronizálása sikertelen')
      }

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || `${result.synced} termék típus szinkronizálva`)
        // Refresh the page to show updated data
        router.refresh()
      } else {
        throw new Error(result.error || 'Termék típusok szinkronizálása sikertelen')
      }
    } catch (error: any) {
      console.error('Error syncing Product Classes:', error)
      const errorMessage = error.message || 'Ismeretlen hiba'
      toast.error(
        `Hiba a termék típusok szinkronizálásakor: ${errorMessage}\n\nKérjük, ellenőrizze a kapcsolat beállításait és próbálja újra.`,
        { autoClose: 8000 }
      )
    } finally {
      setSyncingProductClassesConnectionId(null)
    }
  }

  // Handle backfill manufacturers
  const handleSetupAllWebhooks = async () => {
    try {
      setSettingUpWebhooks(true)
      toast.info('Webhook-ok beállítása elindítva...')
      
      const response = await fetch('/api/connections/setup-all-webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Hiba a webhook-ok beállításakor')
      }

      const result = await response.json()
      
      if (result.success) {
        const { summary } = result
        let message = `Webhook-ok beállítva: ${summary.webhooks_created} webhook létrehozva, ${summary.mappings_synced} mapping szinkronizálva`
        
        if (summary.webhooks_failed > 0 || summary.mappings_failed > 0) {
          message += `\nFigyelem: ${summary.webhooks_failed} webhook és ${summary.mappings_failed} mapping sikertelen`
          toast.warning(message, { autoClose: 8000 })
        } else {
          toast.success(message)
        }
        
        // Show details if there are any failures
        if (result.details && result.details.some((d: any) => !d.webhook_success || !d.mapping_success)) {
          console.log('Webhook setup details:', result.details)
        }
      } else {
        throw new Error(result.error || 'Ismeretlen hiba')
      }
    } catch (error) {
      console.error('Error setting up webhooks:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
      toast.error(`Hiba a webhook-ok beállításakor: ${errorMessage}`)
    } finally {
      setSettingUpWebhooks(false)
    }
  }

  const handleBackfillManufacturers = async () => {
    try {
      setBackfillingManufacturers(true)
      toast.info('Gyártók szinkronizálása elindítva...')
      
      const response = await fetch('/api/products/backfill-manufacturers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Hiba a gyártók szinkronizálásakor')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message || `Gyártók szinkronizálása befejezve: ${result.updated} termék frissítve`)
        if (result.errors > 0) {
          toast.warning(`${result.errors} hiba történt a szinkronizálás során`)
        }
      } else {
        throw new Error(result.error || 'Ismeretlen hiba')
      }
    } catch (error) {
      console.error('Error backfilling manufacturers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
      toast.error(`Hiba a gyártók szinkronizálásakor: ${errorMessage}`)
    } finally {
      setBackfillingManufacturers(false)
    }
  }

  // Handle sync products (actual sync)
  // forceSync=true: Full sync (all products)
  // forceSync=false: Incremental sync (only changed/new products) - default and recommended
  const handleSyncProducts = async (connection: WebshopConnection, forceSync: boolean = false) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz szinkronizálható termékek')
      return
    }

    try {
      setSyncingConnectionId(connection.id)
      currentSyncingConnectionRef.current = connection
      setSyncProgress({ current: 0, total: 0, synced: 0, batchesProcessed: 0, totalBatches: 0 })
      
      // Start sync (non-blocking)
      const response = await fetch(`/api/connections/${connection.id}/sync-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: forceSync })
      })

      if (!response.ok) {
        const errorResult = await response.json()
        
        // Handle 401 (Unauthorized) - session expired
        if (response.status === 401) {
          toast.error('A munkamenet lejárt. Kérjük, jelentkezzen ki és be újra, majd próbálja újra a szinkronizálást.')
          setSyncingConnectionId(null)
          currentSyncingConnectionRef.current = null
          // Optionally redirect to login after a delay
          setTimeout(() => {
            router.push('/login')
          }, 2000)
          return
        }
        
        // Handle 409 (Conflict) - sync already running
        if (response.status === 409) {
          const existingProgress = errorResult.existingProgress
          if (existingProgress) {
            toast.warning(
              `Szinkronizálás már folyamatban van. Jelenleg ${existingProgress.synced}/${existingProgress.total} termék szinkronizálva. Kérjük, várja meg a befejezését vagy állítsa le az előző szinkronizálást.`,
              { autoClose: 8000 }
            )
          } else {
            toast.warning('Szinkronizálás már folyamatban van erre a kapcsolatra. Kérjük, várja meg a befejezését.')
          }
          setSyncingConnectionId(null)
          currentSyncingConnectionRef.current = null
          return
        }
        
        // Handle 429 (Rate Limit) - rate limit exceeded
        if (response.status === 429) {
          toast.error(
            'A webshop API túl sok kérést kapott (429). Várjon 2-3 percet, majd indítsa újra a "Változások szinkronja (ajánlott)" módot. Ha ismétlődik, ellenőrizze a hitelesítést és a ShopRenter API limitet.',
            { autoClose: 10000 }
          )
          setSyncingConnectionId(null)
          currentSyncingConnectionRef.current = null
          return
        }
        
        // Handle 500+ (Server errors)
        if (response.status >= 500) {
          toast.error(
            `Szerver hiba történt (${response.status}). Kérjük, próbálja újra néhány perc múlva. Ha a probléma továbbra is fennáll, lépjen kapcsolatba a támogatással.`,
            { autoClose: 10000 }
          )
          setSyncingConnectionId(null)
          currentSyncingConnectionRef.current = null
          return
        }
        
        // Generic error with actionable message
        const errorMessage = errorResult.error || errorResult.details || 'Szinkronizálás sikertelen'
        const actionableMessage = errorResult.details 
          ? `${errorMessage}\n\n${errorResult.details}`
          : `${errorMessage}\n\nKérjük, ellenőrizze a kapcsolat beállításait és próbálja újra.`
        
        toast.error(actionableMessage, { autoClose: 8000 })
        setSyncingConnectionId(null)
        currentSyncingConnectionRef.current = null
        return
      }

      // Read response once
      const result = await response.json()
      
      // Handle case where incremental sync finds 0 products (everything is up to date)
      if (result.success && result.total === 0 && !forceSync) {
        toast.success(result.message || 'Nincs szinkronizálandó termék. Minden termék naprakész.')
        setSyncingConnectionId(null)
        currentSyncingConnectionRef.current = null
        setSyncProgress(null)
        return
      }
      
      // If we got a total from the response, set it immediately with syncing status
      if (result.total && result.total > 0) {
        setSyncProgress({ 
          current: 0, 
          total: result.total, 
          synced: 0, 
          batchesProcessed: 0, 
          totalBatches: 0,
          status: 'syncing' // Explicitly set to syncing, not completed
        })
      }
      
      // Wait a moment for sync to initialize progress in the background
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Start polling using the extracted function
      startPollingForConnection(connection)

    } catch (error) {
      console.error('Error syncing products:', error)
      toast.error(`Hiba a termékek szinkronizálásakor: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
      // Clear polling if it exists
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      setSyncingConnectionId(null)
      currentSyncingConnectionRef.current = null
      setSyncProgress(null)
    }
  }

  // Get connection type icon and color
  const getConnectionTypeConfig = (type: string) => {
    const configs: Record<string, { icon: React.ReactNode; color: string; borderColor: string; label: string }> = {
      shoprenter: {
        icon: <StoreIcon sx={{ color: 'white', fontSize: '24px' }} />,
        color: '#2196f3',
        borderColor: '#2196f3',
        label: 'ShopRenter'
      },
      szamlazz: {
        icon: <ReceiptIcon sx={{ color: 'white', fontSize: '24px' }} />,
        color: '#ff9800',
        borderColor: '#ff9800',
        label: 'Szamlazz.hu'
      }
    }
    return configs[type] || {
      icon: <LinkIcon sx={{ color: 'white', fontSize: '24px' }} />,
      color: '#757575',
      borderColor: '#757575',
      label: type
    }
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Kapcsolatok kezelése
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Webshopok, szállítási és számlázási partnerek kezelése
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedConnections.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deletingConnections}
            >
              Törlés ({selectedConnections.length})
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={backfillingManufacturers ? <CircularProgress size={18} /> : <BusinessIcon />}
            onClick={handleBackfillManufacturers}
            disabled={backfillingManufacturers}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
          >
            {backfillingManufacturers ? 'Gyártók szinkronizálása...' : 'Gyártók szinkronizálása'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={settingUpWebhooks ? <CircularProgress size={18} /> : <LinkIcon />}
            onClick={handleSetupAllWebhooks}
            disabled={settingUpWebhooks}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
          >
            {settingUpWebhooks ? 'Webhook-ok beállítása...' : 'Webhook-ok beállítása'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewConnectionDialogOpen(true)}
            color="primary"
            sx={{ minWidth: 180 }}
          >
            Kapcsolat hozzáadása
          </Button>
        </Box>
      </Box>

      {filteredConnections.length === 0 ? (
        <Paper 
          elevation={0}
          sx={{ 
            p: 6,
            textAlign: 'center',
            bgcolor: 'white',
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 2
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 2, 
              borderRadius: '50%', 
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <LinkIcon sx={{ fontSize: 48, color: 'grey.400' }} />
            </Box>
            <Typography variant="h6" color="text.secondary">
              Nincs elérhető kapcsolat
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
              Adjon hozzá webshopot, szállítási vagy számlázási partnert az integrációk kezeléséhez.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewConnectionDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Első kapcsolat hozzáadása
            </Button>
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredConnections.map((connection) => {
            const typeConfig = getConnectionTypeConfig(connection.connection_type)
            const isSyncing = syncingConnectionId === connection.id
            const isSyncingCategories = syncingCategoriesConnectionId === connection.id
            const isSyncingProductClasses = syncingProductClassesConnectionId === connection.id
            const isSyncingCustomers = syncingCustomersConnectionId === connection.id
            
            return (
              <Grid item xs={12} key={connection.id}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: typeConfig.borderColor,
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  {/* Header Section */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: typeConfig.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 4px 12px ${typeConfig.color}40`
                    }}>
                      {typeConfig.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: typeConfig.borderColor }}>
                          {connection.name}
                        </Typography>
                        <Chip 
                          label={typeConfig.label} 
                          size="small" 
                          sx={{ 
                            bgcolor: `${typeConfig.color}20`,
                            color: typeConfig.borderColor,
                            fontWeight: 600,
                            height: '24px'
                          }} 
                        />
                        {!connection.is_active && (
                          <Chip 
                            label="Inaktív" 
                            size="small" 
                            color="default"
                            sx={{ height: '24px' }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {connection.api_url}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Checkbox
                        checked={selectedConnections.includes(connection.id)}
                        onChange={() => handleSelectConnection(connection.id)}
                        size="small"
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditDialog(connection)}
                        sx={{ 
                          color: typeConfig.borderColor,
                          '&:hover': { bgcolor: `${typeConfig.color}10` }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Status and Info Section */}
                  {(() => {
                    const syncStatus = syncStatuses.get(connection.id)
                    const formatTimeAgo = (date: string | null) => {
                      if (!date) return 'Még nem szinkronizálva'
                      const now = new Date()
                      const syncDate = new Date(date)
                      const diffMs = now.getTime() - syncDate.getTime()
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                      const diffDays = Math.floor(diffHours / 24)
                      
                      if (diffHours < 1) return 'Mostanában'
                      if (diffHours < 24) return `${diffHours} órája`
                      if (diffDays < 7) return `${diffDays} napja`
                      return syncDate.toLocaleDateString('hu-HU')
                    }
                    
                    const getStatusColor = (status: string) => {
                      if (status === 'up_to_date') return '#4caf50'
                      if (status === 'needs_attention') return '#ff9800'
                      return '#f44336'
                    }
                    
                    return (
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ 
                            p: 2, 
                            bgcolor: 'rgba(0, 0, 0, 0.02)', 
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              Áttekintés
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                              {getStatusIndicator(connection)}
                              {isSyncing && syncProgress && (
                                <Chip
                                  size="small"
                                  label={`Termék szinkron: ${syncProgress.synced.toLocaleString('hu-HU')}/${syncProgress.total.toLocaleString('hu-HU')}`}
                                  color="primary"
                                  sx={{ height: '24px', fontWeight: 600 }}
                                />
                              )}
                              {isSyncingCustomers && customerSyncProgress && (
                                <Chip
                                  size="small"
                                  label={`Vevők: ${customerSyncProgress.synced.toLocaleString('hu-HU')}/${customerSyncProgress.total.toLocaleString('hu-HU')}`}
                                  sx={{ 
                                    bgcolor: '#9b59b6', 
                                    color: 'white',
                                    height: '24px',
                                    fontWeight: 600,
                                    mr: 1
                                  }}
                                />
                              )}
                              {isSyncingCategories && categorySyncProgress && (
                                <Chip
                                  size="small"
                                  label={`Kategóriák: ${categorySyncProgress.synced.toLocaleString('hu-HU')}/${categorySyncProgress.total.toLocaleString('hu-HU')}`}
                                  color="success"
                                  sx={{ height: '24px', fontWeight: 600 }}
                                />
                              )}
                            </Box>
                            {syncStatus && (
                              <Box sx={{ mt: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Termékek:
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {syncStatus.counts?.products?.synced || 0} / {syncStatus.counts?.products?.total || 0}
                                  </Typography>
                                </Box>
                                {syncStatus.lastSync?.productsFrom && (
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Utolsó webshop - ERP szinkron:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                      {formatTimeAgo(syncStatus.lastSync.productsFrom.date)}
                                    </Typography>
                                  </Box>
                                )}
                                {syncStatus.lastSync?.productsTo && (
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Utolsó ERP - webshop szinkron:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                      {formatTimeAgo(syncStatus.lastSync.productsTo.date)}
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    Előzmény gyorskártyák
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block' }}>
                                    Utolsó sikeres webshop - ERP: {syncStatus.recovery?.lastSuccessfulProductsFrom?.date ? formatTimeAgo(syncStatus.recovery.lastSuccessfulProductsFrom.date) : 'Nincs'}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', color: syncStatus.recovery?.lastFailedProductsFrom ? 'error.main' : 'text.secondary' }}>
                                    Utolsó hiba: {syncStatus.recovery?.lastFailedProductsFrom?.error || (syncStatus.recovery?.lastFailedProductsFrom ? 'Ismeretlen hiba' : 'Nincs')}
                                  </Typography>
                                  {syncStatus.recovery?.suggested && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      sx={{ mt: 1 }}
                                      onClick={() => handleRecoverySync(connection)}
                                      disabled={isSyncing}
                                    >
                                      Helyreállítási szinkron indítása
                                    </Button>
                                  )}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ 
                            p: 2, 
                            bgcolor: 'rgba(0, 0, 0, 0.02)', 
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              Felkészültség
                            </Typography>
                            {syncStatus && (
                              <>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Kategóriák:
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {syncStatus.counts?.categories?.synced || 0} / {syncStatus.counts?.categories?.total || 0}
                                  </Typography>
                                </Box>
                                {syncStatus.lastSync?.categories && (
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Utolsó kategória szinkron:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                      {formatTimeAgo(syncStatus.lastSync.categories.date)}
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    ÁFA leképezések:
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {syncStatus.counts?.taxMappings || 0}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Fizetési mód leképezések:
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {syncStatus.counts?.paymentMappings ?? 0}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Szállítási mód leképezések:
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {syncStatus.counts?.shippingMappings ?? 0}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Utolsó tesztelés:
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                    {connection.last_tested_at 
                                      ? new Date(connection.last_tested_at).toLocaleDateString('hu-HU')
                                      : 'Még nem tesztelve'
                                    }
                                  </Typography>
                                </Box>
                              </>
                            )}
                            {!syncStatus && (
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {connection.last_tested_at 
                                  ? new Date(connection.last_tested_at).toLocaleString('hu-HU')
                                  : 'Még nem tesztelve'
                                }
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    )
                  })()}

                  {/* Actions Section - Modern Clean Design */}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Termékszinkron
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 1,
                    pt: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider'
                  }}>
                    {/* Primary Action: Product sync (most common) */}
                    {connection.connection_type === 'shoprenter' && (
                      <Button
                        variant="contained"
                        size="medium"
                        startIcon={isSyncing ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
                        onClick={() => handleSyncProductsClick(connection)}
                        disabled={isSyncing}
                        sx={{
                          bgcolor: typeConfig.color,
                          color: 'white',
                          fontWeight: 600,
                          px: 3,
                          '&:hover': {
                            bgcolor: typeConfig.borderColor,
                          },
                          '&.Mui-disabled': {
                            bgcolor: 'rgba(0, 0, 0, 0.12)',
                            color: 'rgba(0, 0, 0, 0.26)'
                          }
                        }}
                      >
                        {isSyncing ? 'Szinkronizálás...' : 'Gyors frissítés (ajánlott)'}
                      </Button>
                    )}
                    {connection.connection_type === 'shoprenter' && (
                      <Button
                        variant="outlined"
                        size="medium"
                        startIcon={fullSyncConnectionId === connection.id ? <CircularProgress size={18} /> : <SyncIcon />}
                        onClick={() => handleGuidedFullSync(connection)}
                        disabled={isSyncing || fullSyncConnectionId === connection.id}
                        sx={{
                          fontWeight: 600,
                          px: 2.5,
                        }}
                      >
                        {fullSyncConnectionId === connection.id
                          ? (fullSyncStep === 'categories'
                              ? 'Teljes frissítés: kategóriák...'
                              : fullSyncStep === 'product_classes'
                                ? 'Teljes frissítés: termék típusok...'
                                : fullSyncStep === 'products'
                                  ? 'Teljes frissítés: termékek...'
                                  : 'Teljes frissítés...')
                          : 'Teljes frissítés'}
                      </Button>
                    )}
                    
                    {/* Secondary Action: Test Connection */}
                    <Button
                      variant="outlined"
                      size="medium"
                      startIcon={testingConnectionId === connection.id ? <CircularProgress size={18} /> : <RefreshIcon />}
                      onClick={() => handleTestConnection(connection)}
                      disabled={testingConnectionId === connection.id}
                      sx={{ 
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                        color: 'rgba(0, 0, 0, 0.87)',
                        fontWeight: 500,
                        px: 2.5,
                        '&:hover': {
                          borderColor: 'rgba(0, 0, 0, 0.4)',
                          bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                    >
                      {testingConnectionId === connection.id ? 'Tesztelés...' : 'Tesztelés'}
                    </Button>
                    
                    {/* More Actions Menu (Three-dot menu) */}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setMenuAnchorEl(e.currentTarget)
                        setMenuConnectionId(connection.id)
                      }}
                      sx={{
                        ml: 'auto',
                        color: 'rgba(0, 0, 0, 0.54)',
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                    
                    {/* Menu for additional actions */}
                    <Menu
                      anchorEl={menuAnchorEl}
                      open={Boolean(menuAnchorEl) && menuConnectionId === connection.id}
                      onClose={() => {
                        setMenuAnchorEl(null)
                        setMenuConnectionId(null)
                      }}
                      anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                      }}
                      transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      PaperProps={{
                        sx: {
                          mt: 1,
                          minWidth: 220,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }
                      }}
                    >
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem disabled sx={{ opacity: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Termékszinkron
                          </Typography>
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            handleSyncCategoriesClick(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                          disabled={isSyncingCategories}
                        >
                          <CategoryIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          {isSyncingCategories ? 'Szinkronizálás...' : 'Kategóriák szinkronizálása'}
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            handleSyncProductClassesClick(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                          disabled={isSyncingProductClasses}
                        >
                          <LocalOfferIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          {isSyncingProductClasses ? 'Szinkronizálás...' : 'Termék típusok szinkronizálása'}
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            handleSyncCustomersClick(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                          disabled={isSyncingCustomers}
                        >
                          <PeopleIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          {isSyncingCustomers ? 'Szinkronizálás...' : 'Vevők szinkronizálása'}
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem disabled sx={{ opacity: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Felkészültség
                          </Typography>
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            handleVatMappingClick(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                        >
                          <ReceiptIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          ÁFA leképezés
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            handlePaymentMappingClick(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                        >
                          <PaymentIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          Fizetési mód leképezés
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            handleShippingMappingClick(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                        >
                          <LocalShippingIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          Szállítási mód leképezés
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && (
                        <MenuItem
                          onClick={() => {
                            checkOrphanedProducts(connection)
                            setMenuAnchorEl(null)
                            setMenuConnectionId(null)
                          }}
                          disabled={checkingOrphaned}
                        >
                          <WarningIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                          {checkingOrphaned ? 'Ellenőrzés...' : 'Árva termékek'}
                        </MenuItem>
                      )}
                      {connection.connection_type === 'shoprenter' && <Divider />}
                      <MenuItem disabled sx={{ opacity: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          Előzmények
                        </Typography>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setSyncHistoryConnection(connection)
                          setSyncHistoryDialogOpen(true)
                          loadSyncLogs(connection.id)
                          setMenuAnchorEl(null)
                          setMenuConnectionId(null)
                        }}
                      >
                        <HistoryIcon sx={{ mr: 2, fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
                        Előzmények
                      </MenuItem>
                    </Menu>
                  </Box>
                  {connection.connection_type === 'shoprenter' && (
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        bgcolor: 'rgba(25, 118, 210, 0.03)',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Teljes frissítés folyamata
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          icon={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'categories'
                              ? <CircularProgress size={12} />
                              : <CheckCircleIcon />
                          }
                          label="1. Kategóriák"
                          color={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'categories'
                              ? 'primary'
                              : 'default'
                          }
                          variant={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'categories'
                              ? 'filled'
                              : 'outlined'
                          }
                        />
                        <Typography variant="caption" color="text.secondary">→</Typography>
                        <Chip
                          size="small"
                          icon={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'product_classes'
                              ? <CircularProgress size={12} />
                              : <CheckCircleIcon />
                          }
                          label="2. Termék típusok"
                          color={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'product_classes'
                              ? 'primary'
                              : 'default'
                          }
                          variant={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'product_classes'
                              ? 'filled'
                              : 'outlined'
                          }
                        />
                        <Typography variant="caption" color="text.secondary">→</Typography>
                        <Chip
                          size="small"
                          icon={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'products'
                              ? <CircularProgress size={12} />
                              : <CheckCircleIcon />
                          }
                          label="3. Termékek"
                          color={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'products'
                              ? 'primary'
                              : 'default'
                          }
                          variant={
                            fullSyncConnectionId === connection.id && fullSyncStep === 'products'
                              ? 'filled'
                              : 'outlined'
                          }
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Gyors frissítés csak a 3. lépést futtatja (termékek változásai).
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Sync Progress Panel - Sticky at top when syncing */}
      {syncingConnectionId && syncProgress && (
        <Paper 
          elevation={0}
          sx={{ 
            mt: 3, 
            mb: 3,
            p: 3,
            bgcolor: 'white',
            border: '2px solid',
            borderColor: syncProgress.status === 'completed' ? '#4caf50' : 
                         syncProgress.status === 'error' ? '#f44336' : 
                         syncProgress.status === 'stopped' ? '#ff9800' : 
                         '#2196f3',
            borderRadius: 2,
            position: 'sticky',
            top: 20,
            zIndex: 1000
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: syncPanelExpanded ? 3 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ 
                p: 1, 
                borderRadius: '50%', 
                bgcolor: syncProgress.status === 'completed' ? '#4caf50' : 
                         syncProgress.status === 'error' ? '#f44336' : 
                         syncProgress.status === 'stopped' ? '#ff9800' : 
                         '#9e9e9e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${
                  syncProgress.status === 'completed' ? 'rgba(76, 175, 80, 0.3)' : 
                  syncProgress.status === 'error' ? 'rgba(244, 67, 54, 0.3)' : 
                  syncProgress.status === 'stopped' ? 'rgba(255, 152, 0, 0.3)' : 
                  'rgba(158, 158, 158, 0.3)'
                }`
              }}>
                <CloudDownloadIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: syncProgress.status === 'completed' ? '#2e7d32' : 
                                                                          syncProgress.status === 'error' ? '#c62828' : 
                                                                          syncProgress.status === 'stopped' ? '#e65100' : 
                                                                          '#616161' }}>
                  Termék szinkron (webshop - ERP)
                </Typography>
                {currentSyncingConnectionRef.current && (
                  <Typography variant="body2" color="text.secondary">
                    {currentSyncingConnectionRef.current.name}
                  </Typography>
                )}
              </Box>
              {syncProgress.total > 0 && (
                <Chip
                  label={`${syncProgress.synced.toLocaleString('hu-HU')} / ${syncProgress.total.toLocaleString('hu-HU')} (${Math.round((syncProgress.synced / syncProgress.total) * 100)}%)`}
                  sx={{
                    bgcolor: syncProgress.status === 'completed' ? '#4caf50' : 
                             syncProgress.status === 'error' ? '#f44336' : 
                             syncProgress.status === 'stopped' ? '#ff9800' : 
                             '#2196f3',
                    color: 'white',
                    fontWeight: 600,
                    height: '32px'
                  }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {syncProgress.status === 'syncing' && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleStopSync}
                >
                  Leállítás
                </Button>
              )}
              {(syncProgress.status === 'completed' || syncProgress.status === 'error' || syncProgress.status === 'stopped') && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    // Clear progress on server so it doesn't restore on refresh
                    if (currentSyncingConnectionRef.current) {
                      try {
                        await fetch(`/api/connections/${currentSyncingConnectionRef.current.id}/sync-progress`, {
                          method: 'DELETE'
                        })
                      } catch (error) {
                        console.error('Error clearing progress:', error)
                      }
                    }
                    // Clear local state
                    setSyncingConnectionId(null)
                    currentSyncingConnectionRef.current = null
                    setSyncProgress(null)
                  }}
                >
                  Bezárás
                </Button>
              )}
              <IconButton
                size="small"
                onClick={() => setSyncPanelExpanded(!syncPanelExpanded)}
              >
                {syncPanelExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          {syncPanelExpanded && (
            <Box>
              {syncProgress && syncProgress.total > 0 ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {syncProgress.status === 'completed' ? 'Szinkronizálás befejezve!' : 
                       syncProgress.status === 'error' ? 'Szinkronizálás hibával leállt!' :
                       syncProgress.status === 'stopped' ? 'Szinkronizálás leállítva' :
                       syncProgress.status === 'syncing' || !syncProgress.status ? 'Szinkronizálás folyamatban...' :
                       'Szinkronizálás folyamatban...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      {syncProgress.synced} / {syncProgress.total} termék
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={syncProgress.total > 0 ? (syncProgress.synced / syncProgress.total) * 100 : 0}
                    sx={{ 
                      height: 12, 
                      borderRadius: 6, 
                      mb: 3,
                      bgcolor: 'rgba(0, 0, 0, 0.1)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: syncProgress.status === 'completed' ? '#4caf50' : 
                                 syncProgress.status === 'error' ? '#f44336' : 
                                 syncProgress.status === 'stopped' ? '#ff9800' : 
                                 '#2196f3',
                        borderRadius: 6
                      }
                    }}
                  />
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Összes termék:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="primary.main">
                        {syncProgress.total.toLocaleString('hu-HU')} db
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Szinkronizált termékek:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {syncProgress.synced.toLocaleString('hu-HU')} db
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Hátralévő termékek:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                        {(syncProgress.total - syncProgress.synced).toLocaleString('hu-HU')} db
                      </Typography>
                    </Box>
                    {syncProgress.total > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Előrehaladás:
                        </Typography>
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          {Math.round((syncProgress.synced / syncProgress.total) * 100)}%
                        </Typography>
                      </Box>
                    )}
                    {/* Batch progress display */}
                    {syncProgress.currentBatch && syncProgress.totalBatches && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Batch:</strong> {syncProgress.currentBatch} / {syncProgress.totalBatches}
                          {syncProgress.batchProgress && (
                            <span> ({syncProgress.batchProgress}/200 termék)</span>
                          )}
                        </Typography>
                      </Box>
                    )}
                    {syncProgress.total > 0 && syncProgress.synced < syncProgress.total && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                        <Typography variant="body2" color="info.dark">
                          <strong>Becsült hátralévő idő:</strong> {
                            (() => {
                              // Need at least 10 seconds of data for accurate estimation
                              if (syncProgress.synced > 10 && syncProgress.elapsed && syncProgress.elapsed >= 10) {
                                // Calculate actual sync rate (products per second)
                                const rate = syncProgress.synced / syncProgress.elapsed
                                
                                // Account for parallel processing (2 concurrent batches)
                                // Effective rate is higher due to parallelism, but not 2x due to overhead
                                const effectiveRate = rate * 1.4 // Conservative estimate for 2x parallelism
                                
                                // Calculate remaining products
                                const remaining = syncProgress.total - syncProgress.synced
                                
                                // Estimate remaining time in seconds
                                // Add 15% buffer for slowdowns (database, network, etc.)
                                const remainingSeconds = (remaining / effectiveRate) * 1.15
                                
                                // Convert to minutes (round up, minimum 1 minute)
                                const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60))
                                
                                // Format nicely
                                if (remainingMinutes < 60) {
                                  return `~${remainingMinutes} perc`
                                } else {
                                  const hours = Math.floor(remainingMinutes / 60)
                                  const minutes = remainingMinutes % 60
                                  return minutes > 0 ? `~${hours} óra ${minutes} perc` : `~${hours} óra`
                                }
                              } else {
                                // Not enough data yet - use conservative estimate
                                // Realistic rate: ~1-1.5 products/second = 60-90 products/minute
                                const conservativeRate = 60 // products per minute (conservative)
                                const remaining = syncProgress.total - syncProgress.synced
                                const remainingMinutes = Math.max(1, Math.ceil(remaining / conservativeRate))
                                
                                if (remainingMinutes < 60) {
                                  return `~${remainingMinutes} perc (becslés)`
                                } else {
                                  const hours = Math.floor(remainingMinutes / 60)
                                  const minutes = remainingMinutes % 60
                                  return minutes > 0 ? `~${hours} óra ${minutes} perc (becslés)` : `~${hours} óra (becslés)`
                                }
                              }
                            })()
                          }
                        </Typography>
                      </Box>
                    )}
                    {syncProgress.status === 'completed' && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                        <Typography variant="body2" color="success.dark" fontWeight="medium">
                          ✓ Szinkronizálás sikeresen befejeződött!
                        </Typography>
                      </Box>
                    )}
                    {syncProgress.status === 'stopped' && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                        <Typography variant="body2" color="warning.dark" fontWeight="medium">
                          ⚠ Szinkronizálás leállítva
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body1">
                      Termékek listájának betöltése...
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Kérjük, várjon.</strong> A szinkronizálás eltarthat néhány percig, ha sok termék van a webshopban.
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* New Connection Dialog */}
      <Dialog
        open={newConnectionDialogOpen}
        onClose={() => setNewConnectionDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: '#2196f3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
            }}>
              <AddIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
              Új kapcsolat hozzáadása
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information Section */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#2196f3',
                  borderRadius: 2
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <InfoIcon sx={{ color: 'white', fontSize: '20px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1rem' }}>
                    Alapinformációk
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Kapcsolat neve *"
                      value={newConnection.name}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                      required
                      helperText="A kapcsolat azonosító neve (pl: Fő webshop, Másodlagos webshop)"
                      placeholder="Pl.: Fő webshop"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Típus *</InputLabel>
                      <Select
                        value={newConnection.connection_type}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, connection_type: e.target.value as any }))}
                        label="Típus *"
                        required
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'white'
                          }
                        }}
                      >
                        <MenuItem value="shoprenter">ShopRenter</MenuItem>
                        <MenuItem value="szamlazz">Szamlazz.hu</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={newConnection.is_active}
                            onChange={(e) => setNewConnection(prev => ({ ...prev, is_active: e.target.checked }))}
                          />
                        }
                        label="Aktív"
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* API Settings Section - Conditional based on connection type */}
            {newConnection.connection_type === 'shoprenter' && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: '#4caf50',
                    borderRadius: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#4caf50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                    }}>
                      <SettingsIcon sx={{ color: 'white', fontSize: '20px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1rem' }}>
                      ShopRenter API Beállítások
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="API URL *"
                        value={newConnection.api_url}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, api_url: e.target.value }))}
                        required
                        placeholder="https://shopname.api2.myshoprenter.hu"
                        helperText="ShopRenter API URL formátum: https://shopname.api2.myshoprenter.hu"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Client ID *"
                        value={newConnection.username}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, username: e.target.value }))}
                        required
                        helperText="ShopRenter API Client ID"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Client Secret *"
                        type="password"
                        value={newConnection.password}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, password: e.target.value }))}
                        required
                        helperText="ShopRenter API Client Secret"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}

            {/* Szamlazz.hu Settings Section */}
            {newConnection.connection_type === 'szamlazz' && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: '#ff9800',
                    borderRadius: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#ff9800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                    }}>
                      <ReceiptIcon sx={{ color: 'white', fontSize: '20px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', fontSize: '1rem' }}>
                      Szamlazz.hu Beállítások
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Agent Key *"
                        value={newConnection.agent_key}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, agent_key: e.target.value }))}
                        required
                        placeholder="Az Agent Key a Szamlazz.hu fiókjából érhető el"
                        helperText="A Szamlazz.hu Agent Key-je (a fiók beállításaiból)"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}
            
            {/* Search Console Configuration - Optional (only for ShopRenter) */}
            {newConnection.connection_type === 'shoprenter' && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: newConnection.search_console_enabled ? '#9c27b0' : '#e0e0e0',
                    borderRadius: 2,
                    opacity: newConnection.search_console_enabled ? 1 : 0.7
                  }}
                >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: newConnection.search_console_enabled ? '#9c27b0' : '#e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: newConnection.search_console_enabled ? '0 4px 12px rgba(156, 39, 176, 0.3)' : 'none'
                  }}>
                    <SearchIcon sx={{ color: 'white', fontSize: '20px' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: newConnection.search_console_enabled ? '#7b1fa2' : '#757575', fontSize: '1rem' }}>
                      Google Search Console (Opcionális)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SEO optimalizáláshoz és keresési adatokhoz
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={newConnection.search_console_enabled}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, search_console_enabled: e.target.checked }))}
                      />
                    }
                    label=""
                  />
                </Box>
                {newConnection.search_console_enabled && (
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Property URL *"
                        value={newConnection.search_console_property_url}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, search_console_property_url: e.target.value }))}
                        required={newConnection.search_console_enabled}
                        placeholder="https://vasalatmester.hu vagy sc-domain:vasalatmester.hu"
                        helperText="A Search Console property URL-je"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Service Account Email *"
                        value={newConnection.search_console_client_email}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, search_console_client_email: e.target.value }))}
                        required={newConnection.search_console_enabled}
                        placeholder="service-account@project.iam.gserviceaccount.com"
                        helperText="Google Service Account email"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Private Key *"
                        type="password"
                        value={newConnection.search_console_private_key}
                        onChange={(e) => setNewConnection(prev => ({ ...prev, search_console_private_key: e.target.value }))}
                        required={newConnection.search_console_enabled}
                        multiline
                        rows={4}
                        helperText="Service Account private key (JSON formátum)"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                )}
              </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setNewConnectionDialogOpen(false)}
            variant="outlined"
          >
            Mégse
          </Button>
          <Button 
            onClick={handleCreateConnection} 
            variant="contained"
            startIcon={creatingConnection ? <CircularProgress size={20} /> : <AddIcon />}
            disabled={
              creatingConnection || 
              !newConnection.name || 
              (newConnection.connection_type === 'shoprenter' && (!newConnection.api_url || !newConnection.username || !newConnection.password)) ||
              (newConnection.connection_type === 'szamlazz' && !newConnection.agent_key)
            }
            sx={{ minWidth: 120 }}
          >
            {creatingConnection ? 'Létrehozás...' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Connection Dialog */}
      <Dialog
        open={editConnectionDialogOpen}
        onClose={() => {
          setEditConnectionDialogOpen(false)
          setEditingConnection(null)
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: '#2196f3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
            }}>
              <EditIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
              Kapcsolat szerkesztése
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information Section */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3,
                  bgcolor: 'white',
                  border: '2px solid',
                  borderColor: '#2196f3',
                  borderRadius: 2
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}>
                    <InfoIcon sx={{ color: 'white', fontSize: '20px' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1rem' }}>
                    Alapinformációk
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Kapcsolat neve *"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      helperText="A kapcsolat azonosító neve"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused': {
                            bgcolor: 'white'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Típus *</InputLabel>
                      <Select
                        value={editFormData.connection_type}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, connection_type: e.target.value as any }))}
                        label="Típus *"
                        required
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            bgcolor: 'white'
                          }
                        }}
                      >
                        <MenuItem value="shoprenter">ShopRenter</MenuItem>
                        <MenuItem value="szamlazz">Szamlazz.hu</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={editFormData.is_active}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                          />
                        }
                        label="Aktív"
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* API Settings Section - Conditional based on connection type */}
            {editFormData.connection_type === 'shoprenter' && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: '#4caf50',
                    borderRadius: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#4caf50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                    }}>
                      <SettingsIcon sx={{ color: 'white', fontSize: '20px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1rem' }}>
                      ShopRenter API Beállítások
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="API URL *"
                        value={editFormData.api_url}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, api_url: e.target.value }))}
                        required
                        placeholder="https://shopname.api2.myshoprenter.hu"
                        helperText="ShopRenter API URL formátum: https://shopname.api2.myshoprenter.hu"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Client ID *"
                        value={editFormData.username}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))}
                        required
                        helperText="ShopRenter API Client ID"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Client Secret"
                        type="password"
                        value={editFormData.password}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))}
                        helperText="Hagyja üresen, ha nem szeretné megváltoztatni"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}

            {/* Szamlazz.hu Settings Section */}
            {editFormData.connection_type === 'szamlazz' && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: '#ff9800',
                    borderRadius: 2
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Box sx={{ 
                      p: 1, 
                      borderRadius: '50%', 
                      bgcolor: '#ff9800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                    }}>
                      <ReceiptIcon sx={{ color: 'white', fontSize: '20px' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100', fontSize: '1rem' }}>
                      Szamlazz.hu Beállítások
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Agent Key *"
                        value={editFormData.agent_key}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, agent_key: e.target.value }))}
                        required={editFormData.connection_type === 'szamlazz'}
                        placeholder="Az Agent Key a Szamlazz.hu fiókjából érhető el"
                        helperText={(editingConnection as any)?.agent_key || (editingConnection?.connection_type === 'szamlazz' && editingConnection?.password)
                          ? "Hagyja üresen, ha nem szeretné megváltoztatni" 
                          : "A Szamlazz.hu Agent Key-je (a fiók beállításaiból)"}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}
            
            {/* Search Console Configuration - Optional (only for ShopRenter) */}
            {editFormData.connection_type === 'shoprenter' && (
              <Grid item xs={12}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3,
                    bgcolor: 'white',
                    border: '2px solid',
                    borderColor: editFormData.search_console_enabled ? '#9c27b0' : '#e0e0e0',
                    borderRadius: 2,
                    opacity: editFormData.search_console_enabled ? 1 : 0.7
                  }}
                >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '50%', 
                    bgcolor: editFormData.search_console_enabled ? '#9c27b0' : '#e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: editFormData.search_console_enabled ? '0 4px 12px rgba(156, 39, 176, 0.3)' : 'none'
                  }}>
                    <SearchIcon sx={{ color: 'white', fontSize: '20px' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: editFormData.search_console_enabled ? '#7b1fa2' : '#757575', fontSize: '1rem' }}>
                      Google Search Console (Opcionális)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SEO optimalizáláshoz és keresési adatokhoz
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editFormData.search_console_enabled}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, search_console_enabled: e.target.checked }))}
                      />
                    }
                    label=""
                  />
                </Box>
                {editFormData.search_console_enabled && (
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Property URL *"
                        value={editFormData.search_console_property_url}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, search_console_property_url: e.target.value }))}
                        required={editFormData.search_console_enabled}
                        placeholder="https://vasalatmester.hu vagy sc-domain:vasalatmester.hu"
                        helperText="A Search Console property URL-je"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Service Account Email *"
                        value={editFormData.search_console_client_email}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, search_console_client_email: e.target.value }))}
                        required={editFormData.search_console_enabled}
                        placeholder="service-account@project.iam.gserviceaccount.com"
                        helperText="Google Service Account email"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label={editingConnection?.search_console_private_key ? "Private Key" : "Private Key *"}
                        type="password"
                        value={editFormData.search_console_private_key}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, search_console_private_key: e.target.value }))}
                        required={editFormData.search_console_enabled && !editingConnection?.search_console_private_key}
                        multiline
                        rows={4}
                        helperText={editingConnection?.search_console_private_key 
                          ? "Hagyja üresen, ha nem szeretné megváltoztatni" 
                          : "Service Account private key (JSON formátum)"}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)',
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)'
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white'
                            }
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                )}
              </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => {
              setEditConnectionDialogOpen(false)
              setEditingConnection(null)
            }}
            variant="outlined"
          >
            Mégse
          </Button>
          <Button 
            onClick={handleUpdateConnection} 
            variant="contained"
            startIcon={updatingConnection ? <CircularProgress size={20} /> : <EditIcon />}
            disabled={
              updatingConnection || 
              !editFormData.name || 
              (editFormData.connection_type === 'shoprenter' && (!editFormData.api_url || !editFormData.username)) ||
              (editFormData.connection_type === 'szamlazz' && !editFormData.agent_key)
            }
            sx={{ minWidth: 120 }}
          >
            {updatingConnection ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DeleteIcon color="error" />
            <Typography variant="h6">
              Kapcsolatok törlése
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Biztosan törölni szeretné a kiválasztott {selectedConnections.length} kapcsolatot?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ez a művelet nem visszavonható. A kapcsolatok soft delete módszerrel lesznek törölve.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
          >
            Mégse
          </Button>
          <Button 
            onClick={handleDeleteConnections} 
            variant="contained"
            color="error"
            startIcon={deletingConnections ? <CircularProgress size={20} /> : <DeleteIcon />}
            disabled={deletingConnections}
            sx={{ minWidth: 120 }}
          >
            {deletingConnections ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync Confirmation Dialog */}
      <Dialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: '#9e9e9e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(158, 158, 158, 0.3)'
            }}>
              <CloudDownloadIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#616161' }}>
              Termékek szinkronizálása a webshopból
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Mikor használja ezt?</AlertTitle>
            <Typography variant="body2">
              Csak akkor töltse le / szinkronizálja a webshopból a termékeket, ha a webshopban történt olyan változás, amit az ERP-ben nem tud kezelni.
              <br />
              <strong>Példa:</strong> tömeges módosítás a ShopRenter admin felületén.
            </Typography>
          </Alert>
          
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Figyelem</AlertTitle>
            <Typography variant="body2">
              A webshopból érkező szinkron <strong>felülírhatja az ERP-ben lévő termékmezőket</strong>. Csak akkor indítsa, ha biztos benne,
              hogy a webshop adatai most fontosabbak.
              <br />
              <strong>Általában az ERP a vezérlő rendszer — a teljes letöltés csak szükség esetén kell.</strong>
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Gyors frissítés (ajánlott)
            </Typography>
            <Typography variant="body2">
              Ez a művelet csak az új vagy módosult termékeket frissíti a webshopból az ERP-be.
              A webshopból eltűnt termékeket az ERP töröltként jelöli. Ez a leggyorsabb és napi használatra ajánlott mód.
            </Typography>
          </Alert>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              A termék szinkron önmagában nem frissíti automatikusan a kategória- és termék típus törzseket.
              Teljes egyeztetéshez használja a kártyán a <strong>Teljes frissítés</strong> gombot (Kategóriák - Termék típusok - Termékek).
            </Typography>
          </Alert>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(25, 118, 210, 0.04)', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Mi fog most történni?
            </Typography>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              <li><Typography variant="body2" color="text.secondary">Lekérdezzük a webshop terméklistát.</Typography></li>
              <li><Typography variant="body2" color="text.secondary">Kiválasztjuk csak a változott / új termékeket.</Typography></li>
              <li><Typography variant="body2" color="text.secondary">Frissítjük az ERP termékadatokat (képek, attribútumok, kapcsolatok).</Typography></li>
              <li><Typography variant="body2" color="text.secondary">A hiányzó webshop termékeket töröltként jelöljük.</Typography></li>
            </Box>
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Biztosan elindítja a termékek szinkronizálását a webshopból az ERP-be?
          </Typography>
          <Box sx={{ 
            p: 2, 
            bgcolor: 'rgba(0, 0, 0, 0.02)', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Szinkronizált adatok:</strong>
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <li><Typography variant="body2" color="text.secondary">Termék alapadatok (név, SKU, ár, stb.)</Typography></li>
              <li><Typography variant="body2" color="text.secondary">Termékleírások és SEO adatok</Typography></li>
              <li><Typography variant="body2" color="text.secondary">Termékképek és alt szövegek</Typography></li>
              <li><Typography variant="body2" color="text.secondary">Kategória kapcsolatok</Typography></li>
              <li><Typography variant="body2" color="text.secondary">Termék attribútumok</Typography></li>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setSyncDialogOpen(false)}
            variant="outlined"
          >
            Mégse
          </Button>
          <Button 
            onClick={() => {
              if (syncDialogConnection) {
                setSyncDialogOpen(false)
                handleSyncProducts(syncDialogConnection, false)
              }
            }}
            variant="contained"
            color="primary"
            startIcon={<CloudDownloadIcon />}
          >
            Szinkron indítása
          </Button>
        </DialogActions>
      </Dialog>

      {/* VAT Mapping Dialog */}
      <Dialog
        open={vatMappingDialogOpen}
        onClose={() => setVatMappingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon />
            <Typography variant="h6">ÁFA leképezés</Typography>
          </Box>
          {vatMappingConnection && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {vatMappingConnection.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {loadingVatMapping ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Mi az ÁFA leképezés?
                </Typography>
                <Typography variant="body2">
                  Az ÁFA leképezés összekapcsolja az ERP rendszerben lévő ÁFA kulcsokat a ShopRenter webshopban lévő adóosztályokkal.
                  Ez biztosítja, hogy amikor termékeket szinkronizál, a megfelelő ÁFA kulcs kerüljön beállításra a ShopRenter oldalon is.
                </Typography>
              </Alert>

              <TableContainer component={Paper} elevation={1}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 600 }}>ERP ÁFA kulcs</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">ShopRenter adóosztály</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center" width="200">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vatRates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            Nincs ÁFA kulcs létrehozva. Kérjük, hozzon létre ÁFA kulcsokat az "Áfák" oldalon.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      vatRates.map((vat) => {
                        const mapping = mappings.find(m => m.vat_id === vat.id)
                        const mappedTaxClass = mapping
                          ? shoprenterTaxClasses.find(tc => tc.id === mapping.shoprenter_tax_class_id)
                          : null

                        return (
                          <TableRow key={vat.id} hover>
                            <TableCell>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                  {vat.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {vat.kulcs}%
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              {mappedTaxClass ? (
                                <Chip
                                  label={mappedTaxClass.name}
                                  color="success"
                                  size="small"
                                />
                              ) : (
                                <Chip
                                  label="Nincs leképezve"
                                  color="default"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <FormControl size="small" sx={{ minWidth: 200 }}>
                                <Select
                                  value={mapping?.shoprenter_tax_class_id || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSaveVatMapping(vat.id, e.target.value)
                                    } else if (mapping) {
                                      handleDeleteVatMapping(vat.id)
                                    }
                                  }}
                                  disabled={savingMapping}
                                  displayEmpty
                                >
                                  <MenuItem value="">
                                    <em>Nincs leképezve</em>
                                  </MenuItem>
                                  {shoprenterTaxClasses.map((tc) => (
                                    <MenuItem key={tc.id} value={tc.id}>
                                      {tc.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {shoprenterTaxClasses.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Nem sikerült betölteni a ShopRenter adóosztályokat. Kérjük, ellenőrizze a kapcsolat beállításait.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setVatMappingDialogOpen(false)}>
            Bezárás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment method mapping dialog */}
      <Dialog
        open={paymentMappingDialogOpen}
        onClose={() => setPaymentMappingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentIcon />
            <Typography variant="h6">Fizetési mód leképezés</Typography>
          </Box>
          {paymentMappingConnection && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {paymentMappingConnection.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {loadingPaymentMapping ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                {shoprenterPaymentModes.length > 0
                  ? 'Válassza ki a ShopRenter fizetési módot és az ERP fizetési módot. A rendelés feldolgozásnál ezt a leképezést használja a rendszer.'
                  : 'A webshop fizetési mód kódját (pl. COD, bank_transfer) kösse az ERP fizetési módhoz. Ha az API elérhető, a ShopRenter módok listája automatikusan megjelenik.'}
              </Alert>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                {shoprenterPaymentModes.length > 0 ? (
                  <FormControl size="small" sx={{ minWidth: 280 }}>
                    <InputLabel>ShopRenter fizetési mód</InputLabel>
                    <Select
                      value={selectedShoprenterPaymentCode}
                      onChange={e => setSelectedShoprenterPaymentCode(e.target.value)}
                      label="ShopRenter fizetési mód"
                    >
                      <MenuItem value=""><em>Válasszon</em></MenuItem>
                      {shoprenterPaymentModes.map(pm => (
                        <MenuItem key={pm.id} value={pm.code}>{pm.name} ({pm.code})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    size="small"
                    label="Platform kód"
                    placeholder="pl. bank_transfer"
                    value={newPaymentCode}
                    onChange={e => setNewPaymentCode(e.target.value)}
                    sx={{ minWidth: 140 }}
                  />
                )}
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>ERP fizetési mód</InputLabel>
                  <Select
                    value={newPaymentMethodId}
                    onChange={e => setNewPaymentMethodId(e.target.value)}
                    label="ERP fizetési mód"
                  >
                    <MenuItem value=""><em>Válasszon</em></MenuItem>
                    {paymentMethods.map(pm => (
                      <MenuItem key={pm.id} value={pm.id}>{pm.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  disabled={(shoprenterPaymentModes.length > 0 ? !selectedShoprenterPaymentCode : !newPaymentCode.trim()) || !newPaymentMethodId || savingPaymentMapping}
                  onClick={() => {
                    const code = shoprenterPaymentModes.length > 0 ? selectedShoprenterPaymentCode : newPaymentCode.trim()
                    const name = shoprenterPaymentModes.length > 0 ? shoprenterPaymentModes.find(p => p.code === selectedShoprenterPaymentCode)?.name : null
                    handleSavePaymentMapping(newPaymentMethodId, code, name)
                  }}
                >
                  {savingPaymentMapping ? 'Mentés…' : 'Hozzáadás'}
                </Button>
              </Box>
              <TableContainer component={Paper} elevation={1}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Platform kód</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>ERP fizetési mód</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center" width="100">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentMappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Nincs leképezés. Adjon hozzá platform kódot és ERP fizetési módot.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paymentMappings.map(m => {
                        const pm = paymentMethods.find(p => p.id === m.payment_method_id)
                        return (
                          <TableRow key={m.platform_payment_code} hover>
                            <TableCell>{m.platform_payment_code}</TableCell>
                            <TableCell>{pm?.name ?? m.payment_method_id}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeletePaymentMapping(m.platform_payment_code)}
                                disabled={savingPaymentMapping}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setPaymentMappingDialogOpen(false)}>Bezárás</Button>
        </DialogActions>
      </Dialog>

      {/* Shipping method mapping dialog */}
      <Dialog
        open={shippingMappingDialogOpen}
        onClose={() => setShippingMappingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon />
            <Typography variant="h6">Szállítási mód leképezés</Typography>
          </Box>
          {shippingMappingConnection && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {shippingMappingConnection.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {loadingShippingMapping ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                {shoprenterShippingModes.length > 0
                  ? 'Válassza ki a ShopRenter szállítási módot és az ERP szállítási módot. A rendelés feldolgozásnál ezt a leképezést használja a rendszer.'
                  : 'A webshop szállítási mód kódját (pl. GLSPARCELPOINT, WSESHIP) kösse az ERP szállítási módhoz. Ha az API elérhető, a ShopRenter módok listája automatikusan megjelenik.'}
              </Alert>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                {shoprenterShippingModes.length > 0 ? (
                  <FormControl size="small" sx={{ minWidth: 280 }}>
                    <InputLabel>ShopRenter szállítási mód</InputLabel>
                    <Select
                      value={selectedShoprenterShippingExtension}
                      onChange={e => setSelectedShoprenterShippingExtension(e.target.value)}
                      label="ShopRenter szállítási mód"
                    >
                      <MenuItem value=""><em>Válasszon</em></MenuItem>
                      {shoprenterShippingModes.map(sm => (
                        <MenuItem key={sm.id} value={sm.extension}>{sm.name} ({sm.extension})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    size="small"
                    label="Platform kód"
                    placeholder="pl. GLSPARCELPOINT"
                    value={newShippingCode}
                    onChange={e => setNewShippingCode(e.target.value)}
                    sx={{ minWidth: 160 }}
                  />
                )}
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>ERP szállítási mód</InputLabel>
                  <Select
                    value={newShippingMethodId}
                    onChange={e => setNewShippingMethodId(e.target.value)}
                    label="ERP szállítási mód"
                  >
                    <MenuItem value=""><em>Válasszon</em></MenuItem>
                    {shippingMethods.map(sm => (
                      <MenuItem key={sm.id} value={sm.id}>{sm.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  disabled={(shoprenterShippingModes.length > 0 ? !selectedShoprenterShippingExtension : !newShippingCode.trim()) || !newShippingMethodId || savingShippingMapping}
                  onClick={() => {
                    const code = shoprenterShippingModes.length > 0 ? selectedShoprenterShippingExtension : newShippingCode.trim()
                    const name = shoprenterShippingModes.length > 0 ? shoprenterShippingModes.find(s => s.extension === selectedShoprenterShippingExtension)?.name : null
                    handleSaveShippingMapping(newShippingMethodId, code, name)
                  }}
                >
                  {savingShippingMapping ? 'Mentés…' : 'Hozzáadás'}
                </Button>
              </Box>
              <TableContainer component={Paper} elevation={1}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Platform kód</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>ERP szállítási mód</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center" width="100">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shippingMappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Nincs leképezés. Adjon hozzá platform kódot és ERP szállítási módot.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      shippingMappings.map(m => {
                        const sm = shippingMethods.find(s => s.id === m.shipping_method_id)
                        return (
                          <TableRow key={m.platform_shipping_code} hover>
                            <TableCell>{m.platform_shipping_code}</TableCell>
                            <TableCell>{sm?.name ?? m.shipping_method_id}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteShippingMapping(m.platform_shipping_code)}
                                disabled={savingShippingMapping}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setShippingMappingDialogOpen(false)}>Bezárás</Button>
        </DialogActions>
      </Dialog>

      {/* Sync History Dialog */}
      <Dialog 
        open={syncHistoryDialogOpen} 
        onClose={() => setSyncHistoryDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6" component="span">
              Szinkronizálási előzmények
            </Typography>
            {syncHistoryConnection && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                - {syncHistoryConnection.name || 'Ismeretlen kapcsolat'}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingSyncLogs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : syncLogs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Még nincs szinkronizálási előzmény
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                A szinkronizálások előzményei itt jelennek meg
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <Alert severity="success" variant="outlined">
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Utolsó sikeres webshop - ERP
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(syncLogs.find(l => l.sync_direction === 'from_shoprenter' && l.status === 'completed')?.started_at
                      ? new Date(syncLogs.find(l => l.sync_direction === 'from_shoprenter' && l.status === 'completed')!.started_at).toLocaleString('hu-HU')
                      : 'Nincs sikeres bejegyzés')}
                  </Typography>
                </Alert>
                <Alert severity="error" variant="outlined">
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Utolsó hiba oka
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(syncLogs.find(l => l.sync_direction === 'from_shoprenter' && (l.status === 'failed' || l.status === 'stopped'))?.error_message
                      || 'Nincs hiba bejegyzés')}
                  </Typography>
                </Alert>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Dátum</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Típus</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Irány</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Státusz</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Statisztika</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Időtartam</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Felhasználó</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {syncLogs.map((log) => {
                    const startDate = new Date(log.started_at)
                    const completedDate = log.completed_at ? new Date(log.completed_at) : null
                    const duration = log.duration_seconds 
                      ? `${Math.floor(log.duration_seconds / 60)}:${String(log.duration_seconds % 60).padStart(2, '0')}`
                      : completedDate
                      ? `${Math.floor((completedDate.getTime() - startDate.getTime()) / 1000 / 60)}:${String(Math.floor((completedDate.getTime() - startDate.getTime()) / 1000 % 60)).padStart(2, '0')}`
                      : '-'

                    const getSyncTypeLabel = (type: string) => {
                      const types: Record<string, string> = {
                        'full': 'Teljes szinkronizálás',
                        'incremental': 'Inkrementális szinkronizálás',
                        'single_product': 'Egy termék',
                        'bulk': 'Tömeges szinkronizálás',
                        'category': 'Kategóriák szinkronizálása'
                      }
                      return types[type] || type
                    }

                    const getSyncDirectionLabel = (direction: string) => {
                      const directions: Record<string, string> = {
                        'from_shoprenter': 'Webshop → ERP',
                        'to_shoprenter': 'ERP → Webshop'
                      }
                      return directions[direction] || direction
                    }

                    const getStatusChip = (status: string) => {
                      const statusConfig: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
                        'completed': { label: 'Befejezve', color: 'success' },
                        'failed': { label: 'Sikertelen', color: 'error' },
                        'stopped': { label: 'Megszakítva', color: 'warning' },
                        'running': { label: 'Folyamatban', color: 'info' }
                      }
                      const config = statusConfig[status] || { label: status, color: 'default' }
                      return <Chip label={config.label} color={config.color} size="small" />
                    }

                    return (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {startDate.toLocaleDateString('hu-HU', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit' 
                            })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {startDate.toLocaleTimeString('hu-HU', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {getSyncTypeLabel(log.sync_type)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {getSyncDirectionLabel(log.sync_direction)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {getStatusChip(log.status)}
                        </TableCell>
                        <TableCell align="center">
                          <Box>
                            {(() => {
                              const isCategorySync = log.sync_type === 'category'
                              const itemLabel = isCategorySync ? 'kategória' : 'termék'
                              
                              if (log.sync_type === 'incremental' && log.skipped_count > 0) {
                                // For incremental sync, show: synced / total evaluated (synced + skipped)
                                return (
                                  <>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {log.synced_count} szinkronizálva
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {log.skipped_count} kihagyva
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      Összesen: {log.total_products} {itemLabel}
                                    </Typography>
                                    {log.total_products > 0 && (
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {Math.round((log.synced_count / log.total_products) * 100)}% szinkronizálva
                                      </Typography>
                                    )}
                                  </>
                                )
                              } else {
                                // For full sync or category sync, show: synced / total
                                return (
                                  <>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {log.synced_count} / {log.total_products} {itemLabel}
                                    </Typography>
                                    {log.total_products > 0 && (
                                      <Typography variant="caption" color="text.secondary">
                                        {Math.round((log.synced_count / log.total_products) * 100)}%
                                      </Typography>
                                    )}
                                    {log.skipped_count > 0 && (
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {log.skipped_count} kihagyva
                                      </Typography>
                                    )}
                                  </>
                                )
                              }
                            })()}
                            {log.error_count > 0 && (
                              <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                                {log.error_count} hiba
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="text.secondary">
                            {duration}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {log.user_email || 'Ismeretlen'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setSyncHistoryDialogOpen(false)}>
            Bezárás
          </Button>
        </DialogActions>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog
        open={migrationDialogOpen}
        onClose={() => {
          setMigrationDialogOpen(false)
          setMigrationConnection(null)
          setOrphanedConnections([])
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WarningIcon sx={{ color: '#ff9800', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Árva termékek migrálása
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>Árva termékek találhatók</AlertTitle>
            A rendszer törölt kapcsolatokból talált termékeket, amelyek ugyanazokkal a hitelesítő adatokkal rendelkeznek, mint a jelenlegi kapcsolat.
            Migrálhatja ezeket a termékeket a jelenlegi kapcsolathoz, hogy megőrizze az adatokat.
          </Alert>
          
          {migrationConnection && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Cél kapcsolat:
              </Typography>
              <Chip 
                label={migrationConnection.name || 'Ismeretlen'} 
                color="primary" 
                size="small"
              />
            </Box>
          )}

          {orphanedConnections.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Törölt kapcsolatok árva termékekkel:
              </Typography>
              {orphanedConnections.map((orphanedConn) => (
                <Paper
                  key={orphanedConn.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'grey.50'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {orphanedConn.name || 'Ismeretlen kapcsolat'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Törölve: {new Date(orphanedConn.deletedAt).toLocaleDateString('hu-HU')}
                      </Typography>
                    </Box>
                    <Chip 
                      label={`${orphanedConn.productCount} termék`} 
                      color="warning" 
                      size="small"
                    />
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={migrating ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                    onClick={() => handleMigrateProducts(orphanedConn.id)}
                    disabled={migrating}
                    fullWidth
                    sx={{
                      bgcolor: '#ff9800',
                      '&:hover': {
                        bgcolor: '#f57c00'
                      }
                    }}
                  >
                    {migrating ? 'Migrálás...' : 'Termékek migrálása'}
                  </Button>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => {
              setMigrationDialogOpen(false)
              setMigrationConnection(null)
              setOrphanedConnections([])
            }}
          >
            Bezárás
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
