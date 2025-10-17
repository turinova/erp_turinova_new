# Menu Customization Documentation

## Overview
This document provides a comprehensive guide to menu customization in the Materialize Next.js Admin Template, covering layout classes, menu styling, menu classes, before/after content, icons, React icons, and the customizer. Based on the [official Materialize menu documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/).

## Current Project Menu Analysis

### Starter Kit Menu Structure
The Materialize starter kit includes a complete menu system with all necessary components and styling:

```
src/
├── @menu/
│   ├── components/
│   │   ├── vertical-menu/
│   │   │   ├── Menu.tsx                ← Menu component
│   │   │   ├── MenuButton.tsx          ← Menu button component
│   │   │   ├── MenuItem.tsx            ← Menu item component
│   │   │   ├── MenuSection.tsx         ← Menu section component
│   │   │   ├── NavCollapseIcons.tsx    ← Collapse/expand icons
│   │   │   ├── NavHeader.tsx           ← Navigation header
│   │   │   ├── SubMenu.tsx             ← Submenu component
│   │   │   ├── SubMenuContent.tsx     ← Submenu content
│   │   │   └── VerticalNav.tsx         ← Vertical navigation
│   │   ├── horizontal-menu/
│   │   │   ├── HorizontalNav.tsx       ← Horizontal navigation
│   │   │   ├── Menu.tsx                ← Horizontal menu
│   │   │   ├── MenuButton.tsx          ← Menu button
│   │   │   ├── MenuItem.tsx            ← Menu item
│   │   │   ├── SubMenu.tsx             ← Submenu
│   │   │   ├── SubMenuContent.tsx     ← Submenu content
│   │   │   └── VerticalNavInHorizontal.tsx ← Vertical nav in horizontal
│   │   └── RouterLink.tsx              ← Router link component
│   ├── styles/
│   │   ├── vertical/
│   │   │   ├── StyledVerticalMenu.tsx  ← Vertical menu styling
│   │   │   ├── StyledVerticalMenuItem.tsx ← Menu item styling
│   │   │   ├── StyledVerticalMenuSection.tsx ← Menu section styling
│   │   │   ├── StyledVerticalNav.tsx   ← Navigation styling
│   │   │   ├── StyledVerticalNavBgColorContainer.tsx ← Background container
│   │   │   ├── StyledVerticalNavContainer.tsx ← Navigation container
│   │   │   ├── StyledVerticalNavExpandIcon.tsx ← Expand icon styling
│   │   │   └── verticalNavBgImage.module.css ← Background image styles
│   │   ├── horizontal/
│   │   │   ├── StyledHorizontalMenu.tsx ← Horizontal menu styling
│   │   │   ├── StyledHorizontalMenuItem.tsx ← Menu item styling
│   │   │   ├── StyledHorizontalNav.tsx ← Navigation styling
│   │   │   ├── StyledHorizontalNavExpandIcon.tsx ← Expand icon styling
│   │   │   ├── StyledHorizontalSubMenuContent.tsx ← Submenu content styling
│   │   │   ├── StyledHorizontalSubMenuContentWrapper.tsx ← Submenu wrapper
│   │   │   └── horizontalUl.module.css ← Horizontal menu CSS
│   │   ├── StyledBackdrop.tsx          ← Backdrop styling
│   │   ├── StyledMenuIcon.tsx          ← Menu icon styling
│   │   ├── StyledMenuLabel.tsx         ← Menu label styling
│   │   ├── StyledMenuPrefix.tsx        ← Menu prefix styling
│   │   ├── StyledMenuSectionLabel.tsx  ← Menu section label styling
│   │   ├── StyledMenuSuffix.tsx        ← Menu suffix styling
│   │   ├── StyledSubMenuContent.tsx    ← Submenu content styling
│   │   └── styles.module.css           ← Common menu styles
│   ├── utils/
│   │   ├── menuClasses.ts              ← Menu CSS classes
│   │   └── menuUtils.tsx               ← Menu utilities
│   ├── contexts/
│   │   ├── horizontalNavContext.tsx    ← Horizontal navigation context
│   │   └── verticalNavContext.tsx     ← Vertical navigation context
│   ├── hooks/
│   │   ├── useHorizontalMenu.tsx       ← Horizontal menu hook
│   │   ├── useHorizontalNav.tsx        ← Horizontal navigation hook
│   │   ├── useMediaQuery.tsx           ← Media query hook
│   │   ├── useVerticalMenu.tsx         ← Vertical menu hook
│   │   └── useVerticalNav.tsx          ← Vertical navigation hook
│   ├── svg/
│   │   ├── ChevronRight.tsx            ← Chevron right icon
│   │   ├── Close.tsx                   ← Close icon
│   │   ├── RadioCircle.tsx             ← Radio circle icon
│   │   └── RadioCircleMarked.tsx       ← Radio circle marked icon
│   ├── types.ts                        ← Menu type definitions
│   ├── defaultConfigs.ts               ← Default menu configurations
│   ├── vertical-menu/
│   │   └── index.tsx                   ← Vertical menu entry point
│   └── horizontal-menu/
│       └── index.tsx                   ← Horizontal menu entry point
├── @layouts/
│   └── utils/
│       └── layoutClasses.ts            ← Layout CSS classes
└── components/
    └── layout/
        ├── vertical/
        │   ├── Navigation.tsx          ← Vertical navigation implementation
        │   └── VerticalMenu.tsx        ← Vertical menu implementation
        └── horizontal/
            ├── Navigation.tsx          ← Horizontal navigation implementation
            └── HorizontalMenu.tsx      ← Horizontal menu implementation
```

