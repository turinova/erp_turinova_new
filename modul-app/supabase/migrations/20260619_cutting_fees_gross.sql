-- Opti díjak: bruttó forrásigazság (ÁFA round-trip, pl. 600 → ne legyen 599)
-- Nettó megmarad ÁFA-bázisnak; UI / egységár a *_gross oszlopból jön.

alter table public.cutting_fees
  add column if not exists fee_per_meter_gross numeric(10, 0);

alter table public.cutting_fees
  add column if not exists duplungolas_fee_per_sqm_gross numeric(10, 0);

alter table public.cutting_fees
  add column if not exists szogvagas_fee_per_panel_gross numeric(10, 0);

alter table public.cutting_fees
  add column if not exists panthelyfuras_fee_per_hole_gross numeric(10, 0);

comment on column public.cutting_fees.fee_per_meter_gross is
  'Vágási díj bruttó Ft/m — forrásigazság a megjelenítéshez / Opti egységárhoz.';
comment on column public.cutting_fees.duplungolas_fee_per_sqm_gross is
  'Duplungolás bruttó Ft/m² — forrásigazság.';
comment on column public.cutting_fees.szogvagas_fee_per_panel_gross is
  'Szögvágás bruttó Ft/panel — forrásigazság.';
comment on column public.cutting_fees.panthelyfuras_fee_per_hole_gross is
  'Pánthelyfúrás bruttó Ft/lyuk — forrásigazság.';

-- Backfill: meglévő nettó × ÁFA (eddigi UI viselkedés)
update public.cutting_fees cf
set
  fee_per_meter_gross = coalesce(
    fee_per_meter_gross,
    round(cf.fee_per_meter * (1 + coalesce(t.rate_percent, 0) / 100.0))
  ),
  duplungolas_fee_per_sqm_gross = coalesce(
    duplungolas_fee_per_sqm_gross,
    round(
      coalesce(cf.duplungolas_fee_per_sqm, 0)
      * (1 + coalesce(t.rate_percent, 0) / 100.0)
    )
  ),
  szogvagas_fee_per_panel_gross = coalesce(
    szogvagas_fee_per_panel_gross,
    round(
      coalesce(cf.szogvagas_fee_per_panel, 0)
      * (1 + coalesce(t.rate_percent, 0) / 100.0)
    )
  ),
  panthelyfuras_fee_per_hole_gross = coalesce(
    panthelyfuras_fee_per_hole_gross,
    round(
      coalesce(cf.panthelyfuras_fee_per_hole, 0)
      * (1 + coalesce(t.rate_percent, 0) / 100.0)
    )
  )
from public.tax_rates t
where t.id = cf.tax_rate_id
  and (
    cf.fee_per_meter_gross is null
    or cf.duplungolas_fee_per_sqm_gross is null
    or cf.szogvagas_fee_per_panel_gross is null
    or cf.panthelyfuras_fee_per_hole_gross is null
  );

update public.cutting_fees
set
  fee_per_meter_gross = coalesce(fee_per_meter_gross, round(fee_per_meter)),
  duplungolas_fee_per_sqm_gross = coalesce(
    duplungolas_fee_per_sqm_gross,
    round(coalesce(duplungolas_fee_per_sqm, 0))
  ),
  szogvagas_fee_per_panel_gross = coalesce(
    szogvagas_fee_per_panel_gross,
    round(coalesce(szogvagas_fee_per_panel, 0))
  ),
  panthelyfuras_fee_per_hole_gross = coalesce(
    panthelyfuras_fee_per_hole_gross,
    round(coalesce(panthelyfuras_fee_per_hole, 0))
  )
where fee_per_meter_gross is null
   or duplungolas_fee_per_sqm_gross is null
   or szogvagas_fee_per_panel_gross is null
   or panthelyfuras_fee_per_hole_gross is null;

alter table public.cutting_fees
  alter column fee_per_meter_gross set not null,
  alter column fee_per_meter_gross set default 0;

alter table public.cutting_fees
  alter column duplungolas_fee_per_sqm_gross set not null,
  alter column duplungolas_fee_per_sqm_gross set default 0;

alter table public.cutting_fees
  alter column szogvagas_fee_per_panel_gross set not null,
  alter column szogvagas_fee_per_panel_gross set default 0;

alter table public.cutting_fees
  alter column panthelyfuras_fee_per_hole_gross set not null,
  alter column panthelyfuras_fee_per_hole_gross set default 0;

alter table public.cutting_fees
  drop constraint if exists cutting_fees_fee_per_meter_gross_nonneg;
alter table public.cutting_fees
  add constraint cutting_fees_fee_per_meter_gross_nonneg
  check (fee_per_meter_gross >= 0);

alter table public.cutting_fees
  drop constraint if exists cutting_fees_duplungolas_fee_per_sqm_gross_nonneg;
alter table public.cutting_fees
  add constraint cutting_fees_duplungolas_fee_per_sqm_gross_nonneg
  check (duplungolas_fee_per_sqm_gross >= 0);

alter table public.cutting_fees
  drop constraint if exists cutting_fees_szogvagas_fee_per_panel_gross_nonneg;
alter table public.cutting_fees
  add constraint cutting_fees_szogvagas_fee_per_panel_gross_nonneg
  check (szogvagas_fee_per_panel_gross >= 0);

alter table public.cutting_fees
  drop constraint if exists cutting_fees_panthelyfuras_fee_per_hole_gross_nonneg;
alter table public.cutting_fees
  add constraint cutting_fees_panthelyfuras_fee_per_hole_gross_nonneg
  check (panthelyfuras_fee_per_hole_gross >= 0);
