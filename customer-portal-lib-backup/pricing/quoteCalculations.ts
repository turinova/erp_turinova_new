// Quote Calculation Functions for Opti Page
import type { OptimizationResult, Placement } from '@/types/optimization';

export interface MaterialPricing {
  material_id: string;
  material_name: string;
  on_stock: boolean;
  boards: BoardPricing[];
  edge_materials: EdgeMaterialPricing[]; // Edge materials for THIS material
  cutting_cost: CuttingCostPricing | null; // Cutting cost for THIS material
  additional_services: AdditionalServicesPricing | null; // Additional services for THIS material
  total_material_net: number;
  total_material_vat: number;
  total_material_gross: number;
  total_edge_net: number;
  total_edge_vat: number;
  total_edge_gross: number;
  total_cutting_net: number;
  total_cutting_vat: number;
  total_cutting_gross: number;
  total_services_net: number;
  total_services_vat: number;
  total_services_gross: number;
  total_net: number;
  total_vat: number;
  total_gross: number;
  currency: string;
}

export interface BoardPricing {
  board_id: number;
  usage_percentage: number;
  area_m2: number;
  charged_area_m2: number;
  net_price: number;
  vat_amount: number;
  gross_price: number;
  pricing_method: 'panel_area' | 'full_board';
}

export interface EdgeMaterialPricing {
  edge_material_name: string;
  length_m: number;
  length_with_overhang_m: number;
  price_per_m: number;
  net_price: number;
  vat_rate: number;
  vat_amount: number;
  gross_price: number;
  currency: string;
}

export interface CuttingCostPricing {
  total_cutting_length_m: number;
  fee_per_meter: number;
  net_price: number;
  vat_rate: number;
  vat_amount: number;
  gross_price: number;
  currency: string;
}

export interface AdditionalServicesPricing {
  panthelyfuras: ServicePricing | null;
  duplungolas: ServicePricing | null;
  szogvagas: ServicePricing | null;
}

export interface ServicePricing {
  quantity: number;      // Total count (holes, panels, or m²)
  unit_price: number;    // Price per unit
  net_price: number;
  vat_rate: number;
  vat_amount: number;
  gross_price: number;
  currency: string;
  unit: string;          // 'db' or 'm²'
}

export interface QuoteResult {
  materials: MaterialPricing[];
  grand_total_net: number;
  grand_total_vat: number;
  grand_total_gross: number;
  currency: string;
}

export interface MaterialInfo {
  id: string;
  name: string;
  width_mm: number;
  length_mm: number;
  on_stock: boolean;
  usage_limit: number;
  price_per_sqm: number;
  vat_rate: number; // as decimal (e.g., 0.27 for 27%)
  waste_multi: number;
  currency: string;
}

export interface EdgeMaterialInfo {
  name: string;
  price_per_m: number;
  vat_rate: number; // as decimal (e.g., 0.27 for 27%)
  overhang_mm: number; // ráhagyás
  currency: string;
}

export interface PanelEdge {
  edge_material_name: string;
  length_mm: number;
  quantity: number;
}

export interface CuttingFeeInfo {
  fee_per_meter: number;
  panthelyfuras_fee_per_hole: number;
  duplungolas_fee_per_sqm: number;
  szogvagas_fee_per_panel: number;
  vat_rate: number; // as decimal (e.g., 0.27 for 27%)
  currency: string;
}

export interface PanelWithServices {
  width_mm: number;
  height_mm: number;
  quantity: number;
  panthelyfuras_quantity: number;  // Holes per panel
  panthelyfuras_side: string;      // 'hosszú' or 'rövid'
  duplungolas: boolean;
  szogvagas: boolean;
}

/**
 * Calculate quote for optimization results
 */
