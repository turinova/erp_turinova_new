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
  Switch
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
  Code as CodeIcon
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
  const [searchTerm, setSearchTerm] = useState('')
  const [newConnectionDialogOpen, setNewConnectionDialogOpen] = useState(false)
  const [editConnectionDialogOpen, setEditConnectionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncDialogConnection, setSyncDialogConnection] = useState<WebshopConnection | null>(null)
  const [forceSync, setForceSync] = useState(false)
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)
  const [syncPanelExpanded, setSyncPanelExpanded] = useState(true)
  const [deployingScriptTagId, setDeployingScriptTagId] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentSyncingConnectionRef = useRef<WebshopConnection | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
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
              totalBatches: 0,
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
    status?: string
    elapsed?: number
  } | null>(null)
  
  const [newConnection, setNewConnection] = useState({
    name: '',
    connection_type: 'shoprenter' as 'shoprenter' | 'unas' | 'shopify',
    api_url: '',
    username: '',
    password: '',
    is_active: true,
    search_console_property_url: '',
    search_console_client_email: '',
    search_console_private_key: '',
    search_console_enabled: false
  })
  
  const [editingConnection, setEditingConnection] = useState<WebshopConnection | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    connection_type: 'shoprenter' as 'shoprenter' | 'unas' | 'shopify',
    api_url: '',
    username: '',
    password: '',
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

  // Filter connections based on search term
  const filteredConnections = connections.filter(conn =>
    conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conn.api_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conn.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Selection handlers
  const handleSelectAll = () => {
    const filteredIds = filteredConnections.map(conn => conn.id)
    if (selectedConnections.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedConnections([])
    } else {
      setSelectedConnections(filteredIds)
    }
  }

  const handleSelectConnection = (connectionId: string) => {
    setSelectedConnections(prev => 
      prev.includes(connectionId) 
        ? prev.filter(id => id !== connectionId)
        : [...prev, connectionId]
    )
  }

  const isAllSelected = selectedConnections.length === filteredConnections.length && filteredConnections.length > 0
  const isIndeterminate = selectedConnections.length > 0 && selectedConnections.length < filteredConnections.length

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

      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: connection.id,
          connection_type: connection.connection_type,
          api_url: connection.api_url,
          username: connection.username, // For ShopRenter: client_id
          password: connection.password, // For ShopRenter: client_secret
          shop_name: shopName // Extracted shop name for ShopRenter
        })
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
    if (!newConnection.name || !newConnection.api_url || !newConnection.username || !newConnection.password) {
      toast.error('Minden mező kitöltése kötelező')
      return
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

  // Deploy structured data script tag
  const handleDeployScriptTag = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz elérhető')
      return
    }

    try {
      setDeployingScriptTagId(connection.id)

      const response = await fetch(`/api/connections/${connection.id}/script-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Structured data script sikeresen telepítve ShopRenter-be!')
      } else {
        toast.error(`Script telepítés sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error deploying script tag:', error)
      toast.error('Hiba a script telepítésekor')
    } finally {
      setDeployingScriptTagId(null)
    }
  }

  // Open edit dialog
  const handleOpenEditDialog = (connection: WebshopConnection) => {
    setEditingConnection(connection)
    setEditFormData({
      name: connection.name,
      connection_type: connection.connection_type,
      api_url: connection.api_url,
      username: connection.username,
      password: '', // Don't pre-fill password for security
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
    
    if (!editFormData.name || !editFormData.api_url || !editFormData.username) {
      toast.error('Alap mezők kitöltése kötelező')
      return
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
          label="Nincs tesztelve" 
          size="small" 
          sx={{ bgcolor: 'grey.300', color: 'grey.700' }}
        />
      )
    }
    
    if (connection.last_test_status === 'success') {
      return (
        <Chip 
          icon={<CheckCircleIcon sx={{ color: 'success.main' }} />}
          label="Csatlakozva" 
          size="small" 
          color="success"
        />
      )
    } else {
      return (
        <Chip 
          icon={<CancelIcon sx={{ color: 'error.main' }} />}
          label="Sikertelen" 
          size="small" 
          color="error"
        />
      )
    }
  }

  // Format connection type
  const formatConnectionType = (type: string) => {
    const types: Record<string, string> = {
      shoprenter: 'ShopRenter',
      unas: 'Unas',
      shopify: 'Shopify'
    }
    return types[type] || type
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
    setForceSync(false)
    setSyncDialogOpen(true)
  }

  // Handle sync products (actual sync)
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

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Webshop kapcsolatok kezelése
        </Typography>
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
          >
            Kapcsolat hozzáadása
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés név, API URL vagy felhasználónév szerint..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Előtag</TableCell>
              <TableCell>Típus</TableCell>
              <TableCell>API URL</TableCell>
              <TableCell>Felhasználónév</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Utolsó teszt</TableCell>
              <TableCell>Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredConnections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <LinkIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                    <Typography variant="body1" color="text.secondary">
                      Nincs elérhető kapcsolat
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setNewConnectionDialogOpen(true)}
                    >
                      Első kapcsolat hozzáadása
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredConnections.map((connection) => (
                <TableRow key={connection.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedConnections.includes(connection.id)}
                      onChange={() => handleSelectConnection(connection.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {connection.name}
                      </Typography>
                      {!connection.is_active && (
                        <Chip label="Inaktív" size="small" color="default" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={formatConnectionType(connection.connection_type)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {connection.api_url}
                    </Typography>
                  </TableCell>
                  <TableCell>{connection.username}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {getStatusIndicator(connection)}
                      {syncingConnectionId === connection.id && syncProgress && (
                        <Chip
                          size="small"
                          label={`Szinkronizálás: ${syncProgress.synced.toLocaleString('hu-HU')}/${syncProgress.total.toLocaleString('hu-HU')} (${Math.round((syncProgress.synced / syncProgress.total) * 100)}%)`}
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {connection.last_tested_at ? (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(connection.last_tested_at).toLocaleString('hu-HU')}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Még nem tesztelve
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Kapcsolat tesztelése">
                        <IconButton
                          size="small"
                          onClick={() => handleTestConnection(connection)}
                          disabled={testingConnectionId === connection.id}
                          color="primary"
                        >
                          {testingConnectionId === connection.id ? (
                            <CircularProgress size={20} />
                          ) : (
                            <RefreshIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      {connection.connection_type === 'shoprenter' && (
                        <>
                          <Tooltip title="Termékek szinkronizálása">
                            <IconButton
                              size="small"
                              onClick={() => handleSyncProductsClick(connection)}
                              disabled={syncingConnectionId === connection.id}
                              color="secondary"
                            >
                              {syncingConnectionId === connection.id ? (
                                <CircularProgress size={20} />
                              ) : (
                                <SyncIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Structured Data Script telepítése (JSON-LD)">
                            <IconButton
                              size="small"
                              onClick={() => handleDeployScriptTag(connection)}
                              disabled={deployingScriptTagId === connection.id}
                              color="info"
                            >
                              {deployingScriptTagId === connection.id ? (
                                <CircularProgress size={20} />
                              ) : (
                                <CodeIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title="Szerkesztés">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(connection)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Sync Progress Panel - Persistent display under table */}
      {syncingConnectionId && syncProgress && (
        <Paper 
          elevation={3} 
          sx={{ 
            mt: 3, 
            p: 2,
            borderLeft: `4px solid ${
              syncProgress.status === 'completed' ? 'success.main' : 
              syncProgress.status === 'error' ? 'error.main' : 
              syncProgress.status === 'stopped' ? 'warning.main' : 
              'primary.main'
            }`
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: syncPanelExpanded ? 2 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SyncIcon 
                color={
                  syncProgress.status === 'completed' ? 'success' : 
                  syncProgress.status === 'error' ? 'error' : 
                  syncProgress.status === 'stopped' ? 'warning' : 
                  'primary'
                } 
              />
              <Box>
                <Typography variant="h6">
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
                  color={
                    syncProgress.status === 'completed' ? 'success' : 
                    syncProgress.status === 'error' ? 'error' : 
                    syncProgress.status === 'stopped' ? 'warning' : 
                    'primary'
                  }
                  variant="outlined"
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
                    sx={{ height: 10, borderRadius: 5, mb: 3 }}
                    color={syncProgress.status === 'completed' ? 'success' : 'primary'}
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
                    {syncProgress.total > 0 && syncProgress.synced < syncProgress.total && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                        <Typography variant="body2" color="info.dark">
                          <strong>Becsült hátralévő idő:</strong> {
                            syncProgress.synced > 0 && syncProgress.elapsed && syncProgress.elapsed > 0
                              ? (() => {
                                  // Calculate actual sync rate (products per second)
                                  const rate = syncProgress.synced / syncProgress.elapsed
                                  // Calculate remaining products
                                  const remaining = syncProgress.total - syncProgress.synced
                                  // Estimate remaining time in seconds
                                  const remainingSeconds = remaining / rate
                                  // Convert to minutes (round up)
                                  const remainingMinutes = Math.ceil(remainingSeconds / 60)
                                  return `~${remainingMinutes} perc`
                                })()
                              : `~${Math.ceil((syncProgress.total - syncProgress.synced) / 200 * 0.5)} perc` // Fallback to old calculation
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AddIcon color="primary" />
            <Typography variant="h6">
              Új webshop kapcsolat hozzáadása
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Előtag *"
                value={newConnection.name}
                onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                required
                helperText="A kapcsolat azonosító neve"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Típus *"
                value={newConnection.connection_type}
                onChange={(e) => setNewConnection(prev => ({ ...prev, connection_type: e.target.value as any }))}
                required
                SelectProps={{
                  native: true,
                }}
              >
                <option value="shoprenter">ShopRenter</option>
                <option value="unas">Unas</option>
                <option value="shopify">Shopify</option>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newConnection.is_active}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                }
                label="Aktív"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API URL *"
                value={newConnection.api_url}
                onChange={(e) => setNewConnection(prev => ({ ...prev, api_url: e.target.value }))}
                required
                placeholder="https://example.shoprenter.hu"
                helperText="A webshop API URL címe"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Felhasználónév *"
                value={newConnection.username}
                onChange={(e) => setNewConnection(prev => ({ ...prev, username: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Jelszó *"
                type="password"
                value={newConnection.password}
                onChange={(e) => setNewConnection(prev => ({ ...prev, password: e.target.value }))}
                required
              />
            </Grid>
            
            {/* Search Console Configuration */}
            <Grid item xs={12}>
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Google Search Console beállítások
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newConnection.search_console_enabled}
                      onChange={(e) => setNewConnection(prev => ({ ...prev, search_console_enabled: e.target.checked }))}
                    />
                  }
                  label="Search Console integráció engedélyezése"
                />
              </Box>
            </Grid>
            {newConnection.search_console_enabled && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Property URL *"
                    value={newConnection.search_console_property_url}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, search_console_property_url: e.target.value }))}
                    required={newConnection.search_console_enabled}
                    placeholder="https://vasalatmester.hu vagy sc-domain:vasalatmester.hu"
                    helperText="A Search Console property URL-je"
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
                  />
                </Grid>
              </>
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
            disabled={creatingConnection || !newConnection.name || !newConnection.api_url || !newConnection.username || !newConnection.password}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditIcon color="primary" />
            <Typography variant="h6">
              Kapcsolat szerkesztése
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Előtag *"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Típus *"
                value={editFormData.connection_type}
                onChange={(e) => setEditFormData(prev => ({ ...prev, connection_type: e.target.value as any }))}
                required
                SelectProps={{
                  native: true,
                }}
              >
                <option value="shoprenter">ShopRenter</option>
                <option value="unas">Unas</option>
                <option value="shopify">Shopify</option>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                }
                label="Aktív"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API URL *"
                value={editFormData.api_url}
                onChange={(e) => setEditFormData(prev => ({ ...prev, api_url: e.target.value }))}
                required
                placeholder="https://shopname.api2.myshoprenter.hu"
                helperText={editFormData.connection_type === 'shoprenter' 
                  ? "ShopRenter API URL formátum: https://shopname.api2.myshoprenter.hu" 
                  : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={editFormData.connection_type === 'shoprenter' ? 'Client ID *' : 'Felhasználónév *'}
                value={editFormData.username}
                onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))}
                required
                helperText={editFormData.connection_type === 'shoprenter' 
                  ? "ShopRenter API Client ID" 
                  : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={editFormData.connection_type === 'shoprenter' ? 'Client Secret' : 'Jelszó'}
                type="password"
                value={editFormData.password}
                onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))}
                helperText={editFormData.connection_type === 'shoprenter' 
                  ? "Hagyja üresen, ha nem szeretné megváltoztatni" 
                  : "Hagyja üresen, ha nem szeretné megváltoztatni"}
              />
            </Grid>
            
            {/* Search Console Configuration */}
            <Grid item xs={12}>
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Google Search Console beállítások
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editFormData.search_console_enabled}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, search_console_enabled: e.target.checked }))}
                    />
                  }
                  label="Search Console integráció engedélyezése"
                />
              </Box>
            </Grid>
            {editFormData.search_console_enabled && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Property URL *"
                    value={editFormData.search_console_property_url}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, search_console_property_url: e.target.value }))}
                    required={editFormData.search_console_enabled}
                    placeholder="https://vasalatmester.hu vagy sc-domain:vasalatmester.hu"
                    helperText="A Search Console property URL-je"
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
                  />
                </Grid>
              </>
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
            disabled={updatingConnection || !editFormData.name || !editFormData.api_url || !editFormData.username}
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
          Termékek szinkronizálása
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Biztosan szeretné szinkronizálni a termékeket a webshopból?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={forceSync}
                onChange={(e) => setForceSync(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  Kényszerített szinkronizálás
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ha be van jelölve, a helyi módosítások felülírásra kerülnek. Alapértelmezetten csak az üres mezők kerülnek frissítésre.
                </Typography>
              </Box>
            }
            sx={{ mt: 1 }}
          />
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
                handleSyncProducts(syncDialogConnection, forceSync)
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

    </>
  )
}
