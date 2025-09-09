# ERP Turinova Server Startup & Routes Documentation

## Overview
This document provides comprehensive instructions for starting both the Next.js frontend server and the PHP optimization service, along with detailed API route documentation for the ERP Turinova project.

## Prerequisites
- Node.js (LTS version recommended)
- pnpm package manager installed
- PHP 7.4+ with built-in web server
- All dependencies installed (`pnpm install`)

## Architecture Overview

The ERP Turinova project consists of two main components:

1. **Next.js Frontend Server** (Port 3000) - React-based admin interface
2. **PHP Optimization Service** (Port 8000) - Panel optimization algorithm

## Server Startup Instructions

### 1. Start the PHP Optimization Service

**CRITICAL**: Start the PHP server first as the frontend depends on it.

```bash
cd /Volumes/T7/erp_turinova_new/starter-kit/development_documentation
php -S localhost:8000
```

**Expected Output:**
```
PHP 8.3.0 Development Server (http://localhost:8000) started
```

### 2. Start the Next.js Frontend Server

In a **new terminal window**, navigate to the correct directory:

```bash
cd /Volumes/T7/erp_turinova_new/starter-kit
```

Start the development server:

```bash
pnpm dev
```

### 3. Expected Output

**PHP Server (Terminal 1):**
```
PHP 8.3.0 Development Server (http://localhost:8000) started
```

**Next.js Server (Terminal 2):**
```
> materialize-mui-nextjs-admin-template@5.0.0 dev /Volumes/T7/erp_turinova_new/starter-kit
> next dev --turbopack

   ▲ Next.js 15.1.2 (Turbopack)
   - Local:        http://localhost:3000
   - Network:      http://192.168.3.1:3000
   - Environments: .env

 ✓ Starting...
 ✓ Ready in 938ms
```

### 4. Access the Application
- **Frontend URL**: http://localhost:3000
- **Optimization Service**: http://localhost:8000
- **Network URL**: http://192.168.3.1:3000

## API Routes Documentation

### PHP Optimization Service Routes

#### Base URL
```
http://localhost:8000
```

#### 1. Panel Optimization Endpoint

**Endpoint**: `POST /test_optimization.php`

**Purpose**: Optimize panel placement using guillotine cutting algorithm

**Request Format**:
```json
{
  "materials": [
    {
      "id": "1",
      "name": "MDF 18mm",
      "parts": [
        {
          "id": "panel-1",
          "w_mm": 1000,
          "h_mm": 1000,
          "qty": 1,
          "allow_rot_90": true,
          "grain_locked": false
        }
      ],
      "board": {
        "w_mm": 2800,
        "h_mm": 2070,
        "trim_top_mm": 10,
        "trim_right_mm": 0,
        "trim_bottom_mm": 0,
        "trim_left_mm": 10
      },
      "params": {
        "kerf_mm": 3,
        "seed": 123456,
        "order_policy": "LAF"
      }
    }
  ]
}
```

**Response Format**:
```json
[
  {
    "material_id": "1",
    "material_name": "MDF 18mm",
    "placements": [
      {
        "id": "panel-1-1",
        "x_mm": 10,
        "y_mm": 10,
        "w_mm": 1000,
        "h_mm": 1000,
        "rot_deg": 0,
        "board_id": 1
      }
    ],
    "unplaced": [],
    "metrics": {
      "used_area_mm2": 1000000,
      "board_area_mm2": 5796000,
      "waste_pct": 82.74672187715666,
      "placed_count": 1,
      "unplaced_count": 0,
      "boards_used": 1,
      "total_cut_length_mm": 7600
    },
    "board_cut_lengths": {
      "1": 7600
    },
    "debug": {
      "board_width": 2800,
      "board_height": 2070,
      "usable_width": 2790,
      "usable_height": 2060,
      "bins_count": 1,
      "panels_count": 1
    }
  }
]
```

**Parameters**:
- `materials`: Array of material objects to optimize
- `id`: Unique material identifier
- `name`: Material name (e.g., "MDF 18mm")
- `parts`: Array of panel objects
- `w_mm`: Panel width in millimeters
- `h_mm`: Panel height in millimeters
- `qty`: Quantity of panels
- `allow_rot_90`: Whether panel can be rotated 90 degrees
- `grain_locked`: Whether panel has grain direction restrictions
- `board`: Board specifications
- `w_mm`: Board width in millimeters
- `h_mm`: Board height in millimeters
- `trim_*_mm`: Trim dimensions (top, right, bottom, left)
- `params`: Optimization parameters
- `kerf_mm`: Blade width for cutting
- `seed`: Random seed for reproducible results
- `order_policy`: Panel ordering policy ("LAF", "WAF", etc.)

### Next.js Frontend Routes

#### Base URL
```
http://localhost:3000
```

#### 1. Optimization Test Page

**Route**: `GET /optitest`

**Purpose**: Interactive panel optimization interface

**Features**:
- Multi-material panel optimization
- Real-time visualization
- Board usage statistics
- Cut length calculations
- Accordion-based material organization

#### 2. Dashboard Routes

**Route**: `GET /home`
- Main dashboard overview

**Route**: `GET /about`
- About page

**Route**: `GET /login`
- Authentication page

### API Testing Examples

#### Test Single Panel Optimization
```bash
curl -X POST http://localhost:8000/test_optimization.php \
  -H "Content-Type: application/json" \
  -d '{
    "materials": [
      {
        "id": "1",
        "name": "MDF 18mm",
        "parts": [
          {
            "id": "panel-1",
            "w_mm": 1000,
            "h_mm": 1000,
            "qty": 1,
            "allow_rot_90": true,
            "grain_locked": false
          }
        ],
        "board": {
          "w_mm": 2800,
          "h_mm": 2070,
          "trim_top_mm": 10,
          "trim_right_mm": 0,
          "trim_bottom_mm": 0,
          "trim_left_mm": 10
        },
        "params": {
          "kerf_mm": 3,
          "seed": 123456,
          "order_policy": "LAF"
        }
      }
    ]
  }'
```

