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
  Tooltip,
  Autocomplete
} from '@mui/material'
import { styled } from '@mui/material/styles'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import type { AccordionProps } from '@mui/material/Accordion'

// Third-party Imports
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
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


export default function OptiPage() {
  // State
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(true)
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

  // Validation states for required fields
  const [validationErrors, setValidationErrors] = useState({
    hosszúság: false,
    szélesség: false,
    darab: false,
    táblásAnyag: false
  })

  // Validation function
  const validateForm = () => {
    const errors = {
      hosszúság: !panelForm.hosszúság || parseFloat(panelForm.hosszúság) <= 0,
      szélesség: !panelForm.szélesség || parseFloat(panelForm.szélesség) <= 0,
      darab: !panelForm.darab || parseInt(panelForm.darab) <= 0,
      táblásAnyag: !selectedTáblásAnyag
    }
    
    setValidationErrors(errors)
    return !Object.values(errors).some(error => error)
  }

  // Clear validation errors when user starts typing
  const clearValidationError = (field: keyof typeof validationErrors) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: false }))
    }
  }
  
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

  // Load panels from session storage on component mount
  useEffect(() => {
    const savedPanels = sessionStorage.getItem('opti-panels')
    if (savedPanels) {
      try {
        setAddedPanels(JSON.parse(savedPanels))
      } catch (error) {
        console.error('Error loading panels from session storage:', error)
      }
    }
  }, [])

  // Save panels to session storage whenever addedPanels changes
  useEffect(() => {
    if (addedPanels.length > 0) {
      sessionStorage.setItem('opti-panels', JSON.stringify(addedPanels))
    } else {
      sessionStorage.removeItem('opti-panels')
    }
  }, [addedPanels])
  
  // Edit state
  const [editingPanel, setEditingPanel] = useState<string | null>(null)

  // Add panel to separate table
  const addPanelToTable = () => {
    // Validation
    if (!validateForm()) {
      toast.error('Kérjük, töltse ki az összes kötelező mezőt!')
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
    
    // Clear optimization results when new panels are added
    setOptimizationResult(null)

    // Show success toast
    toast.success('Panel sikeresen hozzáadva!')

    // Clear form but keep the same material selected for next entry
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
    // Keep selectedTáblásAnyag unchanged for next entry
  }

  // Delete panel from table
  const deletePanelFromTable = (id: string) => {
    setAddedPanels(prev => prev.filter(panel => panel.id !== id))
    
    // Clear optimization results when panels are removed
    setOptimizationResult(null)
    
    // Show error toast
    toast.error('Panel sikeresen törölve!')
  }

  // Edit panel - load record into form
  const editPanel = (panel: any) => {
    setEditingPanel(panel.id)
    
    // Find the material ID from the panel's táblásAnyag string
    const material = materials.find(m => 
      panel.táblásAnyag.includes(m.name) && 
      panel.táblásAnyag.includes(`${m.width_mm}×${m.length_mm}mm`)
    )
    
    if (material) {
      setSelectedTáblásAnyag(material.id)
    }
    
    // Load form data
    setPanelForm({
      hosszúság: panel.hosszúság,
      szélesség: panel.szélesség,
      darab: panel.darab,
      jelölés: panel.jelölés
    })
    
    // Parse élzárás back to A, B, C, D selections
    const élzárásParts = panel.élzárás.split(', ').filter(part => part && part !== '-')
    setSelectedA(élzárásParts[0] || '')
    setSelectedB(élzárásParts[1] || '')
    setSelectedC(élzárásParts[2] || '')
    setSelectedD(élzárásParts[3] || '')
    
    // Scroll to the top of the page
    setTimeout(() => {
      window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      })
    }, 100)
  }

  // Save edited panel
  const savePanel = () => {
    if (!editingPanel || !selectedTáblásAnyag || !panelForm.hosszúság || !panelForm.szélesség || !panelForm.darab) {
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

    // Update panel in table
    setAddedPanels(prev => prev.map(panel => 
      panel.id === editingPanel 
        ? {
            ...panel,
            táblásAnyag: materialName,
            hosszúság: panelForm.hosszúság,
            szélesség: panelForm.szélesség,
            darab: panelForm.darab,
            jelölés: panelForm.jelölés || '-',
            élzárás: élzárás || '-'
          }
        : panel
    ))
    
    // Clear optimization results when panels are modified
    setOptimizationResult(null)

    // Show success toast
    toast.success('Panel sikeresen módosítva!')

    // Clear form and exit edit mode
    setEditingPanel(null)
    setPanelForm({
      hosszúság: '',
      szélesség: '',
      darab: '',
      jelölés: ''
    })
    setSelectedTáblásAnyag('')
    setSelectedA('')
    setSelectedB('')
    setSelectedC('')
    setSelectedD('')
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingPanel(null)
    setPanelForm({
      hosszúság: '',
      szélesség: '',
      darab: '',
      jelölés: ''
    })
    // Keep the material selected when canceling edit
    setSelectedA('')
    setSelectedB('')
    setSelectedC('')
    setSelectedD('')
  }

  // Handle Enter key press
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (editingPanel) {
        savePanel()
      } else {
        addPanelToTable()
      }
      // Focus on hosszúság input after action
      setTimeout(() => {
        const hosszúságInput = document.querySelector('input[name="hosszúság"]') as HTMLInputElement
        if (hosszúságInput) {
          hosszúságInput.focus()
        }
      }, 100)
    }
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

  // Initialize board indices when optimization result changes
  useEffect(() => {
    if (optimizationResult && optimizationResult.materials.length > 0) {
      // Initialize board indices for each material
      const newBoardIndices = new Map<string, number>()
      optimizationResult.materials.forEach(material => {
        newBoardIndices.set(material.material_id, 0) // Start with first board
      })
      setCurrentBoardPerMaterial(newBoardIndices)
    }
  }, [optimizationResult])




  // Convert addedPanels to panels format for compatibility
  const convertAddedPanelsToPanels = (): Panel[] => {
    return addedPanels.map(addedPanel => {
      // Extract material name from táblásAnyag (format: "Material Name (width×lengthmm)")
      const materialMatch = addedPanel.táblásAnyag.match(/^(.+?)\s*\((\d+)×(\d+)mm\)$/)
      if (!materialMatch) {
        console.warn('Could not parse material from:', addedPanel.táblásAnyag)
        return null
      }
      
      const materialName = materialMatch[1].trim()
      const materialWidth = parseInt(materialMatch[2])
      const materialLength = parseInt(materialMatch[3])
      
      // Find the material in our materials array
      const material = materials.find(m => 
        m.name === materialName && 
        m.width_mm === materialWidth && 
        m.length_mm === materialLength
      )
      
      if (!material) {
        console.warn('Material not found in materials array:', materialName, materialWidth, materialLength)
        return null
      }
      
      return {
        id: addedPanel.id,
        material: material,
        length: parseInt(addedPanel.hosszúság),
        width: parseInt(addedPanel.szélesség),
        quantity: parseInt(addedPanel.darab),
        marking: addedPanel.jelölés,
        edgeTop: addedPanel.élzárás.includes('A') ? 'A' : 'None',
        edgeRight: addedPanel.élzárás.includes('B') ? 'B' : 'None',
        edgeBottom: addedPanel.élzárás.includes('C') ? 'C' : 'None',
        edgeLeft: addedPanel.élzárás.includes('D') ? 'D' : 'None'
      }
    }).filter(panel => panel !== null) as Panel[]
  }

  // Optimize with multiple materials using addedPanels
  const optimize = async () => {
    console.log('=== MULTI-MATERIAL OPTIMIZATION STARTED (using addedPanels) ===')
    console.log('Optimize function called!')
    console.log('Added panels count:', addedPanels.length)
    console.log('Added panels data:', addedPanels)
    console.log('Order Policy:', orderPolicy)
    
    if (addedPanels.length === 0) {
      console.log('ERROR: No panels to optimize')
      setError('Please add at least one panel to optimize')
      return
    }

    console.log('Starting multi-material optimization...')
    setIsOptimizing(true)
    setError(null)

    try {
      // Group addedPanels by material
      const panelsByMaterial = new Map<string, { material: Material; panels: any[] }>()
      
      addedPanels.forEach(addedPanel => {
        // Extract material name from táblásAnyag (format: "Material Name (width×lengthmm)")
        const materialMatch = addedPanel.táblásAnyag.match(/^(.+?)\s*\((\d+)×(\d+)mm\)$/)
        if (!materialMatch) {
          console.warn('Could not parse material from:', addedPanel.táblásAnyag)
          return
        }
        
        const materialName = materialMatch[1].trim()
        const materialWidth = parseInt(materialMatch[2])
        const materialLength = parseInt(materialMatch[3])
        
        // Find the material in our materials array
        const material = materials.find(m => 
          m.name === materialName && 
          m.width_mm === materialWidth && 
          m.length_mm === materialLength
        )
        
        if (!material) {
          console.warn('Material not found in materials array:', materialName, materialWidth, materialLength)
          return
        }
        
        const materialId = material.id
        if (!panelsByMaterial.has(materialId)) {
          panelsByMaterial.set(materialId, {
            material: material,
            panels: []
          })
        }
        
        // Convert addedPanel to panel format
        const panel = {
          id: addedPanel.id,
          material: material,
          length: parseInt(addedPanel.hosszúság),
          width: parseInt(addedPanel.szélesség),
          quantity: parseInt(addedPanel.darab),
          marking: addedPanel.jelölés,
          edgeTop: addedPanel.élzárás.includes('A') ? 'A' : 'None',
          edgeRight: addedPanel.élzárás.includes('B') ? 'B' : 'None',
          edgeBottom: addedPanel.élzárás.includes('C') ? 'C' : 'None',
          edgeLeft: addedPanel.élzárás.includes('D') ? 'D' : 'None'
        }
        
        panelsByMaterial.get(materialId)!.panels.push(panel)
      })

      console.log('=== PREPARING MATERIALS ===')
      console.log('Materials found:', panelsByMaterial.size)
      
      const materialsForOptimization = Array.from(panelsByMaterial.values()).map(({ material, panels: materialPanels }) => {
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

      console.log('Materials prepared:', materialsForOptimization.map(m => `${m.name}: ${m.parts.length} parts`))

      // Call multi-material optimization service
      const request = { materials: materialsForOptimization }
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



  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Opti - Multi-Material Panel Optimization
      </Typography>

      <Grid container spacing={3}>
        {/* Dynamic Rectangle Visualization Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Panel Előnézet
              </Typography>
              <Box
                sx={{
                  height: 200,
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {panelForm.hosszúság && panelForm.szélesség ? (
                  <Box
                    sx={{
                      position: 'relative',
                      backgroundColor: '#e0e0e0',
                      border: '2px solid #666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      maxWidth: '90%',
                      maxHeight: '90%',
                      // Calculate aspect ratio and fit within 200px height
                      width: (() => {
                        const width = parseFloat(panelForm.hosszúság) || 0
                        const height = parseFloat(panelForm.szélesség) || 0
                        if (width === 0 || height === 0) return '100px'
                        const aspectRatio = width / height
                        const maxHeight = 170
                        const maxWidth = 300
                        const calculatedWidth = maxHeight * aspectRatio
                        return calculatedWidth > maxWidth ? `${maxWidth}px` : `${calculatedWidth}px`
                      })(),
                      height: (() => {
                        const width = parseFloat(panelForm.hosszúság) || 0
                        const height = parseFloat(panelForm.szélesség) || 0
                        if (width === 0 || height === 0) return '100px'
                        const aspectRatio = height / width
                        const maxHeight = 170
                        const maxWidth = 300
                        const calculatedHeight = maxWidth * aspectRatio
                        return calculatedHeight > maxHeight ? `${maxHeight}px` : `${calculatedHeight}px`
                      })()
                    }}
                  >
                    {/* Grain direction lines - horizontal lines if material has grain direction */}
                    {(() => {
                      const selectedMaterial = materials.find(m => m.id === selectedTáblásAnyag)
                      if (selectedMaterial?.grain_direction) {
                        const lines = []
                        for (let i = 0; i < 8; i++) {
                          lines.push(
                            <Box
                              key={`grain-${i}`}
                              sx={{
                                position: 'absolute',
                                top: `${(i + 1) * 12.5}%`,
                                left: '5%',
                                right: '5%',
                                height: '1px',
                                backgroundColor: '#999',
                                opacity: 0.6
                              }}
                            />
                          )
                        }
                        return lines
                      }
                      return null
                    })()}
                    {/* Edge labels A, B, C, D with option-based colors */}
                    {(() => {
                      // Color mapping based on option values
                      const getOptionColor = (option: string) => {
                        if (!option) return '#666'
                        switch (option) {
                          case 'option1': return '#1976d2' // Blue
                          case 'option2': return '#388e3c' // Green
                          case 'option3': return '#f57c00' // Orange
                          case 'option4': return '#d32f2f' // Red
                          default: return '#666'
                        }
                      }
                      
                      return (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -20,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getOptionColor(selectedA)
                            }}
                          >
                            A
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: -20,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getOptionColor(selectedB)
                            }}
                          >
                            B
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: -20,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getOptionColor(selectedC)
                            }}
                          >
                            C
                          </Box>
                          <Box
                            sx={{
                              position: 'absolute',
                              right: -20,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: getOptionColor(selectedD)
                            }}
                          >
                            D
                          </Box>
                        </>
                      )
                    })()}
                    
                    {/* Special borders for selected edges with option-based colors */}
                    {(() => {
                      // Color mapping based on option values
                      const getOptionColor = (option: string) => {
                        if (!option) return '#666'
                        switch (option) {
                          case 'option1': return '#1976d2' // Blue
                          case 'option2': return '#388e3c' // Green
                          case 'option3': return '#f57c00' // Orange
                          case 'option4': return '#d32f2f' // Red
                          default: return '#666'
                        }
                      }
                      
                      return (
                        <>
                          {selectedA && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -3,
                                left: -3,
                                right: -3,
                                height: 3,
                                backgroundColor: getOptionColor(selectedA),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                          {selectedB && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: -3,
                                left: -3,
                                right: -3,
                                height: 3,
                                backgroundColor: getOptionColor(selectedB),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                          {selectedC && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -3,
                                left: -3,
                                bottom: -3,
                                width: 3,
                                backgroundColor: getOptionColor(selectedC),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                          {selectedD && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -3,
                                right: -3,
                                bottom: -3,
                                width: 3,
                                backgroundColor: getOptionColor(selectedD),
                                borderRadius: '2px'
                              }}
                            />
                          )}
                        </>
                      )
                    })()}
                    
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      backgroundColor: '#e0e0e0',
                      border: '2px solid #666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#666' }}>
                      X × Y
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '10px', color: '#999' }}>
                      mm
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel Information Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Megrendelő adatai
              </Typography>
              <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Üres - később lesz feltöltve
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel Adatok Card */}
        <Grid item xs={12}>
          <Card id="panel-adatok-section">
            <CardContent>
              {/* Táblás anyag Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                  Táblás anyag
                </Typography>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid item xs={12} sm={6} md={4}>
               <Autocomplete
                 fullWidth
                 size="small"
                 options={materials}
                 getOptionLabel={(option) => `${option.name} (${option.width_mm}×${option.length_mm}mm)`}
                 value={materials.find(m => m.id === selectedTáblásAnyag) || null}
                 onChange={(event, newValue) => {
                   setSelectedTáblásAnyag(newValue ? newValue.id : '')
                   clearValidationError('táblásAnyag')
                 }}
                 disabled={materialsLoading}
                 loading={materialsLoading}
                 loadingText="Anyagok betöltése..."
                 noOptionsText="Nincs találat"
                 renderInput={(params) => (
                   <TextField
                     {...params}
                     label="Táblás anyag választás:"
                     size="small"
                     error={validationErrors.táblásAnyag}
                     helperText={validationErrors.táblásAnyag ? 'Táblás anyag kiválasztása kötelező' : ''}
                     InputProps={{
                       ...params.InputProps,
                       endAdornment: (
                         <>
                           {materialsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                           {params.InputProps.endAdornment}
                         </>
                       ),
                     }}
                   />
                 )}
                 renderOption={(props, option) => (
                   <Box component="li" {...props}>
                     {option.name} ({option.width_mm}×{option.length_mm}mm)
                   </Box>
                 )}
               />
        </Grid>

                  {/* Selected Material Details */}
                  {selectedTáblásAnyag && (() => {
                    const selectedMaterial = materials.find(m => m.id === selectedTáblásAnyag)
                    if (!selectedMaterial) return null
                    
                    // Color mapping based on material type
                    const getMaterialColor = (materialName: string) => {
                      const name = materialName.toLowerCase()
                      if (name.includes('mdf')) return '#8B4513' // Brown
                      if (name.includes('plywood')) return '#DEB887' // Burlywood
                      if (name.includes('chipboard')) return '#D2691E' // Chocolate
                      if (name.includes('osb')) return '#A0522D' // Sienna
                      if (name.includes('hardboard')) return '#F5DEB3' // Wheat
                      return '#696969' // Dim gray (default)
                    }
                    
                    return (
                      <Grid item xs={12} sm={6} md={8}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          {/* Material Image */}
                          <Box
                            sx={{
                              width: 60,
                              height: 60,
                              background: selectedMaterial.image_url 
                                ? `url(${selectedMaterial.image_url})`
                                : `linear-gradient(45deg, ${getMaterialColor(selectedMaterial.name)} 25%, transparent 25%), 
                                   linear-gradient(-45deg, ${getMaterialColor(selectedMaterial.name)} 25%, transparent 25%), 
                                   linear-gradient(45deg, transparent 75%, ${getMaterialColor(selectedMaterial.name)} 75%), 
                                   linear-gradient(-45deg, transparent 75%, ${getMaterialColor(selectedMaterial.name)} 75%)`,
                              backgroundSize: selectedMaterial.image_url ? 'cover' : '20px 20px',
                              backgroundPosition: selectedMaterial.image_url ? 'center' : '0 0, 0 10px, 10px -10px, -10px 0px',
                              border: '2px solid #e0e0e0',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mr: 1,
                              overflow: 'hidden',
                              position: 'relative'
                            }}
                            title={`${selectedMaterial.name} képe`}
                          >
                            {selectedMaterial.image_url ? (
                              <img
                                src={selectedMaterial.image_url}
                                alt={selectedMaterial.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: `linear-gradient(135deg, ${getMaterialColor(selectedMaterial.name)} 0%, ${getMaterialColor(selectedMaterial.name)}dd 100%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: 'white', 
                                    textAlign: 'center', 
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                  }}
                                >
                                  {selectedMaterial.name.split(' ')[0]}
              </Typography>
                              </Box>
                            )}
                          </Box>
                          
                          <Chip
                            label={`${selectedMaterial.width_mm} × ${selectedMaterial.length_mm}mm`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={`${selectedMaterial.thickness_mm}mm vastag`}
                            color="secondary"
                            variant="outlined"
                            size="small"
                          />
                          {selectedMaterial.grain_direction && (
                            <Chip
                              label="Szálirány"
                              color="warning"
                              variant="outlined"
                              size="small"
                            />
                          )}
                        </Box>
                      </Grid>
                    )
                  })()}
                </Grid>
              </Box>
              
              {/* Méretek Section */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                  Méretek
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Hosszúság (mm)"
                    type="number"
                    required
                    name="hosszúság"
                    value={panelForm.hosszúság}
                    onChange={(e) => {
                      setPanelForm({...panelForm, hosszúság: e.target.value})
                      clearValidationError('hosszúság')
                    }}
                    onKeyPress={handleKeyPress}
                    inputProps={{ min: 0, step: 0.1 }}
                    error={validationErrors.hosszúság}
                    helperText={validationErrors.hosszúság ? 'Hosszúság megadása kötelező és nagyobb kell legyen 0-nál' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Szélesség (mm)"
                    type="number"
                    required
                    value={panelForm.szélesség}
                    onChange={(e) => {
                      setPanelForm({...panelForm, szélesség: e.target.value})
                      clearValidationError('szélesség')
                    }}
                    onKeyPress={handleKeyPress}
                    inputProps={{ min: 0, step: 0.1 }}
                    error={validationErrors.szélesség}
                    helperText={validationErrors.szélesség ? 'Szélesség megadása kötelező és nagyobb kell legyen 0-nál' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Darab"
                    type="number"
                    required
                    value={panelForm.darab}
                    onChange={(e) => {
                      setPanelForm({...panelForm, darab: e.target.value})
                      clearValidationError('darab')
                    }}
                    onKeyPress={handleKeyPress}
                    inputProps={{ min: 1, step: 1 }}
                    error={validationErrors.darab}
                    helperText={validationErrors.darab ? 'Darab megadása kötelező és nagyobb kell legyen 0-nál' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Jelölés"
                    value={panelForm.jelölés}
                    onChange={(e) => setPanelForm({...panelForm, jelölés: e.target.value})}
                    onKeyPress={handleKeyPress}
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                
                {/* Élzárás Section */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
                    Élzárás
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="dropdown-a-label">A</InputLabel>
                    <Select
                      labelId="dropdown-a-label"
                      value={selectedA}
                      onChange={(e) => setSelectedA(e.target.value)}
                      onKeyPress={handleKeyPress}
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
                  <FormControl fullWidth size="small">
                    <InputLabel id="dropdown-b-label">B</InputLabel>
                    <Select
                      labelId="dropdown-b-label"
                      value={selectedB}
                      onChange={(e) => setSelectedB(e.target.value)}
                      onKeyPress={handleKeyPress}
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
                  <FormControl fullWidth size="small">
                    <InputLabel id="dropdown-c-label">C</InputLabel>
                    <Select
                      labelId="dropdown-c-label"
                      value={selectedC}
                      onChange={(e) => setSelectedC(e.target.value)}
                      onKeyPress={handleKeyPress}
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
                  <FormControl fullWidth size="small">
                    <InputLabel id="dropdown-d-label">D</InputLabel>
                    <Select
                      labelId="dropdown-d-label"
                      value={selectedD}
                      onChange={(e) => setSelectedD(e.target.value)}
                      onKeyPress={handleKeyPress}
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
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                {editingPanel && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="large"
                    onClick={cancelEdit}
                  >
                    Mégse
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={editingPanel ? savePanel : addPanelToTable}
                  disabled={!selectedTáblásAnyag}
                >
                  {editingPanel ? 'Mentés' : 'Hozzáadás'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Added Panels Table */}
        {addedPanels.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Hozzáadott Panelek
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
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
                      <TableRow 
                        key={panel.id}
                        onClick={() => editPanel(panel)}
                        sx={{ 
                          cursor: 'pointer',
                          backgroundColor: (() => {
                            // Get all unique materials and assign colors
                            const uniqueMaterials = [...new Set(addedPanels.map(p => p.táblásAnyag))]
                            const materialIndex = uniqueMaterials.indexOf(panel.táblásAnyag)
                            const colors = [
                              'rgba(0, 123, 108, 0.05)',    // Green
                              'rgba(25, 118, 210, 0.05)',   // Blue  
                              'rgba(156, 39, 176, 0.05)',   // Purple
                              'rgba(255, 152, 0, 0.05)',    // Orange
                              'rgba(244, 67, 54, 0.05)',    // Red
                              'rgba(76, 175, 80, 0.05)',    // Light Green
                              'rgba(63, 81, 181, 0.05)',    // Indigo
                              'rgba(255, 193, 7, 0.05)'     // Yellow
                            ]
                            return colors[materialIndex % colors.length]
                          })(),
                          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                        }}
                      >
                      <TableCell>{panel.táblásAnyag}</TableCell>
                      <TableCell>{panel.hosszúság} mm</TableCell>
                      <TableCell>{panel.szélesség} mm</TableCell>
                      <TableCell>{panel.darab}</TableCell>
                      <TableCell>{panel.jelölés}</TableCell>
                      <TableCell>{panel.élzárás}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => deletePanelFromTable(panel.id)}
                          sx={{ 
                            minWidth: 'auto', 
                            px: 1, 
                            py: 0.5,
                            minHeight: 'auto',
                            fontSize: '12px'
                          }}
                        >
                          Törlés
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Optimalizálás Button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
              <Button
                variant="contained"
                color={optimizationResult && !isOptimizing ? "success" : "warning"}
                size="large"
                onClick={optimize}
                disabled={addedPanels.length === 0 || isOptimizing}
                sx={{ 
                  minWidth: 200,
                  py: 1.5,
                  px: 4
                }}
              >
                {isOptimizing ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Optimalizálás...
                  </>
                ) : (
                  'Optimalizálás'
                )}
              </Button>
            </Box>
            
            {/* Error Display */}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
        </Grid>
        )}





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
                                // Horizontal layout: left->left, top->top, width->width, height->height
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
                                  // Horizontal stacking: x->left, y->top, w->width, h->height
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
                                  // Use swapped board dimensions from optimization results
                                  left: `${(placement.x_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${((placement.y_mm - kerfSize/2) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(kerfSize / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
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
                                  // Use swapped board dimensions from optimization results
                                  left: `${(placement.x_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${((placement.y_mm + placement.h_mm - kerfSize/2) / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(placement.w_mm / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(kerfSize / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
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
                                  // Use swapped board dimensions from optimization results
                                  left: `${((placement.x_mm - kerfSize/2) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(kerfSize / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
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
                                  // Use swapped board dimensions from optimization results
                                  left: `${((placement.x_mm + placement.w_mm - kerfSize/2) / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  top: `${(placement.y_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
                                  width: `${(kerfSize / (materialResult.debug?.board_width || material?.width_mm || 1)) * 100}%`,
                                  height: `${(placement.h_mm / (materialResult.debug?.board_height || material?.length_mm || 1)) * 100}%`,
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

      {/* Toast Container */}
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Box>
  )
}
