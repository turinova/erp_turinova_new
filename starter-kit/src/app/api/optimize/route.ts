// Main Optimization API Route - Node.js version of PHP optimization
// Handles material optimization requests from the frontend

import { NextRequest, NextResponse } from 'next/server';
import { guillotineCutting, processPanelsForMaterial, calculateUsableBoardDimensions } from '@/lib/optimization/algorithms';
import { processBin } from '@/lib/optimization/cutCalculations';
import type { OptimizationRequest, OptimizationResult, Placement, UnplacedPart } from '@/types/optimization';

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 NODE.JS OPTIMIZATION API CALLED - NOT PHP SERVICE!');
    console.log('📍 Request from:', request.url);
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Get the request data from the frontend
    const input = await request.json();
    
    if (!input || !Array.isArray(input.materials)) {
      console.log('❌ Invalid request data - missing materials array');
      return NextResponse.json(
        { error: 'Invalid request data - missing materials array' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`🧮 Processing optimization request with ${input.materials.length} materials`);

    // Process each material from the request
    const results: OptimizationResult[] = [];

    for (const materialData of input.materials) {
      const materialId = materialData.id;
      const materialName = materialData.name;
      const parts = materialData.parts;
      const board = materialData.board;
      const params = materialData.params;

      console.log(`📦 Processing material: ${materialName} (${materialId}) - Board: ${board.w_mm}x${board.h_mm}mm`);

      // Process panels for this material - expand by quantity
      const panels = processPanelsForMaterial(parts, false); // grain_direction not in current data structure

      // Get board dimensions
      const boardWidth = board.w_mm;
      const boardHeight = board.h_mm;
      const trimLeft = board.trim_left_mm ?? 0;
      const trimRight = board.trim_right_mm ?? 0;
      const trimTop = board.trim_top_mm ?? 0;
      const trimBottom = board.trim_bottom_mm ?? 0;
      const kerfSize = params.kerf_mm ?? 3;

      // CRITICAL: Swap board dimensions to place panels along the LENGTH side (longer dimension)
      // This matches the PHP logic exactly
      const boardWidthSwapped = boardHeight;  // 2070 (now treated as width for horizontal placement)
      const boardHeightSwapped = boardWidth;  // 2800 (now treated as height for vertical stacking)

      // Calculate usable board dimensions after trim
      const { usableWidth, usableHeight } = calculateUsableBoardDimensions(
        boardWidthSwapped,
        boardHeightSwapped,
        trimLeft,
        trimRight,
        trimTop,
        trimBottom
      );

      console.log(`🔧 Board dimensions: ${boardWidthSwapped}x${boardHeightSwapped}mm, Usable: ${usableWidth}x${usableHeight}mm`);

      // Use the guillotine cutting algorithm
      const bins = guillotineCutting(panels, usableWidth, usableHeight, kerfSize);
      console.log(`📊 Guillotine cutting created ${bins.length} bins for ${panels.length} panels`);

      // Convert to response format - process ALL boards
      const placements: Placement[] = [];
      const unplaced: UnplacedPart[] = [];
      const placedPanelIds: string[] = [];
      const boardCutLengths: Record<number, number> = {};

      // Process all bins (all boards)
      if (bins.length > 0) {
        for (let binIndex = 0; binIndex < bins.length; binIndex++) {
          const bin = bins[binIndex];
          
          // Calculate actual cut length using the sophisticated algorithm
          const boardCutLength = processBin(bin, trimLeft, trimRight, trimTop, trimBottom);
          boardCutLengths[binIndex + 1] = boardCutLength;

          for (const rect of bin.usedRectangles) {
            // Find the original panel data that matches this rectangle
            let originalPanel: any = null;
            let originalIndex = -1;

            // Find which part this panel came from by checking dimensions
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const quantity = part.qty ?? 1;

              // Check if dimensions match (accounting for possible rotation)
              // Note: w_mm = hosszúság, h_mm = szélesség in the API request
              // Rectangle constructor: new Rectangle($part['h_mm'], $part['w_mm'], ...)
              // So rect->width = h_mm (szélesség), rect->height = w_mm (hosszúság)
              if ((part.h_mm === rect.width && part.w_mm === rect.height) ||
                  (part.h_mm === rect.height && part.w_mm === rect.width)) {
                
                // Count how many of this part type we've already placed
                let alreadyPlacedCount = 0;
                for (const placedId of placedPanelIds) {
                  if (placedId.startsWith(part.id)) {
                    alreadyPlacedCount++;
                  }
                }

                // If we haven't placed all quantities of this part yet
                if (alreadyPlacedCount < quantity) {
                  originalPanel = part;
                  originalIndex = i;
                  break;
                }
              }
            }

            if (originalPanel) {
              let instanceNumber = 1;
              for (const placedId of placedPanelIds) {
                if (placedId.startsWith(originalPanel.id)) {
                  instanceNumber++;
                }
              }

              placements.push({
                id: `${originalPanel.id}-${instanceNumber}`,
                x_mm: rect.x + trimLeft,
                y_mm: rect.y + trimTop,
                w_mm: rect.width,
                h_mm: rect.height,
                rot_deg: 0,
                board_id: binIndex + 1
              });
              placedPanelIds.push(`${originalPanel.id}-${instanceNumber}`);
            }
          }
        }
      }

      // Mark remaining panels as unplaced
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const quantity = part.qty ?? 1;

        // Count how many of this part type were placed
        let placedCount = 0;
        for (const placedId of placedPanelIds) {
          if (placedId.startsWith(part.id)) {
            placedCount++;
          }
        }

        // Add unplaced instances
        for (let j = placedCount; j < quantity; j++) {
          unplaced.push({
            id: `${part.id}-${j + 1}`,
            w_mm: part.w_mm,
            h_mm: part.h_mm,
            reason: 'No space available'
          });
        }
      }

      // Calculate metrics
      let totalUsedArea = 0;
      for (const placement of placements) {
        totalUsedArea += placement.w_mm * placement.h_mm;
      }

      const boardArea = boardWidthSwapped * boardHeightSwapped;
      const totalBoardArea = boardArea * bins.length;
      const wastePercentage = totalBoardArea > 0 ? ((totalBoardArea - totalUsedArea) / totalBoardArea) * 100 : 0;

      // Calculate total cut length
      const totalCutLength = Object.values(boardCutLengths).reduce((sum, length) => sum + length, 0);

      console.log(`✅ Material ${materialName}: ${placements.length} placed, ${unplaced.length} unplaced, ${bins.length} boards used`);

      // Add result for this material
      results.push({
        material_id: materialId,
        material_name: materialName,
        placements: placements,
        unplaced: unplaced,
        metrics: {
          used_area_mm2: totalUsedArea,
          board_area_mm2: totalBoardArea,
          waste_pct: Math.round(wastePercentage * 100) / 100, // Round to 2 decimal places
          placed_count: placements.length,
          unplaced_count: unplaced.length,
          boards_used: bins.length,
          total_cut_length_mm: totalCutLength
        },
        board_cut_lengths: boardCutLengths,
        debug: {
          board_width: boardWidthSwapped,
          board_height: boardHeightSwapped,
          usable_width: usableWidth,
          usable_height: usableHeight,
          bins_count: bins.length,
          panels_count: panels.length
        }
      });
    }

    console.log(`🎉 NODE.JS OPTIMIZATION COMPLETE - Returning ${results.length} material results`);
    
    // Return results array directly as expected by OptiClient
    return NextResponse.json(results, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ NODE.JS OPTIMIZATION ERROR:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Optimization service error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500, headers: corsHeaders }
    );
  }
}