#### Test Multi-Panel Optimization
```bash
curl -X POST http://localhost:8000/test_optimization.php \
  -H "Content-Type: application/json" \
  -d '{
    "materials": [
      {
        "id": "1",
        "name": "MDF 18mm",
        "parts": [
          {
            "id": "panel-1",
            "w_mm": 1000,
            "h_mm": 1000,
            "qty": 4,
            "allow_rot_90": true,
            "grain_locked": false
          }
        ],
        "board": {
          "w_mm": 2800,
          "h_mm": 2070,
          "trim_top_mm": 10,
          "trim_right_mm": 0,
          "trim_bottom_mm": 0,
          "trim_left_mm": 10
        },
        "params": {
          "kerf_mm": 3,
          "seed": 123456,
          "order_policy": "LAF"
        }
      }
    ]
  }'
```

## Common Issues and Solutions

### Issue: "No package.json found" Error
**Error Message**: `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND No package.json was found`

**Solution**: You're in the wrong directory. Make sure you're in:
```bash
/Volumes/T7/erp_turinova_new/starter-kit
```

### Issue: PHP Server Won't Start
**Error Message**: `Address already in use`

**Solution**: 
1. Check if port 8000 is already in use: `lsof -i :8000`
2. Kill existing process: `kill -9 <PID>`
3. Try a different port: `php -S localhost:8001`

### Issue: Next.js Server Won't Start
**Solution**: 
1. Check if you're in the correct directory
2. Ensure dependencies are installed: `pnpm install`
3. Check if port 3000 is already in use
4. Try clearing cache: `pnpm clean`

### Issue: Optimization API Returns Error
**Error Message**: `Failed to fetch` or `Connection refused`

**Solution**:
1. Ensure PHP server is running on port 8000
2. Check PHP server logs for errors
3. Verify request format matches expected schema
4. Test with curl to isolate frontend vs backend issues

### Issue: Browser Shows "Cannot Connect"
**Solution**:
1. Wait for the "Ready" message in the terminal
2. Check that both servers are actually running
3. Try accessing http://localhost:3000 directly
4. Check browser console for CORS errors

## Running in Background

### PHP Server (Terminal 1)
```bash
cd /Volumes/T7/erp_turinova_new/starter-kit/development_documentation && php -S localhost:8000
```

### Next.js Server (Terminal 2)
```bash
cd /Volumes/T7/erp_turinova_new/starter-kit && pnpm dev
```

## Stopping the Servers
- Press `Ctrl + C` in each terminal where the servers are running
- Or close the terminal windows

## Environment Configuration
The servers use the following environment variables (configured in `.env`):
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

## Troubleshooting Commands

### Check if servers are running:
```bash
# Check Next.js server
curl -I http://localhost:3000

# Check PHP server
curl -I http://localhost:8000/test_optimization.php
```

### Check running processes:
```bash
# Check Next.js process
ps aux | grep "next dev" | grep -v grep

# Check PHP process
ps aux | grep "php -S" | grep -v grep
```

### Check port usage:
```bash
# Check port 3000
lsof -i :3000

# Check port 8000
lsof -i :8000
```

### Update browserslist (if needed):
```bash
npx update-browserslist-db@latest
```

## File Structure Reference
```
/Volumes/T7/erp_turinova_new/
├── starter-kit/                           ← NEXT.JS SERVER ROOT
│   ├── package.json                       ← Required for pnpm commands
│   ├── .env                               ← Environment configuration
│   ├── src/                               ← Source code
│   │   └── app/
│   │       └── (dashboard)/
│   │           └── optitest/              ← Optimization interface
│   │               └── page.tsx
│   └── public/                            ← Static assets
└── starter-kit/development_documentation/ ← PHP SERVER ROOT
    ├── test_optimization.php              ← Optimization API endpoint
    ├── calculate_price.php                ← Original algorithm
    └── SERVER_STARTUP.md                  ← This documentation
```

## Quick Start Commands

### Start Both Servers (Two Terminals)
**Terminal 1 (PHP Server):**
```bash
cd /Volumes/T7/erp_turinova_new/starter-kit/development_documentation && php -S localhost:8000
```

**Terminal 2 (Next.js Server):**
```bash
cd /Volumes/T7/erp_turinova_new/starter-kit && pnpm dev
```

## Development Workflow

1. **Start PHP Server First** - Required for optimization API
2. **Start Next.js Server** - Frontend interface
3. **Access Application** - Navigate to http://localhost:3000/optitest
4. **Test Optimization** - Use the interface or curl commands
5. **Monitor Logs** - Check both terminal outputs for errors

## Performance Notes

- **PHP Server**: Lightweight, handles optimization calculations
- **Next.js Server**: Full-featured React development server with hot reload
- **Memory Usage**: Both servers are optimized for development
- **Response Times**: Optimization API typically responds in <100ms for small datasets

## Security Considerations

- **Development Only**: These servers are configured for local development
- **CORS Enabled**: PHP server allows cross-origin requests from localhost:3000
- **No Authentication**: Development servers run without authentication
- **Production Deployment**: Requires proper security configuration

---
**Last Updated**: December 2024
**Project**: ERP Turinova Optimization Service
**Template Version**: Materialize Next.js Admin Template v5.0.0
