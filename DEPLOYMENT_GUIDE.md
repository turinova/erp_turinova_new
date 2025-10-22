# Deployment Guide - Turinova ERP & Customer Portal

## 🎯 Deployment Architecture

**Customer Portal:** `turinova.hu` (root domain - public-facing)
**Main App (ERP):** `app.turinova.hu` (subdomain - staff only)

---

## 📋 Current State

- ✅ Git repository with both apps (`/main-app` and `/customer-portal`)
- ✅ Existing Vercel project deployed at `turinova.hu`
- ✅ DNS configured with registrar

---

## 🚀 Deployment Steps

### Step 1: Update Existing Vercel Project (Main App → app.turinova.hu)

**In Vercel Dashboard:**

1. Go to your existing project (currently at `turinova.hu`)
2. **Settings** → **General**
   - **Root Directory:** Set to `main-app`
   - Click **Save**

3. **Settings** → **Domains**
   - **Remove** `turinova.hu` domain (we'll use this for customer portal)
   - **Add** new domain: `app.turinova.hu`
   - Vercel will provide DNS instructions (CNAME record)

4. **Environment Variables** (if not already set):
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-main-app-db-url>
   SUPABASE_SERVICE_ROLE_KEY=<your-main-app-service-key>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-main-app-anon-key>
   ```

5. **Redeploy** → Settings → Deployments → Latest deployment → ... menu → Redeploy

---

### Step 2: Create New Vercel Project (Customer Portal → turinova.hu)

**In Vercel Dashboard:**

1. Click **Add New...** → **Project**
2. **Import Git Repository** (same repo as main app)
3. **Configure Project:**
   - **Project Name:** `turinova-customer-portal`
   - **Root Directory:** `customer-portal` ⚠️ CRITICAL
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `npm run build` (auto-filled)
   - **Output Directory:** `.next` (auto-filled)
   - **Install Command:** `npm install` (auto-filled)

4. **Environment Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-portal-anon-key>
   ```

5. Click **Deploy**

6. After first deployment, go to **Settings** → **Domains**
   - **Add Domain:** `turinova.hu`
   - Vercel will verify DNS (should already be configured)

---

### Step 3: Configure DNS in Registrar

Add the subdomain for the main app:

```dns
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 3600 (or auto)
```

The root domain (`@` or `turinova.hu`) should already point to Vercel from your existing setup.

---

### Step 4: Wait for SSL & Propagation

- **SSL Certificates:** Vercel auto-provisions (5-10 minutes)
- **DNS Propagation:** Can take 5 minutes to 48 hours
- **Check status:** Vercel Domains tab shows "Valid" when ready

---

## ✅ Verification

After deployment completes:

**Main App:**
```bash
curl https://app.turinova.hu
# Should return main app HTML

curl https://app.turinova.hu/api/health
# Should return health check if you have one
```

**Customer Portal:**
```bash
curl https://turinova.hu
# Should return customer portal HTML

curl https://turinova.hu/api/health
# Should return health check if you have one
```

**Browser Tests:**
- ✅ `https://app.turinova.hu/login` → Main app login
- ✅ `https://turinova.hu/login` → Customer portal login
- ✅ SSL certificates valid (green padlock)
- ✅ No mixed content warnings

---

## 🔄 Future Deployments

Every time you `git push origin main`:

1. Both Vercel projects detect the push
2. **Main App** project:
   - Builds from `/main-app` folder
   - Deploys to `app.turinova.hu`
3. **Customer Portal** project:
   - Builds from `/customer-portal` folder
   - Deploys to `turinova.hu`

**Selective Deployment (Advanced):**

If you only want to deploy one app, you can use Vercel's "Ignored Build Step" feature:

**Main App vercel.json:**
```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "ignoreCommand": "bash -c 'git diff HEAD^ HEAD --quiet ./main-app'"
}
```

This only deploys if files in `/main-app` changed. (Optional - not needed for now)

---

## 📝 Database Migrations Required

Before the customer portal works in production, run these SQL migrations:

### **Customer Portal Database** (oatbbtbkerxogzvwicxx.supabase.co):
1. ✅ `create_portal_quote_number_generator.sql`
2. ✅ `create_portal_quotes_rls_policies.sql`
3. ✅ `add_portal_quotes_delete_policy.sql`

### **Company Database** (e.g., Turinova ERP):
1. ✅ `create_customer_portal_system_user.sql` (creates system user)
2. ✅ RLS policy for `tenant_company` (allow anon read)
3. ✅ RLS policy for `cutting_fees` (allow anon read)

---

## 🎯 Deployment Timeline

**Preparation:** 10 minutes
- Commit code ✅
- Push to Git ✅
- Verify both apps build locally ✅

**Vercel Setup:** 20 minutes
- Update existing project (main app) → 5 min
- Create new project (customer portal) → 10 min
- Configure domains → 5 min

**DNS & SSL:** 10-60 minutes
- DNS propagation (varies)
- SSL certificate provisioning (automatic)

**Testing:** 10 minutes
- Verify both URLs work
- Test authentication
- Test quote creation/submission

**Total: 1-2 hours** (mostly waiting for DNS/SSL)

---

## ⚠️ Important Notes

1. **Both apps share the same Git repo** but deploy separately
2. **Root directory setting** is crucial - make sure it's correct
3. **Environment variables** are project-specific in Vercel
4. **Database migrations** must be run manually (not auto-deployed)
5. **First deployment** might take longer (dependency installation)

---

## 🆘 Troubleshooting

### Build Fails:
- Check root directory is set correctly
- Verify package.json exists in root directory
- Check build logs for errors

### Domain Not Working:
- Wait 5-10 minutes for DNS propagation
- Verify DNS records in registrar
- Check Vercel Domains tab for status

### 404 Errors:
- Clear browser cache
- Check that the correct app deployed to the domain
- Verify routing in app (should use relative URLs)

### Environment Variables Missing:
- Add them in Vercel project settings
- Redeploy after adding
- Check they're in the correct project

---

## 📞 Next Steps

Ready to proceed? Here's what we'll do:

1. ✅ Create vercel.json files (DONE)
2. Commit all changes to Git
3. Push to main branch
4. Update existing Vercel project settings
5. Create new Vercel project for customer portal
6. Configure domains
7. Test deployments

Let me know when you're ready to commit and I'll help you with the Git commands! 🚀

