# Materialize Hooks Documentation

## Overview
This document provides a comprehensive guide to the custom React Hooks used in the Materialize Next.js Admin Template. These hooks provide essential functionality for navigation, settings management, media queries, and more. Based on the [official Materialize hooks documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/overview).

## Current Project Analysis

### Current Project Hooks Structure

The Materialize starter kit includes a complete hooks system with the following structure:

```
src/
├── @core/hooks/
│   ├── useImageVariant.ts        ← Image variant hook
│   ├── useLayoutInit.ts          ← Layout initialization hook
│   ├── useObjectCookie.ts        ← Object cookie management hook
│   └── useSettings.tsx           ← Settings management hook
└── @menu/hooks/
    ├── useHorizontalMenu.tsx     ← Horizontal menu hook
    ├── useHorizontalNav.tsx      ← Horizontal navigation hook
    ├── useMediaQuery.tsx         ← Media query hook
    ├── useVerticalMenu.tsx       ← Vertical menu hook
    └── useVerticalNav.tsx        ← Vertical navigation hook
```

**Current Hooks Status:**
- ✅ **Complete Hooks System**: All essential hooks present and functional
- ✅ **Navigation Hooks**: Vertical and horizontal navigation management
- ✅ **Settings Hook**: Complete settings management with context
- ✅ **Media Query Hook**: Responsive design support
- ✅ **Menu Hooks**: Menu state management for both layouts
- ✅ **Cookie Management**: Object cookie persistence
- ✅ **Layout Hooks**: Layout initialization and management
- ✅ **TypeScript Support**: Full type safety for all hooks

## Hooks Overview

Based on the [official hooks overview documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/overview):

### What are Custom Hooks?
Custom React Hooks are JavaScript functions that start with "use" and can call other hooks. They allow you to extract component logic into reusable functions, making your code more modular and easier to maintain.

### React-Use Library Integration
The Materialize template includes the `react-use` library, which provides additional utility hooks that can be used throughout your project.

### Available Hooks in Materialize

The template provides the following custom hooks:

1. **useVerticalNav** - Vertical navigation sidebar management
2. **useHorizontalNav** - Horizontal navigation management  
3. **useMediaQuery** - Media query detection for responsive design
4. **useSettings** - Application settings management

## useVerticalNav Hook

Based on the [official useVerticalNav documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/useVerticalNav):

### Overview
The `useVerticalNav()` hook is a custom hook specifically designed to handle the functionality and state management of a navigation sidebar within a web application. It provides a comprehensive set of variables that can be utilized to customize the behavior of the navigation sidebar.

### Hook Values

The `useVerticalNav()` hook provides the following variables:

| Value | Type | Description |
|-------|------|-------------|
| `width` | `number` | Determines the width of the navigation sidebar |
| `collapsedWidth` | `number` | Specifies the width when collapsed |
| `isCollapsed` | `boolean` | Indicates whether the sidebar is collapsed |
| `isHovered` | `boolean` | Indicates hover state when collapsed |
| `isToggled` | `boolean` | Indicates whether the sidebar is toggled |
| `isScrollWithContent` | `boolean` | Determines if sidebar scrolls with content |
| `isPopoutWhenCollapsed` | `boolean` | Determines if sidebar pops out when collapsed |
| `isBreakpointReached` | `boolean` | Indicates if breakpoint has been reached |
| `transitionDuration` | `number` | Transition duration in milliseconds |
| `updateVerticalNavState` | `(values: VerticalNavState) => void` | Updates navigation state |
| `collapseVerticalNav` | `(value?: boolean) => void` | Collapses the navigation |
| `hoverVerticalNav` | `(value?: boolean) => void` | Applies hover effect |
| `toggleVerticalNav` | `(value?: boolean) => void` | Toggles sidebar visibility |

### Usage Examples