**Current Menu Status:**
- ✅ **Complete Menu System**: All menu components present and functional
- ✅ **Vertical Menu**: Left sidebar with hierarchical structure
- ✅ **Horizontal Menu**: Top navigation with responsive behavior
- ✅ **Menu Styling**: Complete CSS styling system for both layouts
- ✅ **Menu Classes**: Comprehensive CSS class system
- ✅ **Layout Classes**: Complete layout class system
- ✅ **Menu Utilities**: Helper functions and hooks
- ✅ **Responsive Design**: Mobile and tablet responsive behavior

## Layout Classes

Based on the [official layout classes documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/layout-classes):

### Overview
Layout classes provide a comprehensive set of CSS classes for different layout types including vertical, horizontal, and blank layouts. These classes are designed to assist in customizing the layout of your application.

**Location**: `src/@layouts/utils/layoutClasses.ts`

### Vertical Layout Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-vertical-layout |
| contentWrapper | ts-vertical-layout-content-wrapper |
| header | ts-vertical-layout-header |
| headerFixed | ts-vertical-layout-header-fixed |
| headerStatic | ts-vertical-layout-header-static |
| headerFloating | ts-vertical-layout-header-floating |
| headerDetached | ts-vertical-layout-header-detached |
| headerAttached | ts-vertical-layout-header-attached |
| headerContentCompact | ts-vertical-layout-header-content-compact |
| headerContentWide | ts-vertical-layout-header-content-wide |
| headerBlur | ts-vertical-layout-header-blur |
| navbar | ts-vertical-layout-navbar |
| navbarContent | ts-vertical-layout-navbar-content |
| content | ts-vertical-layout-content |
| contentCompact | ts-vertical-layout-content-compact |
| contentWide | ts-vertical-layout-content-wide |
| footer | ts-vertical-layout-footer |
| footerStatic | ts-vertical-layout-footer-static |
| footerFixed | ts-vertical-layout-footer-fixed |
| footerDetached | ts-vertical-layout-footer-detached |
| footerAttached | ts-vertical-layout-footer-attached |
| footerContentWrapper | ts-vertical-layout-footer-content-wrapper |
| footerContent | ts-vertical-layout-footer-content |
| footerContentCompact | ts-vertical-layout-footer-content-compact |
| footerContentWide | ts-vertical-layout-footer-content-wide |

### Horizontal Layout Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-horizontal-layout |
| contentWrapper | ts-horizontal-layout-content-wrapper |
| header | ts-horizontal-layout-header |
| headerFixed | ts-horizontal-layout-header-fixed |
| headerStatic | ts-horizontal-layout-header-static |
| headerContentCompact | ts-horizontal-layout-header-content-compact |
| headerContentWide | ts-horizontal-layout-header-content-wide |
| headerBlur | ts-horizontal-layout-header-blur |
| navbar | ts-horizontal-layout-navbar |
| navbarContent | ts-horizontal-layout-navbar-content |
| navigation | ts-horizontal-layout-navigation |
| navigationContentWrapper | ts-horizontal-layout-navigation-content-wrapper |
| content | ts-horizontal-layout-content |
| contentCompact | ts-horizontal-layout-content-compact |
| contentWide | ts-horizontal-layout-content-wide |
| footer | ts-horizontal-layout-footer |
| footerStatic | ts-horizontal-layout-footer-static |
| footerFixed | ts-horizontal-layout-footer-fixed |
| footerContentWrapper | ts-horizontal-layout-footer-content-wrapper |
| footerContent | ts-horizontal-layout-footer-content |
| footerContentCompact | ts-horizontal-layout-footer-content-compact |
| footerContentWide | ts-horizontal-layout-footer-content-wide |

### Blank Layout Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-blank-layout |

### Creating Custom Layout Classes

**Step 1**: Create a new file `src/utils/userLayoutClasses.ts`

