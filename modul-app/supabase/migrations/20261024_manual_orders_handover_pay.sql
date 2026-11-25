-- Kézi rendelés kiegészítés (20261023 után, ha az már lefutott):
--  • suppliers.color — beszállítói jelölőszín (várólista)
--  • manual_order_deposits.kind — előleg vs. átadáskor fizetett hátralék (Scanner minta)
--  • tenant_companies.po_email_intro — alap rendelési e-mail bevezető (ha a beszállítónak nincs sajátja)

alter table public.suppliers
  add column if not exists color text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suppliers_color_check') then
    alter table public.suppliers
      add constraint suppliers_color_check
      check (color is null or color in ('blue', 'teal', 'green', 'lime', 'amber', 'orange', 'rose', 'pink', 'violet', 'slate'));
  end if;
end $$;

alter table public.manual_order_deposits
  add column if not exists kind text not null default 'eloleg';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manual_order_deposits_kind_check') then
    alter table public.manual_order_deposits
      add constraint manual_order_deposits_kind_check check (kind in ('eloleg', 'atadas'));
  end if;
end $$;

alter table public.tenant_companies
  add column if not exists po_email_intro text;
