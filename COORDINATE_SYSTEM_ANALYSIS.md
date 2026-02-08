# Deep Analysis: Coordinate System for Worktop Visualizations

## Overview
The SVG generator uses a multi-stage coordinate transformation system:
1. **Original Coordinates**: Worktop drawn at real-world dimensions (mm)
2. **ViewBox Expansion**: Adds label padding around worktop
3. **Rotation**: Rotates 90° counter-clockwise for landscape display
4. **Scaling**: Scales to fit A4 landscape (297mm × 210mm)
5. **Centering**: Centers in final viewBox

---

## 1. LEVÁGÁS Type

### Initial Dimensions
```
worktopWidth = 4100mm (DEFAULT_MATERIAL_WIDTH - full material width)
worktopLength = bValue (e.g., 500mm - height)
cutPosition = aValue (e.g., 2498mm - kept portion)
```

### Worktop Coordinates
```
mainWorktopOffsetX = 0 (no perpendicular rectangle)
startY = 0
bottomY = worktopLength (e.g., 500mm)

Worktop drawn from: (0, 0) to (cutPosition, worktopLength)
Effective size: 2498mm × 500mm
```

### Total Dimensions Calculation
```
totalWorktopWidth = cutPosition (2498mm) - ONLY kept portion
totalWorktopHeight = worktopLength (500mm)
Aspect ratio: 2498/500 = 4.996 (very wide, short)
```

### Label Padding
```
labelPaddingLeft = max(250, labelOffsets.left.cDimension + 30)
labelPaddingRight = max(250, labelOffsets.right.bDimension + 30)
labelPaddingTop = max(60, labelOffsets.top.aDimension + 30)
labelPaddingBottom = max(80, labelOffsets.bottom.aDimension + 30)
```

### Expanded ViewBox (Before Rotation)
```
expandedWidth = totalWorktopWidth + labelPaddingLeft + labelPaddingRight
  = 2498 + 250 + 250 = 2998mm

expandedHeight = totalWorktopHeight + labelPaddingTop + labelPaddingBottom
  = 500 + 60 + 80 = 640mm

expandedAspectRatio = 2998/640 = 4.68
worktopAspectRatio = 2498/500 = 4.996

Since expandedAspectRatio < worktopAspectRatio:
  originalViewBoxHeight = expandedWidth / worktopAspectRatio
  = 2998 / 4.996 = 600mm
  originalViewBoxWidth = expandedWidth = 2998mm
```

### ViewBox Origin
```
originalViewBoxX = -(originalViewBoxWidth - totalWorktopWidth) / 2
  = -(2998 - 2498) / 2 = -250mm

originalViewBoxY = -(originalViewBoxHeight - totalWorktopHeight) / 2
  = -(600 - 500) / 2 = -50mm

ViewBox: (-250, -50, 2998, 600)
```

### Content Center
```
contentCenterX = originalViewBoxX + originalViewBoxWidth / 2
  = -250 + 2998/2 = 1249mm

contentCenterY = originalViewBoxY + originalViewBoxHeight / 2
  = -50 + 600/2 = 250mm
```

### Rotation Transformation
```
After 90° counter-clockwise rotation:
  rotatedWidth = originalViewBoxHeight = 600mm
  rotatedHeight = originalViewBoxWidth = 2998mm

A4 landscape: 297mm × 210mm
margin = 1mm (for Levágás)
maxContentWidth = 297 - 2 = 295mm
maxContentHeight = 210 - 2 = 208mm

scaleX = 295 / 600 = 0.492
scaleY = 208 / 2998 = 0.069

baseScale = max(0.492, 0.069) = 0.492
scale = baseScale * 2.2 = 1.082 (120% larger)
scale = min(1.082, 0.492*1.9, 0.069*1.9) = min(1.082, 0.935, 0.131) = 0.131
```

