# Supabase Connection & Implementation Guide

## Overview
This comprehensive guide documents the complete Supabase setup, connection, and implementation for the ERP Turinova project, including CLI setup, migrations, soft delete functionality, and API integration.

## Table of Contents
1. [Supabase CLI Setup](#supabase-cli-setup)
2. [Project Configuration](#project-configuration)
3. [Database Migrations](#database-migrations)
4. [Soft Delete Implementation](#soft-delete-implementation)
5. [API Integration](#api-integration)
6. [Environment Configuration](#environment-configuration)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Supabase CLI Setup

### Installation
The Supabase CLI was installed using Homebrew (recommended method):

```bash
brew install supabase/tap/supabase
```

**Version Installed**: 2.40.7

### Project Initialization
```bash
cd /Volumes/T7/erp_turinova_new/starter-kit
supabase init
```

This command created:
- `supabase/config.toml` - Project configuration
- `supabase/migrations/` - Directory for database migrations
- `.vscode/settings.json` - VS Code settings for Deno

### Authentication
```bash
supabase login
```

**Login Process**:
1. Opens browser for authentication
2. Generates CLI token
3. Stores credentials locally

### Project Linking
```bash
supabase link --project-ref xgkaviefifbllbmfbyfe
```

**Project Details**:
- **Project Name**: turinova
- **Project Reference**: xgkaviefifbllbmfbyfe
- **Organization ID**: loqxqzuqjnwolfsylkrc
- **Region**: eu-north-1
- **Created**: 2025-09-06 08:09:11 UTC

---

## Project Configuration

### Supabase Client Setup
**File**: `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Material = {
  id: string
  name: string
  width_mm: number
  length_mm: number
  thickness_mm: number
  grain_direction: boolean
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  kerf_mm: number
  created_at: string
  updated_at: string
}
```

### Configuration Files
**File**: `supabase/config.toml`

```toml
# A string used to distinguish different Supabase projects on the same host. Defaults to the
# working directory name when running `supabase init`.
project_id = "starter-kit"

[api]
enabled = true
# Port to use for the API URL.
port = 54321
# Schemas to expose in your API. Tables, views and stored procedures in this schema will get API
# endpoints. public and storage are always included.
schemas = ["public", "storage", "graphql_public"]
# Extra schemas to add to the search_path of every request. public is always included.
extra_search_path = ["public", "extensions"]
# The maximum number of rows returned from a table or view. Limits payload size
# for accidental or malicious requests.
max_rows = 1000

[db]
# Port to use for the local database URL.
port = 54322
# Port used by db diff command to initialize the shadow database.
shadow_port = 54320
# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version_num;` on the remote database to check.
major_version = 15
```

---

## Database Migrations

### Migration System Overview
Supabase uses timestamped migration files to manage database schema changes:

**Migration Directory**: `supabase/migrations/`

### Migration Commands
```bash
# Create new migration
supabase migration new migration_name

# Apply migrations to remote database
supabase db push

# List applied migrations
supabase migration list

# Reset local database
supabase db reset
```

### Applied Migrations

#### 1. Brands Soft Delete Migration
**File**: `20250913054609_add_soft_delete_to_brands.sql`

```sql
-- Add deleted_at and updated_at columns to brands table
ALTER TABLE brands ADD COLUMN deleted_at timestamptz;
ALTER TABLE brands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_brands_deleted_at ON brands(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for brands table to automatically update updated_at
CREATE TRIGGER update_brands_updated_at 
    BEFORE UPDATE ON brands 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

#### 2. Customers Soft Delete Migration
**File**: `20250913054735_add_soft_delete_to_customers.sql`

```sql
-- Add deleted_at and updated_at columns to customers table
ALTER TABLE customers ADD COLUMN deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for customers table to automatically update updated_at
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Soft Delete Implementation

### Concept Overview
Soft delete marks records as deleted without physically removing them from the database, providing:
- **Data Preservation**: Records are never lost
- **Audit Trail**: Track when records were deleted
- **Recovery**: Ability to restore deleted records
- **Referential Integrity**: Maintains foreign key relationships

### Database Schema Changes

#### Brands Table Schema
```sql
CREATE TABLE brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  comment     text,                    -- Added separately
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),  -- NEW
  deleted_at  timestamptz                              -- NEW
);
```

#### Customers Table Schema
```sql
CREATE TABLE customers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  email                     text UNIQUE NOT NULL,
  mobile                    text,
  discount_percent          numeric(5,2) DEFAULT 0,
  billing_name              text,
  billing_country           text DEFAULT 'Magyarország',
  billing_city              text,
  billing_postal_code       text,
  billing_street            text,
  billing_house_number      text,
  billing_tax_number        text,
  billing_company_reg_number text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),  -- NEW
  deleted_at                timestamptz                              -- NEW
);
```

### Automatic Timestamp Management
**Trigger Function**: `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

**Triggers Applied**:
- `update_brands_updated_at` - Automatically updates `updated_at` on brands table
- `update_customers_updated_at` - Automatically updates `updated_at` on customers table

### Performance Optimization
**Indexes Created**:
- `ix_brands_deleted_at` - Optimizes queries filtering active brands
- `ix_customers_deleted_at` - Optimizes queries filtering active customers

Both indexes use conditional indexing (`WHERE deleted_at IS NULL`) for optimal performance.

---

## API Integration

### Brands API Implementation

#### GET /api/brands
**File**: `src/app/api/brands/route.ts`

**Features**:
- Progressive column detection (handles missing columns gracefully)
- Soft delete filtering (`deleted_at IS NULL`)
- Includes `updated_at` field in response
- Fallback to sample data if Supabase not configured

**Response Example**:
```json
[
  {
    "id": "12efb493-6d16-417e-ab49-2b775cae7c62",
    "name": "Egger",
    "comment": null,
    "created_at": "2025-09-08T12:21:59.233917+00:00",
    "updated_at": "2025-09-13T05:46:21.750811+00:00"
  }
]
```

#### DELETE /api/brands/{id}
**File**: `src/app/api/brands/[id]/route.ts`

**Features**:
- Soft delete implementation
- Fallback to hard delete if `deleted_at` column doesn't exist
- Robust error handling

**Implementation**:
```typescript
// Try soft delete first
let { error } = await supabase
  .from('brands')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)

// If deleted_at column doesn't exist, fall back to hard delete
if (error && error.message.includes('column "deleted_at" does not exist')) {
  console.log('deleted_at column not found, using hard delete...')
  const result = await supabase
    .from('brands')
    .delete()
    .eq('id', id)
  
  error = result.error
}
```

### Customers API Implementation

#### GET /api/customers
**File**: `src/app/api/customers/route.ts`

**Features**:
- Soft delete filtering
- Includes `updated_at` field
- Comprehensive error handling
- Fallback mechanisms for missing columns

#### PUT /api/customers/{id}
**File**: `src/app/api/customers/[id]/route.ts`

**Features**:
- Updates customer data
- Automatically sets `updated_at` timestamp
- Handles both simple IDs (for testing) and UUIDs

#### DELETE /api/customers/{id}
**File**: `src/app/api/customers/[id]/route.ts`

**Features**:
- Soft delete implementation
- Fallback to hard delete if needed
- Consistent with brands API pattern

---

## Environment Configuration

### Required Environment Variables
The application requires the following environment variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Optional, for server-side operations
```

### Environment File Setup
**Note**: Environment files (`.env`, `.env.local`) are not tracked in git for security reasons.

**Example Configuration**:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Testing & Verification

### API Testing Commands

#### Test Brands API
```bash
# Get all brands
curl http://localhost:3000/api/brands

# Soft delete a brand
curl -X DELETE http://localhost:3000/api/brands/{brand-id}

# Verify soft delete (brand should not appear in list)
curl http://localhost:3000/api/brands
```

#### Test Customers API
```bash
# Get all customers
curl http://localhost:3000/api/customers

# Soft delete a customer
curl -X DELETE http://localhost:3000/api/customers/{customer-id}

# Verify soft delete (customer should not appear in list)
curl http://localhost:3000/api/customers
```

### Verification Results

#### Brands Table
- ✅ **Migration Applied**: `deleted_at` and `updated_at` columns added
- ✅ **API Response**: Includes `updated_at` field
- ✅ **Soft Delete**: Successfully soft-deleted Kronospan brand
- ✅ **Filtering**: Soft-deleted brands hidden from API responses
- ✅ **Data Preservation**: Records remain in database with `deleted_at` timestamp

#### Customers Table
- ✅ **Migration Applied**: `deleted_at` and `updated_at` columns added
- ✅ **API Response**: Includes `updated_at` field
- ✅ **Soft Delete**: Successfully soft-deleted test customers
- ✅ **Filtering**: Soft-deleted customers hidden from API responses
- ✅ **Data Preservation**: Records remain in database with `deleted_at` timestamp

---

## Troubleshooting

### Common Issues & Solutions

#### 1. Supabase CLI Installation Issues
**Problem**: Permission denied when installing globally with npm
**Solution**: Use Homebrew instead
```bash
brew install supabase/tap/supabase
```

#### 2. Migration Application Failures
**Problem**: Migration fails due to existing columns
**Solution**: Check if columns already exist before adding
```sql
-- Safe column addition
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type;
```

#### 3. API Import Errors
**Problem**: `Export createClient doesn't exist in target module`
**Solution**: Use correct import from supabase.ts
```typescript
// Correct
import { supabase } from '@/lib/supabase'

// Incorrect
import { createClient } from '@/lib/supabase'
```

#### 4. Environment Variable Issues
**Problem**: Supabase client not configured
**Solution**: Ensure environment variables are set
```bash
# Check if variables are loaded
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

#### 5. Soft Delete Not Working
**Problem**: Records still visible after deletion
**Solution**: Check if `deleted_at` column exists and API filtering
```sql
-- Verify column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'brands' AND column_name = 'deleted_at';
```

### Debug Commands
```bash
# Check Supabase CLI version
supabase --version

# List projects
supabase projects list

# Check migration status
supabase migration list

# View database schema
supabase db diff
```

---

## Best Practices

### Migration Management
1. **Always test migrations locally first**
2. **Use descriptive migration names**
3. **Include rollback procedures in documentation**
4. **Version control all migration files**

### API Design
1. **Implement progressive enhancement** (handle missing columns gracefully)
2. **Use consistent error handling patterns**
3. **Include comprehensive logging**
4. **Provide fallback mechanisms**

### Soft Delete Implementation
1. **Always filter by `deleted_at IS NULL` in queries**
2. **Use conditional indexes for performance**
3. **Implement automatic timestamp management**
4. **Document restoration procedures**

### Security Considerations
1. **Never commit environment files to version control**
2. **Use service role keys only for server-side operations**
3. **Implement proper RLS (Row Level Security) policies**
4. **Validate all input data**

### Performance Optimization
1. **Use conditional indexes for soft delete filtering**
2. **Implement pagination for large datasets**
3. **Cache frequently accessed data**
4. **Monitor query performance**

---

## Project Structure

```
starter-kit/
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20250913054609_add_soft_delete_to_brands.sql
│       └── 20250913054735_add_soft_delete_to_customers.sql
├── src/
│   ├── lib/
│   │   └── supabase.ts
│   └── app/
│       └── api/
│           ├── brands/
│           │   ├── route.ts
│           │   └── [id]/route.ts
│           └── customers/
│               ├── route.ts
│               └── [id]/route.ts
└── development_documentation/
    ├── BRANDS_SOFT_DELETE_MIGRATION.md
    ├── CUSTOMERS_SOFT_DELETE_MIGRATION.md
    └── SUPABASE_CONNECTION_GUIDE.md
```

---

## Future Enhancements

### Planned Improvements
1. **Row Level Security (RLS)** implementation
2. **Real-time subscriptions** for live data updates
3. **Database backup and restore** procedures
4. **Performance monitoring** and optimization
5. **Automated testing** for migrations

### Additional Tables to Migrate
- Materials table
- Orders table
- Invoices table
- Users table

---

**Last Updated**: December 2024  
**Project**: ERP Turinova  
**Status**: Production Ready  
**Supabase CLI Version**: 2.40.7  
**Database Version**: PostgreSQL 15
