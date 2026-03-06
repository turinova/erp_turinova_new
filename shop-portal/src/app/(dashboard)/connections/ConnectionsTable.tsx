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
  MoreVert as MoreVertIcon
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
  const [forceSyncEnabled, setForceSyncEnabled] = useState(false) // Force full sync option
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
  const [syncHistoryDialogOpen, setSyncHistoryDialogOpen] = useState(false)
  const [syncHistoryConnection, setSyncHistoryConnection] = useState<WebshopConnection | null>(null)
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
    setForceSyncEnabled(false) // Reset to default (incremental sync)
    setSyncDialogOpen(true)
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
            'A webshop API túl sok kérést kapott. Kérjük, várjon 2-3 percet, majd próbálja újra. Ha a probléma továbbra is fennáll, ellenőrizze a kapcsolat beállításait.',
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
                              Szinkronizálási állapot
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                              {getStatusIndicator(connection)}
                              {isSyncing && syncProgress && (
                                <Chip
                                  size="small"
                                  label={`Importálás: ${syncProgress.synced.toLocaleString('hu-HU')}/${syncProgress.total.toLocaleString('hu-HU')}`}
                                  color="primary"
                                  sx={{ height: '24px', fontWeight: 600 }}
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
                                      Utolsó importálás:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                      {formatTimeAgo(syncStatus.lastSync.productsFrom.date)}
                                    </Typography>
                                  </Box>
                                )}
                                {syncStatus.lastSync?.productsTo && (
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Utolsó szinkronizálás webshopba:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                      {formatTimeAgo(syncStatus.lastSync.productsTo.date)}
                                    </Typography>
                                  </Box>
                                )}
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
                              További információk
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
                                      Utolsó kategória szinkronizálás:
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
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 1,
                    pt: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider'
                  }}>
                    {/* Primary Action: Import (most common) */}
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
                        {isSyncing ? 'Importálás...' : 'Importálás webshopból'}
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
                  Importálás webshopból
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
                      {syncProgress.status === 'completed' ? 'Importálás befejezve!' : 
                       syncProgress.status === 'error' ? 'Importálás hibával leállt!' :
                       syncProgress.status === 'stopped' ? 'Importálás leállítva' :
                       syncProgress.status === 'syncing' || !syncProgress.status ? 'Importálás folyamatban...' :
                       'Importálás folyamatban...'}
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
              Importálás webshopból
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Mikor használja ezt?</AlertTitle>
            <Typography variant="body2">
              Csak akkor importáljon a webshopból, ha a webshopban történt módosítás, amit az ERP-ben nem lehet megtenni.
              <br />
              <strong>Példa:</strong> Termékek tömeges módosítása a webshop admin felületén.
            </Typography>
          </Alert>
          
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Figyelem</AlertTitle>
            <Typography variant="body2">
              Az importálás <strong>felülírhatja az ERP-ben lévő adatokat</strong>. Csak akkor importáljon, ha biztos benne, 
              hogy a webshop változásai fontosabbak, mint az ERP-ben lévő adatok.
              <br />
              <strong>Az ERP az adatok forrása - általában nem szükséges importálni!</strong>
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {forceSyncEnabled ? 'Teljes importálás' : 'Inkrementális importálás (ajánlott)'}
            </Typography>
            <Typography variant="body2">
              {forceSyncEnabled ? (
                <>
                  A teljes importálás során <strong>minden termékadat</strong> frissül a webshopból. 
                  Ez biztosítja, hogy az ERP adatbázis pontosan egyezzen a ShopRenter webshop adataival.
                </>
              ) : (
                <>
                  Az inkrementális importálás csak az <strong>új vagy módosított termékeket</strong> importálja, 
                  ami <strong>80-90%-kal gyorsabb</strong> lehet. Automatikusan észleli a törölt termékeket is.
                </>
              )}
            </Typography>
          </Alert>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={forceSyncEnabled}
                  onChange={(e) => setForceSyncEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Teljes szinkronizálás kényszerítése
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Minden termék szinkronizálása, még akkor is, ha nem változott
                  </Typography>
                </Box>
              }
            />
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Biztosan szeretné importálni a termékeket a webshopból?
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
                handleSyncProducts(syncDialogConnection, forceSyncEnabled)
              }
            }}
            variant="contained"
            color="primary"
            startIcon={<CloudDownloadIcon />}
          >
            Importálás indítása
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
                label={migrationConnection.name || migrationConnection.shop_name || 'Ismeretlen'} 
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
