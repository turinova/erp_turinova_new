import { RectangleClass, BinClass } from './classes';
import { guillotineCutting } from './algorithms';
import { sortPanelsByStrategy, type SortStrategy } from './sorting';

/**
 * Look-ahead optimization: Try both orientations for the first panel
 * and choose the one that results in fewer boards overall
 * 
 * This algorithm improves upon the standard guillotine cutting by:
 * 1. Identifying the largest panel (first after sorting)
 * 2. If it's rotatable, testing both orientations
 * 3. Locking the chosen orientation to prevent the standard algorithm from changing it
 * 4. Selecting the orientation that minimizes board usage
 * 
 * @param sortStrategy - Panel sorting strategy to use
 */
export function guillotineCuttingWithLookAhead(
  rectangles: RectangleClass[], 
  binWidth: number, 
  binHeight: number, 
  kerf: number = 0,
  sortStrategy: SortStrategy = 'area'
): BinClass[] {
  
  if (rectangles.length === 0) {
    return [];
  }
  
  // Sort using the specified strategy
  const sortedRectangles = sortPanelsByStrategy(rectangles, sortStrategy);
  
  const firstPanel = sortedRectangles[0];
  
  // If first panel is not rotatable, use standard algorithm
  if (!firstPanel.rotatable) {
    return guillotineCutting(sortedRectangles, binWidth, binHeight, kerf, sortStrategy);
  }
  
  // Clone rectangles for testing (lock first panel's rotation during test)
  const rectsNormal = sortedRectangles.map((r, i) => 
    new RectangleClass(r.width, r.height, 0, 0, i === 0 ? false : r.rotatable)
  );
  const rectsRotated = sortedRectangles.map((r, i) => 
    new RectangleClass(r.width, r.height, 0, 0, i === 0 ? false : r.rotatable)
  );
  
  console.log(`[Look-Ahead] Testing ${sortedRectangles.length} panels (sort: ${sortStrategy}), first panel: ${firstPanel.width}×${firstPanel.height}`);
  
  // Try normal orientation
  const normalResult = guillotineCutting(rectsNormal, binWidth, binHeight, kerf, sortStrategy);
  console.log(`[Look-Ahead] Normal orientation: ${normalResult.length} boards`);
  
  // Try rotated orientation (actually rotate the first panel)
  [rectsRotated[0].width, rectsRotated[0].height] = [rectsRotated[0].height, rectsRotated[0].width];
  const rotatedResult = guillotineCutting(rectsRotated, binWidth, binHeight, kerf, sortStrategy);
  console.log(`[Look-Ahead] Rotated orientation: ${rotatedResult.length} boards`);
  
  // Count placed panels in each result
  const normalPlaced = normalResult.reduce((sum, bin) => sum + bin.usedRectangles.length, 0);
  const rotatedPlaced = rotatedResult.reduce((sum, bin) => sum + bin.usedRectangles.length, 0);
  
  console.log(`[Look-Ahead] Normal placed: ${normalPlaced}/${rectangles.length}, Rotated placed: ${rotatedPlaced}/${rectangles.length}`);
  
  // PRIORITY 1: Choose the result that places ALL panels (if one does and the other doesn't)
  if (normalPlaced === rectangles.length && rotatedPlaced < rectangles.length) {
    console.log(`[Look-Ahead] ✅ Choosing NORMAL (all panels placed vs ${rectangles.length - rotatedPlaced} unplaced)`);
    return normalResult;
  } else if (rotatedPlaced === rectangles.length && normalPlaced < rectangles.length) {
    console.log(`[Look-Ahead] ✅ Choosing ROTATED (all panels placed vs ${rectangles.length - normalPlaced} unplaced)`);
    return rotatedResult;
  }
  
  // PRIORITY 2: If both place all panels (or both have unplaced), choose by board count
  if (normalResult.length < rotatedResult.length) {
    console.log(`[Look-Ahead] ✅ Choosing NORMAL (fewer boards: ${normalResult.length} vs ${rotatedResult.length})`);
    return normalResult;
  } else if (rotatedResult.length < normalResult.length) {
    console.log(`[Look-Ahead] ✅ Choosing ROTATED (fewer boards: ${rotatedResult.length} vs ${normalResult.length})`);
    return rotatedResult;
  } else {
    // Same number of boards - compare waste percentage
    const normalWaste = normalResult.reduce((sum, bin) => {
      const usedArea = bin.usedRectangles.reduce((s, r) => s + (r.width * r.height), 0);
      return sum + ((binWidth * binHeight) - usedArea);
    }, 0);
    
    const rotatedWaste = rotatedResult.reduce((sum, bin) => {
      const usedArea = bin.usedRectangles.reduce((s, r) => s + (r.width * r.height), 0);
      return sum + ((binWidth * binHeight) - usedArea);
    }, 0);
    
    console.log(`[Look-Ahead] Same boards (${normalResult.length}), comparing waste: normal=${normalWaste}, rotated=${rotatedWaste}`);
    
    // Return the result with less waste directly
    const chosen = normalWaste <= rotatedWaste ? normalResult : rotatedResult;
    console.log(`[Look-Ahead] ✅ Choosing ${normalWaste <= rotatedWaste ? 'NORMAL' : 'ROTATED'} (less waste)`);
    return chosen;
  }
}

