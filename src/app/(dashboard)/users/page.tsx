'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Select, MenuItem, FormControl, InputLabel, Chip, Tabs, Tab, Switch, FormControlLabel } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Security as SecurityIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import type { User, CreateUserRequest, UpdateUserRequest, UserFilters } from '@/types/user'
import type { Page, PermissionMatrix, UpdateUserPermissionsRequest } from '@/types/permission'
import { useLightweightPermissions } from '@/hooks/useLightweightPermissions'
import { PermissionGuard } from '@/components/PermissionGuard'

export default function UsersPage() {
  const router = useRouter()
  
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState<CreateUserRequest>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'user',
    is_active: true
  })
  
  // Permission management state
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [userPermissions, setUserPermissions] = useState<{[key: string]: boolean}>({})
  
  // Use lightweight permissions hook
  const { isAdmin, canAccessPage } = useLightweightPermissions()

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

  // Available pages for permission management - ALL pages in the system
  const availablePages = [
    { path: '/home', name: 'Főoldal' },
    { path: '/company', name: 'Cégadatok' },
    { path: '/customers', name: 'Ügyfelek' },
    { path: '/vat', name: 'Adónemek' },
    { path: '/brands', name: 'Márkák' },
    { path: '/currencies', name: 'Pénznemek' },
    { path: '/units', name: 'Mértékegységek' },
    { path: '/tablas-anyagok', name: 'Táblás anyagok' },
    { path: '/szalas-anyagok', name: 'Szálas anyagok' },
    { path: '/elzarok', name: 'Elzárók' },
    { path: '/opti', name: 'Optimalizáló' },
    { path: '/optitest', name: 'Opti teszt' },
    { path: '/opti-beallitasok', name: 'Opti beállítások' },
    { path: '/users', name: 'Felhasználók' },
    { path: '/test-toast', name: 'Toast teszt' }
  ]

  // Permission save function
  const saveUserPermissions = async () => {
    if (!selectedUserForPermissions) return

    try {
      setSavingPermissions(true)
      
      // Prepare permissions data for API
      const permissionsData = availablePages.map(page => ({
        page_path: page.path,
        can_access: userPermissions[page.path] || false
      }))

      // Call the API to save permissions
      const response = await fetch(`/api/permissions/simple/user/${selectedUserForPermissions.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: permissionsData }),
      })

      if (!response.ok) {
        throw new Error('Failed to save permissions')
      }

      toast.success('Jogosultságok sikeresen mentve!')
      setPermissionsDialogOpen(false)
      setSelectedUserForPermissions(null)
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


  // Open permissions dialog - load individual permissions
  const handleOpenPermissions = async (user: User) => {
    setSelectedUserForPermissions(user)
    
    try {
      // Fetch user's actual permissions from the API
      const response = await fetch(`/api/permissions/simple/user/${user.id}`)
      const data = await response.json()
      
      // Initialize userPermissions based on actual permissions or default to true
      const initialPermissions: {[key: string]: boolean} = {}
      availablePages.forEach(page => {
        // Find if user has permission for this page
        const userPermission = data.permissions?.find((p: any) => p.page_path === page.path)
        initialPermissions[page.path] = userPermission?.can_access ?? true // Default to true if no permission found
      })
      setUserPermissions(initialPermissions)
    } catch (error) {
      console.error('Error fetching user permissions:', error)
      // Fallback: default all to true
      const initialPermissions: {[key: string]: boolean} = {}
      availablePages.forEach(page => {
        initialPermissions[page.path] = true 
      })
      setUserPermissions(initialPermissions)
    }
    
    setPermissionsDialogOpen(true)
  }

  // Filter users based on search term and filters
  const filteredUsers = useMemo(() => {
    let filtered = users

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(term) ||
        (user.full_name && user.full_name.toLowerCase().includes(term))
      )
    }

    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    if (statusFilter) {
      const isActive = statusFilter === 'true'
      filtered = filtered.filter(user => user.is_active === isActive)
    }

    return filtered
  }, [users, searchTerm, roleFilter, statusFilter])

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
          full_name: '',
          phone: '',
          role: 'user',
          is_active: true
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
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active
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
      full_name: '',
      phone: '',
      role: 'user',
      is_active: true
    })
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
    <PermissionGuard requiredPage="/users">
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

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Szerepkör</InputLabel>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            label="Szerepkör"
          >
            <MenuItem value="">Összes</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="user">User</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Státusz"
          >
            <MenuItem value="">Összes</MenuItem>
            <MenuItem value="true">Aktív</MenuItem>
            <MenuItem value="false">Inaktív</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
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
              <TableCell>Telefon</TableCell>
              <TableCell>Szerepkör</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Létrehozva</TableCell>
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
                <TableCell>{user.phone || '-'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={user.role}
                      color={user.role === 'admin' ? 'error' : user.role === 'manager' ? 'warning' : 'default'}
                      size="small"
                    />
                    {user.role === 'admin' && (
                      <Chip
                        label="Admin"
                        color="error"
                        variant="outlined"
                        size="small"
                        icon={<SecurityIcon />}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.is_active ? 'Aktív' : 'Inaktív'}
                    color={user.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('hu-HU')}
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
              <TextField
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Szerepkör</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                  label="Szerepkör"
                >
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ marginRight: '8px' }}
                />
                <label htmlFor="is_active">Aktív felhasználó</label>
              </Box>
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
                {selectedUserForPermissions?.email} - Oldal hozzáférés beállítása
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
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Válassza ki, hogy mely oldalakhoz férhet hozzá ez a felhasználó:
                </Typography>
                
                {/* Simple List of Pages */}
                <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                  {availablePages.map((page) => (
                    <Box 
                      key={page.path} 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        py: 1.5,
                        px: 1,
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
    </PermissionGuard>
  )
}
