-- Insert the /shipments page to public.pages and ensure default permissions via trigger
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES ('/shipments', 'Szállítmányok', 'Shipments management (placeholder)', 'purchasing', true)
ON CONFLICT (path) DO NOTHING;

-- If your instance requires the trigger creation, make sure this exists:
-- create trigger on_public_page_created_or_activated
-- after insert or update of is_active on public.pages
-- for each row execute function handle_new_page_permissions();

-- Optional helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_pages_active ON public.pages USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_pages_path ON public.pages USING btree (path);
CREATE INDEX IF NOT EXISTS idx_pages_path_active ON public.pages USING btree (path, is_active);


