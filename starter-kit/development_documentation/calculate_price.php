<?php
// Enable error reporting
ini_set('memory_limit', '512M'); // Adjust if needed
ini_set('max_execution_time', 300); // 5 minutes

ini_set('display_errors', 0);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

header('Content-Type: application/json');

// Database connection
require './db.php';

// Fetch materials
$materials_query = "SELECT material_id, material_type, board_height, board_width, price_per_square_meter, sell_by_square_meter, Rotatable, waste_multi FROM materials";
$materials_result = $conn->query($materials_query);
if (!$materials_result) {
    error_log("Error fetching materials: " . $conn->error . "\n", 3, 'error_log.txt');
    echo json_encode(['error' => 'Error fetching materials.']);
    exit;
}
$admin_boards = [];
while ($row = $materials_result->fetch_assoc()) {
    $admin_boards[$row['material_id']] = [
        "material_id" => $row['material_id'],
        "board_height" => $row['board_height'],
        "board_width" => $row['board_width'],
        "price_per_square_meter" => $row['price_per_square_meter'],
        "sell_by_square_meter" => $row['sell_by_square_meter'],
        "name" => $row['material_type'],
        "price" => $row['price_per_square_meter'],
        "charge_type" => $row['sell_by_square_meter'] ? 'by square meter' : 'by board',
        "rotatable" => !empty($row['Rotatable']) && $row['Rotatable'] == 1, // Convert to boolean
        "waste_multi" => !empty($row['waste_multi']) ? $row['waste_multi'] : 1
    ];
}

// Fetch edge materials
$edge_materials_query = "SELECT edge_metarial_ID, edge_material, price_per_meter FROM edge_materials";
$edge_materials_result = $conn->query($edge_materials_query);
if (!$edge_materials_result) {
    error_log("Error fetching edge materials: " . $conn->error . "\n", 3, 'error_log.txt');
    echo json_encode(['error' => 'Error fetching edge materials.']);
    exit;
}
$admin_edge_materials = [];
while ($row = $edge_materials_result->fetch_assoc()) {
    $admin_edge_materials[$row['edge_metarial_ID']] = [
        "edge_material_id" => $row['edge_metarial_ID'],
        "price_per_meter" => $row['price_per_meter'],
        "name" => $row['edge_material'],
        "price" => $row['price_per_meter']
    ];
}

// Fetch cutting fees
$cutting_fees_query = "SELECT * FROM cutting_fees";
$cutting_fees_result = $conn->query($cutting_fees_query);
if (!$cutting_fees_result) {
    error_log("Error fetching cutting fees: " . $conn->error . "\n", 3, 'error_log.txt');
    echo json_encode(['error' => 'Error fetching cutting fees.']);
    exit;
}
$cutting_fees = $cutting_fees_result->fetch_assoc();
$edge_fee_per_meter = $cutting_fees['edge_fee_per_meter'];
$cutting_fee_per_meter = $cutting_fees['cutting_fee_per_meter'];
$kerf_size = $cutting_fees['kerf_size'];

$usage_limit = $cutting_fees['usage_limit'];






$total_price = 0;
$total_boards_used = 0;
$board_usage = [];
$total_cutting_length = 0; // Initialize total cutting length
$total_edge_banding_length = 0; // Initialize total edge banding length
$total_cutting_cost = 0; // Initialize total cutting cost
$total_edge_banding_cost = 0; // Initialize total edge banding cost
$total_square_meters = []; // Initialize total square meters for each material sold by square meter
$total_boards = []; // Initialize total boards used for each material sold by board
$total_board_costs = []; // Initialize total board costs for each material sold by board
$total_material_costs = []; // Initialize total material costs for each material

define('KERF', $kerf_size);
 // Define cutting width in mm

class Rectangle {
    public $width;
    public $height;
    public $x;
    public $y;
    public $rotatable;

    public function __construct($width, $height, $x = 0, $y = 0, $rotatable = false) {
        $this->width = $width;
        $this->height = $height;
        $this->x = $x;
        $this->y = $y;
        $this->rotatable = $rotatable;
    }
}

