-- Add indexes for permission system performance
-- These indexes are crucial for speeding up permission checks

-- Index for user_permissions table - most important for permission checks
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page_id ON user_permissions(page_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_page ON user_permissions(user_id, page_id);

-- Composite index for admin check (user_id + page_id + can_edit)
CREATE INDEX IF NOT EXISTS idx_user_permissions_admin_check ON user_permissions(user_id, page_id, can_edit);

-- Index for pages table
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);
CREATE INDEX IF NOT EXISTS idx_pages_active ON pages(is_active);

-- Composite index for pages (path + is_active)
CREATE INDEX IF NOT EXISTS idx_pages_path_active ON pages(path, is_active);

-- Update statistics for better query planning
ANALYZE user_permissions;
ANALYZE pages;
