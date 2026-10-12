-- POS miss → gyors felvétel / vonalkód hozzárendelés (tenant kapcsoló)

alter table public.tenant_pos_settings
  add column if not exists allow_pos_quick_create boolean not null default true;

comment on column public.tenant_pos_settings.allow_pos_quick_create is
  'Ha true: ismeretlen barcode / zero-hit → Gyors felvétel + hozzárendelés dialógus.';
