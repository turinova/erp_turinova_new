# Turinova Corpus Portal

Corpus management portal for managing corpus data and users.

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

Uses separate Supabase database: `corpus-portal-prod`

### Tables
- `users` - Corpus portal users

## 🔐 User Setup

Create user in Supabase:

```sql
-- 1. Create user in Auth (via Supabase dashboard or SQL)
-- 2. Add to users table
INSERT INTO public.users (id, email, full_name)
VALUES ('user-uuid-from-auth', 'user@turinova.hu', 'User Name');
```

## 🛠️ Development

```bash
cd corpus-portal
npm install
npm run dev
```

Server runs on: `http://localhost:3003`

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

