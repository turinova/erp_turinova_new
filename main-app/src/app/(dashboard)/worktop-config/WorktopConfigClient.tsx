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
  worktopType?: 'main' | 'perpendicular' // For Összemarás Balos: which worktop the cutout is on
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
  dimensionD: string
  dimensionE?: string
  dimensionF?: string
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
    'Összemarás U alak (Nem működik még)'
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
  const [dimensionD, setDimensionD] = useState<string>('')
  const [dimensionE, setDimensionE] = useState<string>('')
  const [dimensionF, setDimensionF] = useState<string>('')
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
    if (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') {
      if (!dimensionA || parseFloat(dimensionA) <= 0) return false
      if (!dimensionB || parseFloat(dimensionB) <= 0) return false
      if (assemblyType === 'Hossztoldás') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
      }
      if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
        if (!dimensionD || parseFloat(dimensionD) <= 0) return false
      }
      if (assemblyType === 'Összemarás U alak (Nem működik még)') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) return false
        if (!dimensionD || parseFloat(dimensionD) <= 0) return false
        if (!dimensionE || parseFloat(dimensionE) <= 0) return false
        if (!dimensionF || parseFloat(dimensionF) <= 0) return false
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
    if (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') {
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
      if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) {
          toast.error('Kérjük adja meg a C méretet!')
          return false
        }
        if (!dimensionD || parseFloat(dimensionD) <= 0) {
          toast.error('Kérjük adja meg a D méretet!')
          return false
        }
      }
      if (assemblyType === 'Összemarás U alak (Nem működik még)') {
        if (!dimensionC || parseFloat(dimensionC) <= 0) {
          toast.error('Kérjük adja meg a C méretet!')
          return false
        }
        if (!dimensionD || parseFloat(dimensionD) <= 0) {
          toast.error('Kérjük adja meg a D méretet!')
          return false
        }
        if (!dimensionE || parseFloat(dimensionE) <= 0) {
          toast.error('Kérjük adja meg az E méretet!')
          return false
        }
        if (!dimensionF || parseFloat(dimensionF) <= 0) {
          toast.error('Kérjük adja meg az F méretet!')
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
      dimensionD,
      dimensionE,
      dimensionF,
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
    setDimensionD(config.dimensionD || '')
    setDimensionE(config.dimensionE || '')
    setDimensionF(config.dimensionF || '')
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
    setDimensionD('')
    setDimensionE('')
    setDimensionF('')
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
                {(assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Méretek ({assemblyType})
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') ? 2 : (assemblyType === 'Hossztoldás' ? 4 : 6)}>
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
                      <Grid item xs={12} sm={(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') ? 2 : (assemblyType === 'Hossztoldás' ? 4 : 6)}>
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
                      {(assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && (
                        <Grid item xs={12} sm={(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') ? 2 : 4}>
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
                      {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && (
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="D (mm)"
                            type="number"
                            value={dimensionD}
                            onChange={(e) => setDimensionD(e.target.value)}
                            inputProps={{ min: 0, step: 1 }}
                          />
                        </Grid>
                      )}
                      {assemblyType === 'Összemarás U alak (Nem működik még)' && (
                        <>
                          <Grid item xs={12} sm={2}>
                            <TextField
                              fullWidth
                              size="small"
                              label="E (mm)"
                              type="number"
                              value={dimensionE}
                              onChange={(e) => setDimensionE(e.target.value)}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <TextField
                              fullWidth
                              size="small"
                              label="F (mm)"
                              type="number"
                              value={dimensionF}
                              onChange={(e) => setDimensionF(e.target.value)}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                        </>
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
                          const cValue = parseFloat(dimensionC) || 0
                          const dValue = parseFloat(dimensionD) || 0
                          const selectedMaterial = linearMaterials.find(l => l.id === selectedLinearMaterialId)
                          const materialWidth = selectedMaterial?.length || 1
                          const keptWidth = (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && aValue > 0 ? Math.min(aValue, materialWidth) : materialWidth
                          
                          const cutoutWidth = parseFloat(cutout.width) || 0
                          const cutoutHeight = parseFloat(cutout.height) || 0
                          const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                          const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                          
                          // For perpendicular worktop: width/height are swapped after rotation, and dimensions are different
                          let widthError, heightError, positionError
                          if (isPerpendicular) {
                            const rotatedCutoutWidth = cutoutHeight // After rotation, original height becomes width
                            const rotatedCutoutHeight = cutoutWidth // After rotation, original width becomes height
                            widthError = rotatedCutoutWidth >= dValue // D is the width of perpendicular rectangle
                            heightError = rotatedCutoutHeight >= cValue // C is the height of perpendicular rectangle
                            positionError = parseFloat(cutout.distanceFromBottom) + rotatedCutoutWidth > dValue
                          } else {
                            widthError = cutoutWidth >= keptWidth
                            heightError = cutoutHeight >= bValue
                            positionError = distanceFromLeft + cutoutWidth > keptWidth
                          }
                          
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
                                    helperText={widthError ? (isPerpendicular ? `Szélesség (forgás után) kisebb kell legyen, mint ${dValue}mm` : `Szélesség kisebb kell legyen, mint ${keptWidth}mm`) : ''}
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
                                    helperText={heightError ? (isPerpendicular ? `Magasság (forgás után) kisebb kell legyen, mint ${cValue}mm` : `Magasság kisebb kell legyen, mint ${bValue}mm`) : ''}
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
                                    helperText={positionError ? (isPerpendicular ? `Pozíció + szélesség nem lehet nagyobb, mint ${dValue}mm` : `Pozíció + szélesség nem lehet nagyobb, mint ${keptWidth}mm`) : ''}
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
                                {/* Worktop selection for Összemarás Balos and jobbos */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && (
                                  <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                      select
                                      fullWidth
                                      size="small"
                                      label="Munkalap"
                                      value={cutout.worktopType || 'main'}
                                      onChange={(e) => setCutouts(prev => prev.map(c => c.id === cutout.id ? { ...c, worktopType: e.target.value as 'main' | 'perpendicular' } : c))}
                                    >
                                      <MenuItem value="main">Fő munkalap</MenuItem>
                                      <MenuItem value="perpendicular">Perpendikuláris munkalap</MenuItem>
                                    </TextField>
                                  </Grid>
                                )}
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
                                distanceFromBottom: '',
                                worktopType: (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 'main' : undefined
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
                        // For Összemarás Balos: A = width, B = height (no cutting)
                        const aValue = parseFloat(dimensionA) || 0
                        const bValue = parseFloat(dimensionB) || materialLength // Parse B early for Összemarás Balos
                        const cValue = parseFloat(dimensionC) || 0
                        
                        // Determine actual worktop dimensions based on assembly type
                        let worktopWidth: number
                        let worktopLength: number
                        
                        if (assemblyType === 'Hossztoldás') {
                          // Hossztoldás: A = full extended length, base visualization uses material dimensions
                          // B creates vertical cut from material width (like Levágás)
                          worktopWidth = aValue > 0 ? aValue : materialWidth
                          worktopLength = materialLength  // Use material width as base (same as Levágás)
                        } else if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') {
                          // Összemarás Balos/jobbos/Összemarás: Simple A x B rectangle, no cutting logic
                          worktopWidth = aValue > 0 ? aValue : materialWidth
                          worktopLength = bValue > 0 ? bValue : materialLength
                        } else {
                          // Levágás: use material dimensions, A is cut position
                          worktopWidth = materialWidth
                          worktopLength = materialLength
                        }

                        // Cut position based on A (mm) along displayed width (for Levágás)
                        const cutPosition = assemblyType === 'Levágás' ? aValue : 0
                        const cutPercent = worktopWidth > 0 ? (cutPosition / worktopWidth) * 100 : 0
                        const showCut = assemblyType === 'Levágás' && cutPosition > 0 && cutPosition < worktopWidth
                        
                        // Join position for Hossztoldás only (C value - measured from right edge)
                        // C is measured from right, so join position from left = worktopWidth - cValue
                        // Összemarás balos: no join line, C is just the height of the perpendicular rectangle
                        const joinPosition = assemblyType === 'Hossztoldás' && cValue > 0 ? worktopWidth - cValue : 0
                        const joinPercent = worktopWidth > 0 ? (joinPosition / worktopWidth) * 100 : 0
                        const showJoin = assemblyType === 'Hossztoldás' && cValue > 0 && joinPosition > 0 && joinPosition < worktopWidth
                        
                        // Vertical cut based on B (mm) along displayed height (for Levágás and Hossztoldás only)
                        // Összemarás balos: no cutting, B is just the height of the main rectangle
                        const verticalCutHeight = worktopLength - bValue
                        const verticalCutPercent = worktopLength > 0 ? (verticalCutHeight / worktopLength) * 100 : 0
                        const showVerticalCut = (assemblyType === 'Levágás' || assemblyType === 'Hossztoldás') && bValue > 0 && bValue < worktopLength
                        
                        // Perpendicular rectangles for Összemarás types
                        // Simple visualization: no cutting logic
                        // Main worktop: A x B rectangle
                        // Left perpendicular rectangle (Balos/Összemarás): C x D rectangle, perpendicular to main worktop
                        // Right perpendicular rectangle (Összemarás only): E x F rectangle, perpendicular to main worktop
                        const dValue = parseFloat(dimensionD) || 0
                        const eValue = parseFloat(dimensionE) || 0
                        const fValue = parseFloat(dimensionF) || 0
                        const leftPerpendicularRectHeight = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && cValue > 0 ? cValue : 0 // Height = C
                        const leftPerpendicularRectWidth = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && dValue > 0 ? dValue : 0 // Width = D
                        const rightPerpendicularRectHeight = assemblyType === 'Összemarás U alak (Nem működik még)' && eValue > 0 ? eValue : 0 // Height = E
                        const rightPerpendicularRectWidth = assemblyType === 'Összemarás U alak (Nem működik még)' && fValue > 0 ? fValue : 0 // Width = F
                        const showLeftPerpendicularRect = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && cValue > 0 && dValue > 0 && leftPerpendicularRectHeight > 0 && leftPerpendicularRectWidth > 0
                        const showRightPerpendicularRect = assemblyType === 'Összemarás U alak (Nem működik még)' && eValue > 0 && fValue > 0 && rightPerpendicularRectHeight > 0 && rightPerpendicularRectWidth > 0
                        // For backward compatibility, keep showPerpendicularRect for left rectangle
                        const showPerpendicularRect = showLeftPerpendicularRect
                        const isJobbos = assemblyType === 'Összemarás jobbos'
                        const isOsszemaras = assemblyType === 'Összemarás U alak (Nem működik még)'

                        // Calculate rounding: R1/R2 values are in mm
                        // R1 = 100mm means: cut 100mm from bottom-left corner along bottom edge (right), 
                        // cut 100mm up along left edge, connect with 100mm radius arc
                        // For Összemarás balos: R1 applies to perpendicular rectangle's bottom-right corner
                        const r1ValueRaw = parseFloat(roundingR1) || 0
                        const r2ValueRaw = parseFloat(roundingR2) || 0
                        // Effective width for rounding on kept part (left of cut)
                        const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, materialWidth)) : worktopWidth
                        // Effective height for rounding on kept part (bottom of vertical cut)
                        const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, materialLength)) : worktopLength
                        // Use shorter edge until value of B (height), while respecting half of kept width
                        // For Összemarás: R2 applies to right rectangle, not main worktop
                        const r1Value = Math.min(r1ValueRaw, keptWidth / 2, keptHeight)
                        const r2Value = (assemblyType === 'Összemarás U alak (Nem működik még)') ? 0 : Math.min(r2ValueRaw, keptWidth / 2, keptHeight)
                        
                        // For left perpendicular rectangle: R1 applies to its bottom-right corner
                        const leftPerpendicularRectR1 = showLeftPerpendicularRect 
                          ? Math.min(r1ValueRaw, leftPerpendicularRectWidth / 2, leftPerpendicularRectHeight) 
                          : 0
                        // For right perpendicular rectangle: R2 applies to its bottom-left corner
                        const rightPerpendicularRectR2 = showRightPerpendicularRect 
                          ? Math.min(r2ValueRaw, rightPerpendicularRectWidth / 2, rightPerpendicularRectHeight) 
                          : 0
                        
                        // Calculate chamfer values: L1/L2 for bottom-left (or left perpendicular rectangle's bottom-right for Összemarás Balos), L3/L4 for right perpendicular rectangle's bottom-left (Összemarás)
                        const l1Value = parseFloat(cutL1) || 0
                        const l2Value = parseFloat(cutL2) || 0
                        const l3Value = parseFloat(cutL3) || 0
                        const l4Value = parseFloat(cutL4) || 0
                        // For Összemarás Balos/jobbos: L1-L2 applies to left perpendicular rectangle's bottom-right, not main worktop's bottom-left
                        // For Összemarás: L1-L2 applies to left perpendicular rectangle's bottom-right, L3-L4 applies to right perpendicular rectangle's bottom-left
                        const hasL1L2 = l1Value > 0 && l2Value > 0 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos' && assemblyType !== 'Összemarás U alak (Nem működik még)'
                        const hasL3L4 = l3Value > 0 && l4Value > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)'
                        // For left perpendicular rectangle: L1-L2 applies to its bottom-right corner
                        const hasLeftPerpendicularL1L2 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && l1Value > 0 && l2Value > 0
                        // For right perpendicular rectangle: L3-L4 applies to its bottom-left corner
                        const hasRightPerpendicularL3L4 = assemblyType === 'Összemarás U alak (Nem működik még)' && showRightPerpendicularRect && l3Value > 0 && l4Value > 0
                        // For backward compatibility
                        const hasPerpendicularL1L2 = hasLeftPerpendicularL1L2
                        const keptRightEdge = showCut ? cutPosition : worktopWidth

                        // Calculate expanded viewBox to accommodate labels while maintaining aspect ratio
                        // Labels need space: increased padding for left/right to show dimension labels
                        // For Összemarás balos, also need space for perpendicular rectangle (extends down by C-B, right by D)
                        // Also need space for A dimension label on top and C dimension label on left
                        // Need extra space for cutout dimension labels on right side (perpendicular worktop)
                        const maxCutoutIndex = cutouts.length > 0 ? cutouts.length - 1 : 0
                        const rightPaddingForCutouts = maxCutoutIndex * 120 + 200 // Space for perpendicular cutout dimension labels
                        const labelPaddingLeft = (showLeftPerpendicularRect || showRightPerpendicularRect) ? 550 : 400 // Extra space for C/E dimension labels and cutout labels (increased for better spacing from card edge)
                        const labelPaddingRight = Math.max(400, rightPaddingForCutouts) // Extra space for B/F dimension labels and perpendicular cutout labels
                        const labelPaddingTop = (assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') ? 300 : 100 // Extra space for A dimension label
                        const labelPaddingBottom = 150
                        
                        // Total dimensions depend on assembly type
                        let totalWorktopHeight: number
                        let totalWorktopWidth: number
                        
                        if (isJobbos && showLeftPerpendicularRect) {
                          // Összemarás jobbos: perpendicular rectangle at top-left, main worktop attached to its top-right
                          // Total width = leftPerpendicularRectWidth + worktopWidth = D + A
                          // Total height = max(leftPerpendicularRectHeight, worktopLength) = max(C, B)
                          totalWorktopWidth = leftPerpendicularRectWidth + worktopWidth
                          totalWorktopHeight = Math.max(leftPerpendicularRectHeight, worktopLength)
                        } else if (isOsszemaras && showLeftPerpendicularRect && showRightPerpendicularRect) {
                          // Összemarás: U-shape with left and right perpendicular rectangles
                          // Total width = leftPerpendicularRectWidth + worktopWidth + rightPerpendicularRectWidth = D + A + F
                          // Total height = max(worktopLength + leftPerpendicularRectHeight, worktopLength + rightPerpendicularRectHeight) = max(B + C, B + E)
                          totalWorktopWidth = leftPerpendicularRectWidth + worktopWidth + rightPerpendicularRectWidth
                          totalWorktopHeight = Math.max(worktopLength + leftPerpendicularRectHeight, worktopLength + rightPerpendicularRectHeight)
                        } else if (showLeftPerpendicularRect) {
                          // Összemarás Balos: left perpendicular rectangle at bottom-left
                          totalWorktopHeight = worktopLength + leftPerpendicularRectHeight
                          totalWorktopWidth = Math.max(worktopWidth, leftPerpendicularRectWidth)
                        } else {
                          totalWorktopHeight = worktopLength
                          totalWorktopWidth = worktopWidth
                        }
                        
                        const expandedWidth = totalWorktopWidth + labelPaddingLeft + labelPaddingRight
                        const expandedHeight = totalWorktopHeight + labelPaddingTop + labelPaddingBottom
                        
                        // Calculate the aspect ratio of the expanded viewBox
                        const expandedAspectRatio = expandedWidth / expandedHeight
                        // For Összemarás balos/jobbos, use total dimensions
                        const worktopAspectRatio = totalWorktopWidth / totalWorktopHeight
                        
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
                        
                        // Calculate viewBox offset
                        // For Összemarás: left rectangle starts at X=0, so viewBox should start at -labelPaddingLeft to show it
                        // For other types: center the worktop in the expanded viewBox
                        let viewBoxX: number
                        if (isOsszemaras && showLeftPerpendicularRect) {
                          // For Összemarás: left rectangle is at X=0, so viewBox should start at -labelPaddingLeft
                          viewBoxX = -labelPaddingLeft
                        } else {
                          // Center the worktop in the expanded viewBox
                          viewBoxX = -(finalViewBoxWidth - totalWorktopWidth) / 2
                        }
                        const viewBoxY = -(finalViewBoxHeight - totalWorktopHeight) / 2

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
                                    // For Összemarás Balos/jobbos: R1 is used for perpendicular rectangle, not main worktop
                                    const r1 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 0 : Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
                                    const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
                                    
                                    // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                    // For Összemarás: main worktop stays at (0, 0), left rectangle extends LEFT from it
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    
                                    // Start position: if vertical cut, start from top of kept portion (bottom of cut)
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Build path: start from top-left of kept portion (offset for jobbos)
                                    let path = `M ${mainWorktopOffsetX} ${startY}`
                                    
                                    // Top edge: to top-right (or cut position if horizontal cutting)
                                    if (showCut) {
                                      path += ` L ${mainWorktopOffsetX + cutPosition} ${startY}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX + worktopWidth} ${startY}`
                                    }
                                    
                                    // Right edge: if horizontal cutting, stop at cut position; otherwise go to bottom-right
                                    const bottomY = worktopLength // Always go to full bottom
                                    if (showCut) {
                                      // At cut position, go down the right edge
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (cutPosition, worktopLength - l4Value), then diagonal to (cutPosition - l3Value, worktopLength)
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + cutPosition - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
                                        // R2 rounding at cut line (bottom-right of kept part)
                                        if (r2 > 0) {
                                          path += ` Q ${mainWorktopOffsetX + cutPosition} ${bottomY} ${mainWorktopOffsetX + cutPosition - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      // No horizontal cut: go to bottom-right
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (worktopWidth, worktopLength - l4Value), then diagonal to (worktopWidth - l3Value, worktopLength)
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + worktopWidth - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
                                        // R2 rounding at full width
                                        if (r2 > 0) {
                                          path += ` Q ${mainWorktopOffsetX + worktopWidth} ${bottomY} ${mainWorktopOffsetX + worktopWidth - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY}`
                                        }
                                      }
                                    }
                                    
                                    // Bottom edge: to bottom-left
                                    if (hasL1L2) {
                                      // L1/L2 chamfer: go to (l1Value, materialLength) then diagonal to (0, materialLength - l2Value)
                                      path += ` L ${mainWorktopOffsetX + l1Value} ${bottomY}`
                                      path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX + r1} ${bottomY}`
                                      // R1 rounding (bottom-left)
                                      if (r1 > 0) {
                                        path += ` Q ${mainWorktopOffsetX} ${bottomY} ${mainWorktopOffsetX} ${bottomY - r1}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX} ${bottomY}`
                                      }
                                    }
                                    
                                    // Left edge: back to top (or to start of kept portion if vertical cut)
                                    path += ` L ${mainWorktopOffsetX} ${startY}`
                                    
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

                                {/* Left perpendicular rectangle for Összemarás balos (at bottom-left) and jobbos (at top-left) - Simple C x D rectangle with R1 rounding or L1-L2 chamfer at bottom-right corner */}
                                {showLeftPerpendicularRect && (() => {
                                  // For Balos: at bottom-left (0, worktopLength), extends to the right
                                  //   Top-left corner connects to main worktop bottom-left
                                  // For Összemarás: top-LEFT corner connects to main worktop's bottom-LEFT corner
                                  //   Main worktop bottom-left is at (leftPerpendicularRectWidth, worktopLength)
                                  //   So left rectangle's top-LEFT should be at (leftPerpendicularRectWidth, worktopLength)
                                  //   Rectangle extends LEFT from this point
                                  // For jobbos: at top-left (0, 0)
                                  let rectX: number
                                  let rectY: number
                                  
                                  if (isJobbos) {
                                    rectX = 0
                                    rectY = 0
                                  } else {
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength), extends to the right
                                    // EXACTLY the same as Összemarás Balos
                                    rectX = 0
                                    rectY = worktopLength
                                  }
                                  
                                  const rectWidth = leftPerpendicularRectWidth
                                  const rectHeight = leftPerpendicularRectHeight
                                  const r1 = leftPerpendicularRectR1
                                  
                                  // Build path with R1 rounding or L1-L2 chamfer
                                  // For all types (Balos, jobbos, Összemarás): standard drawing extending to the right
                                  const bottomRightX = rectX + rectWidth
                                  const bottomRightY = rectY + rectHeight
                                  
                                  let path = `M ${rectX} ${rectY}` // Start at top-left
                                  path += ` L ${bottomRightX} ${rectY}` // Top edge to top-right
                                  
                                  // Right edge: down to bottom-right corner (with L1-L2 chamfer or R1 rounding)
                                  if (hasLeftPerpendicularL1L2) {
                                    path += ` L ${bottomRightX} ${bottomRightY - l2Value}`
                                    path += ` L ${bottomRightX - l1Value} ${bottomRightY}`
                                  } else {
                                    path += ` L ${bottomRightX} ${bottomRightY - r1}`
                                    if (r1 > 0) {
                                      path += ` Q ${bottomRightX} ${bottomRightY} ${bottomRightX - r1} ${bottomRightY}`
                                    } else {
                                      path += ` L ${bottomRightX} ${bottomRightY}`
                                    }
                                  }
                                  
                                  path += ` L ${rectX} ${bottomRightY}` // Bottom edge to bottom-left
                                  path += ` L ${rectX} ${rectY}` // Left edge back to top-left
                                  
                                  path += ` Z` // Close path
                                  
                                  return (
                                    <path
                                      d={path}
                                      fill="#f0f8ff"
                                      stroke="#000"
                                      strokeWidth="3"
                                    />
                                  )
                                })()}

                                {/* Right perpendicular rectangle for Összemarás (at bottom-right) - Simple E x F rectangle with R2 rounding or L3-L4 chamfer at bottom-left corner */}
                                {showRightPerpendicularRect && (() => {
                                  // For Összemarás: top-RIGHT corner connects to main worktop's bottom-RIGHT corner
                                  // Main worktop bottom-right is at (worktopWidth, worktopLength) - no offset
                                  // So right rectangle top-RIGHT should be at (worktopWidth, worktopLength)
                                  // Rectangle extends RIGHT from this point
                                  const topRightX = worktopWidth // Top-right corner (connection point)
                                  const rectY = worktopLength
                                  const rectWidth = rightPerpendicularRectWidth
                                  const rectHeight = rightPerpendicularRectHeight
                                  const r2 = rightPerpendicularRectR2
                                  
                                  // Rectangle extends RIGHT from the connection point
                                  // Top-right corner: (topRightX, rectY) = (mainWorktopOffsetX + worktopWidth, worktopLength)
                                  // Top-left corner: (topRightX - rectWidth, rectY) = (mainWorktopOffsetX + worktopWidth - rectWidth, worktopLength)
                                  // Bottom-left corner: (topRightX - rectWidth, rectY + rectHeight)
                                  // Bottom-right corner: (topRightX, rectY + rectHeight)
                                  // R2 rounding is at bottom-RIGHT corner (the connection point side)
                                  const topLeftX = topRightX - rectWidth
                                  const bottomLeftX = topLeftX
                                  const bottomLeftY = rectY + rectHeight
                                  const bottomRightX = topRightX
                                  const bottomRightY = bottomLeftY
                                  
                                  // Build path with R2 rounding or L3-L4 chamfer at bottom-RIGHT corner
                                  let path = `M ${topRightX} ${rectY}` // Start at top-right (connection point)
                                  path += ` L ${topLeftX} ${rectY}` // Top edge going left
                                  path += ` L ${bottomLeftX} ${bottomLeftY}` // Left edge going down
                                  path += ` L ${bottomRightX} ${bottomRightY}` // Bottom edge going right
                                  
                                  // Bottom-right corner: with L3-L4 chamfer or R2 rounding
                                  if (hasRightPerpendicularL3L4) {
                                    // L3-L4 chamfer at bottom-right corner: go left to (bottomRightX - l3Value, bottomRightY), then diagonal to (bottomRightX, bottomRightY - l4Value)
                                    path = `M ${topRightX} ${rectY}` // Start at top-right (connection point)
                                    path += ` L ${topLeftX} ${rectY}` // Top edge going left
                                    path += ` L ${bottomLeftX} ${bottomLeftY}` // Left edge going down
                                    path += ` L ${bottomRightX - l3Value} ${bottomRightY}` // Bottom edge to where chamfer starts
                                    path += ` L ${bottomRightX} ${bottomRightY - l4Value}` // Diagonal chamfer
                                    path += ` L ${topRightX} ${rectY}` // Right edge back to top-right
                                  } else {
                                    // R2 rounding at bottom-right corner
                                    if (r2 > 0) {
                                      path = `M ${topRightX} ${rectY}` // Start at top-right (connection point)
                                      path += ` L ${topLeftX} ${rectY}` // Top edge going left
                                      path += ` L ${bottomLeftX} ${bottomLeftY}` // Left edge going down
                                      path += ` L ${bottomRightX - r2} ${bottomRightY}` // Bottom edge to where rounding starts
                                      path += ` Q ${bottomRightX} ${bottomRightY} ${bottomRightX} ${bottomRightY - r2}` // R2 rounding arc
                                      path += ` L ${topRightX} ${rectY}` // Right edge back to top-right
                                    } else {
                                      path += ` L ${topRightX} ${rectY}` // Right edge back to top-right
                                    }
                                  }
                                  
                                  path += ` Z` // Close path
                                  
                                  return (
                                    <path
                                      d={path}
                                      fill="#f0f8ff"
                                      stroke="#000"
                                      strokeWidth="3"
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
                                  
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  
                                  // Build the EXACT same path as the worktop border
                                  const buildWorktopBorderPath = () => {
                                    let path = `M ${mainWorktopOffsetX} ${startY}`
                                    
                                    // Top edge
                                    if (showCut) {
                                      path += ` L ${mainWorktopOffsetX + cutPosition} ${startY}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX + worktopWidth} ${startY}`
                                    }
                                    
                                    // Right edge
                                    // For Összemarás: no R2 or L3-L4 on main worktop (they apply to right rectangle)
                                    if (showCut) {
                                      if (hasL3L4) {
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + cutPosition - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
                                        if (r2 > 0) {
                                          path += ` Q ${mainWorktopOffsetX + cutPosition} ${bottomY} ${mainWorktopOffsetX + cutPosition - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      if (hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
                                        path += ` L ${mainWorktopOffsetX + worktopWidth - l3Value} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
                                        if (r2 > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
                                          path += ` Q ${mainWorktopOffsetX + worktopWidth} ${bottomY} ${mainWorktopOffsetX + worktopWidth - r2} ${bottomY}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY}`
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
                                    let path = `M ${mainWorktopOffsetX} ${startY}`
                                    if (hasL1L2) {
                                      // Left edge ends at (mainWorktopOffsetX, bottomY - l2Value) where chamfer starts
                                      path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                    } else {
                                      // Left edge ends at (mainWorktopOffsetX, bottomY - r1) where rounding starts
                                      path += ` L ${mainWorktopOffsetX} ${bottomY - r1}`
                                    }
                                    return path
                                  }
                                  
                                  const buildTopEdgePath = () => {
                                    let path = `M ${mainWorktopOffsetX} ${startY}`
                                    if (showCut) {
                                      path += ` L ${mainWorktopOffsetX + cutPosition} ${startY}`
                                    } else {
                                      path += ` L ${mainWorktopOffsetX + worktopWidth} ${startY}`
                                    }
                                    return path
                                  }
                                  
                                  const buildRightEdgePath = () => {
                                    // Right edge goes from top to bottom, ending where bottom corner starts
                                    let path = `M ${mainWorktopOffsetX + rightEdge} ${startY}`
                                    if (showCut) {
                                      if (hasL3L4) {
                                        // Right edge ends at (cutPosition, bottomY - l4Value) where bottom chamfer starts
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
                                      } else {
                                        // Right edge ends at (cutPosition, bottomY - r2) where bottom rounding starts
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        // Right edge ends at (worktopWidth, bottomY - l4Value) where bottom chamfer starts
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
                                      } else {
                                        // Right edge ends at (worktopWidth, bottomY - r2) where bottom rounding starts
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
                                      }
                                    }
                                    return path
                                  }
                                  
                                  const buildBottomEdgePath = () => {
                                    // Bottom edge includes both left corner (R1 or L1/L2) and right corner (R2 or L3/L4)
                                    let path = ''
                                    if (hasL1L2) {
                                      // Start from left edge at bottom (mainWorktopOffsetX, bottomY - l2Value), then chamfer to (mainWorktopOffsetX + l1Value, bottomY)
                                      path = `M ${mainWorktopOffsetX} ${bottomY - l2Value}`
                                      path += ` L ${mainWorktopOffsetX + l1Value} ${bottomY}`
                                    } else {
                                      // Start from left edge at bottom (mainWorktopOffsetX, bottomY - r1), then rounding to (mainWorktopOffsetX + r1, bottomY)
                                      path = `M ${mainWorktopOffsetX} ${bottomY - r1}`
                                      if (r1 > 0) {
                                        path += ` Q ${mainWorktopOffsetX} ${bottomY} ${mainWorktopOffsetX + r1} ${bottomY}`
                                      } else {
                                        path += ` L ${mainWorktopOffsetX} ${bottomY}`
                                      }
                                    }
                                    // Continue to right corner and include it
                                    if (showCut) {
                                      if (hasL3L4) {
                                        // Go to where right chamfer starts, then include the chamfer
                                        path += ` L ${mainWorktopOffsetX + cutPosition - l3Value} ${bottomY}`
                                        path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
                                      } else {
                                        // Go to where right rounding starts, then include the rounding
                                        if (r2 > 0) {
                                          path += ` L ${mainWorktopOffsetX + cutPosition - r2} ${bottomY}`
                                          path += ` Q ${mainWorktopOffsetX + cutPosition} ${bottomY} ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY}`
                                        }
                                      }
                                    } else {
                                      if (hasL3L4) {
                                        // Go to where right chamfer starts, then include the chamfer
                                        path += ` L ${mainWorktopOffsetX + worktopWidth - l3Value} ${bottomY}`
                                        path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
                                      } else {
                                        // Go to where right rounding starts, then include the rounding
                                        if (r2 > 0) {
                                          path += ` L ${mainWorktopOffsetX + worktopWidth - r2} ${bottomY}`
                                          path += ` Q ${mainWorktopOffsetX + worktopWidth} ${bottomY} ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
                                        } else {
                                          path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY}`
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
                                  const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                                  
                                  // Only show if valid and on kept side
                                  if (cutoutWidth <= 0 || cutoutHeight <= 0) return null
                                  
                                  if (isPerpendicular && showLeftPerpendicularRect) {
                                    // Cutout on perpendicular rectangle - rotated 90 degrees clockwise
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength)
                                    // For jobbos: at top-left (0, 0)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    
                                    // For perpendicular rectangle: 
                                    // distanceFromBottom (távolság alulról) = distance from RIGHT edge of perpendicular worktop
                                    // distanceFromLeft (távolság balról) = distance from BOTTOM edge of perpendicular worktop
                                    
                                    // After 90° clockwise rotation:
                                    // - Original width becomes visual height
                                    // - Original height becomes visual width
                                    // - Visual right edge = original bottom edge
                                    // - Visual bottom edge = original left edge
                                    
                                    // The visual dimensions after 90° clockwise rotation:
                                    // Original width becomes visual height, original height becomes visual width
                                    const visualWidth = cutoutHeight // After rotation, this is the visual width
                                    const visualHeight = cutoutWidth // After rotation, this is the visual height
                                    
                                    // Where the visual edges should be positioned:
                                    const visualRightEdgeX = rectX + rectWidth - distanceFromBottom
                                    const visualBottomEdgeY = rectY + rectHeight - distanceFromLeft
                                    const visualLeftEdgeX = visualRightEdgeX - visualWidth
                                    const visualTopEdgeY = visualBottomEdgeY - visualHeight
                                    
                                    // After 90° clockwise rotation around center (cx, cy):
                                    // The transformation is: (x', y') = (cy - y + cx, x - cx + cy)
                                    // Working backwards: if visual point is (vx, vy), original point is:
                                    // x = vy - cy + cx, y = cy - vx + cx
                                    
                                    // For the visual bottom-left corner (visualLeftEdgeX, visualBottomEdgeY):
                                    // This corresponds to the original top-left corner
                                    // So: original x = visualBottomEdgeY - centerY + centerX
                                    //     original y = centerY - visualLeftEdgeX + centerX
                                    
                                    // But we don't know center yet. Let's use a different approach:
                                    // The center after rotation is at the midpoint of the visual rectangle
                                    const visualCenterX = (visualLeftEdgeX + visualRightEdgeX) / 2
                                    const visualCenterY = (visualTopEdgeY + visualBottomEdgeY) / 2
                                    
                                    // The center doesn't move during rotation, so:
                                    const centerX = visualCenterX
                                    const centerY = visualCenterY
                                    
                                    // Now calculate original position:
                                    // Original rectangle dimensions (before rotation):
                                    const originalWidth = cutoutWidth   // Original width
                                    const originalHeight = cutoutHeight // Original height
                                    
                                    // Original center is at (centerX, centerY), so:
                                    const x = centerX - originalWidth / 2
                                    const y = centerY - originalHeight / 2
                                    
                                    // Check if cutout fits within perpendicular rectangle (using visual dimensions)
                                    if (distanceFromBottom + visualWidth > rectWidth) return null
                                    if (distanceFromLeft + visualHeight > rectHeight) return null
                                    
                                    return (
                                      <g key={cutout.id} transform={`rotate(90 ${centerX} ${centerY})`}>
                                        {/* Red outlined rectangle - use swapped dimensions, rotation will make it correct */}
                                        <rect
                                          x={x}
                                          y={y}
                                          width={originalWidth}
                                          height={originalHeight}
                                          fill="rgba(255, 107, 107, 0.1)"
                                          stroke="#ff6b6b"
                                          strokeWidth="2"
                                        />
                                        {/* Diagonal cross lines */}
                                        <line
                                          x1={x}
                                          y1={y}
                                          x2={x + originalWidth}
                                          y2={y + originalHeight}
                                          stroke="#ff6b6b"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={x + originalWidth}
                                          y1={y}
                                          x2={x}
                                          y2={y + originalHeight}
                                          stroke="#ff6b6b"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension label - centered in cutout, rotated -90 degrees to flip it back to readable orientation */}
                                        <text
                                          x={centerX}
                                          y={centerY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${centerX} ${centerY})`}
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
                                  } else {
                                    // Cutout on main worktop (normal placement)
                                    // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                    // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth (to make room for left rectangle)
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                               (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                    const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Check if cutout fits within kept portion horizontally
                                  if (distanceFromLeft + cutoutWidth > keptWidth) return null
                                  
                                    // Check if cutout fits within kept portion vertically (distanceFromBottom should be within keptHeight)
                                    if (distanceFromBottom + cutoutHeight > keptHeight) return null
                                    
                                    // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
                                    const x = mainWorktopOffsetX + distanceFromLeft
                                    const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
                                  
                                  // Don't render if outside bounds
                                    if (x < mainWorktopOffsetX || y < startY || x + cutoutWidth > mainWorktopOffsetX + keptWidth || y + cutoutHeight > worktopLength) return null
                                    
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
                                  }
                                })}
                              
                                {/* Cutout position dimension labels - ISO standard dimensioning */}
                                {cutouts.map((cutout, index) => {
                                const cutoutWidth = parseFloat(cutout.width) || 0
                                const cutoutHeight = parseFloat(cutout.height) || 0
                                const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
                                const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
                                  const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
                                
                                  // Only show if valid
                                if (cutoutWidth <= 0 || cutoutHeight <= 0) return null
                                
                                  if (isPerpendicular && showLeftPerpendicularRect) {
                                    // Cutout dimension labels for perpendicular rectangle
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength)
                                    // For jobbos: at top-left (0, 0)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    
                                    // The visual dimensions after 90° clockwise rotation:
                                    const visualWidth = cutoutHeight // Original height becomes visual width
                                    const visualHeight = cutoutWidth // Original width becomes visual height
                                    
                                    // Where the visual edges are positioned (after rotation):
                                    const visualRightEdgeX = rectX + rectWidth - distanceFromBottom
                                    const visualBottomEdgeY = rectY + rectHeight - distanceFromLeft
                                    const visualLeftEdgeX = visualRightEdgeX - visualWidth
                                    const visualTopEdgeY = visualBottomEdgeY - visualHeight
                                    
                                    // Check if cutout fits
                                    if (distanceFromBottom + visualWidth > rectWidth) return null
                                    if (distanceFromLeft + visualHeight > rectHeight) return null
                                    
                                    // Stack dimension labels in separate rows/columns to avoid overlap
                                    // Horizontal dimension (távolság alulról = distance from RIGHT edge of perpendicular worktop)
                                    // For Balos: show below perpendicular rectangle
                                    // For jobbos: show above perpendicular rectangle
                                    const horizontalRowSpacing = 120
                                    const horizontalBaseOffset = 100
                                    let horizontalDimensionLineY: number
                                    let horizontalLabelY: number
                                    if (isJobbos) {
                                      // For jobbos: show above the perpendicular rectangle (negative Y)
                                      horizontalDimensionLineY = rectY - horizontalBaseOffset - (index * horizontalRowSpacing)
                                      horizontalLabelY = horizontalDimensionLineY - 60
                                    } else {
                                      // For Balos: show below the perpendicular rectangle
                                      horizontalDimensionLineY = rectY + rectHeight + horizontalBaseOffset + (index * horizontalRowSpacing)
                                      horizontalLabelY = horizontalDimensionLineY + 60
                                    }
                                    
                                    // Vertical dimension (távolság balról = distance from BOTTOM edge of perpendicular worktop)
                                    // Show on RIGHT side for both
                                    const verticalColumnSpacing = 120
                                    const verticalBaseOffset = 100
                                    const verticalDimensionLineX = rectX + rectWidth + verticalBaseOffset + (index * verticalColumnSpacing)
                                    const verticalLabelX = verticalDimensionLineX + 50
                                
                                return (
                                      <g key={`cutout-dims-${cutout.id}`}>
                                        {/* Horizontal dimension - távolság alulról (distance from RIGHT edge of perpendicular worktop) */}
                                        <g>
                                          {isJobbos ? (
                                            <>
                                              {/* For jobbos: show above the perpendicular rectangle */}
                                              {/* Extension line from perpendicular worktop's right edge */}
                                              <line
                                                x1={rectX + rectWidth}
                                                y1={rectY}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Extension line from cutout's visual right edge */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={rectY}
                                                x2={visualRightEdgeX}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Dimension line (horizontal, above) */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={horizontalDimensionLineY}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                            </>
                                          ) : (
                                            <>
                                              {/* For Balos: show below the perpendicular rectangle */}
                                              {/* Extension line from perpendicular worktop's right edge */}
                                              <line
                                                x1={rectX + rectWidth}
                                                y1={rectY + rectHeight}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Extension line from cutout's visual right edge */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={rectY + rectHeight}
                                                x2={visualRightEdgeX}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                              {/* Dimension line (horizontal, below) */}
                                              <line
                                                x1={visualRightEdgeX}
                                                y1={horizontalDimensionLineY}
                                                x2={rectX + rectWidth}
                                                y2={horizontalDimensionLineY}
                                                stroke="#000000"
                                                strokeWidth="1.5"
                                              />
                                            </>
                                          )}
                                          {/* Label */}
                                          <text
                                            x={(visualRightEdgeX + rectX + rectWidth) / 2}
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
                                            {distanceFromBottom}mm
                                          </text>
                                        </g>
                                        
                                        {/* Vertical dimension - távolság balról (distance from BOTTOM edge of perpendicular worktop) - show on RIGHT side */}
                                        <g>
                                          {/* Extension line from cutout's visual bottom edge */}
                                          <line
                                            x1={rectX + rectWidth}
                                            y1={visualBottomEdgeY}
                                            x2={verticalDimensionLineX}
                                            y2={visualBottomEdgeY}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Extension line from perpendicular worktop's bottom edge */}
                                          <line
                                            x1={rectX + rectWidth}
                                            y1={rectY + rectHeight}
                                            x2={verticalDimensionLineX}
                                            y2={rectY + rectHeight}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Dimension line (vertical, on right) */}
                                          <line
                                            x1={verticalDimensionLineX}
                                            y1={visualBottomEdgeY}
                                            x2={verticalDimensionLineX}
                                            y2={rectY + rectHeight}
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                          {/* Label */}
                                          <text
                                            x={verticalLabelX}
                                            y={(visualBottomEdgeY + rectY + rectHeight) / 2}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            transform={`rotate(-90 ${verticalLabelX} ${(visualBottomEdgeY + rectY + rectHeight) / 2})`}
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
                                      </g>
                                    )
                                  } else {
                                    // Cutout dimension labels for main worktop
                                    // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                    // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth (to make room for left rectangle)
                                    const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                               (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                    const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                    const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
                                    const startY = showVerticalCut ? verticalCutHeight : 0
                                    
                                    // Check if cutout fits within kept portion
                                    if (distanceFromLeft + cutoutWidth > keptWidth) return null
                                    if (distanceFromBottom + cutoutHeight > keptHeight) return null
                                    
                                    // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
                                    const x = mainWorktopOffsetX + distanceFromLeft
                                    const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
                                    
                                    // Don't render if outside bounds
                                    if (x < mainWorktopOffsetX || y < startY || x + cutoutWidth > mainWorktopOffsetX + keptWidth || y + cutoutHeight > worktopLength) return null
                                    
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
                                  }
                                })}
                                
                                {/* L1-L2 chamfer dimension labels (bottom-left corner) - ISO standard dimensioning */}
                                {hasL1L2 && (() => {
                                  const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
                                  const bottomY = worktopLength
                                  
                                  // L1 dimension: horizontal distance from left edge
                                  const l1DimensionLineY = bottomY + 100
                                  const l1LabelY = l1DimensionLineY + 60
                                  
                                  // L2 dimension: vertical distance from bottom edge
                                  const l2DimensionLineX = -(100 + cutouts.length * 120)
                                  const l2LabelX = l2DimensionLineX - 50
                                  
                                  return (
                                    <g key="l1-l2-dims">
                                      {/* L1 dimension - horizontal distance from left edge */}
                                      <g>
                                        {/* Extension lines */}
                                          <line
                                          x1={0}
                                          y1={bottomY}
                                            x2={0}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                          <line
                                          x1={l1Value}
                                          y1={bottomY}
                                          x2={l1Value}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                          />
                                          {/* Dimension line */}
                                          <line
                                          x1={0}
                                          y1={l1DimensionLineY}
                                          x2={l1Value}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                            strokeWidth="1.5"
                                          />
                                        {/* Label */}
                                        <text
                                          x={l1Value / 2}
                                          y={l1LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L1: {l1Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L2 dimension - vertical distance from bottom edge */}
                                      <g>
                                        {/* Extension lines */}
                                          <line
                                          x1={0}
                                          y1={bottomY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomY - l2Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                          />
                                          <line
                                          x1={0}
                                          y1={bottomY}
                                          x2={l2DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l2DimensionLineX}
                                          y1={bottomY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l2LabelX}
                                          y={bottomY - l2Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l2LabelX} ${bottomY - l2Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L2: {l2Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* L3-L4 chamfer dimension labels (bottom-right corner) - ISO standard dimensioning */}
                                {/* For Összemarás: L3-L4 applies to right rectangle, not main worktop */}
                                {hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)' && (() => {
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  const bottomY = worktopLength
                                  
                                  // L3 dimension: horizontal distance from right edge (going left)
                                  const l3DimensionLineY = bottomY + 100
                                  const l3LabelY = l3DimensionLineY + 60
                                  
                                  // L4 dimension: vertical distance from bottom edge
                                  // For Összemarás Balos/jobbos: position below B dimension label on right side, but offset to the left to avoid overlap
                                  let l4DimensionLineX, l4LabelX
                                  if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && bValue > 0) {
                                    // Position L4 to the left of B dimension to avoid overlap
                                    const maxCutoutOffset = cutouts.length > 0 
                                      ? 100 + ((cutouts.length - 1) * 120) + 50 + 40
                                      : 0
                                    const baseOffset = edgePosition3 ? 350 : 220
                                    const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                    // Offset L4 120mm to the left of B dimension line
                                    l4DimensionLineX = rightEdge + extensionLineOffset - 120
                                    l4LabelX = l4DimensionLineX + 50
                                  } else {
                                    // Original position for other assembly types
                                    l4DimensionLineX = rightEdge + 100 + (cutouts.length * 120)
                                    l4LabelX = l4DimensionLineX + 50
                                  }
                                  
                                  return (
                                    <g key="l3-l4-dims">
                                      {/* L3 dimension - horizontal distance from right edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={rightEdge}
                                          y1={bottomY}
                                          x2={rightEdge}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={rightEdge - l3Value}
                                          y1={bottomY}
                                          x2={rightEdge - l3Value}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={rightEdge - l3Value}
                                          y1={l3DimensionLineY}
                                          x2={rightEdge}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={rightEdge - l3Value / 2}
                                          y={l3LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L3: {l3Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L4 dimension - vertical distance from bottom edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={rightEdge}
                                          y1={bottomY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomY - l4Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={rightEdge}
                                          y1={bottomY}
                                          x2={l4DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l4DimensionLineX}
                                          y1={bottomY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label - for Összemarás Balos/jobbos, position below B label */}
                                        {(() => {
                                          // Calculate B label position for Összemarás Balos/jobbos
                                          let labelY = bottomY - l4Value / 2
                                          if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && bValue > 0) {
                                            const startY = showVerticalCut ? verticalCutHeight : 0
                                            const bLabelY = (startY + bottomY) / 2
                                            // Position L4 label below B label (120mm spacing)
                                            labelY = bLabelY + 120
                                          }
                                          return (
                                            <text
                                              x={l4LabelX}
                                              y={labelY}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              transform={`rotate(-90 ${l4LabelX} ${labelY})`}
                                              style={{
                                                fontSize: '80px',
                                                fontWeight: 500,
                                                fill: '#666',
                                                pointerEvents: 'none'
                                              }}
                                            >
                                              L4: {l4Value}mm
                                            </text>
                                          )
                                        })()}
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* L1-L2 chamfer dimension labels for left perpendicular rectangle (bottom-right corner for Balos, bottom-left corner for Összemarás) - ISO standard dimensioning */}
                                {hasLeftPerpendicularL1L2 && (() => {
                                  let rectX: number
                                  let rectY: number
                                  let bottomRightX: number
                                  let bottomRightY: number
                                  
                                  if (isJobbos) {
                                    // For jobbos: at top-left (0, 0)
                                    rectX = 0
                                    rectY = 0
                                    bottomRightX = leftPerpendicularRectWidth
                                    bottomRightY = leftPerpendicularRectHeight
                                  } else {
                                    // For Balos and Összemarás: at bottom-left (0, worktopLength), extends to the right
                                    // Bottom-right corner (where R1/L1-L2 are): (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    rectX = 0
                                    rectY = worktopLength
                                    bottomRightX = leftPerpendicularRectWidth
                                    bottomRightY = rectY + leftPerpendicularRectHeight
                                  }
                                  
                                  const rectWidth = leftPerpendicularRectWidth
                                  const rectHeight = leftPerpendicularRectHeight
                                  
                                  // L1 dimension: horizontal distance from right edge of perpendicular rectangle (going left)
                                  const l1DimensionLineY = bottomRightY + 100
                                  const l1LabelY = l1DimensionLineY + 60
                                  
                                  // L2 dimension: vertical distance from bottom edge of perpendicular rectangle
                                  const l2DimensionLineX = bottomRightX + 100 + (cutouts.length * 120)
                                  const l2LabelX = l2DimensionLineX + 50
                                  
                                  return (
                                    <g key="perpendicular-l1-l2-dims">
                                      {/* L1 dimension - horizontal distance from right edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={bottomRightX}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX - l1Value}
                                          y1={bottomRightY}
                                          x2={bottomRightX - l1Value}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={bottomRightX - l1Value}
                                          y1={l1DimensionLineY}
                                          x2={bottomRightX}
                                          y2={l1DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={bottomRightX - l1Value / 2}
                                          y={l1LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L1: {l1Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L2 dimension - vertical distance from bottom edge */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomRightY - l2Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={l2DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l2DimensionLineX}
                                          y1={bottomRightY - l2Value}
                                          x2={l2DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l2LabelX}
                                          y={bottomRightY - l2Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l2LabelX} ${bottomRightY - l2Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L2: {l2Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}
                                
                                {/* Edge position labels outside worktop with ISO dimension style extension lines */}
                                {(() => {
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  
                                  // Center of worktop edges (accounting for offset)
                                  const centerX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth) / 2
                                  const centerY = (startY + bottomY) / 2
                                  
                                  // Extension line offset (distance from edge to label) - proportional to maintain aspect ratio
                                  // Use a percentage of the smaller dimension to keep labels visible and maintain aspect ratio
                                  const worktopWidthForCalc = showCut ? cutPosition : worktopWidth
                                  const minDimension = Math.min(worktopWidthForCalc, bottomY - startY)
                                  const extensionOffset = minDimension * 0.15 // 15% of smaller dimension
                                  
                                  // Extension line length (how far the line extends from edge) - proportional
                                  const extensionLineLength = minDimension * 0.08 // 8% of smaller dimension
                                  
                                  // Calculate edge center points (accounting for main worktop offset for jobbos)
                                  // 1. oldal - Left edge center: (mainWorktopOffsetX, centerY)
                                  const leftEdgeX = mainWorktopOffsetX
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

                                {/* A dimension - ISO standard dimensioning for Hossztoldás and Összemarás types - ABOVE worktop */}
                                {(assemblyType === 'Hossztoldás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && aValue > 0 && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position ABOVE worktop (top edge)
                                  // Account for 2. oldal label if active (at 160mm from top)
                                  const baseOffset = edgePosition2 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const dimensionLineY = startY - extensionLineOffset
                                  const labelY = dimensionLineY - 60 // Label above dimension line
                                  
                                  let aDimensionStartX: number
                                  let aDimensionEndX: number
                                  
                                  if (isJobbos && showLeftPerpendicularRect) {
                                    // For jobbos: A dimension spans from top-left of perpendicular rectangle (0) to top-right of main worktop (leftPerpendicularRectWidth + worktopWidth = D + A)
                                    aDimensionStartX = 0 // Top-left of perpendicular rectangle
                                    aDimensionEndX = leftPerpendicularRectWidth + worktopWidth // Top-right of main worktop (D + A)
                                  } else if (isOsszemaras && showLeftPerpendicularRect && showRightPerpendicularRect) {
                                    // For Összemarás: A dimension spans just the main worktop (from 0 to A)
                                    aDimensionStartX = 0 // Left edge of main worktop
                                    aDimensionEndX = worktopWidth // Right edge of main worktop (A)
                                  } else {
                                    // For Hossztoldás and Balos: A dimension spans from left edge to right edge of main worktop
                                    aDimensionStartX = 0
                                    aDimensionEndX = worktopWidth
                                  }
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left edge and right edge */}
                                      <line
                                        x1={aDimensionStartX}
                                        y1={startY}
                                        x2={aDimensionStartX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={aDimensionEndX}
                                        y1={startY}
                                        x2={aDimensionEndX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={aDimensionStartX}
                                        y1={dimensionLineY}
                                        x2={aDimensionEndX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label above dimension line */}
                                      <text
                                        x={(aDimensionStartX + aDimensionEndX) / 2}
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
                                
                                {/* C dimension - ISO standard dimensioning for Összemarás types */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && cValue > 0 && (() => {
                                  // For Balos and Összemarás: C dimension goes from top-left of main worktop (0, startY) to bottom-left of perpendicular rectangle (0, worktopLength + leftPerpendicularRectHeight)
                                  // For jobbos: C dimension goes from top-left of perpendicular rectangle (0, 0) to bottom-left of perpendicular rectangle (0, leftPerpendicularRectHeight)
                                  // Both are VERTICAL dimensions on the LEFT side
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  
                                  let topY: number
                                  let bottomY: number
                                  let dimensionLineX: number
                                  let labelX: number
                                  
                                  let extensionLineX: number // X position of the extension lines
                                  
                                  if (isJobbos) {
                                    // For jobbos: vertical dimension from top to bottom of perpendicular rectangle
                                    topY = 0 // Top of perpendicular rectangle
                                    bottomY = leftPerpendicularRectHeight // Bottom of perpendicular rectangle
                                    extensionLineX = 0 // Left edge of perpendicular rectangle
                                  } else {
                                    // For Balos and Összemarás: vertical dimension from top-left of main worktop to bottom-left of perpendicular rectangle
                                    // Both use the same positioning: left edge at x=0
                                    topY = startY
                                    bottomY = worktopLength + leftPerpendicularRectHeight
                                    extensionLineX = 0 // Left edge
                                  }
                                  
                                  // Both use the same positioning logic: vertical dimension on the left side
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40
                                    : 0
                                  const baseOffset = edgePosition1 ? 320 : 200
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  dimensionLineX = extensionLineX - extensionLineOffset
                                  labelX = dimensionLineX - 60
                                  
                                  return (
                                    <g>
                                      {/* Vertical dimension from connection point */}
                                      <line
                                        x1={extensionLineX}
                                        y1={topY}
                                        x2={dimensionLineX}
                                        y2={topY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={extensionLineX}
                                        y1={bottomY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={dimensionLineX}
                                        y1={topY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <text
                                        x={labelX}
                                        y={(topY + bottomY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                        transform={`rotate(-90 ${labelX} ${(topY + bottomY) / 2})`}
                                      >
                                        C: {cValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* B dimension - ISO standard dimensioning for Összemarás types (vertical - main worktop height) - on right side */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && bValue > 0 && (() => {
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  // For jobbos/Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const rightEdge = mainWorktopOffsetX + worktopWidth
                                  
                                  // Calculate maximum offset needed for cutout dimension labels
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 50 + 40
                                    : 0
                                  
                                  // Position to the right, account for 3. oldal label if active
                                  const baseOffset = edgePosition3 ? 350 : 220
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineX = rightEdge + extensionLineOffset
                                  const labelX = dimensionLineX + 50 // Label to the right of dimension line
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from top and bottom of main worktop */}
                                      <line
                                        x1={rightEdge}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={startY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={rightEdge}
                                        y1={bottomY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (vertical) */}
                                      <line
                                        x1={dimensionLineX}
                                        y1={startY}
                                        x2={dimensionLineX}
                                        y2={bottomY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label to the right of dimension line */}
                                      <text
                                        x={labelX}
                                        y={(startY + bottomY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                    fontWeight: 500,
                                          fill: '#1976d2',
                                    pointerEvents: 'none'
                                  }}
                                        transform={`rotate(-90 ${labelX} ${(startY + bottomY) / 2})`}
                                      >
                                        B: {bValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* D dimension - ISO standard dimensioning for Összemarás types (horizontal - left perpendicular rectangle width) */}
                                {(assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && dValue > 0 && (() => {
                                  // For Balos and Összemarás: at bottom-left (0, worktopLength), extends to the right
                                  //   Left edge at x=0, right edge at x=leftPerpendicularRectWidth
                                  // For jobbos: at top-left (0, 0)
                                  const rectX = 0
                                  const rectY = isJobbos ? 0 : worktopLength
                                  const rectWidth = leftPerpendicularRectWidth
                                  const rectHeight = leftPerpendicularRectHeight
                                  const bottomRightX = rectWidth
                                  const bottomRightY = rectY + rectHeight
                                  
                                  // Calculate maximum offset needed for cutout dimension labels
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40
                                    : 0
                                  
                                  // Position below perpendicular rectangle, account for 4. oldal label if active
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const extensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const dimensionLineY = bottomRightY + extensionLineOffset
                                  const labelY = dimensionLineY + 60
                                
                                return (
                                    <g>
                                      {/* Extension lines - from left and right edges of perpendicular rectangle */}
                                      <line
                                        x1={rectX}
                                        y1={bottomRightY}
                                        x2={rectX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={bottomRightX}
                                        y1={bottomRightY}
                                        x2={bottomRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (horizontal) */}
                                      <line
                                        x1={rectX}
                                        y1={dimensionLineY}
                                        x2={bottomRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={bottomRightX / 2}
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
                                        D: {dValue}mm
                                      </text>
                                    </g>
                                )
                              })()}

                                {/* E dimension - ISO standard dimensioning for Összemarás (vertical - right rectangle height) - on left side */}
                                {isOsszemaras && showRightPerpendicularRect && eValue > 0 && (() => {
                                  // Main worktop is at (0, 0), no offset
                                  const topRightX = worktopWidth // Top-right corner (connection point)
                                  const topLeftX = topRightX - rightPerpendicularRectWidth
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  
                                  // Position to the left of the right rectangle
                                  const extensionLineOffset = 100
                                  const dimensionLineX = topLeftX - extensionLineOffset
                                  const labelX = dimensionLineX - 50
                                
                                return (
                                    <g>
                                      {/* Extension lines - from top and bottom of right rectangle */}
                                      <line
                                        x1={topLeftX}
                                        y1={rectY}
                                        x2={dimensionLineX}
                                        y2={rectY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={topLeftX}
                                        y1={rectY + rectHeight}
                                        x2={dimensionLineX}
                                        y2={rectY + rectHeight}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (vertical) */}
                                      <line
                                        x1={dimensionLineX}
                                        y1={rectY}
                                        x2={dimensionLineX}
                                        y2={rectY + rectHeight}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label */}
                                      <text
                                        x={labelX}
                                        y={rectY + rectHeight / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        transform={`rotate(-90 ${labelX} ${rectY + rectHeight / 2})`}
                                        style={{
                                          fontSize: '80px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        E: {eValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* F dimension - ISO standard dimensioning for Összemarás (horizontal - right rectangle width) - below right rectangle */}
                                {isOsszemaras && showRightPerpendicularRect && fValue > 0 && (() => {
                                  // Account for main worktop offset
                                  const mainWorktopOffsetX = showLeftPerpendicularRect ? leftPerpendicularRectWidth : 0
                                  const topRightX = mainWorktopOffsetX + worktopWidth // Top-right corner (connection point)
                                  const topLeftX = topRightX - rightPerpendicularRectWidth
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  
                                  // Position below the right rectangle
                                  const extensionLineOffset = 100
                                  const dimensionLineY = rectY + rectHeight + extensionLineOffset
                                  const labelY = dimensionLineY + 60
                                  
                                  return (
                                    <g>
                                      {/* Extension lines - from left and right of right rectangle */}
                                      <line
                                        x1={topLeftX}
                                        y1={rectY + rectHeight}
                                        x2={topLeftX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={topRightX}
                                        y1={rectY + rectHeight}
                                        x2={topRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line (horizontal) */}
                                      <line
                                        x1={topLeftX}
                                        y1={dimensionLineY}
                                        x2={topRightX}
                                        y2={dimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label */}
                                      <text
                                        x={(topLeftX + topRightX) / 2}
                                        y={labelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '80px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                          pointerEvents: 'none'
                                        }}
                                      >
                                        F: {fValue}mm
                                      </text>
                                    </g>
                                  )
                                })()}

                                {/* R2 label for right perpendicular rectangle (bottom-RIGHT corner) - Összemarás only */}
                                {isOsszemaras && showRightPerpendicularRect && rightPerpendicularRectR2 > 0 && (() => {
                                  // Account for main worktop offset
                                  const mainWorktopOffsetX = showLeftPerpendicularRect ? leftPerpendicularRectWidth : 0
                                  const topRightX = mainWorktopOffsetX + worktopWidth // Top-right corner (connection point)
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  const r2 = rightPerpendicularRectR2
                                  const bottomRightX = topRightX
                                  const bottomRightY = rectY + rectHeight
                                  
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (bottomRightX - r2, bottomRightY - r2)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = bottomRightX - r2 * 0.6
                                  const labelY = bottomRightY - r2 * 0.6
                                  
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
                                    R2
                                    </text>
                                )
                              })()}

                                {/* L3-L4 chamfer dimension labels for right perpendicular rectangle (bottom-RIGHT corner) - ISO standard dimensioning - Összemarás only */}
                                {hasRightPerpendicularL3L4 && (() => {
                                  // Account for main worktop offset
                                  const mainWorktopOffsetX = showLeftPerpendicularRect ? leftPerpendicularRectWidth : 0
                                  const topRightX = mainWorktopOffsetX + worktopWidth // Top-right corner (connection point)
                                  const rectY = worktopLength
                                  const rectHeight = rightPerpendicularRectHeight
                                  const bottomRightX = topRightX
                                  const bottomRightY = rectY + rectHeight
                                  
                                  // L3 dimension: horizontal distance from right edge (going left)
                                  const l3DimensionLineY = bottomRightY + 100
                                  const l3LabelY = l3DimensionLineY + 60
                                  
                                  // L4 dimension: vertical distance from bottom edge (going up)
                                  const l4DimensionLineX = bottomRightX + 100
                                  const l4LabelX = l4DimensionLineX + 50
                                  
                                  return (
                                    <g>
                                      {/* L3 dimension - horizontal */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={bottomRightX}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX - l3Value}
                                          y1={bottomRightY}
                                          x2={bottomRightX - l3Value}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={bottomRightX - l3Value}
                                          y1={l3DimensionLineY}
                                          x2={bottomRightX}
                                          y2={l3DimensionLineY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={bottomRightX - l3Value / 2}
                                          y={l3LabelY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L3: {l3Value}mm
                                        </text>
                                      </g>
                                      
                                      {/* L4 dimension - vertical */}
                                      <g>
                                        {/* Extension lines */}
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY}
                                          x2={l4DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        <line
                                          x1={bottomRightX}
                                          y1={bottomRightY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomRightY - l4Value}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Dimension line */}
                                        <line
                                          x1={l4DimensionLineX}
                                          y1={bottomRightY - l4Value}
                                          x2={l4DimensionLineX}
                                          y2={bottomRightY}
                                          stroke="#000000"
                                          strokeWidth="1.5"
                                        />
                                        {/* Label */}
                                        <text
                                          x={l4LabelX}
                                          y={bottomRightY - l4Value / 2}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          transform={`rotate(-90 ${l4LabelX} ${bottomRightY - l4Value / 2})`}
                                          style={{
                                            fontSize: '80px',
                                            fontWeight: 500,
                                            fill: '#666',
                                            pointerEvents: 'none'
                                          }}
                                        >
                                          L4: {l4Value}mm
                                        </text>
                                      </g>
                                    </g>
                                  )
                                })()}

                                {/* C dimension - ISO standard dimensioning for Hossztoldás - above A, below cutout labels */}
                                {assemblyType === 'Hossztoldás' && showJoin && cValue > 0 && (() => {
                                  // Calculate maximum offset needed for cutout dimension labels
                                  // Cutout labels are at: 100 + (index * 120) + 60 (label offset)
                                  const maxCutoutOffset = cutouts.length > 0 
                                    ? 100 + ((cutouts.length - 1) * 120) + 60 + 40 // Add extra spacing
                                    : 0
                                  
                                  // Position A dimension (furthest from worktop)
                                  const baseOffset = edgePosition4 ? 300 : 180
                                  const aExtensionLineOffset = Math.max(baseOffset, maxCutoutOffset)
                                  const aDimensionLineY = worktopLength + aExtensionLineOffset
                                  
                                  // Position C dimension above A (1 row above A dimension line), but below cutout labels
                                  const rowSpacing = 120 // Space between rows
                                  const cDimensionLineY = aDimensionLineY - rowSpacing
                                  
                                  // Make sure C is above cutout labels (cutout dimension lines start at worktopLength + 100)
                                  const minCDimensionLineY = worktopLength + 100 + 40 // Above cutout dimension lines
                                  const finalCDimensionLineY = Math.max(cDimensionLineY, minCDimensionLineY)
                                  const finalCLabelY = finalCDimensionLineY + 60
                                
                                return (
                                    <g>
                                      {/* Extension lines - from join position and right edge */}
                                      <line
                                        x1={joinPosition}
                                        y1={worktopLength}
                                        x2={joinPosition}
                                        y2={finalCDimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      <line
                                        x1={worktopWidth}
                                        y1={worktopLength}
                                        x2={worktopWidth}
                                        y2={finalCDimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Dimension line */}
                                      <line
                                        x1={joinPosition}
                                        y1={finalCDimensionLineY}
                                        x2={worktopWidth}
                                        y2={finalCDimensionLineY}
                                        stroke="#000000"
                                        strokeWidth="1.5"
                                      />
                                      {/* Label below dimension line */}
                                      <text
                                        x={(joinPosition + worktopWidth) / 2}
                                        y={finalCLabelY}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                          fontSize: '100px',
                                          fontWeight: 500,
                                          fill: '#1976d2',
                                      pointerEvents: 'none'
                                    }}
                                  >
                                        C: {cValue}mm
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
                                
                                {/* R1 label - For Összemarás Balos/jobbos/Összemarás: bottom-right corner of left perpendicular rectangle, otherwise: bottom-left corner of main worktop */}
                                {r1ValueRaw > 0 && (() => {
                                  if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos' || assemblyType === 'Összemarás U alak (Nem működik még)') && showLeftPerpendicularRect && leftPerpendicularRectR1 > 0) {
                                    // R1 label for left perpendicular rectangle
                                    // For Balos: bottom-right corner at (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    // For Összemarás: bottom-LEFT corner (connection point) at (leftPerpendicularRectWidth, worktopLength + leftPerpendicularRectHeight)
                                    // For jobbos: at top-left (0, 0), bottom-right at (leftPerpendicularRectWidth, leftPerpendicularRectHeight)
                                    const rectX = 0
                                    const rectY = isJobbos ? 0 : worktopLength
                                    const rectWidth = leftPerpendicularRectWidth
                                    const rectHeight = leftPerpendicularRectHeight
                                    const r1 = leftPerpendicularRectR1
                                    
                                    // For all types: R1 is at bottom-right corner
                                    const bottomRightX = rectWidth
                                    const bottomRightY = rectY + rectHeight
                                    
                                    // Position label inside the corner, offset from the arc center
                                    // Arc center is at (bottomRightX - r1, bottomRightY - r1)
                                    // Place label at about 60% of the radius from the corner
                                    const labelX = bottomRightX - r1 * 0.6
                                    const labelY = bottomRightY - r1 * 0.6
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
                                        R1
                                      </text>
                                    )
                                  } else if (assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos' && assemblyType !== 'Összemarás U alak (Nem működik még)' && r1Value > 0) {
                                    // R1 label for main worktop's bottom-left corner (only if not Összemarás Balos)
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
                                  }
                                  return null
                                })()}
                                
                                {/* R2 label (bottom-right corner of kept part) - positioned inside worktop close to corner */}
                                {/* For Összemarás: R2 applies to right rectangle, not main worktop */}
                                {r2Value > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)' && (() => {
                                  // For Összemarás jobbos: main worktop is offset to the right by leftPerpendicularRectWidth
                                  // For Összemarás: main worktop is offset to the right by leftPerpendicularRectWidth
                                  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 
                                                             (isOsszemaras && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
                                  const startY = showVerticalCut ? verticalCutHeight : 0
                                  const bottomY = worktopLength
                                  const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
                                  // Position label inside the corner, offset from the arc center
                                  // Arc center is at (rightEdge - r2Value, bottomY - r2Value)
                                  // Place label at about 60% of the radius from the corner
                                  const labelX = rightEdge - r2Value * 0.6
                                  const labelY = bottomY - r2Value * 0.6
                                  // Only show if label is within the kept portion
                                  if (labelY < startY || labelX > rightEdge || labelX < mainWorktopOffsetX) return null
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

