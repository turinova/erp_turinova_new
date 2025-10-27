'use client'

import { Line, Text } from '@react-three/drei'

type PanelType = 'left-side' | 'right-side' | 'top' | 'bottom' | 'shelf'

interface PanelData {
  id: string
  type: PanelType
  yPosition?: number
  thickness: number
}

interface DimensionLinesProps {
  widthM: number
  heightM: number
  depthM: number
  thicknessM: number
  widthMM: number
  heightMM: number
  depthMM: number
  panels?: PanelData[]
}

// Helper component for dimension arrow
const DimensionArrow = ({ 
  start, 
  end, 
  color = '#2C2C2C' 
}: { 
  start: [number, number, number]; 
  end: [number, number, number];
  color?: string;
}) => {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const dz = end[2] - start[2]
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  
  // Safety check for invalid values
  if (!isFinite(length) || length < 0.001) {
    return null
  }
  
  // Normalized direction
  const dirX = dx / length
  const dirY = dy / length
  const dirZ = dz / length
  
  // Arrow size
  const arrowSize = 0.015
  const arrowWidth = 0.008
  
  // Perpendicular vectors for arrow wings
  let perpX, perpY, perpZ
  if (Math.abs(dirY) < 0.9) {
    perpX = -dirY
    perpY = dirX
    perpZ = 0
  } else {
    perpX = 0
    perpY = -dirZ
    perpZ = dirY
  }
  
  const perpLength = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ)
  
  // Safety check for perpendicular length
  if (!isFinite(perpLength) || perpLength < 0.001) {
    return null
  }
  
  perpX /= perpLength
  perpY /= perpLength
  perpZ /= perpLength
  
  return (
    <>
      {/* Arrow line 1 */}
      <Line
        points={[
          start,
          [start[0] + dirX * arrowSize + perpX * arrowWidth, 
           start[1] + dirY * arrowSize + perpY * arrowWidth, 
           start[2] + dirZ * arrowSize + perpZ * arrowWidth]
        ]}
        color={color}
        lineWidth={1.5}
      />
      {/* Arrow line 2 */}
      <Line
        points={[
          start,
          [start[0] + dirX * arrowSize - perpX * arrowWidth, 
           start[1] + dirY * arrowSize - perpY * arrowWidth, 
           start[2] + dirZ * arrowSize - perpZ * arrowWidth]
        ]}
        color={color}
        lineWidth={1.5}
      />
    </>
  )
}