export function calculateQuote(
  optimizationResults: OptimizationResult[],
  materials: MaterialInfo[],
  panelEdgesByMaterial: Map<string, PanelEdge[]>, // Edges grouped by material_id
  edgeMaterials: Map<string, EdgeMaterialInfo>,
  cuttingFeeInfo: CuttingFeeInfo | null = null,
  panelsByMaterial: Map<string, PanelWithServices[]> = new Map() // Panels grouped by material_id
): QuoteResult {
  const materialPricings: MaterialPricing[] = [];
  let grandTotalNet = 0;
  let grandTotalVat = 0;
  let grandTotalGross = 0;

  // Calculate material costs with their edge materials and services
  for (const result of optimizationResults) {
    const material = materials.find(m => m.id === result.material_id);
    if (!material) continue;

    // Get edges for this specific material
    const materialEdges = panelEdgesByMaterial.get(result.material_id) || [];
    
    // Get panels for this specific material
    const materialPanels = panelsByMaterial.get(result.material_id) || [];

    const materialPricing = calculateMaterialPricing(
      result, 
      material, 
      materialEdges, 
      edgeMaterials, 
      cuttingFeeInfo,
      materialPanels
    );
    materialPricings.push(materialPricing);
    
    grandTotalNet += materialPricing.total_net;
    grandTotalVat += materialPricing.total_vat;
    grandTotalGross += materialPricing.total_gross;
  }

  // Get currency from first material (assuming single currency for now)
  const currency = materials[0]?.currency || 'HUF';

  return {
    materials: materialPricings,
    grand_total_net: grandTotalNet,
    grand_total_vat: grandTotalVat,
    grand_total_gross: grandTotalGross,
    currency
  };
}

/**
 * Calculate pricing for a single material
 */
