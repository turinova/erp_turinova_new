'use client'

import React, { useState, useMemo, useEffect } from 'react'
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
  Button,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  FormControlLabel,
  Switch,
  CircularProgress
} from '@mui/material'
import {
  Home as HomeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ContentCopy as DuplicateIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  price_monthly: number | null
  price_yearly: number | null
  features: Record<string, any>
  ai_credits_per_month: number | null
  is_active: boolean
  display_order: number
  tenant_count?: number
  created_at: string
  updated_at: string
}

interface SubscriptionPlansListClientProps {
  initialPlans: SubscriptionPlan[]
}

interface TokenPack {
  id: string
  name: string
  credits: number
  price_huf: number
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export default function SubscriptionPlansListClient({ initialPlans }: SubscriptionPlansListClientProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>(initialPlans)
  const [tokenPacks, setTokenPacks] = useState<TokenPack[]>([])
  const [loadingTokenPacks, setLoadingTokenPacks] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showTokenPacks, setShowTokenPacks] = useState(false)
  const [tokenPackModalOpen, setTokenPackModalOpen] = useState(false)
  const [editingTokenPack, setEditingTokenPack] = useState<TokenPack | null>(null)
  const [tokenPackForm, setTokenPackForm] = useState({
    name: '',
    credits: '',
    price_huf: '',
    is_active: true,
    display_order: 0
  })

  // Filter plans based on search term
  const filteredPlans = useMemo(() => {
    if (!plans || !Array.isArray(plans)) return []
    if (!searchTerm) return plans
    
    const term = searchTerm.toLowerCase()
    return plans.filter(plan => 
      plan.name.toLowerCase().includes(term) ||
      plan.slug.toLowerCase().includes(term)
    )
  }, [plans, searchTerm])

  const handleRowClick = (planId: string) => {
    router.push(`/subscription-plans/${planId}`)
  }

  const handleNewPlan = () => {
    router.push('/subscription-plans/new')
  }

  const handleEdit = (e: React.MouseEvent, planId: string) => {
    e.stopPropagation()
    router.push(`/subscription-plans/${planId}`)
  }

