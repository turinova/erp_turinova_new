# OptiTest Page Documentation

## Overview
The OptiTest page (`/optitest`) is a comprehensive panel optimization testing interface that allows users to test the guillotine cutting optimization algorithm with multiple materials and panels. It provides a complete workflow from material selection to visualization of optimized layouts.

## Page URL
- **Local Development**: `http://localhost:3000/optitest` (or `http://localhost:3001/optitest`, `http://localhost:3002/optitest` depending on port availability)
- **File Location**: `/Volumes/T7/erp_turinova_new/starter-kit/src/app/(dashboard)/optitest/page.tsx`

## Core Functionality
1. **Material Selection**: Choose from database materials with full settings
2. **Panel Management**: Add, remove, and manage panels for optimization
3. **Multi-Material Optimization**: Optimize panels across different materials simultaneously
4. **Visualization**: Interactive board visualization with kerf lines and panel details
5. **Test Data**: Pre-built comprehensive test panels for testing

## Technical Architecture

### Dependencies
```typescript
// React Core
import React, { useState, useEffect } from 'react'

// Material-UI Components
import {
  Box, Card, CardContent, Typography, TextField, Button, Select, MenuItem,
  FormControl, InputLabel, Grid, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Alert, CircularProgress,
  Pagination, Tooltip
} from '@mui/material'

// Material-UI Styling
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'

// Type Definitions
import type { AccordionProps } from '@mui/material/Accordion'
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary'
import type { AccordionDetailsProps } from '@mui/material/AccordionDetails'
```

### Styled Components

#### Accordion Styling
```typescript
const Accordion = styled(MuiAccordion)<AccordionProps>(({ theme }) => ({
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
```

#### AccordionSummary Styling
```typescript
const AccordionSummary = styled(MuiAccordionSummary)<AccordionSummaryProps>(({ theme }) => ({
  marginBottom: -1,
  transition: 'none',
  backgroundColor: 'var(--mui-palette-customColors-greyLightBg)',
  borderBottom: '1px solid var(--mui-palette-divider) !important'
}))
```

#### AccordionDetails Styling
```typescript
const AccordionDetails = styled(MuiAccordionDetails)<AccordionDetailsProps>(({ theme }) => ({
  padding: `${theme.spacing(4)} !important`
}))
```

### Type Definitions

#### Material Interface
```typescript
interface Material {
  id: string
  name: string
  brand_name: string
  material_name: string
  width_mm: number
  length_mm: number
  thickness_mm: number
  grain_direction: boolean
  image_url?: string
  kerf_mm: number
  trim_top_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  trim_right_mm: number
  rotatable: boolean
  waste_multi: number
  created_at: string
  updated_at: string
}
```

#### Panel Interface
```typescript
interface Panel {
  id: string
  material: Material
  length: number
  width: number
  quantity: number
  marking: string
  edgeTop: string
  edgeRight: string
  edgeBottom: string
  edgeLeft: string
}
```

#### Placement Interface
```typescript
interface Placement {
  id: string
  x_mm: number
  y_mm: number
  w_mm: number
  h_mm: number
  rot_deg: number
  board_id?: number
}
```

#### MaterialOptimizationResult Interface
```typescript
interface MaterialOptimizationResult {
  material_id: string
  material_name: string
  placements: Placement[]
  unplaced: Array<{ id: string; w_mm: number; h_mm: number }>
  metrics: {
    used_area_mm2: number
    board_area_mm2: number
    waste_pct: number
    placed_count: number
    unplaced_count: number
    boards_used: number
    total_cut_length_mm: number
  }
  board_cut_lengths: { [boardId: number]: number }
  debug: {
    board_width: number
    board_height: number
    usable_width: number
    usable_height: number
    bins_count: number
    panels_count: number
  }
}
```

#### OptimizationResult Interface
```typescript
interface OptimizationResult {
  materials: MaterialOptimizationResult[]
  totalMetrics: {
    total_materials: number
    total_used_area_mm2: number
    total_board_area_mm2: number
    overall_waste_pct: number
    total_placed_count: number
    total_unplaced_count: number
  }
}
```

### State Variables

