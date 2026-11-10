-- Partner visszajelzés: címkék (mi hiányzik) + látott kérdésváltozat
-- Docs: 54-partner-feedback-ux.md

alter table public.partner_product_feedback
  add column if not exists tags text[] not null default '{}',
  add column if not exists prompt_variant text;

alter table public.partner_product_feedback
  drop constraint if exists partner_product_feedback_prompt_variant_check;
alter table public.partner_product_feedback
  add constraint partner_product_feedback_prompt_variant_check
  check (prompt_variant is null or prompt_variant in ('low', 'mid', 'high'));

create index if not exists partner_product_feedback_tags_gin_idx
  on public.partner_product_feedback using gin (tags);

comment on column public.partner_product_feedback.tags is
  'Választott címkék (feedback-copy.ts FEEDBACK_TAGS id-k).';
comment on column public.partner_product_feedback.prompt_variant is
  'Pontszám szerinti követő kérdés: low (1–6) / mid (7–8) / high (9–10).';
