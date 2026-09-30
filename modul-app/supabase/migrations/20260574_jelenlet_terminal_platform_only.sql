-- Jelenlét terminál: csak platform kezeli (tenant UI / jog / RLS write el)

-- Tenant page access + entitlement visszavonás
delete from public.tenant_membership_page_access
where page_key = '/jelenlet/terminalok';

delete from public.tenant_entitlements
where feature_key = '/jelenlet/terminalok';

delete from public.product_addon_features
where feature_key = '/jelenlet/terminalok';

update public.product_features
set active = false
where key = '/jelenlet/terminalok';

-- Tenant tagok ne írjanak / olvassanak eszközöket — service-role scan + platform admin
drop policy if exists jelenlet_devices_select_member on public.jelenlet_devices;
drop policy if exists jelenlet_devices_insert_member on public.jelenlet_devices;
drop policy if exists jelenlet_devices_update_member on public.jelenlet_devices;
drop policy if exists jelenlet_devices_delete_member on public.jelenlet_devices;
