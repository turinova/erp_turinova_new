'use client'

import React, { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Select, MenuItem, FormControl, InputLabel, Chip, Tabs, Tab, Switch, FormControlLabel } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Security as SecurityIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import type { User, CreateUserRequest, UpdateUserRequest, UserFilters } from '@/types/user'
import type { Page, PermissionMatrix, UpdateUserPermissionsRequest } from '@/types/permission'
import { usePagePermission } from '@/hooks/usePagePermission'

export default function UsersPage() {
  const router = useRouter()
  
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [formData, setFormData] = useState<CreateUserRequest>({
    email: '',
    password: '',
    full_name: ''
  })
  
  // Permission management state
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [userPermissions, setUserPermissions] = useState<{[key: string]: boolean}>({})
  
  // Use optimized permission hook
  const { hasAccess, loading: permissionsLoading } = usePagePermission('/users')

  // Handle redirect if no access - moved to useEffect to avoid setState during render
  useEffect(() => {
    // Only redirect if permissions are loaded and user doesn't have access
    // Add a small delay to prevent redirects during page refresh
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        router.push('/403')
      }, 100) // Small delay to prevent redirects during page refresh
      
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading, router])

  // Fetch users
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/users')
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users)
      } else {
        toast.error(data.error || 'Failed to fetch users')
      }
    } catch (error) {
      toast.error('Error fetching users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Available pages for permission management - matches the actual navigation structure
  const availablePages = [
    { path: '/home', name: 'Főoldal', category: 'Főoldal' },
    { path: '/opti', name: 'Opti', category: 'Optimalizáló' },
    { path: '/customers', name: 'Ügyfelek', category: 'Törzsadatok' },
    { path: '/brands', name: 'Gyártók', category: 'Törzsadatok' },
    { path: '/vat', name: 'Adónem', category: 'Törzsadatok' },
    { path: '/currencies', name: 'Pénznem', category: 'Törzsadatok' },
    { path: '/units', name: 'Egységek', category: 'Törzsadatok' },
    { path: '/materials', name: 'Táblás anyagok', category: 'Törzsadatok' },
    { path: '/linear-materials', name: 'Szálas anyagok', category: 'Törzsadatok' },
    { path: '/edge', name: 'Élzárók', category: 'Törzsadatok' },
    { path: '/company', name: 'Cégadatok', category: 'Beállítások' },
    { path: '/users', name: 'Felhasználók', category: 'Beállítások' },
    { path: '/opti-settings', name: 'Opti beállítások', category: 'Beállítások' }
  ]

  // Permission save function - now actually saves to database
  const saveUserPermissions = async () => {
    if (!selectedUserForPermissions) return

    try {
      setSavingPermissions(true)
      
      // Prepare permissions data
      const permissionsData = availablePages.map(page => ({
        path: page.path,
        can_view: userPermissions[page.path] || false,
        can_edit: userPermissions[page.path] || false,
        can_delete: false // For now, only allow view permissions
      }))

      const response = await fetch(`/api/permissions/user/${selectedUserForPermissions.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: permissionsData
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`Jogosultságok sikeresen mentve! (${result.updatedPermissions} oldal)`)
        setPermissionsDialogOpen(false)
        setSelectedUserForPermissions(null)
      } else {
        toast.error(result.error || 'Hiba a jogosultságok mentése során')
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Hiba a jogosultságok mentése során')
    } finally {
      setSavingPermissions(false)
    }
  }

  // Toggle permission for a page
  const togglePermission = (pagePath: string) => {
    setUserPermissions(prev => ({
      ...prev,
      [pagePath]: !prev[pagePath]
    }))
  }


  // Open permissions dialog - now fetches actual permissions
  const handleOpenPermissions = async (user: User) => {
    setSelectedUserForPermissions(user)
    setPermissionsDialogOpen(true)
    
    try {
      // Fetch current permissions for this user
      const response = await fetch(`/api/permissions/user/${user.id}`)
      const result = await response.json()
      
      if (response.ok) {
        // Initialize permissions based on current user permissions
        const initialPermissions: {[key: string]: boolean} = {}
        availablePages.forEach(page => {
          // Check if user has access to this page
          initialPermissions[page.path] = result.paths?.includes(page.path) || false
        })
        setUserPermissions(initialPermissions)
      } else {
        // If error, initialize all to false
        const initialPermissions: {[key: string]: boolean} = {}
        availablePages.forEach(page => {
          initialPermissions[page.path] = false
        })
        setUserPermissions(initialPermissions)
        toast.error('Hiba a jogosultságok betöltése során')
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      // Initialize all to false on error
      const initialPermissions: {[key: string]: boolean} = {}
      availablePages.forEach(page => {
        initialPermissions[page.path] = false
      })
      setUserPermissions(initialPermissions)
      toast.error('Hiba a jogosultságok betöltése során')
    }
  }

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    let filtered = users

    if (searchTerm) {
      const term = searchTerm.toLowerCase()

      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(term) ||
        (user.full_name && user.full_name.toLowerCase().includes(term))
      )
    }

    return filtered
  }, [users, searchTerm])

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedUsers(filteredUsers.map(user => user.id))
    } else {
      setSelectedUsers([])
    }
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const isAllSelected = selectedUsers.length === filteredUsers.length && filteredUsers.length > 0
  const isIndeterminate = selectedUsers.length > 0 && selectedUsers.length < filteredUsers.length

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingUser ? 'Felhasználó sikeresen frissítve!' : 'Felhasználó sikeresen létrehozva!')
        setOpenDialog(false)
        setEditingUser(null)
        setFormData({
          email: '',
          password: '',
          full_name: ''
        })
        fetchUsers()
      } else {
        toast.error(data.error || 'Hiba a felhasználó mentése során')
      }
    } catch (error) {
      toast.error('Hiba a felhasználó mentése során')
    }
  }

  // Handle edit user
  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '', // Don't pre-fill password
      full_name: user.full_name || ''
    })
    setOpenDialog(true)
  }

  // Handle delete click
  const handleDeleteClick = () => {
    if (selectedUsers.length === 0) {
      toast.warning('Válasszon ki legalább egy felhasználót a törléshez!', {
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

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (selectedUsers.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete users one by one
      const deletePromises = selectedUsers.map(userId => 
        fetch(`/api/users/${userId}`, {
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
        toast.success(`${selectedUsers.length} felhasználó sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Remove deleted users from local state
        setUsers(prev => prev.filter(user => !selectedUsers.includes(user.id)))
        setSelectedUsers([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} felhasználó törlése sikertelen!`, {
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

  // Handle dialog close
  const handleDialogClose = () => {
    setOpenDialog(false)
    setEditingUser(null)
    setFormData({
      email: '',
      password: '',
      full_name: ''
    })
  }

  // Show loading while permissions are being checked
  if (permissionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">
            Loading permissions...
          </Typography>
        </Box>
      </Box>
    )
  }

  // Show loading or no access message while checking permissions
  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          Access Denied - Redirecting...
        </Typography>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Felhasználók betöltése...</Typography>
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
          Rendszer
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Felhasználók
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedUsers.length === 0}
        >
          Törlés ({selectedUsers.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={() => setOpenDialog(true)}
        >
          Új felhasználó hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés email vagy név szerint..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
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
              <TableCell>Email</TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Létrehozva</TableCell>
              <TableCell>Utolsó bejelentkezés</TableCell>
              <TableCell>Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow 
                key={user.id} 
                hover 
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                  />
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.full_name || '-'}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('hu-HU')}
                </TableCell>
                <TableCell>
                  {user.last_sign_in_at 
                    ? new Date(user.last_sign_in_at).toLocaleDateString('hu-HU') + ' ' + new Date(user.last_sign_in_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
                    : 'Soha'
                  }
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(user)}
                      color="primary"
                    >
                      Szerkesztés
                    </Button>
                    <Button
                      size="small"
                      startIcon={<SecurityIcon />}
                      onClick={() => handleOpenPermissions(user)}
                      color="secondary"
                    >
                      Jogosultságok
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Felhasználó szerkesztése' : 'Új felhasználó'}
        </DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Jelszó"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required={!editingUser}
                fullWidth
                helperText={editingUser ? "Hagyd üresen, ha nem szeretnéd megváltoztatni" : ""}
              />
              <TextField
                label="Teljes név"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                fullWidth
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 2 }}>
                <Button onClick={handleDialogClose}>
                  Mégse
                </Button>
                <Button type="submit" variant="contained">
                  {editingUser ? 'Frissítés' : 'Létrehozás'}
                </Button>
              </Box>
            </Box>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Felhasználók törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedUsers.length} felhasználót? 
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

      {/* Enhanced Permissions Management Dialog */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={() => setPermissionsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon color="primary" />
            <Box>
              <Typography variant="h6" component="div">
                Jogosultságok kezelése
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUserForPermissions?.email} ({selectedUserForPermissions?.role}) - Oldal hozzáférés beállítása
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 3 }}>
            {selectedUserForPermissions?.role === 'admin' ? (
              <Box sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" color="warning.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon fontSize="small" />
                  <strong>Admin felhasználó:</strong> Ez a felhasználó automatikusan hozzáfér minden oldalhoz.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Válassza ki, hogy mely oldalakhoz férhet hozzá ez a felhasználó:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const allPermissions: {[key: string]: boolean} = {}
                        availablePages.forEach(page => {
                          allPermissions[page.path] = true
                        })
                        setUserPermissions(allPermissions)
                      }}
                    >
                      Minden engedélyezése
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const noPermissions: {[key: string]: boolean} = {}
                        availablePages.forEach(page => {
                          noPermissions[page.path] = false
                        })
                        setUserPermissions(noPermissions)
                      }}
                    >
                      Minden megtagadása
                    </Button>
                  </Box>
                </Box>
                
                {/* Grouped List of Pages */}
                <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                  {['Főoldal', 'Optimalizáló', 'Törzsadatok', 'Beállítások'].map((category) => {
                    const categoryPages = availablePages.filter(page => page.category === category)
                    if (categoryPages.length === 0) return null
                    
                    return (
                      <Box key={category} sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'primary.main' }}>
                          {category}
                        </Typography>
                        {categoryPages.map((page) => (
                          <Box 
                            key={page.path} 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              py: 1.5,
                              px: 2,
                              ml: 1,
                              borderBottom: 1,
                              borderColor: 'grey.200',
                              '&:hover': {
                                bgcolor: 'grey.50'
                              }
                            }}
                          >
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {page.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {page.path}
                              </Typography>
                            </Box>
                            <Switch
                              checked={userPermissions[page.path] || false}
                              onChange={() => togglePermission(page.path)}
                              color="primary"
                            />
                          </Box>
                        ))}
                      </Box>
                    )
                  })}
                </Box>
              </>
            )}

            {/* Summary Section */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight="medium" sx={{ mb: 1 }}>
                Összefoglaló
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={`${Object.values(userPermissions).filter(Boolean).length} aktív oldal`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`${availablePages.length - Object.values(userPermissions).filter(Boolean).length} letiltott oldal`}
                  color="default"
                  variant="outlined"
                  size="small"
                />
              </Box>
              
              {Object.values(userPermissions).filter(Boolean).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                    Aktív oldalak:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {availablePages
                      .filter(page => userPermissions[page.path])
                      .map((page) => (
                        <Chip
                          key={page.path}
                          label={page.name}
                          size="small"
                          color="primary"
                          variant="filled"
                        />
                      ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setPermissionsDialogOpen(false)}
            variant="outlined"
          >
            Mégse
          </Button>
          <Button 
            onClick={saveUserPermissions} 
            variant="contained"
            startIcon={savingPermissions ? <CircularProgress size={20} /> : <SecurityIcon />}
            disabled={savingPermissions}
            sx={{ minWidth: 120 }}
          >
            {savingPermissions ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
  )
}