#### 1. Basic Usage
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const NavigationComponent = () => {
  const {
    isCollapsed,
    isToggled,
    isHovered,
    width,
    collapsedWidth,
    toggleVerticalNav,
    collapseVerticalNav,
    hoverVerticalNav
  } = useVerticalNav()

  return (
    <div>
      <p>Sidebar Width: {width}px</p>
      <p>Collapsed Width: {collapsedWidth}px</p>
      <p>Is Collapsed: {isCollapsed ? 'Yes' : 'No'}</p>
      <p>Is Toggled: {isToggled ? 'Yes' : 'No'}</p>
      <p>Is Hovered: {isHovered ? 'Yes' : 'No'}</p>
      
      <button onClick={() => toggleVerticalNav()}>
        Toggle Menu
      </button>
      
      <button onClick={() => collapseVerticalNav()}>
        Collapse Menu
      </button>
      
      <button onClick={() => hoverVerticalNav()}>
        Hover Effect
      </button>
    </div>
  )
}
```

#### 2. Toggle Functionality
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const MenuToggle = () => {
  const { isToggled, toggleVerticalNav } = useVerticalNav()

  const handleToggle = () => {
    toggleVerticalNav(!isToggled)
  }

  return (
    <button onClick={handleToggle}>
      {isToggled ? 'Show Menu' : 'Hide Menu'}
    </button>
  )
}
```

#### 3. Collapse Functionality
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const CollapseButton = () => {
  const { isCollapsed, collapseVerticalNav } = useVerticalNav()

  const handleCollapse = () => {
    collapseVerticalNav(!isCollapsed)
  }

  return (
    <button onClick={handleCollapse}>
      {isCollapsed ? 'Expand Menu' : 'Collapse Menu'}
    </button>
  )
}
```

#### 4. Hover Functionality
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const HoverButton = () => {
  const { isHovered, hoverVerticalNav } = useVerticalNav()

  const handleHover = () => {
    hoverVerticalNav(!isHovered)
  }

  return (
    <button onClick={handleHover}>
      {isHovered ? 'Remove Hover' : 'Apply Hover'}
    </button>
  )
}
```

#### 5. Scroll with Content
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const ScrollToggle = () => {
  const { isScrollWithContent, updateVerticalNavState } = useVerticalNav()

  const handleScrollToggle = () => {
    updateVerticalNavState({
      isScrollWithContent: !isScrollWithContent
    })
  }

  return (
    <button onClick={handleScrollToggle}>
      Scroll with Content: {isScrollWithContent ? 'Enabled' : 'Disabled'}
    </button>
  )
}
```

#### 6. Popout When Collapsed
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const PopoutToggle = () => {
  const { isPopoutWhenCollapsed, updateVerticalNavState } = useVerticalNav()

  const handlePopoutToggle = () => {
    updateVerticalNavState({
      isPopoutWhenCollapsed: !isPopoutWhenCollapsed
    })
  }

  return (
    <button onClick={handlePopoutToggle}>
      Popout When Collapsed: {isPopoutWhenCollapsed ? 'Enabled' : 'Disabled'}
    </button>
  )
}
```

#### 7. Breakpoint Detection
```typescript
import useVerticalNav from '@menu/hooks/useVerticalNav'

const BreakpointIndicator = () => {
  const { isBreakpointReached } = useVerticalNav()

  return (
    <div>
      <p>Breakpoint Reached: {isBreakpointReached ? 'Yes' : 'No'}</p>
      {isBreakpointReached && (
        <p>Mobile view is active</p>
      )}
    </div>
  )
}
```

## useHorizontalNav Hook

### Overview
The `useHorizontalNav()` hook manages horizontal navigation functionality, providing state and methods for top navigation bars.

### Hook Values

| Value | Type | Description |
|-------|------|-------------|
| `isBreakpointReached` | `boolean` | Indicates if mobile breakpoint is reached |
| `isScrollWithContent` | `boolean` | Determines if nav scrolls with content |
| `updateHorizontalNavState` | `(values: HorizontalNavState) => void` | Updates horizontal nav state |

