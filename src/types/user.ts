export interface User {
  id: string
  email: string
  full_name?: string
  phone?: string
  role: 'admin' | 'user' | 'manager'
  is_active: boolean
  created_at: string
  updated_at: string
  last_sign_in_at?: string
}

export interface CreateUserRequest {
  email: string
  password: string
  full_name?: string
  phone?: string
  role: 'admin' | 'user' | 'manager'
  is_active?: boolean
}

export interface UpdateUserRequest {
  email?: string
  full_name?: string
  phone?: string
  role?: 'admin' | 'user' | 'manager'
  is_active?: boolean
}

export interface UserFilters {
  search?: string
  role?: string
  is_active?: boolean
}
