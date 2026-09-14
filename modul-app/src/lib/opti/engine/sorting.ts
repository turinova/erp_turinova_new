/**
 * Panel Sorting Strategies for Optimization
 * Different sorting approaches can significantly impact cutting efficiency
 */

import { RectangleClass } from './classes';

export type SortStrategy = 'area' | 'perimeter' | 'width' | 'height' | 'aspect';

/**
 * Sort panels using the specified strategy
 * All strategies sort in descending order (largest/longest first)
 */
export function sortPanelsByStrategy(
  rectangles: RectangleClass[], 
  strategy: SortStrategy
): RectangleClass[] {
  const sorted = [...rectangles]; // Clone to avoid mutating original
  
  switch (strategy) {
    case 'area':
      // Default strategy - largest area first
      // Good for general cases, ensures big panels get priority
      return sorted.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
    case 'perimeter':
      // Best for beam saws - longest perimeter first
      // Prioritizes long cuts first, can improve efficiency by 5-15%
      return sorted.sort((a, b) => 
        (b.width + b.height) - (a.width + a.height)
      );
      
    case 'width':
      // Widest panels first
      // Good when board width is the limiting factor
      return sorted.sort((a, b) => b.width - a.width);
      
    case 'height':
      // Tallest panels first
      // Good when board height is the limiting factor
      return sorted.sort((a, b) => b.height - a.height);
      
    case 'aspect':
      // Most square panels first (aspect ratio closest to 1:1)
      // Can reduce fragmentation in some cases
      return sorted.sort((a, b) => {
        const aspectA = Math.max(a.width, a.height) / Math.min(a.width, a.height);
        const aspectB = Math.max(b.width, b.height) / Math.min(b.width, b.height);
        return aspectA - aspectB; // Closer to 1:1 comes first
      });
      
    default:
      return sorted.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  }
}

/**
 * Get user-friendly description of each strategy
 */
export function getSortStrategyDescription(strategy: SortStrategy): string {
  switch (strategy) {
    case 'area':
      return 'Legnagyobb területű panelek először';
    case 'perimeter':
      return 'Legnagyobb kerületű panelek először (Ajánlott gerenda fűrészhez)';
    case 'width':
      return 'Legszélesebb panelek először';
    case 'height':
      return 'Leghosszabb panelek először';
    case 'aspect':
      return 'Négyzet alakú panelek először';
    default:
      return '';
  }
}

/**
 * Recommend best strategy based on panel characteristics
 */
export function recommendSortStrategy(rectangles: RectangleClass[]): SortStrategy {
  if (rectangles.length === 0) return 'area';
  
  // Calculate statistics
  const avgAspect = rectangles.reduce((sum, r) => {
    const aspect = Math.max(r.width, r.height) / Math.min(r.width, r.height);
    return sum + aspect;
  }, 0) / rectangles.length;
  
  // If panels are very rectangular (aspect > 3), perimeter works better
  if (avgAspect > 3) {
    return 'perimeter';
  }
  
  // Default to area for mixed shapes
  return 'area';
}

