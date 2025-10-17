#!/bin/bash

# Performance Test Script for Optimized APIs
# Run this script to test the performance improvements

echo "🚀 PERFORMANCE TEST SUITE - OPTIMIZED VERSION"
echo "=============================================="
echo ""

# Function to test API endpoint
test_endpoint() {
    local endpoint=$1
    local name=$2
    local iterations=${3:-3}
    
    echo "Testing $name ($endpoint):"
    
    total_time=0
    for i in $(seq 1 $iterations); do
        time_ms=$(curl -w "%{time_total}" -s "$endpoint" -o /dev/null | awk '{print $1*1000}')
        total_time=$(echo "$total_time + $time_ms" | bc -l)
        echo "  Run $i: ${time_ms}ms"
    done
    
    avg_time=$(echo "scale=2; $total_time / $iterations" | bc -l)
    echo "  Average: ${avg_time}ms"
    echo ""
}

# Test optimized API endpoints
echo "📊 TESTING OPTIMIZED API ENDPOINTS"
echo "=================================="

test_endpoint "http://localhost:3000/api/users/ultra-optimized" "Users API (Ultra-Optimized)" 3
test_endpoint "http://localhost:3000/api/customers/ultra-optimized" "Customers API (Ultra-Optimized)" 3
test_endpoint "http://localhost:3000/api/brands/ultra-optimized" "Brands API (Ultra-Optimized)" 3
test_endpoint "http://localhost:3000/api/units/ultra-optimized" "Units API (Ultra-Optimized)" 3
test_endpoint "http://localhost:3000/api/currencies/ultra-optimized" "Currencies API (Ultra-Optimized)" 3

# Test permission APIs
echo "🔐 TESTING PERMISSION APIs"
echo "=========================="

test_endpoint "http://localhost:3000/api/permissions/check-admin/6c927640-1de8-4e6c-a124-7f9e7ccdd416/ultra-optimized" "Admin Check API (Ultra-Optimized)" 3
test_endpoint "http://localhost:3000/api/permissions/simple/user/6c927640-1de8-4e6c-a124-7f9e7ccdd416/ultra-optimized" "User Permissions API (Ultra-Optimized)" 3

# Test page load times
echo "📄 TESTING PAGE LOAD TIMES"
echo "==========================="

test_endpoint "http://localhost:3000/users" "Users Page" 3
test_endpoint "http://localhost:3000/customers" "Customers Page" 3
test_endpoint "http://localhost:3000/brands" "Brands Page" 3
test_endpoint "http://localhost:3000/units" "Units Page" 3
test_endpoint "http://localhost:3000/currencies" "Currencies Page" 3

echo "✅ PERFORMANCE TEST COMPLETE"
echo "============================="
echo ""
echo "Expected improvements:"
echo "- API calls: 3-4 seconds → 50-200ms (15-80x faster)"
echo "- Page loads: 3-4 seconds → 200-500ms (6-20x faster)"
echo "- Cached responses: Near-instant (0ms)"
echo ""
echo "If you see significant improvements, the optimization was successful!"
echo "If not, we can restore using: git reset --hard HEAD"
