-- Új ügyfél: értékelés-kérő SMS hozzájárulás alapból bekapcsolva (minden létrehozási útvonal,
-- a partner ensure_partner_customer RPC is). Meglévő ügyfelek nem változnak.

alter table public.customers
  alter column review_sms_consent set default true;

create or replace function public.customers_review_consent_stamp()
returns trigger
language plpgsql
as $$
begin
  if new.review_sms_consent and new.review_sms_consent_at is null then
    new.review_sms_consent_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists customers_review_consent_stamp on public.customers;
create trigger customers_review_consent_stamp
  before insert on public.customers
  for each row execute function public.customers_review_consent_stamp();
