-- Kiemelt partnerek lista — lapszabászat page_access meglévő tenantoknak.

insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  a.tenant_id,
  a.membership_id,
  '/kiemelt-partnerek',
  true
from public.tenant_membership_page_access a
where a.page_key = '/ajanlatok'
  and a.can_access = true
  and exists (
    select 1
    from public.tenant_entitlements e
    where e.tenant_id = a.tenant_id
      and e.feature_key = 'lapszabaszat'
  )
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
