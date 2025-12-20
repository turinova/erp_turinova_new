'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Hook to manage navigation state and prevent double-clicks
 * Prevents multiple navigation attempts while one is in progress
 */
export function useNavigationState() {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  const navigate = useCallback(async (path: string) => {
    // Prevent double-clicks - if already navigating, ignore
    if (isNavigating) {
      return
    }
    
    setIsNavigating(true)
    try {
      router.push(path)
      // Reset after navigation starts (not completes) to allow new navigation
      // Use a short timeout to prevent rapid successive clicks
      setTimeout(() => {
        setIsNavigating(false)
      }, 500)
    } catch (error) {
      // Reset immediately on error
      setIsNavigating(false)
      console.error('Navigation error:', error)
      throw error
    }
  }, [router, isNavigating])

  return { navigate, isNavigating }
}