### Usage Example
```typescript
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

const HorizontalNavigation = () => {
  const {
    isBreakpointReached,
    isScrollWithContent,
    updateHorizontalNavState
  } = useHorizontalNav()

  return (
    <div>
      <p>Mobile View: {isBreakpointReached ? 'Active' : 'Inactive'}</p>
      <p>Scroll with Content: {isScrollWithContent ? 'Enabled' : 'Disabled'}</p>
    </div>
  )
}
```

## useMediaQuery Hook

Based on the [official useMediaQuery documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/useMediaQuery):

### Overview
The `useMediaQuery()` hook is a custom hook used to determine if the current viewport matches a given media query. It's essential for responsive design implementation.

### Hook Implementation
```typescript
const useMediaQuery = (breakpoint?: string): boolean => {
  const [matches, setMatches] = useState(breakpoint === 'always')

  useEffect(() => {
    if (breakpoint && breakpoint !== 'always') {
      const media = window.matchMedia(`(max-width: ${breakpoint})`)

      if (media.matches !== matches) {
        setMatches(media.matches)
      }

      const listener = () => setMatches(media.matches)
      window.addEventListener('resize', listener)

      return () => window.removeEventListener('resize', listener)
    }
  }, [matches, breakpoint])

  return matches
}
```

### Usage Examples

#### 1. Basic Media Query
```typescript
import useMediaQuery from '@menu/hooks/useMediaQuery'

const ResponsiveComponent = () => {
  const isMobile = useMediaQuery('768px')
  const isTablet = useMediaQuery('1024px')
  const isDesktop = useMediaQuery('1200px')

  return (
    <div>
      <p>Screen Size: {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}</p>
      {isMobile && <p>Mobile-specific content</p>}
      {isTablet && <p>Tablet-specific content</p>}
      {isDesktop && <p>Desktop-specific content</p>}
    </div>
  )
}
```

#### 2. Responsive Layout
```typescript
import useMediaQuery from '@menu/hooks/useMediaQuery'

const ResponsiveLayout = () => {
  const isMobile = useMediaQuery('768px')
  const isTablet = useMediaQuery('1024px')

  if (isMobile) {
    return <MobileLayout />
  }

  if (isTablet) {
    return <TabletLayout />
  }

  return <DesktopLayout />
}
```

#### 3. Conditional Rendering
```typescript
import useMediaQuery from '@menu/hooks/useMediaQuery'

const ConditionalComponent = () => {
  const isSmallScreen = useMediaQuery('600px')
  const isLargeScreen = useMediaQuery('1200px')

  return (
    <div>
      {isSmallScreen && (
        <button>Mobile Button</button>
      )}
      
      {isLargeScreen && (
        <div className="desktop-sidebar">
          <p>Desktop Sidebar Content</p>
        </div>
      )}
      
      <div className={`content ${isSmallScreen ? 'mobile' : 'desktop'}`}>
        Main Content
      </div>
    </div>
  )
}
```

#### 4. Dynamic Styling
```typescript
import useMediaQuery from '@menu/hooks/useMediaQuery'

const DynamicStyledComponent = () => {
  const isMobile = useMediaQuery('768px')

  const styles = {
    padding: isMobile ? '16px' : '32px',
    fontSize: isMobile ? '14px' : '16px',
    flexDirection: isMobile ? 'column' : 'row'
  }

  return (
    <div style={styles}>
      <p>Responsive content</p>
    </div>
  )
}
```

