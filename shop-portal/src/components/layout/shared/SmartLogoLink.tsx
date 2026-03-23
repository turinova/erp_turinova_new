'use client'

import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionContext'
import { resolveLandingPageFromPermissions } from '@/lib/auth-redirect'
import Logo from './Logo'

/**
 * Smart Logo Link Component
 * Redirects to the first page the user has permission to access
 * Falls back to /login if no permissions
 */
const SmartLogoLink = () => {
  const router = useRouter()
  const { permissions } = usePermissions()

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    const redirectPath = resolveLandingPageFromPermissions(permissions)
    
    console.log('[LOGO] Redirecting to first permitted page:', redirectPath)
    router.push(redirectPath)
  }

  return (
    <a 
      href="#" 
      onClick={handleLogoClick}
      style={{ cursor: 'pointer', textDecoration: 'none' }}
    >
      <Logo />
    </a>
  )
}

export default SmartLogoLink

