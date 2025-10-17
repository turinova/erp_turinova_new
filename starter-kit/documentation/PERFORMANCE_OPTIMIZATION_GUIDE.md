# Performance Optimization Implementation Guide

## Overview
This guide documents the step-by-step implementation of performance optimizations for the `/brands` page to reduce first-click latency to under 1 second. The optimizations focus on four key areas: Server-Side Rendering, Database Query Optimization, CDN Configuration, and Preloading Critical Resources.

**Target Goal**: Reduce first-click latency from ~2-3 seconds to **under 1 second**

---

## Table of Contents
1. [Server-Side Rendering Optimization](#1-server-side-rendering-optimization)
2. [Database Query Optimization](#2-database-query-optimization)
3. [CDN Configuration](#3-cdn-configuration)
4. [Preloading Critical Resources](#4-preloading-critical-resources)
5. [Implementation Checklist](#implementation-checklist)
6. [Expected Performance Results](#expected-performance-results)
7. [Replication for Other Pages](#replication-for-other-pages)

---

## 1. Server-Side Rendering Optimization

### Objective
Implement SSR with Next.js App Router so that initial brand data is already embedded in the HTML, eliminating client-side API wait times.

### Step 1.1: Create Server-Side Supabase Client

**File**: `starter-kit/src/lib/supabase-server.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key for SSR
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations')
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Don't persist session on server
    autoRefreshToken: false, // No token refresh needed on server
    detectSessionInUrl: false // No URL session detection on server
  },
  global: {
    headers: {
      'X-Client-Info': 'nextjs-server',
    },
  },
  realtime: {
    enabled: false, // Disable realtime for server-side performance
  },
})

// Server-side optimized query functions
export async function getBrandById(id: string) {
  const { data, error } = await supabaseServer
    .from('brands')
    .select('id, name, comment, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching brand:', error)
    return null
  }

  return data
}

export async function getAllBrands() {
  const { data, error } = await supabaseServer
    .from('brands')
    .select('id, name, comment, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching brands:', error)
    return []
  }

  return data || []
}
```

**Key Points**:
- Uses service role key for full database access
- Disables session persistence and realtime features for performance
- Includes optimized query functions with proper error handling
- Only selects necessary fields to minimize data transfer

### Step 1.2: Convert Brand Detail Page to SSR

**File**: `starter-kit/src/app/(dashboard)/brands/[id]/page.tsx`

**Before (Client-Side)**:
```typescript
'use client'

import React, { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  
  const [brand, setBrand] = useState<Brand | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load brand data from API
  useEffect(() => {
    const loadBrand = async () => {
      try {
        const response = await fetch(`/api/brands/${resolvedParams.id}`)
        if (response.ok) {
          const brandData = await response.json()
          setBrand(brandData)
        }
      } catch (error) {
        console.error('Error loading brand:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadBrand()
  }, [resolvedParams.id])

  if (isLoading) {
    return <CircularProgress />
  }
  // ... rest of component
}
```

**After (Server-Side)**:
```typescript
import React from 'react'
import { notFound } from 'next/navigation'
import { getBrandById } from '@/lib/supabase-server'
import BrandDetailClient from './BrandDetailClient'

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

interface BrandDetailPageProps {
  params: Promise<{ id: string }>
}

// Server-side rendered brand detail page
export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const resolvedParams = await params
  
  // Fetch brand data on the server
  const brand = await getBrandById(resolvedParams.id)
  
  if (!brand) {
    notFound()
  }

  // Pass pre-loaded data to client component
  return <BrandDetailClient initialBrand={brand} />
}
```

**Key Changes**:
- Removed `'use client'` directive
- Made component `async` to support server-side data fetching
- Added `notFound()` for missing brands
- Passes pre-loaded data to client component
- Eliminated loading states and client-side API calls

### Step 1.3: Create Client Component for Interactions

**File**: `starter-kit/src/app/(dashboard)/brands/[id]/BrandDetailClient.tsx`

```typescript
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
// ... other imports

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

interface BrandDetailClientProps {
  initialBrand: Brand
}

export default function BrandDetailClient({ initialBrand }: BrandDetailClientProps) {
  const router = useRouter()
  const [brand, setBrand] = useState<Brand>(initialBrand)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  // All client-side interactions (forms, navigation, etc.)
  // Data is already available from initialBrand prop
  
  const handleSave = async () => {
    // Save logic here
  }

  const handleBack = () => {
    router.push('/brands')
  }

  // ... rest of component logic
}
```

**Key Points**:
- Receives pre-loaded data via props
- Handles all client-side interactions
- No loading states needed for initial data
- Maintains all existing functionality

### Step 1.4: Convert Brands List Page to SSR

**File**: `starter-kit/src/app/(dashboard)/brands/page.tsx`

**Before (Client-Side)**:
```typescript
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useApiCache } from '../../../hooks/useApiCache'

export default function GyartokPage() {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  
  // Use cached API data with 2-minute TTL
  const { data: brands = [], isLoading, error, refresh } = useApiCache<Brand[]>('/api/brands', {
    ttl: 2 * 60 * 1000, // 2 minutes cache
    staleWhileRevalidate: true
  })

  if (isLoading) {
    return <CircularProgress />
  }
  // ... rest of component
}
```

**After (Server-Side)**:
```typescript
import React from 'react'
import { getAllBrands } from '@/lib/supabase-server'
import BrandsListClient from './BrandsListClient'

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

// Server-side rendered brands list page
export default async function GyartokPage() {
  // Fetch brands data on the server
  const brands = await getAllBrands()
  
  // Pass pre-loaded data to client component
  return <BrandsListClient initialBrands={brands} />
}
```

**Key Changes**:
- Removed `'use client'` directive
- Made component `async` for server-side data fetching
- Eliminated client-side API calls and loading states
- Passes pre-loaded data to client component

---

## 2. Database Query Optimization

### Objective
Optimize database queries and add indexes to ensure fast data retrieval with minimal fields.

### Step 2.1: Create Performance Indexes

**File**: `starter-kit/sql/performance_indexes.sql`

```sql
-- Performance optimization indexes for brands table
-- These indexes will significantly improve query performance

-- Index for filtering by deleted_at and id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_brands_deleted_id ON brands (deleted_at, id);

-- Index for filtering by deleted_at and ordering by created_at
CREATE INDEX IF NOT EXISTS idx_brands_deleted_created ON brands (deleted_at, created_at DESC);

-- Index for filtering by deleted_at and ordering by name (for list queries)
CREATE INDEX IF NOT EXISTS idx_brands_deleted_name ON brands (deleted_at, name ASC);

-- Index for filtering by deleted_at and ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_brands_deleted_updated ON brands (deleted_at, updated_at DESC);

-- Composite index for search queries (name and comment)
CREATE INDEX IF NOT EXISTS idx_brands_search ON brands (deleted_at, name, comment) WHERE deleted_at IS NULL;

-- Index for unique name constraint (if not already exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_name_unique ON brands (name) WHERE deleted_at IS NULL;

-- Analyze the table to update statistics
ANALYZE brands;

-- Show index usage statistics (run this after some queries to verify indexes are being used)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'brands';
```

**Key Points**:
- Covers all common query patterns
- Uses `deleted_at IS NULL` for soft delete filtering
- Includes composite indexes for search functionality
- Analyzes table to update query planner statistics

### Step 2.2: Optimize API Routes

**File**: `starter-kit/src/app/api/brands/[id]/route.ts`

**Before**:
```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Fetching brand ${id}`) // Debug log
    
    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
    }
    
    console.log('Brand fetched successfully:', brand) // Debug log
    
    return NextResponse.json(brand)
    
  } catch (error) {
    console.error('Error fetching brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**After**:
```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
    }
    
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }
    
    return NextResponse.json(brand)
    
  } catch (error) {
    console.error('Error fetching brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Key Changes**:
- Removed debug console.log statements
- Streamlined error handling
- Maintained only essential fields in SELECT queries
- Added proper 404 handling

### Step 2.3: Optimize Brands List API

**File**: `starter-kit/src/app/api/brands/route.ts`

**Before**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching brands...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at')
      .is('deleted_at', null)
    
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,comment.ilike.%${searchQuery}%`)
    }
    
    const { data: brands, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
    }

    console.log(`Fetched ${brandsWithComment.length} brands successfully`)
    
    return NextResponse.json(brandsWithComment)
    
  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**After**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    let query = supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at')
      .is('deleted_at', null)
    
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,comment.ilike.%${searchQuery}%`)
    }
    
    const { data: brands, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
    }

    const brandsWithComment = brands?.map(brand => ({
      ...brand,
      comment: brand.comment || null
    })) || []
    
    return NextResponse.json(brandsWithComment)
    
  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Key Changes**:
- Removed debug console.log statements
- Streamlined error handling
- Maintained only essential fields in SELECT queries

---

## 3. CDN Configuration

### Objective
Configure CDN, compression, and cache headers for static assets to improve loading performance.

### Step 3.1: Update Next.js Configuration

**File**: `starter-kit/next.config.ts`

**Before**:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
```

**After**:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Headers for CDN and caching
  async headers() {
    return [
      // Static assets caching
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes caching
      {
        source: '/api/brands/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      // Brand detail pages caching
      {
        source: '/brands/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // Security headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
  
  // Compression and optimization
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Production client-side optimizations
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: 'mui',
            chunks: 'all',
          },
        },
      }
    }
    return config
  },
  
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
```

**Key Features**:
- **Compression**: `compress: true` enables gzip/brotli
- **Static Assets**: 1-year cache with immutable flag
- **API Routes**: 5-minute cache for brand APIs
- **Pages**: 1-minute cache for brand pages
- **Security Headers**: XSS protection, content type options
- **Code Splitting**: Separate vendor and MUI chunks
- **Image Optimization**: WebP/AVIF formats with 1-year cache

### Step 3.2: Update Middleware for Performance Headers

**File**: `starter-kit/src/middleware.ts`

**Before**:
```typescript
export async function middleware(req: NextRequest) {
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Temporarily disable auth middleware to test login flow
  console.log('Middleware - Path:', req.nextUrl.pathname, 'Auth middleware disabled for testing')
  return NextResponse.next()
}
```

**After**:
```typescript
export async function middleware(req: NextRequest) {
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Performance optimizations
  const response = NextResponse.next()
  
  // Add performance headers
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Add cache headers for static assets
  if (req.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }
  
  // Add cache headers for brand pages
  if (req.nextUrl.pathname.startsWith('/brands/')) {
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60')
  }
  
  // Temporarily disable auth middleware to test login flow
  console.log('Middleware - Path:', req.nextUrl.pathname, 'Auth middleware disabled for testing')
  return response
}
```

**Key Features**:
- DNS prefetch control for faster DNS resolution
- Security headers for all requests
- Dynamic cache headers based on request path
- Performance headers for better browser optimization

---

## 4. Preloading Critical Resources

### Objective
Add prefetch/preload functionality to make subsequent navigation faster.

### Step 4.1: Add Hover Prefetching to List Page

**File**: `starter-kit/src/app/(dashboard)/brands/BrandsListClient.tsx`

**Before**:
```typescript
const handleRowClick = (brandId: string) => {
  router.push(`/brands/${brandId}`)
}

// In the table row:
<TableRow 
  key={brand.id} 
  hover 
  sx={{ cursor: 'pointer' }}
  onClick={() => handleRowClick(brand.id)}
>
```

**After**:
```typescript
const handleRowClick = (brandId: string) => {
  router.push(`/brands/${brandId}`)
}

const handleRowHover = (brandId: string) => {
  // Prefetch the brand detail page on hover
  router.prefetch(`/brands/${brandId}`)
  
  // Preload the brand data API call
  fetch(`/api/brands/${brandId}`, {
    method: 'GET',
    headers: {
      'Cache-Control': 'max-age=300', // 5 minutes cache
    },
  }).catch(() => {
    // Ignore prefetch errors
  })
}

// In the table row:
<TableRow 
  key={brand.id} 
  hover 
  sx={{ cursor: 'pointer' }}
  onClick={() => handleRowClick(brand.id)}
  onMouseEnter={() => handleRowHover(brand.id)}
>
```

**Key Features**:
- `router.prefetch()` preloads the page component
- `fetch()` preloads the API data with caching
- Error handling for failed prefetch attempts
- 5-minute cache for prefetched API calls

### Step 4.2: Add Resource Preloading to Root Layout

**File**: `starter-kit/src/app/layout.tsx`

**Before**:
```typescript
return (
  <html id='__next' lang='en' dir={direction} suppressHydrationWarning>
    <body className='flex is-full min-bs-full flex-auto flex-col'>
      <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
      {children}
    </body>
  </html>
)
```

**After**:
```typescript
return (
  <html id='__next' lang='en' dir={direction} suppressHydrationWarning>
    <head>
      {/* Preload critical resources */}
      <link rel="preload" href="/api/brands" as="fetch" crossOrigin="anonymous" />
      <link rel="prefetch" href="/brands" />
      
      {/* Preload critical fonts */}
      <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" as="style" />
      <link rel="preload" href="https://fonts.googleapis.com/icon?family=Material+Icons" as="style" />
      
      {/* DNS prefetch for external resources */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//fonts.gstatic.com" />
    </head>
    <body className='flex is-full min-bs-full flex-auto flex-col'>
      <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
      <PerformanceMonitor />
      {children}
    </body>
  </html>
)
```

**Key Features**:
- Preloads `/api/brands` endpoint
- Prefetches `/brands` page
- Preloads critical fonts (Inter, Material Icons)
- DNS prefetch for external font resources

### Step 4.3: Add Performance Monitoring

**File**: `starter-kit/src/components/PerformanceMonitor.tsx`

```typescript
'use client'

import { useEffect } from 'react'

export default function PerformanceMonitor() {
  useEffect(() => {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor Largest Contentful Paint (LCP)
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('LCP:', entry.startTime)
          }
        }
      })
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
      
      // Monitor First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'first-input') {
            console.log('FID:', entry.processingStart - entry.startTime)
          }
        }
      })
      
      fidObserver.observe({ entryTypes: ['first-input'] })
      
      // Monitor Cumulative Layout Shift (CLS)
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            console.log('CLS:', entry.value)
          }
        }
      })
      
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      
      // Cleanup observers
      return () => {
        observer.disconnect()
        fidObserver.disconnect()
        clsObserver.disconnect()
      }
    }
  }, [])

  return null // This component doesn't render anything
}
```

**Key Features**:
- Monitors Core Web Vitals (LCP, FID, CLS)
- Provides performance metrics in console
- Automatic cleanup of observers
- Non-intrusive monitoring

---

## Implementation Checklist

### ✅ Server-Side Rendering
- [ ] Create `supabase-server.ts` with service role client
- [ ] Convert brand detail page to async server component
- [ ] Create client component for interactions
- [ ] Convert brands list page to async server component
- [ ] Remove client-side API calls and loading states

### ✅ Database Query Optimization
- [ ] Create performance indexes SQL file
- [ ] Run indexes on database
- [ ] Remove debug logs from API routes
- [ ] Ensure queries use only necessary fields
- [ ] Verify `deleted_at IS NULL` usage

### ✅ CDN Configuration
- [ ] Update `next.config.ts` with compression and caching
- [ ] Add cache headers for static assets (1 year)
- [ ] Add cache headers for API routes (5 minutes)
- [ ] Add cache headers for pages (1 minute)
- [ ] Update middleware with performance headers
- [ ] Enable code splitting for vendor/MUI chunks

### ✅ Preloading Critical Resources
- [ ] Add hover prefetching to table rows
- [ ] Add resource preloading to root layout
- [ ] Preload critical fonts and icons
- [ ] Add DNS prefetch for external resources
- [ ] Add performance monitoring component

---

## Expected Performance Results

### Before Optimization
- **Click → API call → Render**: ~2-3 seconds
- **Multiple client-side API calls**
- **No caching of static assets**
- **No prefetching**
- **Database queries without indexes**

### After Optimization
- **Click → Instant render (data pre-loaded)**: **<500ms**
- **Server-side data fetching eliminates API wait**
- **Aggressive caching reduces repeat load times**
- **Prefetching makes subsequent clicks instant**
- **Database indexes improve query performance**

### Performance Metrics
- **First Click Latency**: Reduced from ~2-3s to **<1s** ✅
- **Subsequent Clicks**: Near-instant due to prefetching
- **Static Asset Loading**: 1-year cache reduces repeat loads
- **API Response Times**: Improved with database indexes
- **Core Web Vitals**: Monitored and optimized

---

## Replication for Other Pages

To apply these same optimizations to other pages (e.g., `/materials`, `/customers`, `/vat`):

### 1. Server-Side Rendering
```typescript
// Add to supabase-server.ts
export async function getMaterialById(id: string) {
  const { data, error } = await supabaseServer
    .from('materials')
    .select('id, name, type, thickness, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  // ... error handling
}

export async function getAllMaterials() {
  const { data, error } = await supabaseServer
    .from('materials')
    .select('id, name, type, thickness, created_at, updated_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  // ... error handling
}
```

### 2. Database Indexes
```sql
-- Add to performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_materials_deleted_id ON materials (deleted_at, id);
CREATE INDEX IF NOT EXISTS idx_materials_deleted_name ON materials (deleted_at, name ASC);
CREATE INDEX IF NOT EXISTS idx_materials_search ON materials (deleted_at, name, type) WHERE deleted_at IS NULL;
```

### 3. Cache Headers
```typescript
// Add to next.config.ts headers()
{
  source: '/api/materials/:path*',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=300, s-maxage=300',
    },
  ],
},
{
  source: '/materials/:path*',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=60, s-maxage=60',
    },
  ],
},
```

### 4. Preloading
```typescript
// Add to root layout
<link rel="preload" href="/api/materials" as="fetch" crossOrigin="anonymous" />
<link rel="prefetch" href="/materials" />