```typescript
export const verticalLayoutClasses = {
  customClass: 'custom-layout-class',
  customHeader: 'custom-header-class',
  customContent: 'custom-content-class'
}

export const horizontalLayoutClasses = {
  customClass: 'custom-horizontal-layout-class',
  customNav: 'custom-navigation-class'
}

export const blankLayoutClasses = {
  customClass: 'custom-blank-layout-class'
}
```

**Step 2**: Use custom classes in components

```typescript
import { verticalLayoutClasses } from '@/utils/userLayoutClasses'

const CustomComponent = () => {
  return (
    <div className={verticalLayoutClasses.customClass}>
      <header className={verticalLayoutClasses.customHeader}>
        Custom Header
      </header>
      <main className={verticalLayoutClasses.customContent}>
        Custom Content
      </main>
    </div>
  )
}
```

## Menu Classes

Based on the [official menu classes documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/menu-classes):

### Overview
Menu classes provide a comprehensive set of CSS classes for different menu types including vertical and horizontal menus. These classes are designed to assist in customizing the menu of your application.

**Location**: `src/@menu/utils/menuClasses.ts`

### Common Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-menu-root |
| menuSectionRoot | ts-menusection-root |
| menuItemRoot | ts-menuitem-root |
| subMenuRoot | ts-submenu-root |
| button | ts-menu-button |
| prefix | ts-menu-prefix |
| suffix | ts-menu-suffix |
| label | ts-menu-label |
| icon | ts-menu-icon |
| menuSectionWrapper | ts-menu-section-wrapper |
| menuSectionContent | ts-menu-section-content |
| menuSectionLabel | ts-menu-section-label |
| subMenuContent | ts-submenu-content |
| subMenuExpandIcon | ts-submenu-expand-icon |
| openActive | ts-open-active |
| disabled | ts-disabled |
| active | ts-active |
| open | ts-open |

### Vertical Menu Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-vertical-nav-root |
| container | ts-vertical-nav-container |
| bgColorContainer | ts-vertical-nav-bg-color-container |
| header | ts-vertical-nav-header |
| image | ts-vertical-nav-image |
| backdrop | ts-vertical-nav-backdrop |
| collapsed | ts-collapsed |
| toggled | ts-toggled |
| hovered | ts-hovered |
| scrollWithContent | ts-scroll-with-content |
| breakpointReached | ts-breakpoint-reached |
| collapsing | ts-collapsing |
| expanding | ts-expanding |

### Horizontal Menu Classes

| Variable Name | Class Name |
|---------------|------------|
| root | ts-horizontal-nav-root |
| scrollWithContent | ts-scroll-with-content |
| breakpointReached | ts-breakpoint-reached |

### Creating Custom Menu Classes

**Step 1**: Create a new file `src/utils/userMenuClasses.ts`

```typescript
export const verticalNavClasses = {
  customClass: 'custom-menu-class',
  customItem: 'custom-menu-item',
  customSubmenu: 'custom-submenu'
}

export const horizontalNavClasses = {
  customClass: 'custom-horizontal-menu-class',
  customItem: 'custom-horizontal-item'
}

export const commonMenuClasses = {
  customButton: 'custom-menu-button',
  customIcon: 'custom-menu-icon'
}
```

**Step 2**: Use custom classes in menu components

```typescript
import { verticalNavClasses } from '@/utils/userMenuClasses'

const CustomMenu = () => {
  return (
    <Menu className={verticalNavClasses.customClass}>
      <MenuItem className={verticalNavClasses.customItem}>
        Custom Item
      </MenuItem>
      <SubMenu className={verticalNavClasses.customSubmenu}>
        <MenuItem>Sub Item</MenuItem>
      </SubMenu>
    </Menu>
  )
}
```

## Menu Styling

Based on the [official menu styling documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/menu-styling):

### Vertical Layout Menu Styling

Menu styling for the Vertical layout is divided into three parts:

#### 1. Root Styles
**Location**: `src/@core/styles/vertical/navigationCustomStyles.ts`

For defining the navigation menu styles—excluding menu item, submenu, and menu section styles.

```typescript
// In src/components/layout/vertical/Navigation.tsx
import navigationCustomStyles from '@core/styles/vertical/navigationCustomStyles'

<VerticalNav
  customStyles={navigationCustomStyles(/* parameters */)}
  // ... other props
>
```

#### 2. Menu Item Styles
**Location**: `src/@core/styles/vertical/menuItemStyles.ts`

For defining the menu item and submenu styles.

```typescript
// In src/components/layout/vertical/VerticalMenu.tsx
import menuItemStyles from '@core/styles/vertical/menuItemStyles'

<Menu
  menuItemStyles={menuItemStyles(/* parameters */)}
  // ... other props
>
```

