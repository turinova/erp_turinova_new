// Look-Ahead Optimization for Beam Saw
// Phase 2: Smart first-panel rotation decision

import { RectangleClass, BinClass } from './classes';
import { guillotineCutting } from './algorithms';

/**
 * Guillotine cutting with look-ahead for first panel rotation
 * 
 * Strategy: For the first (largest) panel, try BOTH orientations
 * and pick the one that results in fewer total boards.
 * 
 * This solves the common problem where rotating the first panel
 * uses too much height and forces remaining panels to new boards.
 * 
 * @param rectangles - Panels to place
 * @param binWidth - Board width (after trim)
 * @param binHeight - Board height (after trim)
 * @param kerf - Saw blade width
 * @returns Array of bins with placed panels
 */
export function guillotineCuttingWithLookAhead(
  rectangles: RectangleClass[], 
  binWidth: number, 
  binHeight: number, 
  kerf: number = 0
): BinClass[] {
  // If no panels or first panel not rotatable, use standard algorithm
  if (rectangles.length === 0) {
    return [];
  }
  
  // Sort by area first (largest first) - same as original
  rectangles.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  const firstPanel = rectangles[0];
  
  if (!firstPanel.rotatable) {
    return guillotineCutting(rectangles, binWidth, binHeight, kerf);
  }
  
  // Clone rectangles for testing (avoid mutating original)
  const rectsNormal = rectangles.map(r => new RectangleClass(r.width, r.height, 0, 0, r.rotatable));
  const rectsRotated = rectangles.map(r => new RectangleClass(r.width, r.height, 0, 0, r.rotatable));
  
  // Try normal orientation
  const normalResult = guillotineCutting(rectsNormal, binWidth, binHeight, kerf);
  
  // Try rotated orientation for first panel
  [rectsRotated[0].width, rectsRotated[0].height] = [rectsRotated[0].height, rectsRotated[0].width];
  const rotatedResult = guillotineCutting(rectsRotated, binWidth, binHeight, kerf);
  
  // Pick the result with fewer boards
  // If equal boards, pick the one with less waste
  if (normalResult.length < rotatedResult.length) {
    console.log('[Optimization] Look-ahead: Normal orientation is better (fewer boards)');
    return guillotineCutting(rectangles, binWidth, binHeight, kerf);
  } else if (rotatedResult.length < normalResult.length) {
    console.log('[Optimization] Look-ahead: Rotated orientation is better (fewer boards)');
    // Apply rotation to original first panel
    [rectangles[0].width, rectangles[0].height] = [rectangles[0].height, rectangles[0].width];
    return guillotineCutting(rectangles, binWidth, binHeight, kerf);
  } else {
    // Same number of boards - calculate total waste
    const normalWaste = normalResult.reduce((sum, bin) => {
      const usedArea = bin.usedRectangles.reduce((s, r) => s + (r.width * r.height), 0);
      return sum + ((binWidth * binHeight) - usedArea);
    }, 0);
    
    const rotatedWaste = rotatedResult.reduce((sum, bin) => {
      const usedArea = bin.usedRectangles.reduce((s, r) => s + (r.width * r.height), 0);
      return sum + ((binWidth * binHeight) - usedArea);
    }, 0);
    
    if (normalWaste <= rotatedWaste) {
      console.log('[Optimization] Look-ahead: Normal orientation (equal boards, less waste)');
      return guillotineCutting(rectangles, binWidth, binHeight, kerf);
    } else {
      console.log('[Optimization] Look-ahead: Rotated orientation (equal boards, less waste)');
      [rectangles[0].width, rectangles[0].height] = [rectangles[0].height, rectangles[0].width];
      return guillotineCutting(rectangles, binWidth, binHeight, kerf);
    }
  }
}

/**
 * Calculate optimization metrics for a result
 */
export function calculateMetrics(
  bins: BinClass[],
  binWidth: number,
  binHeight: number
): {
  totalBoards: number;
  totalPanelArea: number;
  totalBoardArea: number;
  wasteArea: number;
  efficiency: number;
} {
  const totalBoards = bins.length;
  const totalBoardArea = totalBoards * binWidth * binHeight;
  
  let totalPanelArea = 0;
  for (const bin of bins) {
    for (const rect of bin.usedRectangles) {
      totalPanelArea += rect.width * rect.height;
    }
  }
  
  const wasteArea = totalBoardArea - totalPanelArea;
  const efficiency = totalBoardArea > 0 ? totalPanelArea / totalBoardArea : 0;
  
  return {
    totalBoards,
    totalPanelArea,
    totalBoardArea,
    wasteArea,
    efficiency
  };
}

