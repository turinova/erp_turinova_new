# Deep Analysis: Why Rotation is 180° Instead of 90°

## Problem
User requests 90° rotation, but visualization rotates 180° instead.

## Current Implementation

### SVG Transform (line 1921)
```svg
<g transform="translate(${a4Width / 2}, ${a4Height / 2}) rotate(-90) scale(${scale}) translate(${-contentCenterX}, ${-contentCenterY})">
```

Transform order:
1. `translate(${a4Width / 2}, ${a4Height / 2})` - Move to center of printable area
2. `rotate(-90)` - Rotate 90° counter-clockwise (to the left)
3. `scale(${scale})` - Scale to fit
4. `translate(${-contentCenterX}, ${-contentCenterY})` - Move content center to origin

### Scale Calculation (lines 414-415)
```javascript
const rotatedWorktopWidth = totalWorktopHeight  // After rotation: original height becomes width
const rotatedWorktopHeight = totalWorktopWidth  // After rotation: original width becomes height
```

**CRITICAL ISSUE**: The scale calculation is already accounting for a 90° rotation by swapping dimensions. This means:
- The code assumes rotation will happen
- Dimensions are swapped BEFORE rotation is applied
- But the actual rotation in the SVG might be conflicting with this assumption

## Root Cause Hypothesis

### Hypothesis 1: Double Rotation
The scale calculation swaps dimensions (assuming rotation), AND the SVG applies rotation. This could cause:
- Scale calculation: "After rotation, width becomes height" → swaps dimensions
- SVG transform: `rotate(-90)` → rotates again
- Result: 180° total rotation

### Hypothesis 2: Coordinate System Inversion
PDFKit/SVGtoPDF might use a coordinate system where:
- Y-axis is inverted (top-to-bottom instead of bottom-to-top)
- A -90° rotation in SVG becomes +90° in PDF
- Combined with dimension swap = 180°

### Hypothesis 3: Transform Order Issue
The transform order might be wrong:
```svg
translate(center) rotate(-90) scale() translate(-contentCenter)
```

If the content center calculation is based on pre-rotated coordinates, but rotation happens after translation, the rotation might be around the wrong point, causing unexpected results.

## Solution Options

### Option 1: Remove Dimension Swap, Keep Rotation
If we want 90° rotation, we should:
1. NOT swap dimensions in scale calculation
2. Apply rotation in SVG
3. Scale based on original dimensions

### Option 2: Remove Rotation, Keep Dimension Swap
If the dimension swap is correct for landscape orientation:
1. Keep dimension swap in scale calculation
2. Remove rotation from SVG
3. Generate worktop in landscape orientation from start

### Option 3: Fix Transform Order
Ensure rotation happens around the correct center point:
```svg
translate(center) translate(-contentCenter) rotate(-90) scale() translate(contentCenter)
```

## Recommended Fix

**Option 2** seems most correct because:
1. The scale calculation already accounts for landscape orientation
2. The worktop should be generated in landscape from the start
3. No rotation needed if we generate it correctly oriented

But if user wants rotation, we need to:
1. Remove dimension swap from scale calculation
2. Keep only the SVG rotation
3. Recalculate scale based on original (non-swapped) dimensions
