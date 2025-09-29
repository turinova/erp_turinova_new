<?php
// Database connection for Supabase PostgreSQL
// This replaces the old MySQL connection with Supabase PostgreSQL

// Get environment variables
$supabase_url = getenv('SUPABASE_URL');
$supabase_password = getenv('SUPABASE_PASSWORD');
$supabase_db = getenv('SUPABASE_DB') ?: 'postgres';
$supabase_user = getenv('SUPABASE_USER') ?: 'postgres';
$supabase_host = getenv('SUPABASE_HOST') ?: 'db.xgkaviefifbllbmfbyfe.supabase.co';
$supabase_port = getenv('SUPABASE_PORT') ?: '5432';

// Parse Supabase URL if provided
if ($supabase_url) {
    $parsed_url = parse_url($supabase_url);
    if ($parsed_url) {
        $supabase_host = $parsed_url['host'];
        $supabase_port = $parsed_url['port'] ?? '5432';
        $supabase_db = trim($parsed_url['path'], '/') ?: 'postgres';
    }
}

// Build connection string
$dsn = "pgsql:host={$supabase_host};port={$supabase_port};dbname={$supabase_db}";

try {
    // Create PDO connection
    $conn = new PDO($dsn, $supabase_user, $supabase_password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    
    // Set timezone
    $conn->exec("SET timezone = 'UTC'");
    
} catch (PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    
    // Fallback: try with default Supabase connection
    try {
        $fallback_dsn = "pgsql:host=db.xgkaviefifbllbmfbyfe.supabase.co;port=5432;dbname=postgres";
        $fallback_user = "postgres";
        $fallback_password = getenv('SUPABASE_DB_PASSWORD') ?: 'your-supabase-password';
        
        $conn = new PDO($fallback_dsn, $fallback_user, $fallback_password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        
        $conn->exec("SET timezone = 'UTC'");
        
    } catch (PDOException $e2) {
        error_log("Fallback database connection also failed: " . $e2->getMessage());
        die(json_encode(['error' => 'Database connection failed. Please check your Supabase credentials.']));
    }
}

// Test connection
try {
    $stmt = $conn->query("SELECT 1");
    error_log("Database connection successful");
} catch (PDOException $e) {
    error_log("Database test query failed: " . $e->getMessage());
}
?>
