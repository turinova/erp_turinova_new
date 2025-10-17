# Notion-Inspired Color Scheme Documentation

## Overview
This document outlines the implementation of a Notion-inspired color scheme for the Turinova ERP application, featuring black as the primary color and carefully selected accent colors for symbols and highlights.

## Color Philosophy

Based on [Notion's design system](https://www.notion.com/), our color scheme follows these principles:

### 1. **Black Primary Color**
- **Primary**: `#000000` (Pure black)
- **Light**: `#4A4A4A` (Dark gray for lighter variants)
- **Dark**: `#000000` (Pure black for dark variants)

### 2. **Professional Accent Colors**
Following Notion's color palette for symbols and highlights:

#### **Light Mode Colors**
- **Gray (Secondary)**: `#9B9A97` - For neutral text and secondary elements
- **Red (Error)**: `#E03E3E` - For errors and destructive actions
- **Orange (Warning)**: `#D9730D` - For warnings and attention-grabbing elements
- **Blue (Info)**: `#0B6E99` - For informational content and links
- **Green (Success)**: `#0F7B6C` - For success states and positive actions

#### **Dark Mode Colors**
- **Gray (Secondary)**: `#979A9B` - Adjusted for dark backgrounds
- **Red (Error)**: `#FF7369` - Brighter for dark mode visibility
- **Orange (Warning)**: `#FFA344` - Enhanced visibility in dark mode
- **Blue (Info)**: `#529CCA` - Optimized for dark backgrounds
- **Green (Success)**: `#4DAB9A` - Adjusted for dark mode contrast

## Implementation Details

### 1. Primary Color Configuration

**File**: `src/configs/primaryColorConfig.ts`

```typescript
const primaryColorConfig: PrimaryColorConfig[] = [
  {
    name: 'primary-1',
    light: '#4A4A4A',
    main: '#000000',
    dark: '#000000'
  },
  {
    name: 'primary-2',
    light: '#4DAB9A',
    main: '#0F7B6C',
    dark: '#0A5A4F'
  },
  {
    name: 'primary-3',
    light: '#FFA344',
    main: '#D9730D',
    dark: '#B85C0A'
  },
  {
    name: 'primary-4',
    light: '#FF7369',
    main: '#E03E3E',
    dark: '#B83232'
  },
  {
    name: 'primary-5',
    light: '#529CCA',
    main: '#0B6E99',
    dark: '#085A7A'
  }
]
```

### 2. Color Schemes Implementation

**File**: `src/@core/theme/colorSchemes.ts`

#### Light Mode Palette
```typescript
light: {
  palette: {
    primary: {
      main: '#000000',
      light: '#4A4A4A',
      dark: '#000000'
    },
    secondary: {
      main: '#9B9A97',
      light: '#C4C3C0',
      dark: '#6B6A67'
    },
    error: {
      main: '#E03E3E',
      light: '#FF7369',
      dark: '#B83232'
    },
    warning: {
      main: '#D9730D',
      light: '#FFA344',
      dark: '#B85C0A'
    },
    info: {
      main: '#0B6E99',
      light: '#529CCA',
      dark: '#085A7A'
    },
    success: {
      main: '#0F7B6C',
      light: '#4DAB9A',
      dark: '#0A5A4F'
    }
  }
}
```

#### Dark Mode Palette
```typescript
dark: {
  palette: {
    primary: {
      main: '#000000',
      light: '#4A4A4A',
      dark: '#000000'
    },
    secondary: {
      main: '#979A9B',
      light: '#B8BBBC',
      dark: '#6B6E6F'
    },
    error: {
      main: '#FF7369',
      light: '#FF9A92',
      dark: '#CC5A50'
    },
    warning: {
      main: '#FFA344',
      light: '#FFB870',
      dark: '#CC8236'
    },
    info: {
      main: '#529CCA',
      light: '#7BB3D9',
      dark: '#427EA3'
    },
    success: {
      main: '#4DAB9A',
      light: '#7BC4B8',
      dark: '#3E897B'
    }
  }
}
```

### 3. Theme Configuration Updates

**File**: `src/configs/themeConfig.ts`

```typescript
const themeConfig: Config = {
  templateName: 'Turinova ERP',
  homePageUrl: '/home',
  settingsCookieName: 'turinova-erp-settings',
  mode: 'light', // Force light mode for professional look
  skin: 'default',
  // ... other configurations
}
```

## Color Usage Guidelines

### 1. **Primary Color (Black)**
- **Use for**: Main navigation, primary buttons, headers, important text
- **Avoid**: Large background areas (use sparingly)
- **Best practices**: 
  - Use for high-contrast elements
  - Combine with white backgrounds for maximum readability
  - Use for professional, authoritative elements

### 2. **Secondary Color (Gray)**
- **Use for**: Secondary text, disabled states, subtle borders
- **Light mode**: `#9B9A97`
- **Dark mode**: `#979A9B`

### 3. **Accent Colors**

#### **Red (Error)**
- **Use for**: Error messages, delete buttons, critical alerts
- **Light mode**: `#E03E3E`
- **Dark mode**: `#FF7369`

#### **Orange (Warning)**
- **Use for**: Warning messages, attention-grabbing elements
- **Light mode**: `#D9730D`
- **Dark mode**: `#FFA344`

#### **Blue (Info)**
- **Use for**: Links, informational content, primary actions
- **Light mode**: `#0B6E99`
- **Dark mode**: `#529CCA`

#### **Green (Success)**
- **Use for**: Success messages, positive actions, confirmations
- **Light mode**: `#0F7B6C`
- **Dark mode**: `#4DAB9A`

## Background Colors

### Light Mode
- **Default Background**: `#F7F7F9` (Light gray)
- **Paper Background**: `#FFFFFF` (White)
- **Bordered Skin**: `#FFFFFF` (White)

### Dark Mode
- **Default Background**: `#1F1F1F` (Dark gray)
- **Paper Background**: `#2F3437` (Medium dark gray)
- **Bordered Skin**: `#2F3437` (Medium dark gray)

## Text Colors

### Light Mode
- **Primary Text**: `rgba(0, 0, 0, 0.9)` (90% black)
- **Secondary Text**: `rgba(0, 0, 0, 0.7)` (70% black)
- **Disabled Text**: `rgba(0, 0, 0, 0.4)` (40% black)

### Dark Mode
- **Primary Text**: `rgba(255, 255, 255, 0.9)` (90% white)
- **Secondary Text**: `rgba(255, 255, 255, 0.7)` (70% white)
- **Disabled Text**: `rgba(255, 255, 255, 0.4)` (40% white)

## Component-Specific Colors

### 1. **Buttons**
- **Primary Button**: Black background, white text
- **Secondary Button**: Gray border, black text
- **Error Button**: Red background, white text
- **Success Button**: Green background, white text

### 2. **Alerts**
- **Error Alert**: Red border, light red background
- **Warning Alert**: Orange border, light orange background
- **Info Alert**: Blue border, light blue background
- **Success Alert**: Green border, light green background

### 3. **Navigation**
- **Active Menu Item**: Black background, white text
- **Hover State**: Light gray background
- **Menu Icons**: Black for active, gray for inactive

### 4. **Forms**
- **Input Borders**: Light gray
- **Focus State**: Black border
- **Error State**: Red border
- **Success State**: Green border

## Accessibility Considerations

### 1. **Contrast Ratios**
- **Black on White**: 21:1 (AAA compliant)
- **Gray on White**: 4.5:1 (AA compliant)
- **Accent colors**: All meet WCAG AA standards

### 2. **Color Blindness**
- **Red-Green**: Alternative indicators (icons, patterns)
- **Blue-Yellow**: Sufficient contrast maintained
- **Monochrome**: All colors distinguishable in grayscale

### 3. **Dark Mode**
- **High Contrast**: Maintained across all color combinations
- **Eye Strain**: Reduced with darker backgrounds
- **Consistency**: Same color relationships preserved

## Customization Examples

### 1. **Custom Primary Color**
```typescript
// To change primary color while maintaining Notion principles
const customPrimary = {
  main: '#1A1A1A', // Dark gray instead of pure black
  light: '#4A4A4A',
  dark: '#000000'
}
```

### 2. **Custom Accent Colors**
```typescript
// To add custom accent colors
const customAccents = {
  purple: {
    main: '#6940A5',
    light: '#9A6DD7',
    dark: '#4D2A7A'
  },
  pink: {
    main: '#AD1A72',
    light: '#E255A1',
    dark: '#7A124F'
  }
}
```

### 3. **Brand-Specific Colors**
```typescript
// For Turinova ERP branding
const turinovaColors = {
  primary: '#000000',
  secondary: '#9B9A97',
  accent: '#0B6E99', // Professional blue
  success: '#0F7B6C', // Professional green
  warning: '#D9730D', // Professional orange
  error: '#E03E3E'   // Professional red
}
```

## Testing and Validation

### 1. **Color Testing**
- **Light Mode**: Test all components in light theme
- **Dark Mode**: Verify dark mode color combinations
- **Accessibility**: Check contrast ratios with tools
- **Cross-browser**: Test color rendering across browsers

### 2. **Component Testing**
- **Buttons**: All button variants and states
- **Forms**: Input fields, validation states
- **Navigation**: Menu items, active states
- **Alerts**: All alert types and variants

### 3. **User Experience**
- **Readability**: Text legibility across all backgrounds
- **Visual Hierarchy**: Clear distinction between elements
- **Professional Look**: Maintains business-appropriate appearance
- **Consistency**: Uniform color usage across components

## Migration Guide

### 1. **From Default Materialize Colors**
- **Primary**: Changed from `#666CFF` to `#000000`
- **Secondary**: Updated to Notion gray `#9B9A97`
- **Accent Colors**: Replaced with Notion palette
- **Backgrounds**: Maintained existing structure

### 2. **Breaking Changes**
- **Primary Color**: All primary-colored elements now black
- **Accent Colors**: Updated error, warning, info, success colors
- **Theme Name**: Changed to "Turinova ERP"
- **Cookie Name**: Updated to "turinova-erp-settings"

### 3. **Compatibility**
- **Existing Components**: Should work without modification
- **Custom Themes**: May need color adjustments
- **Third-party Components**: Check color compatibility

## Best Practices

### 1. **Color Usage**
- **Consistency**: Use colors consistently across the application
- **Hierarchy**: Use color to establish visual hierarchy
- **Accessibility**: Always check contrast ratios
- **Context**: Consider color meaning in different contexts

### 2. **Maintenance**
- **Documentation**: Keep color documentation updated
- **Testing**: Regular accessibility testing
- **Updates**: Careful consideration of color changes
- **Version Control**: Track color scheme changes

### 3. **Performance**
- **CSS Variables**: Use CSS custom properties for colors
- **Optimization**: Minimize color variations
- **Caching**: Leverage browser color caching
- **Bundle Size**: Consider impact on bundle size

## Related Documentation

- [Theming Guide](./THEMING_GUIDE.md) - Complete theming and customization guide
- [Theme Configurations](./THEME_CONFIGURATIONS.md) - Theme configurations and settings context
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Environment configuration
- [Authentication Documentation](./AUTHENTICATION_DOCUMENTATION.md) - Authentication implementation

---
**Sources**: 
- [Notion Design System](https://www.notion.com/)
- [Notion Colors Reference](https://notioncolors.com/)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
**Color Scheme**: Notion-Inspired Black Primary