#### 3. Menu Section Styles
**Location**: `src/@core/styles/vertical/menuSectionStyles.ts`

For defining the menu section styles.

```typescript
// In src/components/layout/vertical/VerticalMenu.tsx
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

<Menu
  menuSectionStyles={menuSectionStyles(/* parameters */)}
  // ... other props
>
```

### Horizontal Layout Menu Styling

Menu styling for the Horizontal layout is divided into various parts:

#### 1. Navigation Content Wrapper Styles
**Location**: `src/components/layout/horizontal/Navigation.tsx`

For defining the navigation content wrapper styles using `StyledDiv` styled component.

#### 2. Menu Root Styles
**Location**: `src/@core/styles/horizontal/menuRootStyles.ts`

For defining the menu root styles.

```typescript
// In src/components/layout/horizontal/HorizontalMenu.tsx
import menuRootStyles from '@core/styles/horizontal/menuRootStyles'

<Menu
  rootStyles={menuRootStyles(/* parameters */)}
  // ... other props
>
```

#### 3. Menu Item Styles
**Location**: `src/@core/styles/horizontal/menuItemStyles.ts`

For defining the menu item and submenu styles.

```typescript
// In src/components/layout/horizontal/HorizontalMenu.tsx
import menuItemStyles from '@core/styles/horizontal/menuItemStyles'

<Menu
  menuItemStyles={menuItemStyles(/* parameters */)}
  // ... other props
>
```

#### 4. Adapting Navigation for Small Screens
For smaller screens, the horizontal menu transitions to a vertical format using the `switchToVertical` prop.

```typescript
// In src/components/layout/horizontal/HorizontalMenu.tsx
import VerticalNavContent from './VerticalNavContent'
import verticalNavigationCustomStyles from '@core/styles/vertical/navigationCustomStyles'
import verticalMenuItemStyles from '@core/styles/vertical/menuItemStyles'

<HorizontalNav
  switchToVertical
  verticalNavContent={VerticalNavContent}
  verticalNavProps={{
    customStyles: verticalNavigationCustomStyles(/* parameters */),
    // ... other props
  }}
  // ... other props
>
  <Menu
    verticalMenuProps={{
      menuItemStyles: verticalMenuItemStyles(/* parameters */),
      // ... other props
    }}
    // ... other props
  >
    {/* Menu items */}
  </Menu>
</HorizontalNav>
```

### Customizing Menu Styling

#### Custom Menu Item Styles
```typescript
// In src/components/layout/vertical/VerticalMenu.tsx
import menuItemStyles from '@core/styles/vertical/menuItemStyles'

// Create custom styles
const userMenuItemStyles = (/* parameters if any */) => ({
  root: {
    backgroundColor: 'transparent',
    borderRadius: '8px',
    margin: '4px 8px',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    '&.active': {
      backgroundColor: 'primary.main',
      color: 'primary.contrastText',
    }
  },
  button: {
    padding: '12px 16px',
    fontWeight: 500,
  }
})

<Menu
  menuItemStyles={{
    ...menuItemStyles(/* parameters */),
    ...userMenuItemStyles(/* parameters if any */)
  }}
  // ... other props
>
```

#### Custom Menu Section Styles
```typescript
// In src/components/layout/vertical/VerticalMenu.tsx
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

const userMenuSectionStyles = (/* parameters if any */) => ({
  root: {
    margin: '16px 0 8px 0',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'text.secondary',
    padding: '0 16px',
  }
})

<Menu
  menuSectionStyles={{
    ...menuSectionStyles(/* parameters */),
    ...userMenuSectionStyles(/* parameters if any */)
  }}
  // ... other props
>
```

#### Custom Navigation Styles
```typescript
// In src/components/layout/vertical/Navigation.tsx
import navigationCustomStyles from '@core/styles/vertical/navigationCustomStyles'

const userNavigationStyles = (/* parameters if any */) => ({
  root: {
    backgroundColor: 'background.paper',
    borderRight: '1px solid',
    borderColor: 'divider',
    boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
  },
  container: {
    padding: '16px 0',
  }
})

<VerticalNav
  customStyles={{
    ...navigationCustomStyles(/* parameters */),
    ...userNavigationStyles(/* parameters if any */)
  }}
  // ... other props
>
```

## Before/After Menu Content

Based on the [official before/after content documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/before-after-content):

### Overview
Before/after menu content is a feature that allows you to customize the layout of your menu by adding additional elements at the beginning or end of the menu. This feature is particularly useful for incorporating a header or footer into your menu layout.

### Scrollable Before Content

