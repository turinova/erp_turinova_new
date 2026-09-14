/**
 * Multi-Panel Look-Ahead Optimization
 * Tests multiple panels' orientations to find optimal combination
 */

import { RectangleClass, BinClass } from './classes';
import { guillotineCutting } from './algorithms';
import { sortPanelsByStrategy, type SortStrategy } from './sorting';

/**
 * Generate all binary combinations for n items
 * For n=3: [[false,false,false], [false,false,true], ..., [true,true,true]]
 */
function generateRotationCombinations(n: number): boolean[][] {
  const combinations: boolean[][] = [];
  const total = Math.pow(2, n);
  
  for (let i = 0; i < total; i++) {
    const combo: boolean[] = [];
    for (let j = 0; j < n; j++) {
      combo.push((i & (1 << j)) !== 0);
    }
    combinations.push(combo);
  }
  
  return combinations;
}

/**
 * Multi-Panel Look-Ahead: Test first N panels' orientations
 * 
 * Performance considerations:
 * - 1 panel: 2 combinations (current look-ahead)
 * - 2 panels: 4 combinations (~2ms)
 * - 3 panels: 8 combinations (~4ms)
 * - 4 panels: 16 combinations (~8ms)
 * - 5 panels: 32 combinations (~16ms)
 * 
 * We limit to 3 panels for performance/benefit balance
 */
export function guillotineCuttingWithMultiPanelLookAhead(
  rectangles: RectangleClass[], 
  binWidth: number, 
  binHeight: number, 
  kerf: number = 0,
  sortStrategy: SortStrategy = 'height'
): BinClass[] {
  
  if (rectangles.length === 0) {
    return [];
  }
  
  // Sort using the specified strategy
  const sortedRectangles = sortPanelsByStrategy(rectangles, sortStrategy);
  
  // Determine how many panels to test based on total count
  // Balance between performance and optimization quality
  // More aggressive testing - the extra 2-5ms is worth the 10-20% efficiency gain
  let panelsToTest = 1; // Default: single panel
  
  if (sortedRectangles.length <= 20) {
    panelsToTest = Math.min(3, sortedRectangles.length); // Test up to 3 panels (8 combinations)
  } else if (sortedRectangles.length <= 100) {
    panelsToTest = 2; // Test 2 panels for medium-large sets (4 combinations)
  } else {
    panelsToTest = 1; // Test only 1 panel for very large quotes (100+)
  }
  
  // Find rotatable panels in the test set
  const testPanels = sortedRectangles.slice(0, panelsToTest);
  const rotatableIndices = testPanels
    .map((r, i) => ({ index: i, rotatable: r.rotatable }))
    .filter(p => p.rotatable)
    .map(p => p.index);
  
  // If no rotatable panels in test set, use standard algorithm
  if (rotatableIndices.length === 0) {
    return guillotineCutting(sortedRectangles, binWidth, binHeight, kerf, sortStrategy);
  }
  
  console.log(`[Multi-Panel Look-Ahead] Testing ${sortedRectangles.length} panels, examining first ${panelsToTest} panels (${rotatableIndices.length} rotatable)`);
  
  // Generate all rotation combinations for rotatable panels
  const combinations = generateRotationCombinations(rotatableIndices.length);
  console.log(`[Multi-Panel Look-Ahead] Testing ${combinations.length} orientation combinations`);
  
  let bestResult: BinClass[] | null = null;
  let bestBoards = Infinity;
  let bestPlaced = 0;
  let bestWaste = Infinity;
  let bestCombination: boolean[] = [];
  
  // Test each combination
  for (let comboIdx = 0; comboIdx < combinations.length; comboIdx++) {
    const combo = combinations[comboIdx];
    
    // Clone rectangles and apply rotation combination
    const testRects = sortedRectangles.map((r, i) => {
      // Check if this panel is in our test set
      if (i < panelsToTest) {
        const rotIdx = rotatableIndices.indexOf(i);
        if (rotIdx >= 0) {
          // This panel is rotatable and in test set
          const shouldRotate = combo[rotIdx];
          const rect = new RectangleClass(r.width, r.height, 0, 0, false); // Lock rotation
          if (shouldRotate) {
            [rect.width, rect.height] = [rect.height, rect.width];
          }
          return rect;
        }
      }
      // Not in test set or not rotatable - keep original
      return new RectangleClass(r.width, r.height, 0, 0, r.rotatable);
    });
    
    // Run optimization with this combination
    const result = guillotineCutting(testRects, binWidth, binHeight, kerf, sortStrategy);
    const placed = result.reduce((sum, bin) => sum + bin.usedRectangles.length, 0);
    const waste = result.reduce((sum, bin) => {
      const usedArea = bin.usedRectangles.reduce((s, r) => s + (r.width * r.height), 0);
      return sum + ((binWidth * binHeight) - usedArea);
    }, 0);
    
    // Scoring: Priority is all placed > fewer boards > less waste
    const isBetter = 
      placed > bestPlaced || 
      (placed === bestPlaced && result.length < bestBoards) ||
      (placed === bestPlaced && result.length === bestBoards && waste < bestWaste);
    
    if (isBetter) {
      bestResult = result;
      bestBoards = result.length;
      bestPlaced = placed;
      bestWaste = waste;
      bestCombination = combo;
    }
  }
  
  // Log the winning combination
  const rotationDesc = rotatableIndices.map((idx, i) => 
    `P${idx+1}:${bestCombination[i] ? 'R' : 'N'}`
  ).join(', ');
  
  console.log(`[Multi-Panel Look-Ahead] ✅ Best combination: ${rotationDesc}`);
  console.log(`[Multi-Panel Look-Ahead] Result: ${bestBoards} boards, ${bestPlaced}/${sortedRectangles.length} placed, waste: ${bestWaste.toFixed(0)} mm²`);
  
  return bestResult || guillotineCutting(sortedRectangles, binWidth, binHeight, kerf, sortStrategy);
}

