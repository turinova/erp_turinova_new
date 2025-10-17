# Theme Configurations & Settings Context Documentation

## Overview
This document provides a comprehensive guide to theme configurations and settings context in the Materialize Next.js Admin Template, covering the `themeConfig.ts` file, settings context implementation, and how to customize template behavior. Based on the [official Materialize theme configurations documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/settings/theme-configurations) and [settings context documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/settings/settings-context).

## Current Project Analysis

### Current Project Theme Configuration Analysis

**Location**: `src/configs/themeConfig.ts`

The Materialize starter kit includes a complete theme configuration system with the following current settings:

```typescript
const themeConfig: Config = {
  templateName: 'Materialize',
  homePageUrl: '/home',
  settingsCookieName: 'materialize-mui-next-demo-1',
  mode: 'system', // 'system', 'light', 'dark'
  skin: 'default', // 'default', 'bordered'
  semiDark: false, // true, false
  layout: 'vertical', // 'vertical', 'collapsed', 'horizontal'
  layoutPadding: 24, // Common padding for header, content, footer layout components (in px)
  compactContentWidth: 1440, // in px
  navbar: {
    type: 'fixed', // 'fixed', 'static'
    contentWidth: 'compact', // 'compact', 'wide'
    floating: false, //! true, false (This will not work in the Horizontal Layout)
    detached: true, //! true, false (This will not work in the Horizontal Layout or floating navbar is enabled)
    blur: true // true, false
  },
  contentWidth: 'compact', // 'compact', 'wide'
  footer: {
    type: 'static', // 'fixed', 'static'
    contentWidth: 'compact', // 'compact', 'wide'
    detached: true //! true, false (This will not work in the Horizontal Layout)
  },
  disableRipple: false // true, false
}
```

### Current Project Settings Context Analysis

**Location**: `src/@core/contexts/settingsContext.tsx`

The starter kit includes a complete settings context implementation with:

- **Settings Provider**: Complete context provider for managing theme settings
- **Cookie Integration**: Automatic cookie storage for settings persistence
- **State Management**: React state management for real-time updates
- **Page-level Settings**: Support for page-specific settings that don't persist
- **Settings Hook**: `useSettings()` hook for easy access to settings

**Current Settings Context Features:**
- ✅ **Complete Settings System**: All theme settings managed through context
- ✅ **Cookie Persistence**: Settings automatically saved to browser cookies
- ✅ **Real-time Updates**: Settings changes reflected immediately
- ✅ **Page-level Settings**: Temporary settings for specific pages
- ✅ **Settings Reset**: Ability to reset to default values
- ✅ **Settings Validation**: Type-safe settings with TypeScript
- ✅ **Customizer Integration**: Settings context integrated with customizer

## Theme Configurations

Based on the [official theme configurations documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/settings/theme-configurations):

### Overview
The `themeConfig.ts` file contains various template configurations along with their valid values. By making changes to these configurations, you can customize the template according to your specific requirements.

**Important Notes:**
- **Cookie Priority**: Some settings are stored in cookies and have higher priority than themeConfig
- **Browser Storage**: Clear browser's local storage to see configuration changes
- **Consistent Width**: Keep `contentWidth` property equal for navbar, page content, and footer

### Configuration Properties

The `themeConfig` object contains various properties and their default values that control the appearance and behavior of the template.

#### Complete Property Reference