class Bin {
    public $width;
    public $height;
    public $usedRectangles = [];
    public $freeRectangles = [];

    public function __construct($width, $height) {
        $this->width = $width;
        $this->height = $height;
        $this->freeRectangles[] = new Rectangle($width, $height);
    }

    public function insert($rectangle) {
        $bestFit = null;
        $bestFitIndex = -1;
        $bestWaste = PHP_INT_MAX;
        $rotated = false;

        foreach ($this->freeRectangles as $index => $freeRect) {
            $normalWaste = ($freeRect->width - $rectangle->width) * ($freeRect->height - $rectangle->height);
            $rotatedWaste = ($freeRect->width - $rectangle->height) * ($freeRect->height - $rectangle->width);

            if ($freeRect->width >= $rectangle->width + KERF && 
                $freeRect->height >= $rectangle->height + KERF) {
                if ($normalWaste < $bestWaste) {
                    $bestFit = $freeRect;
                    $bestFitIndex = $index;
                    $bestWaste = $normalWaste;
                    $rotated = false;
                }
            }

            if ($rectangle->rotatable && 
                $freeRect->width >= $rectangle->height + KERF && 
                $freeRect->height >= $rectangle->width + KERF) {
                if ($rotatedWaste < $bestWaste) {
                    $bestFit = $freeRect;
                    $bestFitIndex = $index;
                    $bestWaste = $rotatedWaste;
                    $rotated = true;
                }
            }
        }

        if ($bestFit === null) {
            return false;
        }

        array_splice($this->freeRectangles, $bestFitIndex, 1);

        if ($rotated) {
            list($rectangle->width, $rectangle->height) = [$rectangle->height, $rectangle->width];
        }

        $this->splitFreeSpaceVerticalFirst($bestFit, $rectangle);
        
        $rectangle->x = $bestFit->x;
        $rectangle->y = $bestFit->y;
        $this->usedRectangles[] = $rectangle;

        return true;
    }

    private function splitFreeSpaceVerticalFirst($freeRect, $placedRect) {
        $widthRemainder = $freeRect->width - $placedRect->width - KERF;
        $heightRemainder = $freeRect->height - $placedRect->height - KERF;
        
        // Prioritize vertical cuts first
        if ($heightRemainder > 0) {
            $this->freeRectangles[] = new Rectangle(
                $freeRect->width, 
                $heightRemainder, 
                $freeRect->x, 
                $freeRect->y + $placedRect->height + KERF
            );
        }
        if ($widthRemainder > 0) {
            $this->freeRectangles[] = new Rectangle(
                $widthRemainder, 
                $placedRect->height, 
                $freeRect->x + $placedRect->width + KERF, 
                $freeRect->y
            );
        }
    }
}

function guillotineCutting($rectangles, $binWidth, $binHeight) {
    $bins = [];
    $bins[] = new Bin($binWidth, $binHeight);

    usort($rectangles, function ($a, $b) {
        return ($b->width * $b->height) - ($a->width * $a->height);
    });

    foreach ($rectangles as $rectangle) {
        $placed = false;
        foreach ($bins as $bin) {
            if ($bin->insert($rectangle)) {
                $placed = true;
                break;
            }
        }
        if (!$placed) {
            $newBin = new Bin($binWidth, $binHeight);
            $newBin->insert($rectangle);
            $bins[] = $newBin;
        }
    }

    return $bins;
}

function calculateTotalCuttingLength($results) {
    $totalCuttingLength = 0;
    $binCount = 0;
    
    foreach ($results as $result) {
        foreach ($result['bins'] as $bin) {
            $binCount++;
            $totalCuttingLength += processBin($bin);
        }
    }
    
    return $totalCuttingLength;
}

