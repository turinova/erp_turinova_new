'use client'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { useSettings } from '@core/hooks/useSettings'

const Logo = () => {
  // Hooks
  const { isHovered, isBreakpointReached } = useVerticalNav()
  const { settings } = useSettings()

  // Vars
  const { layout } = settings
  const isCollapsed = !isBreakpointReached && layout === 'collapsed' && !isHovered

  return (
    <div className='flex items-center min-bs-[24px]'>
      {isCollapsed ? (
        <img 
          src='/images/turinova-small-icon.png' 
          alt='Turinova Icon' 
          style={{ height: '32px', width: '32px', objectFit: 'contain' }}
        />
      ) : (
        <img 
          src='/images/turinova-logo.png' 
          alt='Turinova Logo' 
          style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
        />
      )}
    </div>
  )
}

export default Logo
