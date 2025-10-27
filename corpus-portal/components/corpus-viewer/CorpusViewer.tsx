/**
 * 3D Corpus Viewer Component - Interactive Panel Builder
 * 
 * Build a corpus by adding panels one at a time:
 * - Left-Side (max 1)
 * - Right-Side (max 1)
 * - Top/Tető (max 1)
 * - Bottom/Fenék (max 1)
 * 
 * Each panel has its own dimensions (Width × Height × Depth × Thickness)
 */

'use client'

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  FormControlLabel, 
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
import Corpus3D from './Corpus3D'
import { validateDimension, validateThickness } from '@/lib/units'

type PanelType = 'left-side' | 'right-side' | 'top' | 'bottom' | 'shelf'

interface Panel {
  id: string
  type: PanelType
  width: number
  height: number
  depth: number
  thickness: number
  yPosition?: number // Y position in mm (for horizontal panels: top, bottom, shelf)
}

interface NewPanelForm {
  type: PanelType | ''
  width: string
  height: string
  depth: string
  thickness: string
}

const PANEL_TYPE_LABELS: Record<PanelType, string> = {
  'left-side': 'Bal oldal',
  'right-side': 'Jobb oldal',
  'top': 'Tető',
  'bottom': 'Fenék',
  'shelf': 'Polc'
}

const PANEL_TYPE_COLORS: Record<PanelType, { bg: string; text: string }> = {
  'left-side': { bg: '#E3F2FD', text: '#1976D2' },
  'right-side': { bg: '#E3F2FD', text: '#1976D2' },
  'top': { bg: '#FFF3E0', text: '#F57C00' },
  'bottom': { bg: '#F3E5F5', text: '#7B1FA2' },
  'shelf': { bg: '#E8F5E9', text: '#388E3C' }
}

