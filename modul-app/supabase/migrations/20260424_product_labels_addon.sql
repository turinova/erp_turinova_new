-- Termék címkenyomtatás add-on (nem Alap plan)

insert into public.product_features (key, label, category, page_key, sort_order, active)
values (
  'product_labels',
  'Termék címkenyomtatás',
  'Add-on',
  null,
  510,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  category = excluded.category,
  page_key = excluded.page_key,
  sort_order = excluded.sort_order,
  active = true;

insert into public.product_addons (key, name, description, active)
values (
  'product_labels',
  'Termék címkenyomtatás',
  'Polccímke nyomtatás a Termékek listáról (33×25 mm, vonalkód).',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  updated_at = now();

insert into public.product_addon_features (addon_id, feature_key)
select a.id, 'product_labels'
from public.product_addons a
where a.key = 'product_labels'
on conflict do nothing;
