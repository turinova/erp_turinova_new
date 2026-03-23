-- Durable sync job records for ShopRenter product pull sync (and future sync types).
-- Survives server restarts: progress is polled from sync_jobs when in-memory store is empty.

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  audit_log_id UUID REFERENCES public.sync_audit_logs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  sync_mode VARCHAR(20) NOT NULL DEFAULT 'incremental', -- 'full' | 'incremental'
  sync_direction VARCHAR(30) NOT NULL DEFAULT 'from_shoprenter',
  status VARCHAR(20) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'stopped'
  total_units INTEGER NOT NULL DEFAULT 0,
  synced_units INTEGER NOT NULL DEFAULT 0,
  error_units INTEGER NOT NULL DEFAULT 0,
  current_batch INTEGER,
  total_batches INTEGER,
  batch_progress INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection_status
  ON public.sync_jobs(connection_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_audit
  ON public.sync_jobs(audit_log_id);

DROP TRIGGER IF EXISTS trg_sync_jobs_updated_at ON public.sync_jobs;
CREATE TRIGGER trg_sync_jobs_updated_at
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sync jobs viewable for accessible connections" ON public.sync_jobs;
CREATE POLICY "Sync jobs viewable for accessible connections" ON public.sync_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = sync_jobs.connection_id
      AND wc.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Sync jobs manageable with connections permission" ON public.sync_jobs;
CREATE POLICY "Sync jobs manageable with connections permission" ON public.sync_jobs
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid()
      AND p.path = '/connections'
      AND up.can_access = true
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.sync_jobs TO authenticated;

COMMENT ON TABLE public.sync_jobs IS 'Durable sync job progress (product pull, etc.) for UI polling across server instances';