### Final Transform
```
transform = translate(148.5, 105) rotate(-90) scale(0.131) translate(-1249, -250)

Steps:
1. Translate to A4 center: (148.5, 105)
2. Rotate -90° counter-clockwise
3. Scale by 0.131
4. Translate back by content center: (-1249, -250)
```

### Issues for Levágás
1. **Scale too small**: 0.131 makes visualization tiny (13% of original)
2. **Rotation mismatch**: After rotation, 600mm width becomes height, but A4 height is only 208mm
3. **Aspect ratio conflict**: Rotated content (600×2998) doesn't fit A4 landscape (297×210) well
4. **Scale multiplier ineffective**: 2.2x multiplier gets capped down to 0.131 due to constraints

---

## 2. ÖSSZEMARÁS BALOS Type

### Initial Dimensions
```
worktopWidth = aValue (e.g., 1300mm)
worktopLength = bValue (e.g., 600mm)
leftPerpendicularRectWidth = dValue (e.g., 200mm)
leftPerpendicularRectHeight = cValue (e.g., 800mm)
```

### Worktop Coordinates
```
mainWorktopOffsetX = leftPerpendicularRectWidth (200mm) - main worktop starts AFTER perpendicular
startY = 0
bottomY = worktopLength (600mm)

Main worktop: (200, 0) to (200+1300, 600) = (200, 0) to (1500, 600)
Perpendicular rect: (0, 600) to (200, 600+800) = (0, 600) to (200, 1400)
```

### Total Dimensions Calculation
```
totalWorktopWidth = max(worktopWidth, leftPerpendicularRectWidth)
  = max(1300, 200) = 1300mm

totalWorktopHeight = worktopLength + leftPerpendicularRectHeight
  = 600 + 800 = 1400mm

Aspect ratio: 1300/1400 = 0.929 (taller than wide)
```

### Label Padding
```
labelPaddingLeft = max(450, labelOffsets.left.cDimension + 50)
labelPaddingRight = max(300, labelOffsets.right.bDimension + 50)
labelPaddingTop = max(250, labelOffsets.top.aDimension + 50)
labelPaddingBottom = max(100, labelOffsets.bottom.dDimension + 50)
```

### Expanded ViewBox (Before Rotation)
```
expandedWidth = 1300 + 450 + 300 = 2050mm
expandedHeight = 1400 + 250 + 100 = 1750mm

expandedAspectRatio = 2050/1750 = 1.17
worktopAspectRatio = 1300/1400 = 0.929

Since expandedAspectRatio > worktopAspectRatio:
  originalViewBoxWidth = expandedHeight * worktopAspectRatio
  = 1750 * 0.929 = 1626mm
  originalViewBoxHeight = expandedHeight = 1750mm
```

### ViewBox Origin
```
originalViewBoxX = -labelPaddingLeft = -450mm
originalViewBoxY = -(originalViewBoxHeight - totalWorktopHeight) / 2
  = -(1750 - 1400) / 2 = -175mm

ViewBox: (-450, -175, 1626, 1750)
```

### Content Center
```
contentCenterX = -450 + 1626/2 = 363mm
contentCenterY = -175 + 1750/2 = 700mm
```

### Rotation Transformation
```
After 90° counter-clockwise rotation:
  rotatedWidth = 1750mm
  rotatedHeight = 1626mm

A4 landscape: 297mm × 210mm
margin = 2mm
maxContentWidth = 295mm
maxContentHeight = 208mm

scaleX = 295 / 1750 = 0.169
scaleY = 208 / 1626 = 0.128
scale = min(0.169, 0.128) = 0.128
```

### Final Transform
```
transform = translate(148.5, 105) rotate(-90) scale(0.128) translate(-363, -700)
```

### Issues for Balos
1. **Scale small**: 0.128 (12.8% of original)
2. **Better fit**: Aspect ratio closer to A4 landscape after rotation
3. **Perpendicular positioning**: Perpendicular rect at (0, 600) may be cut off after rotation

