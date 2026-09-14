// TypeScript interfaces for optimization system
// Mirrors the PHP optimization architecture

export interface Rectangle {
  width: number;
  height: number;
  x: number;
  y: number;
  rotatable: boolean;
}

export interface Bin {
  width: number;
  height: number;
  usedRectangles: Rectangle[];
  freeRectangles: Rectangle[];
  kerf: number;
}

export interface Part {
  id: string;
  w_mm: number;
  h_mm: number;
  qty: number;
  allow_rot_90: boolean;
  grain_locked: boolean;
}

export interface Board {
  w_mm: number;
  h_mm: number;
  trim_top_mm: number;
  trim_right_mm: number;
  trim_bottom_mm: number;
  trim_left_mm: number;
}

export interface Params {
  kerf_mm: number;
}

export interface MaterialData {
  id: string;
  name: string;
  parts: Part[];
  board: Board;
  params: Params;
}

export interface OptimizationRequest {
  materials: MaterialData[];
}

export interface Placement {
  id: string;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  rot_deg: number;
  board_id: number;
}

export interface UnplacedPart {
  id: string;
  w_mm: number;
  h_mm: number;
  reason?: string;
}

export interface Metrics {
  used_area_mm2: number;
  board_area_mm2: number;
  waste_pct: number;
  placed_count: number;
  unplaced_count: number;
  boards_used: number;
  total_cut_length_mm: number;
}

export interface DebugInfo {
  board_width: number;
  board_height: number;
  usable_width: number;
  usable_height: number;
  bins_count: number;
  panels_count: number;
}

export interface OptimizationResult {
  material_id: string;
  material_name: string;
  placements: Placement[];
  unplaced: UnplacedPart[];
  metrics: Metrics;
  board_cut_lengths: Record<number, number>;
  debug: DebugInfo;
}

export interface OptimizationResponse {
  results: OptimizationResult[];
}

// Constants
export const KERF = 3; // Default cutting width in mm
export const DEFAULT_EDGE_FEE_PER_METER = 5;
export const DEFAULT_CUTTING_FEE_PER_METER = 10;
export const DEFAULT_USAGE_LIMIT = 80;
