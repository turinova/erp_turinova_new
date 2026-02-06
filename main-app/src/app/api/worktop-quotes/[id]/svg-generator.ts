// Comprehensive worktop SVG visualization generator for PDF
// Based on WorktopConfigClient SVG generation logic

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
}

export function generateWorktopSvg(config: WorktopConfig): string {
  const a = config.dimension_a || 0
  const b = config.dimension_b || 0
  const c = config.dimension_c || 0
  const d = config.dimension_d || 0
  
  const r1 = config.rounding_r1 || 0
  const r2 = config.rounding_r2 || 0
  const r3 = config.rounding_r3 || 0
  const r4 = config.rounding_r4 || 0
  
  const l1 = config.cut_l1 || 0
  const l2 = config.cut_l2 || 0
  const l3 = config.cut_l3 || 0
  const l4 = config.cut_l4 || 0
  const l5 = config.cut_l5 || 0
  const l6 = config.cut_l6 || 0
  const l7 = config.cut_l7 || 0
  const l8 = config.cut_l8 || 0
  
  const hasL1L2 = l1 > 0 && l2 > 0
  const hasL3L4 = l3 > 0 && l4 > 0
  const hasL5L6 = l5 > 0 && l6 > 0
  const hasL7L8 = l7 > 0 && l8 > 0
  
  const cutouts = config.cutouts ? JSON.parse(config.cutouts) : []
  
  // Clamp rounding values
  const clampR1 = Math.min(r1, a / 2, b)
  const clampR2 = Math.min(r2, a / 2, b)
  const clampR3 = Math.min(r3, a / 2, b)
  const clampR4 = Math.min(r4, a / 2, b)
  
  let svgContent = ''
  const labelPadding = 200
  const fontSize = 100
  
  if (config.assembly_type === 'Levágás') {
    const width = a
    const height = b
    
    // Build main path with all rounding and chamfers
    let path = ''
    
    // Start position (top-left)
    if (hasL5L6) {
      path = `M ${l5} 0`
    } else if (clampR3 > 0) {
      path = `M ${clampR3} 0`
    } else {
      path = 'M 0 0'
    }
    
    // Top edge
    if (hasL7L8) {
      path += ` L ${width - l7} 0`
    } else if (clampR4 > 0) {
      path += ` L ${width - clampR4} 0`
    } else {
      path += ` L ${width} 0`
    }
    
    // Top-right corner
    if (hasL7L8) {
      path += ` L ${width} ${l8}`
    } else if (clampR4 > 0) {
      path += ` Q ${width} 0 ${width} ${clampR4}`
    }
    
    // Right edge
    if (hasL3L4) {
      path += ` L ${width} ${height - l4}`
      path += ` L ${width - l3} ${height}`
    } else {
      path += ` L ${width} ${height - clampR2}`
      if (clampR2 > 0) {
        path += ` Q ${width} ${height} ${width - clampR2} ${height}`
      } else {
        path += ` L ${width} ${height}`
      }
    }
    
    // Bottom edge
    if (hasL1L2) {
      path += ` L ${l1} ${height}`
      path += ` L 0 ${height - l2}`
    } else {
      path += ` L ${clampR1} ${height}`
      if (clampR1 > 0) {
        path += ` Q 0 ${height} 0 ${height - clampR1}`
      } else {
        path += ` L 0 ${height}`
      }
    }
    
    // Left edge
    if (hasL5L6) {
      path += ` L 0 ${l6}`
      path += ` L ${l5} 0`
    } else if (clampR3 > 0) {
      path += ` L 0 ${clampR3}`
      path += ` Q 0 0 ${clampR3} 0`
    } else {
      path += ` L 0 0`
    }
    
    path += ' Z'
    
    // Calculate viewBox with padding
    const viewBoxX = -labelPadding
    const viewBoxY = -labelPadding
    const viewBoxWidth = width + (labelPadding * 2)
    const viewBoxHeight = height + (labelPadding * 2)
    
    // Build dimension labels
    let dimensionLabels = ''
    
    // A dimension (width) - bottom
    dimensionLabels += `
      <line x1="0" y1="${height + 50}" x2="${width}" y2="${height + 50}" stroke="#000" stroke-width="2" fill="none"/>
      <text x="${width / 2}" y="${height + 120}" text-anchor="middle" font-size="${fontSize}" font-weight="500" fill="#000">A: ${a}mm</text>
    `
    
    // B dimension (height) - right
    dimensionLabels += `
      <line x1="${width + 50}" y1="0" x2="${width + 50}" y2="${height}" stroke="#000" stroke-width="2" fill="none"/>
      <text x="${width + 120}" y="${height / 2}" text-anchor="middle" transform="rotate(-90 ${width + 120} ${height / 2})" font-size="${fontSize}" font-weight="500" fill="#000">B: ${b}mm</text>
    `
    
    // Rounding labels
    if (clampR1 > 0) {
      dimensionLabels += `
        <text x="${clampR1 / 2}" y="${height - clampR1 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">R1: ${r1}mm</text>
      `
    }
    if (clampR2 > 0) {
      dimensionLabels += `
        <text x="${width - clampR2 / 2}" y="${height - clampR2 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">R2: ${r2}mm</text>
      `
    }
    if (clampR3 > 0) {
      dimensionLabels += `
        <text x="${clampR3 / 2}" y="${clampR3 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">R3: ${r3}mm</text>
      `
    }
    if (clampR4 > 0) {
      dimensionLabels += `
        <text x="${width - clampR4 / 2}" y="${clampR4 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">R4: ${r4}mm</text>
      `
    }
    
    // Chamfer labels
    if (hasL1L2) {
      dimensionLabels += `
        <text x="${l1 / 2}" y="${height - l2 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">L1-L2</text>
      `
    }
    if (hasL3L4) {
      dimensionLabels += `
        <text x="${width - l3 / 2}" y="${height - l4 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">L3-L4</text>
      `
    }
    if (hasL5L6) {
      dimensionLabels += `
        <text x="${l5 / 2}" y="${l6 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">L5-L6</text>
      `
    }
    if (hasL7L8) {
      dimensionLabels += `
        <text x="${width - l7 / 2}" y="${l8 / 2}" text-anchor="middle" font-size="${fontSize * 0.8}" font-weight="500" fill="#666">L7-L8</text>
      `
    }
    
    // Cutouts
    let cutoutElements = ''
    cutouts.forEach((cutout: any, idx: number) => {
      const x = parseFloat(cutout.distanceFromLeft) || 0
      const y = height - parseFloat(cutout.distanceFromBottom) - (parseFloat(cutout.height) || 0)
      const w = parseFloat(cutout.width) || 0
      const h = parseFloat(cutout.height) || 0
      
      cutoutElements += `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="2"/>
        <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize * 0.7}" fill="#000">${w}×${h}</text>
      `
    })
    
    // Arrow pointing down (front indication) - centered in remaining part
    const arrowSize = Math.min(width, height) * 0.1
    const arrowX = width / 2
    const arrowY = height / 2
    const arrowPath = `
      M ${arrowX} ${arrowY - arrowSize / 2}
      L ${arrowX - arrowSize / 3} ${arrowY + arrowSize / 6}
      L ${arrowX} ${arrowY}
      L ${arrowX + arrowSize / 3} ${arrowY + arrowSize / 6}
      Z
    `
    
    svgContent = `
      <svg viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">
        <defs>
          <style>
            .dimension-label { font-size: ${fontSize}px; font-weight: 500; fill: #000; }
            .dimension-line { stroke: #000; stroke-width: 2; fill: none; }
          </style>
        </defs>
        
        <!-- Main worktop shape -->
        <path d="${path}" fill="none" stroke="#000" stroke-width="3"/>
        
        <!-- Front arrow -->
        <path d="${arrowPath}" fill="#000" stroke="none"/>
        
        ${dimensionLabels}
        ${cutoutElements}
      </svg>
    `
  } else if (config.assembly_type === 'Összemarás Balos' || config.assembly_type === 'Összemarás jobbos') {
    const isJobbos = config.assembly_type === 'Összemarás jobbos'
    
    // Main worktop: A × B
    const mainWidth = a
    const mainHeight = b
    
    // Perpendicular worktop: D × (C-D)
    const perpWidth = d
    const perpHeight = c - d
    
    let mainX = 0
    let mainY = 0
    let perpX = 0
    let perpY = 0
    
    if (isJobbos) {
      // Main on left, perpendicular on right
      mainX = 0
      mainY = 0
      perpX = a - d
      perpY = 0
    } else {
      // Balos: perpendicular on left, main on right
      perpX = 0
      perpY = 0
      mainX = perpWidth
      mainY = 0
    }
    
    // Build main worktop path (simple rectangle for now)
    let mainPath = `M ${mainX} ${mainY}`
    mainPath += ` L ${mainX + mainWidth} ${mainY}`
    mainPath += ` L ${mainX + mainWidth} ${mainY + mainHeight}`
    mainPath += ` L ${mainX} ${mainY + mainHeight}`
    mainPath += ' Z'
    
    // Build perpendicular worktop path
    let perpPath = `M ${perpX} ${perpY}`
    perpPath += ` L ${perpX + perpWidth} ${perpY}`
    perpPath += ` L ${perpX + perpWidth} ${perpY + perpHeight}`
    perpPath += ` L ${perpX} ${perpY + perpHeight}`
    perpPath += ' Z'
    
    // Calculate total dimensions
    const totalWidth = isJobbos ? a : (perpWidth + mainWidth)
    const totalHeight = Math.max(mainHeight, perpHeight)
    
    const viewBoxX = -labelPadding
    const viewBoxY = -labelPadding
    const viewBoxWidth = totalWidth + (labelPadding * 2)
    const viewBoxHeight = totalHeight + (labelPadding * 2)
    
    // Dimension labels
    let dimensionLabels = ''
    
    // Main worktop dimensions
    dimensionLabels += `
      <g transform="translate(${mainX}, ${mainY})">
        <line x1="0" y1="${mainHeight + 50}" x2="${mainWidth}" y2="${mainHeight + 50}" stroke="#000" stroke-width="2" fill="none"/>
        <text x="${mainWidth / 2}" y="${mainHeight + 120}" text-anchor="middle" font-size="${fontSize}" font-weight="500" fill="#000">A: ${a}mm</text>
        <line x1="${mainWidth + 50}" y1="0" x2="${mainWidth + 50}" y2="${mainHeight}" stroke="#000" stroke-width="2" fill="none"/>
        <text x="${mainWidth + 120}" y="${mainHeight / 2}" text-anchor="middle" transform="rotate(-90 ${mainWidth + 120} ${mainHeight / 2})" font-size="${fontSize}" font-weight="500" fill="#000">B: ${b}mm</text>
      </g>
    `
    
    // Perpendicular worktop dimensions
    dimensionLabels += `
      <g transform="translate(${perpX}, ${perpY})">
        <line x1="0" y1="${perpHeight + 50}" x2="${perpWidth}" y2="${perpHeight + 50}" stroke="#000" stroke-width="2" fill="none"/>
        <text x="${perpWidth / 2}" y="${perpHeight + 120}" text-anchor="middle" font-size="${fontSize}" font-weight="500" fill="#000">D: ${d}mm</text>
        <line x1="${perpWidth + 50}" y1="0" x2="${perpWidth + 50}" y2="${perpHeight}" stroke="#000" stroke-width="2" fill="none"/>
        <text x="${perpWidth + 120}" y="${perpHeight / 2}" text-anchor="middle" transform="rotate(-90 ${perpWidth + 120} ${perpHeight / 2})" font-size="${fontSize}" font-weight="500" fill="#000">C-D: ${c - d}mm</text>
      </g>
    `
    
    // Arrows
    // Main worktop: arrow pointing down
    const mainArrowSize = Math.min(mainWidth, mainHeight) * 0.1
    const mainArrowX = mainX + mainWidth / 2
    const mainArrowY = mainY + mainHeight / 2
    const mainArrowPath = `
      M ${mainArrowX} ${mainArrowY - mainArrowSize / 2}
      L ${mainArrowX - mainArrowSize / 3} ${mainArrowY + mainArrowSize / 6}
      L ${mainArrowX} ${mainArrowY}
      L ${mainArrowX + mainArrowSize / 3} ${mainArrowY + mainArrowSize / 6}
      Z
    `
    
    // Perpendicular worktop: arrow pointing right
    const perpArrowSize = Math.min(perpWidth, perpHeight) * 0.1
    const perpArrowX = perpX + perpWidth / 2
    const perpArrowY = perpY + perpHeight / 2
    const perpArrowPath = `
      M ${perpArrowX - perpArrowSize / 2} ${perpArrowY}
      L ${perpArrowX + perpArrowSize / 6} ${perpArrowY - perpArrowSize / 3}
      L ${perpArrowX} ${perpArrowY}
      L ${perpArrowX + perpArrowSize / 6} ${perpArrowY + perpArrowSize / 3}
      Z
    `
    
    svgContent = `
      <svg viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">
        <defs>
          <style>
            .dimension-label { font-size: ${fontSize}px; font-weight: 500; fill: #000; }
            .dimension-line { stroke: #000; stroke-width: 2; fill: none; }
          </style>
        </defs>
        
        <!-- Main worktop -->
        <g transform="translate(${mainX}, ${mainY})">
          <path d="${mainPath}" fill="none" stroke="#000" stroke-width="3"/>
          <path d="${mainArrowPath}" fill="#000" stroke="none"/>
        </g>
        
        <!-- Perpendicular worktop -->
        <g transform="translate(${perpX}, ${perpY})">
          <path d="${perpPath}" fill="none" stroke="#000" stroke-width="3"/>
          <path d="${perpArrowPath}" fill="#000" stroke="none"/>
        </g>
        
        ${dimensionLabels}
      </svg>
    `
  } else {
    // Fallback: simple rectangle
    svgContent = `
      <svg viewBox="0 0 ${a} ${b}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${a}" height="${b}" fill="none" stroke="#000" stroke-width="3"/>
      </svg>
    `
  }
  
  return svgContent.trim()
}