#### 5. Navigation Adaptation
```typescript
import useMediaQuery from '@menu/hooks/useMediaQuery'
import useVerticalNav from '@menu/hooks/useVerticalNav'

const AdaptiveNavigation = () => {
  const isMobile = useMediaQuery('768px')
  const { collapseVerticalNav } = useVerticalNav()

  useEffect(() => {
    if (isMobile) {
      collapseVerticalNav(true)
    } else {
      collapseVerticalNav(false)
    }
  }, [isMobile])

  return (
    <nav>
      {isMobile ? (
        <MobileMenu />
      ) : (
        <DesktopMenu />
      )}
    </nav>
  )
}
```

## useSettings Hook

Based on the [official useSettings documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/useSettings):

### Overview
The `useSettings()` hook is a React hook that allows you to access and modify the settings of your app. It enables you to update distinct settings for different pages within your application.

### Hook Values

| Value | Type | Description |
|-------|------|-------------|
| `settings` | `Settings` | The current settings of your app |
| `isSettingsChanged` | `boolean` | Indicates whether initial settings changed |
| `updateSettings` | `(settings: Partial<Settings>, options?: UpdateSettingsOptions) => void` | Updates app settings |
| `resetSettings` | `() => void` | Resets settings to initial values |
| `updatePageSettings` | `(settings: Partial<Settings>) => () => void` | Updates page-specific settings |

### Settings Object Properties

| Property | Values | Description |
|----------|--------|-------------|
| `mode` | `system`, `light`, `dark` | Color theme mode |
| `skin` | `default`, `bordered` | Template skin style |
| `semiDark` | `true`, `false` | Semi-dark theme toggle |
| `layout` | `vertical`, `horizontal`, `collapsed` | Layout arrangement |
| `navbarContentWidth` | `compact`, `wide` | Navbar width |
| `contentWidth` | `compact`, `wide` | Content area width |
| `footerContentWidth` | `compact`, `wide` | Footer width |
| `primaryColor` | `string` | Primary color theme |

### Usage Examples

#### 1. Basic Settings Access
```typescript
import { useSettings } from '@core/hooks/useSettings'

const SettingsDisplay = () => {
  const { settings, isSettingsChanged } = useSettings()

  return (
    <div>
      <h3>Current Settings</h3>
      <p>Mode: {settings.mode}</p>
      <p>Skin: {settings.skin}</p>
      <p>Layout: {settings.layout}</p>
      <p>Content Width: {settings.contentWidth}</p>
      <p>Settings Changed: {isSettingsChanged ? 'Yes' : 'No'}</p>
    </div>
  )
}
```

#### 2. Theme Mode Management
```typescript
import { useSettings } from '@core/hooks/useSettings'

const ThemeToggle = () => {
  const { settings, updateSettings } = useSettings()

  const toggleTheme = () => {
    const newMode = settings.mode === 'light' ? 'dark' : 'light'
    updateSettings({ mode: newMode })
  }

  return (
    <button onClick={toggleTheme}>
      Switch to {settings.mode === 'light' ? 'dark' : 'light'} mode
    </button>
  )
}
```

#### 3. Skin Management
```typescript
import { useSettings } from '@core/hooks/useSettings'

const SkinSelector = () => {
  const { settings, updateSettings } = useSettings()

  const changeSkin = (skin: 'default' | 'bordered') => {
    updateSettings({ skin })
  }

  return (
    <div>
      <button 
        onClick={() => changeSkin('default')}
        className={settings.skin === 'default' ? 'active' : ''}
      >
        Default Skin
      </button>
      <button 
        onClick={() => changeSkin('bordered')}
        className={settings.skin === 'bordered' ? 'active' : ''}
      >
        Bordered Skin
      </button>
    </div>
  )
}
```

#### 4. Layout Management
```typescript
import { useSettings } from '@core/hooks/useSettings'

const LayoutSelector = () => {
  const { settings, updateSettings } = useSettings()

  const changeLayout = (layout: 'vertical' | 'horizontal' | 'collapsed') => {
    updateSettings({ layout })
  }

  return (
    <div>
      <button 
        onClick={() => changeLayout('vertical')}
        className={settings.layout === 'vertical' ? 'active' : ''}
      >
        Vertical Layout
      </button>
      <button 
        onClick={() => changeLayout('horizontal')}
        className={settings.layout === 'horizontal' ? 'active' : ''}
      >
        Horizontal Layout
      </button>
      <button 
        onClick={() => changeLayout('collapsed')}
        className={settings.layout === 'collapsed' ? 'active' : ''}
      >
        Collapsed Layout
      </button>
    </div>
  )
}
```

