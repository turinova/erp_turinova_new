-- Marketing listaár sync: belépőszámláló 5 000 Ft nettó/hó
update public.product_addons
set
  price_monthly_huf = 5000,
  currency = 'HUF',
  description =
    'AI kamera belépőszámláló — havidíj + saját gyártású kamera egyszeri díja.',
  updated_at = now()
where key = 'footcounter';
