# 🚀 Turinova ERP Deployment & Git Workflow Documentation

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Git Repository Structure](#git-repository-structure)
3. [Vercel Project Configuration](#vercel-project-configuration)
4. [Deployment Workflow](#deployment-workflow)
5. [Git Commit Strategy](#git-commit-strategy)
6. [Database Migrations](#database-migrations)
7. [Domain Configuration](#domain-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## 🏗️ Architecture Overview

### **Two Separate Applications**
- **Main App (ERP)**: Admin panel for Turinova staff
- **Customer Portal**: Public-facing portal for customers

### **Deployment URLs**
- **Main App**: `https://app.turinova.hu`
- **Customer Portal**: `https://turinova.hu`

### **Database Architecture**
- **Main App**: Uses company-specific Supabase databases (multi-tenant)
- **Customer Portal**: Uses dedicated portal database (`oatbbtbkerxogzvwicxx.supabase.co`)

---

## 📁 Git Repository Structure

```
/Volumes/T7/erp_turinova_new/
├── main-app/                    # Main ERP Application
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── ...
│   ├── package.json
│   ├── next.config.ts
│   └── README.md
├── customer-portal/             # Customer Portal Application
│   ├── app/
│   │   ├── (dashboard)/
│   │   ├── api/
│   │   └── ...
│   ├── lib/
│   ├── package.json
│   ├── next.config.ts
│   └── README.md
├── supabase/                    # Database migrations
│   └── migrations/
├── docs/                        # Documentation
├── DEPLOYMENT_GUIDE.md
└── README.md
```

---

## ⚙️ Vercel Project Configuration

### **Main App Project**
```
Project Name: turinova-main-app
Root Directory: main-app
Framework: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=<main-app-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<main-app-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<main-app-service-key>
```

### **Customer Portal Project**
```
Project Name: turinova-customer-portal
Root Directory: customer-portal
Framework: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<portal-anon-key>
```

---

## 🚀 Deployment Workflow

### **Automatic Deployment (Recommended)**

Both projects are configured for **automatic deployment** on Git push:

1. **Developer pushes to `main` branch**
2. **Vercel detects the push**
3. **Both projects start building simultaneously**
4. **Each project builds from its respective root directory**

### **Manual Deployment Process**

If automatic deployment fails:

#### **Main App Manual Deployment**
1. Go to Vercel Dashboard → Main App Project
2. **Settings** → **General** → Verify Root Directory: `main-app`
3. **Deployments** → Click **"Redeploy"** (top button)
4. Wait for build to complete
5. Verify deployment at `https://app.turinova.hu`

#### **Customer Portal Manual Deployment**
1. Go to Vercel Dashboard → Customer Portal Project
2. **Settings** → **General** → Verify Root Directory: `customer-portal`
3. **Deployments** → Click **"Redeploy"** (top button)
4. Wait for build to complete
5. Verify deployment at `https://turinova.hu`

---

## 📝 Git Commit Strategy

### **Commit Message Format**
```
type: Brief description

Detailed explanation of changes:
- What was changed
- Why it was changed
- Any breaking changes

Technical details:
- Files modified
- Database changes
- API changes
```

### **Commit Types**
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions/changes
- `chore:` Maintenance tasks

### **Examples**

#### **Feature Addition**
```bash
git add .
git commit -m "feat: Add quote submission to customer portal

Features:
- Customer portal users can submit quotes to company database
- Automatic customer creation in company DB
- Quote status tracking from draft to submitted
- Integration with company's quote numbering system

Technical:
- New API route: /api/portal-quotes/submit
- Database migration: create_customer_portal_system_user.sql
- Cross-database operations for quote submission
- Error handling for failed submissions

Files modified:
- customer-portal/app/api/portal-quotes/submit/route.ts
- customer-portal/supabase/migrations/create_customer_portal_system_user.sql
- customer-portal/lib/supabase-server.ts"
```

#### **Bug Fix**
```bash
git add .
git commit -m "fix: Remove main-app pages from customer-portal

Problem:
- Customer portal had admin-only pages causing build errors
- Missing imports from deleted main-app components

Solution:
- Removed 25 admin page folders (accessories, brands, materials, etc.)
- Removed 30+ main-app API routes
- Fixed /orders/[order_id] to use PortalQuoteDetailClient
- Cleaned up unused component files

Result:
- Build now succeeds
- Clean separation between apps
- 186 files changed, 39,767 lines deleted"
```

#### **Documentation Update**
```bash
git add DEPLOYMENT_GUIDE.md
git commit -m "docs: Add comprehensive deployment workflow guide

Added detailed documentation covering:
- Git repository structure
- Vercel project configuration
- Deployment workflows (automatic and manual)
- Database migration procedures
- Domain configuration steps
- Troubleshooting common issues
- Best practices for development

This guide will help team members understand
the deployment process and avoid common pitfalls."
```

---

## 🗄️ Database Migrations

### **Customer Portal Database Migrations**

Run these in the **Customer Portal Supabase** (`oatbbtbkerxogzvwicxx.supabase.co`):

#### **1. Quote Number Generator**
```sql
-- File: customer-portal/supabase/migrations/create_portal_quote_number_generator.sql
CREATE OR REPLACE FUNCTION generate_portal_quote_number()
RETURNS TEXT AS $$
DECLARE
    current_year INTEGER;
    next_number INTEGER;
    quote_number TEXT;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 'PQ-' || current_year || '-(.*)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM portal_quotes
    WHERE quote_number LIKE 'PQ-' || current_year || '-%';
    
    quote_number := 'PQ-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN quote_number;
END;
$$ LANGUAGE plpgsql;
```

#### **2. RLS Policies**
```sql
-- File: customer-portal/supabase/migrations/create_portal_quotes_rls_policies.sql
-- Policies for portal_quotes table
CREATE POLICY "Portal customers can view their own quotes" ON portal_quotes
    FOR SELECT TO authenticated USING (portal_customer_id = auth.uid());

CREATE POLICY "Portal customers can insert their own quotes" ON portal_quotes
    FOR INSERT TO authenticated WITH CHECK (portal_customer_id = auth.uid());

CREATE POLICY "Portal customers can update their own quotes" ON portal_quotes
    FOR UPDATE TO authenticated USING (portal_customer_id = auth.uid());

CREATE POLICY "Portal customers can delete their own quotes" ON portal_quotes
    FOR DELETE TO authenticated USING (portal_customer_id = auth.uid());

-- Similar policies for portal_quote_panels, portal_quote_materials_pricing, etc.
```

### **Company Database Migrations**

Run these in **each company's Supabase database**:

#### **1. System User for Portal Submissions**
```sql
-- File: customer-portal/supabase/migrations/create_customer_portal_system_user.sql
-- Insert system user for portal quote submissions
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'customer-portal-system@turinova.hu',
    crypt('system-password', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;
```

#### **2. RLS Policies for Anonymous Access**
```sql
-- Allow anonymous read access to tenant_company
CREATE POLICY "Anonymous can read tenant company" ON tenant_company
    FOR SELECT TO anon USING (true);

-- Allow anonymous read access to cutting_fees
CREATE POLICY "Anonymous can read cutting fees" ON cutting_fees
    FOR SELECT TO anon USING (true);
```

---

## 🌐 Domain Configuration

### **DNS Records**

Configure these records in your DNS provider:

```dns
# Root domain → Customer Portal
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600

# Subdomain → Main App
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 3600
```

### **Vercel Domain Setup**

#### **Customer Portal Project**
1. Go to Vercel Dashboard → Customer Portal Project
2. **Settings** → **Domains**
3. **Add Domain:** `turinova.hu`
4. Follow DNS verification steps

#### **Main App Project**
1. Go to Vercel Dashboard → Main App Project
2. **Settings** → **Domains**
3. **Add Domain:** `app.turinova.hu`
4. Follow DNS verification steps

---

## 🔧 Troubleshooting

### **Build Failures**

#### **"Module not found" Errors**
```bash
# Problem: Importing non-existent modules
# Solution: Check if files exist in correct root directory

# Check main-app imports
ls -la main-app/src/lib/supabase-server.ts

# Check customer-portal imports
ls -la customer-portal/lib/supabase-server.ts
```

#### **"Root Directory" Issues**
```bash
# Problem: Wrong root directory in Vercel
# Solution: Update Vercel project settings

# Main App should have: Root Directory = "main-app"
# Customer Portal should have: Root Directory = "customer-portal"
```

### **Database Connection Issues**

#### **RLS Policy Errors**
```sql
-- Check if RLS policies exist
SELECT * FROM pg_policies WHERE tablename = 'portal_quotes';

-- Drop and recreate if needed
DROP POLICY IF EXISTS "Portal customers can view their own quotes" ON portal_quotes;
CREATE POLICY "Portal customers can view their own quotes" ON portal_quotes
    FOR SELECT TO authenticated USING (portal_customer_id = auth.uid());
```

#### **Missing System User**
```sql
-- Check if system user exists
SELECT * FROM auth.users WHERE id = 'c0000000-0000-0000-0000-000000000001';

-- Create if missing
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES ('c0000000-0000-0000-0000-000000000001', 'customer-portal-system@turinova.hu', 
        crypt('system-password', gen_salt('bf')), NOW());
```

### **Deployment Issues**

#### **Manual Redeploy**
```bash
# If automatic deployment fails
# 1. Check Vercel project settings
# 2. Verify root directory
# 3. Trigger manual redeploy
# 4. Check build logs for errors
```

#### **Environment Variables**
```bash
# Verify environment variables are set
# Main App: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# Customer Portal: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## ✅ Best Practices

### **Development Workflow**

1. **Always work in feature branches**
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   git add .
   git commit -m "feat: Add new feature"
   git push origin feature/new-feature
   # Create PR to main
   ```

2. **Test locally before pushing**
   ```bash
   # Test main app
   cd main-app
   npm run dev
   
   # Test customer portal
   cd customer-portal
   npm run dev
   ```

3. **Use descriptive commit messages**
   ```bash
   # Good
   git commit -m "fix: Resolve quote calculation error in customer portal"
   
   # Bad
   git commit -m "fix bug"
   ```

### **Deployment Checklist**

Before pushing to main:
- [ ] Code tested locally
- [ ] No console errors
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Documentation updated

After deployment:
- [ ] Both apps accessible
- [ ] Login functionality works
- [ ] Database connections working
- [ ] No 404 errors
- [ ] Performance acceptable

### **File Organization**

- **Keep apps separate**: Don't mix main-app and customer-portal files
- **Use consistent naming**: Follow existing patterns
- **Document changes**: Update README files when adding features
- **Version control**: Commit frequently with meaningful messages

---

## 📞 Support

### **Common Commands**

```bash
# Check deployment status
vercel ls

# View deployment logs
vercel logs [deployment-url]

# Check Git status
git status
git log --oneline -10

# Test local builds
cd main-app && npm run build
cd customer-portal && npm run build
```

### **Emergency Procedures**

1. **Rollback deployment**
   - Go to Vercel Dashboard
   - Find previous working deployment
   - Click "Promote to Production"

2. **Fix critical bugs**
   - Create hotfix branch
   - Make minimal changes
   - Test thoroughly
   - Deploy immediately

3. **Database issues**
   - Check RLS policies
   - Verify system user exists
   - Run missing migrations

---

**🎉 This documentation covers the complete deployment workflow for Turinova ERP!**

**Remember:**
- **Main App** = Admin panel (`app.turinova.hu`)
- **Customer Portal** = Public portal (`turinova.hu`)
- **Both deploy automatically** on Git push
- **Always test locally** before pushing
- **Keep apps separate** in the repository