---

## 3. ÖSSZEMARÁS JOBBOS Type

### Initial Dimensions
```
worktopWidth = aValue (e.g., 1300mm)
worktopLength = bValue (e.g., 600mm)
leftPerpendicularRectWidth = dValue (e.g., 200mm)
leftPerpendicularRectHeight = cValue (e.g., 800mm)
```

### Worktop Coordinates
```
mainWorktopOffsetX = 0 (main worktop is on LEFT, perpendicular on RIGHT)
startY = 0
bottomY = worktopLength (600mm)

Main worktop: (0, 0) to (1300, 600)
Perpendicular rect: (1300-200, 0) to (1300, max(600, 800)) = (1100, 0) to (1300, 800)
```

### Total Dimensions Calculation
```
totalWorktopWidth = leftPerpendicularRectWidth + worktopWidth
  = 200 + 1300 = 1500mm

totalWorktopHeight = max(leftPerpendicularRectHeight, worktopLength)
  = max(800, 600) = 800mm

Aspect ratio: 1500/800 = 1.875 (wider than tall)
```

### Label Padding
```
Same as Balos:
labelPaddingLeft = max(450, ...)
labelPaddingRight = max(300, ...)
labelPaddingTop = max(250, ...)
labelPaddingBottom = max(100, ...)
```

### Expanded ViewBox (Before Rotation)
```
expandedWidth = 1500 + 450 + 300 = 2250mm
expandedHeight = 800 + 250 + 100 = 1150mm

expandedAspectRatio = 2250/1150 = 1.96
worktopAspectRatio = 1500/800 = 1.875

Since expandedAspectRatio > worktopAspectRatio:
  originalViewBoxWidth = expandedHeight * worktopAspectRatio
  = 1150 * 1.875 = 2156mm
  originalViewBoxHeight = expandedHeight = 1150mm
```

### ViewBox Origin
```
originalViewBoxX = -(originalViewBoxWidth - totalWorktopWidth) / 2
  = -(2156 - 1500) / 2 = -328mm

originalViewBoxY = -(originalViewBoxHeight - totalWorktopHeight) / 2
  = -(1150 - 800) / 2 = -175mm

ViewBox: (-328, -175, 2156, 1150)
```

### Content Center
```
contentCenterX = -328 + 2156/2 = 750mm
contentCenterY = -175 + 1150/2 = 400mm
```

### Rotation Transformation
```
After 90° counter-clockwise rotation:
  rotatedWidth = 1150mm
  rotatedHeight = 2156mm

A4 landscape: 297mm × 210mm
margin = 2mm
maxContentWidth = 295mm
maxContentHeight = 208mm

scaleX = 295 / 1150 = 0.257
scaleY = 208 / 2156 = 0.096
scale = min(0.257, 0.096) = 0.096
```

### Final Transform
```
transform = translate(148.5, 105) rotate(-90) scale(0.096) translate(-750, -400)
```

### Issues for jobbos
1. **Scale very small**: 0.096 (9.6% of original) - smallest of all types
2. **Height constraint**: After rotation, 2156mm height becomes width, but A4 width is only 295mm
3. **Perpendicular positioning**: Perpendicular rect overlaps with main worktop at (1100, 0)

---

## ROOT CAUSE ANALYSIS

### Problem 1: Coordinate System Mismatch
- **Worktop coordinates**: Real-world mm (2498mm, 500mm, etc.)
- **A4 page**: 297mm × 210mm landscape
- **Scale factor**: 0.096 to 0.131 (10-13% of original)
- **Result**: Visualization appears tiny

### Problem 2: Rotation Logic Flaw
- Content is rotated 90° counter-clockwise
- After rotation: width becomes height, height becomes width
- For Levágás: 600mm (rotated width) > 208mm (A4 height) → must scale down drastically
- For jobbos: 2156mm (rotated height) > 295mm (A4 width) → must scale down drastically

