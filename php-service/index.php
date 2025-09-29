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

// Database connection
require './db.php';

// Fetch materials from Supabase
$materials_query = "SELECT material_id, material_type, board_height, board_width, price_per_square_meter, sell_by_square_meter, Rotatable, waste_multi FROM materials WHERE deleted_at IS NULL";
$materials_result = $conn->query($materials_query);
if (!$materials_result) {
    error_log("Error fetching materials: " . $conn->errorInfo()[2]);
    echo json_encode(['error' => 'Error fetching materials.']);
    exit;
}

$admin_boards = [];
while ($row = $materials_result->fetch()) {
    $admin_boards[$row['material_id']] = [
        "material_id" => $row['material_id'],
        "board_height" => $row['board_height'],
        "board_width" => $row['board_width'],
        "price_per_square_meter" => $row['price_per_square_meter'],
        "sell_by_square_meter" => $row['sell_by_square_meter'],
        "name" => $row['material_type'],
        "price" => $row['price_per_square_meter'],
        "charge_type" => $row['sell_by_square_meter'] ? 'by square meter' : 'by board',
        "rotatable" => !empty($row['Rotatable']) && $row['Rotatable'] == 1,
        "waste_multi" => !empty($row['waste_multi']) ? $row['waste_multi'] : 1
    ];
}

// Fetch edge materials from Supabase
$edge_materials_query = "SELECT edge_metarial_ID, edge_material, price_per_meter FROM edge_materials WHERE deleted_at IS NULL";
$edge_materials_result = $conn->query($edge_materials_query);
if (!$edge_materials_result) {
    error_log("Error fetching edge materials: " . $conn->errorInfo()[2]);
    echo json_encode(['error' => 'Error fetching edge materials.']);
    exit;
}

$admin_edge_materials = [];
while ($row = $edge_materials_result->fetch()) {
    $admin_edge_materials[$row['edge_metarial_ID']] = [
        "edge_material_id" => $row['edge_metarial_ID'],
        "price_per_meter" => $row['price_per_meter'],
        "name" => $row['edge_material'],
        "price" => $row['price_per_meter']
    ];
}

// Fetch cutting fees from Supabase
$cutting_fees_query = "SELECT * FROM cutting_fees WHERE deleted_at IS NULL LIMIT 1";
$cutting_fees_result = $conn->query($cutting_fees_query);
if (!$cutting_fees_result) {
    error_log("Error fetching cutting fees: " . $conn->errorInfo()[2]);
    echo json_encode(['error' => 'Error fetching cutting fees.']);
    exit;
}

$cutting_fees = $cutting_fees_result->fetch();
if (!$cutting_fees) {
    // Use default values if no cutting fees found
    $edge_fee_per_meter = 5;
    $cutting_fee_per_meter = 10;
    $kerf_size = 3;
    $usage_limit = 80;
} else {
    $edge_fee_per_meter = $cutting_fees['edge_fee_per_meter'];
    $cutting_fee_per_meter = $cutting_fees['cutting_fee_per_meter'];
    $kerf_size = $cutting_fees['kerf_size'];
    $usage_limit = $cutting_fees['usage_limit'];
}

// Include the optimization classes and functions
require './optimization_classes.php';

// Initialize variables
$total_price = 0;
$total_boards_used = 0;
$board_usage = [];
$total_cutting_length = 0;
$total_edge_banding_length = 0;
$total_cutting_cost = 0;
$total_edge_banding_cost = 0;
$total_square_meters = [];
$total_boards = [];
$total_board_costs = [];
$total_material_costs = [];
$edge_banding_by_material = [];

