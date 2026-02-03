'use client'

import React, { useMemo, useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Autocomplete,
  MenuItem,
  Radio,
  FormControlLabel,
  Checkbox,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import type { AccordionProps } from '@mui/material/Accordion'
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary'
import type { AccordionDetailsProps } from '@mui/material/AccordionDetails'
import { toast } from 'react-toastify'

// Styled components copied from Opti for identical look & feel
const Accordion = styled(MuiAccordion)<AccordionProps>(() => ({
  boxShadow: 'none !important',
  border: '1px solid var(--mui-palette-divider) !important',
  borderRadius: '0 !important',
  overflow: 'hidden',
  '&:not(:last-of-type)': {
    borderBottom: '0 !important'
  },
  '&:before': {
    display: 'none'
  },
  '&.Mui-expanded': {
    margin: 'auto'
  },
  '&:first-of-type': {
    borderTopLeftRadius: 'var(--mui-shape-customBorderRadius-lg) !important',
    borderTopRightRadius: 'var(--mui-shape-customBorderRadius-lg) !important'
  },
  '&:last-of-type': {
    borderBottomLeftRadius: 'var(--mui-shape-customBorderRadius-lg) !important',
    borderBottomRightRadius: 'var(--mui-shape-customBorderRadius-lg) !important'
  }
}))

const AccordionSummary = styled(MuiAccordionSummary)<AccordionSummaryProps>(() => ({
  marginBottom: -1,
  transition: 'none',
  backgroundColor: 'var(--mui-palette-customColors-greyLightBg)',
  borderBottom: '1px solid var(--mui-palette-divider) !important'
}))

const AccordionDetails = styled(MuiAccordionDetails)<AccordionDetailsProps>(({ theme }) => ({
  padding: `${theme.spacing(4)} !important`
}))

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  discount_percent: number
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  created_at: string
  updated_at: string
}

interface LinearMaterial {
  id: string
  name: string
  width: number
  length: number
  thickness: number
  type: string | null
}

interface WorktopConfigClientProps {
  initialCustomers: Customer[]
  initialLinearMaterials: LinearMaterial[]
}

// Cutout interface
interface Cutout {
  id: string
  width: string
  height: string
  distanceFromLeft: string
  distanceFromBottom: string
}

// Saved worktop configuration interface
interface SavedWorktopConfig {
  id: string
  assemblyType: string | null
  selectedLinearMaterialId: string | null
  edgeBanding: 'LAM' | 'ABS' | 'Nincs élzáró'
  edgeColorChoice: 'Színazonos' | 'Egyéb szín'
  edgeColorText: string
  noPostformingEdge: boolean
  edgePosition1: boolean
  edgePosition2: boolean
  edgePosition3: boolean
  edgePosition4: boolean
  dimensionA: string
  dimensionB: string
  dimensionC: string
  roundingR1: string
  roundingR2: string
  cutL1: string
  cutL2: string
  cutL3: string
  cutL4: string
  cutouts: Cutout[]
}

