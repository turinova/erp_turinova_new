'use client'

import React, { useMemo, useState } from 'react'
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
  Divider
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import type { AccordionProps } from '@mui/material/Accordion'
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary'
import type { AccordionDetailsProps } from '@mui/material/AccordionDetails'

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
  const [dimensionA, setDimensionA] = useState<string>('')
  const [dimensionB, setDimensionB] = useState<string>('')
  const [roundingR1, setRoundingR1] = useState<string>('')
  const [roundingR2, setRoundingR2] = useState<string>('')
  const [cutL1, setCutL1] = useState<string>('')
  const [cutL2, setCutL2] = useState<string>('')
  const [cutL3, setCutL3] = useState<string>('')
  const [cutL4, setCutL4] = useState<string>('')

  const linearMaterialOptions = useMemo(() => {
    return linearMaterials.map(lm => ({
      id: lm.id,
      label: `${lm.name} ${lm.width}*${lm.length}*${lm.thickness} ${lm.type ?? ''}`.trim()
    }))
  }, [linearMaterials])

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
                      Élzáró
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
                </Grid>

                {/* Conditional fields per összeállítás típus */}
                {assemblyType === 'Levágás' && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          Méretek (Levágás)
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="A (mm)"
                          type="number"
                          value={dimensionA}
                          onChange={(e) => setDimensionA(e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
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
                    </Grid>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Worktop Visualization Card */}
      <Box sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Munkapult vizualizáció
                </Typography>
                
                <Box
                  sx={{
                    p: 3,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    fontFamily: 'monospace',
                    maxWidth: 800,
                    margin: '0 auto'
                  }}
                >
                  <Box sx={{ position: 'relative', margin: '0 auto', maxWidth: 700 }}>
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

                        // Cut position based on A (mm) along displayed width (original length)
                        const cutPosition = parseFloat(dimensionA) || 0
                        const cutPercent = (cutPosition / materialWidth) * 100
                        const showCut = assemblyType === 'Levágás' && cutPosition > 0 && cutPosition < materialWidth

                        // Calculate rounding: R1/R2 values are in mm
                        // R1 = 100mm means: cut 100mm from bottom-left corner along bottom edge (right), 
                        // cut 100mm up along left edge, connect with 100mm radius arc
                        const r1ValueRaw = parseFloat(roundingR1) || 0
                        const r2ValueRaw = parseFloat(roundingR2) || 0
                        // Effective width for rounding on kept part (left of cut)
                        const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, materialWidth)) : materialWidth
                        // Use shorter edge until value of B (height), while respecting half of kept width
                        const bValue = parseFloat(dimensionB) || materialLength
                        const r1Value = Math.min(r1ValueRaw, keptWidth / 2, bValue)
                        const r2Value = Math.min(r2ValueRaw, keptWidth / 2, bValue)
                        
                        // Calculate chamfer values: L1/L2 for bottom-left, L3/L4 for bottom-right
                        const l1Value = parseFloat(cutL1) || 0
                        const l2Value = parseFloat(cutL2) || 0
                        const l3Value = parseFloat(cutL3) || 0
                        const l4Value = parseFloat(cutL4) || 0
                        const hasL1L2 = l1Value > 0 && l2Value > 0
                        const hasL3L4 = l3Value > 0 && l4Value > 0
                        const keptRightEdge = showCut ? cutPosition : materialWidth

                        return (
                          <>
                            {/* Top dimension label (rotated width = original length) */}
                            <Typography
                              variant="subtitle2"
                              sx={{
                                position: 'absolute',
                                top: -25,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontWeight: 500,
                                color: 'text.primary'
                              }}
                            >
                              {selectedMaterial.length}mm
                            </Typography>
                            
                            {/* Left dimension label (rotated height = original width) */}
                            <Typography
                              variant="subtitle2"
                              sx={{
                                position: 'absolute',
                                top: '50%',
                                left: -60,
                                transform: 'translateY(-50%)',
                                fontWeight: 500,
                                color: 'text.primary',
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed'
                              }}
                            >
                              {selectedMaterial.width}mm
                            </Typography>
                            
                            {/* Material rectangle (rotated 90 degrees) with rounded corners and cut overlay */}
                            <Box
                              sx={{
                                width: '100%',
                                aspectRatio: `${materialWidth} / ${materialLength}`,
                                position: 'relative',
                                overflow: 'visible',
                                fontFamily: 'monospace'
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
                                  zIndex: 1
                                }}
                                viewBox={`0 0 ${materialWidth} ${materialLength}`}
                                preserveAspectRatio="none"
                              >
                                {/* Main rectangle with rounded corners */}
                                <path
                                  d={(() => {
                                    // Effective width for rounding (kept part only)
                                    const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, materialWidth)) : materialWidth
                                    
                                    // Clamp radii to half of effective width and up to B (height)
                                    const r1 = Math.min(r1Value, effectiveWidth / 2, bValue)
                                    const r2 = Math.min(r2Value, effectiveWidth / 2, bValue)
                                    
                                    // Build path: start from top-left
                                    let path = `M 0 0`
                                    
                                    // Top edge: to top-right (or cut position if cutting)
                                    if (showCut) {
                                      path += ` L ${cutPosition} 0`
                                    } else {
                                      path += ` L ${materialWidth} 0`
                                    }
                                    
                                    // Right edge: if cutting, stop at cut position; otherwise go to bottom-right
                                    if (showCut) {
                                      // At cut position, go down the right edge
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (cutPosition, materialLength - l4Value), then diagonal to (cutPosition - l3Value, materialLength)
                                        path += ` L ${cutPosition} ${materialLength - l4Value}`
                                        path += ` L ${cutPosition - l3Value} ${materialLength}`
                                      } else {
                                        path += ` L ${cutPosition} ${materialLength - r2}`
                                        // R2 rounding at cut line (bottom-right of kept part)
                                        if (r2 > 0) {
                                          path += ` Q ${cutPosition} ${materialLength} ${cutPosition - r2} ${materialLength}`
                                        } else {
                                          path += ` L ${cutPosition} ${materialLength}`
                                        }
                                      }
                                    } else {
                                      // No cut: go to bottom-right
                                      if (hasL3L4) {
                                        // L3/L4 chamfer: go down to (materialWidth, materialLength - l4Value), then diagonal to (materialWidth - l3Value, materialLength)
                                        path += ` L ${materialWidth} ${materialLength - l4Value}`
                                        path += ` L ${materialWidth - l3Value} ${materialLength}`
                                      } else {
                                        path += ` L ${materialWidth} ${materialLength - r2}`
                                        // R2 rounding at full width
                                        if (r2 > 0) {
                                          path += ` Q ${materialWidth} ${materialLength} ${materialWidth - r2} ${materialLength}`
                                        } else {
                                          path += ` L ${materialWidth} ${materialLength}`
                                        }
                                      }
                                    }
                                    
                                    // Bottom edge: to bottom-left
                                    if (hasL1L2) {
                                      // L1/L2 chamfer: go to (l1Value, materialLength) then diagonal to (0, materialLength - l2Value)
                                      path += ` L ${l1Value} ${materialLength}`
                                      path += ` L 0 ${materialLength - l2Value}`
                                    } else {
                                      path += ` L ${r1} ${materialLength}`
                                      // R1 rounding (bottom-left)
                                      if (r1 > 0) {
                                        path += ` Q 0 ${materialLength} 0 ${materialLength - r1}`
                                      } else {
                                        path += ` L 0 ${materialLength}`
                                      }
                                    }
                                    
                                    // Left edge: back to top
                                    path += ` Z`
                                    
                                    return path
                                  })()}
                                  fill="#f0f8ff"
                                  stroke="#000"
                                  strokeWidth="1"
                                />
                              </Box>
                              
                              {/* Cut part (right side) with diagonal cross lines, only for Levágás (rotated) - OVERLAY with 5px gap */}
                              {showCut && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: `calc(${cutPercent}% + 5px)`,
                                    top: 0,
                                    width: `calc(${100 - cutPercent}% - 5px)`,
                                    height: '100%',
                                    backgroundColor: 'rgba(158, 158, 158, 0.1)',
                                    border: '1px dashed rgba(158, 158, 158, 0.3)',
                                    borderLeft: '2px solid #ff6b6b',
                                    zIndex: 2,
                                    '&::before': {
                                      content: '""',
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(158, 158, 158, 0.2) 2px, rgba(158, 158, 158, 0.2) 4px)',
                                    }
                                  }}
                                />
                              )}

                              {/* Cut position label (rotated) */}
                              {showCut && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    position: 'absolute',
                                    bottom: -20,
                                    left: `${cutPercent}%`,
                                    transform: 'translateX(-50%)',
                                    fontWeight: 500,
                                    color: '#ff6b6b'
                                  }}
                                >
                                  A: {cutPosition}mm
                                </Typography>
                              )}

                              {/* R1 label (bottom-left corner) - positioned at rounded corner arc */}
                              {r1Value > 0 && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    position: 'absolute',
                                    bottom: `${(r1Value / 2 / materialLength) * 100}%`,
                                    left: `${(r1Value / 2 / materialWidth) * 100}%`,
                                    fontWeight: 600,
                                    color: '#1976d2',
                                    fontSize: '0.75rem',
                                    zIndex: 10,
                                    pointerEvents: 'none'
                                  }}
                                >
                                  R1
                                </Typography>
                              )}

                              {/* R2 label (bottom-right corner of kept part) - positioned at rounded corner arc (same pattern as R1) */}
                              {r2Value > 0 && (() => {
                                // Calculate the right edge of the kept part
                                const keptRightEdge = showCut ? cutPosition : materialWidth
                                // Position R2 at r2Value/2 from the right edge (same pattern as R1 from left edge)
                                const r2LeftPosition = keptRightEdge - (r2Value / 2)
                                
                                return (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      position: 'absolute',
                                      bottom: `${(r2Value / 2 / materialLength) * 100}%`,
                                      left: `${(r2LeftPosition / materialWidth) * 100}%`,
                                      fontWeight: 600,
                                      color: '#1976d2',
                                      fontSize: '0.75rem',
                                      zIndex: 10,
                                      pointerEvents: 'none'
                                    }}
                                  >
                                    R2
                                  </Typography>
                                )
                              })()}
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
    </Box>
  )
}