| Property | Values | Description |
|----------|--------|-------------|
| `templateName` | string | Specifies the name of the template, project, or company |
| `homePageUrl` | string | Sets the URL for the home page |
| `settingsCookieName` | string | Specifies the name of the cookie that stores the settings |
| `mode` | `system`, `light`, `dark` | Sets the color mode for the template |
| `skin` | `default`, `bordered` | Changes the skin of the template |
| `semiDark` | `true`, `false` | Enables or disables semi-dark mode |
| `layout` | `vertical`, `horizontal`, `collapsed` | Defines the layout type |
| `layoutPadding` | number | Sets the padding for the layout in px |
| `compactContentWidth` | number | Specifies the width of the content area |
| `navbar.type` | `fixed`, `static` | Determines the position of the navbar |
| `navbar.contentWidth` | `compact`, `wide` | Sets the width of the navbar |
| `navbar.floating` | `true`, `false` | Enables or disables floating for the navbar |
| `navbar.detached` | `true`, `false` | Controls whether the navbar is detached |
| `navbar.blur` | `true`, `false` | Enables or disables blur for the navbar |
| `contentWidth` | `compact`, `wide` | Sets the width of the content area |
| `footer.type` | `fixed`, `static` | Specifies the type of the footer |
| `footer.contentWidth` | `compact`, `wide` | Sets the width of the footer |
| `footer.detached` | `true`, `false` | Controls whether the footer is detached |
| `disableRipple` | `true`, `false` | Enables or disables ripple effect |
| `toastPosition` | `top-right`, `top-center`, `top-left`, `bottom-right`, `bottom-center`, `bottom-left` | Specifies the position of the toast message |

### Detailed Property Explanations

#### 1. Basic Configuration
```typescript
const themeConfig = {
  templateName: 'Materialize',           // Your project/company name
  homePageUrl: '/home',                  // Default home page URL
  settingsCookieName: 'materialize-mui-next-demo-1', // Cookie name for settings
}
```

#### 2. Theme Mode Configuration
```typescript
const themeConfig = {
  mode: 'system', // 'system' | 'light' | 'dark'
  skin: 'default', // 'default' | 'bordered'
  semiDark: false, // true | false
}
```

**Mode Options:**
- `system`: Follows the device's system theme preference
- `light`: Forces light theme
- `dark`: Forces dark theme

**Skin Options:**
- `default`: Standard Material Design appearance
- `bordered`: Adds visual borders to components

#### 3. Layout Configuration
```typescript
const themeConfig = {
  layout: 'vertical', // 'vertical' | 'horizontal' | 'collapsed'
  layoutPadding: 24, // Common padding in pixels
  compactContentWidth: 1440, // Maximum content width in pixels
}
```

**Layout Options:**
- `vertical`: Left sidebar navigation
- `horizontal`: Top navigation bar
- `collapsed`: Collapsed sidebar navigation

#### 4. Navbar Configuration
```typescript
const themeConfig = {
  navbar: {
    type: 'fixed', // 'fixed' | 'static'
    contentWidth: 'compact', // 'compact' | 'wide'
    floating: false, // true | false (Not compatible with horizontal layout)
    detached: true, // true | false (Not compatible with horizontal layout or floating navbar)
    blur: true // true | false
  }
}
```

**Navbar Type:**
- `fixed`: Navbar stays in position when scrolling
- `static`: Navbar scrolls with content

**Content Width:**
- `compact`: Narrower content area
- `wide`: Wider content area

#### 5. Content Configuration
```typescript
const themeConfig = {
  contentWidth: 'compact', // 'compact' | 'wide'
}
```

#### 6. Footer Configuration
```typescript
const themeConfig = {
  footer: {
    type: 'static', // 'fixed' | 'static'
    contentWidth: 'compact', // 'compact' | 'wide'
    detached: true // true | false (Not compatible with horizontal layout)
  }
}
```

#### 7. Additional Configuration
```typescript
const themeConfig = {
  disableRipple: false, // true | false
  toastPosition: 'top-right' // Toast notification position
}
```

### Cookie Priority Settings

The following settings are stored in cookies and have higher priority than themeConfig:

1. `mode`
2. `skin`
3. `semiDark`
4. `layout`
5. `navbar.contentWidth`
6. `contentWidth`
7. `footer.contentWidth`

**To see changes in these settings:**
1. Click the reset button in the Customizer (top-right corner)
2. Clear the cookie from browser's Application/Storage tab and reload

## Settings Context

Based on the [official settings context documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/settings/settings-context):

### Overview
Settings Context has been created so that the template is independent of the redux store for storing the variables used in the template. It provides a centralized way to manage theme settings with cookie persistence.

### Settings Context Properties

The Settings Context provides the following properties and methods:

