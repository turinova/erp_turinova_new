'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Pagination,
  Tooltip
} from '@mui/material'
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import type { AccordionProps } from '@mui/material/Accordion'
import type { AccordionSummaryProps } from '@mui/material/AccordionSummary'
import type { AccordionDetailsProps } from '@mui/material/AccordionDetails'

// Styled component for Accordion component
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

// Styled component for AccordionSummary component
const AccordionSummary = styled(MuiAccordionSummary)<AccordionSummaryProps>(({ theme }) => ({
  marginBottom: -1,
  transition: 'none',
  backgroundColor: 'var(--mui-palette-customColors-greyLightBg)',
  borderBottom: '1px solid var(--mui-palette-divider) !important'
}))

// Styled component for AccordionDetails component
const AccordionDetails = styled(MuiAccordionDetails)<AccordionDetailsProps>(({ theme }) => ({
  padding: `${theme.spacing(4)} !important`
}))

// Expand icon component using remix icons
const expandIcon = (value: string, expandedAccordions: Set<string>) => (
  <i className={expandedAccordions.has(value) ? 'ri-subtract-line' : 'ri-add-line'} />
)

// Types
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

interface Placement {
  id: string
  x_mm: number
  y_mm: number
  w_mm: number
  h_mm: number
  rot_deg: number
  board_id?: number
}

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

// Materials will be fetched from database

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

