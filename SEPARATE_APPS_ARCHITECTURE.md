# Separate Apps Architecture - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Directory Structure](#directory-structure)
4. [Development Workflow](#development-workflow)
5. [Git Workflow](#git-workflow)
6. [Deployment Strategy](#deployment-strategy)
7. [URL Routing](#url-routing)
8. [Environment Configuration](#environment-configuration)
9. [Database Architecture](#database-architecture)
10. [Migration Plan](#migration-plan)
11. [Production Setup](#production-setup)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### Problem Statement
Initially attempted to integrate the customer portal into the main ERP application, which caused:
- Middleware conflicts (auth session issues)
- Cookie conflicts (two different Supabase projects)
- Route conflicts (shared routes)
- Complex maintenance (tightly coupled code)

### Solution
Create two **separate Next.js applications** in the same Git repository:
1. **Main App** - Company staff ERP system
2. **Customer Portal** - Customer-facing quote system

Both apps share the same domain in production via Vercel rewrites.

---

## 🏗️ Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Git Repository (erp_turinova_new)            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐   ┌─────────────────────────┐    │
│  │   Main App          │   │   Customer Portal       │    │
│  │   (Port 3000)       │   │   (Port 3001)           │    │
│  ├─────────────────────┤   ├─────────────────────────┤    │
│  │ src/                │   │ app/                    │    │
│  │ package.json        │   │ package.json            │    │
│  │ next.config.ts      │   │ next.config.ts          │    │
│  │ vercel.json         │   │ vercel.json             │    │
│  └─────────────────────┘   └─────────────────────────┘    │
│           ↓                           ↓                     │
│  ┌─────────────────────┐   ┌─────────────────────────┐    │
│  │ Main Supabase DB    │   │ Customer Portal DB      │    │
│  │ (xgkaviefif...)     │   │ (oatbbtbker...)         │    │
│  └─────────────────────┘   └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Main App
- **Purpose**: Internal ERP for company staff
- **Users**: Admin, managers, staff
- **Database**: Main Supabase project
- **Port**: 3000 (dev), 443 (prod)
- **Routes**: `/home`, `/quotes`, `/customers`, etc.

#### Customer Portal
- **Purpose**: Customer-facing quote creation
- **Users**: End customers
- **Database**: customer-portal-prod Supabase
- **Port**: 3001 (dev), 443 (prod via rewrites)
- **Routes**: `/home`, `/quotes`, `/settings`, etc. (all prefixed with `/customer` in production)

---

## 📁 Directory Structure

### Current Structure (Before)
```
erp_turinova_new/
├── src/                    ← Main app code
├── package.json            ← Single package.json
├── next.config.ts
└── customer-portal/        ← Just documentation
```

### New Structure (After)
```
erp_turinova_new/
├── main-app/               ← Main ERP Application
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── views/
│   │   └── middleware.ts
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── vercel.json         ← Rewrite rules
│   └── .env.local
│
├── customer-portal/        ← Customer Portal Application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── home/
│   │   │   ├── quotes/
│   │   │   ├── orders/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── quotes/
│   │   │   ├── companies/
│   │   │   └── auth/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   └── forms/
│   ├── lib/
│   │   ├── supabase-client.ts
│   │   ├── supabase-server.ts
│   │   └── optimization/   ← Copy from main app
│   ├── public/
│   │   └── images/
│   ├── types/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── vercel.json
│   └── .env.local
│
├── docs/                   ← Shared documentation
├── supabase/               ← Main app migrations
└── README.md               ← Repository overview
```

---

## 💻 Development Workflow

### Starting Development Servers

```bash
# Terminal 1: Main App
cd erp_turinova_new/main-app
npm run dev
# → http://localhost:3000

# Terminal 2: Customer Portal
cd erp_turinova_new/customer-portal
npm run dev
# → http://localhost:3001
```

### Development URLs

| Application | URL | Purpose |
|------------|-----|---------|
| Main App | `http://localhost:3000` | Company staff development |
| Main App Login | `http://localhost:3000/login` | Staff login |
| Main App Home | `http://localhost:3000/home` | Staff dashboard |
| Customer Portal | `http://localhost:3001` | Customer development |
| Customer Login | `http://localhost:3001/login` | Customer login |
| Customer Home | `http://localhost:3001/home` | Customer dashboard |

**Note**: In development, each app runs independently on different ports.

---

## 🔄 Git Workflow

### Repository Structure

```
Branch: main
├── main-app/           (Main ERP)
├── customer-portal/    (Customer Portal)
├── docs/               (Shared docs)
└── README.md
```

### Commit Workflow

```bash
# 1. Make changes to either or both apps
cd erp_turinova_new

# 2. Check status
git status
# Shows changes in main-app/ and/or customer-portal/

# 3. Add changes
git add .
# OR add specific app
git add main-app/
git add customer-portal/

# 4. Commit (same as before!)
git commit -m "feat: add customer registration"

# 5. Push (same as before!)
git push origin main
```

### Example Commits

```bash
# Commit only main app changes
git add main-app/
git commit -m "fix: resolve quote calculation bug"
git push origin main

# Commit only customer portal changes
git add customer-portal/
git commit -m "feat: add quote submission"
git push origin main

# Commit both apps
git add .
git commit -m "feat: update branding in both apps"
git push origin main
```

### Branching Strategy

```bash
# Feature branches work the same
git checkout -b feature/customer-quotes
# Make changes to customer-portal/
git add customer-portal/
git commit -m "feat: implement quote creation"
git push origin feature/customer-quotes
# Create PR to main
```

---

## 🚀 Deployment Strategy

### Vercel Projects Setup

#### **Project 1: Main App**

```
Vercel Project Settings:
├── Name: turinova-main-app
├── Framework: Next.js
├── Root Directory: main-app/
├── Build Command: npm run build
├── Output Directory: .next
├── Install Command: npm install
└── Node Version: 18.x
```

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**Domain:**
```
Production: turinova.hu
Preview: main-app-git-main-yourname.vercel.app
```

#### **Project 2: Customer Portal**

```
Vercel Project Settings:
├── Name: turinova-customer-portal
├── Framework: Next.js
├── Root Directory: customer-portal/
├── Build Command: npm run build
├── Output Directory: .next
├── Install Command: npm install
└── Node Version: 18.x
```

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**Domain:**
```
Production: customer-portal.vercel.app
Custom: portal.turinova.hu (optional)
```

---

## 🔗 URL Routing

### Development URLs

| App | URL | Example |
|-----|-----|---------|
| Main App | `localhost:3000/*` | `localhost:3000/home` |
| Customer Portal | `localhost:3001/*` | `localhost:3001/home` |

### Production URLs (Option A: Rewrites)

Using `main-app/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/customer/:path*",
      "destination": "https://customer-portal.vercel.app/:path*"
    }
  ]
}
```

Result:
| User Visits | Serves From | Appears As |
|-------------|-------------|------------|
| `turinova.hu/home` | Main App | `turinova.hu/home` |
| `turinova.hu/customer/home` | Customer Portal | `turinova.hu/customer/home` |
| `turinova.hu/customer/login` | Customer Portal | `turinova.hu/customer/login` |

### Production URLs (Option B: Subdomain)

Alternative setup without rewrites:

| App | URL | Users |
|-----|-----|-------|
| Main App | `erp.turinova.hu` | Company staff |
| Customer Portal | `portal.turinova.hu` | Customers |

**Pros**: Cleaner separation, easier DNS management
**Cons**: Different domains (still acceptable)

---

## ⚙️ Environment Configuration

### Main App `.env.local`

```bash
# Main App Supabase (xgkaviefifbllbmfbyfe)
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhna2F2aWVmaWZibGxibWZieWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNDYxNTEsImV4cCI6MjA3MjcyMjE1MX0.EQFv5-iHscXMhU73oV7f90xmB8g8gr3YJ_-4ROQJ-AY
SUPABASE_SERVICE_ROLE_KEY=your-main-app-service-role-key
```

### Customer Portal `.env.local`

```bash
# Customer Portal Supabase (oatbbtbkerxogzvwicxx)
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk1MjU5MiwiZXhwIjoyMDc2NTI4NTkyfQ.95wpFs18T3xwsR8TOPjuA-GgA9L0IdaLdtXxdQVp7KU
```

### Shared Environment Variables

Neither app needs to know about the other's database credentials. Complete isolation.

---

## 🗄️ Database Architecture

### Main App Database (xgkaviefifbllbmfbyfe.supabase.co)

**Tables:**
- `auth.users` - Company staff accounts
- `customers` - End customer records (for invoicing)
- `quotes` - All quotes (including customer-submitted)
- `materials`, `accessories`, `edge_materials` - Product catalog
- `orders`, `production_machines`, etc. - ERP functionality

**New Fields:**
- `quotes.source` - VARCHAR(20) - Values: 'internal' or 'customer_portal'

### Customer Portal Database (oatbbtbkerxogzvwicxx.supabase.co)

**Tables:**
- `auth.users` - Customer accounts (separate from main app)
- `portal_customers` - Customer profile data
- `companies` - Registry of companies customers can connect to
- `portal_quotes` - Customer quotes (before submission)
- `portal_quote_panels` - Panel specifications
- `portal_quote_materials_pricing` - Optimization results
- `portal_quote_edge_materials_breakdown` - Edge costs
- `portal_quote_services_breakdown` - Service costs
- `portal_quote_accessories` - Accessories
- `portal_quote_fees` - Fees

### Data Flow

```
Customer creates quote in portal:
1. Data stored in portal_quotes (customer portal DB)
2. Status: 'draft'
3. Customer can edit freely

Customer submits quote:
1. Quote copied from portal_quotes → quotes (main app DB)
2. Set quotes.source = 'customer_portal'
3. Set portal_quotes.status = 'submitted'
4. portal_quotes.submitted_to_company_quote_id = quotes.id
5. Quote becomes read-only in portal

Company processes quote:
1. Staff sees quote in main app
2. Quote has source='customer_portal' indicator
3. Normal workflow continues

Status sync:
1. Background job periodically syncs status
2. Updates portal_quotes.status based on company quote status
3. Customer sees updated status in their orders page
```

---

## 📦 Migration Plan

### Phase 1: Move Current Main App Code

```bash
# 1. Create main-app directory
mkdir main-app

# 2. Move all current files to main-app/
mv src/ main-app/
mv public/ main-app/
mv package.json main-app/
mv package-lock.json main-app/
mv next.config.ts main-app/
mv tsconfig.json main-app/
mv tailwind.config.ts main-app/
mv postcss.config.mjs main-app/
mv next-env.d.ts main-app/
# Keep: docs/, supabase/, customer-portal/ in root

# 3. Create main-app/.gitignore
echo "node_modules/" > main-app/.gitignore
echo ".next/" >> main-app/.gitignore
echo ".env.local" >> main-app/.gitignore

# 4. Remove temporary customer portal files from main-app/
rm -rf main-app/src/app/(blank-layout-pages)/customer/
rm -rf main-app/src/views/CustomerLogin.tsx
rm -rf main-app/src/views/CustomerRegister.tsx
rm -rf main-app/src/views/CustomerHome.tsx
rm -rf main-app/src/app/api/customer-portal/

# 5. Restore original LandingPage (single button)
# (Revert changes to main-app/src/views/LandingPage.tsx)
```

### Phase 2: Create Customer Portal Next.js App

```bash
# 1. Navigate to customer-portal directory
cd customer-portal

# 2. Initialize Next.js app
npx create-next-app@latest . --typescript --tailwind --app --no-src

# 3. Install dependencies
npm install @supabase/ssr @supabase/supabase-js
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install react-toastify
npm install guillotine-packer  # For optimization

# 4. Copy shared utilities from main app
cp -r ../main-app/src/lib/optimization/ ./lib/
cp -r ../main-app/src/lib/pricing/ ./lib/
cp ../main-app/src/@core/hooks/useImageVariant.ts ./hooks/

# 5. Copy theme configuration
cp -r ../main-app/src/@core/theme/ ./theme/
cp ../main-app/tailwind.config.ts ./
```

### Phase 3: Configure Customer Portal

```bash
# 1. Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EOF

# 2. Create vercel.json (for production path prefix)
cat > vercel.json << EOF
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev -- --port 3001",
  "framework": "nextjs"
}
EOF
```

### Phase 4: Update Git Configuration

```bash
# 1. Update .gitignore in root
cat > .gitignore << EOF
# Dependencies
node_modules/
*/node_modules/

# Next.js
.next/
*/.next/
out/
*/out/

# Environment
.env.local
*/.env.local
.env

# IDE
.vscode/
.idea/

# OS
.DS_Store
EOF

# 2. Verify structure
tree -L 2 -I 'node_modules|.next'
```

---

## 🌐 Production Setup

### Step 1: Deploy Main App to Vercel

```bash
# From repository root
cd erp_turinova_new

# Login to Vercel
vercel login

# Deploy main app
vercel --prod
# When prompted:
# - Set up and deploy: Yes
# - Which scope: Your team
# - Link to existing project: No
# - Project name: turinova-main-app
# - In which directory is your code located: main-app/
```

**Vercel Dashboard Settings:**
- Root Directory: `main-app/`
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Domain Setup:**
- Add domain: `turinova.hu`
- SSL: Auto (Let's Encrypt)

### Step 2: Deploy Customer Portal to Vercel

```bash
# From repository root
cd erp_turinova_new

# Deploy customer portal
vercel --prod
# When prompted:
# - Set up and deploy: Yes
# - Which scope: Your team
# - Link to existing project: No
# - Project name: turinova-customer-portal
# - In which directory is your code located: customer-portal/
```

**Vercel Dashboard Settings:**
- Root Directory: `customer-portal/`
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Default URL:** `turinova-customer-portal.vercel.app`

### Step 3: Configure Rewrites

Create `main-app/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/customer/:path*",
      "destination": "https://turinova-customer-portal.vercel.app/:path*"
    }
  ],
  "headers": [
    {
      "source": "/customer/:path*",
      "headers": [
        {
          "key": "X-Forwarded-Host",
          "value": "turinova.hu"
        }
      ]
    }
  ]
}
```

### Step 4: Test Production URLs

```
Main App:
✓ https://turinova.hu/home
✓ https://turinova.hu/quotes
✓ https://turinova.hu/login

Customer Portal (via rewrites):
✓ https://turinova.hu/customer/home
✓ https://turinova.hu/customer/login
✓ https://turinova.hu/customer/register

Customer Portal (direct - works but not used):
✓ https://turinova-customer-portal.vercel.app/home
```

---

## 🔐 Authentication & Sessions

### Main App Authentication

```typescript
// main-app/src/lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // Main app URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { /* ... */ }
      }
    }
  )
}
```

**Cookie Name**: `sb-xgkaviefifbllbmfbyfe-auth-token`

### Customer Portal Authentication

```typescript
// customer-portal/lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // Customer portal URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { /* ... */ }
      }
    }
  )
}
```

**Cookie Name**: `sb-oatbbtbkerxogzvwicxx-auth-token`

**No Conflicts**: Different cookie names, different domains (in dev), different Supabase projects.

---

## 📝 Code Sharing Strategy

### Shared Code (Copy Once)

These files can be copied from main app to customer portal:

```bash
# Optimization algorithms
cp -r main-app/src/lib/optimization/ customer-portal/lib/

# Pricing calculations
cp -r main-app/src/lib/pricing/ customer-portal/lib/

# UI theme
cp -r main-app/src/@core/theme/ customer-portal/theme/

# Tailwind config
cp main-app/tailwind.config.ts customer-portal/

# TypeScript config (with minor adjustments)
cp main-app/tsconfig.json customer-portal/
```

### Not Shared (Keep Separate)

- Middleware (different auth logic)
- API routes (different databases)
- Components (similar but customized)
- Navigation (different menu structure)

### When to Sync

If you update shared code (like optimization algorithm):
1. Update in main app
2. Copy to customer portal
3. Commit both changes
4. Single push

---

## 🔄 Continuous Integration

### GitHub Actions (Optional)

```yaml
# .github/workflows/deploy.yml
name: Deploy Both Apps

on:
  push:
    branches: [main]

jobs:
  deploy-main-app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: cd main-app && npm install && npm run build
      
  deploy-customer-portal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: cd customer-portal && npm install && npm run build
```

### Vercel Auto-Deploy

Vercel automatically detects changes:
- Changes in `main-app/` → Redeploys main app only
- Changes in `customer-portal/` → Redeploys customer portal only
- Changes in both → Deploys both

---

## 🧪 Testing Strategy

### Development Testing

```bash
# Terminal 1: Main App
cd main-app && npm run dev

# Terminal 2: Customer Portal
cd customer-portal && npm run dev -- --port 3001

# Terminal 3: Run tests
cd main-app && npm test
cd customer-portal && npm test
```

### Production Testing

```bash
# Test main app
curl https://turinova.hu/api/health

# Test customer portal (via rewrite)
curl https://turinova.hu/customer/api/health

# Test customer portal (direct)
curl https://turinova-customer-portal.vercel.app/api/health
```

---

## 🚨 Troubleshooting

### Issue: "Can't access /customer/* in development"

**Cause**: Rewrites only work in production  
**Solution**: Use `localhost:3001` directly in development

### Issue: "Session not persisting after login"

**Cause**: Different cookie domains in development  
**Solution**: Expected behavior - works fine in production

### Issue: "Changes not deploying"

**Cause**: Vercel might not detect changes in subdirectory  
**Solution**: Trigger manual deploy from Vercel dashboard

### Issue: "CORS errors when calling APIs"

**Cause**: Cross-origin requests between apps  
**Solution**: Add CORS headers in API routes

---

## 📊 Comparison: Before vs After

### Before (Shared App)

```
Pros:
- Single deployment
- Shared components

Cons:
- Middleware conflicts ❌
- Cookie conflicts ❌
- Route conflicts ❌
- Complex authentication ❌
- Tight coupling ❌
```

### After (Separate Apps)

```
Pros:
- No conflicts ✅
- Independent development ✅
- Clean separation ✅
- Easy to maintain ✅
- Scalable ✅

Cons:
- Two deployments (minimal effort)
- Need to copy shared code (rare updates)
```

---

## 🎯 Implementation Checklist

### Phase 1: Restructure Repository
- [ ] Create `main-app/` directory
- [ ] Move all current files to `main-app/`
- [ ] Create `main-app/.gitignore`
- [ ] Create `main-app/vercel.json`
- [ ] Test main app still works

### Phase 2: Create Customer Portal App
- [ ] Initialize Next.js in `customer-portal/`
- [ ] Install dependencies
- [ ] Copy shared utilities
- [ ] Configure environment variables
- [ ] Create `.gitignore`

### Phase 3: Implement Customer Portal Features
- [ ] Create login page
- [ ] Create registration page
- [ ] Create home page
- [ ] Create API routes
- [ ] Test locally on port 3001

### Phase 4: Deploy to Vercel
- [ ] Deploy main app (turinova.hu)
- [ ] Deploy customer portal (auto URL)
- [ ] Configure rewrites in main app
- [ ] Test production URLs
- [ ] Verify sessions work

### Phase 5: Cleanup
- [ ] Remove temporary customer files from main app
- [ ] Update documentation
- [ ] Create shared README
- [ ] Commit and push

---

## 📖 Documentation Structure

```
erp_turinova_new/
├── README.md                           ← Repository overview
├── SEPARATE_APPS_ARCHITECTURE.md       ← This document
├── docs/
│   ├── main-app/
│   │   ├── DEPLOYMENT.md
│   │   └── DEVELOPMENT.md
│   └── customer-portal/
│       ├── DEPLOYMENT.md
│       └── DEVELOPMENT.md
├── main-app/
│   └── README.md                       ← Main app specific
└── customer-portal/
    └── README.md                       ← Customer portal specific
```

---

## 🔮 Future Considerations

### Monorepo Tools (Optional)

For advanced management, consider:
- **Turborepo** - Better build caching
- **Nx** - Monorepo orchestration
- **pnpm workspaces** - Shared dependencies

### API Gateway (Advanced)

For complex integrations:
- Unified API layer
- Request routing
- Rate limiting
- Authentication proxy

### Shared Component Library (Future)

Create a shared package:
```
erp_turinova_new/
├── main-app/
├── customer-portal/
└── shared-components/    ← Shared UI library
    └── package.json
```

---

## 💰 Cost Implications

### Vercel Pricing

**Hobby (Free):**
- Unlimited deployments
- 2 projects included
- Perfect for development

**Pro ($20/month per member):**
- Unlimited projects
- Better performance
- Analytics
- Recommended for production

### Supabase Pricing

**Current Setup:**
- Main App: Pro tier ($25/month)
- Customer Portal: Pro tier ($25/month)
- **Total**: $50/month

**No change** from original plan - you already planned for 2 Supabase projects.

---

## 🎓 Best Practices

### 1. Keep Apps Independent
- Don't import code between apps
- Copy shared utilities when needed
- Each app should be self-contained

### 2. Use Environment Variables
- Never hardcode URLs or keys
- Use `.env.local` for local development
- Use Vercel env vars for production

### 3. Document Everything
- Each app has its own README
- Shared docs in root `docs/` folder
- Keep architecture docs updated

### 4. Version Control
- Semantic versioning for each app
- Tag releases: `main-app-v1.0.0`, `customer-portal-v1.0.0`
- Changelog for each app

### 5. Testing
- Unit tests in each app
- Integration tests for API interactions
- E2E tests for critical flows

---

## 📋 Summary

### What We're Building

**Two independent Next.js applications** in one Git repository:

1. **Main App** (`main-app/`)
   - Company staff ERP
   - Port 3000 (dev)
   - turinova.hu (prod)

2. **Customer Portal** (`customer-portal/`)
   - Customer quote system
   - Port 3001 (dev)
   - turinova.hu/customer/* (prod via rewrites)

### Why This Works

- ✅ Complete separation (no conflicts)
- ✅ Same Git repo (single source of truth)
- ✅ Same commit/push workflow
- ✅ Unified production URL
- ✅ Independent deployments
- ✅ Easy to maintain

### What Changes in Your Workflow

**Development:**
- Run 2 terminal windows instead of 1
- Test on different ports

**Git:**
- No change! Same commit/push process

**Deployment:**
- Deploy 2 Vercel projects instead of 1
- Add rewrite rule to main app

---

This architecture provides the best of both worlds: **separate apps with unified URLs**! 🚀

