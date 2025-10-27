'use client'

import { OrbitControls, Grid } from '@react-three/drei'
import Panel from './Panel'
import ConnectionLines from './ConnectionLines'
import DimensionLines from './DimensionLines'
import { mm } from '@/lib/units'

type PanelType = 'left-side' | 'right-side' | 'top' | 'bottom' | 'shelf'

interface PanelData {
  id: string
  type: PanelType
  width: number
  height: number
  depth: number
  thickness: number
  yPosition?: number
}

interface Corpus3DProps {
  widthMM: number
  heightMM: number
  depthMM: number
  thicknessMM: number
  topOffsetMM: number
  bottomOffsetMM: number
  showDimensions: boolean
  panels?: PanelData[]
}

export default function Corpus3D({ 
  widthMM, 
  heightMM, 
  depthMM, 
  thicknessMM, 
  topOffsetMM, 
  bottomOffsetMM, 
  showDimensions, 
  panels = [] 
}: Corpus3DProps) {

  // If no panels provided, don't render anything
  if (panels.length === 0) {
    return (
      <>
        {/* Camera Controls - Rotation enabled, pan disabled */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 2}
          maxAzimuthAngle={Math.PI / 2}
        />

        {/* Grid */}
        <Grid
          args={[10, 10]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#e0e0e0"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#cccccc"
          fadeDistance={30}
          fadeStrength={1}
          position={[0, 0, 0]}
        />
      </>
    )
  }

  // Find specific panels
  const leftPanel = panels.find(p => p.type === 'left-side')
  const rightPanel = panels.find(p => p.type === 'right-side')
  const topPanel = panels.find(p => p.type === 'top')
  const bottomPanel = panels.find(p => p.type === 'bottom')
  const shelves = panels.filter(p => p.type === 'shelf')

  // Calculate positions for each panel type
  // Using the panel's own dimensions, not the corpus dimensions

  const renderedPanels: Array<{ size: [number, number, number]; position: [number, number, number] }> = []

  // LEFT SIDE: positioned at the left edge
  if (leftPanel) {
    const w = mm(leftPanel.width)
    const h = mm(leftPanel.height)
    const d = mm(leftPanel.depth)
    
    renderedPanels.push({
      size: [w, h, d],
      position: [-(mm(widthMM) / 2 - w / 2), h / 2, 0]
    })
  }

  // RIGHT SIDE: positioned at the right edge
  if (rightPanel) {
    const w = mm(rightPanel.width)
    const h = mm(rightPanel.height)
    const d = mm(rightPanel.depth)
    
    renderedPanels.push({
      size: [w, h, d],
      position: [+(mm(widthMM) / 2 - w / 2), h / 2, 0]
    })
  }

  // TOP: positioned at Y = heightMM, centered horizontally (HORIZONTAL orientation)
  // For horizontal panels: width stays width, height becomes thickness (thin dimension)
  if (topPanel) {
    const w = mm(topPanel.width)
    const t = mm(topPanel.thickness)  // thickness is the vertical dimension
    const d = mm(topPanel.depth)
    
    renderedPanels.push({
      size: [w, t, d],  // width, thickness (vertical), depth
      position: [0, mm(heightMM) - t / 2, 0]  // top edge at heightMM
    })
  }

  // BOTTOM: positioned at Y = 0, centered horizontally (HORIZONTAL orientation)
  if (bottomPanel) {
    const w = mm(bottomPanel.width)
    const t = mm(bottomPanel.thickness)  // thickness is the vertical dimension
    const d = mm(bottomPanel.depth)
    
    renderedPanels.push({
      size: [w, t, d],  // width, thickness (vertical), depth
      position: [0, t / 2, 0]  // bottom edge at Y=0
    })
  }

  // SHELVES: horizontal panels at custom Y positions
  shelves.forEach(shelf => {
    const w = mm(shelf.width)
    const t = mm(shelf.thickness)  // thickness is the vertical dimension
    const d = mm(shelf.depth)
    const y = shelf.yPosition ? mm(shelf.yPosition) : mm(heightMM) / 2  // center if no yPosition
    
    renderedPanels.push({
      size: [w, t, d],  // width, thickness (vertical), depth
      position: [0, y, 0]  // at custom Y position
    })
  })

  return (
    <>
      {/* Camera Controls - Rotation enabled, pan disabled */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={-Math.PI / 2}
        maxAzimuthAngle={Math.PI / 2}
      />

      {/* Grid */}
      <Grid
        args={[10, 10]}
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#e0e0e0"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#cccccc"
        fadeDistance={30}
        fadeStrength={1}
        position={[0, 0, 0]}
      />

      {/* Render panels */}
      {renderedPanels.map((panel, index) => (
        <Panel key={index} size={panel.size} position={panel.position} />
      ))}

      {/* Connection lines where panels meet */}
      {leftPanel && rightPanel && topPanel && bottomPanel && (
        <ConnectionLines
          widthM={mm(widthMM)}
          heightM={mm(heightMM)}
          depthM={mm(depthMM)}
          thicknessM={mm(thicknessMM)}
          topOffsetM={mm(topOffsetMM)}
          bottomOffsetM={mm(bottomOffsetMM)}
        />
      )}

      {/* Dimension lines (toggleable) */}
      {showDimensions && (
        <DimensionLines
          widthM={mm(widthMM)}
          heightM={mm(heightMM)}
          depthM={mm(depthMM)}
          thicknessM={mm(thicknessMM)}
          widthMM={widthMM}
          heightMM={heightMM}
          depthMM={depthMM}
          panels={panels}
        />
      )}
    </>
  )
}
