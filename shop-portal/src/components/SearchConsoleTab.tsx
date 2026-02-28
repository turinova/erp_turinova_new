'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material'
import {
  Sync as SyncIcon,
  CheckCircle,
  Cancel,
  TrendingUp,
  Visibility,
  Mouse as MouseIcon,
  BarChart
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface SearchConsoleTabProps {
  productId: string
  productUrl: string | null
}

interface PerformanceData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

interface QueryData {
  query: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  date: string
}

interface IndexingStatus {
  is_indexed: boolean
  last_crawled: string | null
  coverage_state: string | null
  indexing_state: string | null
  has_issues: boolean
  issues: any[] | null
  last_checked: string
  // Enhanced fields
  page_fetch_state?: string | null
  page_fetch_error?: string | null
  mobile_usability_issues?: Array<{
    issue: string
    severity: 'ERROR' | 'WARNING'
    description: string
  }> | null
  mobile_usability_passed?: boolean
  core_web_vitals?: {
    lcp?: number | null
    inp?: number | null
    cls?: number | null
  } | null
  structured_data_issues?: Array<{
    type: string
    severity: 'ERROR' | 'WARNING'
    message: string
  }> | null
  rich_results_eligible?: string[] | null
  sitemap_status?: string | null
  sitemap_url?: string | null
}

interface SearchConsoleData {
  performance: PerformanceData[]
  queries: QueryData[]
  indexingStatus: IndexingStatus | null
  stats: {
    totalImpressions: number
    totalClicks: number
    avgCtr: number
    avgPosition: number
    uniqueQueries: number
  }
}

export default function SearchConsoleTab({ productId, productUrl }: SearchConsoleTabProps) {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [data, setData] = useState<SearchConsoleData | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    if (productUrl) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [productId, productUrl, days])

  const fetchData = async () => {
    if (!productUrl) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/search-console?days=${days}`)
      const result = await response.json()

      if (result.success) {
        setData(result)
      } else {
        toast.error(`Adatok betöltése sikertelen: ${result.error}`)
      }
    } catch (error) {
      console.error('Error fetching Search Console data:', error)
      toast.error('Hiba a Search Console adatok betöltésekor.')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    if (!productUrl) {
      toast.error('A termék URL-je nem elérhető. Kérjük, szinkronizálja a termékeket először.')
      return
    }

    setSyncing(true)
    try {
      const response = await fetch(`/api/products/${productId}/search-console/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days })
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Search Console adatok sikeresen szinkronizálva! (${result.stats.totalImpressions} megjelenés, ${result.stats.totalClicks} kattintás)`)
        fetchData() // Refresh data
      } else {
        toast.error(`Szinkronizálás sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error syncing Search Console data:', error)
      toast.error('Hiba a Search Console adatok szinkronizálásakor.')
    } finally {
      setSyncing(false)
    }
  }

  if (!productUrl) {
    return (
      <Alert severity="info">
        A termék URL-je nem elérhető. Kérjük, szinkronizálja a termékeket a Kapcsolatok oldalon, hogy a Search Console adatok elérhetők legyenek.
      </Alert>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Szinkronizálás...' : 'Adatok szinkronizálása'}
          </Button>
        </Box>
        <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
          Még nincsenek Search Console adatok. Kattintson a "Adatok szinkronizálása" gombra az adatok lekéréséhez.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          A Search Console adatok segítenek optimalizálni a termék SEO teljesítményét
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.875rem' }}
          >
            <option value={7}>Utolsó 7 nap</option>
            <option value={30}>Utolsó 30 nap</option>
            <option value={90}>Utolsó 90 nap</option>
            <option value={180}>Utolsó 180 nap</option>
          </select>
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Szinkronizálás...' : 'Frissítés'}
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Visibility color="primary" />
                <Typography variant="h6">{data.stats.totalImpressions.toLocaleString()}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Megjelenések</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MouseIcon color="success" />
                <Typography variant="h6">{data.stats.totalClicks.toLocaleString()}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Kattintások</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp color="info" />
                <Typography variant="h6">{(data.stats.avgCtr * 100).toFixed(2)}%</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Átlagos CTR</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BarChart color="warning" />
                <Typography variant="h6">{data.stats.avgPosition.toFixed(1)}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">Átlagos pozíció</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Indexing Status */}
      {data.indexingStatus && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Indexelési státusz</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {data.indexingStatus.is_indexed ? (
                  <>
                    <CheckCircle color="success" />
                    <Typography>Indexelve</Typography>
                  </>
                ) : (
                  <>
                    <Cancel color="error" />
                    <Typography>Nincs indexelve</Typography>
                  </>
                )}
              </Box>
            </Grid>
            {data.indexingStatus.coverage_state && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Státusz: {data.indexingStatus.coverage_state}
                </Typography>
              </Grid>
            )}
            {data.indexingStatus.last_crawled && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Utolsó bejárás: {new Date(data.indexingStatus.last_crawled).toLocaleDateString('hu-HU')}
                </Typography>
              </Grid>
            )}
            {/* Page Fetch State */}
            {(() => {
              const successStates = ['SUCCESS', 'PASS']
              const fetchState = data.indexingStatus.page_fetch_state
              const fetchError = data.indexingStatus.page_fetch_error
              
              // Only show error if state is an actual error (not SUCCESS or PASS)
              // Also check that error message is not a success state (handles old data)
              const isError = fetchState && 
                             !successStates.includes(fetchState) &&
                             (!fetchError || !successStates.includes(fetchError))
              
              return isError ? (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                      Oldal betöltési hiba
                    </Typography>
                    <Typography variant="body2">
                      {fetchError || fetchState}
                    </Typography>
                  </Alert>
                </Grid>
              ) : null
            })()}
            
            {/* Mobile Usability */}
            {data.indexingStatus.mobile_usability_issues && data.indexingStatus.mobile_usability_issues.length > 0 && (
              <Grid item xs={12}>
                <Alert severity={data.indexingStatus.mobile_usability_passed ? "info" : "warning"} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                    Mobil használhatósági problémák ({data.indexingStatus.mobile_usability_issues.length})
                  </Typography>
                  {data.indexingStatus.mobile_usability_issues.map((issue: any, idx: number) => (
                    <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                      • {issue.issue}: {issue.description}
                    </Typography>
                  ))}
                </Alert>
              </Grid>
            )}
            
            {/* Structured Data Issues */}
            {data.indexingStatus.structured_data_issues && data.indexingStatus.structured_data_issues.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                    Strukturált adat hibák ({data.indexingStatus.structured_data_issues.length})
                  </Typography>
                  {data.indexingStatus.structured_data_issues.map((issue: any, idx: number) => (
                    <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                      • {issue.type}: {issue.message}
                    </Typography>
                  ))}
                </Alert>
              </Grid>
            )}
            
            {/* Rich Results Eligible */}
            {data.indexingStatus.rich_results_eligible && data.indexingStatus.rich_results_eligible.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" fontWeight={600}>Rich Results típusok:</Typography>
                  {data.indexingStatus.rich_results_eligible.map((type: string, idx: number) => (
                    <Chip key={idx} label={type} size="small" color="success" variant="outlined" />
                  ))}
                </Box>
              </Grid>
            )}
            
            {/* Sitemap Status */}
            {data.indexingStatus.sitemap_status && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Sitemap: {data.indexingStatus.sitemap_status === 'IN_SITEMAP' ? '✓ Sitemap-ben' : '✗ Nincs sitemap-ben'}
                </Typography>
              </Grid>
            )}
            
            {data.indexingStatus.has_issues && 
             !data.indexingStatus.page_fetch_state && 
             !data.indexingStatus.mobile_usability_issues && 
             !data.indexingStatus.structured_data_issues && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  Problémák találhatók az indexelés során. Ellenőrizze a Search Console-t részletekért.
                </Alert>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Top Queries */}
      {data.queries && data.queries.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Legfontosabb keresési lekérdezések</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Keresési lekérdezés</TableCell>
                  <TableCell align="right">Megjelenések</TableCell>
                  <TableCell align="right">Kattintások</TableCell>
                  <TableCell align="right">CTR</TableCell>
                  <TableCell align="right">Pozíció</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.queries.slice(0, 10).map((query, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {query.query}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{query.impressions.toLocaleString()}</TableCell>
                    <TableCell align="right">{query.clicks.toLocaleString()}</TableCell>
                    <TableCell align="right">{(query.ctr * 100).toFixed(2)}%</TableCell>
                    <TableCell align="right">{query.position.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Performance Chart Placeholder */}
      {data.performance && data.performance.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Teljesítmény időbeli alakulása</Typography>
          <Alert severity="info">
            Grafikon megjelenítése hamarosan. Jelenleg {data.performance.length} nap adata van elérhető.
          </Alert>
        </Paper>
      )}

      {(!data.performance || data.performance.length === 0) && 
       (!data.queries || data.queries.length === 0) && 
       !data.indexingStatus && (
        <Alert severity="info">
          Még nincsenek Search Console adatok. Kattintson a "Adatok szinkronizálása" gombra az adatok lekéréséhez.
        </Alert>
      )}
    </Box>
  )
}
