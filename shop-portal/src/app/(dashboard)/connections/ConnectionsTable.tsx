'use client'

import React, { useState, useTransition } from 'react'
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
  Sync as SyncIcon
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
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<{
    current: number
    total: number
    synced: number
    batchesProcessed: number
    totalBatches: number
  } | null>(null)
  
  const [newConnection, setNewConnection] = useState({
    name: '',
    connection_type: 'shoprenter' as 'shoprenter' | 'unas' | 'shopify',
    api_url: '',
    username: '',
    password: '',
    is_active: true
  })
  
  const [editingConnection, setEditingConnection] = useState<WebshopConnection | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    connection_type: 'shoprenter' as 'shoprenter' | 'unas' | 'shopify',
    api_url: '',
    username: '',
    password: '',
    is_active: true
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
          is_active: true
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
      connection_type: connection.connection_type,
      api_url: connection.api_url,
      username: connection.username,
      password: '', // Don't pre-fill password for security
      is_active: connection.is_active
    })
    setEditConnectionDialogOpen(true)
  }

  // Update connection
  const handleUpdateConnection = async () => {
    if (!editingConnection) return
    
    if (!editFormData.name || !editFormData.api_url || !editFormData.username || !editFormData.password) {
      toast.error('Minden mező kitöltése kötelező')
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

  // Handle sync products
  const handleSyncProducts = async (connection: WebshopConnection) => {
    if (connection.connection_type !== 'shoprenter') {
      toast.error('Csak ShopRenter kapcsolatokhoz szinkronizálható termékek')
      return
    }

    try {
      setSyncingConnectionId(connection.id)
      setSyncProgress({ current: 0, total: 0, synced: 0, batchesProcessed: 0, totalBatches: 0 })
      
      const response = await fetch(`/api/connections/${connection.id}/sync-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Szinkronizálás sikertelen')
      }

      const result = await response.json()

      // Update progress with final results
      if (result.total) {
        setSyncProgress({
          current: result.total,
          total: result.total,
          synced: result.synced || 0,
          batchesProcessed: result.batchesProcessed || 0,
          totalBatches: result.batchesProcessed || 0
        })
      }

      if (result.success) {
        toast.success(`${result.synced || 0} termék sikeresen szinkronizálva!${result.errorCount > 0 ? ` (${result.errorCount} hiba)` : ''}`)
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(`Szinkronizálás sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error syncing products:', error)
      toast.error(`Hiba a termékek szinkronizálásakor: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
    } finally {
      // Keep progress visible for a moment, then clear
      setTimeout(() => {
        setSyncingConnectionId(null)
        setSyncProgress(null)
      }, 2000)
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
                    {getStatusIndicator(connection)}
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
                        <Tooltip title="Termékek szinkronizálása">
                          <IconButton
                            size="small"
                            onClick={() => handleSyncProducts(connection)}
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
                label={editFormData.connection_type === 'shoprenter' ? 'Client Secret *' : 'Jelszó *'}
                type="password"
                value={editFormData.password}
                onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                helperText={editFormData.connection_type === 'shoprenter' 
                  ? "ShopRenter API Client Secret" 
                  : "Új jelszó megadása kötelező"}
              />
            </Grid>
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
            disabled={updatingConnection || !editFormData.name || !editFormData.api_url || !editFormData.username || !editFormData.password}
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

      {/* Sync Progress Dialog */}
      <Dialog
        open={syncingConnectionId !== null}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SyncIcon color="primary" />
            <Typography variant="h6">
              Termékek szinkronizálása
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {syncProgress && syncProgress.total > 0 ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Szinkronizálás folyamatban...
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight="medium">
                    {syncProgress.synced} / {syncProgress.total}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={syncProgress.total > 0 ? (syncProgress.synced / syncProgress.total) * 100 : 0}
                  sx={{ height: 10, borderRadius: 5, mb: 3 }}
                />
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Szinkronizált termékek:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {syncProgress.synced} / {syncProgress.total}
                    </Typography>
                  </Box>
                  {syncProgress.totalBatches > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Feldolgozott batch-ek:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {syncProgress.batchesProcessed} / {syncProgress.totalBatches}
                      </Typography>
                    </Box>
                  )}
                  {syncProgress.total > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Előrehaladás:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" color="primary.main">
                        {Math.round((syncProgress.synced / syncProgress.total) * 100)}%
                      </Typography>
                    </Box>
                  )}
                  {syncProgress.total > 0 && syncProgress.synced < syncProgress.total && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                      <Typography variant="body2" color="info.dark">
                        <strong>Becsült idő:</strong> ~{Math.ceil((syncProgress.total - syncProgress.synced) / 200 * 0.5)} perc
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
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    A folyamat háttérben fut, bezárhatja ezt az ablakot, de a szinkronizálás folytatódik.
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}