function processBin($bin) {
    $cuttingLength = 0;
    $currentY = 0;
    $remainingRectangles = $bin->usedRectangles;
    $stripCount = 0;
    
    // Add initial full cuts (one horizontal, one vertical)
    $cuttingLength += $bin->width;  // Full horizontal cut (2800)
    $cuttingLength += $bin->height; // Full vertical cut (2070)
    
    while (count($remainingRectangles) > 0) {
        $stripCount++;
        
        $strip = getNextStrip($remainingRectangles, $bin, $currentY);
        if (!$strip) break;
        
        // Initial horizontal cut for each strip
        $cuttingLength += $bin->width;  // Using width (2800) for horizontal cuts
        
        // Process strip with rotation consideration
        $stripCuttingLength = processStripWithRotation($strip);
        $cuttingLength += $stripCuttingLength;
        
        $currentY = $strip['height'];
        $remainingRectangles = $strip['remainingRectangles'];
    }
    
    return $cuttingLength;
}

function getNextStrip($rectangles, $bin, $currentY) {
    if (empty($rectangles)) return null;
    
    $stripRectangles = [];
    $remainingRectangles = [];
    $maxHeight = 0;
    
    foreach ($rectangles as $rect) {
        if ($rect->y >= $currentY && $rect->y < $currentY + 1) {
            $stripRectangles[] = $rect;
            $maxHeight = max($maxHeight, $rect->height);
        } else if ($rect->y > $currentY) {
            $remainingRectangles[] = $rect;
        }
    }
    
    if (empty($stripRectangles)) {
        $nextY = PHP_FLOAT_MAX;
        foreach ($rectangles as $rect) {
            if ($rect->y > $currentY) {
                $nextY = min($nextY, $rect->y);
            }
        }
        
        if ($nextY < PHP_FLOAT_MAX) {
            return getNextStrip($rectangles, $bin, $nextY);
        }
        return null;
    }
    
    usort($stripRectangles, function($a, $b) {
        return $a->x - $b->x;
    });
    
    return [
        'rectangles' => $stripRectangles,
        'height' => $currentY + $maxHeight,
        'stripHeight' => $maxHeight,
        'remainingRectangles' => $remainingRectangles,
        'bin' => $bin
    ];
}

function processStripWithRotation($strip) {
    // Calculate cutting length for normal orientation
    $normalLength = calculateStripCuts($strip, false);
    
    // Calculate cutting length for rotated orientation if possible
    $rotatedLength = PHP_FLOAT_MAX;
    if ($strip['stripHeight'] <= $strip['bin']->width) {
        $rotatedLength = calculateStripCuts($strip, true);
    }
    
    // Use the better orientation
    return min($normalLength, $rotatedLength);
}

function calculateStripCuts($strip, $isRotated) {
    $cuttingLength = 0;
    $currentX = 0;
    $stripHeight = $isRotated ? $strip['bin']->width : $strip['stripHeight'];
    $stripWidth = $isRotated ? $strip['stripHeight'] : $strip['bin']->width;
    
    foreach ($strip['rectangles'] as $rect) {
        // Make vertical cut if needed
        if ($rect->x > $currentX) {
            $cuttingLength += $stripHeight;  // Using stripHeight for vertical cuts (height of the cut)
        }
        
        // Make vertical cut at the end of the panel
        if ($rect->x + $rect->width < $stripWidth) {
            $cuttingLength += $stripHeight;  // Using stripHeight for vertical cuts (height of the cut)
        }
        
        // Check if horizontal cuts needed within this panel
        if ($rect->height < $stripHeight) {
            $cuttingLength += $rect->width;  // Using panel width for horizontal cuts (width of the cut)
        }
        
        $currentX = $rect->x + $rect->width;
    }
    
    return $cuttingLength;
}


/**
 * Function to calculate the number of boards needed.
 *
 * @param array $rectangles Array of Rectangle objects.
 * @param int $binWidth Width of the board.
 * @param int $binHeight Height of the board.
 * @return int Number of boards needed.
 */
