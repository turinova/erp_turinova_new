import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Database-based navigation filtering
export function useDatabaseNavigation() {
  const { user } = useAuth()
  const [filteredMenu, setFilteredMenu] = useState<VerticalMenuDataType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const filterMenu = async () => {
      if (!user?.id) {
        setFilteredMenu([])
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/permissions/simple/user/${user.id}`)
        
        if (!response.ok) {
          console.error('Failed to fetch permissions')
          setFilteredMenu([])
          setLoading(false)
          return
        }

        const data = await response.json()
        const permissions = data.permissions || []
        
        // Create a map of page paths to access permissions
        const permissionMap = new Map()
        permissions.forEach((p: any) => {
          permissionMap.set(p.page_path, p.can_access)
        })
        
        const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
          return items.filter(item => {
            // If item has children, filter children first
            if (item.children) {
              const filteredChildren = filterMenuItems(item.children)
              return filteredChildren.length > 0
            }
            
            // Check database permission for this page
            if (item.href) {
              // Always allow home
              if (item.href === '/home') return true
              
              // Check database permission for this page
              const hasAccess = permissionMap.get(item.href)
              return hasAccess === true
            }
            
            return true // Show items without href
          }).map(item => ({
            ...item,
            children: item.children ? filterMenuItems(item.children) : undefined
          }))
        }
        
        setFilteredMenu(filterMenuItems(verticalMenuData()))
      } catch (error) {
        console.error('Error filtering menu:', error)
        setFilteredMenu([])
      } finally {
        setLoading(false)
      }
    }

    filterMenu()
  }, [user?.id])

  return filteredMenu
}
