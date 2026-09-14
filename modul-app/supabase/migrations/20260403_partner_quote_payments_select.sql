-- modul-app: partner olvashatja saját beküldött ajánlatainak befizetéseit
-- Depends on: 20260322_quote_payments, 20260331_partner_portal

drop policy if exists quote_payments_select_own_partner on public.quote_payments;
create policy quote_payments_select_own_partner
  on public.quote_payments
  for select
  to authenticated
  using (
    public.is_partner()
    and deleted_at is null
    and exists (
      select 1
      from public.quotes q
      where q.id = quote_payments.quote_id
        and q.tenant_id = quote_payments.tenant_id
        and q.partner_profile_id = auth.uid()
        and q.source = 'portal'
        and q.portal_submitted_at is not null
        and q.deleted_at is null
    )
  );

comment on policy quote_payments_select_own_partner on public.quote_payments is
  'Partner: csak saját, beküldött portal quote befizetései (olvasható).';
