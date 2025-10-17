# Workers Management System Documentation

## Overview

The Workers Management System (`/workers`) is a complete CRUD (Create, Read, Update, Delete) application for managing employee records. It includes features like color coding, nickname management, phone number formatting, and a modern Material-UI interface.

## Features

### Core Functionality
- ✅ **Full CRUD Operations**: Create, read, update, and delete workers
- ✅ **Color Coding**: Each worker can have a custom color for visual identification
- ✅ **Nickname Support**: Optional nickname field for informal identification
- ✅ **Phone Number Formatting**: Automatic Hungarian phone number formatting
- ✅ **Search Functionality**: Real-time search by name or nickname
- ✅ **Bulk Operations**: Bulk delete functionality
- ✅ **Responsive Design**: Mobile-friendly interface

### UI/UX Features
- ✅ **Color Indicators**: Visual color circles in the table
- ✅ **Row Backgrounds**: Subtle color tinting based on worker color
- ✅ **Hover Effects**: Enhanced hover states with color-based backgrounds
- ✅ **Empty State**: Proper empty state handling with call-to-action
- ✅ **Loading States**: Skeleton loading components
- ✅ **Toast Notifications**: Success/error feedback

## Database Schema

### Workers Table
```sql
CREATE TABLE public.workers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) NOT NULL,
    nickname character varying(100) NULL,
    mobile character varying(20) NULL,
    color character varying(7) NULL DEFAULT '#1976d2',
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    deleted_at timestamp with time zone NULL,
    CONSTRAINT workers_pkey PRIMARY KEY (id)
);
```

### Indexes
- `idx_workers_name`: B-tree index on name field
- `idx_workers_nickname`: B-tree index on nickname field
- `idx_workers_mobile`: B-tree index on mobile field
- `idx_workers_color`: B-tree index on color field
- `idx_workers_active`: Partial index for active workers (deleted_at IS NULL)

## API Endpoints

### Workers List
- **GET** `/api/workers`
- **Description**: Fetch all active workers
- **Response**: Array of worker objects with all fields

### Create Worker
- **POST** `/api/workers`
- **Body**: `{ name, nickname?, mobile?, color? }`
- **Validation**: Name is required
- **Response**: Created worker object

### Get Worker
- **GET** `/api/workers/[id]`
- **Description**: Fetch single worker by ID
- **Response**: Worker object or 404

### Update Worker
- **PUT** `/api/workers/[id]`
- **Body**: `{ name, nickname?, mobile?, color? }`
- **Validation**: Name is required
- **Response**: Updated worker object

### Delete Worker
- **DELETE** `/api/workers/[id]`
- **Description**: Soft delete worker (sets deleted_at)
- **Response**: Success confirmation

### Bulk Delete
- **DELETE** `/api/workers/bulk-delete`
- **Body**: `{ ids: string[] }`
- **Description**: Soft delete multiple workers
- **Response**: Success confirmation

## File Structure

```
src/app/(dashboard)/workers/
├── page.tsx                    # Server-side rendered main page
├── WorkersList.tsx             # Client-side list component
├── new/
│   └── page.tsx               # Add new worker page
└── [id]/
    ├── page.tsx               # Server-side edit page
    └── WorkerEditClient.tsx   # Client-side edit component

src/app/api/workers/
├── route.ts                   # GET (list), POST (create)
├── [id]/
│   └── route.ts              # GET, PUT, DELETE individual worker
└── bulk-delete/
    └── route.ts              # Bulk delete endpoint
```

## Key Components

### WorkersList.tsx
- **Type**: Client Component (`'use client'`)
- **Purpose**: Main workers table with search and navigation
- **Features**:
  - Color-coded rows
  - Click-to-navigate functionality
  - Phone number formatting
  - Empty state handling

### WorkerEditClient.tsx
- **Type**: Client Component
- **Purpose**: Edit existing worker form
- **Features**:
  - Color picker integration
  - Phone number formatting
  - Form validation
  - Auto-save functionality

### New Worker Page
- **Type**: Server Component
- **Purpose**: Add new worker form
- **Features**:
  - Color picker
  - Phone number formatting
  - Form validation

## Phone Number Formatting

### Format Helper Function
```typescript
const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return ''
  
  const digits = phone.replace(/\D/g, '')
  
  let formatted = digits
  if (!digits.startsWith('36') && digits.length > 0) {
    formatted = '36' + digits
  }
  
  if (formatted.length >= 2) {
    const countryCode = formatted.substring(0, 2)
    const areaCode = formatted.substring(2, 4)
    const firstPart = formatted.substring(4, 7)
    const secondPart = formatted.substring(7, 11)
    
    let result = `+${countryCode}`
    if (areaCode) result += ` ${areaCode}`
    if (firstPart) result += ` ${firstPart}`
    if (secondPart) result += ` ${secondPart}`
    
    return result
  }
  
  return phone
}
```

