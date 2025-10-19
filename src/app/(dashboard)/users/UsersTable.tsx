'use client'

import React, { useState, useTransition } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Grid } from '@mui/material'
import { Search as SearchIcon, Security as SecurityIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { createUserAction, deleteUsersAction, updatePermissionAction } from './actions'

interface User {
  id: string
  email: string
  full_name?: string
  created_at: string
  last_sign_in_at?: string
}

interface Page {
  id: string
  path: string
  name: string
  category: string
}

interface UserPermission {
  page_path: string
  can_access: boolean
}

interface UsersTableProps {
  initialUsers: User[]
  initialPages: Page[]
}

export default function UsersTable({ initialUsers, initialPages }: UsersTableProps) {
  const [users] = useState<User[]>(initialUsers)
  const [pages] = useState<Page[]>(initialPages)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<{[key: string]: boolean}>({})
  const [savingPermissions, setSavingPermissions] = useState(false)
  
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: ''
  })
  const [creatingUser, setCreatingUser] = useState(false)
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingUsers, setDeletingUsers] = useState(false)

  const [isPending, startTransition] = useTransition()

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Selection handlers
  const handleSelectAll = () => {
    const filteredIds = filteredUsers.map(user => user.id)
    if (selectedUsers.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredIds)
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

  // Open permissions dialog
  const handleOpenPermissions = async (user: User) => {
    setSelectedUser(user)
    setPermissionsDialogOpen(true)
    
    try {
      const response = await fetch(`/api/permissions/user/${user.id}`)
      const permissions: UserPermission[] = await response.json()
      
      if (response.ok) {
        const initialPermissions: {[key: string]: boolean} = {}
        pages.forEach(page => {
          const permission = permissions.find(p => p.page_path === page.path)
          initialPermissions[page.path] = permission?.can_access ?? true
        })
        setUserPermissions(initialPermissions)
      } else {
        const initialPermissions: {[key: string]: boolean} = {}
        pages.forEach(page => {
          initialPermissions[page.path] = true
        })
        setUserPermissions(initialPermissions)
        toast.error('Hiba a jogosultságok betöltésekor')
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      const initialPermissions: {[key: string]: boolean} = {}
      pages.forEach(page => {
        initialPermissions[page.path] = true
      })
      setUserPermissions(initialPermissions)
      toast.error('Hiba a jogosultságok betöltésekor')
    }
  }

  // Toggle permission for a page
  const togglePermission = (pagePath: string) => {
    setUserPermissions(prev => ({
      ...prev,
      [pagePath]: !prev[pagePath]
    }))
  }

  // Save user permissions
  const saveUserPermissions = async () => {
    if (!selectedUser) return

    try {
      setSavingPermissions(true)
      
      const updatePromises = Object.entries(userPermissions).map(([pagePath, canAccess]) =>
        updatePermissionAction(selectedUser.id, pagePath, canAccess)
      )

      const results = await Promise.allSettled(updatePromises)
      const failedUpdates = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.success)
      )

      if (failedUpdates.length === 0) {
        toast.success('Jogosultságok sikeresen frissítve!')
        setPermissionsDialogOpen(false)
        setSelectedUser(null)
        startTransition(() => {
          window.location.reload()
        })
      } else {
        toast.error(`${failedUpdates.length} jogosultság frissítése sikertelen`)
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Hiba a jogosultságok mentésekor')
    } finally {
      setSavingPermissions(false)
    }
  }

  // Create new user
  const createUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error('Email és jelszó megadása kötelező')
      return
    }

    try {
      setCreatingUser(true)
      
      const result = await createUserAction(newUser)

      if (result.success) {
        toast.success('Felhasználó sikeresen létrehozva!')
        setNewUserDialogOpen(false)
        setNewUser({ email: '', password: '', full_name: '' })
        startTransition(() => {
          window.location.reload()
        })
      } else {
        toast.error(result.error || 'Hiba a felhasználó létrehozásakor')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Hiba a felhasználó létrehozásakor')
    } finally {
      setCreatingUser(false)
    }
  }

  // Delete selected users
  const deleteSelectedUsers = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Nincs kiválasztott felhasználó')
      return
    }

    try {
      setDeletingUsers(true)
      
      const result = await deleteUsersAction(selectedUsers)

      if (result.success) {
        toast.success(`${result.count} felhasználó sikeresen törölve!`)
        setSelectedUsers([])
        setDeleteDialogOpen(false)
        startTransition(() => {
          window.location.reload()
        })
      } else {
        toast.error(result.error || 'Hiba a felhasználók törlésekor')
      }
    } catch (error) {
      console.error('Error deleting users:', error)
      toast.error('Hiba a felhasználók törlésekor')
    } finally {
      setDeletingUsers(false)
    }
  }

  // Group pages by category
  const pagesByCategory = pages.reduce((acc, page) => {
    if (!acc[page.category]) {
      acc[page.category] = []
    }
    acc[page.category].push(page)
    return acc
  }, {} as Record<string, Page[]>)

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Felhasználók és jogosultságok kezelése
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedUsers.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deletingUsers}
            >
              Törlés ({selectedUsers.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewUserDialogOpen(true)}
            color="primary"
          >
            Felhasználó hozzáadása
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés email vagy név szerint..."
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
              <TableCell>Email</TableCell>
              <TableCell>Teljes név</TableCell>
              <TableCell>Létrehozva</TableCell>
              <TableCell>Utolsó bejelentkezés</TableCell>
              <TableCell>Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                  />
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.full_name || 'Nincs megadva'}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('hu-HU')}
                </TableCell>
                <TableCell>
                  {user.last_sign_in_at 
                    ? new Date(user.last_sign_in_at).toLocaleDateString('hu-HU')
                    : 'Soha'
                  }
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    startIcon={<SecurityIcon />}
                    onClick={() => handleOpenPermissions(user)}
                    color="primary"
                  >
                    Jogosultságok
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Permissions Dialog */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={() => setPermissionsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon color="primary" />
            <Box>
              <Typography variant="h6">
                Jogosultságok kezelése
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUser?.email}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Válassza ki, hogy mely oldalakhoz férhet hozzá:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const allPermissions: {[key: string]: boolean} = {}
                    pages.forEach(page => {
                      allPermissions[page.path] = true
                    })
                    setUserPermissions(allPermissions)
                  }}
                >
                  Összes engedélyezése
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const allPermissions: {[key: string]: boolean} = {}
                    pages.forEach(page => {
                      allPermissions[page.path] = false
                    })
                    setUserPermissions(allPermissions)
                  }}
                >
                  Összes tiltása
                </Button>
              </Box>
            </Box>

            {Object.entries(pagesByCategory).map(([category, categoryPages]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, textTransform: 'capitalize' }}>
                  {category}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {categoryPages.map((page) => (
                    <FormControlLabel
                      key={page.path}
                      control={
                        <Switch
                          checked={userPermissions[page.path] ?? true}
                          onChange={() => togglePermission(page.path)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">{page.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{page.path}</Typography>
                        </Box>
                      }
                    />
                  ))}
                </Box>
              </Box>
            ))}
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

      {/* New User Dialog */}
      <Dialog
        open={newUserDialogOpen}
        onClose={() => setNewUserDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AddIcon color="primary" />
            <Typography variant="h6">
              Új felhasználó hozzáadása
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email cím"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Jelszó"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                required
                helperText="Minimum 6 karakter"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Teljes név"
                value={newUser.full_name}
                onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Opcionális"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setNewUserDialogOpen(false)}
            variant="outlined"
          >
            Mégse
          </Button>
          <Button 
            onClick={createUser} 
            variant="contained"
            startIcon={creatingUser ? <CircularProgress size={20} /> : <AddIcon />}
            disabled={creatingUser || !newUser.email || !newUser.password}
            sx={{ minWidth: 120 }}
          >
            {creatingUser ? 'Létrehozás...' : 'Létrehozás'}
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
              Felhasználók törlése
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Biztosan törölni szeretné a kiválasztott {selectedUsers.length} felhasználót?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ez a művelet nem visszavonható. A felhasználók soft delete módszerrel lesznek törölve.
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
            onClick={deleteSelectedUsers} 
            variant="contained"
            color="error"
            startIcon={deletingUsers ? <CircularProgress size={20} /> : <DeleteIcon />}
            disabled={deletingUsers}
            sx={{ minWidth: 120 }}
          >
            {deletingUsers ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

