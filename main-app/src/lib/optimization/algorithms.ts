// Core Optimization Algorithms - TypeScript version of PHP functions
import { RectangleClass, BinClass } from './classes';
import type { Rectangle } from '@/types/optimization';

/**
 * Guillotine cutting algorithm - main optimization function
 * Mirrors the PHP guillotineCutting function exactly
 */
export function guillotineCutting(
  rectangles: RectangleClass[], 
  binWidth: number, 
  binHeight: number, 
  kerf: number = 0
): BinClass[] {
  const bins: BinClass[] = [];
  bins.push(new BinClass(binWidth, binHeight, kerf));

  // Sort rectangles by area (largest first) - exactly like PHP
  rectangles.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  for (const rectangle of rectangles) {
    let placed = false;
    for (const bin of bins) {
      if (bin.insert(rectangle, kerf)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newBin = new BinClass(binWidth, binHeight, kerf);
      newBin.insert(rectangle, kerf);
      bins.push(newBin);
    }
  }

  return bins;
}

/**
 * Calculate number of boards needed - utility function
 */
export function calculateBoardsNeeded(
  rectangles: RectangleClass[], 
  binWidth: number, 
  binHeight: number
): number {
  const bins = guillotineCutting(rectangles, binWidth, binHeight);
  return bins.length;
}

/**
 * Process panels for a material - convert parts to rectangles
 * Mirrors the PHP logic for processing parts and handling quantities
 */
export function processPanelsForMaterial(
  parts: any[], 
  grainDirection: boolean = false
): RectangleClass[] {
  const panels: RectangleClass[] = [];
  
  for (const part of parts) {
    const quantity = part.qty ?? 1;
    for (let i = 0; i < quantity; i++) {
      // Check if material has grain direction - if so, panels cannot be rotated
      const canRotate = grainDirection ? false : (part.allow_rot_90 ?? true);
      panels.push(new RectangleClass(
        part.h_mm,  // Note: PHP uses h_mm as width in Rectangle constructor
        part.w_mm,  // Note: PHP uses w_mm as height in Rectangle constructor
        0, 
        0, 
        canRotate
      ));
    }
  }
  
  return panels;
}

/**
 * Calculate board dimensions with trim
 */
export function calculateUsableBoardDimensions(
  boardWidth: number,
  boardHeight: number,
  trimLeft: number = 0,
  trimRight: number = 0,
  trimTop: number = 0,
  trimBottom: number = 0
): { usableWidth: number; usableHeight: number } {
  const usableWidth = boardWidth - trimLeft - trimRight;
  const usableHeight = boardHeight - trimTop - trimBottom;
  
  return { usableWidth, usableHeight };
}

/**
 * Sort rectangles by Y position for strip processing
 */
export function sortRectanglesByY(rectangles: Rectangle[]): Rectangle[] {
  return rectangles.sort((a, b) => a.y - b.y);
}

/**
 * Sort rectangles by X position for strip processing
 */
export function sortRectanglesByX(rectangles: Rectangle[]): Rectangle[] {
  return rectangles.sort((a, b) => a.x - b.x);
}
