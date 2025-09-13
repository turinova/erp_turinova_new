'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'

export interface UserPermissions {
  id: string
  user_id: string
  page_access: string[]
  is_super_user: boolean
  created_at: string
  updated_at: string
}

export interface AuthUser extends User {
  permissions?: UserPermissions
}

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  hasPermission: (page: string) => boolean
  isSuperUser: () => boolean
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user permissions from database
  const fetchUserPermissions = async (userId: string): Promise<UserPermissions | null> => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching user permissions:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user permissions:', error)
      return null
    }
  }

  // Check if user has permission to access a specific page
  const hasPermission = (page: string): boolean => {
    if (!user?.permissions) return false
    
    // Super users have access to everything
    if (user.permissions.is_super_user) return true
    
    // Check if page is in user's allowed pages
    return user.permissions.page_access.includes(page)
  }

  // Check if user is super user
  const isSuperUser = (): boolean => {
    return user?.permissions?.is_super_user || false
  }

  // Refresh user permissions
  const refreshPermissions = async (): Promise<void> => {
    if (!user) return

    try {
      const permissions = await fetchUserPermissions(user.id)
      if (permissions) {
        setUser(prev => prev ? { ...prev, permissions } : null)
      }
    } catch (error) {
      console.error('Error refreshing permissions:', error)
    }
  }

  // Sign in function
  const signIn = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        // Fetch user permissions
        const permissions = await fetchUserPermissions(data.user.id)
        setUser({ ...data.user, permissions: permissions || undefined })
        setSession(data.session)
      }

      return { error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: error as AuthError }
    }
  }

  // Sign out function
  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      toast.success('Sikeres kijelentkezés!')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Kijelentkezés sikertelen')
    }
  }

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setLoading(false)
          return
        }

        if (session?.user) {
          // Fetch user permissions
          const permissions = await fetchUserPermissions(session.user.id)
          setUser({ ...session.user, permissions: permissions || undefined })
          setSession(session)
        }

        setLoading(false)
      } catch (error) {
        console.error('Error initializing auth:', error)
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const permissions = await fetchUserPermissions(session.user.id)
          setUser({ ...session.user, permissions: permissions || undefined })
          setSession(session)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    hasPermission,
    isSuperUser,
    refreshPermissions,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