### Problem 3: ViewBox Calculation Issues
- `originalViewBoxWidth/Height` are calculated to maintain aspect ratio
- But they don't account for the rotation swap
- After rotation, the dimensions that were "width" become "height" and vice versa
- This causes the wrong dimension to constrain the scale

### Problem 4: Scale Calculation Error
```javascript
// Current logic:
rotatedWidth = originalViewBoxHeight  // After rotation, original height becomes width
rotatedHeight = originalViewBoxWidth  // After rotation, original width becomes height

scaleX = maxContentWidth / rotatedWidth   // 295 / 600 = 0.492 (for Levágás)
scaleY = maxContentHeight / rotatedHeight // 208 / 2998 = 0.069 (for Levágás)

// Problem: scaleY is the limiting factor (0.069), but it's comparing:
// - maxContentHeight (208mm) vs rotatedHeight (2998mm)
// - This is wrong! After rotation, the "tall" dimension (2998mm) becomes the "wide" dimension
// - But we're trying to fit it in the "height" constraint (208mm)
```

### Problem 5: Levágás Scale Multiplier Ineffective
```javascript
baseScale = Math.max(scaleX, scaleY) = Math.max(0.492, 0.069) = 0.492
scale = baseScale * 2.2 = 1.082
scale = Math.min(1.082, 0.492*1.9, 0.069*1.9) = min(1.082, 0.935, 0.131) = 0.131

// The multiplier gets capped down because scaleY*1.9 = 0.131 is the smallest
// The issue is that scaleY is already too small (0.069), so even 1.9x is still tiny
```

---

## RECOMMENDED FIXES

### Fix 1: Correct Scale Calculation After Rotation
```javascript
// After rotation, dimensions swap:
// - What was "width" (horizontal) becomes "height" (vertical)
// - What was "height" (vertical) becomes "width" (horizontal)

// For A4 landscape (297×210):
// - We have 297mm horizontal space (width)
// - We have 210mm vertical space (height)

// After rotation:
// - rotatedWidth = originalViewBoxHeight (what was vertical becomes horizontal)
// - rotatedHeight = originalViewBoxWidth (what was horizontal becomes vertical)

// Scale calculation should be:
scaleX = maxContentWidth / rotatedWidth   // Fit in 297mm horizontal
scaleY = maxContentHeight / rotatedHeight // Fit in 210mm vertical
scale = Math.min(scaleX, scaleY)

// But the current code has this correct! The issue is elsewhere...
```

### Fix 2: Remove Rotation, Generate Landscape Directly
- Don't rotate the SVG
- Generate worktop in landscape orientation from the start
- This eliminates coordinate system confusion
- Scale calculation becomes straightforward

### Fix 3: Use Actual Page Dimensions
- Current: Uses A4 full size (297×210)
- Should use: Printable area (289×194 after Puppeteer margins)
- This gives more space for visualization

### Fix 4: Calculate Scale Based on Worktop Only
- Don't include label padding in scale calculation
- Scale worktop to fill page
- Labels scale proportionally
- This ensures worktop is always visible and large

---

## SUMMARY

### Current State
- **Levágás**: Scale 0.131 (13%) - too small, rotation causes height constraint
- **Balos**: Scale 0.128 (12.8%) - small but better aspect ratio fit
- **jobbos**: Scale 0.096 (9.6%) - smallest, height constraint after rotation

### Key Issues
1. Rotation causes dimension swap that creates tight constraints
2. Scale calculation uses wrong dimensions after rotation
3. Label padding included in viewBox makes worktop smaller
4. A4 full size used instead of printable area (289×194)

### Recommended Solution
1. Remove rotation - generate landscape directly
2. Use printable area dimensions (289×194)
3. Scale based on worktop dimensions only (ignore label padding)
4. Apply scale transform directly to worktop coordinates
