-- Add optional page links to home_news_posts (safe if table already exists without them).

ALTER TABLE public.home_news_posts
  ADD COLUMN IF NOT EXISTS link_url text NULL,
  ADD COLUMN IF NOT EXISTS link_label text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'home_news_posts_link_url_len'
  ) THEN
    ALTER TABLE public.home_news_posts
      ADD CONSTRAINT home_news_posts_link_url_len
      CHECK (link_url IS NULL OR char_length(link_url) <= 300);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'home_news_posts_link_label_len'
  ) THEN
    ALTER TABLE public.home_news_posts
      ADD CONSTRAINT home_news_posts_link_label_len
      CHECK (link_label IS NULL OR char_length(link_label) <= 80);
  END IF;
END $$;

COMMENT ON COLUMN public.home_news_posts.link_url IS 'Internal path (/opti) or https URL';
COMMENT ON COLUMN public.home_news_posts.link_label IS 'Optional CTA label, e.g. Opti megnyitása';
