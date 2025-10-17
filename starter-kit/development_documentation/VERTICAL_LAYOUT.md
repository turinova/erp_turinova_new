# Vertical Layout Components Documentation

## Overview
This document provides a comprehensive guide to understanding and customizing the Vertical Layout components in the Materialize Next.js Admin Template, based on the [official vertical layout documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/vertical-layout-components).

## What is the Vertical Layout?

The Vertical Layout is the primary layout structure for admin interfaces, featuring:
- **Left Sidebar Navigation** - Collapsible menu with hierarchical structure
- **Top Navbar** - Header with search, user actions, and navigation controls
- **Main Content Area** - Primary workspace for page content
- **Footer** - Bottom section with copyright and important links

## Current Project Layout Analysis

### Starter Kit Layout Structure
The Materialize starter kit includes a complete vertical layout implementation with all necessary components:

```
src/
├── @layouts/
│   ├── VerticalLayout.tsx              ← Main vertical layout component
│   ├── components/
│   │   └── vertical/
│   │       ├── Footer.tsx              ← Footer wrapper component
│   │       ├── LayoutContent.tsx      ← Content wrapper component
│   │       └── Navbar.tsx              ← Navbar wrapper component
│   └── styles/
│       └── vertical/
│           ├── StyledContentWrapper.tsx ← Content styling
│           ├── StyledFooter.tsx         ← Footer styling
│           └── StyledHeader.tsx        ← Header styling
├── @menu/
│   ├── components/
│   │   └── vertical-menu/
│   │       ├── Menu.tsx                ← Menu component
│   │       ├── MenuButton.tsx          ← Menu button component
│   │       ├── MenuItem.tsx            ← Menu item component
│   │       ├── MenuSection.tsx         ← Menu section component
│   │       ├── NavCollapseIcons.tsx    ← Collapse/expand icons
│   │       ├── NavHeader.tsx           ← Navigation header
│   │       ├── SubMenu.tsx             ← Submenu component
│   │       ├── SubMenuContent.tsx     ← Submenu content
│   │       └── VerticalNav.tsx         ← Vertical navigation
│   ├── vertical-menu/
│   │   └── index.tsx                   ← Vertical menu entry point
│   └── styles/
│       └── vertical/
│           ├── StyledVerticalMenu.tsx  ← Menu styling
│           ├── StyledVerticalMenuItem.tsx ← Menu item styling
│           ├── StyledVerticalMenuSection.tsx ← Menu section styling
│           └── StyledVerticalNav.tsx   ← Navigation styling
└── components/
    └── layout/
        ├── shared/
        │   └── Logo.tsx                 ← Logo component
        └── vertical/
            ├── Footer.tsx              ← Footer implementation
            ├── FooterContent.tsx       ← Footer content
            ├── Navbar.tsx              ← Navbar implementation
            ├── NavbarContent.tsx       ← Navbar content
            ├── Navigation.tsx          ← Navigation implementation
            ├── NavToggle.tsx           ← Navigation toggle
            └── VerticalMenu.tsx        ← Vertical menu implementation
```

**Current Layout Status:**
- ✅ **Complete Vertical Layout**: All components present and functional
- ✅ **Navigation Menu**: Left sidebar with hierarchical structure
- ✅ **Navbar**: Top header with search and user actions
- ✅ **Content Area**: Main workspace for page content
- ✅ **Footer**: Bottom section with copyright and links
- ✅ **Styling**: Complete CSS styling system
- ✅ **Responsive**: Mobile and tablet responsive design

## Vertical Layout Components Guide

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/vertical-layout-components):

## 1. Navigation Menu (Left Sidebar)

The Navigation Menu is positioned on the left side and organized for straightforward access and navigation:

### Navigation Structure
- **Navigation Header**: Company brand, logo, and sidebar toggle icons
- **Navigation Section (MenuSection)**: Various navigation groups and items
- **Navigation Group (SubMenu)**: Groups including navigation items or smaller subgroups
- **Navigation Item (MenuItem)**: Fundamental unit representing links to specific pages

### Navigation Component

**Location**: `src/components/layout/vertical/Navigation.tsx`

