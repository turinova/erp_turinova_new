# CRUD Quick Reference Guide

Quick reference for implementing CRUD functionality in the ERP system.

## 🚀 Quick Start Checklist

### 1. Create File Structure
```bash
mkdir -p src/app/\(dashboard\)/{entity}
mkdir -p src/app/\(dashboard\)/{entity}/\[id\]
mkdir -p src/app/\(dashboard\)/{entity}/new
mkdir -p src/app/api/{entity}
mkdir -p src/app/api/{entity}/\[id\]
```

### 2. Create Pages
- `src/app/(dashboard)/{entity}/page.tsx` - List view
- `src/app/(dashboard)/{entity}/[id]/page.tsx` - Detail/edit view  
- `src/app/(dashboard)/{entity}/new/page.tsx` - Create view

### 3. Create API Routes
- `src/app/api/{entity}/route.ts` - GET (list), POST (create)
- `src/app/api/{entity}/[id]/route.ts` - GET (detail), PUT (update), DELETE (soft delete)

### 4. Update Navigation
Add to `src/data/navigation/verticalMenuData.tsx`:
```typescript
{
  title: '{Entity Name}',
  path: '/{entity}',
  icon: 'tabler:database'
}
```

## 📝 Essential Code Templates

### List Page Template
```typescript
'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface Item {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

export default function ItemsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch items from API
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/items')
        if (response.ok) {
          const data = await response.json()
          setItems(data)
        }
      } catch (error) {
        console.error('Failed to fetch items:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchItems()
  }, [])

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items
    const term = searchTerm.toLowerCase()
    return items.filter(item => 
      item.name.toLowerCase().includes(term) ||
      (item.comment && item.comment.toLowerCase().includes(term))
    )
  }, [items, searchTerm])

  const handleRowClick = (itemId: string) => {
    router.push(`/items/${itemId}`)
  }

  const handleAddNew = () => {
    router.push('/items/new')
  }

  // ... rest of implementation
}
```

### Detail Page Template
```typescript
'use client'
import React, { useState, use, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface Item {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const [item, setItem] = useState<Item | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadItem = async () => {
      try {
        const response = await fetch(`/api/items/${resolvedParams.id}`)
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
      const response = await fetch(`/api/items/${item.id}`, {
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

  // ... rest of implementation
}
```

### API Route Template
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all items...')
    
    let { data: items, error } = await supabase
      .from('items')
      .select('id, name, comment, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }
    
    console.log(`Fetched ${items?.length || 0} items successfully`)
    return NextResponse.json(items || [])
    
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new item...')
    
    const itemData = await request.json()
    
    const newItem = {
      name: itemData.name || '',
      comment: itemData.comment || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: item, error } = await supabase
      .from('items')
      .insert([newItem])
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
    }
    
    console.log('Item created successfully:', item)
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Item created successfully',
        item: item
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('Error creating item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## 🗄️ Database Migration Template

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

## 🧪 Testing Commands

```bash
# Test list
curl http://localhost:3000/api/{entity}

# Test create
curl -X POST http://localhost:3000/api/{entity} \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","comment":"Test comment"}'

# Test detail
curl http://localhost:3000/api/{entity}/{id}

# Test update
curl -X PUT http://localhost:3000/api/{entity}/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Item","comment":"Updated comment"}'

# Test delete
curl -X DELETE http://localhost:3000/api/{entity}/{id}
```

## 📋 Implementation Checklist

- [ ] Create file structure
- [ ] Create list page with table, search, selection
- [ ] Create detail page with form and validation
- [ ] Create new page with form and validation
- [ ] Create API routes (GET, POST, PUT, DELETE)
- [ ] Add navigation menu item
- [ ] Test all CRUD operations
- [ ] Test error handling
- [ ] Test loading states
- [ ] Test validation
- [ ] Test soft delete functionality

## 🔧 Common Issues & Solutions

**API 500 Error**: Check Supabase connection and column names
**Navigation Error**: Verify route structure matches file structure
**Form Validation**: Check required field validation and error state
**Soft Delete**: Ensure `deleted_at` column exists and is properly filtered

---

*Use this quick reference alongside the full CRUD Functionality Guide for complete implementation.*
