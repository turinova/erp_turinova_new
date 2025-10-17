# CRUD Functionality Implementation Guide

This guide documents how to implement complete CRUD (Create, Read, Update, Delete) functionality for any entity in the ERP system, using the brands (`/gyartok`) implementation as a reference.

## 📋 Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Frontend Implementation](#frontend-implementation)
4. [Backend API Implementation](#backend-api-implementation)
5. [Database Integration](#database-integration)
6. [Testing](#testing)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## 🎯 Overview

The CRUD functionality follows a consistent pattern across all entities in the system:

- **List View**: Main page with table, search, selection, and action buttons
- **Detail View**: Individual record editing page
- **Create View**: New record creation page
- **API Endpoints**: RESTful API for all operations
- **Soft Delete**: Records are marked as deleted, not physically removed

## 📁 File Structure

For any entity (e.g., `brands`, `customers`, `products`), create this structure:

```
src/app/(dashboard)/{entity}/
├── page.tsx                    # Main list view
├── [id]/
│   └── page.tsx               # Detail/edit view
└── new/
    └── page.tsx              # Create new record view

src/app/api/{entity}/
├── route.ts                   # GET (list), POST (create)
└── [id]/
    └── route.ts              # GET (detail), PUT (update), DELETE (soft delete)
```

## 🎨 Frontend Implementation

### 1. Main List Page (`page.tsx`)

**Key Features:**
- Table with search functionality
- Row selection with checkboxes
- Action buttons (Add New, Delete Selected)
- Row click navigation to detail page
- Loading states and error handling

**Essential Imports:**
```typescript
import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
```

**Core State Management:**
```typescript
const router = useRouter()
const [items, setItems] = useState<Item[]>([])
const [selectedItems, setSelectedItems] = useState<string[]>([])
const [searchTerm, setSearchTerm] = useState('')
const [isLoading, setIsLoading] = useState(true)
const [deleteModalOpen, setDeleteModalOpen] = useState(false)
const [isDeleting, setIsDeleting] = useState(false)
```

**Essential Functions:**
```typescript
// Navigation
const handleRowClick = (itemId: string) => {
  router.push(`/${entity}/${itemId}`)
}

const handleAddNew = () => {
  router.push(`/${entity}/new`)
}

// Selection
const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
  if (event.target.checked) {
    setSelectedItems(filteredItems.map(item => item.id))
  } else {
    setSelectedItems([])
  }
}

const handleSelectItem = (itemId: string) => {
  setSelectedItems(prev => 
    prev.includes(itemId) 
      ? prev.filter(id => id !== itemId)
      : [...prev, itemId]
  )
}

// Search
const filteredItems = useMemo(() => {
  if (!searchTerm) return items
  const term = searchTerm.toLowerCase()
  return items.filter(item => 
    item.name.toLowerCase().includes(term) ||
    (item.comment && item.comment.toLowerCase().includes(term))
  )
}, [items, searchTerm])

// Delete
const handleDeleteConfirm = async () => {
  setIsDeleting(true)
  try {
    const deletePromises = selectedItems.map(itemId => 
      fetch(`/api/${entity}/${itemId}`, { method: 'DELETE' })
    )
    const results = await Promise.allSettled(deletePromises)
    // Handle results...
  } finally {
    setIsDeleting(false)
    setDeleteModalOpen(false)
  }
}
```

### 2. Detail/Edit Page (`[id]/page.tsx`)

**Key Features:**
- Form with validation
- Save functionality
- Breadcrumb navigation
- Loading states
- Metadata display

**Essential Imports:**
```typescript
import React, { useState, use, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
```

**Core State Management:**
```typescript
const router = useRouter()
const resolvedParams = use(params)
const [item, setItem] = useState<Item | null>(null)
const [errors, setErrors] = useState<{ [key: string]: string }>({})
const [isSaving, setIsSaving] = useState(false)
const [isLoading, setIsLoading] = useState(true)
```

**Essential Functions:**
```typescript
// Load data
useEffect(() => {
  const loadItem = async () => {
    try {
      const response = await fetch(`/api/${entity}/${resolvedParams.id}`)
      if (response.ok) {
        const itemData = await response.json()
        setItem(itemData)
      }
    } catch (error) {
      console.error('Error loading item:', error)
    } finally {
      setIsLoading(false)
    }
  }
  loadItem()
}, [resolvedParams.id])

// Save
const handleSave = async () => {
  if (!item) return
  
  const newErrors: { [key: string]: string } = {}
  if (!item.name.trim()) {
    newErrors.name = 'A név mező kötelező'
  }
  
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    return
  }
  
  setIsSaving(true)
  try {
    const response = await fetch(`/api/${entity}/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    
    if (response.ok) {
      const result = await response.json()
      toast.success('Adatok sikeresen mentve!')
      setItem(result.item)
    }
  } finally {
    setIsSaving(false)
  }
}
```

### 3. Create New Page (`new/page.tsx`)

**Key Features:**
- Empty form
- Validation
- Create functionality
- Navigation to detail page after creation

**Core State Management:**
```typescript
const [item, setItem] = useState<Item>({
  id: '',
  name: '',
  comment: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
})
const [errors, setErrors] = useState<{ [key: string]: string }>({})
const [isSaving, setIsSaving] = useState(false)
```

**Essential Functions:**
```typescript
const handleSave = async () => {
  const newErrors: { [key: string]: string } = {}
  if (!item.name.trim()) {
    newErrors.name = 'A név mező kötelező'
  }
  
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    return
  }
  
  setIsSaving(true)
  try {
    const response = await fetch(`/api/${entity}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    
    if (response.ok) {
      const result = await response.json()
      toast.success('Új rekord sikeresen létrehozva!')
      router.push(`/${entity}/${result.item.id}`)
    }
  } finally {
    setIsSaving(false)
  }
}
```

## 🔧 Backend API Implementation

### 1. Main Route (`route.ts`)

**GET Endpoint (List):**
```typescript
export async function GET(request: NextRequest) {
  try {
    console.log(`Fetching all ${entity}...`)
    
    // Progressive column fetching with fallbacks
    let { data: items, error } = await supabase
      .from(entity)
      .select('id, name, created_at')
      .order('name', { ascending: true })
    
    // Try to add comment column
    if (!error) {
      const commentResult = await supabase
        .from(entity)
        .select('id, name, comment, created_at')
        .order('name', { ascending: true })
      
      if (!commentResult.error) {
        items = commentResult.data
      }
    }
    
    // Try to add updated_at column
    if (!error && items) {
      const updatedAtResult = await supabase
        .from(entity)
        .select('id, name, comment, created_at, updated_at')
        .order('name', { ascending: true })
      
      if (!updatedAtResult.error) {
        items = updatedAtResult.data
      }
    }
    
    // Try to add soft delete filter
    if (!error && items) {
      const softDeleteResult = await supabase
        .from(entity)
        .select('id, name, comment, created_at, updated_at')
        .is('deleted_at', null)
        .order('name', { ascending: true })
      
      if (!softDeleteResult.error) {
        items = softDeleteResult.data
      }
    }
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }
    
    const itemsWithComment = items?.map(item => ({
      ...item,
      comment: (item as any).comment || null
    }))
    
    console.log(`Fetched ${itemsWithComment?.length || 0} items successfully`)
    return NextResponse.json(itemsWithComment || [])
    
  } catch (error) {
    console.error(`Error fetching ${entity}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**POST Endpoint (Create):**
```typescript
export async function POST(request: NextRequest) {
  try {
    console.log(`Creating new ${entity}...`)
    
    const itemData = await request.json()
    
    const newItem = {
      name: itemData.name || '',
      comment: itemData.comment || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: item, error } = await supabase
      .from(entity)
      .insert([newItem])
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Egy ${entity} már létezik ezzel a névvel`,
            error: 'Name already exists' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
    }
    
    console.log(`${entity} created successfully:`, item)
    
    return NextResponse.json(
      { 
        success: true, 
        message: `${entity} created successfully`,
        item: item
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error(`Error creating ${entity}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 2. Individual Route (`[id]/route.ts`)

**GET Endpoint (Detail):**
```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Fetching ${entity} ${id}`)
    
    const { data: item, error } = await supabase
      .from(entity)
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 })
    }
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    
    console.log(`${entity} fetched successfully:`, item)
    return NextResponse.json(item)
    
  } catch (error) {
    console.error(`Error fetching ${entity}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**PUT Endpoint (Update):**
```typescript
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const itemData = await request.json()
    
    console.log(`Updating ${entity} ${id}:`, itemData)
    
    const { data: item, error } = await supabase
      .from(entity)
      .update({
        name: itemData.name,
        comment: itemData.comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Egy ${entity} már létezik ezzel a névvel`,
            error: 'Name already exists' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }
    
    console.log(`${entity} updated successfully:`, item)
    return NextResponse.json({ 
      success: true, 
      message: `${entity} updated successfully`,
      item: item 
    })
    
  } catch (error) {
    console.error(`Error updating ${entity}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**DELETE Endpoint (Soft Delete):**
```typescript
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Soft deleting ${entity} ${id}`)
    
    // Try soft delete first
    let { error } = await supabase
      .from(entity)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    
    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')
      const result = await supabase
        .from(entity)
        .delete()
        .eq('id', id)
      
      error = result.error
    }
    
    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
    }
    
    console.log(`${entity} ${id} deleted successfully`)
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error(`Error deleting ${entity}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## 🗄️ Database Integration

### Required Database Schema

For any entity, ensure these columns exist:

```sql
-- Basic columns
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
name VARCHAR NOT NULL
comment TEXT

-- Timestamps
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

-- Soft delete
deleted_at TIMESTAMPTZ

-- Indexes
CREATE INDEX IF NOT EXISTS ix_{entity}_deleted_at ON {entity}(deleted_at) WHERE deleted_at IS NULL;
```

### Migration Script Template

```sql
-- Add soft delete and updated_at columns to {entity} table
ALTER TABLE {entity} ADD COLUMN deleted_at timestamptz;
ALTER TABLE {entity} ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_{entity}_deleted_at ON {entity}(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for {entity} table to automatically update updated_at
CREATE TRIGGER update_{entity}_updated_at
    BEFORE UPDATE ON {entity}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### ⚠️ CRITICAL: Unique Constraints for Soft Delete

**IMPORTANT**: When implementing soft delete, you MUST use partial unique indexes instead of standard unique constraints to allow reusing names of soft-deleted records.

#### ❌ WRONG - Standard Unique Constraint
```sql
-- This prevents creating new records with names of soft-deleted records
ALTER TABLE {entity} ADD CONSTRAINT {entity}_name_unique UNIQUE (name);
```

#### ✅ CORRECT - Partial Unique Index
```sql
-- This allows reusing names of soft-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS {entity}_name_unique_active ON {entity} (name) WHERE deleted_at IS NULL;
```

#### Migration Script for Unique Constraints Fix
```sql
-- Drop existing unique constraints if they exist
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = '{entity}'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = '{entity}'::regclass AND attname = 'name');
    IF FOUND THEN
        EXECUTE 'ALTER TABLE {entity} DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Create partial unique index for active records only
CREATE UNIQUE INDEX IF NOT EXISTS {entity}_name_unique_active ON {entity} (name) WHERE deleted_at IS NULL;
```

**Why This Matters**: Without this fix, users cannot create new records with names that were previously used by soft-deleted records, creating a poor user experience.

## 🧪 Testing

### API Testing Commands

```bash
# Test list endpoint
curl http://localhost:3000/api/{entity}

# Test create endpoint
curl -X POST http://localhost:3000/api/{entity} \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","comment":"Test comment"}'

# Test detail endpoint
curl http://localhost:3000/api/{entity}/{id}

# Test update endpoint
curl -X PUT http://localhost:3000/api/{entity}/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Item","comment":"Updated comment"}'

# Test delete endpoint
curl -X DELETE http://localhost:3000/api/{entity}/{id}
```

### Frontend Testing Checklist

- [ ] List page loads and displays data
- [ ] Search functionality works
- [ ] Row selection works
- [ ] "Add New" button navigates correctly
- [ ] Row click navigates to detail page
- [ ] Detail page loads and displays data
- [ ] Form validation works
- [ ] Save functionality works
- [ ] Create page works
- [ ] Delete functionality works
- [ ] Error handling works
- [ ] Loading states display correctly

## 📋 Best Practices

### 1. Consistent Naming
- Use Hungarian names for UI elements
- Use English names for technical elements
- Follow the pattern: `{entity}` (e.g., `brands`, `customers`)

### 2. Error Handling
- Always provide user-friendly error messages
- Log technical errors to console
- Handle network failures gracefully
- Provide fallback data when possible

### 3. Loading States
- Show loading indicators during API calls
- Disable buttons during operations
- Provide feedback for long operations

### 4. Validation
- Validate required fields
- Provide clear error messages
- Clear errors when user starts typing
- Handle duplicate name errors specifically

### 5. Navigation
- Use consistent breadcrumb structure
- Provide back buttons
- Navigate to detail page after creation
- Handle navigation errors gracefully

### 6. API Design
- Use progressive column fetching
- Handle missing columns gracefully
- Provide consistent response formats
- Use appropriate HTTP status codes

## 🔧 Troubleshooting

### Common Issues

**1. API 500 Errors**
- Check Supabase connection
- Verify column names exist
- Check for missing columns in progressive fetching

**2. Navigation Issues**
- Verify route structure matches file structure
- Check for typos in route paths
- Ensure proper Next.js App Router usage

**3. Form Validation Issues**
- Check required field validation
- Verify error state management
- Ensure proper form submission handling

**4. Soft Delete Issues**
- Verify `deleted_at` column exists
- Check soft delete filtering in queries
- Ensure proper fallback to hard delete

### Debug Steps

1. Check browser console for errors
2. Check server console for API errors
3. Test API endpoints directly with curl
4. Verify database schema matches expectations
5. Check Supabase connection and permissions

## 📚 Reference Implementation

The complete CRUD implementation can be found in:

- **Brands**: `/gyartok` (fully implemented)
- **Customers**: `/customers` (fully implemented)

Use these as templates for implementing CRUD functionality for any new entity in the system.

---

*This guide provides a complete blueprint for implementing CRUD functionality. Follow these patterns consistently across all entities for a maintainable and user-friendly system.*