function calculateBoardsNeeded($rectangles, $binWidth, $binHeight) {
    $bins = guillotineCutting($rectangles, $binWidth, $binHeight);
    return count($bins);
}
function calculateBoardUsage($rectangles, $binWidth, $binHeight, $usage_limit) {
    $bins = guillotineCutting($rectangles, $binWidth, $binHeight);
    $totalBoards = count($bins);
    $totalBinArea = $totalBoards * ($binWidth * $binHeight);

    if ($totalBinArea == 0) {
        return ['error' => 'Division by zero: No boards available!', 'total_boards' => 0, 'extra_squaremeters' => 0];
    }

    // Initialize counters
    $usedArea = 0;
    $fullBoardsUsed = 0;
    $extraSquareMeters = 0;

    // Analyze each board separately
    foreach ($bins as $bin) {
        $boardUsedArea = 0;
        
        foreach ($bin->usedRectangles as $rect) {
            $boardUsedArea += $rect->width * $rect->height;
        }

        // Calculate usage percentage for this board
        $boardUsagePercentage = ($boardUsedArea / ($binWidth * $binHeight)) * 100;

        if ($boardUsagePercentage >= $usage_limit) {
            // If board is above usage limit, count as fully used
            $fullBoardsUsed++;
        } else {
            // If board is below usage limit, add its area to square meters
            $extraSquareMeters += round($boardUsedArea / 1_000_000, 2);
        }
    }

    
    if ($fullBoardsUsed > 0) {
        return [
            'total_boards' => $fullBoardsUsed,
            'extra_squaremeters' => $extraSquareMeters
        ];
    }

    
    return [
        'total_boards' => 0,
        'extra_squaremeters' => $extraSquareMeters
    ];
}