#### Core State
```typescript
const [materials, setMaterials] = useState<Material[]>([])
const [materialsLoading, setMaterialsLoading] = useState(true)
const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
const [panels, setPanels] = useState<Panel[]>([])
const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
const [isOptimizing, setIsOptimizing] = useState(false)
const [error, setError] = useState<string | null>(null)
const [orderPolicy, setOrderPolicy] = useState<'LSF' | 'LAF' | 'DH'>('LAF')
```

#### UI State
```typescript
const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(new Set())
const [currentBoardPerMaterial, setCurrentBoardPerMaterial] = useState<Map<string, number>>(new Map())
```

#### Form State
```typescript
const [panelForm, setPanelForm] = useState({
  length: '',
  width: '',
  quantity: '1',
  marking: '',
  edgeTop: 'None',
  edgeRight: 'None',
  edgeBottom: 'None',
  edgeLeft: 'None'
})
```

### Constants

#### Edge Banding Options
```typescript
const EDGE_OPTIONS = [
  'None',
  'PVC White',
  'PVC Black', 
  'PVC Oak',
  'PVC Walnut',
  'ABS White',
  'ABS Black',
  'Melamine White',
  'Melamine Black'
]
```

### API Endpoints

#### Materials API
- **Endpoint**: `/api/test-supabase`
- **Method**: GET
- **Purpose**: Fetch materials with settings from database
- **Response Format**:
```typescript
{
  success: boolean
  data: Material[]
  error?: string
}
```

#### Optimization API
- **Endpoint**: `http://localhost:8000/test_optimization.php`
- **Method**: POST
- **Purpose**: Run guillotine cutting optimization
- **Request Format**:
```typescript
{
  materials: Array<{
    id: string
    name: string
    parts: Array<{
      id: string
      w_mm: number
      h_mm: number
      qty: number
      allow_rot_90: boolean
      grain_locked: boolean
    }>
    board: {
      w_mm: number
      h_mm: number
      trim_top_mm: number
      trim_right_mm: number
      trim_bottom_mm: number
      trim_left_mm: number
    }
    params: {
      kerf_mm: number
      seed: number
      order_policy: string
    }
  }>
}
```

### Core Functions

#### Material Loading
```typescript
useEffect(() => {
  const fetchMaterials = async () => {
    try {
      setMaterialsLoading(true)
      const response = await fetch('/api/test-supabase')
      const result = await response.json()
      
      if (result.success) {
        console.log('Materials loaded:', result.data.length, 'materials')
        console.log('First material:', result.data[0])
        setMaterials(result.data)
      } else {
        console.error('Failed to fetch materials:', result.error)
        setError('Failed to load materials from database')
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
      setError('Error loading materials from database')
    } finally {
      setMaterialsLoading(false)
    }
  }

  fetchMaterials()
}, [])
```

#### Panel Management
```typescript
// Add Panel
const addPanel = () => {
  if (!selectedMaterial) {
    setError('Please select a material first')
    return
  }

  const length = parseFloat(panelForm.length)
  const width = parseFloat(panelForm.width)
  const quantity = parseInt(panelForm.quantity)

  if (!length || !width || !quantity || length <= 0 || width <= 0 || quantity <= 0) {
    setError('Please enter valid dimensions and quantity')
    return
  }

  // Validation checks...
  
  const newPanel: Panel = {
    id: `panel-${Date.now()}`,
    material: selectedMaterial,
    length,
    width,
    quantity,
    marking: panelForm.marking,
    edgeTop: panelForm.edgeTop,
    edgeRight: panelForm.edgeRight,
    edgeBottom: panelForm.edgeBottom,
    edgeLeft: panelForm.edgeLeft
  }

  setPanels([...panels, newPanel])
  // Reset form...
}

// Remove Panel
const removePanel = (id: string) => {
  setPanels(panels.filter(p => p.id !== id))
}
```

