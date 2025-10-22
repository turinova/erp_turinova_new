'use client'

import React, { useState, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete, Divider, Button, Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ExpandMore as ExpandMoreIcon, Clear as ClearIcon, Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'

// Types
interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
}

interface ShopOrderItem {
  id: string
  product_name: string
  sku: string
  type: string
  base_price: number
  multiplier: number
  quantity: number
  megjegyzes: string
  status: string
  units: {
    id: string
    name: string
    shortform: string
  }
  partners: {
    id: string
    name: string
  }
  vat: {
    id: string
    kulcs: number
  }
  currencies: {
    id: string
    name: string
  }
}

interface ShopOrderData {
  id: string
  order_number: string
  worker_id: string
  worker: Worker
  customer_name: string
  customer_email: string
  customer_mobile: string
  customer_discount: number
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  status: string
  items: ShopOrderItem[]
  totals: {
    total_net: number
    total_gross: number
    final_total: number
    discount_amount: number
  }
  created_at: string
  updated_at: string
}

interface ShopOrderEditClientProps {
  initialOrderData: ShopOrderData
}

export default function ShopOrderEditClient({ initialOrderData }: ShopOrderEditClientProps) {
  const [orderData] = useState<ShopOrderData>(initialOrderData)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form data from existing order
  const [workerId, setWorkerId] = useState(orderData.worker_id)
  const [customerData, setCustomerData] = useState({
    name: orderData.customer_name,
    email: orderData.customer_email || '',
    mobile: orderData.customer_mobile || '',
    billing_name: orderData.billing_name || '',
    billing_country: orderData.billing_country || '',
    billing_city: orderData.billing_city || '',
    billing_postal_code: orderData.billing_postal_code || '',
    billing_street: orderData.billing_street || '',
    billing_house_number: orderData.billing_house_number || '',
    billing_tax_number: orderData.billing_tax_number || '',
    billing_company_reg_number: orderData.billing_company_reg_number || '',
    discount_percent: orderData.customer_discount
  })

  // Convert existing items to products table format
  const [productsTable, setProductsTable] = useState(
    orderData.items.map(item => ({
      id: item.id,
      name: item.product_name,
      sku: item.sku,
      type: item.type,
      base_price: item.base_price,
      multiplier: item.multiplier,
      quantity: item.quantity,
      net_price: Math.round(item.base_price * item.multiplier),
      gross_price: Math.round(item.base_price * item.multiplier * (1 + (item.vat?.kulcs || 0) / 100)),
      vat_id: item.vat.id,
      currency_id: item.currencies.id,
      units_id: item.units.id,
      partners_id: item.partners.id,
      megjegyzes: item.megjegyzes || '',
      brand_name: '',
      dimensions: ''
    }))
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: Implement update API call
      toast.success(`Beszerzés ${orderData.order_number} sikeresen frissítve!`)
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Hiba történt a beszerzés frissítése során')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate totals
  const totals = productsTable.reduce((acc, product) => {
    const itemTotal = product.gross_price * product.quantity
    const discountAmount = itemTotal * (customerData.discount_percent / 100)
    
    acc.productsTotal += itemTotal
    acc.discountAmount += discountAmount
    acc.finalTotal += itemTotal - discountAmount
    
    return acc
  }, {
    productsTotal: 0,
    discountAmount: 0,
    finalTotal: 0
  })

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          href="/customer-orders"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <ArrowBackIcon fontSize="small" />
          Ügyfél rendelések
        </Link>
        <Link
          component={NextLink}
          href={`/customer-orders/${orderData.id}`}
        >
          {orderData.order_number}
        </Link>
        <Typography color="text.primary">
          Szerkesztés
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1" gutterBottom>
        Beszerzés szerkesztése
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column - Form */}
        <Grid item xs={12} md={8}>
          {/* Worker Selection */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Dolgozó kiválasztása
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <FormControl fullWidth size="small">
                <InputLabel>Dolgozó</InputLabel>
                <Select
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  label="Dolgozó"
                >
                  <MenuItem value={orderData.worker.id}>
                    {orderData.worker.name}
                    {orderData.worker.nickname && ` (${orderData.worker.nickname})`}
                  </MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {/* Customer Section */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Megrendelő adatai
                </Typography>
                <Button
                  size="small"
                  color="error"
                  startIcon={<ClearIcon />}
                  onClick={() => {
                    setCustomerData({
                      name: '',
                      email: '',
                      mobile: '',
                      billing_name: '',
                      billing_country: '',
                      billing_city: '',
                      billing_postal_code: '',
                      billing_street: '',
                      billing_house_number: '',
                      billing_tax_number: '',
                      billing_company_reg_number: '',
                      discount_percent: 0
                    })
                  }}
                >
                  Törlés
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Név *"
                    value={customerData.name}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Telefon"
                    value={customerData.mobile}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, mobile: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Kedvezmény (%)"
                    type="number"
                    value={customerData.discount_percent}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, discount_percent: parseFloat(e.target.value) || 0 }))}
                  />
                </Grid>
              </Grid>

              {/* Billing Information Accordion */}
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Számlázási adatok</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Számlázási név"
                        value={customerData.billing_name}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_name: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Ország"
                        value={customerData.billing_country}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_country: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Város"
                        value={customerData.billing_city}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_city: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Irányítószám"
                        value={customerData.billing_postal_code}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_postal_code: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Utca"
                        value={customerData.billing_street}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_street: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Házszám"
                        value={customerData.billing_house_number}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_house_number: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Adószám"
                        value={customerData.billing_tax_number}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_tax_number: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Cégjegyzékszám"
                        value={customerData.billing_company_reg_number}
                        onChange={(e) => setCustomerData(prev => ({ ...prev, billing_company_reg_number: e.target.value }))}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Termékek
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Termék neve</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Típus</TableCell>
                      <TableCell align="right">Nettó egységár</TableCell>
                      <TableCell align="right">Bruttó egységár</TableCell>
                      <TableCell align="right">Mennyiség</TableCell>
                      <TableCell align="right">Nettó összesen</TableCell>
                      <TableCell align="right">Bruttó összesen</TableCell>
                      <TableCell align="center">Megjegyzés</TableCell>
                      <TableCell align="center">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productsTable.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.type}</TableCell>
                        <TableCell align="right">{product.net_price.toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="right">{product.gross_price.toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="right">{product.quantity} db</TableCell>
                        <TableCell align="right">{(product.net_price * product.quantity).toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="right">{(product.gross_price * product.quantity).toLocaleString('hu-HU')} Ft</TableCell>
                        <TableCell align="center">
                          {product.megjegyzes ? (
                            <Tooltip title={product.megjegyzes} arrow placement="top">
                              <IconButton
                                size="small"
                                color="info"
                                sx={{ '&:hover': { backgroundColor: 'info.light', color: 'white' } }}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setProductsTable(prev => prev.filter(p => p.id !== product.id))
                            }}
                            sx={{ '&:hover': { backgroundColor: 'error.light', color: 'white' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Summary */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Összesítés
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Termékek összesen:</Typography>
                <Typography variant="body2">
                  {Math.round(totals.productsTotal).toLocaleString('hu-HU')} Ft
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Kedvezmény ({customerData.discount_percent}%):</Typography>
                <Typography variant="body2" color="error">
                  -{Math.round(totals.discountAmount).toLocaleString('hu-HU')} Ft
                </Typography>
              </Box>
              
              <Divider sx={{ my: 1 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight="bold">Végső összeg:</Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {Math.round(totals.finalTotal).toLocaleString('hu-HU')} Ft
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />
              
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleSave}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={20} /> : <AddIcon />}
              >
                {isSaving ? 'Mentés...' : 'Mentés'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
