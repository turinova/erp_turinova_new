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
  Alert
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
  Settings as SettingsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Category as CategoryIcon
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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentSyncingConnectionRef = useRef<WebshopConnection | null>(null)

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
        toast.success('Kapcsolat sikeresen létrehozva!')
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
    setSyncDialogOpen(true)
  }

  // Handle sync categories button click
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
      toast.error(`Hiba a kategóriák szinkronizálásakor: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
      setSyncingCategoriesConnectionId(null)
      setCategorySyncProgress(null)
    }
  }

  // Handle sync products (actual sync)
  // Note: forceSync parameter is ignored for bulk sync - backend always uses forceSync=true
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
        
        throw new Error(errorResult.error || 'Szinkronizálás sikertelen')
      }

      // Read response once
      const result = await response.json()
      
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
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ 
                        p: 2, 
                        bgcolor: 'rgba(0, 0, 0, 0.02)', 
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Kapcsolat státusza
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          {getStatusIndicator(connection)}
                          {isSyncing && syncProgress && (
                            <Chip
                              size="small"
                              label={`Szinkronizálás: ${syncProgress.synced.toLocaleString('hu-HU')}/${syncProgress.total.toLocaleString('hu-HU')}`}
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
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Utolsó tesztelés
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {connection.last_tested_at 
                            ? new Date(connection.last_tested_at).toLocaleString('hu-HU')
                            : 'Még nem tesztelve'
                          }
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Actions Section */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1.5,
                    pt: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={testingConnectionId === connection.id ? <CircularProgress size={16} /> : <RefreshIcon />}
                      onClick={() => handleTestConnection(connection)}
                      disabled={testingConnectionId === connection.id}
                      sx={{ 
                        borderColor: typeConfig.borderColor,
                        color: typeConfig.borderColor,
                        '&:hover': {
                          borderColor: typeConfig.borderColor,
                          bgcolor: `${typeConfig.color}10`
                        }
                      }}
                    >
                      {testingConnectionId === connection.id ? 'Tesztelés...' : 'Kapcsolat tesztelése'}
                    </Button>
                    
                    {connection.connection_type === 'shoprenter' && (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
                          onClick={() => handleSyncProductsClick(connection)}
                          disabled={isSyncing}
                          sx={{
                            borderColor: '#2196f3',
                            color: '#2196f3',
                            fontWeight: 600,
                            '&:hover': {
                              borderColor: '#1976d2',
                              bgcolor: 'rgba(33, 150, 243, 0.08)',
                              color: '#1976d2'
                            },
                            '&.Mui-disabled': {
                              borderColor: 'rgba(0, 0, 0, 0.26)',
                              color: 'rgba(0, 0, 0, 0.26)'
                            }
                          }}
                        >
                          {isSyncing ? 'Szinkronizálás...' : 'Termékek szinkronizálása'}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={isSyncingCategories ? <CircularProgress size={16} /> : <CategoryIcon />}
                          onClick={() => handleSyncCategoriesClick(connection)}
                          disabled={isSyncingCategories}
                          sx={{
                            borderColor: '#4caf50',
                            color: '#4caf50',
                            fontWeight: 600,
                            '&:hover': {
                              borderColor: '#388e3c',
                              bgcolor: 'rgba(76, 175, 80, 0.08)',
                              color: '#388e3c'
                            },
                            '&.Mui-disabled': {
                              borderColor: 'rgba(0, 0, 0, 0.26)',
                              color: 'rgba(0, 0, 0, 0.26)'
                            }
                          }}
                        >
                          {isSyncingCategories ? 'Szinkronizálás...' : 'Kategóriák szinkronizálása'}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ReceiptIcon />}
                          onClick={() => handleVatMappingClick(connection)}
                          sx={{
                            borderColor: '#ff9800',
                            color: '#ff9800',
                            fontWeight: 600,
                            '&:hover': {
                              borderColor: '#f57c00',
                              bgcolor: 'rgba(255, 152, 0, 0.08)',
                              color: '#f57c00'
                            }
                          }}
                        >
                          ÁFA leképezés
                        </Button>
                      </>
                    )}
                    
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<HistoryIcon />}
                      onClick={() => {
                        setSyncHistoryConnection(connection)
                        setSyncHistoryDialogOpen(true)
                        loadSyncLogs(connection.id)
                      }}
                      color="info"
                    >
                      Előzmények
                    </Button>
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
                         '#2196f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${
                  syncProgress.status === 'completed' ? 'rgba(76, 175, 80, 0.3)' : 
                  syncProgress.status === 'error' ? 'rgba(244, 67, 54, 0.3)' : 
                  syncProgress.status === 'stopped' ? 'rgba(255, 152, 0, 0.3)' : 
                  'rgba(33, 150, 243, 0.3)'
                }`
              }}>
                <SyncIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: syncProgress.status === 'completed' ? '#2e7d32' : 
                                                                          syncProgress.status === 'error' ? '#c62828' : 
                                                                          syncProgress.status === 'stopped' ? '#e65100' : 
                                                                          '#1565c0' }}>
                  Termékek szinkronizálása
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
              bgcolor: '#2196f3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
            }}>
              <SyncIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
              Termékek szinkronizálása
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Teljes szinkronizálás
            </Typography>
            <Typography variant="body2">
              A teljes szinkronizálás során <strong>minden termékadat</strong> frissül a webshopból. 
              Ez biztosítja, hogy az ERP adatbázis pontosan egyezzen a ShopRenter webshop adataival.
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Biztosan szeretné szinkronizálni a termékeket a webshopból?
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
                handleSyncProducts(syncDialogConnection, false) // forceSync is ignored for bulk sync anyway
              }
            }}
            variant="contained"
            color="primary"
            startIcon={<SyncIcon />}
          >
            Szinkronizálás indítása
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
    </>
  )
}
