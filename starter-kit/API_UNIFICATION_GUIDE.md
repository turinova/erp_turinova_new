# API Unification Guide: Step-by-Step Implementation

## Overview
This guide provides a detailed step-by-step process for unifying API endpoints, removing unnecessary services, and implementing consistent data flow patterns across your application. Based on the successful brands page implementation.

## Prerequisites
- Next.js 15+ application
- Supabase database
- Existing API routes and pages
- Understanding of RESTful API principles

---

## Step 1: Analyze Current API Structure

### 1.1 Identify Existing Endpoints
Before starting, document all current API endpoints for the target page:

```bash
# Example for brands (before unification)
GET /api/brands/optimized          # List all brands
POST /api/brands/optimized         # Create brand (unused)
GET /api/brands/[id]               # Get single brand
PUT /api/brands/[id]               # Update brand
DELETE /api/brands/[id]            # Delete brand
POST /api/brands                   # Create brand (used)
```

### 1.2 Document Current Data Flow
Create a flow diagram showing:
- Frontend components
- API endpoints
- Database queries
- Cache invalidation points
- Error handling

### 1.3 Identify Redundancies
Look for:
- Duplicate endpoints (`/api/brands` vs `/api/brands/optimized`)
- Unused API routes
- Inconsistent data structures
- Missing cache invalidation

---

## Step 2: Design Unified API Structure

### 2.1 Define Standard Endpoints
Create a consistent pattern for all CRUD operations:

```
GET    /api/{resource}           # List all (with optional ?q=search)
POST   /api/{resource}           # Create new
GET    /api/{resource}/[id]      # Get single
PATCH  /api/{resource}/[id]       # Update (use PATCH, not PUT)
DELETE /api/{resource}/[id]      # Delete
```

### 2.2 Define Consistent Response Format
Standardize all responses:

```typescript
// List Response (GET /api/{resource})
interface ListResponse<T> {
  data: T[]
  // Optional: pagination, total count, etc.
}

// Single Item Response (GET /api/{resource}/[id])
interface ItemResponse<T> {
  data: T
}

// Success Response (POST/PATCH/DELETE)
interface SuccessResponse<T> {
  success: true
  message: string
  data: T  // ⚠️ CRITICAL: Always use 'data' field, never resource-specific names
}

// Error Response
interface ErrorResponse {
  success: false
  error: string
  message?: string
}
```

**⚠️ CRITICAL RESPONSE FORMAT RULES:**
1. **Always use `data` field** for the actual resource data
2. **Never use resource-specific field names** like `vat`, `brand`, `currency`
3. **Consistent across all endpoints** - POST, PATCH, DELETE all return `{ success, message, data }`
4. **Frontend must access `result.data`** - never `result.vat` or `result.brand`

**Example of CORRECT response format:**
```typescript
// ✅ CORRECT - Unified format
{
  "success": true,
  "message": "VAT rate created successfully",
  "data": {
    "id": "uuid",
    "name": "string",
    "kulcs": 25,
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}

// ❌ WRONG - Resource-specific format
{
  "success": true,
  "message": "VAT rate created successfully",
  "vat": {  // Don't use resource-specific names
    "id": "uuid",
    "name": "string",
    "kulcs": 25
  }
}
```

### 2.3 Define Consistent Data Structure
Ensure all endpoints return the same fields:

```typescript
interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

// Example for brands
interface Brand extends BaseEntity {
  name: string
  comment: string | null
}
```

---

## Step 3: Implement Unified API Routes

