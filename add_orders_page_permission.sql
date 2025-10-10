-- =============================================================================
-- ADD ORDERS PAGE TO PAGES TABLE
-- =============================================================================
-- Description: Add /orders page for permission system
-- Created: 2025-01-28
-- =============================================================================

-- Insert /orders page
INSERT INTO pages (path, name, description, category, is_active)
VALUES (
  '/orders',
  'Megrendelések',
  'Megrendelések kezelése és követése',
  'Eszközök',
  true
)
ON CONFLICT (path) DO UPDATE
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify
SELECT * FROM pages WHERE path = '/orders';