The `Navigation` component renders the complete navigation menu including header and all navigation items.

#### Props
| Prop Name | Type | Description |
|-----------|------|-------------|
| dictionary | Awaited<ReturnType<typeof getDictionary>> | Dynamic object for localization (i18n feature only) |
| mode | system, light or dark | The mode of the template |
| systemMode | light or dark | The system mode of the user's device |
| skin | default or bordered | The skin of the template |

#### Usage Example
```typescript
import Navigation from '@/components/layout/vertical/Navigation'

const Layout = () => {
  return (
    <Navigation
      mode="light"
      systemMode="light"
      skin="default"
      dictionary={dictionary} // Only if using i18n
    />
  )
}
```

### NavHeader Component

**Location**: `src/@menu/components/vertical-menu/NavHeader.tsx`

Styled wrapper for logo and navigation menu toggle icons.

#### Features
- Company logo display
- Sidebar collapse/expand toggle
- Brand name display
- Responsive design

#### Usage
```typescript
import NavHeader from '@menu/components/vertical-menu/NavHeader'

const Navigation = () => {
  return (
    <NavHeader>
      {/* Logo and toggle icons */}
    </NavHeader>
  )
}
```

### Logo Component

**Location**: `src/components/layout/shared/Logo.tsx`

Renders company logo and text with customizable styling.

#### Customization Options
- Logo image source
- Company name text
- Logo size and positioning
- Color schemes

#### Usage
```typescript
import Logo from '@/components/layout/shared/Logo'

const NavHeader = () => {
  return (
    <Logo
      src="/path/to/logo.png"
      alt="Company Logo"
      text="Company Name"
    />
  )
}
```

### NavCollapseIcons Component

**Location**: `src/@menu/components/vertical-menu/NavCollapseIcons.tsx`

Renders icons for toggling (collapsing/expanding) the navigation menu.

#### Features
- Collapse/expand functionality
- Responsive behavior
- Icon animations
- Accessibility support

#### Usage
```typescript
import NavCollapseIcons from '@menu/components/vertical-menu/NavCollapseIcons'

const NavHeader = () => {
  return (
    <NavCollapseIcons
      onClick={handleToggle}
      isCollapsed={isCollapsed}
    />
  )
}
```

### VerticalMenu Component

**Location**: `src/components/layout/vertical/VerticalMenu.tsx`

Renders navigation items (menu sections, submenus, and menu items).

#### Props
| Prop Name | Type | Description |
|-----------|------|-------------|
| dictionary | Awaited<ReturnType<typeof getDictionary>> | Dynamic object for localization (i18n feature only) |

#### Usage
```typescript
import VerticalMenu from '@/components/layout/vertical/VerticalMenu'

const Navigation = () => {
  return (
    <VerticalMenu dictionary={dictionary} />
  )
}
```

## 2. Navbar (Top Header)

The Navbar spans the top of the layout and facilitates quick access to various functions:

### Navbar Structure
#### Left Side Section
- **Navigation Menu Toggler**: Mobile/tablet menu toggle
- **Template Search**: Intuitive search function for page navigation

#### Right Side Section
- **Change Language**: Language switching functionality
- **User Actions**: Profile, account settings, logout, etc.

### Navbar Component

**Location**: `src/@layouts/components/vertical/Navbar.tsx`

Dedicated wrapper encapsulating navbar content with predefined template styles.

#### Props
| Prop Name | Type | Required | Description |
|-----------|------|----------|-------------|
| children | ReactNode | Yes | Child components rendered inside the Navbar |
| overrideStyles | CSSObject | No | Custom styles using @emotion/styled CSSObject |

#### Usage
```typescript
import LayoutNavbar from '@layouts/components/vertical/Navbar'

const Navbar = () => {
  return (
    <LayoutNavbar
      overrideStyles={{
        '& .ts-vertical-layout-navbar': {
          backgroundColor: 'lightcyan !important'
        }
      }}
    >
      <NavbarContent />
    </LayoutNavbar>
  )
}
```

### NavbarContent Component

**Location**: `src/components/layout/vertical/NavbarContent.tsx`