  const handleDuplicate = async (e: React.MouseEvent, plan: SubscriptionPlan) => {
    e.stopPropagation()
    try {
      const response = await fetch('/api/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${plan.name} (Copy)`,
          slug: `${plan.slug}-copy-${Date.now()}`,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          features: plan.features,
          ai_credits_per_month: plan.ai_credits_per_month,
          is_active: false, // Start as inactive
          display_order: plan.display_order + 1
        }),
      })

      if (response.ok) {
        toast.success('Terv másolva!', {
          position: "top-right",
          autoClose: 3000,
        })
        // Refresh the page to show the new plan
        router.refresh()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Másolás sikertelen')
      }
    } catch (error) {
      console.error('Error duplicating plan:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
      })
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, plan: SubscriptionPlan) => {
    e.stopPropagation()
    setPlanToDelete(plan)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/subscription-plans/${planToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Előfizetési terv törölve!', {
          position: "top-right",
          autoClose: 3000,
        })
        setDeleteModalOpen(false)
        setPlanToDelete(null)
        // Refresh the page
        router.refresh()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Törlés sikertelen')
      }
    } catch (error) {
      console.error('Error deleting plan:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
    setPlanToDelete(null)
  }

  useEffect(() => {
    if (showTokenPacks) {
      loadTokenPacks()
    }
  }, [showTokenPacks])

  const loadTokenPacks = async () => {
    setLoadingTokenPacks(true)
    try {
      const res = await fetch('/api/token-packs?includeInactive=true')
      const data = await res.json()
      if (data.success) {
        setTokenPacks(data.tokenPacks || [])
      }
    } catch (error) {
      console.error('Error loading token packs:', error)
      toast.error('Hiba a token csomagok betöltésekor')
    } finally {
      setLoadingTokenPacks(false)
    }
  }

  const handleNewTokenPack = () => {
    setEditingTokenPack(null)
    setTokenPackForm({
      name: '',
      credits: '',
      price_huf: '',
      is_active: true,
      display_order: tokenPacks.length
    })
    setTokenPackModalOpen(true)
  }

  const handleEditTokenPack = (pack: TokenPack) => {
    setEditingTokenPack(pack)
    setTokenPackForm({
      name: pack.name,
      credits: pack.credits.toString(),
      price_huf: pack.price_huf.toString(),
      is_active: pack.is_active,
      display_order: pack.display_order
    })
    setTokenPackModalOpen(true)
  }

  const handleSaveTokenPack = async () => {
    if (!tokenPackForm.name || !tokenPackForm.credits || !tokenPackForm.price_huf) {
      toast.error('Kérjük, töltse ki az összes kötelező mezőt!')
      return
    }

    try {
      const url = editingTokenPack
        ? `/api/token-packs/${editingTokenPack.id}`
        : '/api/token-packs'
      
      const method = editingTokenPack ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tokenPackForm.name,
          credits: parseInt(tokenPackForm.credits),
          price_huf: parseInt(tokenPackForm.price_huf),
          is_active: tokenPackForm.is_active,
          display_order: parseInt(tokenPackForm.display_order.toString())
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(editingTokenPack ? 'Token csomag frissítve!' : 'Token csomag létrehozva!')
        setTokenPackModalOpen(false)
        loadTokenPacks()
      } else {
        throw new Error(data.error || 'Hiba történt')
      }
    } catch (error) {
      console.error('Error saving token pack:', error)
      toast.error(`Hiba: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
    }
  }

  const handleDeleteTokenPack = async (packId: string) => {
    if (!confirm('Biztosan törölni szeretné ezt a token csomagot?')) return

    try {
      const res = await fetch(`/api/token-packs/${packId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Token csomag törölve!')
        loadTokenPacks()
      } else {
        throw new Error(data.error || 'Hiba történt')
      }
    } catch (error) {
      console.error('Error deleting token pack:', error)
      toast.error(`Hiba: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
    }
  }

  const getStatusChip = (isActive: boolean) => {
    return (
      <Chip
        label={isActive ? 'Aktív' : 'Inaktív'}
        color={isActive ? 'success' : 'default'}
        size="small"
        variant="outlined"
      />
    )
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return 'Nincs'
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatCredits = (credits: number | null) => {
    if (credits === null) return 'Korlátlan'
    return credits.toLocaleString('hu-HU')
  }

  const getFeatureCount = (features: Record<string, any>) => {
    if (!features) return 0
    return Object.values(features).filter(v => v === true || (typeof v === 'object' && v?.enabled === true)).length
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Kezdőlap
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Előfizetési tervek
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Előfizetési tervek</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowTokenPacks(!showTokenPacks)}
          >
            {showTokenPacks ? 'Előfizetési tervek' : 'Token csomagok'}
          </Button>
          {!showTokenPacks ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewPlan}
            >
              Új terv létrehozása
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewTokenPack}
            >
              Új token csomag
            </Button>
          )}
        </Box>
      </Box>

      <TextField
        fullWidth
        placeholder={showTokenPacks ? "Keresés token csomag név szerint..." : "Keresés név vagy slug szerint..."}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {showTokenPacks ? (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Név</TableCell>
                <TableCell align="right">Turitoken</TableCell>
                <TableCell align="right">Ár (HUF)</TableCell>
                <TableCell align="right">Ár/Turitoken</TableCell>
                <TableCell>Rendezés</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell align="right">Műveletek</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingTokenPacks ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : tokenPacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      Nincs token csomag
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tokenPacks
                  .filter(pack => !searchTerm || pack.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((pack) => (
                    <TableRow key={pack.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {pack.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {pack.credits.toLocaleString('hu-HU')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {pack.price_huf.toLocaleString('hu-HU')} Ft
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {Math.round(pack.price_huf / pack.credits)} Ft
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {pack.display_order}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pack.is_active ? 'Aktív' : 'Inaktív'}
                          color={pack.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Szerkesztés">
                            <IconButton
                              size="small"
                              onClick={() => handleEditTokenPack(pack)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Törlés">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteTokenPack(pack.id)}
                            >
                              <DeleteIcon fontSize="small" />
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
      ) : (
        <TableContainer component={Paper}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Név</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Havi ár</TableCell>
              <TableCell>Éves ár</TableCell>
              <TableCell>Turitoken limit</TableCell>
              <TableCell>Funkciók</TableCell>
              <TableCell>Ügyfelek</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell align="right">Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    Nincs előfizetési terv
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans.map((plan) => (
                <TableRow
                  key={plan.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(plan.id)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {plan.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {plan.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatPrice(plan.price_monthly)}</TableCell>
                  <TableCell>{formatPrice(plan.price_yearly)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatCredits(plan.ai_credits_per_month)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${getFeatureCount(plan.features)} funkció`}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {plan.tenant_count || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(plan.is_active)}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Tooltip title="Szerkesztés">
                        <IconButton
                          size="small"
                          onClick={(e) => handleEdit(e, plan.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Másolás">
                        <IconButton
                          size="small"
                          onClick={(e) => handleDuplicate(e, plan)}
                        >
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Törlés">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => handleDeleteClick(e, plan)}
                        >
                          <DeleteIcon fontSize="small" />
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
      )}

      {/* Token Pack Form Modal */}
      <Dialog
        open={tokenPackModalOpen}
        onClose={() => setTokenPackModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingTokenPack ? 'Token csomag szerkesztése' : 'Új token csomag'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Név"
              value={tokenPackForm.name}
              onChange={(e) => setTokenPackForm({ ...tokenPackForm, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Turitoken mennyiség"
              type="number"
              value={tokenPackForm.credits}
              onChange={(e) => setTokenPackForm({ ...tokenPackForm, credits: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Ár (HUF)"
              type="number"
              value={tokenPackForm.price_huf}
              onChange={(e) => setTokenPackForm({ ...tokenPackForm, price_huf: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Rendezési sorrend"
              type="number"
              value={tokenPackForm.display_order}
              onChange={(e) => setTokenPackForm({ ...tokenPackForm, display_order: parseInt(e.target.value) || 0 })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={tokenPackForm.is_active}
                  onChange={(e) => setTokenPackForm({ ...tokenPackForm, is_active: e.target.checked })}
                />
              }
              label="Aktív"
            />
            {tokenPackForm.credits && tokenPackForm.price_huf && (
              <Typography variant="body2" color="text.secondary">
                Ár/Turitoken: {Math.round(parseInt(tokenPackForm.price_huf) / parseInt(tokenPackForm.credits))} Ft
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTokenPackModalOpen(false)}>
            Mégse
          </Button>
          <Button
            onClick={handleSaveTokenPack}
            variant="contained"
          >
            {editingTokenPack ? 'Mentés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Előfizetési terv törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a(z) "{planToDelete?.name}" előfizetési tervet?
            {planToDelete && planToDelete.tenant_count && planToDelete.tenant_count > 0 && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                Figyelem: {planToDelete.tenant_count} ügyfél használja ezt a tervet. A terv inaktívvá válik, de nem törlődik.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Mégse
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
