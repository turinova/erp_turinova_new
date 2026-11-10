-- Partnerportál: Google értékelés kérése a kezdőlapon (docs/55)
-- tenant_review_settings.partner_portal_enabled + partner_review_prompts (partnerenként, boltonként)

alter table public.tenant_review_settings
  add column if not exists partner_portal_enabled boolean not null default true;

comment on column public.tenant_review_settings.partner_portal_enabled is
  'Partnerportál kezdőlap: Google értékelés kártya a kapcsolt partnereknek.';

create table if not exists public.partner_review_prompts (
  partner_user_id uuid not null references public.partner_profiles (user_id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  clicked_at timestamptz,
  self_reported_at timestamptz,
  dismissed_at timestamptz,
  dismiss_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_user_id, tenant_id),
  constraint partner_review_prompts_dismiss_count_check check (dismiss_count >= 0)
);

comment on table public.partner_review_prompts is
  'Partner kezdőlap Google értékelés kártya állapota: kattintás, „Már írtam”, „Most nem”.';

create index if not exists partner_review_prompts_tenant_idx
  on public.partner_review_prompts (tenant_id);

alter table public.partner_review_prompts enable row level security;

drop policy if exists partner_review_prompts_select on public.partner_review_prompts;
create policy partner_review_prompts_select
  on public.partner_review_prompts
  for select
  to authenticated
  using (
    partner_user_id = auth.uid()
    or public.is_tenant_member(tenant_id)
    or public.is_platform_admin()
  );

drop policy if exists partner_review_prompts_insert_own on public.partner_review_prompts;
create policy partner_review_prompts_insert_own
  on public.partner_review_prompts
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

drop policy if exists partner_review_prompts_update_own on public.partner_review_prompts;
create policy partner_review_prompts_update_own
  on public.partner_review_prompts
  for update
  to authenticated
  using (partner_user_id = auth.uid())
  with check (partner_user_id = auth.uid());
