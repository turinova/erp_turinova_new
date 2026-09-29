-- CSO átvehető SMS sablon kulcs (tenant_sms_templates + ledger)

alter table public.tenant_sms_templates
  drop constraint if exists tenant_sms_templates_key_check;

alter table public.tenant_sms_templates
  add constraint tenant_sms_templates_key_check
  check (template_key in ('quote_ready', 'cso_ready'));

alter table public.sms_send_events
  drop constraint if exists sms_send_events_template_check;

alter table public.sms_send_events
  add constraint sms_send_events_template_check
  check (template_key in ('quote_ready', 'cso_ready'));

comment on table public.tenant_sms_templates is
  'Tenant SMS sablonok (quote_ready, cso_ready).';

-- CSO tenantek is elérhessék a közös SMS beállítások oldalt
insert into public.product_plan_features (plan_id, feature_key)
select p.id, '/beallitasok/sms'
from public.product_plans p
where p.key = 'alap'
  and exists (
    select 1 from public.product_features f where f.key = '/beallitasok/sms'
  )
on conflict do nothing;

insert into public.tenant_entitlements (tenant_id, feature_key)
select t.id, '/beallitasok/sms'
from public.tenants t
where exists (
  select 1
  from public.tenant_entitlements e
  where e.tenant_id = t.id
    and e.feature_key = 'customer_special_orders'
)
on conflict do nothing;

insert into public.tenant_membership_page_access (
  tenant_id, membership_id, page_key, can_access
)
select m.tenant_id, m.id, '/beallitasok/sms', true
from public.tenant_memberships m
where exists (
  select 1
  from public.tenant_entitlements e
  where e.tenant_id = m.tenant_id
    and e.feature_key = 'customer_special_orders'
)
on conflict (membership_id, page_key) do update
set can_access = true, updated_at = now();
