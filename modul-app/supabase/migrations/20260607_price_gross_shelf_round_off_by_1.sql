-- Polcár off-by-1 javítás a 20260599 backfill után.
-- Csak ha stored = round(net×ÁFA) (backfill), és az utolsó két számjegy:
--   …01/11/21/…/91 → −1 (1501→1500, 31→30, 51→50)
--   …19/29/…/89/99 → +1 (79→80, 39→40, 1499→1500)
-- …09 kimarad (pl. 47109). price_net nem változik.

update public.accessories a
set
  price_gross = t.suggested_gross,
  updated_at = now()
from (
  with base as (
    select
      acc.id,
      acc.price_net::numeric as price_net,
      acc.price_gross::numeric as stored_gross,
      tax.rate_percent::numeric as vat,
      round(
        acc.price_net * (1 + coalesce(tax.rate_percent, 0) / 100.0)
      ) as from_net
    from public.accessories acc
    join public.tax_rates tax on tax.id = acc.tax_rate_id
    where acc.deleted_at is null
      and acc.price_gross is not null
  ),
  targets as (
    select
      b.id,
      case
        when mod(b.stored_gross::int, 100) in (1, 11, 21, 31, 41, 51, 61, 71, 81, 91)
          then b.stored_gross - 1
        when mod(b.stored_gross::int, 100) in (19, 29, 39, 49, 59, 69, 79, 89, 99)
          then b.stored_gross + 1
        else null
      end as suggested_gross,
      b.price_net,
      b.vat
    from base b
    where b.stored_gross = b.from_net
  )
  select
    id,
    suggested_gross
  from targets
  where suggested_gross is not null
    and suggested_gross > 0
    and mod(suggested_gross::int, 10) = 0
    and round(suggested_gross / (1 + vat / 100.0)) = round(price_net)
) t
where a.id = t.id
  and a.price_gross is distinct from t.suggested_gross;
