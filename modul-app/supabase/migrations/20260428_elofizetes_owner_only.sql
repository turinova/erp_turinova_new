-- Előfizetés oldal: csak tenant owner page_access
-- (admin/member/viewer ne lássa a menüben / gate-en sem)

update public.tenant_membership_page_access pa
set
  can_access = false,
  updated_at = now()
from public.tenant_memberships m
where pa.membership_id = m.id
  and pa.page_key = '/beallitasok/elofizetes'
  and m.role <> 'owner';

-- Biztosítsuk, hogy minden ownernek legyen access (ha még nincs)
insert into public.tenant_membership_page_access (
  tenant_id,
  membership_id,
  page_key,
  can_access
)
select
  m.tenant_id,
  m.id,
  '/beallitasok/elofizetes',
  true
from public.tenant_memberships m
where m.role = 'owner'
on conflict (membership_id, page_key) do update
set
  can_access = true,
  updated_at = now();
