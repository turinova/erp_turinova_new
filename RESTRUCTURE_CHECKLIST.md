# Restructure Implementation Checklist

Use this checklist while implementing the separate apps architecture.

---

## ✅ Pre-Implementation

- [ ] Read `SEPARATE_APPS_ARCHITECTURE.md`
- [ ] Read `SEPARATE_APPS_FAQ.md`
- [ ] Read `IMPLEMENTATION_GUIDE.md`
- [ ] Understand the architecture
- [ ] Ready to proceed (2 hours available)

---

## 📦 Step 1: Backup (5 minutes)

- [ ] Create backup branch
  ```bash
  git checkout -b backup-before-restructure
  git add .
  git commit -m "backup: before restructuring"
  git push origin backup-before-restructure
  git checkout main
  ```
- [ ] Verify backup exists on GitHub
- [ ] Note current working state

---

## 📁 Step 2: Create Main App Directory (10 minutes)

- [ ] Stop development server
- [ ] Create `main-app/` directory
  ```bash
  mkdir main-app
  ```
- [ ] Move files to `main-app/`:
  - [ ] `mv src/ main-app/`
  - [ ] `mv public/ main-app/`
  - [ ] `mv package.json main-app/`
  - [ ] `mv package-lock.json main-app/`
  - [ ] `mv next.config.ts main-app/`
  - [ ] `mv tsconfig.json main-app/`
  - [ ] `mv tailwind.config.ts main-app/`
  - [ ] `mv postcss.config.mjs main-app/`
  - [ ] `mv next-env.d.ts main-app/`
- [ ] Create `main-app/.gitignore`
- [ ] Verify files moved correctly

---

## 🧹 Step 3: Clean Main App (5 minutes)

- [ ] Remove customer portal files:
  ```bash
  cd main-app
  rm -rf src/app/(blank-layout-pages)/customer/
  rm -rf src/app/(blank-layout-pages)/register/
  rm -f src/views/CustomerLogin.tsx
  rm -f src/views/CustomerRegister.tsx
  rm -f src/views/CustomerHome.tsx
  rm -rf src/app/api/customer-portal/
  ```
- [ ] Restore `src/views/LandingPage.tsx` (remove extra buttons)
- [ ] Restore `src/middleware.ts` (remove customer routes)
- [ ] Verify no customer portal remnants

---

## 🧪 Step 4: Test Main App (5 minutes)

- [ ] Navigate to main-app: `cd main-app`
- [ ] Install dependencies: `npm install`
- [ ] Start server: `npm run dev`
- [ ] Open `http://localhost:3000`
- [ ] Verify landing page loads
- [ ] Test login at `/login`
- [ ] Test dashboard at `/home`
- [ ] All features working
- [ ] Stop server

---

## 🆕 Step 5: Initialize Customer Portal (10 minutes)

- [ ] Navigate to customer-portal: `cd ../customer-portal`
- [ ] Backup old docs:
  ```bash
  mkdir _old_docs
  mv *.md _old_docs/ 2>/dev/null || true
  mv *.sql _old_docs/ 2>/dev/null || true
  ```
- [ ] Remove old lib/types folders:
  ```bash
  rm -rf lib/ types/ app/ components/
  ```
- [ ] Initialize Next.js:
  ```bash
  npx create-next-app@latest . --typescript --tailwind --app --no-src --yes
  ```
- [ ] Verify Next.js files created

---

## 📦 Step 6: Install Dependencies (5 minutes)

- [ ] Install Supabase:
  ```bash
  npm install @supabase/ssr @supabase/supabase-js
  ```
- [ ] Install UI framework:
  ```bash
  npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
  ```
- [ ] Install utilities:
  ```bash
  npm install react-toastify classnames
  npm install guillotine-packer
  ```
- [ ] Verify all installed: `npm list`

---

## ⚙️ Step 7: Configure Customer Portal (10 minutes)

- [ ] Create `.env.local`:
  ```bash
  cat > .env.local << 'EOF'
  NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk1MjU5MiwiZXhwIjoyMDc2NTI4NTkyfQ.95wpFs18T3xwsR8TOPjuA-GgA9L0IdaLdtXxdQVp7KU
  EOF
  ```
- [ ] Update `package.json` dev script:
  ```json
  "dev": "next dev --port 3001"
  ```
- [ ] Create `vercel.json`
- [ ] Copy `tailwind.config.ts` from main app

---

## 📋 Step 8: Copy Shared Code (15 minutes)

- [ ] Copy optimization:
  ```bash
  cp -r ../main-app/src/lib/optimization/ ./lib/
  ```
- [ ] Copy pricing:
  ```bash
  cp -r ../main-app/src/lib/pricing/ ./lib/
  ```
- [ ] Copy theme:
  ```bash
  mkdir -p theme
  cp -r ../main-app/src/@core/theme/ ./theme/core/
  ```
- [ ] Copy hooks:
  ```bash
  mkdir -p hooks
  cp ../main-app/src/@core/hooks/useImageVariant.ts ./hooks/
  ```
- [ ] Copy images:
  ```bash
  cp -r ../main-app/public/images/ ./public/
  ```
- [ ] Verify all copied successfully

---

## 🎨 Step 9: Create Customer Portal Structure (20 minutes)

