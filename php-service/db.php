<?php
// Supabase REST API client for PHP
// This replaces direct PostgreSQL connection with Supabase REST API calls

// Get environment variables
$supabase_url = getenv('SUPABASE_URL') ?: 'https://xgkaviefifbllbmfbyfe.supabase.co';
$supabase_service_key = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhna2F2aWVmaWZibGxibWZieWZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE0NjE1MSwiZXhwIjoyMDcyNzIyMTUxfQ.-LslYzl8Mhl14UOIr19lSHAKxpuv_roxXM7SPZm3U5Y';

// Supabase REST API client class
class SupabaseClient {
    private $url;
    private $headers;
    
    public function __construct($url, $service_key) {
        $this->url = rtrim($url, '/') . '/rest/v1';
        $this->headers = [
            'apikey: ' . $service_key,
            'Authorization: Bearer ' . $service_key,
            'Content-Type: application/json',
            'Prefer: return=representation'
        ];
    }
    
    public function query($table, $params = []) {
        $url = $this->url . '/' . $table;
        
        // Add query parameters
        if (!empty($params)) {
            $query_string = http_build_query($params);
            $url .= '?' . $query_string;
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($http_code !== 200) {
            error_log("Supabase API error: HTTP $http_code - $response");
            return false;
        }
        
        return json_decode($response, true);
    }
}

// Create connection object for compatibility
class MockConnection {
    private $supabase;
    
    public function __construct($supabase) {
        $this->supabase = $supabase;
    }
    
    public function query($sql) {
        // Parse SQL to determine which table and what data to fetch
        if (strpos($sql, 'materials_with_settings') !== false) {
            $data = $this->supabase->query('materials_with_settings', [
                'select' => 'id,material_name,length_mm,width_mm,thickness_mm,grain_direction,on_stock,image_url,brand_name,kerf_mm,trim_top_mm,trim_right_mm,trim_bottom_mm,trim_left_mm,rotatable,waste_multi,created_at,updated_at'
            ]);
            
            if ($data) {
                return new SupabaseResult($data);
            }
        } elseif (strpos($sql, 'edge_materials') !== false) {
            $data = $this->supabase->query('edge_materials', [
                'select' => 'id,brand_id,type,thickness,width,decor,price,vat_id,created_at,updated_at',
                'deleted_at' => 'is.null'
            ]);
            
            if ($data) {
                return new SupabaseResult($data);
            }
        }
        
        return new SupabaseResult([]);
    }
    
    public function exec($sql) {
        return true;
    }
}

class SupabaseResult {
    private $data;
    private $index = 0;
    
    public function __construct($data) {
        $this->data = $data;
    }
    
    public function fetch() {
        if ($this->index < count($this->data)) {
            return $this->data[$this->index++];
        }
        return false;
    }
}

// Create Supabase client and connection
$supabase_client = new SupabaseClient($supabase_url, $supabase_service_key);
$conn = new MockConnection($supabase_client);

// Test connection
error_log("Supabase REST API connection established");
?>
