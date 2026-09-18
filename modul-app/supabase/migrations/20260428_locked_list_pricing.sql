-- Listaárak: zárolt nettó marketing árak (Alap 22k, SMS 4.9k+89, partner 19k, címke 9.9k)

update public.product_plans
set price_monthly_huf = 22000, currency = 'HUF', updated_at = now()
where key = 'alap';

update public.product_addons
set
  price_monthly_huf = 9900,
  price_unit_huf = null,
  unit_key = null,
  currency = 'HUF',
  updated_at = now()
where key = 'product_labels';

update public.product_addons
set
  price_monthly_huf = 19000,
  price_unit_huf = null,
  unit_key = null,
  currency = 'HUF',
  updated_at = now()
where key = 'partner_orders';

update public.product_addons
set
  price_monthly_huf = 4900,
  price_unit_huf = 89,
  unit_key = 'sms_sent',
  currency = 'HUF',
  updated_at = now()
where key = 'quote_ready_sms';
