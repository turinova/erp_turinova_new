-- Performance indexes for brands table
create index if not exists idx_brands_deleted_name on brands (deleted_at, name);
create index if not exists idx_brands_deleted_created on brands (deleted_at, created_at desc);

-- Performance indexes for materials table  
create index if not exists idx_materials_deleted_name on materials (deleted_at, material_name);
create index if not exists idx_materials_deleted_created on materials (deleted_at, created_at desc);

-- Full text search indexes using pg_trgm extension
create extension if not exists pg_trgm;
create index if not exists idx_brands_name_trgm on brands using gin (name gin_trgm_ops) where deleted_at is null;
create index if not exists idx_materials_name_trgm on materials using gin (material_name gin_trgm_ops) where deleted_at is null;
create index if not exists idx_materials_brand_trgm on materials using gin (brand_name gin_trgm_ops) where deleted_at is null;

-- Composite indexes for common queries
create index if not exists idx_brands_active_name on brands (name) where deleted_at is null;
create index if not exists idx_materials_active_name on materials (material_name, brand_name) where deleted_at is null;

-- Permission system indexes
create index if not exists idx_user_permissions_user_id on user_permissions (user_id);
create index if not exists idx_user_permissions_page_id on user_permissions (page_id);
create index if not exists idx_pages_path on pages (path);

-- Comment on the indexes
comment on index idx_brands_deleted_name is 'Performance index for brands filtering by deleted_at and name';
comment on index idx_materials_deleted_created is 'Performance index for materials pagination by created_at';
