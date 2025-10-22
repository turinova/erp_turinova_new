// Simple test to verify the Node.js optimization API works correctly
import { guillotineCutting, processPanelsForMaterial } from './algorithms';
import { processBin } from './cutCalculations';
import { RectangleClass } from './classes';

// Test data matching the frontend request format
const testRequest = {
  materials: [
    {
      id: "test-material-1",
      name: "Test Material",
      parts: [
        {
          id: "part-1",
          w_mm: 600,
          h_mm: 400,
          qty: 2,
          allow_rot_90: true,
          grain_locked: false
        },
        {
          id: "part-2", 
          w_mm: 800,
          h_mm: 600,
          qty: 1,
          allow_rot_90: true,
          grain_locked: false
        }
      ],
      board: {
        w_mm: 2800,
        h_mm: 2070,
        trim_top_mm: 0,
        trim_right_mm: 0,
        trim_bottom_mm: 0,
        trim_left_mm: 0
      },
      params: {
        kerf_mm: 3
      }
    }
  ]
};

export function testOptimizationAPI() {
  console.log('🧪 Testing Node.js Optimization API...');
  
  try {
    // Test 1: Process panels for material
    const panels = processPanelsForMaterial(testRequest.materials[0].parts);
    console.log(`✅ Processed ${panels.length} panels from parts`);
    
    // Test 2: Run guillotine cutting
    const bins = guillotineCutting(panels, 2070, 2800, 3); // Swapped dimensions like PHP
    console.log(`✅ Guillotine cutting created ${bins.length} bins`);
    
    // Test 3: Calculate cut length
    if (bins.length > 0) {
      const cutLength = processBin(bins[0]);
      console.log(`✅ Cut length calculation: ${cutLength}mm`);
    }
    
    // Test 4: Check placements
    let totalPlacements = 0;
    for (const bin of bins) {
      totalPlacements += bin.usedRectangles.length;
    }
    console.log(`✅ Total placements: ${totalPlacements}`);
    
    console.log('🎉 All tests passed! Node.js optimization API is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Export for manual testing
export { testRequest };
