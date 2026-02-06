// Comprehensive worktop SVG visualization generator for PDF
// Extracts EXACT logic from WorktopConfigClient.tsx (7000+ lines)
// This is a server-side port of the React component's SVG generation

interface WorktopConfig {
  assembly_type: string
  dimension_a: number
  dimension_b: number
  dimension_c: number | null
  dimension_d: number | null
  rounding_r1: number | null
  rounding_r2: number | null
  rounding_r3: number | null
  rounding_r4: number | null
  cut_l1: number | null
  cut_l2: number | null
  cut_l3: number | null
  cut_l4: number | null
  cut_l5: number | null
  cut_l6: number | null
  cut_l7: number | null
  cut_l8: number | null
  cutouts: string | null
  edge_position1: boolean
  edge_position2: boolean
  edge_position3: boolean
  edge_position4: boolean
  edge_position5: boolean | null
  edge_position6: boolean | null
}

// Material dimensions - for now using config dimensions directly
// In real implementation, these would come from linear_material data
const DEFAULT_MATERIAL_WIDTH = 4100 // mm
const DEFAULT_MATERIAL_LENGTH = 600 // mm

export function generateWorktopSvg(config: WorktopConfig): string {
  // Parse all dimensions
  const aValue = config.dimension_a || 0
  const bValue = config.dimension_b || 0
  const cValue = config.dimension_c || 0
  const dValue = config.dimension_d || 0
  
  const r1ValueRaw = config.rounding_r1 || 0
  const r2ValueRaw = config.rounding_r2 || 0
  const r3ValueRaw = config.rounding_r3 || 0
  const r4ValueRaw = config.rounding_r4 || 0
  
  const l1Value = config.cut_l1 || 0
  const l2Value = config.cut_l2 || 0
  const l3Value = config.cut_l3 || 0
  const l4Value = config.cut_l4 || 0
  const l5Value = config.cut_l5 || 0
  const l6Value = config.cut_l6 || 0
  const l7Value = config.cut_l7 || 0
  const l8Value = config.cut_l8 || 0
  
  const hasL1L2 = l1Value > 0 && l2Value > 0 && config.assembly_type !== 'Összemarás Balos' && config.assembly_type !== 'Összemarás jobbos'
  const hasL3L4 = l3Value > 0 && l4Value > 0
  const hasL5L6 = l5Value > 0 && l6Value > 0 && (config.assembly_type === 'Levágás' || config.assembly_type === 'Összemarás Balos' || config.assembly_type === 'Összemarás jobbos')
  const hasL7L8 = l7Value > 0 && l8Value > 0 && (config.assembly_type === 'Levágás' || config.assembly_type === 'Összemarás Balos' || config.assembly_type === 'Összemarás jobbos')
  
  const cutouts = config.cutouts ? JSON.parse(config.cutouts) : []
  
  const assemblyType = config.assembly_type
  const isJobbos = assemblyType === 'Összemarás jobbos'
  const isOsszemaras = assemblyType === 'Összemarás U alak (Nem működik még)'
  
  // Determine worktop dimensions
  let worktopWidth: number
  let worktopLength: number
  
  if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') {
    worktopWidth = aValue > 0 ? aValue : DEFAULT_MATERIAL_WIDTH
    worktopLength = bValue > 0 ? bValue : DEFAULT_MATERIAL_LENGTH
  } else {
    // Levágás: A is the kept width (cut position), B is the height
    // The material is rotated 90 degrees, so:
    // - material.length becomes displayed width
    // - material.width becomes displayed height
    // For Levágás: A = cut position along width, B = height
    worktopWidth = DEFAULT_MATERIAL_WIDTH  // Full material width (before cut)
    worktopLength = bValue > 0 ? bValue : DEFAULT_MATERIAL_LENGTH  // B is the height (e.g., 500mm)
  }
  
  // Cut position for Levágás
  const cutPosition = assemblyType === 'Levágás' ? aValue : 0
  const showCut = assemblyType === 'Levágás' && cutPosition > 0 && cutPosition < worktopWidth
  const showVerticalCut = false // Not used in current configs
  
  // Perpendicular rectangles for Összemarás
  const leftPerpendicularRectHeight = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && cValue > 0 ? cValue : 0
  const leftPerpendicularRectWidth = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && dValue > 0 ? dValue : 0
  const showLeftPerpendicularRect = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && cValue > 0 && dValue > 0
  
  // Calculate rounding values
  const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
  const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
  
  const r1Value = Math.min(r1ValueRaw, keptWidth / 2, keptHeight)
  const r2Value = Math.min(r2ValueRaw, keptWidth / 2, keptHeight)
  const r3Value = Math.min(r3ValueRaw, worktopWidth / 2, worktopLength / 2)
  const r4Value = Math.min(r4ValueRaw, worktopWidth / 2, worktopLength / 2)
  
  const leftPerpendicularRectR1 = showLeftPerpendicularRect 
    ? Math.min(r1ValueRaw, leftPerpendicularRectWidth / 2, leftPerpendicularRectHeight) 
    : 0
  
  const hasLeftPerpendicularL1L2 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && l1Value > 0 && l2Value > 0
  
  // For Összemarás Balos/jobbos: R3 and L5-L6 apply to perpendicular rectangle
  const hasLeftPerpendicularR3 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && r3ValueRaw > 0
  const hasLeftPerpendicularL5L6 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && hasL5L6
  const leftPerpendicularRectR3 = hasLeftPerpendicularR3 && showLeftPerpendicularRect
    ? Math.min(r3ValueRaw, leftPerpendicularRectWidth / 2, leftPerpendicularRectHeight / 2)
    : 0
  
  // Main worktop offset
  const mainWorktopOffsetX = (isJobbos && showLeftPerpendicularRect) ? leftPerpendicularRectWidth : 0
  const startY = showVerticalCut ? (worktopLength - bValue) : 0
  const bottomY = worktopLength
  
  // Calculate unified spacing offsets for all label types FIRST
  // This must be done before viewBox calculation
  // NEW PRIORITY ORDER (closest to farthest from edges):
  // 1. L values (L1-L8) - CLOSEST to edges
  // 2. Cutout labels (kivágás) - after L values
  // 3. Edge labels (oldal) - after cutout labels
  // 4. A/B/C/D dimensions - FARTHEST from edges (last)
  const calculateLabelOffsets = () => {
    const worktopWidthForCalc = showCut ? cutPosition : worktopWidth
    const minDimension = Math.min(worktopWidthForCalc, bottomY - startY)
    const baseOffset = 100 // Base distance from edge
    
    // Spacing constants
    const SPACING_BETWEEN_LABEL_TYPES = 300 // Space between different label types
    const SPACING_BETWEEN_STACKED_LABELS = 120 // Space between stacked labels of same type
    const LABEL_HEIGHT = 60 // Height of label text
    const DIMENSION_LINE_OFFSET = 50 // Offset from dimension line to label
    
    // Calculate offsets for each side
    const offsets = {
      // LEFT SIDE
      left: {
        l2Dimension: 0, // L2 - CLOSEST
        l6Dimension: 0, // L6 - CLOSEST
        cutoutVertical: 0, // Cutout labels - after L values
        edgeLabel: 0, // 1. oldal - after cutout
        cDimension: 0 // C dimension - FARTHEST (last)
      },
      // RIGHT SIDE
      right: {
        l8Dimension: 0, // L8 - CLOSEST
        l4Dimension: 0, // L4 - CLOSEST
        cutoutVertical: 0, // Cutout labels - after L values
        edgeLabel: 0, // 3. oldal - after cutout
        bDimension: 0 // B dimension - FARTHEST (last)
      },
      // TOP SIDE
      top: {
        l7Dimension: 0, // L7 - CLOSEST
        cutoutHorizontal: 0, // Cutout labels - after L values
        edgeLabel: 0, // 2. oldal - after cutout
        aDimension: 0 // A dimension - FARTHEST (last)
      },
      // BOTTOM SIDE
      bottom: {
        l1Dimension: 0, // L1 - CLOSEST
        l3Dimension: 0, // L3 - CLOSEST
        l5Dimension: 0, // L5 - CLOSEST (perpendicular only)
        cutoutHorizontal: 0, // Cutout labels - after L values
        edgeLabel: 0, // 4. oldal - after cutout
        aDimension: 0, // A dimension (Levágás) - FARTHEST (last)
        dDimension: 0 // D dimension (Összemarás) - FARTHEST (last)
      }
    }
    
    // LEFT SIDE CALCULATIONS
    // Priority: L2/L6 (closest) -> cutout vertical -> 1. oldal -> C dimension (farthest)
    let leftCurrentOffset = baseOffset
    
    // L2 and L6 (vertical labels on left) - CLOSEST
    const hasL2OrL6 = hasL1L2 || (hasL5L6 && !showLeftPerpendicularRect)
    if (hasL2OrL6) {
      offsets.left.l2Dimension = leftCurrentOffset
      offsets.left.l6Dimension = leftCurrentOffset
      leftCurrentOffset += 100 + DIMENSION_LINE_OFFSET + 200 + SPACING_BETWEEN_LABEL_TYPES // L2/L6 dimension line + label + spacing
    }
    
    // Cutout vertical labels (stacked) - after L values
    if (cutouts.length > 0) {
      offsets.left.cutoutVertical = leftCurrentOffset
      // Each cutout adds 120mm spacing
      leftCurrentOffset += 100 + (cutouts.length - 1) * SPACING_BETWEEN_STACKED_LABELS + DIMENSION_LINE_OFFSET + 200 + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // 1. oldal - after cutout labels
    const edgeLabelOffset = minDimension * 0.15
    if (config.edge_position1) {
      offsets.left.edgeLabel = Math.max(leftCurrentOffset, edgeLabelOffset)
      leftCurrentOffset = offsets.left.edgeLabel + 80 + 100 // Reduced spacing from SPACING_BETWEEN_LABEL_TYPES (300) to 100
    } else {
      offsets.left.edgeLabel = edgeLabelOffset
    }
    
    // C dimension (Összemarás only) - FARTHEST (last)
    // Minimized spacing to bring much closer to edges
    if (showLeftPerpendicularRect && cValue > 0) {
      offsets.left.cDimension = leftCurrentOffset
      leftCurrentOffset += 80 + DIMENSION_LINE_OFFSET + 40 // Further minimized: 120 -> 80, 60 -> 40
    }
    
    // RIGHT SIDE CALCULATIONS
    // Priority: L8/L4 (closest) -> cutout vertical -> 3. oldal -> B dimension (farthest)
    let rightCurrentOffset = baseOffset
    
    // L8 (top-right, vertical) - CLOSEST
    if (hasL7L8) {
      offsets.right.l8Dimension = rightCurrentOffset
      rightCurrentOffset += 100 + DIMENSION_LINE_OFFSET + 200 + SPACING_BETWEEN_LABEL_TYPES // L8 label end + spacing
    }
    
    // L4 (bottom-right, vertical) - CLOSEST
    if (hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
      offsets.right.l4Dimension = rightCurrentOffset
      rightCurrentOffset += 100 + DIMENSION_LINE_OFFSET + 200 + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // Cutout vertical labels on right (if any) - after L values
    // Note: Currently cutouts only use left side, but keeping for future
    
    // 3. oldal - after cutout labels
    if (config.edge_position3) {
      offsets.right.edgeLabel = Math.max(rightCurrentOffset, edgeLabelOffset)
      rightCurrentOffset = offsets.right.edgeLabel + 80 + 100 // Reduced spacing from SPACING_BETWEEN_LABEL_TYPES (300) to 100
    } else {
      offsets.right.edgeLabel = edgeLabelOffset
    }
    
    // B dimension - FARTHEST (last) - for both Levágás and Összemarás
    // Minimized spacing to bring much closer to edges
    if (bValue > 0) {
      offsets.right.bDimension = rightCurrentOffset
      rightCurrentOffset += 80 + DIMENSION_LINE_OFFSET + 40 // Further minimized: 120 -> 80, 60 -> 40
    }
    
    // TOP SIDE CALCULATIONS
    // Priority: L7 (closest) -> cutout horizontal -> 2. oldal -> A dimension (farthest)
    let topCurrentOffset = baseOffset
    
    // L7 (top-right, horizontal) - CLOSEST
    if (hasL7L8) {
      offsets.top.l7Dimension = topCurrentOffset
      topCurrentOffset += 100 + LABEL_HEIGHT + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // Cutout horizontal labels - after L values
    // Note: Currently cutouts only use bottom side, but keeping for future
    
    // 2. oldal - after cutout labels
    if (config.edge_position2) {
      offsets.top.edgeLabel = Math.max(topCurrentOffset, edgeLabelOffset)
      topCurrentOffset = offsets.top.edgeLabel + 80 + 100 // Reduced spacing from SPACING_BETWEEN_LABEL_TYPES (300) to 100
    } else {
      offsets.top.edgeLabel = edgeLabelOffset
    }
    
    // A dimension (Összemarás only, above worktop) - FARTHEST (last)
    // Minimized spacing to bring much closer to edges
    if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')) {
      offsets.top.aDimension = topCurrentOffset
      topCurrentOffset += 60 + LABEL_HEIGHT // Further minimized: 100 -> 60
    }
    
    // BOTTOM SIDE CALCULATIONS
    // Priority: L1/L3/L5 (closest) -> cutout horizontal -> 4. oldal -> A/D dimension (farthest)
    let bottomCurrentOffset = baseOffset
    
    // L1 (bottom-left, horizontal) - CLOSEST
    if (hasL1L2) {
      offsets.bottom.l1Dimension = bottomCurrentOffset
      bottomCurrentOffset += 100 + LABEL_HEIGHT + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // L3 (bottom-right, horizontal) - CLOSEST
    if (hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
      offsets.bottom.l3Dimension = bottomCurrentOffset
      bottomCurrentOffset += 100 + LABEL_HEIGHT + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // L5 (perpendicular rectangle bottom-left, horizontal) - CLOSEST
    if (hasL5L6 && showLeftPerpendicularRect && hasLeftPerpendicularL5L6) {
      offsets.bottom.l5Dimension = bottomCurrentOffset
      bottomCurrentOffset += 100 + LABEL_HEIGHT + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // Cutout horizontal labels (stacked) - after L values
    if (cutouts.length > 0) {
      offsets.bottom.cutoutHorizontal = bottomCurrentOffset
      // Each cutout adds 120mm spacing
      bottomCurrentOffset += 100 + (cutouts.length - 1) * SPACING_BETWEEN_STACKED_LABELS + LABEL_HEIGHT + SPACING_BETWEEN_LABEL_TYPES
    }
    
    // 4. oldal - after cutout labels
    if (config.edge_position4) {
      offsets.bottom.edgeLabel = Math.max(bottomCurrentOffset, edgeLabelOffset)
      bottomCurrentOffset = offsets.bottom.edgeLabel + 80 + 100 // Reduced spacing from SPACING_BETWEEN_LABEL_TYPES (300) to 100
    } else {
      offsets.bottom.edgeLabel = edgeLabelOffset
    }
    
    // A dimension (Levágás only, below worktop) - FARTHEST (last)
    // Minimized spacing to bring much closer to edges
    if (assemblyType === 'Levágás' && showCut) {
      offsets.bottom.aDimension = bottomCurrentOffset
      bottomCurrentOffset += 60 + LABEL_HEIGHT // Further minimized: 100 -> 60
    }
    
    // D dimension (Összemarás only, below perpendicular rectangle) - FARTHEST (last)
    // Minimized spacing to bring much closer to edges
    if (showLeftPerpendicularRect && dValue > 0) {
      offsets.bottom.dDimension = bottomCurrentOffset
      bottomCurrentOffset += 60 + LABEL_HEIGHT // Further minimized: 100 -> 60
    }
    
    return offsets
  }
  
  // Calculate all label offsets once
  const labelOffsets = calculateLabelOffsets()
  
  // Calculate viewBox with padding for labels based on calculated offsets
  // A/B/C/D dimensions are now the farthest, so they determine the padding
  const labelPaddingLeft = Math.max(showLeftPerpendicularRect ? 550 : 400, labelOffsets.left.cDimension + 100)
  const labelPaddingRight = Math.max(400, labelOffsets.right.bDimension + 100)
  const labelPaddingTop = Math.max((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 300 : 100, labelOffsets.top.aDimension + 100)
  const labelPaddingBottom = Math.max(150, Math.max(labelOffsets.bottom.aDimension || 0, labelOffsets.bottom.dDimension || 0) + 100)
  
  // Total dimensions
  // For Levágás: use kept width (cut position), not full material width
  let totalWorktopHeight: number
  let totalWorktopWidth: number
  
  if (assemblyType === 'Levágás' && showCut) {
    // For Levágás: total width is the kept portion (cut position)
    totalWorktopWidth = cutPosition
    totalWorktopHeight = worktopLength
  } else if (isJobbos && showLeftPerpendicularRect) {
    totalWorktopWidth = leftPerpendicularRectWidth + worktopWidth
    totalWorktopHeight = Math.max(leftPerpendicularRectHeight, worktopLength)
  } else if (showLeftPerpendicularRect) {
    totalWorktopHeight = worktopLength + leftPerpendicularRectHeight
    totalWorktopWidth = Math.max(worktopWidth, leftPerpendicularRectWidth)
  } else {
    totalWorktopHeight = worktopLength
    totalWorktopWidth = worktopWidth
  }
  
  const expandedWidth = totalWorktopWidth + labelPaddingLeft + labelPaddingRight
  const expandedHeight = totalWorktopHeight + labelPaddingTop + labelPaddingBottom
  
  // Calculate original viewBox (before rotation) to determine content bounds
  const expandedAspectRatio = expandedWidth / expandedHeight
  const worktopAspectRatio = totalWorktopWidth / totalWorktopHeight
  
  let originalViewBoxWidth = expandedWidth
  let originalViewBoxHeight = expandedHeight
  
  if (expandedAspectRatio > worktopAspectRatio) {
    originalViewBoxHeight = expandedWidth / worktopAspectRatio
  } else {
    originalViewBoxWidth = expandedHeight * worktopAspectRatio
  }
  
  let originalViewBoxX: number
  if (isOsszemaras && showLeftPerpendicularRect) {
    originalViewBoxX = -labelPaddingLeft
  } else {
    originalViewBoxX = -(originalViewBoxWidth - totalWorktopWidth) / 2
  }
  const originalViewBoxY = -(originalViewBoxHeight - totalWorktopHeight) / 2
  
  // For 90-degree counter-clockwise rotation, swap width and height
  // After rotation: original width becomes height, original height becomes width
  const rotatedWidth = originalViewBoxHeight
  const rotatedHeight = originalViewBoxWidth
  
  // A4 paper dimensions in mm: 210mm × 297mm (portrait)
  // We want to center the rotated content on A4
  const a4Width = 210
  const a4Height = 297
  
  // Calculate the bounding box needed for rotated content
  // The rotated content will fit in a box of rotatedWidth × rotatedHeight
  // We need to ensure this fits within A4 with some margin
  const margin = 5 // 5mm margin on all sides
  const maxContentWidth = a4Width - (2 * margin)
  const maxContentHeight = a4Height - (2 * margin)
  
  // Calculate scale to fit rotated content within A4
  const scaleX = maxContentWidth / rotatedWidth
  const scaleY = maxContentHeight / rotatedHeight
  const scale = Math.min(scaleX, scaleY, 1) // Don't scale up, only down if needed
  
  // Calculate the center of the original content (in original viewBox coordinates)
  // This is the point around which we'll rotate
  const contentCenterX = originalViewBoxX + originalViewBoxWidth / 2
  const contentCenterY = originalViewBoxY + originalViewBoxHeight / 2
  
  // Calculate viewBox to center rotated content on A4
  // The viewBox should be A4 size, and we'll center the rotated content within it
  const finalViewBoxWidth = a4Width
  const finalViewBoxHeight = a4Height
  const viewBoxX = 0
  const viewBoxY = 0
  
  // Build main worktop path
  const buildMainWorktopPath = (): string => {
    const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
    const effectiveHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
    
    const r1 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 0 : Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
    const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
    
    let path = ''
    if (hasL5L6 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
      path = `M ${mainWorktopOffsetX + l5Value} ${startY}`
    } else if (r3Value > 0 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
      path = `M ${mainWorktopOffsetX + r3Value} ${startY}`
    } else {
      path = `M ${mainWorktopOffsetX} ${startY}`
    }
    
    const topRightX = showCut ? (mainWorktopOffsetX + cutPosition) : (mainWorktopOffsetX + worktopWidth)
    if (hasL7L8) {
      path += ` L ${topRightX - l7Value} ${startY}`
    } else if (r4Value > 0) {
      path += ` L ${topRightX - r4Value} ${startY}`
    } else {
      path += ` L ${topRightX} ${startY}`
    }
    
    if (hasL7L8) {
      path += ` L ${topRightX} ${startY + l8Value}`
    } else if (r4Value > 0) {
      path += ` Q ${topRightX} ${startY} ${topRightX} ${startY + r4Value}`
    }
    
    if (hasL3L4) {
      path += ` L ${topRightX} ${bottomY - l4Value}`
      path += ` L ${mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth) - l3Value} ${bottomY}`
    } else {
      path += ` L ${topRightX} ${bottomY - r2}`
      if (r2 > 0) {
        path += ` Q ${topRightX} ${bottomY} ${mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth) - r2} ${bottomY}`
      } else {
        path += ` L ${topRightX} ${bottomY}`
      }
    }
    
    if (hasL1L2) {
      path += ` L ${mainWorktopOffsetX + l1Value} ${bottomY}`
      path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
    } else {
      path += ` L ${mainWorktopOffsetX + r1} ${bottomY}`
      if (r1 > 0) {
        path += ` Q ${mainWorktopOffsetX} ${bottomY} ${mainWorktopOffsetX} ${bottomY - r1}`
      } else {
        path += ` L ${mainWorktopOffsetX} ${bottomY}`
      }
    }
    
    if (hasL5L6 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
      path += ` L ${mainWorktopOffsetX} ${startY + l6Value}`
      path += ` L ${mainWorktopOffsetX + l5Value} ${startY}`
    } else if (r3Value > 0 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
      path += ` L ${mainWorktopOffsetX} ${startY + r3Value}`
      path += ` Q ${mainWorktopOffsetX} ${startY} ${mainWorktopOffsetX + r3Value} ${startY}`
    } else {
      path += ` L ${mainWorktopOffsetX} ${startY}`
    }
    
    path += ' Z'
    return path
  }
  
  // Build perpendicular rectangle path
  const buildPerpendicularRectPath = (): string => {
    if (!showLeftPerpendicularRect) return ''
    
    const rectX = 0
    const rectY = isJobbos ? 0 : worktopLength
    const rectWidth = leftPerpendicularRectWidth
    const rectHeight = leftPerpendicularRectHeight
    const r1 = leftPerpendicularRectR1
    
    const bottomRightX = rectX + rectWidth
    const bottomRightY = rectY + rectHeight
    const bottomLeftX = rectX
    const bottomLeftY = bottomRightY
    
    let path = `M ${rectX} ${rectY}`
    path += ` L ${bottomRightX} ${rectY}`
    
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
    
    if (hasLeftPerpendicularL5L6) {
      path += ` L ${bottomLeftX + l5Value} ${bottomLeftY}`
    } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
      path += ` L ${bottomLeftX + leftPerpendicularRectR3} ${bottomLeftY}`
    } else {
      path += ` L ${bottomLeftX} ${bottomLeftY}`
    }
    
    if (hasLeftPerpendicularL5L6) {
      path += ` L ${bottomLeftX} ${bottomLeftY - l6Value}`
    } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
      path += ` Q ${bottomLeftX} ${bottomLeftY} ${bottomLeftX} ${bottomLeftY - leftPerpendicularRectR3}`
    }
    
    path += ` L ${rectX} ${rectY}`
    path += ' Z'
    return path
  }
  
  // Build edge highlighting paths - EXACT paths from WorktopConfigClient
  const buildEdgePaths = () => {
    // Edge styling - EXACT from WorktopConfigClient
    // Converted to greyscale
    const edgeColor = '#4a4a4a'  // Dark grey (was red #ff6b6b)
    const edgeThickness = 15
    const dashArray = '8,4'
    const edgeOpacity = 0.7
    
    // Calculate values needed for edge paths
    const effectiveWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
    const effectiveHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
    const r1 = (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') ? 0 : Math.min(r1Value, effectiveWidth / 2, effectiveHeight)
    const r2 = Math.min(r2Value, effectiveWidth / 2, effectiveHeight)
    const rightEdge = showCut ? cutPosition : worktopWidth
    
    // Build individual edge paths - EXACT from WorktopConfigClient
    const buildLeftEdgePath = (): string => {
      // For Összemarás jobbos: 1. oldal is the C×D rectangle's left edge
      if (isJobbos && showLeftPerpendicularRect) {
        const rectX = 0
        const rectY = 0
        const rectHeight = leftPerpendicularRectHeight
        const bottomY = rectY + rectHeight
        
        let path = `M ${rectX} ${rectY}`
        
        if (hasLeftPerpendicularL5L6) {
          path += ` L ${rectX} ${bottomY - l6Value}`
          path += ` L ${rectX + l5Value} ${bottomY}`
        } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
          path += ` L ${rectX} ${bottomY - leftPerpendicularRectR3}`
          path += ` Q ${rectX} ${bottomY} ${rectX + leftPerpendicularRectR3} ${bottomY}`
        } else {
          path += ` L ${rectX} ${bottomY}`
        }
        
        return path
      }
      
      // For Összemarás Balos: extend the left edge down the perpendicular rectangle's left edge
      if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
        const topLeftX = mainWorktopOffsetX
        const topLeftY = startY
        
        let path = `M ${topLeftX} ${topLeftY}`
        
        if (hasL1L2) {
          path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
        } else {
          path += ` L ${mainWorktopOffsetX} ${bottomY - r1}`
        }
        
        const perpendicularRectTopY = worktopLength
        const perpendicularRectBottomY = worktopLength + leftPerpendicularRectHeight
        path += ` L ${mainWorktopOffsetX} ${perpendicularRectTopY}`
        
        if (hasLeftPerpendicularL5L6) {
          path += ` L ${mainWorktopOffsetX} ${perpendicularRectBottomY - l6Value}`
          path += ` L ${mainWorktopOffsetX + l5Value} ${perpendicularRectBottomY}`
        } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
          path += ` L ${mainWorktopOffsetX} ${perpendicularRectBottomY - leftPerpendicularRectR3}`
          path += ` Q ${mainWorktopOffsetX} ${perpendicularRectBottomY} ${mainWorktopOffsetX + leftPerpendicularRectR3} ${perpendicularRectBottomY}`
        } else {
          path += ` L ${mainWorktopOffsetX} ${perpendicularRectBottomY}`
        }
        
        return path
      }
      
      // Default: Left edge goes from top to bottom, ending where bottom corner starts
      const topLeftX = mainWorktopOffsetX
      const topLeftY = startY
      
      let path = ''
      
      if (hasL5L6) {
        path = `M ${topLeftX} ${topLeftY + l6Value}`
      } else if (r3Value > 0) {
        path = `M ${topLeftX} ${topLeftY + r3Value}`
      } else {
        path = `M ${topLeftX} ${topLeftY}`
      }
      
      if (hasL1L2) {
        path += ` L ${mainWorktopOffsetX} ${bottomY - l2Value}`
      } else {
        path += ` L ${mainWorktopOffsetX} ${bottomY - r1}`
      }
      
      return path
    }
    
    const buildTopEdgePath = (): string => {
      // For Összemarás jobbos: 2. oldal includes both perpendicular rectangle's top edge AND main worktop's top edge
      if (isJobbos && showLeftPerpendicularRect) {
        const rectX = 0
        const rectY = 0
        const rectWidth = leftPerpendicularRectWidth
        
        let path = `M ${rectX} ${rectY}`
        path += ` L ${rectX + rectWidth} ${rectY}`
        
        const mainWorktopTopLeftX = rectWidth
        const mainWorktopTopRightX = rectWidth + (showCut ? cutPosition : worktopWidth)
        
        if (hasL7L8) {
          path += ` L ${mainWorktopTopRightX - l7Value} ${rectY}`
          path += ` L ${mainWorktopTopRightX} ${rectY + l8Value}`
        } else if (r4Value > 0) {
          path += ` L ${mainWorktopTopRightX - r4Value} ${rectY}`
          path += ` Q ${mainWorktopTopRightX} ${rectY} ${mainWorktopTopRightX} ${rectY + r4Value}`
        } else {
          path += ` L ${mainWorktopTopRightX} ${rectY}`
        }
        
        return path
      }
      
      // Default: Top edge of main worktop
      const topLeftX = mainWorktopOffsetX
      const topLeftY = startY
      const topRightX = showCut ? (mainWorktopOffsetX + cutPosition) : (mainWorktopOffsetX + worktopWidth)
      const topRightY = startY
      
      let path = ''
      
      if (hasL5L6 && !hasLeftPerpendicularL5L6) {
        path = `M ${topLeftX} ${topLeftY + l6Value}`
        path += ` L ${topLeftX + l5Value} ${topLeftY}`
      } else if (r3Value > 0 && !hasLeftPerpendicularR3) {
        path = `M ${topLeftX} ${topLeftY + r3Value}`
        path += ` Q ${topLeftX} ${topLeftY} ${topLeftX + r3Value} ${topLeftY}`
      } else {
        path = `M ${topLeftX} ${topLeftY}`
      }
      
      if (hasL7L8) {
        path += ` L ${topRightX - l7Value} ${topRightY}`
        path += ` L ${topRightX} ${topRightY + l8Value}`
      } else if (r4Value > 0) {
        path += ` L ${topRightX - r4Value} ${topRightY}`
        path += ` Q ${topRightX} ${topRightY} ${topRightX} ${topRightY + r4Value}`
      } else {
        path += ` L ${topRightX} ${topRightY}`
      }
      
      return path
    }
    
    const buildRightEdgePath = (): string => {
      const topRightX = mainWorktopOffsetX + rightEdge
      const topRightY = startY
      
      let startYPos = topRightY
      if (hasL7L8) {
        startYPos = topRightY + l8Value
      } else if (r4Value > 0) {
        startYPos = topRightY + r4Value
      }
      
      let path = `M ${topRightX} ${startYPos}`
      if (showCut) {
        if (hasL3L4) {
          path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - l4Value}`
        } else {
          path += ` L ${mainWorktopOffsetX + cutPosition} ${bottomY - r2}`
        }
      } else {
        if (hasL3L4) {
          path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - l4Value}`
        } else {
          path += ` L ${mainWorktopOffsetX + worktopWidth} ${bottomY - r2}`
        }
      }
      return path
    }
    
    const buildBottomEdgePath = (): string => {
      let path = ''
      let bottomEdgeStartX: number
      let bottomEdgeEndX: number
      
      if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
        bottomEdgeStartX = leftPerpendicularRectWidth
        bottomEdgeEndX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
      } else {
        bottomEdgeStartX = mainWorktopOffsetX
        bottomEdgeEndX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
      }
      
      if (hasL1L2 && assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
        path = `M ${mainWorktopOffsetX} ${bottomY - l2Value}`
        path += ` L ${mainWorktopOffsetX + l1Value} ${bottomY}`
      } else if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
        path = `M ${bottomEdgeStartX} ${bottomY}`
      } else if (isJobbos && showLeftPerpendicularRect) {
        path = `M ${bottomEdgeStartX} ${bottomY}`
      } else {
        path = `M ${mainWorktopOffsetX} ${bottomY - r1}`
        if (r1 > 0) {
          path += ` Q ${mainWorktopOffsetX} ${bottomY} ${mainWorktopOffsetX + r1} ${bottomY}`
        } else {
          path += ` L ${mainWorktopOffsetX} ${bottomY}`
        }
      }
      
      if (showCut) {
        if (hasL3L4) {
          path += ` L ${bottomEdgeEndX - l3Value} ${bottomY}`
          path += ` L ${bottomEdgeEndX} ${bottomY - l4Value}`
        } else {
          if (r2 > 0) {
            path += ` L ${bottomEdgeEndX - r2} ${bottomY}`
            path += ` Q ${bottomEdgeEndX} ${bottomY} ${bottomEdgeEndX} ${bottomY - r2}`
          } else {
            path += ` L ${bottomEdgeEndX} ${bottomY}`
          }
        }
      } else {
        if (hasL3L4) {
          path += ` L ${bottomEdgeEndX - l3Value} ${bottomY}`
          path += ` L ${bottomEdgeEndX} ${bottomY - l4Value}`
        } else {
          if (r2 > 0) {
            path += ` L ${bottomEdgeEndX - r2} ${bottomY}`
            path += ` Q ${bottomEdgeEndX} ${bottomY} ${bottomEdgeEndX} ${bottomY - r2}`
          } else {
            path += ` L ${bottomEdgeEndX} ${bottomY}`
          }
        }
      }
      return path
    }
    
    const buildPerpendicularRightEdgePath = (): string => {
      if (isJobbos && showLeftPerpendicularRect) {
        const rectX = 0
        const rectY = 0
        const rectWidth = leftPerpendicularRectWidth
        const rectHeight = leftPerpendicularRectHeight
        const rightEdgeX = rectX + rectWidth
        const startY = rectY + bValue
        const endY = rectY + rectHeight
        const r1 = leftPerpendicularRectR1
        
        let path = `M ${rightEdgeX} ${startY}`
        
        if (hasLeftPerpendicularL1L2) {
          path += ` L ${rightEdgeX} ${endY - l2Value}`
          path += ` L ${rightEdgeX - l1Value} ${endY}`
        } else {
          path += ` L ${rightEdgeX} ${endY - r1}`
          if (r1 > 0) {
            path += ` Q ${rightEdgeX} ${endY} ${rightEdgeX - r1} ${endY}`
          } else {
            path += ` L ${rightEdgeX} ${endY}`
          }
        }
        
        return path
      }
      
      // For Összemarás Balos
      const rectX = 0
      const rectY = worktopLength
      const rectWidth = leftPerpendicularRectWidth
      const rectHeight = leftPerpendicularRectHeight
      const rightEdgeX = rectX + rectWidth
      const topY = rectY
      const bottomY = rectY + rectHeight
      const r1 = leftPerpendicularRectR1
      
      let path = `M ${rightEdgeX} ${topY}`
      
      if (hasLeftPerpendicularL1L2) {
        path += ` L ${rightEdgeX} ${bottomY - l2Value}`
        path += ` L ${rightEdgeX - l1Value} ${bottomY}`
      } else {
        path += ` L ${rightEdgeX} ${bottomY - r1}`
        if (r1 > 0) {
          path += ` Q ${rightEdgeX} ${bottomY} ${rightEdgeX - r1} ${bottomY}`
        } else {
          path += ` L ${rightEdgeX} ${bottomY}`
        }
      }
      
      return path
    }
    
    const buildPerpendicularBottomEdgePath = (): string => {
      if (isJobbos && showLeftPerpendicularRect) {
        const rectX = 0
        const rectY = 0
        const rectWidth = leftPerpendicularRectWidth
        const rectHeight = leftPerpendicularRectHeight
        const bottomY = rectY + rectHeight
        const rightEdgeX = rectX + rectWidth
        const r1 = leftPerpendicularRectR1
        
        let path = ''
        if (hasLeftPerpendicularL5L6) {
          path = `M ${rectX + l5Value} ${bottomY}`
        } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
          path = `M ${rectX + leftPerpendicularRectR3} ${bottomY}`
        } else {
          path = `M ${rectX} ${bottomY}`
        }
        
        if (hasLeftPerpendicularL1L2) {
          path += ` L ${rightEdgeX - l1Value} ${bottomY}`
          path += ` L ${rightEdgeX} ${bottomY - l2Value}`
        } else {
          path += ` L ${rightEdgeX - r1} ${bottomY}`
          if (r1 > 0) {
            path += ` Q ${rightEdgeX} ${bottomY} ${rightEdgeX} ${bottomY - r1}`
          } else {
            path += ` L ${rightEdgeX} ${bottomY}`
          }
        }
        
        return path
      }
      
      // For Összemarás Balos
      const rectX = 0
      const rectY = worktopLength
      const rectWidth = leftPerpendicularRectWidth
      const rectHeight = leftPerpendicularRectHeight
      const bottomY = rectY + rectHeight
      const rightEdgeX = rectX + rectWidth
      const r1 = leftPerpendicularRectR1
      
      let path = ''
      if (hasLeftPerpendicularL5L6) {
        path = `M ${rectX + l5Value} ${bottomY}`
      } else if (hasLeftPerpendicularR3 && leftPerpendicularRectR3 > 0) {
        path = `M ${rectX + leftPerpendicularRectR3} ${bottomY}`
      } else {
        path = `M ${rectX} ${bottomY}`
      }
      
      if (hasLeftPerpendicularL1L2) {
        path += ` L ${rightEdgeX - l1Value} ${bottomY}`
        path += ` L ${rightEdgeX} ${bottomY - l2Value}`
      } else {
        path += ` L ${rightEdgeX - r1} ${bottomY}`
        if (r1 > 0) {
          path += ` Q ${rightEdgeX} ${bottomY} ${rightEdgeX} ${bottomY - r1}`
        } else {
          path += ` L ${rightEdgeX} ${bottomY}`
        }
      }
      
      return path
    }
    
    const paths: string[] = []
    
    // 1. oldal - Left edge
    if (config.edge_position1) {
      const leftPath = buildLeftEdgePath()
      paths.push(`<path d="${leftPath}" fill="none" stroke="${edgeColor}" stroke-width="${edgeThickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashArray}" stroke-opacity="${edgeOpacity}"/>`)
    }
    
    // 2. oldal - Top edge
    if (config.edge_position2) {
      const topPath = buildTopEdgePath()
      paths.push(`<path d="${topPath}" fill="none" stroke="${edgeColor}" stroke-width="${edgeThickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashArray}" stroke-opacity="${edgeOpacity}"/>`)
    }
    
    // 3. oldal - Right edge
    if (config.edge_position3) {
      const rightPath = buildRightEdgePath()
      paths.push(`<path d="${rightPath}" fill="none" stroke="${edgeColor}" stroke-width="${edgeThickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashArray}" stroke-opacity="${edgeOpacity}"/>`)
    }
    
    // 4. oldal - Bottom edge
    if (config.edge_position4) {
      const bottomPath = buildBottomEdgePath()
      paths.push(`<path d="${bottomPath}" fill="none" stroke="${edgeColor}" stroke-width="${edgeThickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashArray}" stroke-opacity="${edgeOpacity}"/>`)
    }
    
    // 5. oldal - Perpendicular rectangle right edge
    if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && config.edge_position5) {
      const perpRightPath = buildPerpendicularRightEdgePath()
      paths.push(`<path d="${perpRightPath}" fill="none" stroke="${edgeColor}" stroke-width="${edgeThickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashArray}" stroke-opacity="${edgeOpacity}"/>`)
    }
    
    // 6. oldal - Perpendicular rectangle bottom edge
    if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && config.edge_position6) {
      const perpBottomPath = buildPerpendicularBottomEdgePath()
      paths.push(`<path d="${perpBottomPath}" fill="none" stroke="${edgeColor}" stroke-width="${edgeThickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dashArray}" stroke-opacity="${edgeOpacity}"/>`)
    }
    
    return paths.join('\n        ')
  }
  
  // Build edge position labels (1. oldal, 2. oldal, etc.) - EXACT from WorktopConfigClient
  const buildEdgePositionLabels = (): string => {
    const labels: string[] = []
    
    // Calculate edge center points
    const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
    const centerX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth) / 2
    const centerY = (startY + bottomY) / 2
    
    // Extension line offset (distance from edge to label) - proportional
    const worktopWidthForCalc = showCut ? cutPosition : worktopWidth
    const minDimension = Math.min(worktopWidthForCalc, bottomY - startY)
    const extensionOffset = minDimension * 0.15 // 15% of smaller dimension
    
    // Calculate edge center points
    let leftEdgeX: number
    let leftEdgeY: number
    if (isJobbos && showLeftPerpendicularRect) {
      // For Összemarás jobbos: 1. oldal is the perpendicular rectangle's left edge
      leftEdgeX = 0
      leftEdgeY = leftPerpendicularRectHeight / 2
    } else if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
      // For Összemarás Balos: left edge includes both main worktop and perpendicular rectangle
      leftEdgeX = 0
      const combinedTopY = startY
      const combinedBottomY = worktopLength + leftPerpendicularRectHeight
      leftEdgeY = (combinedTopY + combinedBottomY) / 2
    } else {
      // For other types: left edge center is just the main worktop center
      leftEdgeX = mainWorktopOffsetX
      leftEdgeY = centerY
    }
    
    // 2. oldal - Top edge center
    let topEdgeX: number
    let topEdgeY: number
    if (isJobbos && showLeftPerpendicularRect) {
      // For Összemarás jobbos: 2. oldal includes both perpendicular rectangle's top edge AND main worktop's top edge
      const combinedLeftX = 0
      const combinedRightX = leftPerpendicularRectWidth + (showCut ? cutPosition : worktopWidth)
      topEdgeX = (combinedLeftX + combinedRightX) / 2
      topEdgeY = 0
    } else {
      // For other types: top edge center is just the main worktop center
      topEdgeX = centerX
      topEdgeY = startY
    }
    
    // 3. oldal - Right edge center
    const rightEdgeX = rightEdge
    const rightEdgeY = centerY
    
    // 4. oldal - Bottom edge center
    const bottomEdgeX = centerX
    const bottomEdgeY = bottomY
    
    // Label positions - outside worktop
    const leftLabelX = leftEdgeX - extensionOffset
    const leftLabelY = leftEdgeY
    const topLabelX = topEdgeX
    const topLabelY = topEdgeY - extensionOffset
    const rightLabelX = rightEdgeX + extensionOffset
    const rightLabelY = rightEdgeY
    const bottomLabelX = bottomEdgeX
    const bottomLabelY = bottomY + extensionOffset
    
    // 1. oldal - Left edge label
    if (config.edge_position1) {
      labels.push(`
        <text x="${leftLabelX}" y="${leftLabelY}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${leftLabelX} ${leftLabelY})" font-size="80" font-weight="600" fill="#000000">1. oldal</text>
      `)
    }
    
    // 2. oldal - Top edge label
    if (config.edge_position2) {
      labels.push(`
        <text x="${topLabelX}" y="${topLabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="600" fill="#000000">2. oldal</text>
      `)
    }
    
    // 3. oldal - Right edge label
    if (config.edge_position3) {
      labels.push(`
        <text x="${rightLabelX}" y="${rightLabelY}" text-anchor="middle" dominant-baseline="middle" transform="rotate(90 ${rightLabelX} ${rightLabelY})" font-size="80" font-weight="600" fill="#000000">3. oldal</text>
      `)
    }
    
    // 4. oldal - Bottom edge label
    if (config.edge_position4) {
      labels.push(`
        <text x="${bottomLabelX}" y="${bottomLabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="600" fill="#000000">4. oldal</text>
      `)
    }
    
    // 5. oldal - Perpendicular rectangle right edge label (C dimension)
    if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && config.edge_position5) {
      if (isJobbos) {
        // For jobbos: 5. oldal is the C×D rectangle's right edge minus B from top
        const perpendicularRectRightX = leftPerpendicularRectWidth
        const bValue = parseFloat(String(config.dimension_b)) || 0
        const perpendicularRectTopY = bValue
        const perpendicularRectBottomY = leftPerpendicularRectHeight
        const perpendicularRectCenterY = (perpendicularRectTopY + perpendicularRectBottomY) / 2
        
        const labelX = perpendicularRectRightX + extensionOffset
        const labelY = perpendicularRectCenterY
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${labelX} ${labelY})" font-size="80" font-weight="600" fill="#000000">5. oldal</text>
        `)
      } else {
        // For Balos: Perpendicular rectangle right edge
        const perpendicularRectRightX = leftPerpendicularRectWidth
        const perpendicularRectTopY = worktopLength
        const perpendicularRectBottomY = worktopLength + leftPerpendicularRectHeight
        const perpendicularRectCenterY = (perpendicularRectTopY + perpendicularRectBottomY) / 2
        
        const labelX = perpendicularRectRightX + extensionOffset
        const labelY = perpendicularRectCenterY
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${labelX} ${labelY})" font-size="80" font-weight="600" fill="#000000">5. oldal</text>
        `)
      }
    }
    
    // 6. oldal - Perpendicular rectangle bottom edge label (D dimension)
    if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect && config.edge_position6) {
      if (isJobbos) {
        // For jobbos: 6. oldal is the C×D rectangle's bottom D edge
        const perpendicularRectBottomY = leftPerpendicularRectHeight
        const perpendicularRectLeftX = 0
        const perpendicularRectRightX = leftPerpendicularRectWidth
        const perpendicularRectCenterX = (perpendicularRectLeftX + perpendicularRectRightX) / 2
        
        const labelX = perpendicularRectCenterX
        const labelY = perpendicularRectBottomY + extensionOffset
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="600" fill="#000000">6. oldal</text>
        `)
      } else {
        // For Balos: Perpendicular rectangle bottom edge
        const perpendicularRectBottomY = worktopLength + leftPerpendicularRectHeight
        const perpendicularRectLeftX = 0
        const perpendicularRectRightX = leftPerpendicularRectWidth
        const perpendicularRectCenterX = (perpendicularRectLeftX + perpendicularRectRightX) / 2
        
        const labelX = perpendicularRectCenterX
        const labelY = perpendicularRectBottomY + extensionOffset
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="600" fill="#000000">6. oldal</text>
        `)
      }
    }
    
    return labels.join('\n        ')
  }
  
  // Build dimension labels
  const buildDimensionLabels = (): string => {
    const labels: string[] = []
    const fontSize = 100
    
    // A dimension (width) - for Levágás: BELOW worktop
    if (assemblyType === 'Levágás' && showCut) {
      const extensionLineOffset = labelOffsets.bottom.aDimension
      const dimensionLineY = bottomY + extensionLineOffset
      const labelY = dimensionLineY + 60
      
      // For Levágás: extension lines start from 0 (left edge), not mainWorktopOffsetX
      labels.push(`
        <g>
          <line x1="0" y1="${bottomY}" x2="0" y2="${dimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${cutPosition}" y1="${bottomY}" x2="${cutPosition}" y2="${dimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="0" y1="${dimensionLineY}" x2="${cutPosition}" y2="${dimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${cutPosition / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="500" fill="#333333">A: ${cutPosition}mm</text>
        </g>
      `)
    } else if (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') {
      // A dimension for Összemarás: ABOVE worktop
      const extensionLineOffset = labelOffsets.top.aDimension
      const dimensionLineY = startY - extensionLineOffset
      const labelY = dimensionLineY - 60
      
      let aDimensionStartX: number
      let aDimensionEndX: number
      
      if (isJobbos && showLeftPerpendicularRect) {
        aDimensionStartX = 0
        aDimensionEndX = leftPerpendicularRectWidth + worktopWidth
      } else {
        aDimensionStartX = mainWorktopOffsetX
        aDimensionEndX = mainWorktopOffsetX + worktopWidth
      }
      
      labels.push(`
        <g>
          <line x1="${aDimensionStartX}" y1="${startY}" x2="${aDimensionStartX}" y2="${dimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${aDimensionEndX}" y1="${startY}" x2="${aDimensionEndX}" y2="${dimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${aDimensionStartX}" y1="${dimensionLineY}" x2="${aDimensionEndX}" y2="${dimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${(aDimensionStartX + aDimensionEndX) / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="500" fill="#333333">A: ${aValue}mm</text>
        </g>
      `)
    }
    
    // B dimension (height) - For both Levágás and Összemarás
    if (bValue > 0) {
      let rightEdge: number
      let bStartY: number
      let bBottomY: number
      
      if (assemblyType === 'Levágás' && showCut) {
        // For Levágás: B dimension is the height (worktopLength), displayed on right side
        rightEdge = cutPosition
        bStartY = 0
        bBottomY = worktopLength
      } else {
        // For Összemarás: B dimension on right side of main worktop
        rightEdge = mainWorktopOffsetX + worktopWidth
        bStartY = startY
        bBottomY = bottomY
      }
      
      // Use unified spacing offset (positioned after L8)
      const extensionLineOffset = labelOffsets.right.bDimension
      let dimensionLineX = rightEdge + extensionLineOffset
      let labelX = dimensionLineX + 50
      
      // Ensure B label stays within viewBox
      const maxRightPosition = rightEdge + labelPaddingRight - 100
      if (labelX > maxRightPosition) {
        dimensionLineX = maxRightPosition - 50
        labelX = maxRightPosition
      }
      
      labels.push(`
        <g>
          <line x1="${rightEdge}" y1="${bStartY}" x2="${dimensionLineX}" y2="${bStartY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${rightEdge}" y1="${bBottomY}" x2="${dimensionLineX}" y2="${bBottomY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${dimensionLineX}" y1="${bStartY}" x2="${dimensionLineX}" y2="${bBottomY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${labelX}" y="${(bStartY + bBottomY) / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${labelX} ${(bStartY + bBottomY) / 2})" font-size="${fontSize}" font-weight="500" fill="#333333">B: ${bValue}mm</text>
        </g>
      `)
    }
    
    // C-D dimension for perpendicular rectangle
    if (showLeftPerpendicularRect && cValue > 0 && dValue > 0) {
      const rectX = 0
      const rectY = isJobbos ? 0 : worktopLength
      const rectWidth = leftPerpendicularRectWidth
      const rectHeight = leftPerpendicularRectHeight
      const bottomRightY = rectY + rectHeight
      
      // D dimension (width) - use unified spacing
      const dExtensionLineOffset = labelOffsets.bottom.dDimension
      const dimensionLineY = bottomRightY + dExtensionLineOffset
      const labelY = dimensionLineY + 60
      
      labels.push(`
        <line x1="${rectX}" y1="${bottomRightY}" x2="${rectX}" y2="${dimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
        <line x1="${rectX + rectWidth}" y1="${bottomRightY}" x2="${rectX + rectWidth}" y2="${dimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
        <line x1="${rectX}" y1="${dimensionLineY}" x2="${rectX + rectWidth}" y2="${dimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
        <text x="${rectX + rectWidth / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="500" fill="#333333">D: ${dValue}mm</text>
      `)
      
      // C dimension (height) - vertical on LEFT side - use unified spacing
      let topY: number
      let bottomY2: number
      
      if (isJobbos) {
        topY = 0
        bottomY2 = leftPerpendicularRectHeight
      } else {
        topY = startY
        bottomY2 = worktopLength + leftPerpendicularRectHeight
      }
      
      const extensionLineOffset = labelOffsets.left.cDimension
      const dimensionLineX = -extensionLineOffset
      const labelX = dimensionLineX - 60
      
      labels.push(`
        <g>
          <line x1="0" y1="${topY}" x2="${dimensionLineX}" y2="${topY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="0" y1="${bottomY2}" x2="${dimensionLineX}" y2="${bottomY2}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${dimensionLineX}" y1="${topY}" x2="${dimensionLineX}" y2="${bottomY2}" stroke="#000000" stroke-width="1.5"/>
          <text x="${labelX}" y="${(topY + bottomY2) / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${labelX} ${(topY + bottomY2) / 2})" font-size="${fontSize}" font-weight="500" fill="#333333">C: ${cValue}mm</text>
        </g>
      `)
    }
    
    // R1 label
    if (r1ValueRaw > 0) {
      if (showLeftPerpendicularRect && leftPerpendicularRectR1 > 0) {
        const rectX = 0
        const rectY = isJobbos ? 0 : worktopLength
        const bottomRightX = leftPerpendicularRectWidth
        const bottomRightY = rectY + leftPerpendicularRectHeight
        const r1 = leftPerpendicularRectR1
        const labelX = bottomRightX - r1 * 0.6
        const labelY = bottomRightY - r1 * 0.6
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="end" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333333">R1</text>
        `)
      } else if (assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos' && r1Value > 0) {
        const labelX = r1Value * 0.6
        const labelY = bottomY - r1Value * 0.6
        if (labelY >= startY) {
          labels.push(`
            <text x="${labelX}" y="${labelY}" text-anchor="start" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333333">R1</text>
          `)
        }
      }
    }
    
    // R2 label (bottom-right corner)
    if (r2Value > 0 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
      const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
      const labelX = rightEdge - r2Value * 0.6
      const labelY = bottomY - r2Value * 0.6
      if (labelY >= startY && labelX >= mainWorktopOffsetX && labelX <= rightEdge) {
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="end" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333333">R2</text>
        `)
      }
    }
    
    // R3 label
    if (r3ValueRaw > 0 && (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')) {
      if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && showLeftPerpendicularRect) {
        const rectX = 0
        const rectY = isJobbos ? 0 : worktopLength
        const bottomLeftX = rectX
        const bottomLeftY = rectY + leftPerpendicularRectHeight
        const r3 = leftPerpendicularRectR3
        const labelX = bottomLeftX + r3 * 0.6
        const labelY = bottomLeftY - r3 * 0.6
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="start" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333333">R3</text>
        `)
      } else {
        const topLeftX = mainWorktopOffsetX
        const topLeftY = startY
        const labelX = topLeftX + r3Value * 0.6
        const labelY = topLeftY + r3Value * 0.6
        
        labels.push(`
          <text x="${labelX}" y="${labelY}" text-anchor="start" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333333">R3</text>
        `)
      }
    }
    
    // R4 label (top-right corner)
    if (r4ValueRaw > 0 && (assemblyType === 'Levágás' || assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')) {
      const topRightX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
      const topRightY = startY
      const labelX = topRightX - r4Value * 0.6
      const labelY = topRightY + r4Value * 0.6
      
      labels.push(`
        <text x="${labelX}" y="${labelY}" text-anchor="end" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333333">R4</text>
      `)
    }
    
    // L1-L2 chamfer dimension labels (bottom-left corner)
    if (hasL1L2) {
      const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
      const bottomY = worktopLength
      
      // Use unified spacing offsets
      const l1ExtensionLineOffset = labelOffsets.bottom.l1Dimension
      const l1DimensionLineY = bottomY + l1ExtensionLineOffset
      const l1LabelY = l1DimensionLineY + 60
      const l2ExtensionLineOffset = labelOffsets.left.l2Dimension
      const l2DimensionLineX = -l2ExtensionLineOffset
      const l2LabelX = l2DimensionLineX - 50
      
      labels.push(`
        <g>
          <!-- L1 dimension - horizontal distance from left edge -->
          <line x1="0" y1="${bottomY}" x2="0" y2="${l1DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${l1Value}" y1="${bottomY}" x2="${l1Value}" y2="${l1DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="0" y1="${l1DimensionLineY}" x2="${l1Value}" y2="${l1DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${l1Value / 2}" y="${l1LabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">L1: ${l1Value}mm</text>
          
          <!-- L2 dimension - vertical distance from bottom edge -->
          <line x1="0" y1="${bottomY - l2Value}" x2="${l2DimensionLineX}" y2="${bottomY - l2Value}" stroke="#000000" stroke-width="1.5"/>
          <line x1="0" y1="${bottomY}" x2="${l2DimensionLineX}" y2="${bottomY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${l2DimensionLineX}" y1="${bottomY - l2Value}" x2="${l2DimensionLineX}" y2="${bottomY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${l2LabelX}" y="${bottomY - l2Value / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${l2LabelX} ${bottomY - l2Value / 2})" font-size="80" font-weight="500" fill="#666">L2: ${l2Value}mm</text>
        </g>
      `)
    }
    
    // L3-L4 chamfer dimension labels (bottom-right corner)
    if (hasL3L4 && assemblyType !== 'Összemarás U alak (Nem működik még)') {
      const rightEdge = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
      const bottomY = worktopLength
      
      // Use unified spacing offsets
      const l3ExtensionLineOffset = labelOffsets.bottom.l3Dimension
      const l3DimensionLineY = bottomY + l3ExtensionLineOffset
      const l3LabelY = l3DimensionLineY + 60
      
      // L4 uses right side offset (positioned after B dimension)
      const l4ExtensionLineOffset = labelOffsets.right.l4Dimension
      const l4DimensionLineX = rightEdge + l4ExtensionLineOffset
      const l4LabelX = l4DimensionLineX + 50
      
      let l4LabelY = bottomY - l4Value / 2
      if ((assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos') && bValue > 0) {
        const bLabelY = (startY + bottomY) / 2
        l4LabelY = bLabelY + 120
      }
      
      labels.push(`
        <g>
          <!-- L3 dimension - horizontal distance from right edge -->
          <line x1="${rightEdge}" y1="${bottomY}" x2="${rightEdge}" y2="${l3DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${rightEdge - l3Value}" y1="${bottomY}" x2="${rightEdge - l3Value}" y2="${l3DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${rightEdge - l3Value}" y1="${l3DimensionLineY}" x2="${rightEdge}" y2="${l3DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${rightEdge - l3Value / 2}" y="${l3LabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">L3: ${l3Value}mm</text>
          
          <!-- L4 dimension - vertical distance from bottom edge -->
          <line x1="${rightEdge}" y1="${bottomY - l4Value}" x2="${l4DimensionLineX}" y2="${bottomY - l4Value}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${rightEdge}" y1="${bottomY}" x2="${l4DimensionLineX}" y2="${bottomY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${l4DimensionLineX}" y1="${bottomY - l4Value}" x2="${l4DimensionLineX}" y2="${bottomY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${l4LabelX}" y="${l4LabelY}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${l4LabelX} ${l4LabelY})" font-size="80" font-weight="500" fill="#666">L4: ${l4Value}mm</text>
        </g>
      `)
    }
    
    // L7-L8 chamfer dimension labels (top-right corner)
    if (hasL7L8) {
      const topRightX = mainWorktopOffsetX + (showCut ? cutPosition : worktopWidth)
      const topRightY = startY
      
      // Use unified spacing offsets
      const l7ExtensionLineOffset = labelOffsets.top.l7Dimension
      const l7DimensionLineY = topRightY - l7ExtensionLineOffset
      const l7LabelY = l7DimensionLineY - 60
      
      // L8 uses right side offset (positioned before B dimension)
      const l8ExtensionLineOffset = labelOffsets.right.l8Dimension
      const l8DimensionLineX = topRightX + l8ExtensionLineOffset
      const l8LabelX = l8DimensionLineX + 50
      
      labels.push(`
        <g>
          <!-- L7 dimension - horizontal distance from right edge -->
          <line x1="${topRightX}" y1="${topRightY}" x2="${topRightX}" y2="${l7DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${topRightX - l7Value}" y1="${topRightY}" x2="${topRightX - l7Value}" y2="${l7DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${topRightX - l7Value}" y1="${l7DimensionLineY}" x2="${topRightX}" y2="${l7DimensionLineY}" stroke="#000000" stroke-width="1.5"/>
          <text x="${topRightX - l7Value / 2}" y="${l7LabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">L7: ${l7Value}mm</text>
          
          <!-- L8 dimension - vertical distance from top edge -->
          <line x1="${topRightX}" y1="${topRightY}" x2="${l8DimensionLineX}" y2="${topRightY}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${topRightX}" y1="${topRightY + l8Value}" x2="${l8DimensionLineX}" y2="${topRightY + l8Value}" stroke="#000000" stroke-width="1.5"/>
          <line x1="${l8DimensionLineX}" y1="${topRightY}" x2="${l8DimensionLineX}" y2="${topRightY + l8Value}" stroke="#000000" stroke-width="1.5"/>
          <text x="${l8LabelX}" y="${topRightY + l8Value / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${l8LabelX} ${topRightY + l8Value / 2})" font-size="80" font-weight="500" fill="#666">L8: ${l8Value}mm</text>
        </g>
      `)
    }
    
    // L5-L6 labels
    if (hasL5L6) {
      if (showLeftPerpendicularRect && hasLeftPerpendicularL5L6) {
        const rectX = 0
        const rectY = isJobbos ? 0 : worktopLength
        const bottomLeftX = rectX
        const bottomLeftY = rectY + leftPerpendicularRectHeight
        
        // Use unified spacing offsets
        const l5ExtensionLineOffset = labelOffsets.bottom.l5Dimension
        const l5DimensionLineY = bottomLeftY + l5ExtensionLineOffset
        const l5LabelY = l5DimensionLineY + 60
        const l6ExtensionLineOffset = labelOffsets.left.l6Dimension
        const l6DimensionLineX = -l6ExtensionLineOffset
        const l6LabelX = l6DimensionLineX - 50
        
        labels.push(`
          <line x1="${bottomLeftX}" y1="${bottomLeftY}" x2="${bottomLeftX}" y2="${l5DimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${bottomLeftX + l5Value}" y1="${bottomLeftY}" x2="${bottomLeftX + l5Value}" y2="${l5DimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${bottomLeftX}" y1="${l5DimensionLineY}" x2="${bottomLeftX + l5Value}" y2="${l5DimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <text x="${bottomLeftX + l5Value / 2}" y="${l5LabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">L5: ${l5Value}mm</text>
          
          <line x1="${bottomLeftX}" y1="${bottomLeftY}" x2="${l6DimensionLineX}" y2="${bottomLeftY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${bottomLeftX}" y1="${bottomLeftY - l6Value}" x2="${l6DimensionLineX}" y2="${bottomLeftY - l6Value}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${l6DimensionLineX}" y1="${bottomLeftY - l6Value}" x2="${l6DimensionLineX}" y2="${bottomLeftY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <text x="${l6LabelX}" y="${bottomLeftY - l6Value / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${l6LabelX} ${bottomLeftY - l6Value / 2})" font-size="80" font-weight="500" fill="#666">L6: ${l6Value}mm</text>
        `)
      } else if (assemblyType !== 'Összemarás Balos' && assemblyType !== 'Összemarás jobbos') {
        const topLeftX = mainWorktopOffsetX
        const topLeftY = startY
        // Use unified spacing offsets
        const l5ExtensionLineOffset = 100 // Top side, above worktop
        const l5DimensionLineY = topLeftY - l5ExtensionLineOffset
        const l5LabelY = l5DimensionLineY - 60
        const l6ExtensionLineOffset = labelOffsets.left.l6Dimension
        const l6DimensionLineX = -l6ExtensionLineOffset
        const l6LabelX = l6DimensionLineX - 50
        
        labels.push(`
          <line x1="${topLeftX}" y1="${topLeftY}" x2="${topLeftX}" y2="${l5DimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${topLeftX + l5Value}" y1="${topLeftY}" x2="${topLeftX + l5Value}" y2="${l5DimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${topLeftX}" y1="${l5DimensionLineY}" x2="${topLeftX + l5Value}" y2="${l5DimensionLineY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <text x="${topLeftX + l5Value / 2}" y="${l5LabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">L5: ${l5Value}mm</text>
          
          <line x1="${topLeftX}" y1="${topLeftY}" x2="${l6DimensionLineX}" y2="${topLeftY}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${topLeftX}" y1="${topLeftY + l6Value}" x2="${l6DimensionLineX}" y2="${topLeftY + l6Value}" stroke="#000" stroke-width="1.5" fill="none"/>
          <line x1="${l6DimensionLineX}" y1="${topLeftY}" x2="${l6DimensionLineX}" y2="${topLeftY + l6Value}" stroke="#000" stroke-width="1.5" fill="none"/>
          <text x="${l6LabelX}" y="${topLeftY + l6Value / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${l6LabelX} ${topLeftY + l6Value / 2})" font-size="80" font-weight="500" fill="#666">L6: ${l6Value}mm</text>
        `)
      }
    }
    
    return labels.join('\n        ')
  }
  
  // Build cutout position dimension labels - EXACT from WorktopConfigClient
  const buildCutoutDimensionLabels = (): string => {
    const labels: string[] = []
    
    cutouts.forEach((cutout: any, index: number) => {
      const cutoutWidth = parseFloat(cutout.width) || 0
      const cutoutHeight = parseFloat(cutout.height) || 0
      const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
      const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
      const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
      
      // Only show if valid
      if (cutoutWidth <= 0 || cutoutHeight <= 0) return
      
      if (isPerpendicular && showLeftPerpendicularRect) {
        // Cutout dimension labels for perpendicular rectangle
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
        if (distanceFromBottom + visualWidth > rectWidth || distanceFromLeft + visualHeight > rectHeight) return
        
        // Stack dimension labels in separate rows/columns to avoid overlap
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
        const verticalColumnSpacing = 120
        const verticalBaseOffset = 100
        const verticalDimensionLineX = rectX + rectWidth + verticalBaseOffset + (index * verticalColumnSpacing)
        const verticalLabelX = verticalDimensionLineX + 50
        
        labels.push(`
          <g>
            <!-- Horizontal dimension - távolság alulról (distance from RIGHT edge of perpendicular worktop) -->
            ${isJobbos ? `
              <!-- For jobbos: show above the perpendicular rectangle -->
              <line x1="${rectX + rectWidth}" y1="${rectY}" x2="${rectX + rectWidth}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
              <line x1="${visualRightEdgeX}" y1="${rectY}" x2="${visualRightEdgeX}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
              <line x1="${visualRightEdgeX}" y1="${horizontalDimensionLineY}" x2="${rectX + rectWidth}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
            ` : `
              <!-- For Balos: show below the perpendicular rectangle -->
              <line x1="${rectX + rectWidth}" y1="${rectY + rectHeight}" x2="${rectX + rectWidth}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
              <line x1="${visualRightEdgeX}" y1="${rectY + rectHeight}" x2="${visualRightEdgeX}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
              <line x1="${visualRightEdgeX}" y1="${horizontalDimensionLineY}" x2="${rectX + rectWidth}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
            `}
            <text x="${(visualRightEdgeX + rectX + rectWidth) / 2}" y="${horizontalLabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">${distanceFromBottom}mm</text>
            
            <!-- Vertical dimension - távolság balról (distance from BOTTOM edge of perpendicular worktop) - show on RIGHT side -->
            <line x1="${rectX + rectWidth}" y1="${visualBottomEdgeY}" x2="${verticalDimensionLineX}" y2="${visualBottomEdgeY}" stroke="#000000" stroke-width="1.5"/>
            <line x1="${rectX + rectWidth}" y1="${rectY + rectHeight}" x2="${verticalDimensionLineX}" y2="${rectY + rectHeight}" stroke="#000000" stroke-width="1.5"/>
            <line x1="${verticalDimensionLineX}" y1="${visualBottomEdgeY}" x2="${verticalDimensionLineX}" y2="${rectY + rectHeight}" stroke="#000000" stroke-width="1.5"/>
            <text x="${verticalLabelX}" y="${(visualBottomEdgeY + rectY + rectHeight) / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${verticalLabelX} ${(visualBottomEdgeY + rectY + rectHeight) / 2})" font-size="80" font-weight="500" fill="#666">${distanceFromLeft}mm</text>
          </g>
        `)
      } else {
        // Cutout dimension labels for main worktop
        const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
        const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
        
        // Check if cutout fits within kept portion
        if (distanceFromLeft + cutoutWidth > keptWidth || distanceFromBottom + cutoutHeight > keptHeight) return
        
        // Position: distanceFromLeft from left, distanceFromBottom from bottom of kept portion
        const x = mainWorktopOffsetX + distanceFromLeft
        const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
        
        // Don't render if outside bounds
        if (x < mainWorktopOffsetX || y < startY || x + cutoutWidth > mainWorktopOffsetX + keptWidth || y + cutoutHeight > worktopLength) return
        
        // Stack dimension labels using unified spacing offsets
        const horizontalRowSpacing = 120
        const horizontalBaseOffset = labelOffsets.bottom.cutoutHorizontal
        const horizontalDimensionLineY = worktopLength + horizontalBaseOffset + (index * horizontalRowSpacing)
        const horizontalLabelY = horizontalDimensionLineY + 60
        
        const verticalColumnSpacing = 120
        const verticalBaseOffset = labelOffsets.left.cutoutVertical
        const verticalDimensionLineX = -(verticalBaseOffset + (index * verticalColumnSpacing))
        const verticalLabelX = verticalDimensionLineX - 50
        
        // Extension lines should start from 0 (left edge of worktop), not mainWorktopOffsetX
        // This matches WorktopConfigClient exactly
        labels.push(`
          <g>
            <!-- Horizontal dimension - distance from left edge -->
            <line x1="0" y1="${worktopLength}" x2="0" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
            <line x1="${x}" y1="${worktopLength}" x2="${x}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
            <line x1="0" y1="${horizontalDimensionLineY}" x2="${x}" y2="${horizontalDimensionLineY}" stroke="#000000" stroke-width="1.5"/>
            <text x="${x / 2}" y="${horizontalLabelY}" text-anchor="middle" dominant-baseline="middle" font-size="80" font-weight="500" fill="#666">${distanceFromLeft}mm</text>
            
            <!-- Vertical dimension - distance from bottom -->
            <line x1="0" y1="${y + cutoutHeight}" x2="${verticalDimensionLineX}" y2="${y + cutoutHeight}" stroke="#000000" stroke-width="1.5"/>
            <line x1="0" y1="${worktopLength}" x2="${verticalDimensionLineX}" y2="${worktopLength}" stroke="#000000" stroke-width="1.5"/>
            <line x1="${verticalDimensionLineX}" y1="${y + cutoutHeight}" x2="${verticalDimensionLineX}" y2="${worktopLength}" stroke="#000000" stroke-width="1.5"/>
            <text x="${verticalLabelX}" y="${(y + cutoutHeight + worktopLength) / 2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${verticalLabelX} ${(y + cutoutHeight + worktopLength) / 2})" font-size="80" font-weight="500" fill="#666">${distanceFromBottom}mm</text>
          </g>
        `)
      }
    })
    
    return labels.join('\n        ')
  }
  
  // Build cutout elements
  const buildCutouts = (): string => {
    const elements: string[] = []
    
    cutouts.forEach((cutout: any, index: number) => {
      const cutoutWidth = parseFloat(cutout.width) || 0
      const cutoutHeight = parseFloat(cutout.height) || 0
      const distanceFromLeft = parseFloat(cutout.distanceFromLeft) || 0
      const distanceFromBottom = parseFloat(cutout.distanceFromBottom) || 0
      
      if (cutoutWidth <= 0 || cutoutHeight <= 0) return
      
      const isPerpendicular = cutout.worktopType === 'perpendicular' && (assemblyType === 'Összemarás Balos' || assemblyType === 'Összemarás jobbos')
      
      if (isPerpendicular && showLeftPerpendicularRect) {
        // Perpendicular cutout - rotated 90 degrees clockwise
        const rectX = 0
        const rectY = isJobbos ? 0 : worktopLength
        const rectWidth = leftPerpendicularRectWidth
        const rectHeight = leftPerpendicularRectHeight
        
        // After 90° clockwise rotation:
        // - Original width becomes visual height
        // - Original height becomes visual width
        const visualWidth = cutoutHeight // After rotation, this is the visual width
        const visualHeight = cutoutWidth // After rotation, this is the visual height
        
        // Where the visual edges should be positioned:
        const visualRightEdgeX = rectX + rectWidth - distanceFromBottom
        const visualBottomEdgeY = rectY + rectHeight - distanceFromLeft
        const visualLeftEdgeX = visualRightEdgeX - visualWidth
        const visualTopEdgeY = visualBottomEdgeY - visualHeight
        
        // Check if cutout fits within perpendicular rectangle (using visual dimensions)
        if (distanceFromBottom + visualWidth > rectWidth || distanceFromLeft + visualHeight > rectHeight) return
        
        // The center after rotation is at the midpoint of the visual rectangle
        const visualCenterX = (visualLeftEdgeX + visualRightEdgeX) / 2
        const visualCenterY = (visualTopEdgeY + visualBottomEdgeY) / 2
        
        // The center doesn't move during rotation, so:
        const centerX = visualCenterX
        const centerY = visualCenterY
        
        // Original rectangle dimensions (before rotation):
        const originalWidth = cutoutWidth   // Original width
        const originalHeight = cutoutHeight // Original height
        
        // Original center is at (centerX, centerY), so:
        const x = centerX - originalWidth / 2
        const y = centerY - originalHeight / 2
        
        elements.push(`
          <g transform="rotate(90 ${centerX} ${centerY})">
            <rect x="${x}" y="${y}" width="${originalWidth}" height="${originalHeight}" fill="rgba(100, 100, 100, 0.1)" stroke="#666666" stroke-width="2"/>
            <line x1="${x}" y1="${y}" x2="${x + originalWidth}" y2="${y + originalHeight}" stroke="#666666" stroke-width="1.5"/>
            <line x1="${x + originalWidth}" y1="${y}" x2="${x}" y2="${y + originalHeight}" stroke="#666666" stroke-width="1.5"/>
            <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${centerX} ${centerY})" font-size="60" font-weight="600" fill="#333" font-family="monospace">
              <tspan x="${centerX}" dy="-0.3em">Kivágás ${index + 1}</tspan>
              <tspan x="${centerX}" dy="1.2em">${cutoutWidth}×${cutoutHeight}</tspan>
            </text>
          </g>
        `)
      } else {
        // Main worktop cutout
        const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
        const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
        
        if (distanceFromLeft + cutoutWidth > keptWidth || distanceFromBottom + cutoutHeight > keptHeight) return
        
        const x = mainWorktopOffsetX + distanceFromLeft
        const y = startY + (keptHeight - distanceFromBottom - cutoutHeight)
        
        if (x < mainWorktopOffsetX || y < startY || x + cutoutWidth > mainWorktopOffsetX + keptWidth || y + cutoutHeight > worktopLength) return
        
        elements.push(`
          <rect x="${x}" y="${y}" width="${cutoutWidth}" height="${cutoutHeight}" fill="rgba(100, 100, 100, 0.1)" stroke="#666666" stroke-width="2"/>
          <line x1="${x}" y1="${y}" x2="${x + cutoutWidth}" y2="${y + cutoutHeight}" stroke="#666666" stroke-width="1.5"/>
          <line x1="${x + cutoutWidth}" y1="${y}" x2="${x}" y2="${y + cutoutHeight}" stroke="#666666" stroke-width="1.5"/>
          <text x="${x + cutoutWidth / 2}" y="${y + cutoutHeight / 2}" text-anchor="middle" dominant-baseline="middle" font-size="60" font-weight="600" fill="#333" font-family="monospace">
            <tspan x="${x + cutoutWidth / 2}" dy="-0.3em">Kivágás ${index + 1}</tspan>
            <tspan x="${x + cutoutWidth / 2}" dy="1.2em">${cutoutWidth}×${cutoutHeight}</tspan>
          </text>
        `)
      }
    })
    
    return elements.join('\n        ')
  }
  
  // Build arrows
  const buildArrows = (): string => {
    const arrows: string[] = []
    const arrowHeadWidth = 60
    const arrowHeadHeight = 50
    const strokeWidth = 10
    const arrowColor = '#333333' // Dark grey (was blue #1976d2)
    
    if (assemblyType === 'Levágás') {
      const keptWidth = showCut ? Math.max(0, Math.min(cutPosition, worktopWidth)) : worktopWidth
      const keptHeight = showVerticalCut ? Math.max(0, Math.min(bValue, worktopLength)) : worktopLength
      const centerX = mainWorktopOffsetX + keptWidth / 2
      const centerY = keptHeight / 2
      const bottomY = keptHeight
      const arrowLength = Math.min(150, (bottomY - centerY) * 0.8)
      const tailEndY = Math.min(bottomY - arrowHeadHeight, centerY + arrowLength)
      const arrowTipY = tailEndY + arrowHeadHeight
      const arrowLeftX = centerX - arrowHeadWidth / 2
      const arrowRightX = centerX + arrowHeadWidth / 2
      
      arrows.push(`
        <line x1="${centerX}" y1="${centerY}" x2="${centerX}" y2="${tailEndY}" stroke="${arrowColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <path d="M ${centerX} ${arrowTipY} L ${arrowLeftX} ${tailEndY} L ${arrowRightX} ${tailEndY} Z" fill="${arrowColor}" stroke="${arrowColor}" stroke-width="${strokeWidth / 2}"/>
      `)
    } else if (assemblyType === 'Összemarás Balos' && showLeftPerpendicularRect) {
      // Main worktop arrow (pointing down)
      const mainCenterX = aValue / 2
      const mainCenterY = bValue / 2
      const mainBottomY = bValue
      const mainArrowLength = Math.min(150, (mainBottomY - mainCenterY) * 0.8)
      const mainTailEndY = Math.min(mainBottomY - arrowHeadHeight, mainCenterY + mainArrowLength)
      const mainArrowTipY = mainTailEndY + arrowHeadHeight
      const mainArrowLeftX = mainCenterX - arrowHeadWidth / 2
      const mainArrowRightX = mainCenterX + arrowHeadWidth / 2
      
      arrows.push(`
        <line x1="${mainCenterX}" y1="${mainCenterY}" x2="${mainCenterX}" y2="${mainTailEndY}" stroke="${arrowColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <path d="M ${mainCenterX} ${mainArrowTipY} L ${mainArrowLeftX} ${mainTailEndY} L ${mainArrowRightX} ${mainTailEndY} Z" fill="${arrowColor}" stroke="${arrowColor}" stroke-width="${strokeWidth / 2}"/>
      `)
      
      // Perpendicular rectangle arrow (pointing right)
      const perpRectX = 0
      const perpRectY = worktopLength
      const perpCenterX = perpRectX + dValue / 2
      const perpCenterY = perpRectY + (cValue - dValue) / 2
      const perpRightX = perpRectX + dValue
      const perpArrowLength = Math.min(150, (perpRightX - perpCenterX) * 0.8)
      const perpTailEndX = Math.min(perpRightX - arrowHeadHeight, perpCenterX + perpArrowLength)
      const perpArrowTipX = perpTailEndX + arrowHeadHeight
      const perpArrowTopY = perpCenterY - arrowHeadWidth / 2
      const perpArrowBottomY = perpCenterY + arrowHeadWidth / 2
      
      arrows.push(`
        <line x1="${perpCenterX}" y1="${perpCenterY}" x2="${perpTailEndX}" y2="${perpCenterY}" stroke="${arrowColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <path d="M ${perpArrowTipX} ${perpCenterY} L ${perpTailEndX} ${perpArrowTopY} L ${perpTailEndX} ${perpArrowBottomY} Z" fill="${arrowColor}" stroke="${arrowColor}" stroke-width="${strokeWidth / 2}"/>
      `)
    } else if (assemblyType === 'Összemarás jobbos' && showLeftPerpendicularRect) {
      // Similar logic for jobbos
      const mainCenterX = leftPerpendicularRectWidth + aValue / 2
      const mainCenterY = bValue / 2
      const mainBottomY = bValue
      const mainArrowLength = Math.min(150, (mainBottomY - mainCenterY) * 0.8)
      const mainTailEndY = Math.min(mainBottomY - arrowHeadHeight, mainCenterY + mainArrowLength)
      const mainArrowTipY = mainTailEndY + arrowHeadHeight
      const mainArrowLeftX = mainCenterX - arrowHeadWidth / 2
      const mainArrowRightX = mainCenterX + arrowHeadWidth / 2
      
      arrows.push(`
        <line x1="${mainCenterX}" y1="${mainCenterY}" x2="${mainCenterX}" y2="${mainTailEndY}" stroke="${arrowColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <path d="M ${mainCenterX} ${mainArrowTipY} L ${mainArrowLeftX} ${mainTailEndY} L ${mainArrowRightX} ${mainTailEndY} Z" fill="${arrowColor}" stroke="${arrowColor}" stroke-width="${strokeWidth / 2}"/>
      `)
      
      const perpRectX = 0
      const perpRectY = 0
      const perpCenterX = perpRectX + dValue / 2
      const perpCenterY = perpRectY + (cValue - dValue) / 2
      const perpRightX = perpRectX + dValue
      const perpArrowLength = Math.min(150, (perpRightX - perpCenterX) * 0.8)
      const perpTailEndX = Math.min(perpRightX - arrowHeadHeight, perpCenterX + perpArrowLength)
      const perpArrowTipX = perpTailEndX + arrowHeadHeight
      const perpArrowTopY = perpCenterY - arrowHeadWidth / 2
      const perpArrowBottomY = perpCenterY + arrowHeadWidth / 2
      
      arrows.push(`
        <line x1="${perpCenterX}" y1="${perpCenterY}" x2="${perpTailEndX}" y2="${perpCenterY}" stroke="${arrowColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <path d="M ${perpArrowTipX} ${perpCenterY} L ${perpTailEndX} ${perpArrowTopY} L ${perpTailEndX} ${perpArrowBottomY} Z" fill="${arrowColor}" stroke="${arrowColor}" stroke-width="${strokeWidth / 2}"/>
      `)
    }
    
    return arrows.join('\n        ')
  }
  
  // Build the complete SVG
  const mainPath = buildMainWorktopPath()
  const perpPath = buildPerpendicularRectPath()
  const edgePaths = buildEdgePaths()
  const edgePositionLabels = buildEdgePositionLabels()
  const dimensionLabels = buildDimensionLabels()
  const cutoutElements = buildCutouts()
  const cutoutDimensionLabels = buildCutoutDimensionLabels()
  const arrowElements = buildArrows()
  
  // Debug: Log path to check if it's being generated
  console.log('[SVG Generator] Assembly type:', assemblyType)
  console.log('[SVG Generator] Main path:', mainPath ? mainPath.substring(0, 150) : 'EMPTY')
  console.log('[SVG Generator] ViewBox:', `${viewBoxX} ${viewBoxY} ${finalViewBoxWidth} ${finalViewBoxHeight}`)
  console.log('[SVG Generator] Total dimensions:', `${totalWorktopWidth} × ${totalWorktopHeight}`)
  
  // Build cut-down parts (hatched rectangles for removed material)
  const buildCutDownParts = (): string => {
    const parts: string[] = []
    
    // Horizontal cut part (right side) for Levágás
    if (showCut) {
      const gapSize = 25 // Gap between cut line and cut-down part (mm)
      const cutDownX = cutPosition + gapSize
      const cutDownWidth = worktopWidth - cutPosition - gapSize
      
      parts.push(`
        <!-- Cut-down rectangle with diagonal pattern -->
        <rect x="${cutDownX}" y="0" width="${cutDownWidth}" height="${worktopLength}" 
              fill="rgba(150, 150, 150, 0.2)" stroke="rgba(100, 100, 100, 0.5)" stroke-width="1" stroke-dasharray="5,5"/>
        <rect x="${cutDownX}" y="0" width="${cutDownWidth}" height="${worktopLength}" fill="url(#diagonalHatch)"/>
        <!-- Grey cut line -->
        <line x1="${cutPosition}" y1="0" x2="${cutPosition}" y2="${worktopLength}" stroke="#666666" stroke-width="2"/>
      `)
    }
    
    // Vertical cut part (top side) - if needed
    if (showVerticalCut) {
      const gapSize = 25
      const cutDownY = 0
      const cutDownHeight = (worktopLength - bValue) - gapSize
      
      parts.push(`
        <!-- Cut-down rectangle with diagonal pattern -->
        <rect x="0" y="${cutDownY}" width="${worktopWidth}" height="${cutDownHeight}" 
              fill="rgba(150, 150, 150, 0.2)" stroke="rgba(100, 100, 100, 0.5)" stroke-width="1" stroke-dasharray="5,5"/>
        <rect x="0" y="${cutDownY}" width="${worktopWidth}" height="${cutDownHeight}" fill="url(#diagonalHatch)"/>
        <!-- Grey cut line -->
        <line x1="0" y1="${worktopLength - bValue}" x2="${worktopWidth}" y2="${worktopLength - bValue}" stroke="#666666" stroke-width="2"/>
      `)
    }
    
    return parts.join('\n      ')
  }
  
  return `
    <svg viewBox="${viewBoxX} ${viewBoxY} ${finalViewBoxWidth} ${finalViewBoxHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; font-family: Arial, sans-serif;">
      <defs>
        <style>
          .dimension-label { font-size: 100px; font-weight: 500; fill: #000; }
          .dimension-line { stroke: #000; stroke-width: 1.5; fill: none; }
        </style>
        <!-- Diagonal hatch pattern for cut-down parts -->
        <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="80" height="80">
          <path d="M 0,80 L 80,0" stroke="rgba(100, 100, 100, 0.35)" stroke-width="1.5"/>
        </pattern>
      </defs>
      
      <!-- Transform group: 
           1. Translate to move content center to origin
           2. Rotate 90° counter-clockwise
           3. Scale to fit A4
           4. Translate to A4 center
      -->
      <g transform="translate(${a4Width / 2}, ${a4Height / 2}) rotate(-90) scale(${scale}) translate(${-contentCenterX}, ${-contentCenterY})">
        ${buildCutDownParts() ? `<!-- Cut-down parts -->
        ${buildCutDownParts()}` : ''}
        
        <!-- Main worktop shape -->
        ${mainPath ? `<path d="${mainPath}" fill="#f5f5f5" stroke="#000" stroke-width="3"/>` : ''}
      
      ${perpPath ? `<!-- Perpendicular rectangle -->
      <path d="${perpPath}" fill="#f5f5f5" stroke="#000" stroke-width="3"/>` : ''}
        
        ${edgePaths ? `<!-- Edge highlighting -->
        ${edgePaths}` : ''}
        
        ${edgePositionLabels ? `<!-- Edge position labels -->
        ${edgePositionLabels}` : ''}
        
        ${cutoutElements ? `<!-- Cutouts -->
        ${cutoutElements}` : ''}
        
        ${cutoutDimensionLabels ? `<!-- Cutout dimension labels -->
        ${cutoutDimensionLabels}` : ''}
        
        ${dimensionLabels ? `<!-- Dimension labels -->
        ${dimensionLabels}` : ''}
        
        ${arrowElements ? `<!-- Arrows -->
        ${arrowElements}` : ''}
      </g>
    </svg>
  `.trim()
}
