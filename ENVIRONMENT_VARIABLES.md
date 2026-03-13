# Environment Variables Guide

This document explains which environment variables are needed for each project in the multi-tenant SaaS system.

## Architecture Overview

- **Admin Database**: Central database that stores tenant metadata, subscriptions, and credit usage logs
- **Tenant Databases**: Separate databases for each tenant (customer)
- **shop-portal**: The main tenant application (where customers use the ERP)
- **admin-portal**: The admin panel for managing tenants

---

## 📦 shop-portal (Tenant Application)

**Purpose**: The main ERP application where tenants (customers) log in and use the system.

**Vercel Project**: Tenant project (e.g., `shop.turinova.hu`)

### Required Environment Variables:

```env
# Tenant's own database (for product data, users, etc.)
NEXT_PUBLIC_SUPABASE_URL=https://your-tenant-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-tenant-anon-key
# OR (alternative name)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-tenant-anon-key

# Admin Database credentials (for tenant lookup, subscriptions, credit tracking)
ADMIN_SUPABASE_URL=https://your-admin-project.supabase.co
ADMIN_SUPABASE_SERVICE_ROLE_KEY=your-admin-service-role-key

# AI Features (Anthropic Claude)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Webhook URL (for ShopRenter order webhooks)
# Production: https://your-domain.com/api/webhooks/shoprenter
# Development (with ngrok): https://your-ngrok-url.ngrok.io/api/webhooks/shoprenter
NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.com/api/webhooks/shoprenter
```

### Why These Variables?

1. **Tenant Database (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)**: 
   - Used for the tenant's own data (products, users, categories, etc.)
   - Each tenant has their own database
   - This is the database where the tenant's users authenticate

2. **Admin Database (`ADMIN_SUPABASE_URL`, `ADMIN_SUPABASE_SERVICE_ROLE_KEY`)**:
   - Used to look up which tenant a user belongs to
   - Used to fetch subscription plans and credit limits
   - Used to track credit usage (stored in Admin DB for persistence)
   - **Service Role Key is required** to bypass RLS policies for admin operations

3. **AI API Key (`ANTHROPIC_API_KEY`)**:
   - Required for AI generation features (descriptions, meta fields, etc.)

### Important Notes:

- ❌ **You do NOT need to add all tenant database credentials** to Vercel
- ✅ Tenant databases are looked up dynamically from the Admin Database
- ✅ The `ADMIN_SUPABASE_SERVICE_ROLE_KEY` allows the app to query the Admin DB without RLS restrictions
- ✅ Each tenant's database connection details are stored in the `tenants` table in the Admin DB

---

## 🔧 admin-portal (Admin Panel)

**Purpose**: Admin interface for managing tenants, subscriptions, and credit balances.

**Vercel Project**: Admin project (e.g., `admin.turinova.hu`)

### Required Environment Variables:

```env
# Admin Database credentials (this is the ONLY database the admin portal uses)
NEXT_PUBLIC_SUPABASE_URL=https://your-admin-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-admin-anon-key
# OR (alternative name)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-admin-anon-key

# Service Role Key for admin operations (bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY=your-admin-service-role-key
```

### Why These Variables?

1. **Admin Database (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)**:
   - The admin portal ONLY connects to the Admin Database
   - It manages `tenants`, `tenant_subscriptions`, `subscription_plans`, `token_packs`, etc.
   - Admin users authenticate against the Admin Database

2. **Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)**:
   - Required for CRUD operations on tenants and subscriptions
   - Bypasses RLS policies for admin operations

### Important Notes:

- ❌ **You do NOT need tenant database credentials** in the admin portal
- ✅ The admin portal only manages metadata in the Admin Database
- ✅ Tenant databases are managed separately (each tenant has their own Supabase project)
- ✅ The admin portal stores tenant connection details (`supabase_url`, `supabase_anon_key`) in the `tenants` table, but doesn't connect to them directly

---

## 🔐 How Authentication Works

### shop-portal (Tenant Login):

1. User enters email/password
2. App queries **Admin Database** → `tenant_users` table to find which tenant the user belongs to
3. App retrieves tenant's database connection details from `tenants` table
4. App authenticates user against **Tenant Database** (the user's actual database)
5. Tenant context is stored in a cookie for subsequent requests

### admin-portal (Admin Login):

1. Admin enters email/password
2. App authenticates against **Admin Database** directly
3. App verifies user exists in `admin_users` table
4. Admin session is established in Admin Database

---

## 📋 Vercel Setup Checklist

### For shop-portal (Tenant Project):

- [ ] `NEXT_PUBLIC_SUPABASE_URL` → Tenant's Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Tenant's Supabase anon key
- [ ] `ADMIN_SUPABASE_URL` → Admin Database URL
- [ ] `ADMIN_SUPABASE_SERVICE_ROLE_KEY` → Admin Database service role key
- [ ] `ANTHROPIC_API_KEY` → Anthropic API key for AI features

### For admin-portal (Admin Project):

- [ ] `NEXT_PUBLIC_SUPABASE_URL` → Admin Database URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Admin Database anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → Admin Database service role key

---

## 🚨 Common Mistakes

1. **Adding tenant database credentials to admin-portal**: ❌ Not needed! Admin portal only uses Admin DB.

2. **Using anon key instead of service role key for admin operations**: ❌ Will fail due to RLS policies. Use `ADMIN_SUPABASE_SERVICE_ROLE_KEY` in shop-portal and `SUPABASE_SERVICE_ROLE_KEY` in admin-portal.

3. **Adding all tenant credentials to shop-portal**: ❌ Not needed! Tenant databases are looked up dynamically from Admin DB.

4. **Mixing up Admin DB and Tenant DB URLs**: ✅ Make sure `ADMIN_SUPABASE_URL` in shop-portal points to the Admin Database, not the tenant's database.

---

## 🔍 Verification

### Test shop-portal setup:

1. Check that login works (user is found in Admin DB's `tenant_users` table)
2. Check that subscription page loads (queries Admin DB for subscription)
3. Check that credit usage is tracked (writes to Admin DB's `tenant_credit_usage_logs`)

### Test admin-portal setup:

1. Check that login works (user is found in Admin DB's `admin_users` table)
2. Check that tenants list loads (queries Admin DB's `tenants` table)
3. Check that you can edit tenant subscriptions (updates Admin DB's `tenant_subscriptions`)

---

## 📚 Related Documentation

- `shop-portal/SETUP_SEPARATE_ADMIN_DB.md` - Detailed setup guide for Admin Database
- `admin-portal/README.md` - Admin portal setup instructions
- `shop-portal/MULTI_TENANT_IMPLEMENTATION.md` - Multi-tenant architecture details