export default function WorktopConfigClient({ initialCustomers, initialLinearMaterials }: WorktopConfigClientProps) {
  // Fetch-only: we only use initialCustomers from DB, no saves yet
  const customers = initialCustomers || []
  const linearMaterials = initialLinearMaterials || []

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    discount: '',
    billing_name: '',
    billing_country: 'Magyarország',
    billing_city: '',
    billing_postal_code: '',
    billing_street: '',
    billing_house_number: '',
    billing_tax_number: '',
    billing_company_reg_number: ''
  })

  // Worktop config state (fetch-only, no save yet)
  const assemblyTypes = [
    'Levágás',
    'Hossztoldás',
    'Összemarás Balos',
    'Összemarás jobbos',
    'Szögbemarás',
    'Összemarás sarkletöréssel',
    'Összemarás',
    'U-szögbemarás'
  ]
  const [assemblyType, setAssemblyType] = useState<string | null>(null)
  const [selectedLinearMaterialId, setSelectedLinearMaterialId] = useState<string | null>(null)
  const [edgeBanding, setEdgeBanding] = useState<'LAM' | 'ABS' | 'Nincs élzáró'>('Nincs élzáró')
  const [edgeColorChoice, setEdgeColorChoice] = useState<'Színazonos' | 'Egyéb szín'>('Színazonos')
  const [edgeColorText, setEdgeColorText] = useState<string>('')
  const [noPostformingEdge, setNoPostformingEdge] = useState<boolean>(false)
  const [edgePosition1, setEdgePosition1] = useState<boolean>(false)
  const [edgePosition2, setEdgePosition2] = useState<boolean>(false)
  const [edgePosition3, setEdgePosition3] = useState<boolean>(false)
  const [edgePosition4, setEdgePosition4] = useState<boolean>(false)
  const [dimensionA, setDimensionA] = useState<string>('')
  const [dimensionB, setDimensionB] = useState<string>('')
  const [dimensionC, setDimensionC] = useState<string>('')
  const [roundingR1, setRoundingR1] = useState<string>('')
  const [roundingR2, setRoundingR2] = useState<string>('')
  const [cutL1, setCutL1] = useState<string>('')
  const [cutL2, setCutL2] = useState<string>('')
  const [cutL3, setCutL3] = useState<string>('')
  const [cutL4, setCutL4] = useState<string>('')
  
  // Cutouts state (max 3)
  const [cutouts, setCutouts] = useState<Cutout[]>([])

  // Saved configurations state
  const [savedConfigs, setSavedConfigs] = useState<SavedWorktopConfig[]>([])
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)

  const linearMaterialOptions = useMemo(() => {
    return linearMaterials.map(lm => ({
      id: lm.id,
      label: `${lm.name} ${lm.width}*${lm.length}*${lm.thickness} ${lm.type ?? ''}`.trim()
    }))
  }, [linearMaterials])

  // Load saved configurations from session storage on mount
  useEffect(() => {
    const savedConfigsStr = sessionStorage.getItem('worktop-configs')
    if (savedConfigsStr) {
      try {
        setSavedConfigs(JSON.parse(savedConfigsStr))
      } catch (error) {
        console.error('Error loading worktop configs from session storage:', error)
      }
    }
  }, [])

  // Save configurations to session storage whenever savedConfigs changes
  useEffect(() => {
    if (savedConfigs.length > 0) {
      sessionStorage.setItem('worktop-configs', JSON.stringify(savedConfigs))
    } else {
      sessionStorage.removeItem('worktop-configs')
    }
  }, [savedConfigs])

  // Check if required fields are filled (without showing errors)
  const areRequiredFieldsFilled = (): boolean => {
    if (!assemblyType) return false
    if (!selectedLinearMaterialId) return false
    // edgeBanding can be 'Nincs élzáró' - it's acceptable
    if (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') {
      if (!dimensionA || parseFloat(dimensionA) <= 0) return false
      if (!dimensionB || parseFloat(dimensionB) <= 0) return false
      if (assemblyType === 'Hossztoldás') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
      }
    }
    return true
  }

  // Validation function for required fields (with toast errors)
  const validateRequiredFields = (): boolean => {
    if (!assemblyType) {
      toast.error('Kérjük válassza ki az összeállítás típusát!')
      return false
    }
    if (!selectedLinearMaterialId) {
      toast.error('Kérjük válassza ki a munkalap típusát!')
      return false
    }
    // edgeBanding can be 'Nincs élzáró' - it's acceptable
    if (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') {
      if (!dimensionA || parseFloat(dimensionA) <= 0) {
        toast.error('Kérjük adja meg az A méretet!')
        return false
      }
      if (!dimensionB || parseFloat(dimensionB) <= 0) {
        toast.error('Kérjük adja meg a B méretet!')
        return false
      }
      if (assemblyType === 'Hossztoldás') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) {
          toast.error('Kérjük adja meg a C méretet!')
          return false
        }
      }
    }
    return true
  }

  // Save configuration
  const saveConfiguration = () => {
    if (!validateRequiredFields()) {
      return
    }

    const config: SavedWorktopConfig = {
      id: editingConfigId || `config-${Date.now()}-${Math.random()}`,
      assemblyType,
      selectedLinearMaterialId,
      edgeBanding,
      edgeColorChoice,
      edgeColorText,
      noPostformingEdge,
      edgePosition1,
      edgePosition2,
      edgePosition3,
      edgePosition4,
      dimensionA,
      dimensionB,
      dimensionC,
      roundingR1,
      roundingR2,
      cutL1,
      cutL2,
      cutL3,
      cutL4,
      cutouts: [...cutouts]
    }

    if (editingConfigId) {
      // Update existing configuration
      setSavedConfigs(prev => prev.map(c => c.id === editingConfigId ? config : c))
      toast.success('Konfiguráció sikeresen frissítve!')
    } else {
      // Add new configuration
      setSavedConfigs(prev => [...prev, config])
      toast.success('Konfiguráció sikeresen mentve!')
    }

    // Clear edit mode and form to hide visualization
    setEditingConfigId(null)
    clearWorktopConfigForm()
  }

  // Load configuration for editing
  const loadConfiguration = (config: SavedWorktopConfig) => {
    setEditingConfigId(config.id)
    setAssemblyType(config.assemblyType)
    setSelectedLinearMaterialId(config.selectedLinearMaterialId)
    setEdgeBanding(config.edgeBanding)
    setEdgeColorChoice(config.edgeColorChoice)
    setEdgeColorText(config.edgeColorText)
    setNoPostformingEdge(config.noPostformingEdge)
    setEdgePosition1(config.edgePosition1)
    setEdgePosition2(config.edgePosition2)
    setEdgePosition3(config.edgePosition3)
    setEdgePosition4(config.edgePosition4)
    setDimensionA(config.dimensionA)
    setDimensionB(config.dimensionB)
    setDimensionC(config.dimensionC || '')
    setRoundingR1(config.roundingR1)
    setRoundingR2(config.roundingR2)
    setCutL1(config.cutL1)
    setCutL2(config.cutL2)
    setCutL3(config.cutL3)
    setCutL4(config.cutL4)
    setCutouts([...config.cutouts])

    // Scroll to top
    setTimeout(() => {
      window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      })
    }, 100)
  }

  // Delete configuration
  const deleteConfiguration = (configId: string) => {
    setSavedConfigs(prev => prev.filter(c => c.id !== configId))
    if (editingConfigId === configId) {
      setEditingConfigId(null)
    }
    toast.success('Konfiguráció sikeresen törölve!')
  }

  // Clear worktop configuration form
  const clearWorktopConfigForm = () => {
    setAssemblyType(null)
    setSelectedLinearMaterialId(null)
    setEdgeBanding('Nincs élzáró')
    setEdgeColorChoice('Színazonos')
    setEdgeColorText('')
    setNoPostformingEdge(false)
    setEdgePosition1(false)
    setEdgePosition2(false)
    setEdgePosition3(false)
    setEdgePosition4(false)
    setDimensionA('')
    setDimensionB('')
    setDimensionC('')
    setRoundingR1('')
    setRoundingR2('')
    setCutL1('')
    setCutL2('')
    setCutL3('')
    setCutL4('')
    setCutouts([])
  }

  // Get material name for display
  const getMaterialName = (materialId: string | null): string => {
    if (!materialId) return '-'
    const material = linearMaterials.find(m => m.id === materialId)
    if (!material) return '-'
    return `${material.name} ${material.width}*${material.length}*${material.thickness} ${material.type ?? ''}`.trim()
  }

  const handleCustomerDataChange = (field: keyof typeof customerData, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }))
  }

  const handleCustomerSelect = (customer: Customer | null) => {
    if (!customer) {
      setSelectedCustomer(null)
      setCustomerData({
        name: '',
        email: '',
        phone: '',
        discount: '',
        billing_name: '',
        billing_country: 'Magyarország',
        billing_city: '',
        billing_postal_code: '',
        billing_street: '',
        billing_house_number: '',
        billing_tax_number: '',
        billing_company_reg_number: ''
      })
      return
    }

    setSelectedCustomer(customer)
    setCustomerData({
      name: customer.name,
      email: customer.email,
      phone: customer.mobile,
      discount: customer.discount_percent?.toString?.() ?? '',
      billing_name: customer.billing_name || '',
      billing_country: customer.billing_country || 'Magyarország',
      billing_city: customer.billing_city || '',
      billing_postal_code: customer.billing_postal_code || '',
      billing_street: customer.billing_street || '',
      billing_house_number: customer.billing_house_number || '',
      billing_tax_number: customer.billing_tax_number || '',
      billing_company_reg_number: customer.billing_company_reg_number || ''
    })
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Munkalép készítés
      </Typography>

      <Grid container spacing={3}>
        {/* Customer Information Card (full width row) */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Megrendelő adatai
              </Typography>

              <Grid container spacing={2}>
                {/* Customer Selection and Discount in same row */}
                <Grid item xs={12} sm={8}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={customers}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                    value={selectedCustomer}
                    inputValue={customerData.name}
                    onChange={(event, newValue) => {
                      if (typeof newValue === 'string') {
                        setSelectedCustomer(null)
                        setCustomerData(prev => ({
                          ...prev,
                          name: newValue
                        }))
                      } else if (newValue) {
                        handleCustomerSelect(newValue)
                      } else if (event) {
                        handleCustomerSelect(null)
                      }
                    }}
                    onInputChange={(event, newInputValue) => {
                      setCustomerData(prev => ({
                        ...prev,
                        name: newInputValue
                      }))

                      if (newInputValue && !customers.find(c => c.name === newInputValue)) {
                        setSelectedCustomer(null)
                      }
                    }}
                    freeSolo
                    disabled={false}
                    loading={false}
                    loadingText="Ügyfelek betöltése..."
                    noOptionsText="Nincs találat"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Név (válasszon ügyfelet vagy írjon be új nevet) *"
                        size="small"
                        required
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...otherProps } = props
                      return (
                        <Box component="li" key={key} {...otherProps}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {option.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.email} • {option.mobile}
                            </Typography>
                          </Box>
                        </Box>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Kedvezmény (%)"
                    type="number"
                    value={customerData.discount}
                    onChange={(e) => handleCustomerDataChange('discount', e.target.value)}
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                  />
                </Grid>

                {/* Customer Data Fields */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="E-mail"
                    value={customerData.email}
                    onChange={(e) => handleCustomerDataChange('email', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Telefon"
                    placeholder="+36 30 999 2800"
                    value={customerData.phone}
                    onChange={(e) => handleCustomerDataChange('phone', e.target.value)}
                  />
                </Grid>

                {/* Status and Clear Button */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pt: 1, gap: 2 }}>
                    {selectedCustomer ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Adatok automatikusan kitöltve - szerkeszthető
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          onClick={() => handleCustomerSelect(null)}
                        >
                          Törlés
                        </Button>
                      </>
                    ) : customerData.name && !selectedCustomer ? (
                      <Typography variant="body2" color="primary">
                        Új ügyfél adatai - kérem töltse ki a mezőket
                      </Typography>
                    ) : null}
                  </Box>
                </Grid>

                {/* Szálázási adatok Collapsible Section */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded={false}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                        Számlázási adatok
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Számlázási név"
                            value={customerData.billing_name}
                            onChange={(e) => handleCustomerDataChange('billing_name', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Ország"
                            value={customerData.billing_country}
                            onChange={(e) => handleCustomerDataChange('billing_country', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Irányítószám"
                            value={customerData.billing_postal_code}
                            onChange={(e) => handleCustomerDataChange('billing_postal_code', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Város"
                            value={customerData.billing_city}
                            onChange={(e) => handleCustomerDataChange('billing_city', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Utca"
                            value={customerData.billing_street}
                            onChange={(e) => handleCustomerDataChange('billing_street', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Házszám"
                            value={customerData.billing_house_number}
                            onChange={(e) => handleCustomerDataChange('billing_house_number', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Adószám"
                            value={customerData.billing_tax_number}
                            onChange={(e) => handleCustomerDataChange('billing_tax_number', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Cégjegyzékszám"
                            value={customerData.billing_company_reg_number}
                            onChange={(e) => handleCustomerDataChange('billing_company_reg_number', e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          {/* Worktop config card (full width) */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Munkapult konfiguráció
                </Typography>

                <Grid container spacing={2}>
                  {/* Row 1: Assembly type & Worktop type */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Összeállítás típusa"
                      value={assemblyType || ''}
                      onChange={(e) => setAssemblyType(e.target.value || null)}
                    SelectProps={{
                      native: false,
                      MenuProps: {
                        PaperProps: {
                          style: {
                            maxHeight: 320
                          }
                        }
                      }
                    }}
                    >
                      {assemblyTypes.map(type => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={linearMaterialOptions}
                      getOptionLabel={(opt) => opt.label}
                      value={linearMaterialOptions.find(o => o.id === selectedLinearMaterialId) || null}
                      onChange={(_, newValue) => {
                        setSelectedLinearMaterialId(newValue?.id || null)
                        if (newValue) {
                          // Prefill dimension B with width when selecting a worktop
                          const lm = linearMaterials.find(l => l.id === newValue.id)
                          if (lm?.width !== undefined && lm?.width !== null) {
                            const widthStr = lm.width.toString()
                            setDimensionB(widthStr)
                          }
                          // Prefill dimension C for Hossztoldás: C = A - material.length
                          if (assemblyType === 'Hossztoldás' && lm?.length !== undefined && lm?.length !== null) {
                            const aValue = parseFloat(dimensionA) || 0
                            if (aValue > 0) {
                              const cValue = Math.max(0, aValue - lm.length)
                              setDimensionC(cValue.toString())
                            }
                          }
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Munkalap típusa"
                          size="small"
                          placeholder="Válasszon munkalapot"
                        />
                      )}
                    />
                  </Grid>

                  {/* Row 2: Edge banding and color choice */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Élzáró anyaga:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {(['LAM', 'ABS', 'Nincs élzáró'] as const).map(val => (
                        <FormControlLabel
                          key={val}
                          control={
                            <Radio
                              checked={edgeBanding === val}
                              onChange={() => setEdgeBanding(val)}
                            />
                          }
                          label={val}
                        />
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Élzáró színe
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      {(['Színazonos', 'Egyéb szín'] as const).map(val => (
                        <FormControlLabel
                          key={val}
                          control={
                            <Radio
                              checked={edgeColorChoice === val}
                              onChange={() => setEdgeColorChoice(val)}
                              disabled={edgeBanding === 'Nincs élzáró'}
                            />
                          }
                          label={val}
                        />
                      ))}
                      {edgeColorChoice === 'Egyéb szín' && edgeBanding !== 'Nincs élzáró' && (
                        <TextField
                          size="small"
                          label="Egyéb szín megnevezése"
                          value={edgeColorText}
                          onChange={(e) => setEdgeColorText(e.target.value)}
                          sx={{ minWidth: 240 }}
                        />
                      )}
                    </Box>
                  </Grid>

                  {/* Row 3: Postforming and Edge Position */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Postforming:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={noPostformingEdge}
                            onChange={(e) => setNoPostformingEdge(e.target.checked)}
                          />
                        }
                        label="Ne maradjon postfroming él"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Élzáró pozíció
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition1}
                              onChange={(e) => setEdgePosition1(e.target.checked)}
                            />
                          }
                          label="1. oldal"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition2}
                              onChange={(e) => setEdgePosition2(e.target.checked)}
                            />
                          }
                          label="2. oldal"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition3}
                              onChange={(e) => setEdgePosition3(e.target.checked)}
                            />
                          }
                          label="3. oldal"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={edgePosition4}
                              onChange={(e) => setEdgePosition4(e.target.checked)}
                              disabled={noPostformingEdge}
                            />
                          }
                          label="4. oldal"
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Conditional fields per összeállítás típus */}
                {(assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Méretek ({assemblyType})
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={assemblyType === 'Hossztoldás' ? 4 : 6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="A (mm)"
                          type="number"
                          value={dimensionA}
                          onChange={(e) => {
                            setDimensionA(e.target.value)
                            // Prefill C for Hossztoldás: C = A - material.length
                            if (assemblyType === 'Hossztoldás' && selectedLinearMaterialId) {
                              const lm = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                              if (lm?.length !== undefined && lm?.length !== null) {
                                const aValue = parseFloat(e.target.value) || 0
                                if (aValue > 0) {
                                  const cValue = Math.max(0, aValue - lm.length)
                                  setDimensionC(cValue.toString())
                                } else {
                                  setDimensionC('')
                                }
                              }
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={assemblyType === 'Hossztoldás' ? 4 : 6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="B (mm)"
                          type="number"
                          value={dimensionB}
                          onChange={(e) => setDimensionB(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      {assemblyType === 'Hossztoldás' && (
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="C (mm)"
                            type="number"
                            value={dimensionC}
                            onChange={(e) => setDimensionC(e.target.value)}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </Grid>
                      )}
                      {/* Row: Lekerekítés */}
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lekerekítés bal oldalon (R1)"
                          type="number"
                          value={roundingR1}
                          onChange={(e) => setRoundingR1(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Lekerekítés jobb oldalon (R2)"
                          type="number"
                          value={roundingR2}
                          onChange={(e) => setRoundingR2(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      {/* Row: Letörések */}
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L1)"
                          type="number"
                          value={cutL1}
                          onChange={(e) => setCutL1(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={!!(parseFloat(roundingR1) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L2)"
                          type="number"
                          value={cutL2}
                          onChange={(e) => setCutL2(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={!!(parseFloat(roundingR1) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L3)"
                          type="number"
                          value={cutL3}
                          onChange={(e) => setCutL3(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={!!(parseFloat(roundingR2) > 0)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Letörés (L4)"
                          type="number"
                          value={cutL4}
                          onChange={(e) => setCutL4(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          disabled={!!(parseFloat(roundingR2) > 0)}
                        />
                      </Grid>
                      
                      {/* Kivágások Section */}
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Kivágások
                        </Typography>
                        {cutouts.map((cutout, index) => {
                          const aValue = parseFloat(dimensionA) || 0
                          const bValue = parseFloat(dimensionB) || 0
                          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                          const materialWidth = selectedMaterial?.length || 1
                          const keptWidth = (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') && aValue > 0 ? Math.min(aValue, materialWidth) : materialWidth
                          
                          const cutoutWidth = parseFloat(cutout.width) || 0
                          const cutoutHeight = parseFloat(cutout.height) || 0
                          const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                          
                          const widthError = cutoutWidth >= keptWidth
                          const heightError = cutoutHeight >= bValue
                          const positionError = distanceFromLeft + cutoutWidth > keptWidth
                          
                          return (
                            <Box key={cutout.id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  Kivágás {index + 1}
                                </Typography>
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={() => setCutouts(prev => prev.filter(c => c.id !== cutout.id))}
                                >
                                  Törlés
                                </Button>
                              </Box>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Szélesség (mm)"
                                    type="number"
                                    value={cutout.width}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, width: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                    error={widthError}
                                    helperText={widthError ? `Szélesség kisebb kell legyen, mint ${keptWidth}mm` : ''}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Magasság (mm)"
                                    type="number"
                                    value={cutout.height}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, height: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                    error={heightError}
                                    helperText={heightError ? `Magasság kisebb kell legyen, mint ${bValue}mm` : ''}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Távolság balról (mm)"
                                    type="number"
                                    value={cutout.distanceFromLeft}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, distanceFromLeft: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                    error={positionError}
                                    helperText={positionError ? `Pozíció + szélesség nem lehet nagyobb, mint ${keptWidth}mm` : ''}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Távolság alulról (mm)"
                                    type="number"
                                    value={cutout.distanceFromBottom}
                                    onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, distanceFromBottom: e.target.value } : c))}
                                    inputProps={{ min: 0, step: 1 }}
                                  />
                                </Grid>
                              </Grid>
                            </Box>
                          )
                        })}
                        {cutouts.length < 3 && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setCutouts(prev => [...prev, {
                                id: `cutout-${Date.now()}-${Math.random()}`,
                                width: '',
                                height: '',
                                distanceFromLeft: '',
                                distanceFromBottom: ''
                              }])
                            }}
                            sx={{ mt: 1 }}
                          >
                            Kivágás hozzáadása
                          </Button>
                        )}
                      </Grid>
                    </Grid>
                  </>
                )}

                {/* Save Button */}
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={saveConfiguration}
                    disabled={!areRequiredFieldsFilled()}
                  >
                    {editingConfigId ? 'Mentés' : 'Mentés'}
                  </Button>
                  {editingConfigId && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        setEditingConfigId(null)
                        clearWorktopConfigForm()
                      }}
                      sx={{ ml: 2 }}
                    >
                      Mégse
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Worktop Visualization Card - Only show when both assembly type and material are selected */}
      {assemblyType && selectedLinearMaterialId && (
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ px: '5px', py: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Munkapult vizualizáció
                  </Typography>
                
                <Box
                  sx={{
                    px: 0,
                    py: 3,
                    pb: 4,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    fontFamily: 'monospace',
                    maxWidth: 1400,
                    width: '100%',
                    margin: '0 auto',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Box sx={{ position: 'relative', margin: '0 auto', width: '100%', overflow: 'visible', paddingBottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0, flex: '1 1 auto' }}>
                    {selectedLinearMaterialId ? (
                      (() => {
                        const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                        if (!selectedMaterial) {
                          return (
                            <Box
                              sx={{
                                width: '100%',
                                aspectRatio: '1 / 1',
                                border: '1px dashed #ccc',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 200
                              }}
                            >
                              <Typography variant="body2" color="text.secondary">
                                Válasszon munkalapot a vizualizáció megjelenítéséhez
                              </Typography>
                            </Box>
                          )
                        }

                        // Rotate visualization by 90 degrees: display width = material length, height = material width
                        const materialWidth = selectedMaterial.length || 1   // displayed width (rotated)
                        const materialLength = selectedMaterial.width || 1   // displayed height (rotated)

                        // For Hossztoldás: A = full extended length, C = join position
                        // For Levágás: A = cut position
                        const aValue = parseFloat(dimensionA) || 0
                        const cValue = parseFloat(dimensionC) || 0
                        
                        // Determine actual worktop dimensions based on assembly type
                        let worktopWidth: number
                        let worktopLength: number
                        
                        if (assemblyType === 'Hossztoldás') {
                          // Hossztoldás: A = full extended length, base visualization uses material dimensions
                          // B creates vertical cut from material width (like Levágás)
                          worktopWidth = aValue > 0 ? aValue : materialWidth
                          worktopLength = materialLength  // Use material width as base (same as Levágás)
                        } else {
                          // Levágás: use material dimensions, A is cut position
                          worktopWidth = materialWidth
                          worktopLength = materialLength
                        }

                        // Cut position based on A (mm) along displayed width (for Levágás)
                        const cutPosition = assemblyType === 'Levágás' ? aValue : 0
                        const cutPercent = worktopWidth > 0 ? (cutPosition / worktopWidth) * 100 : 0
                        const showCut = assemblyType === 'Levágás' && cutPosition > 0 && cutPosition < worktopWidth
                        
                        // Join position for Hossztoldás (C value - measured from right edge)
                        // C is measured from right, so join position from left = worktopWidth - cValue
                        const joinPosition = assemblyType === 'Hossztoldás' && cValue > 0 ? worktopWidth - cValue : 0
                        const joinPercent = worktopWidth > 0 ? (joinPosition / worktopWidth) * 100 : 0
                        const showJoin = assemblyType === 'Hossztoldás' && cValue > 0 && joinPosition > 0 && joinPosition < worktopWidth
                        
                        // Vertical cut based on B (mm) along displayed height (for Levágás and Hossztoldás)
                        const bValue = parseFloat(dimensionB) || worktopLength
                        const verticalCutHeight = worktopLength - bValue
                        const verticalCutPercent = worktopLength > 0 ? (verticalCutHeight / worktopLength) * 100 : 0
                        const showVerticalCut = (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') && bValue > 0 && bValue < worktopLength

                        // Calculate rounding: R1/R2 values are in mm
                        // R1 = 100mm means: cut 100mm from bottom-left corner along bottom edge (right), 
                        // cut 100mm up along left edge, connect with 100mm radius arc
                        const r1ValueRaw = parseFloat(roundingR1) || 0
                        const r2ValueRaw = parseFloat(roundingR2) || 0
                        // Effective width for rounding on kept part (left of cut)
                        const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, materialWidth)) : materialWidth
                        // Effective height for rounding on kept part (bottom of vertical cut)
                        const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, materialLength)) : materialLength
                        // Use shorter edge until value of B (height), while respecting half of kept width
                        const r1Value = Math.min(r1ValueRaw, keptWidth / 2, keptHeight)
                        const r2Value = Math.min(r2ValueRaw, keptWidth / 2, keptHeight)
                        
                        // Calculate chamfer values: L1/L2 for bottom-left, L3/L4 for bottom-right
                        const l1Value = parseFloat(cutL1) || 0
                        const l2Value = parseFloat(cutL2) || 0
                        const l3Value = parseFloat(cutL3) || 0
                        const l4Value = parseFloat(cutL4) || 0
                        const hasL1L2 = l1Value > 0 && l2Value > 0
                        const hasL3L4 = l3Value > 0 && l4Value > 0
                        const keptRightEdge = showCut ? cutPosition : worktopWidth

                        // Calculate expanded viewBox to accommodate labels while maintaining aspect ratio
                        // Labels need space: ~200mm on left, ~200mm on right, ~100mm on top, ~150mm on bottom
                        const labelPaddingLeft = 200
                        const labelPaddingRight = 200
                        const labelPaddingTop = 100
                        const labelPaddingBottom = 150
                        const expandedWidth = worktopWidth + labelPaddingLeft + labelPaddingRight
                        const expandedHeight = worktopLength + labelPaddingTop + labelPaddingBottom
                        
                        // Calculate the aspect ratio of the expanded viewBox
                        const expandedAspectRatio = expandedWidth / expandedHeight
                        const worktopAspectRatio = worktopWidth / worktopLength
                        
                        // Adjust viewBox to maintain worktop aspect ratio
                        let finalViewBoxWidth = expandedWidth
                        let finalViewBoxHeight = expandedHeight
                        
                        // If expanded viewBox is wider than worktop aspect ratio, adjust height
                        if (expandedAspectRatio > worktopAspectRatio) {
                          finalViewBoxHeight = expandedWidth / worktopAspectRatio
                        } else {
                          // If expanded viewBox is taller than worktop aspect ratio, adjust width
                          finalViewBoxWidth = expandedHeight * worktopAspectRatio
                        }
                        
                        // Center the worktop in the expanded viewBox
                        const viewBoxX = -(finalViewBoxWidth - worktopWidth) / 2
                        const viewBoxY = -(finalViewBoxHeight - worktopLength) / 2

                        return (
                          <>
                            {/* Material rectangle (rotated 90 degrees) with rounded corners and cut overlay */}
                            <Box
                              sx={{
                                width: '100%',
                                maxWidth: '100%',
                                aspectRatio: `${finalViewBoxWidth} / ${finalViewBoxHeight}`,
                                position: 'relative',
                                overflow: 'visible',
                                fontFamily: 'monospace',
                                marginBottom: cutouts.some(c => parseFloat(c.distanceFromLeft) > 0 || parseFloat(c.distanceFromBottom) > 0) ? 12 : 3,
                                margin: '0 auto'
                              }}
                            >
                              {/* SVG for rectangle with rounded corners (R1 bottom-left, R2 bottom-right at cut) */}
                              <Box
                                component="svg"
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  zIndex: 1,
                                  overflow: 'visible'
                                }}
                                viewBox={`${viewBoxX} ${viewBoxY} ${finalViewBoxWidth} ${finalViewBoxHeight}`}
                                preserveAspectRatio="xMidYMid meet"
                              >
                                {/* Main rectangle with rounded corners */}
                                <path
                                  d={(() => {
                                    // Effective width for rounding (kept part only)
                                    const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                    
                                    // Effective height for rounding (kept part only - bottom of vertical cut)
                                    const effectiveHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                    
                                    // Clamp radii to half of effective width and up to effective height
                                    const r1 = Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
                                    const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
                                    
                                    // Start position: if vertical cut, start from top of kept portion (bottom of cut)
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Build path: start from top-left of kept portion
                                    let path = `M 0 ${startY}`
                                    
                                    // Top edge: to top-right (or cut position if horizontal cutting)
                                    if (showCut) {
                                      path += ` L ${cutPosition} ${startY}`
                                    } else {
                                      path += ` L ${worktopWidth} ${startY}`
                                    }
                                    
                                    // Right edge: if horizontal cutting, stop at cut position; otherwise go to bottom-right
                                    const bottomY = worktopLength // Always go to full bottom
                                    if (showCut) {
                                      // At cut position, go down the right edge
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (cutPosition, worktopLength - l4Value), then diagonal to (cutPosition - l3Value, worktopLength)
                                        path += ` L ${cutPosition} ${bottomY - l4Value}`
                                        path += ` L ${cutPosition - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${cutPosition} ${bottomY - r2}`
                                        // R2 rounding at cut line (bottom-right of kept part)
                                        if (r2 > 0) {
                                          path += ` Q ${cutPosition} ${bottomY} ${cutPosition - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      // No horizontal cut: go to bottom-right
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (worktopWidth, worktopLength - l4Value), then diagonal to (worktopWidth - l3Value, worktopLength)
                                        path += ` L ${worktopWidth} ${bottomY - l4Value}`
                                        path += ` L ${worktopWidth - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${worktopWidth} ${bottomY - r2}`
                                        // R2 rounding at full width
                                        if (r2 > 0) {
                                          path += ` Q ${worktopWidth} ${bottomY} ${worktopWidth - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${worktopWidth} ${bottomY}`
                                        }
                                      }
                                    }
                                    
                                    // Bottom edge: to bottom-left
                                    if (hasL1L2) {
                                      // L1/L2 chamfer: go to (l1Value, materialLength) then diagonal to (0, materialLength - l2Value)
                                      path += ` L ${l1Value} ${bottomY}`
                                      path += ` L 0 ${bottomY - l2Value}`
                                    } else {
                                      path += ` L ${r1} ${bottomY}`
                                      // R1 rounding (bottom-left)
                                      if (r1 > 0) {
                                        path += ` Q 0 ${bottomY} 0 ${bottomY - r1}`
                                      } else {
                                        path += ` L 0 ${bottomY}`
                                      }
                                    }
                                    
                                    // Left edge: back to top (or to start of kept portion if vertical cut)
                                    path += ` L 0 ${startY}`
                                    
                                    // Close path
                                    path += ` Z`
                                    
                                    return path
                                  })()}
                                  fill="#f0f8ff"
                                  stroke="#000"
                                  strokeWidth="3"
                                />
                                
                                {/* Join line for Hossztoldás (dashed vertical line at position C) - only on remaining part */}
                                {showJoin && (() => {
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  return (
                                    <line
                                      x1={joinPosition}
                                      y1={startY}
                                      x2={joinPosition}
                                      y2={bottomY}
                                      stroke="#333"
                                      strokeWidth="3"
                                      strokeDasharray="10,5"
                                      strokeOpacity={0.9}
                                    />
                                  )
                                })()}

                                {/* Edge highlighting based on Élzáró pozíció checkboxes - uses EXACT same path as worktop border */}
                                {(() => {
                                  // Use the EXACT same path calculation as the worktop border
                                  const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const effectiveHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                  const r1 = Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
                                  const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  const rightEdge = showCut ? cutPosition : worktopWidth
                                  
                                  // Build the EXACT same path as the worktop border
                                  const buildWorktopBorderPath = () => {
                                    let path = `M 0 ${startY}`
                                    
                                    // Top edge
                                    if (showCut) {
                                      path += ` L ${cutPosition} ${startY}`
                                    } else {
                                      path += ` L ${worktopWidth} ${startY}`
                                    }
                                    
                                    // Right edge
                                    if (showCut) {
                                      if (hasL3L4) {
                                        path += ` L ${cutPosition} ${bottomY - l4Value}`
                                        path += ` L ${cutPosition - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${cutPosition} ${bottomY - r2}`
                                        if (r2 > 0) {
                                          path += ` Q ${cutPosition} ${bottomY} ${cutPosition - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        path += ` L ${worktopWidth} ${bottomY - l4Value}`
                                        path += ` L ${worktopWidth - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${worktopWidth} ${bottomY - r2}`
                                        if (r2 > 0) {
                                          path += ` Q ${worktopWidth} ${bottomY} ${worktopWidth - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${worktopWidth} ${bottomY}`
                                        }
                                      }
                                    }
                                    
                                    // Bottom edge
                                    if (hasL1L2) {
                                      path += ` L ${l1Value} ${bottomY}`
                                      path += ` L 0 ${bottomY - l2Value}`
                                    } else {
                                      path += ` L ${r1} ${bottomY}`
                                      if (r1 > 0) {
                                        path += ` Q 0 ${bottomY} 0 ${bottomY - r1}`
                                      } else {
                                        path += ` L 0 ${bottomY}`
                                      }
                                    }
                                    
                                    // Left edge
                                    path += ` L 0 ${startY}`
                                    path += ` Z`
                                    return path
                                  }
                                  
                                  // Edge styling
                                  const edgeColor = '#ff6b6b'
                                  const edgeThickness = 15
                                  const dashArray = "8,4"
                                  const edgeOpacity = 0.7
                                  
                                  // Build individual edge paths
                                  const buildLeftEdgePath = () => {
                                    // Left edge goes from top to bottom, ending where bottom corner starts
                                    let path = `M 0 ${startY}`
                                    if (hasL1L2) {
                                      // Left edge ends at (0, bottomY - l2Value) where chamfer starts
                                      path += ` L 0 ${bottomY - l2Value}`
                                    } else {
                                      // Left edge ends at (0, bottomY - r1) where rounding starts
                                      path += ` L 0 ${bottomY - r1}`
                                    }
                                    return path
                                  }
                                  
                                  const buildTopEdgePath = () => {
                                    let path = `M 0 ${startY}`
                                    if (showCut) {
                                      path += ` L ${cutPosition} ${startY}`
                                    } else {
                                      path += ` L ${worktopWidth} ${startY}`
                                    }
                                    return path
                                  }
                                  
                                  const buildRightEdgePath = () => {
                                    // Right edge goes from top to bottom, ending where bottom corner starts
                                    let path = `M ${rightEdge} ${startY}`
                                    if (showCut) {
                                      if (hasL3L4) {
                                        // Right edge ends at (cutPosition, bottomY - l4Value) where bottom chamfer starts
                                        path += ` L ${cutPosition} ${bottomY - l4Value}`
                                      } else {
                                        // Right edge ends at (cutPosition, bottomY - r2) where bottom rounding starts
                                        path += ` L ${cutPosition} ${bottomY - r2}`
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        // Right edge ends at (worktopWidth, bottomY - l4Value) where bottom chamfer starts
                                        path += ` L ${worktopWidth} ${bottomY - l4Value}`
                                      } else {
                                        // Right edge ends at (worktopWidth, bottomY - r2) where bottom rounding starts
                                        path += ` L ${worktopWidth} ${bottomY - r2}`
                                      }
                                    }
                                    return path
                                  }
                                  
                                  const buildBottomEdgePath = () => {
                                    // Bottom edge includes both left corner (R1 or L1/L2) and right corner (R2 or L3/L4)
                                    let path = ''
                                    if (hasL1L2) {
                                      // Start from left edge at bottom (0, bottomY - l2Value), then chamfer to (l1Value, bottomY)
                                      path = `M 0 ${bottomY - l2Value}`
                                      path += ` L ${l1Value} ${bottomY}`
                                    } else {
                                      // Start from left edge at bottom (0, bottomY - r1), then rounding to (r1, bottomY)
                                      path = `M 0 ${bottomY - r1}`
                                      if (r1 > 0) {
                                        path += ` Q 0 ${bottomY} ${r1} ${bottomY}`
                                      } else {
                                        path += ` L 0 ${bottomY}`
                                      }
                                    }
                                    // Continue to right corner and include it
                                    if (showCut) {
                                      if (hasL3L4) {
                                        // Go to where right chamfer starts, then include the chamfer
                                        path += ` L ${cutPosition - l3Value} ${bottomY}`
                                        path += ` L ${cutPosition} ${bottomY - l4Value}`
                                      } else {
                                        // Go to where right rounding starts, then include the rounding
                                        if (r2 > 0) {
                                          path += ` L ${cutPosition - r2} ${bottomY}`
                                          path += ` Q ${cutPosition} ${bottomY} ${cutPosition} ${bottomY - r2}`
                                        } else {
                                          path += ` L ${cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        // Go to where right chamfer starts, then include the chamfer
                                        path += ` L ${worktopWidth - l3Value} ${bottomY}`
                                        path += ` L ${worktopWidth} ${bottomY - l4Value}`
                                      } else {
                                        // Go to where right rounding starts, then include the rounding
                                        if (r2 > 0) {
                                          path += ` L ${worktopWidth - r2} ${bottomY}`
                                          path += ` Q ${worktopWidth} ${bottomY} ${worktopWidth} ${bottomY - r2}`
                                        } else {
                                          path += ` L ${worktopWidth} ${bottomY}`
                                        }
                                      }
                                    }
                                    return path
                                  }
                                  
                                  return (
                                    <>
                                      {/* 1. oldal - Left edge */}
                                      {edgePosition1 && (
                                        <path
                                          d={buildLeftEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 2. oldal - Top edge */}
                                      {edgePosition2 && (
                                        <path
                                          d={buildTopEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 3. oldal - Right edge */}
                                      {edgePosition3 && (
                                        <path
                                          d={buildRightEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                      
                                      {/* 4. oldal - Bottom edge */}
                                      {edgePosition4 && (
                                        <path
                                          d={buildBottomEdgePath()}
                                          fill="none"
                                          stroke={edgeColor}
                                          strokeWidth={edgeThickness}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeDasharray={dashArray}
                                          strokeOpacity={edgeOpacity}
                                        />
                                      )}
                                    </>
                                  )
                                })()}
                                
                                {/* Cutouts - red outlined rectangles with crossed out pattern */}
                                {cutouts.map((cutout, index) => {
                                  const cutoutWidth = parseFloat(cutout.width) || 0
                                  const cutoutHeight = parseFloat(cutout.height) || 0
                                  const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                                  const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
                                  
                                  // Only show if valid and on kept side
                                  if (cutoutWidth <= 0 || cutoutHeight <= 0) return null
                                  
                                  const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  
                                  // Check if cutout fits within kept portion horizontally
                                  if (distanceFromLeft + cutoutWidth > keptWidth) return null
                                  
                                  // Check if cutout fits within kept portion vertically (distanceFromBottom should be within keptHeight)
                                  if (distanceFromBottom + cutoutHeight > keptHeight) return null
                                  
                                  // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
                                  const x = distanceFromLeft
                                  const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
                                  
                                  // Don't render if outside bounds
                                  if (x < 0 || y < startY || x + cutoutWidth > keptWidth || y + cutoutHeight > worktopLength) return null
                                  
                                  // Calculate exact center coordinates of the cutout rectangle
                                  const centerX = x + cutoutWidth / 2
                                  const centerY = y + cutoutHeight / 2
                                  
                                  return (
                                    <g key={cutout.id}>
                                      {/* Red outlined rectangle */}
                                      <rect
                                        x={x}
                                        y={y}
                                        width={cutoutWidth}
                                        height={cutoutHeight}
                                        fill="rgba(255, 107, 107, 0.1)"
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                      />
                                      {/* Diagonal cross lines */}
                                      <line
                                        x1={x}
                                        y1={y}
                                        x2={x + cutoutWidth}
                                        y2={y + cutoutHeight}
                                        stroke="#ff6b6b"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={x + cutoutWidth}
                                        y1={y}
                                        x2={x}
                                        y2={y + cutoutHeight}
                                        stroke="#ff6b6b"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension label - centered in cutout */}
                                      <text
                                        x={centerX}
                                        y={centerY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '60px',
                                          fontWeight: 600,
                                          fill: '#333',
                                          pointerEvents: 'none',
                                          fontFamily: 'monospace'
                                        }}
                                      >
                                        <tspan x={centerX} dy="-0.3em">Kivágás {index + 1}</tspan>
                                        <tspan x={centerX} dy="1.2em">{cutoutWidth}×{cutoutHeight}</tspan>
                                      </text>
                                    </g>
                                  )
                                })}
                                
                                {/* Cutout position dimension labels - ISO standard dimensioning */}
                                {cutouts.map((cutout, index) => {
                                  const cutoutWidth = parseFloat(cutout.width) || 0
                                  const cutoutHeight = parseFloat(cutout.height) || 0
                                  const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                                  const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
                                  
                                  // Only show if valid and on kept side
                                  if (cutoutWidth <= 0 || cutoutHeight <= 0) return null
                                  
                                  const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  
                                  // Check if cutout fits within kept portion
                                  if (distanceFromLeft + cutoutWidth > keptWidth) return null
                                  if (distanceFromBottom + cutoutHeight > keptHeight) return null
                                  
                                  // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
                                  const x = distanceFromLeft
                                  const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
                                  
                                  // Don't render if outside bounds
                                  if (x < 0 || y < startY || x + cutoutWidth > keptWidth || y + cutoutHeight > worktopLength) return null
                                  
                                  // Stack dimension labels in separate rows/columns to avoid overlap
                                  // Horizontal dimension (distance from left edge) - stack vertically
                                  const horizontalRowSpacing = 120 // Space between rows
                                  const horizontalBaseOffset = 100 // Base distance from bottom
                                  const horizontalDimensionLineY = worktopLength + horizontalBaseOffset + (index * horizontalRowSpacing)
                                  const horizontalLabelY = horizontalDimensionLineY + 60
                                  
                                  // Vertical dimension (distance from bottom) - stack horizontally
                                  const verticalColumnSpacing = 120 // Space between columns
                                  const verticalBaseOffset = 100 // Base distance from left edge
                                  const verticalDimensionLineX = -(verticalBaseOffset + (index * verticalColumnSpacing))
                                  const verticalLabelX = verticalDimensionLineX - 50
                                  
                                  return (
                                    <g key={`cutout-dims-${cutout.id}`}>
                                      {/* Horizontal dimension - distance from left edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={0}
                                          y1={worktopLength}
                                          x2={0}
                                          y2={horizontalDimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={x}
                                          y1={worktopLength}
                                          x2={x}
                                          y2={horizontalDimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={0}
                                          y1={horizontalDimensionLineY}
                                          x2={x}
                                          y2={horizontalDimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={x / 2}
                                          y={horizontalLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          {distanceFromLeft}mm
                                        </text>
                                      </g>
                                      
                                      {/* Vertical dimension - distance from bottom */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={0}
                                          y1={y + cutoutHeight}
                                          x2={verticalDimensionLineX}
                                          y2={y + cutoutHeight}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={0}
                                          y1={worktopLength}
                                          x2={verticalDimensionLineX}
                                          y2={worktopLength}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={verticalDimensionLineX}
                                          y1={y + cutoutHeight}
                                          x2={verticalDimensionLineX}
                                          y2={worktopLength}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={verticalLabelX}
                                          y={(y + cutoutHeight + worktopLength) / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${verticalLabelX} ${(y + cutoutHeight + worktopLength) / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          {distanceFromBottom}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })}
                                
                                {/* Edge position labels outside worktop with ISO dimension style extension lines */}
                                {(() => {
                                  const rightEdge = showCut ? cutPosition : worktopWidth
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  
                                  // Center of worktop edges
                                  const centerX = rightEdge / 2
                                  const centerY = (startY + bottomY) / 2
                                  
                                  // Extension line offset (distance from edge to label) - proportional to maintain aspect ratio
                                  // Use a percentage of the smaller dimension to keep labels visible and maintain aspect ratio
                                  const minDimension = Math.min(rightEdge, bottomY - startY)
                                  const extensionOffset = minDimension * 0.15 // 15% of smaller dimension
                                  
                                  // Extension line length (how far the line extends from edge) - proportional
                                  const extensionLineLength = minDimension * 0.08 // 8% of smaller dimension
                                  
                                  // Calculate edge center points
                                  // 1. oldal - Left edge center: (0, centerY)
                                  const leftEdgeX = 0
                                  const leftEdgeY = centerY
                                  
                                  // 2. oldal - Top edge center: (centerX, startY)
                                  const topEdgeX = centerX
                                  const topEdgeY = startY
                                  
                                  // 3. oldal - Right edge center: (rightEdge, centerY)
                                  const rightEdgeX = rightEdge
                                  const rightEdgeY = centerY
                                  
                                  // 4. oldal - Bottom edge center: (centerX, bottomY)
                                  const bottomEdgeX = centerX
                                  const bottomEdgeY = bottomY
                                  
                                  // Label positions - outside worktop
                                  // 1. oldal - Left: to the left of worktop
                                  const leftLabelX = leftEdgeX - extensionOffset
                                  const leftLabelY = leftEdgeY
                                  
                                  // 2. oldal - Top: above worktop
                                  const topLabelX = topEdgeX
                                  const topLabelY = topEdgeY - extensionOffset
                                  
                                  // 3. oldal - Right: to the right of worktop
                                  const rightLabelX = rightEdgeX + extensionOffset
                                  const rightLabelY = rightEdgeY
                                  
                                  // 4. oldal - Bottom: below worktop
                                  const bottomLabelX = bottomEdgeX
                                  const bottomLabelY = bottomEdgeY + extensionOffset
                                  
                                  return (
                                    <>
                                      {/* 1. oldal - Left edge label */}
                                      {edgePosition1 && (
                                        <text
                                          x={leftLabelX}
                                          y={leftLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${leftLabelX} ${leftLabelY})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          1. oldal
                                        </text>
                                      )}
                                      
                                      {/* 2. oldal - Top edge label */}
                                      {edgePosition2 && (
                                        <text
                                          x={topLabelX}
                                          y={topLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          2. oldal
                                        </text>
                                      )}
                                      
                                      {/* 3. oldal - Right edge label */}
                                      {edgePosition3 && (
                                        <text
                                          x={rightLabelX}
                                          y={rightLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(90 ${rightLabelX} ${rightLabelY})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          3. oldal
                                        </text>
                                      )}
                                      
                                      {/* 4. oldal - Bottom edge label */}
                                      {edgePosition4 && (
                                        <text
                                          x={bottomLabelX}
                                          y={bottomLabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 600,
                                            fill: '#000000',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          4. oldal
                                        </text>
                                      )}
                                    </>
                                  )
                                })()}
                                
                                {/* A dimension - ISO standard dimensioning for Levágás */}
                                {showCut && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position below oldal label if 4. oldal is active, otherwise closer
                                  // Always position after all cutout dimension labels
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineY = worktopLength + extensionLineOffset
                                  const labelY = dimensionLineY + 60 // Label below dimension line
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left edge and cut position */}
                                      <line
                                        x1={0}
                                        y1={worktopLength}
                                        x2={0}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={cutPosition}
                                        y1={worktopLength}
                                        x2={cutPosition}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={0}
                                        y1={dimensionLineY}
                                        x2={cutPosition}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={cutPosition / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#ff6b6b',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        A: {cutPosition}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* A dimension - ISO standard dimensioning for Hossztoldás */}
                                {assemblyType === 'Hossztoldás' && aValue > 0 && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position below oldal label if 4. oldal is active, otherwise closer
                                  // Always position after all cutout dimension labels
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineY = worktopLength + extensionLineOffset
                                  const labelY = dimensionLineY + 60 // Label below dimension line
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left edge and right edge */}
                                      <line
                                        x1={0}
                                        y1={worktopLength}
                                        x2={0}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={worktopWidth}
                                        y1={worktopLength}
                                        x2={worktopWidth}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={0}
                                        y1={dimensionLineY}
                                        x2={worktopWidth}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={worktopWidth / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        A: {aValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}
                                
                                {/* B dimension - ISO standard dimensioning (vertical) - measures kept part from cut line to bottom */}
                                {showVerticalCut && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 50 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 50 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position to the left of oldal label if 1. oldal is active, otherwise closer
                                  // Always position after all cutout dimension labels
                                  const baseOffset = edgePosition1 ? 350 : 220
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineX = -extensionLineOffset
                                  const startY = verticalCutHeight // Start from cut line (top of kept part)
                                  const bottomY = worktopLength // End at bottom
                                  const labelX = dimensionLineX - 50 // Label to the left of dimension line
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from cut line and bottom of kept part */}
                                      <line
                                        x1={0}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={startY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={0}
                                        y1={bottomY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={dimensionLineX}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label to the left of dimension line - centered and rotated */}
                                      <text
                                        x={labelX}
                                        y={(startY + bottomY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        transform={`rotate(-90 ${labelX} ${(startY + bottomY) / 2})`}
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#ff6b6b',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        B: {bValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}
                                
                                {/* Pattern definitions for cut overlays */}
                                <defs>
                                  <pattern
                                    id="diagonalHatch"
                                    patternUnits="userSpaceOnUse"
                                    width="80"
                                    height="80"
                                  >
                                    <path
                                      d="M 0,80 L 80,0"
                                      stroke="rgba(100, 150, 200, 0.35)"
                                      strokeWidth="1.5"
                                    />
                                  </pattern>
                                </defs>
                                
                                {/* Horizontal cut part (right side) for Levágás - drawn in SVG to match exact dimensions */}
                                {showCut && (() => {
                                  const gapSize = 25 // Gap between cut line and cut-down part (mm)
                                  const cutDownX = cutPosition + gapSize
                                  const cutDownWidth = worktopWidth - cutPosition - gapSize
                                  return (
                                    <g>
                                      {/* Cut-down rectangle with diagonal pattern */}
                                      <rect
                                        x={cutDownX}
                                        y={0}
                                        width={cutDownWidth}
                                        height={worktopLength}
                                        fill="rgba(150, 180, 220, 0.2)"
                                        stroke="rgba(100, 150, 200, 0.5)"
                                        strokeWidth="1"
                                        strokeDasharray="5,5"
                                      />
                                      <rect
                                        x={cutDownX}
                                        y={0}
                                        width={cutDownWidth}
                                        height={worktopLength}
                                        fill="url(#diagonalHatch)"
                                      />
                                      {/* Red cut line */}
                                      <line
                                        x1={cutPosition}
                                        y1={0}
                                        x2={cutPosition}
                                        y2={worktopLength}
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                      />
                                    </g>
                                  )
                                })()}
                                
                                {/* Vertical cut part (top side) - drawn in SVG to match exact dimensions */}
                                {showVerticalCut && (() => {
                                  const gapSize = 25 // Gap between cut line and cut-down part (mm)
                                  const cutDownY = 0
                                  const cutDownHeight = verticalCutHeight - gapSize
                                  return (
                                    <g>
                                      {/* Cut-down rectangle with diagonal pattern */}
                                      <rect
                                        x={0}
                                        y={cutDownY}
                                        width={worktopWidth}
                                        height={cutDownHeight}
                                        fill="rgba(150, 180, 220, 0.2)"
                                        stroke="rgba(100, 150, 200, 0.5)"
                                        strokeWidth="1"
                                        strokeDasharray="5,5"
                                      />
                                      <rect
                                        x={0}
                                        y={cutDownY}
                                        width={worktopWidth}
                                        height={cutDownHeight}
                                        fill="url(#diagonalHatch)"
                                      />
                                      {/* Red cut line */}
                                      <line
                                        x1={0}
                                        y1={verticalCutHeight}
                                        x2={worktopWidth}
                                        y2={verticalCutHeight}
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                      />
                                    </g>
                                  )
                                })()}
                                
                                {/* R1 label (bottom-left corner) - positioned inside worktop close to corner */}
                                {r1Value > 0 && (() => {
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (r1Value, bottomY - r1Value)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = r1Value * 0.6
                                  const labelY = bottomY - r1Value * 0.6
                                  // Only show if label is within the kept portion
                                  if (labelY < startY) return null
                                  return (
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="start"
                                      dominantBaseline="middle"
                                      style={{
                                        fontSize: '60px',
                                        fontWeight: 600,
                                        fill: '#1976d2',
                                        pointerEvents: 'none'
                                      }}
                                    >
                                      R1
                                    </text>
                                  )
                                })()}
                                
                                {/* R2 label (bottom-right corner of kept part) - positioned inside worktop close to corner */}
                                {r2Value > 0 && (() => {
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  const rightEdge = showCut ? cutPosition : worktopWidth
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (rightEdge - r2Value, bottomY - r2Value)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = rightEdge - r2Value * 0.6
                                  const labelY = bottomY - r2Value * 0.6
                                  // Only show if label is within the kept portion
                                  if (labelY < startY || labelX > rightEdge) return null
                                  return (
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="end"
                                      dominantBaseline="middle"
                                      style={{
                                        fontSize: '60px',
                                        fontWeight: 600,
                                        fill: '#1976d2',
                                        pointerEvents: 'none'
                                      }}
                                    >
                                      R2
                                    </text>
                                  )
                                })()}
                              </Box>
                              
                              


                              {/* Join position label (C dimension) for Hossztoldás - centered on join line */}
                              {showJoin && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    position: 'absolute',
                                    bottom: -20,
                                    left: `${joinPercent}%`,
                                    transform: 'translateX(-50%)',
                                    fontWeight: 500,
                                    color: '#666'
                                  }}
                                >
                                  C: {cValue}mm
                                </Typography>
                              )}

                            </Box>
                          </>
                        )
                      })()
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          border: '1px dashed #ccc',
                          backgroundColor: '#fafafa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 200
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Válasszon munkalapot a vizualizáció megjelenítéséhez
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Saved Configurations Table */}
      {savedConfigs.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Mentett konfigurációk
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Munkalap típusa</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Összeállítás típusa</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Műveletek</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {savedConfigs.map((config) => (
                  <TableRow
                    key={config.id}
                    onClick={() => loadConfiguration(config)}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: editingConfigId === config.id ? 'action.selected' : 'inherit',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <TableCell>{getMaterialName(config.selectedLinearMaterialId)}</TableCell>
                    <TableCell>{config.assemblyType || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConfiguration(config.id)
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}

