// Optimization Classes - TypeScript version of PHP classes
import type { Rectangle, Bin } from '@/lib/opti/optimization-types';

export class RectangleClass implements Rectangle {
  public width: number;
  public height: number;
  public x: number;
  public y: number;
  public rotatable: boolean;

  constructor(
    width: number, 
    height: number, 
    x: number = 0, 
    y: number = 0, 
    rotatable: boolean = false
  ) {
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.rotatable = rotatable;
  }
}

export class BinClass implements Bin {
  public width: number;
  public height: number;
  public usedRectangles: RectangleClass[] = [];
  public freeRectangles: RectangleClass[] = [];
  public kerf: number;

  constructor(width: number, height: number, kerf: number = 0) {
    this.width = width;
    this.height = height;
    this.kerf = kerf;
    this.freeRectangles.push(new RectangleClass(width, height));
  }

  public insert(rectangle: RectangleClass, kerf: number = 0): boolean {
    let bestFit: RectangleClass | null = null;
    let bestFitIndex = -1;
    let bestWaste = Number.MAX_SAFE_INTEGER;
    let rotated = false;

    for (let index = 0; index < this.freeRectangles.length; index++) {
      const freeRect = this.freeRectangles[index];
      const normalWaste = (freeRect.width - rectangle.width) * (freeRect.height - rectangle.height);
      const rotatedWaste = (freeRect.width - rectangle.height) * (freeRect.height - rectangle.width);

      // Prioritize horizontal placement (leftmost, topmost)
      // Only require kerf if there's remaining space that would need a cut
      const requiresHorizontalKerf = (freeRect.width > rectangle.width);
      const requiresVerticalKerf = (freeRect.height > rectangle.height);
      
      if (freeRect.width >= rectangle.width + (requiresHorizontalKerf ? kerf : 0) && 
          freeRect.height >= rectangle.height + (requiresVerticalKerf ? kerf : 0)) {
        // Prefer horizontal placement by prioritizing lower y-coordinate, then lower x-coordinate
        const wasteScore = normalWaste + (freeRect.y * 10000) + (freeRect.x * 1000);
        if (wasteScore < bestWaste) {
          bestFit = freeRect;
          bestFitIndex = index;
          bestWaste = wasteScore;
          rotated = false;
        }
      }

      if (rectangle.rotatable) {
        const requiresHorizontalKerfRotated = (freeRect.width > rectangle.height);
        const requiresVerticalKerfRotated = (freeRect.height > rectangle.width);
        
        if (freeRect.width >= rectangle.height + (requiresHorizontalKerfRotated ? kerf : 0) && 
            freeRect.height >= rectangle.width + (requiresVerticalKerfRotated ? kerf : 0)) {
          const wasteScore = rotatedWaste + (freeRect.y * 10000) + (freeRect.x * 1000);
          if (wasteScore < bestWaste) {
            bestFit = freeRect;
            bestFitIndex = index;
            bestWaste = wasteScore;
            rotated = true;
          }
        }
      }
    }

    if (bestFit === null) {
      return false;
    }

    this.freeRectangles.splice(bestFitIndex, 1);

    if (rotated) {
      [rectangle.width, rectangle.height] = [rectangle.height, rectangle.width];
    }

    this.splitFreeSpaceHorizontalFirst(bestFit, rectangle, kerf);
    
    rectangle.x = bestFit.x;
    rectangle.y = bestFit.y;
    this.usedRectangles.push(rectangle);

    return true;
  }

  /** Dry-run fit check without mutating free rectangles. */
  public canInsert(rectangle: RectangleClass, kerf: number = 0): boolean {
    for (const freeRect of this.freeRectangles) {
      const requiresHorizontalKerf = freeRect.width > rectangle.width;
      const requiresVerticalKerf = freeRect.height > rectangle.height;
      if (
        freeRect.width >= rectangle.width + (requiresHorizontalKerf ? kerf : 0) &&
        freeRect.height >= rectangle.height + (requiresVerticalKerf ? kerf : 0)
      ) {
        return true;
      }
      if (rectangle.rotatable) {
        const requiresHorizontalKerfRotated = freeRect.width > rectangle.height;
        const requiresVerticalKerfRotated = freeRect.height > rectangle.width;
        if (
          freeRect.width >= rectangle.height + (requiresHorizontalKerfRotated ? kerf : 0) &&
          freeRect.height >= rectangle.width + (requiresVerticalKerfRotated ? kerf : 0)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /** Remaining free area after a hypothetical insert (approx.). */
  public calculateWasteIfInserted(rectangle: RectangleClass): number {
    const panelArea = rectangle.width * rectangle.height;
    const usedArea = this.usedRectangles.reduce(
      (sum, r) => sum + r.width * r.height,
      0
    );
    return this.width * this.height - usedArea - panelArea;
  }

  public getUtilization(): number {
    const usedArea = this.usedRectangles.reduce(
      (sum, r) => sum + r.width * r.height,
      0
    );
    const total = this.width * this.height;
    return total > 0 ? usedArea / total : 0;
  }

  private splitFreeSpaceHorizontalFirst(
    freeRect: RectangleClass, 
    placedRect: RectangleClass, 
    kerf: number = 0
  ): void {
    const widthRemainder = freeRect.width - placedRect.width;
    const heightRemainder = freeRect.height - placedRect.height;
    
    // Prioritize horizontal cuts first (place panels side by side)
    // Only apply kerf if there's actually space for another panel
    if (widthRemainder > kerf) {
      this.freeRectangles.push(new RectangleClass(
        widthRemainder - kerf, 
        placedRect.height, 
        freeRect.x + placedRect.width + kerf, 
        freeRect.y
      ));
    }
    if (heightRemainder > kerf) {
      this.freeRectangles.push(new RectangleClass(
        freeRect.width, 
        heightRemainder - kerf, 
        freeRect.x, 
        freeRect.y + placedRect.height + kerf
      ));
    }
  }
}