export default function CorpusViewer() {
  const [panels, setPanels] = useState<Panel[]>([])
  const [showDimensions, setShowDimensions] = useState(false)
  const [newPanel, setNewPanel] = useState<NewPanelForm>({
    type: '',
    width: '564',
    height: '18',
    depth: '560',
    thickness: '18'
  })

  // Handle panel type change and set smart defaults
  const handleTypeChange = (type: PanelType | '') => {
    if (type === 'left-side' || type === 'right-side') {
      // Side panels: thin width, full height
      setNewPanel({
        type,
        width: '18',
        height: '720',
        depth: '560',
        thickness: '18'
      })
    } else if (type === 'top' || type === 'bottom' || type === 'shelf') {
      // Horizontal panels: full width, thin height (thickness)
      setNewPanel({
        type,
        width: '564',
        height: '18',
        depth: '560',
        thickness: '18'
      })
    } else {
      setNewPanel({
        type: '',
        width: '564',
        height: '18',
        depth: '560',
        thickness: '18'
      })
    }
  }

  // Check which panel types are already added
  const addedTypes = new Set(panels.map(p => p.type))
  const availableTypes: PanelType[] = (['left-side', 'right-side', 'top', 'bottom', 'shelf'] as PanelType[])
    .filter(type => {
      // Allow multiple shelves
      if (type === 'shelf') return true
      // Only one of each other type
      return !addedTypes.has(type)
    })

  // Calculate Y positions for all horizontal panels
  const calculateYPositions = (updatedPanels: Panel[], forceRedistribute: boolean = false): Panel[] => {
    const corpusHeight = updatedPanels.find(p => p.type === 'left-side' || p.type === 'right-side')?.height || 720
    const topPanel = updatedPanels.find(p => p.type === 'top')
    const bottomPanel = updatedPanels.find(p => p.type === 'bottom')
    const shelves = updatedPanels.filter(p => p.type === 'shelf')

    // Calculate bounds
    const bottomTopEdge = bottomPanel ? bottomPanel.thickness : 0
    const topBottomEdge = topPanel ? corpusHeight - topPanel.thickness : corpusHeight

    return updatedPanels.map(panel => {
      if (panel.type === 'top') {
        // Top panel: positioned at corpus height
        return { ...panel, yPosition: corpusHeight }
      } else if (panel.type === 'bottom') {
        // Bottom panel: positioned at 0
        return { ...panel, yPosition: 0 }
      } else if (panel.type === 'shelf') {
        // If forceRedistribute is true, always recalculate
        // Otherwise, keep existing yPosition if it exists (user manually set)
        if (!forceRedistribute && panel.yPosition !== undefined) return panel

        // Auto-distribute shelves with EQUAL GAPS (not equal center spacing)
        const shelfIndex = shelves.findIndex(s => s.id === panel.id)
        const totalShelves = shelves.length
        const availableSpace = topBottomEdge - bottomTopEdge
        
        // Calculate total thickness of all shelves
        const totalShelfThickness = shelves.reduce((sum, s) => sum + s.thickness, 0)
        
        // Calculate gap size (space between panels)
        const totalGapSpace = availableSpace - totalShelfThickness
        const gapSize = totalGapSpace / (totalShelves + 1)
        
        // Calculate position of this shelf's CENTER
        // Position = bottom edge + gap + (shelves before * (thickness + gap)) + half of this shelf's thickness
        let yCenter = bottomTopEdge + gapSize
        for (let i = 0; i < shelfIndex; i++) {
          yCenter += shelves[i].thickness + gapSize
        }
        yCenter += panel.thickness / 2
        
        return { ...panel, yPosition: yCenter }
      }
      return panel
    })
  }

  const handleAddPanel = () => {
    if (!newPanel.type) {
      alert('Kérjük válasszon típust!')
      return
    }

    const width = parseFloat(newPanel.width)
    const height = parseFloat(newPanel.height)
    const depth = parseFloat(newPanel.depth)
    const thickness = parseFloat(newPanel.thickness)

    if (isNaN(width) || isNaN(height) || isNaN(depth) || isNaN(thickness)) {
      alert('Érvénytelen méretek!')
      return
    }

    const panel: Panel = {
      id: Date.now().toString(),
      type: newPanel.type,
      width: Math.max(12, Math.min(2000, Math.round(width))),
      height: Math.max(12, Math.min(2000, Math.round(height))),
      depth: Math.max(12, Math.min(2000, Math.round(depth))),
      thickness: Math.max(12, Math.min(25, Math.round(thickness)))
    }

    // Force redistribution when adding a shelf
    const forceRedistribute = newPanel.type === 'shelf'
    const updatedPanels = calculateYPositions([...panels, panel], forceRedistribute)
    setPanels(updatedPanels)
    
    // Reset form to default (horizontal panel defaults)
    setNewPanel({
      type: '',
      width: '564',
      height: '18',
      depth: '560',
      thickness: '18'
    })
  }

  const handleDeletePanel = (id: string) => {
    const deletedPanel = panels.find(p => p.id === id)
    const updated = panels.filter(p => p.id !== id)
    // Force redistribution if deleting a shelf
    const forceRedistribute = deletedPanel?.type === 'shelf'
    setPanels(calculateYPositions(updated, forceRedistribute))
  }

  // Validate if panels overlap
  const checkOverlap = (updatedPanels: Panel[]): boolean => {
    const horizontalPanels = updatedPanels.filter(p => 
      (p.type === 'top' || p.type === 'bottom' || p.type === 'shelf') && p.yPosition !== undefined
    )

    // Sort by Y position
    const sorted = [...horizontalPanels].sort((a, b) => (a.yPosition || 0) - (b.yPosition || 0))

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]
      
      const currentTop = (current.yPosition || 0) + current.thickness / 2
      const nextBottom = (next.yPosition || 0) - next.thickness / 2

      if (currentTop > nextBottom) {
        return true // Overlap detected
      }
    }

    return false
  }

  const handleYPositionChange = (panelId: string, newYPosition: number) => {
    const updated = panels.map(p =>
      p.id === panelId ? { ...p, yPosition: Math.round(newYPosition) } : p
    )

    // Just update, don't validate on every keystroke
    setPanels(updated)
  }

  const handleYPositionBlur = (panelId: string, currentValue: number) => {
    // Validate on blur (when user finishes editing)
    if (checkOverlap(panels)) {
      alert('Figyelem: A panelek átfedik egymást!')
    }
  }

  // Calculate corpus dimensions and positions for rendering
  const calculateCorpusDimensions = () => {
    const leftPanel = panels.find(p => p.type === 'left-side')
    const rightPanel = panels.find(p => p.type === 'right-side')
    const topPanel = panels.find(p => p.type === 'top')
    const bottomPanel = panels.find(p => p.type === 'bottom')

    // Default dimensions if no panels
    if (panels.length === 0) {
      return {
        width: 600,
        height: 720,
        depth: 560,
        thickness: 18,
        topOffset: 0,
        bottomOffset: 0
      }
    }

    // Use side panel dimensions as reference
    const refHeight = leftPanel?.height || rightPanel?.height || 720
    const refDepth = leftPanel?.depth || rightPanel?.depth || topPanel?.depth || bottomPanel?.depth || 560
    const refThickness = leftPanel?.thickness || rightPanel?.thickness || 18

    // Calculate corpus width based on presence of side panels
    let corpusWidth = 600 // default
    
    if (leftPanel && rightPanel) {
      // Both sides present: width from left edge to right edge
      corpusWidth = leftPanel.width + rightPanel.width + 564 // ~600mm total
    } else if (leftPanel) {
      corpusWidth = leftPanel.width + 582
    } else if (rightPanel) {
      corpusWidth = rightPanel.width + 582
    }

    return {
      width: corpusWidth,
      height: refHeight,
      depth: refDepth,
      thickness: refThickness,
      topOffset: 0,
      bottomOffset: 0,
      panels: {
        left: leftPanel,
        right: rightPanel,
        top: topPanel,
        bottom: bottomPanel
      }
    }
  }

  const corpusDims = calculateCorpusDimensions()

  return (
    <div className='flex flex-col gap-6'>
      {/* 3D Visualization - Full Width */}
      <Card className='h-[600px]'>
        <CardContent className='h-full p-0 relative'>
          {/* Dimension Toggle */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 10,
              pointerEvents: 'all'
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={showDimensions}
                  onChange={(e) => setShowDimensions(e.target.checked)}
                  color='primary'
                />
              }
              label={
                <Typography variant='body2' sx={{ backgroundColor: 'white', px: 1, py: 0.5, borderRadius: 1 }}>
                  Méretek
                </Typography>
              }
              sx={{
                backgroundColor: 'white',
                boxShadow: 2,
                borderRadius: 1,
                px: 1,
                m: 0
              }}
            />
          </Box>

          <Canvas
            orthographic
            camera={{
              position: [2, 1.5, 2],
              zoom: 800,
              up: [0, 1, 0],
              far: 10000
            }}
            style={{ background: '#f5f5f5' }}
          >
            <Corpus3D
              widthMM={corpusDims.width}
              heightMM={corpusDims.height}
              depthMM={corpusDims.depth}
              thicknessMM={corpusDims.thickness}
              topOffsetMM={corpusDims.topOffset}
              bottomOffsetMM={corpusDims.bottomOffset}
              showDimensions={showDimensions}
              panels={panels}
            />
          </Canvas>
        </CardContent>
      </Card>

      {/* Add Panel Form */}
      <Card>
        <CardContent>
          <Typography variant='h6' className='mb-4 font-bold'>
            <i className='ri-add-circle-line mr-2' />
            Panel Hozzáadása
          </Typography>

          <Box className='flex flex-col md:flex-row gap-4 mb-4'>
            <FormControl size='small' className='flex-1'>
              <InputLabel>Típus</InputLabel>
              <Select
                value={newPanel.type}
                label='Típus'
                onChange={(e) => handleTypeChange(e.target.value as PanelType)}
                disabled={availableTypes.length === 0}
              >
                {availableTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {PANEL_TYPE_LABELS[type]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label='Szélesség (mm)'
              type='number'
              size='small'
              className='flex-1'
              value={newPanel.width}
              onChange={(e) => setNewPanel({ ...newPanel, width: e.target.value })}
              helperText='12-2000 mm'
            />

            <TextField
              label='Magasság (mm)'
              type='number'
              size='small'
              className='flex-1'
              value={newPanel.height}
              onChange={(e) => setNewPanel({ ...newPanel, height: e.target.value })}
              helperText={
                newPanel.type === 'top' || newPanel.type === 'bottom' 
                  ? 'Vastagság (függőleges)'
                  : '12-2000 mm'
              }
            />

            <TextField
              label='Mélység (mm)'
              type='number'
              size='small'
              className='flex-1'
              value={newPanel.depth}
              onChange={(e) => setNewPanel({ ...newPanel, depth: e.target.value })}
              helperText='12-2000 mm'
            />

            <TextField
              label='Vastagság (mm)'
              type='number'
              size='small'
              className='flex-1'
              value={newPanel.thickness}
              onChange={(e) => setNewPanel({ ...newPanel, thickness: e.target.value })}
              helperText='12-25 mm'
            />
          </Box>

          <Button
            variant='contained'
            color='primary'
            onClick={handleAddPanel}
            disabled={availableTypes.length === 0 || !newPanel.type}
            startIcon={<i className='ri-add-line' />}
          >
            Panel Hozzáadása
          </Button>

          {availableTypes.length === 0 && !availableTypes.includes('shelf' as PanelType) && (
            <Typography variant='caption' color='text.secondary' className='ml-4'>
              Minden panel típus hozzáadva
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Added Panels List */}
      {panels.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant='h6' className='mb-4 font-bold'>
              Hozzáadott Panelek ({panels.length})
            </Typography>
            <TableContainer component={Paper} variant='outlined'>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Típus</strong></TableCell>
                    <TableCell align='right'><strong>Szélesség (mm)</strong></TableCell>
                    <TableCell align='right'><strong>Magasság (mm)</strong></TableCell>
                    <TableCell align='right'><strong>Mélység (mm)</strong></TableCell>
                    <TableCell align='right'><strong>Vastagság (mm)</strong></TableCell>
                    <TableCell align='right'><strong>Y Pozíció (mm)</strong></TableCell>
                    <TableCell align='center'><strong>Műveletek</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {panels.map((panel) => (
                    <TableRow key={panel.id} hover>
                      <TableCell>
                        <Chip
                          label={PANEL_TYPE_LABELS[panel.type]}
                          size='small'
                          sx={{
                            backgroundColor: PANEL_TYPE_COLORS[panel.type].bg,
                            color: PANEL_TYPE_COLORS[panel.type].text,
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell align='right' className='font-mono'>{panel.width}</TableCell>
                      <TableCell align='right' className='font-mono'>{panel.height}</TableCell>
                      <TableCell align='right' className='font-mono'>{panel.depth}</TableCell>
                      <TableCell align='right' className='font-mono'>{panel.thickness}</TableCell>
                      <TableCell align='right'>
                        {(panel.type === 'top' || panel.type === 'bottom' || panel.type === 'shelf') ? (
                          <TextField
                            type='number'
                            value={panel.yPosition || 0}
                            onChange={(e) => handleYPositionChange(panel.id, parseFloat(e.target.value))}
                            onBlur={(e) => handleYPositionBlur(panel.id, parseFloat(e.target.value))}
                            size='small'
                            sx={{ width: 100 }}
                            inputProps={{ 
                              style: { textAlign: 'right', fontFamily: 'monospace' },
                              step: 1
                            }}
                          />
                        ) : (
                          <span className='text-gray-400'>-</span>
                        )}
                      </TableCell>
                      <TableCell align='center'>
                        <Tooltip title='Törlés'>
                          <IconButton
                            size='small'
                            color='error'
                            onClick={() => handleDeletePanel(panel.id)}
                          >
                            <i className='ri-delete-bin-line' />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {panels.length === 0 && (
        <Card>
          <CardContent className='text-center py-12'>
            <i className='ri-inbox-line text-6xl text-gray-300 mb-4' />
            <Typography variant='h6' color='text.secondary' className='mb-2'>
              Még nincsenek panelek
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Kezdje el a korpusz építését panelek hozzáadásával
            </Typography>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