```typescript
import { PerfectScrollbar } from 'react-perfect-scrollbar'

const BeforeMenuContent = () => {
  return (
    <div className="before-menu-content">
      <div className="menu-header">
        <Typography variant="h6">Menu Header</Typography>
        <Typography variant="body2" color="text.secondary">
          Additional information
        </Typography>
      </div>
    </div>
  )
}

const Navigation = () => {
  return (
    <VerticalNav>
      {/* Before Menu Content */}
      <BeforeMenuContent />
      <PerfectScrollbar options={{ wheelPropagation: false }}>
        <Menu>
          <SubMenu label="Dashboards">
            <MenuItem>Analytics</MenuItem>
            <MenuItem>ECommerce</MenuItem>
          </SubMenu>
          <MenuItem href="/about">About</MenuItem>
          {/* More menu items */}
        </Menu>
      </PerfectScrollbar>
    </VerticalNav>
  )
}
```

### Scrollable After Content

```typescript
import { PerfectScrollbar } from 'react-perfect-scrollbar'

const AfterMenuContent = () => {
  return (
    <div className="after-menu-content">
      <div className="menu-footer">
        <Typography variant="body2" color="text.secondary">
          © 2024 Your Company
        </Typography>
        <Box className="menu-footer-links">
          <Link href="/help">Help</Link>
          <Link href="/support">Support</Link>
        </Box>
      </div>
    </div>
  )
}

const Navigation = () => {
  return (
    <VerticalNav>
      <PerfectScrollbar options={{ wheelPropagation: false }}>
        <Menu>
          <SubMenu label="Dashboards">
            <MenuItem>Analytics</MenuItem>
            <MenuItem>ECommerce</MenuItem>
          </SubMenu>
          <MenuItem href="/about">About</MenuItem>
          {/* More menu items */}
        </Menu>
      </PerfectScrollbar>
      {/* After Menu Content */}
      <AfterMenuContent />
    </VerticalNav>
  )
}
```

### Fixed Before & After Content

```typescript
const FixedBeforeContent = () => {
  return (
    <div className="fixed-before-content">
      <Box className="menu-search">
        <TextField
          placeholder="Search menu..."
          size="small"
          InputProps={{
            startAdornment: <IconSearch />
          }}
        />
      </Box>
    </div>
  )
}

const FixedAfterContent = () => {
  return (
    <div className="fixed-after-content">
      <Box className="menu-actions">
        <IconButton>
          <IconSettings />
        </IconButton>
        <IconButton>
          <IconUser />
        </IconButton>
      </Box>
    </div>
  )
}

const Navigation = () => {
  return (
    <VerticalNav>
      {/* Fixed Before Content */}
      <FixedBeforeContent />
      
      <PerfectScrollbar options={{ wheelPropagation: false }}>
        <Menu>
          <SubMenu label="Dashboards">
            <MenuItem>Analytics</MenuItem>
            <MenuItem>ECommerce</MenuItem>
          </SubMenu>
          <MenuItem href="/about">About</MenuItem>
          {/* More menu items */}
        </Menu>
      </PerfectScrollbar>
      
      {/* Fixed After Content */}
      <FixedAfterContent />
    </VerticalNav>
  )
}
```

## Icons and React Icons

Based on the [official icons documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/icons) and [React icons documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/how-to-use-react-icon):

### Icon System Overview
The Materialize template uses a comprehensive icon system that supports multiple icon libraries and provides consistent styling across the application.

### Built-in Icons
The template includes several built-in SVG icons:

**Location**: `src/@menu/svg/`

- `ChevronRight.tsx` - Chevron right icon
- `Close.tsx` - Close icon
- `RadioCircle.tsx` - Radio circle icon
- `RadioCircleMarked.tsx` - Radio circle marked icon

### Using React Icons

#### Installation
```bash
npm install react-icons
# or
yarn add react-icons
```

#### Basic Usage
```typescript
import { IconHome, IconUser, IconSettings } from '@tabler/icons-react'

const MenuItem = ({ icon, label, href }) => {
  return (
    <Box className="menu-item">
      <Icon name={icon} />
      <Typography>{label}</Typography>
    </Box>
  )
}

// Usage
<MenuItem icon={<IconHome />} label="Home" href="/home" />
<MenuItem icon={<IconUser />} label="Profile" href="/profile" />
<MenuItem icon={<IconSettings />} label="Settings" href="/settings" />
```

#### Icon Libraries Supported
- **Tabler Icons**: `@tabler/icons-react`
- **Material Icons**: `@mui/icons-material`
- **Font Awesome**: `react-icons/fa`
- **Feather Icons**: `react-icons/fi`
- **Heroicons**: `react-icons/hi`

