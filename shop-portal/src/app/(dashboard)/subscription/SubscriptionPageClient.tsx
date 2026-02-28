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
  TableRow
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  TrendingUp as TrendingUpIcon,
  CreditCard as CreditCardIcon
} from '@mui/icons-material'
import { useSubscription } from '@/lib/subscription-context'
import { toast } from 'react-toastify'

export default function SubscriptionPageClient() {
  const { subscription, aiUsage, loading, refreshSubscription, refreshUsage } = useSubscription()
  const [plans, setPlans] = useState<any[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null)

  useEffect(() => {
    loadPlans()
  }, [])

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
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                AI használati statisztikák
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Használt tokenek (ez hónap)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {aiUsage.current_month.toLocaleString('hu-HU')} / {aiUsage.monthly_limit ? aiUsage.monthly_limit.toLocaleString('hu-HU') : '∞'}
                  </Typography>
                </Box>
                {aiUsage.monthly_limit !== null && (
                  <LinearProgress
                    variant="determinate"
                    value={aiUsage.percentage_used}
                    sx={{ height: 8, borderRadius: 1 }}
                    color={aiUsage.percentage_used > 90 ? 'error' : aiUsage.percentage_used > 70 ? 'warning' : 'primary'}
                  />
                )}
              </Box>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Maradék
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {aiUsage.remaining !== null ? aiUsage.remaining.toLocaleString('hu-HU') : '∞'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Becsült költség
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    ${aiUsage.total_cost.toFixed(4)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Generálások száma
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {aiUsage.usage_count}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
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
                          {plan.features.ai_monthly_limit && ` (${plan.features.ai_monthly_limit.toLocaleString('hu-HU')} token/hó)`}
                          {plan.features.ai_monthly_limit === null && ' (korlátlan)'}
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
