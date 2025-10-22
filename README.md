# Turinova ERP System

This repository contains two separate Next.js applications for the Turinova ERP system.

## 📦 Applications

### 1. Main App (`/main-app`)
**Company Staff ERP System**
- Manage quotes, orders, production
- Customer relationship management
- Inventory and material management
- Production planning

**Development**: `http://localhost:3000`  
**Production**: `https://turinova.hu`

### 2. Customer Portal (`/customer-portal`)
**Customer-Facing Quote System**
- Customer registration and login
- Quote creation with optimization
- Quote submission to company
- Order tracking

**Development**: `http://localhost:3001`  
**Production**: `https://turinova.hu/customer` (via rewrites)

---

## 🚀 Quick Start

### Main App
```bash
cd main-app
npm install
npm run dev  # Starts on port 3000
```

Visit: `http://localhost:3000`

### Customer Portal
```bash
cd customer-portal
npm install
npm run dev  # Starts on port 3001
```

Visit: `http://localhost:3001`

### Run Both Simultaneously

**Terminal 1:**
```bash
cd main-app && npm run dev
```

**Terminal 2:**
```bash
cd customer-portal && npm run dev
```

---

## 📚 Documentation

- **[Separate Apps Architecture](./SEPARATE_APPS_ARCHITECTURE.md)** - Complete architecture overview
- **[Implementation Guide](./IMPLEMENTATION_GUIDE.md)** - Step-by-step setup instructions
- **[FAQ](./SEPARATE_APPS_FAQ.md)** - Common questions and answers
- **[Customer Portal Architecture](./CUSTOMER_PORTAL_ARCHITECTURE.md)** - Detailed customer portal design

---

## 🗄️ Databases

### Main App Database
- **Project**: xgkaviefifbllbmfbyfe.supabase.co
- **Tables**: customers, quotes, materials, orders, etc.
- **Users**: Company staff (auth.users)

### Customer Portal Database
- **Project**: oatbbtbkerxogzvwicxx.supabase.co
- **Tables**: portal_customers, portal_quotes, companies
- **Users**: End customers (auth.users - separate)

---

## 🔄 Git Workflow

### Committing Changes

```bash
# Commit both apps
git add .
git commit -m "feat: update both applications"
git push origin main

# Commit only main app
git add main-app/
git commit -m "fix: resolve quote bug"
git push origin main

# Commit only customer portal
git add customer-portal/
git commit -m "feat: add settings page"
git push origin main
```

### Feature Branches

```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: implement feature"
git push origin feature/new-feature
# Create PR
```

---

## 🚀 Deployment

Both apps are deployed to Vercel from the same repository:

### Main App
- **Vercel Project**: turinova-main-app
- **Root Directory**: `main-app/`
- **Domain**: `turinova.hu`

### Customer Portal
- **Vercel Project**: turinova-customer-portal
- **Root Directory**: `customer-portal/`
- **Domain**: `customer-portal.vercel.app`
- **Accessed via**: `turinova.hu/customer/*` (rewrites)

---

## 🔧 Environment Variables

### Main App (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-main-app-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-main-app-service-role-key
```

### Customer Portal (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-customer-portal-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-customer-portal-service-role-key
```

---

## 📋 Project Structure

```
erp_turinova_new/
├── main-app/              # Main ERP Application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.local
│
├── customer-portal/       # Customer Portal Application
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── .env.local
│
├── docs/                  # Shared Documentation
├── supabase/              # Main App Migrations
└── README.md              # This file
```

---

## 🎯 Current Status

### Main App
- ✅ Fully functional
- ✅ All features working
- ✅ Deployed to production

### Customer Portal
- ✅ Authentication (login/register)
- ✅ Customer dashboard
- ⏳ Quote creation (Phase 2)
- ⏳ Quote submission (Phase 2)
- ⏳ Order tracking (Phase 2)

---

## 📞 Support

For questions or issues, refer to the documentation in `/docs` or contact the development team.

---

**Last Updated**: October 20, 2025

