// Beam Saw Optimization Types
// Phase 1: Foundation types for improved optimization

export type MM = number;

export interface BeamSawConfig {
  boardWidth: MM;
  boardHeight: MM;
  kerf: MM;
  trim: {
    top: MM;
    right: MM;
    bottom: MM;
    left: MM;
  };
  cutOrder: 'HORIZONTAL_FIRST' | 'VERTICAL_FIRST';
  minStrip: MM; // Minimum usable strip size for beam saw (e.g., 100mm)
}

export interface PanelInput {
  id: string;
  width: MM;
  height: MM;
  rotatable: boolean; // Based on grain direction
  quantity?: number;
}

export interface PlacementResult {
  id: string;
  x: MM;
  y: MM;
  width: MM;
  height: MM;
  rotated: boolean;
  boardIndex: number;
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  sortMethod: 'area' | 'maxEdge' | 'perimeter' | 'aspectRatio';
  rotateFirstPanel: boolean;
}

export interface OptimizationMetrics {
  totalBoards: number;
  totalPanelArea: MM;
  totalBoardArea: MM;
  wasteArea: MM;
  efficiency: number; // 0-1
  averageWastePerBoard: MM;
}