#### 5. Content Width Management
```typescript
import { useSettings } from '@core/hooks/useSettings'

const ContentWidthSelector = () => {
  const { settings, updateSettings } = useSettings()

  const changeContentWidth = (width: 'compact' | 'wide') => {
    updateSettings({ 
      contentWidth: width,
      navbarContentWidth: width,
      footerContentWidth: width
    })
  }

  return (
    <div>
      <button 
        onClick={() => changeContentWidth('compact')}
        className={settings.contentWidth === 'compact' ? 'active' : ''}
      >
        Compact Width
      </button>
      <button 
        onClick={() => changeContentWidth('wide')}
        className={settings.contentWidth === 'wide' ? 'active' : ''}
      >
        Wide Width
      </button>
    </div>
  )
}
```

#### 6. Primary Color Management
```typescript
import { useSettings } from '@core/hooks/useSettings'

const ColorSelector = () => {
  const { settings, updateSettings } = useSettings()

  const colors = [
    { name: 'Primary', value: '#666CFF' },
    { name: 'Secondary', value: '#6C757D' },
    { name: 'Success', value: '#56CA00' },
    { name: 'Info', value: '#16B1FF' },
    { name: 'Warning', value: '#FFB400' },
    { name: 'Error', value: '#FF4C51' }
  ]

  const changePrimaryColor = (color: string) => {
    updateSettings({ primaryColor: color })
  }

  return (
    <div>
      <h4>Primary Color</h4>
      <div className="color-palette">
        {colors.map(color => (
          <button
            key={color.name}
            onClick={() => changePrimaryColor(color.value)}
            className={settings.primaryColor === color.value ? 'active' : ''}
            style={{ backgroundColor: color.value }}
          >
            {color.name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

#### 7. Settings Reset
```typescript
import { useSettings } from '@core/hooks/useSettings'

const ResetButton = () => {
  const { resetSettings, isSettingsChanged } = useSettings()

  return (
    <button 
      onClick={resetSettings}
      disabled={!isSettingsChanged}
    >
      Reset to Default Settings
    </button>
  )
}
```

#### 8. Page-specific Settings
```typescript
import { useSettings } from '@core/hooks/useSettings'
import { useEffect } from 'react'

const SpecialPage = () => {
  const { updatePageSettings } = useSettings()

  useEffect(() => {
    // Apply page-specific settings
    const resetSettings = updatePageSettings({
      layout: 'collapsed',
      contentWidth: 'wide'
    })

    // Cleanup function to reset settings when leaving page
    return resetSettings
  }, [])

  return (
    <div>
      <h2>Special Page with Custom Settings</h2>
      <p>This page has collapsed layout and wide content width</p>
    </div>
  )
}
```

## Additional Hooks

### useObjectCookie Hook

A utility hook for managing object cookies with JSON serialization.

```typescript
import { useObjectCookie } from '@core/hooks/useObjectCookie'

const CookieExample = () => {
  const [userPreferences, setUserPreferences] = useObjectCookie('user-preferences', {
    theme: 'light',
    language: 'en'
  })

  const updatePreferences = () => {
    setUserPreferences({
      theme: 'dark',
      language: 'es'
    })
  }

  return (
    <div>
      <p>Current Preferences: {JSON.stringify(userPreferences)}</p>
      <button onClick={updatePreferences}>Update Preferences</button>
    </div>
  )
}
```

### useVerticalMenu Hook

Manages vertical menu state and functionality.

```typescript
import useVerticalMenu from '@menu/hooks/useVerticalMenu'

