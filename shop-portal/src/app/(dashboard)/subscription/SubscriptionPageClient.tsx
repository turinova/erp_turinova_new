'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
  TablePagination
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  TrendingUp as TrendingUpIcon,
  CreditCard as CreditCardIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AutoAwesome as AutoAwesomeIcon,
  Description as DescriptionIcon,
  Title as TitleIcon,
  Search as SearchIcon,
  Link as LinkIcon,
  LocalOffer as LocalOfferIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material'
import { useSubscription } from '@/lib/subscription-context'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface UsageLog {
  id: string
  feature_type: string
  credits_used: number
  credit_type: string
  created_at: string
  product_id: string | null
  product_name: string | null
  product_sku: string | null
  user_email?: string | null
  user_id_in_tenant_db?: string | null
}

export default function SubscriptionPageClient() {
  const { subscription, aiUsage, loading, refreshSubscription, refreshUsage } = useSubscription()
  const [plans, setPlans] = useState<any[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null)
  
  // Usage logs state
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsExpanded, setLogsExpanded] = useState(false)
  const [logsPage, setLogsPage] = useState(0)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsLimit] = useState(20) // Items per page
  
  // Token packs state
  const [tokenPacks, setTokenPacks] = useState<any[]>([])
  const [loadingTokenPacks, setLoadingTokenPacks] = useState(false)
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null)

  useEffect(() => {
    loadPlans()
    loadTokenPacks()
  }, [])

  useEffect(() => {
    if (logsExpanded && usageLogs.length === 0) {
      loadUsageLogs()
    }
  }, [logsExpanded])

  const loadPlans = async () => {
    try {
      setLoadingPlans(true)
      const res = await fetch('/api/subscription/plans')
      const data = await res.json()
      if (data.success) {
        setPlans(data.plans || [])
      }
    } catch (error) {
      console.error('Error loading plans:', error)
      toast.error('Hiba a csomagok betöltésekor')
    } finally {
      setLoadingPlans(false)
    }
  }

  const loadTokenPacks = async () => {
    try {
      setLoadingTokenPacks(true)
      const res = await fetch('/api/subscription/token-packs')
      const data = await res.json()
      if (data.success) {
        setTokenPacks(data.tokenPacks || [])
      }
    } catch (error) {
      console.error('Error loading token packs:', error)
    } finally {
      setLoadingTokenPacks(false)
    }
  }

  const handlePurchaseTokens = async (tokenPackId: string) => {
    setPurchasingPackId(tokenPackId)
    try {
      const res = await fetch('/api/subscription/purchase-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenPackId }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(data.message || `${data.purchasedCredits} Turitoken hozzáadva!`, {
          position: "top-right",
          autoClose: 5000,
        })
        // Refresh usage to show updated credits
        await refreshUsage()
      } else {
        toast.error(data.error || 'Hiba történt a vásárlás során', {
          position: "top-right",
          autoClose: 5000,
        })
      }
    } catch (error) {
      console.error('Error purchasing tokens:', error)
      toast.error('Hiba történt a vásárlás során', {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setPurchasingPackId(null)
    }
  }

  const loadUsageLogs = async (page: number = 0) => {
    try {
      setLoadingLogs(true)
      const offset = page * logsLimit
      const res = await fetch(`/api/subscription/usage-logs?limit=${logsLimit}&offset=${offset}`)
      const data = await res.json()
      if (data.success) {
        setUsageLogs(data.logs || [])
        setLogsTotal(data.total || 0)
        setLogsPage(page)
      } else {
        toast.error('Hiba a használati logok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading usage logs:', error)
      toast.error('Hiba a használati logok betöltésekor')
    } finally {
      setLoadingLogs(false)
    }
  }

  const getFeatureLabel = (featureType: string): string => {
    const labels: Record<string, string> = {
      'meta_title': 'Meta cím',
      'meta_keywords': 'Meta kulcsszavak',
      'meta_description': 'Meta leírás',
      'url_slug': 'URL slug',
      'product_description': 'Részletes leírás',
      'product_tags': 'Termék címkék',
      'competitor_price_scrape': 'Versenyár ellenőrzés'
    }
    return labels[featureType] || featureType
  }

  const getFeatureIcon = (featureType: string) => {
    switch (featureType) {
      case 'meta_title':
        return <TitleIcon fontSize="small" />
      case 'meta_keywords':
        return <SearchIcon fontSize="small" />
      case 'meta_description':
        return <DescriptionIcon fontSize="small" />
      case 'url_slug':
        return <LinkIcon fontSize="small" />
      case 'product_description':
        return <DescriptionIcon fontSize="small" />
      case 'product_tags':
        return <LocalOfferIcon fontSize="small" />
      case 'competitor_price_scrape':
        return <AssessmentIcon fontSize="small" />
      default:
        return <AutoAwesomeIcon fontSize="small" />
    }
  }

  const getFeatureColor = (featureType: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (featureType) {
      case 'product_description':
        return 'primary'
      case 'meta_title':
      case 'meta_keywords':
      case 'meta_description':
        return 'info'
      case 'url_slug':
        return 'secondary'
      case 'product_tags':
        return 'success'
      case 'competitor_price_scrape':
        return 'warning'
      default:
        return 'default'
    }
  }

  if (loading || loadingPlans) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'trial': return 'info'
      case 'canceled': return 'warning'
      case 'expired': return 'error'
      default: return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktív'
      case 'trial': return 'Próbaidőszak'
      case 'canceled': return 'Megszakítva'
      case 'expired': return 'Lejárt'
      default: return status
    }
  }


  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 700 }}>
        Előfizetésem
      </Typography>

      <Grid container spacing={3}>
        {/* Current Subscription Card */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Jelenlegi előfizetés
              </Typography>
              {subscription && (
                <Chip
                  label={getStatusLabel(subscription.status)}
                  color={getStatusColor(subscription.status)}
                  size="small"
                />
              )}
            </Box>

            {subscription ? (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                    {subscription.plan.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {subscription.plan.price_monthly 
                      ? `${subscription.plan.price_monthly.toLocaleString('hu-HU')} Ft/hó`
                      : 'Ingyenes'}
                  </Typography>
                </Box>

                {subscription.current_period_end && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Következő számlázás: {new Date(subscription.current_period_end).toLocaleDateString('hu-HU')}
                  </Typography>
                )}

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Elérhető funkciók:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {subscription.plan.features.ai_generation ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <LockIcon color="disabled" fontSize="small" />
                      )}
                      <Typography variant="body2">
                        AI generálás {subscription.plan.features.ai_generation ? '(aktív)' : '(zárolva)'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {subscription.plan.features.analytics ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <LockIcon color="disabled" fontSize="small" />
                      )}
                      <Typography variant="body2">
                        Elemzés tab {subscription.plan.features.analytics ? '(aktív)' : '(zárolva)'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </>
            ) : (
              <Alert severity="info">
                Nincs aktív előfizetés. Válasszon egy csomagot az alábbi lehetőségek közül.
              </Alert>
            )}
          </Paper>

          {/* AI Usage Stats */}
          {subscription && subscription.plan.features.ai_generation && aiUsage && (
            <>
              {/* Credit Usage Stats */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  AI Turitoken használat
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Használt Turitoken (ez hónap)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {aiUsage.credit_used || 0} / {aiUsage.credit_limit !== null && aiUsage.credit_limit !== Infinity ? aiUsage.credit_limit.toLocaleString('hu-HU') : '∞'}
                    </Typography>
                  </Box>
                  {aiUsage.credit_limit !== null && aiUsage.credit_limit !== Infinity && (
                    <LinearProgress
                      variant="determinate"
                      value={aiUsage.credit_percentage || 0}
                      sx={{ height: 8, borderRadius: 1 }}
                      color={(aiUsage.credit_percentage || 0) > 90 ? 'error' : (aiUsage.credit_percentage || 0) > 70 ? 'warning' : 'primary'}
                    />
                  )}
                </Box>

                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Maradék Turitoken
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {aiUsage.credit_remaining !== null && aiUsage.credit_remaining !== Infinity ? aiUsage.credit_remaining.toLocaleString('hu-HU') : '∞'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Turitoken limit
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {aiUsage.credit_limit !== null && aiUsage.credit_limit !== Infinity ? aiUsage.credit_limit.toLocaleString('hu-HU') : 'Korlátlan'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Token Packs Purchase Section */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  További Turitoken vásárlása
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Vásároljon további Turitokent, amelyek a következő hónapban is használhatók.
                </Typography>

                {loadingTokenPacks ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : tokenPacks.length === 0 ? (
                  <Alert severity="info">
                    Jelenleg nincs elérhető token csomag.
                  </Alert>
                ) : (
                  <Grid container spacing={2}>
                    {tokenPacks.map((pack) => (
                      <Grid item xs={12} sm={6} md={4} key={pack.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            p: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            '&:hover': {
                              boxShadow: 3,
                              borderColor: 'primary.main'
                            }
                          }}
                        >
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                              {pack.name}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                              {pack.price_huf.toLocaleString('hu-HU')} Ft
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {pack.credits} Turitoken
                            </Typography>
                            <Chip
                              label={`${Math.round(pack.price_huf / pack.credits)} Ft/Turitoken`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                          <Button
                            variant="contained"
                            fullWidth
                            sx={{ mt: 2 }}
                            onClick={() => handlePurchaseTokens(pack.id)}
                            disabled={purchasingPackId === pack.id}
                            startIcon={purchasingPackId === pack.id ? <CircularProgress size={20} /> : <CreditCardIcon />}
                          >
                            {purchasingPackId === pack.id ? 'Vásárlás...' : 'Vásárlás'}
                          </Button>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>

              {/* Usage Logs Table */}
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Turitoken használati log (ez hónap)
                  </Typography>
                  <IconButton
                    onClick={() => {
                      setLogsExpanded(!logsExpanded)
                      if (!logsExpanded && usageLogs.length === 0) {
                        loadUsageLogs(0)
                      }
                    }}
                    size="small"
                  >
                    {logsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                <Collapse in={logsExpanded}>
                  {loadingLogs ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : usageLogs.length === 0 ? (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Még nincs Turitoken használati log ebben a hónapban.
                    </Alert>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Dátum</TableCell>
                            <TableCell>Funkció</TableCell>
                            <TableCell>Termék</TableCell>
                            <TableCell>Felhasználó</TableCell>
                            <TableCell align="right">Turitoken</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {usageLogs.map((log) => (
                            <TableRow key={log.id} hover>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(log.created_at).toLocaleString('hu-HU', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  icon={getFeatureIcon(log.feature_type)}
                                  label={getFeatureLabel(log.feature_type)}
                                  size="small"
                                  color={getFeatureColor(log.feature_type)}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                {log.product_id && log.product_name ? (
                                  <NextLink
                                    href={`/products/${log.product_id}`}
                                    style={{
                                      textDecoration: 'none',
                                      color: 'inherit'
                                    }}
                                  >
                                    <Typography 
                                      variant="body2"
                                      sx={{
                                        color: 'primary.main',
                                        '&:hover': {
                                          textDecoration: 'underline'
                                        }
                                      }}
                                    >
                                      {log.product_name}
                                    </Typography>
                                    {log.product_sku && (
                                      <Typography variant="caption" color="text.secondary" display="block">
                                        {log.product_sku}
                                      </Typography>
                                    )}
                                  </NextLink>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    N/A
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {log.user_email || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={`-${log.credits_used}`}
                                  color="error"
                                  size="small"
                                  variant="outlined"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination
                        component="div"
                        count={logsTotal}
                        page={logsPage}
                        onPageChange={(event, newPage) => {
                          loadUsageLogs(newPage)
                        }}
                        rowsPerPage={logsLimit}
                        rowsPerPageOptions={[]}
                        labelRowsPerPage="Sorok oldalanként:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count !== -1 ? count : `több mint ${to}`}`}
                      />
                    </TableContainer>
                  )}
                </Collapse>
              </Paper>
            </>
          )}
        </Grid>

        {/* Available Plans */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Elérhető csomagok
            </Typography>

            {plans.map((plan) => (
              <Card
                key={plan.id}
                sx={{
                  mb: 2,
                  border: subscription?.plan_id === plan.id ? '2px solid' : '1px solid',
                  borderColor: subscription?.plan_id === plan.id ? 'primary.main' : 'divider'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {plan.name}
                    </Typography>
                    {subscription?.plan_id === plan.id && (
                      <Chip label="Aktív" color="primary" size="small" />
                    )}
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                    {plan.price_monthly 
                      ? `${plan.price_monthly.toLocaleString('hu-HU')} Ft/hó`
                      : 'Ingyenes'}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                      Funkciók:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {plan.features.ai_generation ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <LockIcon color="disabled" fontSize="small" />
                        )}
                        <Typography variant="caption">
                          AI generálás
                          {plan.ai_credits_per_month !== undefined && plan.ai_credits_per_month !== null && plan.ai_credits_per_month !== Infinity && ` (${plan.ai_credits_per_month} Turitoken/hó)`}
                          {(plan.ai_credits_per_month === null || plan.ai_credits_per_month === Infinity) && ' (korlátlan Turitoken)'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {plan.features.analytics ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <LockIcon color="disabled" fontSize="small" />
                        )}
                        <Typography variant="caption">
                          Elemzés tab
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {subscription?.plan_id !== plan.id && (
                    <Button
                      variant={subscription ? 'outlined' : 'contained'}
                      fullWidth
                      startIcon={upgradingPlanId === plan.id ? <CircularProgress size={18} /> : <CreditCardIcon />}
                      onClick={async () => {
                        setUpgradingPlanId(plan.id)
                        try {
                          const res = await fetch('/api/subscription/upgrade', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ planId: plan.id })
                          })
                          const data = await res.json()
                          if (data.success) {
                            toast.success('Előfizetés frissítve!')
                            await refreshSubscription()
                            await refreshUsage()
                          } else {
                            toast.error(data.error || 'Hiba az előfizetés frissítésekor')
                          }
                        } catch (error) {
                          console.error('Error upgrading subscription:', error)
                          toast.error('Hiba az előfizetés frissítésekor')
                        } finally {
                          setUpgradingPlanId(null)
                        }
                      }}
                      disabled={upgradingPlanId === plan.id}
                    >
                      {upgradingPlanId === plan.id ? 'Frissítés...' : (subscription ? 'Frissítés' : 'Választás')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
