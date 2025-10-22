# Implementation Guide - Separate Apps Architecture

## 🎯 Goal
Transform the current structure into two separate Next.js applications while maintaining the same Git repository and production URLs.

---

## 📋 Pre-Implementation Checklist

- [ ] Main app is working on localhost:3000
- [ ] All changes are committed (or we're okay losing uncommitted changes)
- [ ] Backup database connection strings
- [ ] Have Vercel account ready
- [ ] Customer portal database schema already created

---

## 🚀 Implementation Steps

### STEP 1: Backup Current State (5 minutes)

```bash
# Create a backup branch
cd /Volumes/T7/erp_turinova_new
git checkout -b backup-before-restructure
git add .
git commit -m "backup: state before restructuring into separate apps"
git push origin backup-before-restructure

# Switch back to main
git checkout main
```

**Why**: Safety net in case we need to revert.

---

### STEP 2: Create Main App Directory (10 minutes)

```bash
cd /Volumes/T7/erp_turinova_new

# Create main-app directory
mkdir main-app

# Move all current app files to main-app/
mv src/ main-app/
mv public/ main-app/
mv package.json main-app/
mv package-lock.json main-app/
mv next.config.ts main-app/
mv tsconfig.json main-app/
mv tailwind.config.ts main-app/
mv postcss.config.mjs main-app/
mv next-env.d.ts main-app/

# Keep these in root:
# - docs/
# - supabase/
# - customer-portal/
# - *.md files
# - *.sql files

# Create main-app/.gitignore
cat > main-app/.gitignore << 'EOF'
# Dependencies
node_modules/

# Next.js
.next/
out/

# Production
build/

# Environment
.env
.env.local
.env.production

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
*.swp

# TypeScript
*.tsbuildinfo
EOF
```

---

### STEP 3: Clean Up Main App (5 minutes)

```bash
cd /Volumes/T7/erp_turinova_new/main-app

# Remove temporary customer portal files
rm -rf src/app/(blank-layout-pages)/customer/
rm -rf src/app/(blank-layout-pages)/register/
rm -f src/views/CustomerLogin.tsx
rm -f src/views/CustomerRegister.tsx
rm -f src/views/CustomerHome.tsx
rm -rf src/app/api/customer-portal/

# Restore original LandingPage.tsx (single button version)
# We'll do this manually in next step
```

**Restore `src/views/LandingPage.tsx`** to original (1 button):

```typescript
// main-app/src/views/LandingPage.tsx
// Change back to single button:
<Button 
  href='/login' 
  component={Link} 
  variant='contained' 
  size='large'
>
  Belépés vállalkozásoknak
</Button>
```

**Restore `src/middleware.ts`** to original:

```typescript
// Remove customer routes from publicRoutes
const publicRoutes = ['/', '/home', '/login']  // Remove '/register', '/customer/login'

// Remove isCustomerRoute logic
```

---

### STEP 4: Test Main App (5 minutes)

```bash
cd /Volumes/T7/erp_turinova_new/main-app

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

**Verify**:
- [ ] Main app runs on localhost:3000
- [ ] Login works at /login
- [ ] Dashboard loads at /home
- [ ] All existing features work

**Fix any errors before proceeding.**

---

### STEP 5: Initialize Customer Portal App (10 minutes)

```bash
cd /Volumes/T7/erp_turinova_new/customer-portal

# Remove old documentation-only files (keep docs for reference)
mkdir _old_docs
mv *.md _old_docs/
mv *.sql _old_docs/

# Initialize Next.js app
npx create-next-app@latest . --typescript --tailwind --app --no-src --yes

# The directory already has some files, that's okay
# It will create: app/, components/, lib/, etc.
```

---

### STEP 6: Install Customer Portal Dependencies (5 minutes)

```bash
cd /Volumes/T7/erp_turinova_new/customer-portal

# Supabase
npm install @supabase/ssr @supabase/supabase-js

# UI Framework (same as main app)
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled

# Forms and notifications
npm install react-toastify react-hook-form

# Optimization (same algorithm as main app)
npm install guillotine-packer

# Utilities
npm install classnames

# Dev dependencies
npm install -D @types/node
```

---

### STEP 7: Configure Customer Portal (10 minutes)

#### **Create `.env.local`:**

```bash
cat > .env.local << 'EOF'
# Customer Portal Supabase (oatbbtbkerxogzvwicxx)
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk1MjU5MiwiZXhwIjoyMDc2NTI4NTkyfQ.95wpFs18T3xwsR8TOPjuA-GgA9L0IdaLdtXxdQVp7KU
EOF
```

#### **Update `package.json`:**

```json
{
  "name": "turinova-customer-portal",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint"
  }
}
```

#### **Create `vercel.json`:**

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "framework": "nextjs",
  "installCommand": "npm install"
}
```

