'use client'

import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionContext'
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
    
    // Find first permitted page
    const firstAllowed = permissions.find(p => p.can_access === true)
    const redirectPath = firstAllowed?.page_path || '/login'
    
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