### Input Formatting
- **Real-time formatting**: As user types
- **Hungarian numbers**: Auto-adds +36 prefix
- **International support**: Handles existing +36 prefix
- **Clean display**: Properly formatted for display

## Color System

### Color Storage
- **Format**: Hex color codes (e.g., `#1976d2`)
- **Default**: `#1976d2` (Material-UI primary blue)
- **Storage**: VARCHAR(7) in database

### Color Usage
- **Table Rows**: Subtle background tinting (`${color}10`)
- **Hover States**: Stronger tinting (`${color}20`)
- **Color Indicators**: Circular color previews
- **Color Picker**: HTML5 color input

## Navigation Integration

### Menu Structure
```typescript
{
  label: 'Törzsadatok',
  icon: 'ri-database-2-line',
  iconColor: '#2ECC71',
  children: [
    {
      label: 'Dolgozók',
      href: '/workers',
      icon: 'ri-user-line',
      iconColor: '#3498DB'
    }
  ]
}
```

### Permission System
- **Current Status**: Bypassed for development
- **Future**: Will integrate with main permission system
- **Access Control**: All authenticated users can access

## Performance Optimizations

### Server-Side Rendering (SSR)
- **Initial Load**: Workers data fetched on server
- **Performance**: Fast initial page load
- **SEO**: Fully server-rendered content

### Database Optimizations
- **Indexes**: Optimized queries with proper indexing
- **Soft Deletes**: Uses deleted_at instead of hard deletes
- **Query Performance**: Monitored with performance logs

### Client-Side Optimizations
- **Debounced Search**: Prevents excessive API calls
- **Skeleton Loading**: Better perceived performance
- **Error Boundaries**: Graceful error handling

## Error Handling

### API Error Handling
- **Validation Errors**: Proper HTTP status codes
- **Database Errors**: Graceful fallbacks
- **Authentication**: Proper session handling

### Client Error Handling
- **Toast Notifications**: User-friendly error messages
- **Form Validation**: Real-time validation feedback
- **Network Errors**: Retry mechanisms

## Security Considerations

### Authentication
- **Session Management**: Supabase session handling
- **API Protection**: Server-side authentication checks
- **CSRF Protection**: Built-in Next.js protection

### Data Validation
- **Input Sanitization**: All inputs properly sanitized
- **SQL Injection**: Protected via Supabase client
- **XSS Protection**: React's built-in protection

## Migration Scripts

### Initial Setup
```sql
-- add_workers_page.sql
INSERT INTO public.pages (path, name, description, category, is_active) 
VALUES ('/workers', 'Dolgozók', 'Dolgozók kezelése', 'Master Data', true);
```

### Schema Updates
```sql
-- add_nickname_to_workers.sql
ALTER TABLE public.workers ADD COLUMN nickname character varying(100) NULL;
CREATE INDEX IF NOT EXISTS idx_workers_nickname ON public.workers USING btree (nickname);
```

```sql
-- add_color_to_workers.sql
ALTER TABLE public.workers ADD COLUMN color character varying(7) NULL DEFAULT '#1976d2';
CREATE INDEX IF NOT EXISTS idx_workers_color ON public.workers USING btree (color);
```

## Testing

### Manual Testing Checklist
- ✅ Create new worker
- ✅ Edit existing worker
- ✅ Delete worker
- ✅ Bulk delete workers
- ✅ Search functionality
- ✅ Color picker
- ✅ Phone number formatting
- ✅ Navigation
- ✅ Empty state
- ✅ Error handling

### Performance Testing
- ✅ Page load times
- ✅ API response times
- ✅ Database query performance
- ✅ Client-side rendering

## Future Enhancements

### Planned Features
- **Advanced Search**: Filter by multiple criteria
- **Export/Import**: Excel/CSV functionality
- **Photo Upload**: Profile pictures
- **Role Management**: Worker roles and permissions
- **Schedule Integration**: Work schedule management
- **Reporting**: Worker statistics and reports

### Technical Improvements
- **Caching**: Redis caching for better performance
- **Real-time Updates**: WebSocket integration
- **Offline Support**: PWA capabilities
- **Mobile App**: React Native mobile app

## Troubleshooting

### Common Issues

#### Hydration Errors
- **Cause**: Server/client HTML mismatch
- **Solution**: Use proper SSR patterns, avoid client-only code in SSR components

#### Phone Number Formatting Issues
- **Cause**: Input formatting conflicts
- **Solution**: Use controlled components with proper state management

#### Color Picker Issues
- **Cause**: HTML5 color input compatibility
- **Solution**: Fallback to text input with validation

### Performance Issues
- **Slow Queries**: Check database indexes
- **Large Datasets**: Implement pagination
- **Memory Leaks**: Proper cleanup in useEffect

## Support

For technical support or feature requests, please refer to the main project documentation or contact the development team.

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Production Ready