#### **Update `next.config.ts`:**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Production base path will be handled by Vercel rewrites
}

export default nextConfig
```

---

### STEP 8: Copy Shared Utilities (15 minutes)

```bash
cd /Volumes/T7/erp_turinova_new

# Copy optimization algorithms
cp -r main-app/src/lib/optimization/ customer-portal/lib/

# Copy pricing calculations
cp -r main-app/src/lib/pricing/ customer-portal/lib/

# Copy theme utilities
mkdir -p customer-portal/theme
cp -r main-app/src/@core/theme/ customer-portal/theme/core/

# Copy hooks
mkdir -p customer-portal/hooks
cp main-app/src/@core/hooks/useImageVariant.ts customer-portal/hooks/

# Copy Tailwind config
cp main-app/tailwind.config.ts customer-portal/

# Copy images
cp -r main-app/public/images/ customer-portal/public/
```

---

### STEP 9: Create Customer Portal Pages (20 minutes)

Follow the structure from `customer-portal/_old_docs/` but now in a clean Next.js app:

#### **File Structure:**
```
customer-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── home/
│   │   │   └── page.tsx
│   │   ├── quotes/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── companies/
│   │   └── quotes/
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
└── types/
```

We'll create these files step by step in the implementation.

---

### STEP 10: Test Customer Portal (10 minutes)

```bash
cd /Volumes/T7/erp_turinova_new/customer-portal

# Start server
npm run dev
# Should start on port 3001

# Verify in browser:
# http://localhost:3001
```

---

### STEP 11: Update Root Files (5 minutes)

#### **Create root `.gitignore`:**

```bash
cd /Volumes/T7/erp_turinova_new

cat > .gitignore << 'EOF'
# Dependencies
node_modules/
*/node_modules/
**/node_modules/

# Next.js
.next/
*/.next/
**/.next/
out/
*/out/

# Environment
.env
.env.local
.env.*.local
*/.env.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo
EOF
```

#### **Create root `README.md`:**

```markdown
# Turinova ERP System

This repository contains two separate Next.js applications:

## 📦 Applications

### Main App (`/main-app`)
Company staff ERP system for managing quotes, orders, and production.
- **Development**: http://localhost:3000
- **Production**: https://turinova.hu

### Customer Portal (`/customer-portal`)
Customer-facing portal for creating and submitting quotes.
- **Development**: http://localhost:3001
- **Production**: https://turinova.hu/customer (via rewrites)

## 🚀 Quick Start

### Main App
```bash
cd main-app
npm install
npm run dev  # Port 3000
```

### Customer Portal
```bash
cd customer-portal
npm install
npm run dev  # Port 3001
```

## 📚 Documentation
- [Separate Apps Architecture](./SEPARATE_APPS_ARCHITECTURE.md)
- [Main App Docs](./docs/main-app/)
- [Customer Portal Docs](./docs/customer-portal/)

## 🔧 Deployment
Both apps are deployed to Vercel with automatic deployments on push to main branch.
```

---

### STEP 12: Commit Restructured Code (5 minutes)

```bash
cd /Volumes/T7/erp_turinova_new

# Add all changes
git add .

# Commit
git commit -m "refactor: restructure into separate apps (main-app + customer-portal)"

# Push
git push origin main
```

---

### STEP 13: Deploy to Vercel (20 minutes)

#### **Deploy Main App:**

```bash
cd /Volumes/T7/erp_turinova_new

# Link to Vercel
vercel

# Follow prompts:
# - Set up and deploy: Yes
# - Which scope: [Your team]
# - Link to existing project: No
# - Project name: turinova-main-app
# - In which directory is your code located: main-app

