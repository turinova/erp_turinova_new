'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Collapse,
  Grid
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalOffer as LocalOfferIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface CustomerGroup {
  id: string
  name: string
  code: string
}

interface Promotion {
  id: string
  priority: number
  price: number
  date_from: string | null
  date_to: string | null
  min_quantity: number
  max_quantity: number
  type: string
  day_of_week: number | null
  is_active: boolean
  is_expired: boolean
  shoprenter_special_id: string | null
  customer_group_id: string | null
  customer_groups: CustomerGroup | null
}

interface PromotionsCardProps {
  productId: string
  isVisible?: boolean // Only load data when component is visible
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Hétfő' },
  { value: 2, label: 'Kedd' },
  { value: 3, label: 'Szerda' },
  { value: 4, label: 'Csütörtök' },
  { value: 5, label: 'Péntek' },
  { value: 6, label: 'Szombat' },
  { value: 7, label: 'Vasárnap' }
]

export default function PromotionsCard({ productId, isVisible = true }: PromotionsCardProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null)
  const [expiredExpanded, setExpiredExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [formData, setFormData] = useState({
    customer_group_id: '',
    price: '',
    priority: '',
    date_from: '',
    date_to: '',
    min_quantity: '0',
    max_quantity: '0',
    type: 'interval',
    day_of_week: ''
  })

  // Load promotions
  const loadPromotions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/promotions`)
      const result = await response.json()
      if (result.success && result.promotions) {
        setPromotions(result.promotions)
      }
    } catch (error) {
      console.error('Error loading promotions:', error)
      toast.error('Hiba az akciók betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  // Load customer groups
  const loadCustomerGroups = async () => {
    try {
      const response = await fetch('/api/customer-groups')
      const result = await response.json()
      if (result.customerGroups) {
        setCustomerGroups(result.customerGroups)
      }
    } catch (error) {
      console.error('Error loading customer groups:', error)
    }
  }

  useEffect(() => {
    // Only load data when component is visible
    if (isVisible) {
      loadPromotions()
      loadCustomerGroups()
    }
  }, [productId, isVisible])

  const handleOpenDialog = (promotion?: Promotion) => {
    if (promotion) {
      setEditingPromotion(promotion)
      setFormData({
        customer_group_id: promotion.customer_group_id || '',
        price: promotion.price.toString(),
        priority: promotion.priority.toString(),
        date_from: promotion.date_from || '',
        date_to: promotion.date_to || '',
        min_quantity: promotion.min_quantity.toString(),
        max_quantity: promotion.max_quantity.toString(),
        type: promotion.type || 'interval',
        day_of_week: promotion.day_of_week?.toString() || ''
      })
    } else {
      setEditingPromotion(null)
      setFormData({
        customer_group_id: '',
        price: '',
        priority: '',
        date_from: '',
        date_to: '',
        min_quantity: '0',
        max_quantity: '0',
        type: 'interval',
        day_of_week: ''
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingPromotion(null)
    setFormData({
      customer_group_id: '',
      price: '',
      priority: '',
      date_from: '',
      date_to: '',
      min_quantity: '0',
      max_quantity: '0',
      type: 'interval',
      day_of_week: ''
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Validation
      if (!formData.price || parseFloat(formData.price) <= 0) {
        toast.error('Az akciós ár kötelező és nagyobbnak kell lennie, mint 0')
        setSaving(false)
        return
      }

      if (formData.type === 'day_spec' && !formData.day_of_week) {
        toast.error('A hét napja kötelező a "Nap terméke" típusnál')
        setSaving(false)
        return
      }

      const url = editingPromotion
        ? `/api/products/${productId}/promotions/${editingPromotion.id}`
        : `/api/products/${productId}/promotions`

      const method = editingPromotion ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_group_id: formData.customer_group_id || null,
          price: parseFloat(formData.price),
          priority: formData.priority ? parseInt(formData.priority) : undefined,
          date_from: formData.date_from || null,
          date_to: formData.date_to || null,
          min_quantity: parseInt(formData.min_quantity) || 0,
          max_quantity: parseInt(formData.max_quantity) || 0,
          type: formData.type,
          day_of_week: formData.type === 'day_spec' ? parseInt(formData.day_of_week) : null
        })
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Hiba az akció mentésekor')
        setSaving(false)
        return
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning: string) => {
          toast.warning(warning)
        })
      }

      // Show success message
      toast.success(editingPromotion ? 'Akció frissítve' : 'Akció létrehozva')
      handleCloseDialog()
      loadPromotions()
    } catch (error) {
      console.error('Error saving promotion:', error)
      toast.error('Hiba az akció mentésekor')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingPromotion) return

    try {
      setDeleting(true)
      const response = await fetch(
        `/api/products/${productId}/promotions/${deletingPromotion.id}`,
        { method: 'DELETE' }
      )

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Hiba az akció törlésekor')
        setDeleting(false)
        return
      }

      toast.success('Akció törölve')
      setDeleteDialogOpen(false)
      setDeletingPromotion(null)
      loadPromotions()
    } catch (error) {
      console.error('Error deleting promotion:', error)
      toast.error('Hiba az akció törlésekor')
    } finally {
      setDeleting(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Nincs korlát'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  const formatQuantityRange = (min: number, max: number) => {
    if (min === 0 && max === 0) return 'Nincs korlát'
    if (max === 0) return `${min}+`
    return `${min}-${max}`
  }

  const activePromotions = promotions.filter(p => p.is_active && !p.is_expired)
  const expiredPromotions = promotions.filter(p => p.is_expired || !p.is_active)

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#e74c3c',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#e74c3c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
        }}>
          <LocalOfferIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#c0392b' }}>
          Akciók & Mennyiségi Árazás
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          size="small"
          sx={{ bgcolor: '#e74c3c', '&:hover': { bgcolor: '#c0392b' } }}
        >
          Új akció
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Active Promotions */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
              Aktív akciók ({activePromotions.length})
            </Typography>
            {activePromotions.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 1, 
                mt: 1.5, 
                mb: 2,
                p: 1.5,
                bgcolor: 'rgba(231, 76, 60, 0.08)',
                borderRadius: 1,
                borderLeft: '3px solid #e74c3c'
              }}>
                <InfoIcon sx={{ color: '#c0392b', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: '#c0392b', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Nincs aktív akció
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Akciós ár (Nettó)</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Dátum</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Mennyiség</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }}>Típus</TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Műveletek</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activePromotions.map((promo) => (
                      <TableRow key={promo.id} hover>
                        <TableCell sx={{ py: 1 }}>
                          {promo.customer_groups ? (
                            <Chip label={promo.customer_groups.name} size="small" />
                          ) : (
                            <Chip label="Mindenki" size="small" color="default" />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                          <Typography variant="body2" fontWeight={600} color="primary.main">
                            {formatPrice(promo.price)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="caption">
                            {formatDate(promo.date_from)} - {formatDate(promo.date_to)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          <Typography variant="caption">
                            {formatQuantityRange(promo.min_quantity, promo.max_quantity)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1 }}>
                          {promo.type === 'day_spec' ? (
                            <Chip
                              label={`Nap terméke (${DAYS_OF_WEEK.find(d => d.value === promo.day_of_week)?.label || ''})`}
                              size="small"
                              color="secondary"
                            />
                          ) : (
                            <Chip label="Időszakos akció" size="small" />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                          <Tooltip title="Szerkesztés">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(promo)}
                              sx={{ mr: 0.5 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Törlés">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setDeletingPromotion(promo)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Expired Promotions */}
          {expiredPromotions.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  mb: 1
                }}
                onClick={() => setExpiredExpanded(!expiredExpanded)}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Lejárt akciók ({expiredPromotions.length})
                </Typography>
                <IconButton size="small">
                  {expiredExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={expiredExpanded}>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Akciós ár</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1 }}>Dátum</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1 }} align="right">Műveletek</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expiredPromotions.map((promo) => (
                        <TableRow key={promo.id} hover sx={{ opacity: 0.7 }}>
                          <TableCell sx={{ py: 1 }}>
                            {promo.customer_groups ? (
                              <Chip label={promo.customer_groups.name} size="small" />
                            ) : (
                              <Chip label="Mindenki" size="small" color="default" />
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1 }}>
                            <Typography variant="body2">
                              {formatPrice(promo.price)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Typography variant="caption">
                              {formatDate(promo.date_from)} - {formatDate(promo.date_to)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1 }}>
                            <Tooltip title="Törlés">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setDeletingPromotion(promo)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPromotion ? 'Akció szerkesztése' : 'Új akció'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Típus</InputLabel>
                <Select
                  value={formData.type}
                  label="Típus"
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value, day_of_week: e.target.value === 'day_spec' ? prev.day_of_week : '' }))}
                >
                  <MenuItem value="interval">Időszakos akció</MenuItem>
                  <MenuItem value="day_spec">Nap terméke</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {formData.type === 'day_spec' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Hét napja</InputLabel>
                  <Select
                    value={formData.day_of_week}
                    label="Hét napja"
                    onChange={(e) => setFormData(prev => ({ ...prev, day_of_week: e.target.value }))}
                    required
                  >
                    {DAYS_OF_WEEK.map(day => (
                      <MenuItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Vevőcsoport</InputLabel>
                <Select
                  value={formData.customer_group_id}
                  label="Vevőcsoport"
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_group_id: e.target.value }))}
                >
                  <MenuItem value="">Mindenki</MenuItem>
                  {customerGroups.map(group => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Akciós ár (Nettó)"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                required
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>

            {formData.type === 'interval' && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Kezdő dátum"
                    type="date"
                    value={formData.date_from}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_from: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Befejező dátum"
                    type="date"
                    value={formData.date_to}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_to: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Minimum mennyiség"
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, min_quantity: e.target.value }))}
                inputProps={{ min: '0' }}
                helperText="0 = nincs minimum"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Maximum mennyiség"
                type="number"
                value={formData.max_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, max_quantity: e.target.value }))}
                inputProps={{ min: '0' }}
                helperText="0 = korlátlan"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Prioritás"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                helperText="Magasabb prioritás nyer konfliktus esetén. Üresen hagyva automatikusan számolódik."
                inputProps={{ min: '-1' }}
                disabled={formData.type === 'day_spec'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.price}
            startIcon={saving ? <CircularProgress size={20} /> : null}
            sx={{ bgcolor: '#e74c3c', '&:hover': { bgcolor: '#c0392b' } }}
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Akció törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné ezt az akciót?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Mégse
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