function calculateMaterialPricing(
  result: OptimizationResult,
  material: MaterialInfo,
  panelEdges: PanelEdge[],
  edgeMaterials: Map<string, EdgeMaterialInfo>,
  cuttingFeeInfo: CuttingFeeInfo | null = null,
  panels: PanelWithServices[] = []
): MaterialPricing {
  const boardArea = (material.width_mm * material.length_mm) / 1_000_000; // m²
  const boards: BoardPricing[] = [];
  
  // Group placements by board_id
  const placementsByBoard = new Map<number, Placement[]>();
  result.placements.forEach(placement => {
    const boardId = placement.board_id || 1;
    if (!placementsByBoard.has(boardId)) {
      placementsByBoard.set(boardId, []);
    }
    placementsByBoard.get(boardId)!.push(placement);
  });

  const boardIds = Array.from(placementsByBoard.keys()).sort((a, b) => a - b);

  if (material.on_stock) {
    // Calculate per-board pricing based on usage
    for (const boardId of boardIds) {
      const boardPlacements = placementsByBoard.get(boardId) || [];
      const boardUsedArea = boardPlacements.reduce((sum, p) => sum + (p.w_mm * p.h_mm), 0);
      const boardUsagePercentage = boardUsedArea / (material.width_mm * material.length_mm);
      const panelAreaM2 = boardUsedArea / 1_000_000;

      let chargedAreaM2: number;
      let pricingMethod: 'panel_area' | 'full_board';

      if (boardUsagePercentage < material.usage_limit) {
        // Under limit: charge for panel area with waste multiplier
        chargedAreaM2 = panelAreaM2 * material.waste_multi;
        pricingMethod = 'panel_area';
        
        // Formula: panel_area × price_per_sqm × (1 + VAT_rate) × waste_multi
        const netPrice = chargedAreaM2 * material.price_per_sqm;
        const vatAmount = netPrice * material.vat_rate;
        const grossPrice = netPrice + vatAmount;

        boards.push({
          board_id: boardId,
          usage_percentage: boardUsagePercentage * 100,
          area_m2: panelAreaM2,
          charged_area_m2: chargedAreaM2,
          net_price: netPrice,
          vat_amount: vatAmount,
          gross_price: grossPrice,
          pricing_method: pricingMethod
        });
      } else {
        // Over limit: charge for full board
        chargedAreaM2 = boardArea;
        pricingMethod = 'full_board';
        
        // Formula: board_area × price_per_sqm × (1 + VAT_rate)
        const netPrice = chargedAreaM2 * material.price_per_sqm;
        const vatAmount = netPrice * material.vat_rate;
        const grossPrice = netPrice + vatAmount;

        boards.push({
          board_id: boardId,
          usage_percentage: boardUsagePercentage * 100,
          area_m2: panelAreaM2,
          charged_area_m2: chargedAreaM2,
          net_price: netPrice,
          vat_amount: vatAmount,
          gross_price: grossPrice,
          pricing_method: pricingMethod
        });
      }
    }
  } else {
    // Not on stock: charge for full boards count, but show real usage
    const boardsUsed = result.metrics.boards_used;
    const totalBoardArea = boardsUsed * boardArea;
    
    // Calculate actual usage percentage
    const actualUsedArea = result.placements.reduce((sum, p) => sum + (p.w_mm * p.h_mm), 0);
    const actualUsagePercentage = (actualUsedArea / (material.width_mm * material.length_mm * boardsUsed)) * 100;
    
    // Formula: boards_count × board_area × price_per_sqm × (1 + VAT_rate)
    const netPrice = totalBoardArea * material.price_per_sqm;
    const vatAmount = netPrice * material.vat_rate;
    const grossPrice = netPrice + vatAmount;

    // Create separate board entries for each board used (so OptiClient can count them correctly)
    for (let i = 1; i <= boardsUsed; i++) {
      boards.push({
        board_id: i,
        usage_percentage: actualUsagePercentage, // Real usage, not 100%
        area_m2: actualUsedArea / 1_000_000,
        charged_area_m2: boardArea, // Each board is charged as full board
        net_price: netPrice / boardsUsed, // Split price across boards
        vat_amount: vatAmount / boardsUsed, // Split VAT across boards
        gross_price: grossPrice / boardsUsed, // Split gross across boards
        pricing_method: 'full_board'
      });
    }
  }

  // Calculate board totals
  const totalMaterialNet = boards.reduce((sum, b) => sum + b.net_price, 0);
  const totalMaterialVat = boards.reduce((sum, b) => sum + b.vat_amount, 0);
  const totalMaterialGross = boards.reduce((sum, b) => sum + b.gross_price, 0);

  // Calculate edge materials for this material
  const edgePricings = calculateEdgeMaterialPricing(panelEdges, edgeMaterials);
  const totalEdgeNet = edgePricings.reduce((sum, e) => sum + e.net_price, 0);
  const totalEdgeVat = edgePricings.reduce((sum, e) => sum + e.vat_amount, 0);
  const totalEdgeGross = edgePricings.reduce((sum, e) => sum + e.gross_price, 0);

  // Calculate cutting cost for this material
  const cuttingCostPricing = cuttingFeeInfo 
    ? calculateCuttingCost(result, cuttingFeeInfo)
    : null;
  const totalCuttingNet = cuttingCostPricing?.net_price || 0;
  const totalCuttingVat = cuttingCostPricing?.vat_amount || 0;
  const totalCuttingGross = cuttingCostPricing?.gross_price || 0;

  // Calculate additional services for this material
  const additionalServicesPricing = cuttingFeeInfo && panels.length > 0
    ? calculateAdditionalServices(panels, cuttingFeeInfo)
    : null;
  const totalServicesNet = additionalServicesPricing 
    ? (additionalServicesPricing.panthelyfuras?.net_price || 0) +
      (additionalServicesPricing.duplungolas?.net_price || 0) +
      (additionalServicesPricing.szogvagas?.net_price || 0)
    : 0;
  const totalServicesVat = additionalServicesPricing
    ? (additionalServicesPricing.panthelyfuras?.vat_amount || 0) +
      (additionalServicesPricing.duplungolas?.vat_amount || 0) +
      (additionalServicesPricing.szogvagas?.vat_amount || 0)
    : 0;
  const totalServicesGross = additionalServicesPricing
    ? (additionalServicesPricing.panthelyfuras?.gross_price || 0) +
      (additionalServicesPricing.duplungolas?.gross_price || 0) +
      (additionalServicesPricing.szogvagas?.gross_price || 0)
    : 0;

  return {
    material_id: material.id,
    material_name: material.name,
    on_stock: material.on_stock,
    boards,
    edge_materials: edgePricings,
    cutting_cost: cuttingCostPricing,
    additional_services: additionalServicesPricing,
    total_material_net: totalMaterialNet,
    total_material_vat: totalMaterialVat,
    total_material_gross: totalMaterialGross,
    total_edge_net: totalEdgeNet,
    total_edge_vat: totalEdgeVat,
    total_edge_gross: totalEdgeGross,
    total_cutting_net: totalCuttingNet,
    total_cutting_vat: totalCuttingVat,
    total_cutting_gross: totalCuttingGross,
    total_services_net: totalServicesNet,
    total_services_vat: totalServicesVat,
    total_services_gross: totalServicesGross,
    total_net: totalMaterialNet + totalEdgeNet + totalCuttingNet + totalServicesNet,
    total_vat: totalMaterialVat + totalEdgeVat + totalCuttingVat + totalServicesVat,
    total_gross: totalMaterialGross + totalEdgeGross + totalCuttingGross + totalServicesGross,
    currency: material.currency
  };
}