### 3.1 Create Main Resource Route (`/api/{resource}/route.ts`)

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - List all resources with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching resources...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabase
      .from('table_name')
      .select('id, field1, field2, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`field1.ilike.%${searchQuery}%,field2.ilike.%${searchQuery}%`)
    }
    
    const { data: resources, error } = await query.order('field1', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 })
    }

    console.log(`Fetched ${resources?.length || 0} resources successfully`)
    return NextResponse.json(resources || [])
    
  } catch (error) {
    console.error('Error fetching resources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new resource
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new resource...')
    
    const resourceData = await request.json()
    
    // Validate required fields
    if (!resourceData.requiredField) {
      return NextResponse.json({ error: 'Required field is missing' }, { status: 400 })
    }
    
    // Prepare resource data with timestamp
    const newResource = {
      field1: resourceData.field1 || '',
      field2: resourceData.field2 || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Insert resource into Supabase database
    const { data: resource, error } = await supabase
      .from('table_name')
      .insert([newResource])
      .select('id, field1, field2, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle specific errors
      if (error.code === '23505' && error.message.includes('unique_constraint')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Resource already exists',
            error: 'Duplicate entry' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
    }
    
    console.log('Resource created successfully:', resource)
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Resource created successfully',
        data: resource
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('Error creating resource:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 3.2 Create Individual Resource Route (`/api/{resource}/[id]/route.ts`)

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Get single resource
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching resource ${id}`)
    
    const { data: resource, error } = await supabase
      .from('table_name')
      .select('id, field1, field2, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch resource' }, { status: 500 })
    }
    
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }
    
    console.log('Resource fetched successfully:', resource)
    return NextResponse.json(resource)
    
  } catch (error) {
    console.error('Error fetching resource:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update resource
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const resourceData = await request.json()
    
    console.log(`Updating resource ${id}:`, resourceData)
    
    const { data: resource, error } = await supabase
      .from('table_name')
      .update({
        field1: resourceData.field1,
        field2: resourceData.field2,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, field1, field2, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle specific errors
      if (error.code === '23505' && error.message.includes('unique_constraint')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Resource already exists',
            error: 'Duplicate entry' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 })
    }
    
    console.log('Resource updated successfully:', resource)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Resource updated successfully',
      data: resource 
    })
    
  } catch (error) {
    console.error('Error updating resource:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete resource
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting resource ${id}`)
    
    // Try soft delete first
    let { error } = await supabase
      .from('table_name')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')

      const result = await supabase
        .from('table_name')
        .delete()
        .eq('id', id)
      
      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 })
    }

    console.log(`Resource ${id} deleted successfully`)
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error deleting resource:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Step 4: Update Frontend Components

### 4.1 Update List Page (`/app/(dashboard)/{resource}/page.tsx`)

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useApiCache } from '@/hooks/useApiCache'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Resource {
  id: string
  field1: string
  field2: string | null
  created_at: string
  updated_at: string
}

