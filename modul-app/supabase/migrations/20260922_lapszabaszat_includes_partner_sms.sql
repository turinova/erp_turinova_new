-- A Lapszabászat havi díja tartalmazza a partnerfiókot és az SMS funkciót.
-- Az SMS-nek nincs külön havidíja; csak a kiküldött üzenetek után fizetendő.

update public.product_addons
set
  price_monthly_huf = 0,
  price_unit_huf = null,
  unit_key = null,
  description = 'A partner saját fiókból küldi be a lapszabászati rendelést.',
  updated_at = now()
where key = 'partner_orders';

update public.product_addons
set
  price_monthly_huf = 0,
  price_unit_huf = 89,
  unit_key = 'sms_sent',
  description = 'SMS az ügyfélnek, amikor elkészült a rendelése.',
  updated_at = now()
where key = 'quote_ready_sms';

-- A már Lapszabászatot használó cégeknél kapcsoljuk be a csomag részeit.
insert into public.tenant_addons (tenant_id, addon_id, enabled_at)
select core_ta.tenant_id, included.id, now()
from public.tenant_addons core_ta
join public.product_addons core on core.id = core_ta.addon_id
cross join public.product_addons included
where core.key = 'lapszabaszat'
  and included.key in ('partner_orders', 'quote_ready_sms')
on conflict (tenant_id, addon_id) do nothing;

-- Az újonnan bekapcsolt csomagrészek jogosultságait is materializáljuk.
insert into public.tenant_entitlements (tenant_id, feature_key)
select ta.tenant_id, paf.feature_key
from public.tenant_addons ta
join public.product_addons addon on addon.id = ta.addon_id
join public.product_addon_features paf on paf.addon_id = addon.id
where addon.key in ('partner_orders', 'quote_ready_sms')
on conflict do nothing;
