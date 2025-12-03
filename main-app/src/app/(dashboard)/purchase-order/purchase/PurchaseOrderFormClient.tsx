'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Breadcrumbs, Button, Card, CardContent, Chip, CircularProgress, FormControl, Grid, InputLabel, Link, MenuItem, Paper, Select, Stack, TextField, Typography, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip
} from '@mui/material'
import { Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { Home as HomeIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import Autocomplete from '@mui/material/Autocomplete'

interface PurchaseOrderFormClientProps {
  mode: 'create' | 'edit'
  id?: string
  initialHeader?: {
    id: string
    po_number: string
    status: string
    partner_id: string
    partner_name: string
    warehouse_id: string
    order_date: string
    expected_date: string | null
    note: string | null
    created_at: string
    updated_at: string
    shipments?: Array<{ id: string; number: string }>
  } | null
  initialItems?: any[]
  initialVatRates?: VatRow[]
  initialCurrencies?: CurrencyRow[]
  initialUnits?: UnitRow[]
  initialPartners?: PartnerRow[]
  initialWarehouses?: WarehouseRow[]
}

interface VatRow { id: string; kulcs: number }
interface CurrencyRow { id: string; name: string }
interface UnitRow { id: string; name: string; shortform: string }
interface PartnerRow { id: string; name: string }
interface WarehouseRow { id: string; name: string }

interface ItemDraft {
  id?: string // Optional: present for existing items, absent for new items
  product_type: 'accessory' | 'material' | 'linear_material'
  accessory_id?: string | null
  material_id?: string | null
  linear_material_id?: string | null
  description: string
  quantity: number
  // optional pricing fields preserved for editing and summary calculations
  base_price?: number
  multiplier?: number
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  sku?: string
  megjegyzes?: string
  quantity_received?: number // Total quantity received from all shipments
  // Internal: store multiplier used at selection time to allow edits
  __multiplier?: number
}

interface ProductPickerProps {
  vatRates: VatRow[]
  currencies: CurrencyRow[]
  units: UnitRow[]
  onAdd: (item: ItemDraft) => void
  onUpdate: (index: number, item: ItemDraft) => void
  editingIndex: number | null
  editingItem: (ItemDraft & {
    pending_source?: string
    pending_accessory_id?: string
    pending_material_id?: string
    pending_linear_material_id?: string
    base_price_hint?: number
  }) | null
  disabled?: boolean // Disable when PO status is not 'draft'
}

function ProductPicker({ vatRates, currencies, units, onAdd, onUpdate, editingIndex, editingItem, disabled = false }: ProductPickerProps) {
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [mounted, setMounted] = useState(false)
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
    if (disabled) return // Prevent any action if disabled
    if (!canAdd) return
    const effectiveMultiplier = selectedItem?.multiplier || editingItem?.__multiplier || 1
    const netUnit = Math.round((Number(form.base_price) || 0) * (effectiveMultiplier || 1))
    const product_type =
      form.pending_source === 'materials' ? 'material' :
      form.pending_source === 'linear_materials' ? 'linear_material' : 'accessory'
    const newItem: ItemDraft = {
      id: editingItem?.id, // Preserve ID when updating
      product_type,
      accessory_id: form.pending_accessory_id && form.pending_accessory_id.trim() ? form.pending_accessory_id : null,
      material_id: form.pending_material_id && form.pending_material_id.trim() ? form.pending_material_id : null,
      linear_material_id: form.pending_linear_material_id && form.pending_linear_material_id.trim() ? form.pending_linear_material_id : null,
      description: form.name,
      quantity: Number(form.quantity) || 1,
      net_price: netUnit,
      vat_id: form.vat_id,
      currency_id: form.currency_id,
      units_id: form.units_id,
      sku: form.sku,
      megjegyzes: form.megjegyzes,
      __multiplier: effectiveMultiplier
    }
    console.log('Adding new item:', newItem)
    if (editingIndex !== null) onUpdate(editingIndex, newItem)
    else onAdd(newItem)
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

  // Load editing item into form when provided
  useEffect(() => {
    if (editingIndex !== null && editingItem) {
      const pending_source = editingItem.pending_source ||
        (editingItem.material_id ? 'materials' : editingItem.linear_material_id ? 'linear_materials' : 'accessories')
      const base_price_val = editingItem.base_price_hint ??
        (editingItem.__multiplier ? Math.round(editingItem.net_price / editingItem.__multiplier) : editingItem.net_price)
      setForm(prev => ({
        ...prev,
        name: editingItem.description,
        sku: editingItem.sku || '',
        base_price: String(base_price_val || ''),
        quantity: editingItem.quantity,
        vat_id: editingItem.vat_id,
        currency_id: editingItem.currency_id,
        units_id: editingItem.units_id,
        megjegyzes: editingItem.megjegyzes || '',
        pending_source,
        pending_accessory_id: editingItem.accessory_id || '',
        pending_material_id: editingItem.material_id || '',
        pending_linear_material_id: editingItem.linear_material_id || ''
      }))
      // Ensure the Autocomplete input shows the current name
      setSearchTerm(editingItem.description || '')
      setSelectedItem({
        id: 'editing',
        name: editingItem.description,
        sku: editingItem.sku || ''
      } as any)
    }
  }, [editingIndex, editingItem])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Grid container spacing={2} sx={{ mx: -1 }}>
      {/* Row 1: Termék neve, SKU, Beszerzési ár (fill full width: 6 + 4 + 2 = 12) */}
      <Grid item xs={12} md={6}>
        <Autocomplete
          fullWidth
          size="small"
          options={searchResults}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.name}${opt.sku ? ` (${opt.sku})` : ''}`)}
          isOptionEqualToValue={(a, b) => (a && b) ? a.id === b.id && a.source === b.source : a === b}
          value={selectedItem}
          onChange={handleAccessoryChange}
          inputValue={searchTerm}
          onInputChange={(_, v) => setSearchTerm(v)}
          filterOptions={(o) => o}
          disabled={disabled}
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
              size="small"
              disabled={disabled}
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
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="SKU"
          size="small"
          value={form.sku}
          onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
          disabled
        />
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField
          fullWidth
          type="number"
          label="Beszerzési ár"
           size="small"
          value={form.base_price}
          onChange={(e) => setForm(prev => ({ ...prev, base_price: e.target.value }))}
          inputProps={{ min: 0, step: 1 }}
          disabled={disabled}
        />
      </Grid>
      {/* Force Row 2 */}
      <Grid item xs={12} />

      {/* Row 2: Mennyiség, Mértékegység, Pénznem, ÁFA (4 equal columns) */}
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          type="number"
          label="Mennyiség"
          size="small"
          value={form.quantity}
          onChange={(e) => setForm(prev => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
          inputProps={{ min: 1, step: 1 }}
          disabled={disabled}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Mértékegység</InputLabel>
          <Select
            label="Mértékegység"
            value={form.units_id}
            onChange={(e) => setForm(prev => ({ ...prev, units_id: e.target.value }))}
            disabled={disabled}
          >
            {units.map(u => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}{u.shortform ? ` (${u.shortform})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Pénznem</InputLabel>
          <Select
            label="Pénznem"
            value={form.currency_id}
            onChange={(e) => setForm(prev => ({ ...prev, currency_id: e.target.value }))}
            disabled={disabled}
          >
            {currencies.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>ÁFA</InputLabel>
          <Select
            label="ÁFA"
            value={form.vat_id}
            onChange={(e) => setForm(prev => ({ ...prev, vat_id: e.target.value }))}
            disabled={disabled}
          >
            {vatRates.map(v => (
              <MenuItem key={v.id} value={v.id}>{v.kulcs}%</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      {/* End Row 2 */}

      {/* Row 3: Megjegyzés + Hozzáadás */}
      <Grid item xs={12} md={11}>
        <TextField
          fullWidth
          label="Megjegyzés"
          size="small"
          value={form.megjegyzes}
          onChange={(e) => setForm(prev => ({ ...prev, megjegyzes: e.target.value }))}
          disabled={disabled}
        />
      </Grid>
      <Grid item xs={12} md={1}>
        <Button
          variant="contained"
          fullWidth
          disabled={disabled || !canAdd}
          onClick={onSubmitAdd}
        >
          {editingIndex !== null ? 'Frissítés' : 'Hozzáadás'}
        </Button>
      </Grid>
    </Grid>
  )
}
export default function PurchaseOrderFormClient({ 
  mode, 
  id,
  initialHeader = null,
  initialItems = [],
  initialVatRates = [],
  initialCurrencies = [],
  initialUnits = [],
  initialPartners = [],
  initialWarehouses = []
}: PurchaseOrderFormClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(mode === 'edit' && !initialHeader)
  const [saving, setSaving] = useState(false)
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [partnersError, setPartnersError] = useState<string | null>(null)

  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>(initialWarehouses)
  const [vatRates, setVatRates] = useState<VatRow[]>(initialVatRates)
  const [currencies, setCurrencies] = useState<CurrencyRow[]>(initialCurrencies)
  const [units, setUnits] = useState<UnitRow[]>(initialUnits)

  const [partnerId, setPartnerId] = useState(initialHeader?.partner_id || '')
  const [warehouseId, setWarehouseId] = useState(initialHeader?.warehouse_id || '')
  const [orderDate, setOrderDate] = useState<string>(initialHeader?.order_date || new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState<string>(initialHeader?.expected_date || '')
  const [note, setNote] = useState<string>(initialHeader?.note || '')
  const [poStatus, setPoStatus] = useState<string>(initialHeader?.status || '')

  // Transform initial items to ItemDraft format
  const initialItemsTransformed: ItemDraft[] = initialItems.map((it: any) => ({
    id: it.id,
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
    units_id: it.units_id,
    sku: it.sku || it.accessories?.sku || '',
    megjegyzes: '',
    quantity_received: Number(it.quantity_received) || 0
  }))

  const [items, setItems] = useState<ItemDraft[]>(initialItemsTransformed)
  const [originalItemIds, setOriginalItemIds] = useState<Set<string>>(new Set(initialItemsTransformed.map(it => it.id).filter((id): id is string => Boolean(id)))) // Track original item IDs for deletion
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingItem, setEditingItem] = useState<(ItemDraft & { base_price_hint?: number }) | null>(null)

  // Styling for disabled fields to make them more readable
  const disabledFieldSx = {
    '& .MuiInputBase-input.Mui-disabled': {
      WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
      color: 'rgba(0, 0, 0, 0.87)'
    },
    '& .MuiInputLabel-root.Mui-disabled': {
      color: 'rgba(0, 0, 0, 0.6)'
    },
    '& .MuiSelect-select.Mui-disabled': {
      WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
      color: 'rgba(0, 0, 0, 0.87)'
    }
  }

  const totals = useMemo(() => {
    let itemsCount = items.length
    let totalQty = 0
    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    const vatMap = new Map(vatRates.map(v => [v.id, v.kulcs || 0]))
    for (const it of items) {
      totalQty += it.quantity || 0
      const netUnit = Math.round(Number(it.net_price) || 0)
      const lineNet = netUnit * (it.quantity || 0)
      totalNet += lineNet
      const vatPercent = vatMap.get(it.vat_id) || 0
      const lineVat = Math.round(lineNet * (vatPercent / 100))
      totalVat += lineVat
      totalGross += lineNet + lineVat
    }
    return { itemsCount, totalQty, totalNet, totalVat, totalGross }
  }, [items, vatRates])

  // Only fetch static data if not provided via props
  useEffect(() => {
    if (initialVatRates.length === 0 || initialCurrencies.length === 0 || initialUnits.length === 0 || initialPartners.length === 0 || initialWarehouses.length === 0) {
      const loadStatic = async () => {
        try {
          const [vatRes, curRes, unitRes, partnerRes, whRes] = await Promise.all([
            fetch('/api/vat'),
            fetch('/api/currencies'),
            fetch('/api/units'),
            fetch('/api/partners'),
            fetch('/api/warehouses')
          ])
          const [vatData, curData, unitData, partnerData, whData] = await Promise.all([
            vatRes.ok ? vatRes.json() : { vat: [] },
            curRes.ok ? curRes.json() : { currencies: [] },
            unitRes.ok ? unitRes.json() : { units: [] },
            partnerRes.ok ? partnerRes.json() : null,
            whRes.ok ? whRes.json() : { warehouses: [] }
          ])
          
          // Improved error handling for partners
          if (initialPartners.length === 0) {
            setLoadingPartners(true)
            if (partnerRes.ok && partnerData && !partnerData.error) {
              // Check if response is an array or has partners property
              const partnersArray = Array.isArray(partnerData) 
                ? partnerData 
                : (partnerData.partners || [])
              setPartners(partnersArray)
              setPartnersError(null)
            } else {
              const errorMsg = partnerData?.error || 'Nem sikerült betölteni a beszállítókat'
              console.error('Error fetching partners:', errorMsg)
              setPartnersError(errorMsg)
              setPartners([]) // Ensure we always have an array
              toast.error(errorMsg)
            }
            setLoadingPartners(false)
          }
          
          if (initialVatRates.length === 0) setVatRates(vatData.vat || vatData || [])
          if (initialCurrencies.length === 0) setCurrencies(curData.currencies || curData || [])
          if (initialUnits.length === 0) setUnits(unitData.units || unitData || [])
          if (initialWarehouses.length === 0) setWarehouses(whData.warehouses || whData || [])
        } catch (e) {
          console.error('Error loading static data:', e)
          if (initialPartners.length === 0) {
            setPartnersError('Hiba történt a beszállítók betöltésekor')
            setPartners([])
            toast.error('Hiba történt a beszállítók betöltésekor')
          }
        }
      }
      loadStatic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only fetch existing data if not provided via props
  useEffect(() => {
    if (mode === 'edit' && id && !initialHeader) {
      const loadExisting = async () => {
        setLoading(true)
        try {
          const res = await fetch(`/api/purchase-order/${id}`)
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || 'Hiba a PO betöltésekor')
          setPartnerId(data.header.partner_id || '')
          setWarehouseId(data.header.warehouse_id || '')
          setOrderDate(data.header.order_date || new Date().toISOString().slice(0, 10))
          setExpectedDate(data.header.expected_date || '')
          setNote(data.header.note || '')
          setPoStatus(data.header.status || '')
          const loadedItems = (data.items || []).map((it: any) => ({
            id: it.id, // Store the item ID for tracking
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
            units_id: it.units_id,
            sku: it.sku || it.accessories?.sku || it.materials?.sku || it.linear_materials?.sku || '',
            quantity_received: Number(it.quantity_received) || 0
          }))
          setItems(loadedItems)
          // Store original item IDs for tracking deletions
          setOriginalItemIds(new Set(loadedItems.filter((it: ItemDraft) => it.id).map((it: ItemDraft) => it.id!)))
        } catch (e) {
          // noop
        } finally {
          setLoading(false)
        }
      }
      loadExisting()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, initialHeader])

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
    console.log('handleSave called', { mode, itemsCount: items.length, items })
    // Validate required header fields
    if (!partnerId) {
      toast.warning('Beszállító kötelező')
      return
    }
    if (!warehouseId) {
      toast.warning('Raktár kötelező')
      return
    }
    if (!orderDate) {
      toast.warning('Rendelés dátuma kötelező')
      return
    }
    if (!expectedDate) {
      toast.warning('Várható érkezés kötelező')
      return
    }
    // Validate at least 1 item
    if (!items || items.length === 0) {
      console.log('Validation failed: no items')
      toast.warning('Legalább egy terméket adjon hozzá')
      return
    }
    console.log('Validation passed, proceeding with save')
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
            net_price: Math.round(Number(it.net_price) || 0),
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
      // edit mode - save header AND items (smart update)
      // Prevent saving if status is not 'draft'
      if (poStatus !== 'draft') {
        toast.warning('Csak vázlat státuszú beszerzési rendelés módosítható')
        return
      }
      setSaving(true)
      try {
        // First, update the header
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

        // Smart update items: separate into new, updated, and deleted
        const currentItemIds = new Set(items.filter(it => it.id).map(it => it.id!))
        const itemsToDelete = Array.from(originalItemIds).filter(id => !currentItemIds.has(id))
        const itemsToUpdate = items.filter(it => it.id) // Items with IDs are existing (may be updated)
        const itemsToInsert = items.filter(it => !it.id) // Items without IDs are new

        console.log('Save items:', { 
          total: items.length, 
          toDelete: itemsToDelete.length, 
          toUpdate: itemsToUpdate.length, 
          toInsert: itemsToInsert.length,
          itemsToInsert 
        })

        // Delete removed items
        if (itemsToDelete.length > 0) {
          const resDelete = await fetch(`/api/purchase-order/${id}/items`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: itemsToDelete })
          })
          const deleteData = await resDelete.json()
          if (!resDelete.ok) {
            console.error('Delete error:', deleteData)
            throw new Error(deleteData?.error || 'Hiba a tételek törlésekor')
          }
        }

        // Update existing items
        for (const item of itemsToUpdate) {
          const resUpdate = await fetch(`/api/purchase-order/${id}/items`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_id: item.id,
              product_type: item.product_type,
              accessory_id: item.accessory_id || null,
              material_id: item.material_id || null,
              linear_material_id: item.linear_material_id || null,
              quantity: item.quantity,
              net_price: Math.round(Number(item.net_price) || 0),
              vat_id: item.vat_id,
              currency_id: item.currency_id,
              units_id: item.units_id,
              description: item.description || ''
            })
          })
          const updateData = await resUpdate.json()
          if (!resUpdate.ok) {
            console.error('Update error:', updateData)
            throw new Error(updateData?.error || 'Hiba a tétel frissítésekor')
          }
        }

        // Insert new items
        if (itemsToInsert.length > 0) {
          const prepared = itemsToInsert.map(it => ({
            product_type: it.product_type,
            accessory_id: it.accessory_id || null,
            material_id: it.material_id || null,
            linear_material_id: it.linear_material_id || null,
            quantity: it.quantity,
            net_price: Math.round(Number(it.net_price) || 0),
            vat_id: it.vat_id,
            currency_id: it.currency_id,
            units_id: it.units_id,
            description: it.description || ''
          }))
          console.log('Inserting items:', prepared)
          const resInsert = await fetch(`/api/purchase-order/${id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: prepared })
          })
          const insertData = await resInsert.json()
          if (!resInsert.ok) {
            console.error('Insert error:', insertData)
            throw new Error(insertData?.error || 'Hiba a tételek hozzáadásakor')
          }
        } else {
          console.log('No new items to insert')
        }

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
          Beszállítói rendelések
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
            {mode === 'edit' && poStatus !== 'draft' && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
                <Typography variant="body2" color="info.dark">
                  Csak vázlat státuszú beszerzési rendelés módosítható.
                </Typography>
              </Box>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={partners}
                  getOptionLabel={(option) => option.name || ''}
                  value={partners.find(p => p.id === partnerId) || null}
                  onChange={(_, newValue) => {
                    setPartnerId(newValue?.id || '')
                  }}
                  disabled={(mode === 'edit' && poStatus !== 'draft') || loadingPartners}
                  loading={loadingPartners}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Beszállító"
                      required
                      error={!!partnersError}
                      helperText={partnersError || ''}
                      sx={disabledFieldSx}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingPartners ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  noOptionsText={partnersError ? 'Hiba történt' : 'Nincs találat'}
                  ListboxProps={{
                    style: { maxHeight: 320 }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Raktár</InputLabel>
                  <Select 
                    value={warehouseId} 
                    label="Raktár" 
                    onChange={(e) => setWarehouseId(e.target.value)}
                    disabled={mode === 'edit' && poStatus !== 'draft'}
                    sx={disabledFieldSx}
                  >
                    {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  required
                  label="Rendelés dátuma"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={mode === 'edit' && poStatus !== 'draft'}
                  sx={disabledFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  required
                  label="Várható dátum"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={mode === 'edit' && poStatus !== 'draft'}
                  sx={disabledFieldSx}
                />
              </Grid>
              {mode === 'edit' && initialHeader && (
                <>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="PO szám"
                      value={initialHeader.po_number}
                      disabled
                      InputProps={{
                        readOnly: true,
                      }}
                      sx={disabledFieldSx}
                    />
                  </Grid>
                  {initialHeader.shipments && initialHeader.shipments.length > 0 && (
                    <Grid item xs={12} md={9}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 1 }}>
                        <Typography variant="body2" color="text.secondary">Szállítmányok:</Typography>
                        {initialHeader.shipments.map((shipment) => (
                          <Link
                            key={shipment.id}
                            component={NextLink}
                            href={`/shipments/${shipment.id}`}
                            underline="hover"
                            sx={{ fontWeight: 500 }}
                          >
                            <Chip 
                              label={shipment.number}
                              size="small"
                              clickable
                              color="primary"
                              variant="outlined"
                            />
                          </Link>
                        ))}
                      </Box>
                    </Grid>
                  )}
                </>
              )}
              <Grid item xs={12}>
                <TextField 
                  fullWidth 
                  label="Megjegyzés" 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  multiline 
                  minRows={2}
                  disabled={mode === 'edit' && poStatus !== 'draft'}
                  sx={disabledFieldSx}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Termék hozzáadása</Typography>
            {mode === 'edit' && poStatus !== 'draft' && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                <Typography variant="body2" color="warning.dark">
                  Csak vázlat státuszú beszerzési rendeléshez lehet új tételeket hozzáadni.
                </Typography>
              </Box>
            )}
            <Stack spacing={2}>
              <ProductPicker
                vatRates={vatRates}
                currencies={currencies}
                units={units}
                editingIndex={editingIndex}
                editingItem={editingItem}
                disabled={mode === 'edit' && poStatus !== 'draft'}
                onAdd={(item) => {
                  console.log('onAdd called with item:', item)
                  setItems(prev => {
                    const newItems = [...prev, item]
                    console.log('Updated items array:', newItems)
                    return newItems
                  })
                }}
                onUpdate={(index, item) => {
                  if (mode === 'edit' && poStatus !== 'draft') return // Prevent updates if not draft
                  setItems(prev => prev.map((x, i) => i === index ? item : x))
                  setEditingIndex(null)
                  setEditingItem(null)
                }}
              />
              {items.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                    Hozzáadott termékek
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                  <TableHead>
                        <TableRow>
                          <TableCell>Termék neve</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell align="right">Mennyiség</TableCell>
                          <TableCell align="center">Mértékegység</TableCell>
                          {mode === 'edit' && poStatus !== 'draft' && (
                            <TableCell align="right">Beérkezett</TableCell>
                          )}
                          <TableCell align="right">Nettó egységár</TableCell>
                          <TableCell align="right">ÁFA %</TableCell>
                          <TableCell align="right">Nettó összesen</TableCell>
                          <TableCell align="right">Bruttó összesen</TableCell>
                          <TableCell align="center">Megjegyzés</TableCell>
                          <TableCell align="center">Művelet</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((it, idx) => {
                          const vatPercent = vatRates.find(v => v.id === it.vat_id)?.kulcs || 0
                          const qty = Number(it.quantity) || 0
                          const netUnit = Number(it.net_price) || 0
                          const lineNet = netUnit * qty
                          const lineVat = Math.round(lineNet * (vatPercent / 100))
                          const lineGross = lineNet + lineVat
                          return (
                            <TableRow
                              key={idx}
                              hover
                              sx={{ cursor: mode === 'edit' && poStatus !== 'draft' ? 'default' : 'pointer' }}
                              onClick={() => {
                                if (mode === 'edit' && poStatus !== 'draft') return
                                setEditingIndex(idx)
                                setEditingItem({
                                  ...it,
                                  base_price_hint: it.__multiplier ? Math.round(it.net_price / it.__multiplier) : it.net_price
                                })
                                if (typeof window !== 'undefined') {
                                  window.scrollTo({ top: 0, behavior: 'smooth' })
                                }
                              }}
                            >
                              <TableCell>{it.description}</TableCell>
                              <TableCell>{it.sku || '-'}</TableCell>
                              <TableCell align="right">{qty}</TableCell>
                              <TableCell align="center">
                                {(() => {
                                  const unit = units.find(u => u.id === it.units_id)
                                  return unit ? (unit.shortform || unit.name) : '-'
                                })()}
                              </TableCell>
                              {mode === 'edit' && poStatus !== 'draft' && (
                                <TableCell align="right">
                                  <Chip
                                    label={it.quantity_received || 0}
                                    size="small"
                                    color={
                                      (it.quantity_received || 0) === qty 
                                        ? 'success' // Green - exact match
                                        : (it.quantity_received || 0) < qty
                                          ? 'error' // Red - less than ordered
                                          : 'warning' // Orange - more than ordered
                                    }
                                    sx={{
                                      fontWeight: 600,
                                      minWidth: 50,
                                      color: 'white',
                                      '& .MuiChip-label': {
                                        color: 'white'
                                      }
                                    }}
                                  />
                                </TableCell>
                              )}
                              <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(netUnit)} Ft</TableCell>
                              <TableCell align="right">{vatPercent}%</TableCell>
                              <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(lineNet)} Ft</TableCell>
                              <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(lineGross)} Ft</TableCell>
                              <TableCell align="center">
                                {it.megjegyzes ? (
                                  <Tooltip title={it.megjegyzes} arrow placement="top">
                                    <IconButton size="small" color="info">
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title={mode === 'edit' && poStatus !== 'draft' ? 'Csak vázlat státuszú rendelésből lehet törölni' : 'Törlés'}>
                                  <span>
                                    <IconButton 
                                      size="small" 
                                      color="error" 
                                      disabled={mode === 'edit' && poStatus !== 'draft'}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (mode === 'edit' && poStatus !== 'draft') return
                                        setItems(prev => prev.filter((_, i) => i !== idx))
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {mode === 'edit' && poStatus !== 'draft' && (
              <Box sx={{ p: 2, bgcolor: 'info.lighter', borderRadius: 1, flex: 1 }}>
                <Typography variant="body2" color="info.dark">
                  Ez a beszerzési rendelés már nem módosítható, mert státusza nem vázlat.
                </Typography>
              </Box>
            )}
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || (mode === 'edit' && poStatus !== 'draft')}
            >
              {mode === 'create' ? 'Mentés' : 'Frissítés'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  )
}