/**
 * Calculate pricing for edge materials
 */
function calculateEdgeMaterialPricing(
  panelEdges: PanelEdge[],
  edgeMaterials: Map<string, EdgeMaterialInfo>
): EdgeMaterialPricing[] {
  // Group by edge material name
  const edgesByMaterial = new Map<string, number>(); // name -> total length in mm
  
  for (const panelEdge of panelEdges) {
    const currentLength = edgesByMaterial.get(panelEdge.edge_material_name) || 0;
    edgesByMaterial.set(
      panelEdge.edge_material_name,
      currentLength + (panelEdge.length_mm * panelEdge.quantity)
    );
  }

  const result: EdgeMaterialPricing[] = [];

  for (const [edgeId, totalLengthMm] of edgesByMaterial.entries()) {
    const edgeInfo = edgeMaterials.get(edgeId);
    if (!edgeInfo) continue;

    const lengthM = totalLengthMm / 1000;
    
    // Add overhang (ráhagyás) per panel quantity
    // Count total quantity of panels using this edge material
    const totalQuantity = panelEdges
      .filter(e => e.edge_material_name === edgeId)
      .reduce((sum, e) => sum + e.quantity, 0);
    const overhangLengthMm = totalQuantity * edgeInfo.overhang_mm;
    const lengthWithOverhangM = (totalLengthMm + overhangLengthMm) / 1000;

    // Formula: length_with_overhang × price_per_m × (1 + VAT_rate)
    const netPrice = lengthWithOverhangM * edgeInfo.price_per_m;
    const vatAmount = netPrice * edgeInfo.vat_rate;
    const grossPrice = netPrice + vatAmount;

    result.push({
      edge_material_name: edgeInfo.name, // Use display name from edgeInfo
      length_m: lengthM,
      length_with_overhang_m: lengthWithOverhangM,
      price_per_m: edgeInfo.price_per_m,
      net_price: netPrice,
      vat_rate: edgeInfo.vat_rate,
      vat_amount: vatAmount,
      gross_price: grossPrice,
      currency: edgeInfo.currency
    });
  }

  return result;
}

/**
 * Calculate cutting cost for a material based on total cutting length
 */