export default function OptiPage() {
  // State
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [panels, setPanels] = useState<Panel[]>([])
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderPolicy, setOrderPolicy] = useState<'LSF' | 'LAF' | 'DH'>('LAF')
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(new Set())
  const [currentBoardPerMaterial, setCurrentBoardPerMaterial] = useState<Map<string, number>>(new Map())
  const [selectedTáblásAnyag, setSelectedTáblásAnyag] = useState<string>('')
  const [selectedA, setSelectedA] = useState<string>('')
  const [selectedB, setSelectedB] = useState<string>('')
  const [selectedC, setSelectedC] = useState<string>('')
  const [selectedD, setSelectedD] = useState<string>('')
  
  // Panel form state for the separate table
  const [panelForm, setPanelForm] = useState({
    hosszúság: '',
    szélesség: '',
    darab: '',
    jelölés: ''
  })
  
  // Separate panels table state
  const [addedPanels, setAddedPanels] = useState<Array<{
    id: string
    táblásAnyag: string
    hosszúság: string
    szélesség: string
    darab: string
    jelölés: string
    élzárás: string
  }>>([])

  // Add panel to separate table
  const addPanelToTable = () => {
    // Validation
    if (!selectedTáblásAnyag || !panelForm.hosszúság || !panelForm.szélesség || !panelForm.darab) {
      alert('Kérjük töltse ki az összes kötelező mezőt!')
      return
    }

    // Get material name
    const material = materials.find(m => m.id === selectedTáblásAnyag)
    const materialName = material ? `${material.name} (${material.width_mm}×${material.length_mm}mm)` : 'Ismeretlen anyag'

    // Create élzárás string from A, B, C, D selections
    const élzárás = [selectedA, selectedB, selectedC, selectedD]
      .filter(val => val && val !== '')
      .join(', ')

    // Add new panel to table
    const newPanel = {
      id: Date.now().toString(),
      táblásAnyag: materialName,
      hosszúság: panelForm.hosszúság,
      szélesség: panelForm.szélesség,
      darab: panelForm.darab,
      jelölés: panelForm.jelölés || '-',
      élzárás: élzárás || '-'
    }

    setAddedPanels(prev => [...prev, newPanel])

    // Clear form
    setPanelForm({
      hosszúság: '',
      szélesség: '',
      darab: '',
      jelölés: ''
    })
    setSelectedA('')
    setSelectedB('')
    setSelectedC('')
    setSelectedD('')
  }

  // Delete panel from table
  const deletePanelFromTable = (id: string) => {
    setAddedPanels(prev => prev.filter(panel => panel.id !== id))
  }

  // Fetch materials from database
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setMaterialsLoading(true)
        const response = await fetch('/api/test-supabase')
        const result = await response.json()
        
        if (result.success) {
          // Use the data directly from API (already properly formatted)
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

  // Initialize expanded accordions and board indices when optimization result changes
  useEffect(() => {
    if (optimizationResult && optimizationResult.materials.length > 0) {
      // Expand first material accordion by default
      const firstMaterialId = optimizationResult.materials[0].material_id
      setExpandedAccordions(new Set([firstMaterialId]))
      
      // Initialize board indices for each material
      const newBoardIndices = new Map<string, number>()
      optimizationResult.materials.forEach(material => {
        newBoardIndices.set(material.material_id, 0) // Start with first board
      })
      setCurrentBoardPerMaterial(newBoardIndices)
    }
  }, [optimizationResult])


  // Add panel for optimization (using separate form state)
  const [optimizationPanelForm, setOptimizationPanelForm] = useState({
    length: '',
    width: '',
    quantity: '1',
    marking: '',
    edgeTop: 'None',
    edgeRight: 'None',
    edgeBottom: 'None',
    edgeLeft: 'None'
  })

  const addPanel = () => {
    if (!selectedMaterial) {
      setError('Please select a material first')
      return
    }

    const length = parseFloat(optimizationPanelForm.length)
    const width = parseFloat(optimizationPanelForm.width)
    const quantity = parseInt(optimizationPanelForm.quantity)

    if (!length || !width || !quantity || length <= 0 || width <= 0 || quantity <= 0) {
      setError('Please enter valid dimensions and quantity')
      return
    }

    // Prevent extremely large panels that might cause optimization issues
    if (length > selectedMaterial.length_mm || width > selectedMaterial.width_mm) {
      setError(`Panel dimensions (${length}x${width}mm) exceed material dimensions (${selectedMaterial.width_mm}x${selectedMaterial.length_mm}mm)`)
      return
    }

    // Prevent excessive quantities
    if (quantity > 100) {
      setError('Maximum quantity per panel is 100')
      return
    }

    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      material: selectedMaterial,
      length,
      width,
      quantity,
      marking: optimizationPanelForm.marking,
      edgeTop: optimizationPanelForm.edgeTop,
      edgeRight: optimizationPanelForm.edgeRight,
      edgeBottom: optimizationPanelForm.edgeBottom,
      edgeLeft: optimizationPanelForm.edgeLeft
    }

    setPanels([...panels, newPanel])
    setOptimizationPanelForm({
      length: '',
      width: '',
      quantity: '1',
      marking: '',
      edgeTop: 'None',
      edgeRight: 'None',
      edgeBottom: 'None',
      edgeLeft: 'None'
    })
    setError(null)
  }

  // Remove panel
  const removePanel = (id: string) => {
    setPanels(panels.filter(p => p.id !== id))
  }

  // Optimize with multiple materials
  const optimize = async () => {
    console.log('=== MULTI-MATERIAL OPTIMIZATION STARTED ===')
    console.log('Optimize function called!')
    console.log('Panels count:', panels.length)
    console.log('Panels data:', panels)
    console.log('Order Policy:', orderPolicy)
    
    if (panels.length === 0) {
      console.log('ERROR: No panels to optimize')
      setError('Please add at least one panel to optimize')
      return
    }

    console.log('Starting multi-material optimization...')
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

      console.log('=== PREPARING MATERIALS ===')
      console.log('Materials found:', panelsByMaterial.size)
      
      const materials = Array.from(panelsByMaterial.values()).map(({ material, panels: materialPanels }) => {
        // Prepare all parts for this material
        const allParts = materialPanels.flatMap(panel => 
        Array.from({ length: panel.quantity }, (_, i) => ({
          id: `${panel.id}-${i + 1}`,
          w_mm: panel.width,
          h_mm: panel.length,
          qty: 1,
            allow_rot_90: panel.material.rotatable, // Use rotatable field from database
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

      console.log('Materials prepared:', materials.map(m => `${m.name}: ${m.parts.length} parts`))

      // Call multi-material optimization service
      const request = { materials }
        console.log('API Request:', JSON.stringify(request, null, 2))
        
      const response = await fetch('http://localhost:8000/test_optimization.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        })

        console.log('API Response status:', response.status, response.statusText)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.log('API Error response:', errorText)
          throw new Error(`Optimization failed: ${response.statusText}`)
        }

      const results = await response.json()
      console.log('API Response data:', JSON.stringify(results, null, 2))

      // Calculate total metrics
      const totalUsedArea = results.reduce((sum: number, result: any) => sum + result.metrics.used_area_mm2, 0)
      const totalBoardArea = results.reduce((sum: number, result: any) => sum + result.metrics.board_area_mm2, 0)
      const totalPlaced = results.reduce((sum: number, result: any) => sum + result.metrics.placed_count, 0)
      const totalUnplaced = results.reduce((sum: number, result: any) => sum + result.metrics.unplaced_count, 0)

      console.log('Total used area:', totalUsedArea, 'mm²')
      console.log('Total board area:', totalBoardArea, 'mm²')
      console.log('Total placed parts:', totalPlaced)
      console.log('Total unplaced parts:', totalUnplaced)

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

      console.log('\n=== FINAL OPTIMIZATION RESULT ===')
      console.log('Final result:', JSON.stringify(finalResult, null, 2))
      setOptimizationResult(finalResult)
    } catch (err) {
      console.error('\n=== OPTIMIZATION ERROR ===')
      console.error('Error details:', err)
      console.error('Error message:', err instanceof Error ? err.message : 'Unknown error')
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')
      setError(`Optimization failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      console.log('\n=== OPTIMIZATION COMPLETED ===')
      console.log('Setting isOptimizing to false')
      setIsOptimizing(false)
    }
  }

  // Clear all
  const clearAll = () => {
    setPanels([])
    setOptimizationResult(null)
    setError(null)
  }

  // Test with comprehensive multi-material panel data (enough for 3+ boards per material)
  const addTestPanels = () => {
    console.log('=== ADDING COMPREHENSIVE MULTI-MATERIAL TEST PANELS (3+ BOARDS PER MATERIAL) ===')
    
    // Board areas for reference:
    // MDF 18mm: 2800x2070 = 5,796,000 mm²
    // Plywood 15mm: 2500x1250 = 3,125,000 mm²  
    // Chipboard 16mm: 2750x1830 = 5,032,500 mm²
    // OSB 12mm: 2500x1250 = 3,125,000 mm²
    // Hardboard 3mm: 3050x1525 = 4,651,250 mm²
    // MDF 18mm No Grain: 2800x2070 = 5,796,000 mm²
    
    // Create comprehensive panels from all materials to fill at least 3 boards each
    const testPanels: Panel[] = [
      // MDF 18mm panels (2800x2070mm = 5,796,000 mm²) - Target: 3+ boards
      {
        id: 'panel-mdf-large-1000x800',
        material: materials[0] || { id: '1', name: 'MDF 18mm', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: true, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm', created_at: '', updated_at: '' }, // MDF 18mm
        length: 800,
        width: 1000,
        quantity: 6, // 6 panels = 4,800,000 mm² (fits ~1 board)
        marking: 'MDF Large Panel 1000x800',
        edgeTop: 'PVC White',
        edgeRight: 'PVC White',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-mdf-medium-744x615',
        material: materials[0] || { id: '1', name: 'MDF 18mm', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: true, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm', created_at: '', updated_at: '' }, // MDF 18mm
        length: 615,
        width: 744,
        quantity: 8, // 8 panels = 3,660,480 mm² (fits ~1 board)
        marking: 'MDF Medium Panel 744x615',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-mdf-small-400x300',
        material: materials[0] || { id: '1', name: 'MDF 18mm', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: true, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm', created_at: '', updated_at: '' }, // MDF 18mm
        length: 300,
        width: 400,
        quantity: 15, // 15 panels = 1,800,000 mm² (fits ~1 board)
        marking: 'MDF Small Panel 400x300',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-mdf-tiny-200x150',
        material: materials[0] || { id: '1', name: 'MDF 18mm', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: true, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm', created_at: '', updated_at: '' }, // MDF 18mm
        length: 150,
        width: 200,
        quantity: 20, // 20 panels = 600,000 mm² (fits ~1 board)
        marking: 'MDF Tiny Panel 200x150',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      
      // Plywood 15mm panels (2500x1250mm = 3,125,000 mm²) - Target: 3+ boards
      {
        id: 'panel-plywood-large-800x600',
        material: materials[1] || { id: '2', name: 'Plywood 15mm', width_mm: 2500, length_mm: 1250, thickness_mm: 15, grain_direction: true, kerf_mm: 3, trim_top_mm: 5, trim_bottom_mm: 5, trim_left_mm: 5, trim_right_mm: 5, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Plywood 15mm', created_at: '', updated_at: '' }, // Plywood 15mm
        length: 600,
        width: 800,
        quantity: 6, // 6 panels = 2,880,000 mm² (fits ~1 board)
        marking: 'Plywood Large Panel 800x600',
        edgeTop: 'PVC Oak',
        edgeRight: 'PVC Oak',
        edgeBottom: 'PVC Oak',
        edgeLeft: 'PVC Oak'
      },
      {
        id: 'panel-plywood-medium-500x400',
        material: materials[1] || { id: '2', name: 'Plywood 15mm', width_mm: 2500, length_mm: 1250, thickness_mm: 15, grain_direction: true, kerf_mm: 3, trim_top_mm: 5, trim_bottom_mm: 5, trim_left_mm: 5, trim_right_mm: 5, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Plywood 15mm', created_at: '', updated_at: '' }, // Plywood 15mm
        length: 400,
        width: 500,
        quantity: 8, // 8 panels = 1,600,000 mm² (fits ~1 board)
        marking: 'Plywood Medium Panel 500x400',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-plywood-small-300x200',
        material: materials[1] || { id: '2', name: 'Plywood 15mm', width_mm: 2500, length_mm: 1250, thickness_mm: 15, grain_direction: true, kerf_mm: 3, trim_top_mm: 5, trim_bottom_mm: 5, trim_left_mm: 5, trim_right_mm: 5, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Plywood 15mm', created_at: '', updated_at: '' }, // Plywood 15mm
        length: 200,
        width: 300,
        quantity: 12, // 12 panels = 720,000 mm² (fits ~1 board)
        marking: 'Plywood Small Panel 300x200',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-plywood-tiny-150x100',
        material: materials[1] || { id: '2', name: 'Plywood 15mm', width_mm: 2500, length_mm: 1250, thickness_mm: 15, grain_direction: true, kerf_mm: 3, trim_top_mm: 5, trim_bottom_mm: 5, trim_left_mm: 5, trim_right_mm: 5, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Plywood 15mm', created_at: '', updated_at: '' }, // Plywood 15mm
        length: 100,
        width: 150,
        quantity: 15, // 15 panels = 225,000 mm² (fits ~1 board)
        marking: 'Plywood Tiny Panel 150x100',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      
      // Chipboard 16mm panels (2750x1830mm = 5,032,500 mm²) - Target: 3+ boards
      {
        id: 'panel-chipboard-large-900x700',
        material: materials[2] || { id: '3', name: 'Chipboard 16mm', width_mm: 2750, length_mm: 1830, thickness_mm: 16, grain_direction: false, kerf_mm: 4, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'Chipboard 16mm', created_at: '', updated_at: '' }, // Chipboard 16mm
        length: 700,
        width: 900,
        quantity: 6, // 6 panels = 3,780,000 mm² (fits ~1 board)
        marking: 'Chipboard Large Panel 900x700',
        edgeTop: 'Melamine White',
        edgeRight: 'Melamine White',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-chipboard-medium-600x400',
        material: materials[2] || { id: '3', name: 'Chipboard 16mm', width_mm: 2750, length_mm: 1830, thickness_mm: 16, grain_direction: false, kerf_mm: 4, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'Chipboard 16mm', created_at: '', updated_at: '' }, // Chipboard 16mm
        length: 400,
        width: 600,
        quantity: 8, // 8 panels = 1,920,000 mm² (fits ~1 board)
        marking: 'Chipboard Medium Panel 600x400',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-chipboard-small-400x300',
        material: materials[2] || { id: '3', name: 'Chipboard 16mm', width_mm: 2750, length_mm: 1830, thickness_mm: 16, grain_direction: false, kerf_mm: 4, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'Chipboard 16mm', created_at: '', updated_at: '' }, // Chipboard 16mm
        length: 300,
        width: 400,
        quantity: 12, // 12 panels = 1,440,000 mm² (fits ~1 board)
        marking: 'Chipboard Small Panel 400x300',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-chipboard-tiny-200x150',
        material: materials[2] || { id: '3', name: 'Chipboard 16mm', width_mm: 2750, length_mm: 1830, thickness_mm: 16, grain_direction: false, kerf_mm: 4, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'Chipboard 16mm', created_at: '', updated_at: '' }, // Chipboard 16mm
        length: 150,
        width: 200,
        quantity: 18, // 18 panels = 540,000 mm² (fits ~1 board)
        marking: 'Chipboard Tiny Panel 200x150',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      
      // OSB 12mm panels (2500x1250mm = 3,125,000 mm²) - Target: 3+ boards
      {
        id: 'panel-osb-large-700x500',
        material: materials[3] || { id: '4', name: 'OSB 12mm', width_mm: 2500, length_mm: 1250, thickness_mm: 12, grain_direction: false, kerf_mm: 5, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'OSB 12mm', created_at: '', updated_at: '' }, // OSB 12mm
        length: 500,
        width: 700,
        quantity: 6, // 6 panels = 2,100,000 mm² (fits ~1 board)
        marking: 'OSB Large Panel 700x500',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-osb-medium-500x350',
        material: materials[3] || { id: '4', name: 'OSB 12mm', width_mm: 2500, length_mm: 1250, thickness_mm: 12, grain_direction: false, kerf_mm: 5, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'OSB 12mm', created_at: '', updated_at: '' }, // OSB 12mm
        length: 350,
        width: 500,
        quantity: 8, // 8 panels = 1,400,000 mm² (fits ~1 board)
        marking: 'OSB Medium Panel 500x350',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-osb-small-300x200',
        material: materials[3] || { id: '4', name: 'OSB 12mm', width_mm: 2500, length_mm: 1250, thickness_mm: 12, grain_direction: false, kerf_mm: 5, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'OSB 12mm', created_at: '', updated_at: '' }, // OSB 12mm
        length: 200,
        width: 300,
        quantity: 12, // 12 panels = 720,000 mm² (fits ~1 board)
        marking: 'OSB Small Panel 300x200',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-osb-tiny-150x100',
        material: materials[3] || { id: '4', name: 'OSB 12mm', width_mm: 2500, length_mm: 1250, thickness_mm: 12, grain_direction: false, kerf_mm: 5, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: false, waste_multi: 1.0, brand_name: 'Test', material_name: 'OSB 12mm', created_at: '', updated_at: '' }, // OSB 12mm
        length: 100,
        width: 150,
        quantity: 15, // 15 panels = 225,000 mm² (fits ~1 board)
        marking: 'OSB Tiny Panel 150x100',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      
      // Hardboard 3mm panels (3050x1525mm = 4,651,250 mm²) - Target: 3+ boards
      {
        id: 'panel-hardboard-large-1200x800',
        material: materials[4] || { id: '5', name: 'Hardboard 3mm', width_mm: 3050, length_mm: 1525, thickness_mm: 3, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Hardboard 3mm', created_at: '', updated_at: '' }, // Hardboard 3mm
        length: 800,
        width: 1200,
        quantity: 4, // 4 panels = 3,840,000 mm² (fits ~1 board)
        marking: 'Hardboard Large Panel 1200x800',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-hardboard-medium-600x400',
        material: materials[4] || { id: '5', name: 'Hardboard 3mm', width_mm: 3050, length_mm: 1525, thickness_mm: 3, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Hardboard 3mm', created_at: '', updated_at: '' }, // Hardboard 3mm
        length: 400,
        width: 600,
        quantity: 8, // 8 panels = 1,920,000 mm² (fits ~1 board)
        marking: 'Hardboard Medium Panel 600x400',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-hardboard-small-300x200',
        material: materials[4] || { id: '5', name: 'Hardboard 3mm', width_mm: 3050, length_mm: 1525, thickness_mm: 3, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Hardboard 3mm', created_at: '', updated_at: '' }, // Hardboard 3mm
        length: 200,
        width: 300,
        quantity: 12, // 12 panels = 720,000 mm² (fits ~1 board)
        marking: 'Hardboard Small Panel 300x200',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-hardboard-tiny-150x100',
        material: materials[4] || { id: '5', name: 'Hardboard 3mm', width_mm: 3050, length_mm: 1525, thickness_mm: 3, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'Hardboard 3mm', created_at: '', updated_at: '' }, // Hardboard 3mm
        length: 100,
        width: 150,
        quantity: 16, // 16 panels = 240,000 mm² (fits ~1 board)
        marking: 'Hardboard Tiny Panel 150x100',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      
      // MDF 18mm No Grain panels (2800x2070mm = 5,796,000 mm²) - Target: 3+ boards
      {
        id: 'panel-mdf-nograin-large-800x600',
        material: materials[5] || { id: '6', name: 'MDF 18mm No Grain', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm No Grain', created_at: '', updated_at: '' }, // MDF 18mm No Grain
        length: 600,
        width: 800,
        quantity: 6, // 6 panels = 2,880,000 mm² (fits ~1 board)
        marking: 'MDF No Grain Large Panel 800x600',
        edgeTop: 'ABS Black',
        edgeRight: 'ABS Black',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-mdf-nograin-medium-500x400',
        material: materials[5] || { id: '6', name: 'MDF 18mm No Grain', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm No Grain', created_at: '', updated_at: '' }, // MDF 18mm No Grain
        length: 400,
        width: 500,
        quantity: 8, // 8 panels = 1,600,000 mm² (fits ~1 board)
        marking: 'MDF No Grain Medium Panel 500x400',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-mdf-nograin-small-300x200',
        material: materials[5] || { id: '6', name: 'MDF 18mm No Grain', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm No Grain', created_at: '', updated_at: '' }, // MDF 18mm No Grain
        length: 200,
        width: 300,
        quantity: 12, // 12 panels = 720,000 mm² (fits ~1 board)
        marking: 'MDF No Grain Small Panel 300x200',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      },
      {
        id: 'panel-mdf-nograin-tiny-150x100',
        material: materials[5] || { id: '6', name: 'MDF 18mm No Grain', width_mm: 2800, length_mm: 2070, thickness_mm: 18, grain_direction: false, kerf_mm: 3, trim_top_mm: 0, trim_bottom_mm: 0, trim_left_mm: 0, trim_right_mm: 0, rotatable: true, waste_multi: 1.0, brand_name: 'Test', material_name: 'MDF 18mm No Grain', created_at: '', updated_at: '' }, // MDF 18mm No Grain
        length: 100,
        width: 150,
        quantity: 20, // 20 panels = 300,000 mm² (fits ~1 board)
        marking: 'MDF No Grain Tiny Panel 150x100',
        edgeTop: 'None',
        edgeRight: 'None',
        edgeBottom: 'None',
        edgeLeft: 'None'
      }
    ]

    console.log('Comprehensive multi-material test panels created:', testPanels.length, 'panel types')
    console.log('Materials used:', [...new Set(testPanels.map(p => p.material.name))])
    console.log('Total panels to optimize:', testPanels.reduce((sum, panel) => sum + panel.quantity, 0))
    
    // Calculate total area per material
    const materialAreas = new Map<string, number>()
    testPanels.forEach(panel => {
      const materialName = panel.material.name
      const panelArea = panel.width * panel.length * panel.quantity
      materialAreas.set(materialName, (materialAreas.get(materialName) || 0) + panelArea)
    })
    
    console.log('Total area per material:')
    materialAreas.forEach((area, material) => {
      const materialData = materials.find(m => m.name === material)
      const boardArea = materialData ? materialData.width_mm * materialData.length_mm : 0
      const estimatedBoards = Math.ceil(area / boardArea)
      console.log(`  ${material}: ${(area / 1000000).toFixed(1)}M mm² (estimated ${estimatedBoards}+ boards)`)
    })
    
    console.log('Panel size distribution:')
    testPanels.forEach(panel => {
      console.log(`  ${panel.marking}: ${panel.quantity} panels (${panel.width}x${panel.length}mm)`)
    })
    
    setPanels(testPanels)
    setError(null)
    console.log('Comprehensive multi-material test panels added successfully')
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Opti - Multi-Material Panel Optimization
      </Typography>

      <Grid container spacing={3}>
        {/* Panel Adatok Card with Táblás anyag */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Panel Adatok
              </Typography>
              
              <Grid container spacing={2}>
                {/* Táblás anyag Selection */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="táblás-anyag-label">Táblás anyag választás:</InputLabel>
                    <Select
                      labelId="táblás-anyag-label"
                      value={selectedTáblásAnyag}
                      onChange={(e) => setSelectedTáblásAnyag(e.target.value)}
                      disabled={materialsLoading}
                      label="Táblás anyag választás:"
                    >
                      {materialsLoading ? (
                        <MenuItem disabled>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Loading materials...
                        </MenuItem>
                      ) : (
                        materials.map((material) => (
                          <MenuItem key={material.id} value={material.id}>
                            {material.name} ({material.width_mm}×{material.length_mm}mm)
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Hosszúság (mm)"
                    type="number"
                    required
                    value={panelForm.hosszúság}
                    onChange={(e) => setPanelForm({...panelForm, hosszúság: e.target.value})}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Szélesség (mm)"
                    type="number"
                    required
                    value={panelForm.szélesség}
                    onChange={(e) => setPanelForm({...panelForm, szélesség: e.target.value})}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Darab"
                    type="number"
                    required
                    value={panelForm.darab}
                    onChange={(e) => setPanelForm({...panelForm, darab: e.target.value})}
                    inputProps={{ min: 1, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Jelölés"
                    value={panelForm.jelölés}
                    onChange={(e) => setPanelForm({...panelForm, jelölés: e.target.value})}
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="dropdown-a-label">A</InputLabel>
                    <Select
                      labelId="dropdown-a-label"
                      value={selectedA}
                      onChange={(e) => setSelectedA(e.target.value)}
                      label="A"
                    >
                      <MenuItem value="option1">Option 1</MenuItem>
                      <MenuItem value="option2">Option 2</MenuItem>
                      <MenuItem value="option3">Option 3</MenuItem>
                      <MenuItem value="option4">Option 4</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="dropdown-b-label">B</InputLabel>
                    <Select
                      labelId="dropdown-b-label"
                      value={selectedB}
                      onChange={(e) => setSelectedB(e.target.value)}
                      label="B"
                    >
                      <MenuItem value="option1">Option 1</MenuItem>
                      <MenuItem value="option2">Option 2</MenuItem>
                      <MenuItem value="option3">Option 3</MenuItem>
                      <MenuItem value="option4">Option 4</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="dropdown-c-label">C</InputLabel>
                    <Select
                      labelId="dropdown-c-label"
                      value={selectedC}
                      onChange={(e) => setSelectedC(e.target.value)}
                      label="C"
                    >
                      <MenuItem value="option1">Option 1</MenuItem>
                      <MenuItem value="option2">Option 2</MenuItem>
                      <MenuItem value="option3">Option 3</MenuItem>
                      <MenuItem value="option4">Option 4</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel id="dropdown-d-label">D</InputLabel>
                    <Select
                      labelId="dropdown-d-label"
                      value={selectedD}
                      onChange={(e) => setSelectedD(e.target.value)}
                      label="D"
                    >
                      <MenuItem value="option1">Option 1</MenuItem>
                      <MenuItem value="option2">Option 2</MenuItem>
                      <MenuItem value="option3">Option 3</MenuItem>
                      <MenuItem value="option4">Option 4</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={addPanelToTable}
                  disabled={!selectedTáblásAnyag}
                >
                  Hozzáadás
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Added Panels Table - Separate Card */}
        {addedPanels.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Hozzáadott Panelek
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Táblás anyag</strong></TableCell>
                        <TableCell><strong>Hosszúság</strong></TableCell>
                        <TableCell><strong>Szélesség</strong></TableCell>
                        <TableCell><strong>Darab</strong></TableCell>
                        <TableCell><strong>Jelölés</strong></TableCell>
                        <TableCell><strong>Élzárás</strong></TableCell>
                        <TableCell><strong>Műveletek</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {addedPanels.map((panel) => (
                        <TableRow key={panel.id}>
                          <TableCell>{panel.táblásAnyag}</TableCell>
                          <TableCell>{panel.hosszúság} mm</TableCell>
                          <TableCell>{panel.szélesség} mm</TableCell>
                          <TableCell>{panel.darab}</TableCell>
                          <TableCell>{panel.jelölés}</TableCell>
                          <TableCell>{panel.élzárás}</TableCell>
                          <TableCell>
                            <Button
                              variant="contained"
                              color="error"
                              size="small"
                              onClick={() => deletePanelFromTable(panel.id)}
                              sx={{ minWidth: 'auto', px: 1 }}
                            >
                              ✕
                            </Button>
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

        {/* Material Selection */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Material Selection
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Material</InputLabel>
                <Select
                  value={selectedMaterial?.id || ''}
                  onChange={(e) => {
                    const material = materials.find(m => m.id === e.target.value)
                    setSelectedMaterial(material || null)
                    setOptimizationResult(null)
                  }}
                  disabled={materialsLoading}
                >
                  {materialsLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Loading materials...
                    </MenuItem>
                  ) : (
                    materials.map((material) => {
                      console.log('Rendering material:', material.name, material.width_mm, material.length_mm)
                      return (
                    <MenuItem key={material.id} value={material.id}>
                      {material.name} ({material.width_mm}×{material.length_mm}mm)
                    </MenuItem>
                      )
                    })
                  )}
                </Select>
              </FormControl>


              {selectedMaterial && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Dimensions:</strong> {selectedMaterial.width_mm} × {selectedMaterial.length_mm}mm<br/>
                    <strong>Thickness:</strong> {selectedMaterial.thickness_mm}mm<br/>
                    <strong>Grain Direction:</strong> {selectedMaterial.grain_direction ? 'Yes' : 'No'}
                  </Typography>
                </Box>
              )}

              {/* Material Settings Display */}
              {selectedMaterial && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Material Settings
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Trim Settings:</strong><br/>
                      Top: {selectedMaterial.trim_top_mm}mm | Bottom: {selectedMaterial.trim_bottom_mm}mm<br/>
                      Left: {selectedMaterial.trim_left_mm}mm | Right: {selectedMaterial.trim_right_mm}mm
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Kerf Size:</strong> {selectedMaterial.kerf_mm}mm<br/>
                      <strong>Rotation Allowed:</strong> {selectedMaterial.rotatable ? 'Yes' : 'No'}<br/>
                      <strong>Waste Multiplier:</strong> {selectedMaterial.waste_multi}x
                    </Typography>
                  </Box>
                  
                  {/* Show usable dimensions */}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Usable Dimensions:</strong> {
                        (selectedMaterial.width_mm - selectedMaterial.trim_left_mm - selectedMaterial.trim_right_mm)
                      } × {
                        (selectedMaterial.length_mm - selectedMaterial.trim_top_mm - selectedMaterial.trim_bottom_mm)
                      }mm
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Kerf:</strong> {selectedMaterial.kerf_mm}mm between panels
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Panel Form */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Add Panel
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Length (mm)"
                    type="number"
                    value={optimizationPanelForm.length}
                    onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, length: e.target.value})}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Width (mm)"
                    type="number"
                    value={optimizationPanelForm.width}
                    onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, width: e.target.value})}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Quantity"
                    type="number"
                    value={optimizationPanelForm.quantity}
                    onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, quantity: e.target.value})}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Marking"
                    value={optimizationPanelForm.marking}
                    onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, marking: e.target.value})}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Edge Banding:
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Top</InputLabel>
                    <Select
                      value={optimizationPanelForm.edgeTop}
                      onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, edgeTop: e.target.value})}
                    >
                      {EDGE_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Right</InputLabel>
                    <Select
                      value={optimizationPanelForm.edgeRight}
                      onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, edgeRight: e.target.value})}
                    >
                      {EDGE_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Bottom</InputLabel>
                    <Select
                      value={optimizationPanelForm.edgeBottom}
                      onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, edgeBottom: e.target.value})}
                    >
                      {EDGE_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Left</InputLabel>
                    <Select
                      value={optimizationPanelForm.edgeLeft}
                      onChange={(e) => setOptimizationPanelForm({...optimizationPanelForm, edgeLeft: e.target.value})}
                    >
                      {EDGE_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Button
                fullWidth
                variant="contained"
                onClick={addPanel}
                sx={{ mt: 2 }}
                disabled={!selectedMaterial}
              >
                Add Panel
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={addTestPanels}
                sx={{ mt: 1 }}
              >
                Add Multi-Material Test Panels
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>

              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={optimize}
                disabled={panels.length === 0 || isOptimizing}
                sx={{ mb: 2 }}
              >
                {isOptimizing ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Optimizing...
                  </>
                ) : (
                  'Optimize Layout'
                )}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={clearAll}
                disabled={panels.length === 0}
              >
                Clear All
              </Button>

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Panels List */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Panels to Optimize ({panels.length})
              </Typography>

              {panels.length === 0 ? (
                <Typography color="text.secondary">
                  No panels added yet. Select a material and add panels to get started.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Material</TableCell>
                        <TableCell>Dimensions</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Marking</TableCell>
                        <TableCell>Edge Banding</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {panels.map((panel) => (
                        <TableRow key={panel.id}>
                          <TableCell>{panel.material.name}</TableCell>
                          <TableCell>{panel.length} × {panel.width}mm</TableCell>
                          <TableCell>{panel.quantity}</TableCell>
                          <TableCell>{panel.marking || '-'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {[panel.edgeTop, panel.edgeRight, panel.edgeBottom, panel.edgeLeft]
                                .filter(edge => edge !== 'None')
                                .map((edge, i) => (
                                  <Chip key={i} label={edge} size="small" />
                                ))}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removePanel(panel.id)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Multi-Material Visualization */}
        {optimizationResult && (
          <Grid item xs={12}>
            {optimizationResult.materials.map((materialResult) => {
              const isExpanded = expandedAccordions.has(materialResult.material_id)
              const material = materials.find(m => m.id === materialResult.material_id)
              const currentBoardIndex = currentBoardPerMaterial.get(materialResult.material_id) || 0
              
              // Group placements by board_id
              const placementsByBoard = new Map<number, Placement[]>()
              materialResult.placements.forEach(placement => {
                const boardId = placement.board_id || 1
                if (!placementsByBoard.has(boardId)) {
                  placementsByBoard.set(boardId, [])
                }
                placementsByBoard.get(boardId)!.push(placement)
              })
              
              const boardIds = Array.from(placementsByBoard.keys()).sort((a, b) => a - b)
              const currentBoardId = boardIds[currentBoardIndex] || 1
              const currentBoardPlacements = placementsByBoard.get(currentBoardId) || []
              
              return (
                <Accordion 
                  key={materialResult.material_id}
                  expanded={isExpanded}
                  onChange={(event, expanded) => {
                    const newExpanded = new Set(expandedAccordions)
                    if (expanded) {
                      newExpanded.add(materialResult.material_id)
                    } else {
                      newExpanded.delete(materialResult.material_id)
                    }
                    setExpandedAccordions(newExpanded)
                  }}
                >
                  <AccordionSummary
                    expandIcon={expandIcon(materialResult.material_id, expandedAccordions)}
                    aria-controls={`material-${materialResult.material_id}-content`}
                    id={`material-${materialResult.material_id}-header`}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography variant="h6" component="div">
                        {materialResult.material_name}
                          </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                          label={`${materialResult.metrics.placed_count} placed`} 
                          size="small" 
                          color="success" 
                          variant="outlined"
                        />
                        <Chip 
                          label={`${material?.length_mm}×${material?.width_mm}mm`} 
                          size="small" 
                          color="info" 
                          variant="outlined"
                        />
                        <Chip 
                          label={material?.grain_direction ? "Grain Direction" : "No Grain"} 
                          size="small" 
                          color={material?.grain_direction ? "warning" : "default"} 
                          variant="outlined"
                        />
                        {materialResult.metrics.unplaced_count > 0 && (
                          <Chip 
                            label={`${materialResult.metrics.unplaced_count} unplaced`} 
                            size="small" 
                              color="error"
                            variant="outlined"
                          />
                        )}
                        <Chip 
                          label={`${materialResult.metrics.boards_used} boards`} 
                              size="small"
                          color="primary" 
                          variant="outlined"
                        />
                        {/* Board usage breakdown */}
                        {boardIds.length > 1 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {boardIds.map((boardId) => {
                              const boardPlacements = placementsByBoard.get(boardId) || []
                              const boardUsedArea = boardPlacements.reduce((sum, placement) => sum + (placement.w_mm * placement.h_mm), 0)
                              const boardArea = (materialResult.debug?.board_width || material?.width_mm || 1) * (materialResult.debug?.board_height || material?.length_mm || 1)
                              const boardUsage = (boardUsedArea / boardArea) * 100
                              return (
                                <Tooltip key={boardId} title="Tábla kihasználtsága" arrow>
                                  <Chip
                                    label={`${boardUsage.toFixed(0)}%`}
                                    size="medium"
                                    variant="outlined"
                                    sx={{ fontSize: '14px', height: '28px', fontWeight: 'bold' }}
                                  />
                                </Tooltip>
                              )
                            })}
                        </Box>
                      )}
                        
                        {/* Cut length information */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                            Cut length:
                    </Typography>
                          {boardIds.map((boardId) => {
                            const boardCutLength = materialResult.board_cut_lengths[boardId] || 0
                            return (
                              <Tooltip key={boardId} title={`Board ${boardId} cut length`} arrow>
                                <Chip
                                  label={`B${boardId}: ${(boardCutLength / 1000).toFixed(1)}m`}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  sx={{ fontSize: '10px', height: '20px' }}
                                />
                              </Tooltip>
                            )
                          })}
                          <Tooltip title="Total cut length for this material" arrow>
                            <Chip
                              label={`Total: ${(materialResult.metrics.total_cut_length_mm / 1000).toFixed(1)}m`}
                              size="small"
                              variant="filled"
                              color="secondary"
                              sx={{ fontSize: '10px', height: '20px', fontWeight: 'bold' }}
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {/* Board Display for this material */}
                    {currentBoardPlacements.length > 0 && (
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
                        
                        {/* Board visualization container with dimension labels */}
                        <Box sx={{ position: 'relative', margin: '0 auto', maxWidth: 700 }}>
                          {/* Top dimension label (width) */}
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
                            {materialResult.debug?.board_width || material?.width_mm}mm
                          </Typography>
                          
                          {/* Left dimension label (height) */}
                          <Typography
                            variant="subtitle2"
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: -40,
                              transform: 'translateY(-50%)',
                              fontWeight: 500,
                              color: 'text.primary',
                              writingMode: 'vertical-rl',
                              textOrientation: 'mixed'
                            }}
                          >
                            {materialResult.debug?.board_height || material?.length_mm}mm
                            </Typography>
                            
                             {/* Board visualization container - Blueprint style with proper aspect ratio */}
                             <Box
                               sx={{
                                 width: '100%',
                              aspectRatio: `${materialResult.debug?.board_width || material?.width_mm || 1} / ${materialResult.debug?.board_height || material?.length_mm || 1}`,
                              border: '1px solid #000',
                                 backgroundColor: '#f0f8ff', // Light blue blueprint background
                                 position: 'relative',
                                 overflow: 'hidden',
                              fontFamily: 'monospace'
                            }}
                          >
                          
                          {/* Trim margins visualization - only show if any trim > 0 */}
                          {((material?.trim_top_mm ?? 0) > 0 || 
                            (material?.trim_bottom_mm ?? 0) > 0 || 
                            (material?.trim_left_mm ?? 0) > 0 || 
                            (material?.trim_right_mm ?? 0) > 0) && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                left: `${((material?.trim_left_mm || 0) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                top: `${((material?.trim_top_mm || 0) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                width: `${((materialResult.debug?.board_width || material?.width_mm || 1) - (material?.trim_left_mm || 0) - (material?.trim_right_mm || 0)) / (materialResult.debug?.board_width || material?.width_mm || 1) * 100}%`,
                                height: `${((materialResult.debug?.board_height || material?.length_mm || 1) - (material?.trim_top_mm || 0) - (material?.trim_bottom_mm || 0)) / (materialResult.debug?.board_height || material?.length_mm || 1) * 100}%`,
                                  border: '2px dashed #0066cc',
                                  backgroundColor: 'rgba(0,102,204,0.05)'
                                }}
                              />
                          )}
                              
                              {/* Placed panels - Blueprint style */}
                          {currentBoardPlacements.map((placement, index) => {
                            // Notion-inspired color palette for different panel sizes
                            const getPanelColor = (w: number, h: number) => {
                              const area = w * h;
                              if (area >= 1000000) return '#f1f3f4'; // Light grey for large panels
                              if (area >= 500000) return '#e8f0fe'; // Light blue for medium-large panels
                              if (area >= 250000) return '#e6f4ea'; // Light green for medium panels
                              if (area >= 100000) return '#fef7e0'; // Light yellow for small-medium panels
                              return '#fce7f3'; // Light pink for small panels
                            };
                                
                                return (
                                  <Box
                                    key={placement.id}
                                    sx={{
                                      position: 'absolute',
                                  left: `${(placement.x_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: getPanelColor(placement.w_mm, placement.h_mm),
                                  border: '1px solid #000',
                                      display: 'flex',
                                      alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {/* Width label on top edge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                      fontSize: '10px',
                                    fontFamily: [
                                      'Inter',
                                      'sans-serif',
                                      '-apple-system',
                                      'BlinkMacSystemFont',
                                      '"Segoe UI"',
                                      'Roboto',
                                      '"Helvetica Neue"',
                                      'Arial',
                                      'sans-serif'
                                    ].join(','),
                                    fontWeight: 400,
                                    color: '#000'
                                  }}
                                >
                                  {placement.w_mm}
                                      </Box>
                                
                                {/* Height label on left edge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: 0,
                                    transform: 'translateY(-50%)',
                                    fontSize: '10px',
                                    fontFamily: [
                                      'Inter',
                                      'sans-serif',
                                      '-apple-system',
                                      'BlinkMacSystemFont',
                                      '"Segoe UI"',
                                      'Roboto',
                                      '"Helvetica Neue"',
                                      'Arial',
                                      'sans-serif'
                                    ].join(','),
                                    fontWeight: 400,
                                    color: '#000',
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed'
                                  }}
                                >
                                  {placement.h_mm}
                                    </Box>
                                  </Box>
                                )
                              })}
                              
                          {/* Kerf visualization - red outline around every panel (cutting pattern) */}
                          {currentBoardPlacements.map((placement, index) => {
                            const kerfSize = material?.kerf_mm || 3;
                            const kerfLines = [];
                            
                            // Every panel needs to be cut out, so show kerf around the entire perimeter
                            // Top edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-top-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${(placement.x_mm / (material?.width_mm || 1)) * 100}%`,
                                  top: `${((placement.y_mm - kerfSize/2) / (material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (material?.width_mm || 1)) * 100}%`,
                                  height: `${(kerfSize / (material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            // Bottom edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-bottom-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${(placement.x_mm / (material?.width_mm || 1)) * 100}%`,
                                  top: `${((placement.y_mm + placement.h_mm - kerfSize/2) / (material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (material?.width_mm || 1)) * 100}%`,
                                  height: `${(kerfSize / (material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            // Left edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-left-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${((placement.x_mm - kerfSize/2) / (material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (material?.length_mm || 1)) * 100}%`,
                                  width: `${(kerfSize / (material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            // Right edge kerf
                            kerfLines.push(
                              <Box
                                key={`kerf-right-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: `${((placement.x_mm + placement.w_mm - kerfSize/2) / (material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (material?.length_mm || 1)) * 100}%`,
                                  width: `${(kerfSize / (material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (material?.length_mm || 1)) * 100}%`,
                                  backgroundColor: '#ff6b6b',
                                  opacity: 0.7,
                                  zIndex: 10
                                }}
                              />
                            );
                            
                            return kerfLines;
                          }).flat()}
                          
                          
                              </Box>
                            </Box>
                          </Box>
                    )}
                    
                    {/* Board Pagination Controls */}
                    {boardIds.length > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination
                          count={boardIds.length}
                          page={currentBoardIndex + 1}
                          onChange={(event, page) => {
                            const newBoardIndices = new Map(currentBoardPerMaterial)
                            newBoardIndices.set(materialResult.material_id, page - 1)
                            setCurrentBoardPerMaterial(newBoardIndices)
                          }}
                          color="primary"
                          size="large"
                        />
                        </Box>
                    )}
                    
                    {/* Show message if no panels placed */}
                    {materialResult.placements.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">
                          No panels could be placed on this material
                        </Typography>
                    </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              )
            })}
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