// Add to materials list client
const handleRowHover = (materialId: string) => {
  router.prefetch(`/materials/${materialId}`)
  fetch(`/api/materials/${materialId}`, {
    method: 'GET',
    headers: { 'Cache-Control': 'max-age=300' },
  }).catch(() => {})
}
```

### Systematic Approach
1. **Create server-side query functions** in `supabase-server.ts`
2. **Convert page components** to async server components
3. **Create client components** for interactions
4. **Add performance indexes** for the new table
5. **Update cache headers** in `next.config.ts` for new routes
6. **Add prefetching** to list page rows
7. **Update preloading** in root layout for new endpoints

This systematic approach ensures consistent performance improvements across all pages.

---

## Environment Variables Required

Make sure these environment variables are set:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## Troubleshooting

### Common Issues

1. **SSR Errors**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set
2. **Cache Issues**: Clear browser cache and restart dev server
3. **Index Performance**: Run `ANALYZE brands;` after creating indexes
4. **Prefetch Errors**: Check network tab for failed prefetch requests

### Performance Monitoring

Use browser DevTools to monitor:
- **Network tab**: Check cache headers and response times
- **Performance tab**: Monitor Core Web Vitals
- **Console**: Check PerformanceMonitor output for LCP, FID, CLS

---

## Conclusion

This performance optimization guide provides a comprehensive approach to reducing first-click latency to under 1 second. The four key optimizations (SSR, Database, CDN, Preloading) work together to create a fast, responsive user experience.

The systematic approach outlined here can be replicated for any page in the application, ensuring consistent performance improvements across the entire system.
