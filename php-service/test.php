<?php
// Test endpoint for PHP service
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Test database connection
try {
    require './db.php';
    
    // Test query
    $stmt = $conn->query("SELECT 1 as test");
    $result = $stmt->fetch();
    
    echo json_encode([
        'status' => 'success',
        'message' => 'PHP service is running',
        'database' => 'connected',
        'test_query' => $result,
        'timestamp' => date('Y-m-d H:i:s'),
        'php_version' => PHP_VERSION,
        'environment' => [
            'SUPABASE_URL' => getenv('SUPABASE_URL') ? 'set' : 'not set',
            'SUPABASE_PASSWORD' => getenv('SUPABASE_PASSWORD') ? 'set' : 'not set',
            'PORT' => getenv('PORT') ?: 'not set'
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed',
        'error' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s'),
        'php_version' => PHP_VERSION
    ]);
}
?>
