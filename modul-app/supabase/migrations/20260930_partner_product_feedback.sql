-- Partner szoftver-visszajelzés (home 1–10 csillag) + prompt snooze mezők
-- Docs: 54-partner-feedback-ux.md

alter table public.partner_profiles
  add column if not exists product_feedback_dismissed_at timestamptz,
  add column if not exists product_feedback_dismiss_count integer not null default 0;

comment on column public.partner_profiles.product_feedback_dismissed_at is
  'Utolsó „Most nem” a szoftver-visszajelzés kártyán.';
comment on column public.partner_profiles.product_feedback_dismiss_count is
  'Hányszor utasította el a szoftver-visszajelzést (snooze: 14 / 30 nap).';

create table if not exists public.partner_product_feedback (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references public.partner_profiles (user_id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  score smallint not null,
  comment text,
  source text not null default 'partner_home_v1',
  user_agent text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint partner_product_feedback_score_check check (score >= 1 and score <= 10)
);

create index if not exists partner_product_feedback_created_idx
  on public.partner_product_feedback (created_at desc);

create index if not exists partner_product_feedback_partner_created_idx
  on public.partner_product_feedback (partner_user_id, created_at desc);

create index if not exists partner_product_feedback_unreviewed_idx
  on public.partner_product_feedback (created_at desc)
  where reviewed_at is null;

comment on table public.partner_product_feedback is
  'Partner portal szoftver-visszajelzés (1–10). Platform inbox: /platform/visszajelzesek.';

alter table public.partner_product_feedback enable row level security;

drop policy if exists partner_product_feedback_insert_own on public.partner_product_feedback;
create policy partner_product_feedback_insert_own
  on public.partner_product_feedback
  for insert
  to authenticated
  with check (
    partner_user_id = auth.uid()
    and exists (
      select 1
      from public.partner_profiles p
      where p.user_id = auth.uid()
        and p.status = 'active'
    )
  );

drop policy if exists partner_product_feedback_select_own_or_admin
  on public.partner_product_feedback;
create policy partner_product_feedback_select_own_or_admin
  on public.partner_product_feedback
  for select
  to authenticated
  using (
    partner_user_id = auth.uid()
    or public.is_platform_admin()
  );

drop policy if exists partner_product_feedback_update_admin
  on public.partner_product_feedback;
create policy partner_product_feedback_update_admin
  on public.partner_product_feedback
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
