-- Home page news / announcements (Hírek/Feladatok)
-- Read on /home; writes gated by PIN in main-app API.

CREATE TABLE IF NOT EXISTS public.home_news_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NULL,
  kind text NOT NULL DEFAULT 'news',
  link_url text NULL,
  link_label text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_news_posts_pkey PRIMARY KEY (id),
  CONSTRAINT home_news_posts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT home_news_posts_title_len CHECK (char_length(title) <= 120),
  CONSTRAINT home_news_posts_body_len CHECK (body IS NULL OR char_length(body) <= 800),
  CONSTRAINT home_news_posts_link_url_len CHECK (link_url IS NULL OR char_length(link_url) <= 300),
  CONSTRAINT home_news_posts_link_label_len CHECK (link_label IS NULL OR char_length(link_label) <= 80),
  CONSTRAINT home_news_posts_kind_check CHECK (kind IN ('news', 'task'))
);

CREATE INDEX IF NOT EXISTS idx_home_news_posts_active_created
  ON public.home_news_posts (created_at DESC)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS update_home_news_posts_updated_at ON public.home_news_posts;
CREATE TRIGGER update_home_news_posts_updated_at
  BEFORE UPDATE ON public.home_news_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.home_news_posts IS 'CEO announcements shown on main-app /home (Hírek/Feladatok)';
COMMENT ON COLUMN public.home_news_posts.link_url IS 'Internal path (/opti) or https URL';
COMMENT ON COLUMN public.home_news_posts.link_label IS 'Optional CTA label, e.g. Opti megnyitása';
