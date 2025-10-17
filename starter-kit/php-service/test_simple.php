<?php
// Simple test endpoint without database connection
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

// Return success response
echo json_encode([
    'status' => 'success',
    'message' => 'PHP optimization service is running',
    'received_data' => $data,
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'server' => 'localhost:8000'
]);
?>
