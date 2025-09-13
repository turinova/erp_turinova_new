// Permission system types

export interface Page {
  id: string
  path: string
  name: string
  description?: string
  category: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserPermission {
  id: string
  user_id: string
  page_id: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  created_at: string
  updated_at: string
}

export interface UserPermissionWithPage extends UserPermission {
  page: Page
}

export interface PermissionMatrix {
  page_path: string
  page_name: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface UpdateUserPermissionsRequest {
  user_id: string
  permissions: {
    page_id: string
    can_view: boolean
    can_edit: boolean
    can_delete: boolean
  }[]
}

export interface PermissionCheck {
  page_path: string
  permission_type: 'view' | 'edit' | 'delete'
  has_permission: boolean
}

// Permission categories for organization
export const PERMISSION_CATEGORIES = {
  GENERAL: 'Általános',
  MASTER_DATA: 'Törzsadatok', 
  SYSTEM: 'Rendszer',
  TOOLS: 'Eszközök'
} as const

export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES]