#### Custom Icon Component
```typescript
import { Icon } from '@iconify/react'

const CustomIcon = ({ name, size = 20, color = 'currentColor' }) => {
  return (
    <Icon
      icon={name}
      width={size}
      height={size}
      color={color}
    />
  )
}

// Usage
<CustomIcon name="tabler:home" size={24} color="#666" />
<CustomIcon name="mdi:account" size={20} />
<CustomIcon name="heroicons:settings" size={18} />
```

#### Menu Icon Integration
```typescript
// In menu data
export const menuData = [
  {
    label: 'Dashboard',
    icon: 'tabler:home',
    path: '/dashboard'
  },
  {
    label: 'Users',
    icon: 'tabler:users',
    children: [
      {
        label: 'All Users',
        icon: 'tabler:user',
        path: '/users'
      },
      {
        label: 'Add User',
        icon: 'tabler:user-plus',
        path: '/users/add'
      }
    ]
  },
  {
    label: 'Settings',
    icon: 'tabler:settings',
    path: '/settings'
  }
]

// In menu component
const MenuItem = ({ item }) => {
  return (
    <Box className="menu-item">
      <Icon name={item.icon} />
      <Typography>{item.label}</Typography>
    </Box>
  )
}
```

### Icon Styling
```typescript
// Custom icon styles
const StyledIcon = styled(Icon)`
  color: ${({ theme }) => theme.palette.text.secondary};
  transition: color 0.2s ease;
  
  &:hover {
    color: ${({ theme }) => theme.palette.primary.main};
  }
  
  &.active {
    color: ${({ theme }) => theme.palette.primary.main};
  }
`

// Usage
<StyledIcon name="tabler:home" className={isActive ? 'active' : ''} />
```

## Customizer

Based on the [official customizer documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/customizer):

### Overview
The customizer is a powerful tool that allows users to customize various aspects of the template including theme, layout, colors, and other visual elements in real-time.

### Customizer Components

#### Theme Customizer
```typescript
import { useState } from 'react'
import { Box, Card, CardContent, Typography, Switch, Slider } from '@mui/material'

const ThemeCustomizer = () => {
  const [theme, setTheme] = useState({
    mode: 'light',
    primaryColor: '#666CFF',
    skin: 'default',
    layout: 'vertical',
    navbarType: 'fixed',
    footerType: 'static'
  })

  const handleThemeChange = (key, value) => {
    setTheme(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Theme Customizer
        </Typography>
        
        {/* Mode Toggle */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Mode</Typography>
          <Switch
            checked={theme.mode === 'dark'}
            onChange={(e) => handleThemeChange('mode', e.target.checked ? 'dark' : 'light')}
          />
        </Box>

        {/* Primary Color */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Primary Color</Typography>
          <Box className="color-picker">
            {primaryColors.map(color => (
              <Box
                key={color.name}
                className={`color-option ${theme.primaryColor === color.main ? 'active' : ''}`}
                style={{ backgroundColor: color.main }}
                onClick={() => handleThemeChange('primaryColor', color.main)}
              />
            ))}
          </Box>
        </Box>

        {/* Skin Selection */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Skin</Typography>
          <Box className="skin-options">
            <Box
              className={`skin-option ${theme.skin === 'default' ? 'active' : ''}`}
              onClick={() => handleThemeChange('skin', 'default')}
            >
              Default
            </Box>
            <Box
              className={`skin-option ${theme.skin === 'bordered' ? 'active' : ''}`}
              onClick={() => handleThemeChange('skin', 'bordered')}
            >
              Bordered
            </Box>
          </Box>
        </Box>

        {/* Layout Selection */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Layout</Typography>
          <Box className="layout-options">
            <Box
              className={`layout-option ${theme.layout === 'vertical' ? 'active' : ''}`}
              onClick={() => handleThemeChange('layout', 'vertical')}
            >
              Vertical
            </Box>
            <Box
              className={`layout-option ${theme.layout === 'horizontal' ? 'active' : ''}`}
              onClick={() => handleThemeChange('layout', 'horizontal')}
            >
              Horizontal
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
```

