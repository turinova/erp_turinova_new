'use client'

import React, { useState, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Chip } from '@mui/material'
import { Home as HomeIcon, Search as SearchIcon, Security as SecurityIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface User {
  id: string
  email: string
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<{[key: string]: boolean}>({})
  const [savingPermissions, setSavingPermissions] = useState(false)

  // Fetch users and pages
  const fetchData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/permissions/admin')
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users || [])
        setPages(data.pages || [])
      } else {
        // If unauthorized, show a message
        if (response.status === 401) {
          toast.error('Be kell jelentkeznie a jogosultságok kezeléséhez')
        } else {
          toast.error(data.error || 'Failed to fetch data')
        }
      }
    } catch (error) {
      toast.error('Error fetching data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
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
      // Fetch current permissions for this user
      const response = await fetch(`/api/permissions/user/${user.id}`)
      const permissions: UserPermission[] = await response.json()
      
      if (response.ok) {
        // Initialize permissions based on current user permissions
        const initialPermissions: {[key: string]: boolean} = {}
        pages.forEach(page => {
          const permission = permissions.find(p => p.page_path === page.path)
          initialPermissions[page.path] = permission?.can_access ?? true // Default to true for new users
        })
        setUserPermissions(initialPermissions)
      } else {
        // If error, initialize all to true (default access)
        const initialPermissions: {[key: string]: boolean} = {}
        pages.forEach(page => {
          initialPermissions[page.path] = true
        })
        setUserPermissions(initialPermissions)
        toast.error('Error loading permissions')
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      // Initialize all to true on error
      const initialPermissions: {[key: string]: boolean} = {}
      pages.forEach(page => {
        initialPermissions[page.path] = true
      })
      setUserPermissions(initialPermissions)
      toast.error('Error loading permissions')
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
      
      // Update each permission
      const updatePromises = Object.entries(userPermissions).map(([pagePath, canAccess]) =>
        fetch('/api/permissions/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            pagePath,
            canAccess
          })
        })
      )

      const results = await Promise.allSettled(updatePromises)
      const failedUpdates = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok)
      )

      if (failedUpdates.length === 0) {
        toast.success('Permissions updated successfully!')
        setPermissionsDialogOpen(false)
        setSelectedUser(null)
      } else {
        toast.error(`${failedUpdates.length} permissions failed to update`)
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Error saving permissions')
    } finally {
      setSavingPermissions(false)
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

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Felhasználók betöltése...</Typography>
      </Box>
    )
  }

  if (users.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
          <Link
            component={NextLink}
            href="/home"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <HomeIcon fontSize="small" />
            Főoldal
          </Link>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Felhasználók és jogosultságok
          </Typography>
        </Breadcrumbs>

        <Typography variant="h4" sx={{ mb: 3 }}>
          Felhasználók és jogosultságok kezelése
        </Typography>

        <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
          <SecurityIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Nincs elérhető felhasználó
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Jelenleg csak a saját jogosultságait kezelheti. További felhasználók hozzáadásához vegye fel a kapcsolatot a rendszergazdával.
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Felhasználók és jogosultságok
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Felhasználók és jogosultságok kezelése
      </Typography>

      <TextField
        fullWidth
        placeholder="Keresés email szerint..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

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

      {/* Permissions Management Dialog */}
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
                  Minden engedélyezése
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const noPermissions: {[key: string]: boolean} = {}
                    pages.forEach(page => {
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
              {Object.entries(pagesByCategory).map(([category, categoryPages]) => (
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
              ))}
            </Box>

            {/* Summary */}
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
                  label={`${pages.length - Object.values(userPermissions).filter(Boolean).length} letiltott oldal`}
                  color="default"
                  variant="outlined"
                  size="small"
                />
              </Box>
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

