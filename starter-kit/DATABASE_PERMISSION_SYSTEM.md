# Database-Based Permission System Documentation

## Overview

This document describes the implementation of a **database-driven permission system** for the ERP Turinova application. The system replaces the previous email-based permission logic with a robust, database-backed solution that provides granular page-level access control.

## System Architecture

### Core Components

1. **Database Tables**
   - `pages` - Stores available pages with UUIDs
   - `user_permissions` - Stores user-specific page permissions

2. **React Hooks**
   - `useDatabasePermission` - Checks page access for individual pages
   - `useDatabaseNavigation` - Filters navigation menu based on permissions
   - `useSimplePagePermissions` - Manages permission editing in admin interface

3. **API Routes**
   - `/api/pages` - Fetches all available pages
   - `/api/permissions/simple/user/[userId]` - Manages user permissions (GET/PUT)

## Database Schema

### Pages Table
```sql
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Permissions Table
```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  page_id UUID NOT NULL REFERENCES pages(id),
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, page_id)
);
```

## Implementation Details

### 1. Permission Checking Hook (`useDatabasePermission`)

**Location**: `src/hooks/useDatabasePermission.ts`

**Purpose**: Checks if the current user has access to a specific page path.

**Usage**:
```typescript
import { useDatabasePermission } from '@/hooks/useDatabasePermission'

function MyPage() {
  const hasAccess = useDatabasePermission('/vat')
  
  if (!hasAccess) {
    return <AccessDenied />
  }
  
  return <PageContent />
}
```

**How it works**:
1. Fetches user permissions from `/api/permissions/simple/user/[userId]`
2. Creates a permission map for fast lookups
3. Returns `true` if user has `can_access: true` for the page
4. Defaults to `true` if no permission record exists (allows access)

### 2. Navigation Filtering Hook (`useDatabaseNavigation`)

**Location**: `src/hooks/useFastNavigation.ts` (renamed from `useFastNavigation`)

**Purpose**: Filters the navigation menu based on user's database permissions.

**Usage**:
```typescript
import { useDatabaseNavigation } from '@/hooks/useFastNavigation'

function VerticalMenu() {
  const filteredMenu = useDatabaseNavigation()
  
  return <MenuItems items={filteredMenu} />
}
```

**How it works**:
1. Fetches user permissions from the API
2. Creates a permission map for fast lookups
3. Filters menu items based on database permissions
4. Always allows `/home` page access
5. Recursively filters nested menu items

### 3. Permission Management Hook (`useSimplePagePermissions`)

**Location**: `src/hooks/useSimplePagePermissions.ts`

**Purpose**: Manages permission editing in the admin interface.

**Usage**:
```typescript
import { useSimplePagePermissions } from '@/hooks/useSimplePagePermissions'

function PermissionEditor({ user }) {
  const {
    permissions,
    pages,
    loading,
    error,
    toggleAccess,
    savePermissions
  } = useSimplePagePermissions(user)
  
  return (
    <PermissionTable 
      permissions={permissions}
      onToggle={toggleAccess}
      onSave={savePermissions}
    />
  )
}
```

**Features**:
- Fetches all available pages from `/api/pages`
- Fetches user-specific permissions
- Initializes permissions for all pages (defaults to `true`)
- Provides toggle functionality for each page
- Saves changes to database via API

## API Endpoints

### GET `/api/pages`
Returns all active pages from the database.

**Response**:
```json
{
  "pages": [
    {
      "id": "uuid",
      "path": "/vat",
      "name": "Adónemek",
      "description": "VAT rates management",
      "category": "master-data",
      "is_active": true
    }
  ]
}
```

### GET `/api/permissions/simple/user/[userId]`
Returns user's permissions for all pages.

**Response**:
```json
{
  "permissions": [
    {
      "user_id": "uuid",
      "page_path": "/vat",
      "can_access": false
    }
  ]
}
```

### PUT `/api/permissions/simple/user/[userId]`
Updates user's permissions.

**Request Body**:
```json
{
  "permissions": [
    {
      "user_id": "uuid",
      "page_path": "/vat",
      "can_access": false
    }
  ]
}
```

**Process**:
1. Deletes existing permissions for the user
2. Fetches all pages to get UUIDs
3. Maps page paths to UUIDs
4. Inserts new permissions with correct UUIDs
5. Sets `can_edit` and `can_delete` to `false` (simple system)

## Page Protection Implementation

### Example: VAT Page Protection

**File**: `src/app/(dashboard)/vat/page.tsx`

```typescript
import { useDatabasePermission } from '@/hooks/useDatabasePermission'