// Handle POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $material_types = $_POST['material_type'] ?? [];
        error_log("Received material_types: " . print_r($material_types, true));

        // Validate material exists
        foreach ($material_types as $material_id) {
            if (!isset($admin_boards[$material_id])) {
                throw new Exception("Material not found: " . $material_id);
            }
        }

        $heights = $_POST['width'] ?? [];
        $widths = $_POST['height'] ?? [];
        $quantities = $_POST['quantity'] ?? [];
        $right_long_edge_materials = $_POST['right_short_edge_material'] ?? [];
        $left_long_edge_materials = $_POST['left_short_edge_material'] ?? [];
        $right_short_edge_materials = $_POST['right_long_edge_material'] ?? [];
        $left_short_edge_materials = $_POST['left_long_edge_material'] ?? [];
        $labels = $_POST['label'] ?? [];

        $results = [];
        $grouped_panels = [];

        // Group panels by material type
        for ($i = 0; $i < count($material_types); $i++) {
            $material_type = $material_types[$i];
            $height = (int)$heights[$i];
            $width = (int)$widths[$i];
            $quantity = (int)$quantities[$i];

            if (!isset($grouped_panels[$material_type])) {
                $grouped_panels[$material_type] = [];
            }

            for ($j = 0; $j < $quantity; $j++) {
                $grouped_panels[$material_type][] = new Rectangle($width, $height, 0, 0, $admin_boards[$material_type]['rotatable']);
            }
        }

        // Process each group of panels
        foreach ($grouped_panels as $material_type => $panels) {
            $board_width = $admin_boards[$material_type]['board_height'];
            $board_height = $admin_boards[$material_type]['board_width'];
            $price_per_square_meter = $admin_boards[$material_type]['price_per_square_meter'];
            $sell_by_square_meter = $admin_boards[$material_type]['sell_by_square_meter'];

            $material_cost = 0;
            $edge_banding_length = 0;
            $edge_banding_cost = 0;
            $waste_multiplier = isset($admin_boards[$material_type]['waste_multi']) 
                ? (1 + (float) $admin_boards[$material_type]['waste_multi'])  
                : 1;
            $trim_width = 25;
            $trim_height = 25;

            // Adjust board dimensions by subtracting trim
            $usable_board_width = $board_width - $trim_width;
            $usable_board_height = $board_height - $trim_height;

            // Ensure dimensions do not become negative
            if ($usable_board_width <= 0 || $usable_board_height <= 0) {
                die("Error: Trim dimensions are larger than the board dimensions.");
            }

            // Get bin packing solution
            $bins = guillotineCutting($panels, $usable_board_width, $usable_board_height);

            if ($sell_by_square_meter) {
                // Get board usage result
                $usage_result = calculateBoardUsage($panels, $usable_board_width, $usable_board_height, $usage_limit);
               
                $used_board = $usage_result['total_boards'];
                $squaremeter_needed = $usage_result['extra_squaremeters'];

                $total_area = $squaremeter_needed;
                $boards_needed = $used_board;

                // Calculate material cost
                $material_cost = (($total_area * $waste_multiplier) * $price_per_square_meter) 
                            + ($boards_needed * ($board_height / 1000) * ($board_width / 1000) * $price_per_square_meter);
                $material_cost = round($material_cost / 10) * 10;

                // Store square meters usage per material type
                if (!isset($total_square_meters[$material_type])) {
                    $total_square_meters[$material_type] = 0;
                }
                $total_square_meters[$material_type] += $total_area;

                if (!isset($total_boards[$material_type])) {
                    $total_boards[$material_type] = 0;
                }
                $total_boards[$material_type] += $boards_needed;
            } else {
                // Calculate the required number of boards
                $boards_needed = calculateBoardsNeeded($panels, $usable_board_width, $usable_board_height);

                $total_boards_used += $boards_needed;
                $material_cost = $boards_needed * ($board_height / 1000) * ($board_width / 1000) * $price_per_square_meter;
                $material_cost = round($material_cost / 10) * 10;
                
                if (!isset($total_boards[$material_type])) {
                    $total_boards[$material_type] = 0;
                }
                if (!isset($total_board_costs[$material_type])) {
                    $total_board_costs[$material_type] = 0;
                }
                $total_boards[$material_type] += $boards_needed;
                $total_board_costs[$material_type] += $material_cost;
            }

            // Calculate cutting length
            $results_for_cutting = [
                [
                    'bins' => $bins
                ]
            ];
            $cutting_length = calculateTotalCuttingLength($results_for_cutting) / 1000;

            // Calculate cutting cost
            $cutting_cost = $cutting_length * $cutting_fee_per_meter;
            $cutting_cost = max($cutting_cost, 1900);
            $cutting_cost = round($cutting_cost / 10) * 10;
            $total_cutting_cost += $cutting_cost;
            $total_cutting_length += $cutting_length;

            $total_price += $material_cost + $cutting_cost;

            // Accumulate total material costs
            if (!isset($total_material_costs[$material_type])) {
                $total_material_costs[$material_type] = 0;
            }
            $total_material_costs[$material_type] += $material_cost + $cutting_cost;

            // Store results
            $results[] = [
                'material_id' => $admin_boards[$material_type]['material_id'],
                'material_type' => $material_type,
                'height' => $board_height,
                'width' => $board_width,
                'quantity' => count($panels),
                'label' => implode(', ', $labels),
                'material_cost_per_m2' => $price_per_square_meter,
                'cutting_length' => $cutting_length,
                'edge_banding_length' => $edge_banding_length,
                'material_cost' => $material_cost,
                'cutting_cost' => $cutting_cost,
                'edge_banding_cost' => $edge_banding_cost,
                'total_cost' => $material_cost,
                'boards_needed' => $boards_needed,
                'total_square_meters' => isset($total_square_meters[$material_type]) ? $total_square_meters[$material_type] : 0,
                'total_boards' => isset($total_boards[$material_type]) ? $total_boards[$material_type] : 0,
                'total_board_costs' => isset($total_board_costs[$material_type]) ? $total_board_costs[$material_type] : 0,
                'total_material_costs' => isset($total_material_costs[$material_type]) ? $total_material_costs[$material_type] : 0
            ];
        }

        // Calculate edge banding costs and lengths
        $edge_banding_totals = [];

        for ($i = 0; $i < count($material_types); $i++) {
            $material_type = $material_types[$i];
            $height = (int)$heights[$i];
            $width = (int)$widths[$i];
            $quantity = (int)$quantities[$i];
            
            if (!isset($edge_banding_totals[$material_type])) {
                $edge_banding_totals[$material_type] = [
                    'length' => 0,
                    'cost' => 0
                ];
            }
            
            $length = 0;
            $edge_banding_cost = 0;

            if (!isset($edge_banding_by_material[$material_type])) {
                $edge_banding_by_material[$material_type] = [];
            }

            // Calculate edge banding for each edge
            if ($right_long_edge_materials[$i] !== 'none') {
                $edge_length = ($height / 1000 + 0.04) * $quantity;
                $length += $edge_length;
                $edge_banding_cost += $edge_length * ($admin_edge_materials[$right_long_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                if (!isset($edge_banding_by_material[$material_type][$right_long_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$right_long_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$right_long_edge_materials[$i]] += $edge_length;
            }

            if ($left_long_edge_materials[$i] !== 'none') {
                $edge_length = ($height / 1000 + 0.04) * $quantity;
                $length += $edge_length;
                if (isset($admin_edge_materials[$left_long_edge_materials[$i]])) {
                    $edge_banding_cost += $edge_length * ($admin_edge_materials[$left_long_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                }
                if (!isset($edge_banding_by_material[$material_type][$left_long_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$left_long_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$left_long_edge_materials[$i]] += $edge_length;
            }

            if ($right_short_edge_materials[$i] !== 'none') {
                $edge_length = ($width / 1000 + 0.04) * $quantity;
                $length += $edge_length;
                $edge_banding_cost += $edge_length * ($admin_edge_materials[$right_short_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                if (!isset($edge_banding_by_material[$material_type][$right_short_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$right_short_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$right_short_edge_materials[$i]] += $edge_length;
            }

            if ($left_short_edge_materials[$i] !== 'none') {
                $edge_length = ($width / 1000 + 0.04) * $quantity;
                $length += $edge_length;
                $edge_banding_cost += $edge_length * ($admin_edge_materials[$left_short_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                if (!isset($edge_banding_by_material[$material_type][$left_short_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$left_short_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$left_short_edge_materials[$i]] += $edge_length;
            }

            $edge_banding_totals[$material_type]['length'] += $length;
            $edge_banding_totals[$material_type]['cost'] += $edge_banding_cost;

            $total_edge_banding_length += $length;
            $edge_banding_cost = round($edge_banding_cost / 10) * 10;
            $total_edge_banding_cost += $edge_banding_cost;
            $total_price += $edge_banding_cost;
        }
        
        // Update the results array with edge banding information
        foreach ($results as $key => $result) {
            $material_type = $result['material_type'];
            if (isset($edge_banding_totals[$material_type])) {
                $results[$key]['edge_banding_length'] = $edge_banding_totals[$material_type]['length'];
                $results[$key]['edge_banding_cost'] = $edge_banding_totals[$material_type]['cost'];
            }
        }

        // Prepare response
        $response = [
            'results' => $results,
            'total_price' => $total_price,
            'total_cutting_length' => $total_cutting_length,
            'total_edge_banding_length' => $total_edge_banding_length,
            'total_cutting_cost' => $total_cutting_cost,
            'total_edge_banding_cost' => $total_edge_banding_cost,
            'total_square_meters' => $total_square_meters,
            'total_boards' => $total_boards,
            'total_board_costs' => $total_board_costs,
            'total_material_costs' => $total_material_costs,
            'edge_banding_by_material' => $edge_banding_by_material,
            'status' => 'success',
            'timestamp' => date('Y-m-d H:i:s')
        ];

        ob_clean();
        echo json_encode($response, JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage(),
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
} else {
    // Handle GET requests - return service info
    echo json_encode([
        'service' => 'Material Optimization API',
        'version' => '1.0.0',
        'status' => 'running',
        'endpoints' => [
            'POST /' => 'Calculate material optimization',
            'GET /' => 'Service information'
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>