Component for displaying content in the navbar.

#### Features
- Search functionality
- User menu dropdown
- Language switcher
- Notification center
- Theme toggle

#### Customization
```typescript
import NavbarContent from '@/components/layout/vertical/NavbarContent'

const Navbar = () => {
  return (
    <LayoutNavbar>
      <NavbarContent
        showSearch={true}
        showUserMenu={true}
        showLanguageSwitcher={true}
        showNotifications={true}
      />
    </LayoutNavbar>
  )
}
```

## 3. Content Area

The Content section is the primary area where main template content is displayed.

### LayoutContent Component

**Location**: `src/@layouts/components/vertical/LayoutContent.tsx`

Dedicated wrapper encapsulating page content with predefined template styles.

#### Features
- Responsive content area
- Proper spacing and padding
- Scroll behavior
- Content transitions

#### Usage
```typescript
import LayoutContent from '@layouts/components/vertical/LayoutContent'

const VerticalLayout = () => {
  return (
    <LayoutContent>
      {/* Page content goes here */}
      <YourPageContent />
    </LayoutContent>
  )
}
```

#### Customization
```typescript
import LayoutContent from '@layouts/components/vertical/LayoutContent'

const LayoutContent = () => {
  return (
    <LayoutContent
      overrideStyles={{
        '& .ts-vertical-layout-content': {
          padding: '24px',
          backgroundColor: '#f5f5f5'
        }
      }}
    >
      {/* Content */}
    </LayoutContent>
  )
}
```

## 4. Footer

The Footer, located at the bottom, provides essential information and links:

### Footer Structure
- **Copyright**: Left side ownership and copyright information
- **Important Links**: Right side links to License, Themes, Support portal, etc.

### Footer Component

**Location**: `src/@layouts/components/vertical/Footer.tsx`

Dedicated wrapper encapsulating footer content with predefined template styles.

#### Props
| Prop Name | Type | Required | Description |
|-----------|------|----------|-------------|
| children | ReactNode | Yes | Child components rendered inside the Footer |
| overrideStyles | CSSObject | No | Custom styles using @emotion/styled CSSObject |

#### Usage
```typescript
import LayoutFooter from '@layouts/components/vertical/Footer'

const Footer = () => {
  return (
    <LayoutFooter
      overrideStyles={{
        '& .ts-vertical-layout-footer-content-wrapper': {
          backgroundColor: 'lightcyan'
        }
      }}
    >
      <FooterContent />
    </LayoutFooter>
  )
}
```

### FooterContent Component

**Location**: `src/components/layout/vertical/FooterContent.tsx`

Component for displaying content in the footer.

#### Features
- Copyright information
- Important links
- Social media links
- Company information

#### Customization
```typescript
import FooterContent from '@/components/layout/vertical/FooterContent'

const Footer = () => {
  return (
    <LayoutFooter>
      <FooterContent
        copyright="© 2024 Your Company"
        links={[
          { label: 'License', href: '/license' },
          { label: 'Support', href: '/support' },
          { label: 'Documentation', href: '/docs' }
        ]}
      />
    </LayoutFooter>
  )
}
```

## Layout Customization Guide

### 1. Styling Customization

#### Override Component Styles
```typescript
// Navbar styling
<LayoutNavbar
  overrideStyles={{
    '& .ts-vertical-layout-navbar': {
      backgroundColor: 'your-color',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderBottom: '1px solid #e0e0e0'
    }
  }}
>

// Footer styling
<LayoutFooter
  overrideStyles={{
    '& .ts-vertical-layout-footer-content-wrapper': {
      backgroundColor: 'your-color',
      padding: '16px 24px',
      borderTop: '1px solid #e0e0e0'
    }
  }}
>

// Content styling
<LayoutContent
  overrideStyles={{
    '& .ts-vertical-layout-content': {
      padding: '24px',
      backgroundColor: '#fafafa',
      minHeight: 'calc(100vh - 120px)'
    }
  }}
>
```

### 2. Navigation Menu Customization

