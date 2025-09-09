# OptiTest Page

A test page for panel optimization functionality that connects to the Rust optimization service.

## Features

### Material Selection
- Choose from 5 predefined materials (MDF, Plywood, Chipboard, OSB, Hardboard)
- Each material has specific dimensions, thickness, and grain direction properties
- Materials include trim margins and kerf considerations

### Panel Management
- Add panels with custom dimensions (length × width in mm)
- Set quantity for each panel type
- Add marking/labeling for identification
- Configure edge banding for all four edges (Top, Right, Bottom, Left)
- Remove individual panels from the list

### Optimization
- Connects to the Rust optimization service running on `localhost:8080`
- Uses MaxRects-Guillotine algorithm with kerf spacing
- Respects grain direction constraints
- Supports 90° rotation when allowed
- Returns placement coordinates and metrics

### Visualization
- Simple visual representation of the optimized layout
- Shows placed panels with different colors
- Displays rotation indicators
- Shows board dimensions and panel positions

## Usage

1. **Select Material**: Choose a material from the dropdown
2. **Add Panels**: Enter dimensions, quantity, marking, and edge banding
3. **Optimize**: Click "Optimize Layout" to run the optimization
4. **View Results**: See the placement visualization and metrics

## Prerequisites

The Rust optimization service must be running on `localhost:8080`:

```bash
cd /Volumes/T7/erp_turinova_new/services/optimizer
source ~/.cargo/env
./target/release/optimizer &
```

## API Integration

The page calls the optimization service with this structure:

```json
{
  "board": {
    "w_mm": 2800,
    "h_mm": 2070,
    "trim_top_mm": 10,
    "trim_right_mm": 10,
    "trim_bottom_mm": 10,
    "trim_left_mm": 10
  },
  "parts": [
    {
      "id": "panel-1-1",
      "w_mm": 600,
      "h_mm": 400,
      "qty": 1,
      "allow_rot_90": true,
      "grain_locked": false
    }
  ],
  "params": {
    "kerf_mm": 3,
    "seed": 123456
  }
}
```

## Response Format

```json
{
  "placements": [
    {
      "id": "panel-1-1",
      "x_mm": 10,
      "y_mm": 10,
      "w_mm": 600,
      "h_mm": 400,
      "rot_deg": 0
    }
  ],
  "unplaced": [],
  "metrics": {
    "used_area_mm2": 240000,
    "board_area_mm2": 5796000,
    "waste_pct": 95.86,
    "placed_count": 1,
    "unplaced_count": 0
  }
}
```

## Navigation

Access the page via the "OptiTest" menu item in the sidebar (orange test tube icon).
