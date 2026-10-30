-- Új vonalkód lap: SKU off, ár on (füzet / fal — név + ár + vonalkód).
-- Meglévő sablonokat nem módosítjuk.

alter table public.a4_barcode_sheets
  alter column show_sku set default false;

alter table public.a4_barcode_sheets
  alter column show_price set default true;
