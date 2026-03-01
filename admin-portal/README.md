# Turinova Admin Portal

SaaS administration portal for managing companies, users, and database templates.

## 🚀 Deployment

**Domain:** `saas.turinova.hu`  
**Status:** Active

### Vercel Setup

1. **Create New Project in Vercel**
   - Import from Git repository
   - **Root Directory:** `admin-portal`
   - **Framework:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

2. **Environment Variables**
   ```
   NEXT_PUBLIC_SUPABASE_URL=<admin-portal-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<admin-portal-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<admin-portal-service-key>
   ```

3. **Domain Configuration**
   - Add custom domain: `saas.turinova.hu`
   - Configure DNS CNAME record:
     ```
     Type: CNAME
     Name: saas
     Value: cname.vercel-dns.com
     TTL: Auto
     ```

## 📋 Features

- **Company Management:** View, add, edit, soft delete companies
- **Statistics Dashboard:** Real-time metrics and analytics
- **Database Template:** Complete SQL schema for new company databases
- **Admin Authentication:** Secure email/password login

## 🗄️ Database

Uses separate Supabase database: `customer-portal-prod`

### Tables
- `companies` - SaaS client companies
- `portal_customers` - End customers
- `portal_quotes` - Customer quotes
- `admin_users` - Admin portal users

## 🔐 Admin User Setup

Create admin user in Supabase:

```sql
-- 1. Create user in Auth (via Supabase dashboard or SQL)
-- 2. Add to admin_users table
INSERT INTO public.admin_users (email, name, is_active)
VALUES ('admin@turinova.hu', 'Admin User', true);
```

## 🛠️ Development

### Setup

1. **Create `.env.local` file** in the `admin-portal` directory:
   ```bash
   cd admin-portal
   touch .env.local
   ```

2. **Add your Admin Database credentials** to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-admin-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-admin-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-admin-service-role-key
   ```
   
   These should point to your **Admin Database** (Turinova Admin Supabase project), NOT the tenant databases.

3. **Install dependencies and run**:
   ```bash
   npm install
   npm run dev
   ```

Server runs on: `http://localhost:3002`

## 📦 Database Template

The complete Turinova ERP database template is available at:
- File: `/public/database-template.sql`
- Access: Via "Database Template" button on home page

Template includes:
- 46 tables
- 21 custom functions
- 36+ triggers
- 2 views
- Performance indexes
- Sample data

## 🔗 Related Apps

- **Main App:** `app.turinova.hu` (ERP system)
- **Customer Portal:** `turinova.hu` (Customer facing)
- **Admin Portal:** `saas.turinova.hu` (This app)