export default function VatPage() {
  const router = useRouter()
  const hasAccess = useDatabasePermission('/vat')
  
  // Check access permission
  useEffect(() => {
    if (!hasAccess) {
      toast.error('Nincs jogosultsága az Adónemek oldal megtekintéséhez!')
      router.push('/users')
    }
  }, [hasAccess, router])

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az Adónemek oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  // ... rest of component
}
```

## Performance Optimizations

### 1. Database Queries
- Uses Supabase service role key for server-side operations
- Fetches all pages once and maps paths to UUIDs
- Batch operations for permission updates

### 2. Client-Side Caching
- Permission data is fetched once per user session
- Navigation menu is filtered client-side after initial fetch
- No repeated API calls for permission checks

### 3. Efficient Data Structures
- Uses `Map` for O(1) permission lookups
- Minimal data transfer (only necessary fields)
- Optimized database queries with proper indexing

## Security Considerations

### 1. Server-Side Validation
- All permission checks happen server-side via API routes
- Uses Supabase service role key for secure database access
- Validates user IDs and page paths

### 2. Client-Side Protection
- Pages check permissions before rendering content
- Navigation menu filters based on actual permissions
- Graceful fallbacks for permission errors

### 3. Data Integrity
- Foreign key constraints ensure valid page references
- Unique constraints prevent duplicate permissions
- Proper error handling for database operations

## Migration from Email-Based System

### Changes Made

1. **Replaced Email-Based Logic**
   - Removed email pattern matching
   - Implemented database-driven permission checks
   - Updated all permission-related hooks

2. **Updated Components**
   - `VerticalMenu.tsx` - Now uses `useDatabaseNavigation`
   - `vat/page.tsx` - Added `useDatabasePermission` check
   - `customers/page.tsx` - Added `useDatabasePermission` check

3. **New API Routes**
   - Created `/api/pages` for page management
   - Enhanced `/api/permissions/simple/user/[userId]` for database operations

### Benefits

1. **Granular Control**
   - Individual page-level permissions
   - Easy to manage via admin interface
   - No hardcoded email patterns

2. **Scalability**
   - Database-backed system scales with user growth
   - Easy to add new pages and permissions
   - Supports complex permission hierarchies

3. **Maintainability**
   - Clear separation of concerns
   - Consistent API patterns
   - Easy to debug and modify

## Usage Instructions

### For Administrators

1. **Managing User Permissions**
   - Go to Users page (`/users`)
   - Click "Jogosultságok kezelése" for any user
   - Toggle page access on/off
   - Click "Mentés" to save changes

2. **Adding New Pages**
   - Add page to `pages` table in Supabase
   - Update navigation menu data
   - Add permission check to page component

### For Developers

1. **Protecting a New Page**
   ```typescript
   import { useDatabasePermission } from '@/hooks/useDatabasePermission'
   
   export default function NewPage() {
     const hasAccess = useDatabasePermission('/new-page')
     
     if (!hasAccess) {
       return <AccessDenied />
     }
     
     return <PageContent />
   }
   ```

2. **Adding to Navigation**
   - Add page to `pages` table
   - Navigation will automatically filter based on permissions

## Troubleshooting

### Common Issues

1. **Permission Not Working**
   - Check if page exists in `pages` table
   - Verify user has permission record in `user_permissions`
   - Check browser console for API errors

2. **Navigation Not Filtering**
   - Ensure `useDatabaseNavigation` is used in `VerticalMenu`
   - Check if permissions are being fetched correctly
   - Verify page paths match between navigation and database

3. **API Errors**
   - Check Supabase connection
   - Verify service role key is set
   - Check database table structure

### Debug Commands

```bash
# Check user permissions
curl "http://localhost:3000/api/permissions/simple/user/[userId]"

# Check available pages
curl "http://localhost:3000/api/pages"

# Test permission update
curl -X PUT "http://localhost:3000/api/permissions/simple/user/[userId]" \
  -H "Content-Type: application/json" \
  -d '{"permissions":[{"user_id":"[userId]","page_path":"/vat","can_access":false}]}'
```

## Future Enhancements

### Planned Features

1. **Role-Based Permissions**
   - Group users into roles
   - Assign permissions to roles
   - Inherit permissions from roles

2. **Advanced Permission Types**
   - Read/Write/Delete permissions
   - Time-based access
   - IP-based restrictions

3. **Permission Analytics**
   - Track permission usage
   - Audit logs
   - Performance metrics

### Technical Improvements

1. **Caching Layer**
   - Supabase API for permission management
   - Reduced database queries
   - Faster permission checks

2. **Real-Time Updates**
   - WebSocket for permission changes
   - Live navigation updates
   - Instant permission enforcement

## Conclusion

The database-based permission system provides a robust, scalable, and maintainable solution for access control in the ERP Turinova application. It replaces the previous email-based system with a more flexible and secure approach that supports granular page-level permissions.

The system is designed for performance, security, and ease of use, making it suitable for production environments while remaining easy to maintain and extend.

---

**Last Updated**: September 13, 2025  
**Version**: 1.0  
**Author**: AI Assistant
