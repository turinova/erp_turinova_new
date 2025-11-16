'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Breadcrumbs, Button, Card, CardContent, CircularProgress, FormControl, Grid, InputLabel, Link, MenuItem, Paper, Select, Stack, TextField, Typography
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import Autocomplete from '@mui/material/Autocomplete'

interface PurchaseOrderFormClientProps {
  mode: 'create' | 'edit'
  id?: string
}

interface VatRow { id: string; kulcs: number }
interface CurrencyRow { id: string; name: string }
interface UnitRow { id: string; name: string; shortform: string }
interface PartnerRow { id: string; name: string }
interface WarehouseRow { id: string; name: string }

interface ItemDraft {
  product_type: 'accessory' | 'material' | 'linear_material'
  accessory_id?: string | null
  material_id?: string | null
  linear_material_id?: string | null
  description: string
  quantity: number
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  sku?: string
  megjegyzes?: string
}

interface ProductPickerProps {
  vatRates: VatRow[]
  currencies: CurrencyRow[]
  units: UnitRow[]
  onAdd: (item: ItemDraft) => void
}

function ProductPicker({ vatRates, currencies, units, onAdd }: ProductPickerProps) {
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [form, setForm] = useState({
    name: '',
    sku: '',
    base_price: '',
    quantity: 1 as number | '',
    vat_id: '',
    currency_id: '',
    units_id: '',
    megjegyzes: '',
    pending_source: '' as string | '',
    pending_accessory_id: '' as string | '',
    pending_material_id: '' as string | '',
    pending_linear_material_id: '' as string | ''
  })

  const defaultVat = vatRates.find(v => v.kulcs === 27) || vatRates[0]
  const defaultCur = currencies.find(c => c.name === 'HUF') || currencies[0]
  const defaultUnit = units.find(u => u.shortform === 'db') || units[0]

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      vat_id: defaultVat?.id || '',
      currency_id: defaultCur?.id || '',
      units_id: defaultUnit?.id || ''
    }))
  }, [defaultVat, defaultCur, defaultUnit])

  // Search
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/shoporder/search?q=${encodeURIComponent(searchTerm)}`)
        if (res.ok) {
          const data = await res.json()
          const all = [...(data.materials || []), ...(data.linearMaterials || []), ...(data.accessories || [])]
          setSearchResults(all)
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const handleAccessoryChange = (_: any, newValue: any | null) => {
    if (!newValue) {
      setSelectedItem(null)
      setForm(prev => ({
        ...prev,
        name: '',
        sku: '',
        base_price: '',
        quantity: 1,
        megjegyzes: '',
        pending_source: '',
        pending_accessory_id: '',
        pending_material_id: '',
        pending_linear_material_id: ''
      }))
      return
    }
    setSelectedItem(newValue)
    // store pending FKs and fill fields
    const source = newValue.source
    setForm(prev => ({
      ...prev,
      name: newValue.name,
      sku: newValue.sku || '',
      base_price: newValue.base_price?.toString() || '',
      quantity: 1,
      vat_id: newValue.vat_id || prev.vat_id,
      currency_id: newValue.currency_id || prev.currency_id,
      units_id: source === 'linear_materials' ? (units.find(u => u.name === 'Szál')?.id || prev.units_id) : (newValue.units_id || prev.units_id),
      pending_source: source,
      pending_accessory_id: source === 'accessories' ? newValue.id : '',
      pending_material_id: source === 'materials' ? newValue.id : '',
      pending_linear_material_id: source === 'linear_materials' ? newValue.id : ''
    }))
  }

  const canAdd =
    !!form.pending_source &&
    (form.pending_accessory_id || form.pending_material_id || form.pending_linear_material_id) &&
    Number(form.base_price) >= 0 &&
    Number(form.quantity) > 0 &&
    !!form.vat_id &&
    !!form.currency_id &&
    !!form.units_id

  const onSubmitAdd = () => {
    if (!canAdd || !selectedItem) return
    const netUnit = Math.round((Number(form.base_price) || 0) * (selectedItem.multiplier || 1))
    const product_type =
      form.pending_source === 'materials' ? 'material' :
      form.pending_source === 'linear_materials' ? 'linear_material' : 'accessory'
    onAdd({
      product_type,
      accessory_id: form.pending_accessory_id || null,
      material_id: form.pending_material_id || null,
      linear_material_id: form.pending_linear_material_id || null,
      description: form.name,
      quantity: Number(form.quantity) || 1,
      net_price: netUnit,
      vat_id: form.vat_id,
      currency_id: form.currency_id,
      units_id: form.units_id,
      sku: form.sku,
      megjegyzes: form.megjegyzes
    })
    // reset selection
    setSelectedItem(null)
    setSearchTerm('')
    setForm(prev => ({
      ...prev,
      name: '',
      sku: '',
      base_price: '',
      quantity: 1,
      megjegyzes: '',
      pending_source: '',
      pending_accessory_id: '',
      pending_material_id: '',
      pending_linear_material_id: ''
    }))
  }

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          {/* Row 1: Termék neve (autocomplete), SKU */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              fullWidth
              options={searchResults}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.name}${opt.sku ? ` (${opt.sku})` : ''}`)}
              isOptionEqualToValue={(a, b) => (a && b) ? a.id === b.id && a.source === b.source : a === b}
              value={selectedItem}
              onChange={handleAccessoryChange}
              inputValue={searchTerm}
              onInputChange={(_, v) => setSearchTerm(v)}
              filterOptions={(o) => o} // don't filter client-side
              renderOption={(props, option) => {
                const { key, ...other } = props as any
                const isMaterial = option.source === 'materials'
                const isLinear = option.source === 'linear_materials'
                const rightNet = Math.round((option.base_price || 0) * (option.multiplier || 1))
                return (
                  <li key={key} {...other}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {isMaterial || isLinear ? (
                            <>
                              {option.brand_name ? `Márka: ${option.brand_name} ` : ''}
                              {option.dimensions ? `| Méret: ${option.dimensions} ` : ''}
                              | 
                            </>
                          ) : null}
                          {' '}SKU: {option.sku || '-'}
                          {option.partner_name ? ` | Partner: ${option.partner_name}` : ''}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {new Intl.NumberFormat('hu-HU').format(rightNet)} Ft
                      </Typography>
                    </Box>
                  </li>
                )
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Termék neve"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isSearching ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
              disabled
            />
          </Grid>

          {/* Row 2: Beszerzési ár, Mennyiség, ÁFA, Pénznem, Megjegyzés */}
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              type="number"
              label="Beszerzési ár"
              value={form.base_price}
              onChange={(e) => setForm(prev => ({ ...prev, base_price: e.target.value }))}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              type="number"
              label="Mennyiség"
              value={form.quantity}
              onChange={(e) => setForm(prev => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
              inputProps={{ min: 1, step: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <FormControl fullWidth>
              <InputLabel>ÁFA</InputLabel>
              <Select
                label="ÁFA"
                value={form.vat_id}
                onChange={(e) => setForm(prev => ({ ...prev, vat_id: e.target.value }))}
              >
                {vatRates.map(v => (
                  <MenuItem key={v.id} value={v.id}>{v.kulcs}%</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <FormControl fullWidth>
              <InputLabel>Pénznem</InputLabel>
              <Select
                label="Pénznem"
                value={form.currency_id}
                onChange={(e) => setForm(prev => ({ ...prev, currency_id: e.target.value }))}
              >
                {currencies.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              label="Megjegyzés"
              value={form.megjegyzes}
              onChange={(e) => setForm(prev => ({ ...prev, megjegyzes: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={onSubmitAdd} disabled={!canAdd}>
                Hozzáadása
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
export default function PurchaseOrderFormClient({ mode, id }: PurchaseOrderFormClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)

  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [vatRates, setVatRates] = useState<VatRow[]>([])
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])

  const [partnerId, setPartnerId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const [items, setItems] = useState<ItemDraft[]>([])

  const totals = useMemo(() => {
    let itemsCount = items.length
    let totalQty = 0
    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    const vatMap = new Map(vatRates.map(v => [v.id, v.kulcs || 0]))
    for (const it of items) {
      totalQty += it.quantity || 0
      const net = Math.round((it.base_price || 0) * (it.multiplier || 1))
      const lineNet = net * (it.quantity || 0)
      totalNet += lineNet
      const vatPercent = vatMap.get(it.vat_id) || 0
      const lineVat = Math.round(lineNet * (vatPercent / 100))
      totalVat += lineVat
      totalGross += lineNet + lineVat
    }
    return { itemsCount, totalQty, totalNet, totalVat, totalGross }
  }, [items, vatRates])

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [vatRes, curRes, unitRes, partnerRes, whRes] = await Promise.all([
          fetch('/api/vat'), // assuming exists
          fetch('/api/currencies'),
          fetch('/api/units'),
          fetch('/api/partners'),
          fetch('/api/warehouses')
        ])
        const [vatData, curData, unitData, partnerData, whData] = await Promise.all([
          vatRes.ok ? vatRes.json() : { vat: [] },
          curRes.ok ? curRes.json() : { currencies: [] },
          unitRes.ok ? unitRes.json() : { units: [] },
          partnerRes.ok ? partnerRes.json() : { partners: [] },
          whRes.ok ? whRes.json() : { warehouses: [] }
        ])
        setVatRates(vatData.vat || vatData || [])
        setCurrencies(curData.currencies || curData || [])
        setUnits(unitData.units || unitData || [])
        setPartners(partnerData.partners || partnerData || [])
        setWarehouses(whData.warehouses || whData || [])
      } catch (e) {
        // ignore
      }
    }
    loadStatic()
  }, [])

  useEffect(() => {
    const loadExisting = async () => {
      if (mode !== 'edit' || !id) return
      try {
        const res = await fetch(`/api/purchase-order/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Hiba a PO betöltésekor')
        setPartnerId(data.header.partner_id || '')
        setWarehouseId(data.header.warehouse_id || '')
        setOrderDate(data.header.order_date || new Date().toISOString().slice(0, 10))
        setExpectedDate(data.header.expected_date || '')
        setNote(data.header.note || '')
        setItems((data.items || []).map((it: any) => ({
          product_type: it.product_type,
          accessory_id: it.accessory_id,
          material_id: it.material_id,
          linear_material_id: it.linear_material_id,
          description: it.description || '',
          quantity: Number(it.quantity) || 0,
          base_price: 0,
          multiplier: 1,
          net_price: Number(it.net_price) || 0,
          vat_id: it.vat_id,
          currency_id: it.currency_id,
          units_id: it.units_id
        })))
      } catch (e) {
        // noop
      } finally {
        setLoading(false)
      }
    }
    loadExisting()
  }, [mode, id])

  const addBlankItem = () => {
    const defaultVat = vatRates.find(v => v.kulcs === 27)
    const defaultCur = currencies.find(c => c.name === 'HUF')
    const defaultUnit = units[0]
    setItems(prev => [...prev, {
      product_type: 'accessory',
      description: '',
      quantity: 1,
      base_price: 0,
      multiplier: 1.38,
      net_price: 0,
      vat_id: defaultVat?.id || '',
      currency_id: defaultCur?.id || '',
      units_id: defaultUnit?.id || ''
    }])
  }

  const handleSave = async () => {
    if (!partnerId || !warehouseId) {
      toast.error('Partner és Raktár kötelező')
      return
    }
    if (mode === 'create') {
      setSaving(true)
      try {
        const res = await fetch('/api/purchase-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner_id: partnerId,
            warehouse_id: warehouseId,
            order_date: orderDate || new Date().toISOString().slice(0, 10),
            expected_date: expectedDate || null,
            note: note || null
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Hiba a PO létrehozásakor')
        const poId = data.id
        if (items.length > 0) {
          // map items to API shape
          const prepared = items.map(it => ({
            product_type: it.product_type,
            accessory_id: it.accessory_id || null,
            material_id: it.material_id || null,
            linear_material_id: it.linear_material_id || null,
            quantity: it.quantity,
            net_price: Math.round((it.base_price || 0) * (it.multiplier || 1)),
            vat_id: it.vat_id,
            currency_id: it.currency_id,
            units_id: it.units_id,
            description: it.description || ''
          }))
          const resItems = await fetch(`/api/purchase-order/${poId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: prepared })
          })
          const dataItems = await resItems.json()
          if (!resItems.ok) throw new Error(dataItems?.error || 'Hiba a tételek mentésekor')
        }
        toast.success('PO létrehozva')
        router.push(`/purchase-order/${poId}`)
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : 'Hiba a mentéskor')
      } finally {
        setSaving(false)
      }
    } else {
      // edit header only
      setSaving(true)
      try {
        const res = await fetch(`/api/purchase-order/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner_id: partnerId,
            warehouse_id: warehouseId,
            order_date: orderDate || null,
            expected_date: expectedDate || null,
            note: note || null
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Hiba a frissítéskor')
        toast.success('PO frissítve')
        router.refresh()
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : 'Hiba a frissítéskor')
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/purchase-order"
        >
          Beszállítói rendelése
        </Link>
        <Typography color="text.primary">
          {mode === 'create' ? 'Új' : 'Szerkesztés'}
        </Typography>
      </Breadcrumbs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Alap adatok</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Beszállító</InputLabel>
                  <Select
                    value={partnerId}
                    label="Beszállító"
                    onChange={(e) => setPartnerId(e.target.value)}
                    MenuProps={{
                      PaperProps: {
                        style: { maxHeight: 320, width: 360 }
                      }
                    }}
                  >
                    {partners.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Raktár</InputLabel>
                  <Select value={warehouseId} label="Raktár" onChange={(e) => setWarehouseId(e.target.value)}>
                    {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Rendelés dátuma"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Várható dátum"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Megjegyzés" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Termék hozzáadása</Typography>
            <Stack spacing={2}>
              <ProductPicker
                vatRates={vatRates}
                currencies={currencies}
                units={units}
                onAdd={(item) => {
                  setItems(prev => [...prev, item])
                }}
              />
              {items.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>Tételek</Typography>
                  <Grid container>
                    <Grid item xs={12}>
                      <Box sx={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px' }}>Termék neve</th>
                              <th style={{ textAlign: 'left', padding: '8px' }}>SKU</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Mennyiség</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Nettó egységár</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>ÁFA %</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Nettó összesen</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Bruttó összesen</th>
                              <th style={{ textAlign: 'center', padding: '8px' }}>Művelet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, idx) => {
                              const vatPercent = vatRates.find(v => v.id === it.vat_id)?.kulcs || 0
                              const qty = Number(it.quantity) || 0
                              const netUnit = Number(it.net_price) || 0
                              const lineNet = netUnit * qty
                              const lineVat = Math.round(lineNet * (vatPercent / 100))
                              const lineGross = lineNet + lineVat
                              return (
                                <tr key={idx} style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                  <td style={{ padding: '8px' }}>{it.description}</td>
                                  <td style={{ padding: '8px' }}>{it.sku || '-'}</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{qty}</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{new Intl.NumberFormat('hu-HU').format(netUnit)} Ft</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{vatPercent}%</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{new Intl.NumberFormat('hu-HU').format(lineNet)} Ft</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{new Intl.NumberFormat('hu-HU').format(lineGross)} Ft</td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <Button size="small" color="error" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                                      Törlés
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Ár összegzés</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2.5}>
                <Card><CardContent>
                  <Typography variant="caption" color="text.secondary">Tételszám</Typography>
                  <Typography variant="h6">{totals.itemsCount}</Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={2.5}>
                <Card><CardContent>
                  <Typography variant="caption" color="text.secondary">Össz. mennyiség</Typography>
                  <Typography variant="h6">{totals.totalQty}</Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={2.5}>
                <Card><CardContent>
                  <Typography variant="caption" color="text.secondary">Termékek Nettó [HUF]</Typography>
                  <Typography variant="h6">{new Intl.NumberFormat('hu-HU').format(totals.totalNet)} Ft</Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={2.5}>
                <Card><CardContent>
                  <Typography variant="caption" color="text.secondary">Termékek ÁFA [HUF]</Typography>
                  <Typography variant="h6">{new Intl.NumberFormat('hu-HU').format(totals.totalVat)} Ft</Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={2}>
                <Card><CardContent>
                  <Typography variant="caption" color="text.secondary">Bruttó összesen</Typography>
                  <Typography variant="h6">{new Intl.NumberFormat('hu-HU').format(totals.totalGross)} Ft</Typography>
                </CardContent></Card>
              </Grid>
            </Grid>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {mode === 'create' ? 'Mentés' : 'Frissítés'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  )
}