export default function DimensionLines({
  widthM,
  heightM,
  depthM,
  widthMM,
  heightMM,
  depthMM,
  panels = []
}: DimensionLinesProps) {
  // Safety check for invalid dimensions
  if (!isFinite(widthM) || !isFinite(heightM) || !isFinite(depthM) || 
      widthM <= 0 || heightM <= 0 || depthM <= 0) {
    return null
  }

  const dimColor = '#2C2C2C' // Dark technical drawing color
  const dimOffset = 0.12 // Offset for dimension lines from object
  const extensionOverhang = 0.02 // How much extension lines extend beyond dimension line
  
  // Get horizontal panels sorted by Y position
  const horizontalPanels = panels
    .filter(p => (p.type === 'top' || p.type === 'bottom' || p.type === 'shelf') && p.yPosition !== undefined)
    .sort((a, b) => (a.yPosition || 0) - (b.yPosition || 0))

  // Calculate spacing between consecutive horizontal panels
  // Note: yPosition means different things for different panel types:
  // - Bottom: yPosition = bottom edge (0)
  // - Top: yPosition = top edge (corpusHeight)
  // - Shelf: yPosition = center position
  const spacings: Array<{ yStart: number; yEnd: number; distanceMM: number }> = []
  
  for (let i = 0; i < horizontalPanels.length - 1; i++) {
    const current = horizontalPanels[i]
    const next = horizontalPanels[i + 1]
    
    // Calculate top edge of current panel
    let currentTop: number
    if (current.type === 'bottom') {
      currentTop = (current.yPosition || 0) + current.thickness // yPosition is bottom edge
    } else if (current.type === 'shelf') {
      currentTop = (current.yPosition || 0) + current.thickness / 2 // yPosition is center
    } else { // top
      currentTop = (current.yPosition || 0) // yPosition is already top edge
    }
    
    // Calculate bottom edge of next panel
    let nextBottom: number
    if (next.type === 'bottom') {
      nextBottom = (next.yPosition || 0) // yPosition is bottom edge
    } else if (next.type === 'shelf') {
      nextBottom = (next.yPosition || 0) - next.thickness / 2 // yPosition is center
    } else { // top
      nextBottom = (next.yPosition || 0) - next.thickness // yPosition is top edge
    }
    
    const distance = nextBottom - currentTop
    
    if (distance > 10) { // Only show if spacing > 10mm
      spacings.push({
        yStart: currentTop,
        yEnd: nextBottom,
        distanceMM: Math.round(distance)
      })
    }
  }

  return (
    <group>
      {/* ============================================ */}
      {/* WIDTH DIMENSION (bottom front) */}
      {/* ============================================ */}
      <group>
        {/* Extension lines (witness lines) */}
        <Line
          points={[
            [-widthM / 2, 0, depthM / 2],
            [-widthM / 2, -dimOffset - extensionOverhang, depthM / 2 + dimOffset]
          ]}
          color={dimColor}
          lineWidth={0.8}
        />
        <Line
          points={[
            [widthM / 2, 0, depthM / 2],
            [widthM / 2, -dimOffset - extensionOverhang, depthM / 2 + dimOffset]
          ]}
          color={dimColor}
          lineWidth={0.8}
        />
        
        {/* Dimension line */}
        <Line
          points={[
            [-widthM / 2, -dimOffset, depthM / 2 + dimOffset],
            [widthM / 2, -dimOffset, depthM / 2 + dimOffset]
          ]}
          color={dimColor}
          lineWidth={1.5}
        />
        
        {/* Arrows */}
        <DimensionArrow 
          start={[-widthM / 2, -dimOffset, depthM / 2 + dimOffset]}
          end={[widthM / 2, -dimOffset, depthM / 2 + dimOffset]}
          color={dimColor}
        />
        <DimensionArrow 
          start={[widthM / 2, -dimOffset, depthM / 2 + dimOffset]}
          end={[-widthM / 2, -dimOffset, depthM / 2 + dimOffset]}
          color={dimColor}
        />
        
        {/* Text */}
        <Text
          position={[0, -dimOffset - 0.04, depthM / 2 + dimOffset]}
          fontSize={0.045}
          color={dimColor}
          anchorX="center"
          anchorY="top"
        >
          {widthMM}
        </Text>
      </group>

      {/* ============================================ */}
      {/* HEIGHT DIMENSION (left side front) */}
      {/* ============================================ */}
      <group>
        {/* Extension lines */}
        <Line
          points={[
            [-widthM / 2, 0, depthM / 2],
            [-widthM / 2 - dimOffset - extensionOverhang, 0, depthM / 2 + dimOffset]
          ]}
          color={dimColor}
          lineWidth={0.8}
        />
        <Line
          points={[
            [-widthM / 2, heightM, depthM / 2],
            [-widthM / 2 - dimOffset - extensionOverhang, heightM, depthM / 2 + dimOffset]
          ]}
          color={dimColor}
          lineWidth={0.8}
        />
        
        {/* Dimension line */}
        <Line
          points={[
            [-widthM / 2 - dimOffset, 0, depthM / 2 + dimOffset],
            [-widthM / 2 - dimOffset, heightM, depthM / 2 + dimOffset]
          ]}
          color={dimColor}
          lineWidth={1.5}
        />
        
        {/* Arrows */}
        <DimensionArrow 
          start={[-widthM / 2 - dimOffset, 0, depthM / 2 + dimOffset]}
          end={[-widthM / 2 - dimOffset, heightM, depthM / 2 + dimOffset]}
          color={dimColor}
        />
        <DimensionArrow 
          start={[-widthM / 2 - dimOffset, heightM, depthM / 2 + dimOffset]}
          end={[-widthM / 2 - dimOffset, 0, depthM / 2 + dimOffset]}
          color={dimColor}
        />
        
        {/* Text */}
        <Text
          position={[-widthM / 2 - dimOffset - 0.055, heightM / 2, depthM / 2 + dimOffset]}
          fontSize={0.045}
          color={dimColor}
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, Math.PI / 2]}
        >
          {heightMM}
        </Text>
      </group>

      {/* ============================================ */}
      {/* DEPTH DIMENSION (right side) */}
      {/* ============================================ */}
      <group>
        {/* Extension lines */}
        <Line
          points={[
            [widthM / 2, 0, -depthM / 2],
            [widthM / 2 + dimOffset + extensionOverhang, -dimOffset, -depthM / 2]
          ]}
          color={dimColor}
          lineWidth={0.8}
        />
        <Line
          points={[
            [widthM / 2, 0, depthM / 2],
            [widthM / 2 + dimOffset + extensionOverhang, -dimOffset, depthM / 2]
          ]}
          color={dimColor}
          lineWidth={0.8}
        />
        
        {/* Dimension line */}
        <Line
          points={[
            [widthM / 2 + dimOffset, -dimOffset, -depthM / 2],
            [widthM / 2 + dimOffset, -dimOffset, depthM / 2]
          ]}
          color={dimColor}
          lineWidth={1.5}
        />
        
        {/* Arrows */}
        <DimensionArrow 
          start={[widthM / 2 + dimOffset, -dimOffset, -depthM / 2]}
          end={[widthM / 2 + dimOffset, -dimOffset, depthM / 2]}
          color={dimColor}
        />
        <DimensionArrow 
          start={[widthM / 2 + dimOffset, -dimOffset, depthM / 2]}
          end={[widthM / 2 + dimOffset, -dimOffset, -depthM / 2]}
          color={dimColor}
        />
        
        {/* Text */}
        <Text
          position={[widthM / 2 + dimOffset + 0.055, -dimOffset, 0]}
          fontSize={0.045}
          color={dimColor}
          anchorX="center"
          anchorY="middle"
          rotation={[0, -Math.PI / 2, 0]}
        >
          {depthMM}
        </Text>
      </group>

      {/* ============================================ */}
      {/* SPACING DIMENSIONS between horizontal panels */}
      {/* ============================================ */}
      {spacings.map((spacing, index) => {
        const yStartM = spacing.yStart / 1000
        const yEndM = spacing.yEnd / 1000
        const yMidM = (yStartM + yEndM) / 2
        const xPos = widthM / 2 + dimOffset * 0.5 // Outside right edge, between depth and height dimensions

        return (
          <group key={`spacing-${index}`}>
            {/* Extension lines from panel edges */}
            <Line
              points={[
                [widthM / 2, yStartM, 0],
                [xPos + extensionOverhang, yStartM, 0]
              ]}
              color={dimColor}
              lineWidth={0.8}
            />
            <Line
              points={[
                [widthM / 2, yEndM, 0],
                [xPos + extensionOverhang, yEndM, 0]
              ]}
              color={dimColor}
              lineWidth={0.8}
            />
            
            {/* Dimension line */}
            <Line
              points={[
                [xPos, yStartM, 0],
                [xPos, yEndM, 0]
              ]}
              color={dimColor}
              lineWidth={1.5}
            />
            
            {/* Arrows */}
            <DimensionArrow 
              start={[xPos, yStartM, 0]}
              end={[xPos, yEndM, 0]}
              color={dimColor}
            />
            <DimensionArrow 
              start={[xPos, yEndM, 0]}
              end={[xPos, yStartM, 0]}
              color={dimColor}
            />
            
            {/* Text */}
            <Text
              position={[xPos + 0.045, yMidM, 0]}
              fontSize={0.035}
              color={dimColor}
              anchorX="center"
              anchorY="middle"
              rotation={[0, 0, Math.PI / 2]}
            >
              {spacing.distanceMM}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
