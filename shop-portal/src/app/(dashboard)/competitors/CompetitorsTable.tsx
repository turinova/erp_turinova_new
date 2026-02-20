'use client'

import React, { useState, useTransition } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as TrendingUpIcon,
  Store as StoreIcon,
  Language as LanguageIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'

interface Competitor {
  id: string
  name: string
  website_url: string
  scrape_config: Record<string, any>
  is_active: boolean
  last_scraped_at: string | null
  created_at: string
  updated_at: string
}

interface Props {
  initialCompetitors: Competitor[]
}

export default function CompetitorsTable({ initialCompetitors }: Props) {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors)
  const [isPending, startTransition] = useTransition()
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    website_url: '',
    is_active: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [competitorToDelete, setCompetitorToDelete] = useState<Competitor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (competitor?: Competitor) => {
    if (competitor) {
      setEditingCompetitor(competitor)
      setFormData({
        name: competitor.name,
        website_url: competitor.website_url,
        is_active: competitor.is_active
      })
    } else {
      setEditingCompetitor(null)
      setFormData({
        name: '',
        website_url: '',
        is_active: true
      })
    }
    setError(null)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingCompetitor(null)
    setFormData({
      name: '',
      website_url: '',
      is_active: true
    })
    setError(null)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.website_url) {
      setError('Név és weboldal URL megadása kötelező')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const url = editingCompetitor 
        ? `/api/competitors/${editingCompetitor.id}`
        : '/api/competitors'
      
      const method = editingCompetitor ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Hiba történt')
      }

      handleCloseDialog()
      startTransition(() => {
        router.refresh()
      })
      
      // Reload the competitors list
      const refreshResponse = await fetch('/api/competitors')
      if (refreshResponse.ok) {
        const data = await refreshResponse.json()
        setCompetitors(data)
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt a mentés során')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDeleteDialog = (competitor: Competitor) => {
    setCompetitorToDelete(competitor)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!competitorToDelete) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/competitors/${competitorToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Hiba a törlés során')
      }

      setDeleteDialogOpen(false)
      setCompetitorToDelete(null)
      
      // Update local state
      setCompetitors(prev => prev.filter(c => c.id !== competitorToDelete.id))
      
      startTransition(() => {
        router.refresh()
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (competitor: Competitor) => {
    try {
      const response = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !competitor.is_active })
      })

      if (!response.ok) {
        throw new Error('Hiba az állapot módosítása során')
      }

      // Update local state
      setCompetitors(prev => prev.map(c => 
        c.id === competitor.id ? { ...c, is_active: !c.is_active } : c
      ))
    } catch (err: any) {
      console.error('Error toggling competitor status:', err)
    }
  }

  return (
    <Box>
      {/* Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h5" fontWeight={600}>
                  Versenytárs Árfigyelés
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Kövesse nyomon versenytársai árait és kapjon értesítést a változásokról
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ borderRadius: 2 }}
            >
              Új Versenytárs
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary.main" fontWeight={700}>
                {competitors.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Összes versenytárs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight={700}>
                {competitors.filter(c => c.is_active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktív figyelés
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Competitors Table */}
      <Card>
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Versenytárs</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Weboldal</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">AI Tanulás</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Aktív</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Utolsó Scrape</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Műveletek</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {competitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <StoreIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                    <Typography color="text.secondary">
                      Még nincs versenytárs hozzáadva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                      sx={{ mt: 2 }}
                    >
                      Első versenytárs hozzáadása
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                competitors.map((competitor) => (
                  <TableRow key={competitor.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1.1rem'
                          }}
                        >
                          {competitor.name.charAt(0).toUpperCase()}
                        </Box>
                        <Typography fontWeight={500}>{competitor.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LanguageIcon fontSize="small" color="action" />
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {competitor.website_url}
                        </Typography>
                        <Tooltip title="Megnyitás új ablakban">
                          <IconButton
                            size="small"
                            href={competitor.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {competitor.scrape_config?.successCount > 0 ? (
                        <Tooltip 
                          title={`🧠 Tanult minták\n✓ ${competitor.scrape_config.successCount} sikeres scrape${competitor.scrape_config.priceType ? `\nÁr típus: ${competitor.scrape_config.priceType === 'gross' ? 'Bruttó' : 'Nettó'}` : ''}${competitor.scrape_config.averageConfidence ? `\nBizonyosság: ${competitor.scrape_config.averageConfidence}%` : ''}`}
                          arrow
                          enterDelay={200}
                          leaveDelay={100}
                          componentsProps={{
                            tooltip: {
                              sx: { whiteSpace: 'pre-line' }
                            }
                          }}
                        >
                          <Chip 
                            icon={<PsychologyIcon />}
                            label={`${competitor.scrape_config.successCount}x`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip 
                          title="Még nem történt scraping. Az első sikeres scrape után az AI megtanulja a mintákat." 
                          arrow
                          enterDelay={200}
                          leaveDelay={100}
                        >
                          <Chip 
                            label="Nincs adat"
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={competitor.is_active}
                        onChange={() => handleToggleActive(competitor)}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {competitor.last_scraped_at ? (
                        <Typography variant="body2">
                          {new Date(competitor.last_scraped_at).toLocaleString('hu-HU')}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          Még nem történt
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Szerkesztés">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(competitor)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Törlés">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDeleteDialog(competitor)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCompetitor ? 'Versenytárs szerkesztése' : 'Új versenytárs hozzáadása'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Név"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            margin="normal"
            placeholder="pl. VasalatWebshop"
            required
          />
          <TextField
            label="Weboldal URL"
            fullWidth
            value={formData.website_url}
            onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
            margin="normal"
            placeholder="https://www.example.com"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LanguageIcon color="action" />
                </InputAdornment>
              )
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <Switch
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              color="success"
            />
            <Typography>Aktív figyelés</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : null}
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Versenytárs törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a(z) <strong>{competitorToDelete?.name}</strong> versenytársat?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Ez a művelet törli az összes kapcsolódó termék összerendelést és árhistóriát is.
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
    </Box>
  )
}
