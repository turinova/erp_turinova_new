// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'
import 'react-toastify/dist/ReactToastify.css'

// Type Imports
import type { ChildrenType } from '@core/types'

// Component Imports
import { ToastContainer } from 'react-toastify'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'

// Style Imports
import './globals.css'

// Generated Icon CSS Imports (commented out - generate if needed)
// import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  title: 'Turinova Admin Portal',
  description: 'Turinova Admin Portal - SaaS Management',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
}

const RootLayout = async (props: ChildrenType) => {
  const { children } = props

  const systemMode = await getSystemMode()
  const direction = 'ltr'

  return (
    <html id='__next' lang='en' dir={direction} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Global debug script - runs IMMEDIATELY on page load
            (function() {
              const timestamp = new Date().toISOString();
              console.warn('🔵 [ROOT LAYOUT] LOADED AT:', timestamp);
              console.warn('🔵 [ROOT LAYOUT] Current URL:', window.location.href);
              console.warn('🔵 [ROOT LAYOUT] Pathname:', window.location.pathname);
              
              // Store initial URL
              window.__INITIAL_URL__ = window.location.href;
              window.__INITIAL_PATHNAME__ = window.location.pathname;
              
              // Intercept navigation
              const originalPushState = history.pushState;
              const originalReplaceState = history.replaceState;
              
              history.pushState = function(...args) {
                console.error('🔴 [NAVIGATION] pushState called:', args[2]);
                console.error('🔴 [NAVIGATION] From:', window.location.pathname, 'To:', args[2]);
                console.trace('🔴 [NAVIGATION] Stack trace:');
                return originalPushState.apply(this, args);
              };
              
              history.replaceState = function(...args) {
                console.error('🔴 [NAVIGATION] replaceState called:', args[2]);
                console.error('🔴 [NAVIGATION] From:', window.location.pathname, 'To:', args[2]);
                console.trace('🔴 [NAVIGATION] Stack trace:');
                return originalReplaceState.apply(this, args);
              };
              
              // Track popstate (back/forward)
              window.addEventListener('popstate', function(e) {
                console.error('🔴 [NAVIGATION] popstate event:', window.location.pathname);
              });
              
              // Log when DOM is ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                  console.warn('🔵 [ROOT LAYOUT] DOM Ready. Final URL:', window.location.href);
                  if (window.location.pathname !== window.__INITIAL_PATHNAME__) {
                    console.error('🔴🔴🔴 [REDIRECT DETECTED] Initial:', window.__INITIAL_PATHNAME__, '→ Current:', window.location.pathname);
                  }
                });
              } else {
                console.warn('🔵 [ROOT LAYOUT] DOM already ready. URL:', window.location.href);
              }
            })();
          `
        }} />
      </head>
      <body className='flex is-full min-bs-full flex-auto flex-col'>
        <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
        {children}
        <ToastContainer position="top-right" autoClose={3000} />
      </body>
    </html>
  )
}

export default RootLayout

