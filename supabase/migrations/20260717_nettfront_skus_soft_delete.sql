-- Soft delete for nettfront_skus

ALTER TABLE public.nettfront_skus
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_nettfront_skus_deleted_at
  ON public.nettfront_skus (deleted_at)
  WHERE deleted_at IS NULL;
