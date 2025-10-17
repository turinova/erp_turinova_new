# New Page Generation Process Documentation

## Overview
This document provides a step-by-step guide for creating new pages in the ERP Turinova Next.js application and adding them to the vertical navigation menu.

## Architecture Overview

The ERP Turinova application uses Next.js 15 with App Router and follows a specific structure:

```
src/
├── app/
│   └── (dashboard)/           ← Dashboard pages group
│       ├── layout.tsx         ← Shared layout for all dashboard pages
│       ├── home/              ← Individual page directories
│       ├── customers/         ← Example: Customers page
│       └── gyartok/           ← Example: New Gyártók page
├── data/
│   └── navigation/
│       └── verticalMenuData.tsx ← Navigation configuration
└── components/                ← Reusable components
```

## Step-by-Step Process

### Step 1: Create the Page Directory and Component

1. **Navigate to the dashboard pages directory:**
   ```bash
   cd /Volumes/T7/erp_turinova_new/starter-kit/src/app/(dashboard)
   ```

2. **Create a new directory for your page:**
   ```bash
   mkdir gyartok
   ```

3. **Create the page component file:**
   ```bash
   touch gyartok/page.tsx
   ```

4. **Add basic page content:**
   ```typescript
   // gyartok/page.tsx
   export default function GyartokPage() {
     return <h1>Gyártók</h1>
   }
   ```

### Step 2: Update Navigation Configuration

1. **Open the navigation configuration file:**
   ```bash
   /Volumes/T7/erp_turinova_new/starter-kit/src/data/navigation/verticalMenuData.tsx
   ```

2. **Add the new menu item to the appropriate section:**
   ```typescript
   {
     label: 'Törzsadatok',
     icon: 'ri-database-2-line',
     iconColor: '#2ECC71',
     children: [
       {
         label: 'Ügyfelek',
         href: '/customers'
       },
       {
         label: 'Gyártók',        ← New menu item
         href: '/gyartok'         ← Route path
       }
     ]
   }
   ```

### Step 3: Test the New Page

1. **Ensure servers are running:**
   - PHP server: `http://localhost:8000`
   - Next.js server: `http://localhost:3000`

2. **Access the new page:**
   - Direct URL: `http://localhost:3000/gyartok`
   - Via navigation: Click "Törzsadatok" → "Gyártók"

## Navigation Structure

### Menu Item Properties

Each menu item can have the following properties:

```typescript
{
  label: string,           // Display text
  href?: string,          // Route path (for leaf items)
  icon?: string,          // Iconify icon name
  iconColor?: string,     // Hex color for icon
  children?: Array<{      // Submenu items
    label: string,
    href: string
  }>
}
```

### Available Icon Colors

The application uses a consistent color scheme:

- `#0B6E99` - Blue (Home/Dashboard)
- `#9B9A97` - Gray (Informational)
- `#0F7B6C` - Green (Success/Optimization)
- `#E67E22` - Orange (Testing/Experimentation)
- `#8E44AD` - Purple (Tools/Settings)
- `#2ECC71` - Green (Master Data)

### Icon Library

The application uses Iconify icons. Common icons include:

- `ri-home-smile-line` - Home
- `ri-database-2-line` - Database/Master Data
- `ri-speed-up-line` - Optimization
- `ri-test-tube-line` - Testing
- `ri-settings-3-line` - Settings
- `ri-information-line` - Information

## File Structure Examples

### Simple Page (Leaf Item)
```
src/app/(dashboard)/gyartok/
└── page.tsx
```

### Complex Page with Sub-routes
```
src/app/(dashboard)/customers/
├── page.tsx              ← List view
├── new/
│   └── page.tsx          ← Create new
└── [id]/
    └── page.tsx          ← Detail view
```

## Best Practices

### 1. Naming Conventions
- **Directory names**: Use lowercase, hyphen-separated (e.g., `gyartok`, `customer-details`)
- **Component names**: Use PascalCase (e.g., `GyartokPage`, `CustomerDetailPage`)
- **Route paths**: Match directory structure (e.g., `/gyartok`, `/customers/new`)

### 2. Page Structure
- Always export a default function component
- Use descriptive component names ending with "Page"
- Keep initial implementation simple, add complexity gradually

### 3. Navigation Organization
- Group related pages under parent menu items
- Use consistent icon colors for similar functionality
- Keep menu hierarchy shallow (max 2 levels recommended)

### 4. Hungarian Localization
- Use Hungarian labels in navigation (`Gyártók`, `Törzsadatok`)
- Maintain consistency with existing Hungarian terminology
- Consider adding English translations for internationalization

## Common Patterns

### 1. List Page Pattern
```typescript
export default function GyartokPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Gyártók</h1>
      {/* List content here */}
    </div>
  )
}
```

### 2. Form Page Pattern
```typescript
export default function NewGyartokPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Új Gyártó</h1>
      {/* Form content here */}
    </div>
  )
}
```

### 3. Detail Page Pattern
```typescript
export default function GyartokDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Gyártó Részletei</h1>
      {/* Detail content here */}
    </div>
  )
}
```

## Troubleshooting

### Issue: Page Not Found (404)
**Solution**: 
1. Check directory structure matches route path
2. Ensure `page.tsx` exists in the correct directory
3. Verify Next.js server is running and has reloaded

### Issue: Navigation Item Not Appearing
**Solution**:
1. Check `verticalMenuData.tsx` syntax
2. Ensure proper nesting in parent menu item
3. Verify href path matches directory structure

### Issue: TypeScript Errors
**Solution**:
1. Run `pnpm build` to check for compilation errors
2. Use proper TypeScript types for props
3. Import required dependencies

## Development Workflow

1. **Plan the page structure** - Determine if it needs sub-routes
2. **Create the directory structure** - Follow Next.js App Router conventions
3. **Implement basic page component** - Start with minimal content
4. **Update navigation configuration** - Add menu items
5. **Test the implementation** - Verify routing and navigation
6. **Add functionality gradually** - Build complexity incrementally
7. **Document any custom patterns** - Update this guide if needed

## Example: Complete Gyártók Page Implementation

### 1. Directory Structure
```
src/app/(dashboard)/gyartok/
└── page.tsx
```

### 2. Page Component
```typescript
// src/app/(dashboard)/gyartok/page.tsx
export default function GyartokPage() {
  return <h1>Gyártók</h1>
}
```

### 3. Navigation Update
```typescript
// src/data/navigation/verticalMenuData.tsx
{
  label: 'Törzsadatok',
  icon: 'ri-database-2-line',
  iconColor: '#2ECC71',
  children: [
    {
      label: 'Ügyfelek',
      href: '/customers'
    },
    {
      label: 'Gyártók',
      href: '/gyartok'
    }
  ]
}
```

### 4. Access URLs
- Direct: `http://localhost:3000/gyartok`
- Navigation: Törzsadatok → Gyártók

## Related Documentation

- [SERVER_STARTUP.md](./SERVER_STARTUP.md) - Server startup instructions
- [VERTICAL_LAYOUT.md](./VERTICAL_LAYOUT.md) - Layout component documentation
- [MENU_CUSTOMIZATION.md](./MENU_CUSTOMIZATION.md) - Advanced menu customization

---

**Last Updated**: December 2024  
**Project**: ERP Turinova  
**Template**: Materialize Next.js Admin Template v5.0.0
