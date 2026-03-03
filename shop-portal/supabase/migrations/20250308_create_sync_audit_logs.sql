-- Create sync_audit_logs table for tracking sync operations
-- This table tracks all sync operations (full sync, incremental, single product) per connection

CREATE TABLE IF NOT EXISTS public.sync_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'single_product', 'bulk'
  sync_direction VARCHAR(20) NOT NULL, -- 'from_shoprenter', 'to_shoprenter'
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255),
  
  -- Sync statistics
  total_products INTEGER DEFAULT 0,
  synced_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Status
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed', 'stopped'
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- {forceSync: true, batchSize: 200, etc.}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_audit_connection ON public.sync_audit_logs(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_user ON public.sync_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_status ON public.sync_audit_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_type ON public.sync_audit_logs(sync_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.sync_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view sync logs for connections they have access to
DROP POLICY IF EXISTS "Sync audit logs are viewable by authenticated users" ON public.sync_audit_logs;
CREATE POLICY "Sync audit logs are viewable by authenticated users" ON public.sync_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = sync_audit_logs.connection_id
      AND wc.deleted_at IS NULL
    )
  );

-- Only users with /connections page permission can insert/update sync logs
DROP POLICY IF EXISTS "Only admins can manage sync audit logs" ON public.sync_audit_logs;
CREATE POLICY "Only admins can manage sync audit logs" ON public.sync_audit_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/connections' 
      AND up.can_access = true
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.sync_audit_logs TO authenticated;

-- Add comments
COMMENT ON TABLE public.sync_audit_logs IS 'Audit log for all sync operations (full sync, incremental, single product)';
COMMENT ON COLUMN public.sync_audit_logs.sync_type IS 'Type of sync: full, incremental, single_product, bulk';
COMMENT ON COLUMN public.sync_audit_logs.sync_direction IS 'Direction: from_shoprenter (pull) or to_shoprenter (push)';
COMMENT ON COLUMN public.sync_audit_logs.metadata IS 'Additional sync metadata: {forceSync: true, batchSize: 200, etc.}';
