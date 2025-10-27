# Admin Portal Deployment Instructions

## ✅ Step 1: Push to Git (MANUAL)

```bash
cd /Volumes/T7/erp_turinova_new
git push origin main
```

Your changes are committed locally and ready to push!

---

## 🚀 Step 2: Create New Vercel Project

### **In Vercel Dashboard (vercel.com):**

1. **Click "Add New..." → "Project"**

2. **Import Git Repository**
   - Select your existing `erp_turinova_new` repository
   - Click "Import"

3. **Configure Project:**
   ```
   Project Name: turinova-admin-portal
   Framework Preset: Next.js (auto-detected)
   Root Directory: admin-portal ⚠️ CRITICAL - Click "Edit" and set this!
   Build Command: npm run build (auto-filled)
   Output Directory: .next (auto-filled)
   Install Command: npm install (auto-filled)
   ```

4. **Environment Variables** (Click "Add" for each):
   ```
   NEXT_PUBLIC_SUPABASE_URL
   Value: https://oatbbtbkerxogzvwicxx.supabase.co

   NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: <your-portal-anon-key>

   SUPABASE_SERVICE_ROLE_KEY
   Value: <your-portal-service-role-key>
   ```

5. **Click "Deploy"**
   - Wait 2-5 minutes for first build
   - Vercel will give you a URL like: `turinova-admin-portal.vercel.app`

---

## 🌐 Step 3: Add Custom Domain

### **After First Deployment:**

1. **In Vercel Project → Settings → Domains**

2. **Add Domain:**
   ```
   Enter: saas.turinova.hu
   Click "Add"
   ```

3. **Vercel will show DNS instructions:**
   ```
   Type: CNAME
   Name: saas
   Value: cname.vercel-dns.com
   ```

---

## 🔧 Step 4: Configure DNS (In Your Domain Registrar)

Add this record to your DNS settings:

```dns
Type: CNAME
Name: saas
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)
```

**Wait 5-30 minutes** for DNS propagation.

---

## ✅ Step 5: Verify Deployment

After DNS propagates:

### **Test URLs:**
- ✅ https://saas.turinova.hu/login
- ✅ https://saas.turinova.hu/home (after login)
- ✅ https://saas.turinova.hu/companies

### **Check SSL:**
- Green padlock icon should appear
- Certificate should be valid

---

## 🔐 Step 6: Create Admin User

### **In Supabase Dashboard (oatbbtbkerxogzvwicxx.supabase.co):**

1. **Authentication → Users → Add User**
   ```
   Email: admin@turinova.hu
   Password: (create a strong password)
   Auto Confirm User: Yes
   ```

2. **SQL Editor → New Query:**
   ```sql
   INSERT INTO public.admin_users (email, name, is_active)
   VALUES ('admin@turinova.hu', 'Admin User', true);
   ```

3. **Run the query**

---

## 📋 What You'll Have:

### **Three Deployed Apps:**
```
🌐 turinova.hu          → Customer Portal (existing)
🔧 app.turinova.hu      → Main ERP App (existing)
⚙️ saas.turinova.hu     → Admin Portal (NEW!)
```

### **Admin Portal Features:**
- ✅ Company management (list, add, edit, soft delete)
- ✅ Statistics dashboard
- ✅ Database template viewer & copier (1449 lines SQL)
- ✅ Download database template as .sql file
- ✅ Copy to clipboard functionality

---

## 🎯 Summary

**What was added:**
- 256 new files (admin-portal app)
- Complete database template with:
  - 46 tables
  - 21 custom functions
  - 36+ triggers
  - 2 views
  - Performance indexes
  - Sample data

**What you need to do:**
1. ✅ Push to Git: `git push origin main`
2. ✅ Create Vercel project with root: `admin-portal`
3. ✅ Add domain: `saas.turinova.hu`
4. ✅ Configure DNS CNAME
5. ✅ Create admin user in Supabase

---

## 🆘 Troubleshooting

### **Build fails:**
- Check that root directory is set to `admin-portal`
- Verify environment variables are set
- Check build logs in Vercel

### **Domain not working:**
- Wait 10-30 minutes for DNS
- Verify CNAME record is correct
- Check Vercel Domains tab for status

### **Can't login:**
- Make sure admin user is in `admin_users` table
- Check `is_active` is `true`
- Verify email matches exactly

---

**Need help?** Check the detailed `DEPLOYMENT_GUIDE.md` in the repo root.