#### Menu Structure Customization
```typescript
// In src/data/navigation/verticalMenuData.tsx
export const verticalMenuData = [
  {
    label: 'Dashboard',
    icon: 'tabler:home',
    path: '/dashboard'
  },
  {
    label: 'Apps',
    icon: 'tabler:apps',
    children: [
      {
        label: 'Invoice',
        path: '/apps/invoice'
      },
      {
        label: 'User Management',
        path: '/apps/user-management'
      }
    ]
  },
  {
    label: 'Pages',
    icon: 'tabler:file',
    children: [
      {
        label: 'About',
        path: '/pages/about'
      },
      {
        label: 'Contact',
        path: '/pages/contact'
      }
    ]
  }
]
```

#### Menu Styling Customization
```typescript
// In src/@menu/styles/vertical/StyledVerticalMenu.tsx
export const StyledVerticalMenu = styled('div')<VerticalMenuProps>`
  .vertical-menu {
    background-color: ${({ theme }) => theme.palette.background.paper};
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    
    .menu-item {
      padding: 12px 16px;
      border-radius: 8px;
      margin: 4px 8px;
      
      &:hover {
        background-color: ${({ theme }) => theme.palette.action.hover};
      }
      
      &.active {
        background-color: ${({ theme }) => theme.palette.primary.main};
        color: ${({ theme }) => theme.palette.primary.contrastText};
      }
    }
  }
`
```

### 3. Responsive Behavior

#### Mobile Navigation
```typescript
// Mobile menu toggle
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

const handleMobileMenuToggle = () => {
  setMobileMenuOpen(!mobileMenuOpen)
}

// In NavbarContent.tsx
<IconButton
  onClick={handleMobileMenuToggle}
  sx={{ display: { xs: 'block', md: 'none' } }}
>
  <IconMenu2 />
</IconButton>
```

#### Tablet Navigation
```typescript
// Tablet-specific navigation
const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)')

const Navigation = () => {
  return (
    <Navigation
      collapsed={isTablet ? true : false}
      onCollapse={isTablet ? undefined : handleCollapse}
    />
  )
}
```

### 4. Theme Integration

#### Dark Mode Support
```typescript
// In Navigation.tsx
const Navigation = ({ mode, systemMode }: NavigationProps) => {
  const currentMode = mode === 'system' ? systemMode : mode
  
  return (
    <Navigation
      className={`vertical-navigation ${currentMode}-mode`}
      data-theme={currentMode}
    >
      {/* Navigation content */}
    </Navigation>
  )
}
```

#### Skin Customization
```typescript
// In themeConfig.ts
const themeConfig = {
  skin: 'bordered', // 'default' or 'bordered'
  // ... other config
}

// Apply skin-specific styles
const StyledNavigation = styled('div')<{ skin: string }>`
  ${({ skin }) => skin === 'bordered' && `
    border-right: 2px solid ${theme.palette.divider};
    box-shadow: 2px 0 4px rgba(0,0,0,0.1);
  `}
`
```

## Advanced Customization

### 1. Custom Navigation Header

```typescript
// Custom NavHeader component
const CustomNavHeader = () => {
  return (
    <Box className="nav-header">
      <Logo />
      <Box className="nav-actions">
        <IconButton onClick={handleSearch}>
          <IconSearch />
        </IconButton>
        <IconButton onClick={handleNotifications}>
          <IconBell />
        </IconButton>
      </Box>
    </Box>
  )
}
```

### 2. Custom Menu Items

```typescript
// Custom menu item with badge
const CustomMenuItem = ({ item }: { item: MenuItemType }) => {
  return (
    <Box className="menu-item">
      <Icon name={item.icon} />
      <Typography>{item.label}</Typography>
      {item.badge && (
        <Chip
          label={item.badge}
          size="small"
          color="error"
          className="menu-badge"
        />
      )}
    </Box>
  )
}
```

### 3. Custom Footer Content

```typescript
// Custom footer with social links
const CustomFooterContent = () => {
  return (
    <Box className="footer-content">
      <Box className="footer-left">
        <Typography variant="body2">
          © 2024 Your Company. All rights reserved.
        </Typography>
      </Box>
      <Box className="footer-right">
        <Box className="social-links">
          <IconButton><IconBrandTwitter /></IconButton>
          <IconButton><IconBrandLinkedin /></IconButton>
          <IconButton><IconBrandGithub /></IconButton>
        </Box>
        <Box className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
        </Box>
      </Box>
    </Box>
  )
}
```

