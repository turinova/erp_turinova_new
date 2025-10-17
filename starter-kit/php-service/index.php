<?php
// Railway PHP Service - Material Optimization API
// This service provides material optimization calculations for the ERP system

// Enable error reporting
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 300);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

// Set CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get the request data from the frontend
$input = file_get_contents('php://input');
$requestData = json_decode($input, true);

if (!$requestData || !isset($requestData['materials'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request data - missing materials']);
    exit;
}

// Log the received data for debugging
error_log('Received optimization request with ' . count($requestData['materials']) . ' materials');

// Include the optimization classes and functions
require './optimization_classes.php';

// Initialize results array
        $results = [];

// Process each material from the request
foreach ($requestData['materials'] as $materialData) {
    $materialId = $materialData['id'];
    $materialName = $materialData['name'];
    $boardWidth = $materialData['board']['w_mm'];
    $boardHeight = $materialData['board']['h_mm'];
    
    error_log("Processing material: $materialName ($materialId) - Board: {$boardWidth}x{$boardHeight}mm");
    
    // Initialize optimization for this material
    $optimizer = new MaterialOptimizer($boardWidth, $boardHeight);
    
    // Add all parts for this material
    $placedParts = [];
    $unplacedParts = [];
    
    foreach ($materialData['parts'] as $part) {
        $width = (int)$part['w_mm'];
        $height = (int)$part['h_mm'];
        $quantity = (int)$part['qty'];
        $allowRotation = $part['allow_rot_90'] ?? true;
        
        // Try to place this part
        for ($i = 0; $i < $quantity; $i++) {
            $placement = $optimizer->placePart($width, $height, $allowRotation);
            
            if ($placement) {
                $placedParts[] = [
                    'part_id' => $part['id'] . '-' . ($i + 1),
                    'x' => $placement['x'],
                    'y' => $placement['y'],
                    'w_mm' => $width,
                    'h_mm' => $height,
                    'rot_deg' => $placement['rotated'] ? 90 : 0,
                    'board_id' => 1 // Single board for now
                ];
            } else {
                $unplacedParts[] = [
                    'part_id' => $part['id'] . '-' . ($i + 1),
                    'w_mm' => $width,
                    'h_mm' => $height,
                    'reason' => 'No space available'
                ];
            }
        }
    }
    
    // Calculate metrics
    $usedArea = array_sum(array_map(function($part) {
        return $part['w_mm'] * $part['h_mm'];
    }, $placedParts));
    
    $boardArea = $boardWidth * $boardHeight;
    $wastePercentage = $boardArea > 0 ? (($boardArea - $usedArea) / $boardArea) * 100 : 0;
    
    // Add result for this material
    $results[] = [
        'material_id' => $materialId,
        'material_name' => $materialName,
        'placements' => $placedParts,
        'unplaced' => $unplacedParts,
        'metrics' => [
            'used_area_mm2' => $usedArea,
            'board_area_mm2' => $boardArea,
            'waste_pct' => round($wastePercentage, 2),
            'placed_count' => count($placedParts),
            'unplaced_count' => count($unplacedParts),
            'boards_used' => 1,
            'total_cut_length_mm' => $boardWidth + $boardHeight // Simple calculation
        ],
        'board_cut_lengths' => [
            1 => $boardWidth + $boardHeight
        ],
        'debug' => [
            'board_width' => $boardWidth,
            'board_height' => $boardHeight,
            'usable_width' => $boardWidth,
            'usable_height' => $boardHeight,
            'bins_count' => 1,
            'panels_count' => count($materialData['parts'])
        ]
    ];
}

// Return results array directly as expected by OptiClient
ob_clean();
echo json_encode($results, JSON_PRETTY_PRINT);
?>