#### Optimization Function
```typescript
const optimize = async () => {
  console.log('=== MULTI-MATERIAL OPTIMIZATION STARTED ===')
  
  if (panels.length === 0) {
    setError('Please add at least one panel to optimize')
    return
  }

  setIsOptimizing(true)
  setError(null)

  try {
    // Group panels by material
    const panelsByMaterial = new Map<string, { material: Material; panels: Panel[] }>()
    
    panels.forEach(panel => {
      const materialId = panel.material.id
      if (!panelsByMaterial.has(materialId)) {
        panelsByMaterial.set(materialId, {
          material: panel.material,
          panels: []
        })
      }
      panelsByMaterial.get(materialId)!.panels.push(panel)
    })

    // Transform to optimization format
    const materials = Array.from(panelsByMaterial.values()).map(({ material, panels: materialPanels }) => {
      const allParts = materialPanels.flatMap(panel => 
        Array.from({ length: panel.quantity }, (_, i) => ({
          id: `${panel.id}-${i + 1}`,
          w_mm: panel.width,
          h_mm: panel.length,
          qty: 1,
          allow_rot_90: panel.material.rotatable,
          grain_locked: panel.material.grain_direction
        }))
      )
      
      return {
        id: material.id,
        name: material.name,
        parts: allParts,
        board: {
          w_mm: material.width_mm,
          h_mm: material.length_mm,
          trim_top_mm: material.trim_top_mm || 0,
          trim_right_mm: material.trim_right_mm || 0,
          trim_bottom_mm: material.trim_bottom_mm || 0,
          trim_left_mm: material.trim_left_mm || 0
        },
        params: {
          kerf_mm: material.kerf_mm || 3,
          seed: 123456,
          order_policy: orderPolicy
        }
      }
    })

    // Call optimization API
    const response = await fetch('http://localhost:8000/test_optimization.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ materials })
    })

    if (!response.ok) {
      throw new Error(`Optimization failed: ${response.statusText}`)
    }

    const results = await response.json()

    // Calculate total metrics
    const totalUsedArea = results.reduce((sum: number, result: any) => sum + result.metrics.used_area_mm2, 0)
    const totalBoardArea = results.reduce((sum: number, result: any) => sum + result.metrics.board_area_mm2, 0)
    const totalPlaced = results.reduce((sum: number, result: any) => sum + result.metrics.placed_count, 0)
    const totalUnplaced = results.reduce((sum: number, result: any) => sum + result.metrics.unplaced_count, 0)

    const finalResult: OptimizationResult = {
      materials: results,
      totalMetrics: {
        total_materials: results.length,
        total_used_area_mm2: totalUsedArea,
        total_board_area_mm2: totalBoardArea,
        overall_waste_pct: totalBoardArea > 0 ? ((totalBoardArea - totalUsedArea) / totalBoardArea) * 100 : 0,
        total_placed_count: totalPlaced,
        total_unplaced_count: totalUnplaced
      }
    }

    setOptimizationResult(finalResult)
  } catch (err) {
    setError(`Optimization failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  } finally {
    setIsOptimizing(false)
  }
}
```

### Test Data Function

#### Comprehensive Test Panels
```typescript
const addTestPanels = () => {
  console.log('=== ADDING COMPREHENSIVE MULTI-MATERIAL TEST PANELS (3+ BOARDS PER MATERIAL) ===')
  
  // Creates test panels for 6 different materials:
  // 1. MDF 18mm (2800x2070mm)
  // 2. Plywood 15mm (2500x1250mm)
  // 3. Chipboard 16mm (2750x1830mm)
  // 4. OSB 12mm (2500x1250mm)
  // 5. Hardboard 3mm (3050x1525mm)
  // 6. MDF 18mm No Grain (2800x2070mm)
  
  // Each material gets 4 panel types:
  // - Large panels (6-8 pieces)
  // - Medium panels (8 pieces)
  // - Small panels (12-15 pieces)
  // - Tiny panels (15-20 pieces)
  
  // Total: 261 panels across 6 materials
  // Estimated: 3+ boards per material
}
```

### UI Components

#### Layout Structure
```typescript
<Box sx={{ p: 3 }}>
  <Grid container spacing={3}>
    {/* Material Selection Card */}
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Material Selection</Typography>
          <FormControl fullWidth>
            <InputLabel>Select Material</InputLabel>
            <Select value={selectedMaterial?.id || ''} onChange={...}>
              {materials.map((material) => (
                <MenuItem key={material.id} value={material.id}>
                  {material.name} ({material.width_mm}×{material.length_mm}mm)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Material details display */}
        </CardContent>
      </Card>
    </Grid>

    {/* Panel Form Card */}
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Add Panel</Typography>
          {/* Panel form fields */}
        </CardContent>
      </Card>
    </Grid>

    {/* Actions Card */}
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Actions</Typography>
          <Button onClick={optimize} disabled={panels.length === 0 || isOptimizing}>
            {isOptimizing ? 'Optimizing...' : 'Optimize Layout'}
          </Button>
          <Button onClick={clearAll}>Clear All</Button>
        </CardContent>
      </Card>
    </Grid>

    {/* Panels Table */}
    <Grid item xs={12}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Panels to Optimize ({panels.length})</Typography>
          {/* Table with panels */}
        </CardContent>
      </Card>
    </Grid>

    {/* Optimization Results */}
    {optimizationResult && (
      <Grid item xs={12}>
        {/* Accordion visualization */}
      </Grid>
    )}
  </Grid>
</Box>
```

#### Board Visualization
```typescript
<Box sx={{ position: 'relative', margin: '0 auto', maxWidth: 700 }}>
  {/* Dimension labels */}
  <Typography variant="subtitle2" sx={{ position: 'absolute', top: -25, left: '50%', transform: 'translateX(-50%)' }}>
    {material?.width_mm}mm
  </Typography>
  
  <Typography variant="subtitle2" sx={{ position: 'absolute', top: '50%', left: -40, transform: 'translateY(-50%)', writingMode: 'vertical-rl' }}>
    {material?.length_mm}mm
  </Typography>
  
  {/* Board container with proper aspect ratio */}
  <Box sx={{
    position: 'relative',
    width: '100%',
    aspectRatio: `${material?.width_mm || 1} / ${material?.length_mm || 1}`,
    border: '2px solid #333',
    backgroundColor: '#f8f9fa'
  }}>
    {/* Panel placements */}
    {currentBoardPlacements.map((placement, index) => (
      <Box key={placement.id} sx={{
        position: 'absolute',
        left: `${(placement.x_mm / (material?.width_mm || 1)) * 100}%`,
        top: `${(placement.y_mm / (material?.length_mm || 1)) * 100}%`,
        width: `${(placement.w_mm / (material?.width_mm || 1)) * 100}%`,
        height: `${(placement.h_mm / (material?.length_mm || 1)) * 100}%`,
        backgroundColor: getPanelColor(placement.w_mm, placement.h_mm),
        border: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Panel dimensions */}
        <Box sx={{ textAlign: 'center', fontSize: '10px', fontWeight: 400, color: '#000' }}>
          {placement.w_mm}×{placement.h_mm}
        </Box>
      </Box>
    ))}
    
    {/* Kerf visualization */}
    {currentBoardPlacements.map((placement, index) => {
      const kerfSize = material?.kerf_mm || 3;
      return [
        // Top, bottom, left, right kerf lines
        <Box key={`kerf-top-${index}`} sx={{ /* kerf styling */ }} />,
        <Box key={`kerf-bottom-${index}`} sx={{ /* kerf styling */ }} />,
        <Box key={`kerf-left-${index}`} sx={{ /* kerf styling */ }} />,
        <Box key={`kerf-right-${index}`} sx={{ /* kerf styling */ }} />
      ];
    }).flat()}
  </Box>
</Box>
```

### Color System

#### Panel Colors
```typescript
const getPanelColor = (width: number, height: number) => {
  const area = width * height
  if (area >= 800000) return '#e3f2fd'      // Large panels - Light blue
  if (area >= 400000) return '#f3e5f5'      // Medium panels - Light purple
  if (area >= 200000) return '#e8f5e8'      // Small panels - Light green
  return '#fff3e0'                          // Tiny panels - Light orange
}
```

### Features

#### 1. Material Management
- **Database Integration**: Fetches materials from Supabase with full settings
- **Material Details**: Displays dimensions, thickness, grain direction, trim settings, kerf size
- **Usable Dimensions**: Calculates and displays usable area after trim
- **Settings Display**: Shows kerf, rotation, waste multiplier settings

#### 2. Panel Management
- **Form Validation**: Validates dimensions, quantity, and material constraints
- **Edge Banding**: Supports 9 different edge banding options
- **Marking System**: Text field for panel identification
- **Quantity Support**: Multiple quantities of the same panel
- **Material Constraints**: Prevents panels larger than material dimensions

#### 3. Optimization Engine
- **Multi-Material Support**: Optimizes panels across different materials
- **Guillotine Algorithm**: Uses strip-based cutting with alternating directions
- **Rotation Support**: Respects material grain direction constraints
- **Kerf Calculation**: Accounts for blade width in cutting calculations
- **Trim Handling**: Applies material-specific trim settings

#### 4. Visualization System
- **Interactive Boards**: Clickable board navigation with pagination
- **Accordion Interface**: Collapsible material sections
- **Real-time Metrics**: Live calculation of usage percentages
- **Kerf Visualization**: Red lines showing cutting patterns
- **Dimension Labels**: Board and panel dimension display
- **Color Coding**: Different colors for different panel sizes

#### 5. Test Data
- **Comprehensive Testing**: 261 test panels across 6 materials
- **Realistic Scenarios**: Multiple panel sizes and quantities
- **Multi-Board Testing**: Enough panels to fill 3+ boards per material
- **Edge Cases**: Various material constraints and settings

### Performance Optimizations

#### 1. State Management
- **Efficient Updates**: Minimal re-renders with targeted state updates
- **Memoization**: Uses React's built-in optimization
- **Lazy Loading**: Materials loaded only when needed

#### 2. API Optimization
- **Single Request**: Materials fetched once on component mount
- **Error Handling**: Comprehensive error handling and user feedback
- **Loading States**: Visual feedback during API calls

#### 3. UI Performance
- **Virtual Scrolling**: Efficient rendering of large panel lists
- **Conditional Rendering**: Only render visible components
- **Optimized Calculations**: Efficient metric calculations

### Error Handling

#### 1. Validation Errors
- **Form Validation**: Client-side validation before submission
- **Material Constraints**: Prevents invalid panel dimensions
- **Quantity Limits**: Prevents excessive quantities

#### 2. API Errors
- **Network Errors**: Handles connection failures
- **Server Errors**: Handles optimization failures
- **Data Errors**: Handles malformed responses

#### 3. User Feedback
- **Error Messages**: Clear, actionable error messages
- **Loading States**: Visual feedback during operations
- **Success Indicators**: Confirmation of successful operations

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Responsive Design**: Works on desktop and tablet devices
- **Material-UI**: Uses latest Material-UI components and styling

### Development Notes

#### 1. Console Logging
- **Debug Information**: Extensive console logging for development
- **API Tracking**: Logs all API requests and responses
- **State Changes**: Logs important state changes

#### 2. Type Safety
- **TypeScript**: Full TypeScript implementation
- **Interface Definitions**: Comprehensive type definitions
- **Type Checking**: Strict type checking enabled

#### 3. Code Organization
- **Modular Structure**: Well-organized component structure
- **Separation of Concerns**: Clear separation between UI and logic
- **Reusable Components**: Styled components for consistency

### Future Enhancements
1. **Export Functionality**: Export optimization results
2. **Save/Load**: Save and load panel configurations
3. **Advanced Settings**: More optimization parameters
4. **Performance Metrics**: Detailed performance analysis
5. **Batch Operations**: Bulk panel operations
6. **Real-time Updates**: Live optimization updates
7. **Mobile Support**: Enhanced mobile responsiveness
8. **Accessibility**: Improved accessibility features

### Troubleshooting

#### Common Issues
1. **Materials Not Loading**: Check API endpoint and database connection
2. **Optimization Fails**: Verify PHP server is running on port 8000
3. **Visualization Issues**: Check browser compatibility and console errors
4. **Performance Issues**: Reduce panel count or check browser resources

#### Debug Steps
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check network requests in browser dev tools
4. Verify database connection and data integrity
5. Check PHP server logs for optimization errors

This documentation provides a comprehensive overview of the OptiTest page, covering all aspects from technical implementation to user features and troubleshooting.