#### Layout Customizer
```typescript
const LayoutCustomizer = () => {
  const [layout, setLayout] = useState({
    navbarType: 'fixed',
    footerType: 'static',
    contentWidth: 'compact',
    layoutPadding: 24
  })

  const handleLayoutChange = (key, value) => {
    setLayout(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Layout Customizer
        </Typography>

        {/* Navbar Type */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Navbar Type</Typography>
          <Box className="navbar-options">
            <Box
              className={`navbar-option ${layout.navbarType === 'fixed' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('navbarType', 'fixed')}
            >
              Fixed
            </Box>
            <Box
              className={`navbar-option ${layout.navbarType === 'static' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('navbarType', 'static')}
            >
              Static
            </Box>
          </Box>
        </Box>

        {/* Footer Type */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Footer Type</Typography>
          <Box className="footer-options">
            <Box
              className={`footer-option ${layout.footerType === 'fixed' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('footerType', 'fixed')}
            >
              Fixed
            </Box>
            <Box
              className={`footer-option ${layout.footerType === 'static' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('footerType', 'static')}
            >
              Static
            </Box>
          </Box>
        </Box>

        {/* Content Width */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Content Width</Typography>
          <Box className="content-width-options">
            <Box
              className={`content-width-option ${layout.contentWidth === 'compact' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('contentWidth', 'compact')}
            >
              Compact
            </Box>
            <Box
              className={`content-width-option ${layout.contentWidth === 'wide' ? 'active' : ''}`}
              onClick={() => handleLayoutChange('contentWidth', 'wide')}
            >
              Wide
            </Box>
          </Box>
        </Box>

        {/* Layout Padding */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Layout Padding</Typography>
          <Slider
            value={layout.layoutPadding}
            onChange={(e, value) => handleLayoutChange('layoutPadding', value)}
            min={16}
            max={48}
            step={4}
            marks={[
              { value: 16, label: '16px' },
              { value: 24, label: '24px' },
              { value: 32, label: '32px' },
              { value: 48, label: '48px' }
            ]}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
```

#### Menu Customizer
```typescript
const MenuCustomizer = () => {
  const [menu, setMenu] = useState({
    collapsed: false,
    floating: false,
    detached: true,
    blur: true
  })

  const handleMenuChange = (key, value) => {
    setMenu(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Menu Customizer
        </Typography>

        {/* Collapsed */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Collapsed</Typography>
          <Switch
            checked={menu.collapsed}
            onChange={(e) => handleMenuChange('collapsed', e.target.checked)}
          />
        </Box>

        {/* Floating */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Floating</Typography>
          <Switch
            checked={menu.floating}
            onChange={(e) => handleMenuChange('floating', e.target.checked)}
          />
        </Box>

        {/* Detached */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Detached</Typography>
          <Switch
            checked={menu.detached}
            onChange={(e) => handleMenuChange('detached', e.target.checked)}
          />
        </Box>

        {/* Blur */}
        <Box className="customizer-section">
          <Typography variant="subtitle2">Blur</Typography>
          <Switch
            checked={menu.blur}
            onChange={(e) => handleMenuChange('blur', e.target.checked)}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
```

### Customizer Integration
```typescript
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'

const CustomizerProvider = ({ children }) => {
  const [customizerSettings, setCustomizerSettings] = useState({
    theme: 'light',
    primaryColor: '#666CFF',
    skin: 'default',
    layout: 'vertical',
    navbarType: 'fixed',
    footerType: 'static',
    contentWidth: 'compact',
    layoutPadding: 24,
    menu: {
      collapsed: false,
      floating: false,
      detached: true,
      blur: true
    }
  })

  const theme = createTheme({
    palette: {
      mode: customizerSettings.theme,
      primary: {
        main: customizerSettings.primaryColor
      }
    },
    // ... other theme options
  })

  return (
    <ThemeProvider theme={theme}>
      <CustomizerContext.Provider value={{ customizerSettings, setCustomizerSettings }}>
        {children}
      </CustomizerContext.Provider>
    </ThemeProvider>
  )
}

// Usage
const App = () => {
  return (
    <CustomizerProvider>
      <Layout>
        <Customizer />
        <MainContent />
      </Layout>
    </CustomizerProvider>
  )
}
```

## Advanced Menu Customization

### 1. Dynamic Menu Generation
```typescript
const DynamicMenu = ({ userRole }) => {
  const getMenuItems = (role) => {
    const baseMenu = [
      { label: 'Dashboard', icon: 'tabler:home', path: '/dashboard' }
    ]

    if (role === 'admin') {
      return [
        ...baseMenu,
        { label: 'Users', icon: 'tabler:users', path: '/users' },
        { label: 'Settings', icon: 'tabler:settings', path: '/settings' }
      ]
    }

    if (role === 'user') {
      return [
        ...baseMenu,
        { label: 'Profile', icon: 'tabler:user', path: '/profile' }
      ]
    }

    return baseMenu
  }

  return (
    <Menu>
      {getMenuItems(userRole).map(item => (
        <MenuItem key={item.path} href={item.path}>
          <Icon name={item.icon} />
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
```

### 2. Menu Search Functionality
```typescript
const SearchableMenu = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredMenu, setFilteredMenu] = useState(menuData)

  useEffect(() => {
    if (searchTerm) {
      const filtered = menuData.filter(item =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.path.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredMenu(filtered)
    } else {
      setFilteredMenu(menuData)
    }
  }, [searchTerm])

  return (
    <Box>
      <TextField
        placeholder="Search menu..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: <IconSearch />
        }}
      />
      <Menu>
        {filteredMenu.map(item => (
          <MenuItem key={item.path} href={item.path}>
            <Icon name={item.icon} />
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
```

### 3. Menu Badges and Notifications
```typescript
const MenuWithBadges = () => {
  const menuData = [
    {
      label: 'Dashboard',
      icon: 'tabler:home',
      path: '/dashboard'
    },
    {
      label: 'Messages',
      icon: 'tabler:message',
      path: '/messages',
      badge: 5
    },
    {
      label: 'Notifications',
      icon: 'tabler:bell',
      path: '/notifications',
      badge: 12
    }
  ]

  return (
    <Menu>
      {menuData.map(item => (
        <MenuItem key={item.path} href={item.path}>
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
        </MenuItem>
      ))}
    </Menu>
  )
}
```

## Performance Optimization

### 1. Menu Memoization
```typescript
import { memo, useMemo } from 'react'

const MemoizedMenuItem = memo(({ item }) => {
  return (
    <MenuItem href={item.path}>
      <Icon name={item.icon} />
      {item.label}
    </MenuItem>
  )
})

const OptimizedMenu = ({ menuData }) => {
  const memoizedMenuItems = useMemo(() => {
    return menuData.map(item => (
      <MemoizedMenuItem key={item.path} item={item} />
    ))
  }, [menuData])

  return <Menu>{memoizedMenuItems}</Menu>
}
```

### 2. Lazy Loading Menu Items
```typescript
import { lazy, Suspense } from 'react'

const LazyMenuItem = lazy(() => import('./MenuItem'))

const LazyMenu = ({ menuData }) => {
  return (
    <Menu>
      {menuData.map(item => (
        <Suspense key={item.path} fallback={<MenuItemSkeleton />}>
          <LazyMenuItem item={item} />
        </Suspense>
      ))}
    </Menu>
  )
}
```

## Testing Menu Components

### 1. Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import Menu from '@/components/Menu'

test('renders menu items', () => {
  const menuData = [
    { label: 'Home', path: '/home' },
    { label: 'About', path: '/about' }
  ]
  
  render(<Menu data={menuData} />)
  
  expect(screen.getByText('Home')).toBeInTheDocument()
  expect(screen.getByText('About')).toBeInTheDocument()
})

test('handles menu item click', () => {
  const menuData = [{ label: 'Home', path: '/home' }]
  const mockOnClick = jest.fn()
  
  render(<Menu data={menuData} onItemClick={mockOnClick} />)
  
  fireEvent.click(screen.getByText('Home'))
  expect(mockOnClick).toHaveBeenCalledWith('/home')
})
```

### 2. Menu Styling Testing
```typescript
import { render } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import Menu from '@/components/Menu'

test('applies custom menu styles', () => {
  const customStyles = {
    root: {
      backgroundColor: 'red'
    }
  }
  
  render(
    <ThemeProvider theme={theme}>
      <Menu styles={customStyles} />
    </ThemeProvider>
  )
  
  const menuElement = screen.getByTestId('menu-root')
  expect(menuElement).toHaveStyle('background-color: red')
})
```

## Troubleshooting

### Issue: Menu Items Not Styling
**Symptoms**: Custom styles not being applied to menu items
**Solutions**:
1. Check style object structure and properties
2. Verify CSS specificity and conflicts
3. Ensure proper theme integration
4. Check for missing style imports

### Issue: Menu Classes Not Working
**Symptoms**: Custom CSS classes not being applied
**Solutions**:
1. Verify class name spelling and structure
2. Check CSS file imports and paths
3. Ensure proper class application in components
4. Check for CSS conflicts

### Issue: Before/After Content Not Displaying
**Symptoms**: Before or after menu content not showing
**Solutions**:
1. Check component structure and placement
2. Verify PerfectScrollbar configuration
3. Ensure proper CSS positioning
4. Check for z-index conflicts

### Issue: Customizer Not Updating
**Symptoms**: Customizer changes not reflecting in UI
**Solutions**:
1. Check state management and updates
2. Verify theme provider integration
3. Ensure proper event handling
4. Check for component re-rendering issues

## Related Documentation

- [Vertical Layout](./VERTICAL_LAYOUT.md) - Vertical layout components
- [Theming Guide](./THEMING_GUIDE.md) - Theme customization
- [Pages Setup](./PAGES_SETUP.md) - Page development
- [Apps Setup](./APPS_SETUP.md) - App development

---
**Sources**: 
- [Layout Classes Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/layout-classes)
- [Menu Styling Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/menu-styling)
- [Menu Classes Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/menu-classes)
- [Before/After Content Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/before-after-content)
- [Icons Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/icons)
- [React Icons Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/how-to-use-react-icon)
- [Customizer Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/layout/customizer)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
list_dir
