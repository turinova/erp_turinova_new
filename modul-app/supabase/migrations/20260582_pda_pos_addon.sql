-- PDA POS add-on: gombos kézi eladás + árellenőrzés (/pos/pda)
-- Függ az Alap pos entitlementtől (create_sale, műszak). Ár: 7900 Ft/hó.

insert into public.product_features (key, label, category, page_key, sort_order, active)
values
  (
    'pda_pos',
    'PDA POS',
    'Add-on',
    null,
    540,
    true
  ),
  (
    '/pos/pda',
    'PDA POS',
    'Pult',
    '/pos/pda',
    46,
    true
  )
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (
  key, name, description, active, price_monthly_huf, currency
)
values (
  'pda_pos',
  'PDA POS',
  'Gombos, scan-first eladás és árellenőrzés kézi eszközön (/pos/pda).',
  true,
  7900,
  'HUF'
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  price_monthly_huf = excluded.price_monthly_huf,
  currency = 'HUF',
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, v.feature_key
from public.product_addons a
cross join (
  values
    ('pda_pos'),
    ('/pos/pda')
) as v(feature_key)
where a.key = 'pda_pos'
  and exists (select 1 from public.product_features f where f.key = v.feature_key)
on conflict do nothing;