const VerticalMenuComponent = () => {
  const { 
    openGroups, 
    handleGroupClick, 
    handleMenuClick 
  } = useVerticalMenu()

  return (
    <div>
      {/* Menu implementation */}
    </div>
  )
}
```

### useHorizontalMenu Hook

Manages horizontal menu state and functionality.

```typescript
import useHorizontalMenu from '@menu/hooks/useHorizontalMenu'

const HorizontalMenuComponent = () => {
  const { 
    openGroups, 
    handleGroupClick, 
    handleMenuClick 
  } = useHorizontalMenu()

  return (
    <div>
      {/* Menu implementation */}
    </div>
  )
}
```

## Advanced Hook Usage

### 1. Custom Hook Composition
```typescript
import { useSettings } from '@core/hooks/useSettings'
import useMediaQuery from '@menu/hooks/useMediaQuery'
import useVerticalNav from '@menu/hooks/useVerticalNav'

const useResponsiveNavigation = () => {
  const { settings, updateSettings } = useSettings()
  const isMobile = useMediaQuery('768px')
  const { collapseVerticalNav } = useVerticalNav()

  const adaptToScreenSize = () => {
    if (isMobile) {
      updateSettings({ layout: 'horizontal' })
      collapseVerticalNav(true)
    } else {
      updateSettings({ layout: 'vertical' })
      collapseVerticalNav(false)
    }
  }

  return {
    isMobile,
    adaptToScreenSize,
    currentLayout: settings.layout
  }
}
```

### 2. Hook with Local Storage
```typescript
import { useSettings } from '@core/hooks/useSettings'
import { useEffect } from 'react'

const useSettingsWithStorage = () => {
  const { settings, updateSettings } = useSettings()

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings))
  }, [settings])

  // Load from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings')
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        updateSettings(parsedSettings)
      } catch (error) {
        console.error('Failed to parse saved settings:', error)
      }
    }
  }, [])

  return { settings, updateSettings }
}
```

### 3. Hook with Validation
```typescript
import { useSettings } from '@core/hooks/useSettings'

const useValidatedSettings = () => {
  const { settings, updateSettings } = useSettings()

  const updateSettingsWithValidation = (newSettings: Partial<Settings>) => {
    const errors: string[] = []

    // Validate layout compatibility
    if (newSettings.layout === 'horizontal' && newSettings.navbar?.floating) {
      errors.push('Floating navbar is not compatible with horizontal layout')
    }

    // Validate content width consistency
    if (newSettings.contentWidth && 
        newSettings.contentWidth !== newSettings.navbarContentWidth) {
      errors.push('Content width should be consistent across components')
    }

    if (errors.length > 0) {
      console.warn('Settings validation errors:', errors)
      return false
    }

    updateSettings(newSettings)
    return true
  }

  return { settings, updateSettings: updateSettingsWithValidation }
}
```

## Performance Optimization

### 1. Hook Memoization
```typescript
import { useMemo } from 'react'
import { useSettings } from '@core/hooks/useSettings'

const OptimizedComponent = () => {
  const { settings } = useSettings()

  const memoizedSettings = useMemo(() => ({
    isDarkMode: settings.mode === 'dark',
    isWideLayout: settings.contentWidth === 'wide',
    isVerticalLayout: settings.layout === 'vertical'
  }), [settings.mode, settings.contentWidth, settings.layout])

  return (
    <div className={memoizedSettings.isDarkMode ? 'dark' : 'light'}>
      {/* Component content */}
    </div>
  )
}
```

### 2. Conditional Hook Usage
```typescript
import { useSettings } from '@core/hooks/useSettings'
import useMediaQuery from '@menu/hooks/useMediaQuery'