function calculateCuttingCost(
  result: OptimizationResult,
  cuttingFeeInfo: CuttingFeeInfo
): CuttingCostPricing {
  // Get total cutting length from metrics (already aggregated)
  const totalCuttingLengthMm = result.metrics.total_cut_length_mm || 0;
  const totalCuttingLengthM = totalCuttingLengthMm / 1000;

  // Calculate cost: cutting_length × fee_per_meter × (1 + VAT_rate)
  const netPrice = totalCuttingLengthM * cuttingFeeInfo.fee_per_meter;
  const vatAmount = netPrice * cuttingFeeInfo.vat_rate;
  const grossPrice = netPrice + vatAmount;

  return {
    total_cutting_length_m: totalCuttingLengthM,
    fee_per_meter: cuttingFeeInfo.fee_per_meter,
    net_price: netPrice,
    vat_rate: cuttingFeeInfo.vat_rate,
    vat_amount: vatAmount,
    gross_price: grossPrice,
    currency: cuttingFeeInfo.currency
  };
}

/**
 * Calculate additional services (Pánthelyfúrás, Duplungolás, Szögvágás) for panels
 */
function calculateAdditionalServices(
  panels: PanelWithServices[],
  feeInfo: CuttingFeeInfo
): AdditionalServicesPricing {
  let totalHoles = 0;
  let totalDuplungolasArea = 0;
  let totalSzogvagasPanels = 0;

  // Aggregate service quantities across all panels
  for (const panel of panels) {
    // Pánthelyfúrás: holes × quantity
    if (panel.panthelyfuras_quantity > 0) {
      totalHoles += panel.panthelyfuras_quantity * panel.quantity;
    }

    // Duplungolás: panel area × quantity (only if duplungolás is true)
    if (panel.duplungolas) {
      const panelAreaM2 = (panel.width_mm * panel.height_mm) / 1_000_000;
      totalDuplungolasArea += panelAreaM2 * panel.quantity;
    }

    // Szögvágás: panel count (only if szögvágás is true)
    if (panel.szogvagas) {
      totalSzogvagasPanels += panel.quantity;
    }
  }

  // Calculate Pánthelyfúrás pricing
  const panthelyfuras = totalHoles > 0 ? {
    quantity: totalHoles,
    unit_price: feeInfo.panthelyfuras_fee_per_hole,
    net_price: totalHoles * feeInfo.panthelyfuras_fee_per_hole,
    vat_rate: feeInfo.vat_rate,
    vat_amount: totalHoles * feeInfo.panthelyfuras_fee_per_hole * feeInfo.vat_rate,
    gross_price: totalHoles * feeInfo.panthelyfuras_fee_per_hole * (1 + feeInfo.vat_rate),
    currency: feeInfo.currency,
    unit: 'db'
  } : null;

  // Calculate Duplungolás pricing
  const duplungolas = totalDuplungolasArea > 0 ? {
    quantity: totalDuplungolasArea,
    unit_price: feeInfo.duplungolas_fee_per_sqm,
    net_price: totalDuplungolasArea * feeInfo.duplungolas_fee_per_sqm,
    vat_rate: feeInfo.vat_rate,
    vat_amount: totalDuplungolasArea * feeInfo.duplungolas_fee_per_sqm * feeInfo.vat_rate,
    gross_price: totalDuplungolasArea * feeInfo.duplungolas_fee_per_sqm * (1 + feeInfo.vat_rate),
    currency: feeInfo.currency,
    unit: 'm²'
  } : null;

  // Calculate Szögvágás pricing
  const szogvagas = totalSzogvagasPanels > 0 ? {
    quantity: totalSzogvagasPanels,
    unit_price: feeInfo.szogvagas_fee_per_panel,
    net_price: totalSzogvagasPanels * feeInfo.szogvagas_fee_per_panel,
    vat_rate: feeInfo.vat_rate,
    vat_amount: totalSzogvagasPanels * feeInfo.szogvagas_fee_per_panel * feeInfo.vat_rate,
    gross_price: totalSzogvagasPanels * feeInfo.szogvagas_fee_per_panel * (1 + feeInfo.vat_rate),
    currency: feeInfo.currency,
    unit: 'db'
  } : null;

  return {
    panthelyfuras,
    duplungolas,
    szogvagas
  };
}

/**
 * Format price for display (e.g., "1 234 567 Ft")
 */
export function formatPrice(amount: number, currency: string = 'HUF'): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${currency}`;
}

