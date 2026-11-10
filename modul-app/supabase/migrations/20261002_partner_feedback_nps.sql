-- Partner visszajelzés → valódi NPS (0–10) + mindig elérhető javaslat
-- Docs: 54-partner-feedback-ux.md
-- Előfeltétel: 20260930_partner_product_feedback.sql, 20261001_partner_feedback_tags.sql

-- kind: nps (pontszám kötelező) / suggestion (pontszám nincs)
alter table public.partner_product_feedback
  add column if not exists kind text not null default 'nps',
  add column if not exists updated_at timestamptz not null default now();

alter table public.partner_product_feedback
  alter column score drop not null;

alter table public.partner_product_feedback
  drop constraint if exists partner_product_feedback_score_check;
alter table public.partner_product_feedback
  add constraint partner_product_feedback_score_check
  check (score is null or (score >= 0 and score <= 10));

alter table public.partner_product_feedback
  drop constraint if exists partner_product_feedback_kind_check;
alter table public.partner_product_feedback
  add constraint partner_product_feedback_kind_check
  check (
    (kind = 'nps' and score is not null)
    or (kind = 'suggestion' and score is null)
  );

-- Fiók törlésekor a visszajelzés megmarad (név nélkül)
alter table public.partner_product_feedback
  alter column partner_user_id drop not null;
alter table public.partner_product_feedback
  drop constraint if exists partner_product_feedback_partner_user_id_fkey;
alter table public.partner_product_feedback
  add constraint partner_product_feedback_partner_user_id_fkey
  foreign key (partner_user_id)
  references public.partner_profiles (user_id)
  on delete set null;

create index if not exists partner_product_feedback_partner_kind_created_idx
  on public.partner_product_feedback (partner_user_id, kind, created_at desc);

create index if not exists partner_product_feedback_kind_created_idx
  on public.partner_product_feedback (kind, created_at desc);

comment on column public.partner_product_feedback.kind is
  'nps = 0–10 ajánlási kérdés (90 naponta); suggestion = szabad javaslat (bármikor).';

-- Partner a saját sorát 24 órán belül frissítheti (pontszám javítás, szöveg hozzáadás)
drop policy if exists partner_product_feedback_update_own_recent
  on public.partner_product_feedback;
create policy partner_product_feedback_update_own_recent
  on public.partner_product_feedback
  for update
  to authenticated
  using (
    partner_user_id = auth.uid()
    and created_at > now() - interval '24 hours'
  )
  with check (
    partner_user_id = auth.uid()
    and created_at > now() - interval '24 hours'
  );