# Deploy to production
vercel --prod
```

#### **Deploy Customer Portal:**

```bash
cd /Volumes/T7/erp_turinova_new

# Deploy customer portal
vercel

# Follow prompts:
# - Set up and deploy: Yes
# - Which scope: [Your team]
# - Link to existing project: No
# - Project name: turinova-customer-portal
# - In which directory is your code located: customer-portal

# Deploy to production
vercel --prod
```

#### **Configure Rewrites:**

1. Go to Vercel dashboard → turinova-main-app
2. Settings → General → scroll to vercel.json preview
3. Add `vercel.json` file to main-app/ with rewrites

---

## 🧪 Testing Checklist

### Development Testing

- [ ] Main app runs on port 3000
- [ ] Customer portal runs on port 3001
- [ ] Both apps can run simultaneously
- [ ] No port conflicts
- [ ] No cookie conflicts

### Production Testing

- [ ] Main app accessible at turinova.hu
- [ ] Customer portal accessible at turinova.hu/customer/home
- [ ] Rewrites working correctly
- [ ] Sessions persist correctly
- [ ] Both databases accessible

---

## 🔄 Rollback Plan

If something goes wrong:

```bash
# Option 1: Revert to backup branch
git checkout backup-before-restructure
git push origin main --force

# Option 2: Undo specific commits
git log  # Find commit hash
git revert <commit-hash>
git push origin main
```

---

## 📊 Before/After Comparison

### Before
```
erp_turinova_new/
├── src/                 (mixed main app + customer code)
├── package.json         (single app)
└── Run: npm run dev     (port 3000)
```

### After
```
erp_turinova_new/
├── main-app/
│   ├── src/            (only main app code)
│   └── package.json
├── customer-portal/
│   ├── app/            (only customer code)
│   └── package.json
└── Run both:
    Terminal 1: cd main-app && npm run dev        (port 3000)
    Terminal 2: cd customer-portal && npm run dev  (port 3001)
```

---

## ⏱️ Time Estimates

| Step | Time | Complexity |
|------|------|------------|
| 1. Backup | 5 min | Easy |
| 2. Create main-app/ | 10 min | Easy |
| 3. Clean up | 5 min | Easy |
| 4. Test main app | 5 min | Easy |
| 5. Init customer portal | 10 min | Easy |
| 6. Install deps | 5 min | Easy |
| 7. Configure | 10 min | Medium |
| 8. Copy utilities | 15 min | Medium |
| 9. Create pages | 20 min | Medium |
| 10. Test customer portal | 10 min | Easy |
| 11. Update root | 5 min | Easy |
| 12. Commit | 5 min | Easy |
| 13. Deploy | 20 min | Medium |

**Total: ~2 hours**

---

## 🎯 Success Criteria

### Development
- [x] Main app runs on port 3000
- [x] Customer portal runs on port 3001
- [x] Both can run simultaneously
- [x] No conflicts between apps

### Git
- [x] Both apps in same repository
- [x] Same commit/push workflow
- [x] Clean directory structure

### Production
- [x] Main app deployed to turinova.hu
- [x] Customer portal accessible via turinova.hu/customer/*
- [x] Rewrites working correctly
- [x] Both apps independently deployable

---

## 🔑 Key Points

1. **Same Repository** - No need for multiple repos
2. **Same Git Workflow** - Commit and push as before
3. **Independent Apps** - No code conflicts
4. **Unified URL** - Production uses rewrites
5. **Different Ports** - Development uses 3000 and 3001

---

## 📞 Support During Implementation

### Common Issues

**Issue**: "Module not found" errors in main app  
**Solution**: Run `npm install` in main-app/ directory

**Issue**: "Port 3000 already in use" for customer portal  
**Solution**: Customer portal uses port 3001 by default

**Issue**: "Can't access customer portal in production"  
**Solution**: Verify rewrites are configured in main-app/vercel.json

**Issue**: "Changes not deploying"  
**Solution**: Check Vercel project's root directory setting

---

## 🎓 Next Steps After Implementation

1. **Test both apps locally**
2. **Deploy to Vercel**
3. **Configure custom domain**
4. **Set up CI/CD** (optional)
5. **Implement customer features** (quote creation, etc.)

---

This guide provides step-by-step instructions for restructuring into separate applications while maintaining all benefits of a unified system.

