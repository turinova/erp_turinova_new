'use client'

import { createContext, useContext } from 'react'

interface PermissionContextType {
  canAccess: (path: string) => boolean
  loading: boolean
  allowedPaths: string[]
}

const PermissionContext = createContext<PermissionContextType>({
  canAccess: () => true,
  loading: false,
  allowedPaths: []
})

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  // Admin portal has no permission restrictions - all admins can access everything
  const value: PermissionContextType = {
    canAccess: () => true,
    loading: false,
    allowedPaths: ['/home', '/companies']
  }

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionContext)
}

