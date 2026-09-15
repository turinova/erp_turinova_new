-- Fee types + quote fees: egység (units) kötés és snapshot.

-- 1) fee_types.unit_id (először nullable, backfill, majd NOT NULL)
alter table public.fee_types
  add column if not exists unit_id uuid references public.units (id);

-- Tenantokhoz „db” egység, ha még nincs
insert into public.units (tenant_id, name, shortform)
select t.id, 'Darab', 'db'
from public.tenants t
where not exists (
  select 1
  from public.units u
  where u.tenant_id = t.id
    and lower(u.shortform) = 'db'
    and u.deleted_at is null
);

-- Meglévő díjtípusok → tenant „db” egység
update public.fee_types ft
set unit_id = u.id
from public.units u
where ft.unit_id is null
  and u.tenant_id = ft.tenant_id
  and lower(u.shortform) = 'db'
  and u.deleted_at is null;

-- Ha még mindig null (nincs db shortform), első élő egység
update public.fee_types ft
set unit_id = (
  select u.id
  from public.units u
  where u.tenant_id = ft.tenant_id
    and u.deleted_at is null
  order by u.created_at asc
  limit 1
)
where ft.unit_id is null;

alter table public.fee_types
  alter column unit_id set not null;

create index if not exists fee_types_unit_alive_idx
  on public.fee_types (unit_id)
  where deleted_at is null;

comment on column public.fee_types.unit_id is 'Egység (Ft / egység); UI bruttót szerkeszt';
comment on column public.fee_types.price_net is 'Nettó Ft / egység; UI bruttót szerkeszt';

-- 2) quote_fees snapshot
alter table public.quote_fees
  add column if not exists unit_id uuid references public.units (id),
  add column if not exists unit_shortform text;

update public.quote_fees qf
set
  unit_id = coalesce(qf.unit_id, ft.unit_id),
  unit_shortform = coalesce(
    nullif(trim(qf.unit_shortform), ''),
    u.shortform,
    'db'
  )
from public.fee_types ft
left join public.units u on u.id = ft.unit_id
where qf.fee_type_id = ft.id
  and (qf.unit_shortform is null or trim(qf.unit_shortform) = '');

update public.quote_fees
set unit_shortform = 'db'
where unit_shortform is null or trim(unit_shortform) = '';

alter table public.quote_fees
  alter column unit_shortform set not null,
  alter column unit_shortform set default 'db';

comment on column public.quote_fees.unit_shortform is 'Egység rövidítés snapshot (PDF / lista)';
comment on column public.quote_fees.unit_id is 'Opcionális FK a snapshot idején élő egységre';