| Property | Type | Description |
|----------|------|-------------|
| `settings` | `Settings` | Stores the current settings |
| `updateSettings` | `(settings: Partial<Settings>, options?: UpdateSettingsOptions) => void` | Function to update settings with provided values |
| `isSettingsChanged` | `boolean` | Indicates if settings have been modified |
| `resetSettings` | `() => void` | Resets settings to default values |
| `updatePageSettings` | `(settings: Partial<Settings>) => () => void` | Updates settings for a specific page (temporary) |

### Settings Object Properties

The `Settings` object contains the following properties:

| Property | Values | Description |
|----------|--------|-------------|
| `mode` | `system`, `light`, `dark` | Changes the color theme |
| `skin` | `default`, `bordered` | Selects the template style |
| `semiDark` | `true`, `false` | Toggles a semi-dark theme |
| `layout` | `vertical`, `horizontal`, `collapsed` | Determines the layout arrangement |
| `navbarContentWidth` | `compact`, `wide` | Adjusts the navbar width |
| `contentWidth` | `compact`, `wide` | Sets the main content area's width |
| `footerContentWidth` | `compact`, `wide` | Defines the footer's width |
| `primaryColor` | `string` | Specifies the main color theme |

### Using Settings Context

#### 1. Accessing Settings
```typescript
import { useSettings } from '@core/hooks/useSettings'

const MyComponent = () => {
  const { settings, updateSettings } = useSettings()

  return (
    <div>
      <p>Current mode: {settings.mode}</p>
      <p>Current layout: {settings.layout}</p>
    </div>
  )
}
```

#### 2. Updating Settings
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

#### 3. Page-specific Settings
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

  return <div>Special page content</div>
}
```

#### 4. Resetting Settings
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
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
read_file


## Customizing Theme Configuration

### Example: ERP-focused Configuration
```typescript
const themeConfig: Config = {
  templateName: 'ERP Turinova',
  homePageUrl: '/dashboard',
  settingsCookieName: 'erp-turinova-settings',
  mode: 'light', // Force light theme for professional look
  skin: 'bordered', // Add borders for better data separation
  semiDark: false,
  layout: 'vertical', // Sidebar navigation for complex ERP
  layoutPadding: 32, // More padding for spacious feel
  compactContentWidth: 1600, // Wider content for data tables
  navbar: {
    type: 'fixed', // Keep navbar visible
    contentWidth: 'wide', // Wide navbar for more actions
    floating: false,
    detached: true,
    blur: true
  },
  contentWidth: 'wide', // Wide content for data visualization
  footer: {
    type: 'static',
    contentWidth: 'wide',
    detached: true
  },
  disableRipple: false,
  toastPosition: 'top-right'
}
```

### Example: Mobile-first Configuration
```typescript
const themeConfig: Config = {
  templateName: 'Mobile ERP',
  homePageUrl: '/mobile-dashboard',
  settingsCookieName: 'mobile-erp-settings',
  mode: 'system', // Follow system preference
  skin: 'default',
  semiDark: false,
  layout: 'horizontal', // Top navigation for mobile
  layoutPadding: 16, // Less padding for mobile
  compactContentWidth: 1200,
  navbar: {
    type: 'fixed',
    contentWidth: 'compact',
    floating: false,
    detached: false,
    blur: true
  },
  contentWidth: 'compact',
  footer: {
    type: 'static',
    contentWidth: 'compact',
    detached: false
  },
  disableRipple: false,
  toastPosition: 'bottom-center'
}
```

## Advanced Settings Management

### Settings Provider Setup
```typescript
// In your app root
import { SettingsProvider } from '@core/contexts/settingsContext'

const App = ({ children }) => {
  return (
    <SettingsProvider
      settingsCookie={null} // or initial cookie data
      mode="system" // optional initial mode
    >
      {children}
    </SettingsProvider>
  )
}
```

### Custom Settings Hook
```typescript
import { useSettings } from '@core/hooks/useSettings'

export const useThemeSettings = () => {
  const { settings, updateSettings } = useSettings()

  const setThemeMode = (mode: 'light' | 'dark' | 'system') => {
    updateSettings({ mode })
  }

  const setLayout = (layout: 'vertical' | 'horizontal' | 'collapsed') => {
    updateSettings({ layout })
  }

  const setContentWidth = (width: 'compact' | 'wide') => {
    updateSettings({ 
      contentWidth: width,
      navbarContentWidth: width,
      footerContentWidth: width
    })
  }

  return {
    settings,
    setThemeMode,
    setLayout,
    setContentWidth,
    updateSettings
  }
}
```

## Integration with Customizer

### Customizer Integration
The settings context is fully integrated with the customizer component, allowing real-time theme changes:

```typescript
import { useSettings } from '@core/hooks/useSettings'