// Add this near the other initialization variables at the top
$edge_banding_by_material = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    
    try {
        $material_types = $_POST['material_type'];
        error_log("Received material_types: " . print_r($material_types, true));
        error_log("Available admin_boards: " . print_r(array_keys($admin_boards), true));

        // Validate material exists
        foreach ($material_types as $material_id) {
            if (!isset($admin_boards[$material_id])) {
                throw new Exception("Material not found: " . $material_id);
            }
        }

        $heights = $_POST['width'];
        $widths = $_POST['height'];
        $quantities = $_POST['quantity'];
        $right_long_edge_materials = $_POST['right_short_edge_material'];
        $left_long_edge_materials = $_POST['left_short_edge_material'];
        $right_short_edge_materials = $_POST['right_long_edge_material'];
        $left_short_edge_materials = $_POST['left_long_edge_material'];
        $labels = $_POST['label'];

        $results = [];
        $grouped_panels = [];

        // Group panels by material type
        for ($i = 0; $i < count($material_types); $i++) {
            $material_type = $material_types[$i];
            $height = (int)$heights[$i]; // Ensure height is an integer
            $width = (int)$widths[$i]; // Ensure width is an integer
            $quantity = (int)$quantities[$i]; // Ensure quantity is an integer

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

            // Get bin packing solution first - we'll need this for both pricing methods
            $bins = guillotineCutting($panels, $usable_board_width, $usable_board_height);

            if ($sell_by_square_meter) {
                // Get board usage result
                $usage_result = calculateBoardUsage($panels, $usable_board_width, $usable_board_height, $usage_limit);
               
                // Extract values safely
                $used_board = $usage_result['total_boards'];
                $squaremeter_needed = $usage_result['extra_squaremeters'];

                // Accumulate total square meter usage
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

                // Add this section to track boards for square meter materials too
                if (!isset($total_boards[$material_type])) {
                    $total_boards[$material_type] = 0;
                }
                $total_boards[$material_type] += $boards_needed;
            } else {
                // Calculate the required number of boards with the adjusted size
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

            // Calculate cutting length using the new function - moved after board calculations
            $results_for_cutting = [
                [
                    'bins' => $bins
                ]
            ];
            $cutting_length = calculateTotalCuttingLength($results_for_cutting) / 1000;


            // Calculate cutting cost with the new cutting length
            $cutting_cost = $cutting_length * $cutting_fee_per_meter; // Convert mm to meters
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
                'cutting_length' => $cutting_length,  // Now this will have the correct value
                'edge_banding_length' => $edge_banding_length,
                'material_cost' => $material_cost,
                'cutting_cost' => $cutting_cost,      // And this will be based on the actual cutting length
                'edge_banding_cost' => $edge_banding_cost,
                'total_cost' => $material_cost,
                'boards_needed' => $boards_needed,
                'total_square_meters' => isset($total_square_meters[$material_type]) ? $total_square_meters[$material_type] : 0,
                'total_boards' => isset($total_boards[$material_type]) ? $total_boards[$material_type] : 0,
                'total_board_costs' => isset($total_board_costs[$material_type]) ? $total_board_costs[$material_type] : 0,
                'total_material_costs' => isset($total_material_costs[$material_type]) ? $total_material_costs[$material_type] : 0
            ];
        }

        // Initialize an array to track edge banding totals by material type
        $edge_banding_totals = [];

        // Calculate edge banding costs and lengths
        for ($i = 0; $i < count($material_types); $i++) {
            $material_type = $material_types[$i];
            $height = (int)$heights[$i];
            $width = (int)$widths[$i];
            $quantity = (int)$quantities[$i];
            
            // Initialize tracking for this material type if not exists
            if (!isset($edge_banding_totals[$material_type])) {
                $edge_banding_totals[$material_type] = [
                    'length' => 0,
                    'cost' => 0
                ];
            }
            
            // Initialize length for this panel
            $length = 0;
            $edge_banding_cost = 0;

            // Initialize array for this material if not exists
            if (!isset($edge_banding_by_material[$material_type])) {
                $edge_banding_by_material[$material_type] = [];
            }

            // Track lengths by edge type
            if ($right_long_edge_materials[$i] !== 'none') {
                $edge_length = ($height / 1000+ 0.04) * $quantity;
                $length += $edge_length;
                $edge_banding_cost += $edge_length * ($admin_edge_materials[$right_long_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                if (!isset($edge_banding_by_material[$material_type][$right_long_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$right_long_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$right_long_edge_materials[$i]] += $edge_length;
            }

            if ($left_long_edge_materials[$i] !== 'none') {
                $edge_length = ($height / 1000+ 0.04)* $quantity;
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
                $edge_length = ($width / 1000+ 0.04)* $quantity;
                $length += $edge_length;
                $edge_banding_cost += $edge_length * ($admin_edge_materials[$right_short_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                if (!isset($edge_banding_by_material[$material_type][$right_short_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$right_short_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$right_short_edge_materials[$i]] += $edge_length;
            }

            if ($left_short_edge_materials[$i] !== 'none') {
                $edge_length = ($width / 1000+ 0.04)* $quantity;
                $length += $edge_length;
                $edge_banding_cost += $edge_length * ($admin_edge_materials[$left_short_edge_materials[$i]]['price_per_meter'] + $edge_fee_per_meter);
                if (!isset($edge_banding_by_material[$material_type][$left_short_edge_materials[$i]])) {
                    $edge_banding_by_material[$material_type][$left_short_edge_materials[$i]] = 0;
                }
                $edge_banding_by_material[$material_type][$left_short_edge_materials[$i]] += $edge_length;
            }

            // Accumulate totals by material type
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

        // Log errors to a file
        $error_log_file = 'error_log.txt';
        $error_message = '';

        if (file_exists($error_log_file)) {
            $error_message = file_get_contents($error_log_file);
        }

        // Example error message
        $error_message .= "Calculation completed successfully.\n";

        //file_put_contents($error_log_file, $error_message, FILE_APPEND);

        // Write results to a JSON file
        $json_file = 'results.json';
        $json_data = json_encode([
            'results' => $results,
            'total_price' => $total_price,
            'total_cutting_length' => $total_cutting_length,
            'total_edge_banding_length' => $total_edge_banding_length,
            'total_cutting_cost' => $total_cutting_cost,
            'total_edge_banding_cost' => $total_edge_banding_cost,
            'total_square_meters' => $total_square_meters, // Add total square meters for each material sold by square meter
            'total_boards' => $total_boards, // Add total boards used for each material sold by board
            'total_board_costs' => $total_board_costs, // Add total board costs for each material sold by board
            'total_material_costs' => $total_material_costs, // Add total material costs for each material
            'edge_banding_by_material' => $edge_banding_by_material  // Add this new field
        ], JSON_PRETTY_PRINT);

        file_put_contents($json_file, $json_data);

        ob_clean(); // Clear any output buffers
        echo $json_data;
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
        exit;
    }
}
?>