const ConditionalHookUsage = () => {
  const { settings } = useSettings()
  const isMobile = useMediaQuery('768px')

  // Only use vertical nav hook on desktop
  const verticalNav = useVerticalNav()
  const navState = isMobile ? null : verticalNav

  return (
    <div>
      {isMobile ? (
        <MobileNavigation />
      ) : (
        <DesktopNavigation navState={navState} />
      )}
    </div>
  )
}
```

## Testing Hooks

### 1. Hook Testing with React Testing Library
```typescript
import { renderHook, act } from '@testing-library/react'
import { useSettings } from '@core/hooks/useSettings'

test('useSettings hook updates settings correctly', () => {
  const { result } = renderHook(() => useSettings())

  act(() => {
    result.current.updateSettings({ mode: 'dark' })
  })

  expect(result.current.settings.mode).toBe('dark')
})
```

### 2. Media Query Hook Testing
```typescript
import { renderHook } from '@testing-library/react'
import useMediaQuery from '@menu/hooks/useMediaQuery'

test('useMediaQuery hook detects screen size', () => {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: query === '(max-width: 768px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  const { result } = renderHook(() => useMediaQuery('768px'))
  
  expect(result.current).toBe(true)
})
```

## Troubleshooting

### Issue: Hook Not Working
**Symptoms**: Hook returns undefined or throws error
**Solutions**:
1. Check if component is wrapped in proper provider
2. Verify hook import path
3. Ensure hook is used within React component
4. Check for context provider setup

### Issue: Settings Not Persisting
**Symptoms**: Settings changes not saved between sessions
**Solutions**:
1. Check cookie configuration
2. Verify browser cookie settings
3. Ensure proper SettingsProvider setup
4. Check for cookie size limits

### Issue: Media Query Not Updating
**Symptoms**: Media query hook not responding to screen size changes
**Solutions**:
1. Check breakpoint format
2. Verify window.matchMedia support
3. Ensure proper event listener cleanup
4. Check for SSR/hydration issues

### Issue: Navigation State Not Updating
**Symptoms**: Navigation state changes not reflected in UI
**Solutions**:
1. Check context provider setup
2. Verify hook usage within navigation components
3. Ensure proper state management
4. Check for component re-rendering issues

## Best Practices

### 1. Hook Composition
```typescript
// Combine multiple hooks for complex functionality
const useAppState = () => {
  const settings = useSettings()
  const verticalNav = useVerticalNav()
  const isMobile = useMediaQuery('768px')

  return {
    settings,
    navigation: verticalNav,
    isMobile,
    // Computed values
    isCollapsedOnMobile: isMobile && verticalNav.isCollapsed
  }
}
```

### 2. Error Boundaries
```typescript
import { useSettings } from '@core/hooks/useSettings'

const SafeSettingsComponent = () => {
  try {
    const { settings } = useSettings()
    return <div>Settings: {settings.mode}</div>
  } catch (error) {
    return <div>Error loading settings: {error.message}</div>
  }
}
```

### 3. Hook Documentation
```typescript
/**
 * Custom hook for managing theme settings
 * @returns {Object} Theme settings and update functions
 * @example
 * const { settings, updateSettings } = useThemeSettings()
 * updateSettings({ mode: 'dark' })
 */
const useThemeSettings = () => {
  const { settings, updateSettings } = useSettings()
  
  return {
    settings,
    updateSettings
  }
}
```

## Related Documentation

- [Theme Configurations](./THEME_CONFIGURATIONS.md) - Theme configuration and settings context
- [Menu Customization](./MENU_CUSTOMIZATION.md) - Menu customization and styling
- [Vertical Layout](./VERTICAL_LAYOUT.md) - Vertical layout components
- [Theming Guide](./THEMING_GUIDE.md) - Theme customization and styling

---
**Sources**: 
- [Hooks Overview Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/overview)
- [useVerticalNav Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/useVerticalNav)
- [useMediaQuery Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/useMediaQuery)
- [useSettings Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/hooks/useSettings)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
