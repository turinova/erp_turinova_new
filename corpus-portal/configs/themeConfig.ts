/*
 * Turinova ERP Theme Configuration
 * 
 * Note: Mode is fixed to 'light' for professional appearance
 * Other settings can be customized through the customizer panel
 */

// Type Imports
import type { Mode, Skin, Layout, LayoutComponentPosition, LayoutComponentWidth } from '@core/types'

type Navbar = {
  type: LayoutComponentPosition
  contentWidth: LayoutComponentWidth
  floating: boolean
  detached: boolean
  blur: boolean
}

type Footer = {
  type: LayoutComponentPosition
  contentWidth: LayoutComponentWidth
  detached: boolean
}

export type Config = {
  templateName: string
  homePageUrl: string
  settingsCookieName: string
  mode: Mode
  skin: Skin
  semiDark: boolean
  layout: Layout
  layoutPadding: number
  navbar: Navbar
  contentWidth: LayoutComponentWidth
  compactContentWidth: number
  footer: Footer
  disableRipple: boolean
}

const themeConfig: Config = {
  templateName: 'Turinova ERP',
  homePageUrl: '/home',
  settingsCookieName: 'turinova-erp-settings',
  mode: 'light', // Fixed to light mode for Turinova ERP
  skin: 'bordered', // 'default', 'bordered'
  semiDark: false, // true, false
  layout: 'horizontal', // 'vertical', 'collapsed', 'horizontal'
  layoutPadding: 24, // Common padding for header, content, footer layout components (in px)
  compactContentWidth: 1440, // in px
  navbar: {
    type: 'fixed', // 'fixed', 'static'
    contentWidth: 'compact', // 'compact', 'wide'
    floating: false, //! true, false (This will not work in the Horizontal Layout)
    detached: false, //! true, false (This will not work in the Horizontal Layout or floating navbar is enabled)
    blur: true // true, false
  },
  contentWidth: 'compact', // 'compact', 'wide'
  footer: {
    type: 'static', // 'fixed', 'static'
    contentWidth: 'compact', // 'compact', 'wide'
    detached: false //! true, false (This will not work in the Horizontal Layout)
  },
  disableRipple: false // true, false
}

export default themeConfig
