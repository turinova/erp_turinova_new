-- POS policy settings (tender / stock / discount / invoice) + register Teya overrides

-- ---------------------------------------------------------------------------
-- 1) Tenant policy columns
-- ---------------------------------------------------------------------------
alter table public.tenant_pos_settings
  add column if not exists allow_cash boolean not null default true,
  add column if not exists allow_card boolean not null default true,
  add column if not exists allow_split boolean not null default true,
  add column if not exists default_pay_mode text
    check (default_pay_mode is null or default_pay_mode in ('cash', 'card', 'split')),
  add column if not exists stock_policy text not null default 'warn'
    check (stock_policy in ('warn', 'block')),
  add column if not exists max_discount_percent integer not null default 100
    check (max_discount_percent >= 0 and max_discount_percent <= 100),
  add column if not exists show_invoice_button boolean not null default true,
  add column if not exists require_customer boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) Register-level Teya overrides (optional; empty = tenant default)
-- ---------------------------------------------------------------------------
alter table public.pos_registers
  add column if not exists teya_terminal_id text,
  add column if not exists teya_epos_instance_id text;