### Create Directories:
- [ ] `mkdir -p app/(auth)/login`
- [ ] `mkdir -p app/(auth)/register`
- [ ] `mkdir -p app/(dashboard)/home`
- [ ] `mkdir -p app/(dashboard)/quotes`
- [ ] `mkdir -p app/(dashboard)/settings`
- [ ] `mkdir -p app/api/auth`
- [ ] `mkdir -p app/api/companies`
- [ ] `mkdir -p app/api/quotes`
- [ ] `mkdir -p components/ui`
- [ ] `mkdir -p components/forms`
- [ ] `mkdir -p lib`
- [ ] `mkdir -p types`

### Create Core Files:
- [ ] `lib/supabase-client.ts`
- [ ] `lib/supabase-server.ts`
- [ ] `types/customer.ts`
- [ ] `app/layout.tsx`
- [ ] `app/page.tsx` (landing page)

We'll implement these in the next phase.

---

## 💻 Step 10: Implement Customer Portal Pages (30 minutes)

- [ ] Create login page (`app/(auth)/login/page.tsx`)
- [ ] Create register page (`app/(auth)/register/page.tsx`)
- [ ] Create home page (`app/(dashboard)/home/page.tsx`)
- [ ] Create API routes:
  - [ ] `/api/companies/route.ts`
  - [ ] `/api/auth/register/route.ts`
- [ ] Create components:
  - [ ] Login form
  - [ ] Registration stepper
  - [ ] Home dashboard

---

## 🧪 Step 11: Test Customer Portal (10 minutes)

- [ ] Start server: `npm run dev`
- [ ] Verify runs on port 3001
- [ ] Open `http://localhost:3001`
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test home page
- [ ] Fix any errors

---

## 🔄 Step 12: Test Both Apps Together (5 minutes)

### Terminal 1:
```bash
cd main-app
npm run dev  # Port 3000
```

### Terminal 2:
```bash
cd customer-portal
npm run dev  # Port 3001
```

### Browser:
- [ ] `localhost:3000` → Main app works
- [ ] `localhost:3001` → Customer portal works
- [ ] No conflicts
- [ ] Both can run simultaneously

---

## 📝 Step 13: Update Root Files (5 minutes)

- [ ] Create root `.gitignore`
- [ ] Create root `README.md`
- [ ] Update documentation references
- [ ] Create `docs/main-app/` folder
- [ ] Create `docs/customer-portal/` folder

---

## 💾 Step 14: Commit Changes (5 minutes)

```bash
cd /Volumes/T7/erp_turinova_new

# Review changes
git status

# Add all
git add .

# Commit
git commit -m "refactor: restructure into separate apps

- Split codebase into main-app/ and customer-portal/
- Main app: Company staff ERP (port 3000)
- Customer portal: Customer quote system (port 3001)
- Both apps independent but in same repo
- Same Git workflow maintained
- Resolves middleware and auth conflicts"

# Push
git push origin main
```

---

## 🚀 Step 15: Deploy to Vercel (20 minutes)

### Deploy Main App:
- [ ] `vercel` (link to new project)
- [ ] Project name: `turinova-main-app`
- [ ] Root directory: `main-app/`
- [ ] Add environment variables
- [ ] `vercel --prod`
- [ ] Verify deployment

### Deploy Customer Portal:
- [ ] `vercel` (link to new project)
- [ ] Project name: `turinova-customer-portal`
- [ ] Root directory: `customer-portal/`
- [ ] Add environment variables
- [ ] `vercel --prod`
- [ ] Verify deployment

### Configure Domain:
- [ ] Add `turinova.hu` to main app
- [ ] Add rewrites in `main-app/vercel.json`
- [ ] Test `turinova.hu/customer/home`

---

## ✅ Post-Implementation Verification

### Development:
- [ ] Main app works on localhost:3000
- [ ] Customer portal works on localhost:3001
- [ ] Both run simultaneously without conflicts
- [ ] Authentication works in both
- [ ] No cookie conflicts

### Git:
- [ ] Repository structure correct
- [ ] Both apps in same repo
- [ ] Documentation updated
- [ ] README clear

### Production:
- [ ] Main app deployed
- [ ] Customer portal deployed
- [ ] Rewrites working
- [ ] URLs correct
- [ ] Sessions working

---

## 🐛 Troubleshooting

### Main app won't start
- [ ] Check you're in `main-app/` directory
- [ ] Run `npm install`
- [ ] Check `.env.local` exists
- [ ] Check port 3000 is free

### Customer portal won't start
- [ ] Check you're in `customer-portal/` directory
- [ ] Run `npm install`
- [ ] Check `.env.local` exists
- [ ] Check port 3001 is free

### Can't commit to git
- [ ] Check `.gitignore` is correct
- [ ] Remove `node_modules/` from Git if tracked
- [ ] Run `git status` to see what's staged

### Vercel deployment fails
- [ ] Check root directory setting in Vercel
- [ ] Verify build command is correct
- [ ] Check environment variables are set
- [ ] Review build logs

---

## 📊 Success Metrics

After implementation, you should have:

- ✅ 2 working Next.js apps
- ✅ Same Git repository
- ✅ Independent development
- ✅ Unified production URLs
- ✅ No middleware conflicts
- ✅ Clean separation of concerns
- ✅ Easy to maintain
- ✅ Ready for Phase 2 features

---

## 🎯 Next Steps After Restructure

1. **Test thoroughly** - Both apps work independently
2. **Deploy to production** - Verify rewrites work
3. **Phase 2: Customer Features**:
   - Customer settings page
   - Quote creation (/opti clone)
   - Quote detail page
   - Quote submission
   - Order tracking

---

**Print this checklist and check off items as you go!** ✅

Good luck with the implementation! 🚀

