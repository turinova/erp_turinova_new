-- =============================================================================
-- CLEANUP AND ENHANCE QUOTES - PART 1: Enum Updates
-- =============================================================================
-- Description: Add new status values to quote_status enum
-- Created: 2025-01-28
-- IMPORTANT: Run this FIRST, then run part 2
-- =============================================================================

-- =============================================================================
-- UPDATE QUOTE_STATUS ENUM TO INCLUDE ORDER STATUSES
-- =============================================================================

-- Add new status values to the enum if they don't exist
DO $$ 
BEGIN
  -- Add 'ordered' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ordered' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'ordered';
  END IF;
END $$;

DO $$ 
BEGIN
  -- Add 'in_production' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'in_production' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'in_production';
  END IF;
END $$;

DO $$ 
BEGIN
  -- Add 'ready' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ready' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'ready';
  END IF;
END $$;

DO $$ 
BEGIN
  -- Add 'finished' status
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'finished' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'finished';
  END IF;
END $$;

DO $$ 
BEGIN
  -- Add 'cancelled' status (optional, for future)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'cancelled' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- =============================================================================
-- PART 1 COMPLETE
-- =============================================================================
-- Next step: Run cleanup_and_enhance_quotes_part2.sql
-- =============================================================================

