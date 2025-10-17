<?php
// Optimization Classes and Functions for Material Cutting
// This file contains the core optimization algorithms

define('KERF', 3); // Default cutting width in mm

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
    
    foreach ($results as $result) {
        foreach ($result['bins'] as $bin) {
            $totalCuttingLength += processBin($bin);
        }
    }
    
    return $totalCuttingLength;
}

function processBin($bin) {
    $cuttingLength = 0;
    $currentY = 0;
    $remainingRectangles = $bin->usedRectangles;
    
    // Add initial full cuts (one horizontal, one vertical)
    $cuttingLength += $bin->width;  // Full horizontal cut
    $cuttingLength += $bin->height; // Full vertical cut
    
    while (count($remainingRectangles) > 0) {
        $strip = getNextStrip($remainingRectangles, $bin, $currentY);
        if (!$strip) break;
        
        // Initial horizontal cut for each strip
        $cuttingLength += $bin->width;  // Using width for horizontal cuts
        
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
            $cuttingLength += $stripHeight;  // Using stripHeight for vertical cuts
        }
        
        // Make vertical cut at the end of the panel
        if ($rect->x + $rect->width < $stripWidth) {
            $cuttingLength += $stripHeight;  // Using stripHeight for vertical cuts
        }
        
        // Check if horizontal cuts needed within this panel
        if ($rect->height < $stripHeight) {
            $cuttingLength += $rect->width;  // Using panel width for horizontal cuts
        }
        
        $currentX = $rect->x + $rect->width;
    }
    
    return $cuttingLength;
}

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
?>
