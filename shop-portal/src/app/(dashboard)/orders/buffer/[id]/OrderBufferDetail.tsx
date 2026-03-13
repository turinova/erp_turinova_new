'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material'
import {
  PlayArrow as PlayArrowIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Person as PersonIcon,
  LocalShipping as LocalShippingIcon,
  Payment as PaymentIcon,
  ShoppingCart as ShoppingCartIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface BufferEntry {
  id: string
  connection_id: string
  platform_order_id: string
  platform_order_resource_id: string | null
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'blacklisted'
  is_blacklisted: boolean
  blacklist_reason: string | null
  error_message: string | null
  received_at: string
  created_at: string
  updated_at: string
  processed_at: string | null
  processed_by: string | null
  webhook_data: any
  webshop_connections: {
    id: string
    name: string
    api_url: string
  } | null
}

interface OrderBufferDetailProps {
  initialEntry: BufferEntry
}

export default function OrderBufferDetail({ initialEntry }: OrderBufferDetailProps) {
  const router = useRouter()
  const [entry, setEntry] = useState<BufferEntry>(initialEntry)
  const [processing, setProcessing] = useState(false)

  const handleProcess = async () => {
    setProcessing(true)
    try {
      const response = await fetch(`/api/orders/buffer/${entry.id}/process`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.details || 'Failed to process buffer entry')
      }

      const data = await response.json()
      toast.success(`Rendelés létrehozva: ${data.order_number || data.order_id}`)
      
      // Refresh entry
      const refreshResponse = await fetch(`/api/orders/buffer/${entry.id}`)
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setEntry(refreshData.entry)
      }

      // Navigate to order if created
      if (data.order_id) {
        router.push(`/orders/${data.order_id}`)
      }
    } catch (error) {
      console.error('Error processing buffer entry:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba a buffer bejegyzés feldolgozásakor')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusChip = () => {
    if (entry.is_blacklisted) {
      return <Chip icon={<BlockIcon />} label="Feketelistán" color="error" />
    }

    switch (entry.status) {
      case 'pending':
        return <Chip icon={<WarningIcon />} label="Függőben" color="warning" />
      case 'processing':
        return <Chip icon={<CircularProgress size={16} />} label="Feldolgozás..." color="info" />
      case 'processed':
        return <Chip icon={<CheckCircleIcon />} label="Feldolgozva" color="success" />
      case 'failed':
        return <Chip icon={<CancelIcon />} label="Sikertelen" color="error" />
      default:
        return <Chip label={entry.status} />
    }
  }

  const formatCurrency = (amount: string | number | null, currency: string = 'HUF') => {
    if (!amount) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const webhookData = entry.webhook_data || {}
  const orderData = webhookData.orders?.order?.[0] || webhookData.order || webhookData

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={NextLink} href="/orders/buffer">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1">
              Buffer bejegyzés
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Platform rendelés ID: {entry.platform_order_id}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {getStatusChip()}
          {entry.status === 'pending' && !entry.is_blacklisted && (
            <Button
              variant="contained"
              color="primary"
              startIcon={processing ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              onClick={handleProcess}
              disabled={processing}
            >
              Feldolgozás
            </Button>
          )}
        </Box>
      </Box>

      {entry.is_blacklisted && entry.blacklist_reason && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Feketelistán: {entry.blacklist_reason}
          </Typography>
        </Alert>
      )}

      {entry.status === 'failed' && entry.error_message && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hiba: {entry.error_message}
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Alapinformációk */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Alapinformációk
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Kapcsolat
                  </Typography>
                  <Typography variant="body1">
                    {entry.webshop_connections?.name || '-'}
                  </Typography>
                  {entry.webshop_connections?.api_url && (
                    <Typography variant="caption" color="text.secondary">
                      {entry.webshop_connections.api_url}
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Platform rendelés ID
                  </Typography>
                  <Typography variant="body1" fontFamily="monospace">
                    {entry.platform_order_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Fogadva
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(entry.received_at)}
                  </Typography>
                </Box>
                {entry.processed_at && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Feldolgozva
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(entry.processed_at)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Vásárló információk */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Vásárló
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Név
                  </Typography>
                  <Typography variant="body1">
                    {orderData.firstname && orderData.lastname
                      ? `${orderData.firstname} ${orderData.lastname}`
                      : '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {orderData.email || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Telefon
                  </Typography>
                  <Typography variant="body1">
                    {orderData.phone || '-'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Szállítási cím */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Szállítási cím
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="body2">
                  {orderData.shippingFirstname || orderData.firstname} {orderData.shippingLastname || orderData.lastname}
                </Typography>
                {orderData.shippingCompany && (
                  <Typography variant="body2">
                    {orderData.shippingCompany}
                  </Typography>
                )}
                <Typography variant="body2">
                  {orderData.shippingAddress1 || orderData.shipping_address1}
                </Typography>
                {orderData.shippingAddress2 && (
                  <Typography variant="body2">
                    {orderData.shippingAddress2}
                  </Typography>
                )}
                <Typography variant="body2">
                  {orderData.shippingPostcode || orderData.shipping_postcode} {orderData.shippingCity || orderData.shipping_city}
                </Typography>
                {orderData.shippingCountryName && (
                  <Typography variant="body2">
                    {orderData.shippingCountryName}
                  </Typography>
                )}
                {orderData.shippingMethodName && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Szállítási mód
                    </Typography>
                    <Typography variant="body2">
                      {orderData.shippingMethodName}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Fizetési információk */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PaymentIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Fizetési információk
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {orderData.paymentMethodName && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Fizetési mód
                    </Typography>
                    <Typography variant="body1">
                      {orderData.paymentMethodName}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Összeg
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(orderData.totalGross || orderData.total, orderData.currency?.code || 'HUF')}
                  </Typography>
                </Box>
                {orderData.couponCode && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Kupon kód
                    </Typography>
                    <Typography variant="body1">
                      {orderData.couponCode}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Termékek */}
        {orderData.orderProducts && Array.isArray(orderData.orderProducts) && orderData.orderProducts.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <ShoppingCartIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Termékek
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Termék neve</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Mennyiség</TableCell>
                        <TableCell align="right">Nettó ár</TableCell>
                        <TableCell align="right">Bruttó ár</TableCell>
                        <TableCell align="right">Összesen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orderData.orderProducts.map((product: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{product.name || '-'}</TableCell>
                          <TableCell>{product.sku || '-'}</TableCell>
                          <TableCell align="right">{product.quantity || 1}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(product.price || product.priceNet, product.currency || 'HUF')}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(product.priceGross || product.price, product.currency || 'HUF')}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(
                              (product.priceGross || product.price || 0) * (product.quantity || 1),
                              product.currency || 'HUF'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Webhook adatok (JSON) */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon />
                <Typography variant="h6">Teljes webhook adatok (JSON)</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  overflow: 'auto',
                  maxHeight: 600,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}
              >
                {JSON.stringify(entry.webhook_data, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  )
}