## Performance Optimization

### 1. Lazy Loading

```typescript
// Lazy load navigation components
const Navigation = lazy(() => import('@/components/layout/vertical/Navigation'))
const Navbar = lazy(() => import('@/components/layout/vertical/Navbar'))

const VerticalLayout = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Navigation />
      <Navbar />
      <LayoutContent>
        {/* Content */}
      </LayoutContent>
      <Footer />
    </Suspense>
  )
}
```

### 2. Memoization

```typescript
// Memoize expensive components
const MemoizedNavigation = memo(Navigation)
const MemoizedNavbar = memo(Navbar)

// Use useMemo for expensive calculations
const menuItems = useMemo(() => {
  return processMenuData(rawMenuData)
}, [rawMenuData])
```

### 3. Virtual Scrolling

```typescript
// For large navigation menus
const VirtualizedMenu = () => {
  return (
    <FixedSizeList
      height={400}
      itemCount={menuItems.length}
      itemSize={50}
      itemData={menuItems}
    >
      {({ index, style, data }) => (
        <div style={style}>
          <MenuItem item={data[index]} />
        </div>
      )}
    </FixedSizeList>
  )
}
```

## Testing Layout Components

### 1. Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import Navigation from '@/components/layout/vertical/Navigation'

test('renders navigation menu', () => {
  render(<Navigation mode="light" skin="default" />)
  expect(screen.getByRole('navigation')).toBeInTheDocument()
})

test('toggles navigation collapse', () => {
  render(<Navigation mode="light" skin="default" />)
  const toggleButton = screen.getByRole('button', { name: /toggle/i })
  fireEvent.click(toggleButton)
  expect(screen.getByTestId('navigation')).toHaveClass('collapsed')
})
```

### 2. Layout Testing

```typescript
import { render } from '@testing-library/react'
import VerticalLayout from '@/layouts/VerticalLayout'

test('renders complete vertical layout', () => {
  render(
    <VerticalLayout>
      <div>Test Content</div>
    </VerticalLayout>
  )
  
  expect(screen.getByTestId('vertical-layout')).toBeInTheDocument()
  expect(screen.getByTestId('navigation')).toBeInTheDocument()
  expect(screen.getByTestId('navbar')).toBeInTheDocument()
  expect(screen.getByTestId('content')).toBeInTheDocument()
  expect(screen.getByTestId('footer')).toBeInTheDocument()
})
```

## Troubleshooting

### Issue: Navigation Not Collapsing
**Symptoms**: Sidebar doesn't collapse when clicking toggle button
**Solutions**:
1. Check `NavCollapseIcons` component implementation
2. Verify state management in navigation context
3. Ensure proper event handlers are attached
4. Check CSS classes and styling

### Issue: Menu Items Not Highlighting
**Symptoms**: Active menu items don't show proper styling
**Solutions**:
1. Verify route matching logic
2. Check active state management
3. Ensure proper CSS classes are applied
4. Verify theme integration

### Issue: Responsive Issues
**Symptoms**: Layout breaks on mobile/tablet devices
**Solutions**:
1. Check media query implementations
2. Verify responsive CSS classes
3. Test navigation toggle functionality
4. Ensure proper viewport meta tags

### Issue: Styling Overrides Not Working
**Symptoms**: Custom styles not being applied
**Solutions**:
1. Check CSS specificity
2. Verify `overrideStyles` prop usage
3. Ensure proper CSS-in-JS implementation
4. Check for conflicting styles

## Related Documentation

- [Pages Setup](./PAGES_SETUP.md) - Page development
- [Apps Setup](./APPS_SETUP.md) - App development
- [Theming Guide](./THEMING_GUIDE.md) - Theme customization
- [Folder Structure](./FOLDER_STRUCTURE.md#layout-files)

---
**Source**: [Materialize Vertical Layout Components Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/vertical-layout-components)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
list_dir