const Customizer = () => {
  const { settings, updateSettings } = useSettings()

  const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
    updateSettings({ mode })
  }

  const handleLayoutChange = (layout: 'vertical' | 'horizontal' | 'collapsed') => {
    updateSettings({ layout })
  }

  const handleContentWidthChange = (width: 'compact' | 'wide') => {
    updateSettings({ 
      contentWidth: width,
      navbarContentWidth: width,
      footerContentWidth: width
    })
  }

  return (
    <div className="customizer">
      <div className="customizer-section">
        <label>Theme Mode</label>
        <select value={settings.mode} onChange={(e) => handleModeChange(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div className="customizer-section">
        <label>Layout</label>
        <select value={settings.layout} onChange={(e) => handleLayoutChange(e.target.value)}>
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
          <option value="collapsed">Collapsed</option>
        </select>
      </div>

      <div className="customizer-section">
        <label>Content Width</label>
        <select value={settings.contentWidth} onChange={(e) => handleContentWidthChange(e.target.value)}>
          <option value="compact">Compact</option>
          <option value="wide">Wide</option>
        </select>
      </div>
    </div>
  )
}
```

## Best Practices

### 1. Consistent Width Settings
```typescript
// Always keep content widths consistent
const updateContentWidth = (width: 'compact' | 'wide') => {
  updateSettings({
    contentWidth: width,
    navbarContentWidth: width,
    footerContentWidth: width
  })
}
```

### 2. Layout Compatibility
```typescript
// Check layout compatibility before applying settings
const updateLayout = (layout: 'vertical' | 'horizontal' | 'collapsed') => {
  const newSettings: Partial<Settings> = { layout }
  
  if (layout === 'horizontal') {
    // Disable incompatible settings for horizontal layout
    newSettings.navbar = {
      ...settings.navbar,
      floating: false,
      detached: false
    }
  }
  
  updateSettings(newSettings)
}
```

### 3. Settings Validation
```typescript
// Validate settings before applying
const validateSettings = (settings: Partial<Settings>) => {
  const errors: string[] = []
  
  if (settings.layout === 'horizontal' && settings.navbar?.floating) {
    errors.push('Floating navbar is not compatible with horizontal layout')
  }
  
  if (settings.layoutPadding && settings.layoutPadding < 0) {
    errors.push('Layout padding must be positive')
  }
  
  return errors
}
```

## Troubleshooting

### Issue: Settings Not Persisting
**Symptoms**: Settings changes not saved between sessions
**Solutions**:
1. Check cookie name configuration
2. Verify browser cookie settings
3. Ensure proper SettingsProvider setup
4. Check for cookie size limits

### Issue: Settings Not Updating UI
**Symptoms**: Settings changes not reflected in the interface
**Solutions**:
1. Clear browser cache and cookies
2. Check for conflicting CSS overrides
3. Verify theme provider integration
4. Ensure proper component re-rendering

### Issue: Page Settings Not Resetting
**Symptoms**: Page-specific settings persisting after navigation
**Solutions**:
1. Check cleanup function implementation
2. Verify useEffect dependencies
3. Ensure proper component unmounting
4. Check for memory leaks

### Issue: Customizer Not Working
**Symptoms**: Customizer changes not applying
**Solutions**:
1. Check SettingsProvider context
2. Verify useSettings hook usage
3. Ensure proper event handling
4. Check for JavaScript errors

## Related Documentation

- [Theming Guide](./THEMING_GUIDE.md) - Theme customization and styling
- [Vertical Layout](./VERTICAL_LAYOUT.md) - Vertical layout components
- [Menu Customization](./MENU_CUSTOMIZATION.md) - Menu customization
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Environment configuration

---
**Sources**: 
- [Theme Configurations Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/settings/theme-configurations)
- [Settings Context Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/settings/settings-context)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
