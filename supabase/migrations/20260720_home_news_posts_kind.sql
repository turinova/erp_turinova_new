-- Distinguish news vs tasks on home announcements.

ALTER TABLE public.home_news_posts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'news';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'home_news_posts_kind_check'
  ) THEN
    ALTER TABLE public.home_news_posts
      ADD CONSTRAINT home_news_posts_kind_check
      CHECK (kind IN ('news', 'task'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_home_news_posts_kind_created
  ON public.home_news_posts (kind, created_at DESC)
  WHERE is_active = true;

COMMENT ON COLUMN public.home_news_posts.kind IS 'news = Hír, task = Feladat';