export default function ResourcesPage() {
  const [selectedResources, setSelectedResources] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use unified API endpoint
  const { data: resources = [], isLoading, error, refresh } = useApiCache<Resource[]>('/api/resources', {
    ttl: 2 * 60 * 1000, // 2 minutes cache
    staleWhileRevalidate: true
  })

  // Client-side filtering (fallback if server-side search not implemented)
  const filteredResources = useMemo(() => {
    if (!resources || !Array.isArray(resources)) return []
    if (!searchTerm) return resources
    
    const term = searchTerm.toLowerCase()
    return resources.filter(resource => 
      resource.field1.toLowerCase().includes(term) ||
      (resource.field2 && resource.field2.toLowerCase().includes(term))
    )
  }, [resources, searchTerm])

  // Delete selected resources
  const handleDeleteSelected = async () => {
    if (selectedResources.length === 0) return

    setIsDeleting(true)
    try {
      const deletePromises = selectedResources.map(id =>
        fetch(`/api/resources/${id}`, { method: 'DELETE' })
      )
      
      await Promise.all(deletePromises)
      
      // Invalidate cache and refresh data
      invalidateApiCache('/api/resources')
      await refresh()
      setSelectedResources([])
      setDeleteModalOpen(false)
      
    } catch (error) {
      console.error('Error deleting resources:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      {/* Search input */}
      <input
        type="text"
        placeholder="Search resources..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Resource list */}
      {filteredResources.map(resource => (
        <div key={resource.id}>
          {/* Resource content */}
        </div>
      ))}

      {/* Delete modal */}
      {deleteModalOpen && (
        <div>
          <p>Are you sure you want to delete {selectedResources.length} resources?</p>
          <button onClick={handleDeleteSelected} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button onClick={() => setDeleteModalOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}
```

### 4.2 Update Create Page (`/app/(dashboard)/{resource}/new/page.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { invalidateApiCache } from '@/hooks/useApiCache'

export default function NewResourcePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    field1: '',
    field2: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const result = await response.json()
        
        // Invalidate cache to refresh list
        invalidateApiCache('/api/resources')
        
        // Redirect to list or detail page
        router.push('/resources')
      } else {
        const error = await response.json()
        console.error('Error creating resource:', error)
      }
    } catch (error) {
      console.error('Error creating resource:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <input
        type="text"
        value={formData.field1}
        onChange={(e) => setFormData({ ...formData, field1: e.target.value })}
        required
      />
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Resource'}
      </button>
    </form>
  )
}
```

### 4.3 Update Edit Page (`/app/(dashboard)/{resource}/[id]/page.tsx`)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Resource {
  id: string
  field1: string
  field2: string | null
  created_at: string
  updated_at: string
}

export default function EditResourcePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [resource, setResource] = useState<Resource | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchResource = async () => {
      try {
        const response = await fetch(`/api/resources/${params.id}`)
        if (response.ok) {
          const data = await response.json()
          setResource(data)
        } else {
          console.error('Failed to fetch resource')
        }
      } catch (error) {
        console.error('Error fetching resource:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResource()
  }, [params.id])

  const handleSave = async () => {
    if (!resource) return

    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/resources/${resource.id}`, {
        method: 'PATCH', // Use PATCH instead of PUT
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resource),
      })
      
      if (response.ok) {
        const result = await response.json()
        
        // Invalidate cache to refresh list
        invalidateApiCache('/api/resources')
        
        // Redirect to list or detail page
        router.push('/resources')
      } else {
        const error = await response.json()
        console.error('Error updating resource:', error)
      }
    } catch (error) {
      console.error('Error updating resource:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (!resource) return <div>Resource not found</div>

  return (
    <div>
      {/* Edit form */}
      <input
        type="text"
        value={resource.field1}
        onChange={(e) => setResource({ ...resource, field1: e.target.value })}
      />
      
      <button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
```

---

## Step 5: Remove Unnecessary Services

### 5.1 Identify Services to Remove
Look for:
- Duplicate API routes (`/optimized` endpoints)
- Removed Redis caching layers (using only Supabase API)
- Redundant database queries
- Unnecessary middleware

### 5.2 Delete Unused Files
```bash
# Example deletions
rm /api/resources/optimized/route.ts
rm /api/resources/cache/route.ts
rm /middleware/resource-cache.ts
```

### 5.3 Update Imports
Remove imports of deleted services:
```typescript
// Remove these imports
// Redis caching removed - using only Supabase API
// import { optimizedQuery } from '@/lib/optimized'
```

---

## Step 6: Implement Server-Side Search

### 6.1 Add Search Parameters
In the main route GET handler:

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const searchQuery = searchParams.get('q')
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '50'
  
  // Build query with search
  let query = supabase
    .from('table_name')
    .select('id, field1, field2, created_at, updated_at')
    .is('deleted_at', null)
  
  if (searchQuery) {
    // Search in multiple fields
    query = query.or(`field1.ilike.%${searchQuery}%,field2.ilike.%${searchQuery}%`)
  }
  
  // Add pagination
  const offset = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(offset, offset + parseInt(limit) - 1)
  
  const { data, error } = await query.order('field1', { ascending: true })
  
  // Return with pagination info
  return NextResponse.json({
    data: data || [],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: data?.length || 0
    }
  })
}
```

### 6.2 Update Frontend to Use Server-Side Search
```typescript
const [searchTerm, setSearchTerm] = useState('')
const [debouncedSearch, setDebouncedSearch] = useState('')

// Debounce search input
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm)
  }, 300)
  
  return () => clearTimeout(timer)
}, [searchTerm])

// Use search parameter in API call
const { data: resources = [], isLoading, error, refresh } = useApiCache<Resource[]>(
  `/api/resources${debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''}`,
  {
    ttl: 2 * 60 * 1000,
    staleWhileRevalidate: true
  }
)
```

---

## Step 7: Testing and Validation

### 7.1 Test All CRUD Operations
```bash
# Test GET (list)
curl -X GET "http://localhost:3000/api/resources"

# Test GET (search)
curl -X GET "http://localhost:3000/api/resources?q=searchterm"

# Test POST (create)
curl -X POST "http://localhost:3000/api/resources" \
  -H "Content-Type: application/json" \
  -d '{"field1": "value1", "field2": "value2"}'

# Test GET (single)
curl -X GET "http://localhost:3000/api/resources/{id}"

# Test PATCH (update)
curl -X PATCH "http://localhost:3000/api/resources/{id}" \
  -H "Content-Type: application/json" \
  -d '{"field1": "updated_value"}'

# Test DELETE
curl -X DELETE "http://localhost:3000/api/resources/{id}"
```

### 7.2 Test Frontend Functionality
- [ ] List page loads correctly
- [ ] Search functionality works
- [ ] Create new resource works
- [ ] Edit existing resource works
- [ ] Delete resource works
- [ ] Cache invalidation works
- [ ] Error handling works

### 7.3 ⚠️ CRITICAL PRE-DEPLOYMENT CHECKLIST
**Before deploying any unified API changes, verify:**

- [ ] **Response Format Consistency**: All POST/PATCH responses use `{ success, message, data }` format
- [ ] **Frontend Access Pattern**: All frontend code accesses `result.data.id` (not `result.vat.id`)
- [ ] **HTTP Method Consistency**: All updates use `PATCH` (not `PUT`)
- [ ] **Search Query Syntax**: Numeric fields use `.eq.` operator, text fields use `.ilike.`
- [ ] **Cache Invalidation**: `invalidateApiCache()` called after all mutations
- [ ] **Error Handling**: Consistent error response format across all endpoints
- [ ] **TypeScript Types**: Frontend interfaces match API response structure
- [ ] **Console Errors**: No "Cannot read properties of undefined" errors
- [ ] **Navigation**: Create/edit pages redirect correctly after operations
- [ ] **Data Persistence**: Changes are saved and reflected in list views

**Common Mistakes to Avoid:**
- ❌ Using `result.vat.id` instead of `result.data.id`
- ❌ Using `PUT` instead of `PATCH` for updates
- ❌ Using `.ilike.` on numeric fields
- ❌ Forgetting to call `invalidateApiCache()`
- ❌ Inconsistent response field names (`vat` vs `data`)

### 7.4 Performance Testing
- [ ] API response times are acceptable
- [ ] Database queries are optimized
- [ ] Cache is working properly
- [ ] No memory leaks

---

## Step 8: Documentation and Cleanup

### 8.1 Update API Documentation
Document the new unified endpoints:
```markdown
## Resources API

### GET /api/resources
List all resources with optional search and pagination.

**Query Parameters:**
- `q` (optional): Search term
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "field1": "string",
      "field2": "string|null",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100
  }
}
```

### POST /api/resources
Create a new resource.

**Request Body:**
```json
{
  "field1": "string",
  "field2": "string|null"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Resource created successfully",
  "data": {
    "id": "uuid",
    "field1": "string",
    "field2": "string|null",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

### GET /api/resources/[id]
Get a single resource by ID.

**Response:**
```json
{
  "id": "uuid",
  "field1": "string",
  "field2": "string|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### PATCH /api/resources/[id]
Update a resource.

**Request Body:**
```json
{
  "field1": "string",
  "field2": "string|null"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Resource updated successfully",
  "data": {
    "id": "uuid",
    "field1": "string",
    "field2": "string|null",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

### DELETE /api/resources/[id]
Delete a resource (soft delete).

**Response:**
```json
{
  "success": true
}
```

### 8.2 Clean Up Old Code
- Remove commented-out code
- Remove unused imports
- Remove unused variables
- Update comments and documentation

### 8.3 Update Environment Variables
Remove any environment variables related to deleted services:
```bash
# Remove from .env.local
# Redis removed - using only Supabase API
# OPTIMIZED_CACHE_TTL=...
```

---

## Step 9: Apply to Other Pages

### 9.1 Identify Next Pages to Unify
Priority order:
1. Simple CRUD pages (currencies, units, etc.)
2. Complex pages with relationships
3. Pages with file uploads
4. Pages with complex business logic

### 9.2 Follow the Same Pattern
For each page:
1. Analyze current structure
2. Design unified API
3. Implement routes
4. Update frontend
5. Remove old services
6. Test thoroughly
7. Document changes

### 9.3 Common Patterns to Apply
- Always use PATCH for updates
- Always filter `deleted_at IS NULL`
- Always return consistent data structure
- Always implement cache invalidation
- Always handle errors consistently
- Always use server-side search when possible

---

## Benefits of This Approach

### Performance Benefits
- **Reduced API calls**: Single endpoint for listing
- **Server-side search**: Faster filtering
- **Consistent caching**: Better cache hit rates
- **Optimized queries**: Fewer database calls

### Development Benefits
- **Consistent patterns**: Easier to maintain
- **Type safety**: Better TypeScript support
- **Error handling**: Centralized error management
- **Testing**: Easier to test unified APIs

### User Experience Benefits
- **Faster loading**: Better performance
- **Consistent behavior**: Predictable interactions
- **Better search**: Server-side filtering
- **Real-time updates**: Proper cache invalidation

---

## Troubleshooting Common Issues

### Issue 1: Cache Not Invalidating
**Problem**: Changes don't appear immediately
**Solution**: Ensure `invalidateApiCache()` is called after all mutations

### Issue 2: Search Not Working
**Problem**: Server-side search returns no results
**Solution**: Check Supabase query syntax and field names

### Issue 3: TypeScript Errors
**Problem**: Type mismatches between frontend and backend
**Solution**: Ensure consistent interface definitions

### Issue 4: Performance Issues
**Problem**: Slow API responses
**Solution**: Add database indexes and optimize queries

### Issue 5: Response Structure Mismatch (CRITICAL)
**Problem**: Frontend expects `result.vat.id` but API returns `result.data.id`
**Error**: `Cannot read properties of undefined (reading 'id')`
**Solution**: 
- **API Routes**: Always return `{ success: true, message: string, data: T }` format
- **Frontend**: Always access `result.data.id` (not `result.vat.id` or `result.brand.id`)
- **Example Fix**:
  ```typescript
  // ❌ WRONG - Old format
  router.push(`/vat/${result.vat.id}`)
  
  // ✅ CORRECT - New unified format
  router.push(`/vat/${result.data.id}`)
  ```

### Issue 6: HTTP Method Mismatch
**Problem**: Using PUT instead of PATCH for updates
**Error**: API expects PATCH but frontend sends PUT
**Solution**: Always use PATCH for updates in unified API:
  ```typescript
  // ❌ WRONG
  method: 'PUT'
  
  // ✅ CORRECT
  method: 'PATCH'
  ```

### Issue 7: Numeric Field Search Issues
**Problem**: Searching numeric fields with `ILIKE` operator
**Error**: `operator does not exist: numeric ilike`
**Solution**: Use appropriate operators for different field types:
  ```typescript
  // ❌ WRONG - For numeric fields
  query = query.or(`numeric_field.ilike.%${searchQuery}%`)
  
  // ✅ CORRECT - For numeric fields
  query = query.or(`numeric_field.eq.${parseFloat(searchQuery) || 0}`)
  
  // ✅ CORRECT - For text fields
  query = query.or(`text_field.ilike.%${searchQuery}%`)
  ```

---

## Real-World Implementation Examples

### Example 1: VAT Page Unification (Completed)
**Issues Fixed:**
1. **Response Structure Mismatch**: Changed `result.vat.id` → `result.data.id`
2. **HTTP Method**: Changed `PUT` → `PATCH` for updates
3. **Search Query**: Fixed numeric field search (`kulcs.eq.${value}` instead of `kulcs.ilike.%${value}%`)
4. **Cache Invalidation**: Added `invalidateApiCache('/api/vat')` after mutations

**Files Modified:**
- `/api/vat/route.ts` - Unified GET/POST endpoints
- `/api/vat/[id]/route.ts` - Unified GET/PATCH/DELETE endpoints  
- `/vat/page.tsx` - Updated to use `useApiCache` and unified API
- `/vat/new/page.tsx` - Fixed response access pattern
- `/vat/[id]/page.tsx` - Fixed response access pattern

**Key Learnings:**
- Always use consistent `{ success, message, data }` response format
- Frontend must access `result.data` for all unified APIs
- Use appropriate Supabase operators for different field types
- Cache invalidation is critical for data consistency

### Example 2: Brands Page Unification (Completed)
**Pattern Applied:**
- Unified `/api/brands/optimized` → `/api/brands`
- Consistent response format across all endpoints
- Server-side search implementation
- Proper cache invalidation

**Result:**
- Reduced API complexity
- Improved performance
- Consistent user experience
- Easier maintenance

---

## Conclusion

This guide provides a comprehensive approach to unifying API endpoints and removing unnecessary services. By following these steps, you can:

1. **Simplify your architecture** by removing redundant services
2. **Improve performance** through better caching and server-side search
3. **Enhance maintainability** with consistent patterns
4. **Provide better user experience** with faster, more reliable functionality

Remember to test thoroughly at each step and document your changes for future reference.
