<?php
// Simple optimization test endpoint without database dependency
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get request body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Return mock optimization response
echo json_encode([
    [
        "material_id" => "mock-1",
        "material_name" => "Mock Material (PHP)",
        "metrics" => [
            "used_area_mm2" => 1000000,
            "board_area_mm2" => 1200000,
            "placed_count" => 5,
            "unplaced_count" => 0,
            "waste_pct" => 16.67
        ],
        "placements" => [
            [
                "part_id" => "part-1",
                "x" => 0,
                "y" => 0,
                "width" => 100,
                "height" => 100,
                "rotated" => false
            ]
        ]
    ]
]);
?>
